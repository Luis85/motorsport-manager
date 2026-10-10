/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-three.d.ts" />
/**
 * Presentation-only room themes and the room builder frame (LWProcessRooms): theme choice per step, the builder context, the
 * fixtures every room shares (wall lamp, idle standby sign, backlog board, mood face) and the working/idle switch. No simulation
 * state. The room models themselves are registered into `builders` by process-rooms-work.ts (task themes and flow-kind rooms),
 * process-rooms-automation.ts (machine and system) and process-rooms-touchpoint.ts with process-rooms-channels.ts (touchpoints),
 * which load after this module.
 *  - A builder places furniture in `c.root` (always shown), `c.live` (shown while working) or `c.idle` (shown while idle).
 *  - `c.F` is a fixed piece (never moves, re-colours or toggles: merged into one draw with its neighbours, so it returns nothing);
 *    `c.L` is a fixed piece that glows while the room works; `c.P` is a moving or switching piece with its own mesh.
 *  - The `live` and `idle` groups carry `userData.variant` ('live' or 'idle') for checks.
 */
declare namespace LWProcessRooms {
 interface Theme {id: string; label: string; floor: string; wall: string; accent: string; task: string}
 /** One mood level of the authored `emotion` (-3..3): face colour (cool to warm), eye/brow/mouth strokes in a 100-unit box. */
 interface Mood {level: number; label: string; color: string; mouth: string; brow?: string; open?: boolean}
 /** Display data of a touchpoint channel: names, a stroke glyph in a -0.5..0.5 box and its room theme. */
 interface Channel {label: string; glyph: string; theme: Theme}
 type Options = LWThree.MaterialOptions;
 type O3 = LWThree.Object3D;
 /** The 3D renderer's piece kit as room builders (and the asset renderer) see it; see process-3d-kit.ts. */
 interface Kit {
  T: LWThree.Module; mat(color: string, extra?: Options): LWThree.Material; group(parent: O3): LWThree.Group;
  piece(parent: O3, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string,
   rotation?: number, extra?: Options): LWThree.Mesh;
  /** A piece that never changes; merged with its container's other fixed pieces when the scene is sealed. */
  fixed(parent: O3, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string,
   extra?: Options, turn?: LWThree.Turn): void;
  /** Lit text plate facing the front; `userData.signText` carries the displayed text. */
  sign(parent: O3, text: string, x: number, y: number, z: number, width: number, height: number, accent: string): LWThree.Mesh;
  /** Floating mood face sprite for an `emotion` level; the renderer places it above the room caption. */
  mood(parent: O3, level: number): LWThree.Sprite;
 }
 /** `moving` is true when `animate` moves any prop, so a renderer can skip redrawing rooms that stay still. */
 interface Room {
  setActive(active: boolean): void; setQueued(items: number): void; setBacklog(items: number): void; animate(t: number, progress: number): void;
  readonly moving: boolean;
 }
 type Swing = (t: number, progress: number) => void;
 type When = (on: boolean, queued: number) => boolean;
 /** Builder context; see the module header for `root`, `live`, `idle`, `P`, `F` and `L`. */
 interface Ctx {
  root: O3; live: LWThree.Group; idle: LWThree.Group; step: LWProcess.Step; readonly on: boolean; mat: Kit['mat'];
  G(parent: O3): LWThree.Group;
  P(parent: O3, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, extra?: Options): LWThree.Mesh;
  F(parent: O3, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string,
   extra?: Options, turn?: LWThree.Turn): void;
  /** Fixed piece shown `dark` while idle and `lit` with an `emissive` glow of `strength` while working. */
  L(parent: O3, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, dark: string, lit: string,
   emissive: string, strength?: number): void;
  sign(parent: O3, text: string, x: number, y: number, z: number, width: number, height: number): LWThree.Mesh;
  /** Switch a moving piece to `color` with an emissive glow while the room works (`off`, or its own colour, while idle). */
  glow(mesh: LWThree.Mesh, color: string, emissive: string, strength?: number, off?: string): LWThree.Mesh;
  /** Switch a piece to a lit material whenever `when(working, queued)` holds. */
  lamp(mesh: LWThree.Mesh, color: string, emissive: string, when: When, strength?: number): LWThree.Mesh;
  swing(fn: Swing): void; state(fn: (on: boolean, queued: number) => void): void;
 }
 type Builder = (c: Ctx) => void;
 /** `builders` and `channels` are registries filled by the modules loaded after this one; `moods` are the levels -3 to +3. */
 interface Api {
  theme(step: LWProcess.Step): Theme; build(kit: Kit, parent: O3, step: LWProcess.Step, furnished: boolean): Room;
  builders: Record<string, Builder>; channels: Record<string, Channel>; moods: Mood[]; fallbackTheme: Theme;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessRooms?: LWProcessRooms.Api};
 const T = (id: string, label: string, floor: string, wall: string, accent: string, task: string): LWProcessRooms.Theme =>
  ({id, label, floor, wall, accent, task});
 const TASK_THEMES = [
  T('office', 'Office', '#314050', '#374756', '#86a6bb', 'Typing and reviewing'),
  T('studio', 'Design studio', '#3b3a4c', '#4a4560', '#b79ad6', 'Drafting'),
  T('lab', 'Test lab', '#2c4448', '#36585c', '#7fd0c4', 'Running experiments'),
  T('workshop', 'Workshop', '#413a32', '#54483c', '#e0a35c', 'Building'),
  T('review', 'Review desk', '#3a4636', '#4c5e46', '#a8cf86', 'Checking and stamping'),
  T('archive', 'Records room', '#403747', '#54475c', '#d69aa8', 'Filing'),
 ];
 const KIND_THEMES: Record<string, LWProcessRooms.Theme> = {
  start: T('reception', 'Reception', '#2f4157', '#3b536c', '#91b9d5', 'Receiving requests'),
  end: T('dispatch', 'Dispatch dock', '#38404a', '#4a5563', '#8fc9a2', 'Delivering results'),
  decision: T('council', 'Decision room', '#3f3a33', '#574d41', '#e6c06e', 'Deliberating'),
  fork: T('junction', 'Junction', '#2b3a46', '#35495a', '#c79871', 'Routing work'),
  join: T('junction', 'Junction', '#2b3a46', '#35495a', '#c79871', 'Merging work'),
  machine: T('machine', 'Automation cell', '#343a41', '#464e57', '#ff8f5a', 'Running automatically'),
  system: T('system', 'Software system', '#232c45', '#2d3a5e', '#4fc3ff', 'Running automatically'),
  timer: T('clock', 'Waiting room', '#33384a', '#434a62', '#d9c58a', 'Waiting for the due minute'),
 };
 const BACKLOG_THEME = T('backlog', 'Backlog room', '#33405a', '#46527a', '#9db4ff', 'Holding ready work');
 function theme(step: LWProcess.Step): LWProcessRooms.Theme {
  if (step.kind === 'touchpoint') return (step.channel && api.channels[step.channel]?.theme) || api.fallbackTheme;
  if (step.kind === 'join' && step.backlog) return BACKLOG_THEME;
  if (step.kind !== 'task') return KIND_THEMES[step.kind]!;
  let h = 0;
  for (const c of step.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TASK_THEMES[h % TASK_THEMES.length]!;
 }
 type Ctx = LWProcessRooms.Ctx;
 /** Backlog board on the back wall: a framed grid of slots with one card per held item (scaled down when the capacity is larger). */
 function backlogBoard(kit: LWProcessRooms.Kit, c: Ctx, th: LWProcessRooms.Theme, capacity: number): (items: number) => void {
  const big = th.id === 'backlog', cols = big ? 6 : 4, rows = 3, w = big ? 6.4 : 2.6, h = big ? 2.6 : 1.7;
  const x = big ? 0 : -3.3, z = big ? -3.6 : -3.7, cell = w / cols, cards: LWThree.Mesh[] = [];
  c.F(c.root, 'box', x, h / 2 + .45, z, w + .3, h + .3, .12, '#242b38');
  c.F(c.root, 'box', x, h + .75, z + .02, w + .3, .22, .16, th.accent);
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
   const cx = x - w / 2 + cell * (k + .5), cy = .45 + h * (1 - (r + .5) / rows) - .1;
   c.F(c.root, 'box', cx, cy, z + .07, cell * .82, h / rows * .72, .03, '#394356');
   const card = c.P(c.root, 'box', cx, cy, z + .1, cell * .7, h / rows * .6, .04, r === 0 && k === 0 ? '#ffd27a' : th.accent);
   card.visible = false; cards.push(card);
  }
  return items => {
   const shown = items <= 0 ? 0 : capacity <= cards.length ? Math.min(items, cards.length) : Math.max(1, Math.round(items / capacity * cards.length));
   cards.forEach((card, i) => {card.visible = i < shown;});
  };
 }
 /** Every room gets a wall lamp and idle standby sign; `furnished` rooms also get a themed workstation (authored assets replace it). */
 function build(kit: LWProcessRooms.Kit, parent: LWThree.Object3D, step: LWProcess.Step, furnished: boolean): LWProcessRooms.Room {
  const th = theme(step), live = kit.group(parent), idle = kit.group(parent), swings: LWProcessRooms.Swing[] = [];
  const states: ((on: boolean, queued: number) => void)[] = [];
  live.userData.variant = 'live';
  idle.userData.variant = 'idle';
  let on = false, waiting = 0;
  const P: Ctx['P'] = (p, kind, x, y, z, sx, sy, sz, color, extra) => kit.piece(p, kind, x, y, z, sx, sy, sz, color, 0, extra);
  const F: Ctx['F'] = (p, kind, x, y, z, sx, sy, sz, color, extra, turn) => kit.fixed(p, kind, x, y, z, sx, sy, sz, color, extra, turn);
  const glow: Ctx['glow'] = (mesh, color, emissive, strength = .6, off) => {
   const dark = off ? kit.mat(off) : mesh.material, lit = kit.mat(color, {emissive, emissiveIntensity: strength});
   states.push(active => {mesh.material = active ? lit : dark;});
   return mesh;
  };
  // A lit fixed piece is a lit copy in the working variant and a dark copy in the idle one (one copy when it sits in a variant).
  const L: Ctx['L'] = (p, kind, x, y, z, sx, sy, sz, dark, lit, emissive, strength = .6) => {
   if (p !== live && p !== idle && p !== parent) {
    glow(P(p, kind, x, y, z, sx, sy, sz, dark), lit, emissive, strength);
    return;
   }
   if (p !== idle) F(live, kind, x, y, z, sx, sy, sz, lit, {emissive, emissiveIntensity: strength});
   if (p !== live) F(idle, kind, x, y, z, sx, sy, sz, dark);
  };
  const lamp: Ctx['lamp'] = (mesh, color, emissive, when, strength = .6) => {
   const dark = mesh.material, lit = kit.mat(color, {emissive, emissiveIntensity: strength});
   states.push((active, queued) => {mesh.material = when(active, queued) ? lit : dark;});
   return mesh;
  };
  const ctx: Ctx = {root: parent, live, idle, step, mat: kit.mat, P, F, L, glow, lamp, G: p => kit.group(p),
   get on() {return on;}, sign: (p, text, x, y, z, w, h) => kit.sign(p, text, x, y, z, w, h, th.accent),
   swing: fn => {swings.push(fn);}, state: fn => {states.push(fn);}};
  if (furnished) api.builders[th.id]?.(ctx);
  if (step.emotion !== undefined) kit.mood(parent, step.emotion);
  const setBacklog = step.backlog ? backlogBoard(kit, ctx, th, step.backlog.capacity) : () => undefined;
  L(parent, 'box', 2.6, 2.4, -4.2, .5, .14, .2, '#4a4f55', '#fff1df', '#ffd9a0', 1.6);
  F(idle, 'box', -3.3, .3, 1.8, .5, .6, .08, th.accent); F(idle, 'box', -3.3, .1, 1.8, .6, .2, .3, '#313c48');
  // The standby light is shown only while idle, so it keeps its unlit accent colour.
  F(idle, 'ball', -3.3, .75, 1.8, .06, .06, .06, th.accent);
  return {
   setBacklog,
   setActive(active) {
    on = active;
    live.visible = active;
    idle.visible = !active;
    for (const s of states) s(active, waiting);
   },
   setQueued(items) {
    waiting = items;
    for (const s of states) s(on, items);
   },
   animate(t, progress) {for (const s of swings) s(t, progress);},
   get moving() {return swings.length > 0;},
  };
 }
 const fallbackTheme = T('journey', 'Touchpoint', '#2f4a47', '#3b5f5a', '#7fd0c4', 'Serving customers');
 const api: LWProcessRooms.Api = {theme, build, builders: {}, channels: {}, moods: [], fallbackTheme};
 root.LWProcessRooms = api;
})(globalThis);
