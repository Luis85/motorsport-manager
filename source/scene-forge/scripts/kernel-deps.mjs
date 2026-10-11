// Single-copy dependency resolution for the shared model recipe kernel under tsx.
//
//   node --import tsx --import ./scripts/kernel-deps.mjs ...
//
// Scene Forge imports the kernel source from ../model-forge/src/kernel through src/kernel.ts.
// Bare imports made by kernel files (three, zod, three-bvh-csg, three-mesh-bvh, gltf-validator,
// playwright) must resolve from Scene Forge's own node_modules: one instance of each
// library (instanceof and Zod identity hold) and no need for model-forge/node_modules.
// The build scripts apply the same rule through an esbuild plugin (scripts/kernel-resolve.mjs).
import { register } from 'node:module';
import { isMainThread } from 'node:worker_threads';

const kernel = new URL('../../model-forge/src/kernel/', import.meta.url).href;
const anchor = new URL('../package.json', import.meta.url).href;
const relative = /^(?:\.{1,2}(?:\/|$)|\/|[a-z][a-z0-9+.-]*:|#)/i;

/** Module customization hook: re-anchor bare specifiers imported from kernel files. */
export async function resolve(specifier, context, nextResolve) {
  if (context.parentURL?.startsWith(kernel) && !relative.test(specifier))
    return nextResolve(specifier, { ...context, parentURL: anchor });
  return nextResolve(specifier, context);
}

// The same file serves as the --import entry (main thread) and as the hooks module.
if (isMainThread) register(import.meta.url);
