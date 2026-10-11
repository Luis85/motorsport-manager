/// <reference path="./process-contracts.d.ts" />
/**
 * Shared fixtures of the BPMN-class simulation semantics checks (test-process-semantics.cts): compact step, flow and
 * definition builders, a chunked runner, metric and event pickers, and the inclusive-fork, multi-instance and deadline
 * scenario builders that both the behaviour checks and the malformed-definition check edit. This module registers no checks.
 */
import assert from 'node:assert/strict';
import {catalog, runtime} from './process-sdk.cjs';

export const S = (id: string, kind: LWProcess.Kind, extra: Partial<LWProcess.Step> = {}): LWProcess.Step =>
 ({id, name: id, kind, scene: {id: 'scene-' + id, position: [0, 0], color: '#ffbb73'}, ...extra});
export const F = (id: string, from: string, to: string, extra: Partial<LWProcess.Flow> = {}): LWProcess.Flow => ({id, from, to, ...extra});
export const C = (when: unknown) => when as LWProcess.Condition;
export const ONE: LWProcess.Arrival[] = [{at: 0, count: 1, interval: 0, data: {}}];
export const W = (steps: LWProcess.Step[], flows: LWProcess.Flow[], arrivals: LWProcess.Arrival[] = ONE, resources: LWProcess.Resource[] = [],
 seed?: number): LWProcess.Definition =>
 ({format: 'wildlands-process', schemaVersion: 1, revision: 0, id: 'sim', name: 'Sim', start: 'start', ...seed === undefined ? {} : {seed}, resources,
  steps: steps.map((s, i) => ({...s, scene: {...s.scene, position: [i * 12, 0] as [number, number]}})), flows, arrivals});
export const pool = (id: string, capacity: number, costPerMinute = 1): LWProcess.Resource => ({id, name: id, capacity, costPerMinute});
export const cases = (...data: LWProcess.Fields[]): LWProcess.Arrival[] => data.map(d => ({at: 0, count: 1, interval: 0, data: d}));
/** Advances in the given chunk sizes (cycled) up to `total` minutes and returns the final snapshot. */
export const sim = (d: LWProcess.Definition, total: number, chunks: number[] = [total], options: LWProcess.RunOptions = {}) => {
 const s = runtime.create(d, options);
 try {
  for (let done = 0, i = 0; done < total; i++) {
   const n = Math.min(chunks[i % chunks.length]!, total - done);
   if (s.query().status === 'completed') break;
   s.advance(n);
   done += n;
  }
  return s.query();
 } finally { s.dispose(); }
};
export const invalid = (d: LWProcess.Definition) => {
 const v = catalog.validate(d);
 assert.equal(v.ok, false);
 return v.diagnostics.map(x => x.path + ' ' + x.message).join('\n');
};
export const M = (q: LWProcess.Snapshot) => ({minute: q.minute, arrived: q.metrics.arrived, completed: q.metrics.completed,
 failed: q.metrics.failed, cost: q.metrics.cost});
export const stepM = (q: LWProcess.Snapshot, id: string) => q.steps.find(x => x.id === id)!;
export const events = (q: LWProcess.Snapshot, kind: string) => q.events.filter(e => e.kind === kind);
export const rng = (globalThis as unknown as {LWProcessRandom: LWProcessRandom.Api}).LWProcessRandom;
export const graph = (globalThis as unknown as {
 LWProcessGraph: {evaluate(data: LWProcess.Fields, when: unknown, chance: (path: string, percent: number) => boolean): boolean}
}).LWProcessGraph;

/** start -> fork(inclusive) -> a / b (staff tasks) / c (default timer) -> join -> end; four cases choose different branch sets. */
export const inclusive = (extra: {
 data?: LWProcess.Fields[]; fork?: Partial<LWProcess.Step>; flows?: Partial<Record<'a' | 'b' | 'c', Partial<LWProcess.Flow> | null>>; steps?: LWProcess.Step[]
} = {}) => W([S('start', 'start'), ...extra.steps ?? [],
  S('fork', 'fork', {join: 'join', mode: 'inclusive', ...extra.fork}), S('a', 'task', {duration: 3, cost: 4, resources: {staff: 1}, set: {aDone: true}}),
  S('b', 'task', {duration: 5, cost: 6, resources: {staff: 1}, set: {bDone: true}}),
  S('c', 'timer', {duration: 2, set: {cDone: true}}), S('join', 'join'), S('end', 'end')],
  [F('s-f', 'start', extra.steps?.[0]?.id ?? 'fork'), ...extra.steps ? [F('p-f', extra.steps[0]!.id, 'fork')] : [],
   F('f-a', 'fork', 'a', {when: C({field: 'express', op: 'eq', value: true}), ...extra.flows?.a}),
   F('f-b', 'fork', 'b', {when: C({field: 'insured', op: 'eq', value: true}), ...extra.flows?.b}),
   F('f-c', 'fork', 'c', extra.flows?.c ?? {}), F('a-j', 'a', 'join'), F('b-j', 'b', 'join'), F('c-j', 'c', 'join'), F('j-e', 'join', 'end')],
  cases(...extra.data ?? [{express: true, insured: true}, {express: true, insured: false}, {express: false, insured: false}, {}]), [pool('staff', 3)]);

/** start -> t (multi-instance, staff pool) -> end. */
export const items = (spec: LWProcess.Instances, extra: Partial<LWProcess.Step> = {}, capacity = 2, arrivals: LWProcess.Arrival[] = ONE, seed?: number) =>
 W([S('start', 'start'), S('t', 'task', {duration: 4, cost: 10, resources: {w: 1}, set: {done: true}, add: {n: 1}, instances: spec, ...extra}),
  S('end', 'end')],
 [F('a', 'start', 't'), F('b', 't', 'end')], arrivals, [pool('w', capacity)], seed);

/** start -> t (staff task with a deadline) -> end; the deadline flow goes to `late`, then (interrupt) to the same end or (escalate) to its own end. */
export const guarded = (deadline: Partial<LWProcess.Deadline>, extra: Partial<LWProcess.Step> = {},
 over: {capacity?: number; arrivals?: LWProcess.Arrival[]; late?: Partial<LWProcess.Step>; outcomes?: boolean; seed?: number} = {}) => {
 const escalate = deadline.mode === 'escalate';
 return W([S('start', 'start'),
  S('t', 'task', {duration: 10, cost: 5, resources: {w: 1}, set: {done: true}, deadline: {mode: 'interrupt', flow: 'dl', ...deadline}, ...extra}),
  S('late', 'task', {duration: 3, set: {late: true}, ...over.late}),
  S('end', 'end', over.outcomes ? {outcome: 'goal'} : {}), ...escalate ? [S('end2', 'end', over.outcomes ? {outcome: 'lost'} : {})] : []],
  [F('a', 'start', 't'), F('b', 't', 'end'), F('dl', 't', 'late', {on: 'deadline'}), F('c', 'late', escalate ? 'end2' : 'end')],
  over.arrivals ?? cases({}, {}), [pool('w', over.capacity ?? 1, 2)], over.seed);
};
