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

/**
 * Inputs both runs start from: two demo definitions, a starter (also with a BOM and as links), a bad definition, recipes, assets,
 * BPMN files, starters with working hours (beside a display calendar, and closing before they open) and a truncated checkpoint.
 */
export function prepare(directory: string): void {
 const write = (name: string, value: unknown) =>
  fs.writeFileSync(path.join(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
 for (const name of ['agency.process.json', 'loan-application.process.json']) fs.copyFileSync(path.join(AGENCY, name), path.join(directory, name));
 for (const name of ['loan-application.bpmn', 'support-ticket.bpmn']) fs.copyFileSync(path.join(BPMN_EXAMPLES, name), path.join(directory, name));
 const admit = (name: string) => catalog.admit(JSON.parse(fs.readFileSync(path.join(AGENCY, name), 'utf8')));
 const agency = admit('agency.process.json'), loan = admit('loan-application.process.json');
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
 // A byte order mark is accepted; a hard link and a relative symbolic link alias the starter (outputs must refuse both).
 write('bom.json', '\uFEFF' + JSON.stringify(starter));
 fs.linkSync(path.join(directory, 'starter.json'), path.join(directory, 'hard.json'));
 fs.symlinkSync('starter.json', path.join(directory, 'soft.json'));
 // Graph diagnostics without rejections: import-bpmn exits 1 without --draft.
 write('unreachable.bpmn', '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d" targetNamespace="urn:x">'
  + '<process id="p" isExecutable="true"><startEvent id="s"/><task id="t"/><task id="u"/><endEvent id="e"/>'
  + '<sequenceFlow id="f1" sourceRef="s" targetRef="t"/><sequenceFlow id="f2" sourceRef="t" targetRef="e"/>'
  + '<sequenceFlow id="f3" sourceRef="u" targetRef="e"/></process></definitions>');
 // Working hours: a guarded edit adds them to the loan application; the starter variants carry a /workingHours diagnostic (inspect prints
 // the values without words).
 const hours = {opensAt: 540, closesAt: 1020, daysPerWeek: 5};
 write('hours.recipe.json', {expectedRevision: loan.revision, expectedFingerprint: catalog.fingerprint(loan),
  operations: [{op: 'setWorkingHours', value: hours}]});
 write('hours-calendar.json', {...starter, workingHours: hours, calendar: {minutesPerDay: 480, daysPerWeek: 5}});
 write('hours-reversed.json', {...starter, workingHours: {...hours, opensAt: 1020, closesAt: 540}});
 write('broken.checkpoint.json', '{"kind": "wildlands-process-checkpoint", "version": 1,');
}

/**
 * Usage errors (exit 2 before any file is read), refused outputs and other negative results.
 * `attach` holds the starter's attach options; index 5 is the expected revision.
 */
function negativeCases(attach: readonly string[]): Case[] {
 const run = ['run', '--input', 'starter.json', '--minutes', '10'], resume = ['run', '--input', 'agency.process.json', '--minutes', '10'];
 return [
  ...checkpointRefusals(run, resume), ['inspect', ['inspect', '--input', 'hours-reversed.json']],
  ['validate', ['validate', '--input', 'starter.json', '--bogus', '1']], ['validate', ['validate', '--input']],
  ['validate', ['validate', '--input', 'bom.json']], ['inspect', ['inspect', '--input', 'bad.json']],
  ['schema', ['schema', '--kind', 'other']], ['create', ['create', '--id', 'x']],
  ['run', [...run, '--output', 'r.json', '--seed', '1.5']], ['run', [...run, '--output', 'r.json', '--seed', '2147483648']],
  ['run', ['run', '--input', 'starter.json', '--minutes', '0', '--output', 'r.json']], ['run', [...run, '--output', 'r.json', '--format', 'xes']],
  ['run', [...run, '--output', 'r.json', '--event-log', 'starter.json']], ['run', [...run, '--output', 'bom-run.json']],
  ['run', [...run, '--output', 'starter.json']], ['run', [...run, '--output', 'hard.json']], ['run', [...run, '--output', './soft.json']],
  ['slides', ['slides', '--input', 'starter.json', '--format', 'pdf']], ['slides', ['slides', '--input', 'starter.json', '--seed', '3']],
  ['slides', ['slides', '--input', 'starter.json', '--format', 'md', '--output', 'soft.json']],
  ['edit', ['edit', '--input', 'agency.process.json', '--recipe', 'rename.recipe.json', '--dry-run', '--output', 'x.json']],
  ['edit', ['edit', '--input', 'agency.process.json', '--recipe', 'rename.recipe.json', '--output', 'rename.recipe.json']],
  ['attach', ['attach', ...attach.map((value, index) => index === 5 ? 'x' : value), '--asset', 'asset.json', '--dry-run']],
  ['replicate', ['replicate', '--input', 'starter.json', '--minutes', '10', '--runs', '0']],
  ['compare', ['compare', '--input', 'starter.json', '--against', 'starter.json', '--minutes', '10', '--runs', '2', '--warmup', '10']],
  ['export-bpmn', ['export-bpmn', '--input', 'starter.json', '--output', 'starter.txt']],
  ['build', ['build', '--input', 'starter.json', '--output', 'starter.htm']],
  ['forge', ['forge', '--input', 'starter.json', '--output', 'forge-agency']],
  ['import-bpmn', ['import-bpmn', '--input', 'unreachable.bpmn', '--output', 'unreachable.json']],
  ['import-bpmn', ['import-bpmn', '--input', 'unreachable.bpmn', '--output', 'unreachable.json', '--draft']],
  ['import-bpmn', ['import-bpmn', '--input', 'loan-application.bpmn', '--output', 'x.json', '--lanes', 'sideways']],
  ['import-bpmn', ['import-bpmn', '--input', 'loan-application.bpmn', '--output', 'x.json', '--scenario', 'a', '--no-bpsim']],
  ['import-bpmn', ['import-bpmn', '--input', 'loan-application.bpmn', '--output', 'loan-application.bpmn']]
 ];
}

/**
 * Run checkpoint refusals (`run` is a starter run, `resume` an agency run): usage errors before any file is read, aliased
 * outputs, and checkpoints of another process, another definition, another format, a truncated or missing file, or one
 * whose run length the requested minutes would pass. They read agency.checkpoint.json, written by an earlier case.
 */
function checkpointRefusals(run: readonly string[], resume: readonly string[]): Case[] {
 const saved = ['--checkpoint', 'agency.checkpoint.json'];
 return [
  ['run', [...resume, '--output', 'r.json', '--seed', '3', ...saved]], ['run', [...resume, '--output', 'r.json', '--checkpoint']],
  ['run', [...run, '--output', 'r.json', '--checkpoint-out', 'starter.json']], ['run', [...run, '--output', 'r.json', '--checkpoint-out', 'r.json']],
  ['run', [...run, '--output', 'r.json', '--event-log', 'e.csv', '--checkpoint-out', './e.csv']],
  ['run', [...resume, '--output', 'r.json', ...saved, '--checkpoint-out', './agency.checkpoint.json']],
  ['run', [...run, '--output', 'r.json', '--checkpoint-out', 'hard.json']], ['run', [...run, '--output', 'r.json', '--checkpoint-out', 'soft.json']],
  ['run', [...run, '--output', 'r.json', ...saved]],
  ['run', ['run', '--input', 'agency-edited.json', '--minutes', '10', '--output', 'r.json', ...saved]],
  ['run', [...resume, '--output', 'r.json', '--checkpoint', 'bad.json']], ['run', [...resume, '--output', 'r.json', '--checkpoint', 'broken.checkpoint.json']],
  ['run', [...resume, '--output', 'r.json', '--checkpoint', 'missing.checkpoint.json']],
  ['run', ['run', '--input', 'agency.process.json', '--minutes', '100000', '--output', 'r.json', ...saved]]
 ];
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
  ['run', ['run', '--input', 'agency.process.json', '--minutes', '100', '--seed', '7', '--output', 'run-a.json', '--checkpoint-out', 'agency.checkpoint.json']],
  ['run', ['run', '--input', 'agency.process.json', '--minutes', '140', '--output', 'run-b.json', '--checkpoint', 'agency.checkpoint.json']],
  ['run', ['run', '--input', 'agency.process.json', '--minutes', '60', '--output', 'run-c.json', '--checkpoint', 'agency.checkpoint.json',
   '--checkpoint-out', 'agency-160.checkpoint.json', '--event-log', 'events-resumed.xes', '--format', 'xes']],
  ['edit', ['edit', '--input', 'loan-application.process.json', '--recipe', 'hours.recipe.json', '--output', 'hours.json']],
  ['inspect', ['inspect', '--input', 'hours.json']], ['inspect', ['inspect', '--input', 'hours-calendar.json']],
  ['run', ['run', '--input', 'hours.json', '--minutes', '600', '--seed', '7', '--output', 'hours-run.json', '--checkpoint-out', 'hours.checkpoint.json']],
  ['run', ['run', '--input', 'hours.json', '--minutes', '900', '--output', 'hours-run-b.json', '--checkpoint', 'hours.checkpoint.json']],
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
  ['build', ['build', '--input', 'attached.json', '--output', 'attached.html']],
  ...negativeCases(attach)
 ];
}
