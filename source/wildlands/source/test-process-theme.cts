/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-palette.ts" />
/**
 * The studio's light theme against WCAG 2.2 AA (business-process-analysis): the two token blocks of process.css (dark at the top,
 * light under `:root[data-theme=light]`) are parsed here, every colour token of the dark block has a light value, and the light
 * pairs that carry meaning reach their floor with LWProcessPalette.contrast (the maths the theme browser suite uses as well):
 * 4.5:1 for text, 3:1 for marks, control boundaries and focus indicators. `contrastTable()` prints the same pairs for a review.
 * `tokenBlocks()` is shared with the palette check (test-process-palette.cts).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from './test-process-helpers.cjs';
require('./process-palette.js');
const palette = (globalThis as unknown as {LWProcessPalette: LWProcessPalette.Api}).LWProcessPalette;
const SOURCE = path.resolve(__dirname, '../source');
export const DARK_SELECTOR = '.process-studio,.lw-journey,.sipoc';
export const LIGHT_SELECTOR = ':root[data-theme=light] :is(.process-studio,.lw-journey,.sipoc)';

/** The custom properties of one rule of process.css, found by its exact selector. */
function block(css: string, selector: string): Map<string, string> {
 const at = css.indexOf(selector + ' {');
 assert(at >= 0, 'process.css declares ' + selector);
 const open = css.indexOf('{', at), close = css.indexOf('}', open), out = new Map<string, string>();
 for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(m[1]!, m[2]!.trim().toLowerCase());
 return out;
}
/** Both token blocks of process.css: the dark one (its first rule) and the light one. */
export function tokenBlocks(): {dark: Map<string, string>; light: Map<string, string>; css: string} {
 const css = fs.readFileSync(path.join(SOURCE, 'process.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
 assert.equal(css.slice(0, css.indexOf('{')).trim(), DARK_SELECTOR, 'process.css starts with the token block');
 return {dark: block(css, DARK_SELECTOR), light: block(css, LIGHT_SELECTOR), css};
}
const isColour = (v: string) => /^(#[0-9a-f]{3,8}|rgba?\()/.test(v);
const T = 4.5, G = 3;
type Pair = readonly [string, string, number, string];
const on = (fg: string, bgs: string[], min: number, why: string): Pair[] => bgs.map(bg => [fg, bg, min, why] as const);
const STATES = ['axis', 'accent', 'state-queue', 'state-timer', 'state-backlog', 'danger', 'escalated'];
const CHARTS = ['viz-work', 'viz-wait', 'viz-blocked', 'viz-backlog', 'viz-timer', 'viz-join', 'viz-goal', 'axis'];
/** Light token pairs (foreground, background, floor, use) that carry meaning in the studio. */
export const LIGHT_PAIRS: readonly Pair[] = [
 ...on('text', ['bg', 'panel', 'surface-card', 'surface-sunk', 'surface-2', 'surface-hover', 'accent-bg', 'accent-bg-hover', 'goal-bg', 'lost-bg',
  'viz-feel'], T, 'body text'),
 ...on('muted', ['bg', 'panel', 'surface-card', 'surface-sunk', 'surface-2', 'surface-hover', 'accent-bg'], T, 'muted text'),
 ...on('order', ['bg', 'panel', 'surface-hover', 'accent-bg'], T, 'step numbers'),
 ...on('accent', ['bg', 'panel', 'surface-sunk', 'surface-card'], T, 'accent text'),
 ...on('danger-text', ['bg', 'panel', 'lost-bg'], T, 'problem text'),
 ...on('goal-text', ['goal-bg', 'panel'], T, 'goal text'),
 ...on('bg', ['accent', 'accent-hover'], T, 'primary button text'),
 ...on('state-backlog', ['surface-sunk', 'surface-card'], T, 'backlog slot text'),
 ...on('accent', ['bg', 'panel', 'surface-card', 'surface-sunk', 'accent-bg', 'surface-2'], G, 'focus ring'),
 ...on('focus-halo', ['bg'], G, 'map focus halo'),
 ...on('button-border', ['panel', 'bg', 'surface-2'], G, 'button boundary'),
 ...on('control-border', ['panel', 'bg'], G, 'field boundary'),
 ...on('accent-line', ['panel', 'bg'], G, 'pressed button boundary'),
 ...on('card-line', ['surface-card', 'bg'], G, 'journey card boundary'),
 ...on('invalid', ['panel'], G, 'invalid field boundary'),
 ...STATES.flatMap(s => on(s, ['bg', 'surface-sunk', 'surface-card', 'panel'], G, 'work state mark and card border')),
 ...['map-edge', 'map-arrow', 'map-conditional', 'deadline-escalate', 'goal'].flatMap(s => on(s, ['bg'], G, 'map path and outcome')),
 ...CHARTS.flatMap(s => on(s, ['panel'], G, 'chart mark')),
 ...[1, 2, 3, 4, 5, 6, 7].flatMap(n => on('phase-' + n, ['panel'], G, 'journey phase')),
 ...['accent', 'heat-warm', 'heat-hot'].flatMap(s => on(s, ['surface-2'], G, 'pool load bar')),
 ...on('viz-measured', ['viz-feel'], G, 'journey measured line'),
 ...on('viz-fill', ['viz-track'], G, 'funnel fill'), ...on('accent-line', ['viz-track'], G, 'funnel fill'),
];
/** Every light pair with its ratio, for a review table. */
export function contrastTable(): {fg: string; bg: string; ratio: number; min: number; use: string}[] {
 const {light} = tokenBlocks(), value = (name: string) => light.get('--' + name) ?? assert.fail('no light --' + name);
 return LIGHT_PAIRS.map(([fg, bg, min, use]) => ({fg, bg, ratio: palette.contrast(value(fg), value(bg)), min, use}));
}

test('Light theme: every colour token has a light value, and the light pairs reach WCAG 2.2 AA (4.5:1 text, 3:1 marks, boundaries, focus)', () => {
 const {dark, light, css} = tokenBlocks();
 const colours = [...dark].filter(([, v]) => isColour(v)).map(([k]) => k);
 assert(colours.length > 60, 'the dark block holds the colour tokens');
 assert.deepEqual([...light.keys()].sort(), [...colours].sort(), 'the light block redeclares exactly the colour tokens');
 for (const [name, v] of light) assert(isColour(v), name + ' is a colour');
 const low = contrastTable().filter(r => !(r.ratio >= r.min)).map(r => `${r.fg} on ${r.bg} ${r.ratio.toFixed(2)} < ${r.min} (${r.use})`);
 assert.deepEqual(low, [], 'light pairs under their floor');
 // Native controls and scrollbars follow the theme.
 assert.match(css, /:root\[data-theme=light\],:root\[data-theme=light\] \.process-studio \{ color-scheme:light; \}/);
 assert.match(css, /:root \{ color-scheme:dark; \}/);
 // The maths: black on white is 21:1, a colour on itself 1:1, and translucent or unknown colours are refused.
 assert.equal(palette.contrast('#000', 'rgb(255, 255, 255)').toFixed(2), '21.00');
 assert.equal(palette.contrast('#3584b0', '#3584b0'), 1);
 assert.throws(() => palette.contrast('rgba(0, 0, 0, 0.5)', '#fff'), /opaque/);
 assert.throws(() => palette.contrast('red', '#fff'), /opaque/);
});
