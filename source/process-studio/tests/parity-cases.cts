/**
 * The parity corpus: process commands run in order, in one working directory, by `bin/wildlands process` and by
 * bin/process-studio. Every subcommand `bin/wildlands process discover` lists needs at least one case
 * (tests/parity.test.cts fails naming the uncovered one). Later cases may read files earlier cases wrote.
 */
import fs from 'node:fs';
import path from 'node:path';
import {authoring, catalog} from '../src/kernel.cjs';
import {AGENCY, BPMN_EXAMPLES} from './support.cjs';

/** One invocation: the subcommand it covers and its arguments (without the `process` prefix). */
export type Case = readonly [operation: string, args: readonly string[]];

/** Inputs both runs start from: two demo definitions, a starter, a bad definition, recipes, assets and BPMN files. */
export function prepare(directory: string): void {
 const write = (name: string, value: unknown) =>
  fs.writeFileSync(path.join(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
 for (const name of ['agency.process.json', 'loan-application.process.json']) fs.copyFileSync(path.join(AGENCY, name), path.join(directory, name));
 for (const name of ['loan-application.bpmn', 'support-ticket.bpmn']) fs.copyFileSync(path.join(BPMN_EXAMPLES, name), path.join(directory, name));
 const agency = catalog.admit(JSON.parse(fs.readFileSync(path.join(AGENCY, 'agency.process.json'), 'utf8')));
 const starter = authoring.create('starter', 'Starter'), asset = agency.steps.find(step => step.scene.asset)!.scene.asset;
 write('starter.json', starter);
 write('bad.json', {format: 'wildlands-process', schemaVersion: 1, id: 'bad'});
 write('bad.bpmn', '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"><process id="p"><task/></process></definitions>');
 write('asset.json', asset);
 write('visual.json', {visual: asset});
 write('rename.recipe.json', {expectedRevision: agency.revision, expectedFingerprint: catalog.fingerprint(agency),
  operations: [{op: 'rename', value: 'Renamed agency'}]});
 const resource = agency.resources[0]!;
 write('capacity.recipe.json', {expectedRevision: agency.revision, expectedFingerprint: catalog.fingerprint(agency),
  operations: [{op: 'putResource', value: {...resource, capacity: resource.capacity + 1}}]});
 write('starter-guard.json', {revision: starter.revision, fingerprint: catalog.fingerprint(starter)});
}

/** Revision and fingerprint guards of the prepared starter, for `attach`. */
export function starterGuards(directory: string): [string, string] {
 const guard = JSON.parse(fs.readFileSync(path.join(directory, 'starter-guard.json'), 'utf8')) as {revision: number; fingerprint: string};
 return [String(guard.revision), guard.fingerprint];
}

export function cases(directory: string): Case[] {
 const [revision, fingerprint] = starterGuards(directory);
 const starterStep = (JSON.parse(fs.readFileSync(path.join(directory, 'starter.json'), 'utf8')) as LWProcess.Definition).steps[0]!.id;
 const attach = ['--input', 'starter.json', '--step', starterStep, '--expected-revision', revision, '--expected-fingerprint', fingerprint];
 const run = ['--minutes', '600', '--seed', '7'];
 return [
  ['discover', ['discover']], ['discover', []], ['discover', ['--help']],
  ['schema', ['schema']], ['schema', ['schema', '--kind', 'recipe']],
  ['create', ['create', '--id', 'created', '--name', 'Created', '--output', 'created.json']], ['create', ['create', '--id', 'Bad id', '--output', 'x.json']],
  ['validate', ['validate', '--input', 'agency.process.json']], ['validate', ['validate', '--input', 'loan-application.process.json', '--draft']],
  ['validate', ['validate', '--input', 'bad.json']], ['validate', ['validate', '--input', 'missing.json']],
  ['inspect', ['inspect', '--input', 'agency.process.json']], ['inspect', ['inspect', '--input', 'starter.json']],
  ['edit', ['edit', '--input', 'agency.process.json', '--recipe', 'rename.recipe.json', '--dry-run']],
  ['edit', ['edit', '--input', 'agency.process.json', '--recipe', 'capacity.recipe.json', '--output', 'agency-edited.json']],
  ['edit', ['edit', '--input', 'agency-edited.json', '--recipe', 'capacity.recipe.json', '--output', 'stale.json']],
  ['attach', ['attach', ...attach, '--asset', 'asset.json', '--dry-run']],
  ['attach', ['attach', ...attach, '--asset', 'visual.json', '--output', 'attached.json']],
  ['attach', ['attach', ...attach.map(value => value === starterStep ? 'nope' : value), '--asset', 'asset.json', '--dry-run']],
  ['run', ['run', '--input', 'agency.process.json', ...run, '--output', 'run.json']],
  ['run', ['run', '--input', 'agency.process.json', ...run, '--output', 'run-csv.json', '--event-log', 'events.csv']],
  ['run', ['run', '--input', 'agency.process.json', ...run, '--output', 'run-xes.json', '--event-log', 'events.xes', '--format', 'xes']],
  ['run', ['run', '--input', 'loan-application.process.json', '--minutes', '900', '--output', 'loan-run.json']],
  ['replicate', ['replicate', '--input', 'agency.process.json', ...run, '--runs', '3']],
  ['replicate', ['replicate', '--input', 'loan-application.process.json', ...run, '--runs', '3', '--warmup', '100', '--output', 'replicate.json']],
  ['compare', ['compare', '--input', 'agency-edited.json', '--against', 'agency.process.json', ...run, '--runs', '3']],
  ['compare', ['compare', '--input', 'agency-edited.json', '--against', 'agency.process.json', ...run, '--runs', '2', '--warmup', '60',
   '--output', 'compare.json']],
  ['diff', ['diff', '--input', 'agency-edited.json', '--against', 'agency.process.json']],
  ['diff', ['diff', '--input', 'starter.json', '--against', 'starter.json']],
  ['slides', ['slides', '--input', 'agency.process.json']], ['slides', ['slides', '--input', 'agency.process.json', '--format', 'md']],
  ['slides', ['slides', '--input', 'loan-application.process.json', '--format', 'md', ...run, '--output', 'slides.md']],
  ['slides', ['slides', '--input', 'agency.process.json', '--brief', '--output', 'slides-brief.json']],
  ['export-bpmn', ['export-bpmn', '--input', 'agency.process.json', '--output', 'agency.bpmn']],
  ['export-bpmn', ['export-bpmn', '--input', 'loan-application.process.json', '--output', 'loan.xml', '--bpsim']],
  ['validate-bpmn', ['validate-bpmn', '--input', 'agency.bpmn']], ['validate-bpmn', ['validate-bpmn', '--input', 'loan-application.bpmn']],
  ['validate-bpmn', ['validate-bpmn', '--input', 'bad.bpmn']],
  ['import-bpmn', ['import-bpmn', '--input', 'loan-application.bpmn', '--output', 'loan-import.json', '--report', 'loan-report.json']],
  ['import-bpmn', ['import-bpmn', '--input', 'support-ticket.bpmn', '--output', 'ticket.json', '--unsupported', 'drop', '--lanes', 'ignore',
   '--default-duration', '30']],
  ['import-bpmn', ['import-bpmn', '--input', 'loan.xml', '--output', 'loan-round.json', '--draft', '--no-auto-system-pool']],
  ['import-bpmn', ['import-bpmn', '--input', 'bad.bpmn', '--output', 'bad-import.json']],
  ['forge', ['forge', '--input', 'agency.process.json', '--output', 'forge-agency']],
  ['build', ['build', '--input', 'agency.process.json', '--output', 'agency.html']],
  ['build', ['build', '--input', 'attached.json', '--output', 'attached.html']]
 ];
}
