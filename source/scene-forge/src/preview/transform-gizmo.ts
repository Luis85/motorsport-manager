// The transform gizmo: owns the TransformControls instance for the current camera,
// the select/translate/rotate/scale mode and its toolbar buttons, the snap toggle and
// attachment to the selected visible object. Drags are reported through callbacks;
// the viewer decides how a drag becomes an edit and owns its undo history.
import type * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { field } from './dom.js';

interface TransformGizmoContext {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  editable: boolean;
  controls(): OrbitControls;
  selectedObject(): THREE.Object3D | undefined;
  draw(): void;
  onDragStart(): void;
  onObjectChange(): void;
  onDragEnd(): void;
}
export function createTransformGizmo({
  scene,
  renderer,
  editable,
  controls,
  selectedObject,
  draw,
  onDragStart,
  onObjectChange,
  onDragEnd,
}: TransformGizmoContext) {
  let gizmo: TransformControls;
  let mode = 'select';
  function attach() {
    if (!gizmo) return;
    gizmo.detach();
    const object = selectedObject();
    if (editable && object && mode !== 'select' && object.visible) {
      gizmo.setMode(mode as 'translate');
      gizmo.attach(object);
    }
    draw();
  }
  function setMode(next: string) {
    mode = next;
    document
      .querySelectorAll<HTMLButtonElement>('[data-mode]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    attach();
  }
  /** Replace the gizmo for a new camera, keeping the current mode and snap settings. */
  function setup(camera: THREE.Camera) {
    if (gizmo) {
      scene.remove(gizmo.getHelper());
      gizmo.dispose();
    }
    gizmo = new TransformControls(camera, renderer.domElement);
    gizmo.setSpace('local');
    gizmo.setSize(0.85);
    scene.add(gizmo.getHelper());
    if (field('snap').checked) {
      gizmo.setTranslationSnap(0.25);
      gizmo.setRotationSnap(Math.PI / 12);
      gizmo.setScaleSnap(0.1);
    }
    gizmo.addEventListener('dragging-changed', (event) => {
      controls().enabled = !event.value;
    });
    gizmo.addEventListener('mouseDown', onDragStart);
    gizmo.addEventListener('objectChange', onObjectChange);
    gizmo.addEventListener('mouseUp', onDragEnd);
    gizmo.addEventListener('change', draw);
    attach();
  }
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => {
    b.disabled = !editable && b.dataset.mode !== 'select';
    b.addEventListener('click', () => setMode(b.dataset.mode!));
  });
  field('snap').addEventListener('change', () => {
    const on = field('snap').checked;
    gizmo.setTranslationSnap(on ? 0.25 : null);
    gizmo.setRotationSnap(on ? Math.PI / 12 : null);
    gizmo.setScaleSnap(on ? 0.1 : null);
  });
  return { setup, attach, setMode, current: () => gizmo, detach: () => gizmo?.detach() };
}
