/// <reference path="./process-contracts.d.ts" />
/** Counter-based randomness: a draw is a pure function of (seed, key); there is no stream state, ambient source or clock. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessLimits: LWProcess.Limits; LWProcessRandom?: LWProcessRandom.Api};
 const limits = root.LWProcessLimits;
 /** cyrb128 string hash: four 32-bit words that depend on every character of the text. */
 function hash(text: string): [number, number, number, number] {
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
 /** One uniform value in [0, 1) from the hash of `seed|key` through a warmed-up sfc32 generator. */
 function unit(seed: number, key: string): number {
  let [a, b, c, d] = hash(seed + '|' + key), out = 0;
  for (let round = 0; round < 13; round++) {
   const t = (a + b | 0) + d | 0; d = d + 1 | 0; a = b ^ b >>> 9; b = c + (c << 3) | 0; c = c << 21 | c >>> 11; c = c + t | 0; out = t >>> 0;
  }
  return out / 4294967296;
 }
 // Natural log from exactly rounded arithmetic only (+ - * /), so results never differ between JavaScript engines.
 const LN2 = 0.6931471805599453;
 function ln(x: number): number {
  let m = x, exponent = 0;
  while (m < .5) { m *= 2; exponent--; }
  const y = (m - 1) / (m + 1), y2 = y * y; let term = y, sum = 0;
  for (let k = 1; k < 80; k += 2) { sum += term / k; term *= y2; }
  return 2 * sum + exponent * LN2;
 }
 const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
 const int = (seed: number, key: string, min: number, max: number) => min + Math.floor(unit(seed, key) * (max - min + 1));
 const chance = (seed: number, key: string, percent: number) => unit(seed, key) * 100 < percent;
 function weighted<T>(seed: number, key: string, values: {value: T; weight: number}[]): T {
  const total = values.reduce((n, v) => n + v.weight, 0), r = unit(seed, key) * total; let upto = 0;
  for (const v of values) { upto += v.weight; if (r < upto) return v.value; }
  return values[values.length - 1]!.value;
 }
 /** An integer of at least 1 minute (at most the run limit) drawn from a validated distribution. */
 function sample(seed: number, key: string, dist: LWProcess.Dist): number {
  const u = unit(seed, key), min = dist.min ?? 1, max = dist.max ?? limits.minutes;
  let value: number;
  if (dist.dist === 'uniform') value = min + Math.floor(u * (max - min + 1));
  else if (dist.dist === 'triangular') {
   const mode = dist.mode ?? min, span = max - min, c = span ? (mode - min) / span : 0;
   value = span === 0 ? min : Math.round(u < c ? min + Math.sqrt(u * span * (mode - min)) : max - Math.sqrt((1 - u) * span * (max - mode)));
  } else value = Math.round(-(dist.mean ?? 1) * ln(1 - u));
  return clamp(value, Math.max(1, dist.dist === 'exponential' ? 1 : min), Math.min(limits.minutes, dist.dist === 'exponential' ? dist.max ?? limits.minutes : max));
 }
 root.LWProcessRandom = {unit, int, chance, weighted, sample};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessRandom;
})(globalThis);
