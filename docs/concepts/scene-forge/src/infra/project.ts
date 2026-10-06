import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  parse,
  fail,
  SceneSchema,
  ModelSchema,
  ModelBundleSchema,
  ProjectSchema,
  Id,
  type SceneDocument,
  type ModelLibrary,
  type ProjectDocument,
  type Operation,
} from '../domain/schema.js';
import { canonical } from '../domain/canonical.js';
import { errorCode } from '../domain/errors.js';
import { checkGuards, prepareSceneEdit, type EditOptions } from '../application/edit.js';
import { stateHash } from './state-hash.js';
import { readJson, writeJson, atomicWrite, inside, findProject, withLock } from './files.js';
// Compatibility exports for the original library API.
export { readJson, writeJson, atomicWrite, findProject, withLock } from './files.js';
export { stateHash } from './state-hash.js';
export type { EditOptions } from '../application/edit.js';
import { compileScene } from '../application/compiler.js';
import { captureModel, modelDependencies } from '../application/composition.js';

export interface Snapshot {
  root: string;
  manifest: ProjectDocument;
  scene: SceneDocument;
  models: ModelLibrary;
  stateHash: string;
}
export const newScene = (id: string, name = id) =>
  parse(SceneSchema, { schemaVersion: 1, kind: 'scene', id, name });
async function readManifest(root: string) {
  return parse(ProjectSchema, await readJson(path.join(root, 'forge.project.json')));
}
async function loadUnlocked(root: string, sceneId?: string): Promise<Snapshot> {
  const manifest = await readManifest(root);
  const id = sceneId ?? manifest.activeScene;
  if (!Object.hasOwn(manifest.scenes, id))
    fail('NOT_FOUND', `Scene ${id} is not registered.`, {
      available: Object.keys(manifest.scenes),
    });
  const scene = parse(SceneSchema, await readJson(await inside(root, manifest.scenes[id])));
  if (scene.id !== id)
    fail('ID_MISMATCH', `Scene file declares ${scene.id}, but is registered as ${id}.`);
  const models: ModelLibrary = {};
  for (const [mid, file] of Object.entries(manifest.models)) {
    const model = parse(ModelSchema, await readJson(await inside(root, file)));
    if (model.id !== mid)
      fail('ID_MISMATCH', `Model file declares ${model.id}, but is registered as ${mid}.`);
    models[mid] = model;
  }
  return { root, manifest, scene, models, stateHash: stateHash(scene, models) };
}
export async function loadProject(start: string, sceneId?: string) {
  const root = await findProject(start);
  return withLock(root, () => loadUnlocked(root, sceneId));
}
/** Load every scene against one model-library snapshot under the same project lock. */
export async function loadProjectScenes(start: string) {
  const root = await findProject(start);
  return withLock(root, async () => {
    const current = await loadUnlocked(root);
    const scenes: SceneDocument[] = [];
    for (const [id, relative] of Object.entries(current.manifest.scenes)) {
      const scene =
        id === current.scene.id
          ? current.scene
          : parse(SceneSchema, await readJson(await inside(root, relative)));
      if (scene.id !== id)
        fail('ID_MISMATCH', `Scene file declares ${scene.id}, but is registered as ${id}.`);
      scenes.push(scene);
    }
    return { root, manifest: current.manifest, models: current.models, scenes };
  });
}
export async function initProject(directory: string, name?: string) {
  const root = path.resolve(directory);
  await fs.mkdir(root, { recursive: true });
  return withLock(root, async () => {
    const manifestPath = path.join(root, 'forge.project.json');
    for (const file of [manifestPath, path.join(root, 'scenes/main.scene.json')]) {
      try {
        await fs.access(file);
        fail('ALREADY_EXISTS', `Initialization would overwrite ${file}. Choose a new directory.`);
      } catch (error) {
        if (errorCode(error) !== 'ENOENT') throw error;
      }
    }
    const manifest: ProjectDocument = {
      schemaVersion: 1,
      name: name ?? path.basename(root),
      activeScene: 'main',
      scenes: { main: 'scenes/main.scene.json' },
      models: {},
    };
    parse(ProjectSchema, manifest);
    await writeJson(path.join(root, 'scenes/main.scene.json'), newScene('main', 'Main scene'));
    await fs.mkdir(path.join(root, 'models'), { recursive: true });
    await fs.mkdir(path.join(root, 'exports'), { recursive: true });
    await writeJson(manifestPath, manifest);
    return { project: root, manifest };
  });
}
export async function createScene(start: string, id: string, name?: string) {
  parse(Id, id);
  const root = await findProject(start);
  return withLock(root, async () => {
    const manifest = await readManifest(root);
    if (Object.hasOwn(manifest.scenes, id)) fail('ALREADY_EXISTS', `Scene ${id} already exists.`);
    const relative = `scenes/${id}.scene.json`;
    try {
      await fs.access(path.join(root, relative));
      fail('ALREADY_EXISTS', `Unregistered scene file ${relative} already exists.`);
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
    }
    await writeJson(await inside(root, relative), newScene(id, name));
    manifest.scenes[id] = relative;
    await writeJson(path.join(root, 'forge.project.json'), manifest);
    return { id, path: relative };
  });
}
export async function useScene(start: string, id: string) {
  const root = await findProject(start);
  return withLock(root, async () => {
    const manifest = await readManifest(root);
    if (!Object.hasOwn(manifest.scenes, id)) fail('NOT_FOUND', `Scene ${id} does not exist.`);
    manifest.activeScene = id;
    await writeJson(path.join(root, 'forge.project.json'), manifest);
    return { activeScene: id };
  });
}
export async function commitOperations(
  start: string,
  sceneId: string | undefined,
  ops: Operation[],
  options: EditOptions = {},
) {
  const root = await findProject(start);
  return withLock(root, async () => {
    const snapshot = await loadUnlocked(root, sceneId);
    const { next, result } = prepareSceneEdit(snapshot, ops, options, stateHash);
    if (result.changed && !options.dryRun) {
      const { scene, manifest } = snapshot;
      await writeJson(await inside(root, `history/${scene.id}/${scene.revision}.json`), scene);
      await writeJson(await inside(root, manifest.scenes[scene.id]), next);
    }
    return result;
  });
}

