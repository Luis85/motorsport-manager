import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Script } from 'node:vm';

const executable = resolve(import.meta.dirname, '../../../bin/character-studio');
async function command(args: string[], input?: unknown, cwd?: string): Promise<any> {
  const result = await new Promise<{stdout: string; stderr: string; status: number | null}>((accept, reject) => {
    const child = spawn(process.execPath, [executable, ...args], {cwd, stdio: ['pipe', 'pipe', 'pipe']});
    let stdout = '', stderr = '';
    const timeout = setTimeout(() => { child.kill(); reject(new Error('CLI command timed out.')); }, 15000);
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('close', status => { clearTimeout(timeout); accept({stdout, stderr, status}); });
    child.stdin.end(input === undefined ? undefined : JSON.stringify(input));
  });
  assert.equal(result.stderr, '', result.stderr);
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.length, 1, 'one machine JSON result per command');
  return {status: result.status, ...JSON.parse(lines[0])};
}
const guard = (value: any) => ['--expected-revision', String(value.revision), '--expected-state', value.stateHash];

test('bundled CLI supports guarded dry-run, atomic edit, conflict, history, roundtrip and engine exports', async () => {
  const project = await mkdtemp(join(tmpdir(), 'character-cli-'));
  try {
    const identity = ['--project', project, '--id', 'moss'];
    const created = (await command(['create', ...identity, '--name', 'Moss', '--preset', 'fern'], undefined, project));
    assert.equal(created.status, 0);
    assert.equal(created.revision, 1);
    assert.equal(created.character.identity.name, 'Moss');
    assert.equal((await command(['create', ...identity])).status, 3);
    const batch = {operations: [{op: 'set', path: '/appearance/coat', value: '#99aa77'}, {op: 'add', path: '/skills/building', value: 4}]};
    // Resolve a real game skill from discovery instead of inventing a capability.
    const skill = (await command(['catalog'])).catalog.skills[0].id;
    batch.operations[1].path = `/skills/${skill}`;
    const preview = (await command(['apply', ...identity, '--file', '-', ...guard(created), '--dry-run'], batch));
    assert.equal(preview.status, 0);
    assert.equal(preview.dryRun, true);
    assert.equal(preview.revision, created.revision);
    assert.equal(preview.stateHash, created.stateHash);
    assert.equal(preview.proposedRevision, 2);
    assert.deepEqual((await command(['inspect', ...identity])).character, created.character);
    const changed = (await command(['apply', ...identity, '--file', '-', ...guard(created)], batch));
    assert.equal(changed.revision, 2);
    assert.equal(changed.stateHash, preview.proposedStateHash);
    assert.equal(changed.character.skills[skill], 4);
    assert.equal((await command(['apply', ...identity, '--file', '-', ...guard(created)], batch)).status, 3);
    const invalid = {operations: [{op: 'set', path: '/identity/name', value: 'Mutated'}, {op: 'set', path: '/appearance/coat', value: 'bad'}]};
    assert.equal((await command(['apply', ...identity, '--file', '-', ...guard(changed)], invalid)).status, 1);
    assert.deepEqual((await command(['inspect', ...identity])).character, changed.character);
    const history = (await command(['history', ...identity]));
    assert.equal(history.undo, 1);
    const undo = (await command(['undo', ...identity, ...guard(changed)]));
    assert.deepEqual(undo.character, created.character);
    const redo = (await command(['redo', ...identity, ...guard(undo)]));
    assert.deepEqual(redo.character, changed.character);
    const compiled = (await command(['export', ...identity, '--format', 'package']));
    assert.equal(compiled.value.format, 'littlewild-creature-package');
    assert.equal(compiled.value.gameplayDefinition.id, 'moss');
    assert.equal(compiled.value.gameplayDefinition.state.defaults.rpg.points[skill], 4);
    const definition = (await command(['export', ...identity, '--format', 'definition']));
    assert.equal(definition.value.family, 'creatures');
    const path = join(project, 'moss.package.json');
    assert.equal((await command(['export', ...identity, '--format', 'package', '--out', path])).status, 0);
    assert.equal((await command(['export', ...identity, '--format', 'package', '--out', path])).status, 3);
    const imported = (await command(['import', '--project', project, '--file', path, '--id', 'moss-copy']));
    assert.equal(imported.status, 0);
    assert.deepEqual({...imported.character, id: 'moss'}, redo.character);
    const readyRecipe = {...redo.character, status: 'ready'};
    const importedReady = await command(['import', '--project', project, '--file', '-', '--id', 'ready-copy'], readyRecipe);
    assert.equal(importedReady.character.status, 'draft');
    assert.deepEqual({...importedReady.character, id: 'moss', status: 'ready'}, readyRecipe);
    assert.equal((await command(['validate', ...identity])).valid, true);
    assert.equal((await command(['list', '--project', project])).characters.length, 3);
    const html = join(project, 'preview.html');
    assert.equal((await command(['preview', ...identity, '--out', html, '--mode', 'world', '--pose', 'walk'])).status, 0);
    const previewHtml = await readFile(html, 'utf8');
    for (const script of previewHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Script(script[1]);
    assert.match(previewHtml, /Moss/);
    assert.match(previewHtml, /"preview":\{"mode":"world","light":"studio","pose":"walk","camera":"front"\}/);
  } finally { await rm(project, {recursive: true, force: true}); }
});

test('strict machine discovery and errors reject typos, unsafe paths and malformed input', async () => {
  const discover = (await command(['discover']));
  for (const [name, descriptor] of Object.entries(discover.commands) as [string, any][]) {
    assert.equal((await command(['describe', '--command', name])).description, descriptor.description);
  }
  assert.equal((await command(['schema', '--kind', 'batch'])).schema.properties.operations.maxItems, 256);
  assert.equal((await command(['schema', '--kind', 'character'])).schema.properties.format.const, 'littlewild-character');
  assert.equal((await command(['schema', '--kind', 'review'])).schema.properties.views.maxItems, 12);
  assert.equal((await command(['wat'])).status, 2);
  assert.equal((await command(['create', '--project', '/tmp', '--id', 'test', '--presett', 'pip'])).status, 2);
  assert.equal((await command(['serve', '--project', '/tmp', '--port', '1e2'])).status, 2);
  assert.equal((await command(['capture', '--project', '/tmp', '--id', 'test', '--out', '/tmp/test.png', '--width', '9000'])).status, 2);
  assert.equal((await command(['preview', '--project', '/tmp', '--id', 'test', '--out', '/tmp/test.html', '--pose', 'invented'])).status, 2);
  assert.equal((await command(['describe', '--command', '__proto__'])).status, 2);
  const project = await mkdtemp(join(tmpdir(), 'character-errors-'));
  try {
    assert.equal((await command(['create', '--project', project, '--id', '../escape'])).status, 1);
    const created = (await command(['create', '--project', project, '--id', 'safe']));
    const args = ['apply', '--project', project, '--id', 'safe', '--file', '-', ...guard(created)];
    assert.equal((await command(args, {operations: [{op: 'set', path: '/__proto__/polluted', value: true}]})).status, 1);
    assert.equal((await command(args, {operations: [{op: 'set', path: '/id', value: 'other'}]})).status, 1);
    assert.equal((await command(args, {operations: [], unexpected: true})).status, 1);
    const invalidFile = join(project, 'invalid.json');
    await writeFile(invalidFile, '{no');
    assert.equal((await command(['validate', '--file', invalidFile])).error.code, 'INVALID_JSON');
    assert.equal((await command(['validate', '--file', invalidFile, '--id', 'safe'])).status, 2);
  } finally { await rm(project, {recursive: true, force: true}); }
});
