/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-three.d.ts" />
/**
 * Room models for automated work (LWProcessRooms.builders, registered here): the machine step's factory cell and the system step's
 * server room. Presentation only; loads after process-rooms.ts. An idle cell parks its arm and stops its belt; an idle server room
 * shows one steady status LED, and its blinking LEDs, terminal lines and packets exist only in the working variant.
 */
(function(inputRoot: unknown) {
 'use strict';
 const rooms = (inputRoot as {LWProcessRooms: LWProcessRooms.Api}).LWProcessRooms;
 type Ctx = LWProcessRooms.Ctx;
 rooms.builders.machine = (c: Ctx) => {
  const R = c.root, A = '#ff8f5a', steel = '#e9eef2';
  // Factory cell: conveyor, articulated arm, stack light and safety cage. Idle parks the arm folded with the belt still.
  c.F(R, 'box', 0, .45, -1.5, 9.2, .22, 1.3, '#2d3239'); c.F(R, 'box', 0, .58, -1.5, 9, .06, 1, '#1a1d21');
  for (const z of [-2.18, -.82]) c.F(R, 'box', 0, .66, z, 9.2, .12, .1, '#5d6670');
  for (const x of [-4.2, -1.4, 1.4, 4.2]) for (const z of [-2, -1]) c.F(R, 'box', x, .2, z, .14, .4, .14, '#454c55');
  const stripes = Array.from({length: 9}, (_, i) => c.P(c.live, 'box', -4.4 + i, .62, -1.5, .08, .015, .96, '#3a424b'));
  const crates = [0, 1, 2].map(i => {
   const g = c.G(c.live);
   c.F(g, 'box', 0, .3, 0, .7, .5, .6, i % 2 ? '#d8b074' : '#c99a5a'); c.F(g, 'box', 0, .56, 0, .74, .04, .12, '#8a6a3a');
   return g;
  });
  for (const x of [-3.2, 2.9]) c.F(c.idle, 'box', x, .87, -1.5, .7, .5, .6, '#c99a5a');
  c.F(R, 'cylinder', 1.5, .2, -3.1, .75, .4, .75, '#3a4048'); c.F(R, 'cylinder', 1.5, .42, -3.1, .55, .1, .55, A);
  const turret = c.G(R), shoulder = c.G(turret), elbow = c.G(shoulder), wrist = c.G(elbow);
  turret.position.set(1.5, .5, -3.1);
  shoulder.position.y = .4;
  elbow.position.y = 1.4;
  wrist.position.y = 1.2;
  c.F(turret, 'cylinder', 0, .2, 0, .4, .4, .4, '#4a525c');
  c.F(shoulder, 'ball', 0, 0, 0, .26, .26, .26, A); c.F(shoulder, 'box', 0, .7, 0, .3, 1.4, .3, steel);
  c.F(elbow, 'ball', 0, 0, 0, .22, .22, .22, A); c.F(elbow, 'box', 0, .6, 0, .24, 1.2, .24, steel);
  c.F(wrist, 'ball', 0, 0, 0, .16, .16, .16, A); c.F(wrist, 'box', 0, .18, 0, .4, .14, .18, '#2b3036');
  const fingers = [-1, 1].map(s => c.P(wrist, 'box', s * .15, .4, 0, .06, .3, .14, '#aab3bd'));
  const held = c.P(wrist, 'box', 0, .62, 0, .3, .26, .3, '#c99a5a');
  held.visible = false;
  c.state(on => {held.visible = on;});
  const pose = (rest: number, work: number, k: number) => rest + (work - rest) * k;
  c.swing(t => {
   const k = c.on ? 1 : 0, s = Math.sin(t * .9) * k, w = Math.sin(t * 1.8) * k;
   turret.rotation.y = pose(-Math.PI / 2 - .5, -Math.PI / 2, k) + .75 * s; shoulder.rotation.z = pose(-.15, -.5, k) - .15 * w;
   elbow.rotation.z = pose(-1.5, -.95, k) - .3 * w; wrist.rotation.z = pose(.3, -.45, k) + .25 * w;
   fingers.forEach((f, i) => {f.position.x = (i ? 1 : -1) * (.13 + .05 * Math.max(0, w) * k);});
   stripes.forEach((b, i) => {b.position.x = -4.4 + (i + (t * .6) % 1) % 9;});
   crates.forEach((g, i) => {const u = (t * .22 + i / 3) % 1; g.position.set(-4.2 + 8.4 * u, .62, -1.5);});
  });
  const stack = (y: number, dark: string, lit: string, glow: string, when: LWProcessRooms.When) =>
   c.lamp(c.P(R, 'cylinder', 4.15, y, -3.7, .15, .2, .15, dark), lit, glow, when, 1.1);
  c.F(R, 'cylinder', 4.15, 1.05, -3.7, .06, 2.1, .06, '#59616b'); c.F(R, 'cylinder', 4.15, 2.15, -3.7, .15, .1, .15, '#2b3036');
  stack(2.3, '#193b25', '#5af58c', '#2fbf63', on => on); stack(2.52, '#4a3a17', '#ffc23d', '#c98a00', (on, q) => !on && q > 0);
  c.F(R, 'cylinder', 4.15, 2.74, -3.7, .15, .2, .15, '#401d1d');
  for (const x of [-4.5, -1.5, 1.5, 4.5]) c.F(R, 'box', x, .9, -.1, .12, 1.8, .12, '#f2c230');
  for (const y of [.9, 1.8]) c.F(R, 'box', 0, y, -.1, 9, .07, .07, '#2b3036');
  c.F(R, 'box', 0, 1.35, -.1, 9, .9, .02, '#ffd24a', {transparent: true, opacity: .14, depthWrite: false});
  c.F(R, 'box', -4.1, .9, -3.4, 1.1, 1.8, .9, '#4a5058');
  c.lamp(c.P(R, 'box', -4.1, 1.5, -2.93, .5, .3, .03, '#10171d'), '#8cf5b0', '#2fbf63', on => on, 1.1);
  for (const x of [-2.2, 2.2]) c.F(R, 'cylinder', x, 2.05, -4.2, .04, 1.3, .04, '#59616b');
  c.sign(R, c.step.technology ?? 'Machine', 0, 3.1, -4.2, 4.6, .9);
 };
 rooms.builders.system = (c: Ctx) => {
  const R = c.root, B = '#4fc3ff', dark = c.mat('#101521');
  const tones = [c.mat('#5af58c', {emissive: '#2fbf63', emissiveIntensity: 1}), c.mat(B, {emissive: '#1d7fb5', emissiveIntensity: 1})];
  // Server racks with blinking LED rows, a terminal wall with scrolling lines, a cable run carrying packets and a status beacon.
  // Unlit LEDs are fixed; a lit LED is an overlay just larger than it, shown while it blinks. The first LED is the steady
  // status light of an idle rack, so it is one switching piece of its own.
  const leds: {mesh: LWThree.Mesh; seed: number}[] = [];
  let status: LWThree.Mesh | null = null;
  for (const [ri, x] of [-3.6, -2.3].entries()) {
   c.F(R, 'box', x, 1.35, -3.2, 1.1, 2.7, 1, '#1e2638');
   for (let r = 0; r < 8; r++) {
    const y = .35 + r * .31;
    c.F(R, 'box', x, y, -2.68, .96, .24, .04, '#2c3852'); c.F(R, 'box', x + .1, y, -2.655, .4, .03, .01, '#161d2c');
    for (const dx of [-.34, -.22]) {
     const seed = ri * 17 + r * 3 + (dx < -.3 ? 1 : 2);
     if (status) {
      c.F(R, 'box', x + dx, y, -2.65, .08, .07, .03, '#101521');
      leds.push({mesh: c.P(c.live, 'box', x + dx, y, -2.65, .084, .074, .034, '#101521'), seed});
     } else status = c.P(R, 'box', x + dx, y, -2.65, .08, .07, .03, '#101521');
    }
   }
  }
  const first = status!;
  c.F(R, 'box', 2.3, 2, -4.08, 3.9, 1.6, .02, '#0b111a');
  c.F(R, 'box', 2.3, 2, -4.17, 4.2, 1.9, .12, '#141a26');
  for (const x of [.7, 4.1]) c.F(R, 'box', x, .52, -4.2, .15, 1.05, .15, '#252f45');
  c.F(c.live, 'box', 2.3, 2, -4.06, 3.9, 1.6, .02, '#0f2d4a', {emissive: '#1c5f96', emissiveIntensity: .55});
  const widths = [2.4, 1.6, 3, 2, 2.7, 1.2, 2.2];
  const rows = widths.map((w, i) => c.P(c.live, 'box', .55 + w / 2, 2.4, -4.04, w, .07, .01, i % 3 ? '#7fd8ff' : '#9bf5c0'));
  c.F(c.live, 'box', 2.3, 1.38, -4.05, 3.4, .1, .01, '#1b2a3d');
  const bar = c.P(c.live, 'box', .6, 1.38, -4.04, .001, .1, .015, B, {emissive: '#1d7fb5', emissiveIntensity: 1});
  c.F(c.idle, 'box', 1.6, 2.4, -4.05, 1.2, .05, .01, '#2a3b55'); c.F(c.idle, 'box', 1.1, 2.1, -4.05, .1, .12, .01, '#2a3b55');
  c.F(R, 'box', 2, .75, -2.7, 3, .12, 1, '#2b3448');
  for (const x of [.6, 3.4]) c.F(R, 'box', x, .38, -2.7, .12, .75, .9, '#1e2638');
  c.F(R, 'box', 2, .84, -2.4, .9, .04, .3, '#3c4a68');
  const path: [number, number][] = [[-2.95, -2.55], [-2.95, -1.5], [1, -1.5], [1, -2.3]], lengths = [1.05, 3.95, .8], total = 5.8;
  c.F(R, 'box', -2.95, .05, -2.02, .09, .05, 1.07, '#1a2234'); c.F(R, 'box', -.975, .05, -1.5, 4, .05, .09, '#1a2234');
  c.F(R, 'box', 1, .05, -1.9, .09, .05, .82, '#1a2234');
  const packets = [0, 1, 2, 3, 4].map(() => c.glow(c.P(c.live, 'ball', 0, .14, 0, .09, .09, .09, '#a8e6ff'), '#a8e6ff', B, 1.4));
  c.F(R, 'cylinder', -2.95, 2.8, -3.2, .05, .22, .05, '#59616b');
  c.lamp(c.P(R, 'ball', -2.95, 3.02, -3.2, .2, .2, .2, '#1d2a40'), '#6fd6ff', B, (on, q) => on || q > 0, 1.4);
  c.swing((t, p) => {
   const k = c.on, lit = (seed: number) => k && Math.sin(t * 3 + seed * 1.9 + seed % 3 * .7) > .1;
   first.material = lit(1) ? tones[1]! : !k ? tones[0]! : dark;
   leds.forEach(l => {
    l.mesh.visible = lit(l.seed);
    l.mesh.material = tones[l.seed % 2]!;
   });
   rows.forEach((r, i) => {
    const u = (t * .4 + i / rows.length) % 1;
    r.position.y = 2.7 - u * 1.3; r.scale.y = .07 * Math.max(.02, Math.min(1, Math.min(u, 1 - u) * 6));
   });
   bar.scale.x = Math.max(.001, p * 3.4); bar.position.x = .6 + bar.scale.x / 2;
   packets.forEach((m, i) => {
    let d = (t * 1.2 + i * total / packets.length) % total, seg = 0;
    while (seg < 2 && d > lengths[seg]!) d -= lengths[seg++]!;
    const a = path[seg]!, b = path[seg + 1]!, u = d / lengths[seg]!;
    m.position.set(a[0] + (b[0] - a[0]) * u, .14, a[1] + (b[1] - a[1]) * u);
   });
  });
  for (const x of [-.7, 3.1]) c.F(R, 'cylinder', x, 2.3, -4.28, .04, 1.8, .04, '#59616b');
  c.sign(R, c.step.technology ?? 'System', 1.2, 3.6, -4.2, 4.4, .85);
 };
})(globalThis);
