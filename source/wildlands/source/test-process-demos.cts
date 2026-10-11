/// <reference path="./process-contracts.d.ts" />
/**
 * Pinned end-to-end evidence for the bundled agency demo processes that exercise the step kinds: the agile vendor project,
 * the order fulfilment line (one run and a long steady run), the loan application converted from BPMN and the weekly
 * delivery and release train. Each check reads its definition from docs/concepts/agency-delivery/content and pins exact
 * numbers and fingerprints. The step-kind semantics themselves are checked in test-process-steps.cts.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {catalog, runtime} from './process-sdk.cjs';
import {test, copy, run} from './test-process-helpers.cjs';

test('Agile vendor project completes three projects with variable iterations, UAT rework and UX in product design', () => {
 const agile = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/agile-vendor.process.json'), 'utf8')) as LWProcess.Definition;
 const admission = catalog.validate(agile); assert.equal(admission.ok, true); assert.deepEqual(admission.diagnostics, []);
 assert(agile.steps.every(s => !s.scene.asset), 'themed rooms render without attached assets');
 assert(agile.steps.every(s => !admission.diagnostics.some(e => /asset/.test(e.path + e.code))));
 assert(agile.steps.find(s => s.id === 'product-design')!.resources!.ux! >= 1);
 const kickoffDate = agile.steps.find(s => s.id === 'kickoff-date')!; assert.equal(kickoffDate.kind, 'timer'); assert.equal(kickoffDate.until, 12); assert.equal(kickoffDate.duration, undefined);
 const timers = agile.steps.filter(s => s.kind === 'timer'); assert.deepEqual(timers.map(s => s.id), ['kickoff-date', 'sprint-review', 'hypercare']);
 const auto = agile.steps.filter(s => s.kind === 'system'); assert.deepEqual(auto.map(s => s.id), ['ci-build', 'regression-suite', 'auto-deploy']); assert(auto.every(s => Object.keys(s.resources!).every(id => agile.resources.find(p => p.id === id)!.kind === 'system')), 'system steps demand only system pools');
 assert(timers.every(s => !s.resources && s.cost === undefined && !s.backlog), 'timers declare no resources, cost or backlog');
 const ids = ['case-0001', 'case-0002', 'case-0003'], s = runtime.create(agile); let q: ReturnType<typeof s.advance>;
 try {
  q = s.advance(1);
  for (let i = 1; i < 308; i++) {
   for (const r of q.resources) assert(r.busy <= r.capacity, `${r.id} within capacity`);
   if (q.minute === 5) assert(q.tokens.some(t => t.status === 'timer' && t.due === 12) && q.resources.every(r => r.busy === 0), 'a case waiting for the kickoff date occupies nobody');
   q = s.advance(1);
  }
  for (const r of q.resources) assert(r.busy <= r.capacity);
 } finally {s.dispose();}
 const whole = run(agile, 600); assert.equal(whole.status, 'completed'); assert.equal(whole.minute, 308); assert.equal(whole.metrics.completed, 3); assert.equal(whole.metrics.failed, 0); assert.equal(whole.metrics.cost, 2362);
 assert(whole.cases.every(c => c.status === 'completed')); assert.equal(whole.receiptsDropped, 0);
 const visits = (caseId: string, stepId: string) => whole.receipts.filter(r => r.caseId === caseId && r.stepId === stepId).length;
 const per = (stepId: string) => ids.map(c => visits(c, stepId));
 assert.deepEqual(per('sprint'), [6, 2, 3], 'iterations x releases');
 assert.deepEqual(per('ci-build'), per('sprint'), 'CI runs for every iteration'); assert.deepEqual(per('ci-build'), [6, 2, 3]); assert.deepEqual(per('regression-suite'), [2, 1, 3]); assert.deepEqual(per('auto-deploy'), per('release-go-live'), 'one automated deployment per go-live');
 assert.deepEqual(per('sprint-review'), [6, 2, 3]); assert.deepEqual(per('release-go-live'), [2, 1, 3]); assert.deepEqual(per('kickoff'), [1, 1, 1]);
 assert.deepEqual(ids.map(c => whole.cases.find(x => x.id === c)!.data.increments), [6, 2, 3], 'increments counter equals iteration visits');
 assert.deepEqual(ids.map(c => whole.cases.find(x => x.id === c)!.data.release), [2, 1, 3]); assert.deepEqual(whole.cases.map(c => c.data.iteration), [0, 0, 0]);
 assert.deepEqual(per('fix'), [1, 0, 1], 'fix visits only for cases arriving with findings'); assert.deepEqual(per('release-uat'), [3, 1, 4]);
 assert.deepEqual(whole.cases.map(c => c.data.findings), [false, false, false]);
 for (const c of ids) assert(whole.receipts.filter(r => r.caseId === c && r.stepId === 'kickoff').every(r => r.started >= 12), 'no case passes kickoff before the contractual date');
 assert.deepEqual(ids.map(c => whole.receipts.find(r => r.caseId === c && r.stepId === 'kickoff-date')!.finished), [12, 15, 30]);
 const free = whole.receipts.filter(r => timers.some(t => t.id === r.stepId)); assert(free.length > 0 && free.every(r => r.finished >= r.started));
 for (const u of whole.resources) assert(u.utilization <= 1, `${u.id} utilization`);
 assert(whole.resources.find(u => u.id === 'delivery-manager')!.busyMinutes > 0);
 assert.deepEqual(whole.resources.filter(u => u.kind === 'system').map(u => [u.id, u.busyMinutes]), [['ci-pipeline', 34], ['test-automation', 18]]);
 assert(whole.receipts.filter(r => auto.some(a => a.id === r.stepId)).every(r => r.finished > r.started), 'system steps ran as timed work');
 assert(whole.cases.every(c => c.data.buildGreen === true && c.data.regressionGreen === true && c.data.releaseDeployed === true));
});
test('Order fulfilment line completes with robots, systems and a human spot-check', () => {
 const line = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/order-fulfilment.process.json'), 'utf8')) as LWProcess.Definition;
 const admission = catalog.validate(line); assert.equal(admission.ok, true); assert.deepEqual(admission.diagnostics, []); assert(line.steps.every(s => !s.scene.asset));
 const kindOf = (id: string) => line.resources.find(p => p.id === id)!.kind ?? 'people';
 const automated = line.steps.filter(s => s.kind === 'machine' || s.kind === 'system'); assert.deepEqual(automated.map(s => s.id), ['validate-order', 'fraud-check', 'pick-items', 'shipping-documents', 'pack', 'label-parcel', 'notify-customer']);
 for (const st of automated) assert(Object.keys(st.resources!).every(id => kindOf(id) === st.kind), `${st.id} demands only ${st.kind} pools`);
 for (const st of line.steps.filter(s => s.kind === 'task')) assert(Object.keys(st.resources!).every(id => kindOf(id) === 'people'), `${st.id} uses people`);
 assert(automated.filter(s => s.outputs).length >= 3 && line.resources.filter(p => p.kind !== 'people').every(p => p.costPerMinute > 0));
 const at = (d: LWProcess.Definition, minutes: number, options: LWProcess.RunOptions = {}) => { const s = runtime.create(d, options); try { return s.advance(minutes); } finally { s.dispose(); } };
 const seeded = (d: LWProcess.Definition, minutes: number, chunks: number[], options: LWProcess.RunOptions = {}) => { const s = runtime.create(d, options); try { let q = s.query(); for (let done = 0, i = 0; done < minutes; i++) { const n = Math.min(chunks[i % chunks.length]!, minutes - done); q = s.advance(n); done += n; for (const r of q.resources) assert(r.busy <= r.capacity, `${r.id} within capacity at ${q.minute}`); } return JSON.stringify(q); } finally { s.dispose(); } };
 assert.equal(line.seed, 20260607); assert.equal(line.arrivals.length, 1); assert.equal(line.arrivals[0]!.open, true); assert.equal(line.arrivals[0]!.gap!.dist, 'exponential'); assert(line.arrivals[0]!.draws!.some(x => x.field === 'priority') && line.arrivals[0]!.draws!.some(x => x.field === 'defect'));
 const whole = at(line, 1000, {horizon: null}); assert.equal(whole.seed, 20260607); assert.equal(whole.status, 'running'); assert.equal(whole.minute, 1000);
 assert.deepEqual([whole.metrics.arrived, whole.metrics.completed, whole.metrics.failed, whole.metrics.dropped, whole.metrics.active, whole.metrics.cost], [262, 256, 0, 0, 6, 21344]);
 const use = (q: LWProcess.Snapshot, id: string) => q.resources.find(u => u.id === id)!; assert.deepEqual(['packing-line', 'robots', 'inspector', 'packer'].map(id => [id, use(whole, id).kind, use(whole, id).busyMinutes]), [['packing-line', 'machine', 2307], ['robots', 'machine', 1725], ['inspector', 'people', 1808], ['packer', 'people', 240]]);
 const repacks = whole.steps.find(x => x.id === 'repack')!.completed; assert.equal(repacks, 48); assert.equal(whole.receipts.filter(r => r.stepId === 'repack').length > 0, true);
 assert.equal(whole.steps.find(x => x.id === 'spot-check')!.completed, 304, 'every repack adds one more spot-check visit'); assert.equal(whole.metrics.arrived - whole.metrics.completed, whole.metrics.active);
 for (const st of automated) for (const o of st.outputs ?? []) assert(whole.receipts.filter(r => r.stepId === st.id).every(r => o.field in r.output), `${st.id} delivers ${o.field}`);
 assert(whole.receipts.filter(r => r.stepId === 'pack').every(r => r.duration! >= 7 && r.duration! <= 11) && whole.receipts.filter(r => r.stepId === 'pick-items').every(r => r.duration! >= 4 && r.duration! <= 10));
 assert(whole.cases.every(c => (c.input.priority === 'express' || c.input.priority === 'standard') && typeof c.input.defect === 'boolean'));
 const finished = whole.cases.filter(c => c.status === 'completed'); assert(finished.length > 0 && finished.every(c => c.data.defect === false && c.data.notified === true && c.data.parcels === 1));
 const reference = JSON.stringify(whole); assert.equal(JSON.stringify(at(line, 1000, {horizon: null})), reference); assert.equal(seeded(line, 1000, [1000], {horizon: null}), reference);
 assert.equal(seeded(line, 1000, [1], {horizon: null}), reference); assert.equal(seeded(line, 1000, [7, 33, 250], {horizon: null}), reference);
 const other = at(line, 1000, {horizon: null, seed: 7}); assert.equal(other.seed, 7); assert.notEqual(JSON.stringify(other), reference); assert.deepEqual([other.metrics.arrived, other.metrics.completed, other.metrics.cost, use(other, 'packing-line').busyMinutes], [273, 268, 22664, 2464]);
 const unlimited = runtime.create(line, {horizon: null});
 try { const early = unlimited.advance(10000), late = unlimited.advance(10000); assert.equal(early.status, 'running'); assert.equal(late.status, 'running'); assert.equal(late.minute, 20000); assert(late.metrics.completed > early.metrics.completed + 2000); assert.equal(late.metrics.failed, 0); } finally { unlimited.dispose(); }
});
test('Order fulfilment line stays stable under steady random demand with bounded queues', () => {
 const line = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/order-fulfilment.process.json'), 'utf8')) as LWProcess.Definition, limit = runtime.limits.active;
 const s = runtime.create(line, {horizon: null});
 try {
  let q = s.query(); for (let i = 0; i < 50; i++) { q = s.advance(100); assert(q.metrics.active <= limit, `active within ${limit}`); assert.equal(q.metrics.failed, 0); assert.equal(q.status, 'running'); for (const r of q.resources) assert(r.busy <= r.capacity); }
  assert.equal(q.minute, 5000); const lane = q.resources.find(u => u.id === 'packing-line')!;
  assert(lane.utilization > .6 && lane.utilization < .95, String(lane.utilization)); assert.equal(Math.round(lane.utilization * 1000), 762); assert.equal(lane.busyMinutes, 11437);
  assert.deepEqual([q.metrics.arrived, q.metrics.completed, q.metrics.dropped, q.metrics.active], [1274, 1261, 0, 13]);
  assert(q.metrics.active < 40, 'the queue stays small, not growing without bound'); const kept = q.cases.filter(c => c.status !== 'active').length; assert(kept <= runtime.limits.retained); assert.equal(q.retention.finishedDropped, q.metrics.completed + q.metrics.failed - kept); assert.equal(q.retention.finishedDropped, 1061);
 } finally { s.dispose(); }
});
test('Loan application demo converted from BPMN completes with exact inclusive, multi-instance and SLA escalation evidence', () => {
 const loan = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/loan-application.process.json'), 'utf8')) as LWProcess.Definition;
 const admission = catalog.validate(loan); assert.equal(admission.ok, true); assert.deepEqual(admission.diagnostics, []); assert.equal(catalog.fingerprint(loan), '221bcc4d80ed5e55');
 assert.equal(loan.id, 'loan-application'); assert.equal(loan.seed, 7); assert(loan.steps.every(s => s.scene && !s.scene.asset && typeof s.phase === 'string'), 'every step has a scene marker and a phase');
 const at = (id: string) => loan.steps.find(s => s.id === id)!;
 assert.equal(at('gw-extra').mode, 'inclusive'); assert.deepEqual(at('sub-docs-task-verify').instances, {count: 3, mode: 'parallel'}); assert.deepEqual(at('task-review').deadline, {mode: 'escalate', flow: 'f-sla', after: 90});
 // The applicant is the case, not a capacity: its two steps are pool-free touchpoints and no Customer pool remains.
 const applicant = ['task-submit', 'task-sign'].map(id => [at(id).kind, at(id).channel, at(id).resources]);
 assert.deepEqual(applicant, [['touchpoint', 'web', undefined], ['touchpoint', 'document', undefined]]);
 assert.deepEqual(loan.resources.map(r => r.id), ['bank-clerk', 'credit-engine', 'automation']);
 // Main-route ends carry outcomes; the escalation end has none (an escalation end's outcome is never counted).
 assert.deepEqual(['end-paid', 'end-rejected', 'end-breach'].map(id => at(id).outcome), ['goal', 'lost', undefined]);
 assert.deepEqual(loan.arrivals, [{at: 0, until: 960, interval: 30, gap: {dist: 'exponential', mean: 30}, draws: [{field: 'amount', kind: 'int', min: 1000, max: 50000}, {field: 'years', kind: 'int', min: 0, max: 10}], data: {}}]);
 const q = run(loan, 1500), step = (id: string) => q.steps.find(s => s.id === id)!;
 assert.deepEqual([q.seed, q.minute, q.status, q.metrics.arrived, q.metrics.completed, q.metrics.failed, q.metrics.cost, q.metrics.meanCycleMinutes], [7, 984, 'completed', 32, 32, 0, 2414, 50.125]);
 assert.deepEqual([q.metrics.goals, q.metrics.lost, q.metrics.conversion, q.metrics.capacityCost], [31, 1, 969, 13776]);
 assert.deepEqual(q.resources.map(r => [r.id, r.kind, r.busyMinutes]), [['bank-clerk', 'people', 923], ['credit-engine', 'system', 253], ['automation', 'system', 64]]);
 assert.equal(Math.round(q.resources.find(r => r.id === 'bank-clerk')!.utilization * 1000), 313);
 assert.deepEqual(step('sub-docs-task-verify').items, {started: 96, finished: 96}); assert.equal(step('sub-docs-task-verify').completed, 32);
 assert.deepEqual(step('task-review').deadlines, {interrupted: 0, escalated: 1}); assert.deepEqual(['task-notify', 'end-breach'].map(id => step(id).completed), [1, 1]);
 // Inclusive fork: 9 medium-risk cases; 7 income and 2 employer branches plus 2 default (empty) branches reach the join, which continues 9 times.
 assert.deepEqual(['gw-extra', 'task-income', 'task-employer', 'gw-extrajoin'].map(id => [step(id).visits, step(id).completed]), [[9, 9], [7, 7], [2, 2], [11, 9]]);
 assert.deepEqual(['gw-risk', 'task-review', 'gw-review', 'task-sign', 'end-paid', 'end-rejected'].map(id => step(id).completed), [32, 3, 3, 31, 31, 1]);
 // Clock chunking: one advance equals 1, 7 and 60 minute chunks (and a mixed cycle); capacity is never exceeded.
 const chunked = (chunks: number[]) => { const s = runtime.create(loan); try { let r = s.query(); for (let done = 0, i = 0; done < 1500; i++) { const n = Math.min(chunks[i % chunks.length]!, 1500 - done); r = s.advance(n); done += n; for (const u of r.resources) assert(u.busy <= u.capacity, `${u.id} within capacity at ${r.minute}`); } return JSON.stringify(r); } finally { s.dispose(); } };
 const reference = JSON.stringify(q); for (const chunks of [[1500], [1], [7], [60], [1, 7, 60]]) assert.equal(chunked(chunks), reference, `chunks ${chunks.join('/')}`);
 assert.deepEqual(JSON.parse(JSON.stringify(run(copy(loan), 1500))), q);
 const other = (() => { const s = runtime.create(loan, {seed: 8}); try { return s.advance(1500); } finally { s.dispose(); } })();
 assert.deepEqual([other.seed, other.minute, other.metrics.arrived, other.metrics.completed, other.metrics.cost], [8, 1104, 34, 34, 3301]);
 assert.deepEqual([other.metrics.goals, other.metrics.lost, other.metrics.conversion], [31, 3, 912]);
});

test('Weekly delivery and release train runs refinement, planning, dailies, review and retro from a 0.1.0 skeleton to the 1.0.0 MVP with exact evidence', () => {
 const train = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/delivery-release.process.json'), 'utf8')) as LWProcess.Definition;
 const admission = catalog.validate(train); assert.equal(admission.ok, true); assert.deepEqual(admission.diagnostics, []); assert.equal(catalog.fingerprint(train), 'bb5b3b08b28b3bb6');
 assert.equal(train.id, 'delivery-release'); assert.equal(train.seed, 7); assert.equal(train.genre, undefined); assert(train.steps.every(s => s.scene && !s.scene.asset && typeof s.phase === 'string'), 'every step has a scene marker and a phase');
 const at = (id: string) => train.steps.find(s => s.id === id)!;
 assert.deepEqual(at('build').instances, {field: 'plannedItems', mode: 'parallel'}); assert.deepEqual(at('dailies').instances, {count: 4, mode: 'sequential'});
 assert.deepEqual(at('build').deadline, {after: 1440, mode: 'escalate', flow: 'build-impediment'}); assert.equal(at('release-prep').mode, 'inclusive'); assert.equal(at('iteration').mode, undefined);
 assert.deepEqual(train.flows.filter(f => f.from === 'feedback').map(f => [f.to, f.when ?? null]), [['reprioritise', {chance: 30}], ['retro', null]]);
 assert.deepEqual(train.arrivals, [{at: 0, count: 1, interval: 0, data: {}, draws: [{field: 'mvpIncrements', kind: 'int', min: 6, max: 8}]}]);
 const q = run(train, 20000), step = (id: string) => q.steps.find(s => s.id === id)!;
 assert.deepEqual([q.seed, q.minute, q.status, q.metrics.arrived, q.metrics.completed, q.metrics.failed, q.metrics.cost, q.metrics.meanCycleMinutes], [7, 19007, 'completed', 1, 1, 0, 119928, 19007]);
 assert.deepEqual(q.resources.map(r => [r.id, r.kind, r.busyMinutes]), [['product-owner', 'people', 3180], ['delivery-lead', 'people', 1860], ['developers', 'people', 33602], ['ux-designer', 'people', 1095], ['stakeholders', 'people', 1725], ['ci-pipeline', 'system', 372]]);
 assert.equal(Math.round(q.resources.find(r => r.id === 'developers')!.utilization * 1000), 589);
 // Eight weekly iterations after 0.1.0 release 0.2.0 to 0.9.0; one review asked for more, so the drawn MVP scope of 8 grew to 9 before 1.0.0.
 assert.deepEqual(q.cases[0]!.input, {mvpIncrements: 8}); assert.deepEqual([q.cases[0]!.data.increments, q.cases[0]!.data.iteration, q.cases[0]!.data.mvpIncrements, q.cases[0]!.data.impediments], [9, 8, 9, 1]);
 assert.deepEqual(['skeleton-release', 'refinement', 'planning', 'review', 'feedback', 'reprioritise', 'retro', 'release-pipeline', 'mvp-launch', 'mvp-live'].map(id => step(id).completed), [1, 8, 8, 8, 8, 1, 8, 8, 1, 1]);
 // Parallel items queue for three developers; four sequential iteration days per week; one overdue item escalated to the impediment route.
 assert.deepEqual([step('build').items, step('build').waitMinutes, step('dailies').items], [{started: 30, finished: 30}, 3986, {started: 32, finished: 32}]);
 assert.deepEqual(step('build').deadlines, {interrupted: 0, escalated: 1}); assert.deepEqual(['impediment', 'impediment-handled'].map(id => step(id).completed), [1, 1]);
 // Inclusive release gateway: 8 releases; 3 UX and 4 migration branches plus 3 default (empty) branches reach the join, which continues 8 times.
 assert.deepEqual(['release-prep', 'ux-acceptance', 'migration-rehearsal', 'release-ready'].map(id => [step(id).visits, step(id).completed]), [[8, 8], [3, 3], [4, 4], [10, 8]]);
 // Clock chunking: one advance equals 1, 7 and 60 minute chunks (and a mixed cycle); capacity is never exceeded.
 const chunked = (chunks: number[]) => { const s = runtime.create(train); try { let r = s.query(); for (let done = 0, i = 0; done < 20000; i++) { const n = Math.min(chunks[i % chunks.length]!, 20000 - done); r = s.advance(n); done += n; for (const u of r.resources) assert(u.busy <= u.capacity, `${u.id} within capacity at ${r.minute}`); } return JSON.stringify(r); } finally { s.dispose(); } };
 const reference = JSON.stringify(q); for (const chunks of [[20000], [1], [7], [60], [1, 7, 60]]) assert.equal(chunked(chunks), reference, `chunks ${chunks.join('/')}`);
 assert.deepEqual(JSON.parse(JSON.stringify(run(copy(train), 20000))), q);
 const other = (() => { const s = runtime.create(train, {seed: 8}); try { return s.advance(20000); } finally { s.dispose(); } })();
 assert.deepEqual([other.seed, other.minute, other.status, other.metrics.completed, other.metrics.cost, other.cases[0]!.data.increments, other.cases[0]!.data.mvpIncrements], [8, 20000, 'running', 0, 136123, 8, 9]);
});
