/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-three.d.ts" />
/**
 * Room models for people's work (LWProcessRooms.builders, registered here): the six task themes (office, design studio, test
 * lab, workshop, review desk, records room) and the flow-kind rooms (reception, dispatch dock, decision room, backlog room,
 * waiting room, junction). Presentation only; loads after process-rooms.ts. Every prop that moves, toggles or re-colours is a
 * moving piece (`c.P`); everything else is fixed (`c.F`, `c.L`) so the renderer can merge it.
 */
(function(inputRoot: unknown) {
 'use strict';
 const rooms = (inputRoot as {LWProcessRooms: LWProcessRooms.Api}).LWProcessRooms;
 type Ctx = LWProcessRooms.Ctx;
 const wave = (t: number, speed: number, shift = 0) => Math.sin(t * speed + shift);
 const B = rooms.builders;
 B.office = (c: Ctx) => {
  const R = c.root;
  c.F(R, 'box', 0, 1.1, -.6, 3.4, .18, 1.4, '#8c725d');
  for (const x of [-1.4, 1.4]) c.F(R, 'box', x, .5, -.6, .16, 1, 1, '#536379');
  c.F(R, 'box', 0, 1.7, -.8, 1, .65, .1, '#1d2630');
  c.F(R, 'box', 0, 1.22, -.15, .9, .05, .3, '#2b3440');
  c.L(R, 'box', 0, 1.7, -.74, .86, .5, .02, '#10171d', '#86a6bb', '#326578', .5);
  const bars = [0, 1, 2].map(i => c.P(c.live, 'box', 0, 1.82 - i * .13, -.72, .5, .04, .01, '#e9f4f8'));
  const sheet = c.P(c.live, 'box', 0, 1.35, -.2, .5, .02, .38, '#f2efe6');
  c.swing(t => {
   bars.forEach((b, i) => {
    b.scale.x = .25 + .3 * Math.abs(wave(t, .7, i * 1.7));
    b.position.x = -.34 + b.scale.x / 2;
   });
   const u = (t * .25) % 1;
   sheet.position.set(-1.5 + 3 * u, 1.35 + Math.sin(u * Math.PI) * .6, -.2); sheet.rotation.z = wave(t, 3) * .2;
  });
  for (const [x, col] of [[-1.35, '#f0d56a'], [-1.15, '#e98d8d'], [1.3, '#8dd3a1']] as const) c.F(R, 'box', x, 1.22, -.9, .22, .02, .22, col);
  c.F(c.idle, 'box', 0, 1.45, .2, .8, .3, .06, '#d7b98e');
 };
 B.studio = c => {
  const R = c.root;
  c.F(R, 'box', 0, 1.2, -.9, 2.8, .12, 1.5, '#d8d2c2', {}, [-.35, 0, 0]);
  for (const x of [-1.1, 1.1]) c.F(R, 'box', x, .55, -.5, .1, 1.1, .1, '#6b5a4a');
  const pencil = c.P(c.live, 'cylinder', 0, 1.5, -.7, .03, .6, .03, '#e0a35c');
  const lines = [0, 1, 2, 3].map(i => c.P(c.live, 'box', -.6, 1.3 + i * .02, -1.2 + i * .25, 1, .015, .05, i % 2 ? '#7fb3e0' : '#b79ad6'));
  c.swing((t, p) => {
   pencil.position.x = wave(t, 2.4) * .8;
   pencil.position.z = -.7 + wave(t, 1.6) * .25;
   pencil.rotation.z = .5;
   lines.forEach((l, i) => {
    const k = Math.max(.05, Math.min(1, p * 1.4 - i * .18));
    l.scale.x = 1.6 * k;
    l.position.x = -1 + .8 * k;
   });
  });
  for (const [x, col] of [[-1.5, '#b79ad6'], [-1.3, '#7fb3e0'], [-1.1, '#e0a35c']] as const) {
   c.L(R, 'cylinder', x, 1.3, .35, .1, .12, .1, col, col, col, .4);
  }
  c.F(c.idle, 'box', 0, 1.35, -.9, 2.9, .06, 1.6, '#5f5a72'); c.F(c.idle, 'box', 1.5, .1, .8, .4, .2, .4, '#3b3a4c');
 };
 B.lab = c => {
  const R = c.root;
  c.F(R, 'box', 0, .8, -1.4, 4.2, .12, 1.3, '#cfd8dc'); c.F(R, 'box', 0, .4, -1.4, 4, .8, 1.1, '#3c5a5e');
  for (const x of [-1.4, -.4]) c.L(R, 'cone', x, 1.2, -1.4, .3, .7, .3, '#7fd0c4', '#7fd0c4', '#3fa093', .6);
  const bubbles = [0, 1, 2, 3].map(i => c.P(c.live, 'ball', -1.4 + (i % 2) * 1, 1.3, -1.4, .07, .07, .07, '#e3fffa'));
  c.F(R, 'cylinder', 1.4, 1.05, -1.4, .55, .12, .55, '#9aa9b0');
  const arm = c.P(c.live, 'box', 1.4, 1.15, -1.4, 1, .05, .12, '#e05c5c');
  c.swing(t => {
   bubbles.forEach((b, i) => {
    const u = (t * .5 + i * .27) % 1;
    b.position.y = 1.15 + u * .9;
    b.position.x = (i % 2 ? -.4 : -1.4) + wave(t, 5, i) * .08;
    b.scale.setScalar(.05 + .05 * (1 - u));
   });
   arm.rotation.y = t * 6;
  });
  c.F(c.idle, 'box', 0, 1.1, -1.4, 4.3, .55, 1.2, '#8794a0'); c.F(c.idle, 'box', 1.4, .1, .8, .4, .2, .4, '#2c4448');
 };
 B.workshop = c => {
  const R = c.root;
  c.F(R, 'box', 0, .75, -1.2, 3.6, .2, 1.6, '#7a6a56');
  for (const x of [-1.6, 1.6]) c.F(R, 'box', x, .35, -1.2, .2, .7, 1.4, '#4b4d52');
  const gear = c.G(R);
  gear.position.set(-.9, 1.5, -.3); c.F(gear, 'cylinder', 0, 0, 0, .45, .16, .45, '#8f98a3', {}, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) c.F(gear, 'box', 0, 0, 0, 1.2, .14, .2, '#aab3bd', {}, [0, 0, i * Math.PI / 4]);
  const hammer = c.P(c.live, 'box', 1, 1.5, -1.2, .12, .8, .12, '#6b5a4a');
  c.F(hammer, 'box', 0, .5, 0, 3, .45, 1.4, '#9aa5b0');
  const sparks = [0, 1, 2, 3, 4].map(() => c.glow(c.P(c.live, 'ball', 0, 1, -1.2, .05, .05, .05, '#ffd27a'), '#ffd27a', '#ffb347', 1.2));
  c.swing(t => {
   gear.rotation.z = t * 1.8; hammer.rotation.z = -.2 - Math.abs(wave(t, 4)) * .9;
   sparks.forEach((s, i) => {
    const u = (t * 1.3 + i * .21) % 1;
    s.position.set(.2 + u * (i % 2 ? .8 : -1.2), 1 + Math.sin(u * Math.PI) * .6, -1.2 + wave(i, 3) * .3); s.scale.setScalar(.05 * Math.max(.2, 1 - u));
   });
  });
  c.F(c.idle, 'box', 0, 1, -1.2, 3.8, .55, 1.8, '#6c6760'); c.F(c.idle, 'box', 1.6, 2, -4.2, 1.4, .5, .1, '#8a7f70');
 };
 B.review = c => {
  const R = c.root;
  c.F(R, 'box', 0, .8, -1, 3.8, .16, 1.5, '#8a9a7c');
  for (const x of [-1.7, 1.7]) c.F(R, 'box', x, .4, -1, .16, .8, 1.3, '#4c5e46');
  c.L(R, 'box', -.4, .9, -1, 1.3, .03, 1, '#e6f2d8', '#e6f2d8', '#a8cf86', .5);
  for (let i = 0; i < 4; i++) c.F(R, 'box', -1.4, .95 + i * .05, -1, .6, .04, .8, i % 2 ? '#f2efe6' : '#d9d3c0');
  const out = c.P(c.live, 'box', 1.4, 1, -1, .6, .04, .8, '#f2efe6'), stamp = c.P(c.live, 'cylinder', 0, 1.6, -1, .22, .5, .22, '#c75c5c');
  const tick = c.glow(c.P(c.live, 'box', .4, 1.0, -.7, .5, .02, .12, '#8fd68a'), '#8fd68a', '#4caf50', 1);
  c.swing((t, p) => {
   const u = (t * .35) % 1;
   out.position.set(-1.4 + 2.8 * u, 1.05 + Math.sin(u * Math.PI) * .4, -1); stamp.position.y = 1.35 + Math.abs(wave(t, 3)) * .6;
   tick.scale.x = Math.max(.1, p);
  });
  c.F(c.idle, 'box', 0, 1, -1, 3.9, .1, 1.6, '#707a68'); c.F(c.idle, 'cylinder', .2, 1, -.5, .22, .3, .22, '#c75c5c');
 };
 B.archive = c => {
  const R = c.root;
  for (const x of [-1.8, -.6, .6, 1.8]) c.F(R, 'box', x, 1, -3.3, 1, 2, .8, '#6f5a78');
  const drawers = [-1.8, -.6, .6, 1.8].map(x => c.P(R, 'box', x, 1.3, -2.8, .85, .35, .1, '#a78bb0'));
  const boxes = [0, 1, 2].map(i => c.P(c.live, 'box', 0, .6, -1.2, .6, .4, .6, i % 2 ? '#d69aa8' : '#c78a4a'));
  c.F(R, 'box', 0, .15, -1.2, 4, .15, .9, '#4a4252');
  c.swing(t => {
   boxes.forEach((b, i) => {const u = (t * .3 + i / 3) % 1; b.position.x = -1.8 + 3.6 * u;});
   drawers.forEach((d, i) => {d.position.z = -2.8 + Math.max(0, wave(t, 1.6, i * 1.9)) * .6;});
  });
  c.F(c.idle, 'box', 0, .4, -1.2, 3.8, .3, .8, '#5a4e62'); c.F(c.idle, 'box', 1.8, .8, -1.8, .8, 1.6, .5, '#7d8794');
 };
 B.reception = c => {
  const R = c.root;
  c.F(R, 'box', 0, .55, -1.3, 4, 1.1, 1, '#5a7a96'); c.F(R, 'box', 0, 1.12, -1.3, 4.2, .08, 1.2, '#cfd8e0');
  const mail = [0, 1, 2].map(() => c.P(c.live, 'box', 0, 1.3, -1.3, .35, .02, .25, '#f6f1e4'));
  const bell = c.glow(c.P(R, 'ball', 1.6, 1.3, -1.2, .15, .1, .15, '#e0c060'), '#e0c060', '#a0801c', .6);
  c.swing(t => {
   mail.forEach((m, i) => {
    const u = (t * .45 + i / 3) % 1;
    m.position.set(-3.5 + 3.8 * u, 1.3 + Math.sin(u * Math.PI) * .8, -1.3); m.rotation.z = u * 3;
   });
   bell.scale.setScalar(.15 * (1 + Math.max(0, wave(t, 5)) * .3));
  });
  c.F(c.idle, 'box', 0, 1.35, -1.3, .9, .25, .05, '#d6a05a');
 };
 B.dispatch = c => {
  const R = c.root;
  c.F(R, 'box', 0, .15, -1.3, 4.6, .25, 1.1, '#4e5864');
  const crates = [0, 1, 2].map(i => c.P(c.live, 'box', 0, .6, -1.3, .7, .6, .7, i % 2 ? '#8fc9a2' : '#d8b074'));
  const door = c.glow(c.P(R, 'box', 2.4, 1.1, -1.3, .12, 2, 1.6, '#8fc9a2'), '#8fc9a2', '#4c8f63', .6);
  c.swing(t => {
   crates.forEach((b, i) => {const u = (t * .3 + i / 3) % 1; b.position.x = -2.2 + 4.4 * u;});
   door.scale.y = .6 + Math.max(0, wave(t, 1.2)) * .4;
  });
  c.F(c.idle, 'box', 2.4, 1.1, -1.3, .14, 2, 1.6, '#6c7480'); c.F(c.idle, 'box', 0, .5, -1.3, .6, .5, .6, '#6b6558');
 };
 B.council = c => {
  const R = c.root;
  c.F(R, 'cylinder', 0, .8, -.8, 1.9, .14, 1.9, '#8a6f4b'); c.F(R, 'cylinder', 0, .4, -.8, .35, .8, .35, '#5a4a36');
  const lamps = [0, 1, 2, 3, 4].map(i => {
   const a = i / 5 * Math.PI * 2, x = Math.cos(a) * 2.6, z = -.8 + Math.sin(a) * 2.2;
   c.F(R, 'box', x, .45, z, .5, .3, .5, '#5a4a36');
   return c.glow(c.P(R, 'ball', x, .75, z, .1, .1, .1, '#e6c06e'), '#e6c06e', '#a0801c', 1);
  });
  const ring = c.P(c.live, 'ring', 0, 1.7, -.8, 1.1, 1.1, 1.1, '#e6c06e');
  c.swing(t => {
   ring.rotation.set(Math.PI / 2 + wave(t, 1.1) * .35, t * 1.4, 0); ring.position.y = 1.7 + wave(t, 2) * .1;
   lamps.forEach((l, i) => l.scale.setScalar(.1 * (.7 + Math.max(0, wave(t, 2.5, i * 1.3)) * .9)));
  });
  c.F(c.idle, 'box', 0, 1, -.8, 2.1, .1, 2.1, '#6b6358');
 };
 B.backlog = c => {
  c.F(c.root, 'box', 3.2, .3, -1.4, 3, .3, 1, '#4a5578'); c.F(c.root, 'box', 1.5, .65, -1.4, .2, .7, 1.2, '#9db4ff');
  const card = c.P(c.live, 'box', 0, .6, -1.4, .5, .08, .36, '#e7edff');
  c.swing(t => {
   const u = (t * .3) % 1;
   card.position.x = 1.7 + u * 3;
   card.position.y = .6 + Math.sin(u * Math.PI) * .12;
  });
  c.F(c.idle, 'box', 3.2, .55, -1.4, 3.1, .45, 1.1, '#5b6585');
 };
 B.clock = c => {
  const R = c.root;
  c.F(R, 'box', 0, 1.8, -3.9, 2.4, 2.4, .14, '#4a516b'); c.F(R, 'cylinder', 0, 1.8, -3.78, 1, .08, 1, '#efe8d2', {}, [Math.PI / 2, 0, 0]);
  const hand = c.P(c.live, 'box', 0, 2.2, -3.7, .08, .8, .05, '#3a3f52');
  const sand = c.glow(c.P(R, 'cone', 2.2, .9, -1.6, .5, .9, .5, '#d9c58a'), '#d9c58a', '#a38f45', .7);
  c.F(R, 'box', 2.2, .3, -1.6, 1, .1, 1, '#6b5f42'); c.F(R, 'box', 2.2, 1.55, -1.6, 1, .1, 1, '#6b5f42');
  c.swing(t => {
   hand.rotation.z = -t * .6; hand.position.set(Math.sin(t * .6) * .4, 1.8 + Math.cos(t * .6) * .4, -3.7);
   sand.scale.y = .6 + Math.abs(wave(t, .8)) * .4;
  });
  c.F(c.idle, 'box', 0, 1.8, -3.7, .9, .9, .05, '#7b829c');
 };
 B.junction = c => {
  c.F(c.root, 'cylinder', 0, .35, -.8, .9, .7, .9, '#4b6070');
  for (const a of [0, 1, 2, 3]) {
   const x = Math.cos(a * Math.PI / 2) * 1.6, z = -.8 + Math.sin(a * Math.PI / 2) * 1.6;
   c.F(c.root, 'box', x, .25, z, a % 2 ? .4 : 2.2, .2, a % 2 ? 2.2 : .4, '#3b4d5b');
  }
  const ring = c.glow(c.P(c.live, 'ring', 0, .9, -.8, 1, 1, 1, '#c79871'), '#c79871', '#9a6a3c', .9);
  const pulses = [0, 1, 2, 3].map(() => c.glow(c.P(c.live, 'ball', 0, .45, -.8, .12, .12, .12, '#f0c89a'), '#f0c89a', '#d49a62', 1));
  c.swing(t => {
   ring.rotation.set(Math.PI / 2 + wave(t, 1.7) * .3, t * 2, 0);
   pulses.forEach((p, i) => {
    const u = (t * .5 + i * .25) % 1, a = i * Math.PI / 2;
    p.position.set(Math.cos(a) * 2.6 * u, .45, -.8 + Math.sin(a) * 2.6 * u);
   });
  });
  c.F(c.idle, 'cylinder', 0, .8, -.8, .95, .1, .95, '#5f6a74');
 };
})(globalThis);
