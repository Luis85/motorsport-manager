import { surface, type BakedMesh } from './plush-meshes.js';
import { withSphericalUvs } from './companion-uvs.js';
const gaussian = (x: number, y: number) => Math.exp(-x * x - y * y);
type Vertex = {position: number[]; normal: number[]; fields: number[]};
type Field = (p: number[]) => number;
const normalize = (v: number[]) => { const length = Math.hypot(...v); return v.map(value => value / length); };
const round = (value: number) => Math.round(value * 1e6) / 1e6;

export function headFront(x: number, y: number): number {
  const latitude = y / .200;
  const nx = x / (.250 * (1 - .10 * latitude));
  const z = Math.sqrt(Math.max(0, 1 - nx * nx - latitude * latitude));
  const cheeks = .015 * gaussian((Math.abs(x) - .154) / .065, (y + .068) / .065);
  const sockets = .027 * (gaussian((x - .089) / .047, (y - .026) / .056)
    + gaussian((x + .089) / .047, (y - .026) / .056));
  const bridge = .008 * gaussian(x / .038, (y + .010) / .064);
  return z * .210 * (1 + .08 * Math.max(-latitude, 0))
    + (cheeks - sockets + bridge) * Math.min(1, z * 2);
}
/** Split at interpolated boundary crossings, never classify a whole triangle by its center. */
function clip(polygon: Vertex[], field: number, positive: boolean): Vertex[] {
  const output: Vertex[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const da = a.fields[field], db = b.fields[field];
    const inA = positive ? da >= 0 : da <= 0, inB = positive ? db >= 0 : db <= 0;
    if (inA) output.push(a);
    if (inA !== inB) {
      const t = da / (da - db);
      output.push({position: a.position.map((v, axis) => v + (b.position[axis] - v) * t),
        normal: normalize(a.normal.map((v, axis) => v + (b.normal[axis] - v) * t)),
        fields: a.fields.map((v, index) => v + (b.fields[index] - v) * t)});
    }
  }
  return output;
}
/** Partition one continuous surface into coat regions with matching shared boundary vertices. */
export function paintedHead(): Record<string, ReturnType<typeof withSphericalUvs>> {
  const complete = surface(() => 1, 64, 48, (x, y, z) => {
    const px = x * .250 * (1 - .10 * y), py = y * .200;
    return [px, py, z >= 0 ? headFront(px, py) : z * .202];
  });
  const pieces = new Map<string, {mesh: BakedMesh; vertices: Map<string, number>}>();
  const append = (key: string, polygon: Vertex[]) => {
    if (polygon.length < 3) return;
    let piece = pieces.get(key);
    if (!piece) {
      piece = {mesh: {positions: [], normals: [], indices: []}, vertices: new Map()};
      pieces.set(key, piece);
    }
    const indices = polygon.map(vertex => {
      const position = vertex.position.map(round), code = position.join(',');
      let id = piece!.vertices.get(code);
      if (id === undefined) {
        id = piece!.mesh.positions.length / 3;
        piece!.vertices.set(code, id);
        piece!.mesh.positions.push(...position);
        piece!.mesh.normals.push(...normalize(vertex.normal).map(round));
      }
      return id;
    });
    for (let i = 1; i < indices.length - 1; i++)
      if (new Set([indices[0], indices[i], indices[i + 1]]).size === 3)
        piece.mesh.indices.push(indices[0], indices[i], indices[i + 1]);
  };
  const creamField: Field = ([x, y, z]) => {
    const side = Math.max(0, Math.min(1, (z + .12) / .20));
    const wrap = side * side * (3 - 2 * side);
    return -.028 - .072 * (Math.abs(x) / .25) ** 1.7 - y - .22 * (1 - wrap);
  };
  const cheekField = (radius: number): Field => ([x, y, z]) => Math.min(z - .06,
    radius * radius - ((Math.abs(x) - .163) / .044) ** 2 - ((y + .073) / .026) ** 2);
  // Interpolate every boundary field from the original triangle, including after
  // another region cut. Re-evaluation would bend edges and leave tiny cracks.
  const fields = [creamField, ...[1, .75, .5, .25].map(cheekField)];
  for (let index = 0; index < complete.indices.length; index += 3) {
    const triangle = complete.indices.slice(index, index + 3).map(id => ({
      position: complete.positions.slice(id * 3, id * 3 + 3), normal: complete.normals.slice(id * 3, id * 3 + 3),
      fields: fields.map(field => field(complete.positions.slice(id * 3, id * 3 + 3)))}));
    for (const light of [false, true]) {
      let remaining = clip(triangle, 0, light);
      const outside = clip(remaining, 1, false);
      append(light ? 'studio4-face-coat' : 'studio4-head', outside);
      remaining = clip(remaining, 1, true);
      for (let ring = 0; ring < 4; ring++) {
        const radius = 1 - (ring + 1) * .25;
        const band = radius ? clip(remaining, ring + 2, false) : remaining;
        append(`studio4-blush-${light ? 'light' : 'fur'}-${ring}`, band);
        remaining = radius ? clip(remaining, ring + 2, true) : [];
      }
    }
  }
  return Object.fromEntries([...pieces].filter(([,part]) => part.mesh.indices.length)
    .map(([id, part]) => [id, withSphericalUvs(part.mesh)]));
}
