import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Mesh, Raycaster, Vector3 } from 'three';
import {
  parse,
  canonical,
  ForgeError,
  ModelSchema,
  SceneSchema,
  ScatterRecipeSchema,
  applyOperations,
  compileScene,
  createRandom,
  planScatter,
  poissonDisk,
  gridLayout,
  pathLayout,
  uniformRandom,
  insideArea,
  terrainPreset,
  sampleTerrainNode,
  type Operation,
  type SceneDocument,
} from '../src/kernel/index.js';

const rock = parse(ModelSchema, {
  schemaVersion: 1,
  kind: 'model',
  id: 'rock',
  name: 'Rock',
  parameters: {
    size: { default: 1, min: 0.5, max: 2 },
    facets: { default: 6, min: 4, max: 12, integer: true },
  },
  geometries: { g: { type: 'sphere', radius: { $param: 'size' }, segments: 8 } },
  materials: { m: { color: '#888888' } },
  nodes: [{ id: 'r', type: 'mesh', geometry: 'g', material: 'm' }],
});
const models = { rock };
const scene = (nodes: unknown[] = [], terrain?: Record<string, unknown>) => {
  const land = terrainPreset('hills', { size: [40, 40], resolution: [41, 41], seed: 4 });
  return parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'main',
    name: 'Main',
    geometries: { land: land.geometry, box: { type: 'box', size: [1, 1, 1] } },
    materials: { land: land.material, paint: { color: '#aa5533' } },
    nodes: [
      { id: 'terrain', type: 'mesh', geometry: 'land', material: 'land', ...terrain },
      ...nodes,
    ],
  });
};
const recipe = (extra: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  kind: 'scatter',
  seed: 3,
  group: 'rocks',
  area: { type: 'rect', min: [-15, -15], max: [15, 15] },
  distribution: { type: 'poisson', minDistance: 2.5 },
  items: [{ model: 'rock', vary: { size: [0.6, 1.4] } }],
  scale: [0.8, 1.2],
  ...extra,
});
const fails = (code: string) => (error: unknown) =>
  error instanceof ForgeError && error.code === code;
/** The recipe hash is sha256 of the canonical normalized recipe. */
const createHashOf = (value: unknown) =>
  createHash('sha256').update(canonical(value)).digest('hex');
const putNodes = (operations: Operation[]) =>
  operations.flatMap((op) => (op.op === 'putNode' ? [op.node] : []));

test('placement distributions are deterministic and keep their spacing rules', () => {
  const bounds = { min: [-10, -6] as [number, number], max: [10, 6] as [number, number] };
  const points = poissonDisk(bounds, 1.5, createRandom(1, 'p'));
  assert.deepEqual(poissonDisk(bounds, 1.5, createRandom(1, 'p')), points);
  assert.notDeepEqual(poissonDisk(bounds, 1.5, createRandom(2, 'p')), points);
  assert.ok(points.length > 40, `${points.length} points fill the area`);
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    assert.ok(x >= -10 && x <= 10 && z >= -6 && z <= 6);
    assert.equal(Math.round(x * 1e4) / 1e4, x, 'rounded to 1e-4');
    for (let j = i + 1; j < points.length; j++)
      assert.ok(Math.hypot(points[j][0] - x, points[j][1] - z) >= 1.5, `${i}-${j}`);
  }
  const grid = gridLayout(bounds, 2, 0, createRandom(1, 'g'));
  assert.equal(grid.length, 11 * 7);
  assert.deepEqual(grid[0], [-10, -6]);
  const jittered = gridLayout(bounds, 2, 1, createRandom(1, 'g'));
  assert.ok(jittered.every((p, i) => Math.abs(p[0] - grid[i][0]) <= 1 && p !== grid[i]));
  const path = pathLayout(
    [
      [0, 0],
      [0, 10],
      [10, 10],
    ],
    2.5,
  );
  assert.equal(path.length, 9);
  assert.deepEqual(path[4], { point: [0, 10], heading: 0 });
  assert.deepEqual(path[5], { point: [2.5, 10], heading: 90 });
  const circle = { type: 'circle' as const, center: [0, 0] as [number, number], radius: 3 };
  const random = uniformRandom(circle, 50, createRandom(1, 'r'));
  assert.equal(random.inside, 50);
  assert.equal(random.points.filter((p) => insideArea(circle, p)).length, 50);
  const polygon = {
    type: 'polygon' as const,
    points: [
      [0, 0],
      [4, 0],
      [4, 4],
      [2, 1],
      [0, 4],
    ] as [number, number][],
  };
  assert.equal(insideArea(polygon, [1, 0.5]), true);
  assert.equal(insideArea(polygon, [2, 3]), false, 'concave notch');
  const road = { type: 'path' as const, points: polygon.points.slice(0, 2), width: 2 };
  assert.deepEqual(
    [insideArea(road, [2, 0.9]), insideArea(road, [2, 1.1]), insideArea(road, [5.1, 0])],
    [true, false, false],
  );
  assert.throws(() => poissonDisk(bounds, 0.01, createRandom(1, 'p')), fails('PROCEDURAL_BUDGET'));
  assert.throws(
    () => gridLayout(bounds, 0.05, 0, createRandom(1, 'g')),
    fails('PROCEDURAL_BUDGET'),
  );
});

