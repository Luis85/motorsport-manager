/// <reference path="../rts-contracts.d.ts" />
/**
 * `wildlands generate`: deterministic procedural content for game folders, agent first.
 *
 * `discover` describes generators, presets, bounded parameters, recipe schemas, errors and
 * examples. A generator reads one canonical content file of a game folder, adds generated records
 * that reference only what the game already defines, and publishes through tools/generate-write.cts:
 * `--dry-run` (validate, write nothing), `--expected-digest HEX` (guarded in-place replacement of that
 * one file) or `--output NEW.json` (the whole proposed file, outside the folder). The same game,
 * recipe and seed always produce the same bytes. Exit codes follow the engine CLI: 0 success,
 * 1 rejected input (folder, digest, generated content), 2 usage.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {emit, readJsonFile} from './cli-io.cjs';
import {DEFAULT_SEED, SEED_MAX} from './generate-random.cjs';
import {GenerateError} from './generate-rts-terrain.cjs';
import {RTS_LIMITS, RTS_PRESETS, generateMission, type RtsRecipe} from './generate-rts.cjs';
import {ADVENTURE_LIMITS, generateQuests, type AdventureRecipe} from './generate-adventure.cjs';
import {publishCopy, publishInPlace, readCanonical, serialize, stageAndValidate} from './generate-write.cjs';
import {discovery} from './generate-discovery.cjs';

type Plain = Record<string, unknown>;
const MODES = ['--dry-run', '--expected-digest', '--output'] as const;
const commands: Readonly<Record<string, readonly string[]>> = {
 discover: [],
 'rts-mission': ['--game', '--mission', '--seed', '--preset', '--width', '--height', '--difficulty', '--name', '--recipe', '--replace', '--first', ...MODES],
 'adventure-quests': ['--game', '--count', '--seed', '--tier', '--biome', '--recipe', '--replace', ...MODES]
};
const switches = new Set(['--dry-run', '--replace', '--first']);
const ID = /^[a-z][a-z0-9_-]{0,63}$/;
const usage = (message: string): GenerateError => new GenerateError('generate-usage', message, 2);

function parse(command: string, args: readonly string[]): Map<string, string> {
 const values = new Map<string, string>();
 for (let index = 0; index < args.length; index++) {
  const flag = args[index]!;
  if (!commands[command]!.includes(flag)) throw usage(`Unknown option for generate ${command}: ${flag}. Use wildlands generate discover.`);
  if (values.has(flag)) throw usage('Duplicate option: ' + flag);
  if (switches.has(flag)) { values.set(flag, 'true'); continue; }
  const value = args[++index];
  if (value === undefined || value.startsWith('--')) throw usage('Missing value for ' + flag);
  values.set(flag, value);
 }
 if (!values.has('--game')) throw usage(`generate ${command} needs --game DIR (a game folder such as docs/concepts/rts-frontier).`);
 if (MODES.filter(mode => values.has(mode)).length !== 1) throw usage('Choose exactly one of --dry-run, --expected-digest HEX (in place) and --output NEW.json.');
 if (values.has('--expected-digest') && !/^[0-9a-f]{64}$/.test(values.get('--expected-digest')!)) throw usage('--expected-digest must be the 64-character hex digest that inspect-game reports.');
 return values;
}
function whole(raw: unknown, label: string, [low, high]: readonly [number, number]): number {
 const value = typeof raw === 'string' && /^\d{1,10}$/.test(raw) ? Number(raw) : raw;
 if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < low || value > high) throw usage(`${label} must be a whole number from ${low} to ${high}.`);
 return value;
}
function text(raw: unknown, label: string, max: number): string {
 if (typeof raw !== 'string' || !raw.trim() || raw.length > max) throw usage(`${label} must be text of 1 to ${max} characters.`);
 return raw;
}
/** Recipe file fields, overridden by flags; unknown recipe fields are refused. */
function recipeInput(values: Map<string, string>, generator: string, fields: readonly string[]): Plain {
 const file = values.get('--recipe');
 if (file === undefined) return {};
 let recipe: unknown;
 try { recipe = JSON.parse(readJsonFile(file, 64 * 1024).replace(/^﻿/, '')) as unknown; }
 catch (error) { throw usage('--recipe must be a JSON file of at most 64 KiB: ' + (error instanceof Error ? error.message : String(error))); }
 if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) throw usage('A generate recipe is a JSON object.');
 const plain = recipe as Plain;
 if (plain.schemaVersion !== 1 || plain.generator !== generator) throw usage(`The recipe needs schemaVersion 1 and generator "${generator}".`);
 const unknown = Object.keys(plain).filter(key => !['schemaVersion', 'generator', ...fields].includes(key));
 if (unknown.length) throw usage('Unknown recipe fields: ' + unknown.join(', ') + '.');
 // Recipe numbers are JSON numbers (the discovered schema); only flags arrive as text.
 const strings = ['mission', 'preset', 'name', 'playerFaction', 'opponentFaction', 'neutralFaction', 'biome'];
 for (const key of fields) if (plain[key] !== undefined && typeof plain[key] !== (strings.includes(key) ? 'string' : 'number')) throw usage(`Recipe ${key} must be a ${strings.includes(key) ? 'string' : 'number'}.`);
 return plain;
}
const flagOr = (values: Map<string, string>, flag: string, recipe: Plain, key: string): unknown => values.has(flag) ? values.get(flag) : recipe[key];
/** Sorted-key JSON, so the recipe hash does not depend on field order. */
const canonical = (value: unknown): string => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
 : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Plain)[key])).join(',') + '}' : JSON.stringify(value);

