import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ForgeError } from '../src/kernel/index.js';
import { parseDocument } from '../src/application/document.js';
import { writePlanned } from '../src/infra/generated.js';
import { failure, ok, withTemp } from './helpers.js';

/** A 10 m ground mesh and a hidden cone template `tuft`. */
const garden = {
  operations: [
    { op: 'putMaterial', id: 'grass', material: { color: '#4f8a3a' } },
    { op: 'putGeometry', id: 'ground', geometry: { type: 'box', size: [10, 0.1, 10] } },
    { op: 'putGeometry', id: 'tuft', geometry: { type: 'cone', radius: 0.2, height: 0.5 } },
    { op: 'putNode', node: { id: 'ground', type: 'mesh', geometry: 'ground', material: 'grass' } },
    {
      op: 'putNode',
      node: { id: 'tuft', type: 'mesh', geometry: 'tuft', material: 'grass', visible: false },
    },
  ],
};
async function gardenDocument(cwd: string) {
  await ok(['create', 'garden.model.json', '--id', 'garden', '--name', 'Garden'], { cwd });
  await ok(['-d', 'garden.model.json', 'apply', '--data', JSON.stringify(garden)], { cwd });
  return ['-d', 'garden.model.json'];
}
/** Run with Chromium made unavailable, as on a machine without a browser. */
async function withoutBrowser<T>(action: () => Promise<T>) {
  const previous = process.env.FORGE_CHROMIUM_PATH;
  process.env.FORGE_CHROMIUM_PATH = '/nonexistent/forge-test/chromium';
  try {
    return await action();
  } finally {
    if (previous === undefined) delete process.env.FORGE_CHROMIUM_PATH;
    else process.env.FORGE_CHROMIUM_PATH = previous;
  }
}
/** Render failures before any capture (BUILD_REQUIRED when the preview bundle is not built). */
const unavailable = ['BROWSER_UNAVAILABLE', 'PLAYWRIGHT_UNAVAILABLE', 'BUILD_REQUIRED'];
/** A next command as CLI arguments (without the executable name). */
const replay = (command: string[]) => command.slice(1);

test('scatter --replace never destroys a node that is not a scatter group', () =>
  withTemp(async (cwd) => {
    const doc = await gardenDocument(cwd);
    const file = path.join(cwd, 'garden.model.json');
    const before = await fs.readFile(file);
    const args = [...doc, 'scatter', '--node', 'tuft', '--area', 'rect:-4,-4,4,4'];
    const refused = await failure([...args, '--spacing', '1.5', '--group', 'ground', '--replace'], {
      cwd,
    });
    assert.equal(refused.code, 'DUPLICATE_ID');
    assert.match(refused.message, /not a scatter group/);
    assert.match(refused.hint!, /another group ID \(--group\)/);
    assert.ok((await fs.readFile(file)).equals(before), 'the mesh and its geometry stay');
    // The default group is <first item>-scatter, which --replace may regenerate.
    const first = await ok([...args, '--spacing', '1.5'], { cwd });
    assert.equal(first.placement.group, 'tuft-scatter');
    const again = await ok([...args, '--spacing', '2', '--replace'], { cwd });
    assert.ok(again.changes.nodes.updated.includes('tuft-scatter'));
    assert.equal((await ok([...doc, 'node', 'list', '--ids', 'ground'], { cwd })).total, 1);
  }));

test('scatter --grid CxR --step s places exactly CxR around --center, like Scene Forge layout', () =>
  withTemp(async (cwd) => {
    const doc = await gardenDocument(cwd);
    const grid = ['scatter', '--node', 'tuft', '--grid', '4x3', '--step', '2', '--center', '1,-1'];
    const planned = await ok([...doc, ...grid, '--yaw', '0', '--dry-run'], { cwd });
    assert.equal(planned.placement.placed, 12);
    assert.deepEqual(planned.recipe.area, {
      type: 'rect',
      min: [-2.9998, -3.9998],
      max: [4.9998, 1.9998],
    });
    assert.deepEqual(planned.recipe.distribution, { type: 'grid', step: 2, jitter: 0 });
    // The dry run's next command is the exact guarded write.
    const written = await ok(replay(planned.nextCommands[0]), { cwd });
    assert.equal(written.stateHash, planned.proposedStateHash);
    const nodes = (
      await ok([...doc, 'node', 'list', '--parent', 'tuft-scatter', '--details', '--limit', '20'], {
        cwd,
      })
    ).nodes as { node: { transform: { position: number[] } } }[];
    const cells = nodes.map(({ node }) => [node.transform.position[0], node.transform.position[2]]);
    assert.deepEqual(
      cells,
      [-3, -1, 1].flatMap((z) => [-2, 0, 2, 4].map((x) => [x, z])),
    );
    for (const [extra, pattern] of [
      [['--grid', '4x3'], /--step/],
      [['--grid', '4x3', '--step', '1', '--area', 'rect:0,0,1,1'], /--area/],
      [['--grid', '4', '--step', '1'], /COLUMNSxROWS/],
      [['--spacing', '1', '--step', '1', '--area', 'rect:0,0,4,4'], /--step applies only/],
    ] as [string[], RegExp][]) {
      const error = await failure([...doc, 'scatter', '--node', 'tuft', ...extra], { cwd });
      assert.equal(error.code, 'INVALID_OPTION');
      assert.match(error.message, pattern);
    }
  }));

