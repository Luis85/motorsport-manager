import * as THREE from 'three';
import { canonical } from '../domain/canonical.js';
import { sphereUVs } from './surface-pattern.js';
import { littlewildId, type LittlewildNode } from './littlewild.js';
import { importedNodeIds } from './littlewild-import.js';

/**
 * Source-preserving Littlewild maintenance, the one contract of every writer (Model Forge's
 * `export --format littlewild`, Scene Forge's `littlewild export` and `littlewild sync`) when
 * it merges into an existing definition. A re-exported variant keeps that definition's own
 * representation wherever it is semantically unchanged: node key order, explicit zero
 * transforms, empty children, shared string material references, per-node `materialProps`,
 * mesh resource names and engine-only node fields the recipe cannot express (for example
 * `castShadow: false`). Changed fields take the normalized exported form.
 */
type Plain = Record<string, unknown>;
type Node = LittlewildNode & Plain;
const plain = (value: unknown): value is Plain =>
  !!value && typeof value === 'object' && !Array.isArray(value);
/** Fields the recipe round trip owns; every other node field is carried from the source. */
const owned = new Set([
  'primitive',
  'id',
  'position',
  'rotation',
  'scale',
  'material',
  'materialProps',
  'mesh',
  'visible',
  'children',
]);
const physical: Plain = {
  sheen: 0,
  sheenColor: '#000000',
  sheenRoughness: 1,
  clearcoat: 0,
  clearcoatRoughness: 0,
};
const round = (value: number, step: number) => {
  const result = Math.round(value / step) * step;
  return Number((Object.is(result, -0) ? 0 : result).toFixed(Math.max(0, -Math.log10(step))));
};
/** A transform component as the exporter writes it: rounded to 1e-5 with absent defaults. */
function sameVector(previous: unknown, next: unknown, fallback: number) {
  const values = (value: unknown) =>
    Array.isArray(value) && value.length === 3 && value.every((v) => typeof v === 'number')
      ? (value as number[]).map((v) => round(v, 1e-5))
      : value === undefined
        ? [fallback, fallback, fallback]
        : null;
  const a = values(previous),
    b = values(next);
  return !!a && !!b && a.every((v, i) => v === b[i]);
}
/** The material a node renders with, under the defaults Littlewild import assumes. */
function resolvedMaterial(table: Plain, key: unknown, props: unknown, mesh: boolean) {
  if (typeof key !== 'string' || (props !== undefined && !plain(props))) return null;
  const base = Object.hasOwn(table, key) ? table[key] : key;
  if (typeof base !== 'string' && !plain(base)) return null;
  const data: Plain = {
    roughness: 0.98,
    metalness: 0,
    opacity: 1,
    flatShading: !mesh,
    ...(typeof base === 'string' ? { color: base } : base),
    ...(plain(props) ? props : {}),
  };
  delete data.transparent;
  if (data.depthWrite === true) delete data.depthWrite;
  if (data.doubleSided === false) delete data.doubleSided;
  if (data.emissive === undefined || String(data.emissive).toLowerCase() === '#000000') {
    delete data.emissive;
    delete data.emissiveIntensity;
  }
  if (Object.keys(physical).some((field) => data[field] !== undefined))
    for (const [field, value] of Object.entries(physical)) data[field] ??= value;
  for (const [field, value] of Object.entries(data))
    if (typeof value === 'number') data[field] = round(value, 1e-3);
    else if (typeof value === 'string' && value.startsWith('#')) data[field] = value.toLowerCase();
  return canonical(data);
}
/** Normals and UVs the compiler derives for a mesh source without them, as exported. */
function derivedBuffers(positions: number[], indices: number[]) {
  const geometry = new THREE.BufferGeometry();
  try {
    const position = new THREE.Float32BufferAttribute(positions, 3);
    geometry.setAttribute('position', position);
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const normal = geometry.getAttribute('normal');
    return {
      normals: Array.from(normal.array as ArrayLike<number>, (v) => round(v, 1e-3)),
      uvs: new THREE.Float32BufferAttribute(sphereUVs(Array.from(position.array)), 2).array,
    };
  } finally {
    geometry.dispose();
  }
}
/**
 * Exact buffers. Absent source indices mean sequential triangles; absent source normals and
 * UVs mean the ones the compiler derives from the same positions, so an exported mesh equals
 * its source only when it still carries exactly those derived buffers.
 */
