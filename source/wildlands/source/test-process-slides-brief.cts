/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-slides-contracts.d.ts" />
/**
 * The brief deck (LWProcessSlides.build(definition, snapshot, {brief: true}) and `process slides --brief`): the executive cut
 * keeps the title, overview, resources, one section slide per section and the summary, drops every step slide, names every step on
 * exactly one section slide and leaves the full deck untouched.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {runtime, slides} from './process-sdk.cjs';
import {test} from './test-process-helpers.cjs';
import {claims, demos} from './test-process-slides-fixtures.cjs';
const CLI = path.join(__dirname, 'tools/wildlands-cli.cjs');
const seeded = (d: LWProcess.Definition, minutes: number, seed: number) => {
 const s = runtime.create(d, {seed});
 try { return s.advance(minutes); } finally { s.dispose(); }
};
/** Pinned brief deck of every demo: slide count and ordered titles (the full decks are pinned in test-process-slides.cts). */
const BRIEF: Record<string, [number, string[]]> = {
 'agency.process.json': [10, ['Agency delivery lab', 'Overview', 'Resources', 'Discover', 'Design', 'Build', 'Review', 'Handover',
  'Variants and other paths', 'Summary']],
 'agile-vendor.process.json': [11, ['Agile vendor project', 'Overview', 'Resources', 'Initiate', 'Plan', 'Iterate', 'Accept', 'Release', 'Close',
  'Variants and other paths', 'Summary']],
 'customer-journey-webshop.process.json': [10, ['Customer journey · Online shop', 'Overview', 'Resources', 'Awareness', 'Consideration', 'Purchase',
  'Delivery', 'After-sales and loyalty', 'Variants and other paths', 'Summary']],
 'delivery-release.process.json': [11, ['Weekly delivery and release train', 'Overview', 'Resources', 'Inception (0.1.0)', 'Refine and plan', 'Iterate',
  'Review and retro', 'Release 0.x.0', 'MVP 1.0.0', 'Variants and other paths', 'Summary']],
 'loan-application.process.json': [9, ['Loan application (BPMN import)', 'Overview', 'Resources', 'Application', 'Document check', 'Fraud screening',
  'Credit decision', 'Variants and other paths', 'Summary']],
 'order-fulfilment.process.json': [9, ['Order fulfilment line', 'Overview', 'Resources', 'Order', 'Prepare', 'Pack', 'Ship', 'Variants and other paths',
  'Summary']],
 'user-journey-app-onboarding.process.json': [11, ['User journey · App onboarding', 'Overview', 'Resources', 'Discover', 'Sign up', 'Onboard', 'Activate',
  'Retain', 'Monetise', 'Variants and other paths', 'Summary']],
};
/** Slides whose text differs between the cuts: the title's reading guide and the variants lead say which cut it is. */
const REWORDED = new Set(['title', 'section-variants']);

