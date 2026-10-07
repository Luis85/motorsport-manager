import type { Object3D } from 'three';
export const clean = (n: number) => (Math.abs(n) < 1e-10 ? 0 : +n.toFixed(7));
export function transformData(object: Object3D) {
  return {
    position: object.position.toArray().map(clean) as [number, number, number],
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z].map((v) =>
      clean((v * 180) / Math.PI),
    ) as [number, number, number],
    scale: object.scale.toArray().map(clean) as [number, number, number],
  };
}
