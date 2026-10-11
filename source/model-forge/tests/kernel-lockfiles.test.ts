import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Scene Forge executes this kernel with its own node_modules (scripts/kernel-deps.mjs and
// kernel-resolve.mjs), so both projects must lock the same versions of the kernel's packages.
const shared = [
  'three',
  'three-bvh-csg',
  'three-mesh-bvh',
  'zod',
  'gltf-validator',
  'playwright',
  'playwright-core',
  '@types/three',
  'typescript',
];
interface Lock {
  packages: Record<string, { version?: string; integrity?: string }>;
}
interface Manifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}
const json = async <T>(file: string): Promise<T> =>
  JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8')) as T;

test('model-forge and scene-forge lock identical versions of the shared kernel packages', async () => {
  const [mine, scene] = await Promise.all([
    json<Lock>('../package-lock.json'),
    json<Lock>('../../scene-forge/package-lock.json'),
  ]);
  for (const name of shared) {
    const key = `node_modules/${name}`;
    assert.ok(mine.packages[key]?.version, `model-forge locks ${name}`);
    assert.equal(mine.packages[key].version, scene.packages[key]?.version, `${name} version`);
    assert.equal(mine.packages[key].integrity, scene.packages[key]?.integrity, `${name} integrity`);
  }
});

test('model-forge and scene-forge declare the same ranges for the shared kernel packages', async () => {
  const [mine, scene] = await Promise.all([
    json<Manifest>('../package.json'),
    json<Manifest>('../../scene-forge/package.json'),
  ]);
  const range = (manifest: Manifest, name: string) =>
    manifest.dependencies[name] ?? manifest.devDependencies[name];
  for (const name of shared.filter((n) => n !== 'playwright-core'))
    assert.equal(range(mine, name), range(scene, name), name);
});
