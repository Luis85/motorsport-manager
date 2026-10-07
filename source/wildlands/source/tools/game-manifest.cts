/**
 * The `game.json` manifest grammar (format `wildlands-game`, schemaVersion 1) and its structural
 * validator. `schemas/game.schema.json` is the published JSON Schema of the same grammar; the
 * game-folders suite checks that both accept and reject the same manifests. Every object is
 * closed and every string, array and number is bounded. Semantic rules that need no other file
 * (id/namespace/output agreement, per-template features) are checked here as well.
 */
export type Template = 'colony' | 'rts' | 'pet';
export interface ColonyContent {
 /** Authored balancing document (catalog selectors expand over `assets`). */
 readonly balancing: string;
 /** Asset definition folders: `<family>/<id>/definition.json`. */
 readonly assets: string;
 readonly creatures: {readonly catalog: string; readonly editorFields: string};
 /** Interaction library; must equal the balancing `interactions` section. */
 readonly interactions: string;
 /** Scenario packs in presentation order. */
 readonly packs: readonly string[];
 readonly defaultId: string;
 /** Pack that inherits libraries, simulation, starting scenes and default world from `balancing`. */
 readonly canonicalId?: string;
 readonly skillTree?: string;
 /** Reference adventure libraries: parsed, not admitted (they are written against the item set of their time). */
 readonly adventureExamples?: readonly string[];
}
export interface RtsContent {readonly catalog: string;}
export interface PetContent {readonly catalog: string; readonly assets?: string;}
export interface GameManifest {
 readonly $schema?: string;
 readonly format: 'wildlands-game';
 readonly schemaVersion: 1;
 readonly id: string;
 readonly name: string;
 readonly version: string;
 readonly template: Template;
 readonly engine: {readonly api: 1};
 /** Optional engine feature bundles beyond the template's required set. */
 readonly features?: readonly string[];
 readonly content: ColonyContent | RtsContent | PetContent;
 readonly presentation: {readonly title: string; readonly description?: string; readonly accent?: string};
 /** `wildlands.<id>`; only the `littlewild` game keeps the legacy `littlewild` namespace (legacy save keys). */
 readonly storage: {readonly namespace: string};
 readonly targets: {readonly html: {readonly output: string; readonly budgetBytes: number}; readonly godot?: {readonly engineSources: boolean}};
}

export const MANIFEST_FORMAT = 'wildlands-game';
export const ENGINE_API = 1;
/** Optional engine bundles a template may declare (build-inserts.cts bundle tags). */
export const TEMPLATE_FEATURES: Readonly<Record<Template, readonly string[]>> = Object.freeze({colony: ['storytelling-player', 'renderers-2d'], rts: [], pet: []});
export const MAX_BUDGET_BYTES = 64 * 1024 * 1024;
const ID = /^[a-z][a-z0-9-]{0,63}$/;
const PACK_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SEGMENT = '[a-z0-9][a-z0-9_-]*(?:\\.[a-z0-9_-]+)*';
const JSON_PATH = new RegExp(`^(?:${SEGMENT}/){0,7}${SEGMENT}\\.json$`);
const PACK_PATH = new RegExp(`^(?:${SEGMENT}/){0,7}${SEGMENT}\\.pack\\.json$`);
const DIRECTORY = new RegExp(`^(?:${SEGMENT}/){0,7}${SEGMENT}$`);
const VERSION = /^(?:0|[1-9][0-9]{0,5})\.(?:0|[1-9][0-9]{0,5})\.(?:0|[1-9][0-9]{0,5})(?:-[0-9A-Za-z.-]{1,40})?$/;
const NAMESPACE = /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)*$/;

type Plain = Record<string, unknown>;
const isPlain = (value: unknown): value is Plain => !!value && typeof value === 'object' && !Array.isArray(value);

