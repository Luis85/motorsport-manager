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
 const root = inputRoot as {THREE: O; LWAssetRenderer: {createFromDefinition(kit: O, parent: O, input: unknown, model?: string): {root: O}}; LWProcess3D?: LWProcess3D.Api};
 function create(canvas: HTMLCanvasElement, definition: LWProcess.Definition, select: (id: string) => void): LWProcess3D.Surface {
  const T = root.THREE, renderer = new T.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor('#13181f');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(38, 1, .1, 3000), target = new T.Vector3();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const stepIndex = new Map(definition.steps.map(s => [s.id, s]));
  const indicators = new Map<string, {bar: O; lamp: O; status: O}>();
  let needsRender = true;
  let phase = 0, previousView: LWProcessApp.View | undefined;
  const objects: O[] = [], textures: O[] = [], stations = new Map<string, O>(), markers = new Map<string, O>();
  let selected: string | null | undefined, yaw = -.3, pitch = .65, distance = 85, dragging = false, moved = false, px = 0, py = 0;
  let viewportWidth = 0, viewportHeight = 0;
  const geometries = new Map<string, O>(), materials = new Map<string, O>();
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
  const kit = {T, mat, group(parent: O) {const g = new T.Group(); parent.add(g); return g;},
   piece(parent: O, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, _rotation = 0, extra = {}) {
    const mesh = new T.Mesh(geometry(kind), mat(color, extra)); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
   }};
  scene.add(new T.HemisphereLight('#d9e8ff', '#38434e', 1.6));
  const light = new T.DirectionalLight('#fff1df', 1.8); light.position.set(10, 40, 20); light.castShadow = true; light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -.0004; light.shadow.normalBias = .04; scene.add(light); scene.add(light.target);
  const fill = new T.DirectionalLight('#a9cddd', 1.2); fill.position.set(-20, 15, -25); scene.add(fill);
  function label(text: string, color: string): O {
   const c = document.createElement('canvas'); c.width = 640; c.height = 100;
   const ctx = c.getContext('2d')!; ctx.fillStyle = color; ctx.font = '500 33px system-ui'; ctx.textAlign = 'center'; ctx.fillText(text, 320, 56, 615);
   const texture = new T.CanvasTexture(c); textures.push(texture);
   const m = new T.SpriteMaterial({map: texture, transparent: true, depthTest: false}); materials.set('label-' + materials.size, m);
   const sprite = new T.Sprite(m); sprite.scale.set(8, 1.25, 1); return sprite;
  }
  for (const step of definition.steps) {
   const g = kit.group(scene); g.position.set(step.scene.position[0], 0, step.scene.position[1]); g.userData.stepId = step.id; stations.set(step.id, g);
   const floor = kit.piece(g, 'box', 0, -.16, 0, 10, .3, 9, '#293544'); floor.userData.stepId = step.id; objects.push(floor);
   kit.piece(g, 'box', 0, .01, -4.35, 10, .1, .18, step.scene.color);
   // Low walls and inset floor panels give authored furniture a readable room.
   kit.piece(g, 'box', 0, .7, -4.35, 10, 1.4, .14, '#374756');
   kit.piece(g, 'box', -4.9, .7, -2.8, .14, 1.4, 3.2, '#374756');
   for (const x of [-3.75, -1.25, 1.25, 3.75]) for (const z of [-3, -.5, 2])
    kit.piece(g, 'box', x, .006, z, 2.46, .015, 2.46, '#314050');
   kit.piece(g, 'cylinder', 4.05, .3, -3.2, .36, .6, .36, '#b99c7f');
   for (const [x, y] of [[3.85, 1.05], [4.15, 1.35], [4.35, .95]]) kit.piece(g, 'ball', x!, y!, -3.2, .28, .55, .28, '#6d9585');
   kit.piece(g, 'box', -3.7, 1, -3.4, 1.35, 2, .7, '#526579');
   for (const y of [.5, 1.15, 1.8]) kit.piece(g, 'box', -3.7, y, -3, 1.12, .06, .08, '#9cabb7');
   if (step.scene.asset) root.LWAssetRenderer.createFromDefinition(kit, g, step.scene.asset, 'world');
   else if (step.kind === 'task') {
    kit.piece(g, 'box', 0, 1.1, -.6, 3.4, .18, 1.4, '#8c725d');
    for (const x of [-1.4, 1.4]) kit.piece(g, 'box', x, .5, -.6, .16, 1, 1, '#536379');
    kit.piece(g, 'box', 0, 1.7, -.8, 1, .65, .1, '#86a6bb');
   } else kit.piece(g, step.kind === 'decision' ? 'cone' : 'cylinder', 0, .55, 0, .7, 1, .7, step.scene.color);
   const name = label(step.name, '#edf2f7'); name.position.set(0, 4.8, -1); g.add(name);
   const role = label(step.kind + (step.duration ? ' · ' + step.duration + ' min' : ''), '#b1bdcd'); role.position.set(0, 4.05, -1); role.scale.multiplyScalar(.67); g.add(role);
   const lamp = kit.piece(g, 'ball', 4.35, 1.65, -4.25, .12, .12, .12, '#91b9d5');
   kit.piece(g, 'box', 0, .12, 4.2, 8, .07, .12, '#15222e');
   const bar = kit.piece(g, 'box', -4, .17, 4.2, .001, .07, .14, '#ffbb73');
   const status = label('Ready', '#b1bdcd'); status.position.set(0, .25, 5.3); status.scale.multiplyScalar(.75); g.add(status);
   indicators.set(step.id, {bar, lamp, status});
  }
  const links = new T.Group(); scene.add(links);
  for (const f of definition.flows) {
   const a = definition.steps.find(s => s.id === f.from)!.scene.position, b = definition.steps.find(s => s.id === f.to)!.scene.position;
   const from = new T.Vector3(a[0], .05, a[1]), to = new T.Vector3(b[0], .05, b[1]), direction = to.clone().sub(from), length = direction.length();
   if (length < .01) continue;
   const arrow = new T.ArrowHelper(direction.normalize(), from, Math.max(.1, length - 3), f.when ? '#c79871' : '#61738a', .8, .45); links.add(arrow);
  }
  function fit(resetOrbit: boolean): void {
   needsRender = true;
   const visible = selected ? [definition.steps.find(s => s.id === selected)!] : definition.steps;
   const xs = visible.map(s => s.scene.position[0]), zs = visible.map(s => s.scene.position[1]);
   target.set((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
   const spanX = Math.max(...xs) - Math.min(...xs) + 12, spanZ = Math.max(...zs) - Math.min(...zs) + 12;
   const aspect = Math.max(.3, canvas.clientWidth / Math.max(1, canvas.clientHeight));
   const vertical = camera.fov * Math.PI / 180, horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
   distance = Math.max(spanX / (2 * Math.tan(horizontal / 2)), spanZ / (2 * Math.tan(vertical / 2))) * 1.25;
   target.y = selected ? 1 : 0;
   light.position.set(target.x + 10, 35, target.z + 15); light.target.position.copy(target);
   const shadowSpan = Math.max(spanX, spanZ) * .7;
   Object.assign(light.shadow.camera, {left: -shadowSpan, right: shadowSpan, top: shadowSpan, bottom: -shadowSpan, far: shadowSpan * 3 + 100});
   light.shadow.camera.updateProjectionMatrix();
   if (resetOrbit) {yaw = -.3; pitch = .65;}
  }
  const frame = () => fit(true);
  const pointerDown = (e: PointerEvent) => {if (e.button !== 0) return; canvas.focus({preventScroll: true}); dragging = true; moved = false; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId);};
  const pointerMove = (e: PointerEvent) => { if (!dragging) return; needsRender = true; const dx = e.clientX - px, dy = e.clientY - py; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true; yaw -= dx * .006; pitch = Math.max(.2, Math.min(1.45, pitch + dy * .005)); px = e.clientX; py = e.clientY; };
  const pointerUp = (e: PointerEvent) => {
   if (!dragging) return; dragging = false; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); if (moved) return;
   const rect = canvas.getBoundingClientRect(), ray = new T.Raycaster();
   ray.setFromCamera(new T.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
   const hit = ray.intersectObjects(objects.filter(o => o.parent.visible))[0]; if (hit) select(String(hit.object.userData.stepId));
  };
  const cancel = () => {dragging = false;};
  const keyboard = (e: KeyboardEvent) => {
   if (e.key === 'ArrowLeft') yaw += .12; else if (e.key === 'ArrowRight') yaw -= .12;
   else if (e.key === 'ArrowUp') pitch = Math.min(1.45, pitch + .1); else if (e.key === 'ArrowDown') pitch = Math.max(.2, pitch - .1);
   else if (e.key === '+' || e.key === '=') distance = Math.max(10, distance / 1.15); else if (e.key === '-') distance = Math.min(200000, distance * 1.15);
   else if (e.key.toLowerCase() === 'f') frame(); else return; needsRender = true; e.preventDefault();
  };
  canvas.addEventListener('pointercancel', cancel); canvas.addEventListener('lostpointercapture', cancel); canvas.addEventListener('keydown', keyboard);
  const wheel = (e: WheelEvent) => {e.preventDefault(); needsRender = true; distance = Math.max(10, Math.min(200000, distance * Math.exp(e.deltaY * .001)));};
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
    const detailed = working && at < 3 && actorCount++ < 32;
    const step = stepIndex.get(token.stepId)!;
    let marker = markers.get(token.id);
    if (marker && !!marker.userData.actor !== detailed) {scene.remove(marker); markers.delete(token.id); marker = undefined;}
    if (!marker) {
     marker = detailed ? actor() : kit.piece(scene, 'box', 0, 0, 0, .32, .12, .42, '#91b9d5'); markers.set(token.id, marker);
    }
    marker.position.set(step.scene.position[0] + (detailed ? -2.5 + at * 2.5 : -4 + at % 16 * .5), detailed ? .04 : .25 + Math.floor(at / 16) * .18, step.scene.position[1] + (detailed ? 2.4 : working ? 3.3 : 3.85));
    marker.userData.phase = Number(token.id.split('-').at(-1)) * 1.7;
    if (!detailed) marker.material = mat(working ? '#ffbb73' : '#91b9d5');
   }
   for (const [id, indicator] of indicators) {
    const metric = view.snapshot.steps.find(s => s.id === id)!;
    const active = view.snapshot.tokens.filter(t => t.stepId === id && t.status === 'active');
    const duration = stepIndex.get(id)!.duration ?? 1;
    const progress = active.length ? active.reduce((n, t) => n + (duration - t.remaining) / duration, 0) / active.length : 0;
    indicator.bar.scale.x = Math.max(.001, progress * 8); indicator.bar.position.x = -4 + progress * 4;
    indicator.lamp.material = mat(metric.active ? '#ffbb73' : metric.queued ? '#91b9d5' : '#6d9585', {emissive: metric.active ? '#704c2d' : '#000000'});
    const caption = metric.active ? `${metric.active} working · ${metric.queued} waiting` : metric.queued ? `${metric.queued} waiting` : metric.completed ? `${metric.completed} completed` : 'Ready';
    if (indicator.status.userData.caption !== caption) {
     const texture = indicator.status.material.map, c = texture.image as HTMLCanvasElement, ctx = c.getContext('2d')!;
     ctx.clearRect(0, 0, c.width, c.height); ctx.fillText(caption, 320, 56, 615); texture.needsUpdate = true; indicator.status.userData.caption = caption;
    }
   }
  }
  function draw(view: LWProcessApp.View, delta: number): void {
   if (selected !== view.selected) {selected = view.selected; frame();}
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
   const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
   if (width !== viewportWidth || height !== viewportHeight) {
    viewportWidth = width; viewportHeight = height; renderer.setSize(width, height, false); fit(false);
   }
   if (!needsRender && !moving) return;
   needsRender = false;
   camera.aspect = width / height; camera.near = Math.max(.1, distance / 10000); camera.far = Math.max(3000, distance * 3); camera.updateProjectionMatrix();
   camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * distance, target.y + Math.sin(pitch) * distance, target.z + Math.cos(yaw) * Math.cos(pitch) * distance);
   camera.lookAt(target); renderer.render(scene, camera);
  }
  return {draw, frame, dispose() {
   canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('lostpointercapture', cancel); canvas.removeEventListener('keydown', keyboard);
   canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('wheel', wheel);
   const allGeometry = new Set<O>(geometries.values()), allMaterials = new Set<O>(materials.values());
   scene.traverse((o: O) => {if (o.geometry) allGeometry.add(o.geometry); if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) allMaterials.add(m);});
   allGeometry.forEach(g => g.dispose()); allMaterials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose();
  }};
 }
 root.LWProcess3D = {create};
})(globalThis);
