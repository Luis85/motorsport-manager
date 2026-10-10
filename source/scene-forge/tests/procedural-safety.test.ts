import test from 'node:test';
import assert from 'node:assert/strict';
import {
  failure,
  forest,
  ok,
  project,
  sceneBytes,
  source,
  withRoot,
} from './procedural-helpers.js';

test('--replace never destroys a node that is not a scatter group', () =>
  withRoot(async (root) => {
    const dir = await project(root, 'p');
    const before = await sceneBytes(dir);
    for (const args of [
      [...forest, '--group', 'ground', '--replace'],
      [
        'layout',
        '--model',
        'post',
        '--grid',
        '2x2',
        '--step',
        '2',
        '--group',
        'ground',
        '--replace',
      ],
      [...forest, '--group', 'ground', '--replace', '--dry-run'],
    ]) {
      const error = await failure(dir, args, 'DUPLICATE_ID');
      assert.match(error.message, /not a scatter group/);
      assert.match(error.hint, /Choose another --group/);
      assert.doesNotMatch(error.hint, /Pass --replace/);
    }
    assert.equal(await sceneBytes(dir), before, 'the terrain and its geometry stay');
    const scene = await source(dir);
    assert.ok(
      scene.nodes.some((n: { id: string; type: string }) => n.id === 'ground' && n.type === 'mesh'),
    );
    assert.ok(Object.hasOwn(scene.geometries, 'ground_geo'));
    // Without --replace the remedy still offers --replace for a real scatter group.
    await ok(dir, [...forest, '--group', 'forest']);
    const taken = await failure(dir, [...forest, '--group', 'forest'], 'DUPLICATE_ID');
    assert.match(taken.hint, /--replace/);
    const regenerated = await ok(dir, [...forest, '--group', 'forest', '--replace', '--seed', '3']);
    assert.ok(regenerated.changes.nodes.updated.includes('forest'));
  }));

test('scatter and layout take --tilt like --yaw; a recipe file excludes it', () =>
  withRoot(async (root) => {
    const dir = await project(root, 'p');
    const tilted = await ok(dir, [...forest, '--tilt', '4..9', '--group', 'leaning', '--dry-run']);
    assert.deepEqual(tilted.recipe.rotation.tilt, [4, 9]);
    const upright = await ok(dir, [...forest, '--group', 'leaning', '--dry-run']);
    assert.notEqual(tilted.proposedStateHash, upright.proposedStateHash);
    const fixed = await ok(dir, [
      'layout',
      '--model',
      'post',
      '--path',
      '0,0;4,0',
      '--spacing',
      '2',
      '--tilt',
      '3',
      '--dry-run',
    ]);
    assert.deepEqual(fixed.recipe.rotation, { yaw: [0, 0], tilt: [3, 3] });
    const conflict = await failure(
      dir,
      ['scatter', '--data', JSON.stringify(tilted.recipe), '--tilt', '1..2'],
      'INVALID_OPTION',
    );
    assert.deepEqual(conflict.details.flags, ['tilt']);
    assert.match(conflict.hint, /only --seed and --group/);
    await failure(dir, [...forest, '--tilt', '9..4'], 'INVALID_OPTION');
  }));

test('INPUT_REQUIRED errors carry their remedy as the top-level hint', () =>
  withRoot(async (root) => {
    const dir = await project(root, 'p');
    for (const [args, pattern] of [
      [['scatter', '--spacing', '2', '--area', 'circle:0,0,5'], /model list/],
      [['scatter', '--model', 'post', '--area', 'circle:0,0,5'], /--spacing/],
      [['scatter', '--model', 'post', '--spacing', '2'], /--area may be omitted/],
      [['layout', '--model', 'post'], /--step/],
      [['layout', '--model', 'post', '--path', '0,0;1,0'], /--spacing/],
      [['layout', '--model', 'post', '--grid', '2x2'], /--step s/],
    ] as [string[], RegExp][]) {
      const error = await failure(dir, args, 'INPUT_REQUIRED');
      assert.equal(typeof error.hint, 'string', args.join(' '));
      assert.match(error.hint, pattern);
      assert.equal(error.details?.hint, undefined);
    }
    const step = await failure(
      dir,
      ['layout', '--model', 'post', '--grid', '2x2', '--step', '1,2'],
      'INVALID_OPTION',
    );
    assert.match(step.hint, /--path/);
  }));

test('layout grid areas are exact 1e-4 values and hold exactly COLUMNS x ROWS', () =>
  withRoot(async (root) => {
    const dir = await project(root, 'p');
    const grid = ['layout', '--model', 'stone', '--grid'];
    const exact = await ok(dir, [...grid, '4x3', '--step', '2', '--center', '1,-1', '--dry-run']);
    assert.deepEqual(exact.recipe.area, {
      type: 'rect',
      min: [-2.9998, -3.9998],
      max: [4.9998, 1.9998],
    });
    for (const [counts, step, center] of [
      ['7x5', '0.3', '0.1,0.2'],
      ['3x9', '0.7', '-10,5.55'],
      ['16x2', '1.1', '0.0001,-0.0003'],
    ]) {
      const planned = await ok(dir, [
        ...grid,
        counts,
        '--step',
        step,
        '--center',
        center,
        '--dry-run',
      ]);
      const [columns, rows] = counts.split('x').map(Number);
      assert.equal(planned.placement.placed, columns * rows, `${counts} step ${step}`);
      for (const value of [...planned.recipe.area.min, ...planned.recipe.area.max])
        assert.equal(Number(value.toFixed(4)), value, `${value} has no float noise`);
    }
  }));
