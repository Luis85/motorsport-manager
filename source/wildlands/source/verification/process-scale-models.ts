/// <reference path="../process-contracts.d.ts" />
/**
 * The generated process of the process-scale-browser suite: a pure data builder with no page access.
 *
 * `scaleProcess()` is a valid definition exactly at the step and flow limits of the schema (128 steps, 256 flows) with four pools
 * of three kinds, decisions with chance routes, forks and joins, timers, interrupting deadlines and multi-instance system steps.
 * It is fifteen segments of eight steps (decision, task, machine step with a deadline, fork, multi-instance system step, timer,
 * join, task) between a start, five closing tasks and two ends; each decision also has a few rare forward routes (chance 1 to 3 %)
 * to later steps outside any fork, which brings the flows to 256. Every route only moves forward, so a case finishes within the
 * transition limit. An arrival stream runs until minute 9,000 so a 10,000-minute run keeps work in progress throughout.
 */
const SEGMENTS = 15;
const TAIL = 5;
export const SCALE = {steps: 128, flows: 256} as const;

/** Readable names of the eight steps of segment `j`, long enough to need wrapping on a card. */
const names = (j: number) => {
 const n = String(j + 1).padStart(2, '0');
 return {d: `Route order batch ${n}`, t: `Review the order documents ${n}`, m: `Pack parcels on the robot line ${n}`, f: `Split parallel checks ${n}`,
  a: `Validate payment records ${n}`, b: `Cool-down window ${n}`, j: `Merge parallel checks ${n}`, k: `Confirm the shipment ${n}`};
};

export function scaleProcess(): LWProcess.Definition {
 const steps: LWProcess.Step[] = [];
 const flows: LWProcess.Flow[] = [];
 const scene = (id: string, x: number, y: number) => ({id: 'scene-' + id, position: [x, y] as [number, number], color: '#91b9d5'});
 const flow = (from: string, to: string, extra: Partial<LWProcess.Flow> = {}) => {
  flows.push({id: `f${flows.length + 1}`, from, to, ...extra});
 };
 steps.push({id: 'start', name: 'Orders arrive', kind: 'start', scene: scene('start', 0, 0)});
 flow('start', 'd0');
 for (let j = 0; j < SEGMENTS; j++) {
  const x = 14 + j * 56, n = names(j), id = (k: string) => k + j;
  steps.push(
   {id: id('d'), name: n.d, kind: 'decision', scene: scene(id('d'), x, 0)},
   {id: id('t'), name: n.t, kind: 'task', duration: 4 + j % 3, resources: {[j % 2 ? 'reviewers' : 'crew']: 1}, scene: scene(id('t'), x + 14, -14)},
   {id: id('m'), name: n.m, kind: 'machine', duration: 3, resources: {robots: 1}, technology: 'Robot line ' + (j + 1),
    deadline: {after: 6, mode: 'interrupt', flow: id('late')}, scene: scene(id('m'), x + 14, 0)},
   {id: id('f'), name: n.f, kind: 'fork', join: id('j'), scene: scene(id('f'), x + 14, 14)},
   {id: id('a'), name: n.a, kind: 'system', duration: 2, resources: {servers: 1}, technology: 'Payments ' + (j + 1),
    instances: {count: 2 + j % 3, mode: 'parallel'}, scene: scene(id('a'), x + 28, 10)},
   {id: id('b'), name: n.b, kind: 'timer', duration: 3 + j % 4, scene: scene(id('b'), x + 28, 24)},
   {id: id('j'), name: n.j, kind: 'join', scene: scene(id('j'), x + 42, 14)},
   {id: id('k'), name: n.k, kind: 'task', duration: 2, resources: {crew: 1}, scene: scene(id('k'), x + 42, 0)},
  );
  flow(id('d'), id('t'), {when: {chance: 25}, label: 'Needs review'});
  flow(id('d'), id('m'), {when: {chance: 25}, label: 'Ready to pack'});
  flow(id('t'), id('k'));
  flow(id('m'), id('k'));
  flows.push({id: id('late'), from: id('m'), to: 'lost', on: 'deadline'});
  flow(id('f'), id('a'));
  flow(id('f'), id('b'));
  flow(id('a'), id('j'));
  flow(id('b'), id('j'));
  flow(id('j'), id('k'));
  flow(id('k'), j + 1 < SEGMENTS ? 'd' + (j + 1) : 'x1');
 }
 for (let i = 1; i <= TAIL; i++) {
  const x = 14 + SEGMENTS * 56 + i * 14;
  steps.push({id: 'x' + i, name: `Close the order file ${i}`, kind: 'task', duration: 1, resources: {crew: 1}, scene: scene('x' + i, x, 0)});
  flow('x' + i, i < TAIL ? 'x' + (i + 1) : 'goal');
 }
 const end = 14 + SEGMENTS * 56 + (TAIL + 1) * 14;
 steps.push({id: 'goal', name: 'Order delivered', kind: 'end', outcome: 'goal', scene: scene('goal', end, 0)},
  {id: 'lost', name: 'Order cancelled', kind: 'end', outcome: 'lost', scene: scene('lost', end, 28)});
 // Rare forward routes from each decision to steps outside forks, until the flow limit is reached; the fallback goes last.
 const targets = (j: number) => [...Array.from({length: SEGMENTS - j - 1}, (_, k) => [`t${j + k + 1}`, `k${j + k + 1}`, `d${j + k + 1}`]).flat(),
  'x1', 'x3', 'goal', 'lost'];
 const extra = SCALE.flows - flows.length - SEGMENTS;
 for (let made = 0, round = 0; made < extra; round++) {
  for (let j = 0; j < SEGMENTS && made < extra; j++) {
   const to = targets(j)[round];
   if (to === undefined) continue;
   flow('d' + j, to, {when: {chance: 1 + (j + round) % 3}, label: 'Rare route ' + (round + 1)});
   made++;
  }
 }
 for (let j = 0; j < SEGMENTS; j++) flow('d' + j, 'f' + j, {label: 'Standard path'});
 return {format: 'wildlands-process', schemaVersion: 1, revision: 1, id: 'scale-line', name: 'Scale line at the limits',
  description: 'A generated process at the definition limits: 128 steps and 256 flows.', start: 'start', seed: 11,
  resources: [{id: 'crew', name: 'Order crew', capacity: 8, costPerMinute: 1}, {id: 'reviewers', name: 'Reviewers', capacity: 3, costPerMinute: 2},
   {id: 'robots', name: 'Robot line', capacity: 4, costPerMinute: 2, kind: 'machine'},
   {id: 'servers', name: 'Payment servers', capacity: 6, costPerMinute: 1, kind: 'system'}],
  steps, flows, arrivals: [{at: 0, until: 9000, interval: 30, data: {}}]};
}
