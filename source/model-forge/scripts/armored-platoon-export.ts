/** Scene Forge exports are input, semantic bindings and embedded runtime payload are output. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatAuthoredJson } from './format-authored-json.mjs';
import {
  semanticBindings,
  parse,
  ModelSchema,
  SceneSchema,
  authoringTarget,
  compileScene,
  exportScene,
  canonical,
} from '../src/kernel/index.js';
const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? fallback : args[index + 1];
};
const project = resolve(root, option('project', 'source/scene-forge/examples/armored-platoon'));
const output = resolve(
  root,
  option('output', 'docs/concepts/armored-platoon/content/visuals.json'),
);
await formatAuthoredJson(resolve(root, 'source/model-forge/examples/armored-platoon'));
await formatAuthoredJson(project);
const assets: Record<string, unknown> = {};
for (const id of ['m4-sherman', 'panzer-iv']) {
  const object = JSON.parse(readFileSync(resolve(project, `exports/${id}.three.json`), 'utf8'));
  const model = parse(
    ModelSchema,
    JSON.parse(readFileSync(resolve(project, `models/${id}.model.json`), 'utf8')),
  );
  const emptyScene = parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'main',
    name: 'Main',
  });
  const library = { [id]: model };
  const target = authoringTarget(emptyScene, library, { model: id });
  const expected = await exportScene(target, library, 'three');
  if (
    typeof expected.data !== 'string' ||
    canonical(JSON.parse(expected.data)) !== canonical(object)
  )
    throw new Error(
      `Stale Scene Forge export for ${id}; re-export its imported model before packaging.`,
    );
  // Preserve native Three exports as arrays; use lossless compact transport only in the pack.
  // Admission checks canonical base64 and decoded budgets before Three receives typed pixels.
  for (const image of object.images ?? []) {
    const pixels = image.url;
    if (
      pixels.type !== 'Uint8Array' ||
      pixels.width !== 128 ||
      pixels.height !== 128 ||
      !Array.isArray(pixels.data) ||
      pixels.data.length !== 65536 ||
      pixels.data.some(
        (value: unknown) =>
          !Number.isInteger(value) || (value as number) < 0 || (value as number) > 255,
      )
    )
      throw new Error(`Unexpected native image payload for ${id}.`);
    pixels.data = Buffer.from(pixels.data).toString('base64');
    pixels.encoding = 'base64';
  }
  const compiled = compileScene(target, library);
  let semantics;
  try {
    semantics = semanticBindings(compiled.scene, [
      'articulation:hull',
      'articulation:turret',
      'articulation:gun',
      'articulation:recoil',
      'socket:muzzle',
      'socket:commander',
      'socket:optic',
      'socket:exhaust',
      'volume:engine',
      'volume:ammunition',
    ]);
  } finally {
    // The compiler owns geometries, materials and shared native finish textures.
    compiled.dispose();
  }
  assets[id] = { object, semantics };
}
writeFileSync(
  output,
  JSON.stringify({
    format: 'wildlands-armored-visuals',
    version: 2,
    assets,
  }) + '\n',
);
console.log('Exported authored assets with required semantic bindings.');
