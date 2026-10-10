import { fail } from '../domain/errors.js';
import type { Random } from '../domain/random.js';
import { PROCEDURAL_MAX_CANDIDATES, type Area } from '../domain/schema-procedural.js';

/**
 * Deterministic 2D point distributions over [x, z]. Every coordinate is rounded to 1e-4
 * before it is tested or returned, so the reported points are exactly the points that
 * passed the spacing rules. The only randomness is the caller's keyed stream.
 */
export type Point2 = [number, number];
export interface Bounds2 {
  min: Point2;
  max: Point2;
}
/** Round to 1e-4 and normalize -0, so JSON output never depends on the sign of zero. */
export const round4 = (value: number) => Math.round(value * 1e4) / 1e4 + 0;
const point = (x: number, z: number): Point2 => [round4(x), round4(z)];

function budget(count: number, what: string): void {
  if (count > PROCEDURAL_MAX_CANDIDATES)
    fail(
      'PROCEDURAL_BUDGET',
      `${what} would generate about ${Math.ceil(count)} candidate points; the limit is ${PROCEDURAL_MAX_CANDIDATES}.`,
      {
        limit: PROCEDURAL_MAX_CANDIDATES,
        estimate: Math.ceil(count),
        hint: 'Increase the spacing (minDistance, step or spacing) or shrink the area.',
      },
    );
}

export function areaBounds(area: Area): Bounds2 {
  if (area.type === 'rect') return { min: [...area.min], max: [...area.max] };
  if (area.type === 'circle') {
    const [x, z] = area.center;
    return { min: [x - area.radius, z - area.radius], max: [x + area.radius, z + area.radius] };
  }
  const pad = area.type === 'path' ? area.width / 2 : 0;
  const xs = area.points.map((p) => p[0]),
    zs = area.points.map((p) => p[1]);
  return {
    min: [Math.min(...xs) - pad, Math.min(...zs) - pad],
    max: [Math.max(...xs) + pad, Math.max(...zs) + pad],
  };
}

/** Squared distance from p to the segment a-b, using only + - * /. */
function segmentDistance2(p: Point2, a: readonly number[], b: readonly number[]): number {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length2 = dx * dx + dz * dz;
  let t = length2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = p[0] - (a[0] + t * dx),
    ez = p[1] - (a[1] + t * dz);
  return ex * ex + ez * ez;
}

/** Boundary points count as inside. Polygons use the even-odd rule. */
export function insideArea(area: Area, p: Point2): boolean {
  switch (area.type) {
    case 'rect':
      return (
        p[0] >= area.min[0] && p[0] <= area.max[0] && p[1] >= area.min[1] && p[1] <= area.max[1]
      );
    case 'circle': {
      const dx = p[0] - area.center[0],
        dz = p[1] - area.center[1];
      return dx * dx + dz * dz <= area.radius * area.radius;
    }
    case 'polygon': {
      let inside = false;
      const points = area.points;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, zi] = points[i],
          [xj, zj] = points[j];
        if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi)
          inside = !inside;
      }
      return inside;
    }
    case 'path': {
      const limit = (area.width / 2) * (area.width / 2);
      for (let i = 1; i < area.points.length; i++)
        if (segmentDistance2(p, area.points[i - 1], area.points[i]) <= limit) return true;
      return false;
    }
  }
}

export const insideBounds = (bounds: Bounds2, p: Point2) =>
  p[0] >= bounds.min[0] && p[0] <= bounds.max[0] && p[1] >= bounds.min[1] && p[1] <= bounds.max[1];

/**
 * Bridson Poisson-disk sampling inside bounds: no two points closer than minDistance.
 * Candidates around an active point are drawn uniformly from the square [-2r, 2r]^2 and
 * rejected unless r <= distance <= 2r (the annulus), which needs no trigonometry.
 */
