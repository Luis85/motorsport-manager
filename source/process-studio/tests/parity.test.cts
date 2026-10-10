/**
 * Parity with the checked-in `bin/wildlands process`, driven by its own `discover`: the command surface, the coverage
 * of the corpus and, for every case, the exit code, the printed result and every written file byte for byte.
 *
 * Documented differences: `discover` adds `tool`, `toolOperations` and `globalOptions`; an unknown command names
 * `process-studio discover` instead of `wildlands process discover`. Nothing else may differ.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {candidate, execute, executeJson, temporaryDirectory, tree, WILDLANDS_BIN} from './support.cjs';
import {cases, prepare} from './parity-cases.cjs';

interface Operation {readonly id: string; readonly options: readonly string[]; readonly description: string;}
export const STUDIO_ONLY = ['tool', 'toolOperations', 'globalOptions'] as const;

const scratch = temporaryDirectory('process-studio-discover-');
const wildlands = executeJson(WILDLANDS_BIN, ['process', 'discover'], scratch).json;
const operations = wildlands.operations as Operation[];

/** Process Studio's result with its documented additions removed. */
function withoutAdditions(value: Record<string, unknown>): Record<string, unknown> {
 if (value.format !== 'wildlands-process' || !Array.isArray(value.operations)) return value;
 return Object.fromEntries(Object.entries(value).filter(([key]) => !(STUDIO_ONLY as readonly string[]).includes(key)));
}

test('every bin/wildlands process subcommand exists in process-studio with identical options and description', async () => {
 const {file} = await candidate(), studio = executeJson(file, ['discover'], scratch).json, own = studio.operations as Operation[];
 const missing = operations.filter(operation => !own.some(entry => entry.id === operation.id)).map(operation => operation.id);
 assert.deepEqual(missing, [], `bin/wildlands process exposes ${missing.join(', ')}, which process-studio lacks: add the options to src/options.cts, `
  + 'a handler to src/cli.cts and parity cases to tests/parity-cases.cts (then npm run build:cli).');
 const changed = operations.filter(operation => JSON.stringify(own.find(entry => entry.id === operation.id)) !== JSON.stringify(operation))
  .map(operation => operation.id);
 assert.deepEqual(changed, [], `process-studio options or descriptions differ from bin/wildlands process for: ${changed.join(', ')} (src/options.cts).`);
 const extra = own.filter(entry => !operations.some(operation => operation.id === entry.id)).map(entry => entry.id);
 assert.deepEqual(extra, [], `process-studio lists process subcommands bin/wildlands lacks: ${extra.join(', ')}.`);
 assert.deepEqual(withoutAdditions(studio), wildlands, 'discover differs beyond the documented tool, toolOperations and globalOptions fields');
});

test('every bin/wildlands process subcommand has a parity case', () => {
 const covered = new Set(cases((prepare(scratch), scratch)).map(([operation]) => operation));
 const uncovered = operations.map(operation => operation.id).filter(id => !covered.has(id));
 assert.deepEqual(uncovered, [], `No parity case covers ${uncovered.join(', ')}: add cases to tests/parity-cases.cts.`);
});

test('unknown commands differ only in the named discover command', async () => {
 const {file} = await candidate(), studio = executeJson(file, ['no-such-command'], scratch);
 const reference = executeJson(WILDLANDS_BIN, ['process', 'no-such-command'], scratch);
 assert.equal(studio.status, reference.status);
 assert.deepEqual(studio.json, {...reference.json, errors: ['Unknown process command; use process-studio discover.']});
});

test('the corpus gives identical exit codes, results and written files', async () => {
 const {file} = await candidate(), root = temporaryDirectory('process-studio-parity-'), work = path.join(root, 'work');
 // Both runs use the same working directory path, so absolute paths in results and files agree byte for byte.
 const runAll = (entry: string, prefix: readonly string[], keep: string) => {
  fs.mkdirSync(work);
  prepare(work);
  const outcomes = cases(work).map(([operation, args]) => ({operation, args, ...execute(entry, [...prefix, ...args], work)}));
  fs.renameSync(work, path.join(root, keep));
  return outcomes;
 };
 const reference = runAll(WILDLANDS_BIN, ['process'], 'wildlands'), studio = runAll(file, [], 'studio');
 assert.equal(studio.length, reference.length);
 reference.forEach((expected, index) => {
  const actual = studio[index]!, label = expected.args.join(' ');
  assert.equal(actual.stderr, '', label);
  assert.equal(expected.stderr, '', label);
  assert.equal(actual.status, expected.status, label);
  if (expected.stdout.startsWith('{')) {
   assert.deepEqual(withoutAdditions(JSON.parse(actual.stdout) as Record<string, unknown>), JSON.parse(expected.stdout), label);
  }
  else assert.equal(actual.stdout, expected.stdout, label);
 });
 const written = tree(path.join(root, 'wildlands')), own = tree(path.join(root, 'studio'));
 assert.deepEqual([...own.keys()], [...written.keys()], 'process-studio wrote a different set of files');
 const different = [...written].filter(([name, bytes]) => !own.get(name)!.equals(bytes)).map(([name]) => name);
 assert.deepEqual(different, [], 'written files differ from bin/wildlands process');
 assert.ok(written.size > 40, `the corpus wrote only ${written.size} files`);
});