/** Structural and local semantic errors as `game.json/<pointer>: message`; empty when valid. */
export function manifestErrors(value: unknown): string[] {
 const errors: string[] = [], fail = (where: string, message: string): void => { errors.push('game.json' + where + ': ' + message); };
 function object(input: unknown, where: string, required: readonly string[], optional: readonly string[] = []): Plain | null {
  if (!isPlain(input)) { fail(where, 'must be an object'); return null; }
  for (const key of Object.keys(input)) if (!required.includes(key) && !optional.includes(key)) fail(where, 'unknown field ' + key);
  for (const key of required) if (!Object.hasOwn(input, key)) fail(where, 'missing field ' + key);
  return input;
 }
 function text(input: unknown, where: string, max: number, pattern?: RegExp): input is string {
  const ok = typeof input === 'string' && input.length >= 1 && input.length <= max && (!pattern || pattern.test(input));
  if (!ok) fail(where, pattern ? 'must be a string matching ' + pattern.source : 'must be a string of 1-' + max + ' characters');
  return ok;
 }
 function list(input: unknown, where: string, min: number, max: number, item: (entry: unknown, at: string) => void): void {
  if (!Array.isArray(input) || input.length < min || input.length > max) { fail(where, `must be an array of ${min}-${max} entries`); return; }
  if (new Set(input.map(entry => JSON.stringify(entry))).size !== input.length) fail(where, 'must not repeat entries');
  input.forEach((entry, index) => item(entry, where + '/' + index));
 }
 const top = object(value, '', ['format', 'schemaVersion', 'id', 'name', 'version', 'template', 'engine', 'content', 'presentation', 'storage', 'targets'], ['$schema', 'features']);
 if (!top) return errors;
 if (Object.hasOwn(top, '$schema')) text(top.$schema, '/$schema', 256);
 if (top.format !== MANIFEST_FORMAT) fail('/format', 'must be ' + MANIFEST_FORMAT);
 if (top.schemaVersion !== 1) fail('/schemaVersion', 'must be 1 (newer manifests need a newer engine)');
 const id = text(top.id, '/id', 64, ID) ? top.id as string : null;
 text(top.name, '/name', 80);
 text(top.version, '/version', 64, VERSION);
 const template = (['colony', 'rts', 'pet'] as const).find(entry => entry === top.template) ?? null;
 if (!template) fail('/template', 'must be colony, rts or pet');
 const engine = object(top.engine, '/engine', ['api']);
 if (engine && engine.api !== ENGINE_API) fail('/engine/api', 'must be ' + ENGINE_API + ' (this engine)');
 if (Object.hasOwn(top, 'features')) list(top.features, '/features', 0, 2, (entry, at) => {
  if (!TEMPLATE_FEATURES.colony.includes(entry as string)) fail(at, 'must be one of ' + TEMPLATE_FEATURES.colony.join(', '));
  else if (template && !TEMPLATE_FEATURES[template].includes(entry as string)) fail(at, `is not an optional feature of the ${template} template`);
 });
 if (template === 'colony') {
  const content = object(top.content, '/content', ['balancing', 'assets', 'creatures', 'interactions', 'packs', 'defaultId'], ['canonicalId', 'skillTree', 'adventureExamples']);
  if (content) {
   for (const key of ['balancing', 'interactions', 'skillTree'] as const) if (key !== 'skillTree' || Object.hasOwn(content, key)) text(content[key], '/content/' + key, 255, JSON_PATH);
   text(content.assets, '/content/assets', 255, DIRECTORY);
   const creatures = object(content.creatures, '/content/creatures', ['catalog', 'editorFields']);
   if (creatures) { text(creatures.catalog, '/content/creatures/catalog', 255, JSON_PATH); text(creatures.editorFields, '/content/creatures/editorFields', 255, JSON_PATH); }
   list(content.packs, '/content/packs', 1, 64, (entry, at) => { text(entry, at, 255, PACK_PATH); });
   text(content.defaultId, '/content/defaultId', 64, PACK_ID);
   if (Object.hasOwn(content, 'canonicalId')) text(content.canonicalId, '/content/canonicalId', 64, PACK_ID);
   if (Object.hasOwn(content, 'adventureExamples')) list(content.adventureExamples, '/content/adventureExamples', 1, 16, (entry, at) => { text(entry, at, 255, JSON_PATH); });
  }
 } else if (template) {
  const content = object(top.content, '/content', ['catalog'], template === 'pet' ? ['assets'] : []);
  if (content) { text(content.catalog, '/content/catalog', 255, JSON_PATH); if (Object.hasOwn(content, 'assets')) text(content.assets, '/content/assets', 255, DIRECTORY); }
 }
 const presentation = object(top.presentation, '/presentation', ['title'], ['description', 'accent']);
 if (presentation) {
  text(presentation.title, '/presentation/title', 120);
  if (Object.hasOwn(presentation, 'description')) text(presentation.description, '/presentation/description', 500);
  if (Object.hasOwn(presentation, 'accent')) text(presentation.accent, '/presentation/accent', 7, /^#[0-9a-f]{6}$/);
 }
 const storage = object(top.storage, '/storage', ['namespace']);
 if (storage && text(storage.namespace, '/storage/namespace', 128, NAMESPACE) && id && storage.namespace !== 'wildlands.' + id && !(id === 'littlewild' && storage.namespace === 'littlewild'))
  fail('/storage/namespace', `must be wildlands.${id}${id === 'littlewild' ? ' or the legacy littlewild namespace' : ''}`);
 const targets = object(top.targets, '/targets', ['html'], template === 'colony' ? ['godot'] : []);
 if (targets) {
  const html = object(targets.html, '/targets/html', ['output', 'budgetBytes']);
  if (html) {
   if (text(html.output, '/targets/html/output', 80, /^demos\/[a-z][a-z0-9-]{0,63}\.html$/) && id && html.output !== `demos/${id}.html`) fail('/targets/html/output', `must be demos/${id}.html`);
   if (!Number.isSafeInteger(html.budgetBytes) || (html.budgetBytes as number) < 1 || (html.budgetBytes as number) > MAX_BUDGET_BYTES) fail('/targets/html/budgetBytes', 'must be an integer of 1-' + MAX_BUDGET_BYTES + ' bytes');
  }
  if (Object.hasOwn(targets, 'godot')) {
   const godot = object(targets.godot, '/targets/godot', ['engineSources']);
   if (godot && typeof godot.engineSources !== 'boolean') fail('/targets/godot/engineSources', 'must be a boolean');
  }
 }
 return errors;
}
