import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  parse,
  fail,
  type SceneDocument,
  type ModelLibrary,
  modelDependencies,
  compileScene,
  stateHash,
  errorCode,
} from '../kernel.js';
import { SceneBundleSchema } from '../domain/schema.js';
import { writeJson } from './files.js';

/** Freeze editable source plus precisely the model dependency closure it needs. */
export function packScene(scene: SceneDocument, library: ModelLibrary) {
  const models: ModelLibrary = {};
  for (const node of scene.nodes)
    if (node.type === 'model') Object.assign(models, modelDependencies(library, node.model));
  const bundle = parse(SceneBundleSchema, {
    schemaVersion: 1,
    kind: 'scene-bundle',
    scene,
    models,
  });
  const built = compileScene(bundle.scene, bundle.models);
  built.dispose();
  return bundle;
}

/** Unpack only into a new directory. Bundle IDs generate paths; input cannot supply paths. */
export async function unpackScene(directory: string, input: unknown) {
  const bundle = parse(SceneBundleSchema, input);
  for (const [id, model] of Object.entries(bundle.models))
    if (id !== model.id) fail('ID_MISMATCH', `Model ${model.id} is keyed as ${id}.`);
  // Drop unrelated definitions and validate the reachable graph before creating any files.
  const packed = packScene(bundle.scene, bundle.models);
  const root = path.resolve(directory);
  await fs.mkdir(path.dirname(root), { recursive: true });
  try {
    await fs.mkdir(root);
  } catch (error) {
    if (errorCode(error) === 'EEXIST') fail('ALREADY_EXISTS', 'Unpack requires a new directory.');
    throw error;
  }
  const files: string[] = [];
  try {
    const sceneFile = `scenes/${packed.scene.id}.scene.json`;
    const manifest = {
      schemaVersion: 1,
      name: packed.scene.name,
      activeScene: packed.scene.id,
      scenes: { [packed.scene.id]: sceneFile },
      models: Object.fromEntries(
        Object.keys(packed.models).map((id) => [id, `models/${id}.model.json`]),
      ),
    };
    for (const [relative, data] of [
      [sceneFile, packed.scene],
      ...Object.entries(packed.models).map(([id, m]) => [`models/${id}.model.json`, m]),
      ['forge.project.json', manifest],
    ] as [string, unknown][]) {
      const file = path.join(root, relative);
      files.push(file);
      await writeJson(file, data);
    }
    return {
      project: root,
      scene: packed.scene.id,
      models: Object.keys(packed.models),
      stateHash: stateHash(packed.scene, packed.models),
    };
  } catch (error) {
    for (const file of files) await fs.rm(file, { force: true });
    for (const relative of ['scenes', 'models', ''])
      await fs.rmdir(path.join(root, relative)).catch(() => {});
    throw error;
  }
}
