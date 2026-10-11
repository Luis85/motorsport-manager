import type { TexturedMesh } from './companion-uvs.js';
import { headFront } from './artboard-head.js';

type Point = [number, number, number];
const normalize = (v: number[]): Point => {
  const length = Math.hypot(...v);
  return v.map(value => value / length) as Point;
};
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Closed tapered fibres are baked together: one draw call, no hair cards or sorting. */
export function silhouetteFibres(kind: 'head' | 'body' | 'ear'): TexturedMesh {
  const mesh: TexturedMesh = {positions: [], normals: [], indices: [], uvs: []};
  const count = kind === 'head' ? 1500 : kind === 'body' ? 950 : 220;
  for (let index = 0; index < count; index++) {
    const y = 1 - 2 * (index + .5) / count;
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const radius = Math.sqrt(1 - y * y), x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    if (kind === 'head' && z > .04 && Math.abs(x) < .90) continue;
    if (kind === 'body' && z > .10 && Math.abs(x) < .70) continue;
    if (kind === 'ear' && z > .4) continue;
    let point: Point, normal: Point;
    if (kind === 'head') {
      const px = x * .250 * (1 - .10 * y), py = y * .200;
      point = [px, py, z >= 0 ? headFront(px, py) : z * .202];
      normal = normalize([x / .250, y / .200, z / .210]);
    } else if (kind === 'body') {
      const width = .96 - .26 * y;
      point = [x * width * .207, y * .210, (z * width + .10 * (1 - y * y)) * .182];
      normal = normalize([x / .207, y / .210, z / .182]);
    } else {
      point = [x, y, z];
      normal = [x, y, z];
    }
    const tangent = normalize(cross(normal, Math.abs(normal[1]) > .9 ? [1, 0, 0] : [0, 1, 0]));
    const second = cross(normal, tangent);
    const variation = .75 + .25 * Math.sin(index * 17.13);
    const length = (kind === 'ear' ? .09 : .009) * variation;
    const width = (kind === 'ear' ? .012 : .0008) * variation;
    const base = mesh.positions.length / 3;
    for (let corner = 0; corner < 3; corner++) {
      const theta = corner * 2 * Math.PI / 3;
      for (let axis = 0; axis < 3; axis++) mesh.positions.push(point[axis] - normal[axis] * length * .08
        + width * (Math.cos(theta) * tangent[axis] + Math.sin(theta) * second[axis]));
    }
    for (let axis = 0; axis < 3; axis++) mesh.positions.push(point[axis] + normal[axis] * length * .35
      + second[axis] * length * .90);
    mesh.indices.push(base, base + 2, base + 1, base, base + 1, base + 3,
      base + 1, base + 2, base + 3, base + 2, base, base + 3);
    mesh.uvs.push(.25, 0, .75, 0, .5, .2, .5, 1);
  }
  mesh.positions = mesh.positions.map(value => Math.round(value * 1e6) / 1e6);
  mesh.normals = new Array(mesh.positions.length).fill(0);
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ids = mesh.indices.slice(i, i + 3), a = ids[0] * 3;
    const ab = [0, 1, 2].map(axis => mesh.positions[ids[1] * 3 + axis] - mesh.positions[a + axis]) as Point;
    const ac = [0, 1, 2].map(axis => mesh.positions[ids[2] * 3 + axis] - mesh.positions[a + axis]) as Point;
    const normal = cross(ab, ac);
    for (const id of ids) for (let axis = 0; axis < 3; axis++) mesh.normals[id * 3 + axis] += normal[axis];
  }
  for (let i = 0; i < mesh.normals.length; i += 3)
    mesh.normals.splice(i, 3, ...normalize(mesh.normals.slice(i, i + 3)).map(value => Math.round(value * 1e6) / 1e6));
  return mesh;
}
