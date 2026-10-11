import {createHash} from 'node:crypto';

type Value = Record<string, unknown>;
const record = (value: unknown): Value => value && typeof value === 'object' && !Array.isArray(value) ? value as Value : {};
const entries = (value: unknown): [string, unknown][] => Object.entries(record(value)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const triangles = (mesh: Value): number => Array.isArray(mesh.indices) ? mesh.indices.length / 3 : array(mesh.positions).length / 9;
function canonical(value: unknown): unknown {
 if (Array.isArray(value)) return value.map(canonical);
 return value && typeof value === 'object' ? Object.fromEntries(entries(value).map(([key, item]) => [key, canonical(item)])) : value;
}
const properties = ['color', 'roughness', 'metalness', 'sheen', 'sheenColor', 'sheenRoughness', 'clearcoat', 'clearcoatRoughness', 'surface'] as const;
function material(value: unknown): Value {
 if (typeof value === 'string') return {color: value};
 const source = record(value);
 return Object.fromEntries(properties.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
}

/** Compact authored facts. No mesh buffers, simulation access or aesthetic score. */
export function visualSummary(value: unknown): Value {
 const asset = record(value), meshes = record(asset.meshes), materials = record(asset.materials);
 const meshFacts = entries(meshes).map(([id, value]) => {
  const mesh = record(value), vertices = array(mesh.positions).length / 3;
  return {id, vertices, triangles: triangles(mesh),
   normals: array(mesh.normals).length === vertices * 3,
   uv: array(mesh.uvs).length === vertices * 2 ? 'authored' : 'generated-spherical'};
 });
 const models = entries(asset.models).map(([id, value]) => {
  const primitives: Record<string, number> = {}, used = new Set<string>();
  const surfaces: {node: string; material: unknown; surface: unknown}[] = [];
  let nodes = 0, bakedMeshInstances = 0, bakedTriangles = 0;
  function visit(list: unknown, parent: string): void {
   for (const [index, value] of array(list).entries()) {
    const node = record(value), nodePath = parent + '/' + String(node.id ?? index);
    nodes++;
    const primitive = String(node.primitive ?? 'group');
    primitives[primitive] = (primitives[primitive] ?? 0) + 1;
    if (typeof node.material === 'string') used.add(node.material);
    if (primitive === 'mesh') {
     bakedMeshInstances++;
     bakedTriangles += triangles(record(meshes[String(node.mesh)]));
    }
    const effective = {...material(materials[String(node.material)]), ...record(node.materialProps)};
    if (effective.surface) surfaces.push({node: nodePath, material: node.material ?? null, surface: effective.surface});
    visit(node.children, nodePath);
   }
  }
  visit(record(value).nodes, id);
  return {id, nodes, primitives, materials: [...used].sort(), bakedMeshInstances, bakedTriangles, surfaces};
 });
 return {id: asset.id, category: asset.category,
  sha256: createHash('sha256').update(JSON.stringify(canonical(asset))).digest('hex'),
  materials: entries(materials).map(([id, value]) => ({id, ...material(value)})),
  meshes: meshFacts, models,
  totals: {uniqueMeshes: meshFacts.length, storedVertices: meshFacts.reduce((sum, mesh) => sum + mesh.vertices, 0), storedTriangles: meshFacts.reduce((sum, mesh) => sum + mesh.triangles, 0)},
  interpretation: 'Authored facts only. Baked triangle counts exclude procedural primitives. UV fallback applies to baked meshes without authored UVs. Review actual captures to judge expression, silhouette and material appearance.'};
}
