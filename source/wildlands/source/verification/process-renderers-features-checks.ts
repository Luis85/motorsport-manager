/// <reference path="../process-contracts.d.ts" />
/**
 * Instance, deadline and inclusive-fork checks of the process renderers suite (process-renderers-browser.ts calls
 * `featureChecks` once, in its own order), on the rich claims desk: the 2D deadline, conditional and instance marks, route views
 * that ignore where a deadline flow is listed, the 3D gateway marker, deadline arrows, room counters and escalated markers; the
 * inspector sentences and live counters, read without ticking; the overview summary shown only when a process has these
 * features; and escaped definition text in those inspector sections.
 */
import assert from 'node:assert/strict';
import {nextFrames} from './browser-harness';
import {query, type Studio} from './process-browser-fixture';
import {claimsDesk} from './process-browser-models';

export async function featureChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, showIo, importClaims, importJson} = studio;
 await check('Renderers show inclusive forks, multiple instances, deadline paths and escalated tokens and route views ignore deadline flows', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await importClaims(true, true); await page.locator('#mode-2d').click();
  for (let i = 0; i < 2; i++) await page.locator('#advance').click();
  const live = (await query(page)).snapshot;
  assert.ok(live.tokens.some(t => t.escalated) && live.tokens.some(t => t.item !== undefined && t.items === 3 || t.deadlineAt !== undefined),
   'the seeded run holds escalated, item and deadline tokens');
  assert.equal(live.minute, 60);
  const map = await page.evaluate(() => {
   const q = (s: string) => [...document.querySelectorAll<SVGElement>('#map svg ' + s)];
   const css = (e: Element) => getComputedStyle(e), paint = (e: Element) => css(e).fill === 'none' ? css(e).stroke : css(e).fill;
   return {deadline: q('.pm-edge-deadline').map(e => [e.dataset.flow, css(e).stroke, css(e).strokeDasharray, e.getAttribute('class')]),
    plain: q('.pm-edge:not(.pm-edge-deadline):not(.pm-edge-conditional)').map(e => css(e).stroke), tags: q('.pm-deadline-tag text').map(t => t.textContent),
    conditional: q('.pm-edge-conditional').map(e => [e.dataset.flow, e.classList.contains('pm-edge-inclusive'), css(e).stroke, css(e).strokeDasharray]),
    gateways: q('.pm-gateway-inclusive').length, instances: q('.pm-instances').map(p => p.textContent), clocks: q('.pm-deadline-badge').length,
    escalated: q('.pm-token-escalated').map(paint), label: document.getElementById('process-map-route')!.getAttribute('aria-label')};
  });
  assert.deepEqual(map.deadline.map(d => d[0]).sort(), ['approve-late', 'intake-late']);
  assert.ok(map.deadline.every(d => d[2] !== 'none' && d[1] !== map.plain[0]), 'deadline flows are dashed in their own colour');
  assert.deepEqual(map.deadline.map(d => d[3]).sort(), ['pm-edge pm-edge-deadline pm-edge-escalate', 'pm-edge pm-edge-deadline pm-edge-interrupt']);
  assert.deepEqual(map.tags.sort(), ['deadline · escalate', 'deadline · interrupt']);
  assert.deepEqual(map.conditional.map(c => c[0]).sort(), ['to-gift', 'to-insure']);
  const decision = (c: (string | boolean | undefined)[]) => c[1] === true && c[2] === 'rgb(199, 152, 113)' && c[3] !== 'none' && c[3] !== map.deadline[0]![2];
  assert.ok(map.conditional.every(decision), 'inclusive fork flows read like decision flows: dashed, unlike deadline dots');
  assert.equal(map.gateways, 1); assert.match(map.label ?? '', /inclusive fork/);
  assert.equal(map.instances.length, 1); assert.match(map.instances[0] ?? '', /^× (3|per case \(lines\))/); assert.equal(map.clocks, 2);
  assert.ok(map.escalated.length >= 1 && map.escalated.every(f => f === 'rgb(255, 138, 92)'), 'escalated tokens use their own marker colour');
  await page.locator('[data-step="inspect"]').click();
  const inspectPill = await page.locator('#map svg .pm-instances').textContent();
  assert.match(inspectPill ?? '', /^× (3|per case \(lines\)) · \d+ started · \d+ done$/);
  assert.match(await page.locator('#map svg g[role=button]').getAttribute('aria-label') ?? '', /instances parallel, \d+ items started, \d+ finished/);
  await page.locator('[data-step="approve"]').click();
  assert.match(await page.locator('#map svg .pm-deadline-badge').textContent() ?? '', /\d+ escalated · 0 interrupted/);
  assert.match(await page.locator('#map svg .pm-deadline-due').textContent() ?? '', /deadline at minute \d+/);
  // The data view reads the same facts.
  await showIo();
  await page.locator('[data-step="approve"]').click();
  await page.locator('#process-case').selectOption(live.tokens.find(t => t.stepId === 'approve' && t.deadlineAt !== undefined)!.caseId);
  assert.match(await page.locator('#process-data').innerText(), /After 20 min of work the deadline escalates/);
  assert.match(await page.locator('#process-data').innerText(), /deadline at minute \d+/);
  await page.locator('[data-step="inspect"]').click();
  assert.match(await page.locator('#process-data').innerText(), /3 instances/);
  // Route views follow the normal flow however the deadline flow is listed.
  const routes = await page.evaluate(({early, late}) => {
   const w = globalThis as unknown as {LWProcessSipoc: LWProcessSipoc.Api; LWProcessJourney: LWProcessJourney.Api;
    LWProcessStudio: {query(): {snapshot: LWProcess.Snapshot; definition: LWProcess.Definition}}};
   const snapshot = w.LWProcessStudio.query().snapshot, journey = (definition: LWProcess.Definition) => {
    const host = document.createElement('div'); document.body.append(host); const surface = w.LWProcessJourney.create(host, () => {});
    try {
     surface.draw({definition, snapshot, selected: null} as unknown as LWProcessApp.View);
     return [...host.querySelectorAll('.jm-card')].map(c => [c.textContent, c.classList.contains('branch')]);
    } finally {surface.dispose(); host.remove();}
   };
   return {sipoc: [w.LWProcessSipoc.model(early, snapshot).stages, w.LWProcessSipoc.model(late, snapshot).stages], journey: [journey(early), journey(late)]};
  }, {early: claimsDesk(true, true) as unknown as LWProcess.Definition, late: claimsDesk(true, false) as unknown as LWProcess.Definition});
  assert.deepEqual(routes.sipoc[0], routes.sipoc[1], 'SIPOC stages do not depend on where the deadline flow is listed');
  assert.ok(routes.sipoc[0]!.some(s => s.stepIds.includes('approve') && s.stepIds.includes('notify')), 'the escalation path joins the stage of its step');
  assert.deepEqual(routes.journey[0], routes.journey[1], 'journey main route does not depend on where the deadline flow is listed');
  assert.ok(routes.journey[0]!.some(c => /Notify the manager/.test(String(c[0])) && c[1] === true), 'the deadline path is a branch, never the main route');
  // 3D: gateway marker, deadline arrow colours, item and deadline counters in the room caption and escalated markers.
  await page.locator('#overview').click(); await page.locator('#mode-3d').click(); await nextFrames(page);
  const room = await page.evaluate(() => {
   const w = globalThis as any, T = w.THREE, view = w.LWProcessStudio.query(), canvas = document.createElement('canvas');
   canvas.style.cssText = 'width:400px;height:300px';
   document.body.append(canvas);
   let captured: any; const Original = T.WebGLRenderer;
   T.WebGLRenderer = class extends Original {
    constructor(options: any) {
     super(options);
     const render = this.render;
     this.render = (scene: any, camera: any) => {captured = scene; return render.call(this, scene, camera);};
    }
   };
   const surface = w.LWProcess3D.create(canvas, view.definition, () => {});
   try {
    surface.draw(view, .01); const arrows: any[] = [], captions: string[] = [], markers: any[] = []; let glyphs = 0;
    captured.traverse((o: any) => {
     if (o.userData.flow !== undefined) arrows.push([o.userData.flow, o.userData.deadline, o.userData.color]);
     if (o.userData.caption) captions.push(o.userData.caption);
     if (o.userData.glyph === 'inclusive-fork') glyphs++;
     if (o.userData.escalated) markers.push(o.material.color.getHexString());
    });
    return {arrows: arrows.filter(a => a[1]), glyphs, captions, markers};
   } finally {surface.dispose(); canvas.remove(); T.WebGLRenderer = Original;}
  });
  assert.deepEqual(room.arrows.map(a => a[0]).sort(), ['approve-late', 'intake-late']);
  assert.deepEqual(room.arrows.map(a => a[2]).sort(), ['#e07a7a', '#e6b04a']);
  assert.equal(room.glyphs, 1);
  assert.ok(room.captions.some(c => /items \d+ started · \d+ done/.test(c) && /× per case \(lines\)/.test(c)), room.captions.join('\n'));
  assert.ok(room.captions.some(c => /\d+ escalated · 0 interrupted/.test(c) && /deadline 20 min escalate/.test(c)));
  assert.ok(room.markers.length >= 1 && room.markers.every(m => m === 'ff8a5c'), 'escalated markers have their own colour');
 });
 await check('Inspector describes multiple instances, deadlines and inclusive forks with their live counters without ticking', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await importClaims(true, true); await page.locator('#mode-2d').click();
  for (let i = 0; i < 2; i++) await page.locator('#advance').click();
  const before = (await query(page)).snapshot, metric = (id: string) => before.steps.find(s => s.id === id)!,
   text = () => page.locator('#inspector').innerText();
  const items = metric('inspect').items!, fired = metric('approve').deadlines!;
  assert.ok(items.started >= 3 && fired.escalated >= 1, 'the seeded run has started items and an escalation');
  // Multiple instances: the editor's sentence, cumulative item counters, the visits running now and items in the waiting row.
  await page.locator('[data-step="inspect"]').click(); let detail = await text();
  assert.match(detail, /Multiple instances/); assert.match(detail, /Runs one instance for each unit counted in case field "lines" \(1 to 50\) in parallel/);
  assert.match(detail, new RegExp(`Items started\\s+${items.started}\\b`));
  assert.match(detail, new RegExp(`Items finished\\s+${items.finished}\\b`));
  assert.match(detail, /Visits in progress\s+\d+/);
  assert.match(detail, /Items working \/ waiting\s+\d+ \/ \d+/);
  if (before.receipts.some(r => r.stepId === 'inspect')) assert.match(detail, /Latest completed visit\s+3 items/);
  assert.doesNotMatch(detail, /Deadline|Branching/);
  // Deadline: the sentence, the deadline path, both firing counters as in the 2D badge, the next pending minute and the marked next-step button.
  await page.locator('[data-step="approve"]').click(); detail = await text();
  assert.match(detail, /After 20 min of work the deadline escalates: the work keeps going and the deadline path starts beside it\./);
  assert.match(detail, /Deadline path to\s+Notify the manager/);
  assert.match(detail, new RegExp(`Escalated\\s+${fired.escalated}\\b`));
  assert.match(detail, /Interrupted\s+0\b/);
  assert.doesNotMatch(detail, /Multiple instances|Items started/);
  const pending = before.tokens.filter(t => t.stepId === 'approve' && t.deadlineAt !== undefined).map(t => t.deadlineAt!);
  if (pending.length) assert.match(detail, new RegExp(`Next deadline\\s+Minute ${Math.min(...pending)}`)); else assert.doesNotMatch(detail, /Next deadline/);
  assert.deepEqual(await page.locator('.next-step').allInnerTexts(), ['Notify the manager\nDeadline path (escalates: the work keeps going)', 'Paid out']);
  await page.locator('[data-step="intake"]').click();
  assert.match(await text(), /After 11 min of work the deadline interrupts: the work is cancelled and the case takes the deadline path\./);
  assert.match(await text(), /Deadline path to\s+Timed out/);
  assert.ok((await page.locator('.next-step').allInnerTexts()).includes('Timed out\nDeadline path (interrupts: the work is cancelled)'));
  // Inclusive fork: the sentence, its join and each branch's own condition; the branch without one is the default.
  await page.locator('[data-step="route"]').click(); detail = await text();
  assert.match(detail, /Branching/);
  assert.match(detail, /Inclusive fork: starts every branch whose condition is true/);
  assert.match(detail, /Joins at\s+Merge checks/);
  assert.deepEqual(await page.locator('.next-step').allInnerTexts(), ['Check insurance\nIf insured = true',
   'Check gift wrap\nIf gift = true and not insured = true', 'Merge checks\nDefault branch: taken only when no condition is true']);
  // Steps without these features show nothing extra.
  for (const id of ['notify', 'merge', 'done']) {
   await page.locator(`[data-step="${id}"]`).click();
   assert.doesNotMatch(await text(), /Multiple instances|Deadline|Branching|Items started|Escalated\s+\d/);
  }
  assert.deepEqual((await query(page)).snapshot, before, 'reading the inspector never ticks or mutates the run');
 });
 await check('Overview summarises instances, deadlines and inclusive forks only when the process has them', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await importClaims(true, true);
  for (let i = 0; i < 2; i++) await page.locator('#advance').click();
  const q = (await query(page)).snapshot, m = (id: string) => q.steps.find(s => s.id === id)!; await page.locator('#overview').click();
  const overview = await page.locator('#inspector').innerText(), esc = m('approve').deadlines!.escalated + m('intake').deadlines!.escalated,
   int = m('approve').deadlines!.interrupted + m('intake').deadlines!.interrupted;
  assert.match(overview, /Instances, deadlines and forks/);
  assert.match(overview, new RegExp(`Multiple instances\\s+1 step · ${m('inspect').items!.started} items started · ${m('inspect').items!.finished} finished`));
  assert.match(overview, new RegExp(`Deadlines\\s+2 steps · ${esc} escalated · ${int} interrupted`)); assert.match(overview, /Inclusive forks\s+1 fork/);
  assert.equal(await page.locator('#inspector dl.process-tracked dt').count(), 3, 'the summary uses the stacked label/value list');
  // The plain claims desk keeps one deadline and no instances or inclusive fork; the agency process has none of them.
  await importClaims(false);
  let plain = await page.locator('#inspector').innerText();
  assert.match(plain, /Deadlines\s+1 step · 0 escalated · 0 interrupted/);
  assert.doesNotMatch(plain, /Multiple instances|Inclusive forks/);
  await freshStudio(); plain = await page.locator('#inspector').innerText(); assert.doesNotMatch(plain, /Instances, deadlines and forks/);
 });
 await check('Inspector escapes definition text in branching, instance and deadline sections', async () => {
  const hostile = '<img src=x onerror="window.__pwned=1">', def = claimsDesk(true, true) as any;
  def.steps.find((s: any) => s.id === 'notify').name = hostile; def.steps.find((s: any) => s.id === 'merge').name = hostile + ' join';
  await freshStudio(); await importJson('claims-hostile.json', def);
  await page.locator('[data-step="approve"]').click(); assert.match(await page.locator('#inspector').innerText(), /Deadline path to\s+<img src=x/);
  await page.locator('[data-step="route"]').click(); assert.match(await page.locator('#inspector').innerText(), /Joins at\s+<img src=x/);
  assert.equal(await page.locator('#inspector img').count(), 0); assert.equal(await page.evaluate(() => (globalThis as any).__pwned), undefined);
 });
}