test('planScatter is deterministic, seed-dependent and grounded on the terrain', () => {
  const base = scene();
  const first = planScatter(base, models, recipe({ ground: { mode: 'terrain', node: 'terrain' } }));
  const again = planScatter(base, models, recipe({ ground: { mode: 'terrain', node: 'terrain' } }));
  assert.equal(canonical(first), canonical(again));
  const other = planScatter(
    base,
    models,
    recipe({ seed: 4, ground: { mode: 'terrain', node: 'terrain' } }),
  );
  assert.notEqual(canonical(other.operations), canonical(first.operations));
  assert.notEqual(other.placement.recipeHash, first.placement.recipeHash);
  const { placement, operations } = first;
  assert.equal(placement.recipeHash, createHashOf(first.recipe));
  assert.equal(placement.placed, operations.length - 1);
  assert.equal(
    placement.candidates,
    placement.placed + Object.values(placement.rejected).reduce((a, b) => a + b, 0),
  );
  const [group, ...instances] = putNodes(operations);
  assert.deepEqual(group, {
    id: 'rocks',
    type: 'group',
    visible: true,
    tags: ['scatter', `scatter:${placement.recipeHash.slice(0, 8)}`],
  });
  const sample = sampleTerrainNode(
    base,
    'terrain',
    instances.map(
      (n) => [n.transform!.position![0], n.transform!.position![2]] as [number, number],
    ),
  );
  for (const [i, node] of instances.entries()) {
    assert.equal(node.id, `rocks-${i + 1}`);
    assert.equal(node.parent, 'rocks');
    assert.ok(node.type === 'model' && node.model === 'rock');
    const size = node.parameters.size as number;
    assert.ok(size >= 0.6 && size <= 1.4);
    const [sx, sy, sz] = node.transform!.scale as number[];
    assert.ok(sx === sy && sy === sz && sx >= 0.8 && sx <= 1.2);
    assert.ok(Math.abs((node.transform!.position![1] as number) - sample[i].y) < 2e-4);
  }
  const next = applyOperations(base, operations, models);
  const built = compileScene(next, models);
  built.dispose();
});

test('grounding follows translated, turned and scaled terrain and refuses tilt', () => {
  const moved = scene(
    [{ id: 'yard', type: 'group', transform: { position: [2, 1, -3], rotation: [0, -20, 0] } }],
    {
      transform: { position: [3, -2, 1], rotation: [0, 35, 0], scale: [1.5, 1.5, 1.5] },
    },
  );
  const plan = planScatter(
    moved,
    models,
    recipe({
      parent: 'yard',
      items: [{ model: 'rock' }],
      ground: { mode: 'terrain', node: 'terrain', sink: 0.25 },
    }),
  );
  const built = compileScene(applyOperations(moved, plan.operations, models), models);
  try {
    const terrain = built.content.getObjectByName('main/terrain') as Mesh;
    const ray = new Raycaster();
    for (const node of putNodes(plan.operations).slice(1, 25)) {
      const object = built.content.getObjectByName(`main/${node.id}`)!;
      const origin = object.getWorldPosition(new Vector3());
      ray.set(new Vector3(origin.x, 500, origin.z), new Vector3(0, -1, 0));
      const [hit] = ray.intersectObject(terrain);
      assert.ok(hit, `${node.id} lies over the terrain`);
      assert.ok(Math.abs(hit.point.y - 0.25 - origin.y) < 1e-3, `${node.id} grounded with sink`);
    }
  } finally {
    built.dispose();
  }
  for (const transform of [{ rotation: [5, 0, 0] }, { scale: [1, 2, 1] }]) {
    assert.throws(
      () =>
        planScatter(
          scene([], { transform }),
          models,
          recipe({ ground: { mode: 'terrain', node: 'terrain' } }),
        ),
      fails('TERRAIN_TRANSFORM'),
    );
  }
  assert.throws(
    () =>
      planScatter(
        scene([{ id: 'b', type: 'mesh', geometry: 'box', material: 'paint' }]),
        models,
        recipe({ ground: { mode: 'terrain', node: 'b' } }),
      ),
    fails('INVALID_NODE_TYPE'),
  );
  const steep = planScatter(
    scene(),
    models,
    recipe({ ground: { mode: 'terrain', node: 'terrain', maxSlope: 8 } }),
  );
  assert.ok(steep.placement.rejected.slope > 0, 'maxSlope rejects steep candidates');
  const wide = planScatter(
    scene(),
    models,
    recipe({
      area: { type: 'rect', min: [-30, -30], max: [30, 30] },
      ground: { mode: 'terrain', node: 'terrain' },
    }),
  );
  assert.ok(wide.placement.rejected.outside > 0, 'candidates beyond the terrain are outside');
});

