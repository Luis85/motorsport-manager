import { mkdir, writeFile } from 'node:fs/promises';
import { parse, ModelSchema, SceneSchema, packScene, compileScene } from '../dist/index.js';

const p = (name) => ({ $param: name }),
  expr = (op, ...args) => ({ $expr: op, args });
const add = (...args) => expr('add', ...args),
  sub = (a, b) => expr('sub', a, b),
  mul = (...args) => expr('mul', ...args),
  div = (a, b) => expr('div', a, b),
  neg = (a) => expr('neg', a);
const crate = parse(ModelSchema, {
  schemaVersion: 1,
  kind: 'model',
  id: 'crate',
  name: 'Parametric cargo crate',
  parameters: {
    width: { default: 0.8, min: 0.1, max: 5 },
    height: { default: 0.5, min: 0.1, max: 5 },
    depth: { default: 0.6, min: 0.1, max: 5 },
  },
  materials: {
    body: { color: '#d9984d', roughness: 0.7 },
    band: { color: '#445662', metalness: 0.65 },
  },
  geometries: {
    body: { type: 'box', size: [p('width'), p('height'), p('depth')] },
    strap: {
      type: 'box',
      size: [mul(p('width'), 0.08), add(p('height'), 0.014), add(p('depth'), 0.014)],
    },
  },
  nodes: [
    {
      id: 'body',
      type: 'mesh',
      geometry: 'body',
      material: 'body',
      transform: { position: [0, div(p('height'), 2), 0] },
    },
    {
      id: 'straps',
      type: 'mesh',
      geometry: 'strap',
      material: 'band',
      transform: { position: [mul(p('width'), -0.3), div(p('height'), 2), 0] },
      pattern: { type: 'linear', count: 2, step: [mul(p('width'), 0.6), 0, 0] },
    },
  ],
});
const gap = div(sub(p('height'), 0.16), sub(p('levels'), 1));
const rack = parse(ModelSchema, {
  schemaVersion: 1,
  kind: 'model',
  id: 'rack',
  name: 'Procedural storage rack',
  parameters: {
    width: { default: 3.2, min: 1, max: 8, description: 'Overall rack width in meters' },
    height: { default: 2.8, min: 1.5, max: 6 },
    depth: { default: 1.1, min: 0.5, max: 3 },
    levels: { default: 4, min: 2, max: 8, description: 'Integer number of shelves' },
    lanes: { default: 3, min: 1, max: 8, description: 'Integer number of cargo columns' },
  },
  materials: {
    frame: { color: '#55798b', metalness: 0.7, roughness: 0.38 },
    shelf: { color: '#d2d4c9', metalness: 0.3 },
    cargo: { color: '#dda052', roughness: 0.65 },
  },
  geometries: {
    post: { type: 'box', size: [0.08, p('height'), 0.08] },
    shelf: { type: 'box', size: [p('width'), 0.08, p('depth')] },
    rail: { type: 'box', size: [p('width'), 0.11, 0.05] },
  },
  nodes: [
    {
      id: 'posts',
      type: 'mesh',
      geometry: 'post',
      material: 'frame',
      transform: { position: [0, div(p('height'), 2), 0] },
      pattern: {
        type: 'grid',
        counts: [2, 1, 2],
        step: [sub(p('width'), 0.08), 0, sub(p('depth'), 0.08)],
        centered: true,
      },
    },
    {
      id: 'shelves',
      type: 'mesh',
      geometry: 'shelf',
      material: 'shelf',
      transform: { position: [0, 0.12, 0] },
      pattern: { type: 'linear', count: p('levels'), step: [0, gap, 0] },
    },
    {
      id: 'frontRails',
      type: 'mesh',
      geometry: 'rail',
      material: 'frame',
      transform: { position: [0, 0.075, div(p('depth'), 2)] },
      pattern: { type: 'linear', count: p('levels'), step: [0, gap, 0] },
    },
    {
      id: 'cargo',
      type: 'model',
      model: 'crate',
      tags: ['cargo'],
      parameters: {
        width: mul(div(p('width'), p('lanes')), 0.68),
        height: mul(gap, 0.62),
        depth: mul(p('depth'), 0.72),
      },
      materialOverrides: { body: 'cargo' },
      transform: {
        position: [add(neg(div(p('width'), 2)), div(div(p('width'), p('lanes')), 2)), 0.16, 0],
      },
      pattern: {
        type: 'grid',
        counts: [p('lanes'), sub(p('levels'), 1), 1],
        step: [div(p('width'), p('lanes')), gap, 0],
      },
    },
  ],
});
const scene = parse(SceneSchema, {
  schemaVersion: 1,
  kind: 'scene',
  id: 'main',
  name: 'Procedural logistics bay',
  materials: {
    floor: { color: '#6e797d', roughness: 0.85 },
    line: { color: '#e4b463' },
    accent: { color: '#3d929c' },
  },
  geometries: {
    floor: { type: 'box', size: [13, 0.16, 7] },
    line: { type: 'box', size: [0.08, 0.012, 4.8] },
  },
  nodes: [
    {
      id: 'floor',
      type: 'mesh',
      geometry: 'floor',
      material: 'floor',
      transform: { position: [0, -0.08, 0] },
    },
    {
      id: 'laneMarks',
      type: 'mesh',
      geometry: 'line',
      material: 'line',
      transform: { position: [-5.8, 0.007, 0.3] },
      pattern: { type: 'linear', count: 7, step: [1.93, 0, 0] },
    },
    {
      id: 'rackA',
      type: 'model',
      model: 'rack',
      name: 'Compact rack',
      tags: ['storage'],
      transform: { position: [-4.2, 0, -1.1] },
      parameters: { width: 2.4, height: 2.1, levels: 3, lanes: 2 },
    },
    {
      id: 'rackB',
      type: 'model',
      model: 'rack',
      name: 'Tall rack',
      tags: ['storage'],
      transform: { position: [-0.35, 0, -1.1] },
      parameters: { width: 4.1, height: 3.3, levels: 5, lanes: 4 },
    },
    {
      id: 'rackC',
      type: 'model',
      model: 'rack',
      name: 'Standard rack',
      tags: ['storage'],
      transform: { position: [3.9, 0, -1.1] },
      parameters: { width: 2.8, height: 2.7, levels: 4, lanes: 3 },
      materialOverrides: { cargo: 'accent' },
    },
    {
      id: 'looseCargo',
      type: 'model',
      model: 'crate',
      tags: ['cargo'],
      transform: { position: [1.3, 0, 1.7], rotation: [0, 12, 0] },
      parameters: { width: 1.1, height: 0.7, depth: 0.8 },
      pattern: { type: 'grid', counts: [3, 1, 1], step: [1.35, 0, 0] },
    },
  ],
});
const models = { crate, rack },
  root = 'examples/procedural';