function sameMesh(source: unknown, exported: unknown) {
  if (!plain(source) || !plain(exported) || !Array.isArray(source.positions)) return false;
  const positions = source.positions as number[];
  const indices = Array.isArray(source.indices)
    ? (source.indices as number[])
    : Array.from({ length: positions.length / 3 }, (_, i) => i);
  const derived =
    source.normals === undefined || source.uvs === undefined
      ? derivedBuffers(positions, indices)
      : undefined;
  const uvs =
    source.uvs === undefined
      ? Array.from(derived!.uvs as ArrayLike<number>, (v) => round(v, 1e-5))
      : source.uvs;
  const expected = {
    ...source,
    indices,
    normals: source.normals ?? derived!.normals,
    uvs,
  };
  return canonical(expected) === canonical(exported);
}

export interface PreservedVariants {
  /** Material keys whose source definition value the merged nodes rely on. */
  materials: Set<string>;
  /** Source mesh IDs the merged nodes still reference. */
  meshes: Set<string>;
  /** Exported nodes that reference a newly exported material role. */
  exportedMaterialNodes: Node[];
}

/** Merge one exported variant's nodes onto the source variant's nodes. */
export function preserveVariantNodes(
  exported: LittlewildNode[],
  source: unknown[],
  tables: { previous: Plain; previousMeshes: Plain; materials: Plain; meshes: Plain },
  kept: PreservedVariants,
): LittlewildNode[] {
  // An id-less source node is matched only through the ID import gave it, never by
  // position: after a node is removed or reordered, a position names another node.
  const imported = importedNodeIds(source);
  const merge = (nodes: LittlewildNode[], previous: unknown[]): Node[] => {
    const byId = new Map<string, Plain>(),
      bySynthetic = new Map<string, Plain>();
    for (const node of previous)
      if (plain(node) && typeof node.id === 'string' && !byId.has(node.id)) byId.set(node.id, node);
    for (const node of previous)
      if (plain(node) && node.id === undefined && imported.has(node)) {
        const id = littlewildId(imported.get(node)!);
        if (!byId.has(id) && !bySynthetic.has(id)) bySynthetic.set(id, node);
      }
    return nodes.map((node) => {
      const match = byId.get(node.id) ?? bySynthetic.get(node.id);
      return match && match.primitive === node.primitive
        ? mergeNode(node as Node, match)
        : track(node as Node);
    });
  };
  const track = (node: Node) => {
    if (node.material) kept.exportedMaterialNodes.push(node);
    if (node.children) node.children = merge(node.children, []);
    return node;
  };
  const mergeNode = (node: Node, source: Plain): Node => {
    const result: Plain = {};
    const take = (field: string, fromSource: boolean) => {
      const value = fromSource ? source[field] : node[field];
      if (value !== undefined) result[field] = value;
    };
    take('primitive', false);
    take('id', !Object.hasOwn(source, 'id') ? true : source.id === node.id);
    for (const [field, fallback] of [
      ['position', 0],
      ['rotation', 0],
      ['scale', 1],
    ] as const)
      take(field, sameVector(source[field], node[field], fallback));
    take('visible', (source.visible === false) === (node.visible === false));
    let exportedMaterial = false;
    if (node.primitive !== 'group') {
      const mesh = node.primitive === 'mesh';
      const before = resolvedMaterial(tables.previous, source.material, source.materialProps, mesh);
      if (
        before !== null &&
        before === resolvedMaterial(tables.materials, node.material, undefined, mesh)
      ) {
        take('material', true);
        take('materialProps', true);
        if (Object.hasOwn(tables.previous, String(source.material)))
          kept.materials.add(String(source.material));
      } else {
        take('material', false);
        exportedMaterial = true;
      }
    }
    if (node.primitive === 'mesh') {
      const same = sameMesh(
        tables.previousMeshes[String(source.mesh)],
        tables.meshes[String(node.mesh)],
      );
      take('mesh', same);
      if (same) kept.meshes.add(String(source.mesh));
    }
    const children = merge(
      node.children ?? [],
      Array.isArray(source.children) ? source.children : [],
    );
    if (children.length || Array.isArray(source.children)) result.children = children;
    for (const [field, value] of Object.entries(source))
      if (!owned.has(field)) result[field] = value;
    // Source key order first, then fields only the export has.
    const ordered: Plain = {};
    for (const field of [...Object.keys(source), ...Object.keys(result)])
      if (Object.hasOwn(result, field) && !Object.hasOwn(ordered, field))
        ordered[field] = result[field];
    if (exportedMaterial) kept.exportedMaterialNodes.push(ordered as Node);
    return ordered as Node;
  };
  return merge(exported, source);
}

