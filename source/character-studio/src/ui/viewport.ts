import * as THREE from 'three';
import '../../../wildlands/source/asset-catalog.ts';
import '../infra/engine-renderer.cjs';
import {compileVisual} from '../application/compiler.ts';
import {createRenderKit, createStage} from './viewport-kit.ts';

type Mode = 'studio' | 'world' | 'portrait';
type Light = 'studio' | 'daylight' | 'night';
type Pose = 'idle' | 'walk' | 'work' | 'celebrate';
type Instance = {root: THREE.Group; handles: Map<string, THREE.Object3D>};
type Rest = {position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Local presentation animation only. The compiled export is the preview's sole model source. */
export function createViewport(canvas: HTMLCanvasElement) {
  const lifecycle = new AbortController();
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 50);
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const stage = createStage();
  scene.add(stage.root);
  const sky = new THREE.HemisphereLight('#fff2d4', '#75968a', 2);
  const sun = new THREE.DirectionalLight('#ffe3b0', 2.7);
  sun.position.set(-3, 5, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {left: -3, right: 3, top: 3, bottom: -3, near: .1, far: 15});
  sun.shadow.bias = -.0003;
  sun.shadow.normalBias = .02;
  scene.add(sky, sun, sun.target);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false, paused = reducedMotion.matches, contextLost = false;
  let mode: Mode = 'studio', pose: Pose = 'idle';
  let figure: Instance | null = null, resources: ReturnType<typeof createRenderKit> | null = null;
  let rig: Record<string, string | string[]> = {}, footSockets: string[] = [], rest = new Map<string, Rest>();
  let yaw = 0, elevation = .12, zoom = 1, characterHeight = 1.2;
  let time = 0, previousTime = 0, frame = 0, width = 0, height = 0, stamp = '';
  let drag: {x: number; y: number} | null = null;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Interactive 3D character. Drag to orbit. Arrow keys rotate; plus and minus zoom; Home resets view.');
  canvas.dataset.renderer = 'three-engine';

  function setLight(value: Light) {
    const night = value === 'night', daylight = value === 'daylight';
    scene.background = new THREE.Color(night ? '#283b3c' : daylight ? '#e5ebdd' : '#f0eee4');
    sky.color.set(night ? '#8dadd4' : '#fff2d4');
    sky.groundColor.set(night ? '#46585b' : '#75968a');
    sky.intensity = night ? 1.1 : 2;
    sun.color.set(night ? '#bed6f6' : daylight ? '#fff4dc' : '#ffe3b0');
    sun.intensity = night ? 1.2 : 2.7;
    draw();
  }
  function projectCamera() {
    const aspect = width / Math.max(height, 1);
    const vertical = (mode === 'world' ? Math.max(1.15, characterHeight * .8) :
      mode === 'portrait' ? characterHeight * .4 : characterHeight * .67) / zoom;
    const halfHeight = Math.max(vertical, (mode === 'world' ? 1.65 : characterHeight * .55) / aspect / zoom);
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    const targetY = characterHeight * (mode === 'portrait' ? .68 : mode === 'world' ? .42 : .46);
    camera.position.set(Math.sin(yaw) * 5 * Math.cos(elevation), targetY + Math.sin(elevation) * 5,
      Math.cos(yaw) * 5 * Math.cos(elevation));
    camera.lookAt(0, targetY, 0);
    camera.updateProjectionMatrix();
  }
  function animate() {
    if (!figure) return;
    for (const [id, value] of rest) {
      const node = figure.handles.get(id)!;
      node.position.copy(value.position); node.rotation.copy(value.rotation); node.scale.copy(value.scale);
    }
    const handle = (role: string) => typeof rig[role] === 'string' ? figure?.handles.get(rig[role] as string) : undefined;
    const limbs = (role: string) => Array.isArray(rig[role]) ? (rig[role] as string[]).map(id => figure?.handles.get(id)) : [];
    const body = handle('body'), head = handle('head');
    const cycle = Math.sin(time * (pose === 'walk' ? 7 : pose === 'celebrate' ? 5 : 1.7));
    if (pose === 'idle') {
      if (body) body.position.y += cycle * .009;
      if (head) head.rotation.y += Math.sin(time * .9) * .045;
    } else if (pose === 'walk') {
      limbs('feet').forEach((node, index) => {
        const swing = cycle * .48 * (index ? -1 : 1);
        if (node) node.rotation.x += swing;
        const socket = figure?.handles.get(footSockets[index]);
        if (socket) socket.rotation.x += swing;
      });
      limbs('arms').forEach((node, index) => { if (node) node.rotation.x += cycle * .35 * (index ? 1 : -1); });
      if (body) body.position.y += Math.abs(cycle) * .026;
    } else if (pose === 'work') {
      if (head) head.rotation.x += .18;
      limbs('arms').forEach(node => { if (node) node.rotation.x -= .65 + cycle * .12; });
    } else {
      limbs('arms').forEach((node, index) => { if (node) node.rotation.z += (index ? 1 : -1) * (1.4 + cycle * .15); });
      if (body) body.position.y += Math.abs(cycle) * .07;
      if (head) head.rotation.z += cycle * .07;
    }
  }
  function draw() {
    if (disposed || contextLost) return;
    const bounds = canvas.getBoundingClientRect();
    const nextWidth = Math.round(bounds.width), nextHeight = Math.round(bounds.height);
    if (!nextWidth || !nextHeight) return;
    if (nextWidth !== width || nextHeight !== height) {
      width = nextWidth; height = nextHeight; renderer.setSize(width, height, false);
    }
    projectCamera(); animate(); renderer.render(scene, camera);
  }
  function tick(now: number) {
    frame = 0;
    if (disposed || paused || contextLost || document.hidden) { previousTime = 0; return; }
    if (previousTime) time += Math.min((now - previousTime) / 1000, .05);
    previousTime = now;
    draw(); frame = requestAnimationFrame(tick);
  }
  function resume() {
    if (!disposed && !paused && !contextLost && !document.hidden && !frame) frame = requestAnimationFrame(tick);
  }
  function clearFigure() {
    if (figure) { scene.remove(figure.root); resources?.dispose(figure.root); }
    figure = null; resources = null; rest.clear();
  }
  function update(character: Parameters<typeof compileVisual>[0]) {
    if (disposed) return;
    const visual = compileVisual(character);
    const next = JSON.stringify(visual);
    if (next === stamp) return;
    const appearance = Object.values(visual.behaviors.appearances)[0] as {model: string; materials: Record<string, unknown>; scale: number[]};
    const nextResources = createRenderKit();
    const staging = new THREE.Group();
    const engine = (globalThis as unknown as {LWAssetRenderer: {
      createFromDefinition(kit: unknown, parent: THREE.Object3D, asset: unknown, model: string, options: unknown): Instance;
    }}).LWAssetRenderer;
    let nextFigure: Instance;
    try {
      nextFigure = engine.createFromDefinition(nextResources.kit, staging, visual, appearance.model,
        {materials: appearance.materials, scale: appearance.scale});
    } catch (error) { nextResources.dispose(staging); throw error; }
    clearFigure(); resources = nextResources; figure = nextFigure; stamp = next;
    rig = visual.rig as Record<string, string | string[]>;
    footSockets = visual.behaviors.sockets?.feet || [];
    for (const role of ['care', 'carry']) {
      const id = rig[role]; if (typeof id === 'string') { const node = figure.handles.get(id); if (node) node.visible = false; }
    }
    for (const [id, node] of figure.handles) rest.set(id, {
      position: node.position.clone(), rotation: node.rotation.clone(), scale: node.scale.clone(),
    });
    scene.add(figure.root);
    const box = new THREE.Box3().setFromObject(figure.root);
    characterHeight = Math.max(.5, box.max.y);
    canvas.dataset.model = appearance.model;
    canvas.dataset.nodes = String(figure.handles.size);
    draw(); resume();
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = {x: event.clientX, y: event.clientY}; canvas.setPointerCapture(event.pointerId); canvas.focus();
  }, {signal: lifecycle.signal});
  canvas.addEventListener('pointermove', event => {
    if (!drag) return;
    yaw -= (event.clientX - drag.x) * .008;
    elevation = clamp(elevation + (event.clientY - drag.y) * .005, -.3, .8);
    drag = {x: event.clientX, y: event.clientY}; draw();
  }, {signal: lifecycle.signal});
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, () => { drag = null; }, {signal: lifecycle.signal});
  }
  function changeZoom(delta: number) { zoom = clamp(zoom + delta, .5, 2.5); draw(); }
  function reset() { yaw = 0; elevation = .12; zoom = 1; draw(); }
  canvas.addEventListener('wheel', event => {
    event.preventDefault(); changeZoom(-event.deltaY * .001);
  }, {passive: false, signal: lifecycle.signal});
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') yaw -= .15;
    if (event.key === 'ArrowRight') yaw += .15;
    if (event.key === 'ArrowUp') elevation = clamp(elevation + .1, -.3, .8);
    if (event.key === 'ArrowDown') elevation = clamp(elevation - .1, -.3, .8);
    if (event.key === '+' || event.key === '=') changeZoom(.1);
    if (event.key === '-') changeZoom(-.1);
    if (event.key === 'Home') reset();
    draw();
  }, {signal: lifecycle.signal});
  function pause(value: boolean) {
    paused = value; previousTime = 0;
    if (paused && frame) { cancelAnimationFrame(frame); frame = 0; }
    draw(); resume();
  }
  reducedMotion.addEventListener('change', event => pause(event.matches), {signal: lifecycle.signal});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; previousTime = 0; }
    else resume();
  }, {signal: lifecycle.signal});
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextLost = true; canvas.dataset.renderer = 'context-lost';
    if (frame) cancelAnimationFrame(frame); frame = 0;
  }, {signal: lifecycle.signal});
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false; canvas.dataset.renderer = 'three-engine'; draw(); resume();
  }, {signal: lifecycle.signal});
  const observer = new ResizeObserver(draw); observer.observe(canvas);
  setLight('studio'); resume();
  return {
    update, setLight, reset, pause, zoom: changeZoom,
    setMode(value: Mode) { mode = value; stage.setWorld(value === 'world'); draw(); },
    setPose(value: Pose) { pose = value; time = 0; draw(); },
    setCamera(value: 'front' | 'side' | 'back') {
      yaw = value === 'front' ? 0 : value === 'side' ? Math.PI / 2 : Math.PI;
      elevation = .08; draw();
    },
    capture() {
      if (disposed || contextLost) throw new Error('The 3D preview is unavailable. Reload before capturing a portrait.');
      draw(); return canvas.toDataURL('image/png');
    },
    dispose() {
      if (disposed) return;
      disposed = true; cancelAnimationFrame(frame); lifecycle.abort(); observer.disconnect();
      clearFigure(); stage.dispose(); sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
