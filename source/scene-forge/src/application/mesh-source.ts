import type * as THREE from 'three';
import type { Geometry } from '../domain/schema.js';
import type { Resolved } from '../domain/validate.js';

type Mesh = Resolved<Extract<Geometry, { type: 'mesh' }>>;
type Snapshot = {
  source: Mesh;
  attributes: {
    name: string;
    size: number;
    normalized: boolean;
    attributeType: Function;
    arrayType: Function;
    values: ArrayLike<number>;
  }[];
  indices: ArrayLike<number>;
};
const sources = new WeakMap<THREE.BufferGeometry, Snapshot>();
/** Keep authored decimals outside Three JSON/extras; the compilation owns their lifetime. */
export function rememberMeshSource(geometry: THREE.BufferGeometry, source: Mesh) {
  const attributes = ['position', 'normal', 'uv']
    .filter((name) => geometry.getAttribute(name))
    .map((name) => {
      const attribute = geometry.getAttribute(name);
      return {
        name,
        size: attribute.itemSize,
        normalized: attribute.normalized,
        attributeType: attribute.constructor,
        arrayType: attribute.array.constructor,
        values: attribute.array.slice(),
      };
    });
  sources.set(geometry, { source, attributes, indices: geometry.index!.array.slice() });
  geometry.addEventListener('dispose', () => sources.delete(geometry));
}
/** Reuse precise source data only while every compiled buffer still matches its captured value. */
export function authoredMeshBuffers(geometry: THREE.BufferGeometry) {
  const snapshot = sources.get(geometry);
  if (!snapshot) return undefined;
  const matches = (current: ArrayLike<number>, original: ArrayLike<number>) => {
    if (current.length !== original.length) return false;
    for (let i = 0; i < current.length; i++) if (current[i] !== original[i]) return false;
    return true;
  };
  if (
    snapshot.attributes.some(({ name, size, normalized, attributeType, arrayType, values }) => {
      const attribute = geometry.getAttribute(name);
      return (
        !attribute ||
        attribute.itemSize !== size ||
        attribute.normalized !== normalized ||
        attribute.constructor !== attributeType ||
        attribute.array.constructor !== arrayType ||
        !matches(attribute.array, values)
      );
    }) ||
    !geometry.index ||
    !matches(geometry.index.array, snapshot.indices)
  )
    return undefined;
  const { source } = snapshot;
  return {
    positions: source.positions.flat(),
    indices: [...source.indices],
    ...(source.normals ? { normals: source.normals.flat() } : {}),
    ...(source.uvs ? { uvs: source.uvs.flat() } : {}),
  };
}