test('generate and variants render --review before writing: no browser leaves no files', () =>
  withTemp(async (cwd) => {
    await ok(['generate', 'rock', '--out', 'rock.model.json'], { cwd });
    const before = (await fs.readdir(cwd)).sort();
    await withoutBrowser(async () => {
      const single = await failure(
        ['generate', 'crate', '--out', 'crate.model.json', '--review', 'crate-review'],
        { cwd },
      );
      assert.ok(unavailable.includes(single.code), single.code);
      const many = await failure(
        ['generate', 'crate', '--count', '2', '--out', 'crates', '--review', 'crates-review'],
        { cwd },
      );
      assert.ok(unavailable.includes(many.code), many.code);
      const variants = await failure(
        [
          '-d',
          'rock.model.json',
          'variants',
          '--count',
          '2',
          '--vary',
          'size=0.9..1.1',
          '--out',
          'rocks',
          '--review',
          'rocks-review',
        ],
        { cwd },
      );
      assert.ok(unavailable.includes(variants.code), variants.code);
    });
    assert.deepEqual((await fs.readdir(cwd)).sort(), before, 'a retry is not blocked');
    // The same commands without --review still succeed afterwards.
    await ok(['generate', 'crate', '--out', 'crate.model.json'], { cwd });
    const same = await failure(
      ['-d', 'rock.model.json', 'variants', '--count', '2', '--vary', 'size=0.9..1.1'].concat(
        '--out',
        'v',
        '--review',
        'v',
      ),
      { cwd },
    );
    assert.equal(same.code, 'INVALID_OPTION');
    assert.match(same.message, /--review needs a directory other than --out/);
  }));

test('a write failure part way names every path already written', () =>
  withTemp(async (cwd) => {
    const document = parseDocument({
      schemaVersion: 1,
      kind: 'model',
      id: 'crate',
      name: 'Crate',
      geometries: { g: { type: 'box', size: [1, 1, 1] } },
      materials: { m: { color: '#aa7744' } },
      nodes: [{ id: 'n', type: 'mesh', geometry: 'g', material: 'm' }],
    });
    await fs.writeFile(path.join(cwd, 'blocker'), 'a file where a directory is needed');
    const first = path.join(cwd, 'a/crate.model.json');
    await assert.rejects(
      writePlanned(
        [
          {
            path: first,
            document,
            sidecar: { path: path.join(cwd, 'a/crate.generate.json'), data: {} },
          },
          { path: path.join(cwd, 'blocker/crate.model.json'), document },
        ],
        { written: [path.join(cwd, 'review')] },
      ),
      (error: unknown) => {
        assert.ok(error instanceof ForgeError);
        const details = error.details as { written: string[]; hint: string };
        assert.deepEqual(details.written, [
          path.join(cwd, 'review'),
          first,
          path.join(cwd, 'a/crate.generate.json'),
        ]);
        assert.match(details.hint, /Nothing was rolled back/);
        assert.match(error.message, /Already written: 3 path\(s\)/);
        return true;
      },
    );
  }));

test('generator parameter errors list issues as an array and point to generate show', () =>
  withTemp(async (cwd) => {
    const error = await failure(
      ['generate', 'rock', '--set', 'size=999', '--out', 'r.model.json'],
      { cwd },
    );
    assert.equal(error.code, 'SCHEMA_INVALID');
    assert.ok(Array.isArray(error.details), JSON.stringify(error.details));
    assert.equal(error.details[0].path, 'size');
    assert.match(error.message, /^Generator rock parameters are invalid \(size: /);
    assert.equal(error.hint, 'Run generate show rock for parameter ranges and choices.');
    assert.doesNotMatch(error.message, /schema command/);
  }));

test('generate and variants dry runs return the exact command that writes the same documents', () =>
  withTemp(async (cwd) => {
    const generate = ['generate', 'crate', '--preset', 'military', '--seed', '4'];
    const planned = await ok(
      [...generate, '--set', 'planks=5', '--count', '2', '--out', 'crates', '--dry-run'],
      { cwd },
    );
    assert.equal(planned.nextCommands.length, 1);
    assert.ok(!planned.nextCommands[0].includes('--dry-run'));
    const written = await ok(replay(planned.nextCommands[0]), { cwd });
    assert.deepEqual(
      written.documents.map((d: { stateHash: string }) => d.stateHash),
      planned.documents.map((d: { stateHash: string }) => d.stateHash),
    );
    assert.equal(written.recipeHash, planned.recipeHash);

    const variants = [
      '-d',
      'crates/crates-01.model.json',
      'variants',
      '--count',
      '3',
      '--seed',
      '7',
      '--out',
      'boxes',
    ];
    const material = Object.keys(
      JSON.parse(await fs.readFile(path.join(cwd, 'crates/crates-01.model.json'), 'utf8'))
        .materials,
    )[0];
    const dry = await ok([...variants, '--materials', `${material}=#112233,#445566`, '--dry-run'], {
      cwd,
    });
    assert.ok(!dry.nextCommands[0].includes('--dry-run'));
    const real = await ok(replay(dry.nextCommands[0]), { cwd });
    assert.equal(real.recipeHash, dry.recipeHash);
    assert.deepEqual(
      real.documents.map((d: { stateHash: string }) => d.stateHash),
      dry.documents.map((d: { stateHash: string }) => d.stateHash),
    );
  }));
