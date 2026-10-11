import * as THREE from 'three';
import type { MaterialSpec } from '../domain/schema.js';
import { type createSurfacePool } from './surfaces.js';
/** Both supported shading modes have a glTF representation; no executable shader code is accepted. */
export declare function createMaterial(m: MaterialSpec, surfaces?: ReturnType<typeof createSurfacePool>): THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
