import { build } from 'esbuild';
import { mkdir, chmod, writeFile, copyFile, cp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { buildViewer, writeStandalone } from './standalone.mjs';
await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/cli.ts', 'src/index.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
});
const viewer = await buildViewer();
await writeFile('dist/viewer.js', viewer);
await copyFile('src/preview/styles.css', 'dist/viewer.css');
await cp('examples/catalog', 'dist/examples', { recursive: true });
await chmod('dist/cli.js', 0o755);
execFileSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.build.json'],
  { stdio: 'inherit' },
);
const { jsonSchema, schemaKinds } = await import('../dist/index.js');
await mkdir('schemas', { recursive: true });
for (const kind of schemaKinds)
  await writeFile(`schemas/${kind}.schema.json`, JSON.stringify(jsonSchema(kind), null, 2) + '\n');
// The repository executable embeds the same viewer bundle.
await writeStandalone(undefined, viewer);
console.log(
  'Built CLI, typed library, JSON Schemas, offline Three.js viewer and ../../bin/scene-forge.',
);
