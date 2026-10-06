import * as THREE from 'three';
import { fail } from '../domain/errors.js';
import { littlewildPetRoles, primitiveGeometry } from './littlewild.js';

/**
 * Converts a Littlewild `littlewild-3d-asset` into Scene Forge model documents, one per variant.
 * Littlewild's fixed primitives are baked with the exact engine geometry, so a model imported and
 * exported again keeps its node IDs, transforms, materials and silhouette.
 */
type Plain = Record<string, unknown>;
const plain = (value: unknown): value is Plain =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const degrees = (value: number) => Number(THREE.MathUtils.radToDeg(value).toFixed(4));
const triples = (values: ArrayLike<number>, step: number) => {
  const out: number[][] = [];
  for (let i = 0; i < values.length; i += 3)
    out.push([0, 1, 2].map((k) => Number((Math.round(values[i + k] / step) * step).toFixed(5))));
  return out;
};
function bake(geometry: THREE.BufferGeometry) {
  const indexed = geometry.index ? geometry : geometry.toNonIndexed();
  const position = indexed.getAttribute('position'),
    normal = indexed.getAttribute('normal');
  const indices = indexed.index
    ? Array.from(indexed.index.array as ArrayLike<number>)
    : Array.from({ length: position.count }, (_, i) => i);
  return {
    type: 'mesh',
    positions: triples(position.array as ArrayLike<number>, 1e-5),
    indices,
    ...(normal ? { normals: triples(normal.array as ArrayLike<number>, 1e-4) } : {}),
  };
}
function forgeId(value: string, fallback: string) {
  const id = value.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 64);
  return /^[A-Za-z]/.test(id) ? id : `n${id}`.slice(0, 64) || fallback;
}
const camel = (value: string) =>
  value.replace(/[-_]+([a-z0-9])/g, (_, c: string) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, '');
