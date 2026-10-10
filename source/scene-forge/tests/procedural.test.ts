import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { terrainPresetNames } from '../src/kernel.js';
import {
  failure,
  forest,
  ok,
  project,
  sceneBytes,
  source,
  withRoot,
} from './procedural-helpers.js';

test('scatter is deterministic: same seed gives identical bytes and stateHash, another seed differs', () =>
  withRoot(async (root) => {
    const [a, b, c] = await Promise.all(['a', 'b', 'c'].map((n) => project(root, n)));
    const args = [...forest, '--scale', '0.8..1.2', '--group', 'forest'];
    const ra = await ok(a, [...args, '--seed', '42']);
    const rb = await ok(b, [...args, '--seed', '42']);
    const rc = await ok(c, [...args, '--seed', '43']);
    assert.equal(await sceneBytes(a), await sceneBytes(b));
    assert.equal(ra.stateHash, rb.stateHash);
    assert.deepEqual(ra.placement, rb.placement);
    assert.notEqual(await sceneBytes(a), await sceneBytes(c));
    assert.notEqual(ra.stateHash, rc.stateHash);
    assert.notEqual(ra.placement.recipeHash, rc.placement.recipeHash);
    assert.ok(ra.placement.placed > 20, 'a 32 m terrain holds many 2.5 m placements');
    assert.equal(ra.placement.seed, 42);
    assert.equal(ra.changes.nodes.added.length, ra.placement.placed + 1);
    assert.equal(ra.recipe.kind, 'scatter');
    assert.deepEqual(ra.recipe.area, { type: 'rect', min: [-16, -16], max: [16, 16] });
    const tag = `scatter:${ra.placement.recipeHash.slice(0, 8)}`;
    const listed = await ok(a, ['node', 'list', '--tag', tag, '--limit', '1000']);
    assert.equal(listed.total, ra.placement.placed + 1);
    // The echoed recipe replays the same plan through --data, with the same hash.
    const replay = await ok(a, [
      'scatter',
      '--data',
      JSON.stringify(ra.recipe),
      '--group',
      'replayed',
      '--dry-run',
    ]);
    assert.equal(replay.placement.placed, ra.placement.placed);
    assert.equal(replay.recipe.seed, 42);
  }));

test('--replace regenerates idempotently; an existing group fails with DUPLICATE_ID and a remedy', () =>
  withRoot(async (root) => {
    const dir = await project(root, 'p');
    const first = await ok(dir, [...forest, '--group', 'forest']);
    const before = await sceneBytes(dir);
    const duplicate = await failure(dir, [...forest, '--group', 'forest'], 'DUPLICATE_ID');
    assert.match(duplicate.hint, /--replace/);
    const again = await ok(dir, [...forest, '--group', 'forest', '--replace']);
    assert.equal(again.changed, false);
    assert.equal(again.revision, first.revision);
    assert.equal(await sceneBytes(dir), before);
    const reseeded = await ok(dir, [...forest, '--group', 'forest', '--replace', '--seed', '9']);
    assert.equal(reseeded.revision, first.revision + 1);
    assert.equal(
      reseeded.changes.nodes.added.length + reseeded.changes.nodes.updated.length > 0,
      true,
    );
  }));

test('guards are checked before planning and dry-runs leave the project untouched', () =>
  withRoot(async (root) => {
    const dir = await project(root, 'p');
    const state = await ok(dir, ['inspect']);
    const before = await sceneBytes(dir);
    const dry = await ok(dir, [...forest, '--group', 'forest', '--dry-run']);
    assert.equal(dry.dryRun, true);
    assert.equal(dry.revision, state.revision);
    assert.equal(dry.stateHash, state.stateHash);
    assert.equal(dry.proposedRevision, state.revision + 1);
    assert.equal(await sceneBytes(dir), before);
    await assert.rejects(fs.access(path.join(dir, `history/main/${state.revision}.json`)));
    // The dry run hands back the exact guarded write as its next command.
    const next: string[] = dry.nextCommands[0];
    assert.deepEqual(next.slice(-4), [
      '--expected-revision',
      String(state.revision),
      '--expected-state',
      state.stateHash,
    ]);
    const written = await ok(dir, next.slice(next.indexOf('scatter')));
    assert.equal(written.stateHash, dry.proposedStateHash);
    assert.equal(written.revision, dry.proposedRevision);
    await failure(
      dir,
      [...forest, '--group', 'other', '--expected-revision', '0'],
      'REVISION_CONFLICT',
    );
    await failure(
      dir,
      [...forest, '--group', 'other', '--expected-state', 'f'.repeat(64)],
      'STATE_CONFLICT',
    );
    // A stale guard wins over a duplicate group: the agent must re-read first.
    await failure(
      dir,
      [...forest, '--group', 'forest', '--expected-revision', String(state.revision)],
      'REVISION_CONFLICT',
    );
  }));

