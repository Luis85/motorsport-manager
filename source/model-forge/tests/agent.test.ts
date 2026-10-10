import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { cli, copyProject, failure, ok, sceneForgeBin, withTemp } from './helpers.js';

const run = promisify(execFile);
/** Scene Forge's checked-in executable, the consumer of model and model-bundle exports. */
async function sceneForge(cwd: string, ...args: string[]) {
  const { stdout } = await run(process.execPath, [sceneForgeBin, '--compact', ...args], {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(stdout).data;
}

const lampBatch = (guards: { expectedRevision: number; expectedState: string }) => ({
  ...guards,
  operations: [
    {
      op: 'putParameter',
      id: 'height',
      default: 1.4,
      min: 0.8,
      max: 2,
      description: 'Pole height',
    },
    {
      op: 'putMaterial',
      id: 'brass',
      material: { color: '#b08d57', metalness: 0.8, roughness: 0.35 },
    },
    { op: 'putMaterial', id: 'shade', material: { color: '#f3e3c3', roughness: 0.8 } },
    {
      op: 'putGeometry',
      id: 'base',
      geometry: { type: 'cylinder', radiusTop: 0.18, radiusBottom: 0.22, height: 0.05 },
    },
    {
      op: 'putGeometry',
      id: 'pole',
      geometry: {
        type: 'cylinder',
        radiusTop: 0.02,
        radiusBottom: 0.02,
        height: { $param: 'height' },
      },
    },
    { op: 'putGeometry', id: 'cone', geometry: { type: 'cone', radius: 0.25, height: 0.3 } },
    { op: 'putNode', node: { id: 'base', type: 'mesh', geometry: 'base', material: 'brass' } },
    {
      op: 'putNode',
      node: {
        id: 'pole',
        type: 'mesh',
        geometry: 'pole',
        material: 'brass',
        parent: 'base',
        transform: { position: [0, { $expr: 'div', args: [{ $param: 'height' }, 2] }, 0] },
      },
    },
    {
      op: 'putNode',
      node: {
        id: 'lampshade',
        type: 'mesh',
        geometry: 'cone',
        material: 'shade',
        transform: { position: [0, { $param: 'height' }, 0] },
      },
    },
    { op: 'groundNode', id: 'base' },
  ],
});

test('a scripted agent session: discover, create, guarded edits, conflict, exports and Scene Forge import', () =>
  withTemp(async (cwd) => {
    const catalog = await ok(['--compact', 'discover']);
    assert.equal(catalog.workflow[0].command, 'discover');
    const schema = JSON.parse((await cli(['schema', '--kind', 'batch', '--raw'])).stdout);
    assert.ok(schema.properties.operations);

    const doc = ['-d', 'lamp.model.json'];
    const created = await ok(
      [
        'create',
        'lamp.model.json',
        '--id',
        'lamp',
        '--name',
        'Floor lamp',
        '--category',
        'lighting',
      ],
      { cwd },
    );
    assert.equal(created.revision, 0);
    const first = await ok([...doc, 'inspect', '--source'], { cwd });
    const guards = { expectedRevision: first.revision, expectedState: first.stateHash };
    await fs.writeFile(path.join(cwd, 'batch.json'), JSON.stringify(lampBatch(guards)));

    const dry = await ok([...doc, 'apply', '--file', 'batch.json', '--dry-run'], { cwd });
    assert.equal(dry.dryRun, true);
    assert.equal(dry.revision, 0);
    assert.deepEqual(dry.changes.nodes.added, ['base', 'pole', 'lampshade']);
    assert.deepEqual(dry.changes.parameters.added, ['height']);
    const applied = await ok([...doc, 'apply', '--file', 'batch.json'], { cwd });
    assert.equal(applied.revision, 1);
    assert.equal(applied.stateHash, dry.proposedStateHash, 'the dry run predicted the exact state');
    assert.ok(applied.stats.bounds.min[1] >= -1e-9, 'grounded');

    // A second agent holding the old guards must not overwrite the first agent's work.
    const stale = await failure([...doc, 'apply', '--file', 'batch.json'], { cwd });
    assert.equal(stale.code, 'REVISION_CONFLICT');
    assert.deepEqual(stale.details, { expected: 0, actual: 1 });
    const fresh = await ok([...doc, 'inspect'], { cwd });
    const rebased = await ok(
      [
        ...doc,
        'parameter',
        'put',
        'height',
        '--default',
        '1.6',
        '--min',
        '0.8',
        '--max',
        '2',
        '--expected-revision',
        String(fresh.revision),
        '--expected-state',
        fresh.stateHash,
      ],
      { cwd },
    );
    assert.equal(rebased.revision, 2);
    assert.equal(
      (
        await failure(
          [...doc, 'metadata', 'set', '--name', 'X', '--expected-state', fresh.stateHash],
          { cwd },
        )
      ).code,
      'STATE_CONFLICT',
    );

    const inspected = await ok([...doc, 'inspect', '--parameters', '{"height":2}'], { cwd });
    assert.equal(inspected.parameters.height.default, 1.6);
    assert.ok(inspected.stats.bounds.max[1] > 2);
    assert.equal((await ok([...doc, 'validate'], { cwd })).valid, true);
    assert.equal((await ok([...doc, 'audit', '--strict'], { cwd })).passed, true);

    const glb = await ok(
      [...doc, 'export', '--format', 'glb', '--validate', '--out', 'exports/lamp.glb'],
      { cwd },
    );
    assert.equal(glb.validation.numErrors, 0);
    assert.equal(glb.revision, 2);
    await ok([...doc, 'export', '--format', 'model-bundle', '--out', 'exports/lamp.bundle.json'], {
      cwd,
    });
    const littlewild = await ok(
      [
        ...doc,
        'export',
        '--format',
        'littlewild',
        '--family',
        'items',
        '--variant',
        'world',
        '--out',
        'assets/items/floor-lamp/definition.json',
      ],
      { cwd },
    );
    assert.equal(littlewild.written, true);
    const definition = JSON.parse(
      await fs.readFile(path.join(cwd, 'assets/items/floor-lamp/definition.json'), 'utf8'),
    );
    assert.equal(definition.format, 'littlewild-definition');
    assert.deepEqual(Object.keys(definition.visual.models), ['world']);

    // Scene Forge consumes the bundle unchanged, and renders the same GLB bytes.
    await sceneForge(cwd, 'init', 'project');
    const project = path.join(cwd, 'project');
    const bundle = path.join(cwd, 'exports/lamp.bundle.json');
    const planned = await sceneForge(
      cwd,
      '-p',
      project,
      'model',
      'import',
      '--file',
      bundle,
      '--dry-run',
    );
    assert.equal(planned.dryRun, true);
    assert.deepEqual(planned.models, ['lamp']);
    await sceneForge(cwd, '-p', project, 'model', 'import', '--file', bundle);
    await sceneForge(
      cwd,
      '-p',
      project,
      'export',
      '--model',
      'lamp',
      '--format',
      'glb',
      '--out',
      path.join(project, 'sf.glb'),
    );
    assert.ok(
      (await fs.readFile(path.join(cwd, 'exports/lamp.glb'))).equals(
        await fs.readFile(path.join(project, 'sf.glb')),
      ),
      'model-forge GLB equals scene-forge GLB',
    );
    const history = await ok([...doc, 'history'], { cwd });
    assert.deepEqual(
      history.revisions.map((r: { revision: number }) => r.revision),
      [0, 1, 2],
    );
  }));

test('exports are byte-identical to Scene Forge for project models, including nested ones', () =>
  withTemp(async (cwd) => {
    const cases = [
      ['composition', 'rover', 'model'],
      ['composition', 'fieldStation', 'model-bundle'],
      ['pocket-pet', 'petAdultBloom', 'model-bundle'],
    ] as const;
    for (const name of new Set(cases.map(([project]) => project))) await copyProject(name, cwd);
    for (const [name, id, kind] of cases) {
      const project = path.join(cwd, name);
      const file = `${id}.${kind}.json`;
      await ok(['import', '--project', project, '--id', id, '--out', file], { cwd });
      await sceneForge(
        cwd,
        '-p',
        project,
        'export',
        '--model',
        id,
        '--format',
        'glb',
        '--out',
        path.join(project, `sf-${id}.glb`),
      );
      await ok(['-d', file, 'export', '--format', 'glb', '--out', `mf-${id}.glb`], { cwd });
      const [expected, actual] = await Promise.all([
        fs.readFile(path.join(project, `sf-${id}.glb`)),
        fs.readFile(path.join(cwd, `mf-${id}.glb`)),
      ]);
      assert.ok(expected.equals(actual), `${id} GLB bytes`);
      await sceneForge(
        cwd,
        '-p',
        project,
        'model',
        'export',
        id,
        '--out',
        path.join(project, `sf-${id}.bundle.json`),
      );
      await ok(
        ['-d', file, 'export', '--format', 'model-bundle', '--out', `mf-${id}.bundle.json`],
        { cwd },
      );
      assert.equal(
        await fs.readFile(path.join(cwd, `mf-${id}.bundle.json`), 'utf8'),
        await fs.readFile(path.join(project, `sf-${id}.bundle.json`), 'utf8'),
        `${id} model-bundle bytes`,
      );
    }
    const pets = path.join(cwd, 'pocket-pet');
    await sceneForge(
      cwd,
      '-p',
      pets,
      'littlewild',
      'export',
      '--model',
      'petAdultBloom',
      '--family',
      'pets',
      '--out',
      path.join(pets, 'sf/pets/bloom/definition.json'),
    );
    await ok(
      [
        '-d',
        'petAdultBloom.model-bundle.json',
        'export',
        '--format',
        'littlewild',
        '--family',
        'pets',
        '--out',
        'mf/pets/bloom/definition.json',
      ],
      { cwd },
    );
    assert.equal(
      await fs.readFile(path.join(cwd, 'mf/pets/bloom/definition.json'), 'utf8'),
      await fs.readFile(path.join(pets, 'sf/pets/bloom/definition.json'), 'utf8'),
      'Littlewild definition bytes',
    );
  }));
