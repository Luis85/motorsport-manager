/// <reference path="../process-contracts.d.ts" />
/**
 * Process Studio layout: responsive reflow, the desktop fit, the phone layout, the activity modal (process-layout-activity-checks.ts)
 * and fallback-font geometry.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import {waitForReady, openArtifact, nextFrames} from './browser-harness';
import {query, OUT, runSuite} from './process-browser-fixture';
import {activityChecks, layoutProbes} from './process-layout-activity-checks';
runSuite('process layout browser harness', 'process-layout-browser-results.json', async studio => {
 const {page, file, fixtureUrls, check, checkLifecycle, freshStudio, dialogOpen, activeId, switchTo, applyDraft, importJson} = studio;
 await check('Desktop and mobile reflow retain controls without horizontal overflow', async () => {
  await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
  await page.locator('[data-step="discovery"]').click(); await page.locator('#step').click(); await nextFrames(page);
  await page.screenshot({path: path.join(OUT, 'process-desktop.png'), fullPage: true});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({width: 390, height: 844}); await page.screenshot({path: path.join(OUT, 'process-mobile.png'), fullPage: true});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator('#mode-2d').click(); assert.equal(await page.locator('#map').isVisible(), true);
  await page.screenshot({path: path.join(OUT, 'process-mobile-2d.png'), fullPage: true});
  await page.setViewportSize({width: 900, height: 900}); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const long = (await query(page)).definition; long.name = 'LongProcessName'.repeat(8); long.steps[0]!.name = 'LongStepName'.repeat(7);
  await importJson('long-labels.json', long); await page.waitForFunction(name => document.getElementById('process-title')!.textContent === name, long.name);
  await page.locator('[data-step]').first().click();
  for (const width of [1440, 900, 390]) {
   await page.setViewportSize({width, height: 900});
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.setViewportSize({width: 1440, height: 1060});
 });
 await check('Process switch reflows at phone width without horizontal overflow and wraps long names', async () => {
  await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
  await switchTo(1); await applyDraft(d => {d.name = 'LongProcessName'.repeat(8);});
  for (const width of [390, 900, 1440]) {
   await page.setViewportSize({width, height: 900}); await nextFrames(page);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'width ' + width);
   const box = (await page.locator('#process-switch').boundingBox())!; assert(box.x >= 0 && box.x + box.width <= width, 'switch inside viewport at ' + width);
   assert.equal(await page.locator('#process-switch-label').isVisible(), true);
  }
  await page.setViewportSize({width: 390, height: 844}); await page.screenshot({path: path.join(OUT, 'process-switch-mobile.png'), fullPage: true});
  await switchTo(0); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({width: 1440, height: 1060});
 });
 const {actRows, tokenColour, paint} = layoutProbes(page);
 await activityChecks(studio);
 await check('Header and toolbar fit one desktop viewport without document scrolling and keep exports in a menu', async () => {
  await page.setViewportSize({width: 1366, height: 768}); await freshStudio();
  const fits = () => page.evaluate(() => {
   const r = (s: string) => document.querySelector(s)!.getBoundingClientRect(), view = r('#viewport'), nav = r('.process-nav'),
    ins = r('.process-inspector');
   return {docH: document.documentElement.scrollHeight - innerHeight, docW: document.documentElement.scrollWidth - innerWidth,
    band: r('.process-toolbar').bottom, workspaceBottom: r('.process-workspace').bottom - innerHeight, viewH: view.height, viewW: view.width,
    navW: nav.width, insW: ins.width,
    navOverflow: getComputedStyle(document.querySelector('.process-nav')!).overflowY,
    insOverflow: getComputedStyle(document.querySelector('.process-inspector')!).overflowY,
    io: (document.getElementById('io-panel') as HTMLDetailsElement).open};
  });
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080], [2560, 1080], [1100, 700]] as const) {
   await page.setViewportSize({width, height}); await nextFrames(page); const f = await fits(), at = `${width}x${height}`;
   assert(f.docH <= 0 && f.docW <= 0, 'the document does not scroll at ' + at + ' ' + JSON.stringify(f));
   assert(f.band <= (width >= 1366 ? 110 : 160), `header and toolbar band is ${f.band}px at ${at}`);
   assert(Math.abs(f.workspaceBottom) <= 1, 'the workspace fills the rest at ' + at);
   assert(f.viewH >= 320 && f.viewW > f.navW && f.viewW > f.insW, 'the stage is the hero at ' + at + ' ' + JSON.stringify(f));
   assert.deepEqual([f.navOverflow, f.insOverflow], ['auto', 'auto']);
   assert.equal(f.io, width >= 1600, 'Inputs & outputs opens by default only on wide screens (' + at + ')');
  }
  await page.setViewportSize({width: 1366, height: 768}); await nextFrames(page);
  const ids = ['process-switch', 'open-definition', 'import', 'export-menu', 'play', 'step', 'advance', 'run-end', 'reset', 'speed', 'horizon', 'seed',
   'open-activity'];
  const heights = await page.evaluate(list => list.map(id => Math.round(document.getElementById(id)!.getBoundingClientRect().height)), ids);
  assert.deepEqual([...new Set(heights)], [36], 'header and toolbar controls share one height');
  assert.equal(await page.locator('.process-toolbar button.primary').count(), 1);
  assert.equal(await page.locator('#play').getAttribute('class'), 'primary');
  assert.match(await page.locator('#reset').getAttribute('class') ?? '', /ghost/);
  assert.equal(await page.locator('#message').evaluate(e => !!e.closest('.process-toolbar') || !e.closest('.process-stagebar')), false,
   'the status line lives in the stage header');
  assert.equal(await page.locator('#message').getAttribute('role'), 'status');
  assert.doesNotMatch(await page.locator('#process-subtitle').innerText(), /export/i);
  // Exports live in one menu.
  for (const id of ['#json', '#bpmn', '#report', '#html']) assert.equal(await page.locator(id).isHidden(), true, id + ' hides inside the closed menu');
  const trigger = page.locator('#export-menu');
  assert.deepEqual([await trigger.getAttribute('aria-haspopup'), await trigger.getAttribute('aria-expanded'), await page.locator('#import').innerText()],
   ['menu', 'false', 'Import…']);
  await trigger.click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(await activeId(), 'json');
  assert.match(await page.locator('#export-hint').innerText(), /use this process\. Download HTML keeps all \d+ processes/);
  assert.deepEqual(await page.locator('#export-items [role=menuitem]:visible').allInnerTexts(),
   ['Export JSON', 'Export BPMN', 'Export BPMN with BPSim', 'Export run report', 'Export run checkpoint…', 'Load checkpoint…', 'Download HTML',
    'New process…', 'Import as a new process…']);
  const focusAfter = async (key: string) => { await page.keyboard.press(key); return activeId(); };
  const keyed = [await focusAfter('ArrowDown'), await focusAfter('End'), await focusAfter('ArrowDown'), await focusAfter('Home'), await focusAfter('ArrowUp')];
  // The Light theme toggle (a menuitemcheckbox, LWProcessTheme) ends the menu, after Import as a new process….
  assert.deepEqual(keyed, ['bpmn', 'theme-item', 'json', 'json', 'theme-item']);
  await page.keyboard.press('Escape');
  assert.equal(await activeId(), 'export-menu');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('#json').isHidden(), true);
  await page.keyboard.press('ArrowDown'); assert.equal(await activeId(), 'json'); await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowUp'); assert.equal(await activeId(), 'theme-item'); await page.keyboard.press('Escape');
  await trigger.click();
  await page.locator('#scene-title').click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'an outside click closes the menu');
  await trigger.focus();
  await page.keyboard.press('Enter');
  assert.equal(await activeId(), 'json');
  let pending = page.waitForEvent('download');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  let saved = await pending;
  assert.match(saved.suggestedFilename(), /\.bpmn$/);
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'activating an item closes the menu');
  assert.equal(await activeId(), 'export-menu');
  await trigger.click();
  pending = page.waitForEvent('download');
  await page.locator('#report').click();
  saved = await pending;
  assert.match(saved.suggestedFilename(), /\.report\.json$/);
  // The primary button swaps its label; the stage keeps its place while the run plays.
  await page.locator('#play').click();
  assert.equal(await page.locator('#play').innerText(), 'Pause');
  await page.locator('#play').click();
  assert.equal(await page.locator('#play').innerText(), 'Run simulation');
  // A stopped run moves the primary emphasis to Reset: the disabled Run loses the accent fill, and focus moves from Run to Reset.
  await page.locator('#horizon').selectOption('custom'); await page.locator('#horizon-custom').fill('20');
  await page.locator('#horizon-custom').dispatchEvent('change');
  await page.locator('#play').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().snapshot.status === 'limit');
  const emphasis = await page.evaluate(() => ({
   primary: [...document.querySelectorAll('.process-toolbar button.primary')].map(b => b.id), focus: document.activeElement?.id,
   reset: !(document.getElementById('reset') as HTMLButtonElement).disabled, play: (document.getElementById('play') as HTMLButtonElement).disabled,
  }));
  assert.deepEqual(emphasis, {primary: ['reset'], focus: 'reset', reset: true, play: true});
  assert.notEqual(await paint('#play', 'backgroundColor'), await tokenColour('--accent'), 'the disabled Run loses the accent fill');
  await page.keyboard.press('Enter');
  assert.deepEqual([await page.locator('#play').getAttribute('class'), await page.locator('#reset').getAttribute('class')], ['primary', 'ghost']);
  await page.locator('#horizon').selectOption('100000');
  // Inputs & outputs: remembered per session, with its own scroll.
  await page.setViewportSize({width: 1920, height: 1080});
  await nextFrames(page);
  assert.equal((await fits()).io, true);
  assert.equal(await page.locator('#process-data').evaluate(e => getComputedStyle(e).overflowY), 'auto');
  await page.locator('#io-panel > summary').click();
  assert.equal((await fits()).io, false);
  await page.setViewportSize({width: 1366, height: 768});
  await page.setViewportSize({width: 2560, height: 1080});
  await nextFrames(page);
  assert.equal((await fits()).io, false, 'the choice outlives resizing');
  // Choosing a step on the map scrolls its list item into view.
  await page.setViewportSize({width: 1366, height: 768});
  await nextFrames(page);
  await page.locator('#mode-2d').click();
  const last = (await query(page)).definition.steps.at(-1)!.id;
  await page.locator(`#process-map-${last}`).click({force: true});
  await page.waitForFunction(id => {
   const li = document.querySelector(`[data-step="${id}"]`)!.closest('li')!.getBoundingClientRect(),
    nav = document.querySelector('.process-nav')!.getBoundingClientRect();
   return li.bottom <= nav.bottom + 1 && li.top >= nav.top;
  }, last);
  await page.locator('#mode-3d').click(); await page.locator('#overview').click(); await page.screenshot({path: path.join(OUT, 'process-desktop-fit.png')});
 });
 await check('Phone layout keeps the run bar, step navigation and dialogs usable without horizontal overflow', async () => {
  // A business process opens on the readable 2D map on a phone; 3D stays one press away.
  await page.setViewportSize({width: 390, height: 844}); await freshStudio(); assert.equal((await query(page)).mode, '2d');
  assert.equal(await page.locator('#map').isVisible(), true);
  await page.locator('#mode-3d').click(); assert.equal((await query(page)).mode, '3d'); await page.setViewportSize({width: 1440, height: 1060});
  await freshStudio(); const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const small = (selector: string) => page.evaluate(s => [...document.querySelectorAll<HTMLElement>(s)]
   .filter(n => n.getClientRects().length && n.getBoundingClientRect().height < 43.5).map(n => n.id || n.textContent), selector);
  for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1100, 800]] as const) {
   await page.setViewportSize({width, height});
   await nextFrames(page);
   assert.equal(await noOverflow(), true, `no horizontal overflow at ${width}`);
  }
  await page.setViewportSize({width: 390, height: 844}); await nextFrames(page);
  const bar = page.locator('.process-toolbar'); assert.equal(await bar.evaluate(e => getComputedStyle(e).position), 'sticky');
  await page.evaluate(() => window.scrollTo(0, 500));
  assert(await page.evaluate(() => document.querySelector('.process-toolbar')!.getBoundingClientRect().top) <= 1,
   'the run bar stays at the top while the page scrolls');
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const id of ['#play', '#step', '#open-activity', '#clock']) assert.equal(await page.locator(id).isVisible(), true, id);
  const folded = ['#advance', '#run-end', '#reset', '#speed', '#horizon', '#seed'];
  for (const id of folded) assert.equal(await page.locator(id).isHidden(), true, id + ' sits under Run options');
  const toggle = page.locator('#run-options-toggle');
  assert.deepEqual([await toggle.getAttribute('aria-expanded'), await toggle.innerText()], ['false', 'Run options ▾']);
  await toggle.click();
  for (const id of folded) assert.equal(await page.locator(id).isVisible(), true, id);
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(await small(
   '.process-toolbar button, .process-toolbar select, .process-toolbar input, .process-header button, .process-header select, .process-nav button'),
  [], 'touch targets are 44px');
  await toggle.click();
  assert.equal(await page.locator('#advance').isHidden(), true);
  await page.locator('#play').click();
  assert.equal(await page.locator('#play').innerText(), 'Pause');
  await page.locator('#play').click();
  await page.locator('#step').click();
  assert.equal((await query(page)).playing, false);
  // A stopped run keeps Reset outside Run options as the primary action and moves focus to it from the disabled Run; Reset hands focus back to Run.
  await toggle.click(); await page.locator('#speed').selectOption('120'); await toggle.click();
  await page.locator('#play').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().snapshot.status === 'completed');
  const stopped = () => page.evaluate(() => { const shown = (id: string) => document.getElementById(id)!.getClientRects().length > 0;
   const get = (id: string) => document.getElementById(id)!;
   return [document.activeElement?.id, shown('reset'), get('reset').className, get('play').className, shown('step'),
    get('run-options-toggle').getAttribute('aria-expanded')];
   });
  assert.deepEqual(await stopped(), ['reset', true, 'primary', '', false, 'false']); assert.equal(await noOverflow(), true);
  await page.screenshot({path: path.join(OUT, 'process-mobile-stopped.png')});
  await page.keyboard.press('Enter'); assert.deepEqual(await stopped(), ['play', false, 'ghost', 'primary', true, 'false']);
  // Compact header: Edit and an overflow menu holding Import and the exports. The short label keeps the full accessible name.
  assert.equal(await page.locator('#open-definition').innerText(), 'Edit');
  assert.equal(await page.getByRole('button', {name: 'Edit process', exact: true}).count(), 1);
  assert.equal(await page.locator('#export-menu').isHidden(), true); assert.equal(await page.locator('#import').isHidden(), true);
  await page.locator('#more-menu').click();
  assert.deepEqual(await page.locator('#export-items [role=menuitem]:visible').allInnerTexts(), ['Import JSON or BPMN…', 'Present slides', 'Dashboard',
   'Add step…', 'Tidy layout', 'Export JSON', 'Export BPMN', 'Export BPMN with BPSim', 'Export run report', 'Export run checkpoint…',
   'Load checkpoint…', 'Download HTML', 'New process…', 'Import as a new process…']);
  const menuBox = (await page.locator('#export-popup').boundingBox())!;
  assert(menuBox.x >= 0 && menuBox.x + menuBox.width <= 390, 'the menu stays on screen');
  await page.keyboard.press('Escape');
  assert.equal(await activeId(), 'more-menu');
  // Steps are a horizontal scroller above the stage; the stage is about 45vh; the inspector and Inputs & outputs collapse.
  const layout = await page.evaluate(() => {
   const nav = document.querySelector('.process-nav')!.getBoundingClientRect(), view = document.getElementById('viewport')!.getBoundingClientRect(),
    steps = document.getElementById('steps')!;
   return {above: nav.bottom <= view.top + 1, scroller: steps.scrollWidth > document.querySelector('.process-nav')!.clientWidth,
    row: getComputedStyle(steps).display, viewH: view.height};
  });
  assert.deepEqual([layout.above, layout.scroller, layout.row], [true, true, 'flex']);
  assert(layout.viewH >= 300 && layout.viewH <= 844 * .55, 'stage height ' + layout.viewH);
  await page.locator('#mode-2d').click(); const lastStep = (await query(page)).definition.steps.at(-1)!.id;
  await page.locator(`#process-map-${lastStep}`).scrollIntoViewIfNeeded();
  const scrolled = await page.evaluate(() => scrollY); await page.locator(`#process-map-${lastStep}`).click({force: true});
  await page.waitForFunction(id => {
   const li = document.querySelector(`[data-step="${id}"]`)!.closest('li')!.getBoundingClientRect(),
    nav = document.querySelector('.process-nav')!.getBoundingClientRect();
   return li.right <= nav.right + 1 && li.left >= nav.left - 1;
  }, lastStep);
  // Selecting on the map scrolls only the step strip, never the page; a visible control in the stage bar leads back to the whole process.
  const back = await page.evaluate(() => {
   const b = document.getElementById('back-overview')!.getBoundingClientRect(), bar = document.querySelector('.process-toolbar')!.getBoundingClientRect();
   return {y: scrollY, inside: b.left >= 0 && b.right <= innerWidth && b.top >= bar.bottom - .5 && b.bottom <= innerHeight};
  });
  assert.deepEqual(back, {y: scrolled, inside: true}, 'the page stays put and the way back is on screen below the run bar');
  await page.locator('#back-overview').click(); assert.equal((await query(page)).selected, null);
  await page.waitForFunction(() => {
   const o = document.getElementById('overview')!.getBoundingClientRect(), nav = document.querySelector('.process-nav')!.getBoundingClientRect();
   return o.left >= nav.left - 1 && o.right <= nav.right + 1;
  });
  await page.locator(`#process-map-${lastStep}`).click({force: true});
  const inspectorToggle = page.locator('#inspector-toggle');
  assert.equal(await inspectorToggle.isVisible(), true);
  assert.equal(await page.locator('#inspector-body').isVisible(), true);
  await inspectorToggle.click();
  assert.equal(await page.locator('#inspector-body').isHidden(), true);
  assert.equal(await inspectorToggle.getAttribute('aria-expanded'), 'false');
  await inspectorToggle.click();
  assert.equal(await page.locator('#io-panel').evaluate((d: HTMLDetailsElement) => d.open), false);
  await page.locator('#io-panel > summary').click();
  assert.equal(await page.locator('#process-data').isVisible(), true);
  assert.equal(await noOverflow(), true);
  assert.deepEqual(await small('.process-inspector button, #io-panel summary, .process-view-controls button'), [], 'inspector and stage targets are 44px');
  // Dialogs are full sheets at phone width, down to 320.
  for (const [width, height] of [[390, 844], [320, 640]] as const) {
   await page.setViewportSize({width, height}); await nextFrames(page);
   for (const [opener, dialogSelector, hint] of [
    ['#open-activity', 'dialog.act-dialog[open]', 'activity'], ['#open-definition', 'dialog.de-dialog[open]', 'definition']] as const) {
    await page.locator(opener).click(); await page.locator(dialogSelector).waitFor();
    const g = await page.evaluate(sel => {
     const d = document.querySelector(sel) as HTMLElement, r = d.getBoundingClientRect(), foot = d.querySelector('.pd-foot')!.getBoundingClientRect(),
      wide = [...d.querySelectorAll<HTMLElement>('button, select, input, textarea')]
       .filter(n => n.getClientRects().length && (n.getBoundingClientRect().right > r.right + .5 || n.getBoundingClientRect().left < r.left - .5))
       .map(n => n.id);
     return {box: [r.x, r.y, r.width, r.height], vw: innerWidth, vh: innerHeight, own: d.scrollWidth > d.clientWidth,
      footBottom: Math.round(foot.bottom), wide};
    }, dialogSelector);
    assert.deepEqual(g.box, [0, 0, g.vw, g.vh], `${hint} is a full sheet at ${width}`);
    assert.deepEqual([g.own, g.wide, g.footBottom], [false, [], g.vh]);
    assert.equal(await noOverflow(), true);
    if (hint === 'activity') {
     assert((await actRows().count()) > 0);
     assert.deepEqual(await small('.act-dialog .act-controls select, .act-dialog .act-step, .act-dialog .pd-foot button'), [], 'activity targets are 44px');
     const own = await page.locator('#act-scroll').evaluate(e => e.scrollWidth > e.clientWidth);
     assert.equal(own, false, 'rows reflow instead of scrolling sideways');
     await page.screenshot({path: path.join(OUT, 'process-activity-mobile.png')});
    }
    await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), opener.slice(1));
   }
  }
  await page.setViewportSize({width: 1440, height: 1060});
 });
 await check('At 400% zoom no focus stop hides under sticky chrome; forced colours, larger text and lens views keep state cues and plain control names',
  async () => {
  // 320x256 is 1280x1024 at 400% zoom: the run bar scrolls away with the page instead of covering the focused control.
  await page.setViewportSize({width: 320, height: 256}); await freshStudio();
  await page.evaluate(() => { scrollTo(0, 0); (document.activeElement as HTMLElement | null)?.blur(); });
  assert.equal(await page.locator('.process-toolbar').evaluate(e => getComputedStyle(e).position), 'static');
  const hidden: string[] = []; let stops = 0;
  for (let i = 0; i < 70; i++) {
   await page.keyboard.press('Tab');
   const f = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null; if (!a || a === document.body) return null; const r = a.getBoundingClientRect();
    const pinned = (n: HTMLElement) => ['sticky', 'fixed'].includes(getComputedStyle(n).position) && !n.contains(a) && !a.contains(n)
     && n.getClientRects().length > 0;
    const inside = (c: DOMRect) => r.top >= c.top - .5 && r.bottom <= c.bottom + .5 && r.left >= c.left - .5 && r.right <= c.right + .5;
    const covered = [...document.querySelectorAll<HTMLElement>('body *')].filter(pinned).some(n => inside(n.getBoundingClientRect()));
    return {name: a.id || (a.textContent ?? '').trim().slice(0, 24), hidden: covered || r.bottom <= 0 || r.top >= innerHeight};
   });
   if (!f) continue; stops++; if (f.hidden) hidden.push(f.name);
  }
  assert(stops >= 30, `the walk reached ${stops} stops`); assert.deepEqual(hidden, [], 'no focused control is hidden at 320x256');
  // Forced colours keep the state swatches, the meter fills, the pressed view and the current step.
  await page.setViewportSize({width: 1440, height: 1060}); await page.emulateMedia({forcedColors: 'active'});
  await page.locator('#mode-2d').click(); await page.locator('[data-step="discovery"]').click(); await page.locator('#step').click();
  const forced = await page.evaluate(() => {
   const style = (s: string) => getComputedStyle(document.querySelector(s)!);
   const swatches = [...document.querySelectorAll<Element>('.process-legend [data-legend] svg, .pool-bar i, .process-step i')];
   return {swatches: swatches.length > 0 && swatches.every(i => getComputedStyle(i).forcedColorAdjust === 'none'),
    pressed: [style('#mode-2d').outlineStyle, style('#mode-3d').outlineStyle],
    step: [style('.process-step.selected').borderLeftWidth, style('.process-step:not(.selected)').borderLeftWidth !== '4px']};
  });
  assert.deepEqual(forced, {swatches: true, pressed: ['solid', 'none'], step: ['4px', true]}); await page.emulateMedia({forcedColors: 'none'});
  // A larger default text size widens the side columns (rem) and never splits the step count.
  await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; }); await nextFrames(page);
  const big = await page.evaluate(() => {
   const r = (s: string) => document.querySelector(s)!.getBoundingClientRect(), count = document.getElementById('step-count')!;
   return {nav: r('.process-nav').width, inspector: r('.process-inspector').width, 
    lines: r('#step-count').height / parseFloat(getComputedStyle(count).lineHeight)};
  });
  assert(big.nav >= 13.5 * 24 - 1 && big.inspector >= 16.5 * 24 - 1 && big.lines < 1.5, JSON.stringify(big));
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  // Decorative glyphs stay out of accessible names; the metrics are a named group; lens views show no work-marker legend.
  const snapshot = async (selectors: string[]) => (await Promise.all(selectors.map(s => page.locator(s).ariaSnapshot()))).join('\n');
  const names = await snapshot(['.process-header', '.process-toolbar', '.process-stage']);
  assert.doesNotMatch(names, /[▾▸←]/); assert.match(names, /button "Export"/); assert.match(names, /group "Run metrics"/);
  await page.setViewportSize({width: 390, height: 844}); await nextFrames(page);
  const phone = await snapshot(['.process-toolbar', '.process-inspector']);
  assert.match(phone, /button "Run options"/); assert.match(phone, /button "Details"/); assert.doesNotMatch(phone, /[▾▸]/);
  await page.setViewportSize({width: 1440, height: 1060}); assert(await page.locator('.process-legend [data-legend]:visible').count() > 0);
  await page.locator('#mode-lens').click();
  assert.deepEqual(await page.locator('.process-legend > :visible').evaluateAll(n => n.map(x => x.id)), ['camera-hint']);
  await page.locator('#mode-2d').click(); assert(await page.locator('.process-legend [data-legend]:visible').count() > 0);
 });
 // Hosted CI has no Inter and falls back to DejaVu Sans, which is wider: a toolbar that fits locally can wrap there.
 // Forcing that font here makes the fit and phone geometry independent of the fonts the host happens to have.
 const renderedFamilies = async (selectors: string[]) => {
  const cdp = await page.context().newCDPSession(page), out: Record<string, string[]> = {};
  try {
   await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); const {root} = await cdp.send('DOM.getDocument');
   for (const selector of selectors) {
    const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector});
    out[selector] = [...new Set((await cdp.send('CSS.getPlatformFontsForNode', {nodeId})).fonts.map(f => f.familyName))];
   }
  } finally {await cdp.detach();}
  return out;
 };
 /**
  * Header and toolbar geometry: band bottom, the top of each run group shown, document overflow, and controls that leave the viewport or
  * clip their own content.
  */
 const headerGeometry = () => page.evaluate(() => {
  const shown = (n: Element) => n.getClientRects().length > 0 && !n.closest('.process-menu-popup');
  const controls = [...document.querySelectorAll<HTMLElement>('.process-header button, .process-header select, .process-header label, '
   + '.process-toolbar button, .process-toolbar select, .process-toolbar input, .process-toolbar label, .process-toolbar output')].filter(shown);
  const name = (n: HTMLElement) => n.id || n.className || n.tagName;
  return {band: document.querySelector('.process-toolbar')!.getBoundingClientRect().bottom, docW: document.documentElement.scrollWidth - innerWidth,
   docH: document.documentElement.scrollHeight - innerHeight,
   rows: ['.run-actions', '.run-config', '.run-status'].map(s => document.querySelector(s)!).filter(shown).map(n => Math.round(n.getBoundingClientRect().top)),
   offscreen: controls.filter(n => n.getBoundingClientRect().left < -0.5 || n.getBoundingClientRect().right > innerWidth + 0.5).map(name),
   clipped: controls.filter(n => !['SELECT', 'INPUT'].includes(n.tagName) && n.scrollWidth > n.clientWidth + 1).map(name)};
 });
 await check('Desktop fit and phone layout keep one toolbar row, no overflow and no clipped header controls in the wider DejaVu Sans fallback font',
  async () => {
   await page.setViewportSize({width: 1366, height: 768}); await freshStudio();
   await page.addStyleTag({content: '*{font-family:"DejaVu Sans",sans-serif !important}'}); await nextFrames(page);
   // Never pass vacuously: the header and toolbar text must really be drawn with DejaVu Sans, so a host without the font fails here.
   for (const [selector, families] of Object.entries(
    await renderedFamilies(['#process-title', '#open-definition', '#export-menu', '#play', '#open-activity']))) {
    assert.deepEqual(families, ['DejaVu Sans'], `${selector} renders with ${families.join(', ') || 'no font'}; DejaVu Sans must be installed for this check`);
   }
   for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080], [2560, 1080], [1100, 700]] as const) {
    await page.setViewportSize({width, height}); await nextFrames(page); const g = await headerGeometry(), at = `${width}x${height} ` + JSON.stringify(g);
    assert(g.docH <= 0 && g.docW <= 0, 'the document does not scroll at ' + at);
    assert(g.band <= (width >= 1366 ? 110 : 160), `header and toolbar band is ${g.band}px at ${at}`);
    if (width >= 1366) assert.equal(new Set(g.rows).size, 1, 'run actions, settings and status share one toolbar row at ' + at);
    assert.deepEqual([g.offscreen, g.clipped], [[], []], 'no header or toolbar control leaves the viewport or clips its label at ' + at);
    if (width === 1366) await page.screenshot({path: path.join(OUT, 'process-desktop-fit-dejavu.png')});
   }
   // A custom run length that has been reached (minutes field, long status, hours reading) still fits one row without a stray divider.
   await page.setViewportSize({width: 1366, height: 768}); await page.locator('#horizon').selectOption('custom');
   await page.locator('#horizon-custom').fill('95'); await page.locator('#horizon-custom').dispatchEvent('change');
   for (let i = 0; i < 4; i++) if (await page.locator('#advance').isEnabled()) await page.locator('#advance').click();
   assert.equal(await page.locator('#run-status').innerText(), 'Run limit reached'); assert.equal(await page.locator('#clock-hours').innerText(), '1.6 h');
   assert.equal(await page.locator('#horizon-custom').evaluate(e => getComputedStyle(e).appearance), 'textfield', 'no spin buttons, like the seed field');
   for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]] as const) {
    await page.setViewportSize({width, height}); await nextFrames(page);
    const g = await headerGeometry(), at = `custom run length at ${width}x${height} ` + JSON.stringify(g);
    assert(g.band <= 110, at); assert.equal(new Set(g.rows).size, 1, 'one toolbar row with a custom run length at ' + at);
    assert.deepEqual([g.offscreen, g.clipped], [[], []], at);
    const rules = await page.evaluate(() => ['.run-config', '.run-status'].map(s => getComputedStyle(document.querySelector(s)!).borderLeftStyle));
    assert.deepEqual(rules, ['none', 'none'], 'groups are separated by space, so a wrapped row never starts with a divider');
    if (width === 1366) await page.screenshot({path: path.join(OUT, 'process-desktop-custom-dejavu.png')});
   }
   for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1100, 800]] as const) {
    await page.setViewportSize({width, height}); await nextFrames(page); let g = await headerGeometry();
    assert.deepEqual([g.docW <= 0, g.offscreen, g.clipped], [true, [], []], `phone and tablet layout at ${width}x${height} ` + JSON.stringify(g));
    const toggle = page.locator('#run-options-toggle');
    if (await toggle.isVisible()) {
     await toggle.click(); await nextFrames(page); g = await headerGeometry();
     assert.deepEqual([g.docW <= 0, g.offscreen, g.clipped], [true, [], []], `open run options at ${width}x${height} ` + JSON.stringify(g));
     await toggle.click();
    }
    if (width === 390) await page.screenshot({path: path.join(OUT, 'process-mobile-dejavu.png'), fullPage: true});
   }
   await freshStudio();
  });
 await checkLifecycle('Process layout browser lifecycle emits no runtime errors or network requests');
});