function rtsRecipe(values: Map<string, string>): RtsRecipe {
 const recipe = recipeInput(values, 'rts-mission', ['mission', 'seed', 'preset', 'width', 'height', 'difficulty', 'name', 'playerFaction', 'opponentFaction', 'neutralFaction']);
 const preset = flagOr(values, '--preset', recipe, 'preset') ?? 'skirmish';
 if (typeof preset !== 'string' || !Object.hasOwn(RTS_PRESETS, preset)) throw usage('--preset must be one of ' + Object.keys(RTS_PRESETS).join(', ') + '.');
 const mission = flagOr(values, '--mission', recipe, 'mission');
 if (typeof mission !== 'string' || !ID.test(mission)) throw usage('--mission must be a mission id: a lowercase letter, then up to 63 lowercase letters, digits, - or _.');
 const out: RtsRecipe = {schemaVersion: 1, generator: 'rts-mission', mission, seed: whole(flagOr(values, '--seed', recipe, 'seed') ?? DEFAULT_SEED, '--seed', [0, SEED_MAX]), preset,
  width: whole(flagOr(values, '--width', recipe, 'width') ?? RTS_PRESETS[preset]!.width, '--width', RTS_LIMITS.width),
  height: whole(flagOr(values, '--height', recipe, 'height') ?? RTS_PRESETS[preset]!.height, '--height', RTS_LIMITS.height),
  difficulty: whole(flagOr(values, '--difficulty', recipe, 'difficulty') ?? 2, '--difficulty', RTS_LIMITS.difficulty)};
 const name = flagOr(values, '--name', recipe, 'name');
 if (name !== undefined) out.name = text(name, '--name', 80);
 for (const key of ['playerFaction', 'opponentFaction', 'neutralFaction'] as const) if (recipe[key] !== undefined) {
  if (typeof recipe[key] !== 'string' || !ID.test(recipe[key] as string)) throw usage(`Recipe ${key} must be a faction id.`);
  out[key] = recipe[key] as string;
 }
 return out;
}
function adventureRecipe(values: Map<string, string>): AdventureRecipe {
 const recipe = recipeInput(values, 'adventure-quests', ['seed', 'count', 'tier', 'biome']);
 const count = flagOr(values, '--count', recipe, 'count');
 if (count === undefined) throw usage('generate adventure-quests needs --count N (1 to ' + ADVENTURE_LIMITS.count[1] + ').');
 const out: AdventureRecipe = {schemaVersion: 1, generator: 'adventure-quests', seed: whole(flagOr(values, '--seed', recipe, 'seed') ?? DEFAULT_SEED, '--seed', [0, SEED_MAX]), count: whole(count, '--count', ADVENTURE_LIMITS.count)};
 const tier = flagOr(values, '--tier', recipe, 'tier'), biome = flagOr(values, '--biome', recipe, 'biome');
 if (tier !== undefined) out.tier = whole(tier, '--tier', ADVENTURE_LIMITS.tier);
 if (biome !== undefined) out.biome = text(biome, '--biome', 80);
 return out;
}