test('Brief slides keep the title, overview, resources, one section slide per section and the summary, naming every step once', () => {
 assert.deepEqual(demos.map(([file]) => file), Object.keys(BRIEF));
 for (const [file, d] of demos) {
  const full = slides.build(d), brief = slides.build(d, null, {brief: true}), [count, titles] = BRIEF[file]!;
  assert.deepEqual([brief.slides.length, brief.slides.map(s => s.title)], [count, titles], file);
  assert.equal(brief.brief, true); assert.equal(Object.hasOwn(full, 'brief'), false, file + ': a full deck has no brief key');
  assert(brief.slides.every(s => s.kind !== 'step'), file + ': no step slides');
  assert.deepEqual(brief.sections.map(s => s.id), full.sections.map(s => s.id), file + ': the same sections');
  assert(brief.sections.every((s, i) => s.count === (s.kind === 'intro' ? 3 : 1) && s.first === (i ? i + 2 : 0)), file + ': one slide per section');
  // Every other slide is the full deck's, word for word, except the reading guide and the variants lead.
  for (const s of brief.slides) {
   const twin = full.slides.find(x => x.id === s.id)!;
   if (!REWORDED.has(s.id)) assert.deepEqual(s, twin, `${file}: ${s.id}`);
  }
  // Each step is named on exactly one section slide, in the section that held its step slide in the full deck.
  const named = brief.slides.filter(s => s.kind === 'section').flatMap(s => s.blocks
   .filter(b => b.heading === 'In this part' || b.heading === 'Off the main route')
   .flatMap(b => b.items.map(item => [s.section, item] as const)));
  assert.equal(named.length, d.steps.length, file + ': one entry per step');
  for (const step of full.slides.filter(s => s.kind === 'step')) {
   const entries = named.filter(([section, item]) => section === step.section && (item.startsWith(step.title + ' (') || item.startsWith(step.title + ': ')));
   assert(entries.length >= 1, `${file}: ${step.id} is named on the section slide of ${step.section}`);
  }
 }
 const d = claims(), q = seeded(d, 120, 4), brief = slides.build(d, q, {brief: true}), full = slides.build(d, q);
 const guide = brief.slides[0]!.blocks.find(b => b.heading === 'How to read this deck')!.items;
 assert.match(guide[0]!, /^This is the brief deck: the overview and resources, one slide for each phase of the main route and one for the steps off it/);
 assert.match(brief.slides.find(s => s.id === 'section-variants')!.lead, /the list says how\.$/);
 // Live facts stay on the title, resources and summary slides; section slides carry none, as in the full deck.
 assert.deepEqual(brief.slides.filter(s => s.live).map(s => s.id), ['title', 'resources', 'summary']);
 assert.deepEqual(brief.slides[0]!.live, full.slides[0]!.live); assert.deepEqual(brief.live, full.live);
 const md = slides.markdown(brief);
 assert.match(md, /^# Small claims\n\nProcess `small-claims` · Business process · revision 1 · 8 slides · brief deck \(section slides only\)\n/);
 assert.match(md, /This is the brief deck from `--brief`; without it the deck has a slide for every step\._\n$/);
 assert(!md.includes('### Slide 9') && !slides.markdown(full).includes('brief deck'), 'the full Markdown never says brief');
 assert.equal(JSON.stringify(slides.build(d, q, {brief: false})), JSON.stringify(full), 'brief: false is the full deck');
});

test('CLI process slides --brief writes the brief deck as JSON or Markdown and reports it', () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-brief-'));
 try {
  fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(claims(), null, 2));
  const raw = (args: string[]) => spawnSync(process.execPath, [CLI, 'process', 'slides', '--input', 'a.json', ...args], {cwd: dir, encoding: 'utf8'});
  const call = (args: string[]) => { const p = raw(args); assert.equal(p.status, 0, p.stdout); return JSON.parse(p.stdout) as Record<string, any>; };
  const d = claims(), brief = slides.build(d, null, {brief: true});
  assert.deepEqual(call(['--brief']).deck, brief);
  assert.equal(raw(['--brief', '--format', 'md']).stdout, slides.markdown(brief));
  assert.deepEqual(call(['--brief', '--output', 'brief.json']), {ok: true, protocolVersion: 1, output: path.join(dir, 'brief.json'), format: 'json',
   slides: 8, sections: 6, brief: true, live: null});
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'brief.json'), 'utf8')), brief);
  const q = seeded(d, 120, 4), live = call(['--brief', '--minutes', '120', '--seed', '4', '--format', 'md', '--output', 'live.md']);
  assert.deepEqual([live.slides, live.brief, live.live], [8, true, {minute: q.minute, seed: 4, status: q.status}]);
  assert.equal(fs.readFileSync(path.join(dir, 'live.md'), 'utf8'), slides.markdown(slides.build(d, q, {brief: true})));
  assert.equal(raw(['--brief', '--brief']).status, 2, 'a repeated --brief is refused');
 } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
