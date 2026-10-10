/** CLI contract of the bundled candidate: global options, usage errors before any read, exit codes, output guards. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {candidate, execute, executeJson, REPOSITORY, temporaryDirectory} from './support.cjs';

const usage = async (args: readonly string[], message: string | RegExp): Promise<void> => {
 const {file} = await candidate(), directory = temporaryDirectory('process-studio-usage-');
 const outcome = executeJson(file, args, directory);
 assert.equal(outcome.status, 2, args.join(' '));
 assert.equal(outcome.json.ok, false);
 assert.equal(outcome.json.code, 'process-operation-failed');
 const errors = outcome.json.errors as string[];
 assert.equal(errors.length, 1);
 if (typeof message === 'string') assert.equal(errors[0], message); else assert.match(errors[0]!, message);
 // Usage errors come before any file is read or written: the missing input is never mentioned and nothing appears.
 assert.doesNotMatch(errors[0]!, /missing\.json|ENOENT|regular JSON file/);
 assert.deepEqual(fs.readdirSync(directory), []);
};

test('version, --version and --compact', async () => {
 const {file, result} = await candidate(), directory = temporaryDirectory('process-studio-version-');
 const version = executeJson(file, ['version'], directory), flag = executeJson(file, ['--version'], directory);
 assert.equal(version.status, 0);
 assert.deepEqual(version.json, flag.json);
 assert.equal(version.json.name, 'process-studio');
 assert.deepEqual(version.json.kernel, {format: 'wildlands-process', schemaVersion: 1});
 assert.equal(version.json.engine, result.engine);
 assert.equal(version.json.distribution, 'bundle');
 assert.equal(version.json.sourceIdentity, result.sourceIdentity);
 const compact = execute(file, ['--compact', '--version'], directory);
 assert.equal(compact.stdout, JSON.stringify(version.json) + '\n');
 assert.equal(execute(file, ['discover', '--compact'], directory).stdout.split('\n').length, 2);
 await usage(['version', '--input', 'missing.json'], 'version takes no options: --input');
 await usage(['--compact', 'discover', '--compact'], 'Unknown or duplicate option: --compact');
});

test('no arguments, --help and -h print discover with the Process Studio fields', async () => {
 const {file} = await candidate(), directory = temporaryDirectory('process-studio-help-');
 const discover = executeJson(file, ['discover'], directory).json;
 for (const args of [[], ['--help'], ['-h']]) assert.deepEqual(executeJson(file, args, directory).json, discover);
 const tool = discover.tool as {name: string; handbook: string};
 assert.equal(tool.name, 'process-studio');
 assert.equal(tool.handbook, 'docs/reference/process-studio-cli.md');
 assert.ok(fs.statSync(path.join(REPOSITORY, tool.handbook)).isFile(), `the discover handbook ${tool.handbook} exists`);
 assert.deepEqual((discover.toolOperations as {id: string}[]).map(entry => entry.id), ['version', 'doctor']);
 assert.deepEqual((discover.globalOptions as {id: string}[]).map(entry => entry.id), ['--compact']);
});

test('doctor reports every check without a Wildlands CLI', async () => {
 const {file} = await candidate(), directory = temporaryDirectory('process-studio-doctor-');
 const doctor = executeJson(file, ['doctor'], directory);
 assert.equal(doctor.status, 0);
 const checks = doctor.json.checks as {id: string; ok: boolean; detail: Record<string, unknown>}[];
 assert.deepEqual(checks.map(entry => [entry.id, entry.ok]), [['node', true], ['kernel', true], ['engine-kit', true], ['build', true]]);
 assert.equal(checks[3]!.detail.wildlandsRequired, false);
});

test('usage errors exit 2 before any file is read', async () => {
 await usage(['nope'], 'Unknown process command; use process-studio discover.');
 await usage(['validate', '--input', 'missing.json', '--bogus', '1'], 'Unknown or duplicate option: --bogus');
 await usage(['validate', '--input', 'missing.json', '--input', 'other.json'], 'Unknown or duplicate option: --input');
 await usage(['validate', '--input'], 'Missing value for --input');
 await usage(['run', '--input', 'missing.json', '--minutes', '--output'], 'Missing value for --minutes');
 await usage(['run', '--input', 'missing.json', '--minutes', '10'], 'Missing --output');
 await usage(['run', '--input', 'missing.json', '--minutes', '10', '--output', 'r.json', '--seed', '1.5'], '--seed must be a whole number.');
 await usage(['run', '--input', 'missing.json', '--minutes', '10', '--output', 'r.json', '--seed', '2147483648'], '--seed must be from 0 to 2147483647.');
 await usage(['run', '--input', 'missing.json', '--minutes', '0', '--output', 'r.json'], /^--minutes must be a whole number from 1 to \d+\.$/);
 await usage(['run', '--input', 'missing.json', '--minutes', '10', '--output', 'r.json', '--format', 'xes'], /needs --event-log/);
 await usage(['run', '--input', 'missing.json', '--minutes', '10', '--output', 'r.json', '--event-log', 'e', '--format', 'tsv'],
  '--format must be csv or xes on run.');
 await usage(['run', '--input', 'missing.json', '--minutes', '10', '--output', 'r.json', '--event-log', 'missing.json'], /must not be the input or the report/);
 await usage(['schema', '--kind', 'other'], '--kind must be definition or recipe.');
 await usage(['slides', '--input', 'missing.json', '--format', 'pdf'], '--format must be json or md.');
 await usage(['slides', '--input', 'missing.json', '--seed', '3'], '--seed needs --minutes (live facts come from one bounded run).');
 await usage(['edit', '--input', 'missing.json', '--recipe', 'r.json', '--dry-run', '--output', 'x.json'], 'Dry run does not accept --output.');
 await usage(['edit', '--input', 'missing.json', '--recipe', 'r.json'], 'Missing --output (or use --dry-run).');
 await usage(['attach', '--input', 'missing.json', '--asset', 'a.json', '--step', 's', '--expected-revision', 'x', '--expected-fingerprint', 'f', '--dry-run'],
  '--expected-revision must be a whole number.');
 await usage(['replicate', '--input', 'missing.json', '--minutes', '10', '--runs', '0'], /^--runs must be a whole number from 1 to \d+\.$/);
 await usage(['replicate', '--input', 'missing.json', '--minutes', '10', '--runs', '2', '--warmup', '10'], /^--warmup must be a whole number of minutes/);
 await usage(['compare', '--input', 'missing.json', '--minutes', '10', '--runs', '2'], 'Missing --against');
 await usage(['import-bpmn', '--input', 'missing.bpmn', '--output', 'x.json', '--lanes', 'sideways'], /lanes/);
});

test('outputs never replace an input, also through hard and symbolic links', async () => {
 const {file} = await candidate(), directory = temporaryDirectory('process-studio-alias-');
 assert.equal(executeJson(file, ['create', '--id', 'alias', '--output', 'alias.json'], directory).status, 0);
 const original = fs.readFileSync(path.join(directory, 'alias.json'));
 fs.linkSync(path.join(directory, 'alias.json'), path.join(directory, 'hard.json'));
 fs.symlinkSync(path.join(directory, 'alias.json'), path.join(directory, 'soft.json'));
 for (const target of ['alias.json', 'hard.json', 'soft.json', './alias.json']) {
  const outcome = executeJson(file, ['run', '--input', 'alias.json', '--minutes', '5', '--output', target], directory);
  assert.equal(outcome.status, 2, target);
  assert.match((outcome.json.errors as string[])[0]!, /Output must not overwrite an input file/);
  assert.equal(executeJson(file, ['export-bpmn', '--input', 'soft.json', '--output', 'alias.xml'], directory).status, 0);
 }
 assert.equal(executeJson(file, ['slides', '--input', 'alias.json', '--format', 'md', '--output', 'hard.json'], directory).status, 2);
 assert.ok(fs.readFileSync(path.join(directory, 'alias.json')).equals(original));
 // Failed and successful writes leave no temporary files behind.
 assert.deepEqual(fs.readdirSync(directory).filter(name => name.endsWith('.tmp')), []);
});

test('negative results keep their exit codes and codes', async () => {
 const {file} = await candidate(), directory = temporaryDirectory('process-studio-negative-');
 fs.writeFileSync(path.join(directory, 'bad.json'), JSON.stringify({format: 'wildlands-process'}));
 const invalid = executeJson(file, ['validate', '--input', 'bad.json'], directory);
 assert.equal(invalid.status, 1);
 assert.equal(invalid.json.ok, false);
 assert.equal(invalid.json.code, undefined);
 const bpmn = '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"><process id="p"><task/></process></definitions>';
 fs.writeFileSync(path.join(directory, 'bad.bpmn'), bpmn);
 const nonconforming = executeJson(file, ['validate-bpmn', '--input', 'bad.bpmn'], directory);
 assert.equal(nonconforming.status, 2);
 assert.equal(nonconforming.json.code, 'process-bpmn-nonconforming');
 const unreadable = executeJson(file, ['inspect', '--input', 'missing.json'], directory);
 assert.equal(unreadable.status, 2);
 assert.equal(unreadable.json.code, 'process-operation-failed');
 assert.equal(executeJson(file, ['create', '--id', 'p', '--output', 'p.json'], directory).status, 0);
 fs.mkdirSync(path.join(directory, 'existing'));
 const forge = executeJson(file, ['forge', '--input', 'p.json', '--output', 'existing'], directory);
 assert.equal(forge.status, 2);
 assert.match((forge.json.errors as string[])[0]!, /Choose a new Scene Forge directory/);
 assert.equal(executeJson(file, ['build', '--input', 'p.json', '--output', 'p.htm'], directory).status, 2);
 const markdown = execute(file, ['slides', '--input', 'p.json', '--format', 'md'], directory);
 assert.equal(markdown.status, 0);
 assert.match(markdown.stdout, /^# /);
});
