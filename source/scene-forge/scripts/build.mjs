import { build } from 'esbuild';
import { mkdir, chmod, writeFile, readFile, copyFile, cp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
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
const threeLicense = await readFile('node_modules/three/LICENSE', 'utf8');
await build({
  entryPoints: ['src/preview/viewer.ts'],
  outfile: 'dist/viewer.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  minify: true,
  legalComments: 'inline',
  banner: { js: '/*! Bundled Three.js license:\n' + threeLicense + '\n*/' },
});
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
console.log('Built CLI, typed library, JSON Schemas and offline Three.js viewer.');
