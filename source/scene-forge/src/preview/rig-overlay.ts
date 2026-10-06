import * as THREE from 'three';
export function createRigOverlay(helpers: THREE.Group) {
  let overlay: THREE.SkeletonHelper | undefined;
  return {
    show(object?: THREE.Object3D) {
      if (overlay) {
        overlay.removeFromParent();
        overlay.geometry.dispose();
        (Array.isArray(overlay.material) ? overlay.material : [overlay.material]).forEach((m) =>
          m.dispose(),
        );
        overlay = undefined;
      }
      if (!object) return;
      overlay = new THREE.SkeletonHelper(object);
      (Array.isArray(overlay.material) ? overlay.material : [overlay.material]).forEach((m) => {
        m.depthTest = false;
      });
      overlay.renderOrder = 20;
      helpers.add(overlay);
    },
  };
}
