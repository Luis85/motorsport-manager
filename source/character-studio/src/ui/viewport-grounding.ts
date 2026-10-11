import * as THREE from 'three';

/** Keep the visible foot and its sibling equipment pivot above the presentation floor. */
export function groundPreviewFoot(foot: THREE.Object3D, socket?: THREE.Object3D): void {
  const bounds = new THREE.Box3(), part = new THREE.Box3();
  function visit(node: THREE.Object3D): void {
    if (!node.visible) return;
    if (node instanceof THREE.Mesh) {
      if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
      if (node.geometry.boundingBox) bounds.union(part.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld));
    }
    node.children.forEach(visit);
  }
  for (const root of [foot, socket]) if (root) { root.updateWorldMatrix(true, true); visit(root); }
  if (bounds.isEmpty() || bounds.min.y >= 0) return;
  const correction = new THREE.Vector3(0, -bounds.min.y, 0);
  for (const root of [foot, socket]) if (root) {
    const origin = root.getWorldPosition(new THREE.Vector3()).add(correction);
    root.position.copy(root.parent ? root.parent.worldToLocal(origin) : origin);
  }
}
