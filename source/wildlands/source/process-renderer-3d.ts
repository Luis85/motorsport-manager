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
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(38, 1, .1, 3000), target = new T.Vector3();
  const objects: O[] = [], textures: O[] = [], stations = new Map<string, O>(), markers = new Map<string, O>();
  let selected: string | null | undefined, yaw = .05, pitch = .75, distance = 85, dragging = false, moved = false, px = 0, py = 0;
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
    const mesh = new T.Mesh(geometry(kind), mat(color, extra)); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
   }};
  scene.add(new T.HemisphereLight('#f0f4ff', '#536379', 1.5));
  const light = new T.DirectionalLight('#fff1df', 1.8); light.position.set(10, 40, 20); scene.add(light);
  function label(text: string, color: string): O {
   const c = document.createElement('canvas'); c.width = 640; c.height = 100;
   const ctx = c.getContext('2d')!; ctx.fillStyle = color; ctx.font = '500 33px system-ui'; ctx.textAlign = 'center'; ctx.fillText(text, 320, 56, 615);
   const texture = new T.CanvasTexture(c); textures.push(texture);
   const m = new T.SpriteMaterial({map: texture, transparent: true, depthTest: false}); materials.set('label-' + materials.size, m);
   const sprite = new T.Sprite(m); sprite.scale.set(8, 1.25, 1); return sprite;
  }
  for (const step of definition.steps) {
   const g = kit.group(scene); g.position.set(step.scene.position[0], 0, step.scene.position[1]); g.userData.stepId = step.id; stations.set(step.id, g);
   const floor = kit.piece(g, 'box', 0, -.16, 0, 8, .3, 5, '#293544'); floor.userData.stepId = step.id; objects.push(floor);
   kit.piece(g, 'box', 0, .01, -2.35, 8, .1, .18, step.scene.color);
   if (step.scene.asset) root.LWAssetRenderer.createFromDefinition(kit, g, step.scene.asset, 'world');
   else if (step.kind === 'task') {
    kit.piece(g, 'box', 0, 1.1, -.6, 3.4, .18, 1.4, '#8c725d');
    for (const x of [-1.4, 1.4]) kit.piece(g, 'box', x, .5, -.6, .16, 1, 1, '#536379');
    kit.piece(g, 'box', 0, 1.7, -.8, 1, .65, .1, '#86a6bb');
   } else kit.piece(g, step.kind === 'decision' ? 'cone' : 'cylinder', 0, .55, 0, .7, 1, .7, step.scene.color);
   const name = label(step.name, '#edf2f7'); name.position.set(0, 3.2, 0); g.add(name);
   const role = label(step.kind + (step.duration ? ' · ' + step.duration + ' min' : ''), '#b1bdcd'); role.position.set(0, 2.45, 0); role.scale.multiplyScalar(.67); g.add(role);
  }
  const links = new T.Group(); scene.add(links);
  for (const f of definition.flows) {
   const a = definition.steps.find(s => s.id === f.from)!.scene.position, b = definition.steps.find(s => s.id === f.to)!.scene.position;
   const from = new T.Vector3(a[0], .05, a[1]), to = new T.Vector3(b[0], .05, b[1]), direction = to.clone().sub(from), length = direction.length();
   if (length < .01) continue;
   const arrow = new T.ArrowHelper(direction.normalize(), from, Math.max(.1, length - 3), f.when ? '#c79871' : '#61738a', .8, .45); links.add(arrow);
  }
  function fit(resetOrbit: boolean): void {
   const visible = selected ? [definition.steps.find(s => s.id === selected)!] : definition.steps;
   const xs = visible.map(s => s.scene.position[0]), zs = visible.map(s => s.scene.position[1]);
   target.set((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
   const spanX = Math.max(...xs) - Math.min(...xs) + 14, spanZ = Math.max(...zs) - Math.min(...zs) + 12;
   const aspect = Math.max(.3, canvas.clientWidth / Math.max(1, canvas.clientHeight));
   const vertical = camera.fov * Math.PI / 180, horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
   distance = Math.hypot(spanX, spanZ) / (2 * Math.sin(Math.min(vertical, horizontal) / 2));
   if (resetOrbit) {yaw = .05; pitch = .75;}
  }
  const frame = () => fit(true);
  const pointerDown = (e: PointerEvent) => {dragging = true; moved = false; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId);};
  const pointerMove = (e: PointerEvent) => { if (!dragging) return; const dx = e.clientX - px, dy = e.clientY - py; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true; yaw -= dx * .006; pitch = Math.max(.2, Math.min(1.45, pitch + dy * .005)); px = e.clientX; py = e.clientY; };
  const pointerUp = (e: PointerEvent) => {
   dragging = false; if (moved) return;
   const rect = canvas.getBoundingClientRect(), ray = new T.Raycaster();
   ray.setFromCamera(new T.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
   const hit = ray.intersectObjects(objects.filter(o => o.parent.visible))[0]; if (hit) select(String(hit.object.userData.stepId));
  };
  const wheel = (e: WheelEvent) => {e.preventDefault(); distance = Math.max(10, Math.min(200000, distance * Math.exp(e.deltaY * .001)));};
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('wheel', wheel, {passive: false});
  function draw(view: LWProcessApp.View, delta: number): void {
   if (selected !== view.selected) {selected = view.selected; frame();}
   for (const [id, g] of stations) g.visible = !selected || selected === id;
   links.visible = !selected;
   const tokens = view.snapshot.tokens.filter(t => !selected || selected === t.stepId), live = new Set(tokens.slice(0, 1000).map(t => t.id));
   for (const [id, marker] of markers) if (!live.has(id)) {scene.remove(marker); markers.delete(id);}
   const counts = new Map<string, number>();
   for (const token of tokens.slice(0, 1000)) {
    const at = counts.get(token.stepId) ?? 0; counts.set(token.stepId, at + 1);
    const step = definition.steps.find(s => s.id === token.stepId)!;
    const position = new T.Vector3(step.scene.position[0] - 3 + (at % 10) * .6, .45 + Math.floor(at / 30) * .5, step.scene.position[1] + .7 + Math.floor(at % 30 / 10) * .55);
    let marker = markers.get(token.id);
    if (!marker) {marker = kit.piece(scene, 'ball', position.x, position.y, position.z, .25, .3, .25, '#ffbb73'); markers.set(token.id, marker);}
    marker.material = mat(token.status === 'active' ? '#ffbb73' : '#91b9d5'); marker.position.lerp(position, Math.min(1, delta * 8));
   }
   const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
   if (width !== viewportWidth || height !== viewportHeight) {
    viewportWidth = width; viewportHeight = height; renderer.setSize(width, height, false); fit(false);
   }
   camera.aspect = width / height; camera.near = Math.max(.1, distance / 10000); camera.far = Math.max(3000, distance * 3); camera.updateProjectionMatrix();
   camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * distance, target.y + Math.sin(pitch) * distance, target.z + Math.cos(yaw) * Math.cos(pitch) * distance);
   camera.lookAt(target); renderer.render(scene, camera);
  }
  return {draw, frame, dispose() {
   canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('wheel', wheel);
   const allGeometry = new Set<O>(geometries.values()), allMaterials = new Set<O>(materials.values());
   scene.traverse((o: O) => {if (o.geometry) allGeometry.add(o.geometry); if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) allMaterials.add(m);});
   allGeometry.forEach(g => g.dispose()); allMaterials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose();
  }};
 }
 root.LWProcess3D = {create};
})(globalThis);
