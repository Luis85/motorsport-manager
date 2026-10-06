import * as THREE from 'three';
import type { Geometry } from '../domain/schema.js';
import type { Resolved } from '../domain/validate.js';
/** Centripetal spline tube with separate cap vertices for hard end normals and radial UVs. */
export declare function tubeGeometry(spec: Resolved<Extract<Geometry, {
    type: 'tube';
}>>): THREE.TubeGeometry;
