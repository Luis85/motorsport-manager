/** Definition commands: `schema`, `create`, `validate` and `inspect` (none advances simulated time). */
import {catalog, runtime, authoring, advice} from '../kernel.cjs';
import type {Context} from '../io.cjs';

/** The guarded edit recipe schema; same text as `wildlands process schema --kind recipe`. */
export function recipeSchema(): Record<string, unknown> {
 const properties = catalog.schema.properties as Record<string, Record<string, unknown>>;
 const operation = (op: string, key: string, value: unknown) =>
  ({type: 'object', additionalProperties: false, required: ['op', key], properties: {op: {const: op}, [key]: value}});
 // Flow conditions refer to #/definitions/condition, so the recipe schema carries the definition schema's shared definitions.
 return {$schema: 'http://json-schema.org/draft-07/schema#', definitions: catalog.schema.definitions, type: 'object', additionalProperties: false,
  required: ['expectedRevision', 'expectedFingerprint', 'operations'], properties: {
   expectedRevision: properties.revision, expectedFingerprint: {type: 'string', pattern: '^[0-9a-f]{16}$'},
   operations: {type: 'array', minItems: 1, maxItems: 256, items: {oneOf: [
    ...['Step', 'Flow', 'Resource'].map((name, i) => operation('put' + name, 'value', properties[['steps', 'flows', 'resources'][i]!]!.items)),
    ...['Step', 'Flow', 'Resource'].map(name => operation('remove' + name, 'id', properties.id)),
    operation('setArrivals', 'value', properties.arrivals), operation('setStart', 'value', properties.start), operation('rename', 'value', properties.name),
    ...([['setDescription', 'description'], ['setSeed', 'seed'], ['setSipoc', 'sipoc'], ['setTrack', 'track'], ['setCalendar', 'calendar'],
     ['setWorkingHours', 'workingHours']] as const)
     .map(([op, key]) => operation(op, 'value', {oneOf: [properties[key], {type: 'null'}]})),
    operation('setGenre', 'value', properties.genre)
   ]}}}};
}
/** Every guarded edit operation id, taken from the recipe schema so discovery cannot drift from it. */
export function editOperations(): string[] {
 const items = (recipeSchema().properties as Record<string, {items: {oneOf: {properties: {op: {const: string}}}[]}}>)['operations']!.items.oneOf;
 return items.map(item => item.properties.op.const);
}

export function schema(ctx: Context): void {
 const kind = ctx.get('--kind') ?? 'definition';
 if (!['definition', 'recipe'].includes(kind)) throw Error('--kind must be definition or recipe.');
 ctx.success({schema: kind === 'definition' ? catalog.schema : recipeSchema()});
}

export function create(ctx: Context): void {
 const definition = authoring.create(ctx.required('--id'), ctx.get('--name') ?? ctx.required('--id'));
 ctx.success({output: ctx.output(definition, []), revision: definition.revision, fingerprint: catalog.fingerprint(definition)});
}

/** Exit 1 with `ok: false` and no code when rejected; advisories never change acceptance. */
export function validate(ctx: Context): void {
 const input = ctx.read(ctx.required('--input')), draft = ctx.has('--draft');
 const checked = catalog.validate(input, draft), accepted = draft ? checked.acceptable : checked.ok;
 const advisories = checked.definition ? advice.advise(checked.definition) : [];
 ctx.emit({ok: accepted, protocolVersion: 1, runnable: checked.ok, diagnostics: checked.diagnostics, advisories});
 if (!accepted) ctx.exit(1);
}

/**
 * `inspect` names a definition's working hours (only when it has them): the hours in words, the clock's starting point and that the
 * run clock counts elapsed minutes. A draft whose working hours have a diagnostic gets the values without the words.
 */
function workingHours(d: LWProcess.Definition, diagnostics: LWProcess.Diagnostic[]): {workingHours?: Record<string, unknown>} {
 if (!d.workingHours) return {};
 const time = (globalThis as unknown as {LWProcessTime: LWProcessTime.Api}).LWProcessTime, h = d.workingHours;
 if (diagnostics.some(e => e.path.startsWith('/workingHours'))) return {workingHours: {...h}};
 return {workingHours: {...h, hours: time.hours(h), start: time.clock(0, h), clock: 'elapsed minutes; work and arrivals pause outside working hours'}};
}

export function inspect(ctx: Context): void {
 const checked = catalog.validate(ctx.read(ctx.required('--input')), true);
 if (!checked.acceptable) throw Error(checked.diagnostics.map(e => e.path + ': ' + e.message).join('\n'));
 const d = checked.definition!, runnable = !checked.diagnostics.length, temporary = runnable ? runtime.create(d) : null;
 try {
  ctx.success({id: d.id, revision: d.revision, fingerprint: catalog.fingerprint(d), runnable, diagnostics: checked.diagnostics, advisories: advice.advise(d),
   ...workingHours(d, checked.diagnostics), scenes: d.steps.map(s => ({id: s.scene.id, stepId: s.id, name: s.name, position: s.scene.position})), snapshot: temporary?.query() ?? null});
 } finally { temporary?.dispose(); }
}
