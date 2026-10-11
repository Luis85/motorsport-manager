import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ForgeError, modelStateHash, parse, ModelSchema } from '../src/kernel/index.js';
import {
  parseDocument,
  serializeDocument,
  documentStateHash,
  revisionOf,
} from '../src/application/document.js';
import {
  commitEdit,
  createDocument,
  historyFile,
  listHistory,
  readDocument,
  restoreRevision,
} from '../src/infra/store.js';
import { boxModel, withTemp } from './helpers.js';

const code = (expected: string) => (error: unknown) =>
  error instanceof ForgeError && error.code === expected;
const bundle = () => ({
  schemaVersion: 1,
  kind: 'model-bundle',
  entry: 'shelf',
  models: {
    crate: boxModel('crate'),
    shelf: {
      schemaVersion: 1,
      kind: 'model',
      id: 'shelf',
      name: 'Shelf',
      nodes: [{ id: 'item', type: 'model', model: 'crate' }],
    },
  },
});

test('documents parse model and model-bundle kinds and serialize the entry first', () => {
  const single = parseDocument(boxModel());
  assert.equal(single.kind, 'model');
  assert.deepEqual(single.dependencies, {});
  assert.equal(revisionOf(single), 0, 'absent revision means 0');
  const nested = parseDocument(bundle());
  assert.equal(nested.model.id, 'shelf');
  assert.deepEqual(Object.keys(nested.dependencies), ['crate']);
  const written = serializeDocument(nested) as { entry: string; models: object };
  assert.equal(written.entry, 'shelf');
  assert.deepEqual(Object.keys(written.models), ['shelf', 'crate']);
  assert.throws(() => parseDocument({ schemaVersion: 1, kind: 'scene' }), code('DOCUMENT_KIND'));
  assert.throws(() => parseDocument({ ...bundle(), entry: 'missing' }), code('REFERENCE_MISSING'));
  const mismatched = bundle();
  mismatched.models.crate = boxModel('other');
  assert.throws(() => parseDocument(mismatched), code('ID_MISMATCH'));
});

test('stateHash is the kernel model hash, unchanged for documents without a revision', () => {
  const document = parseDocument(boxModel());
  assert.equal(documentStateHash(document), modelStateHash(parse(ModelSchema, boxModel()), {}));
  const nested = parseDocument(bundle());
  assert.equal(documentStateHash(nested), modelStateHash(nested.model, nested.dependencies));
  const revised = parseDocument({ ...boxModel(), revision: 3 });
  assert.equal(revisionOf(revised), 3);
  assert.notEqual(documentStateHash(revised), documentStateHash(document));
});

test('document paths declare their kind and creation never overwrites', () =>
  withTemp(async (directory) => {
    const file = path.join(directory, 'crate.model.json');
    const created = await createDocument(file, parseDocument(boxModel()));
    assert.equal(created.revision, 0);
    assert.equal(created.stats.meshes, 2);
    await assert.rejects(createDocument(file, parseDocument(boxModel())), code('DOCUMENT_EXISTS'));
    await assert.rejects(
      createDocument(path.join(directory, 'crate.json'), parseDocument(boxModel())),
      code('DOCUMENT_KIND'),
    );
    await assert.rejects(
      createDocument(path.join(directory, 'shelf.model.json'), parseDocument(bundle())),
      code('DOCUMENT_KIND'),
    );
    await assert.rejects(
      readDocument(path.join(directory, 'missing.model.json')),
      code('DOCUMENT_NOT_FOUND'),
    );
    const misnamed = path.join(directory, 'shelf.model-bundle.json');
    await fs.writeFile(misnamed, JSON.stringify(boxModel()));
    await assert.rejects(readDocument(misnamed), code('DOCUMENT_KIND'));
    await fs.writeFile(path.join(directory, 'broken.model.json'), '{');
    await assert.rejects(
      readDocument(path.join(directory, 'broken.model.json')),
      code('JSON_INVALID'),
    );
    const invalid = path.join(directory, 'invalid.model.json');
    await fs.writeFile(invalid, JSON.stringify({ ...boxModel(), nodes: 'none' }));
    await assert.rejects(
      readDocument(invalid),
      (error: unknown) =>
        code('SCHEMA_INVALID')(error) && /invalid\.model\.json/.test((error as Error).message),
    );
  }));

