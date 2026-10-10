import * as THREE from 'three';
import type { TransformSpec } from '../domain/schema.js';
import type { Resolved } from '../domain/validate.js';
export declare const radians: (v: number) => number;
export declare function transform(object: THREE.Object3D, t?: Resolved<TransformSpec>): void;
export { uuid } from '../domain/identity.js';
export declare const triangles: (g: THREE.BufferGeometry) => number;