/** Every material and mesh key the variants reference. */
export function referencedResources(models: unknown) {
  const materials = new Set<string>(),
    meshes = new Set<string>();
  const walk = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes)
      if (plain(node)) {
        if (typeof node.material === 'string') materials.add(node.material);
        if (typeof node.mesh === 'string') meshes.add(node.mesh);
        walk(node.children);
      }
  };
  if (plain(models)) for (const model of Object.values(models)) if (plain(model)) walk(model.nodes);
  return { materials, meshes };
}

/** Order keys like the source object; keys the source lacks follow in their own order. */
export function inSourceOrder<T extends Plain>(value: T, source: unknown): T {
  if (!plain(source)) return value;
  const ordered: Plain = {};
  for (const key of [...Object.keys(source), ...Object.keys(value)])
    if (Object.hasOwn(value, key) && !Object.hasOwn(ordered, key)) ordered[key] = value[key];
  return ordered as T;
}

/**
 * Merge every exported variant onto its source variant, then rebuild the exported material
 * table: kept source keys keep their source values; an exported role that would change a
 * kept key's meaning for its users is renamed. Mutates `exported`, `materials` and `meshes`.
 */
export function preserveExported(
  previous: Plain,
  exported: Record<string, { nodes: LittlewildNode[] }>,
  materials: Plain,
  meshes: Plain,
) {
  const sourceModels = plain(previous.models) ? previous.models : {},
    previousMaterials = plain(previous.materials) ? previous.materials : {},
    previousMeshes = plain(previous.meshes) ? previous.meshes : {};
  const kept: PreservedVariants = {
    materials: new Set(),
    meshes: new Set(),
    exportedMaterialNodes: [],
  };
  const exportedMaterials = { ...materials };
  for (const [variant, model] of Object.entries(exported)) {
    const source = sourceModels[variant];
    model.nodes = preserveVariantNodes(
      model.nodes,
      plain(source) && Array.isArray(source.nodes) ? source.nodes : [],
      { previous: previousMaterials, previousMeshes, materials: exportedMaterials, meshes },
      kept,
    );
  }
  const table: Plain = {};
  for (const key of kept.materials) table[key] = previousMaterials[key];
  const names = new Map<string, string>();
  for (const node of kept.exportedMaterialNodes) {
    const role = node.material!,
      mesh = node.primitive === 'mesh';
    const meaning = resolvedMaterial(exportedMaterials, role, undefined, mesh);
    let name = names.get(role) ?? role;
    for (
      let n = 2;
      Object.hasOwn(table, name) &&
      canonical(table[name]) !== canonical(exportedMaterials[role]) &&
      resolvedMaterial(table, name, undefined, mesh) !== meaning;
      n++
    )
      name = `${role.slice(0, 76)}-${n}`;
    names.set(role, name);
    table[name] ??= exportedMaterials[role];
    node.material = name;
  }
  for (const key of Object.keys(materials)) delete materials[key];
  Object.assign(materials, table);
  for (const id of kept.meshes) meshes[id] = previousMeshes[id];
}

/**
 * Restore the source's own layout: materials and meshes no source variant referenced
 * (hand-authored palette entries) are kept, and keys follow the source order.
 */
export function preserveTables(visual: Plain, previous: Plain): Plain {
  const used = referencedResources(previous.models);
  const extras = (field: 'materials' | 'meshes', references: Set<string>) => {
    const source = plain(previous[field]) ? previous[field] : {},
      current = plain(visual[field]) ? { ...visual[field] } : {};
    for (const [key, value] of Object.entries(source))
      if (!references.has(key) && !Object.hasOwn(current, key)) current[key] = value;
    return Object.keys(current).length ? inSourceOrder(current, source) : undefined;
  };
  const materials = extras('materials', used.materials),
    meshes = extras('meshes', used.meshes);
  return inSourceOrder(
    { ...visual, materials: materials ?? {}, ...(meshes ? { meshes } : {}) },
    previous,
  );
}
