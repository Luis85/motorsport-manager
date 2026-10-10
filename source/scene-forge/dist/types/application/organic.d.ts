import * as THREE from 'three';
import type { Geometry } from '../domain/schema.js';
import type { Resolved } from '../domain/validate.js';
/** Smooth, closed plush forms. Taper narrows the top; bend offsets the two ends along X. */
export declare function organicGeometry(g: Resolved<Extract<Geometry, {
    type: 'organic';
}>>): THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>;
