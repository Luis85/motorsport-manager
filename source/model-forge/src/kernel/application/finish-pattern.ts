import type { FinishSpec } from '../domain/schema.js';

/** Immutable v1 recipe. Generic runtimes must retain byte parity before accepting this version. */
export const finishAlgorithm = 'forge-finish-v1';
const SIZE = 128;
// Capture this realm's standard intrinsics once; pixel loops also run in isolated
// preview contexts where repeated global property resolution is expensive.
const { imul, floor, min, round, hypot } = Math;
function noise(x: number, y: number, seed: number): number {
  let n = imul(x ^ seed, 374761393) ^ imul(y + seed, 668265263);
  n = imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
/** Periodic value noise keeps the tile boundary continuous at every octave.
 * Each lattice corner is immutable within a recipe. Evaluate it once, retaining
 * Float64 intermediates and the v1 interpolation order for identical pixels.
 */
function field(cells: number, seed: number): Float64Array {
  const lattice = new Float64Array(cells * cells);
  for (let y = 0; y < cells; y++)
    for (let x = 0; x < cells; x++) lattice[y * cells + x] = noise(x, y, seed);
  const indices = new Uint8Array(SIZE),
    smooth = new Float64Array(SIZE);
  for (let position = 0; position < SIZE; position++) {
    const point = (position / SIZE) * cells,
      index = floor(point),
      t = point - index;
    indices[position] = index;
    smooth[position] = t * t * (3 - 2 * t);
  }
  const values = new Float64Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const iy = indices[y]!,
      sy = smooth[y]!;
    const row = iy * cells,
      nextRow = ((iy + 1) % cells) * cells;
    for (let x = 0; x < SIZE; x++) {
      const ix = indices[x]!,
        sx = smooth[x]!,
        nextX = (ix + 1) % cells;
      values[y * SIZE + x] =
        (lattice[row + ix]! * (1 - sx) + lattice[row + nextX]! * sx) * (1 - sy) +
        (lattice[nextRow + ix]! * (1 - sx) + lattice[nextRow + nextX]! * sx) * sy;
    }
  }
  return values;
}
/** Color is sRGB; normals and roughness(G)/metalness(B) are linear data, with opaque alpha. */
export function generateFinish(finish: FinishSpec): {
  width: number;
  height: number;
  color: Uint8Array;
  normal: Uint8Array;
  orm: Uint8Array;
} {
  if (
    finish.version !== 1 ||
    !['painted-metal', 'bare-metal', 'rubber'].includes(finish.kind) ||
    !Number.isInteger(finish.seed) ||
    finish.seed < 0 ||
    finish.seed > 65535 ||
    !Number.isFinite(finish.scale) ||
    finish.scale < 1 ||
    finish.scale > 16 ||
    !Number.isFinite(finish.wear) ||
    finish.wear < 0 ||
    finish.wear > 1 ||
    (finish.palette !== undefined &&
      (!Array.isArray(finish.palette) ||
        finish.palette.length < 1 ||
        finish.palette.length > 4 ||
        finish.palette.some((color) => !/^#[0-9a-fA-F]{6}$/.test(color))))
  )
    throw Error('Invalid bounded material finish');
  const color = new Uint8Array(SIZE * SIZE * 4),
    normal = new Uint8Array(color.length);
  const orm = new Uint8Array(color.length),
    heights = new Float64Array(SIZE * SIZE);
  const palette = (finish.palette ?? ['#ffffff']).map((color) =>
    [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)),
  );
  const broad = field(4, finish.seed + 11),
    fine = field(8, finish.seed + 17);
  const chipsField = field(16, finish.seed + 31);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const grain = noise(x, y, finish.seed),
        index = y * SIZE + x,
        offset = index * 4;
      const patches = broad[index]! * 0.7 + fine[index]! * 0.3;
      const chips = chipsField[index]!;
      const worn = finish.wear * (chips > 0.69 ? (chips - 0.69) / 0.31 : 0);
      const scratch =
        noise(x, floor(y / 8), finish.seed + 47) > 0.987 ? finish.wear * (0.35 + 0.65 * grain) : 0;
      const exposed = min(1, worn * 5 + scratch);
      const swatch = palette[min(palette.length - 1, floor(patches * palette.length))]!;
      const metal =
        finish.kind === 'bare-metal' ? 1 : finish.kind === 'painted-metal' ? exposed : 0;
      const shade = finish.kind === 'rubber' ? 0.91 + 0.07 * grain : 0.94 + 0.06 * grain;
      const roughness =
        finish.kind === 'rubber'
          ? 0.88 + 0.12 * grain
          : finish.kind === 'bare-metal'
            ? 0.42 + 0.22 * grain + 0.18 * finish.wear
            : 0.78 + 0.16 * grain - 0.35 * exposed;
      for (let channel = 0; channel < 3; channel++) {
        const painted = swatch[channel]! * shade;
        color[offset + channel] = round(
          finish.kind === 'painted-metal'
            ? painted * (1 - exposed) + (112 + 30 * grain) * exposed
            : painted,
        );
      }
      color[offset + 3] = 255;
      orm[offset] = 255;
      orm[offset + 1] = round(roughness * 255);
      orm[offset + 2] = round(metal * 255);
      orm[offset + 3] = 255;
      heights[index] = (grain - 0.5) * (finish.kind === 'rubber' ? 0.1 : 0.04) - exposed * 0.15;
    }
  const height = (x: number, y: number) =>
    heights[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)]!;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = height(x - 1, y) - height(x + 1, y),
        dy = height(x, y - 1) - height(x, y + 1);
      const length = hypot(dx, dy, 1);
      const offset = (y * SIZE + x) * 4;
      normal[offset] = round(((dx / length) * 0.5 + 0.5) * 255);
      normal[offset + 1] = round(((dy / length) * 0.5 + 0.5) * 255);
      normal[offset + 2] = round(((1 / length) * 0.5 + 0.5) * 255);
      normal[offset + 3] = 255;
    }
  return { width: SIZE, height: SIZE, color, normal, orm };
}
