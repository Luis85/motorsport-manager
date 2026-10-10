/// <reference path="../creature-editor-contracts.d.ts" />
/// <reference path="../wildlands-project-contracts.d.ts" />
/** File adapter for the existing detached creature editor; never edits a game folder or live save. */
import {readJsonFile, writeJsonFile, emit} from './cli-io.cjs';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {visualSummary} from './creature-visual-summary.cjs';

const selection = ['--scene', '--archetype', '--instance'];
const project = ['--project', '--game'];
const mutation = ['--expected-fingerprint', '--output', '--dry-run'];
export const options: Record<string, readonly string[]> = {
 'creature-list': project,
 'creature-inspect': [...project, ...selection, '--summary'],
 'creature-export': [...project, ...selection, '--output'],
 'creature-import': [...project, ...selection, ...mutation, '--file', '--replace'],
 'creature-edit': [...project, ...selection, ...mutation, '--recipe'],
 'creature-attach-visual': [...project, ...selection, ...mutation, '--file'],
};
const descriptions: Record<string, string> = {
 list: 'List archetypes, scenes and companion selections without advancing time.',
 inspect: 'Inspect a complete creature package, editable fields and project fingerprint. --summary returns compact visual/material facts without mesh buffers.',
 export: 'Export the selected creature package, including companion state only with --instance.',
 import: 'Validate and install a creature package into a new portable project; --replace authorizes changed existing resources.',
 edit: 'Apply a bounded native creature-editor recipe atomically into a new portable project.',
 'attach-visual': 'Replace the selected appearance from a Scene Forge definition or raw actor visual, retaining gameplay, rig context and companions.',
};
export function discover(): Record<string, unknown> {
 return {commands: Object.entries(options).map(([key, flags]) => ({
  command: key.replace('-', ' '), description: descriptions[key.slice(9)],
  flags: flags.map(flag => ({flag, type: ['--dry-run', '--replace', '--summary'].includes(flag) ? 'boolean' : 'string'})),
  required: ['--project', ...key === 'creature-import' ? ['--file', '--expected-fingerprint'] : key === 'creature-attach-visual' ? ['--file', '--archetype', '--expected-fingerprint'] : key === 'creature-edit' ? ['--recipe', '--archetype', '--expected-fingerprint'] : key === 'creature-list' ? [] : ['--archetype'], ...key === 'creature-export' ? ['--output'] : []],
 })), packageFormat: 'littlewild-creature-package', schemaVersion: 1,
  selection: {scene: 'Defaults to the project scene.', archetype: 'Required except list and import; import can select an existing seed automatically.', instance: 'Optional existing companion ID in the selected scene; never creates a live companion.'},
  recipe: {format: 'wildlands-creature-recipe', schemaVersion: 1, maxOperations: 256,
   operations: [{op: 'setField', fields: ['id', 'value']}, ...['updateDefinition', 'updateAppearance', 'updateInstance'].map(op => ({op, fields: ['value']})), {op: 'duplicateArchetype', fields: ['id', 'name']}],
   example: {format: 'wildlands-creature-recipe', schemaVersion: 1, operations: [{op: 'updateDefinition', value: {name: 'Moss'}}]}},
  persistence: 'Mutations require the fingerprint from list/inspect. Pass exactly one of --dry-run or --output NEW_PROJECT. Source projects and package inputs are never overwritten. Keep successive projects as history; select an earlier file to undo.',
  dependencies: 'Reopening a project exports its item asset catalog as package references; imports preserve unrelated existing item assets, so re-export may contain additional unchanged references.',
  errors: {code: 'operation-failed', exit: 2, conflicts: 'Inspect the source again and reconsider the edit; never retry stale guards blindly.'},
 };
}
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const required = (values: Map<string,string>, key: string): string => {
 const value = values.get(key); if (!value) throw Error('Missing required option: ' + key); return value;
};
/** Publish a complete version exactly once; concurrent agents cannot replace its history. */
function publish(file: string, value: unknown): string {
 const destination = path.resolve(file), temporary = destination + '.' + randomUUID() + '.pending';
 if (fs.existsSync(destination)) throw Error('Output already exists. Choose a new versioned destination: ' + destination);
 try {
  writeJsonFile(temporary, value);
  fs.linkSync(temporary, destination);
  return destination;
 } finally {fs.rmSync(temporary, {force:true});}
}
function exact(value: RecordValue, keys: string[]): void {
 if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw Error('Missing or unknown creature recipe fields: expected ' + keys.join(', ') + '.');
}
function applyRecipe(session: LWCreatureEditor.Session, text: string): void {
 const content = (globalThis as unknown as {LWContent: LWContentPorts.ContentApi}).LWContent;
 const recipe = record(content.parse(text, 1024 * 1024));
 exact(recipe, ['format', 'schemaVersion', 'operations']);
 if (recipe.format !== 'wildlands-creature-recipe' || recipe.schemaVersion !== 1 || !Array.isArray(recipe.operations) || !recipe.operations.length || recipe.operations.length > 256) throw Error('Use wildlands-creature-recipe schemaVersion 1 with 1–256 operations.');
 for (const [index, value] of recipe.operations.entries()) {
  try {
   const operation = record(value);
   if (operation.op === 'setField') {
    exact(operation, ['op', 'id', 'value']);
    if (typeof operation.id !== 'string') throw Error('Field id must be a string from creature inspect.');
    session.setField(operation.id, operation.value);
   } else if (operation.op === 'duplicateArchetype') {
    exact(operation, ['op', 'id', 'name']);
    if (typeof operation.id !== 'string' || typeof operation.name !== 'string') throw Error('Archetype id and name must be strings.');
    session.duplicateArchetype(operation.id, operation.name);
   } else if (['updateDefinition', 'updateAppearance', 'updateInstance'].includes(String(operation.op))) {
    exact(operation, ['op', 'value']);
    if (!operation.value || typeof operation.value !== 'object' || Array.isArray(operation.value)) throw Error('Patch value must be an object.');
    const patch = operation.value as RecordValue;
    if (operation.op === 'updateDefinition') session.updateDefinition(patch);
    else if (operation.op === 'updateAppearance') session.updateAppearance(patch);
    else session.updateInstance(patch);
   } else throw Error('Unknown creature operation; use creature discover.');
  } catch (error) { throw Error('Creature operation ' + index + ': ' + (error instanceof Error ? error.message : String(error))); }
 }
}
export function run(command: string, values: Map<string,string>, loaded: Wildlands.AnyProject, fingerprint: string): void {
 const SDK = require('../wildlands-project-sdk.cjs') as typeof import('../wildlands-project-sdk.cjs');
 const api = require('../creature-editor.js') as LWCreatureEditor.Api;
 const graph = require('../scene-graph.js') as LWSceneGraph.Api;
 const root = globalThis as unknown as {LWContent: LWContentPorts.ContentApi; LWScenarioResources: {snapshot(): LWContentPorts.Resources}};
 const resources = loaded.pack.resources ?? root.LWScenarioResources.snapshot();
 const definitions = resources.creatures.definitions.map(record);
 const sceneId = values.get('--scene') ?? loaded.sceneId;
 const summary = {ok: true, protocolVersion: 1, projectId: loaded.id, fingerprint};
 if (command === 'creature-list') {
  emit({...summary, archetypes: definitions.map(value => ({id: value.id, name: value.name, visualAsset: value.visualAsset})), scenes: loaded.pack.scenes.map(scene => {
   const actors = record(graph.owner(loaded.pack, scene.id).initialState.colony).creatures;
   return {id: scene.id, name: scene.name, companions: Array.isArray(actors) ? actors.map(value => {const actor = record(value); return {id: actor.id, name: actor.name, archetype: actor.archetype};}) : []};
  })}); return;
 }
 const archetypeId = values.get('--archetype') ?? (command === 'creature-import' ? String(definitions[0]?.id ?? '') : required(values, '--archetype'));
 const instanceId = values.get('--instance');
 const session = api.create(loaded.pack, {sceneId, archetypeId, ...(instanceId ? {instanceId} : {})});
 if (command === 'creature-inspect') {
  const packaged = session.exportPackage();
  emit({...summary, selection: session.selection, ...(values.has('--summary')
   ? {visual: visualSummary(packaged.appearanceManifest), next: 'Use creature inspect without --summary for the complete editable package and fields; use creature export --output NEW.json to save it.'}
   : {package: packaged, fields: session.fields()})}); return;
 }
 if (command === 'creature-export') {
  const output = publish(required(values, '--output'), session.exportPackage());
  emit({...summary, output, selection: session.selection, format: 'littlewild-creature-package'}); return;
 }
 const expected = required(values, '--expected-fingerprint');
 if (expected !== fingerprint) throw Error('Project fingerprint conflict: expected ' + expected + ', observed ' + fingerprint + '. Run creature inspect again and reconsider the edit.');
 const outputFile = values.get('--output'), dryRun = values.has('--dry-run');
 if (dryRun === Boolean(outputFile)) throw Error('Choose exactly one of --dry-run or --output NEW_PROJECT.json.');
 const file = required(values, command === 'creature-edit' ? '--recipe' : '--file');
 const text = readJsonFile(file, command === 'creature-edit' ? 1024 * 1024 : 2 * 1024 * 1024);
 const replacements: string[] = [];
 if (command === 'creature-import') {
  const checked = api.validatePackage(text, {pack: loaded.pack, selection: session.selection});
  if (!checked.ok || !checked.package) throw Error(checked.errors.join('\n'));
  const value = checked.package;
  const current = definitions.find(item => item.id === value.gameplayDefinition.id);
  if (current && root.LWContent.stable(current) !== root.LWContent.stable(value.gameplayDefinition)) replacements.push('archetype:' + String(current.id));
  for (const asset of [value.appearanceManifest, ...value.assetReferences]) {
   const next = record(asset), previous = resources.assets.map(record).find(item => item.category === next.category && item.id === next.id);
   if (previous && root.LWContent.stable(previous) !== root.LWContent.stable(next)) replacements.push('asset:' + String(next.category) + ':' + String(next.id));
  }
  if (replacements.length && !values.has('--replace')) throw Error('Existing resources would change: ' + replacements.join(', ') + '. Review the package and pass --replace to authorize replacement.');
  session.importPackage(value);
 } else if (command === 'creature-attach-visual') {
  const source = record(root.LWContent.parse(text, 2 * 1024 * 1024));
  const visual = source.format === 'littlewild-definition' && source.schemaVersion === 1 ? record(source.visual) : source;
  const current = session.exportPackage();
  if (visual.format !== 'littlewild-3d-asset' || visual.id !== current.appearanceManifest.id) throw Error('Attach a Littlewild actor visual with the selected visual asset ID ' + current.appearanceManifest.id + '. Export Scene Forge changes into the original definition to retain all variants and rig bindings.');
  session.importPackage({...current, appearanceManifest: visual});
  replacements.push('asset:actor:' + current.appearanceManifest.id);
 } else applyRecipe(session, text);
 const next = SDK.projects.capture(loaded, session.exportScenario(), loaded.sceneId), checked = SDK.projects.validate(next);
 if (!checked.ok) throw Error(checked.errors.join('\n'));
 const output = dryRun ? null : publish(outputFile!, next);
 emit({...summary, dryRun, output, proposedFingerprint: checked.fingerprint, selection: session.selection, revision: session.revision, replacements,
  preservation: 'Source project and input package/recipe retained; importing an archetype does not create a live companion.'});
}
