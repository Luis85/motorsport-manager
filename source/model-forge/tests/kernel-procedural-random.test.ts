import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  createRandom,
  cyrb128,
  sha256Hex,
  canonical,
  ForgeError,
  SEED_MAX,
  DEFAULT_SEED,
} from '../src/kernel/index.js';
import { repository } from './helpers.js';

/**
 * Forge keyed PRNG v1 vectors. The first value of every stream is
 * LWProcessRandom.unit(seed, stream) of source/wildlands/source/process-random.ts; the
 * following values continue the same sfc32 generator (as wildlands generate does).
 */
const vectors: [number, string, [number, number, number]][] = [
  [1, 'default', [0.8889359254390001, 0.5073707906994969, 0.975911162327975]],
  [0, 'scatter', [0.9815188648644835, 0.08409046707674861, 0.696497438242659]],
  [42, 'terrain', [0.6383798921015114, 0.18939946196042, 0.38275561248883605]],
  [4294967295, 'a/b', [0.9240807003807276, 0.42749882861971855, 0.9380690173711628]],
  [7, 'tree/0', [0.750450053717941, 0.7734426176175475, 0.4441547584719956]],
];

test('forge keyed PRNG v1 reproduces the pinned vectors', () => {
  for (const [seed, stream, expected] of vectors) {
    const random = createRandom(seed, stream);
    assert.deepEqual([random.next(), random.next(), random.next()], expected, `${seed}|${stream}`);
    assert.equal(random.seed, seed);
    assert.equal(random.stream, stream);
  }
  assert.equal(DEFAULT_SEED, 1);
  assert.equal(SEED_MAX, 2 ** 32 - 1);
  assert.equal(createRandom().next(), vectors[0][2][0], 'default seed 1, stream default');
  assert.deepEqual(cyrb128('1|default'), cyrb128('1|default'));
});

test('first draws equal process-random unit() from the wildlands engine source', async () => {
  const file = path.join(repository, 'source/wildlands/source/process-random.ts');
  if (!existsSync(file)) return; // The pinned vectors above still hold the contract.
  await import(file);
  const engine = (
    globalThis as unknown as {
      LWProcessRandom: { unit(seed: number, key: string): number };
    }
  ).LWProcessRandom;
  for (const [seed, stream, expected] of vectors) {
    assert.equal(engine.unit(seed, stream), expected[0]);
    assert.equal(createRandom(seed, stream).next(), engine.unit(seed, stream));
  }
  for (let seed = 0; seed < 64; seed++)
    for (const stream of ['scatter/distribution', `scatter/c${seed}`, 'heightfield'])
      assert.equal(createRandom(seed, stream).next(), engine.unit(seed, stream));
});

test('forks are independent keyed streams and draws stay inside their ranges', () => {
  const root = createRandom(9, 'scatter');
  const child = root.fork('c3');
  assert.equal(child.stream, 'scatter/c3');
  assert.equal(child.next(), createRandom(9, 'scatter/c3').next());
  // Drawing from the parent never shifts a child stream.
  const before = createRandom(9, 'scatter').fork('c4').next();
  root.next();
  root.next();
  assert.equal(root.fork('c4').next(), before);
  const random = createRandom(5, 'ranges');
  const counts = [0, 0, 0];
  for (let i = 0; i < 3000; i++) {
    const value = random.range(-2, 3);
    assert.ok(value >= -2 && value < 3);
    const whole = random.int(4, 6);
    assert.ok(Number.isInteger(whole) && whole >= 4 && whole <= 6);
    counts[whole - 4]++;
  }
  assert.ok(
    counts.every((count) => count > 800),
    `int covers its range: ${counts}`,
  );
  const weighted = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 4000; i++) weighted[random.pick(['a', 'b', 'c'] as const, [1, 3, 0])]++;
  assert.equal(weighted.c, 0, 'zero weight is never picked');
  assert.ok(weighted.b > weighted.a * 2, `weights bias the pick: ${JSON.stringify(weighted)}`);
  const picks = new Set(Array.from({ length: 200 }, () => random.pick(['x', 'y', 'z'])));
  assert.deepEqual([...picks].sort(), ['x', 'y', 'z']);
});

test('seeds and pick inputs are validated with structured errors', () => {
  for (const seed of [-1, 1.5, 2 ** 32, Number.NaN])
    assert.throws(
      () => createRandom(seed),
      (error: unknown) => error instanceof ForgeError && error.code === 'INVALID_OPTION',
    );
  const random = createRandom(1, 'x');
  for (const [items, weights] of [
    [[], undefined],
    [['a'], [0]],
    [['a', 'b'], [1]],
    [['a'], [-1]],
  ] as [string[], number[] | undefined][])
    assert.throws(
      () => random.pick(items, weights),
      (error: unknown) => error instanceof ForgeError && error.code === 'INVALID_OPTION',
    );
});

test('the pure recipe digest equals node:crypto sha256', () => {
  for (const text of [
    '',
    'abc',
    'héllo ✓ 🌲',
    'x'.repeat(55),
    'y'.repeat(56),
    'z'.repeat(64),
    canonical({ b: [1, 2.5, -0], a: { nested: 'value' } }),
    'w'.repeat(100_000),
  ])
    assert.equal(sha256Hex(text), createHash('sha256').update(text, 'utf8').digest('hex'));
});