test('terrain grounding puts every instance origin on the sampled surface', () =>
  withRoot(async (root) => {
    const dir = await project(root, 'p');
    await ok(dir, ['node', 'transform', 'ground', '--at', '3,1.5,-2', '--rotate', '0,30,0']);
    const scattered = await ok(dir, [...forest, '--group', 'forest', '--sink', '0.05']);
    const scene = await source(dir);
    const instances = (
      scene.nodes as { id: string; parent?: string; transform: { position: number[] } }[]
    ).filter((n) => n.parent === 'forest');
    assert.equal(instances.length, scattered.placement.placed);
    const at = instances
      .map((n) => `${n.transform.position[0]},${n.transform.position[2]}`)
      .join(';');
    const { samples } = await ok(dir, ['terrain', 'sample', 'ground', '--at', at]);
    for (const [i, node] of instances.entries()) {
      assert.equal(samples[i].inside, true);
      assert.ok(
        Math.abs(node.transform.position[1] - (samples[i].y - 0.05)) < 2e-4,
        `${node.id} at ${node.transform.position} vs surface ${samples[i].y}`,
      );
    }
    // A turned terrain's default area is its rotated footprint polygon.
    assert.equal(scattered.recipe.area.type, 'polygon');
    await ok(dir, ['node', 'transform', 'ground', '--rotate', '10,30,0']);
    const tilted = await failure(dir, [...forest, '--group', 'tilted'], 'TERRAIN_TRANSFORM');
    assert.match(tilted.hint, /translation, yaw/);
  }));

test('layout places along a path facing its direction and on an exact grid', () =>
  withRoot(async (root) => {
    const dir = await project(root, 'p');
    const fence = await ok(dir, [
      'layout',
      '--model',
      'post',
      '--path',
      '-10,-10;10,-10;10,10',
      '--spacing',
      '2',
      '--group',
      'fence',
    ]);
    assert.equal(fence.placement.placed, 21);
    const grid = await ok(dir, [
      'layout',
      '--model',
      'stone',
      '--grid',
      '4x3',
      '--step',
      '2',
      '--center',
      '1,-1',
      '--on',
      'ground',
    ]);
    assert.equal(grid.placement.group, 'stone-layout');
    assert.equal(grid.placement.placed, 12);
    const scene = await source(dir);
    const nodes = scene.nodes as {
      id: string;
      parent?: string;
      transform: { position: number[]; rotation?: number[] };
    }[];
    const posts = nodes.filter((n) => n.parent === 'fence');
    assert.deepEqual(posts[0].transform.position, [-10, 0, -10]);
    assert.deepEqual(posts[0].transform.rotation, [0, 90, 0], 'east along +X');
    assert.deepEqual(posts.at(-1)!.transform.position, [10, 0, 10]);
    assert.deepEqual(posts.at(-1)!.transform.rotation, undefined, 'north along +Z is yaw 0');
    const cells = nodes
      .filter((n) => n.parent === 'stone-layout')
      .map((n) => [n.transform.position[0], n.transform.position[2]]);
    const expected = [-3, -1, 1].flatMap((z) => [-2, 0, 2, 4].map((x) => [x, z]));
    assert.deepEqual(cells, expected);
    assert.ok(nodes.filter((n) => n.parent === 'stone-layout').every((n) => !n.transform.rotation));
    await failure(
      dir,
      ['layout', '--model', 'stone', '--grid', '2x2', '--step', '1,2'],
      'INVALID_OPTION',
    );
    await failure(dir, ['layout', '--model', 'stone', '--path', '0,0;1,0'], 'INPUT_REQUIRED');
  }));

test('scatter flags validate, recipe files exclude flags, and empty results explain themselves', () =>
  withRoot(async (root) => {
    const dir = await project(root, 'p');
    await failure(dir, [...forest, '--area', 'square:1'], 'INVALID_OPTION');
    await failure(dir, [...forest, '--scale', '2..1'], 'INVALID_OPTION');
    await failure(dir, ['scatter', '--model', 'post', '--spacing', '2'], 'INPUT_REQUIRED');
    await failure(
      dir,
      ['scatter', '--model', 'ghost', '--area', 'circle:0,0,5', '--spacing', '2'],
      'REFERENCE_MISSING',
    );
    const recipe = path.join(root, 'r.scatter.json');
    await fs.writeFile(
      recipe,
      JSON.stringify({
        schemaVersion: 1,
        kind: 'scatter',
        group: 'g',
        area: { type: 'circle', center: [0, 0], radius: 4 },
        distribution: { type: 'random', count: 5 },
        items: [{ model: 'stone' }],
      }),
    );
    const conflict = await failure(
      dir,
      ['scatter', '--file', recipe, '--spacing', '1'],
      'INVALID_OPTION',
    );
    assert.deepEqual(conflict.details.flags, ['spacing']);
    const fromFile = await ok(dir, ['scatter', '--file', recipe, '--seed', '8']);
    assert.equal(fromFile.placement.placed, 5);
    assert.equal(fromFile.recipe.seed, 8);
    const outside = [...forest, '--area', 'rect:40,40,50,50', '--group', 'far'];
    const empty = await failure(dir, outside, 'SCATTER_EMPTY');
    assert.match(empty.hint, /--allow-empty/);
    assert.ok(empty.details.rejected.outside > 0);
    const allowed = await ok(dir, [...outside, '--allow-empty']);
    assert.equal(allowed.placement.placed, 0);
    const budget = await failure(
      dir,
      ['scatter', '--model', 'stone', '--area', 'rect:0,0,1000,1000', '--spacing', '0.5'],
      'PROCEDURAL_BUDGET',
    );
    assert.match(budget.hint, /--spacing/);
  }));

