/**
 * Node entry of the model recipe kernel: contracts, deterministic compilation and the
 * deterministic I/O shared by Model Forge and Scene Forge. Browser code imports
 * `./render/index.js` instead. Kernel modules import nothing outside src/kernel.
 */
export * from './domain/schema.js';
export * from './domain/errors.js';
export * from './domain/canonical.js';
export * from './domain/identity.js';
export * from './domain/validate.js';
export { validateRig } from './domain/rig.js';
export * from './domain/random.js';
export * from './domain/digest.js';

export * from './application/compiler.js';
export * from './application/resources.js';
export * from './application/transforms.js';
export * from './application/materials.js';
export * from './application/surfaces.js';
export * from './application/surface-pattern.js';
export * from './application/lights.js';
export * from './application/camera.js';
export * from './application/rigging.js';
export * from './application/gltf-scene.js';
export * from './application/inspection.js';
export * from './application/operations.js';
export * from './application/composition.js';
export * from './application/target.js';
export * from './application/edit.js';
export * from './application/quality.js';
export * from './application/littlewild.js';
export * from './application/littlewild-import.js';
export * from './application/littlewild-resources.js';
export * from './application/heightfield.js';
export * from './application/terrain.js';
export * from './application/terrain-presets.js';
export * from './application/placement.js';
export * from './application/scatter.js';

export * from './io/files.js';
export * from './io/state-hash.js';
export * from './io/export.js';
export * from './io/littlewild.js';
export * from './io/playwright.js';
export * from './io/capture.js';
export * from './io/review.js';
export type * from './render/page.js';
export * from './application/semantic-bindings.js';
