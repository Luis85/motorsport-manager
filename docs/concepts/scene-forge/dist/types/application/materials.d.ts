import * as THREE from 'three';
import type { MaterialSpec } from '../domain/schema.js';
/** Both supported shading modes have a glTF representation; no executable shader code is accepted. */
export declare function createMaterial(m: MaterialSpec): THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
