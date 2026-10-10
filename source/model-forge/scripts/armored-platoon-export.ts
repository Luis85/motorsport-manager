/** Scene Forge exports are input, semantic bindings and embedded runtime payload are output. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ObjectLoader } from 'three';
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
  const scene = new ObjectLoader().parse(object);
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
  const compiled = compileScene(target, library);
  const semantics = semanticBindings(compiled.scene, [
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
  compiled.dispose();
  assets[id] = { object, semantics };
  scene.traverse((node) => {
    const mesh = node as import('three').Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) material?.dispose();
  });
}
writeFileSync(
  output,
  JSON.stringify(
    {
      format: 'wildlands-armored-visuals',
      version: 1,
      assets,
    },
    null,
    2,
  ) + '\n',
);
console.log('Exported authored assets with required semantic bindings.');
