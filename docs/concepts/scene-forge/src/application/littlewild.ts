import * as THREE from 'three';
import { fail } from '../domain/errors.js';

/**
 * Converts one compiled Scene Forge model into the declarative Littlewild primitive grammar.
 * Boxes stay native primitives; every other mesh is baked into bounded indexed triangles.
 * The result is pure data: no callbacks, URLs or renderer state cross the boundary.
 */
export interface LittlewildMaterial {
  color: string;
  roughness: number;
  metalness: number;
  flatShading: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  transparent?: boolean;
  doubleSided?: boolean;
}
export interface LittlewildMesh {
  positions: number[];
  normals?: number[];
  indices?: number[];
}
export interface LittlewildNode {
  primitive: string;
  id: string;
  position?: number[];
  rotation?: number[];
  scale?: number[];
  material?: string;
  mesh?: string;
  visible?: boolean;
  children?: LittlewildNode[];
}
export interface LittlewildModel {
  nodes: LittlewildNode[];
  materials: Record<string, LittlewildMaterial>;
  meshes: Record<string, LittlewildMesh>;
  rig: Record<string, string | string[]>;
  warnings: string[];
  stats: { nodes: number; meshes: number; primitives: number; vertices: number; triangles: number };
}
/** Littlewild limits mirrored here so agents get an actionable error before the engine rejects it. */
export const littlewildLimits = {
  meshVertices: 8192,
  meshTriangles: 16384,
  definitionVertices: 40000,
};
/** Presentation roles the Littlewild pet renderer understands. Tag a node `rig:<role>` to bind it. */
export const littlewildPetRoles = [
  'body',
  'head',
  'eyes',
  'ears',
  'tail',
  'arms',
  'feet',
  'mouth',
  'cheeks',
  'sprout',
  'shell',
  // Accessory sockets: empty groups where Littlewild attaches equipped items.
  'hat',
  'face',
  'neck',
  'back',
] as const;
function roofGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(0.5, 0);
  shape.lineTo(0, 0.62);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  geometry.translate(0, 0, -0.5);
  return geometry;
}
/** Mirrors the Littlewild engine kit in world-3d.ts; imported `lw-<primitive>` geometries use it. */
export function primitiveGeometry(kind: string): THREE.BufferGeometry {
  switch (kind) {
    case 'ball':
      return new THREE.IcosahedronGeometry(1, 0);
    case 'tiny':
      return new THREE.SphereGeometry(1, 6, 4);
    case 'soft':
      return new THREE.SphereGeometry(1, 10, 7);
    case 'cone':
      return new THREE.ConeGeometry(1, 1, 7);
    case 'cylinder':
      return new THREE.CylinderGeometry(1, 1, 1, 8);
    case 'ring':
      return new THREE.TorusGeometry(1, 0.07, 4, 16);
    case 'roof':
      return roofGeometry();
    case 'ground': {
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [-0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, -0.5],
          3,
        ),
      );
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      return g;
    }
    default:
      return fail('LITTLEWILD_IMPORT', `Unsupported Littlewild primitive ${kind}.`);
  }
}
const nativeCounts = new Map<string, number>();
/** An unchanged `lw-<primitive>` geometry exports as the engine's own primitive. */
function nativePrimitive(object: THREE.Mesh) {
  const kind = /^lw-(ball|soft|tiny|cone|cylinder|ring|roof|ground)$/.exec(
    String(object.userData.geometry ?? ''),
  )?.[1];
  if (!kind) return null;
  if (!nativeCounts.has(kind)) {
    const g = primitiveGeometry(kind);
    nativeCounts.set(kind, g.getAttribute('position').count);
    g.dispose();
  }
  return (object.geometry as THREE.BufferGeometry).getAttribute('position').count ===
    nativeCounts.get(kind)
    ? kind
    : null;
}
/** Roles that name a set of nodes; other roles bind one node. */
const pairedRoles = new Set(['eyes', 'ears', 'cheeks', 'arms', 'feet']);
const round = (value: number, step: number) => {
  const result = Math.round(value / step) * step;
  return Number((Object.is(result, -0) ? 0 : result).toFixed(Math.max(0, -Math.log10(step))));
};
const vector = (values: number[], step = 1e-5) => values.map((v) => round(v, step));
const same = (values: number[], value: number) => values.every((v) => Math.abs(v - value) < 1e-9);
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}
/** Littlewild IDs are lowercase kebab-case; Scene Forge IDs are commonly camelCase. */
export function littlewildId(value: string) {
  const id = value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .toLowerCase()
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 72);
  return id || 'node';
}
function materialData(material: THREE.Material): LittlewildMaterial {
  const m = material as THREE.MeshStandardMaterial;
  const result: LittlewildMaterial = {
    color: `#${m.color.getHexString()}`,
    roughness: round(m.roughness ?? 1, 1e-3),
    metalness: round(m.metalness ?? 0, 1e-3),
    flatShading: !!m.flatShading,
  };
  if (m.emissive && m.emissive.getHex() !== 0) {
    result.emissive = `#${m.emissive.getHexString()}`;
    result.emissiveIntensity = round(m.emissiveIntensity ?? 1, 1e-3);
  }
  if (material.side === THREE.DoubleSide) result.doubleSided = true;
  if (material.opacity < 1) {
    result.opacity = round(material.opacity, 1e-3);
    result.transparent = true;
  }
  return result;
}
function meshData(geometry: THREE.BufferGeometry, label: string): LittlewildMesh {
  const position = geometry.getAttribute('position');
  if (!position || position.itemSize !== 3) fail('LITTLEWILD_EXPORT', `${label} has no positions.`);
  const vertices = position.count,
    triangles = (geometry.index?.count ?? vertices) / 3;
  if (vertices > littlewildLimits.meshVertices || triangles > littlewildLimits.meshTriangles)
    fail(
      'LITTLEWILD_BUDGET',
      `${label} has ${vertices} vertices and ${triangles} triangles; Littlewild meshes allow ${littlewildLimits.meshVertices} vertices and ${littlewildLimits.meshTriangles} triangles. Reduce its segments.`,
    );
  const positions: number[] = [];
  for (let i = 0; i < vertices; i++)
    positions.push(...vector([position.getX(i), position.getY(i), position.getZ(i)], 1e-4));
  const result: LittlewildMesh = { positions };
  const normal = geometry.getAttribute('normal');
  if (normal && normal.count === vertices) {
    const normals: number[] = [];
    for (let i = 0; i < vertices; i++)
      normals.push(...vector([normal.getX(i), normal.getY(i), normal.getZ(i)], 1e-3));
    result.normals = normals;
  }
  if (geometry.index) result.indices = Array.from(geometry.index.array as ArrayLike<number>);
  return result;
}
/** Compiled geometries are plain buffers, so a box is recognised by its exact centered corners. */
function boxSize(geometry: THREE.BufferGeometry): number[] | null {
  const position = geometry.getAttribute('position');
  if (!position || position.count !== 24 || geometry.index?.count !== 36) return null;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!,
    size = box.getSize(new THREE.Vector3()).toArray(),
    center = box.getCenter(new THREE.Vector3()).toArray();
  if (center.some((v) => Math.abs(v) > 1e-6) || size.some((v) => v <= 0)) return null;
  for (let i = 0; i < 24; i++)
    for (let axis = 0; axis < 3; axis++)
      if (Math.abs(Math.abs(position.getComponent(i, axis)) - size[axis] / 2) > 1e-6) return null;
  return size;
}
export function littlewildModel(root: THREE.Object3D, options: { rig: boolean }): LittlewildModel {
  const materials: Record<string, LittlewildMaterial> = {},
    materialRoles = new Map<THREE.Material, string>(),
    meshes: Record<string, LittlewildMesh> = {},
    meshIds = new Map<THREE.BufferGeometry, string>(),
    ids = new Set<string>(),
    rig: Record<string, string[]> = {},
    warnings = new Set<string>(),
    stats = { nodes: 0, meshes: 0, primitives: 0, vertices: 0, triangles: 0 };
  const roles = new Set<string>(littlewildPetRoles);
  function role(material: THREE.Material) {
    if (Array.isArray(material))
      fail('LITTLEWILD_EXPORT', 'Multi-material meshes are unsupported.');
    const known = materialRoles.get(material);
    if (known) return known;
    if (material.type === 'MeshBasicMaterial')
      warnings.add('Unlit materials are exported as standard Littlewild materials.');
    const data = materialData(material),
      // Scene Forge material IDs already satisfy Littlewild's case-preserving role grammar.
      base = (material.name.split('/').pop() || 'material').slice(0, 72);
    let name = base;
    for (
      let n = 2;
      materials[name] && JSON.stringify(materials[name]) !== JSON.stringify(data);
      n++
    )
      name = `${base}-${n}`;
    materials[name] = data;
    materialRoles.set(material, name);
    return name;
  }
  function nodeId(object: THREE.Object3D, parentId: string) {
    const last = object.name.split('/').pop() ?? '';
    const own = littlewildId(String(object.userData.forgeId ?? 'node'));
    let id = /^[0-9]+$/.test(last) ? `${own}-${last}` : own;
    if (ids.has(id)) id = `${parentId}-${id}`.slice(0, 72);
    for (let n = 2; ids.has(id); n++) id = `${id.slice(0, 70)}-${n}`;
    ids.add(id);
    return id;
  }
  function transform(object: THREE.Object3D, node: LittlewildNode) {
    const p = vector(object.position.toArray()),
      r = vector([object.rotation.x, object.rotation.y, object.rotation.z]),
      s = vector(object.scale.toArray());
    if (object.rotation.order !== 'XYZ')
      fail('LITTLEWILD_EXPORT', 'Only XYZ rotation order is supported.');
    if (!same(p, 0)) node.position = p;
    if (!same(r, 0)) node.rotation = r;
    if (!same(s, 1)) node.scale = s;
  }
  function convert(object: THREE.Object3D, parentId: string): LittlewildNode | null {
    if (object instanceof THREE.Light) {
      warnings.add('Lights are not part of Littlewild assets and were skipped.');
      return null;
    }
    const id = nodeId(object, parentId),
      node: LittlewildNode = { primitive: 'group', id };
    stats.nodes++;
    transform(object, node);
    if (!object.visible) node.visible = false;
    if (object instanceof THREE.Mesh) {
      const geometry = object.geometry as THREE.BufferGeometry,
        size = boxSize(geometry);
      node.material = role(object.material as THREE.Material);
      const native = nativePrimitive(object);
      if (native) {
        node.primitive = native;
        stats.primitives++;
      } else if (size) {
        node.primitive = 'box';
        node.scale = vector((node.scale ?? [1, 1, 1]).map((v, axis) => v * size[axis]));
        stats.primitives++;
      } else {
        let meshId = meshIds.get(geometry);
        if (!meshId) {
          const data = meshData(geometry, String(object.userData.forgePath ?? id));
          meshId = `m-${hash(JSON.stringify(data))}`;
          meshIds.set(geometry, meshId);
          if (!meshes[meshId]) {
            meshes[meshId] = data;
            stats.vertices += data.positions.length / 3;
          }
        }
        node.primitive = 'mesh';
        node.mesh = meshId;
        stats.meshes++;
      }
      stats.triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
    }
    for (const tag of (object.userData.tags as string[] | undefined) ?? []) {
      if (!tag.startsWith('rig:')) continue;
      const name = tag.slice(4);
      if (!options.rig) warnings.add('Rig tags are exported only for the pets family.');
      else if (!roles.has(name))
        fail('LITTLEWILD_EXPORT', `Unknown Littlewild rig role ${name}.`, { roles: [...roles] });
      else (rig[name] ??= []).push(id);
    }
    const children = object.children.flatMap((child) => convert(child, id) ?? []);
    if (children.length) node.children = children;
    return node;
  }
  const nodes = root.children.flatMap((child) => convert(child, 'asset') ?? []);
  if (!stats.primitives && !stats.meshes)
    fail('LITTLEWILD_EXPORT', 'The model has no visible geometry.');
  if (stats.vertices > littlewildLimits.definitionVertices)
    fail(
      'LITTLEWILD_BUDGET',
      `Model bakes ${stats.vertices} vertices; Littlewild allows ${littlewildLimits.definitionVertices}.`,
    );
  return {
    nodes,
    materials,
    meshes,
    rig: Object.fromEntries(
      Object.entries(rig).map(([key, value]) => {
        if (!pairedRoles.has(key) && value.length > 1)
          fail('LITTLEWILD_EXPORT', `Rig role ${key} is tagged on ${value.length} nodes.`);
        return [key, pairedRoles.has(key) ? value : value[0]];
      }),
    ),
    warnings: [...warnings],
    stats,
  };
}
