import * as THREE from 'three';
import type { TransformSpec } from '../domain/schema.js';
import type { Resolved } from '../domain/validate.js';
export const radians = (v: number) => THREE.MathUtils.degToRad(v);
export function transform(object: THREE.Object3D, t?: Resolved<TransformSpec>) {
  if (t?.position) object.position.fromArray(t.position as number[]);
  if (t?.rotation)
    object.rotation.set(
      ...((t.rotation as [number, number, number]).map(radians) as [number, number, number]),
    );
  if (t?.scale) object.scale.fromArray(t.scale as number[]);
  object.updateMatrixWorld(true);
}
export { uuid } from '../domain/identity.js';
export const triangles = (g: THREE.BufferGeometry) =>
  (g.index?.count ?? g.getAttribute('position').count) / 3;
