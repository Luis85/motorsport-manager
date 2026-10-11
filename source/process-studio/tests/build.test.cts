/** `process build` parity: every agency demo definition builds byte-identical HTML to `bin/wildlands process build`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {agencyDefinitions, candidate, executeJson, REPOSITORY, temporaryDirectory, WILDLANDS_BIN} from './support.cjs';
import {buildHtml} from '../src/assemble.cjs';
import {distribution} from '../src/kit.cjs';
import {engineKitOf} from '../src/kit-source.cjs';

const engineMeta = (html: string): string | undefined => /<meta name="wildlands-engine" content="([0-9a-f]{64})">/.exec(html)?.[1];

test('the embedded engine identity is bin/wildlands\' engine kit and the demos\' engine', async () => {
 const {file, result} = await candidate(), version = executeJson(file, ['version'], temporaryDirectory('process-studio-engine-')).json;
 const kit = engineKitOf(fs.readFileSync(WILDLANDS_BIN, 'utf8'));
 assert.equal(version.engine, kit.identity);
 assert.equal(result.engine, kit.identity);
 const demos = JSON.parse(fs.readFileSync(path.join(REPOSITORY, 'demos/manifest.json'), 'utf8')) as {engine: string};
 assert.equal(kit.identity, demos.engine, 'bin/wildlands and demos/ disagree on the engine; rebuild Wildlands first');
});

test('every agency definition and a starter build byte-identical HTML', async () => {
 const {file} = await candidate(), directory = temporaryDirectory('process-studio-build-');
 assert.equal(executeJson(file, ['create', '--id', 'starter', '--output', 'starter.json'], directory).status, 0);
 const inputs = [...agencyDefinitions(), ['starter', path.join(directory, 'starter.json')] as const];
 assert.equal(inputs.length, 8);
 for (const [id, input] of inputs) {
  const own = executeJson(file, ['build', '--input', input, '--output', id + '.html'], directory);
  const reference = executeJson(WILDLANDS_BIN, ['process', 'build', '--input', input, '--output', id + '-wildlands.html'], directory);
  assert.equal(own.status, 0, id);
  const html = fs.readFileSync(path.join(directory, id + '.html'));
  assert.ok(html.equals(fs.readFileSync(path.join(directory, id + '-wildlands.html'))), `${id}: HTML differs from bin/wildlands process build`);
  assert.deepEqual({...own.json, output: null}, {...reference.json, output: null}, id);
  assert.equal(engineMeta(html.toString('utf8')), distribution().kit().engine);
 }
});

test('the checkout extracts the same kit slice the bundle embeds', async () => {
 const {file} = await candidate(), directory = temporaryDirectory('process-studio-checkout-');
 const input = agencyDefinitions().get('order-fulfilment')!;
 executeJson(file, ['build', '--input', input, '--output', 'bundle.html'], directory);
 const html = buildHtml(JSON.parse(fs.readFileSync(input, 'utf8')), distribution().kit()).html;
 assert.equal(distribution().kind, 'checkout');
 assert.equal(html, fs.readFileSync(path.join(directory, 'bundle.html'), 'utf8'));
});