interface Folder {root: string; id: string; digest: string; manifest: import('./game-folder.cjs').GameManifest}
function openFolder(directory: string, template: string, generator: string): Folder {
 const folders = require('./game-folder.cjs') as typeof import('./game-folder.cjs');
 let loaded: ReturnType<typeof folders.loadGame>;
 try { loaded = folders.loadGame(directory); }
 catch (error) { throw new GenerateError('invalid-game', error instanceof Error ? error.message : String(error)); }
 if (loaded.manifest.template !== template) throw new GenerateError('wrong-template', `generate ${generator} needs a ${template} game; ${loaded.manifest.id} uses the ${loaded.manifest.template} template.`);
 return {root: loaded.root, id: loaded.manifest.id, digest: loaded.digest, manifest: loaded.manifest};
}

/** The adventure library a colony game plays: the canonical balancing defaults, else its complete default pack. */
function adventureFile(folder: Folder): {file: string; locate: (document: Plain) => Plain} {
 const content = folder.manifest.content as import('./game-manifest.cjs').ColonyContent;
 const library = (document: Plain): Plain | null => {
  const libraries = document.libraries as Plain | undefined, adventure = libraries?.adventure;
  return adventure && typeof adventure === 'object' && !Array.isArray(adventure) ? adventure as Plain : null;
 };
 // Without a canonical pack, the complete default pack carries the library the game plays.
 const packFile = content.canonicalId === undefined ? content.packs.find(file => {
  try { return (JSON.parse(fs.readFileSync(path.join(folder.root, file), 'utf8')) as Plain).id === content.defaultId; } catch { return false; }
 }) : undefined;
 const file = packFile && library(readCanonical(folder.root, packFile).value as Plain) ? packFile : content.balancing;
 return {file, locate: document => { const found = library(document); if (!found) throw new GenerateError('unsupported-catalog', file + ' has no libraries.adventure section.'); return found; }};
}

/** A shell word: bare when safe, else JSON-quoted. */
const word = (text: string): string => /^[A-Za-z0-9_./-]+$/.test(text) ? text : JSON.stringify(text);
/** Flags that replay the effective recipe; recipe-only fields (factions) need the recipe file instead. */
function replayFlags(recipe: Plain): string {
 const flags: Record<string, string> = {mission: '--mission', seed: '--seed', preset: '--preset', width: '--width', height: '--height', difficulty: '--difficulty', name: '--name', count: '--count', tier: '--tier', biome: '--biome'};
 if (['playerFaction', 'opponentFaction', 'neutralFaction'].some(key => recipe[key] !== undefined)) return '--recipe RECIPE.json (the recipe field of this result)';
 return Object.entries(flags).filter(([key]) => recipe[key] !== undefined).map(([key, flag]) => flag + ' ' + word(String(recipe[key]))).join(' ');
}

