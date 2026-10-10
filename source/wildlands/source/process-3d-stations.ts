/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-three.d.ts" />
/**
 * The rooms of the Process Studio 3D view (LWProcess3DStations): one station per step (floor, walls, floor panels and plant, the
 * themed room from LWProcessRooms or the authored asset, a status lamp, a progress bar, the inclusive-fork marker, the name pill
 * and the front caption), the amber frame of the selected room, the flow arrows, and the per-snapshot room update. Presentation
 * only: `update` reads the detached snapshot it is given and never ticks.
 *  - Static furniture goes through the kit's fixed pieces, so all rooms' floors, walls and furniture share a few merged meshes.
 *  - Each room has an invisible floor proxy (`userData.stepId`, in a picking group outside the room) for picking it with a click.
 *  - Flow arrows are two merged meshes (lines and heads, vertex-coloured); each flow keeps an empty record object whose `userData`
 *    names it (`flow`, `deadline`, `conditional`, `color`). Deadline paths are red when the work is interrupted and amber when it
 *    escalates beside it; conditional paths are tan.
 *  - Front captions carry their text in `userData.caption` ("<state> | <extra> | <sub-label>").
 */
declare namespace LWProcess3DStations {
 interface Stations {
  /** Floor proxies of the rooms shown, for picking. */
  hits(): LWThree.Object3D[];
  readonly names: {caption: LWProcess3DCaptions.Caption; text: string}[];
  readonly fronts: LWProcess3DCaptions.Caption[];
  /** The smallest distance between two rooms (at most 14), which bounds overview captions. */
  readonly spacing: number;
  /** Show every room (null) or only the selected one with its frame. */
  show(selected: string | null): void;
  /** Bring lamps, bars, captions and the working/idle room variants up to `snapshot`. */
  update(snapshot: LWProcess.Snapshot): void;
  /** Animate the visible rooms; returns whether any visible room moves its props. */
  animate(phase: number, selected: string | null): boolean;
  dispose(): void;
 }
 interface Api {build(T: LWThree.Module, scene: LWThree.Scene, kit: LWProcess3DKit.Kit, definition: LWProcess.Definition): Stations;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessRooms: LWProcessRooms.Api; LWProcess3DCaptions: LWProcess3DCaptions.Api; LWProcess3DBake: LWProcess3DBake.Api;
  LWAssetRenderer: {createFromDefinition(kit: LWProcessRooms.Kit, parent: LWThree.Object3D, input: unknown, model?: string): unknown};
  LWProcess3DStations?: LWProcess3DStations.Api};
 const AUTOMATED = new Set(['touchpoint', 'machine', 'system']);
 const TONE: Record<string, string> = {interrupt: '#e07a7a', escalate: '#e6b04a'}, CONDITIONAL = '#c79871', PLAIN = '#61738a';
 interface Station {step: LWProcess.Step; group: LWThree.Group; room: LWProcessRooms.Room; lamp: LWThree.Mesh; bar: LWThree.Mesh;
  front: LWProcess3DCaptions.Caption; sub: string; progress: number}
 /** Process Forge starter geometry (desk/monitor or podium/marker) yields to the themed room. */
 function isStarterAsset(asset: unknown): boolean {
  const ids = new Set(((asset as {models?: {world?: {nodes?: {id?: string}[]}}}).models?.world?.nodes ?? []).map(n => n.id));
  return ids.has('desk') && ids.has('monitor') || ids.has('podium') && ids.has('marker');
 }
 function build(T: LWThree.Module, scene: LWThree.Scene, kit: LWProcess3DKit.Kit, definition: LWProcess.Definition): LWProcess3DStations.Stations {
  const captions = root.LWProcess3DCaptions, stations = new Map<string, Station>(), hits: LWThree.Object3D[] = [];
  const names: {caption: LWProcess3DCaptions.Caption; text: string}[] = [], fronts: LWProcess3DCaptions.Caption[] = [];
  const hitMaterial = kit.mat('#000000'), picking = kit.group(scene);
  picking.visible = false;
  for (const step of definition.steps) {
   const [px, pz] = step.scene.position, g = kit.station(step.id, px, pz), theme = root.LWProcessRooms.theme(step);
   const hit = new T.Mesh(kit.shape('box'), hitMaterial);
   hit.position.set(px, -.16, pz);
   hit.scale.set(10, .3, 9);
   hit.userData.stepId = step.id;
   picking.add(hit);
   hits.push(hit);
   kit.fixed(g, 'box', 0, -.16, 0, 10, .3, 9, '#293544');
   kit.fixed(g, 'box', 0, .01, -4.35, 10, .1, .18, step.scene.color);
   // Low walls and inset floor panels tinted per room theme; the themed workstation and its idle variant come from LWProcessRooms.
   kit.fixed(g, 'box', 0, .7, -4.35, 10, 1.4, .14, theme.wall);
   kit.fixed(g, 'box', -4.9, .7, -2.8, .14, 1.4, 3.2, theme.wall);
   for (const x of [-3.75, -1.25, 1.25, 3.75]) for (const z of [-3, -.5, 2]) kit.fixed(g, 'box', x, .006, z, 2.46, .015, 2.46, theme.floor);
   kit.fixed(g, 'cylinder', 4.05, .3, -3.2, .36, .6, .36, '#b99c7f');
   for (const [x, y] of [[3.85, 1.05], [4.15, 1.35], [4.35, .95]] as const) kit.fixed(g, 'ball', x, y, -3.2, .28, .55, .28, '#6d9585');
   // Custom attached geometry is drawn as authored.
   const custom = !!step.scene.asset && !isStarterAsset(step.scene.asset);
   if (custom) root.LWAssetRenderer.createFromDefinition(kit, g, step.scene.asset, 'world');
   const room = root.LWProcessRooms.build(kit, g, step, !custom);
   room.setActive(false);
   const name = captions.caption(T, step.name, '#edf2f7');
   name.sprite.center.set(.5, 0);
   name.sprite.position.set(0, 4.6, -2.2);
   g.add(name.sprite);
   names.push({caption: name, text: step.name});
   // The room kind sub-label shares the front caption pill with the count, so nothing floats over the props.
   const sub = captions.sub(step, theme);
   const lamp = kit.piece(g, 'ball', 4.35, 1.65, -4.25, .12, .12, .12, '#91b9d5');
   kit.fixed(g, 'box', 0, .12, 4.2, 8, .07, .12, '#15222e');
   const bar = kit.piece(g, 'box', -4, .17, 4.2, .001, .07, .14, '#ffbb73');
   bar.visible = false;
   if (step.kind === 'fork' && step.mode === 'inclusive') {
    // A gateway diamond with a ring on a post by the back wall marks the inclusive fork; the diamond carries the marker for checks.
    const diamond = kit.piece(g, 'box', -4.1, 2.25, -4.2, .85, .85, .14, '#c79871');
    diamond.rotation.z = Math.PI / 4;
    diamond.userData.glyph = 'inclusive-fork';
    kit.fixed(g, 'ring', -4.1, 2.25, -4.1, .3, .3, .3, '#13181f');
    kit.fixed(g, 'cylinder', -4.1, 1.35, -4.2, .05, 1.2, .05, '#c79871');
   }
   // The caption hangs below the room's front edge (its top on the floor edge), clear of the queue rail and bench.
   const front = captions.caption(T, ['Ready', sub], '#e3eaf2', step.instances || step.deadline ? 25 : 30);
   front.sprite.center.set(.5, 1);
   front.sprite.position.set(0, .05, 5.9);
   front.sprite.scale.multiplyScalar(.75);
   g.add(front.sprite);
   fronts.push(front);
   stations.set(step.id, {step, group: g, room, lamp, bar, front, sub, progress: 0});
  }
  // Amber frame around the room entered by selection; the whole-process view has none.
  const focus = kit.group(scene);
  focus.visible = false;
  for (const [x, z, w, d] of [[0, -4.7, 10.4, .14], [0, 4.7, 10.4, .14], [-5.2, 0, .14, 9.4], [5.2, 0, .14, 9.4]] as const) {
   kit.fixed(focus, 'box', x, .05, z, w, .08, d, '#ffbb73', {emissive: '#ff9a3c', emissiveIntensity: .6});
  }
  const links = flows(T, scene, kit, definition);
  kit.seal();
  let spacing = 14;
  for (const [i, a] of definition.steps.entries()) for (const b of definition.steps.slice(i + 1)) {
   const d = Math.hypot(a.scene.position[0] - b.scene.position[0], a.scene.position[1] - b.scene.position[1]);
   if (d > 1) spacing = Math.min(spacing, d);
  }
  let shownHits = hits;
  function show(selected: string | null): void {
   for (const [id, s] of stations) s.group.visible = !selected || selected === id;
   shownHits = selected ? hits.filter(h => h.userData.stepId === selected) : hits;
   links.visible = !selected;
   kit.show(selected);
   const chosen = selected ? stations.get(selected) : undefined;
   focus.visible = !!chosen;
   if (chosen) focus.position.set(chosen.step.scene.position[0], 0, chosen.step.scene.position[1]);
  }
  function update(snapshot: LWProcess.Snapshot): void {
   const metrics = new Map(snapshot.steps.map(m => [m.id, m])), byStep = new Map<string, LWProcess.Token[]>();
   for (const t of snapshot.tokens) {
    const list = byStep.get(t.stepId);
    if (list) list.push(t); else byStep.set(t.stepId, [t]);
   }
   for (const [id, s] of stations) {
    const metric = metrics.get(id), step = s.step, here = byStep.get(id) ?? [];
    if (!metric) continue;
    const active = here.filter(t => t.status === 'active'), duration = step.duration ?? 1;
    s.progress = active.length ? active.reduce((n, t) => n + (duration - t.remaining) / duration, 0) / active.length : 0;
    const taskLike = step.kind === 'task' || AUTOMATED.has(step.kind);
    const stored = here.filter(t => t.status === 'backlog' || taskLike && t.status === 'queued').length;
    s.room.setActive(metric.active > 0 || metric.timers.waiting > 0 || step.kind === 'join' && stored > 0);
    s.room.setQueued(metric.queued);
    s.room.setBacklog(step.backlog ? stored : 0);
    s.bar.visible = s.progress > 0;
    s.bar.scale.x = Math.max(.001, s.progress * 8);
    s.bar.position.x = -4 + s.progress * 4;
    const tone = metric.active ? '#ffbb73' : metric.timers.waiting ? '#d9c58a' : metric.queued ? '#91b9d5' : '#6d9585';
    s.lamp.material = kit.mat(tone, {emissive: metric.active ? '#704c2d' : '#000000'});
    const extra = captions.extra(step, metric, here), lines = [captions.status(step, metric, stored), ...extra ? [extra] : [], s.sub];
    const text = lines.join(' | ');
    if (s.front.sprite.userData.caption === text) continue;
    s.front.draw(lines);
    s.front.sprite.userData.caption = text;
   }
  }
  function animate(phase: number, selected: string | null): boolean {
   let moving = false;
   for (const [id, s] of stations) {
    if (selected && selected !== id) continue;
    s.room.animate(phase, s.progress); moving ||= s.room.moving;
   }
   return moving;
  }
  function dispose(): void {
   for (const n of names) n.caption.free();
   for (const f of fronts) f.free();
  }
  return {hits: () => shownHits, names, fronts, spacing, show, update, animate, dispose};
 }
 /** Flow arrows from room to room as two merged meshes, plus one record object per flow for checks. */
 function flows(T: LWThree.Module, scene: LWThree.Scene, kit: LWProcess3DKit.Kit, definition: LWProcess.Definition): LWThree.Group {
  const links = kit.group(scene), at = new Map(definition.steps.map(s => [s.id, s])), segments: number[] = [], colours: number[] = [];
  const heads: LWProcess3DBake.Piece[] = [];
  for (const f of definition.flows) {
   const a = at.get(f.from)?.scene.position, b = at.get(f.to)?.scene.position;
   if (!a || !b) continue;
   const late = f.on === 'deadline', from = new T.Vector3(a[0], .05, a[1]), dir = new T.Vector3(b[0], .05, b[1]).sub(from);
   const length = dir.length();
   if (length < .01) continue;
   // A deadline path runs level, a little above the others.
   dir.normalize();
   if (late) from.y += .12;
   const color = late ? TONE[at.get(f.from)?.deadline?.mode ?? 'interrupt']! : f.when ? CONDITIONAL : PLAIN, tint = new T.Color(color);
   // The arrow is as long as the gap between the rooms minus 3, with a head 0.8 long and 0.45 wide.
   const reach = Math.max(.1, length - 3), end = from.clone().addScaledVector(dir, Math.max(.0001, reach - .8));
   segments.push(from.x, from.y, from.z, end.x, end.y, end.z); colours.push(tint.r, tint.g, tint.b, tint.r, tint.g, tint.b);
   const head = from.clone().addScaledVector(dir, reach - .4);
   heads.push({kind: 'cone', x: head.x, y: head.y, z: head.z, sx: .225, sy: .8, sz: .225, color,
    turn: [0, Math.atan2(dir.z, -dir.x), Math.acos(Math.max(-1, Math.min(1, dir.y)))]});
   const record = new T.Object3D();
   record.userData = {flow: f.id, deadline: late, conditional: !!f.when, color}; links.add(record);
  }
  if (!segments.length) return links;
  const lines = new T.BufferGeometry();
  lines.setAttribute('position', new T.BufferAttribute(new Float32Array(segments), 3));
  lines.setAttribute('color', new T.BufferAttribute(new Float32Array(colours), 3));
  links.add(new T.LineSegments(lines, new T.LineBasicMaterial({vertexColors: true, toneMapped: false})));
  const baked = root.LWProcess3DBake.bake(T, kind => kit.shape(kind), [heads]).geometry;
  links.add(new T.Mesh(baked, new T.MeshBasicMaterial({vertexColors: true, toneMapped: false})));
  return links;
 }
 root.LWProcess3DStations = Object.freeze({build});
})(globalThis);
