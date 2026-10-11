/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-work-state.ts" />
/// <reference path="./process-step-list.ts" />
/// <reference path="./process-sipoc-model.ts" />
/**
 * The studio's one per-step work-state derivation (LWProcessWorkState: `step`, `counts`, `border`, `states`, `progress`) against the
 * rules each surface kept before it moved there: the 2D card's counts, border, waiting count and progress bar, the step scene's
 * progress bar, the 3D caption's waiting count and room progress, the step list's counts and dot, and the SIPOC stage sums. The
 * previous rules are copied here verbatim as the reference; every demo, and a small line that blocks work, is run at several
 * minutes. The only intended difference is
 * the 3D room progress, which used to go below 0 for work running past its planned duration (its bar was hidden there and every
 * room prop clamps it); it is now clamped like the 2D bar.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {runtime} from './process-sdk.cjs';
import {test, build, stepOf, flowOf, startEnd} from './test-process-helpers.cjs';
require('./process-step-list.js');
require('./process-renderer-sipoc.js');
const work = (globalThis as unknown as {LWProcessWorkState: LWProcessWorkState.Api}).LWProcessWorkState;
const list = (globalThis as unknown as {LWProcessStepList: LWProcessStepList.Api}).LWProcessStepList;
const sipoc = (globalThis as unknown as {LWProcessSipocModel: LWProcessSipoc.ModelApi}).LWProcessSipocModel;
const CONTENT = path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content');
const demos = fs.readdirSync(CONTENT).filter(f => f.endsWith('.process.json')).sort()
 .map(f => [f, JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8')) as LWProcess.Definition] as const);
const MINUTES = [0, 45, 180, 600, 1440, 4000];
/** No demo holds work at these minutes, so a fast step feeding a slow step with a one-item backlog adds blocked (held) work. */
const blockedLine = build(startEnd(
 stepOf('make', 'task', {duration: 2, resources: {crew: 1}}),
 stepOf('check', 'task', {duration: 120, resources: {expert: 1}, backlog: {capacity: 1}}),
), [flowOf('start', 'make'), flowOf('make', 'check'), flowOf('check', 'end')], [{at: 0, count: 6, interval: 0, data: {}}],
[{id: 'crew', name: 'Crew', capacity: 4, costPerMinute: 1}, {id: 'expert', name: 'Expert', capacity: 1, costPerMinute: 1}]);
type Status = LWProcessWorkState.Status;

// The previous rules, verbatim from the surfaces before they moved to LWProcessWorkState.
const oldStatusOf = (t: LWProcess.Token): Status =>
 t.status === 'active' || t.status === 'timer' || t.status === 'backlog' || t.status === 'held' ? t.status : 'queued';
function oldCounts(work: LWProcess.Token[]): Record<Status, number> {
 const n = {active: 0, queued: 0, timer: 0, backlog: 0, held: 0};
 for (const t of work) n[oldStatusOf(t)]++;
 return n;
}
const oldBorder = (n: Record<Status, number>) =>
 n.held ? 'held' : n.active ? 'active' : n.queued ? 'queued' : n.timer ? 'timer' : n.backlog ? 'backlog' : 'idle';
/** The 2D card's progress bar. */
function oldCardProgress(step: LWProcess.Step, metric: LWProcess.StepMetric, work: LWProcess.Token[]): number {
 const active = work.filter(t => t.status === 'active');
 const done = active.reduce((s, t) => s + 1 - t.remaining / (step.duration || 1), 0) / metric.active;
 return metric.active > 0 ? Math.max(0, Math.min(1, done)) : 0;
}
/** The step scene's progress bar (drawn only while work is active). */
function oldSceneProgress(step: LWProcess.Step, work: LWProcess.Token[]): number | null {
 const active = work.filter(t => t.status === 'active'), duration = step.duration;
 if (!active.length) return null;
 const share = duration ? active.reduce((s, t) => s + 1 - t.remaining / duration, 0) / active.length : 0;
 return Math.max(0, Math.min(1, share));
}
/** The 3D room's progress (bar and props). */
function old3dProgress(step: LWProcess.Step, here: LWProcess.Token[]): number {
 const active = here.filter(t => t.status === 'active'), duration = step.duration ?? 1;
 return active.length ? active.reduce((n, t) => n + (duration - t.remaining) / duration, 0) / active.length : 0;
}
const RANK: Status[] = ['held', 'active', 'queued', 'timer', 'backlog'];
function oldDots(q: LWProcess.Snapshot): Map<string, Status> {
 const out = new Map<string, Status>();
 for (const t of q.tokens) {
  const status = oldStatusOf(t), at = out.get(t.stepId);
  if (at === undefined || RANK.indexOf(status) < RANK.indexOf(at)) out.set(t.stepId, status);
 }
 return out;
}
const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
function oldListCounts(s: LWProcess.Step, m: LWProcess.StepMetric): string {
 const automated = s.kind === 'machine' || s.kind === 'system', waiting = Math.max(0, m.queued - m.held);
 const parts = [m.active ? m.active + (automated ? ' running' : ' working') : '', waiting ? waiting + ' waiting' : '',
  m.held ? m.held + ' blocked' : '', m.timers.waiting ? m.timers.waiting + ' on timer' : ''];
 return parts.filter(Boolean).map(t => ' · ' + t).join('');
}
function oldListMarkup(view: LWProcessApp.View): string {
 const {definition: d, snapshot: q, selected} = view, live = oldDots(q);
 return d.steps.map((s, i) => {
  const m = q.steps.find(m => m.id === s.id)!, state = live.get(s.id), current = s.id === selected;
  const dot = state ? `<i data-state="${state}" aria-hidden="true"></i>` : '';
  const order = `<span class="process-order" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>`;
  return `<li><button data-step="${esc(s.id)}" class="process-step ${current ? 'selected' : ''}"${current ? ' aria-current="step"' : ''}>${order}`
   + `<span><strong>${esc(s.name)}</strong><small>${esc(s.kind)}${oldListCounts(s, m)}</small></span>${dot}</button></li>`;
 }).join('');
}