test('a written edit snapshots the replaced bytes, increments revision and replaces atomically', () =>
  withTemp(async (directory) => {
    const file = path.join(directory, 'crate.model.json');
    await createDocument(file, parseDocument(boxModel()));
    const before = await fs.readFile(file);
    const result = await commitEdit(file, [{ op: 'removeNode', id: 'lid', cascade: false }], {
      expectedRevision: 0,
    });
    assert.equal(result.revision, 1);
    assert.ok(
      (await fs.readFile(historyFile(file, 0))).equals(before),
      'history keeps exact bytes',
    );
    const current = await readDocument(file);
    assert.equal(current.revision, 1);
    assert.equal(current.stateHash, result.stateHash);
    assert.deepEqual(
      (await fs.readdir(directory)).sort(),
      ['crate.model.json', 'crate.model.json.history'],
      'no lock or temporary files remain',
    );
    // Replacing a definition with identical content is a no-op edit.
    const body = (await readDocument(file)).document.model.geometries.body;
    const unchanged = await commitEdit(
      file,
      [{ op: 'putGeometry', id: 'body', geometry: body }],
      {},
    );
    assert.equal(unchanged.changed, false);
    assert.equal(unchanged.revision, 1, 'a no-op edit keeps the revision');
    assert.deepEqual(await fs.readdir(`${file}.history`), ['0.json']);
  }));

test('the document lock rejects a concurrent writer and is released after failures', () =>
  withTemp(async (directory) => {
    const file = path.join(directory, 'crate.model.json');
    await createDocument(file, parseDocument(boxModel()));
    await fs.writeFile(`${file}.lock`, '{"pid":1}');
    await assert.rejects(
      commitEdit(file, [{ op: 'removeNode', id: 'lid', cascade: false }], {}),
      code('DOCUMENT_LOCKED'),
    );
    assert.equal((await readDocument(file)).revision, 0, 'reads never wait for the lock');
    await fs.rm(`${file}.lock`);
    await assert.rejects(
      commitEdit(file, [{ op: 'removeNode', id: 'missing', cascade: false }], {}),
      code('NOT_FOUND'),
    );
    await assert.rejects(fs.access(`${file}.lock`), 'a failed edit releases the lock');
  }));

test('history lists revisions and restore writes a new revision from a stored one', () =>
  withTemp(async (directory) => {
    const file = path.join(directory, 'crate.model.json');
    await createDocument(file, parseDocument(boxModel()));
    const original = await readDocument(file);
    await commitEdit(file, [{ op: 'removeNode', id: 'lid', cascade: false }], {});
    await commitEdit(file, [{ op: 'setMetadata', name: 'Small crate' }], {});
    const history = await listHistory(file);
    assert.deepEqual(
      history.revisions.map((entry) => entry.revision),
      [0, 1, 2],
    );
    assert.equal(history.revisions[0].stateHash, original.stateHash);
    assert.equal(history.revisions.at(-1)!.current, true);
    await assert.rejects(restoreRevision(file, 9, {}), code('HISTORY_NOT_FOUND'));
    await assert.rejects(
      restoreRevision(file, 0, { expectedRevision: 1 }),
      code('REVISION_CONFLICT'),
    );
    const dry = await restoreRevision(file, 0, { dryRun: true, expectedRevision: 2 });
    assert.equal(dry.revision, 2);
    assert.equal(dry.proposedRevision, 3);
    const restored = await restoreRevision(file, 0, { expectedRevision: 2 });
    assert.equal(restored.revision, 3);
    assert.equal(restored.changed, true);
    const current = await readDocument(file);
    assert.equal(current.document.model.name, 'Crate');
    assert.equal(current.document.model.nodes.length, 2);
    assert.equal(current.stateHash, restored.stateHash);
    assert.ok(await fs.stat(historyFile(file, 2)), 'the replaced revision is kept');
    const again = await restoreRevision(file, 0, {});
    assert.equal(again.changed, false, 'restoring identical content is a no-op');
    assert.equal(again.revision, 3);
  }));
