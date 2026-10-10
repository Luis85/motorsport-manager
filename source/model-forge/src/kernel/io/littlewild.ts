import { canonical } from '../domain/canonical.js';
import {
  reuseLittlewildMeshes,
  assertLittlewildComplexity,
} from '../application/littlewild-resources.js';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  fail,
  parse,
  SceneSchema,
  littlewildFamilies,
  type LittlewildAsset,
  type ModelLibrary,
} from '../domain/schema.js';
import { errorCode } from '../domain/errors.js';
import { compileScene } from '../application/compiler.js';
import {
  littlewildModel,
  littlewildLimits,
  type LittlewildNode,
  type LittlewildMaterial,
  type LittlewildMesh,
} from '../application/littlewild.js';
import { preserveExported, preserveTables } from '../application/littlewild-preserve.js';
import { atomicWrite, readJson } from './files.js';

type Plain = Record<string, unknown>;
export type LittlewildFamily = keyof typeof littlewildFamilies;
const plain = (value: unknown): value is Plain =>
  !!value && typeof value === 'object' && !Array.isArray(value);
/** Indented JSON whose numeric vectors and mesh buffers stay on one line for reviewable diffs. */
export function definitionText(value: unknown) {
  return (
    JSON.stringify(value, null, 2).replace(
      /\[\s+(-?[\d.e+-]+(?:,\s+-?[\d.e+-]+)*)\s+\]/g,
      (_, body) => `[${String(body).replace(/,\s+/g, ', ')}]`,
    ) + '\n'
  );
}
const plainText = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
/** Plain JSON with non-ASCII characters escaped, as Python's json.dump writes it. */
const asciiText = (value: unknown) =>
  plainText(value).replace(
    /[\u0080-\uffff]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
const sourceLayouts = [definitionText, plainText, asciiText];
function renameMaterials(
  nodes: LittlewildNode[],
  names: Map<string, string>,
  field: 'material' | 'mesh' = 'material',
) {
  for (const node of nodes) {
    if (node[field] && names.has(node[field]!)) node[field] = names.get(node[field]!);
    if (node.children) renameMaterials(node.children, names, field);
  }
}
function collect(nodes: readonly unknown[], key: 'material' | 'mesh', into: Set<string>) {
  for (const node of nodes) {
    if (!plain(node)) continue;
    if (typeof node[key] === 'string') into.add(node[key] as string);
    if (Array.isArray(node.children)) collect(node.children, key, into);
  }
  return into;
}
/**
 * Compiles every requested variant and merges it into the existing definition wrapper.
 * A new definition is written in canonical form; merging into an existing one keeps that
 * definition's own representation wherever content is unchanged (littlewild-preserve.ts).
 */
export function littlewildVisual(asset: LittlewildAsset, models: ModelLibrary, existing?: Plain) {
  const category = littlewildFamilies[asset.family],
    previous = plain(existing?.visual) ? existing.visual : {},
    previousModels = plain(previous.models) ? previous.models : {},
    previousMaterials = plain(previous.materials) ? previous.materials : {},
    previousMeshes = plain(previous.meshes) ? previous.meshes : {};
  const materials: Record<string, LittlewildMaterial | unknown> = {},
    meshes: Record<string, LittlewildMesh | unknown> = {},
    exported: Record<string, { nodes: LittlewildNode[] }> = {},
    rig: Plain = {},
    report: Plain[] = [],
    warnings = new Set<string>();
  for (const [variant, spec] of Object.entries(asset.models)) {
    const model = models[spec.model];
    if (!model) fail('NOT_FOUND', `Model ${spec.model} does not exist.`);
    for (const key of Object.keys(spec.materials))
      if (!Object.hasOwn(model.materials, key))
        fail('LITTLEWILD_EXPORT', `Model ${spec.model} has no material ${key} to replace.`);
    const scene = parse(SceneSchema, {
      schemaVersion: 1,
      kind: 'scene',
      id: 'littlewild',
      name: asset.name,
      materials: spec.materials,
      nodes: [
        {
          type: 'model',
          id: 'asset',
          model: spec.model,
          parameters: spec.parameters,
          materialOverrides: Object.fromEntries(Object.keys(spec.materials).map((k) => [k, k])),
        },
      ],
    });
    const built = compileScene(scene, models, { bindRigs: false });
    try {
      const root = built.content.children[0];
      const result = littlewildModel(root, { rig: asset.family === 'pets' });
      // Variants share one material table; a conflicting role gets a variant-specific name.
      const names = new Map<string, string>();
      for (const [role, data] of Object.entries(result.materials)) {
        let name = role;
        if (materials[name] && JSON.stringify(materials[name]) !== JSON.stringify(data))
          name = `${role}-${variant}`.slice(0, 80);
        materials[name] = data;
        if (name !== role) names.set(role, name);
      }
      renameMaterials(result.nodes, names);
      const meshNames = new Map<string, string>();
      for (const [id, data] of Object.entries(result.meshes)) {
        let name = id,
          suffix = 1;
        while (
          (Object.hasOwn(meshes, name) && canonical(meshes[name]) !== canonical(data)) ||
          (Object.hasOwn(previousMeshes, name) &&
            canonical(previousMeshes[name]) !== canonical(data))
        )
          name = `${id.slice(0, 64)}-${suffix++}`;
        meshes[name] = data;
        if (name !== id) meshNames.set(id, name);
      }
      renameMaterials(result.nodes, meshNames, 'mesh');
      exported[variant] = { nodes: result.nodes };
      if (Object.keys(result.rig).length) rig[variant] = result.rig;
      result.warnings.forEach((w) => warnings.add(w));
      report.push({ variant, model: spec.model, ...result.stats });
    } finally {
      built.dispose();
    }
  }
  if (existing) preserveExported(previous, exported, materials as Plain, meshes as Plain);
  const finalModels: Plain = structuredClone({ ...previousModels, ...exported });
  // Retained variants keep their own material and mesh references.
  for (const [name, model] of Object.entries(previousModels)) {
    if (Object.hasOwn(exported, name) || !plain(model) || !Array.isArray(model.nodes)) continue;
    for (const role of collect(model.nodes, 'material', new Set()))
      if (Object.hasOwn(previousMaterials, role)) {
        if (
          materials[role] &&
          JSON.stringify(materials[role]) !== JSON.stringify(previousMaterials[role])
        )
          warnings.add(`Retained variant ${name} now uses the re-exported material ${role}.`);
        else materials[role] ??= previousMaterials[role];
      }
    for (const id of collect(model.nodes, 'mesh', new Set()))
      if (Object.hasOwn(previousMeshes, id)) meshes[id] ??= previousMeshes[id];
  }
  const finalMeshes = reuseLittlewildMeshes(finalModels, meshes, Object.keys(previousMeshes));
  const vertices = Object.values(finalMeshes).reduce<number>(
    (sum, mesh) =>
      sum + (plain(mesh) && Array.isArray(mesh.positions) ? mesh.positions.length / 3 : 0),
    0,
  );
  if (vertices > littlewildLimits.definitionVertices)
    fail(
      'LITTLEWILD_BUDGET',
      `${asset.id} bakes ${vertices} vertices; Littlewild allows ${littlewildLimits.definitionVertices}.`,
    );
  const previousRig = asset.family === 'pets' && plain(previous.rig) ? previous.rig : {};
  const finalRig =
    asset.family === 'pets'
      ? Object.fromEntries(
          Object.entries({ ...previousRig, ...rig }).filter(
            ([name]) =>
              Object.hasOwn(finalModels, name) &&
              (Object.hasOwn(rig, name) || !Object.hasOwn(exported, name)),
          ),
        )
      : previous.rig;
  const metadata: Plain = {
    ...(plain(previous.metadata) ? previous.metadata : {}),
    ...asset.metadata,
  };
  const visual: Plain = {
    format: 'littlewild-3d-asset',
    schemaVersion: 1,
    category,
    id: asset.id,
    name: asset.name,
    materials,
    models: finalModels,
    metadata,
    ...(previous.behaviors === undefined ? {} : { behaviors: previous.behaviors }),
    ...(finalRig === undefined || (plain(finalRig) && !Object.keys(finalRig).length)
      ? {}
      : { rig: finalRig }),
    ...(Object.keys(finalMeshes).length ? { meshes: finalMeshes } : {}),
  };
  const result = existing ? preserveTables(visual, previous) : visual;
  assertLittlewildComplexity(result);
  return { visual: result, report, warnings: [...warnings] };
}
export async function readDefinition(file: string) {
  try {
    await fs.access(file);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw error;
  }
  const value = await readJson(file);
  if (!plain(value)) fail('LITTLEWILD_EXPORT', `${file} is not a Littlewild definition.`);
  return value;
}
/**
 * The family and display name a one-model export to `<family>/<id>/definition.json` writes,
 * shared by Model Forge and Scene Forge: an omitted family comes from the path (else
 * `items`), and an existing definition of that family keeps its display name unless a name
 * is given; a new definition takes `fallbackName` (the model name).
 */
export async function littlewildExportIdentity(
  file: string,
  options: { family?: LittlewildFamily; name?: string; fallbackName: string },
) {
  const directory = path.basename(path.dirname(path.dirname(file)));
  const family =
    options.family ??
    (Object.hasOwn(littlewildFamilies, directory) ? (directory as LittlewildFamily) : 'items');
  const existing = await readDefinition(file);
  const previousName = plain(existing?.visual) ? existing.visual.name : undefined;
  const name =
    options.name ??
    (typeof previousName === 'string' && existing?.family === family
      ? previousName
      : options.fallbackName);
  return { id: path.basename(path.dirname(file)), family, name };
}
/** Writes one definition wrapper; non-visual gameplay facets are preserved byte-for-byte in value. */
export async function writeLittlewildAsset(
  asset: LittlewildAsset,
  models: ModelLibrary,
  file: string,
  options: { dryRun?: boolean; check?: boolean } = {},
) {
  const existing = await readDefinition(file);
  let previousText: string | undefined;
  try {
    previousText = await fs.readFile(file, 'utf8');
  } catch {
    previousText = undefined;
  }
  if (
    existing &&
    (existing.format !== 'littlewild-definition' ||
      existing.family !== asset.family ||
      existing.id !== asset.id)
  )
    fail(
      'LITTLEWILD_EXPORT',
      `${file} belongs to ${String(existing.family)}/${String(existing.id)}, not ${asset.family}/${asset.id}.`,
    );
  if (
    path.basename(path.dirname(file)) !== asset.id ||
    path.basename(path.dirname(path.dirname(file))) !== asset.family
  )
    fail(
      'LITTLEWILD_EXPORT',
      `Littlewild expects ${asset.family}/${asset.id}/definition.json; got ${file}.`,
    );
  const { visual, report, warnings } = littlewildVisual(asset, models, existing);
  const definition: Plain = existing
    ? Object.fromEntries(
        Object.entries({ ...existing, visual }).map(([k]) => [
          k,
          k === 'visual' ? visual : existing[k],
        ]),
      )
    : {
        format: 'littlewild-definition',
        schemaVersion: 1,
        family: asset.family,
        id: asset.id,
        visual,
      };
  // An existing definition keeps its file layout when it is one of the known ones.
  const layout =
    (existing && sourceLayouts.find((format) => format(existing) === previousText)) ||
    definitionText;
  const text = layout(definition);
  const changed = previousText !== text;
  if (changed && !options.dryRun && !options.check) await atomicWrite(file, text);
  return {
    path: file,
    id: asset.id,
    family: asset.family,
    changed,
    written: changed && !options.dryRun && !options.check,
    bytes: Buffer.byteLength(text),
    variants: report,
    warnings,
  };
}