function generate(command: string, values: Map<string, string>): void {
 const generator = command, rts = command === 'rts-mission';
 const recipe = rts ? rtsRecipe(values) : adventureRecipe(values);
 const folder = openFolder(values.get('--game')!, rts ? 'rts' : 'colony', generator), expected = values.get('--expected-digest');
 if (expected !== undefined && expected !== folder.digest) throw new GenerateError('stale-digest', `The game folder digest is ${folder.digest}, not --expected-digest ${expected}. Inspect the folder again (inspect-game or a --dry-run) before writing.`);
 const target = rts ? {file: (folder.manifest.content as import('./game-manifest.cjs').RtsContent).catalog, locate: (document: Plain) => document} : adventureFile(folder);
 const source = readCanonical(folder.root, target.file), document = JSON.parse(source.text) as Plain, section = target.locate(document);
 let generated: unknown, summary: Record<string, unknown>, replaced: string[] = [];
 if (rts) {
  const catalogApi = require('../rts-catalog.js') as LWRTSData.CatalogApi, rtsRecipeValue = recipe as RtsRecipe;
  let catalog: LWRTSData.Catalog;
  try { catalog = catalogApi.validate(document); } catch (error) { throw new GenerateError('invalid-game', error instanceof Error ? error.message : String(error)); }
  ({mission: generated, summary} = generateMission(catalog, rtsRecipeValue));
  const missions = section.missions as Plain[], index = missions.findIndex(mission => mission.id === rtsRecipeValue.mission);
  if (index >= 0 && !values.has('--replace')) throw new GenerateError('duplicate-id', `Mission ${rtsRecipeValue.mission} already exists in ${target.file}; pass --replace to regenerate it in place or choose another --mission.`);
  if (index >= 0) { missions.splice(index, 1); replaced = [rtsRecipeValue.mission]; }
  // The play build starts the first mission; --first makes the generated one that mission, otherwise it keeps its place or is appended.
  if (values.has('--first')) missions.unshift(generated as Plain); else missions.splice(index >= 0 ? index : missions.length, 0, generated as Plain);
 } else {
  ({quests: generated, summary} = generateQuests(section, recipe as AdventureRecipe));
  const quests = section.quests as Plain[], fresh = generated as Plain[];
  replaced = fresh.map(quest => quest.id as string).filter(id => quests.some(quest => quest.id === id));
  if (replaced.length && !values.has('--replace')) throw new GenerateError('duplicate-id', `Quests ${replaced.join(', ')} already exist in ${target.file}; pass --replace to regenerate them in place or choose another --seed.`);
  for (const quest of fresh) { const index = quests.findIndex(entry => entry.id === quest.id); if (index >= 0) quests[index] = quest; else quests.push(quest); }
  if (quests.length > ADVENTURE_LIMITS.quests) throw new GenerateError('generate-budget', `The adventure library would hold ${quests.length} quests; the engine admits at most ${ADVENTURE_LIMITS.quests}.`);
 }
 const proposed = serialize(document, source.style), staged = stageAndValidate(folder.root, folder.id, target.file, proposed);
 const recipeHash = createHash('sha256').update(canonical(recipe)).digest('hex'), bytes = Buffer.byteLength(proposed);
 let output: string | null = null;
 if (expected !== undefined) output = publishInPlace(folder.root, target.file, proposed, expected);
 else if (values.has('--output')) output = publishCopy(folder.root, values.get('--output')!, proposed);
 const game = word(values.get('--game')!), replay = replayFlags(recipe as unknown as Plain) + (values.has('--first') ? ' --first' : '');
 emit({ok: true, protocolVersion: 1, generator, game: folder.id, file: target.file, seed: recipe.seed, recipe, recipeHash, digest: folder.digest, proposedDigest: staged.proposedDigest,
  dryRun: values.has('--dry-run'), written: expected !== undefined, output, bytes, sha256: createHash('sha256').update(proposed).digest('hex'), replaced, summary, generated,
  nextCommands: expected !== undefined ? [`wildlands validate-game --game ${game}`, `wildlands build-game --game ${game} --output OUT.html`]
   : [`wildlands generate ${generator} --game ${game} ${replay} --expected-digest ${folder.digest}${replaced.length ? ' --replace' : ''}`]});
}

export function run(args: readonly string[]): void {
 try {
  const help = args.length === 0 || (args.length === 1 && ['--help', '-h', 'discover'].includes(args[0]!));
  if (help) { emit({ok: true, protocolVersion: 1, ...discovery()}); return; }
  const command = args[0]!;
  if (command === 'discover') throw usage('generate discover takes no options.');
  if (!Object.hasOwn(commands, command)) throw usage('Unknown generate command ' + command + '; use wildlands generate discover.');
  generate(command, parse(command, args.slice(1)));
 } catch (error) {
  const known = error instanceof GenerateError ? error : null;
  emit({ok: false, protocolVersion: 1, code: known?.code ?? 'operation-failed', errors: [error instanceof Error ? error.message : String(error)], handbook: 'docs/reference/wildlands-cli.md#generate'});
  process.exitCode = known?.exit ?? 2;
 }
}
