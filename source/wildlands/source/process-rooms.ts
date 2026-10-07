/// <reference path="./process-contracts.d.ts" />
/** Presentation-only room themes: fixed furniture, animated task visuals while working, and a quiet idle variant. No simulation state. */
declare namespace LWProcessRooms {
 interface Theme {id: string; label: string; floor: string; wall: string; accent: string; task: string}
 /** Subset of the 3D renderer's piece kit that room builders need. */
 interface Kit {T: any; mat(color: string, extra?: Record<string, unknown>): any; group(parent: any): any; piece(parent: any, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, rotation?: number, extra?: Record<string, unknown>): any;}
 interface Room {setActive(active: boolean): void; animate(t: number, progress: number): void;}
 interface Api {theme(step: LWProcess.Step): Theme; build(kit: Kit, parent: any, step: LWProcess.Step, furnished: boolean): Room;}
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
 };
 function theme(step: LWProcess.Step): LWProcessRooms.Theme {
  if (step.kind !== 'task') return KIND_THEMES[step.kind]!;
  let h = 0; for (const c of step.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TASK_THEMES[h % TASK_THEMES.length]!;
 }
 interface Ctx {G(parent: any): any; P(parent: any, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, extra?: Record<string, unknown>): any;
  live: any; idle: any; glow(mesh: any, color: string, emissive: string, strength?: number, off?: string): any; swing(fn: (t: number, progress: number) => void): void; state(fn: (on: boolean) => void): void;}
 type Builder = (c: Ctx) => void;
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
   const mail = [0, 1, 2].map(i => c.P(c.live, 'box', 0, 1.3, -1.3, .35, .02, .25, '#f6f1e4'));
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
  junction(c) {
   c.P(c.live.parent, 'cylinder', 0, .35, -.8, .9, .7, .9, '#4b6070');
   for (const a of [0, 1, 2, 3]) c.P(c.live.parent, 'box', Math.cos(a * Math.PI / 2) * 1.6, .25, -.8 + Math.sin(a * Math.PI / 2) * 1.6, a % 2 ? .4 : 2.2, .2, a % 2 ? 2.2 : .4, '#3b4d5b');
   const ring = c.glow(c.P(c.live, 'ring', 0, .9, -.8, 1, 1, 1, '#c79871'), '#c79871', '#9a6a3c', .9);
   const pulses = [0, 1, 2, 3].map(i => c.glow(c.P(c.live, 'ball', 0, .45, -.8, .12, .12, .12, '#f0c89a'), '#f0c89a', '#d49a62', 1));
   c.swing(t => {ring.rotation.set(Math.PI / 2 + wave(t, 1.7) * .3, t * 2, 0); pulses.forEach((p, i) => {const u = (t * .5 + i * .25) % 1, a = i * Math.PI / 2; p.position.set(Math.cos(a) * 2.6 * u, .45, -.8 + Math.sin(a) * 2.6 * u);});});
   c.P(c.idle, 'cylinder', 0, .8, -.8, .95, .1, .95, '#5f6a74');
  },
 };
 /** Every room gets a wall lamp and idle standby sign; `furnished` rooms also get a themed workstation (authored assets replace it). */
 function build(kit: LWProcessRooms.Kit, parent: any, step: LWProcess.Step, furnished: boolean): LWProcessRooms.Room {
  const th = theme(step), live = kit.group(parent), idle = kit.group(parent), swings: ((t: number, progress: number) => void)[] = [], states: ((on: boolean) => void)[] = [];
  const P = (p: any, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, extra?: Record<string, unknown>) => kit.piece(p, kind, x, y, z, sx, sy, sz, color, 0, extra);
  const ctx: Ctx = {P, G: p => kit.group(p), live, idle, swing: fn => {swings.push(fn);}, state: fn => {states.push(fn);},
   glow(mesh, color, emissive, strength = .6, off) {
    const dark = off ? kit.mat(off) : mesh.material, lit = kit.mat(color, {emissive, emissiveIntensity: strength});
    states.push(active => {mesh.material = active ? lit : dark;}); return mesh;
   }};
  if (furnished) BUILDERS[th.id]!(ctx);
  ctx.glow(P(parent, 'box', 2.6, 2.4, -4.2, .5, .14, .2, '#fff1df'), '#fff1df', '#ffd9a0', 1.6, '#4a4f55');
  P(idle, 'box', -3.3, .3, 1.8, .5, .6, .08, th.accent); P(idle, 'box', -3.3, .1, 1.8, .6, .2, .3, '#313c48');
  ctx.glow(P(idle, 'ball', -3.3, .75, 1.8, .06, .06, .06, th.accent), th.accent, th.accent, 1.2);
  return {
   setActive(active) {live.visible = active; idle.visible = !active; for (const s of states) s(active);},
   animate(t, progress) {for (const s of swings) s(t, progress);},
  };
 }
 root.LWProcessRooms = {theme, build};
})(globalThis);
