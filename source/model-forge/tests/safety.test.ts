import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { hostname } from 'node:os';
import { withFileLock } from '../src/infra/files.js';
import { boxModel, copyProject, failure, ok, withTemp } from './helpers.js';

const readonly = 'PROJECT_MODEL_READONLY';

test('documents inside a Scene Forge project are read-only to Model Forge', () =>
  withTemp(async (cwd) => {
    const project = await copyProject('composition', cwd);
    const rover = path.join(project, 'models/rover.model.json');
    const before = await fs.readFile(rover);
    const doc = ['-d', rover];
    // Reads stay allowed and never create side files in the project.
    assert.equal((await ok([...doc, 'inspect'])).id, 'rover');
    assert.equal((await ok([...doc, 'validate'])).valid, true);
    await ok([...doc, 'export', '--format', 'glb', '--out', path.join(cwd, 'rover.glb')]);
    const refused = await failure([...doc, 'add', 'box', 'extra']);
    assert.equal(refused.code, readonly);
    assert.match(refused.message, /Scene Forge project/);
    assert.equal(refused.details.project, project);
    for (const step of ['import --project', 'export --format model-bundle', 'model import'])
      assert.ok(refused.hint!.includes(step), step);
    assert.match(refused.hint!, /--replace --expected-revision/);
    assert.match(refused.hint!, /--expected-state/);
    for (const args of [
      ['apply', '--data', '{"operations":[{"op":"removeNode","id":"body"}]}', '--dry-run'],
      ['restore', '0', '--expected-revision', '0'],
      ['metadata', 'set', '--name', 'X'],
    ])
      assert.equal((await failure([...doc, ...args])).code, readonly, args.join(' '));
    const nested = path.join(project, 'models/new/deeper');
    const creations = [
      ['create', path.join(nested, 'lamp.model.json'), '--id', 'lamp', '--name', 'Lamp'],
      ['example', 'create', 'barrel', path.join(project, 'barrel2.model.json')],
      ['import', '--from', rover, '--out', path.join(project, 'copy.model.json')],
      ['import', '--from', rover, '--out', path.join(project, 'dry.model.json'), '--dry-run'],
      [...doc, 'export', '--format', 'model-bundle', '--out', path.join(project, 'r.bundle.json')],
    ];
    for (const args of creations)
      assert.equal((await failure(args)).code, readonly, args.join(' '));
    assert.ok((await fs.readFile(rover)).equals(before), 'the project model is unchanged');
    const entries = await fs.readdir(project, { recursive: true });
    assert.deepEqual(
      entries.filter((name) => /\.lock$|\.history|copy|dry|barrel2|new|r\.bundle/.test(name)),
      [],
      'no lock, history or new file was written into the project',
    );
    // The supported path: copy out, edit, hand back through Scene Forge's guarded import.
    const copy = path.join(cwd, 'rover.model.json');
    await ok(['import', '--project', project, '--id', 'rover', '--out', copy]);
    assert.equal((await ok(['-d', copy, 'add', 'box', 'extra'])).revision, 1);
  }));

