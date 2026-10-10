import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { failure, ok, sceneForgeBin, withTemp } from './helpers.js';

const run = promisify(execFile);
/** A 10 m ground plane plus a hidden cone template to scatter. */
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
async function gardenDocument(cwd: string, file = 'garden.model.json') {
  await ok(['create', file, '--id', 'garden', '--name', 'Garden'], { cwd });
  await ok(['-d', file, 'apply', '--data', JSON.stringify(garden), '--expected-revision', '0'], {
    cwd,
  });
  return ['-d', file];
}
const flags = ['--node', 'tuft', '--area', 'rect:-4,-4,4,4', '--spacing', '1.5', '--seed', '3'];

test('scatter plans with the kernel and commits like apply: dry run, guards, history', () =>
  withTemp(async (cwd) => {
    const doc = await gardenDocument(cwd);
    const file = path.join(cwd, 'garden.model.json');
    const before = await fs.readFile(file);
    const planned = await ok([...doc, 'scatter', ...flags, '--dry-run'], { cwd });
    assert.ok((await fs.readFile(file)).equals(before), 'a dry run writes nothing');
    assert.equal(planned.dryRun, true);
    assert.equal(planned.revision, 1);
    assert.equal(planned.proposedRevision, 2);
    assert.ok(planned.placement.placed > 10);
    assert.equal(planned.changes.nodes.added.length, planned.placement.placed + 1);
    assert.equal(planned.recipe.kind, 'scatter');
    assert.equal(planned.recipeHash, planned.placement.recipeHash);
    assert.ok(planned.nextCommands[0].includes('--expected-state'));
    const written = await ok([...doc, 'scatter', ...flags, '--expected-revision', '1'], { cwd });
    assert.equal(written.revision, 2);
    assert.equal(written.stateHash, planned.proposedStateHash);
    assert.ok(
      (await fs.readFile(path.join(cwd, 'garden.model.json.history/1.json'))).equals(before),
    );
    const listed = await ok([...doc, 'node', 'list', '--parent', 'scatter', '--limit', '1000'], {
      cwd,
    });
    assert.equal(listed.total, written.placement.placed);
    assert.ok(listed.nodes.every((n: { visible: boolean }) => n.visible));
    const group = (await ok([...doc, 'node', 'list', '--ids', 'scatter'], { cwd })).nodes[0];
    assert.deepEqual(group.tags, ['scatter', `scatter:${written.recipeHash.slice(0, 8)}`]);

    const stale = await failure([...doc, 'scatter', ...flags, '--expected-revision', '1'], { cwd });
    assert.equal(stale.code, 'REVISION_CONFLICT');
    const taken = await failure([...doc, 'scatter', ...flags], { cwd });
    assert.equal(taken.code, 'DUPLICATE_ID');
    assert.match(taken.hint!, /replace/);
    const replaced = await ok(
      [...doc, 'scatter', ...flags.map((v) => (v === '3' ? '4' : v)), '--replace'],
      { cwd },
    );
    assert.equal(replaced.revision, 3);
    assert.ok(replaced.changes.nodes.updated.includes('scatter'), 'the group is replaced');
    await ok([...doc, 'validate'], { cwd });

    // The same recipe as a file, and on a copy, gives the same plan.
    const copy = await gardenDocument(cwd, 'copy.model.json');
    await fs.writeFile(path.join(cwd, 'recipe.json'), JSON.stringify(written.recipe));
    const fromFile = await ok([...copy, 'scatter', '--file', 'recipe.json'], { cwd });
    assert.equal(fromFile.recipeHash, written.recipeHash);
    assert.equal(fromFile.stateHash, written.stateHash, 'equal documents, equal state');
    assert.deepEqual(fromFile.changes.nodes, written.changes.nodes);
    const mixed = await failure(
      [...copy, 'scatter', '--file', 'recipe.json', '--max-slope', '30'],
      {
        cwd,
      },
    );
    assert.equal(mixed.code, 'INVALID_OPTION');
    assert.match(mixed.message, /--max-slope/);
  }));

