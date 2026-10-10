import type { SurfaceSpec } from '../domain/schema.js';
// Mirrors engine asset-surface.ts. Byte parity tests are mandatory for changes.
export const surfaceAlgorithm = 'littlewild-surface-v1';
const SIZE = 128;
export function resolveSurfaceAlgorithm(
  surface: SurfaceSpec,
): 'littlewild-surface-v1' | 'littlewild-surface-v2' {
  return surface.version === 2 ? 'littlewild-surface-v2' : 'littlewild-surface-v1';
}
function noise(x: number, y: number, seed: number): number {
  let n = Math.imul(x ^ seed, 374761393) ^ Math.imul(y + seed, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
export function generateSurface(surface: SurfaceSpec): {
  width: number;
  height: number;
  color: Uint8Array;
  normal: Uint8Array;
} {
  if (
    (surface.version !== undefined && surface.version !== 1 && surface.version !== 2) ||
    !['fur', 'cloth', 'leather'].includes(surface.kind) ||
    !Number.isInteger(surface.seed) ||
    surface.seed < 0 ||
    surface.seed > 65535 ||
    !Number.isFinite(surface.scale) ||
    surface.scale < 1 ||
    surface.scale > 16 ||
    !Number.isFinite(surface.strength) ||
    surface.strength < 0 ||
    surface.strength > 1
  )
    throw Error('Invalid bounded asset surface');
  const heights = new Float64Array(SIZE * SIZE),
    color = new Uint8Array(SIZE * SIZE * 4),
    normal = new Uint8Array(color.length);
  const sample = (x: number, y: number) =>
    noise((x + SIZE) % SIZE, (y + SIZE) % SIZE, surface.seed);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const grain = sample(x, y);
      let h: number;
      if (surface.kind === 'fur') {
        // Short vertical fibres, staggered rather than a repetitive checkerboard.
        h =
          0.55 * sample(x, Math.floor(y / 4)) +
          0.25 * sample(x - 1, Math.floor((y + 2) / 4)) +
          0.2 * grain;
      } else if (surface.kind === 'cloth') {
        const warp = 0.5 + 0.5 * Math.cos((x * Math.PI) / 2),
          weft = 0.5 + 0.5 * Math.cos((y * Math.PI) / 2);
        h = 0.45 * warp + 0.45 * weft + 0.1 * grain;
      } else h = 0.65 * grain + 0.35 * sample(Math.floor(x / 3), Math.floor(y / 3));
      heights[y * SIZE + x] = h;
    }
  if (surface.version === 2) fineHeights(surface, heights);
  const height = (x: number, y: number) =>
    heights[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)]!;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4,
        h = height(x, y),
        strength = surface.strength;
      const relief = surface.version === 2 ? 0.38 : 0.65;
      const dx = (height(x - 1, y) - height(x + 1, y)) * strength * relief,
        dy = (height(x, y - 1) - height(x, y + 1)) * strength * relief;
      const length = Math.hypot(dx, dy, 1),
        shade = Math.round(
          255 -
            (1 - h) * strength * (surface.version === 2 ? 18 : surface.kind === 'fur' ? 26 : 20),
        );
      color.set([shade, shade, shade, 255], i);
      normal.set(
        [
          Math.round(((dx / length) * 0.5 + 0.5) * 255),
          Math.round(((dy / length) * 0.5 + 0.5) * 255),
          Math.round(((1 / length) * 0.5 + 0.5) * 255),
          255,
        ],
        i,
      );
    }
  return { width: SIZE, height: SIZE, color, normal };
}
/** Version 2 uses continuous tapered strands; version 1 above remains byte-for-byte replayable. */
function fineHeights(surface: SurfaceSpec, heights: Float64Array): void {
  const sample = (x: number, y: number) =>
    noise((x + SIZE) % SIZE, (y + SIZE) % SIZE, surface.seed);
  if (surface.kind === 'fur') {
    for (let i = 0; i < heights.length; i++)
      heights[i] = 0.28 + 0.025 * sample(i % SIZE, Math.floor(i / SIZE));
    for (let strand = 0; strand < 1800; strand++) {
      const x0 = noise(strand, 0, surface.seed) * SIZE,
        y0 = Math.floor(noise(strand, 1, surface.seed) * SIZE);
      const length = 6 + Math.floor(noise(strand, 2, surface.seed) * 13),
        lean = (noise(strand, 3, surface.seed) - 0.5) * 0.6;
      const width = 0.45 + noise(strand, 4, surface.seed) * 0.35,
        relief = 0.25 + 0.3 * noise(strand, 5, surface.seed);
      for (let step = 0; step < length; step++) {
        const t = step / (length - 1),
          center = x0 + lean * step + Math.sin(t * Math.PI) * 0.65;
        const envelope = Math.pow(Math.sin(t * Math.PI), 0.65),
          y = (y0 + step) % SIZE;
        for (let offset = -1; offset <= 1; offset++) {
          const x = Math.floor(center) + offset,
            distance = Math.abs(x + 0.5 - center) / width;
          if (distance >= 1.5) continue;
          const h = 0.28 + relief * envelope * Math.exp(-distance * distance * 2),
            index = y * SIZE + (((x % SIZE) + SIZE) % SIZE);
          heights[index] = Math.max(heights[index]!, h);
        }
      }
    }
    return;
  }
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      if (surface.kind === 'cloth') {
        const warp = 0.5 + 0.5 * Math.cos((x * Math.PI) / 2),
          weft = 0.5 + 0.5 * Math.cos((y * Math.PI) / 2);
        const over = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
        heights[y * SIZE + x] =
          0.3 + 0.25 * (over ? warp : weft) + 0.08 * (over ? weft : warp) + 0.025 * sample(x, y);
      } else
        heights[y * SIZE + x] =
          0.4 +
          0.08 * sample(x, y) +
          0.06 * (sample(x - 1, y) + sample(x + 1, y) + sample(x, y - 1) + sample(x, y + 1));
    }
}
/** Legacy meshes get a local spherical projection; authored seam-aware UVs take precedence. */
export function sphereUVs(positions: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!,
      y = positions[i + 1]!,
      z = positions[i + 2]!,
      r = Math.hypot(x, y, z);
    out.push(
      0.5 + Math.atan2(z, x) / (2 * Math.PI),
      r ? Math.acos(Math.max(-1, Math.min(1, y / r))) / Math.PI : 0.5,
    );
  }
  return out;
}
