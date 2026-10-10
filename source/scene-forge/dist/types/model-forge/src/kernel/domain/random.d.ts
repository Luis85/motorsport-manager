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
export declare const SEED_MAX = 4294967295;
export declare const DEFAULT_SEED = 1;
/** cyrb128 string hash: four 32-bit words that depend on every character of the text. */
export declare function cyrb128(text: string): [number, number, number, number];
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
export declare function checkSeed(seed: number): number;
export declare function createRandom(seed?: number, stream?: string): Random;
