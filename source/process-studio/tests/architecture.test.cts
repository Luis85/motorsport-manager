/** The architecture rules pass on the project and catch each kind of violation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import type {Metafile} from 'esbuild';
import {architectureErrors, importErrors, ruleErrors, toolchainErrors} from '../scripts/architecture.cjs';
import {closureErrors} from '../scripts/bundle.cjs';
import {CLOSURE} from '../scripts/bridge.cjs';
import {codeLines} from '../scripts/source-scan.cjs';

const fixture = (require('./fixtures/architecture.json') as Record<string, string>);
const first = (errors: string[]): string => errors[0] ?? '';

test('the project passes every rule', async () => {
 assert.deepEqual(await architectureErrors(), []);
});

test('only the bridge reaches Wildlands, and src/ imports no packages or scripts', () => {
 assert.deepEqual(importErrors('src/kernel.cts', fixture.bridge!), []);
 assert.match(first(importErrors('src/io.cts', fixture.bypass!)), /only src\/kernel\.cts/);
 assert.match(first(importErrors('src/io.cts', fixture.reference!)), /only src\/kernel\.cts/);
 assert.match(first(importErrors('tests/a.test.cts', fixture.require!)), /only src\/kernel\.cts/);
 assert.match(first(importErrors('src/io.cts', fixture.package!)), /src\/ may import only/);
 assert.match(first(importErrors('src/io.cts', fixture.script!)), /src\/ may import only/);
 assert.deepEqual(importErrors('src/io.cts', fixture.commented!), []);
});

test('budgets count code lines only, and Math.random and Date are refused', () => {
 const code = (count: number) => Array.from({length: count}, (_, i) => `const v${i} = ${i};`).join('\n') + '\n';
 assert.match(ruleErrors('src/a.cts', code(401))[0]!, /401 code lines, over the budget of 400/);
 assert.deepEqual(ruleErrors('src/a.cts', code(400)), []);
 assert.deepEqual(ruleErrors('tests/a.test.cts', code(450)), []);
 assert.deepEqual(ruleErrors('src/a.cts', code(10) + '/*\n' + '\n'.repeat(500) + '*/\n' + '// x\n'.repeat(500)), []);
 assert.equal(codeLines('const a = `x\n// still template\n${b}`;\n// comment\n'), 3);
 assert.ok(first(ruleErrors('src/a.cts', fixture.random!)).includes('Math.random is not allowed'));
 assert.ok(first(ruleErrors('scripts/a.cts', fixture.clock!)).includes('reads no clock'));
 assert.deepEqual(ruleErrors('src/a.cts', fixture.quoted!), []);
});

test('the closure check refuses unlisted Wildlands files, packages, bypasses and stale entries', () => {
 const inputs: Record<string, {bytes: number; imports: {path: string; kind: 'require-call'; original: string}[]}> = {};
 for (const file of CLOSURE.slice(1)) inputs['../wildlands/source/' + file] = {bytes: 1, imports: []};
 inputs['../wildlands/source/process-ui.ts'] = {bytes: 1, imports: []};
 inputs['node_modules/pako/index.js'] = {bytes: 1, imports: []};
 inputs['src/io.cts'] = {bytes: 1, imports: [{path: '../wildlands/source/ecs.ts', kind: 'require-call', original: '../../wildlands/source/ecs.js'}]};
 const errors = closureErrors({inputs, outputs: {}} as unknown as Metafile);
 assert.equal(errors.length, 4, errors.join('\n'));
 assert.match(errors[0]!, /process-ui\.ts is not in the bridge closure allowlist/);
 assert.match(errors[1]!, /node_modules\/pako/);
 assert.match(errors[2]!, /src\/io\.cts imports/);
 assert.match(errors[3]!, /Stale bridge closure entry process-sdk\.cts/);
});

test('devDependencies are exact and locked to Wildlands\' versions', () => {
 assert.deepEqual(toolchainErrors(), []);
});
