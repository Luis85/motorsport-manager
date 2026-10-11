// Viewport camera ownership: fits named or saved views to the scene or selection
// bounds, replaces the orbit controls for every new camera, keeps the projection in
// step with the stage size, and reflects the active view in the toolbar and label.
// A new camera is announced through `onCamera` so the transform gizmo can follow it.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { fitCamera, cameraData } from '../application/camera.js';
import type { CameraRequest, SceneDocument } from '../domain/schema.js';
import { $ } from './dom.js';

export type ViewCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;
interface CameraRigContext {
  stage: HTMLElement;
  renderer: THREE.WebGLRenderer;
  source: SceneDocument;
  /** Visible bounds of an object, or of the whole scene content when omitted. */
  bounds(object?: THREE.Object3D): THREE.Box3;
  selectedObject(): THREE.Object3D | undefined;
  draw(): void;
  onCamera(camera: ViewCamera): void;
}
export function createCameraRig({
  stage,
  renderer,
  source,
  bounds,
  selectedObject,
  draw,
  onCamera,
}: CameraRigContext) {
  let camera: ViewCamera;
  let controls: OrbitControls;
  let view = 'iso';
  function fit(nextView = 'iso', selectionOnly = false, overrides: Partial<CameraRequest> = {}) {
    view = nextView;
    const object = selectionOnly ? selectedObject() : undefined;
    const request: CameraRequest = {
      view: nextView as CameraRequest['view'],
      projection: 'auto',
      azimuth: 45,
      elevation: 30,
      padding: 1.12,
      fov: 40,
      ...overrides,
    };
    const fitted = fitCamera(
      bounds(object),
      stage.clientWidth / Math.max(stage.clientHeight, 1),
      request,
      source.camera,
    );
    controls?.dispose();
    camera = fitted.camera;
    const target = fitted.target;
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.addEventListener('change', draw);
    controls.update();
    onCamera(camera);
    document
      .querySelectorAll<HTMLButtonElement>('[data-view]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === nextView)));
    $('view-label').textContent =
      nextView === 'iso'
        ? 'Perspective'
        : nextView === 'authored'
          ? 'Saved camera'
          : nextView[0].toUpperCase() + nextView.slice(1);
    draw();
  }
  function resize() {
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    if (!camera) return;
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
  return {
    fit,
    resize,
    camera: () => camera,
    controls: () => controls,
    view: () => view,
    snapshot: () => cameraData(camera, controls.target),
  };
}
