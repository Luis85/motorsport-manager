import { fail } from './errors.js';

/**
 * Forge keyed PRNG v1: the deterministic randomness of every procedural generator.
 *
 * A stream is a pure function of (seed, stream key): the cyrb128 hash of `seed|stream`
 * seeds an sfc32 generator. Twelve warm-up outputs are discarded and the 13th is the
 * stream's first value, so the first draw of every stream equals
 * `LWProcessRandom.unit(seed, stream)` of source/wildlands/source/process-random.ts (the
 * shared test vectors); later draws continue the same generator. There is no ambient
 * source, clock or state shared between streams: a draw added to one stream never shifts
 * another, which is why generators fork one stream per concern or per candidate.
 */

/** Seeds are whole numbers from 0 to 2^32 - 1; the default is 1. */
export const SEED_MAX = 4294967295;
export const DEFAULT_SEED = 1;

/** cyrb128 string hash: four 32-bit words that depend on every character of the text. */
export function cyrb128(text: string): [number, number, number, number] {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
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
  /** One element of a nonempty list; with weights, proportional to each nonnegative weight. */
  pick<T>(items: readonly T[], weights?: readonly number[]): T;
  /** Independent child stream `<stream>/<key>` of the same seed. */
  fork(key: string): Random;
}

export function checkSeed(seed: number): number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > SEED_MAX)
    fail('INVALID_OPTION', `Seed must be a whole number from 0 to ${SEED_MAX}.`, { seed });
  return seed;
}

export function createRandom(seed: number = DEFAULT_SEED, stream = 'default'): Random {
  checkSeed(seed);
  let [a, b, c, d] = cyrb128(seed + '|' + stream);
  const round = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  // Twelve warm-up rounds are discarded; the 13th output is the first value of the stream.
  for (let warm = 0; warm < 12; warm++) round();
  const next = (): number => round() / 4294967296;
  const random: Random = {
    seed,
    stream,
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items, weights) => {
      if (!items.length) fail('INVALID_OPTION', 'Cannot pick from an empty list.');
      if (!weights) return items[Math.floor(next() * items.length)];
      if (
        weights.length !== items.length ||
        weights.some((w) => !Number.isFinite(w) || w < 0) ||
        !weights.some((w) => w > 0)
      )
        fail('INVALID_OPTION', 'Pick weights must be nonnegative, one per item, not all zero.');
      const total = weights.reduce((sum, w) => sum + w, 0),
        r = next() * total;
      let upto = 0,
        last = 0;
      for (let i = 0; i < items.length; i++) {
        if (weights[i] > 0) last = i;
        upto += weights[i];
        if (r < upto) return items[i];
      }
      return items[last];
    },
    fork: (key) => createRandom(seed, stream + '/' + key),
  };
  return random;
}
