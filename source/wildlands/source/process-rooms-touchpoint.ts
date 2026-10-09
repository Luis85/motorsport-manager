/// <reference path="./process-contracts.d.ts" />
/** Touchpoint rooms (one themed model per channel plus a generic kiosk), the channel display table and the seven mood faces. Presentation only; loads after process-rooms.ts. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessRooms: LWProcessRooms.Api};
 const rooms = root.LWProcessRooms;
 type Ctx = LWProcessRooms.Ctx;
 const theme = (id: string, label: string, floor: string, wall: string, accent: string, task: string): LWProcessRooms.Theme => ({id, label: 'Touchpoint · ' + label, floor, wall, accent, task});
 // Stroke glyphs in a -0.5..0.5 box (monitor, phone, shop, headset, chat bubble, envelope, megaphone, billboard, parcel, document).
 const CHANNELS: [string, string, string, LWProcessRooms.Theme][] = [
  ['web', 'Website', 'M-.5 -.4 H.5 V.2 H-.5 Z M-.5 -.2 H.5 M-.2 .45 H.2 M0 .2 V.45', theme('web', 'Website', '#2b3f56', '#35506b', '#7fb3e0', 'Browsing the site')],
  ['mobile', 'Mobile app', 'M-.25 -.5 H.25 V.5 H-.25 Z M-.1 .37 H.1', theme('mobile', 'Mobile app', '#2f3a52', '#3d4a68', '#a79bf0', 'Using the app')],
  ['store', 'Store', 'M-.5 -.1 L-.4 -.45 H.4 L.5 -.1 Z M-.4 -.1 V.45 H.4 V-.1 M-.12 .45 V.12 H.12 V.45', theme('store', 'Store', '#43382f', '#5a4a3b', '#e0a35c', 'Shopping in store')],
  ['phone', 'Phone', 'M-.4 .05 V-.1 A.4 .4 0 0 1 .4 -.1 V.05 M-.5 0 H-.32 V.3 H-.5 Z M.32 0 H.5 V.3 H.32 Z M.4 .3 Q.4 .5 .1 .5', theme('phone', 'Phone', '#2e4247', '#3a5a60', '#7fd0c4', 'On a call')],
  ['chat', 'Chat', 'M-.5 -.4 H.5 V.2 H0 L-.25 .45 V.2 H-.5 Z M-.25 -.1 H.25', theme('chat', 'Chat', '#2f3f4a', '#3b5566', '#6fc7e8', 'Chatting')],
  ['email', 'Email', 'M-.5 -.35 H.5 V.35 H-.5 Z M-.5 -.35 L0 .05 L.5 -.35', theme('email', 'Email', '#3a3f55', '#4a5170', '#9db4ff', 'Reading email')],
  ['social', 'Social media', 'M-.5 -.1 H-.25 L.3 -.4 V.4 L-.25 .1 H-.5 Z M-.3 .1 L-.2 .45 H-.05 L-.1 .12 M.42 -.1 H.5 M.42 .1 H.5', theme('social', 'Social media', '#4a3552', '#613f6e', '#e58ac8', 'Scrolling the feed')],
  ['ads', 'Advertising', 'M-.5 -.45 H.5 V.1 H-.5 Z M-.25 .1 V.5 M.25 .1 V.5 M-.3 -.2 H.3', theme('ads', 'Advertising', '#4a3a2b', '#614b36', '#ffb347', 'Seeing an advert')],
  ['delivery', 'Delivery', 'M-.45 -.25 L0 -.5 L.45 -.25 V.25 L0 .5 L-.45 .25 Z M-.45 -.25 L0 0 L.45 -.25 M0 0 V.5', theme('delivery', 'Delivery', '#3a4a3a', '#4a5f4a', '#8fd68a', 'Receiving the parcel')],
  ['document', 'Documents', 'M-.35 -.5 H.15 L.4 -.25 V.5 H-.35 Z M.15 -.5 V-.25 H.4 M-.2 0 H.25 M-.2 .2 H.25', theme('document', 'Documents', '#434034', '#5a5645', '#d9c58a', 'Filling in forms')],
 ];
 for (const [id, label, glyph, th] of CHANNELS) rooms.channels[id] = {label, glyph, theme: th};
 Object.assign(rooms.fallbackTheme, {label: 'Touchpoint', id: 'journey'});
 // Mood faces: colour runs cool to warm; strokes are drawn in a 100-unit box (eyes at 35,40 and 65,40).
 rooms.moods.push(
  {level: -3, label: 'very unhappy', color: '#5b86ff', mouth: 'M28 76 Q50 54 72 76', brow: 'M26 36 L42 28 M74 36 L58 28'}, {level: -2, label: 'unhappy', color: '#62b0f0', mouth: 'M30 72 Q50 58 70 72'},
  {level: -1, label: 'uneasy', color: '#7fd6cf', mouth: 'M34 70 Q50 63 66 70'}, {level: 0, label: 'neutral', color: '#d9e4a8', mouth: 'M34 68 H66'},
  {level: 1, label: 'pleased', color: '#f5d86a', mouth: 'M34 64 Q50 71 66 64'}, {level: 2, label: 'happy', color: '#ffb865', mouth: 'M30 62 Q50 80 70 62'},
  {level: 3, label: 'delighted', color: '#ff8a50', mouth: 'M28 60 Q50 92 72 60 Z', open: true},
 );
 const clamp = (x: number) => Math.max(0, Math.min(1, x)), ease = (x: number) => { const u = clamp(x); return u * u * (3 - 2 * u); };
 const loop = (t: number, speed: number, shift = 0) => ((t * speed + shift) % 1 + 1) % 1;
 const fade = (u: number) => Math.max(.02, Math.min(1, Math.min(u, 1 - u) * 6));
 const label = (c: Ctx) => (c.step.channel && rooms.channels[c.step.channel]?.theme.label) || 'Touchpoint';
 /** Kind plate on two low posts at the front-right of the room, clear of the floating name pill and the props; the sign text is `Touchpoint · <channel>`. */
 function plate(c: Ctx): void {
  const R = c.live.parent; for (const x of [1.7, 4.7]) c.P(R, 'cylinder', x, .4, 3, .05, .8, .05, '#59616b');
  c.sign(R, label(c), 3.2, 1.1, 3, 3.8, .75);
 }
 const anim = (c: Ctx, fn: (t: number, p: number) => void, rest?: () => void) => c.swing((t, p) => {if (c.on) fn(t, p); else rest?.();});
 /** Desk with a keyboard, shared by the screen based channels. */
 function desk(c: Ctx, z: number, w = 3.4): void {
  const R = c.live.parent; c.P(R, 'box', 0, .85, z, w, .12, 1.2, '#8c725d'); for (const s of [-1, 1]) c.P(R, 'box', s * (w / 2 - .15), .42, z, .12, .84, 1, '#536379');
  c.P(R, 'box', 0, .93, z + .25, 1.4, .05, .4, '#2b3440'); c.P(R, 'ball', 1.2, .95, z + .25, .1, .05, .13, '#2b3440');
 }
 const BUILDERS = rooms.builders;
 BUILDERS.web = c => {
  const R = c.live.parent;
  c.P(R, 'box', 0, 2, -3.95, 6.4, 2.8, .16, '#0d131b'); c.glow(c.P(R, 'box', 0, 2, -3.85, 6.1, 2.55, .04, '#e8eef6'), '#e8eef6', '#4a5a70', .3, '#222c38');
  c.P(R, 'box', 0, 3.15, -3.82, 6.1, .22, .03, '#3a4a60'); for (const x of [-2.3, -.9]) c.P(R, 'box', x, 3.15, -3.8, 1.2, .14, .03, '#c9d6e6');
  c.P(R, 'box', .4, 2.9, -3.82, 5, .18, .03, '#9fb0c4'); c.P(R, 'box', -2.9, 2.9, -3.8, .16, .1, .03, '#7fb3e0');
  const spec: [number, number, number, string][] = [[5.4, .6, 0, '#7fb3e0'], [3.2, .12, -1, '#9fb0c4'], [2.4, .12, -1.4, '#b9c8da'], [1.4, .5, -2, '#ffbb73'], [1.4, .5, 0, '#8fd68a'], [1.4, .5, 2, '#d69aa8']];
  const blocks = spec.map(([w, , x, col]) => c.P(c.live, 'box', x, 1.8, -3.8, w, .1, .03, col));
  const cursor = c.P(c.live, 'cone', 0, 1.8, -3.74, .1, .24, .1, '#10161f'), click = c.P(c.live, 'ring', 0, 1.8, -3.74, .2, .2, .2, '#ff8f5a');
  c.P(c.idle, 'ring', 0, 1.8, -3.8, .35, .35, .35, '#7b8794'); c.P(c.idle, 'box', 0, 1.2, -3.8, 1.6, .08, .03, '#59616b');
  anim(c, t => {
   blocks.forEach((b, i) => {const u = loop(t, .12, i / spec.length); b.position.y = 2.75 - u * 1.9; b.scale.y = spec[i]![1] * fade(u);});
   cursor.position.set(2.2 * Math.sin(t * .9), 1.75 + .55 * Math.sin(t * 1.3 + 1), -3.74); cursor.rotation.z = .6;
   const k = loop(t, .6); click.position.copy(cursor.position); click.scale.setScalar(k < .5 ? .05 + k * .5 : .001);
  });
  desk(c, -1.7); c.P(R, 'box', 0, .55, 0, 1, .1, 1, '#3a4452'); c.P(R, 'box', 0, 1.05, .5, 1, .9, .08, '#3a4452'); c.P(R, 'cylinder', 0, .27, 0, .08, .55, .08, '#59616b'); plate(c);
 };
 BUILDERS.mobile = c => {
  const R = c.live.parent;
  c.P(R, 'cylinder', 0, .12, -2.2, 1.3, .24, 1.1, '#2e3a40'); c.P(R, 'cylinder', 0, .47, -2.3, .2, .46, .2, '#4a5a62'); c.P(R, 'box', 0, 2.45, -2.2, 2.2, 3.5, .22, '#10161c');
  c.glow(c.P(R, 'box', 0, 2.45, -2.07, 1.9, 3.1, .03, '#dfe9f5'), '#e6eef9', '#5d6f88', .35, '#171e27'); c.P(R, 'box', 0, 3.98, -2.04, .5, .06, .02, '#10161c'); c.P(R, 'box', 0, .95, -2.04, .6, .05, .02, '#59616b');
  const tiles = ['#ffb347', '#7fb3e0', '#8fd68a', '#e58ac8', '#a79bf0', '#ff8f5a', '#6fc7e8', '#d9c58a', '#7fd0c4'].map((col, i) => c.P(c.live, 'box', (i % 3 - 1) * .62, 3.35 - Math.floor(i / 3) * .62, -2.04, .5, .5, .03, col));
  const banner = c.P(c.live, 'box', 0, 3.7, -2.0, 1.7, .4, .04, '#10161f'), badge = c.glow(c.P(c.live, 'ball', .3, 3.6, -2.0, .1, .1, .1, '#e05c5c'), '#ff6b6b', '#c43c3c', 1.2), ripple = c.P(c.live, 'ring', 0, 3.35, -2.0, .1, .1, .1, '#5a4cc0');
  const dots = [-1, 1].map(s => c.glow(c.P(c.live, 'ball', s * 1.7, 3, -2, .09, .09, .09, '#ffd27a'), '#ffd27a', '#ffb347', 1.2));
  c.P(c.idle, 'box', 0, 3.2, -2.04, 1.2, .35, .03, '#2c3744'); c.P(c.idle, 'ball', 0, 2.3, -2.04, .22, .22, .22, '#59616b'); c.P(c.idle, 'box', 0, 2.05, -2.04, .3, .2, .03, '#59616b');
  anim(c, t => {
   const u = loop(t, .25), s = Math.max(.01, Math.min(1, u / .12, (1 - u) / .12)); banner.position.y = 3.95 - .45 * s; banner.scale.y = .4 * s; banner.scale.x = 1.7 * s;
   const k = loop(t, .8), i = Math.floor(t * .8) % 9; ripple.position.set((i % 3 - 1) * .62, 3.35 - Math.floor(i / 3) * .62, -2); ripple.scale.setScalar(.06 + .42 * k); tiles.forEach((m, j) => {m.scale.set(.5 * (j === i ? .85 : 1), .5 * (j === i ? .85 : 1), .03);});
   badge.scale.setScalar(.1 * (1 + .4 * Math.max(0, Math.sin(t * 5)))); dots.forEach((d, j) => {d.position.y = 3 + .5 * Math.sin(t * 2 + j * 2); d.position.x = (j ? 1 : -1) * (1.7 + .15 * Math.sin(t * 3 + j));});
  });
  plate(c);
 };
 BUILDERS.store = c => {
  const R = c.live.parent, cols = ['#e05c5c', '#7fb3e0', '#ffbb73', '#8fd68a', '#e58ac8', '#d9c58a'];
  for (const x of [-3.3, -.9]) {
   c.P(R, 'box', x, 1.5, -3.9, 2.2, 2.4, .12, '#6a5846'); c.P(R, 'box', x, 2.8, -3.8, 2.3, .16, .4, '#e05c5c');
   for (const [bi, y] of [.75, 1.45, 2.15].entries()) {c.P(R, 'box', x, y, -3.6, 2.2, .08, .6, '#8a6f4b'); if (bi) for (let k = 0; k < 3; k++) c.P(R, 'box', x - .7 + k * .7, y + .2, -3.6, .45, .32, .4, cols[(k + bi * 2 + (x > -2 ? 1 : 0)) % 6]!);}
  }
  c.P(R, 'box', 3.1, .5, -2.8, 2.6, 1, 1, '#5a4a3b'); c.P(R, 'box', 3.1, 1.06, -2.8, 2.8, .1, 1.2, '#cfd8e0'); c.P(R, 'box', 3.7, 1.35, -2.9, .7, .45, .5, '#2b3440'); c.P(R, 'box', 3.7, 1.5, -2.62, .5, .25, .03, '#7fb3e0');
  c.lamp(c.P(R, 'ball', 2.5, 1.2, -2.5, .09, .09, .09, '#3a3f48'), '#8fd68a', '#4caf50', on => on, 1.2); c.P(R, 'box', 2.2, 1.25, -2.9, .4, .4, .4, '#d8b074');
  const shopper = c.G(c.live); c.P(shopper, 'cylinder', 0, .75, 0, .28, 1.2, .24, '#52677b'); c.P(shopper, 'ball', 0, 1.55, 0, .22, .25, .22, '#d5ac88'); c.P(shopper, 'cylinder', 0, 1.8, 0, .27, .08, .27, '#37404b');
  const basket = c.G(shopper); basket.position.set(.55, .5, .1); c.P(basket, 'box', 0, 0, 0, .7, .06, .5, '#c0392b');
  for (const z of [-.25, .25]) c.P(basket, 'box', 0, .15, z, .7, .26, .04, '#d9503f'); for (const x of [-.35, .35]) c.P(basket, 'box', x, .15, 0, .04, .26, .5, '#d9503f');
  c.P(basket, 'box', 0, .38, 0, .6, .04, .04, '#8a8f98'); const items = cols.slice(0, 3).map((col, i) => c.P(basket, 'box', -.2 + i * .2, .2, 0, .17, .24, .2, col));
  const hold = c.G(c.idle); hold.position.set(-3, .1, 0); c.P(hold, 'box', 0, .06, 0, .7, .06, .5, '#c0392b'); c.P(hold, 'box', 0, .2, .24, .7, .26, .04, '#d9503f');
  anim(c, t => {
   const u = loop(t, .1), go = u < .5, k = go ? u * 2 : 2 - u * 2; shopper.position.set(-3.4 + 5.2 * ease(k), 0, -1.2 + .2 * Math.sin(t * 3)); shopper.rotation.y = go ? .3 : -.3 + Math.PI;
   items.forEach(m => {m.visible = go || k > .8;}); shopper.position.y = Math.abs(Math.sin(t * 6)) * .05;
  });
  plate(c);
 };
 BUILDERS.phone = c => {
  const R = c.live.parent;
  c.P(R, 'box', .5, .95, -2.4, 4.4, .14, 1.8, '#8c725d'); for (const x of [-1.4, 2.4]) c.P(R, 'box', x, .47, -2.4, .14, .94, 1.6, '#536379');
  c.P(R, 'box', -.9, 1.17, -2.2, 1.3, .3, .9, '#2b3440'); for (let k = 0; k < 6; k++) c.P(R, 'box', -1.25 + (k % 3) * .25, 1.34, -2.05 + Math.floor(k / 3) * .22, .14, .04, .14, '#9fb0c4');
  for (const x of [-1.4, -.4]) c.P(R, 'box', x, 1.45, -2.55, .12, .3, .12, '#59616b');
  c.P(c.idle, 'box', -.9, 1.58, -2.55, 1.5, .16, .28, '#1d2630'); const lift = c.P(c.live, 'box', -.9, 2.3, -1.8, 1.5, .16, .28, '#1d2630');
  const waves = [0, 1, 2].map(() => c.glow(c.P(c.live, 'ring', -.9, 2.3, -1.6, .5, .5, .5, '#7fd0c4'), '#7fd0c4', '#3fa093', 1));
  c.P(R, 'box', 2.3, 1.95, -3.4, 1.9, 1.3, .1, '#10161f'); c.P(R, 'cylinder', 2.3, 1.2, -3.4, .1, .5, .1, '#59616b'); c.glow(c.P(R, 'box', 2.3, 1.95, -3.34, 1.7, 1.1, .02, '#143642'), '#1b4d5e', '#2a8aa6', .6, '#10171d');
  const bars = [0, 1, 2, 3, 4].map(i => c.P(c.live, 'box', 1.75 + i * .27, 1.5, -3.3, .16, .1, .02, '#7fd0c4')); for (const i of [0, 1, 2]) c.P(c.idle, 'box', 1.75 + i * .5, 1.5, -3.3, .3, .05, .02, '#2a3b55');
  c.P(R, 'cylinder', 1.1, 1.5, -2.7, .04, 1, .04, '#59616b'); c.P(R, 'cylinder', 1.1, 1.03, -2.7, .3, .04, .3, '#2b3440'); c.P(R, 'ring', 1.1, 2.15, -2.7, .45, .45, .45, '#2b3440');
  for (const s of [-1, 1]) c.P(R, 'cylinder', 1.1 + s * .45, 2.1, -2.7, .16, .14, .16, '#e0e6ec').rotation.z = Math.PI / 2;
  c.P(R, 'box', 1.55, 1.85, -2.5, .5, .03, .03, '#2b3440').rotation.z = .4; c.lamp(c.P(R, 'ball', -1.9, 1.1, -2.6, .1, .1, .1, '#401d1d'), '#ff6b6b', '#c43c3c', (on) => on, 1.2);
  anim(c, t => {
   lift.position.y = 2.3 + .08 * Math.sin(t * 3); lift.rotation.set(0, .3, -.6 + .08 * Math.sin(t * 2));
   waves.forEach((w, i) => {const u = loop(t, .5, i / 3); w.scale.setScalar(.3 + u * 1.4); w.visible = u < .92;}); bars.forEach((b, i) => {b.scale.y = .1 + .8 * Math.abs(Math.sin(t * 3 + i * 1.3)); b.position.y = 1.45 + b.scale.y / 2;});
  });
  plate(c);
 };
 BUILDERS.chat = c => {
  const R = c.live.parent, W: [number, boolean][] = [[1.8, true], [2.2, false], [1.4, true], [2.4, false], [1.6, true]], rowY = (i: number) => 2.65 - i * .36;
  c.P(R, 'box', 0, 2, -3.95, 5.6, 2.8, .16, '#0d131b'); c.glow(c.P(R, 'box', 0, 2, -3.85, 5.3, 2.55, .04, '#dfe7f1'), '#e6edf6', '#52627a', .3, '#222c38');
  c.P(R, 'box', 0, 3.1, -3.82, 5.3, .34, .03, '#3b5566'); c.P(R, 'ball', -2.4, 3.1, -3.8, .13, .13, .03, '#6fc7e8'); c.P(R, 'box', -1.3, 3.1, -3.8, 1.5, .09, .03, '#c9d6e6');
  c.P(R, 'box', -.3, .85, -3.82, 4.4, .28, .03, '#aab8ca'); c.glow(c.P(R, 'ball', 2.2, .85, -3.8, .15, .15, .03, '#6fc7e8'), '#6fc7e8', '#2f8fb0', 1, '#59616b');
  const place = (parent: any, i: number) => {
   const [w, mine] = W[i]!, x = mine ? 2.45 - w / 2 : -2.45 + w / 2, g = c.G(parent); g.position.set(x, rowY(i), -3.8);
   c.P(g, 'box', 0, 0, 0, w, .27, .05, mine ? '#7fb3e0' : '#aab8ca'); c.P(g, 'box', 0, 0, .04, w * .7, .06, .02, mine ? '#1d3b52' : '#3b4656'); return g;
  };
  const bubbles = W.map((_, i) => place(c.live, i)); place(c.idle, 0); place(c.idle, 1);
  const dots = [0, 1, 2].map(() => c.P(c.live, 'ball', 0, 0, -3.78, .07, .07, .07, '#3b4656'));
  anim(c, t => {
   const n = (t * .9) % (W.length + 1.5), shown = Math.floor(n);
   bubbles.forEach((b, i) => {b.visible = i < shown; b.scale.setScalar(i === shown - 1 ? .7 + .3 * ease((n - shown) * 4) : 1);});
   dots.forEach((d, i) => {d.visible = shown < W.length; const mine = shown % 2 === 0, x = mine ? 2.2 : -2.2; d.position.set(x + (i - 1) * .22, rowY(Math.min(shown, W.length - 1)) + .1 * Math.max(0, Math.sin(t * 8 - i)), -3.78);});
  });
  desk(c, -1.4); plate(c);
 };
 BUILDERS.email = c => {
  const R = c.live.parent;
  c.P(R, 'box', -1.6, 2, -3.95, 4.4, 2.8, .16, '#0d131b'); c.glow(c.P(R, 'box', -1.6, 2, -3.85, 4.1, 2.55, .04, '#e8eef6'), '#e8eef6', '#4a5a70', .3, '#222c38'); c.P(R, 'box', -1.6, 3.1, -3.82, 4.1, .3, .03, '#4a5170');
  const rows = [0, 1, 2, 3, 4, 5].map(i => {const g = c.G(c.live); c.P(g, 'box', 0, 0, 0, 3.8, .36, .03, i % 2 ? '#c9d6e6' : '#d9e2ee'); c.P(g, 'box', -1.8, 0, .02, .08, .36, .03, '#9db4ff'); c.P(g, 'box', -.4, .05, .02, 2, .07, .02, '#59616b'); return g;});
  for (const i of [1, 2, 3]) {const g = c.G(c.idle); g.position.set(-1.6, 2.8 - i * .46, -3.8); c.P(g, 'box', 0, 0, 0, 3.8, .36, .03, '#aab8ca');}
  c.P(R, 'box', 3.2, .9, -2.9, 2, 1.8, 1.4, '#3b4262'); c.P(R, 'box', 3.2, 1.81, -2.6, 1.4, .05, .12, '#0d131b'); c.lamp(c.P(R, 'ball', 4, 1.6, -2.15, .14, .14, .14, '#401d1d'), '#ff6b6b', '#c43c3c', on => on, 1.2);
  const mail = [0, 1, 2, 3].map(() => {const g = c.G(c.live); c.P(g, 'box', 0, 0, 0, .9, .05, .6, '#f6f1e4'); for (const s of [-1, 1]) c.P(g, 'box', s * .2, .04, -.1, .55, .02, .05, '#9db4ff').rotation.y = s * .8; return g;});
  for (const [x, z] of [[1.3, -1.3], [1.7, -1.1]] as const) {const g = c.G(c.idle); g.position.set(x, .07, z); c.P(g, 'box', 0, 0, 0, .9, .05, .6, '#f6f1e4'); c.P(g, 'box', 0, .04, -.1, .5, .02, .05, '#9db4ff');}
  anim(c, t => {
   const k = loop(t, .5); rows.forEach((g, i) => {g.position.set(-1.6, 2.8 - (i + k) * .46, -3.8); g.scale.y = i === 0 ? Math.max(.02, k) : i === 5 ? Math.max(.02, 1 - k) : 1;});
   mail.forEach((g, i) => {const u = loop(t, .22, i / 4); g.position.set(-4 + 7.2 * u, 3.2 - 1.3 * u + Math.sin(u * Math.PI) * 1.2, -1.2 - 1.4 * u); g.rotation.y = (1 - u) * 1.5; g.scale.setScalar(u > .85 ? Math.max(.2, 1 - (u - .85) * 5) : 1);});
  });
  plate(c);
 };
 BUILDERS.social = c => {
  const R = c.live.parent;
  c.P(R, 'cylinder', 0, .3, -4, .15, .6, .15, '#59616b'); c.P(R, 'box', 0, 2.1, -3.95, 3.6, 3.1, .16, '#0d131b'); c.glow(c.P(R, 'box', 0, 2.1, -3.85, 3.3, 2.85, .04, '#2a2233'), '#3a2d48', '#6b4a85', .4, '#1b1722');
  c.P(R, 'box', 0, 3.4, -3.82, 3.3, .28, .03, '#e58ac8'); for (const x of [-1.3, 1.3]) c.P(R, 'ball', x, 3.4, -3.8, .1, .1, .03, '#f6e3f0'); for (const x of [-1.2, -.4, .4, 1.2]) c.P(R, 'ball', x, .85, -3.8, .08, .08, .03, '#b79ad6');
  const card = (parent: any) => {
   const g = c.G(parent); c.P(g, 'box', 0, 0, 0, 2.9, 1.05, .04, '#f2f4f8'); c.P(g, 'ball', -1.15, .33, .03, .13, .13, .03, '#e58ac8'); c.P(g, 'box', -.3, .33, .03, 1.3, .07, .02, '#59616b');
   c.P(g, 'box', 0, -.05, .03, 2.6, .42, .02, '#a79bf0'); c.P(g, 'box', -.4, -.38, .03, 1.5, .06, .02, '#9fb0c4'); c.P(g, 'ball', 1.15, -.38, .03, .09, .09, .03, '#e05c5c'); return g;
  };
  const cards = [0, 1, 2, 3].map(() => card(c.live)), idleCard = card(c.idle); idleCard.position.set(0, 2.2, -3.8);
  const hearts = [0, 1, 2, 3, 4].map(() => c.glow(c.P(c.live, 'ball', 2, 1, -3.4, .12, .12, .12, '#ff6b81'), '#ff6b81', '#c43c5a', 1.2));
  anim(c, t => {
   cards.forEach((g, i) => {const u = loop(t, .1, i / 4); g.position.set(0, 3.1 - u * 2.35, -3.8); g.scale.y = fade(u);});
   hearts.forEach((h, i) => {const u = loop(t, .3, i / 5); h.position.set(2.2 + .25 * Math.sin(t * 3 + i * 2), .9 + u * 2.6, -3.4); h.scale.setScalar(.12 * Math.max(.2, 1 - u));});
  });
  for (const i of [0, 1, 2, 3]) cards[i]!.position.set(0, 3.1 - i * .6, -3.8);
  plate(c);
 };
 BUILDERS.ads = c => {
  const R = c.live.parent, ADS = [['#ff8f5a', '#fff1df'], ['#4fc3ff', '#0f4b6e'], ['#8fd68a', '#1f5a2c']] as const, band = (k: number, j: number) => ADS[k % 3]![j >= 2 && j <= 5 ? 1 : 0]!;
  c.P(R, 'box', 0, 2.1, -3.9, 6.4, 2.8, .2, '#222a33'); for (const x of [-2.6, 2.6]) c.P(R, 'cylinder', x, .5, -4, .12, 1, .12, '#59616b'); c.P(R, 'box', 0, 3.75, -3.3, 6, .06, .06, '#59616b');
  for (const x of [-2.4, -.8, .8, 2.4]) c.lamp(c.P(R, 'cone', x, 3.58, -3.3, .15, .3, .15, '#2b3440'), '#fff1df', '#ffd9a0', on => on, 1.6).rotation.x = Math.PI;
  const slats = Array.from({length: 8}, (_, j) => {const g = c.G(R); g.position.set(-2.52 + j * .72, 2.1, -3.76); return {g, front: c.P(g, 'box', 0, 0, .03, .7, 2.4, .05, band(0, j)), back: c.P(g, 'box', 0, 0, -.03, .7, 2.4, .05, band(1, j))};});
  let shown = -1; const paint = (k: number) => {if (shown === k) return; shown = k; slats.forEach((s, j) => {s.front.material = c.mat(band(k, j)); s.back.material = c.mat(band(k + 1, j));});};
  for (const x of [-4, 4]) c.P(R, 'cylinder', x, .25, -1.5, .14, .5, .14, '#59616b');
  const glint = c.P(c.live, 'box', 0, 2.1, -3.68, .35, 2.4, .03, '#ffffff', {transparent: true, opacity: .3, depthWrite: false}); paint(0);
  anim(c, t => {
   const p = t * .3, k = Math.floor(p), f = p - k; paint(k);
   slats.forEach((s, j) => {s.g.rotation.y = ease((f - .5 - j * .035) / .25) * Math.PI;}); glint.position.x = -2.9 + 5.8 * loop(t, .4);
  }, () => {paint(0); slats.forEach(s => {s.g.rotation.y = 0;});});
  plate(c);
 };
 BUILDERS.delivery = c => {
  const R = c.live.parent;
  c.P(R, 'box', -1.4, .55, -2.3, 6.8, .24, 1.3, '#2d3239'); c.P(R, 'box', -1.4, .7, -2.3, 6.6, .05, 1.05, '#1a1d21'); for (const z of [-2.98, -1.62]) c.P(R, 'box', -1.4, .78, z, 6.8, .1, .08, '#5d6670');
  for (const x of [-4.4, -1.4, 1.4]) c.P(R, 'box', x, .25, -2.3, .14, .5, 1.1, '#454c55');
  const stripes = Array.from({length: 9}, (_, i) => c.P(c.live, 'box', -4.6 + i * .8, .74, -2.3, .06, .015, 1, '#3a424b'));
  c.P(R, 'box', 3.5, 1.4, -2.3, 2.8, 1.9, 1.9, '#e9eef2'); c.P(R, 'box', 2.1, 1.35, -2.3, .06, 1.5, 1.6, '#10161f'); c.P(R, 'box', 4.5, 1, -2.3, .9, 1.1, 1.7, '#c75c5c'); c.glow(c.P(R, 'box', 4.97, 1.25, -2.3, .04, .5, 1.2, '#10161f'), '#9fd0e8', '#4f8fb0', .6);
  c.P(R, 'box', 3.5, 1.9, -1.34, 2.6, .1, .03, '#8fd68a');
  const wheels = [[2.8, -1.3], [4.3, -1.3], [2.8, -3.3], [4.3, -3.3]].map(([x, z]) => {const g = c.G(R); g.position.set(x!, .42, z!); c.P(g, 'cylinder', 0, 0, 0, .42, .24, .42, '#22262c').rotation.z = Math.PI / 2; c.P(g, 'box', .13, 0, 0, .02, .5, .08, '#aab3bd'); return g;});
  const parcel = (parent: any, w: number) => {const g = c.G(parent); c.P(g, 'box', 0, .3, 0, w, .6, .7, '#c99a5a'); c.P(g, 'box', 0, .3, 0, .1, .62, .72, '#f2ead6'); return g;};
  const parcels = [0, 1, 2, 3].map(i => parcel(c.live, .7 + (i % 2) * .15));
  [-3.9, -2.5, -1.1].forEach((x, i) => {const g = parcel(c.idle, .8); g.position.set(x, .72, -2.3 + (i % 2) * .1);});
  for (const [x, y] of [[-4.2, .3], [-4.2, .9], [-3.4, .3]] as const) c.P(R, 'box', x, y, -.6, .7, .55, .65, '#d8b074');
  c.lamp(c.P(R, 'ball', 2.1, 2.5, -1.4, .12, .12, .12, '#193b25'), '#5af58c', '#2fbf63', on => on, 1.2);
  anim(c, t => {
   stripes.forEach((b, i) => {b.position.x = -4.6 + (i + (t * .8) % 1) % 9 * .8;});
   parcels.forEach((g, i) => {const u = loop(t, .12, i / 4); g.position.set(-4.5 + 6.6 * u, .73, -2.3); g.scale.setScalar(u > .9 ? Math.max(.05, 1 - (u - .9) * 9) : 1);});
   wheels.forEach(w => {w.rotation.x = t * 4;});
  }, () => wheels.forEach(w => {w.rotation.x = 0;}));
  plate(c);
 };
 BUILDERS.document = c => {
  const R = c.live.parent;
  c.P(R, 'box', -2, .9, -2.6, 3.6, .14, 1.6, '#8c725d'); for (const x of [-3.7, -.3]) c.P(R, 'box', x, .45, -2.6, .12, .9, 1.4, '#536379');
  const sheet = (parent: any, w: number, col: string) => {const g = c.G(parent); c.P(g, 'box', 0, 0, 0, w, .03, w * .75, col); for (const z of [-.2, 0, .2]) c.P(g, 'box', 0, .02, z * w, w * .6, .01, .04, '#9fb0c4'); return g;};
  for (let i = 0; i < 6; i++) {const s = c.P(R, 'box', -2.9 + (i % 2) * .05, 1.0 + i * .045, -2.7, 1, .04, .75, i % 2 ? '#f2efe6' : '#e8dfc4'); s.rotation.y = (i - 3) * .04;}
  const form = sheet(R, 1, '#f2efe6'); form.position.set(-1.4, .99, -2.9); c.P(R, 'box', -1.0, 1.0, -2.2, .8, .05, 1, '#6b5a4a'); c.P(R, 'ball', -1.0, 1.05, -1.7, .08, .05, .06, '#aab3bd'); c.P(R, 'cylinder', -.4, 1.0, -2.6, .3, .06, .3, '#2b3440');
  const stamp = c.P(c.live, 'cylinder', -.4, 1.4, -2.6, .15, .5, .15, '#c75c5c'), ink = c.P(c.live, 'box', -.4, 1.04, -2.6, .55, .02, .55, '#8a3b3b');
  c.P(R, 'box', 2.6, .9, -2.9, 2.6, .1, 1.7, '#8c725d'); for (const x of [1.5, 3.7]) c.P(R, 'box', x, .45, -2.9, .1, .9, 1.5, '#536379');
  c.P(R, 'box', 2.6, 1.35, -3.1, 2, .8, 1.2, '#d5dae0'); c.P(R, 'box', 2.6, 1.8, -3.1, 2, .06, 1.2, '#b9c0c8'); c.P(R, 'box', 2.6, 2.1, -3.55, 1.3, .04, .7, '#f2efe6').rotation.x = -.5; c.P(R, 'box', 2.6, 1.28, -2.48, 1.6, .08, .04, '#10161f');
  c.P(R, 'box', 2.6, 1.0, -2.0, 1.6, .04, .7, '#aab3bd'); c.lamp(c.P(R, 'ball', 3.4, 1.7, -2.5, .08, .08, .08, '#193b25'), '#5af58c', '#2fbf63', on => on, 1.2);
  const out = sheet(c.live, 1.1, '#fffdf5'), flying = sheet(c.live, .9, '#e8dfc4'), rest = sheet(c.idle, 1.1, '#fffdf5'); rest.position.set(2.6, 1.05, -2.0);
  anim(c, t => {
   const u = loop(t, .3); out.position.set(2.6, 1.3 - .25 * ease(u * 2), -2.45 + 0.75 * ease(u * 1.4)); out.visible = u < .75;
   const w = loop(t, .2); flying.position.set(2.2 - 4.8 * w, 1.1 + Math.sin(w * Math.PI) * 1.4, -2.4 - .3 * w); flying.rotation.set(0, w * 5, Math.sin(w * 6) * .3);
   stamp.position.y = 1.2 + Math.abs(Math.sin(t * 2.5)) * .45; ink.visible = true;
  });
  plate(c);
 };
 BUILDERS.journey = c => {
  const R = c.live.parent;
  c.P(R, 'box', 0, 1.35, -3, 1.6, 2.7, .9, '#2f4a47'); c.P(R, 'box', 0, 2.75, -3, 1.9, .16, 1.1, '#7fd0c4'); c.P(R, 'box', 0, .06, -2.6, 2.4, .12, 1.7, '#243838');
  c.glow(c.P(R, 'box', 0, 1.95, -2.53, 1.3, 1, .04, '#d8f2ee'), '#d8f2ee', '#4f8f88', .4, '#10171d'); c.P(R, 'box', 0, 1.0, -2.53, .6, .08, .05, '#10171d');
  const lit = (parent: any) => [0, 1, 2, 3, 4].map(i => c.P(parent, 'ball', -.5 + i * .25, 1.8, -2.48, .09, .09, .03, '#ffbb73'));
  const stars = lit(c.live); lit(c.idle).forEach(s => {s.material = c.mat('#59616b');}); const ticket = c.P(c.live, 'box', 0, .85, -2.4, .4, .02, .5, '#f6f1e4');
  const prints = Array.from({length: 8}, (_, i) => c.P(R, 'box', (i % 2 ? .3 : -.3), .02, -.4 + i * .45, .26, .02, .4, '#3a5a56')), walk = prints.map(p => c.P(c.live, 'box', p.position.x, .04, p.position.z, .26, .02, .4, '#7fd0c4'));
  anim(c, (t, p) => {
   const n = 1 + Math.floor(loop(t, .5) * 5); stars.forEach((s, i) => {s.visible = i < n; s.scale.setScalar(.09 * (1 + (i === n - 1 ? .4 * Math.sin(t * 8) : 0)));});
   const k = Math.floor(loop(t, .6) * 8); walk.forEach((w, i) => {w.visible = i <= k && i > k - 3;}); ticket.position.set(0, .85, -2.35 + .35 * loop(t, .5)); ticket.scale.z = .2 + p * .5 + .3 * loop(t, .5);
  });
  plate(c);
 };
})(globalThis);
