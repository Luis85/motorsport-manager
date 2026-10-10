/// <reference path="../process-contracts.d.ts" />
/** Noninteractive process agent tools. All outputs are guarded and atomic via shared CLI I/O. */
import {createHash} from 'node:crypto';
import {catalog, runtime, authoring, bpmn, conformance, slides, diff, advice} from '../process-sdk.cjs';
import {emit, readJsonFile, writeJsonFile, writeTextFile} from './cli-io.cjs';
import {assembleGame} from './game-build.cjs';
import {writeForgeProject} from './process-forge.cjs';
import {checkBounds, runCommand, replicateCommand, compareCommand, definitionDiff} from './process-cli-analytics.cjs';
const commands: Record<string, readonly string[]> = {
 discover: [], schema: ['--kind'], create: ['--id', '--name', '--output'], validate: ['--input', '--draft'], inspect: ['--input'],
 edit: ['--input', '--recipe', '--output', '--dry-run', '--draft'], run: ['--input', '--minutes', '--output', '--seed', '--event-log', '--format'],
 build: ['--input', '--output'], forge: ['--input', '--output'], 'export-bpmn': ['--input', '--output', '--bpsim'], 'validate-bpmn': ['--input'],
 'import-bpmn': ['--input', '--output', '--draft', '--default-duration', '--process', '--lanes', '--default-capacity', '--no-auto-system-pool', '--system-capacity', '--minutes-per-day', '--minutes-per-hour', '--unsupported', '--no-bpsim', '--scenario', '--report'],
 attach: ['--input', '--asset', '--step', '--expected-revision', '--expected-fingerprint', '--output', '--dry-run'],
 slides: ['--input', '--format', '--minutes', '--seed', '--output'], diff: ['--input', '--against'],
 replicate: ['--input', '--minutes', '--runs', '--seed', '--output'], compare: ['--input', '--against', '--minutes', '--runs', '--seed', '--output']
};
const flags = new Set(['--draft', '--dry-run', '--bpsim', '--no-auto-system-pool', '--no-bpsim']);
/** Options every invocation of a command must carry; checked before any file is read or work is done. */
const requiredOptions: Record<string, readonly string[]> = {create: ['--id', '--output'], validate: ['--input'], inspect: ['--input'], edit: ['--input', '--recipe'],
 run: ['--input', '--minutes', '--output'], build: ['--input', '--output'], forge: ['--input', '--output'], 'export-bpmn': ['--input', '--output'], 'import-bpmn': ['--input', '--output'], 'validate-bpmn': ['--input'],
 attach: ['--input', '--asset', '--step', '--expected-revision', '--expected-fingerprint'], slides: ['--input'], diff: ['--input', '--against'],
 replicate: ['--input', '--minutes', '--runs'], compare: ['--input', '--against', '--minutes', '--runs']};
const descriptions: Record<string, string> = {discover: 'Discover commands, limits and guarded edit operations.', schema: 'Get the authoritative process JSON Schema.',
 create: 'Create a runnable starter definition.', validate: 'Validate shape, references and graph semantics; --draft permits graph diagnostics.', inspect: 'Read identity, scene graph and starting snapshot without advancing time.',
 edit: 'Apply a revision/fingerprint guarded transaction; --draft allows intermediate graph diagnostics.',
 run: 'Run a fresh deterministic session for a bounded number of business minutes; --seed N replaces the definition seed; '
  + '--event-log FILE streams every engine event to a CSV (default) or XES (--format xes) file while it runs.',
 build: 'Build one self-contained offline HTML file.',
 'validate-bpmn': 'Check a BPMN 2.0 XML file (and its BPSim 1.0 data) against the built-in conformance rules (no schema files); prints the report (errors with line, path, code and message; elements not covered; unchecked extension content); exit 0 when it conforms, 2 when not.',
 'export-bpmn': 'Export a BPMN 2.0 XML file (with Wildlands extension values and diagram layout); --bpsim adds a BPSim scenario (processing times, probabilities, arrivals, pool quantities and costs); fidelity lists what only the Wildlands extension carries.',
 'import-bpmn': 'Import a BPMN 2.0 XML file into a simulatable definition (lanes, sub-processes, call activities, gateways, loops, boundary timers, expressions and BPSim parameters are mapped); prints the structured report (warnings, mapping counts, rejections); unsupported elements are rejected (exit 2) or, with --unsupported drop, dropped with warnings.', forge: 'Create an editable Scene Forge project with one scene per step.', attach: 'Attach a Scene Forge Wildlands asset to a step using edit guards.',
 slides: 'Explain the process as a slide deck (title, overview, resources, main route by phase, variants, summary); --format json (default) or md (Markdown printed as plain text without --output); --minutes N [--seed S] adds read-only facts from one fresh bounded run.',
 replicate: 'Run the definition for --minutes over --runs consecutive seeds (from --seed, else the definition seed, else 1); '
  + 'report n, mean, sample sd, t-based 95% interval and p10/p50/p90 per KPI with per-seed rows; --output writes the report file.',
 compare: 'Run --input (A) and --against (B) over the same --runs seeds for --minutes; report per KPI the statistics of A and B and '
  + 'the paired difference A - B with its sd and t-based 95% interval, per-seed rows and the process diff of the two files.',
 diff: 'Report what changed from --against (the reference) to --input: counts of changed steps, flows, resources, arrival rules and process settings; the changed steps, resources, flows, arrival rules and settings; every changed value with its path, before and after; and both revisions and fingerprints.'};