for (const folder of ['models', 'scenes', 'exports'])
  await mkdir(`${root}/${folder}`, { recursive: true });
for (const model of Object.values(models))
  await writeFile(`${root}/models/${model.id}.model.json`, JSON.stringify(model, null, 2) + '\n');
await writeFile(`${root}/scenes/main.scene.json`, JSON.stringify(scene, null, 2) + '\n');
await writeFile(
  `${root}/forge.project.json`,
  JSON.stringify(
    {
      schemaVersion: 1,
      name: scene.name,
      activeScene: 'main',
      scenes: { main: 'scenes/main.scene.json' },
      models: { crate: 'models/crate.model.json', rack: 'models/rack.model.json' },
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  'examples/logistics.scene-bundle.json',
  JSON.stringify(packScene(scene, models), null, 2) + '\n',
);
await writeFile(
  'examples/review.plan.json',
  JSON.stringify(
    {
      schemaVersion: 1,
      kind: 'review',
      width: 800,
      height: 600,
      frames: ['iso', 'front', 'right', 'back', 'left', 'top'].map((view) => ({
        id: view,
        camera: { view },
      })),
    },
    null,
    2,
  ) + '\n',
);
const compiled = compileScene(scene, models);
console.log(JSON.stringify(compiled.stats));
compiled.dispose();
