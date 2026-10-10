import type { Descriptor } from './protocol.js';

const identity = ['project', 'id'];
const guards = ['expected-revision', 'expected-state'];
export const previewValues = {
  mode: ['studio', 'world', 'portrait'], light: ['studio', 'daylight', 'night'],
  pose: ['idle', 'walk', 'work', 'celebrate'], camera: ['front', 'side', 'back'],
} as const;
const previewFlags = Object.keys(previewValues);
export const commands: Record<string, Descriptor> = {
  help: { description: 'Discover the machine-readable command protocol.', example: 'character-studio help' },
  version: { description: 'Read tool and protocol version.', example: 'character-studio version' },
  doctor: { description: 'Inspect writer-lock ownership; --capture also checks optional Playwright, Chromium and WebGL2 without installing anything.', required: ['project'], booleans:['capture'], example: 'character-studio doctor --project ./characters --capture' },
  discover: { description: 'List every command, supported flags, exit codes and editing workflow.', example: 'character-studio discover' },
  catalog: { description: 'List supported presets, shapes, personalities, skills and outfits from the game catalog.', example: 'character-studio catalog' },
  describe: { description: 'Describe one command and its flags.', required: ['command'], example: 'character-studio describe --command apply' },
  schema: { description: 'Read the character, edit-batch or reproducible-review JSON schema.', optional: ['kind'], example: 'character-studio schema --kind batch' },
  create: { description: 'Create a character. Existing IDs are never overwritten.', required: identity, optional: ['name', 'preset'], booleans: ['dry-run'], example: 'character-studio create --project ./characters --id moss --name Moss --preset pip' },
  list: { description: 'List project characters and their revision tokens.', required: ['project'], example: 'character-studio list --project ./characters' },
  inspect: { description: 'Read complete editable source and revision tokens.', required: identity, example: 'character-studio inspect --project ./characters --id moss' },
  validate: { description: 'Validate a saved character or JSON input file.', optional: [...identity, 'file'], example: 'character-studio validate --project ./characters --id moss' },
  apply: { description: 'Atomically apply a JSON batch with mandatory optimistic revision and state guards.', required: [...identity, 'file', ...guards], booleans: ['dry-run'], example: 'character-studio apply --project ./characters --id moss --file edits.json --expected-revision 1 --expected-state HASH --dry-run' },
  history: { description: 'Read saved history and undo/redo availability.', required: identity, example: 'character-studio history --project ./characters --id moss' },
  undo: { description: 'Restore the previous character with revision and state guards.', required: [...identity, ...guards], booleans: ['dry-run'], example: 'character-studio undo --project ./characters --id moss --expected-revision 2 --expected-state HASH' },
  redo: { description: 'Restore the next character with revision and state guards.', required: [...identity, ...guards], booleans: ['dry-run'], example: 'character-studio redo --project ./characters --id moss --expected-revision 3 --expected-state HASH' },
  import: { description: 'Create a new draft from a recipe or supported engine package; review it before marking ready.', required: ['project', 'file'], optional: ['id'], booleans: ['dry-run'], example: 'character-studio import --project ./characters --file moss.character.json' },
  export: { description: 'Compile recipe, engine package, definition, visual, or the current look. Output files never overwrite.', required: identity, optional: ['format', 'out'], example: 'character-studio export --project ./characters --id moss --format package --out moss.package.json' },
  preview: { description: 'Generate a self-contained offline editor HTML with the current character and reproducible preview settings.', required: [...identity, 'out'], optional: previewFlags, example: 'character-studio preview --project ./characters --id moss --out moss.html --mode world --pose walk' },
  capture: { description: 'Render a PNG for agent visual review. Requires external Playwright and Chromium; output never overwrites.', required: [...identity, 'out'], optional: [...previewFlags, 'width', 'height'], example: 'character-studio capture --project ./characters --id moss --out moss.png --camera front --light daylight' },
  review: { description: 'Render six useful views, a labeled contact sheet, recipe/visual hashes and a replay plan in a new directory. Optional --plan uses schema --kind review. Requires optional capture dependencies.', required:[...identity,'out'],optional:['plan'],example:'character-studio review --project ./characters --id moss --out ./review-v1' },
  serve: { description: 'Run the local UI and token-protected agent HTTP API; stays active until interrupted.', required: ['project'], optional: ['port'], example: 'character-studio serve --project ./characters --port 4317' },
};