export async function importModel(
  start: string,
  input: unknown,
  replace = false,
  options: EditOptions = {},
) {
  const data =
    input && typeof input === 'object' && 'kind' in input && input.kind === 'model-bundle'
      ? parse(ModelBundleSchema, input)
      : (() => {
          const m = parse(ModelSchema, input);
          return { entry: m.id, models: { [m.id]: m } };
        })();
  if (!Object.hasOwn(data.models, data.entry))
    fail('REFERENCE_MISSING', 'Bundle entry model is missing.');
  const root = await findProject(start);
  return withLock(root, async () => {
    const snapshot = await loadUnlocked(root);
    checkGuards(snapshot, options);
    return registerModels(root, data.models, data.entry, replace, snapshot, options.dryRun);
  });
}
async function registerModels(
  root: string,
  incoming: ModelLibrary,
  entry: string,
  replace: boolean,
  snapshot?: Snapshot,
  dryRun = false,
) {
  const current = snapshot ?? (await loadUnlocked(root));
  const manifest = structuredClone(current.manifest);
  for (const [id, model] of Object.entries(incoming)) {
    if (model.id !== id) fail('ID_MISMATCH', `Model ${model.id} is keyed as ${id}.`);
    if (
      Object.hasOwn(current.models, id) &&
      canonical(current.models[id]) !== canonical(model) &&
      !replace
    )
      fail(
        'ALREADY_EXISTS',
        `Model ${id} differs from the registered model. Use --replace deliberately.`,
      );
  }
  const library = { ...current.models, ...incoming };
  for (const model of Object.values(library)) {
    const built = compileScene(
      parse(SceneSchema, {
        schemaVersion: 1,
        kind: 'scene',
        id: 'validation',
        name: 'Validation',
        nodes: [{ type: 'model', id: 'root', model: model.id }],
      }),
      library,
    );
    built.dispose();
  }
  for (const file of Object.values(manifest.scenes)) {
    const built = compileScene(
      parse(SceneSchema, await readJson(await inside(root, file))),
      library,
    );
    built.dispose();
  }
  if (dryRun)
    return { id: entry, dryRun: true, models: Object.keys(incoming), model: incoming[entry] };
  const writes: { file: string; data: unknown; previous: Buffer | null }[] = [];
  for (const [id, model] of Object.entries(incoming)) {
    const relative = Object.hasOwn(manifest.models, id)
      ? manifest.models[id]
      : `models/${id}.model.json`;
    const file = await inside(root, relative);
    let previous: Buffer | null = null;
    try {
      previous = await fs.readFile(file);
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
    }
    if (!Object.hasOwn(manifest.models, id) && previous)
      fail('ALREADY_EXISTS', `Unregistered model file ${relative} exists.`);
    writes.push({ file, data: model, previous });
    manifest.models[id] = relative;
  }
  try {
    for (const write of writes) await writeJson(write.file, write.data);
    await writeJson(path.join(root, 'forge.project.json'), manifest);
  } catch (error) {
    for (const write of writes) {
      if (write.previous) await atomicWrite(write.file, write.previous);
      else await fs.rm(write.file, { force: true });
    }
    throw error;
  }
  return {
    id: entry,
    path: manifest.models[entry],
    parameters: library[entry].parameters,
    models: Object.keys(incoming),
    stateHash: stateHash(current.scene, library),
  };
}
export async function captureProjectModel(
  start: string,
  sceneId: string | undefined,
  roots: string[],
  id: string,
  name?: string,
  replace = false,
  options: EditOptions = {},
) {
  const root = await findProject(start);
  return withLock(root, async () => {
    const snapshot = await loadUnlocked(root, sceneId);
    checkGuards(snapshot, options);
    const model = captureModel(snapshot.scene, roots, id, name);
    const library = { ...snapshot.models, [id]: model };
    modelDependencies(library, id);
    return registerModels(root, { [id]: model }, id, replace, snapshot, options.dryRun);
  });
}
export async function cloneScene(
  start: string,
  sourceId: string | undefined,
  id: string,
  name?: string,
) {
  parse(Id, id);
  const root = await findProject(start);
  return withLock(root, async () => {
    const snapshot = await loadUnlocked(root, sourceId);
    if (Object.hasOwn(snapshot.manifest.scenes, id)) fail('ALREADY_EXISTS', `Scene ${id} exists.`);
    const relative = `scenes/${id}.scene.json`;
    const file = await inside(root, relative);
    try {
      await fs.access(file);
      fail('ALREADY_EXISTS', `${relative} exists.`);
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
    }
    const scene = {
      ...snapshot.scene,
      id,
      name: name ?? `${snapshot.scene.name} copy`,
      revision: 0,
    };
    await writeJson(file, scene);
    snapshot.manifest.scenes[id] = relative;
    await writeJson(path.join(root, 'forge.project.json'), snapshot.manifest);
    return { id, path: relative };
  });
}
export async function restoreScene(
  start: string,
  sceneId: string | undefined,
  revision: number,
  expectedRevision?: number,
) {
  const root = await findProject(start);
  return withLock(root, async () => {
    const current = await loadUnlocked(root, sceneId);
    if (expectedRevision !== undefined && current.scene.revision !== expectedRevision)
      fail('REVISION_CONFLICT', 'Current revision does not match expected revision.', {
        actual: current.scene.revision,
      });
    const saved = parse(
      SceneSchema,
      await readJson(await inside(root, `history/${current.scene.id}/${revision}.json`)),
    );
    if (saved.id !== current.scene.id)
      fail('ID_MISMATCH', 'History snapshot belongs to another scene.');
    const built = compileScene(saved, current.models);
    built.dispose();
    await writeJson(
      await inside(root, `history/${current.scene.id}/${current.scene.revision}.json`),
      current.scene,
    );
    saved.revision = current.scene.revision + 1;
    await writeJson(await inside(root, current.manifest.scenes[saved.id]), saved);
    return { scene: saved.id, restoredFrom: revision, revision: saved.revision };
  });
}