test('scatter grounds on generated terrain and instances bundle dependencies', () =>
  withTemp(async (cwd) => {
    await ok(['generate', 'terrain', '--set', 'resolution=32', '--out', 'hills.model.json'], {
      cwd,
    });
    await ok(['generate', 'tree', '--preset', 'conifer', '--out', 'fir.model.json'], { cwd });
    const model = await failure(
      ['-d', 'hills.model.json', 'scatter', '--model', 'fir', '--spacing', '9'],
      { cwd },
    );
    assert.equal(model.code, 'REFERENCE_MISSING');
    assert.match(model.hint!, /model-bundle/);
    const kind = await failure(
      [
        '-d',
        'hills.model.json',
        'scatter',
        '--model',
        'fir',
        '--dependency',
        'fir.model.json',
        '--spacing',
        '9',
      ],
      { cwd },
    );
    assert.equal(kind.code, 'DOCUMENT_KIND');
    assert.match(kind.hint!, /import --from/);
    await ok(['import', '--from', 'hills.model.json', '--out', 'forest.model-bundle.json'], {
      cwd,
    });
    const forest = ['-d', 'forest.model-bundle.json', 'scatter'];
    const result = await ok(
      [
        ...forest,
        '--group',
        'firs',
        '--model',
        'fir',
        '--dependency',
        'fir.model.json',
        '--spacing',
        '9',
        '--on',
        'terrain',
        '--scale',
        '0.6..1.2',
        '--max',
        '12',
      ],
      { cwd },
    );
    assert.deepEqual(result.changes.dependencies.added, ['fir']);
    assert.ok(result.placement.placed > 0 && result.placement.placed <= 12);
    const bundle = JSON.parse(
      await fs.readFile(path.join(cwd, 'forest.model-bundle.json'), 'utf8'),
    );
    const firs = bundle.models.hills.nodes.filter((n: { parent?: string }) => n.parent === 'firs');
    assert.ok(firs.every((n: { model: string }) => n.model === 'fir'));
    assert.ok(
      firs.some((n: { transform: { position: number[] } }) => n.transform.position[1] > 0.05),
      'grounded on the terrain surface',
    );
    await ok(
      [
        '-d',
        'forest.model-bundle.json',
        'export',
        '--format',
        'glb',
        '--validate',
        '--out',
        'forest.glb',
      ],
      { cwd },
    );
    const empty = await failure(
      [
        ...forest,
        '--group',
        'none',
        '--model',
        'fir',
        '--spacing',
        '9',
        '--area',
        'rect:0,0,10,10',
        '--exclude',
        'rect:-1,-1,11,11',
      ],
      { cwd },
    );
    assert.equal(empty.code, 'SCATTER_EMPTY');
    const allowed = await ok(
      [
        ...forest,
        '--group',
        'none',
        '--model',
        'fir',
        '--spacing',
        '9',
        '--area',
        'rect:0,0,10,10',
        '--exclude',
        'rect:-1,-1,11,11',
        '--allow-empty',
        '--dry-run',
      ],
      { cwd },
    );
    assert.deepEqual(allowed.changes.nodes.added, ['none']);
    for (const bad of [
      [],
      ['--spacing', '2', '--count', '5'],
      ['--spacing', '2', '--area', 'square:1'],
    ])
      assert.equal(
        (await failure([...forest, '--model', 'fir', ...bad], { cwd })).code,
        'INVALID_OPTION',
      );
  }));

test('scatter refuses documents inside a Scene Forge project', () =>
  withTemp(async (cwd) => {
    await gardenDocument(cwd);
    await run(process.execPath, [sceneForgeBin, 'init', 'project', '--name', 'P'], { cwd });
    await fs.copyFile(
      path.join(cwd, 'garden.model.json'),
      path.join(cwd, 'project/garden.model.json'),
    );
    const refused = await failure(['-d', 'project/garden.model.json', 'scatter', ...flags], {
      cwd,
    });
    assert.equal(refused.code, 'PROJECT_MODEL_READONLY');
  }));

test('discover and schema publish the procedural contracts', async () => {
  const catalog = await ok(['discover']);
  assert.ok(catalog.workflow.some((step: { step: string }) => step.step === 'generate'));
  assert.deepEqual(
    catalog.procedural.generators.map((g: { id: string }) => g.id),
    ['rock', 'tree', 'bush', 'crate', 'barrel', 'fence', 'building', 'terrain'],
  );
  assert.ok(
    catalog.procedural.generators.every((g: { presets: string[] }) => g.presets.length >= 3),
  );
  for (const command of ['generate list', 'generate show', 'generate rock', 'variants', 'scatter'])
    assert.ok(catalog.commands.includes(command), command);
  const codes = catalog.errorCodes.map((e: { code: string }) => e.code);
  for (const code of ['GENERATOR_NOT_FOUND', 'VARIANT_RANGE', 'PROCEDURAL_BUDGET', 'SCATTER_EMPTY'])
    assert.ok(codes.includes(code), code);
  for (const kind of ['scatter', 'generator-recipe', 'model-variants']) {
    const schema = await ok(['schema', '--kind', kind]);
    assert.equal(schema.type, 'object', kind);
  }
});
