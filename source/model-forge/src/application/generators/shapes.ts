import type { Random } from '../../kernel/index.js';
import { normalize, type Vec } from './kit.js';

/**
 * Seeded mesh shapes for the generators: a subdivided icosahedron displaced by value-noise
 * fBm and flattened by random cutting planes. Pure arithmetic on a keyed stream, so the same
 * seed gives the same vertices on every platform (results are rounded by the kit).
 */
export interface MeshData {
  positions: Vec[];
  indices: number[];
  uvs: [number, number][];
}

/** A unit icosphere with `detail` subdivisions (20 * 4^detail triangles). */
export function icosphere(detail: number): { positions: Vec[]; faces: [number, number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const positions: Vec[] = (
    [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1],
    ] as Vec[]
  ).map(normalize);
  let faces: [number, number, number][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  for (let level = 0; level < detail; level++) {
    const midpoints = new Map<string, number>();
    const midpoint = (a: number, b: number) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const known = midpoints.get(key);
      if (known !== undefined) return known;
      const [pa, pb] = [positions[a], positions[b]];
      positions.push(normalize([(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2]));
      midpoints.set(key, positions.length - 1);
      return positions.length - 1;
    };
    faces = faces.flatMap(([a, b, c]) => {
      const [ab, bc, ca] = [midpoint(a, b), midpoint(b, c), midpoint(c, a)];
      return [
        [a, ab, ca],
        [b, bc, ab],
        [c, ca, bc],
        [ab, bc, ca],
      ] as [number, number, number][];
    });
  }
  return { positions, faces };
}

/** Seeded 3D value noise with smooth interpolation on an integer lattice, in [-1, 1]. */
export function valueNoise(random: Random) {
  const table = Array.from({ length: 256 }, () => random.next() * 2 - 1);
  const permutation = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = random.int(0, i);
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }
  const lattice = (x: number, y: number, z: number) =>
    table[permutation[(permutation[(permutation[x & 255] + y) & 255] + z) & 255]];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return (x: number, y: number, z: number) => {
    const [ix, iy, iz] = [Math.floor(x), Math.floor(y), Math.floor(z)];
    const [fx, fy, fz] = [smooth(x - ix), smooth(y - iy), smooth(z - iz)];
    const corner = (dx: number, dy: number, dz: number) => lattice(ix + dx, iy + dy, iz + dz);
    return lerp(
      lerp(
        lerp(corner(0, 0, 0), corner(1, 0, 0), fx),
        lerp(corner(0, 1, 0), corner(1, 1, 0), fx),
        fy,
      ),
      lerp(
        lerp(corner(0, 0, 1), corner(1, 0, 1), fx),
        lerp(corner(0, 1, 1), corner(1, 1, 1), fx),
        fy,
      ),
      fz,
    );
  };
}

export interface LumpOptions {
  detail: number;
  /** Radial noise amplitude relative to the radius. */
  roughness: number;
  /** Noise frequency over the unit sphere. */
  frequency: number;
  /** Random cutting planes that flatten faces (chiseled rock). */
  facets: number;
  /** Flatten everything below this normalized height (-1 = none). */
  floor: number;
}

/**
 * A lumpy closed mesh normalized to a unit box: x and z centered in [-0.5, 0.5], y from 0
 * to 1. Spherical UVs come from the undisplaced directions.
 */
export function lump(random: Random, options: LumpOptions): MeshData {
  const sphere = icosphere(options.detail);
  const noise = valueNoise(random.fork('noise'));
  const offset: Vec = [random.range(0, 64), random.range(0, 64), random.range(0, 64)];
  const fbm = (v: Vec) => {
    let sum = 0,
      amplitude = 1,
      frequency = options.frequency,
      norm = 0;
    for (let octave = 0; octave < 3; octave++) {
      sum +=
        amplitude *
        noise(
          v[0] * frequency + offset[0],
          v[1] * frequency + offset[1],
          v[2] * frequency + offset[2],
        );
      norm += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return sum / norm;
  };
  const planes = random.fork('facets');
  const cuts = Array.from({ length: options.facets }, () => {
    const normal = normalize([planes.range(-1, 1), planes.range(-0.6, 1), planes.range(-1, 1)]);
    return { normal, distance: planes.range(0.62, 0.86) };
  });
  const positions = sphere.positions.map((direction): Vec => {
    const radius = 1 + options.roughness * fbm(direction);
    let point: Vec = [direction[0] * radius, direction[1] * radius, direction[2] * radius];
    for (const { normal, distance } of cuts) {
      const d = point[0] * normal[0] + point[1] * normal[1] + point[2] * normal[2];
      if (d > distance)
        point = [
          point[0] - normal[0] * (d - distance),
          point[1] - normal[1] * (d - distance),
          point[2] - normal[2] * (d - distance),
        ];
    }
    if (point[1] < options.floor) point = [point[0], options.floor, point[2]];
    return point;
  });
  const min: Vec = [Infinity, Infinity, Infinity],
    max: Vec = [-Infinity, -Infinity, -Infinity];
  for (const point of positions)
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  const normalized = positions.map(
    (point): Vec => [
      (point[0] - (min[0] + max[0]) / 2) / (max[0] - min[0]),
      (point[1] - min[1]) / (max[1] - min[1]),
      (point[2] - (min[2] + max[2]) / 2) / (max[2] - min[2]),
    ],
  );
  const uvs = sphere.positions.map(([x, y, z]): [number, number] => [
    0.5 + Math.atan2(z, x) / (2 * Math.PI),
    0.5 + Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI,
  ]);
  return { positions: normalized, indices: sphere.faces.flat(), uvs };
}

/**
 * A palm frond along +X from the origin: a ribbon folded along its midrib that droops
 * parabolically by `droop` at the tip, with serrated edges that read as leaflets. Render it
 * with a double-sided material.
 */
export function frond(length: number, width: number, droop: number, stations = 12): MeshData {
  const positions: Vec[] = [],
    uvs: [number, number][] = [],
    indices: number[] = [];
  for (let i = 0; i <= stations; i++) {
    const t = i / stations;
    const x = length * t,
      y = -droop * t * t;
    const halfWidth = width * 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.7);
    const leaflet = i % 2 ? 1 : 0.55;
    const edge = halfWidth * leaflet,
      fold = edge * 0.35;
    positions.push([x, y - fold, -edge], [x, y, 0], [x, y - fold, edge]);
    uvs.push([t, 0], [t, 0.5], [t, 1]);
    if (i < stations) {
      const a = i * 3,
        b = a + 3;
      indices.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  return { positions, indices, uvs };
}
