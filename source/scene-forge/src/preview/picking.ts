// Click-to-select picking on the viewport canvas. A primary-button release that was
// neither a gizmo drag nor an orbit drag (more than 4 px) ray-casts the visible scene
// content and resolves the first fully visible hit to its nearest authored node.
import * as THREE from 'three';
import type { SceneDocument } from '../domain/schema.js';

/** True when the object and every ancestor are visible. */
export function visibleInScene(object: THREE.Object3D) {
  let p: THREE.Object3D | null = object;
  while (p) {
    if (!p.visible) return false;
    p = p.parent;
  }
  return true;
}
/** The authored node owning an object: the closest ancestor named `<scene>/<node>`. */
export function nodeIdForObject(
  hitObject: THREE.Object3D | undefined,
  content: THREE.Object3D,
  source: SceneDocument,
) {
  let object = hitObject;
  let id: string | undefined;
  while (object && object !== content) {
    const node = source.nodes.find((n) => object!.name === `${source.id}/${n.id}`);
    if (node) {
      id = node.id;
      break;
    }
    object = object.parent ?? undefined;
  }
  return id;
}
export function setupPicking({
  canvas,
  camera,
  content,
  source,
  dragging,
  select,
}: {
  canvas: HTMLCanvasElement;
  camera(): THREE.Camera;
  content(): THREE.Object3D;
  source: SceneDocument;
  /** Whether the transform gizmo is (or just was) dragging. */
  dragging(): boolean;
  select(id?: string): void;
}) {
  const raycaster = new THREE.Raycaster();
  let down = { x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener('pointerup', (e) => {
    if (e.button !== 0 || dragging() || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4)
      return;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera(),
    );
    const hit = raycaster
      .intersectObject(content(), true)
      .find((hit) => visibleInScene(hit.object));
    select(nodeIdForObject(hit?.object, content(), source));
  });
}