function recipeSchema(): Record<string, unknown> {
 const properties = catalog.schema.properties as Record<string, Record<string, unknown>>;
 const operation = (op: string, key: string, value: unknown) => ({type: 'object', additionalProperties: false, required: ['op', key], properties: {op: {const: op}, [key]: value}});
 // Flow conditions refer to #/definitions/condition, so the recipe schema carries the definition schema's shared definitions.
 return {$schema: 'http://json-schema.org/draft-07/schema#', definitions: catalog.schema.definitions, type: 'object', additionalProperties: false,
  required: ['expectedRevision', 'expectedFingerprint', 'operations'], properties: {
   expectedRevision: properties.revision, expectedFingerprint: {type: 'string', pattern: '^[0-9a-f]{16}$'},
   operations: {type: 'array', minItems: 1, maxItems: 256, items: {oneOf: [
    ...['Step', 'Flow', 'Resource'].map((name, i) => operation('put' + name, 'value', properties[['steps', 'flows', 'resources'][i]!]!.items)),
    ...['Step', 'Flow', 'Resource'].map(name => operation('remove' + name, 'id', properties.id)),
    operation('setArrivals', 'value', properties.arrivals), operation('setStart', 'value', properties.start), operation('rename', 'value', properties.name),
    ...([['setDescription', 'description'], ['setSeed', 'seed'], ['setSipoc', 'sipoc'], ['setTrack', 'track'], ['setCalendar', 'calendar']] as const)
     .map(([op, key]) => operation(op, 'value', {oneOf: [properties[key], {type: 'null'}]})),
    operation('setGenre', 'value', properties.genre)
   ]}}}};
}
/** Every guarded edit operation id, taken from the recipe schema so discovery cannot drift from it. */
function editOperations(): string[] {
 const items = (recipeSchema().properties as Record<string, {items: {oneOf: {properties: {op: {const: string}}}[]}}>)['operations']!.items.oneOf;
 return items.map(item => item.properties.op.const);
}
function build(input: unknown): {html: string; bytes: number; sha256: string} {
 const d = catalog.admit(input), digest = createHash('sha256').update(JSON.stringify(d)).digest('hex');
 const game = {root: '', manifest: {format: 'wildlands-game' as const, schemaVersion: 1 as const, id: d.id, name: d.name, version: '1.0.0', template: 'process' as const,
  engine: {api: 1 as const}, content: {definition: 'process.json'}, presentation: {title: d.name}, storage: {namespace: 'wildlands.' + d.id}, targets: {html: {output: 'demos/' + d.id + '.html', budgetBytes: 16 * 1024 * 1024}}},
  files: [], packages: [], digest, profile: {format: 'wildlands-content-profile' as const, version: 1 as const, id: d.id},
  data: new Map<string, unknown>([['LWProcessDefinition', d], ['LWGameProfile', {storage: {namespace: 'wildlands.' + d.id}}]])};
 return assembleGame(game, 'play');
}
export function run(args: readonly string[]): void {
 try {
  const help = args.length === 1 && ['--help', '-h'].includes(args[0]!);
  const command = help ? 'discover' : args[0] ?? 'discover';
  if (!Object.hasOwn(commands, command)) throw Error('Unknown process command; use wildlands process discover.');
  const values = new Map<string, string>();
  for (let i = help ? args.length : 1; i < args.length; i++) {
   const key = args[i]!; if (!commands[command]!.includes(key) || values.has(key)) throw Error('Unknown or duplicate option: ' + key);
   if (flags.has(key)) {values.set(key, 'true'); continue;}
   const value = args[++i]; if (!value || value.startsWith('--')) throw Error('Missing value for ' + key); values.set(key, value);
  }
  for (const key of requiredOptions[command] ?? []) if (!values.has(key)) throw Error('Missing ' + key);
  if (['edit', 'attach'].includes(command)) {
   if (values.has('--dry-run') && values.has('--output')) throw Error('Dry run does not accept --output.');
   if (!values.has('--dry-run') && !values.has('--output')) throw Error('Missing --output (or use --dry-run).');
  }
  const wholeNumbers = ['--expected-revision', '--default-duration', '--seed', '--default-capacity', '--system-capacity', '--minutes-per-day',
   '--minutes-per-hour'];
  for (const key of wholeNumbers) if (values.has(key) && !/^\d+$/.test(values.get(key)!)) throw Error(key + ' must be a whole number.');
  if (values.has('--seed') && Number(values.get('--seed')) > 2147483647) throw Error('--seed must be from 0 to 2147483647.');
  if (values.has('--kind') && !['definition', 'recipe'].includes(values.get('--kind')!)) throw Error('--kind must be definition or recipe.');
  if (command !== 'run' && values.has('--format') && !['json', 'md'].includes(values.get('--format')!)) throw Error('--format must be json or md.');
  checkBounds(command, values);
  if (command === 'slides' && values.has('--seed') && !values.has('--minutes')) throw Error('--seed needs --minutes (live facts come from one bounded run).');
  const required = (key: string) => {const value = values.get(key); if (!value) throw Error('Missing ' + key); return value;};
  const read = (file: string) => JSON.parse(readJsonFile(file, 8 * 1024 * 1024).replace(/^\uFEFF/, '')) as unknown;
  const output = (value: unknown, inputs: string[]) => writeJsonFile(required('--output'), value, inputs);
  const success = (value: Record<string, unknown>) => emit({ok: true, protocolVersion: 1, ...value});
  if (command === 'discover') {
   success({format: 'wildlands-process', schemaVersion: 1, handbook: 'docs/reference/business-process-engine.md', limits: runtime.limits,
    operations: Object.entries(commands).map(([id, options]) => ({id, options, description: descriptions[id]})),
    editOperations: editOperations(),
    workflow: ['create', 'inspect', 'edit --dry-run', 'edit', 'validate', 'diff', 'slides', 'forge', 'attach', 'run', 'replicate', 'compare', 'build'],
    interchange: {bpmn: 'BPMN 2.0 XML via export-bpmn and import-bpmn; validate-bpmn checks a file against the BPMN 2.0 and BPSim 1.0 conformance rules'},
    recipe: {expectedRevision: 0, expectedFingerprint: '<inspect.fingerprint>', operations: [{op: 'rename', value: 'My process'}]},
    notes: ['put operations replace full definitions', 'dry runs write nothing', 'setDescription, setSeed, setSipoc and setTrack remove the field with value null; setGenre with process removes genre', 'draft graph diagnostics must be resolved before run or build', 'fingerprint is a change guard, not a cryptographic signature']}); return;
  }
  if (command === 'schema') {
   const kind = values.get('--kind') ?? 'definition';
   if (!['definition', 'recipe'].includes(kind)) throw Error('--kind must be definition or recipe.');
   success({schema: kind === 'definition' ? catalog.schema : recipeSchema()}); return;
  }
  if (command === 'create') {
   const definition = authoring.create(required('--id'), values.get('--name') ?? required('--id'));
   success({output: output(definition, []), revision: definition.revision, fingerprint: catalog.fingerprint(definition)}); return;
  }
  if (command === 'import-bpmn') {
   const number = (key: string) => values.has(key) ? Number(values.get(key)) : undefined, text = (key: string) => values.get(key);
   // Every option is validated (names, enums, ranges) before the input file is read.
   const options: LWProcessBpmn.Options = {...number('--default-duration') !== undefined ? {defaultDuration: number('--default-duration')!} : {}, ...text('--process') ? {process: text('--process')!} : {},
    ...text('--lanes') ? {lanes: text('--lanes') as 'pools' | 'ignore'} : {}, ...number('--default-capacity') !== undefined ? {defaultCapacity: number('--default-capacity')!} : {}, ...values.has('--no-auto-system-pool') ? {autoSystemPool: false} : {},
    ...number('--system-capacity') !== undefined ? {systemCapacity: number('--system-capacity')!} : {}, ...number('--minutes-per-day') !== undefined ? {minutesPerDay: number('--minutes-per-day')!} : {}, ...number('--minutes-per-hour') !== undefined ? {minutesPerHour: number('--minutes-per-hour')!} : {},
    ...text('--unsupported') ? {unsupported: text('--unsupported') as 'reject' | 'drop'} : {}, ...values.has('--no-bpsim') ? {bpsim: false} : {}, ...text('--scenario') ? {scenario: text('--scenario')!} : {}};
   bpmn.options(options);
   if (values.has('--scenario') && values.has('--no-bpsim')) throw Error('--scenario cannot be combined with --no-bpsim.');
   const source = readJsonFile(required('--input'), 8 * 1024 * 1024), imported = bpmn.analyze(source, options), draft = values.has('--draft');
   const counts = (keys: string[]) => keys.reduce<Record<string, number>>((acc, k) => { acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
   const summary = {total: imported.mapping.length, byType: counts(imported.mapping.map(m => m.type)), byTarget: counts(imported.mapping.map(m => m.target.split(':')[0]!))};
   const report = {process: imported.info.process, scenario: imported.info.scenario, horizon: imported.info.horizon, options: imported.info.options, warnings: imported.warnings, mapping: summary, rejections: imported.rejections};
   if (imported.rejections.length) {emit({ok: false, protocolVersion: 1, code: 'process-import-rejected', ...report, errors: imported.rejections.map(r => r.message)}); process.exitCode = 2; return;}
   if (!(draft ? imported.acceptable : imported.ok)) {emit({ok: false, protocolVersion: 1, diagnostics: imported.diagnostics, ...report}); process.exitCode = 1; return;}
   const inputs = [required('--input')], target = output(imported.definition, inputs);
   const full = values.has('--report') ? writeJsonFile(required('--report'), {format: 'wildlands-bpmn-import-report', schemaVersion: 1, ...report, mapping: imported.mapping, diagnostics: imported.diagnostics}, inputs) : undefined;
   success({output: target, ...full ? {report: full} : {}, runnable: imported.ok, diagnostics: imported.diagnostics, ...report}); return;
  }
  if (command === 'validate-bpmn') {
   const file = required('--input'), report = conformance.validate(readJsonFile(file, 8 * 1024 * 1024));
   emit({ok: report.conforms, protocolVersion: 1, ...report.conforms ? {} : {code: 'process-bpmn-nonconforming'}, input: file, ...report});
   if (!report.conforms) process.exitCode = 2; return;
  }
  const file = required('--input'), input = read(file);
  if (command === 'diff') {
   const reference = required('--against');
   success(definitionDiff(input, file, read(reference), reference));
   return;
  }
  if (command === 'compare') {
   const reference = required('--against');
   compareCommand(input, file, read(reference), reference, values, success);
   return;
  }
  if (command === 'replicate') {
   replicateCommand(input, file, values, success);
   return;
  }
  if (command === 'export-bpmn') {
   const target = required('--output'); if (!/\.(bpmn|xml)$/.test(target)) throw Error('BPMN output must end in .bpmn or .xml.');
   const options = values.has('--bpsim') ? {bpsim: true} : {};
   success({output: writeTextFile(target, bpmn.export(input, options), [file]), bpsim: values.has('--bpsim'), fidelity: bpmn.fidelity(input, options)}); return;
  }
  if (command === 'validate') {
   const checked = catalog.validate(input, values.has('--draft')), accepted = values.has('--draft') ? checked.acceptable : checked.ok;
   // Advisories never change acceptance; they need a definition that passed the structural schema.
   const advisories = checked.definition ? advice.advise(checked.definition) : [];
   emit({ok: accepted, protocolVersion: 1, runnable: checked.ok, diagnostics: checked.diagnostics, advisories});
   if (!accepted) process.exitCode = 1; return;
  }
  if (command === 'edit' || command === 'attach') {
   let recipe: unknown, inputs = [file];
   if (command === 'edit') {const recipeFile = required('--recipe'); recipe = read(recipeFile); inputs.push(recipeFile);}
   else {
    const definition = catalog.admit(input), id = required('--step'), step = definition.steps.find(s => s.id === id);
    if (!step) throw Error('Unknown step: ' + id);
    const assetFile = required('--asset'), assetInput = read(assetFile) as {visual?: unknown}; inputs.push(assetFile);
    // Scene Forge writes a source definition wrapper; the renderer consumes its visual facet.
    const asset = assetInput && typeof assetInput === 'object' && Object.hasOwn(assetInput, 'visual') ? assetInput.visual : assetInput;
    recipe = {expectedRevision: Number(required('--expected-revision')), expectedFingerprint: required('--expected-fingerprint'), operations: [{op: 'putStep', value: {...step, scene: {...step.scene, asset}}}]};
   }
   const result = authoring.edit(input, recipe, values.has('--draft'));
   success({...result, dryRun: values.has('--dry-run'), ...values.has('--dry-run') ? {} : {output: output(result.definition, inputs)}}); return;
  }
  if (command === 'inspect') {
   const checked = catalog.validate(input, true);
   if (!checked.acceptable) throw Error(checked.diagnostics.map(e => e.path + ': ' + e.message).join('\n'));
   const d = checked.definition!, runnable = !checked.diagnostics.length, temporary = runnable ? runtime.create(d) : null;
   try {success({id: d.id, revision: d.revision, fingerprint: catalog.fingerprint(d), runnable, diagnostics: checked.diagnostics, advisories: advice.advise(d),
    scenes: d.steps.map(s => ({id: s.scene.id, stepId: s.id, name: s.name, position: s.scene.position})), snapshot: temporary?.query() ?? null});}
   finally {temporary?.dispose();} return;
  }
  const definition = catalog.admit(input);
  if (command === 'forge') {success(writeForgeProject(definition, required('--output'))); return;}
  if (command === 'build') {
   const target = required('--output'); if (!target.endsWith('.html')) throw Error('Build output must end in .html.');
   const result = build(definition); success({output: writeTextFile(target, result.html, [file]), bytes: result.bytes, sha256: result.sha256}); return;
  }
  if (command === 'slides') {
   let snapshot: LWProcess.Snapshot | null = null;
   if (values.has('--minutes')) {
    // Same bounded, fresh and seeded run as `process run`; the deck only reads the resulting detached snapshot.
    const live = runtime.create(definition, values.has('--seed') ? {seed: Number(values.get('--seed'))} : {});
    try {snapshot = live.advance(Number(values.get('--minutes')));} finally {live.dispose();}
   }
   const deck = slides.build(definition, snapshot), format = values.get('--format') ?? 'json', text = format === 'md' ? slides.markdown(deck) : null;
   if (values.has('--output')) {
    const target = text === null ? writeJsonFile(required('--output'), deck, [file]) : writeTextFile(required('--output'), text, [file]);
    success({output: target, format, slides: deck.slides.length, sections: deck.sections.length, live: deck.live}); return;
   }
   if (text !== null) {process.stdout.write(text); return;}
   success({format, deck}); return;
  }
  runCommand(definition, file, values, success);
 } catch (error) {emit({ok: false, protocolVersion: 1, code: 'process-operation-failed', errors: [error instanceof Error ? error.message : String(error)]}); process.exitCode = 2;}
}