function material(value: unknown) {
  const data =
    typeof value === 'string' ? { color: value } : plain(value) ? value : { color: '#9bb98c' };
  return {
    color: String(data.color),
    roughness: typeof data.roughness === 'number' ? data.roughness : 0.98,
    metalness: typeof data.metalness === 'number' ? data.metalness : 0,
    opacity: typeof data.opacity === 'number' ? data.opacity : 1,
    // The Littlewild kit shades primitives with facets unless a material opts out.
    flatShading: typeof data.flatShading === 'boolean' ? data.flatShading : true,
    ...(typeof data.emissive === 'string' ? { emissive: data.emissive } : {}),
    ...(typeof data.emissiveIntensity === 'number'
      ? { emissiveIntensity: Math.min(20, data.emissiveIntensity) }
      : {}),
  };
}
export function littlewildModels(asset: Plain, prefix?: string) {
  if (asset.format !== 'littlewild-3d-asset' || asset.schemaVersion !== 1 || !plain(asset.models))
    fail('LITTLEWILD_IMPORT', 'Expected a littlewild-3d-asset visual definition.');
  const base = forgeId(prefix ?? camel(String(asset.id)), 'littlewild'),
    meshes = plain(asset.meshes) ? asset.meshes : {},
    materials = plain(asset.materials) ? asset.materials : {},
    rig = asset.category === 'pet' && plain(asset.rig) ? asset.rig : {};
  const roles = new Set<string>(littlewildPetRoles);
  const models: Record<string, Plain> = {};
  for (const [variant, model] of Object.entries(asset.models)) {
    if (!plain(model) || !Array.isArray(model.nodes))
      fail('LITTLEWILD_IMPORT', `Variant ${variant} has no nodes.`);
    const id = `${base}${camel(`-${variant}`)}`.slice(0, 64),
      geometries: Plain = { box: { type: 'box', size: [1, 1, 1] } },
      usedMaterials: Plain = {},
      nodes: Plain[] = [],
      ids = new Set<string>(),
      tags = new Map<string, string[]>();
    for (const [role, refs] of Object.entries(plain(rig[variant]) ? rig[variant] : {}))
      if (roles.has(role))
        for (const ref of Array.isArray(refs) ? refs : [refs])
          tags.set(String(ref), [...(tags.get(String(ref)) ?? []), `rig:${role}`]);
    let counter = 0;
    const visit = (input: unknown, parent?: string) => {
      if (!plain(input)) return;
      const primitive = String(input.primitive),
        lwId = typeof input.id === 'string' ? input.id : undefined;
      let nodeId = forgeId(lwId ?? `${primitive}${++counter}`, `node${++counter}`);
      while (ids.has(nodeId)) nodeId = `${nodeId.slice(0, 58)}${++counter}`;
      ids.add(nodeId);
      const vec = (key: string) =>
        Array.isArray(input[key]) ? (input[key] as number[]) : undefined;
      const position = vec('position'),
        rotation = vec('rotation'),
        scale = vec('scale');
      const node: Plain = {
        id: nodeId,
        type: primitive === 'group' ? 'group' : 'mesh',
        ...(parent ? { parent } : {}),
        ...(position || rotation || scale
          ? {
              transform: {
                ...(position ? { position } : {}),
                ...(rotation ? { rotation: rotation.map(degrees) } : {}),
                ...(scale ? { scale } : {}),
              },
            }
          : {}),
        ...(input.visible === false ? { visible: false } : {}),
        ...(lwId && tags.has(lwId) ? { tags: tags.get(lwId) } : {}),
      };
      if (primitive !== 'group') {
        const geometryId =
          primitive === 'mesh'
            ? forgeId(`mesh-${String(input.mesh)}`, 'mesh')
            : primitive === 'box'
              ? 'box'
              : `lw-${primitive}`;
        if (!geometries[geometryId]) {
          if (primitive === 'mesh') {
            const data = meshes[String(input.mesh)];
            if (!plain(data) || !Array.isArray(data.positions))
              fail('LITTLEWILD_IMPORT', `Missing mesh ${String(input.mesh)}.`);
            const positions = data.positions as number[];
            geometries[geometryId] = {
              type: 'mesh',
              positions: triples(positions, 1e-5),
              indices: Array.isArray(data.indices)
                ? data.indices
                : Array.from({ length: positions.length / 3 }, (_, i) => i),
              ...(Array.isArray(data.normals)
                ? { normals: triples(data.normals as number[], 1e-4) }
                : {}),
            };
          } else geometries[geometryId] = bake(primitiveGeometry(primitive));
        }
        const role = String(input.material);
        const materialId = forgeId(
          Object.hasOwn(materials, role) ? role : `c${role.replace('#', '')}`,
          'material',
        );
        usedMaterials[materialId] ??= material(
          Object.hasOwn(materials, role) ? materials[role] : role,
        );
        if (
          primitive === 'mesh' &&
          !(plain(materials[role]) && typeof materials[role].flatShading === 'boolean')
        )
          (usedMaterials[materialId] as Plain).flatShading = false;
        Object.assign(node, { geometry: geometryId, material: materialId });
      }
      nodes.push(node);
      for (const child of Array.isArray(input.children) ? input.children : []) visit(child, nodeId);
    };
    for (const node of model.nodes) visit(node);
    if (!Object.values(usedMaterials).length)
      fail('LITTLEWILD_IMPORT', `Variant ${variant} has no geometry.`);
    const used = new Set(nodes.map((n) => n.geometry).filter(Boolean) as string[]);
    models[id] = {
      schemaVersion: 1,
      kind: 'model',
      id,
      name: `${String(asset.name)} (${variant})`.slice(0, 120),
      category: `littlewild-${String(asset.category)}`,
      description: `Imported from Littlewild ${String(asset.category)}:${String(asset.id)}/${variant}.`,
      geometries: Object.fromEntries(Object.entries(geometries).filter(([k]) => used.has(k))),
      materials: usedMaterials,
      nodes,
    };
  }
  return models;
}
