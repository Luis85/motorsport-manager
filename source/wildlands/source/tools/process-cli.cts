/// <reference path="../process-contracts.d.ts" />
/** Noninteractive process agent tools. All outputs are guarded and atomic via shared CLI I/O. */
import {createHash} from 'node:crypto';
import {catalog, runtime, authoring} from '../process-sdk.cjs';
import {emit, readJsonFile, writeJsonFile, writeTextFile} from './cli-io.cjs';
import {assembleGame} from './game-build.cjs';
import {writeForgeProject} from './process-forge.cjs';
const commands: Record<string, readonly string[]> = {
 discover: [], schema: ['--kind'], create: ['--id', '--name', '--output'], validate: ['--input', '--draft'], inspect: ['--input'],
 edit: ['--input', '--recipe', '--output', '--dry-run', '--draft'], run: ['--input', '--minutes', '--output'],
 build: ['--input', '--output'], forge: ['--input', '--output'],
 attach: ['--input', '--asset', '--step', '--expected-revision', '--expected-fingerprint', '--output', '--dry-run']
};
const flags = new Set(['--draft', '--dry-run']);
const descriptions: Record<string, string> = {discover: 'Discover commands, limits and guarded edit operations.', schema: 'Get the authoritative process JSON Schema.',
 create: 'Create a runnable starter definition.', validate: 'Validate shape, references and graph semantics; --draft permits graph diagnostics.', inspect: 'Read identity, scene graph and starting snapshot without advancing time.',
 edit: 'Apply a revision/fingerprint guarded transaction; --draft allows intermediate graph diagnostics.', run: 'Run a fresh deterministic session for a bounded number of business minutes.',
 build: 'Build one self-contained offline HTML file.', forge: 'Create an editable Scene Forge project with one scene per step.', attach: 'Attach a Scene Forge Wildlands asset to a step using edit guards.'};
function recipeSchema(): Record<string, unknown> {
 const properties = catalog.schema.properties as Record<string, Record<string, unknown>>;
 const operation = (op: string, key: string, value: unknown) => ({type: 'object', additionalProperties: false, required: ['op', key], properties: {op: {const: op}, [key]: value}});
 return {$schema: 'http://json-schema.org/draft-07/schema#', type: 'object', additionalProperties: false,
  required: ['expectedRevision', 'expectedFingerprint', 'operations'], properties: {
   expectedRevision: properties.revision, expectedFingerprint: {type: 'string', pattern: '^[0-9a-f]{16}$'},
   operations: {type: 'array', minItems: 1, maxItems: 256, items: {oneOf: [
    ...['Step', 'Flow', 'Resource'].map((name, i) => operation('put' + name, 'value', properties[['steps', 'flows', 'resources'][i]!]!.items)),
    ...['Step', 'Flow', 'Resource'].map(name => operation('remove' + name, 'id', properties.id)),
    operation('setArrivals', 'value', properties.arrivals), operation('setStart', 'value', properties.start), operation('rename', 'value', properties.name)
   ]}}}};
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
  const command = args[0] ?? 'discover';
  if (!Object.hasOwn(commands, command)) throw Error('Unknown process command; use wildlands process discover.');
  const values = new Map<string, string>();
  for (let i = 1; i < args.length; i++) {
   const key = args[i]!; if (!commands[command]!.includes(key) || values.has(key)) throw Error('Unknown or duplicate option: ' + key);
   if (flags.has(key)) {values.set(key, 'true'); continue;}
   const value = args[++i]; if (!value || value.startsWith('--')) throw Error('Missing value for ' + key); values.set(key, value);
  }
  const required = (key: string) => {const value = values.get(key); if (!value) throw Error('Missing ' + key); return value;};
  const read = (file: string) => JSON.parse(readJsonFile(file, 8 * 1024 * 1024).replace(/^\uFEFF/, '')) as unknown;
  const output = (value: unknown, inputs: string[]) => writeJsonFile(required('--output'), value, inputs);
  const success = (value: Record<string, unknown>) => emit({ok: true, protocolVersion: 1, ...value});
  if (command === 'discover') {
   success({format: 'wildlands-process', schemaVersion: 1, handbook: 'docs/reference/business-process-engine.md', limits: runtime.limits,
    operations: Object.entries(commands).map(([id, options]) => ({id, options, description: descriptions[id]})),
    editOperations: ['putStep', 'putFlow', 'putResource', 'removeStep', 'removeFlow', 'removeResource', 'setArrivals', 'setStart', 'rename'],
    workflow: ['create', 'inspect', 'edit --dry-run', 'edit', 'validate', 'forge', 'attach', 'run', 'build'],
    recipe: {expectedRevision: 0, expectedFingerprint: '<inspect.fingerprint>', operations: [{op: 'rename', value: 'My process'}]},
    notes: ['put operations replace full definitions', 'dry runs write nothing', 'draft graph diagnostics must be resolved before run or build', 'fingerprint is a change guard, not a cryptographic signature']}); return;
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
  const file = required('--input'), input = read(file);
  if (command === 'validate') {
   const checked = catalog.validate(input, values.has('--draft'));
   emit({ok: checked.ok, protocolVersion: 1, runnable: checked.ok && !checked.diagnostics.length, diagnostics: checked.diagnostics});
   if (!checked.ok) process.exitCode = 1; return;
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
   if (values.has('--dry-run') && values.has('--output')) throw Error('Dry run does not accept --output.');
   success({...result, dryRun: values.has('--dry-run'), ...values.has('--dry-run') ? {} : {output: output(result.definition, inputs)}}); return;
  }
  if (command === 'inspect') {
   const checked = catalog.validate(input, true);
   if (!checked.ok) throw Error(checked.diagnostics.map(e => e.path + ': ' + e.message).join('\n'));
   const d = checked.definition!, runnable = !checked.diagnostics.length, temporary = runnable ? runtime.create(d) : null;
   try {success({id: d.id, revision: d.revision, fingerprint: catalog.fingerprint(d), runnable, diagnostics: checked.diagnostics,
    scenes: d.steps.map(s => ({id: s.scene.id, stepId: s.id, name: s.name, position: s.scene.position})), snapshot: temporary?.query() ?? null});}
   finally {temporary?.dispose();} return;
  }
  const definition = catalog.admit(input);
  if (command === 'forge') {success(writeForgeProject(definition, required('--output'))); return;}
  if (command === 'build') {
   const target = required('--output'); if (!target.endsWith('.html')) throw Error('Build output must end in .html.');
   const result = build(definition); success({output: writeTextFile(target, result.html, [file]), bytes: result.bytes, sha256: result.sha256}); return;
  }
  const session = runtime.create(definition);
  try {
   const raw = required('--minutes'); if (!/^\d+$/.test(raw)) throw Error('--minutes must be a whole number.');
   const snapshot = session.advance(Number(raw));
   const report = {format: 'wildlands-process-report', schemaVersion: 1, fingerprint: catalog.fingerprint(definition), definition, snapshot};
   success({output: output(report, [file]), requestedMinutes: Number(raw), advancedMinutes: snapshot.minute, status: snapshot.status, metrics: snapshot.metrics});
  } finally {session.dispose();}
 } catch (error) {emit({ok: false, protocolVersion: 1, code: 'process-operation-failed', errors: [error instanceof Error ? error.message : String(error)]}); process.exitCode = 2;}
}
