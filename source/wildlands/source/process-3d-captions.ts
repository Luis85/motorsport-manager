/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-three.d.ts" />
/**
 * Room captions of the Process Studio 3D view (LWProcess3DCaptions): the name pill and the front caption of each room, their
 * wording and their readable size. Presentation only; nothing here reads a session, only the detached snapshot it is given.
 *  - A caption is a sprite on a dark pill, never depth-tested and drawn last, so props can neither strike through nor hide it. Its
 *    scale and anchor describe a 640 x 128 logical box (the unit the readability rules measure); the canvas holds only the pill,
 *    sized to the measured text (rounded up to a multiple of 32 x 16 pixels, at most 640 x 128), and the sprite's own quad covers
 *    just that canvas in the middle of the box. A canvas grows or shrinks when its text does, and `free` releases it with the quad;
 *    `held()` reports the canvases and pixels still held.
 *  - Held work (`StepMetric.held`, part of `queued`) reads as blocked, not waiting: "2 working · 3 waiting · 1 blocked".
 *  - Readability: room names keep about 11 px in the overview, wrapping to the room spacing. Front captions grow until their lines
 *    reach 12 px, up to the width of a room (a selected room may widen its caption to most of the stage); an overview caption that
 *    would still be smaller is not drawn, like the 2D map's secondary text.
 */