export const operationSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Character Studio atomic edit batch', type: 'object', additionalProperties: false,
  required: ['operations'], properties: {
    operations: { type: 'array', minItems: 1, maxItems: 256, items: {
      oneOf: [
        { type: 'object', additionalProperties: false, required: ['op', 'path', 'value'], properties: { op: { enum: ['set', 'add'] }, path: { type: 'string', pattern: '^/' }, value: {} } },
        { type: 'object', additionalProperties: false, required: ['op', 'path'], properties: { op: { const: 'remove' }, path: { type: 'string', pattern: '^/' } } },
        { type: 'object', additionalProperties: false, required: ['op', 'preset'], properties: { op: { const: 'preset' }, preset: { type: 'string' } } },
        { type: 'object', additionalProperties: false, required: ['op', 'look'], properties: { op: { const: 'look' }, look: {type: 'object', required: ['format', 'schemaVersion', 'appearance', 'outfits'], additionalProperties: false, properties: {format: {const: 'littlewild-look'}, schemaVersion: {const: 1}, appearance: {type: 'object'}, outfits: {type: 'object'}}} } },
        { type: 'object', additionalProperties: false, required: ['op', 'seed'], properties: { op: { const: 'randomize' }, seed: { type: 'integer', minimum: 0, maximum: 4294967295 }, scope: {enum: ['all', 'body', 'coat'], default: 'all'} } },
        { type: 'object', additionalProperties: false, required: ['op', 'section'], properties: { op: { const: 'reset' }, section: {enum: ['identity', 'body', 'coat', 'skills', 'outfits']} } },
      ],
    } },
  },
};
export const batchSchema = operationSchema;

export function argumentSchema(command: string) {
  const descriptor = commands[command];
  const properties: Record<string, unknown> = {};
  for (const flag of [...descriptor.required || [], ...descriptor.optional || []]) {
    properties[flag] = {type: 'string', minLength: 1};
  }
  for (const flag of descriptor.booleans || []) properties[flag] = {type: 'boolean', default: false};
  if (properties['expected-revision']) properties['expected-revision'] = {type: 'integer', minimum: 0, description: 'Current revision from inspect. Stale writes fail with exit 3.'};
  if (properties['expected-state']) properties['expected-state'] = {type: 'string', pattern: '^[a-f0-9]{64}$', description: 'Current stateHash from inspect.'};
  if (properties.id) properties.id = {type: 'string', pattern: '^[a-z][a-z0-9_-]{0,60}$'};
  if (properties.port) properties.port = {type: 'integer', minimum: 0, maximum: 65535, default: 4317};
  if (properties.kind) properties.kind = {enum: ['character', 'batch', 'review'], default: 'character'};
  if (properties.format) properties.format = {enum: ['recipe', 'package', 'definition', 'visual', 'look'], default: 'recipe'};
  if (properties.preset) properties.preset = {enum: ['pip', 'fern', 'mochi', 'bramble'], default: 'pip'};
  if (properties.command) properties.command = {enum: Object.keys(commands)};
  for (const [key, values] of Object.entries(previewValues)) if (properties[key]) properties[key] = {enum: values, default: values[0]};
  for (const key of ['width', 'height']) if (properties[key]) properties[key] = {type: 'integer', minimum: 256, maximum: 4096, default: 1024};
  return {type: 'object', additionalProperties: false, properties, required: descriptor.required || []};
}

export function discovery() {
  return {
    ok: true, tool: 'character-studio', version: '0.1.0', protocolVersion: 1,
    commands: Object.fromEntries(Object.entries(commands).map(([name, value]) => [name, {...value, arguments: argumentSchema(name)}])),
    exitCodes: { 0: 'success', 1: 'validation or I/O failure', 2: 'usage failure', 3: 'revision/state conflict or existing output' },
    requirements: {
      runtime: 'Node.js 22 or newer; UI and authoring commands are bundled.',
      capture: 'Install Playwright and its Chromium browser: npm install --global playwright && npx playwright install chromium. Checkout-local, global, and NODE_PATH installations are supported.',
      chromiumOverride: 'Set CHARACTER_STUDIO_CHROMIUM_PATH to an existing Chromium executable if needed.',
      browserAutomation: 'Offline and served UI expose window.characterStudio for character edits and preview camera, lighting, mode, pose, pause, reset, zoom, and capture.',
    },
    workflow: ['catalog and schema', 'create or import', 'inspect and retain revision/stateHash', 'apply --dry-run using both guards', 'apply using those same guards', 'validate', 'doctor --capture and review; reuse replay-plan.json to compare edits', 'export or preview'],
    conventions: { input: 'JSON files; --file - reads stdin', output: 'one JSON object on stdout', units: 'meters; Y-up', mutation: 'atomic validated batches; guarded writes; no prompts', outputFiles: 'new paths only', pointer: 'RFC 6901 JSON pointers; set existing fields, add array items or object fields, remove fields/items; id and schemaVersion immutable' },
    batchExample: { operations: [{ op: 'set', path: '/identity/name', value: 'Moss' }] },
    editing: {randomize: 'Seeded randomize supports all (default), body, or coat scope and respects locks.', reset: 'Reset one named section to its selected preset defaults; identity reset keeps the name, skills reset includes personality, and explicit reset ignores randomization locks.'},
  };
}
