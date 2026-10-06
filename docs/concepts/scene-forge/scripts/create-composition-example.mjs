import { mkdir, writeFile } from 'node:fs/promises';
import {
  parse,
  SceneSchema,
  ModelSchema,
  CompositionSchema,
  captureModel,
  compileScene,
  loadProject,
} from '../dist/index.js';

// Deterministic fixture generator. It writes only the bundled example project.
const root = 'examples/composition';
const source = await loadProject('examples/outpost', 'main');
const library = { rover: source.models.rover, barrel: source.models.barrel };
function capture(id, name, roots, origin = [0, 0, 0]) {
  const model = captureModel(source.scene, roots, id, name);
  if (roots.length > 1)
    for (const node of model.nodes)
      if (!node.parent) {
        const position = node.transform?.position ?? [0, 0, 0];
        node.transform = { ...node.transform, position: position.map((v, i) => v - origin[i]) };
      }
  library[id] = parse(ModelSchema, model);
}
capture(
  'habitat',
  'Habitat module',
  ['station', 'stationTop', 'stationFoot', 'stationDoor', 'entryStep', 'antenna'],
  [-2.15, 0, -1.8],
);
capture('solar', 'Solar collector', ['array']);
capture('cargo', 'Cargo crate', ['crate1', 'crate1Band'], [-2.7, 0, 0.2]);
capture('landingPad', 'Landing pad', ['servicePad', 'padMarks'], [0.7, 0, 1]);
capture('platform', 'Terrain platform', ['base', 'terrain']);
const floor = 0.035;
function groundY(model) {
  const scene = parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'measure',
    name: 'Measure',
    nodes: [{ type: 'model', id: 'root', model }],
  });
  const built = compileScene(scene, library);
  const min = built.stats.bounds.min[1];
  built.dispose();
  return floor - min;
}
const groups = [
  { id: 'baseCamp', name: 'Base camp', transform: { position: [0, 0, -3.2] } },
  { id: 'fleet', name: 'Survey fleet', transform: { position: [0, 0, 1.4] } },
  { id: 'power', name: 'Power systems' },
  { id: 'supplies', name: 'Field supplies' },
];
const instance = (id, model, name, x, z, parent, rotation = 0) => ({
  id,
  model,
  name,
  parent,
  transform: { position: [x, groundY(model), z], rotation: [0, rotation, 0] },
});
const instances = [
  {
    id: 'terrain',
    model: 'platform',
    name: 'Terrain platform',
    transform: { scale: [1.38, 1, 1.38] },
  },
  instance('habitatWest', 'habitat', 'Habitat · workshop', -2.3, 0, 'baseCamp'),
  instance('habitatEast', 'habitat', 'Habitat · storage', 0.1, 0, 'baseCamp'),
  instance('habitatComms', 'habitat', 'Habitat · communications', 2.5, 0, 'baseCamp'),
  instance('padAlpha', 'landingPad', 'Landing pad · Alpha', -2.25, 0, 'fleet'),
  instance('padBravo', 'landingPad', 'Landing pad · Bravo', 2.25, 0, 'fleet'),
  instance('alpha', 'rover', 'Rover · Alpha', -2.25, 0, 'fleet', -18),
  instance('bravo', 'rover', 'Rover · Bravo', 2.25, 0, 'fleet', 22),
  instance('solarWest', 'solar', 'Solar collector · West', -4.6, -2, 'power', -35),
  instance('solarEast', 'solar', 'Solar collector · East', 4.6, -2, 'power', 35),
  {
    ...instance('fuel', 'barrel', 'Fuel supplies', 5.3, 0.1, 'supplies'),
    pattern: { type: 'linear', count: 3, step: [0, 0, 0.88] },
  },
  {
    ...instance('cargoLine', 'cargo', 'Cargo crates', -5.3, 0.1, 'supplies'),
    pattern: { type: 'linear', count: 3, step: [0, 0, 1.05] },
  },
  instance('spares', 'cargo', 'Spare parts', -3.4, -1.6, 'supplies', 20),
];
const recipe = parse(CompositionSchema, {
  schemaVersion: 1,
  kind: 'composition',
  scene: 'main',
  groups,
  instances,
});
const scene = parse(SceneSchema, {
  schemaVersion: 1,
  kind: 'scene',
  id: 'main',
  name: 'Kestrel · Modular field station',
  nodes: [...recipe.groups, ...recipe.instances],
  environment: { background: '#171d25', ambient: 2.3, keyIntensity: 4, keyPosition: [-4, 10, 7] },
});
library.fieldStation = parse(ModelSchema, {
  schemaVersion: 1,
  kind: 'model',
  id: 'fieldStation',
  name: 'Complete field station',
  nodes: scene.nodes,
});
const built = compileScene(scene, library);
console.log(
  JSON.stringify({
    meshes: built.stats.meshes,
    triangles: built.stats.triangles,
    models: Object.keys(library),
  }),
);
built.dispose();
await mkdir(root + '/models', { recursive: true });
await mkdir(root + '/scenes', { recursive: true });
await mkdir(root + '/exports', { recursive: true });
for (const model of Object.values(library))
  await writeFile(`${root}/models/${model.id}.model.json`, JSON.stringify(model, null, 2) + '\n');
await writeFile(root + '/scenes/main.scene.json', JSON.stringify(scene, null, 2) + '\n');
await writeFile(
  root + '/forge.project.json',
  JSON.stringify(
    {
      schemaVersion: 1,
      name: 'Kestrel Composition Kit',
      activeScene: 'main',
      scenes: { main: 'scenes/main.scene.json' },
      models: Object.fromEntries(Object.keys(library).map((id) => [id, `models/${id}.model.json`])),
    },
    null,
    2,
  ) + '\n',
);
await writeFile('examples/field-station.composition.json', JSON.stringify(recipe, null, 2) + '\n');
await writeFile(
  'examples/field-station.models.json',
  JSON.stringify(
    { schemaVersion: 1, kind: 'model-bundle', entry: 'fieldStation', models: library },
    null,
    2,
  ) + '\n',
);