test('terrain add builds every preset, exports valid GLB and samples read-only', () =>
  withRoot(async (root) => {
    const dir = path.join(root, 'terrain');
    await ok(root, ['init', dir]);
    for (const [i, preset] of terrainPresetNames.entries()) {
      const added = await ok(dir, [
        'terrain',
        'add',
        preset,
        '--preset',
        preset,
        '--resolution',
        '17',
        '--size',
        '20',
        `--at=${i * 24},0,0`,
      ]);
      assert.equal(added.terrain.geometry.type, 'heightfield');
      assert.deepEqual(added.terrain.geometry.resolution, [17, 17]);
      assert.ok(added.terrain.geometry.bands.length >= 2);
      assert.equal(added.stats.triangles, 16 * 16 * 2 * (i + 1));
    }
    const solid = await ok(dir, [
      'terrain',
      'add',
      'flat',
      '--preset',
      'plains',
      '--color',
      '#557744',
      '--resolution',
      '9',
    ]);
    assert.equal(solid.terrain.bands, false);
    assert.equal(solid.terrain.geometry.bands, undefined);
    const scene = await source(dir);
    assert.equal(scene.materials.hills_mat.vertexColors, true);
    assert.equal(scene.materials.flat_mat.vertexColors, undefined);
    assert.deepEqual(scene.nodes.find((n: { id: string }) => n.id === 'flat').tags, ['terrain']);
    const out = path.join(root, 'terrain.glb');
    const exported = await ok(dir, ['export', '--validate', '--out', out]);
    assert.equal(exported.validation.numErrors, 0);
    const duplicate = await failure(
      dir,
      ['terrain', 'add', 'hills', '--resolution', '9'],
      'DUPLICATE_ID',
    );
    assert.match(duplicate.hint, /--replace/);
    const replaced = await ok(dir, [
      'terrain',
      'add',
      'hills',
      '--resolution',
      '9',
      '--replace',
      '--at=24,0,0',
    ]);
    assert.deepEqual(replaced.staleScatterGroups, []);
    await failure(dir, ['terrain', 'add', 'x', '--preset', 'moon'], 'CLI_USAGE');
    await failure(dir, ['terrain', 'add', 'x', '--material', 'nope'], 'REFERENCE_MISSING');
    const before = await sceneBytes(dir);
    const sampled = await ok(dir, ['terrain', 'sample', 'plains', '--at', '0,0;100,100']);
    assert.equal(sampled.samples[0].inside, true);
    assert.equal(sampled.samples[1].inside, false);
    assert.equal(await sceneBytes(dir), before);
    await failure(dir, ['terrain', 'sample', 'missing', '--at', '0,0'], 'REFERENCE_MISSING');
  }));

test('catalog and schema describe procedural generation additively', () =>
  withRoot(async (root) => {
    const catalog = await ok(root, ['catalog']);
    for (const key of [
      'workflow',
      'schemas',
      'geometryTypes',
      'composition',
      'modelAuthoring',
      'littlewild',
      'review',
      'limits',
      'unsupported',
    ])
      assert.ok(key in catalog, `catalog keeps ${key}`);
    assert.ok(catalog.schemas.includes('scatter'));
    assert.ok(catalog.geometryTypes.includes('heightfield'));
    const procedural = catalog.procedural;
    assert.deepEqual(procedural.commands, ['scatter', 'layout', 'terrain add', 'terrain sample']);
    assert.deepEqual(Object.keys(procedural.terrain.presets), [...terrainPresetNames]);
    assert.equal(procedural.limits.placements, 2000);
    assert.ok(procedural.examples.every((e: string) => e.startsWith('forge3d -p <project> ')));
    const schema = await ok(root, ['schema', '--kind', 'scatter']);
    assert.ok(schema.properties.distribution);
    const described = await ok(root, ['describe', 'scatter']);
    assert.ok(described.options.some((o: { flags: string }) => o.flags.startsWith('--on')));
  }));
