import type { BufferGeometry } from 'three';
import { sphereUVs } from './surface-pattern.js';

type Buffers = { position: number[]; normal: number[]; uv: number[]; index: number[] };
const natives = new Map<string, Buffers>();
function buffers(geometry: BufferGeometry): Buffers {
  const position = Array.from(geometry.getAttribute('position').array);
  const normal = Array.from(geometry.getAttribute('normal').array);
  for (let i = 0; i < normal.length; i += 3) {
    const length = Math.hypot(normal[i], normal[i + 1], normal[i + 2]);
    for (let axis = 0; axis < 3; axis++) normal[i + axis] /= length || 1;
  }
  return {
    position,
    normal,
    uv: geometry.getAttribute('uv')
      ? Array.from(geometry.getAttribute('uv').array)
      : sphereUVs(position),
    index: geometry.index
      ? Array.from(geometry.index.array)
      : Array.from({ length: position.length / 3 }, (_, i) => i),
  };
}
/** Native recovery must preserve authored topology and UVs, not merely vertex count. */
export function unchangedNative(
  kind: string,
  geometry: BufferGeometry,
  create: () => BufferGeometry,
) {
  if (!natives.has(kind)) {
    const source = create();
    try {
      natives.set(kind, buffers(source));
    } finally {
      source.dispose();
    }
  }
  const source = natives.get(kind)!,
    actual = buffers(geometry);
  for (const [field, tolerance] of [
    ['position', 0.000011],
    ['normal', 0.0002],
    ['uv', 0.000001],
    ['index', 0],
  ] as const) {
    if (
      source[field].length !== actual[field].length ||
      source[field].some((value, i) => Math.abs(value - actual[field][i]) > tolerance)
    )
      return false;
  }
  return true;
}
