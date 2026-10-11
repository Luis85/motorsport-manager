// Package build: dist/ (gitignored) for source and package runs, then ../../bin/model-forge.
//
//   node scripts/build.mjs            dist/cli.js, dist/index.js, dist/preview.js, dist/examples
//                                     and the checked-in executable bin/model-forge
//   node scripts/build.mjs --preview  only dist/preview.js (what source-mode review needs)
import { build } from 'esbuild';
import { chmod, cp, mkdir, writeFile } from 'node:fs/promises';
import { buildPreview, writeStandalone } from './standalone.mjs';

await mkdir('dist', { recursive: true });
const preview = await buildPreview();
await writeFile('dist/preview.js', preview);
if (process.argv.includes('--preview')) {
  console.log('Built dist/preview.js.');
} else {
  await build({
    entryPoints: ['src/cli.ts', 'src/index.ts'],
    outdir: 'dist',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    packages: 'external',
    sourcemap: true,
    logLevel: 'warning',
  });
  await cp('examples', 'dist/examples', { recursive: true });
  await chmod('dist/cli.js', 0o755);
  await writeStandalone(undefined, preview);
  console.log('Built dist/ (CLI, library, preview page, examples) and ../../bin/model-forge.');
}
