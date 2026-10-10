/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-three.d.ts" />
/**
 * Touchpoint rooms (LWProcessRooms.builders, registered here): one themed model per channel plus a generic kiosk, each with a kind
 * plate. Presentation only; loads after process-rooms.ts and process-rooms-channels.ts (the channel table and mood faces). Every
 * prop that moves, toggles or re-colours is a moving piece (`c.P`); everything else is fixed (`c.F`, `c.L`) so it can be merged.
 */
(function(inputRoot: unknown) {
 'use strict';
 const rooms = (inputRoot as {LWProcessRooms: LWProcessRooms.Api}).LWProcessRooms;
 type Ctx = LWProcessRooms.Ctx;
 type O3 = LWThree.Object3D;
 const clamp = (x: number) => Math.max(0, Math.min(1, x)), ease = (x: number) => {const u = clamp(x); return u * u * (3 - 2 * u);};
 const loop = (t: number, speed: number, shift = 0) => ((t * speed + shift) % 1 + 1) % 1;
 const fade = (u: number) => Math.max(.02, Math.min(1, Math.min(u, 1 - u) * 6));
 const label = (c: Ctx) => (c.step.channel && rooms.channels[c.step.channel]?.theme.label) || 'Touchpoint';
 /** Kind plate on two low posts at the front-right of the room, clear of the name pill and the props: `Touchpoint · <channel>`. */
 function plate(c: Ctx): void {
  for (const x of [1.7, 4.7]) c.F(c.root, 'cylinder', x, .4, 3, .05, .8, .05, '#59616b');
  c.sign(c.root, label(c), 3.2, 1.1, 3, 3.8, .75);
 }
 /** Run `fn` while the room works; otherwise `rest` (if any) parks the props. */
 const anim = (c: Ctx, fn: (t: number, p: number) => void, rest?: () => void) => c.swing((t, p) => {if (c.on) fn(t, p); else rest?.();});
 /** Desk with a keyboard, shared by the screen based channels. */
 function desk(c: Ctx, z: number, w = 3.4): void {
  const R = c.root;
  c.F(R, 'box', 0, .85, z, w, .12, 1.2, '#8c725d');
  for (const s of [-1, 1]) c.F(R, 'box', s * (w / 2 - .15), .42, z, .12, .84, 1, '#536379');
  c.F(R, 'box', 0, .93, z + .25, 1.4, .05, .4, '#2b3440'); c.F(R, 'ball', 1.2, .95, z + .25, .1, .05, .13, '#2b3440');
 }
 /** A framed wall screen that lights while the room works. */
 function screen(c: Ctx, x: number, y: number, w: number, h: number, dark: string, lit: string, emissive: string, strength: number): void {
  c.F(c.root, 'box', x, y, -3.95, w, h, .16, '#0d131b');
  c.L(c.root, 'box', x, y, -3.85, w - .3, h - .25, .04, dark, lit, emissive, strength);
 }
 const B = rooms.builders;
 B.web = c => {
  const R = c.root;
  screen(c, 0, 2, 6.4, 2.8, '#222c38', '#e8eef6', '#4a5a70', .3);
  c.F(R, 'box', 0, 3.15, -3.82, 6.1, .22, .03, '#3a4a60');
  for (const x of [-2.3, -.9]) c.F(R, 'box', x, 3.15, -3.8, 1.2, .14, .03, '#c9d6e6');
  c.F(R, 'box', .4, 2.9, -3.82, 5, .18, .03, '#9fb0c4'); c.F(R, 'box', -2.9, 2.9, -3.8, .16, .1, .03, '#7fb3e0');
  const spec: [number, number, number, string][] = [
   [5.4, .6, 0, '#7fb3e0'], [3.2, .12, -1, '#9fb0c4'], [2.4, .12, -1.4, '#b9c8da'], [1.4, .5, -2, '#ffbb73'], [1.4, .5, 0, '#8fd68a'],
   [1.4, .5, 2, '#d69aa8']];
  const blocks = spec.map(([w, , x, col]) => c.P(c.live, 'box', x, 1.8, -3.8, w, .1, .03, col));
  const cursor = c.P(c.live, 'cone', 0, 1.8, -3.74, .1, .24, .1, '#10161f'), click = c.P(c.live, 'ring', 0, 1.8, -3.74, .2, .2, .2, '#ff8f5a');
  c.F(c.idle, 'ring', 0, 1.8, -3.8, .35, .35, .35, '#7b8794'); c.F(c.idle, 'box', 0, 1.2, -3.8, 1.6, .08, .03, '#59616b');
  anim(c, t => {
   blocks.forEach((b, i) => {
    const u = loop(t, .12, i / spec.length);
    b.position.y = 2.75 - u * 1.9;
    b.scale.y = spec[i]![1] * fade(u);
   });
   cursor.position.set(2.2 * Math.sin(t * .9), 1.75 + .55 * Math.sin(t * 1.3 + 1), -3.74); cursor.rotation.z = .6;
   const k = loop(t, .6);
   click.position.copy(cursor.position); click.scale.setScalar(k < .5 ? .05 + k * .5 : .001);
  });
  desk(c, -1.7);
  c.F(R, 'box', 0, .55, 0, 1, .1, 1, '#3a4452'); c.F(R, 'box', 0, 1.05, .5, 1, .9, .08, '#3a4452');
  c.F(R, 'cylinder', 0, .27, 0, .08, .55, .08, '#59616b');
  plate(c);
 };
 B.mobile = c => {
  const R = c.root;
  c.F(R, 'cylinder', 0, .12, -2.2, 1.3, .24, 1.1, '#2e3a40'); c.F(R, 'cylinder', 0, .47, -2.3, .2, .46, .2, '#4a5a62');
  c.F(R, 'box', 0, 2.45, -2.2, 2.2, 3.5, .22, '#10161c');
  c.L(R, 'box', 0, 2.45, -2.07, 1.9, 3.1, .03, '#171e27', '#e6eef9', '#5d6f88', .35);
  c.F(R, 'box', 0, 3.98, -2.04, .5, .06, .02, '#10161c'); c.F(R, 'box', 0, .95, -2.04, .6, .05, .02, '#59616b');
  const colours = ['#ffb347', '#7fb3e0', '#8fd68a', '#e58ac8', '#a79bf0', '#ff8f5a', '#6fc7e8', '#d9c58a', '#7fd0c4'];
  const tiles = colours.map((col, i) => c.P(c.live, 'box', (i % 3 - 1) * .62, 3.35 - Math.floor(i / 3) * .62, -2.04, .5, .5, .03, col));
  const banner = c.P(c.live, 'box', 0, 3.7, -2.0, 1.7, .4, .04, '#10161f');
  const badge = c.glow(c.P(c.live, 'ball', .3, 3.6, -2.0, .1, .1, .1, '#e05c5c'), '#ff6b6b', '#c43c3c', 1.2);
  const ripple = c.P(c.live, 'ring', 0, 3.35, -2.0, .1, .1, .1, '#5a4cc0');
  const dots = [-1, 1].map(s => c.glow(c.P(c.live, 'ball', s * 1.7, 3, -2, .09, .09, .09, '#ffd27a'), '#ffd27a', '#ffb347', 1.2));
  c.F(c.idle, 'box', 0, 3.2, -2.04, 1.2, .35, .03, '#2c3744'); c.F(c.idle, 'ball', 0, 2.3, -2.04, .22, .22, .22, '#59616b');
  c.F(c.idle, 'box', 0, 2.05, -2.04, .3, .2, .03, '#59616b');
  anim(c, t => {
   const u = loop(t, .25), s = Math.max(.01, Math.min(1, u / .12, (1 - u) / .12));
   banner.position.y = 3.95 - .45 * s;
   banner.scale.set(1.7 * s, .4 * s, banner.scale.z);
   const k = loop(t, .8), i = Math.floor(t * .8) % 9;
   ripple.position.set((i % 3 - 1) * .62, 3.35 - Math.floor(i / 3) * .62, -2); ripple.scale.setScalar(.06 + .42 * k);
   tiles.forEach((m, j) => {const side = .5 * (j === i ? .85 : 1); m.scale.set(side, side, .03);});
   badge.scale.setScalar(.1 * (1 + .4 * Math.max(0, Math.sin(t * 5))));
   dots.forEach((d, j) => {
    d.position.y = 3 + .5 * Math.sin(t * 2 + j * 2);
    d.position.x = (j ? 1 : -1) * (1.7 + .15 * Math.sin(t * 3 + j));
   });
  });
  plate(c);
 };
 B.store = c => {
  const R = c.root, cols = ['#e05c5c', '#7fb3e0', '#ffbb73', '#8fd68a', '#e58ac8', '#d9c58a'];
  for (const x of [-3.3, -.9]) {
   c.F(R, 'box', x, 1.5, -3.9, 2.2, 2.4, .12, '#6a5846'); c.F(R, 'box', x, 2.8, -3.8, 2.3, .16, .4, '#e05c5c');
   for (const [bi, y] of [.75, 1.45, 2.15].entries()) {
    c.F(R, 'box', x, y, -3.6, 2.2, .08, .6, '#8a6f4b');
    if (bi) for (let k = 0; k < 3; k++) c.F(R, 'box', x - .7 + k * .7, y + .2, -3.6, .45, .32, .4, cols[(k + bi * 2 + (x > -2 ? 1 : 0)) % 6]!);
   }
  }
  c.F(R, 'box', 3.1, .5, -2.8, 2.6, 1, 1, '#5a4a3b'); c.F(R, 'box', 3.1, 1.06, -2.8, 2.8, .1, 1.2, '#cfd8e0');
  c.F(R, 'box', 3.7, 1.35, -2.9, .7, .45, .5, '#2b3440'); c.F(R, 'box', 3.7, 1.5, -2.62, .5, .25, .03, '#7fb3e0');
  c.lamp(c.P(R, 'ball', 2.5, 1.2, -2.5, .09, .09, .09, '#3a3f48'), '#8fd68a', '#4caf50', on => on, 1.2);
  c.F(R, 'box', 2.2, 1.25, -2.9, .4, .4, .4, '#d8b074');
  const shopper = c.G(c.live);
  c.F(shopper, 'cylinder', 0, .75, 0, .28, 1.2, .24, '#52677b'); c.F(shopper, 'ball', 0, 1.55, 0, .22, .25, .22, '#d5ac88');
  c.F(shopper, 'cylinder', 0, 1.8, 0, .27, .08, .27, '#37404b');
  const basket = c.G(shopper);
  basket.position.set(.55, .5, .1); c.F(basket, 'box', 0, 0, 0, .7, .06, .5, '#c0392b');
  for (const z of [-.25, .25]) c.F(basket, 'box', 0, .15, z, .7, .26, .04, '#d9503f');
  for (const x of [-.35, .35]) c.F(basket, 'box', x, .15, 0, .04, .26, .5, '#d9503f');
  c.F(basket, 'box', 0, .38, 0, .6, .04, .04, '#8a8f98');
  const items = cols.slice(0, 3).map((col, i) => c.P(basket, 'box', -.2 + i * .2, .2, 0, .17, .24, .2, col));
  c.F(c.idle, 'box', -3, .16, 0, .7, .06, .5, '#c0392b'); c.F(c.idle, 'box', -3, .3, .24, .7, .26, .04, '#d9503f');
  anim(c, t => {
   const u = loop(t, .1), go = u < .5, k = go ? u * 2 : 2 - u * 2;
   shopper.position.set(-3.4 + 5.2 * ease(k), 0, -1.2 + .2 * Math.sin(t * 3)); shopper.rotation.y = go ? .3 : -.3 + Math.PI;
   items.forEach(m => {m.visible = go || k > .8;});
   shopper.position.y = Math.abs(Math.sin(t * 6)) * .05;
  });
  plate(c);
 };
 B.phone = c => {
  const R = c.root;
  c.F(R, 'box', .5, .95, -2.4, 4.4, .14, 1.8, '#8c725d');
  for (const x of [-1.4, 2.4]) c.F(R, 'box', x, .47, -2.4, .14, .94, 1.6, '#536379');
  c.F(R, 'box', -.9, 1.17, -2.2, 1.3, .3, .9, '#2b3440');
  for (let k = 0; k < 6; k++) c.F(R, 'box', -1.25 + (k % 3) * .25, 1.34, -2.05 + Math.floor(k / 3) * .22, .14, .04, .14, '#9fb0c4');
  for (const x of [-1.4, -.4]) c.F(R, 'box', x, 1.45, -2.55, .12, .3, .12, '#59616b');
  c.F(c.idle, 'box', -.9, 1.58, -2.55, 1.5, .16, .28, '#1d2630');
  const lift = c.P(c.live, 'box', -.9, 2.3, -1.8, 1.5, .16, .28, '#1d2630');
  const waves = [0, 1, 2].map(() => c.glow(c.P(c.live, 'ring', -.9, 2.3, -1.6, .5, .5, .5, '#7fd0c4'), '#7fd0c4', '#3fa093', 1));
  c.F(R, 'box', 2.3, 1.95, -3.4, 1.9, 1.3, .1, '#10161f'); c.F(R, 'cylinder', 2.3, 1.2, -3.4, .1, .5, .1, '#59616b');
  c.L(R, 'box', 2.3, 1.95, -3.34, 1.7, 1.1, .02, '#10171d', '#1b4d5e', '#2a8aa6', .6);
  const bars = [0, 1, 2, 3, 4].map(i => c.P(c.live, 'box', 1.75 + i * .27, 1.5, -3.3, .16, .1, .02, '#7fd0c4'));
  for (const i of [0, 1, 2]) c.F(c.idle, 'box', 1.75 + i * .5, 1.5, -3.3, .3, .05, .02, '#2a3b55');
  c.F(R, 'cylinder', 1.1, 1.5, -2.7, .04, 1, .04, '#59616b'); c.F(R, 'cylinder', 1.1, 1.03, -2.7, .3, .04, .3, '#2b3440');
  c.F(R, 'ring', 1.1, 2.15, -2.7, .45, .45, .45, '#2b3440');
  for (const s of [-1, 1]) c.F(R, 'cylinder', 1.1 + s * .45, 2.1, -2.7, .16, .14, .16, '#e0e6ec', {}, [0, 0, Math.PI / 2]);
  c.F(R, 'box', 1.55, 1.85, -2.5, .5, .03, .03, '#2b3440', {}, [0, 0, .4]);
  c.lamp(c.P(R, 'ball', -1.9, 1.1, -2.6, .1, .1, .1, '#401d1d'), '#ff6b6b', '#c43c3c', on => on, 1.2);
  anim(c, t => {
   lift.position.y = 2.3 + .08 * Math.sin(t * 3); lift.rotation.set(0, .3, -.6 + .08 * Math.sin(t * 2));
   waves.forEach((w, i) => {
    const u = loop(t, .5, i / 3);
    w.scale.setScalar(.3 + u * 1.4);
    w.visible = u < .92;
   });
   bars.forEach((b, i) => {
    b.scale.y = .1 + .8 * Math.abs(Math.sin(t * 3 + i * 1.3));
    b.position.y = 1.45 + b.scale.y / 2;
   });
  });
  plate(c);
 };
 B.chat = c => {
  const R = c.root, W: [number, boolean][] = [[1.8, true], [2.2, false], [1.4, true], [2.4, false], [1.6, true]];
  const rowY = (i: number) => 2.65 - i * .36;
  screen(c, 0, 2, 5.6, 2.8, '#222c38', '#e6edf6', '#52627a', .3);
  c.F(R, 'box', 0, 3.1, -3.82, 5.3, .34, .03, '#3b5566'); c.F(R, 'ball', -2.4, 3.1, -3.8, .13, .13, .03, '#6fc7e8');
  c.F(R, 'box', -1.3, 3.1, -3.8, 1.5, .09, .03, '#c9d6e6'); c.F(R, 'box', -.3, .85, -3.82, 4.4, .28, .03, '#aab8ca');
  c.L(R, 'ball', 2.2, .85, -3.8, .15, .15, .03, '#59616b', '#6fc7e8', '#2f8fb0', 1);
  const place = (parent: O3, i: number) => {
   const [w, mine] = W[i]!, x = mine ? 2.45 - w / 2 : -2.45 + w / 2, g = c.G(parent);
   g.position.set(x, rowY(i), -3.8);
   c.F(g, 'box', 0, 0, 0, w, .27, .05, mine ? '#7fb3e0' : '#aab8ca'); c.F(g, 'box', 0, 0, .04, w * .7, .06, .02, mine ? '#1d3b52' : '#3b4656');
   return g;
  };
  const bubbles = W.map((_, i) => place(c.live, i));
  place(c.idle, 0); place(c.idle, 1);
  const dots = [0, 1, 2].map(() => c.P(c.live, 'ball', 0, 0, -3.78, .07, .07, .07, '#3b4656'));
  anim(c, t => {
   const n = (t * .9) % (W.length + 1.5), shown = Math.floor(n);
   bubbles.forEach((b, i) => {
    b.visible = i < shown;
    b.scale.setScalar(i === shown - 1 ? .7 + .3 * ease((n - shown) * 4) : 1);
   });
   dots.forEach((d, i) => {
    d.visible = shown < W.length;
    const mine = shown % 2 === 0, x = mine ? 2.2 : -2.2;
    d.position.set(x + (i - 1) * .22, rowY(Math.min(shown, W.length - 1)) + .1 * Math.max(0, Math.sin(t * 8 - i)), -3.78);
   });
  });
  desk(c, -1.4); plate(c);
 };
 B.email = c => {
  const R = c.root;
  screen(c, -1.6, 2, 4.4, 2.8, '#222c38', '#e8eef6', '#4a5a70', .3);
  c.F(R, 'box', -1.6, 3.1, -3.82, 4.1, .3, .03, '#4a5170');
  const rows = [0, 1, 2, 3, 4, 5].map(i => {
   const g = c.G(c.live);
   c.F(g, 'box', 0, 0, 0, 3.8, .36, .03, i % 2 ? '#c9d6e6' : '#d9e2ee'); c.F(g, 'box', -1.8, 0, .02, .08, .36, .03, '#9db4ff');
   c.F(g, 'box', -.4, .05, .02, 2, .07, .02, '#59616b');
   return g;
  });
  for (const i of [1, 2, 3]) c.F(c.idle, 'box', -1.6, 2.8 - i * .46, -3.8, 3.8, .36, .03, '#aab8ca');
  c.F(R, 'box', 3.2, .9, -2.9, 2, 1.8, 1.4, '#3b4262'); c.F(R, 'box', 3.2, 1.81, -2.6, 1.4, .05, .12, '#0d131b');
  c.lamp(c.P(R, 'ball', 4, 1.6, -2.15, .14, .14, .14, '#401d1d'), '#ff6b6b', '#c43c3c', on => on, 1.2);
  const mail = [0, 1, 2, 3].map(() => {
   const g = c.G(c.live);
   c.F(g, 'box', 0, 0, 0, .9, .05, .6, '#f6f1e4');
   for (const s of [-1, 1]) c.F(g, 'box', s * .2, .04, -.1, .55, .02, .05, '#9db4ff', {}, [0, s * .8, 0]);
   return g;
  });
  for (const [x, z] of [[1.3, -1.3], [1.7, -1.1]] as const) {
   c.F(c.idle, 'box', x, .07, z, .9, .05, .6, '#f6f1e4'); c.F(c.idle, 'box', x, .11, z - .1, .5, .02, .05, '#9db4ff');
  }
  anim(c, t => {
   const k = loop(t, .5);
   rows.forEach((g, i) => {
    g.position.set(-1.6, 2.8 - (i + k) * .46, -3.8); g.scale.y = i === 0 ? Math.max(.02, k) : i === 5 ? Math.max(.02, 1 - k) : 1;
   });
   mail.forEach((g, i) => {
    const u = loop(t, .22, i / 4);
    g.position.set(-4 + 7.2 * u, 3.2 - 1.3 * u + Math.sin(u * Math.PI) * 1.2, -1.2 - 1.4 * u); g.rotation.y = (1 - u) * 1.5;
    g.scale.setScalar(u > .85 ? Math.max(.2, 1 - (u - .85) * 5) : 1);
   });
  });
  plate(c);
 };
 B.social = c => {
  const R = c.root;
  c.F(R, 'cylinder', 0, .3, -4, .15, .6, .15, '#59616b');
  c.F(R, 'box', 0, 2.1, -3.95, 3.6, 3.1, .16, '#0d131b'); c.L(R, 'box', 0, 2.1, -3.85, 3.3, 2.85, .04, '#1b1722', '#3a2d48', '#6b4a85', .4);
  c.F(R, 'box', 0, 3.4, -3.82, 3.3, .28, .03, '#e58ac8');
  for (const x of [-1.3, 1.3]) c.F(R, 'ball', x, 3.4, -3.8, .1, .1, .03, '#f6e3f0');
  for (const x of [-1.2, -.4, .4, 1.2]) c.F(R, 'ball', x, .85, -3.8, .08, .08, .03, '#b79ad6');
  const card = (parent: O3) => {
   const g = c.G(parent);
   c.F(g, 'box', 0, 0, 0, 2.9, 1.05, .04, '#f2f4f8'); c.F(g, 'ball', -1.15, .33, .03, .13, .13, .03, '#e58ac8');
   c.F(g, 'box', -.3, .33, .03, 1.3, .07, .02, '#59616b'); c.F(g, 'box', 0, -.05, .03, 2.6, .42, .02, '#a79bf0');
   c.F(g, 'box', -.4, -.38, .03, 1.5, .06, .02, '#9fb0c4'); c.F(g, 'ball', 1.15, -.38, .03, .09, .09, .03, '#e05c5c');
   return g;
  };
  const cards = [0, 1, 2, 3].map(() => card(c.live));
  card(c.idle).position.set(0, 2.2, -3.8);
  const hearts = [0, 1, 2, 3, 4].map(() => c.glow(c.P(c.live, 'ball', 2, 1, -3.4, .12, .12, .12, '#ff6b81'), '#ff6b81', '#c43c5a', 1.2));
  anim(c, t => {
   cards.forEach((g, i) => {
    const u = loop(t, .1, i / 4);
    g.position.set(0, 3.1 - u * 2.35, -3.8);
    g.scale.y = fade(u);
   });
   hearts.forEach((h, i) => {
    const u = loop(t, .3, i / 5);
    h.position.set(2.2 + .25 * Math.sin(t * 3 + i * 2), .9 + u * 2.6, -3.4); h.scale.setScalar(.12 * Math.max(.2, 1 - u));
   });
  });
  cards.forEach((g, i) => g.position.set(0, 3.1 - i * .6, -3.8));
  plate(c);
 };
 B.ads = c => {
  const R = c.root, ADS = [['#ff8f5a', '#fff1df'], ['#4fc3ff', '#0f4b6e'], ['#8fd68a', '#1f5a2c']] as const;
  const band = (k: number, j: number) => ADS[k % 3]![j >= 2 && j <= 5 ? 1 : 0]!;
  c.F(R, 'box', 0, 2.1, -3.9, 6.4, 2.8, .2, '#222a33');
  for (const x of [-2.6, 2.6]) c.F(R, 'cylinder', x, .5, -4, .12, 1, .12, '#59616b');
  c.F(R, 'box', 0, 3.75, -3.3, 6, .06, .06, '#59616b');
  for (const x of [-2.4, -.8, .8, 2.4]) {
   c.lamp(c.P(R, 'cone', x, 3.58, -3.3, .15, .3, .15, '#2b3440'), '#fff1df', '#ffd9a0', on => on, 1.6).rotation.x = Math.PI;
  }
  const slats = Array.from({length: 8}, (_, j) => {
   const g = c.G(R);
   g.position.set(-2.52 + j * .72, 2.1, -3.76);
   return {g, front: c.P(g, 'box', 0, 0, .03, .7, 2.4, .05, band(0, j)), back: c.P(g, 'box', 0, 0, -.03, .7, 2.4, .05, band(1, j))};
  });
  let shown = -1;
  const paint = (k: number) => {
   if (shown === k) return;
   shown = k;
   slats.forEach((s, j) => {
    s.front.material = c.mat(band(k, j));
    s.back.material = c.mat(band(k + 1, j));
   });
  };
  for (const x of [-4, 4]) c.F(R, 'cylinder', x, .25, -1.5, .14, .5, .14, '#59616b');
  const glint = c.P(c.live, 'box', 0, 2.1, -3.68, .35, 2.4, .03, '#ffffff', {transparent: true, opacity: .3, depthWrite: false});
  paint(0);
  anim(c, t => {
   const p = t * .3, k = Math.floor(p), f = p - k;
   paint(k);
   slats.forEach((s, j) => {s.g.rotation.y = ease((f - .5 - j * .035) / .25) * Math.PI;});
   glint.position.x = -2.9 + 5.8 * loop(t, .4);
  }, () => {
   paint(0);
   slats.forEach(s => {s.g.rotation.y = 0;});
  });
  plate(c);
 };
 B.delivery = c => {
  const R = c.root;
  c.F(R, 'box', -1.4, .55, -2.3, 6.8, .24, 1.3, '#2d3239'); c.F(R, 'box', -1.4, .7, -2.3, 6.6, .05, 1.05, '#1a1d21');
  for (const z of [-2.98, -1.62]) c.F(R, 'box', -1.4, .78, z, 6.8, .1, .08, '#5d6670');
  for (const x of [-4.4, -1.4, 1.4]) c.F(R, 'box', x, .25, -2.3, .14, .5, 1.1, '#454c55');
  const stripes = Array.from({length: 9}, (_, i) => c.P(c.live, 'box', -4.6 + i * .8, .74, -2.3, .06, .015, 1, '#3a424b'));
  c.F(R, 'box', 3.5, 1.4, -2.3, 2.8, 1.9, 1.9, '#e9eef2'); c.F(R, 'box', 2.1, 1.35, -2.3, .06, 1.5, 1.6, '#10161f');
  c.F(R, 'box', 4.5, 1, -2.3, .9, 1.1, 1.7, '#c75c5c'); c.L(R, 'box', 4.97, 1.25, -2.3, .04, .5, 1.2, '#10161f', '#9fd0e8', '#4f8fb0', .6);
  c.F(R, 'box', 3.5, 1.9, -1.34, 2.6, .1, .03, '#8fd68a');
  const wheels = [[2.8, -1.3], [4.3, -1.3], [2.8, -3.3], [4.3, -3.3]].map(([x, z]) => {
   const g = c.G(R);
   g.position.set(x!, .42, z!);
   c.F(g, 'cylinder', 0, 0, 0, .42, .24, .42, '#22262c', {}, [0, 0, Math.PI / 2]); c.F(g, 'box', .13, 0, 0, .02, .5, .08, '#aab3bd');
   return g;
  });
  const parcel = (parent: O3, w: number) => {
   const g = c.G(parent);
   c.F(g, 'box', 0, .3, 0, w, .6, .7, '#c99a5a'); c.F(g, 'box', 0, .3, 0, .1, .62, .72, '#f2ead6');
   return g;
  };
  const parcels = [0, 1, 2, 3].map(i => parcel(c.live, .7 + (i % 2) * .15));
  [-3.9, -2.5, -1.1].forEach((x, i) => parcel(c.idle, .8).position.set(x, .72, -2.3 + (i % 2) * .1));
  for (const [x, y] of [[-4.2, .3], [-4.2, .9], [-3.4, .3]] as const) c.F(R, 'box', x, y, -.6, .7, .55, .65, '#d8b074');
  c.lamp(c.P(R, 'ball', 2.1, 2.5, -1.4, .12, .12, .12, '#193b25'), '#5af58c', '#2fbf63', on => on, 1.2);
  anim(c, t => {
   stripes.forEach((b, i) => {b.position.x = -4.6 + (i + (t * .8) % 1) % 9 * .8;});
   parcels.forEach((g, i) => {
    const u = loop(t, .12, i / 4);
    g.position.set(-4.5 + 6.6 * u, .73, -2.3); g.scale.setScalar(u > .9 ? Math.max(.05, 1 - (u - .9) * 9) : 1);
   });
   wheels.forEach(w => {w.rotation.x = t * 4;});
  }, () => wheels.forEach(w => {w.rotation.x = 0;}));
  plate(c);
 };
 B.document = c => {
  const R = c.root;
  c.F(R, 'box', -2, .9, -2.6, 3.6, .14, 1.6, '#8c725d');
  for (const x of [-3.7, -.3]) c.F(R, 'box', x, .45, -2.6, .12, .9, 1.4, '#536379');
  const sheet = (parent: O3, w: number, col: string) => {
   const g = c.G(parent);
   c.F(g, 'box', 0, 0, 0, w, .03, w * .75, col);
   for (const z of [-.2, 0, .2]) c.F(g, 'box', 0, .02, z * w, w * .6, .01, .04, '#9fb0c4');
   return g;
  };
  for (let i = 0; i < 6; i++) {
   c.F(R, 'box', -2.9 + (i % 2) * .05, 1.0 + i * .045, -2.7, 1, .04, .75, i % 2 ? '#f2efe6' : '#e8dfc4', {}, [0, (i - 3) * .04, 0]);
  }
  sheet(R, 1, '#f2efe6').position.set(-1.4, .99, -2.9);
  c.F(R, 'box', -1.0, 1.0, -2.2, .8, .05, 1, '#6b5a4a'); c.F(R, 'ball', -1.0, 1.05, -1.7, .08, .05, .06, '#aab3bd');
  c.F(R, 'cylinder', -.4, 1.0, -2.6, .3, .06, .3, '#2b3440');
  const stamp = c.P(c.live, 'cylinder', -.4, 1.4, -2.6, .15, .5, .15, '#c75c5c');
  c.F(c.live, 'box', -.4, 1.04, -2.6, .55, .02, .55, '#8a3b3b');
  c.F(R, 'box', 2.6, .9, -2.9, 2.6, .1, 1.7, '#8c725d');
  for (const x of [1.5, 3.7]) c.F(R, 'box', x, .45, -2.9, .1, .9, 1.5, '#536379');
  c.F(R, 'box', 2.6, 1.35, -3.1, 2, .8, 1.2, '#d5dae0'); c.F(R, 'box', 2.6, 1.8, -3.1, 2, .06, 1.2, '#b9c0c8');
  c.F(R, 'box', 2.6, 2.1, -3.55, 1.3, .04, .7, '#f2efe6', {}, [-.5, 0, 0]); c.F(R, 'box', 2.6, 1.28, -2.48, 1.6, .08, .04, '#10161f');
  c.F(R, 'box', 2.6, 1.0, -2.0, 1.6, .04, .7, '#aab3bd');
  c.lamp(c.P(R, 'ball', 3.4, 1.7, -2.5, .08, .08, .08, '#193b25'), '#5af58c', '#2fbf63', on => on, 1.2);
  const out = sheet(c.live, 1.1, '#fffdf5'), flying = sheet(c.live, .9, '#e8dfc4');
  sheet(c.idle, 1.1, '#fffdf5').position.set(2.6, 1.05, -2.0);
  anim(c, t => {
   const u = loop(t, .3);
   out.position.set(2.6, 1.3 - .25 * ease(u * 2), -2.45 + 0.75 * ease(u * 1.4)); out.visible = u < .75;
   const w = loop(t, .2);
   flying.position.set(2.2 - 4.8 * w, 1.1 + Math.sin(w * Math.PI) * 1.4, -2.4 - .3 * w); flying.rotation.set(0, w * 5, Math.sin(w * 6) * .3);
   stamp.position.y = 1.2 + Math.abs(Math.sin(t * 2.5)) * .45;
  });
  plate(c);
 };
 B.journey = c => {
  const R = c.root;
  c.F(R, 'box', 0, 1.35, -3, 1.6, 2.7, .9, '#2f4a47'); c.F(R, 'box', 0, 2.75, -3, 1.9, .16, 1.1, '#7fd0c4');
  c.F(R, 'box', 0, .06, -2.6, 2.4, .12, 1.7, '#243838');
  c.L(R, 'box', 0, 1.95, -2.53, 1.3, 1, .04, '#10171d', '#d8f2ee', '#4f8f88', .4); c.F(R, 'box', 0, 1.0, -2.53, .6, .08, .05, '#10171d');
  const stars = [0, 1, 2, 3, 4].map(i => c.P(c.live, 'ball', -.5 + i * .25, 1.8, -2.48, .09, .09, .03, '#ffbb73'));
  for (const i of [0, 1, 2, 3, 4]) c.F(c.idle, 'ball', -.5 + i * .25, 1.8, -2.48, .09, .09, .03, '#59616b');
  const ticket = c.P(c.live, 'box', 0, .85, -2.4, .4, .02, .5, '#f6f1e4');
  const steps = Array.from({length: 8}, (_, i) => [i % 2 ? .3 : -.3, -.4 + i * .45] as const);
  for (const [x, z] of steps) c.F(R, 'box', x, .02, z, .26, .02, .4, '#3a5a56');
  const walk = steps.map(([x, z]) => c.P(c.live, 'box', x, .04, z, .26, .02, .4, '#7fd0c4'));
  anim(c, (t, p) => {
   const n = 1 + Math.floor(loop(t, .5) * 5);
   stars.forEach((s, i) => {
    s.visible = i < n;
    s.scale.setScalar(.09 * (1 + (i === n - 1 ? .4 * Math.sin(t * 8) : 0)));
   });
   const k = Math.floor(loop(t, .6) * 8);
   walk.forEach((w, i) => {w.visible = i <= k && i > k - 3;});
   ticket.position.set(0, .85, -2.35 + .35 * loop(t, .5)); ticket.scale.z = .2 + p * .5 + .3 * loop(t, .5);
  });
  plate(c);
 };
})(globalThis);