test('caps, exclusions, avoidance and empty results are enforced and reported', () => {
  const capped = planScatter(scene(), models, recipe({ maxCount: 10 }));
  assert.equal(capped.placement.placed, 10);
  assert.ok(capped.placement.rejected.budget > 0);
  assert.throws(
    () => parse(ScatterRecipeSchema, recipe({ maxCount: 2001 })),
    fails('SCHEMA_INVALID'),
  );
  assert.throws(
    () =>
      planScatter(
        scene(),
        models,
        recipe({ distribution: { type: 'poisson', minDistance: 0.05 } }),
      ),
    fails('PROCEDURAL_BUDGET'),
  );
  const many = planScatter(
    scene(),
    models,
    recipe({
      area: { type: 'rect', min: [-500, -500], max: [500, 500] },
      distribution: { type: 'grid', step: 10 },
    }),
  );
  assert.equal(many.placement.placed, 2000, 'hard cap of 2000 placements');
  assert.equal(many.placement.rejected.budget, 101 * 101 - 2000);
  const excluded = planScatter(
    scene(),
    models,
    recipe({ exclude: [{ type: 'circle', center: [0, 0], radius: 6 }] }),
  );
  assert.ok(excluded.placement.rejected.exclusion > 0);
  for (const node of putNodes(excluded.operations).slice(1)) {
    const [x, , z] = node.transform!.position as number[];
    assert.ok(Math.hypot(x, z) > 6);
  }
  const shed = scene([
    {
      id: 'shed',
      type: 'mesh',
      geometry: 'box',
      material: 'paint',
      transform: { scale: [6, 2, 4] },
    },
  ]);
  const avoided = planScatter(shed, models, recipe({ avoidNodes: { ids: ['shed'], margin: 1 } }));
  for (const node of putNodes(avoided.operations).slice(1)) {
    const [x, , z] = node.transform!.position as number[];
    assert.ok(Math.abs(x) > 4 || Math.abs(z) > 3, `${node.id} clears the shed footprint`);
  }
  const nowhere = recipe({ exclude: [{ type: 'rect', min: [-20, -20], max: [20, 20] }] });
  assert.throws(() => planScatter(scene(), models, nowhere), fails('SCATTER_EMPTY'));
  const empty = planScatter(scene(), models, nowhere, { allowEmpty: true });
  assert.equal(empty.placement.placed, 0);
  assert.equal(empty.operations.length, 1);
});

test('existing groups need replace, which removes the old subtree first', () => {
  const first = planScatter(scene(), models, recipe());
  const placed = applyOperations(scene(), first.operations, models);
  assert.throws(() => planScatter(placed, models, recipe()), fails('DUPLICATE_ID'));
  const again = planScatter(placed, models, recipe({ seed: 8 }), { replace: true });
  assert.deepEqual(again.operations[0], { op: 'removeNode', id: 'rocks', cascade: true });
  const replaced = applyOperations(placed, again.operations, models);
  assert.equal(replaced.nodes.length, 1 + 1 + again.placement.placed);
  assert.throws(
    () => planScatter(scene([{ id: 'rocks-1', type: 'group' }]), models, recipe()),
    fails('DUPLICATE_ID'),
  );
  assert.throws(
    () => planScatter(scene(), models, recipe({ parent: 'missing' })),
    fails('REFERENCE_MISSING'),
  );
  assert.throws(() => planScatter(scene(), {}, recipe()), fails('REFERENCE_MISSING'));
});

