/**
 * Browser entry of the model recipe kernel. It realizes compiled Three.js scene JSON and
 * never imports the schema runtime, compiler or Node built-ins.
 */
export type * from '../domain/schema.js';
export type { SceneStats } from '../application/compiler.js';
export type * from './page.js';
export { ForgeError, fail, errorMessage, errorCode } from '../domain/errors.js';
export { uuid } from '../domain/identity.js';
export { scalar } from '../domain/scalar.js';
export { fitCamera, cameraData } from '../application/camera.js';
export { createLight, orientLight } from '../application/lights.js';
export * from '../application/rigging.js';
export { gltfScene } from '../application/gltf-scene.js';
export { createMaterial } from '../application/materials.js';
export * from '../application/surfaces.js';
export * from './realization.js';
export * from './viewport.js';