export function poissonDisk(bounds: Bounds2, minDistance: number, random: Random): Point2[] {
  const width = bounds.max[0] - bounds.min[0],
    depth = bounds.max[1] - bounds.min[1],
    r = minDistance,
    r2 = r * r;
  // Bridson fills about 0.6 to 0.7 points per r^2; refuse early before allocating the grid.
  budget((0.6 * (width * depth)) / r2, 'Poisson sampling');
  const cell = r / Math.SQRT2,
    columns = Math.floor(width / cell) + 1,
    rows = Math.floor(depth / cell) + 1;
  const grid = new Int32Array(columns * rows).fill(-1);
  const points: Point2[] = [],
    active: number[] = [];
  const cellOf = (p: Point2): [number, number] => [
    Math.min(columns - 1, Math.floor((p[0] - bounds.min[0]) / cell)),
    Math.min(rows - 1, Math.floor((p[1] - bounds.min[1]) / cell)),
  ];
  const free = (p: Point2) => {
    const [cx, cz] = cellOf(p);
    for (let z = Math.max(0, cz - 2); z <= Math.min(rows - 1, cz + 2); z++)
      for (let x = Math.max(0, cx - 2); x <= Math.min(columns - 1, cx + 2); x++) {
        const index = grid[z * columns + x];
        if (index < 0) continue;
        const dx = points[index][0] - p[0],
          dz = points[index][1] - p[1];
        if (dx * dx + dz * dz < r2) return false;
      }
    return true;
  };
  const add = (p: Point2) => {
    budget(points.length + 1, 'Poisson sampling');
    const [cx, cz] = cellOf(p);
    grid[cz * columns + cx] = points.length;
    active.push(points.length);
    points.push(p);
  };
  add(point(bounds.min[0] + random.next() * width, bounds.min[1] + random.next() * depth));
  while (active.length) {
    const slot = Math.floor(random.next() * active.length),
      origin = points[active[slot]];
    let found = false;
    for (let attempt = 0; attempt < 30 && !found; attempt++) {
      for (let tries = 0; tries < 32; tries++) {
        const dx = (random.next() * 4 - 2) * r,
          dz = (random.next() * 4 - 2) * r,
          d2 = dx * dx + dz * dz;
        if (d2 < r2 || d2 > 4 * r2) continue;
        const candidate = point(origin[0] + dx, origin[1] + dz);
        if (insideBounds(bounds, candidate) && free(candidate)) {
          add(candidate);
          found = true;
        }
        break;
      }
    }
    if (!found) {
      active[slot] = active[active.length - 1];
      active.pop();
    }
  }
  return points;
}

/** A grid centered in bounds with spacing step; jitter (0..1) moves points by up to step/2. */
export function gridLayout(
  bounds: Bounds2,
  step: number,
  jitter: number,
  random: Random,
): Point2[] {
  const width = bounds.max[0] - bounds.min[0],
    depth = bounds.max[1] - bounds.min[1];
  const columns = Math.floor(width / step + 1e-9) + 1,
    rows = Math.floor(depth / step + 1e-9) + 1;
  budget(columns * rows, 'Grid layout');
  const startX = bounds.min[0] + (width - (columns - 1) * step) / 2,
    startZ = bounds.min[1] + (depth - (rows - 1) * step) / 2;
  const points: Point2[] = [];
  for (let z = 0; z < rows; z++)
    for (let x = 0; x < columns; x++) {
      const ox = jitter > 0 ? (random.next() - 0.5) * jitter * step : 0,
        oz = jitter > 0 ? (random.next() - 0.5) * jitter * step : 0;
      points.push(point(startX + x * step + ox, startZ + z * step + oz));
    }
  return points;
}

export interface PathPoint {
  point: Point2;
  /** Degrees about +Y that turn +Z to the local path direction. */
  heading: number;
}
/** Points every spacing meters along a polyline, starting at its first point. */
export function pathLayout(points: readonly Point2[], spacing: number): PathPoint[] {
  const segments: { a: Point2; dx: number; dz: number; length: number }[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0],
      dz = points[i][1] - points[i - 1][1],
      length = Math.sqrt(dx * dx + dz * dz);
    if (length > 1e-9) segments.push({ a: points[i - 1], dx, dz, length });
    total += length;
  }
  if (!segments.length) return [{ point: point(points[0][0], points[0][1]), heading: 0 }];
  const count = Math.floor(total / spacing + 1e-9) + 1;
  budget(count, 'Path layout');
  const result: PathPoint[] = [];
  let segment = 0,
    start = 0;
  for (let k = 0; k < count; k++) {
    const distance = Math.min(total, k * spacing);
    while (segment < segments.length - 1 && distance > start + segments[segment].length) {
      start += segments[segment].length;
      segment++;
    }
    const s = segments[segment],
      t = Math.min(1, (distance - start) / s.length);
    result.push({
      point: point(s.a[0] + t * s.dx, s.a[1] + t * s.dz),
      heading: round4((Math.atan2(s.dx, s.dz) * 180) / Math.PI),
    });
  }
  return result;
}

/**
 * Uniform points in bounds until count of them lie inside the area (or 64 attempts per
 * point were spent). Returns every attempt; the caller counts the outside ones.
 */
export function uniformRandom(
  area: Area,
  count: number,
  random: Random,
): { points: Point2[]; inside: number } {
  const bounds = areaBounds(area),
    width = bounds.max[0] - bounds.min[0],
    depth = bounds.max[1] - bounds.min[1];
  const points: Point2[] = [];
  let inside = 0;
  for (let attempt = 0; attempt < count * 64 && inside < count; attempt++) {
    const p = point(bounds.min[0] + random.next() * width, bounds.min[1] + random.next() * depth);
    points.push(p);
    if (insideArea(area, p)) inside++;
  }
  return { points, inside };
}
