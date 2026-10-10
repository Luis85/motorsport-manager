/// <reference path="./process-contracts.d.ts" />
/**
 * Shared fixtures of the read-model checks (no checks of its own): the bundled demos, a run that returns the session's detached
 * reads, deterministic chunkings, the one shared run per demo of the sweep suite, and flat sample records for comparing a series
 * sample with a snapshot taken at the same minute.
 */
import fs from 'node:fs';
import path from 'node:path';
import {runtime} from './process-sdk.cjs';
const CONTENT = path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content');
export const demos = () => fs.readdirSync(CONTENT).filter(f => f.endsWith('.process.json')).sort()
 .map(f => JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8')) as LWProcess.Definition);
/** Runs a fresh session in the given chunks and returns the last snapshot with the session's detached reads. */
export function reads(d: LWProcess.Definition, chunks: number[], options: LWProcess.RunOptions = {}) {
 const s = runtime.create(d, options);
 try {
  let q = s.query();
  for (const n of chunks) q = s.advance(n);
  return {q, series: s.series(), distributions: s.distributions(), recent: s.recent()};
 } finally { s.dispose(); }
}
/** Minutes and options of the one shared run per demo that the identity, series and distribution checks read (never mutated). */
export const SPAN = 2000, SHARED: LWProcess.RunOptions = {retained: 10000, series: {every: 30, points: 64}};
const shared = new Map<string, ReturnType<typeof reads>>();
export function demoRun(d: LWProcess.Definition): ReturnType<typeof reads> {
 if (!shared.has(d.id)) shared.set(d.id, reads(d, [SPAN], SHARED));
 return shared.get(d.id)!;
}
/** Deterministic pseudo-random chunk lengths (1..max) covering `total` minutes. */
export function chunking(total: number, seed: number, max: number): number[] {
 const out: number[] = [];
 let left = total, x = seed;
 while (left > 0) {
  x = (x * 1103515245 + 12345) % 2147483648;
  const n = Math.min(left, 1 + x % max);
  out.push(n);
  left -= n;
 }
 return out;
}
export const CUMULATIVE = ['arrived', 'completed', 'failed', 'dropped', 'goals', 'lost', 'cycleSum', 'wipArea', 'cost'] as const;
export const STEP_CUMULATIVE = ['starts', 'completed', 'entered', 'waitMinutes', 'waitingArea', 'blockedArea'] as const;
/** Sample `i` of a series as a flat record, for comparing against a snapshot of the same minute. */
export function sample(s: LWProcess.Series, i: number): Record<string, number> {
 const out: Record<string, number> = {minute: s.minutes[i]!};
 for (const [k, v] of Object.entries(s.run)) out[k] = v[i]!;
 for (const [id, block] of Object.entries(s.steps)) for (const [k, v] of Object.entries(block)) out[id + '.' + k] = v[i]!;
 for (const [id, block] of Object.entries(s.pools)) for (const [k, v] of Object.entries(block)) out[id + '.' + k] = v[i]!;
 return out;
}
/** The same record built from a snapshot taken at the sample's minute (peaks are left out: a snapshot holds no history). */
export function fromSnapshot(q: LWProcess.Snapshot): Record<string, number> {
 const m = q.metrics, out: Record<string, number> = {minute: q.minute, wip: m.active};
 for (const k of CUMULATIVE) out[k] = (m as unknown as Record<string, number>)[k]!;
 for (const x of q.steps) {
  const here = (status: string) => q.tokens.filter(t => t.stepId === x.id && t.status === status).length;
  Object.assign(out, {[x.id + '.waiting']: here('queued'), [x.id + '.working']: here('active'), [x.id + '.blocked']: here('held'),
   [x.id + '.timers']: here('timer'), [x.id + '.starts']: x.starts, [x.id + '.completed']: x.completed, [x.id + '.entered']: x.entered,
   [x.id + '.waitMinutes']: x.waitMinutes, [x.id + '.waitingArea']: x.minutesBy!.waiting, [x.id + '.blockedArea']: x.minutesBy!.blocked});
 }
 for (const r of q.resources) Object.assign(out, {[r.id + '.busy']: r.busy, [r.id + '.busyMinutes']: r.busyMinutes});
 return out;
}
export const withoutPeaks = (record: Record<string, number>) => Object.fromEntries(Object.entries(record).filter(([k]) => !k.endsWith('Peak')));
