// esbuild counterpart of scripts/kernel-deps.mjs: bare imports made by the shared model
// recipe kernel (../model-forge/src/kernel) resolve from Scene Forge's own node_modules, so a
// bundle contains one copy of three, zod and the CSG libraries and never needs
// model-forge/node_modules.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const sceneForgeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const kernelRoot = path.resolve(sceneForgeRoot, '../model-forge/src/kernel');

export const kernelDependencies = {
  name: 'kernel-dependencies',
  setup(build) {
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.pluginData?.kernelDependency || !args.importer.startsWith(kernelRoot + path.sep))
        return undefined;
      return build.resolve(args.path, {
        kind: args.kind,
        resolveDir: sceneForgeRoot,
        pluginData: { kernelDependency: true },
      });
    });
  },
};
