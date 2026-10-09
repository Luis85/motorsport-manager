/// <reference path="./process-contracts.d.ts" />
/** Three.js view using the engine's asset interpreter. Camera and interpolation are presentation only. */
declare namespace LWProcess3D {
 interface Surface {draw(view: LWProcessApp.View, delta: number): void; frame(): void; dispose(): void;}
 interface Api {create(canvas: HTMLCanvasElement, definition: LWProcess.Definition, select: (id: string) => void): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 // Vendored Three.js has the same intentionally loose adapter boundary as pet-renderer.ts.
 type O = any;
 const root = inputRoot as {THREE: O; LWAssetRenderer: {createFromDefinition(kit: O, parent: O, input: unknown, model?: string): {root: O}}; LWProcessRooms: LWProcessRooms.Api; LWProcess3D?: LWProcess3D.Api};
 function create(canvas: HTMLCanvasElement, definition: LWProcess.Definition, select: (id: string) => void): LWProcess3D.Surface {
  const renderer = new root.THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  try {return build(renderer, canvas, definition, select);}
  catch (e) {renderer.dispose(); renderer.forceContextLoss(); throw e;}
 }
 function build(renderer: O, canvas: HTMLCanvasElement, definition: LWProcess.Definition, select: (id: string) => void): LWProcess3D.Surface {
  const T = root.THREE, AUTOMATED = new Set(['touchpoint', 'machine', 'system']);
  // Deadline paths are red when the work is interrupted and amber when it escalates beside it; escalated tokens have their own colour.
  const TONE: Record<string, string> = {interrupt: '#e07a7a', escalate: '#e6b04a'}, ESCALATED = '#ff8a5c';
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor('#13181f');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(38, 1, .1, 3000), target = new T.Vector3();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const stepIndex = new Map(definition.steps.map(s => [s.id, s]));
  const rooms = new Map<string, LWProcessRooms.Room>(), moods: O[] = [], roomProgress = new Map<string, number>(), indicators = new Map<string, {bar: O; lamp: O; status: O; sub: string; font: number}>(), names: {sprite: O; text: string}[] = [];
  let needsRender = true;
  const motionChanged = () => {needsRender = true;}; reducedMotion.addEventListener('change', motionChanged);
  let phase = 0, previousView: LWProcessApp.View | undefined;
  const objects: O[] = [], textures: O[] = [], stations = new Map<string, O>(), markers = new Map<string, O>();
  let selected: string | null | undefined, yaw = -.3, pitch = .65, distance = 85, dragging: 'orbit' | 'pan' | null = null, moved = false, px = 0, py = 0;
  let panBounds = {minX: 0, maxX: 0, minZ: 0, maxZ: 0};
  let viewportWidth = 0, viewportHeight = 0;
  const geometries = new Map<string, O>(), materials = new Map<string, O>();
  function isStarterAsset(asset: unknown): boolean {
   const ids = new Set(((asset as {models?: {world?: {nodes?: {id?: string}[]}}}).models?.world?.nodes ?? []).map(n => n.id));
   return ids.has('desk') && ids.has('monitor') || ids.has('podium') && ids.has('marker');
  }
  function geometry(kind: string): O {
   if (!geometries.has(kind)) geometries.set(kind, kind === 'box' ? new T.BoxGeometry(1, 1, 1) : kind === 'ground' ? new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    : kind === 'cone' || kind === 'roof' ? new T.ConeGeometry(1, 1, kind === 'roof' ? 4 : 8) : kind === 'cylinder' ? new T.CylinderGeometry(1, 1, 1, 12)
    : kind === 'ring' ? new T.TorusGeometry(1, .07, 6, 20) : new T.SphereGeometry(1, 12, 8));
   return geometries.get(kind);
  }
  function mat(color: string, extra: Record<string, unknown> = {}): O {
   const key = color + JSON.stringify(extra);
   if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({color, roughness: .8, ...extra}));
   return materials.get(key);
  }
  const kit: O = {T, mat, group(parent: O) {const g = new T.Group(); parent.add(g); return g;},
   piece(parent: O, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, _rotation = 0, extra = {}) {
    const mesh = new T.Mesh(geometry(kind), mat(color, extra)); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
   }};
  scene.add(new T.HemisphereLight('#d9e8ff', '#38434e', 1.6));
  const light = new T.DirectionalLight('#fff1df', 1.8); light.position.set(10, 40, 20); light.castShadow = true; light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -.0004; light.shadow.normalBias = .04; scene.add(light); scene.add(light.target);
  const fill = new T.DirectionalLight('#a9cddd', 1.2); fill.position.set(-20, 15, -25); scene.add(fill);
  /** Caption sprite on a dark pill: never depth-tested and drawn last, so props can neither strike through nor hide it. `draw` re-renders the pill (a string wraps to two lines, an array is one line each). */
  function label(text: string | string[], color: string, font = 34): O {
   const c = document.createElement('canvas'); c.width = 640; c.height = 128;
   const texture = new T.CanvasTexture(c); textures.push(texture);
   const m = new T.SpriteMaterial({map: texture, transparent: true, depthTest: false, depthWrite: false}); materials.set('label-' + materials.size, m);
   const sprite = new T.Sprite(m); sprite.renderOrder = 20; sprite.scale.set(8, 1.6, 1);
   sprite.userData.draw = (value: string | string[], maxWidth = 580) => {
    const ctx = c.getContext('2d')!; ctx.clearRect(0, 0, c.width, c.height); ctx.font = `600 ${font}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const ellipsis = (s: string) => {while (s.length > 1 && ctx.measureText(s).width > maxWidth) s = s.slice(0, -2).trimEnd() + '…'; return s;};
    const shorten = (s: string) => ctx.measureText(s).width <= maxWidth ? s : ellipsis(s.replace(/…$/, ''));
    let lines: string[];
    if (Array.isArray(value)) lines = value.map(shorten);
    else {
     const words = value.split(' '); let first = '', i = 0;
     for (; i < words.length; i++) {const next = first ? first + ' ' + words[i] : words[i]!; if (first && ctx.measureText(next).width > maxWidth) break; first = next;}
     lines = [shorten(first)]; if (i < words.length) lines.push(shorten(words.slice(i).join(' ')));
    }
    const lineHeight = font * 1.25, width = Math.min(c.width - 4, Math.max(...lines.map(l => ctx.measureText(l).width)) + 36), height = lines.length * lineHeight + 18, x = (c.width - width) / 2, y = (c.height - height) / 2, r = 14;
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + width, y, x + width, y + height, r); ctx.arcTo(x + width, y + height, x, y + height, r); ctx.arcTo(x, y + height, x, y, r); ctx.arcTo(x, y, x + width, y, r); ctx.closePath();
    ctx.fillStyle = 'rgba(14,18,24,.9)'; ctx.fill(); ctx.strokeStyle = 'rgba(177,189,205,.5)'; ctx.lineWidth = 2; ctx.stroke();
    lines.forEach((l, k) => {ctx.fillStyle = k ? '#9fb0c4' : color; ctx.fillText(l, c.width / 2, c.height / 2 + (k - (lines.length - 1) / 2) * lineHeight, maxWidth);});
    texture.needsUpdate = true;
   };
   sprite.userData.draw(text); return sprite;
  }
  /** Lit front-facing text plate for automated rooms; the displayed text is also kept in `userData.signText`. */
  kit.sign = (parent: O, text: string, x: number, y: number, z: number, width: number, height: number, accent: string): O => {
   const c = document.createElement('canvas'); c.width = 512; c.height = Math.max(64, Math.round(512 * height / width)); const ctx = c.getContext('2d')!;
   ctx.fillStyle = '#10161f'; ctx.fillRect(0, 0, c.width, c.height); ctx.strokeStyle = accent; ctx.lineWidth = 10; ctx.strokeRect(5, 5, c.width - 10, c.height - 10);
   let size = Math.round(c.height * .5); ctx.font = `700 ${size}px system-ui`; while (size > 14 && ctx.measureText(text).width > c.width - 44) {size -= 2; ctx.font = `700 ${size}px system-ui`;}
   ctx.fillStyle = '#f4f7fb'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, c.width / 2, c.height / 2 + 2, c.width - 44);
   const texture = new T.CanvasTexture(c); textures.push(texture);
   const mesh = new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshBasicMaterial({map: texture, toneMapped: false})); mesh.position.set(x, y, z + .08); mesh.userData.signText = text; parent.add(mesh);
   kit.piece(parent, 'box', x, y, z, width + .12, height + .12, .1, '#0a0e14'); return mesh;
  };
  /** Floating mood face for an authored `emotion`: one shared canvas texture per level, drawn from the room module's seven-level table. */
  const moodMaterials = new Map<number, O>();
  kit.mood = (parent: O, level: number): O => {
   const mood = root.LWProcessRooms.moods.find(m => m.level === level) ?? root.LWProcessRooms.moods[3]!;
   if (!moodMaterials.has(level)) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d')!; ctx.scale(1.28, 1.28);
    ctx.fillStyle = mood.color; ctx.strokeStyle = '#13181f'; ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(50, 50, 46, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#13181f'; for (const x of [35, 65]) {ctx.beginPath(); ctx.arc(x, 40, 5.5, 0, Math.PI * 2); ctx.fill();}
    ctx.lineWidth = 5; if (mood.brow) ctx.stroke(new Path2D(mood.brow)); const mouth = new Path2D(mood.mouth); if (mood.open) ctx.fill(mouth); ctx.stroke(mouth);
    const texture = new T.CanvasTexture(c); textures.push(texture); const m = new T.SpriteMaterial({map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false}); materials.set('mood-' + level, m); moodMaterials.set(level, m);
   }
   const sprite = new T.Sprite(moodMaterials.get(level)); sprite.renderOrder = 21; sprite.center.set(.5, 0); sprite.scale.set(2.2, 2.2, 1); sprite.position.set(0, 6.4, -2.2);
   sprite.userData.mood = {level, label: mood.label}; parent.add(sprite); moods.push(sprite); return sprite;
  };
  for (const step of definition.steps) {
   const g = kit.group(scene); g.position.set(step.scene.position[0], 0, step.scene.position[1]); g.userData.stepId = step.id; stations.set(step.id, g);
   const floor = kit.piece(g, 'box', 0, -.16, 0, 10, .3, 9, '#293544'); floor.userData.stepId = step.id; objects.push(floor);
   kit.piece(g, 'box', 0, .01, -4.35, 10, .1, .18, step.scene.color);
   // Low walls and inset floor panels tinted per room theme; the themed workstation and its idle variant come from LWProcessRooms.
   const theme = root.LWProcessRooms.theme(step);
   kit.piece(g, 'box', 0, .7, -4.35, 10, 1.4, .14, theme.wall);
   kit.piece(g, 'box', -4.9, .7, -2.8, .14, 1.4, 3.2, theme.wall);
   for (const x of [-3.75, -1.25, 1.25, 3.75]) for (const z of [-3, -.5, 2])
    kit.piece(g, 'box', x, .006, z, 2.46, .015, 2.46, theme.floor);
   kit.piece(g, 'cylinder', 4.05, .3, -3.2, .36, .6, .36, '#b99c7f');
   for (const [x, y] of [[3.85, 1.05], [4.15, 1.35], [4.35, .95]]) kit.piece(g, 'ball', x!, y!, -3.2, .28, .55, .28, '#6d9585');
   // Process Forge starter furnishings (desk/monitor or podium/marker) give way to the themed room; custom attached geometry is drawn as authored.
   const custom = step.scene.asset && !isStarterAsset(step.scene.asset);
   if (custom) root.LWAssetRenderer.createFromDefinition(kit, g, step.scene.asset, 'world');
   rooms.set(step.id, root.LWProcessRooms.build(kit, g, step, !custom));
   rooms.get(step.id)!.setActive(false);
   const name = label(step.name, '#edf2f7'); name.center.set(.5, 0); name.position.set(0, 4.6, -2.2); g.add(name); names.push({sprite: name, text: step.name});
   // The room kind sub-label shares the front caption pill with the count, so nothing floats over the props.
   const sub = [theme.label, ...(step.kind === 'touchpoint' ? [] : [step.kind]), ...(step.technology ? [step.technology] : []), ...(step.instances ? [step.instances.count !== undefined ? '× ' + step.instances.count : `× per case (${step.instances.field})`] : []), ...(step.deadline ? ['deadline ' + (step.deadline.after !== undefined ? step.deadline.after + ' min' : 'random') + ' ' + step.deadline.mode] : []), ...(step.kind === 'timer' ? [step.until !== undefined ? 'until minute ' + step.until : (step.duration ?? 0) + ' min'] : step.duration ? [step.duration + ' min'] : [])].join(' · ');
   const lamp = kit.piece(g, 'ball', 4.35, 1.65, -4.25, .12, .12, .12, '#91b9d5');
   kit.piece(g, 'box', 0, .12, 4.2, 8, .07, .12, '#15222e');
   const bar = kit.piece(g, 'box', -4, .17, 4.2, .001, .07, .14, '#ffbb73');
   if (step.kind === 'fork' && step.mode === 'inclusive') {
    // A gateway diamond with a ring on a post by the back wall marks the inclusive fork; the first piece carries the marker for tests.
    const diamond = kit.piece(g, 'box', -4.1, 2.25, -4.2, .85, .85, .14, '#c79871'); diamond.rotation.z = Math.PI / 4; diamond.userData.glyph = 'inclusive-fork';
    kit.piece(g, 'ring', -4.1, 2.25, -4.1, .3, .3, .3, '#13181f'); kit.piece(g, 'cylinder', -4.1, 1.35, -4.2, .05, 1.2, .05, '#c79871');
   }
   // The caption hangs below the room's front edge (its top on the floor edge), clear of the queue rail and bench; layoutNames keeps it readable.
   const font = step.instances || step.deadline ? 25 : 30, status = label(['Ready', sub], '#e3eaf2', font); status.center.set(.5, 1); status.position.set(0, .05, 5.9); status.scale.multiplyScalar(.75); g.add(status);
   indicators.set(step.id, {bar, lamp, status, sub, font});
  }
  // Amber frame around the room entered by selection; the whole-process view has none.
  const focusFrame = kit.group(scene); focusFrame.visible = false;
  for (const [x, z, w, d] of [[0, -4.7, 10.4, .14], [0, 4.7, 10.4, .14], [-5.2, 0, .14, 9.4], [5.2, 0, .14, 9.4]] as const) kit.piece(focusFrame, 'box', x, .05, z, w, .08, d, '#ffbb73', 0, {emissive: '#ff9a3c', emissiveIntensity: .6});
  const links = new T.Group(); scene.add(links);
  for (const f of definition.flows) {
   const a = stepIndex.get(f.from)?.scene.position, b = stepIndex.get(f.to)?.scene.position; if (!a || !b) continue;
   const from = new T.Vector3(a[0], .05, a[1]), to = new T.Vector3(b[0], .05, b[1]), direction = to.clone().sub(from), length = direction.length();
   if (length < .01) continue;
   const late = f.on === 'deadline', tone = TONE[definition.steps.find(s => s.id === f.from)?.deadline?.mode ?? 'interrupt']!;
   if (late) from.y += .12;
   const arrow = new T.ArrowHelper(direction.normalize(), from, Math.max(.1, length - 3), late ? tone : f.when ? '#c79871' : '#61738a', .8, .45); arrow.userData = {flow: f.id, deadline: late, conditional: !!f.when, color: late ? tone : f.when ? '#c79871' : '#61738a'}; links.add(arrow);
  }
  function fit(resetOrbit: boolean): void {
   needsRender = true;
   const chosen = selected ? stepIndex.get(selected) : undefined, visible = chosen ? [chosen] : definition.steps, lift = selected && stepIndex.get(selected)?.emotion !== undefined ? 1 : 0;
   const xs = visible.map(s => s.scene.position[0]), zs = visible.map(s => s.scene.position[1]);
   target.set((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
   if (resetOrbit) {yaw = -.3; pitch = .65;}
   // The ground is foreshortened by the pitch, so depth counts at sin(pitch) plus the room height; a selected room also keeps its front caption in view.
   // Width counts the rotated room footprint (10.4 x 9.4 with its frame), so a portrait stage frames the whole room by its width.
   const rangeX = Math.max(...xs) - Math.min(...xs), rangeZ = Math.max(...zs) - Math.min(...zs), spanX = (rangeX + 10.4) * Math.abs(Math.cos(yaw)) + (rangeZ + 9.4) * Math.abs(Math.sin(yaw)) + 1, spanZ = (rangeZ + (selected ? 12 + lift * 3.4 : 10)) * Math.sin(pitch) + (selected ? 7.5 : 4);
   const aspect = Math.max(.3, canvas.clientWidth / Math.max(1, canvas.clientHeight));
   const vertical = camera.fov * Math.PI / 180, horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
   distance = Math.max(spanX / (2 * Math.tan(horizontal / 2)), spanZ / (2 * Math.tan(vertical / 2))) * (selected ? 1.1 : 1.2);
   target.y = selected ? 1.8 + lift * 1.7 : 0; if (selected) target.z += 3;
   panBounds = {minX: Math.min(...xs) - 6, maxX: Math.max(...xs) + 6, minZ: Math.min(...zs) - 6, maxZ: Math.max(...zs) + 6};
   light.position.set(target.x + 10, 35, target.z + 15); light.target.position.copy(target);
   const shadowSpan = Math.max(spanX, spanZ) * .7;
   Object.assign(light.shadow.camera, {left: -shadowSpan, right: shadowSpan, top: shadowSpan, bottom: -shadowSpan, far: shadowSpan * 3 + 100});
   light.shadow.camera.updateProjectionMatrix();
  }
  const frame = () => fit(true);
  const clampTarget = () => {target.x = Math.max(panBounds.minX, Math.min(panBounds.maxX, target.x)); target.z = Math.max(panBounds.minZ, Math.min(panBounds.maxZ, target.z));};
  /** Slide the orbit target along the ground plane relative to the current heading. Presentation-only. */
  function pan(right: number, forward: number): void {
   target.x += Math.cos(yaw) * right - Math.sin(yaw) * forward; target.z += -Math.sin(yaw) * right - Math.cos(yaw) * forward; clampTarget(); needsRender = true;
  }
  const pointerDown = (e: PointerEvent) => {
   if (e.button > 2) return; canvas.focus({preventScroll: true});
   dragging = e.button === 0 && !e.shiftKey ? 'orbit' : 'pan'; moved = false; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId);
   if (e.button !== 0) e.preventDefault();
  };
  const pointerMove = (e: PointerEvent) => {
   if (!dragging) return; needsRender = true; const dx = e.clientX - px, dy = e.clientY - py; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
   if (dragging === 'pan') {const k = distance * Math.tan(camera.fov * Math.PI / 360) * 2 / Math.max(1, canvas.clientHeight); pan(-dx * k, dy * k / Math.max(.3, Math.sin(pitch)));}
   else {yaw -= dx * .006; pitch = Math.max(.2, Math.min(1.45, pitch + dy * .005));}
   px = e.clientX; py = e.clientY;
  };
  const pointerUp = (e: PointerEvent) => {
   if (!dragging) return; const mode = dragging; dragging = null; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); if (moved || mode === 'pan' || e.button !== 0) return;
   const rect = canvas.getBoundingClientRect(), ray = new T.Raycaster();
   ray.setFromCamera(new T.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
   const hit = ray.intersectObjects(objects.filter(o => o.parent.visible))[0]; if (hit) select(String(hit.object.userData.stepId));
  };
  const cancel = () => {dragging = null;};
  const contextMenu = (e: Event) => e.preventDefault();
  const keyboard = (e: KeyboardEvent) => {
   if (e.ctrlKey || e.metaKey || e.altKey) return;
   const step = distance * .06, key = e.key.toLowerCase();
   if (e.shiftKey && e.key.startsWith('Arrow')) pan(e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0, e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0);
   else if (key === 'a') pan(-step, 0); else if (key === 'd') pan(step, 0); else if (key === 'w') pan(0, step); else if (key === 's') pan(0, -step);
   else if (e.key === 'ArrowLeft') yaw += .12; else if (e.key === 'ArrowRight') yaw -= .12;
   else if (e.key === 'ArrowUp') pitch = Math.min(1.45, pitch + .1); else if (e.key === 'ArrowDown') pitch = Math.max(.2, pitch - .1);
   else if (e.key === '+' || e.key === '=') distance = Math.max(10, distance / 1.15); else if (e.key === '-') distance = Math.min(200000, distance * 1.15);
   else if (key === 'f') frame(); else return; needsRender = true; e.preventDefault();
  };
  canvas.addEventListener('pointercancel', cancel); canvas.addEventListener('lostpointercapture', cancel); canvas.addEventListener('keydown', keyboard); canvas.addEventListener('contextmenu', contextMenu);
  const wheel = (e: WheelEvent) => {e.preventDefault(); needsRender = true; distance = Math.max(10, Math.min(200000, distance * Math.exp(e.deltaY * .001)));};
  if (document.getElementById('camera-hint')) canvas.setAttribute('aria-describedby', 'camera-hint');
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('wheel', wheel, {passive: false});
  function actor(): O {
   const g = kit.group(scene), body = kit.group(g);
   kit.piece(body, 'box', 0, .88, 0, .5, .64, .3, '#c79062');
   const head = kit.group(body); head.position.set(0, 1.38, 0);
   kit.piece(head, 'ball', 0, 0, 0, .23, .25, .22, '#d5ac88');
   kit.piece(head, 'ball', 0, .13, .04, .235, .15, .2, '#37404b');
   for (const x of [-.16, .16]) {
    kit.piece(g, 'box', x, .38, 0, .18, .55, .22, '#52677b');
    kit.piece(g, 'box', x, .12, -.09, .21, .16, .4, '#18232f');
   }
   const hands = [-.34, .34].map(x => {
    const pivot = kit.group(body); pivot.position.set(x, 1.08, 0);
    kit.piece(pivot, 'box', 0, -.12, -.15, .16, .2, .45, '#c79062');
    kit.piece(pivot, 'ball', 0, -.14, -.39, .1, .09, .1, '#d5ac88'); return pivot;
   });
   // Each actor represents one active work token, not an additional resource allocation.
   kit.piece(g, 'box', 0, .87, -.65, 1.2, .08, .7, '#a3876d');
   for (const x of [-.48, .48]) kit.piece(g, 'box', x, .43, -.65, .06, .86, .5, '#596b7c');
   kit.piece(g, 'box', 0, 1.19, -.87, .67, .46, .07, '#192a36');
   kit.piece(g, 'box', 0, 1.19, -.824, .56, .34, .015, '#83b9c8', 0, {emissive: '#326578', emissiveIntensity: .35});
   for (const y of [1.12, 1.2, 1.28]) kit.piece(g, 'box', -.05, y, -.81, .33, .016, .01, '#d7edf1');
   kit.piece(g, 'box', 0, .925, -.53, .55, .03, .22, '#354e63');
   kit.piece(g, 'cylinder', .44, .99, -.57, .08, .16, .08, '#e2d8c6');
   g.userData = {body, head, hands, actor: true}; return g;
  }
  function sync(view: LWProcessApp.View): void {
   needsRender = true;
   for (const [id, g] of stations) g.visible = !selected || selected === id;
   links.visible = !selected;
   const tokens = view.snapshot.tokens.filter(t => !selected || selected === t.stepId).sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active')).slice(0, 120);
   const live = new Set(tokens.map(t => t.id));
   for (const [id, marker] of markers) if (!live.has(id)) {scene.remove(marker); markers.delete(id);}
   const activeCounts = new Map<string, number>(), queueCounts = new Map<string, number>();
   let actorCount = 0;
   for (const token of tokens) {
    const working = token.status === 'active', counts = working ? activeCounts : queueCounts;
    const at = counts.get(token.stepId) ?? 0; counts.set(token.stepId, at + 1);
    const step = stepIndex.get(token.stepId); if (!step) continue;
    const detailed = working && !token.escalated && !AUTOMATED.has(step.kind) && at < 3 && actorCount++ < 32;
    let marker = markers.get(token.id);
    if (marker && !!marker.userData.actor !== detailed) {scene.remove(marker); markers.delete(token.id); marker = undefined;}
    if (!marker) {
     marker = detailed ? actor() : kit.piece(scene, 'box', 0, 0, 0, .32, .12, .42, '#91b9d5'); markers.set(token.id, marker);
    }
    marker.position.set(step.scene.position[0] + (detailed ? -2.5 + at * 2.5 : -4 + at % 16 * .5), detailed ? .04 : .25 + Math.floor(at / 16) * .18, step.scene.position[1] + (detailed ? 2.4 : working ? 3.3 : 3.85));
    marker.userData.phase = Number(token.id.split('-').at(-1)) * 1.7; marker.userData.escalated = !!token.escalated; marker.userData.item = token.item ?? null;
    if (!detailed) marker.material = mat(token.escalated ? ESCALATED : working ? '#ffbb73' : token.status === 'held' ? '#e07a7a' : token.status === 'backlog' ? '#b79ad6' : token.status === 'timer' ? '#d9c58a' : '#91b9d5');
   }
   for (const [id, indicator] of indicators) {
    const metric = view.snapshot.steps.find(s => s.id === id), definitionStep = stepIndex.get(id), room = rooms.get(id); if (!metric || !definitionStep || !room) continue;
    const active = view.snapshot.tokens.filter(t => t.stepId === id && t.status === 'active');
    const duration = definitionStep.duration ?? 1;
    const progress = active.length ? active.reduce((n, t) => n + (duration - t.remaining) / duration, 0) / active.length : 0;
    const stored = view.snapshot.tokens.filter(t => t.stepId === id && (t.status === 'backlog' || (definitionStep.kind === 'task' || AUTOMATED.has(definitionStep.kind)) && t.status === 'queued')).length;
    roomProgress.set(id, progress); room.setActive(metric.active > 0 || metric.timers.waiting > 0 || definitionStep.kind === 'join' && stored > 0); room.setQueued(metric.queued); room.setBacklog(definitionStep.backlog ? stored : 0);
    indicator.bar.scale.x = Math.max(.001, progress * 8); indicator.bar.position.x = -4 + progress * 4;
    indicator.lamp.material = mat(metric.active ? '#ffbb73' : metric.timers.waiting ? '#d9c58a' : metric.queued ? '#91b9d5' : '#6d9585', {emissive: metric.active ? '#704c2d' : '#000000'});
    const timerText = metric.timers.waiting ? `${metric.timers.waiting} on timer · next due minute ${metric.timers.nextDue}` : '';
    const outcome = definitionStep.kind === 'end' && definitionStep.outcome ? (definitionStep.outcome === 'goal' ? 'Goal' : 'Lost') + ` · ${metric.reached} reached` : '';
    const touch = definitionStep.kind === 'touchpoint', waitText = touch ? 'waiting for a team' : 'waiting';
    const caption = outcome ? outcome : timerText ? timerText + (metric.completed ? ` · ${metric.completed} completed` : '') : definitionStep.backlog ? `Backlog ${stored}/${definitionStep.backlog.capacity}` + (metric.active ? ` · ${metric.active} working` : '') : metric.active ? touch ? `${metric.active} in this touchpoint` + (metric.queued ? ` · ${metric.queued} waiting` : '') : `${metric.active} working · ${metric.queued} waiting` : metric.queued ? `${metric.queued} ${waitText}` : metric.completed ? `${metric.completed} completed` : 'Ready';
    const live = definitionStep.instances?.count === undefined ? view.snapshot.tokens.find(t => t.stepId === id && t.items !== undefined)?.items : undefined;
    const extra = [live !== undefined ? `× ${live} now` : '', metric.items ? `items ${metric.items.started} started · ${metric.items.finished} done` : '', metric.deadlines ? `${metric.deadlines.escalated} escalated · ${metric.deadlines.interrupted} interrupted` : ''].filter(Boolean).join(' · ');
    const lines = [caption, ...extra ? [extra] : [], indicator.sub], text = lines.join(' | ');
    if (indicator.status.userData.caption !== text) {
     indicator.status.userData.draw(lines); indicator.status.userData.caption = text;
    }
   }
  }
  // Room names keep a minimum on-screen text size (about 11px) in the overview, wrapping to the room spacing so neighbours never collide.
  // Front captions grow until their lines reach 12px, up to the width of a room; a caption that would still be smaller (a zoomed-out
  // overview) is not drawn, like the 2D map's secondary text, and the inspector and step list keep the same counts.
  let spacing = 14, nameScale = 0, captionKey = '';
  for (const [i, a] of definition.steps.entries()) for (const b of definition.steps.slice(i + 1)) {const d = Math.hypot(a.scene.position[0] - b.scene.position[0], a.scene.position[1] - b.scene.position[1]); if (d > 1) spacing = Math.min(spacing, d);}
  function layoutNames(): void {
   const ppu = Math.max(1, canvas.clientHeight) / (2 * Math.tan(camera.fov * Math.PI / 360) * distance), k = Math.round(Math.max(1, Math.min(8, 11 / (.425 * ppu))) * 4) / 4;
   // A selected room may widen its caption to most of the stage; in the overview a caption stays within the room spacing. A wider caption
   // hangs further forward so its ends clear the rotated front edge.
   const widest = selected ? Math.max(2, Math.max(1, canvas.clientWidth) * .92 / ppu / 6) : Math.min(spacing * .94, 12) / 6;
   const captions = [...indicators.values()].map(i => Math.ceil(Math.max(1, 12 / (i.font * .009375 * ppu)) * 4) / 4), key = captions.map(c => c <= widest || selected ? Math.min(c, widest).toFixed(2) : 0).join();
   if (key !== captionKey) {
    captionKey = key; [...indicators.values()].forEach((i, n) => { const c = Math.min(captions[n]!, widest); i.status.visible = !!selected || captions[n]! <= widest; i.status.scale.set(6 * c, 1.2 * c, 1); i.status.position.z = 5.9 + (c - 1); });
   }
   if (k === nameScale) return; nameScale = k;
   const maxWidth = Math.max(180, Math.min(580, Math.floor(spacing * .94 / k * 80) - 40));
   for (const n of names) {n.sprite.scale.set(8 * k, 1.6 * k, 1); n.sprite.userData.draw(n.text, maxWidth);}
   for (const m of moods) {const size = Math.max(2.2, 1.9 * k); m.scale.set(size, size, 1); m.position.y = 4.6 + 1.6 * k + .15;}
  }
  function draw(view: LWProcessApp.View, delta: number): void {
   if (selected !== view.selected) {
    selected = view.selected; frame(); const chosen = selected ? stepIndex.get(selected) : undefined;
    focusFrame.visible = !!chosen; if (chosen) focusFrame.position.set(chosen.scene.position[0], 0, chosen.scene.position[1]);
   }
   if (previousView !== view) {sync(view); previousView = view;}
   const moving = view.playing && !reducedMotion.matches;
   if (moving) phase += Math.min(delta, .1);
   for (const marker of markers.values()) if (marker.userData.actor) {
    const rig = marker.userData, t = phase * 9 + rig.phase;
    rig.hands.forEach((hand: O, i: number) => {hand.rotation.x = Math.sin(t + i * Math.PI) * .19;});
    rig.head.rotation.x = -.12 + Math.sin(t * .28) * .065;
    rig.head.rotation.y = Math.sin(t * .18) * .12;
    rig.body.rotation.z = Math.sin(t * .3) * .025;
   }
   for (const [id, room] of rooms) if (!selected || selected === id) room.animate(phase, roomProgress.get(id) ?? 0);
   const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
   if (width !== viewportWidth || height !== viewportHeight) {
    viewportWidth = width; viewportHeight = height; renderer.setSize(width, height, false); fit(false);
   }
   if (!needsRender && !moving) return;
   needsRender = false; layoutNames();
   camera.aspect = width / height; camera.near = Math.max(.1, distance / 10000); camera.far = Math.max(3000, distance * 3); camera.updateProjectionMatrix();
   camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * distance, target.y + Math.sin(pitch) * distance, target.z + Math.cos(yaw) * Math.cos(pitch) * distance);
   camera.lookAt(target); renderer.render(scene, camera);
  }
  return {draw, frame, dispose() {
   reducedMotion.removeEventListener('change', motionChanged);
   canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('lostpointercapture', cancel); canvas.removeEventListener('keydown', keyboard); canvas.removeEventListener('contextmenu', contextMenu);
   canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('wheel', wheel);
   const allGeometry = new Set<O>(geometries.values()), allMaterials = new Set<O>(materials.values());
   scene.traverse((o: O) => {if (o.geometry) allGeometry.add(o.geometry); if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) allMaterials.add(m);});
   allGeometry.forEach(g => g.dispose()); allMaterials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose(); renderer.forceContextLoss();
  }};
 }
 root.LWProcess3D = {create};
})(globalThis);