declare namespace LWProcess3DCaptions {
 /** A caption sprite and its pill: `draw` re-renders the pill (a string wraps to two lines, an array is one line each). */
 interface Caption {
  readonly sprite: LWThree.Sprite; readonly font: number;
  draw(value: string | string[], maxWidth?: number): void;
  /** Release the canvas and texture (the sprite's material is freed with the scene). */
  free(): void;
 }
 interface Held {canvases: number; pixels: number}
 /** A room's front caption and the room-name scale, laid out from the camera each frame (see the module header). */
 interface Layout {apply(ppu: number, selected: boolean, stageWidth: number): void}
 interface Api {
  caption(T: LWThree.Module, text: string | string[], color: string, font?: number): Caption;
  /** Caption canvases and their pixels held by every live 3D scene of the page. */
  held(): Held;
  /** The first caption line: the step's live state in words. `stored` counts its backlog (and waiting work for task-like steps). */
  status(step: LWProcess.Step, metric: LWProcess.StepMetric, stored: number): string;
  /** The second caption line (may be empty): live instance items, item counters and deadline outcomes. */
  extra(step: LWProcess.Step, metric: LWProcess.StepMetric, tokens: readonly LWProcess.Token[]): string;
  /** The fixed sub-label: room theme, kind, technology, instances, deadline and duration. */
  sub(step: LWProcess.Step, theme: LWProcessRooms.Theme): string;
  layout(names: {caption: Caption; text: string}[], fronts: Caption[], moods: readonly LWThree.Sprite[], spacing: number): Layout;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcess3DCaptions?: LWProcess3DCaptions.Api};
 /** The logical box of every caption, in canvas pixels; the sprite scale maps it to world units. */
 const BOX = {w: 640, h: 128};
 const held: LWProcess3DCaptions.Held = {canvases: 0, pixels: 0};
 let measurer: CanvasRenderingContext2D | null = null;
 const measure = () => measurer ??= document.createElement('canvas').getContext('2d')!;
 function lines(ctx: CanvasRenderingContext2D, value: string | string[], maxWidth: number): string[] {
  const ellipsis = (s: string) => {
   while (s.length > 1 && ctx.measureText(s).width > maxWidth) s = s.slice(0, -2).trimEnd() + '…';
   return s;
  };
  const shorten = (s: string) => ctx.measureText(s).width <= maxWidth ? s : ellipsis(s.replace(/…$/, ''));
  if (Array.isArray(value)) return value.map(shorten);
  const words = value.split(' ');
  let first = '', i = 0;
  for (; i < words.length; i++) {
   const next = first ? first + ' ' + words[i] : words[i]!;
   if (first && ctx.measureText(next).width > maxWidth) break;
   first = next;
  }
  return i < words.length ? [shorten(first), shorten(words.slice(i).join(' '))] : [shorten(first)];
 }
 function pill(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  const r = 14;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(14,18,24,.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(177,189,205,.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
 }
 function caption(T: LWThree.Module, text: string | string[], color: string, font = 34): LWProcess3DCaptions.Caption {
  const c = document.createElement('canvas');
  c.width = 0;
  c.height = 0;
  const texture = new T.CanvasTexture(c);
  const sprite = new T.Sprite(new T.SpriteMaterial({map: texture, transparent: true, depthTest: false, depthWrite: false}));
  sprite.renderOrder = 20;
  sprite.scale.set(8, 1.6, 1);
  // The quad spans the canvas's share of the logical box, so no texel outside the pill is ever sampled.
  const corners = new Float32Array(12), quad = new T.BufferGeometry(), position = new T.BufferAttribute(corners, 3);
  quad.setAttribute('position', position).setAttribute('uv', new T.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  quad.setIndex(new T.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
  sprite.geometry = quad;
  held.canvases++;
  let live = true;
  const style = (ctx: CanvasRenderingContext2D) => {
   ctx.font = `600 ${font}px system-ui`;
   ctx.textAlign = 'center';
   ctx.textBaseline = 'middle';
  };
  function draw(value: string | string[], maxWidth = 580): void {
   const m = measure();
   style(m);
   const rows = lines(m, value, maxWidth), lineHeight = font * 1.25;
   const width = Math.min(BOX.w - 4, Math.max(...rows.map(l => m.measureText(l).width)) + 36), height = rows.length * lineHeight + 18;
   const w = Math.min(BOX.w, Math.ceil((width + 4) / 32) * 32), h = Math.min(BOX.h, Math.ceil((height + 4) / 16) * 16);
   if (w !== c.width || h !== c.height) {
    held.pixels += w * h - c.width * c.height;
    c.width = w;
    c.height = h;
    // A new size needs a new GPU texture; the next upload allocates it.
    texture.dispose();
   }
   const ctx = c.getContext('2d')!;
   ctx.clearRect(0, 0, w, h);
   style(ctx);
   pill(ctx, (w - width) / 2, (h - height) / 2, width, height);
   rows.forEach((l, k) => {
    ctx.fillStyle = k ? '#9fb0c4' : color;
    ctx.fillText(l, w / 2, h / 2 + (k - (rows.length - 1) / 2) * lineHeight, maxWidth);
   });
   const x = w / BOX.w / 2, y = h / BOX.h / 2;
   corners.set([-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0]);
   position.needsUpdate = true;
   texture.needsUpdate = true;
  }
  function free(): void {
   if (!live) return;
   live = false;
   held.canvases--;
   held.pixels -= c.width * c.height;
   texture.dispose();
   quad.dispose();
   c.width = 0;
   c.height = 0;
  }
  draw(text);
  return {sprite, font, draw, free};
 }
 function status(step: LWProcess.Step, metric: LWProcess.StepMetric, stored: number): string {
  const join = (...parts: string[]) => parts.filter(Boolean).join(' · ');
  const waiting = metric.queued - metric.held, blocked = metric.held ? `${metric.held} blocked` : '';
  if (step.kind === 'end' && step.outcome) return (step.outcome === 'goal' ? 'Goal' : 'Lost') + ` · ${metric.reached} reached`;
  if (metric.timers.waiting) {
   const timer = `${metric.timers.waiting} on timer · next due minute ${metric.timers.nextDue}`;
   return join(timer, metric.completed ? `${metric.completed} completed` : '', blocked);
  }
  if (step.backlog) return join(`Backlog ${stored}/${step.backlog.capacity}`, metric.active ? `${metric.active} working` : '', blocked);
  const touch = step.kind === 'touchpoint';
  if (metric.active && touch) return join(`${metric.active} in this touchpoint`, waiting ? `${waiting} waiting` : '', blocked);
  if (metric.active) return join(`${metric.active} working`, `${waiting} waiting`, blocked);
  if (metric.queued) return join(waiting ? `${waiting} ${touch ? 'waiting for a team' : 'waiting'}` : '', blocked);
  return metric.completed ? `${metric.completed} completed` : 'Ready';
 }
 function extra(step: LWProcess.Step, metric: LWProcess.StepMetric, tokens: readonly LWProcess.Token[]): string {
  const live = step.instances?.count === undefined ? tokens.find(t => t.stepId === step.id && t.items !== undefined)?.items : undefined;
  return [live !== undefined ? `× ${live} now` : '', metric.items ? `items ${metric.items.started} started · ${metric.items.finished} done` : '',
   metric.deadlines ? `${metric.deadlines.escalated} escalated · ${metric.deadlines.interrupted} interrupted` : ''].filter(Boolean).join(' · ');
 }
 function sub(step: LWProcess.Step, theme: LWProcessRooms.Theme): string {
  const parts = [theme.label];
  if (step.kind !== 'touchpoint') parts.push(step.kind);
  if (step.technology) parts.push(step.technology);
  if (step.instances) parts.push(step.instances.count !== undefined ? '× ' + step.instances.count : `× per case (${step.instances.field})`);
  if (step.deadline) parts.push('deadline ' + (step.deadline.after !== undefined ? step.deadline.after + ' min' : 'random') + ' ' + step.deadline.mode);
  if (step.kind === 'timer') parts.push(step.until !== undefined ? 'until minute ' + step.until : (step.duration ?? 0) + ' min');
  else if (step.duration) parts.push(step.duration + ' min');
  return parts.join(' · ');
 }
 function layout(names: {caption: LWProcess3DCaptions.Caption; text: string}[], fronts: LWProcess3DCaptions.Caption[],
  moods: readonly LWThree.Sprite[], spacing: number): LWProcess3DCaptions.Layout {
  let nameScale = 0, frontKey = '';
  return {apply(ppu, selected, stageWidth) {
   // A selected room may widen its caption to most of the stage; in the overview a caption stays within the room spacing.
   const widest = selected ? Math.max(2, Math.max(1, stageWidth) * .92 / ppu / 6) : Math.min(spacing * .94, 12) / 6;
   const wanted = fronts.map(f => Math.ceil(Math.max(1, 12 / (f.font * .009375 * ppu)) * 4) / 4);
   const key = wanted.map(c => c <= widest || selected ? Math.min(c, widest).toFixed(2) : 0).join();
   if (key !== frontKey) {
    frontKey = key;
    // A wider caption hangs further forward so its ends clear the rotated front edge.
    fronts.forEach((f, n) => {
     const c = Math.min(wanted[n]!, widest);
     f.sprite.visible = selected || wanted[n]! <= widest;
     f.sprite.scale.set(6 * c, 1.2 * c, 1);
     f.sprite.position.z = 5.9 + (c - 1);
    });
   }
   const k = Math.round(Math.max(1, Math.min(8, 11 / (.425 * ppu))) * 4) / 4;
   if (k === nameScale) return;
   nameScale = k;
   const maxWidth = Math.max(180, Math.min(580, Math.floor(spacing * .94 / k * 80) - 40));
   for (const n of names) {
    n.caption.sprite.scale.set(8 * k, 1.6 * k, 1);
    n.caption.draw(n.text, maxWidth);
   }
   const size = Math.max(2.2, 1.9 * k);
   for (const m of moods) {
    m.scale.set(size, size, 1);
    m.position.y = 4.6 + 1.6 * k + .15;
   }
  }};
 }
 root.LWProcess3DCaptions = Object.freeze({caption, held: () => ({...held}), status, extra, sub, layout});
})(globalThis);
