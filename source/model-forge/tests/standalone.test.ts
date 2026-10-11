import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { ForgeError } from '../src/kernel/index.js';
import { readAsset } from '../src/infra/assets.js';
import { withTemp } from './helpers.js';

const run = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '..');
/** Child environment that cannot reach a module directory through NODE_PATH. */
function withoutNodePath() {
  const environment = { ...process.env };
  delete environment.NODE_PATH;
  return environment;
}

test('source runs read example assets from the examples directory', async () => {
  const index = JSON.parse(await readAsset('examples/index.json'));
  assert.ok(index.some((entry: { kind: string }) => entry.kind === 'model-bundle'));
  await assert.rejects(
    readAsset('examples/missing.json'),
    (error: unknown) => error instanceof ForgeError && error.code === 'BUILD_REQUIRED',
  );
});

test('the standalone executable is deterministic and runs without node_modules', () =>
  withTemp(async (temp) => {
    const { buildStandalone } = await import('../scripts/standalone.mjs');
    const [first, second] = [await buildStandalone(), await buildStandalone()];
    assert.ok(first.equals(second), 'two builds must be byte-identical');
    const text = first.toString('utf8');
    assert.ok(text.startsWith('#!/usr/bin/env node\n/*!'));
    assert.match(text, /three@[\d.]+ \(MIT\)/);
    assert.match(text, /commander@[\d.]+ \(MIT\)/);
    assert.doesNotMatch(text, new RegExp(projectRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(text, /sourceMappingURL/);
    assert.doesNotMatch(text, /require\("playwright-core\/lib/, 'Playwright stays external');
    const executable = path.join(temp, 'model-forge');
    await fs.writeFile(executable, first, { mode: 0o755 });
    const cli = async (...args: string[]) =>
      (await run(process.execPath, [executable, ...args], { cwd: temp, env: withoutNodePath() }))
        .stdout;
    assert.match(await cli('--version'), /^\d+\.\d+\.\d+\n$/);
    const help = await cli('--help');
    assert.match(help, /Usage: model-forge/);
    assert.match(help, /source\/model-forge\/README\.md/);
    const discover = JSON.parse(await cli('--compact', 'discover'));
    assert.equal(discover.data.tool, 'model-forge');
    const examples = JSON.parse(await cli('--compact', 'example', 'list')).data;
    assert.ok(examples.length >= 4);
    const created = JSON.parse(
      await cli('--compact', 'example', 'create', 'petAdultBloom', 'bloom.model-bundle.json'),
    ).data;
    assert.equal(created.nextCommands[0][0], 'model-forge');
    await cli('-d', 'bloom.model-bundle.json', 'export', '--validate', '--out', 'bloom.glb');
    assert.equal(
      (await fs.readFile(path.join(temp, 'bloom.glb'))).subarray(0, 4).toString(),
      'glTF',
    );
    await cli('-d', 'bloom.model-bundle.json', 'preview', '--out', 'bloom.html');
    const html = await fs.readFile(path.join(temp, 'bloom.html'), 'utf8');
    assert.match(html, /window\.__MODEL_FORGE__=/);
    assert.match(html, /Bundled Three\.js license/, 'the preview page script is embedded');
    await assert.rejects(
      run(process.execPath, [executable, '-d', 'missing.model.json', 'inspect'], {
        cwd: temp,
        env: withoutNodePath(),
      }),
      (error: { code: number; stderr: string }) =>
        error.code === 1 && JSON.parse(error.stderr).error.code === 'DOCUMENT_NOT_FOUND',
    );
  }));

test('the checked-in bin/model-forge is current and executable', async () => {
  const { buildStandalone, checkedIn } = await import('../scripts/standalone.mjs');
  const current = await fs.readFile(checkedIn);
  assert.ok((await buildStandalone()).equals(current), 'run npm run build:cli');
  assert.ok(((await fs.stat(checkedIn)).mode & 0o111) !== 0);
});
