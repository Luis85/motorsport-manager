/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-palette.ts" />
/**
 * The studio palette (LWProcessPalette) against process.css, in both themes: every role that names a token equals the dark token
 * block's declaration and its light value equals the light block's, so the stylesheet and the scripts cannot drift apart; outside a
 * page the scheme is dark, `read` gives the dark constants and `css` the token reference; the room themes, their light accents,
 * the feeling faces and the phase colours (the `--phase-n` tokens) are complete; and the map, lens, step list, theme and 3D modules
 * that draw with the palette keep no colour literal of their own (the room and actor models' prop materials are not roles; see the
 * palette header). The token blocks are parsed by test-process-theme.cts, which also checks the light contrast pairs.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from './test-process-helpers.cjs';
import {tokenBlocks} from './test-process-theme.cjs';
require('./process-palette.js');
const palette = (globalThis as unknown as {LWProcessPalette: LWProcessPalette.Api}).LWProcessPalette;
const SOURCE = path.resolve(__dirname, '../source');
/** The modules that draw only with palette roles. */
const DRAWN = ['process-renderer-2d.ts', 'process-map-marks.ts', 'process-map-card.ts', 'process-map-fit.ts', 'process-map-patch.ts',
 'process-map-camera.ts', 'process-map-focus.ts', 'process-map-drag.ts', 'process-map-legend.ts', 'process-renderer-3d.ts',
 'process-3d-kit.ts', 'process-3d-bake.ts', 'process-3d-captions.ts', 'process-3d-stations.ts', 'process-3d-camera.ts',
 'process-rooms.ts', 'process-rooms-channels.ts', 'process-renderer-journey.ts', 'process-journey-model.ts',
 'process-renderer-sipoc.ts', 'process-sipoc-model.ts', 'process-step-list.ts', 'process-work-state.ts', 'process-lens.ts', 'process-theme.ts'];
const COLOUR = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgba\(\d+,\d+,\d+,\.\d+\))$/;
type Role = LWProcessPalette.Role;

test('Studio palette: every token role equals its process.css declaration, themes are complete and the drawing modules keep no colour literal', () => {
 const {dark: tokens, light} = tokenBlocks(), roles = Object.entries(palette.ROLES);
 assert(tokens.size > 40, 'the token block was parsed');
 for (const [role, spec] of roles) {
  assert.match(spec.value, COLOUR, role);
  if (!spec.token) continue;
  assert.equal(tokens.get(spec.token), spec.value.toLowerCase(), `${role} equals ${spec.token} in process.css`);
  assert.equal(palette.css(role as Role), `var(${spec.token})`, role);
  // The light theme: the same token in the light block, and the palette's light constant.
  assert.equal(light.get(spec.token), palette.LIGHT_TOKENS[spec.token]?.toLowerCase(), `${role} equals ${spec.token} in the light block`);
  assert.equal(palette.value(role as Role, 'light'), palette.LIGHT_TOKENS[spec.token], role + ' in light');
 }
 // LIGHT_TOKENS names exactly the tokens of the roles; a script-only role (the 3D diorama's) is the same in both themes.
 assert.deepEqual(Object.keys(palette.LIGHT_TOKENS).sort(), [...new Set(roles.map(([, s]) => s.token).filter(Boolean))].sort());
 for (const [role, spec] of roles) if (!spec.token) assert.equal(palette.value(role as Role, 'light'), spec.value, role);
 // The work states, paths, deadlines, outcomes and data-visualisation roles are tokens; the 3D scene's own roles are not.
 const tokenised = roles.filter(([, spec]) => spec.token).map(([role]) => role);
 for (const role of ['state-active', 'state-queued', 'state-timer', 'state-backlog', 'state-held', 'state-escalated', 'path-edge',
  'path-conditional', 'deadline-interrupt', 'deadline-escalate', 'goal', 'lost', 'viz-measured', 'viz-fill']) {
  assert(tokenised.includes(role), role + ' is a process.css token');
 }
 assert.equal(palette.css('light-key'), palette.value('light-key'), 'a script-only role is its constant');
 // Outside a page the scheme is dark and every role reads as its dark constant.
 assert.equal(palette.scheme(), 'dark');
 assert.deepEqual(palette.read(), Object.fromEntries(roles.map(([role, spec]) => [role, spec.value])));
 assert.deepEqual(palette.resolve('dark'), palette.read());
 assert.equal(palette.resolve('light').text, palette.LIGHT_TOKENS['--text']);
 assert.equal(palette.resolve('light')['caption-pill'], palette.value('caption-pill'), 'the 3D caption pills stay dark');
 // Room themes: every theme id the rooms choose, each with floor, wall and accent, and a light accent that keeps 4.5:1 on the
 // light cards and stage; seven faces and seven phase colours per theme.
 const themes = ['office', 'studio', 'lab', 'workshop', 'review', 'archive', 'reception', 'dispatch', 'council', 'junction', 'machine',
  'system', 'clock', 'backlog', 'web', 'mobile', 'store', 'phone', 'chat', 'email', 'social', 'ads', 'delivery', 'document', 'journey'];
 assert.deepEqual(Object.keys(palette.ROOMS).sort(), [...themes].sort());
 assert.deepEqual(Object.keys(palette.LIGHT_ACCENTS).sort(), [...themes].sort());
 for (const id of themes) {
  for (const part of ['floor', 'wall', 'accent'] as const) assert.match(palette.room(id)[part], COLOUR, id);
  assert.equal(palette.accent(id), palette.room(id).accent, id + ' keeps its accent in the dark theme');
  const lit = palette.accent(id, 'light');
  assert.match(lit, COLOUR, id);
  for (const surface of ['--surface-card', '--surface-sunk', '--bg']) {
   assert(palette.contrast(lit, light.get(surface)!) >= 4.5, `${id} accent on ${surface}`);
  }
 }
 assert.throws(() => palette.room('nowhere'), /Unknown room theme/);
 assert.equal(palette.MOODS.length, 7);
 for (const [list, block] of [[palette.PHASES, tokens], [palette.LIGHT_PHASES, light]] as const) {
  assert.equal(list.length, 7);
  list.forEach((c, i) => assert.equal(block.get(`--phase-${i + 1}`), c, `phase ${i + 1}`));
 }
 assert.deepEqual([0, 6, 7, 15].map(i => palette.phase(i)), ['var(--phase-1)', 'var(--phase-7)', 'var(--phase-1)', 'var(--phase-2)']);
 for (const c of [...palette.MOODS, ...palette.PHASES, ...palette.LIGHT_PHASES]) assert.match(c, COLOUR);
 // No colour literal is left in the modules that draw with the palette.
 const literal = /['"`](#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))['"`]/;
 for (const file of DRAWN) {
  const text = fs.readFileSync(path.join(SOURCE, file), 'utf8');
  assert.doesNotMatch(text, literal, file + ' keeps no colour literal');
 }
 assert.match(fs.readFileSync(path.join(SOURCE, 'process-3d-markers.ts'), 'utf8'), /kit\.colours\[ROLES\[key\]\]/, 'marker states use palette roles');
 // The 3D rooms keep the dark diorama in both themes; the clear colour follows the canvas's stage token.
 const scene = fs.readFileSync(path.join(SOURCE, 'process-renderer-3d.ts'), 'utf8');
 assert.match(scene, /palette\.resolve\('dark'\)/);
 assert.match(scene, /setClearColor\(palette\.read\(canvas\)\.stage\)/);
});