test('items pick by weight, vary parameters in range and copy template nodes', () => {
  const crate = {
    id: 'crate',
    type: 'mesh',
    geometry: 'box',
    material: 'paint',
    visible: false,
    tags: ['prop'],
    transform: { scale: [2, 1, 2] },
  };
  const pebble = { id: 'pebble', type: 'model', model: 'rock', parameters: { size: 0.7 } };
  const host = scene([crate, pebble]);
  const plan = planScatter(
    host,
    models,
    recipe({
      items: [
        { node: 'crate', weight: 1 },
        { node: 'pebble', weight: 1, vary: { facets: [4, 9] } },
        { model: 'rock', weight: 2 },
      ],
    }),
  );
  const instances = putNodes(plan.operations).slice(1);
  const kinds = { crate: 0, pebble: 0, rock: 0 };
  for (const node of instances) {
    if (node.type === 'mesh') {
      kinds.crate++;
      assert.equal(node.visible, true);
      assert.deepEqual(node.tags, ['prop', `scatter:${plan.placement.recipeHash.slice(0, 8)}`]);
      const scale = node.transform!.scale as number[];
      // Template scale [2, 1, 2] times the drawn uniform scale, each rounded to 1e-4.
      assert.ok(Math.abs(scale[0] - 2 * scale[1]) <= 2e-4 && scale[2] === scale[0]);
    } else if (node.type === 'model' && node.parameters.facets !== undefined) {
      kinds.pebble++;
      assert.equal(node.parameters.size, 0.7);
      assert.ok(Number.isInteger(node.parameters.facets));
      assert.ok((node.parameters.facets as number) >= 4 && (node.parameters.facets as number) <= 9);
    } else kinds.rock++;
  }
  assert.ok(kinds.crate > 0 && kinds.pebble > 0 && kinds.rock > kinds.crate, JSON.stringify(kinds));
  compileScene(applyOperations(host, plan.operations, models), models).dispose();
  assert.throws(
    () =>
      planScatter(host, models, recipe({ items: [{ model: 'rock', vary: { size: [0.1, 1] } }] })),
    fails('PARAMETER_RANGE'),
  );
  assert.throws(
    () =>
      planScatter(host, models, recipe({ items: [{ model: 'rock', vary: { width: [1, 2] } }] })),
    fails('UNKNOWN_PARAMETER'),
  );
  assert.throws(
    () => planScatter(host, models, recipe({ items: [{ node: 'crate', vary: { size: [1, 2] } }] })),
    fails('UNKNOWN_PARAMETER'),
  );
  assert.throws(
    () => planScatter(host, models, recipe({ items: [{ node: 'terrain', model: 'rock' }] })),
    fails('SCHEMA_INVALID'),
  );
  const withChild = scene([
    { id: 'kit', type: 'group' },
    { id: 'kitPart', type: 'mesh', geometry: 'box', material: 'paint', parent: 'kit' },
  ]);
  assert.throws(
    () => planScatter(withChild, models, recipe({ items: [{ node: 'kit' }] })),
    fails('INVALID_NODE_TYPE'),
  );
});

test('path distributions orient along the path and filtering never reshuffles others', () => {
  const road = planScatter(scene(), models, {
    ...recipe({ items: [{ model: 'rock' }], scale: [1, 1] }),
    area: undefined,
    distribution: {
      type: 'path',
      points: [
        [-10, 0],
        [10, 0],
      ],
      spacing: 5,
    },
  });
  const posts = putNodes(road.operations).slice(1);
  assert.equal(posts.length, 5);
  for (const post of posts) assert.deepEqual(post.transform!.rotation, [0, 90, 0]);
  const open = planScatter(scene(), models, recipe());
  const fenced = planScatter(
    scene(),
    models,
    recipe({ exclude: [{ type: 'rect', min: [-15, -15], max: [0, 15] }] }),
  );
  const key = (node: { transform?: { position?: unknown } }) => canonical(node.transform?.position);
  const draws = new Map(
    putNodes(open.operations)
      .slice(1)
      .map((n) => [key(n), canonical({ ...n, id: '' })]),
  );
  for (const node of putNodes(fenced.operations).slice(1)) {
    const before = draws.get(key(node));
    assert.ok(before, 'same candidate points');
    assert.equal(
      canonical({ ...node, id: '' }).replace(/scatter:[0-9a-f]{8}/, ''),
      before!.replace(/scatter:[0-9a-f]{8}/, ''),
    );
  }
});

test('in-model scatter plans against a staged model document', () => {
  const staged: SceneDocument = parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'garden',
    name: 'Garden',
    parameters: { spread: 3 },
    geometries: { leaf: { type: 'box', size: [0.2, 0.05, 0.3] } },
    materials: { green: { color: '#3a7a2a' } },
    nodes: [{ id: 'leaf', type: 'mesh', geometry: 'leaf', material: 'green', visible: false }],
  });
  const plan = planScatter(
    staged,
    {},
    recipe({
      items: [{ node: 'leaf' }],
      area: { type: 'circle', center: [0, 0], radius: 3 },
      distribution: { type: 'random', count: 40 },
      ground: { mode: 'plane', y: 0.5 },
    }),
  );
  assert.equal(plan.placement.placed, 40);
  assert.ok(
    putNodes(plan.operations)
      .slice(1)
      .every((n) => n.transform!.position![1] === 0.5),
  );
});
