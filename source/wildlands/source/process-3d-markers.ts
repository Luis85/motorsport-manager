/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-three.d.ts" />
/**
 * Work markers of the Process Studio 3D view (LWProcess3DMarkers): up to 120 tokens per frame, active work first, as articulated
 * desk actors (at most three per room and 32 in the view, working tokens of people's steps that are not escalated) or as compact
 * markers. Presentation only: it reads the detached snapshot it is given and never ticks.
 *  - Compact markers use the 2D map's state encoding (LWProcessMapMarks.STATES): Working a filled disc, Waiting a ring, Timer an
 *    hourglass, Backlog a square and Blocked a cross, in the stage legend's colours (the process.css state tokens read from the
 *    canvas). Each shape is one low-poly geometry shared by every marker of that state (`geometry.userData.shape` names it, and
 *    each marker carries `userData.status`); escalated tokens keep their shape in the escalated colour.
 *  - Actors are presentation of active work, not staff or capacity. Their desk, legs and screen are baked once per scene, so an
 *    actor costs six draws; hands, head and posture animate only while the run plays (`animate`).
 */
declare namespace LWProcess3DMarkers {
 type Shape = 'disc' | 'ring' | 'hourglass' | 'square' | 'cross';
 interface Markers {
  /** Place markers for `tokens` (already filtered to the visible rooms); returns whether any actor is shown. */
  sync(tokens: readonly LWProcess.Token[], steps: ReadonlyMap<string, LWProcess.Step>): boolean;
  /** Pose every actor for animation time `phase`. */
  animate(phase: number): void;
  dispose(): void;
 }
 interface Api {
  /** The marker shape of each work state, in legend order. */
  readonly SHAPES: Readonly<Record<LWProcessMapMarks.Status, Shape>>;
  create(T: LWThree.Module, scene: LWThree.Scene, kit: LWProcessRooms.Kit, canvas: HTMLCanvasElement): Markers;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcess3DBake: LWProcess3DBake.Api; LWProcessMapMarks: LWProcessMapMarks.Api; LWProcess3DMarkers?: LWProcess3DMarkers.Api};
 type Status = LWProcessMapMarks.Status;
 type Piece = LWProcess3DBake.Piece;
 const AUTOMATED = new Set(['touchpoint', 'machine', 'system']), LIMIT = 120, ACTORS = 32, PER_ROOM = 3;
 const SHAPES: Record<Status, LWProcess3DMarkers.Shape> = {active: 'disc', queued: 'ring', timer: 'hourglass', backlog: 'square', held: 'cross'};
 /** State colours: the process.css tokens of the legend, with the same values as fallbacks for a canvas outside the studio. */
 const TOKENS: Record<Status | 'escalated', [string, string]> = {
  active: ['--accent', '#ffbb73'], queued: ['--state-queue', '#91b9d5'], timer: ['--state-timer', '#d9c58a'],
  backlog: ['--state-backlog', '#b79ad6'], held: ['--danger', '#e07a7a'], escalated: ['--escalated', '#ff8a5c'],
 };
 const p = (kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, turn?: LWThree.Turn): Piece =>
  turn ? {kind, x, y, z, sx, sy, sz, color, turn} : {kind, x, y, z, sx, sy, sz, color};
 /** Compact marker shapes centred on their marker position, about 0.36 units across. */
 const SHAPE_PIECES: Record<Exclude<LWProcess3DMarkers.Shape, 'ring'>, Piece[]> = {
  disc: [p('cylinder', 0, 0, 0, .18, .1, .18, '#ffffff')],
  hourglass: [p('cone', 0, -.1, 0, .16, .2, .16, '#ffffff', [Math.PI, 0, 0]), p('cone', 0, .1, 0, .16, .2, .16, '#ffffff')],
  square: [p('box', 0, 0, 0, .32, .1, .32, '#ffffff')],
  cross: [p('box', 0, 0, 0, .42, .08, .1, '#ffffff', [0, Math.PI / 4, 0]), p('box', 0, 0, 0, .42, .08, .1, '#ffffff', [0, -Math.PI / 4, 0])],
 };
 /** Actor parts in their own group's coordinates: the static desk set, the torso, the head and one hand. */
 const DESK: Piece[] = [
  ...[-.16, .16].flatMap(x => [p('box', x, .38, 0, .18, .55, .22, '#52677b'), p('box', x, .12, -.09, .21, .16, .4, '#18232f')]),
  p('box', 0, .87, -.65, 1.2, .08, .7, '#a3876d'), ...[-.48, .48].map(x => p('box', x, .43, -.65, .06, .86, .5, '#596b7c')),
  p('box', 0, 1.19, -.87, .67, .46, .07, '#192a36'), ...[1.12, 1.2, 1.28].map(y => p('box', -.05, y, -.81, .33, .016, .01, '#d7edf1')),
  p('box', 0, .925, -.53, .55, .03, .22, '#354e63'), p('cylinder', .44, .99, -.57, .08, .16, .08, '#e2d8c6'),
 ];
 const TORSO = [p('box', 0, .88, 0, .5, .64, .3, '#c79062')];
 const HEAD = [p('ball', 0, 0, 0, .23, .25, .22, '#d5ac88'), p('ball', 0, .13, .04, .235, .15, .2, '#37404b')];
 const HAND = [p('box', 0, -.12, -.15, .16, .2, .45, '#c79062'), p('ball', 0, -.14, -.39, .1, .09, .1, '#d5ac88')];
 interface Actor {group: LWThree.Group; body: LWThree.Group; head: LWThree.Group; hands: LWThree.Group[]; phase: number}
 interface Marker {object: LWThree.Object3D; actor: Actor | null}
 function create(T: LWThree.Module, scene: LWThree.Scene, kit: LWProcessRooms.Kit, canvas: HTMLCanvasElement): LWProcess3DMarkers.Markers {
  const bake = root.LWProcess3DBake, owned: LWThree.BufferGeometry[] = [], base = new Map<string, LWThree.BufferGeometry>();
  const unit = (kind: string) => {
   let g = base.get(kind);
   if (!g) {
    g = bake.shape(T, kind);
    base.set(kind, g);
    owned.push(g);
   }
   return g;
  };
  const baked = (pieces: Piece[]) => {
   const g = bake.bake(T, unit, [pieces]).geometry;
   owned.push(g);
   return g;
  };
  const shapes = new Map<Status, LWThree.BufferGeometry>();
  for (const {status} of root.LWProcessMapMarks.STATES) {
   const name = SHAPES[status];
   const g = name === 'ring' ? new T.TorusGeometry(.15, .045, 6, 18).rotateX(Math.PI / 2) : baked(SHAPE_PIECES[name]);
   if (name === 'ring') owned.push(g);
   g.userData.shape = name;
   shapes.set(status, g);
  }
  const style = getComputedStyle(canvas);
  const colour = (key: Status | 'escalated') => style.getPropertyValue(TOKENS[key][0]).trim() || TOKENS[key][1];
  const tints = new Map<Status | 'escalated', LWThree.Material>();
  for (const key of Object.keys(TOKENS) as (Status | 'escalated')[]) tints.set(key, kit.mat(colour(key)));
  let parts: Record<'desk' | 'torso' | 'head' | 'hand', LWThree.BufferGeometry> | null = null;
  const tinted = kit.mat('#ffffff', {vertexColors: true}), screen = kit.mat('#83b9c8', {emissive: '#326578', emissiveIntensity: .35});
  function mesh(parent: LWThree.Object3D, geometry: LWThree.BufferGeometry, material: LWThree.Material): LWThree.Mesh {
   const m = new T.Mesh(geometry, material);
   m.castShadow = true;
   m.receiveShadow = true;
   parent.add(m);
   return m;
  }
  function actor(): Actor {
   parts ??= {desk: baked(DESK), torso: baked(TORSO), head: baked(HEAD), hand: baked(HAND)};
   const group = kit.group(scene), body = kit.group(group), head = kit.group(body);
   // Each actor represents one active work token, not an additional resource allocation.
   mesh(group, parts.desk, tinted);
   const glass = mesh(group, unit('box'), screen);
   glass.position.set(0, 1.19, -.824);
   glass.scale.set(.56, .34, .015);
   mesh(body, parts.torso, tinted);
   head.position.set(0, 1.38, 0);
   mesh(head, parts.head, tinted);
   const hands = [-.34, .34].map(x => {
    const pivot = kit.group(body);
    pivot.position.set(x, 1.08, 0);
    mesh(pivot, parts!.hand, tinted);
    return pivot;
   });
   group.userData = {body, head, hands, actor: true};
   return {group, body, head, hands, phase: 0};
  }
  function compact(): LWThree.Mesh {
   const m = new T.Mesh(shapes.get('queued')!, tints.get('queued')!);
   m.castShadow = false;
   m.receiveShadow = true;
   scene.add(m);
   return m;
  }
  const markers = new Map<string, Marker>();
  function sync(tokens: readonly LWProcess.Token[], steps: ReadonlyMap<string, LWProcess.Step>): boolean {
   const shown = [...tokens].sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active')).slice(0, LIMIT);
   const live = new Set(shown.map(t => t.id));
   for (const [id, marker] of markers) {
    if (live.has(id)) continue;
    scene.remove(marker.object);
    markers.delete(id);
   }
   const activeCounts = new Map<string, number>(), queueCounts = new Map<string, number>();
   let actors = 0;
   for (const token of shown) {
    const working = token.status === 'active', counts = working ? activeCounts : queueCounts, at = counts.get(token.stepId) ?? 0;
    counts.set(token.stepId, at + 1);
    const step = steps.get(token.stepId);
    if (!step) continue;
    const detailed = working && !token.escalated && !AUTOMATED.has(step.kind) && at < PER_ROOM && actors++ < ACTORS;
    let marker = markers.get(token.id);
    if (marker && !!marker.actor !== detailed) {
     scene.remove(marker.object);
     markers.delete(token.id);
     marker = undefined;
    }
    if (!marker) {
     const rig = detailed ? actor() : null;
     marker = {object: rig ? rig.group : compact(), actor: rig};
     markers.set(token.id, marker);
    }
    const [x, z] = step.scene.position, o = marker.object;
    o.position.set(x + (detailed ? -2.5 + at * 2.5 : -4 + at % 16 * .5), detailed ? .04 : .25 + Math.floor(at / 16) * .18,
     z + (detailed ? 2.4 : working ? 3.3 : 3.85));
    const phase = Number(token.id.split('-').at(-1)) * 1.7;
    if (marker.actor) marker.actor.phase = phase;
    Object.assign(o.userData, {phase, escalated: !!token.escalated, item: token.item ?? null});
    if (!marker.actor) {
     const status = root.LWProcessMapMarks.statusOf(token), m = o as LWThree.Mesh;
     m.geometry = shapes.get(status)!;
     m.material = tints.get(token.escalated ? 'escalated' : status)!;
     Object.assign(o.userData, {token: token.id, status, shape: SHAPES[status]});
    }
   }
   return [...markers.values()].some(m => m.actor);
  }
  function animate(phase: number): void {
   for (const {actor: rig} of markers.values()) {
    if (!rig) continue;
    const t = phase * 9 + rig.phase;
    rig.hands.forEach((hand, i) => {hand.rotation.x = Math.sin(t + i * Math.PI) * .19;});
    rig.head.rotation.x = -.12 + Math.sin(t * .28) * .065;
    rig.head.rotation.y = Math.sin(t * .18) * .12;
    rig.body.rotation.z = Math.sin(t * .3) * .025;
   }
  }
  function dispose(): void {
   for (const marker of markers.values()) scene.remove(marker.object);
   markers.clear();
   owned.forEach(g => g.dispose());
   owned.length = 0;
  }
  return {sync, animate, dispose};
 }
 root.LWProcess3DMarkers = Object.freeze({SHAPES, create});
})(globalThis);
