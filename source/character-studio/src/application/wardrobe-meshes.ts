import {surface, type BakedMesh} from './plush-meshes.js';
import {withSphericalUvs, type TexturedMesh} from './companion-uvs.js';

export type Point = [number, number, number];
const rounded = (value: number) => Math.round(value * 1e6) / 1e6;
const subtract = (a: Point, b: Point): Point => a.map((v, i) => v - b[i]) as Point;
const cross = (a: Point, b: Point): Point => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = (p: Point): Point => { const length = Math.hypot(...p) || 1; return p.map(v => v / length) as Point; };

/** Compute smooth, area-weighted normals once, then ship the portable mesh as data. */
function finish(positions: number[], indices: number[], uvs: number[]): TexturedMesh {
  const normals = new Array<number>(positions.length).fill(0);
  for (let i = 0; i < indices.length; i += 3) {
    const corners = indices.slice(i, i + 3).map(index => positions.slice(index * 3, index * 3 + 3) as Point);
    const normal = cross(subtract(corners[1], corners[0]), subtract(corners[2], corners[0]));
    for (const index of indices.slice(i, i + 3))
      for (let axis = 0; axis < 3; axis++) normals[index * 3 + axis] += normal[axis];
  }
  // UV seams keep separate vertices but share the same smooth geometric normal.
  const shared = new Map<string, Point>();
  for (let i = 0; i < positions.length; i += 3) {
    const key = positions.slice(i, i + 3).map(rounded).join(','), sum = shared.get(key) || [0, 0, 0];
    for (let axis = 0; axis < 3; axis++) sum[axis] += normals[i + axis];
    shared.set(key, sum as Point);
  }
  for (let i = 0; i < normals.length; i += 3) {
    const key = positions.slice(i, i + 3).map(rounded).join(',');
    normals.splice(i, 3, ...unit(shared.get(key)!));
  }
  return {positions: positions.map(rounded), normals: normals.map(rounded), indices, uvs: uvs.map(rounded)};
}

/** A thin, closed cloth or leather shell with real side walls and explicit UVs. */
export function shell(columns: number, rows: number, point: (u: number, v: number) => Point,
  thickness: number): TexturedMesh {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
  const count = (columns + 1) * (rows + 1);
  const wraps = [0,.5,1].every(v => Math.hypot(...subtract(point(0,v),point(1,v))) < 1e-8);
  for (const side of [1, -1]) {
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const u = column / columns, v = row / rows, p = point(u, v);
      const du = wraps && (column === 0 || column === columns)
        ? subtract(point(.001,v),point(.999,v))
        : subtract(point(Math.min(1, u + .001), v), point(Math.max(0, u - .001), v));
      const dv = subtract(point(u, Math.min(1, v + .001)), point(u, Math.max(0, v - .001)));
      const normal = unit(cross(du, dv));
      positions.push(...p.map((value, axis) => value + normal[axis] * thickness * .5 * side));
      uvs.push(u, v);
    }
  }
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
    indices.push(a, b, c, b, d, c, a + count, c + count, b + count, b + count, c + count, d + count);
  }
  const edge: number[] = [];
  for (let col = 0; col <= columns; col++) edge.push(col);
  for (let row = 1; row <= rows; row++) edge.push(row * (columns + 1) + columns);
  for (let col = columns - 1; col >= 0; col--) edge.push(rows * (columns + 1) + col);
  for (let row = rows - 1; row > 0; row--) edge.push(row * (columns + 1));
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i], b = edge[(i + 1) % edge.length];
    const ac = a % (columns + 1), bc = b % (columns + 1);
    if (wraps && ac === bc && (ac === 0 || ac === columns)) continue;
    indices.push(a, a + count, b, b, a + count, b + count);
  }
  return finish(positions, indices, uvs);
}

/** Bounded tubular piping follows an authored path; caps close both ends. */
export function piping(points: Point[], radius: number, sides = 6): TexturedMesh {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
  const closed = Math.hypot(...subtract(points[0], points.at(-1)!)) < 1e-8;
  points.forEach((point, row) => {
    const next = closed && row === points.length - 1 ? points[1] : points[Math.min(points.length - 1, row + 1)];
    const prior = closed && row === 0 ? points[points.length - 2] : points[Math.max(0, row - 1)];
    const tangent = unit(subtract(next, prior));
    const first = unit(cross(tangent, Math.abs(tangent[1]) < .85 ? [0, 1, 0] : [1, 0, 0]));
    const second = cross(tangent, first);
    for (let side = 0; side <= sides; side++) {
      const angle = side * Math.PI * 2 / sides;
      positions.push(...point.map((value, axis) => value + radius * (first[axis] * Math.cos(angle) + second[axis] * Math.sin(angle))));
      uvs.push(side / sides, row / (points.length - 1));
    }
  });
  for (let row = 0; row < points.length - 1; row++) for (let side = 0; side < sides; side++) {
    const a = row * (sides + 1) + side, b = a + sides + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  for (const end of closed ? [] : [0, points.length - 1]) {
    const center = positions.length / 3; positions.push(...points[end]); uvs.push(.5, .5);
    for (let side = 0; side < sides; side++) {
      const a = end * (sides + 1) + side;
      indices.push(...(end === 0 ? [center, a + 1, a] : [center, a, a + 1]));
    }
  }
  return finish(positions, indices, uvs);
}

export function combine(meshes: TexturedMesh[]): TexturedMesh {
  const result: TexturedMesh = {positions: [], normals: [], uvs: [], indices: []};
  for (const mesh of meshes) {
    const offset = result.positions.length / 3;
    result.positions.push(...mesh.positions); result.normals.push(...mesh.normals); result.uvs.push(...mesh.uvs);
    result.indices.push(...mesh.indices.map(index => index + offset));
  }
  return result;
}

export const shaped = (shape: (x: number, y: number, z: number) => number[], segments = 24, rings = 14): TexturedMesh =>
  withSphericalUvs(surface(() => 1, segments, rings, shape));
export const roundedBox = (): TexturedMesh => shaped((x, y, z) =>
  [x, y, z].map(value => Math.sign(value) * Math.abs(value) ** .48));
export const sample = (count: number, point: (t: number) => Point): Point[] =>
  Array.from({length: count + 1}, (_, index) => point(index / count));
export type {BakedMesh};
