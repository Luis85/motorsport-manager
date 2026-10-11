/**
 * Keyed deterministic randomness for `wildlands generate` (forge keyed PRNG v1).
 *
 * A stream is a pure function of (seed, stream key): the cyrb128 hash of `seed|stream` seeds an
 * sfc32 generator. The 13th sfc32 output is the stream's first value, so the first draw of every
 * stream equals `LWProcessRandom.unit(seed, stream)` of `process-random.ts` (the shared test
 * vectors); later draws continue the same generator. There is no ambient source, clock or state
 * shared between streams, so adding a draw to one stream never shifts another.
 */

/** Seeds are whole numbers from 0 to 2^32 - 1; the default is 1. */
export const SEED_MAX = 4294967295;
export const DEFAULT_SEED = 1;

/** cyrb128 string hash: four 32-bit words that depend on every character of the text. */
export function cyrb128(text: string): [number, number, number, number] {
 let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
 for (let i = 0; i < text.length; i++) {
  const k = text.charCodeAt(i);
  h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
  h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
 }
 h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
 h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
 return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export interface Random {
 /** Seed and stream key this generator was made from. */
 readonly seed: number;
 readonly stream: string;
 /** Uniform value in [0, 1). */
 next(): number;
 /** Uniform value in [min, max). */
 range(min: number, max: number): number;
 /** Uniform whole number in [min, max] (both inclusive). */
 int(min: number, max: number): number;
 /** One element of a nonempty list. */
 pick<T>(values: readonly T[]): T;
 /** Independent child stream `<stream>/<key>` of the same seed. */
 fork(key: string): Random;
}

export function createRandom(seed: number = DEFAULT_SEED, stream = 'default'): Random {
 if (!Number.isSafeInteger(seed) || seed < 0 || seed > SEED_MAX) throw RangeError('Seed must be a whole number from 0 to ' + SEED_MAX + '.');
 let [a, b, c, d] = cyrb128(seed + '|' + stream);
 const round = (): number => {
  const t = (a + b | 0) + d | 0;
  d = d + 1 | 0; a = b ^ b >>> 9; b = c + (c << 3) | 0; c = c << 21 | c >>> 11; c = c + t | 0;
  return t >>> 0;
 };
 // Twelve warm-up rounds are discarded; the 13th output is the first value of the stream.
 for (let warm = 0; warm < 12; warm++) round();
 const next = (): number => round() / 4294967296;
 const random: Random = {
  seed, stream, next,
  range: (min, max) => min + next() * (max - min),
  int: (min, max) => min + Math.floor(next() * (max - min + 1)),
  pick: values => {
   if (!values.length) throw RangeError('Cannot pick from an empty list.');
   return values[Math.floor(next() * values.length)]!;
  },
  fork: key => createRandom(seed, stream + '/' + key)
 };
 return random;
}
