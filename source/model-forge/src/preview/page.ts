/**
 * Render-only Model Forge page: realizes compiled Three.js scene JSON, answers the kernel's
 * RenderPageWindow capture contract and offers orbit inspection. It never edits a document.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  createRealization,
  createViewport,
  boundsOf,
  fitCamera,
  cameraData,
  errorMessage,
  type CameraRequest,
  type RenderPageWindow,
} from '../kernel/render/index.js';
import type { PagePayload } from './payload.js';

const host = window as unknown as RenderPageWindow & { __MODEL_FORGE__: PagePayload };
const element = (id: string) => document.getElementById(id)!;

async function boot() {
  const payload = host.__MODEL_FORGE__;
  const source = payload.document;
  const scene = new THREE.ObjectLoader().parse(payload.scene) as THREE.Scene;
  const content = scene.children[0];
  const stage = element('stage');
  const viewport = createViewport(scene, source, stage);
  const { renderer } = viewport;
  const realization = createRealization(source);
  realization.apply(content);
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  const grid = viewport.lighting(content, true);
  let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  let controls: OrbitControls | undefined;
  const draw = () => renderer.render(scene, camera);
  function fit(overrides: Partial<CameraRequest> = {}) {
    const request: CameraRequest = {
      view: 'iso',
      projection: 'auto',
      azimuth: 45,
      elevation: 30,
      padding: 1.12,
      fov: 40,
      ...overrides,
    };
    const aspect = stage.clientWidth / Math.max(stage.clientHeight, 1);
    const fitted = fitCamera(boundsOf(content), aspect, request);
    camera = fitted.camera;
    controls?.dispose();
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(fitted.target);
    controls.addEventListener('change', draw);
    controls.update();
    draw();
  }
  function setWireframe(enabled: boolean) {
    content.traverse((object) => {
      if (object instanceof THREE.Mesh)
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(
          (material: THREE.Material) =>
            ((material as THREE.MeshStandardMaterial).wireframe = enabled),
        );
    });
  }
  function resize() {
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    const aspect = stage.clientWidth / Math.max(stage.clientHeight, 1);
    if (camera instanceof THREE.PerspectiveCamera) camera.aspect = aspect;
    else {
      const half = (camera.top - camera.bottom) / 2;
      camera.left = -half * aspect;
      camera.right = half * aspect;
    }
    camera.updateProjectionMatrix();
    draw();
  }
  fit();
  new ResizeObserver(resize).observe(stage);
  element('title').textContent = `${source.name} · ${payload.stats.triangles} triangles`;
  window.addEventListener('pagehide', () => realization.dispose(), { once: true });
  host.forgeViewer = {
    setGrid: (visible: boolean) => {
      grid.visible = visible;
      draw();
    },
    clearSelection: () => {},
    render: draw,
    getCamera: () => cameraData(camera, controls!.target),
    configureCapture: (request: CameraRequest, wireframe: boolean) => {
      fit(request);
      setWireframe(wireframe);
      draw();
    },
    stats: payload.stats,
  };
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => {
      draw();
      resolve();
    }),
  );
  host.forgeReady = true;
}
boot().catch((error: unknown) => {
  host.forgeError = String(error);
  element('title').textContent = `Preview could not start: ${errorMessage(error)}`;
});
