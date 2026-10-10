/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-palette.ts" />
/**
 * The studio palette (LWProcessPalette) against process.css: every role that names a token equals the token block's declaration,
 * so the stylesheet and the scripts cannot drift apart; outside a page `read` gives the constants and `css` the token reference;
 * the room themes, feeling faces and phase colours are complete; and the map, lens, step list and 3D modules that draw with
 * the palette keep no colour literal of their own (the room and actor models' prop materials are not roles; see the palette header).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from './test-process-helpers.cjs';
require('./process-palette.js');
const palette = (globalThis as unknown as {LWProcessPalette: LWProcessPalette.Api}).LWProcessPalette;
const SOURCE = path.resolve(__dirname, '../source');
/** The modules that draw only with palette roles. */
const DRAWN = ['process-renderer-2d.ts', 'process-map-marks.ts', 'process-map-card.ts', 'process-map-fit.ts', 'process-map-patch.ts',
 'process-map-camera.ts', 'process-map-focus.ts', 'process-map-drag.ts', 'process-map-legend.ts', 'process-renderer-3d.ts',
 'process-3d-kit.ts', 'process-3d-bake.ts', 'process-3d-captions.ts', 'process-3d-stations.ts', 'process-3d-camera.ts',
 'process-rooms.ts', 'process-rooms-channels.ts', 'process-renderer-journey.ts', 'process-journey-model.ts',
 'process-renderer-sipoc.ts', 'process-sipoc-model.ts', 'process-step-list.ts', 'process-work-state.ts', 'process-lens.ts'];
const COLOUR = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgba\(\d+,\d+,\d+,\.\d+\))$/;

/** The custom properties declared by the token block at the top of process.css (its first rule). */
function tokenBlock(): Map<string, string> {
 const css = fs.readFileSync(path.join(SOURCE, 'process.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
 const open = css.indexOf('{'), close = css.indexOf('}', open);
 assert.equal(css.slice(0, open).trim(), '.process-studio,.lw-journey,.sipoc', 'process.css starts with the token block');
 const out = new Map<string, string>();
 for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(m[1]!, m[2]!.trim().toLowerCase());
 return out;
}

test('Studio palette: every token role equals its process.css declaration, themes are complete and the drawing modules keep no colour literal', () => {
 const tokens = tokenBlock(), roles = Object.entries(palette.ROLES);
 assert(tokens.size > 40, 'the token block was parsed');
 for (const [role, spec] of roles) {
  assert.match(spec.value, COLOUR, role);
  if (!spec.token) continue;
  assert.equal(tokens.get(spec.token), spec.value.toLowerCase(), `${role} equals ${spec.token} in process.css`);
  assert.equal(palette.css(role as LWProcessPalette.Role), `var(${spec.token})`, role);
 }
 // The work states, paths, deadlines, outcomes and data-visualisation roles are tokens; the 3D scene's own roles are not.
 const tokenised = roles.filter(([, spec]) => spec.token).map(([role]) => role);
 for (const role of ['state-active', 'state-queued', 'state-timer', 'state-backlog', 'state-held', 'state-escalated', 'path-edge',
  'path-conditional', 'deadline-interrupt', 'deadline-escalate', 'goal', 'lost', 'viz-measured', 'viz-fill']) {
  assert(tokenised.includes(role), role + ' is a process.css token');
 }
 assert.equal(palette.css('light-key'), palette.value('light-key'), 'a script-only role is its constant');
 // Outside a page every role reads as its constant.
 assert.deepEqual(palette.read(), Object.fromEntries(roles.map(([role, spec]) => [role, spec.value])));
 // Room themes: every theme id the rooms choose, each with floor, wall and accent; seven faces and seven phase colours.
 const themes = ['office', 'studio', 'lab', 'workshop', 'review', 'archive', 'reception', 'dispatch', 'council', 'junction', 'machine',
  'system', 'clock', 'backlog', 'web', 'mobile', 'store', 'phone', 'chat', 'email', 'social', 'ads', 'delivery', 'document', 'journey'];
 assert.deepEqual(Object.keys(palette.ROOMS).sort(), [...themes].sort());
 for (const id of themes) for (const part of ['floor', 'wall', 'accent'] as const) assert.match(palette.room(id)[part], COLOUR, id);
 assert.throws(() => palette.room('nowhere'), /Unknown room theme/);
 assert.equal(palette.MOODS.length, 7);
 assert.equal(palette.PHASES.length, 7);
 for (const c of [...palette.MOODS, ...palette.PHASES]) assert.match(c, COLOUR);
 // No colour literal is left in the modules that draw with the palette.
 const literal = /['"`](#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))['"`]/;
 for (const file of DRAWN) {
  const text = fs.readFileSync(path.join(SOURCE, file), 'utf8');
  assert.doesNotMatch(text, literal, file + ' keeps no colour literal');
 }
 assert.match(fs.readFileSync(path.join(SOURCE, 'process-3d-markers.ts'), 'utf8'), /kit\.colours\[ROLES\[key\]\]/, 'marker states use palette roles');
});
