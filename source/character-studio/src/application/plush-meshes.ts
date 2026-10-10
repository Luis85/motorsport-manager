/** Small shared, indexed meshes keep the compiled model portable and deterministic. */
export interface BakedMesh {
  positions: number[];
  normals: number[];
  indices: number[];
}
type Profile = (y: number) => number;
const round = (value: number) => Math.round(value * 1e6) / 1e6;
/** Closed surface of revolution. Poles are shared and every triangle has area. */
export function surface(
  profile: Profile, segments = 24, rings = 16,
  shape: (x: number, y: number, z: number) => number[] = (x, y, z) => [x, y, z],
): BakedMesh {
  const positions = [0, 1, 0], indices: number[] = [];
  for (let row = 1; row < rings; row++) {
    const latitude = Math.PI * row / rings;
    const y = Math.cos(latitude), radius = Math.sin(latitude) * profile(y);
    for (let column = 0; column < segments; column++) {
      const angle = 2 * Math.PI * column / segments;
      positions.push(round(radius * Math.cos(angle)), round(y), round(radius * Math.sin(angle)));
    }
  }
  const bottom = positions.length / 3;
  positions.push(0, -1, 0);
  for (let column = 0; column < segments; column++) {
    const next = (column + 1) % segments;
    indices.push(0, 1 + next, 1 + column);
    for (let row = 0; row < rings - 2; row++) {
      const a = 1 + row * segments + column, b = 1 + row * segments + next;
      const c = a + segments, d = b + segments;
      indices.push(a, b, c, b, d, c);
    }
    indices.push(bottom, 1 + (rings - 2) * segments + column, 1 + (rings - 2) * segments + next);
  }
  for (let vertex = 0; vertex < positions.length; vertex += 3) {
    const transformed = shape(positions[vertex], positions[vertex + 1], positions[vertex + 2]);
    for (let axis = 0; axis < 3; axis++) positions[vertex + axis] = round(transformed[axis]);
  }
  // Area-weighted normals follow shaped profiles, including the tapered ear.
  const normals = new Array<number>(positions.length).fill(0);
  for (let index = 0; index < indices.length; index += 3) {
    const [a, b, c] = indices.slice(index, index + 3).map(n => n * 3);
    const ab = [0, 1, 2].map(k => positions[b + k] - positions[a + k]);
    const ac = [0, 1, 2].map(k => positions[c + k] - positions[a + k]);
    const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    for (const vertex of [a, b, c])
      for (let axis = 0; axis < 3; axis++) normals[vertex + axis] += normal[axis];
  }
  for (let vertex = 0; vertex < normals.length; vertex += 3) {
    const length = Math.hypot(...normals.slice(vertex, vertex + 3));
    for (let axis = 0; axis < 3; axis++) normals[vertex + axis] = round(normals[vertex + axis] / length);
  }
  return { positions, normals, indices };
}
export function plushMeshes(): Record<string, BakedMesh> {
  return {
    'studio-soft': surface(() => 1),
    'studio-cheek': surface(y => 1 - .12 * y, 32, 20),
    'studio-pear': surface(y => 1 - .18 * y, 20, 14),
    'studio-ear': surface(y => .75 - .34 * y, 16, 12),
    'studio-smile': surface(() => 1, 16, 8, (x, y, z) => [x, .3 * y + .65 * x * x - .3, z]),
    'studio-brow': surface(() => 1, 12, 6, (x, y, z) => [x, .25 * y + .35 * (1 - x * x), z]),
  };
}
