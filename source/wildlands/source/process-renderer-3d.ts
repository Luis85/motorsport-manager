/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-three.d.ts" />
/**
 * The Process Studio 3D view (LWProcess3D): the WebGL renderer lifecycle, the scene's lights and the on-demand draw loop. Camera
 * and interpolation are presentation only. A page keeps one `Stage` (one WebGLRenderer on one canvas) for its lifetime: a surface
 * created on it disposes only its own scene, so rebuilding never adds a renderer, GL context or canvas. A surface created on a bare
 * canvas owns a renderer and disposes it with the scene. Frames are drawn on demand: after a camera, selection or snapshot change,
 * and while playing only when a visible actor or room animates, at most about 30 times a second. The shadow map is PCFShadowMap.
 * The scene is assembled from: LWProcess3DKit (pieces, merging, signs, moods), LWProcess3DStations (rooms, captions, flows),
 * LWProcess3DMarkers (work markers and actors), LWProcess3DCamera (orbit, framing, picking) and LWProcess3DCaptions (wording,
 * readable size and the caption canvas counters). The three.js types come from the facade in process-three.d.ts.
 */
declare namespace LWProcess3D {
 interface Surface {draw(view: LWProcessApp.View, delta: number): void; frame(): void; dispose(): void;}
 /** One WebGL renderer on one canvas for the page's lifetime; `dispose` releases the renderer and its GL context for good. */
 interface Stage {readonly canvas: HTMLCanvasElement; dispose(): void;}
 /**
  * Read-only lifecycle facts of the renderers this module has created and not disposed: how many and the GPU resources they hold,
  * plus the caption canvases (and their pixels) that live scenes hold.
  */
 interface Live {renderers: number; geometries: number; textures: number; programs: number; captionCanvases: number; captionPixels: number;}
 interface Api {
  create(target: HTMLCanvasElement | Stage, definition: LWProcess.Definition, select: (id: string) => void): Surface;
  stage(canvas: HTMLCanvasElement): Stage;
  live(): Live;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {THREE: LWThree.Module; LWProcess3DKit: LWProcess3DKit.Api; LWProcess3DStations: LWProcess3DStations.Api;
  LWProcess3DMarkers: LWProcess3DMarkers.Api; LWProcess3DCamera: LWProcess3DCamera.Api; LWProcess3DCaptions: LWProcess3DCaptions.Api;
  LWProcess3D?: LWProcess3D.Api};
 /** While playing, animated frames are drawn at most this often (seconds). */
 const FRAME = 1 / 30;
 const renderers = new Set<LWThree.WebGLRenderer>(), stages = new WeakMap<LWProcess3D.Stage, LWThree.WebGLRenderer>();
 function open(canvas: HTMLCanvasElement): LWThree.WebGLRenderer {
  const r = new root.THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  renderers.add(r); return r;
 }
 function release(r: LWThree.WebGLRenderer): void {
  if (!renderers.delete(r)) return;
  r.dispose(); r.forceContextLoss();
 }
 function stage(canvas: HTMLCanvasElement): LWProcess3D.Stage {
  const r = open(canvas);
  const s: LWProcess3D.Stage = Object.freeze({canvas, dispose() {
   stages.delete(s);
   release(r);
  }});
  stages.set(s, r);
  return s;
 }
 function live(): LWProcess3D.Live {
  const held = root.LWProcess3DCaptions.held();
  const out = {renderers: renderers.size, geometries: 0, textures: 0, programs: 0, captionCanvases: held.canvases, captionPixels: held.pixels};
  for (const r of renderers) {
   out.geometries += r.info.memory.geometries;
   out.textures += r.info.memory.textures;
   out.programs += r.info.programs?.length ?? 0;
  }
  return out;
 }
 type Select = (id: string) => void;
 function create(target: HTMLCanvasElement | LWProcess3D.Stage, definition: LWProcess.Definition, select: Select): LWProcess3D.Surface {
  const bare = target instanceof HTMLCanvasElement, shared = bare ? undefined : stages.get(target);
  if (!bare && !shared) throw Error('The 3D stage was disposed.');
  const canvas = bare ? target : target.canvas, renderer = shared ?? open(canvas);
  // A shared renderer outlives every scene; an owned one goes with its surface.
  const done = shared ? () => {renderer.renderLists.dispose();} : () => release(renderer);
  try {return build(renderer, canvas, definition, select, done);} catch (e) {
   if (!shared) release(renderer);
   throw e;
  }
 }
 function lights(T: LWThree.Module, scene: LWThree.Scene): LWThree.DirectionalLight {
  scene.add(new T.HemisphereLight('#d9e8ff', '#38434e', 1.6));
  const light = new T.DirectionalLight('#fff1df', 1.8);
  light.position.set(10, 40, 20);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -.0004;
  light.shadow.normalBias = .04;
  scene.add(light, light.target);
  const fill = new T.DirectionalLight('#a9cddd', 1.2);
  fill.position.set(-20, 15, -25); scene.add(fill);
  return light;
 }
 function build(renderer: LWThree.WebGLRenderer, canvas: HTMLCanvasElement, definition: LWProcess.Definition, select: Select,
  done: () => void): LWProcess3D.Surface {
  const T = root.THREE;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor('#13181f');
  // PCFSoftShadowMap is deprecated in this three.js and falls back to PCFShadowMap with a warning; asking for it directly draws the same.
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(38, 1, .1, 3000), light = lights(T, scene);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)'), steps = new Map(definition.steps.map(s => [s.id, s]));
  let needsRender = true, animating = false, actors = false, sinceRender = 0, phase = 0, previous: LWProcessApp.View | undefined;
  let selected: string | null | undefined, viewportWidth = 0, viewportHeight = 0;
  const motionChanged = () => {needsRender = true;};
  reducedMotion.addEventListener('change', motionChanged);
  const kit = root.LWProcess3DKit.create(T, scene), stations = root.LWProcess3DStations.build(T, scene, kit, definition);
  const markers = root.LWProcess3DMarkers.create(T, scene, kit, canvas);
  const view3d = root.LWProcess3DCamera.create(T, {canvas, camera, steps: definition.steps, hits: stations.hits, select,
   selected: () => selected ? steps.get(selected) ?? null : null, changed: () => {needsRender = true;},
   framed(target, span) {
    light.position.set(target.x + 10, 35, target.z + 15); light.target.position.copy(target);
    Object.assign(light.shadow.camera, {left: -span, right: span, top: span, bottom: -span, far: span * 3 + 100});
    light.shadow.camera.updateProjectionMatrix();
   }});
  const layout = root.LWProcess3DCaptions.layout(stations.names, stations.fronts, kit.moods, stations.spacing);
  function sync(view: LWProcessApp.View): void {
   needsRender = true;
   actors = markers.sync(view.snapshot.tokens.filter(t => !selected || selected === t.stepId), steps);
   stations.update(view.snapshot);
  }
  function draw(view: LWProcessApp.View, delta: number): void {
   if (selected !== view.selected) {
    selected = view.selected;
    stations.show(selected);
    view3d.fit(true);
   }
   if (previous !== view) {
    sync(view);
    previous = view;
   }
   const moving = view.playing && !reducedMotion.matches;
   if (moving) phase += Math.min(delta, .1);
   markers.animate(phase);
   // Only visible actors and rooms with moving props change between snapshots while the run plays.
   animating = stations.animate(phase, selected ?? null) || actors;
   const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
   if (width !== viewportWidth || height !== viewportHeight) {
    viewportWidth = width;
    viewportHeight = height;
    renderer.setSize(width, height, false);
    view3d.fit(false);
   }
   sinceRender += delta;
   if (!needsRender && !(moving && animating && sinceRender >= FRAME)) return;
   needsRender = false;
   sinceRender = 0;
   layout.apply(view3d.ppu(), !!selected, width);
   view3d.apply(width, height);
   renderer.render(scene, camera);
  }
  return {draw, frame: () => view3d.fit(true), dispose() {
   reducedMotion.removeEventListener('change', motionChanged);
   view3d.dispose();
   stations.dispose();
   markers.dispose();
   kit.dispose();
   light.dispose();
   done();
  }};
 }
 root.LWProcess3D = Object.freeze({create, stage, live});
})(globalThis);