test('outputs never silently replace files, the document, locks or history', () =>
  withTemp(async (cwd) => {
    await fs.writeFile(path.join(cwd, 'crate.model.json'), JSON.stringify(boxModel()));
    const doc = ['-d', 'crate.model.json'];
    await ok([...doc, 'add', 'box', 'extra'], { cwd });
    const glb = ['export', '--format', 'glb', '--out', 'crate.glb'];
    const first = await ok([...doc, ...glb], { cwd });
    const exists = await failure([...doc, ...glb], { cwd });
    assert.equal(exists.code, 'ALREADY_EXISTS');
    assert.match(exists.hint!, /--overwrite/);
    assert.equal(exists.details.path, path.join(cwd, 'crate.glb'));
    assert.equal((await ok([...doc, ...glb, '--overwrite'], { cwd })).bytes, first.bytes);
    for (const format of ['model', 'obj']) {
      const out = ['export', '--format', format, '--out', `crate.${format}.out`];
      await ok([...doc, ...out], { cwd });
      assert.equal((await failure([...doc, ...out], { cwd })).code, 'ALREADY_EXISTS', format);
    }
    await ok([...doc, 'preview', '--out', 'crate.html'], { cwd });
    assert.equal(
      (await failure([...doc, 'preview', '--out', 'crate.html'], { cwd })).code,
      'ALREADY_EXISTS',
    );
    await ok([...doc, 'preview', '--out', 'crate.html', '--overwrite'], { cwd });
    await fs.mkdir(path.join(cwd, 'folder.glb'));
    assert.equal(
      (await failure([...doc, 'export', '--out', 'folder.glb', '--overwrite'], { cwd })).code,
      'INVALID_PATH',
    );
    const forbidden = [
      'crate.model.json',
      './sub/../crate.model.json',
      'crate.model.json.lock',
      'any.lock',
      'crate.model.json.history/0.json',
      'crate.model.json.history/new.glb',
      'other.model.json.history/x.glb',
    ];
    for (const out of forbidden)
      for (const overwrite of [[], ['--overwrite']]) {
        const error = await failure(
          [...doc, 'export', '--format', 'model', '--out', out, ...overwrite],
          { cwd },
        );
        assert.equal(error.code, 'INVALID_PATH', `${out} ${overwrite.join('')}`);
      }
    assert.equal(
      (await failure([...doc, 'preview', '--out', 'crate.model.json.history/p.html'], { cwd }))
        .code,
      'INVALID_PATH',
    );
    assert.equal(
      (await failure([...doc, 'review', '--out', 'crate.model.json.history'], { cwd })).code,
      'INVALID_PATH',
    );
    assert.equal(
      (await failure([...doc, 'review', '--out', 'crate.glb'], { cwd })).code,
      'INVALID_PATH',
      'a review directory cannot be an existing file',
    );
    for (const args of [
      ['create', 'crate.model.json.history/x.model.json', '--id', 'x', '--name', 'X'],
      ['example', 'create', 'barrel', 'crate.model.json.history/barrel.model.json'],
      ['import', '--from', 'crate.model.json', '--out', 'crate.model.json.history/y.model.json'],
    ])
      assert.equal((await failure(args, { cwd })).code, 'INVALID_PATH', args.join(' '));
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(cwd, 'crate.model.json.history/0.json'), 'utf8')),
      boxModel(),
      'history is untouched',
    );
  }));

test('locks report their holder, detect a stale holder and are only released by their owner', () =>
  withTemp(async (cwd) => {
    await fs.writeFile(path.join(cwd, 'crate.model.json'), JSON.stringify(boxModel()));
    const lock = path.join(cwd, 'crate.model.json.lock');
    const add = ['-d', 'crate.model.json', 'add', 'box', 'extra'];
    const live = { pid: process.pid, hostname: hostname(), createdAt: '2026-01-01T00:00:00.000Z' };
    await fs.writeFile(lock, JSON.stringify(live));
    const held = await failure(add, { cwd });
    assert.equal(held.code, 'DOCUMENT_LOCKED');
    assert.equal(held.details.pid, process.pid);
    assert.equal(held.details.createdAt, live.createdAt);
    assert.equal(held.details.stale, false);
    assert.match(held.hint!, /do not delete/);
    // A pid beyond the kernel's limit cannot be running on this host.
    await fs.writeFile(lock, JSON.stringify({ ...live, pid: 2 ** 31 - 2 }));
    const stale = await failure(add, { cwd });
    assert.equal(stale.details.stale, true);
    assert.match(stale.hint!, /stale/);
    assert.ok(await fs.stat(lock), 'a stale lock is reported, never removed automatically');
    await fs.writeFile(lock, JSON.stringify({ ...live, hostname: 'elsewhere', pid: 2 ** 31 - 2 }));
    assert.equal((await failure(add, { cwd })).details.stale, false, 'other hosts are unknown');
    await fs.rm(lock);
    assert.equal((await ok(add, { cwd })).revision, 1);
    assert.deepEqual(
      (await fs.readdir(cwd)).sort(),
      ['crate.model.json', 'crate.model.json.history'],
      'the writer released its own lock',
    );
  }));

test('a writer never creates directories before its checks and never removes a replaced lock', () =>
  withTemp(async (cwd) => {
    const missing = ['-d', 'missing/dir/crate.model.json', 'add', 'box', 'b'];
    assert.equal((await failure(missing, { cwd })).code, 'DOCUMENT_NOT_FOUND');
    await assert.rejects(fs.stat(path.join(cwd, 'missing')), 'no directory was created');
    const file = path.join(cwd, 'crate.model.json');
    const foreign = JSON.stringify({ pid: 1, token: 'someone-else' });
    await withFileLock(file, async () => {
      // An operator removed this lock and another writer took it while the action ran.
      await fs.rm(`${file}.lock`);
      await fs.writeFile(`${file}.lock`, foreign);
    });
    assert.equal(await fs.readFile(`${file}.lock`, 'utf8'), foreign);
  }));