test('One work-state derivation: counts, card and dot states and progress agree with each surface\'s previous rule on all seven demos', () => {
 assert.equal(demos.length, 7);
 const seen = {held: 0, timer: 0, active: 0, overdue: 0, machines: 0};
 for (const [file, d] of [...demos, ['blocked line fixture', blockedLine] as const]) {
  const session = runtime.create(d, {seed: 7});
  let at = 0;
  try {
   for (const minute of MINUTES) {
    const q = minute > at ? session.advance(minute - at) : session.query();
    at = Math.max(at, minute);
    const where = `${file} at minute ${minute}`, metrics = new Map(q.steps.map(m => [m.id, m]));
    const byStep = new Map(d.steps.map(s => [s.id, q.tokens.filter(t => t.stepId === s.id)]));
    for (const t of q.tokens) assert.equal(work.statusOf(t), oldStatusOf(t), where);
    assert.deepEqual([...work.states(q.tokens)].sort(), [...oldDots(q)].sort(), `${where}: step list dots`);
    for (const s of d.steps) {
     const m = metrics.get(s.id)!, here = byStep.get(s.id)!, id = `${where}, ${s.id}`, n = work.step(m);
     assert.deepEqual(work.counts(here), oldCounts(here), id);
     assert.equal(work.border(work.counts(here)), oldBorder(oldCounts(here)), `${id}: card border`);
     assert.deepEqual([n.working, n.waiting, n.blocked, n.timers], [m.active, Math.max(0, m.queued - m.held), m.held, m.timers.waiting], id);
     assert.equal(n.waiting, m.queued - m.held, `${id}: the 3D caption's waiting count`);
     const progress = work.progress(s, here);
     assert.equal(progress, oldCardProgress(s, m, here), `${id}: card progress`);
     const scene = oldSceneProgress(s, here);
     if (scene !== null) assert.equal(progress, scene, `${id}: step scene progress`);
     const room = old3dProgress(s, here);
     assert(Math.abs(progress - Math.max(0, Math.min(1, room))) < 1e-12, `${id}: 3D room progress ${room} vs ${progress}`);
     if (room < 0) seen.overdue++;
     seen.held += m.held;
     seen.timer += m.timers.waiting;
     seen.active += m.active;
     if (work.verb(s.kind) === 'running') seen.machines += m.active;
    }
    const view = {definition: d, snapshot: q, selected: d.steps[1]!.id} as LWProcessApp.View;
    assert.equal(list.markup(view), oldListMarkup(view), `${where}: step list markup`);
    for (const stage of sipoc.model(d, q).stages) {
     const sum = (key: 'active' | 'queued' | 'held') => stage.stepIds.reduce((total, id) => total + (metrics.get(id)?.[key] ?? 0), 0);
     assert.deepEqual([stage.active, stage.queued, stage.held], [sum('active'), sum('queued') - sum('held'), sum('held')], `${where}: ${stage.name}`);
    }
   }
  } finally {
   session.dispose();
  }
 }
 // The runs cover working, blocked and timer work, running machine work and work past its planned duration (where the 3D progress
 // used to go below 0). Backlog tokens are covered by the token-level rules above whenever a run has them.
 for (const [state, count] of Object.entries(seen)) assert(count > 0, `the demo runs have ${state} work`);
});
