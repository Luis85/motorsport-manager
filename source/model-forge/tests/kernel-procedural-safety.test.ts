import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parse,
  ForgeError,
  ModelSchema,
  SceneSchema,
  PROCEDURAL_MAX_CANDIDATES,
  applyOperations,
  areaBounds,
  createRandom,
  gridArea,
  gridLayout,
  planScatter,
  poissonDisk,
  terrainPreset,
  uniformRandom,
  type Point2,
} from '../src/kernel/index.js';

const rock = parse(ModelSchema, {
  schemaVersion: 1,
  kind: 'model',
  id: 'rock',
  name: 'Rock',
  geometries: { g: { type: 'sphere', radius: 0.5, segments: 8 } },
  materials: { m: { color: '#888888' } },
  nodes: [{ id: 'r', type: 'mesh', geometry: 'g', material: 'm' }],
});
const models = { rock };
/** A terrain mesh `ground` (with its geometry and material) and a model instance `hut`. */
const scene = () => {
  const land = terrainPreset('hills', { size: [20, 20], resolution: [11, 11], seed: 2 });
  return parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'main',
    name: 'Main',
    geometries: { ground_geo: land.geometry },
    materials: { ground_mat: land.material },
    nodes: [
      { id: 'ground', type: 'mesh', geometry: 'ground_geo', material: 'ground_mat' },
      { id: 'hut', type: 'model', model: 'rock', tags: ['scatter-like', 'scatter:00000000'] },
    ],
  });
};
const recipe = (group: string, seed = 1) => ({
  schemaVersion: 1,
  kind: 'scatter',
  seed,
  group,
  area: { type: 'rect', min: [-8, -8], max: [8, 8] },
  distribution: { type: 'poisson', minDistance: 3 },
  items: [{ model: 'rock' }],
  ground: { mode: 'terrain', node: 'ground' },
});
const fails = (code: string, check?: (error: ForgeError) => void) => (error: unknown) => {
  assert.ok(error instanceof ForgeError, String(error));
  assert.equal(error.code, code, error.message);
  check?.(error);
  return true;
};

test('replace removes only a group tagged scatter; any other node of that ID is refused', () => {
  const base = scene();
  for (const id of ['ground', 'hut'])
    assert.throws(
      () => planScatter(base, models, recipe(id), { replace: true }),
      fails('DUPLICATE_ID', (error) => {
        assert.match(error.message, /not a scatter group/);
        const details = error.details as { id: string; hint: string };
        assert.equal(details.id, id);
        assert.match(details.hint, /another group ID/);
      }),
      `${id} must survive --replace`,
    );
  // Without replace the ordinary duplicate remedy still offers replace for scatter groups.
  assert.throws(
    () => planScatter(base, models, recipe('ground')),
    fails('DUPLICATE_ID', (error) => assert.match(error.message, /already exists/)),
  );
  // A real scatter group is still replaced (removeNode first), and the terrain is untouched.
  const first = planScatter(base, models, recipe('rocks'));
  const placed = applyOperations(base, first.operations);
  const again = planScatter(placed, models, recipe('rocks', 2), { replace: true });
  assert.deepEqual(again.operations[0], { op: 'removeNode', id: 'rocks', cascade: true });
  const replaced = applyOperations(placed, again.operations);
  assert.ok(replaced.nodes.some((n) => n.id === 'ground' && n.type === 'mesh'));
  assert.ok(Object.hasOwn(replaced.geometries, 'ground_geo'));
});

test('Poisson sampling over a long thin area never allocates its dense cell grid', () => {
  const thin = {
    type: 'rect' as const,
    min: [0, 0] as Point2,
    max: [1000000, 0.00000003] as Point2,
  };
  // About 1.4e9 cells as a dense grid (5.6 GB); the sparse map only holds placed points.
  const started = performance.now();
  const points = poissonDisk(areaBounds(thin), 0.001, createRandom(1, 'thin'));
  assert.ok(points.length >= 1 && points.length <= PROCEDURAL_MAX_CANDIDATES);
  const plan = planScatter(scene(), models, {
    ...recipe('thin'),
    area: thin,
    distribution: { type: 'poisson', minDistance: 0.001 },
    ground: { mode: 'none' },
  });
  assert.ok(plan.placement.candidates <= PROCEDURAL_MAX_CANDIDATES);
  assert.ok(performance.now() - started < 20000, 'bounded work');
  assert.throws(
    () => poissonDisk({ min: [0, 0], max: [1e300, 1e-300] }, 1, createRandom(1, 'huge')),
    fails('PROCEDURAL_BUDGET'),
    'cell keys that cannot stay exact are refused',
  );
});

test('uniform random attempts never exceed the documented candidate budget', () => {
  // A thin diagonal polygon covers a tiny fraction of its bounds: 2000 x 64 attempts before.
  const sliver = {
    type: 'polygon' as const,
    points: [
      [0, 0],
      [1000, 1000],
      [1000, 1000.001],
    ] as [number, number][],
  };
  const { points, inside } = uniformRandom(sliver, 2000, createRandom(5, 'sliver'));
  assert.equal(points.length, PROCEDURAL_MAX_CANDIDATES);
  assert.ok(inside < 2000);
  const square = {
    type: 'rect' as const,
    min: [0, 0] as [number, number],
    max: [10, 10] as [number, number],
  };
  const easy = uniformRandom(square, 2000, createRandom(5, 'square'));
  assert.equal(easy.points.length, 2000, 'an area that fills its bounds is unchanged');
  assert.equal(easy.inside, 2000);
});

test('gridArea holds exactly COLUMNS x ROWS points, centered, with 1e-4 bounds', () => {
  for (const step of [0.0003, 0.001, 0.3, 0.7, 1.5, 2, 3.3333])
    for (const [columns, rows] of [
      [1, 1],
      [4, 3],
      [7, 2],
      [16, 16],
    ])
      for (const center of [
        [0, 0],
        [1, -1],
        [0.12345678, -3.00004999],
      ] as [number, number][]) {
        const area = gridArea(columns, rows, step, center);
        for (const value of [...area.min, ...area.max])
          assert.equal(Math.round(value * 1e4) / 1e4, value, `${value} is a 1e-4 multiple`);
        const points = gridLayout(areaBounds(area), step, 0, createRandom(1, 'grid'));
        assert.equal(points.length, columns * rows, `${columns}x${rows} step ${step} @ ${center}`);
        const mid = (axis: 0 | 1) => points.reduce((sum, p) => sum + p[axis], 0) / points.length;
        assert.ok(Math.abs(mid(0) - center[0]) < 2e-4 && Math.abs(mid(1) - center[1]) < 2e-4);
      }
  assert.deepEqual(gridArea(4, 3, 2, [1, -1]), {
    type: 'rect',
    min: [-2.9998, -3.9998],
    max: [4.9998, 1.9998],
  });
});
