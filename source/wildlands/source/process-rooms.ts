/// <reference path="./process-contracts.d.ts" />
/** Presentation-only room themes: fixed furniture, animated task visuals while working, and a quiet idle variant. No simulation state. */
declare namespace LWProcessRooms {
 interface Theme {id: string; label: string; floor: string; wall: string; accent: string; task: string}
 /** One mood level of the authored `emotion` (-3..3): face colour (cool to warm), eye/brow/mouth strokes in a 100-unit box. */
 interface Mood {level: number; label: string; color: string; mouth: string; brow?: string; open?: boolean}
 /** Display data of a touchpoint channel: names, a stroke glyph in a -0.5..0.5 box and its room theme. */
 interface Channel {label: string; glyph: string; theme: Theme}
 /** Subset of the 3D renderer's piece kit that room builders need. */
 interface Kit {T: any; mat(color: string, extra?: Record<string, unknown>): any; group(parent: any): any; piece(parent: any, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, rotation?: number, extra?: Record<string, unknown>): any;
  /** Lit text plate facing the front; `userData.signText` carries the displayed text. */
  sign(parent: any, text: string, x: number, y: number, z: number, width: number, height: number, accent: string): any;
  /** Floating mood face sprite for an `emotion` level; the renderer places it above the room caption. */
  mood(parent: any, level: number): any;}
 interface Room {setActive(active: boolean): void; setQueued(items: number): void; setBacklog(items: number): void; animate(t: number, progress: number): void;}
 /** Builder context: furniture goes in `live.parent` (always visible), `live` (working only) and `idle` (standby only). */
 interface Ctx {G(parent: any): any; P(parent: any, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, extra?: Record<string, unknown>): any;
  live: any; idle: any; step: LWProcess.Step; readonly on: boolean; mat: Kit['mat']; sign(parent: any, text: string, x: number, y: number, z: number, width: number, height: number): any;
  glow(mesh: any, color: string, emissive: string, strength?: number, off?: string): any; lamp(mesh: any, color: string, emissive: string, when: (on: boolean, queued: number) => boolean, strength?: number): any;
  swing(fn: (t: number, progress: number) => void): void; state(fn: (on: boolean, queued: number) => void): void;}
 type Builder = (c: Ctx) => void;
 /** `builders` and `channels` are registries filled by the touchpoint module (loaded after this one); `moods` are the seven levels from -3 to +3. */
 interface Api {theme(step: LWProcess.Step): Theme; build(kit: Kit, parent: any, step: LWProcess.Step, furnished: boolean): Room;
  builders: Record<string, Builder>; channels: Record<string, Channel>; moods: Mood[]; fallbackTheme: Theme;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessRooms?: LWProcessRooms.Api};
 const T = (id: string, label: string, floor: string, wall: string, accent: string, task: string): LWProcessRooms.Theme => ({id, label, floor, wall, accent, task});
 const TASK_THEMES = [
  T('office', 'Office', '#314050', '#374756', '#86a6bb', 'Typing and reviewing'), T('studio', 'Design studio', '#3b3a4c', '#4a4560', '#b79ad6', 'Drafting'),
  T('lab', 'Test lab', '#2c4448', '#36585c', '#7fd0c4', 'Running experiments'), T('workshop', 'Workshop', '#413a32', '#54483c', '#e0a35c', 'Building'),
  T('review', 'Review desk', '#3a4636', '#4c5e46', '#a8cf86', 'Checking and stamping'), T('archive', 'Records room', '#403747', '#54475c', '#d69aa8', 'Filing'),
 ];
 const KIND_THEMES: Record<string, LWProcessRooms.Theme> = {
  start: T('reception', 'Reception', '#2f4157', '#3b536c', '#91b9d5', 'Receiving requests'), end: T('dispatch', 'Dispatch dock', '#38404a', '#4a5563', '#8fc9a2', 'Delivering results'),
  decision: T('council', 'Decision room', '#3f3a33', '#574d41', '#e6c06e', 'Deliberating'), fork: T('junction', 'Junction', '#2b3a46', '#35495a', '#c79871', 'Routing work'),
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
  let h = 0; for (const c of step.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TASK_THEMES[h % TASK_THEMES.length]!;
 }
 type Builder = LWProcessRooms.Builder;
 type Ctx = LWProcessRooms.Ctx;
 const wave = (t: number, speed: number, shift = 0) => Math.sin(t * speed + shift);
 const BUILDERS: Record<string, Builder> = {
  office(c) {
   c.P(c.live.parent, 'box', 0, 1.1, -.6, 3.4, .18, 1.4, '#8c725d');
   for (const x of [-1.4, 1.4]) c.P(c.live.parent, 'box', x, .5, -.6, .16, 1, 1, '#536379');
   c.P(c.live.parent, 'box', 0, 1.7, -.8, 1, .65, .1, '#1d2630');
   c.P(c.live.parent, 'box', 0, 1.22, -.15, .9, .05, .3, '#2b3440');
   c.glow(c.P(c.live.parent, 'box', 0, 1.7, -.74, .86, .5, .02, '#86a6bb'), '#86a6bb', '#326578', .5, '#10171d');
   const bars = [0, 1, 2].map(i => c.P(c.live, 'box', 0, 1.82 - i * .13, -.72, .5, .04, .01, '#e9f4f8'));
   const sheet = c.P(c.live, 'box', 0, 1.35, -.2, .5, .02, .38, '#f2efe6');
   c.swing(t => {bars.forEach((b, i) => {b.scale.x = .25 + .3 * Math.abs(wave(t, .7, i * 1.7)); b.position.x = -.34 + b.scale.x / 2;}); const u = (t * .25) % 1; sheet.position.set(-1.5 + 3 * u, 1.35 + Math.sin(u * Math.PI) * .6, -.2); sheet.rotation.z = wave(t, 3) * .2;});
   for (const [x, col] of [[-1.35, '#f0d56a'], [-1.15, '#e98d8d'], [1.3, '#8dd3a1']] as const) c.P(c.live.parent, 'box', x, 1.22, -.9, .22, .02, .22, col);
   c.P(c.idle, 'box', 0, 1.45, .2, .8, .3, .06, '#d7b98e');
  },
  studio(c) {
   const board = c.P(c.live.parent, 'box', 0, 1.2, -.9, 2.8, .12, 1.5, '#d8d2c2'); board.rotation.x = -.35;
   for (const x of [-1.1, 1.1]) c.P(c.live.parent, 'box', x, .55, -.5, .1, 1.1, .1, '#6b5a4a');
   const pencil = c.P(c.live, 'cylinder', 0, 1.5, -.7, .03, .6, .03, '#e0a35c'), lines = [0, 1, 2, 3].map(i => c.P(c.live, 'box', -.6, 1.3 + i * .02, -1.2 + i * .25, 1, .015, .05, i % 2 ? '#7fb3e0' : '#b79ad6'));
   c.swing((t, p) => {pencil.position.x = wave(t, 2.4) * .8; pencil.position.z = -.7 + wave(t, 1.6) * .25; pencil.rotation.z = .5; lines.forEach((l, i) => {const k = Math.max(.05, Math.min(1, p * 1.4 - i * .18)); l.scale.x = 1.6 * k; l.position.x = -1 + .8 * k;});});
   for (const [x, col] of [[-1.5, '#b79ad6'], [-1.3, '#7fb3e0'], [-1.1, '#e0a35c']] as const) c.glow(c.P(c.live.parent, 'cylinder', x, 1.3, .35, .1, .12, .1, col), col, col, .4);
   c.P(c.idle, 'box', 0, 1.35, -.9, 2.9, .06, 1.6, '#5f5a72'); c.P(c.idle, 'box', 1.5, .1, .8, .4, .2, .4, '#3b3a4c');
  },
  lab(c) {
   c.P(c.live.parent, 'box', 0, .8, -1.4, 4.2, .12, 1.3, '#cfd8dc'); c.P(c.live.parent, 'box', 0, .4, -1.4, 4, .8, 1.1, '#3c5a5e');
   for (const x of [-1.4, -.4]) c.glow(c.P(c.live.parent, 'cone', x, 1.2, -1.4, .3, .7, .3, '#7fd0c4'), '#7fd0c4', '#3fa093', .6);
   const bubbles = [0, 1, 2, 3].map(i => c.P(c.live, 'ball', -1.4 + (i % 2) * 1, 1.3, -1.4, .07, .07, .07, '#e3fffa'));
   c.P(c.live.parent, 'cylinder', 1.4, 1.05, -1.4, .55, .12, .55, '#9aa9b0');
   const arm = c.P(c.live, 'box', 1.4, 1.15, -1.4, 1, .05, .12, '#e05c5c');
   c.swing(t => {bubbles.forEach((b, i) => {const u = (t * .5 + i * .27) % 1; b.position.y = 1.15 + u * .9; b.position.x = (i % 2 ? -.4 : -1.4) + wave(t, 5, i) * .08; b.scale.setScalar(.05 + .05 * (1 - u));}); arm.rotation.y = t * 6;});
   c.P(c.idle, 'box', 0, 1.1, -1.4, 4.3, .55, 1.2, '#8794a0'); c.P(c.idle, 'box', 1.4, .1, .8, .4, .2, .4, '#2c4448');
  },
  workshop(c) {
   c.P(c.live.parent, 'box', 0, .75, -1.2, 3.6, .2, 1.6, '#7a6a56'); for (const x of [-1.6, 1.6]) c.P(c.live.parent, 'box', x, .35, -1.2, .2, .7, 1.4, '#4b4d52');
   const gear = c.G(c.live.parent);
   gear.position.set(-.9, 1.5, -.3); c.P(gear, 'cylinder', 0, 0, 0, .45, .16, .45, '#8f98a3').rotation.x = Math.PI / 2;
   for (let i = 0; i < 4; i++) c.P(gear, 'box', 0, 0, 0, 1.2, .14, .2, '#aab3bd').rotation.z = i * Math.PI / 4;
   const hammer = c.P(c.live, 'box', 1, 1.5, -1.2, .12, .8, .12, '#6b5a4a'); c.P(hammer, 'box', 0, .5, 0, 3, .45, 1.4, '#9aa5b0');
   const sparks = [0, 1, 2, 3, 4].map(() => c.glow(c.P(c.live, 'ball', 0, 1, -1.2, .05, .05, .05, '#ffd27a'), '#ffd27a', '#ffb347', 1.2));
   c.swing(t => {gear.rotation.z = t * 1.8; hammer.rotation.z = -.2 - Math.abs(wave(t, 4)) * .9; sparks.forEach((s, i) => {const u = (t * 1.3 + i * .21) % 1; s.position.set(.2 + u * (i % 2 ? .8 : -1.2), 1 + Math.sin(u * Math.PI) * .6, -1.2 + wave(i, 3) * .3); s.scale.setScalar(.05 * Math.max(.2, 1 - u));});});
   c.P(c.idle, 'box', 0, 1, -1.2, 3.8, .55, 1.8, '#6c6760'); c.P(c.idle, 'box', 1.6, 2, -4.2, 1.4, .5, .1, '#8a7f70');
  },
  review(c) {
   c.P(c.live.parent, 'box', 0, .8, -1, 3.8, .16, 1.5, '#8a9a7c'); for (const x of [-1.7, 1.7]) c.P(c.live.parent, 'box', x, .4, -1, .16, .8, 1.3, '#4c5e46');
   c.glow(c.P(c.live.parent, 'box', -.4, .9, -1, 1.3, .03, 1, '#e6f2d8'), '#e6f2d8', '#a8cf86', .5);
   for (let i = 0; i < 4; i++) c.P(c.live.parent, 'box', -1.4, .95 + i * .05, -1, .6, .04, .8, i % 2 ? '#f2efe6' : '#d9d3c0');
   const out = c.P(c.live, 'box', 1.4, 1, -1, .6, .04, .8, '#f2efe6'), stamp = c.P(c.live, 'cylinder', 0, 1.6, -1, .22, .5, .22, '#c75c5c');
   const tick = c.glow(c.P(c.live, 'box', .4, 1.0, -.7, .5, .02, .12, '#8fd68a'), '#8fd68a', '#4caf50', 1);
   c.swing((t, p) => {const u = (t * .35) % 1; out.position.set(-1.4 + 2.8 * u, 1.05 + Math.sin(u * Math.PI) * .4, -1); stamp.position.y = 1.35 + Math.abs(wave(t, 3)) * .6; tick.scale.x = Math.max(.1, p);});
   c.P(c.idle, 'box', 0, 1, -1, 3.9, .1, 1.6, '#707a68'); c.P(c.idle, 'cylinder', .2, 1, -.5, .22, .3, .22, '#c75c5c');
  },
  archive(c) {
   for (const x of [-1.8, -.6, .6, 1.8]) c.P(c.live.parent, 'box', x, 1, -3.3, 1, 2, .8, '#6f5a78');
   const drawers = [-1.8, -.6, .6, 1.8].map(x => c.P(c.live.parent, 'box', x, 1.3, -2.8, .85, .35, .1, '#a78bb0'));
   const boxes = [0, 1, 2].map(i => c.P(c.live, 'box', 0, .6, -1.2, .6, .4, .6, i % 2 ? '#d69aa8' : '#c78a4a'));
   c.P(c.live.parent, 'box', 0, .15, -1.2, 4, .15, .9, '#4a4252');
   c.swing(t => {boxes.forEach((b, i) => {const u = (t * .3 + i / 3) % 1; b.position.x = -1.8 + 3.6 * u;}); drawers.forEach((d, i) => {d.position.z = -2.8 + Math.max(0, wave(t, 1.6, i * 1.9)) * .6;});});
   c.P(c.idle, 'box', 0, .4, -1.2, 3.8, .3, .8, '#5a4e62'); c.P(c.idle, 'box', 1.8, .8, -1.8, .8, 1.6, .5, '#7d8794');
  },
  reception(c) {
   c.P(c.live.parent, 'box', 0, .55, -1.3, 4, 1.1, 1, '#5a7a96'); c.P(c.live.parent, 'box', 0, 1.12, -1.3, 4.2, .08, 1.2, '#cfd8e0');
   const mail = [0, 1, 2].map(() => c.P(c.live, 'box', 0, 1.3, -1.3, .35, .02, .25, '#f6f1e4'));
   const bell = c.glow(c.P(c.live.parent, 'ball', 1.6, 1.3, -1.2, .15, .1, .15, '#e0c060'), '#e0c060', '#a0801c', .6);
   c.swing(t => {mail.forEach((m, i) => {const u = (t * .45 + i / 3) % 1; m.position.set(-3.5 + 3.8 * u, 1.3 + Math.sin(u * Math.PI) * .8, -1.3); m.rotation.z = u * 3;}); bell.scale.setScalar(.15 * (1 + Math.max(0, wave(t, 5)) * .3));});
   c.P(c.idle, 'box', 0, 1.35, -1.3, .9, .25, .05, '#d6a05a');
  },
  dispatch(c) {
   c.P(c.live.parent, 'box', 0, .15, -1.3, 4.6, .25, 1.1, '#4e5864');
   const crates = [0, 1, 2].map(i => c.P(c.live, 'box', 0, .6, -1.3, .7, .6, .7, i % 2 ? '#8fc9a2' : '#d8b074'));
   const door = c.glow(c.P(c.live.parent, 'box', 2.4, 1.1, -1.3, .12, 2, 1.6, '#8fc9a2'), '#8fc9a2', '#4c8f63', .6);
   c.swing(t => {crates.forEach((b, i) => {const u = (t * .3 + i / 3) % 1; b.position.x = -2.2 + 4.4 * u;}); door.scale.y = .6 + Math.max(0, wave(t, 1.2)) * .4;});
   c.P(c.idle, 'box', 2.4, 1.1, -1.3, .14, 2, 1.6, '#6c7480'); c.P(c.idle, 'box', 0, .5, -1.3, .6, .5, .6, '#6b6558');
  },
  council(c) {
   c.P(c.live.parent, 'cylinder', 0, .8, -.8, 1.9, .14, 1.9, '#8a6f4b'); c.P(c.live.parent, 'cylinder', 0, .4, -.8, .35, .8, .35, '#5a4a36');
   const lamps = [0, 1, 2, 3, 4].map(i => {
    const a = i / 5 * Math.PI * 2, x = Math.cos(a) * 2.6, z = -.8 + Math.sin(a) * 2.2; c.P(c.live.parent, 'box', x, .45, z, .5, .3, .5, '#5a4a36');
    return c.glow(c.P(c.live.parent, 'ball', x, .75, z, .1, .1, .1, '#e6c06e'), '#e6c06e', '#a0801c', 1);
   });
   const ring = c.P(c.live, 'ring', 0, 1.7, -.8, 1.1, 1.1, 1.1, '#e6c06e');
   c.swing(t => {ring.rotation.set(Math.PI / 2 + wave(t, 1.1) * .35, t * 1.4, 0); ring.position.y = 1.7 + wave(t, 2) * .1; lamps.forEach((l, i) => l.scale.setScalar(.1 * (.7 + Math.max(0, wave(t, 2.5, i * 1.3)) * .9)));});
   c.P(c.idle, 'box', 0, 1, -.8, 2.1, .1, 2.1, '#6b6358');
  },
  machine(c) {
   const root = c.live.parent, A = '#ff8f5a', steel = '#e9eef2';
   // Factory cell: conveyor, articulated arm, stack light and safety cage. Idle parks the arm folded with the belt still.
   c.P(root, 'box', 0, .45, -1.5, 9.2, .22, 1.3, '#2d3239'); c.P(root, 'box', 0, .58, -1.5, 9, .06, 1, '#1a1d21');
   for (const z of [-2.18, -.82]) c.P(root, 'box', 0, .66, z, 9.2, .12, .1, '#5d6670');
   for (const x of [-4.2, -1.4, 1.4, 4.2]) for (const z of [-2, -1]) c.P(root, 'box', x, .2, z, .14, .4, .14, '#454c55');
   const stripes = Array.from({length: 9}, (_, i) => c.P(c.live, 'box', -4.4 + i, .62, -1.5, .08, .015, .96, '#3a424b'));
   const crates = [0, 1, 2].map(i => {const g = c.G(c.live); c.P(g, 'box', 0, .3, 0, .7, .5, .6, i % 2 ? '#d8b074' : '#c99a5a'); c.P(g, 'box', 0, .56, 0, .74, .04, .12, '#8a6a3a'); return g;});
   for (const x of [-3.2, 2.9]) {const g = c.G(c.idle); g.position.set(x, .62, -1.5); c.P(g, 'box', 0, .25, 0, .7, .5, .6, '#c99a5a');}
   c.P(root, 'cylinder', 1.5, .2, -3.1, .75, .4, .75, '#3a4048'); c.P(root, 'cylinder', 1.5, .42, -3.1, .55, .1, .55, A);
   const turret = c.G(root), shoulder = c.G(turret), elbow = c.G(shoulder), wrist = c.G(elbow);
   turret.position.set(1.5, .5, -3.1); shoulder.position.y = .4; elbow.position.y = 1.4; wrist.position.y = 1.2;
   c.P(turret, 'cylinder', 0, .2, 0, .4, .4, .4, '#4a525c'); c.P(shoulder, 'ball', 0, 0, 0, .26, .26, .26, A); c.P(shoulder, 'box', 0, .7, 0, .3, 1.4, .3, steel);
   c.P(elbow, 'ball', 0, 0, 0, .22, .22, .22, A); c.P(elbow, 'box', 0, .6, 0, .24, 1.2, .24, steel); c.P(wrist, 'ball', 0, 0, 0, .16, .16, .16, A); c.P(wrist, 'box', 0, .18, 0, .4, .14, .18, '#2b3036');
   const fingers = [-1, 1].map(s => c.P(wrist, 'box', s * .15, .4, 0, .06, .3, .14, '#aab3bd')), held = c.P(wrist, 'box', 0, .62, 0, .3, .26, .3, '#c99a5a'); held.visible = false;
   c.state(on => {held.visible = on;});
   const pose = (rest: number, work: number, k: number) => rest + (work - rest) * k;
   c.swing(t => {
    const k = c.on ? 1 : 0, s = Math.sin(t * .9) * k, w = Math.sin(t * 1.8) * k;
    turret.rotation.y = pose(-Math.PI / 2 - .5, -Math.PI / 2, k) + .75 * s; shoulder.rotation.z = pose(-.15, -.5, k) - .15 * w; elbow.rotation.z = pose(-1.5, -.95, k) - .3 * w; wrist.rotation.z = pose(.3, -.45, k) + .25 * w;
    fingers.forEach((f, i) => {f.position.x = (i ? 1 : -1) * (.13 + .05 * Math.max(0, w) * k);});
    stripes.forEach((b, i) => {b.position.x = -4.4 + (i + (t * .6) % 1) % 9;});
    crates.forEach((g, i) => {const u = (t * .22 + i / 3) % 1; g.position.set(-4.2 + 8.4 * u, .62, -1.5);});
   });
   const lampMat = (mesh: any, col: string, glow: string, when: (on: boolean, q: number) => boolean) => c.lamp(mesh, col, glow, when, 1.1);
   c.P(root, 'cylinder', 4.15, 1.05, -3.7, .06, 2.1, .06, '#59616b'); c.P(root, 'cylinder', 4.15, 2.15, -3.7, .15, .1, .15, '#2b3036');
   lampMat(c.P(root, 'cylinder', 4.15, 2.3, -3.7, .15, .2, .15, '#193b25'), '#5af58c', '#2fbf63', on => on); lampMat(c.P(root, 'cylinder', 4.15, 2.52, -3.7, .15, .2, .15, '#4a3a17'), '#ffc23d', '#c98a00', (on, q) => !on && q > 0);
   c.P(root, 'cylinder', 4.15, 2.74, -3.7, .15, .2, .15, '#401d1d');
   for (const x of [-4.5, -1.5, 1.5, 4.5]) c.P(root, 'box', x, .9, -.1, .12, 1.8, .12, '#f2c230');
   for (const y of [.9, 1.8]) c.P(root, 'box', 0, y, -.1, 9, .07, .07, '#2b3036');
   c.P(root, 'box', 0, 1.35, -.1, 9, .9, .02, '#ffd24a', {transparent: true, opacity: .14, depthWrite: false});
   c.P(root, 'box', -4.1, .9, -3.4, 1.1, 1.8, .9, '#4a5058'); lampMat(c.P(root, 'box', -4.1, 1.5, -2.93, .5, .3, .03, '#10171d'), '#8cf5b0', '#2fbf63', on => on);
   for (const x of [-2.2, 2.2]) c.P(root, 'cylinder', x, 2.05, -4.2, .04, 1.3, .04, '#59616b');
   c.sign(root, c.step.technology ?? 'Machine', 0, 3.1, -4.2, 4.6, .9);
  },
  system(c) {
   const root = c.live.parent, B = '#4fc3ff', dark = c.mat('#101521'), tones = [c.mat('#5af58c', {emissive: '#2fbf63', emissiveIntensity: 1}), c.mat(B, {emissive: '#1d7fb5', emissiveIntensity: 1})];
   // Server racks with blinking LED rows, a terminal wall with scrolling lines, a cable run carrying packets and a status beacon.
   const leds: {mesh: any; seed: number}[] = [];
   for (const [ri, x] of [-3.6, -2.3].entries()) {
    c.P(root, 'box', x, 1.35, -3.2, 1.1, 2.7, 1, '#1e2638');
    for (let r = 0; r < 8; r++) {
     c.P(root, 'box', x, .35 + r * .31, -2.68, .96, .24, .04, '#2c3852'); c.P(root, 'box', x + .1, .35 + r * .31, -2.655, .4, .03, .01, '#161d2c');
     for (const dx of [-.34, -.22]) leds.push({mesh: c.P(root, 'box', x + dx, .35 + r * .31, -2.65, .08, .07, .03, '#101521'), seed: ri * 17 + r * 3 + (dx < -.3 ? 1 : 2)});
    }
   }
   c.P(root, 'box', 2.3, 2, -4.08, 3.9, 1.6, .02, '#0b111a');
   c.P(root, 'box', 2.3, 2, -4.17, 4.2, 1.9, .12, '#141a26'); for (const x of [.7, 4.1]) c.P(root, 'box', x, .52, -4.2, .15, 1.05, .15, '#252f45');
   c.P(c.live, 'box', 2.3, 2, -4.06, 3.9, 1.6, .02, '#0f2d4a', {emissive: '#1c5f96', emissiveIntensity: .55});
   const widths = [2.4, 1.6, 3, 2, 2.7, 1.2, 2.2], rows = widths.map((w, i) => c.P(c.live, 'box', .55 + w / 2, 2.4, -4.04, w, .07, .01, i % 3 ? '#7fd8ff' : '#9bf5c0'));
   c.P(c.live, 'box', 2.3, 1.38, -4.05, 3.4, .1, .01, '#1b2a3d'); const bar = c.P(c.live, 'box', .6, 1.38, -4.04, .001, .1, .015, B, {emissive: '#1d7fb5', emissiveIntensity: 1});
   c.P(c.idle, 'box', 1.6, 2.4, -4.05, 1.2, .05, .01, '#2a3b55'); c.P(c.idle, 'box', 1.1, 2.1, -4.05, .1, .12, .01, '#2a3b55');
   c.P(root, 'box', 2, .75, -2.7, 3, .12, 1, '#2b3448'); for (const x of [.6, 3.4]) c.P(root, 'box', x, .38, -2.7, .12, .75, .9, '#1e2638'); c.P(root, 'box', 2, .84, -2.4, .9, .04, .3, '#3c4a68');
   const path: [number, number][] = [[-2.95, -2.55], [-2.95, -1.5], [1, -1.5], [1, -2.3]], lengths = [1.05, 3.95, .8], total = 5.8;
   c.P(root, 'box', -2.95, .05, -2.02, .09, .05, 1.07, '#1a2234'); c.P(root, 'box', -.975, .05, -1.5, 4, .05, .09, '#1a2234'); c.P(root, 'box', 1, .05, -1.9, .09, .05, .82, '#1a2234');
   const packets = [0, 1, 2, 3, 4].map(() => c.glow(c.P(c.live, 'ball', 0, .14, 0, .09, .09, .09, '#a8e6ff'), '#a8e6ff', B, 1.4));
   c.P(root, 'cylinder', -2.95, 2.8, -3.2, .05, .22, .05, '#59616b');
   c.lamp(c.P(root, 'ball', -2.95, 3.02, -3.2, .2, .2, .2, '#1d2a40'), '#6fd6ff', B, (on, q) => on || q > 0, 1.4);
   c.swing((t, p) => {
    const k = c.on;
    leds.forEach((l, i) => {l.mesh.material = k && Math.sin(t * 3 + l.seed * 1.9 + l.seed % 3 * .7) > .1 ? tones[l.seed % 2]! : !k && i === 0 ? tones[0]! : dark;});
    rows.forEach((r, i) => {const u = (t * .4 + i / rows.length) % 1; r.position.y = 2.7 - u * 1.3; r.scale.y = .07 * Math.max(.02, Math.min(1, Math.min(u, 1 - u) * 6));});
    bar.scale.x = Math.max(.001, p * 3.4); bar.position.x = .6 + bar.scale.x / 2;
    packets.forEach((m, i) => {
     let d = ((t * 1.2 + i * total / packets.length) % total), seg = 0; while (seg < 2 && d > lengths[seg]!) d -= lengths[seg++]!;
     const a = path[seg]!, b = path[seg + 1]!, u = d / lengths[seg]!; m.position.set(a[0] + (b[0] - a[0]) * u, .14, a[1] + (b[1] - a[1]) * u);
    });
   });
   for (const x of [-.7, 3.1]) c.P(root, 'cylinder', x, 2.3, -4.28, .04, 1.8, .04, '#59616b');
   c.sign(root, c.step.technology ?? 'System', 1.2, 3.6, -4.2, 4.4, .85);
  },
  backlog(c) {
   c.P(c.live.parent, 'box', 3.2, .3, -1.4, 3, .3, 1, '#4a5578'); c.P(c.live.parent, 'box', 1.5, .65, -1.4, .2, .7, 1.2, '#9db4ff');
   const card = c.P(c.live, 'box', 0, .6, -1.4, .5, .08, .36, '#e7edff');
   c.swing(t => {const u = (t * .3) % 1; card.position.x = 1.7 + u * 3; card.position.y = .6 + Math.sin(u * Math.PI) * .12;});
   c.P(c.idle, 'box', 3.2, .55, -1.4, 3.1, .45, 1.1, '#5b6585');
  },
  clock(c) {
   c.P(c.live.parent, 'box', 0, 1.8, -3.9, 2.4, 2.4, .14, '#4a516b'); c.P(c.live.parent, 'cylinder', 0, 1.8, -3.78, 1, .08, 1, '#efe8d2').rotation.x = Math.PI / 2;
   const hand = c.P(c.live, 'box', 0, 2.2, -3.7, .08, .8, .05, '#3a3f52'), sand = c.glow(c.P(c.live.parent, 'cone', 2.2, .9, -1.6, .5, .9, .5, '#d9c58a'), '#d9c58a', '#a38f45', .7);
   c.P(c.live.parent, 'box', 2.2, .3, -1.6, 1, .1, 1, '#6b5f42'); c.P(c.live.parent, 'box', 2.2, 1.55, -1.6, 1, .1, 1, '#6b5f42');
   c.swing(t => {hand.rotation.z = -t * .6; hand.position.set(Math.sin(t * .6) * .4, 1.8 + Math.cos(t * .6) * .4, -3.7); sand.scale.y = .6 + Math.abs(wave(t, .8)) * .4;});
   c.P(c.idle, 'box', 0, 1.8, -3.7, .9, .9, .05, '#7b829c');
  },
  junction(c) {
   c.P(c.live.parent, 'cylinder', 0, .35, -.8, .9, .7, .9, '#4b6070');
   for (const a of [0, 1, 2, 3]) c.P(c.live.parent, 'box', Math.cos(a * Math.PI / 2) * 1.6, .25, -.8 + Math.sin(a * Math.PI / 2) * 1.6, a % 2 ? .4 : 2.2, .2, a % 2 ? 2.2 : .4, '#3b4d5b');
   const ring = c.glow(c.P(c.live, 'ring', 0, .9, -.8, 1, 1, 1, '#c79871'), '#c79871', '#9a6a3c', .9);
   const pulses = [0, 1, 2, 3].map(() => c.glow(c.P(c.live, 'ball', 0, .45, -.8, .12, .12, .12, '#f0c89a'), '#f0c89a', '#d49a62', 1));
   c.swing(t => {ring.rotation.set(Math.PI / 2 + wave(t, 1.7) * .3, t * 2, 0); pulses.forEach((p, i) => {const u = (t * .5 + i * .25) % 1, a = i * Math.PI / 2; p.position.set(Math.cos(a) * 2.6 * u, .45, -.8 + Math.sin(a) * 2.6 * u);});});
   c.P(c.idle, 'cylinder', 0, .8, -.8, .95, .1, .95, '#5f6a74');
  },
 };
 /** Every room gets a wall lamp and idle standby sign; `furnished` rooms also get a themed workstation (authored assets replace it). */
 function build(kit: LWProcessRooms.Kit, parent: any, step: LWProcess.Step, furnished: boolean): LWProcessRooms.Room {
  const th = theme(step), live = kit.group(parent), idle = kit.group(parent), swings: ((t: number, progress: number) => void)[] = [], states: ((on: boolean, queued: number) => void)[] = [];
  let on = false, waiting = 0;
  const P = (p: any, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, extra?: Record<string, unknown>) => kit.piece(p, kind, x, y, z, sx, sy, sz, color, 0, extra);
  const lamp: Ctx['lamp'] = (mesh, color, emissive, when, strength = .6) => {
   const dark = mesh.material, lit = kit.mat(color, {emissive, emissiveIntensity: strength}); states.push((active, queued) => {mesh.material = when(active, queued) ? lit : dark;}); return mesh;
  };
  const ctx: Ctx = {P, G: p => kit.group(p), live, idle, step, mat: kit.mat, swing: fn => {swings.push(fn);}, state: fn => {states.push(fn);}, lamp,
   get on() {return on;}, sign: (p, text, x, y, z, w, h) => kit.sign(p, text, x, y, z, w, h, th.accent),
   glow(mesh, color, emissive, strength = .6, off) {
    const dark = off ? kit.mat(off) : mesh.material, lit = kit.mat(color, {emissive, emissiveIntensity: strength});
    states.push(active => {mesh.material = active ? lit : dark;}); return mesh;
   }};
  if (furnished) api.builders[th.id]?.(ctx);
  if (step.emotion !== undefined) kit.mood(parent, step.emotion);
  const cards: any[] = [], capacity = step.backlog?.capacity ?? 1;
  if (step.backlog) {
   const big = th.id === 'backlog', cols = big ? 6 : 4, rows = 3, w = big ? 6.4 : 2.6, h = big ? 2.6 : 1.7, x = big ? 0 : -3.3, z = big ? -3.6 : -3.7, cell = w / cols;
   P(parent, 'box', x, h / 2 + .45, z, w + .3, h + .3, .12, '#242b38'); P(parent, 'box', x, h + .75, z + .02, w + .3, .22, .16, th.accent);
   for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const cx = x - w / 2 + cell * (k + .5), cy = .45 + h * (1 - (r + .5) / rows) - .1;
    P(parent, 'box', cx, cy, z + .07, cell * .82, h / rows * .72, .03, '#394356');
    const card = P(parent, 'box', cx, cy, z + .1, cell * .7, h / rows * .6, .04, r === 0 && k === 0 ? '#ffd27a' : th.accent); card.visible = false; cards.push(card);
   }
  }
  ctx.glow(P(parent, 'box', 2.6, 2.4, -4.2, .5, .14, .2, '#fff1df'), '#fff1df', '#ffd9a0', 1.6, '#4a4f55');
  P(idle, 'box', -3.3, .3, 1.8, .5, .6, .08, th.accent); P(idle, 'box', -3.3, .1, 1.8, .6, .2, .3, '#313c48');
  ctx.glow(P(idle, 'ball', -3.3, .75, 1.8, .06, .06, .06, th.accent), th.accent, th.accent, 1.2);
  return {
   setBacklog(items) {const shown = items <= 0 ? 0 : capacity <= cards.length ? Math.min(items, cards.length) : Math.max(1, Math.round(items / capacity * cards.length)); cards.forEach((c, i) => {c.visible = i < shown;});},
   setActive(active) {on = active; live.visible = active; idle.visible = !active; for (const s of states) s(active, waiting);},
   setQueued(items) {waiting = items; for (const s of states) s(on, items);},
   animate(t, progress) {for (const s of swings) s(t, progress);},
  };
 }
 const api: LWProcessRooms.Api = {theme, build, builders: BUILDERS, channels: {}, moods: [], fallbackTheme: T('journey', 'Touchpoint', '#2f4a47', '#3b5f5a', '#7fd0c4', 'Serving customers')};
 root.LWProcessRooms = api;
})(globalThis);
