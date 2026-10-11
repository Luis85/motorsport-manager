/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-three.d.ts" />
/**
 * Camera controller of the Process Studio 3D view (LWProcess3DCamera): orbit, pan and zoom from the pointer, wheel and keyboard,
 * framing of the whole process or the selected room, and picking a room under a click. Presentation only: it moves the camera,
 * asks for a redraw (`changed`) and reports a picked step through `select`; it never ticks or changes the run.
 *  - Pointer: left drag orbits, right or Shift drag pans, a click without a drag picks the room under it (`hits`, the shown rooms'
 *    floor proxies, each with `userData.stepId`). Wheel zooms. Keyboard: arrows orbit, Shift+arrows or WASD pan, +/- zoom, F frames.
 *  - Framing counts the rotated room footprint (10.4 x 9.4 with its frame), so a portrait stage frames a selected room by its width;
 *    the ground is foreshortened by the pitch, and a selected room also keeps its front caption (and mood face) in view.
 */
declare namespace LWProcess3DCamera {
 interface Options {
  canvas: HTMLCanvasElement; camera: LWThree.PerspectiveCamera; steps: readonly LWProcess.Step[];
  /** The selected step, or null for the whole process. */
  selected(): LWProcess.Step | null;
  /** The floor proxies that a click may hit (those of the rooms shown; a proxy is never drawn). */
  hits(): LWThree.Object3D[];
  select(id: string): void; changed(): void;
  /** Called after framing with the framed target and a span that the key light's shadow should cover. */
  framed(target: LWThree.Vector3, span: number): void;
 }
 interface Controller {
  /** Frame the selection (or the whole process); `resetOrbit` also returns to the default heading. */
  fit(resetOrbit: boolean): void;
  /** Place the camera for a `width` x `height` stage. */
  apply(width: number, height: number): void;
  /** Screen pixels per world unit at the orbit target. */
  ppu(): number;
  dispose(): void;
 }
 interface Api {create(T: LWThree.Module, options: Options): Controller;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcess3DCamera?: LWProcess3DCamera.Api};
 function create(T: LWThree.Module, o: LWProcess3DCamera.Options): LWProcess3DCamera.Controller {
  const {canvas, camera} = o, target = new T.Vector3();
  let yaw = -.3, pitch = .65, distance = 85, dragging: 'orbit' | 'pan' | null = null, moved = false, px = 0, py = 0;
  let bounds = {minX: 0, maxX: 0, minZ: 0, maxZ: 0};
  const changed = () => o.changed();
  function fit(resetOrbit: boolean): void {
   const chosen = o.selected(), visible = chosen ? [chosen] : o.steps, lift = chosen?.emotion !== undefined ? 1 : 0;
   const xs = visible.map(s => s.scene.position[0]), zs = visible.map(s => s.scene.position[1]);
   const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
   target.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
   if (resetOrbit) {
    yaw = -.3;
    pitch = .65;
   }
   const rangeX = maxX - minX, rangeZ = maxZ - minZ;
   const spanX = (rangeX + 10.4) * Math.abs(Math.cos(yaw)) + (rangeZ + 9.4) * Math.abs(Math.sin(yaw)) + 1;
   const spanZ = (rangeZ + (chosen ? 12 + lift * 3.4 : 10)) * Math.sin(pitch) + (chosen ? 7.5 : 4);
   const aspect = Math.max(.3, canvas.clientWidth / Math.max(1, canvas.clientHeight));
   const vertical = camera.fov * Math.PI / 180, horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
   distance = Math.max(spanX / (2 * Math.tan(horizontal / 2)), spanZ / (2 * Math.tan(vertical / 2))) * (chosen ? 1.1 : 1.2);
   target.y = chosen ? 1.8 + lift * 1.7 : 0;
   if (chosen) target.z += 3;
   bounds = {minX: minX - 6, maxX: maxX + 6, minZ: minZ - 6, maxZ: maxZ + 6};
   o.framed(target, Math.max(spanX, spanZ) * .7); changed();
  }
  /** Slide the orbit target along the ground plane relative to the current heading. */
  function pan(right: number, forward: number): void {
   target.x += Math.cos(yaw) * right - Math.sin(yaw) * forward; target.z += -Math.sin(yaw) * right - Math.cos(yaw) * forward;
   target.x = Math.max(bounds.minX, Math.min(bounds.maxX, target.x)); target.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, target.z));
   changed();
  }
  const pointerDown = (e: PointerEvent) => {
   if (e.button > 2) return;
   canvas.focus({preventScroll: true});
   dragging = e.button === 0 && !e.shiftKey ? 'orbit' : 'pan';
   moved = false;
   px = e.clientX;
   py = e.clientY;
   canvas.setPointerCapture(e.pointerId);
   if (e.button !== 0) e.preventDefault();
  };
  const pointerMove = (e: PointerEvent) => {
   if (!dragging) return;
   changed();
   const dx = e.clientX - px, dy = e.clientY - py;
   if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
   if (dragging === 'pan') {
    const k = distance * Math.tan(camera.fov * Math.PI / 360) * 2 / Math.max(1, canvas.clientHeight);
    pan(-dx * k, dy * k / Math.max(.3, Math.sin(pitch)));
   } else {
    yaw -= dx * .006;
    pitch = Math.max(.2, Math.min(1.45, pitch + dy * .005));
   }
   px = e.clientX;
   py = e.clientY;
  };
  const pointerUp = (e: PointerEvent) => {
   if (!dragging) return;
   const mode = dragging;
   dragging = null;
   if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
   if (moved || mode === 'pan' || e.button !== 0) return;
   const rect = canvas.getBoundingClientRect(), ray = new T.Raycaster();
   ray.setFromCamera(new T.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
   const hit = ray.intersectObjects(o.hits())[0];
   if (hit) o.select(String(hit.object.userData.stepId));
  };
  const cancel = () => {dragging = null;};
  const contextMenu = (e: Event) => e.preventDefault();
  const keyboard = (e: KeyboardEvent) => {
   if (e.ctrlKey || e.metaKey || e.altKey) return;
   const step = distance * .06, key = e.key.toLowerCase();
   if (e.shiftKey && e.key.startsWith('Arrow')) {
    pan(e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0, e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0);
   } else if (key === 'a') pan(-step, 0);
   else if (key === 'd') pan(step, 0);
   else if (key === 'w') pan(0, step);
   else if (key === 's') pan(0, -step);
   else if (e.key === 'ArrowLeft') yaw += .12;
   else if (e.key === 'ArrowRight') yaw -= .12;
   else if (e.key === 'ArrowUp') pitch = Math.min(1.45, pitch + .1);
   else if (e.key === 'ArrowDown') pitch = Math.max(.2, pitch - .1);
   else if (e.key === '+' || e.key === '=') distance = Math.max(10, distance / 1.15);
   else if (e.key === '-') distance = Math.min(200000, distance * 1.15);
   else if (key === 'f') fit(true);
   else return;
   changed(); e.preventDefault();
  };
  const wheel = (e: WheelEvent) => {
   e.preventDefault();
   changed();
   distance = Math.max(10, Math.min(200000, distance * Math.exp(e.deltaY * .001)));
  };
  const listeners: [string, EventListener, AddEventListenerOptions?][] = [
   ['pointercancel', cancel], ['lostpointercapture', cancel], ['keydown', keyboard as EventListener], ['contextmenu', contextMenu],
   ['pointerdown', pointerDown as EventListener], ['pointermove', pointerMove as EventListener], ['pointerup', pointerUp as EventListener],
   ['wheel', wheel as EventListener, {passive: false}],
  ];
  for (const [type, fn, options] of listeners) canvas.addEventListener(type, fn, options);
  if (document.getElementById('camera-hint')) canvas.setAttribute('aria-describedby', 'camera-hint');
  function apply(width: number, height: number): void {
   camera.aspect = width / height;
   camera.near = Math.max(.1, distance / 10000);
   camera.far = Math.max(3000, distance * 3);
   camera.updateProjectionMatrix();
   const ground = Math.cos(pitch) * distance;
   camera.position.set(target.x + Math.sin(yaw) * ground, target.y + Math.sin(pitch) * distance, target.z + Math.cos(yaw) * ground);
   camera.lookAt(target);
  }
  const ppu = () => Math.max(1, canvas.clientHeight) / (2 * Math.tan(camera.fov * Math.PI / 360) * distance);
  function dispose(): void {
   for (const [type, fn] of listeners) canvas.removeEventListener(type, fn);
  }
  return {fit, apply, ppu, dispose};
 }
 root.LWProcess3DCamera = Object.freeze({create});
})(globalThis);
