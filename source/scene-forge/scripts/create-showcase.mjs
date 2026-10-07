import { animationLab } from './showcase/animation.mjs';
import { assetStudio } from './showcase/assets.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { parse, ModelSchema, SceneSchema } from '../src/domain/schema.ts';
import { loadProject } from '../src/infra/project.ts';
import { compileScene } from '../src/application/compiler.ts';
import { packScene } from '../src/infra/bundle.ts';
import { courtyard } from './showcase/courtyard.mjs';
import { plant } from './showcase/plant.mjs';
import { robot } from './showcase/robot.mjs';

const write = async (file, data) => writeFile(file, JSON.stringify(data, null, 2) + '\n');
const root = 'examples/showcase',
  models = {},
  scenes = {},
  catalog = [];
for (const folder of [`${root}/scenes`, `${root}/models`, `${root}/exports`, 'examples/catalog'])
  await mkdir(folder, { recursive: true });
for (const [project, id, description] of [
  ['outpost', 'outpost', 'A field outpost with a reusable survey rover and supplies.'],
  [
    'composition',
    'fieldStation',
    'A larger field station composed from eight reusable model types.',
  ],
  ['procedural', 'logistics', 'Parameter-driven shelving, nested cargo and repeated layouts.'],
]) {
  const source = await loadProject(`examples/${project}`);
  Object.assign(models, source.models);
  scenes[id] = parse(SceneSchema, { ...source.scene, id });
  catalog.push({
    id,
    name: source.scene.name,
    description,
    features: ['Model composition', 'Portable scene bundles', 'Multi-view review'],
  });
}
for (const example of [courtyard, plant, robot, assetStudio, animationLab]) {
  for (const raw of example.models) {
    const model = parse(ModelSchema, {
      category:
        example === courtyard
          ? 'Architecture'
          : example === plant
            ? 'Industrial'
            : example === robot
              ? 'Robotics'
              : raw.category,
      ...raw,
    });
    models[model.id] = model;
  }
  const scene = parse(SceneSchema, example.scene);
  scenes[scene.id] = scene;
  catalog.push({
    id: scene.id,
    name: scene.name,
    description: example.description,
    features: example.features,
  });
}
for (const [id, model] of Object.entries(models))
  await write(`${root}/models/${id}.model.json`, model);
for (const [id, scene] of Object.entries(scenes)) {
  const built = compileScene(scene, models);
  const entry = catalog.find((example) => example.id === id);
  entry.stats = built.stats;
  built.dispose();
  entry.models = Object.keys(packScene(scene, models).models);
  await write(`${root}/scenes/${id}.scene.json`, scene);
  await write(`examples/catalog/${id}.scene-bundle.json`, packScene(scene, models));
}
await write(`${root}/forge.project.json`, {
  schemaVersion: 1,
  name: 'Scene Forge / Example Workshop',
  activeScene: 'assetStudio',
  scenes: Object.fromEntries(Object.keys(scenes).map((id) => [id, `scenes/${id}.scene.json`])),
  models: Object.fromEntries(Object.keys(models).map((id) => [id, `models/${id}.model.json`])),
});
await write('examples/catalog/index.json', catalog);
console.log(
  JSON.stringify(
    catalog.map(({ id, models, stats }) => ({
      id,
      models: models.length,
      meshes: stats.meshes,
      triangles: stats.triangles,
    })),
  ),
);
