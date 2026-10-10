import type { BakedMesh } from './plush-meshes.js';

export interface TexturedMesh extends BakedMesh { uvs: number[] }
const round = (value: number) => Math.round(value * 1e6) / 1e6;
/** Split texture seams without changing the authored surface or its smooth normals. */
export function withSphericalUvs(mesh: BakedMesh): TexturedMesh {
  const result: TexturedMesh = { positions: [], normals: [], indices: [], uvs: [] };
  const vertices = new Map<string, number>();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const corners = mesh.indices.slice(i, i + 3).map(index => {
      const [x, y, z] = mesh.positions.slice(index * 3, index * 3 + 3);
      return { index, pole: Math.hypot(x, z) < 1e-7,
        u: Math.atan2(z, x) / (2 * Math.PI) + .5,
        v: .5 - Math.asin(Math.max(-1, Math.min(1, y / Math.hypot(x, y, z)))) / Math.PI };
    });
    const ring = corners.filter(corner => !corner.pole);
    if (Math.max(...ring.map(corner => corner.u)) - Math.min(...ring.map(corner => corner.u)) > .5)
      for (const corner of ring) if (corner.u > .5) corner.u -= 1;
    // A pole belongs to all longitudes; one UV per adjacent face prevents pinching.
    for (const corner of corners) {
      if (corner.pole) corner.u = ring.reduce((sum, value) => sum + value.u, 0) / ring.length;
      const u = round(corner.u), v = round(corner.v);
      const key = `${corner.index}:${u}:${v}`;
      let index = vertices.get(key);
      if (index === undefined) {
        index = result.positions.length / 3;
        vertices.set(key, index);
        result.positions.push(...mesh.positions.slice(corner.index * 3, corner.index * 3 + 3));
        result.normals.push(...mesh.normals.slice(corner.index * 3, corner.index * 3 + 3));
        result.uvs.push(u, v);
      }
      result.indices.push(index);
    }
  }
  return result;
}
