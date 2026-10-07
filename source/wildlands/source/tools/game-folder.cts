/// <reference path="../content-provider-contracts.d.ts" />
/**
 * Build-only game folder tooling. A game folder (`docs/concepts/<id>/`) is data only: a
 * `game.json` manifest (`schemas/game.schema.json`, format `wildlands-game`, schemaVersion 1),
 * the JSON documents it names, its asset definition folders and README/PROVENANCE/LICENSE files
 * (README.md is documentation and is not part of the folder digest).
 * Nothing in a folder is executed or imported: files are read as bytes, decoded as strict UTF-8
 * and parsed as JSON. The closed inventory rejects every other file, code or markup, executable
 * modes, symbolic links and oversized trees before any document is interpreted.
 *
 * `compileGame` projects a folder into the `LWContentProvider` profile and the artifact data
 * globals with the same projections the bundled build always used (definition discovery,
 * `$catalog` expansion, library schema derivation, creature and asset projections). Engine-owned
 * schemas stay in `source/content`. `validateGame` adds the engine's runtime validators in a fresh
 * process (one installed game per realm); it needs a prior `npm run build`.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {definitions, read, record, type Definition, type RecordValue} from './definition-source.cjs';
import {contentDocuments} from './bundled-content.cjs';
import {assetDefinitions, creatureConfig, creatureDefinitions, petAssetDefinitions} from './bundled-assets.cjs';
import {manifestErrors, type GameManifest, type ColonyContent, type RtsContent, type PetContent, type ProcessContent} from './game-manifest.cjs';

export type {GameManifest} from './game-manifest.cjs';
type Profile = LWContentProvider.Profile;

/** Project root (source/wildlands) from both `source/tools` (tsx) and `.generated/tools`. */
const PROJECT = path.resolve(__dirname, '../..');
/** Engine-owned authored source (schemas and engine metadata; no game data). */
export const ENGINE_SOURCE = path.join(PROJECT, 'source');
/**
 * Games the engine build composes into its fixtures (the composite showcase, the transitional
 * installers) and engine-source payload, in showcase order: colony packs appear in this order.
 */
export const BUNDLED_GAMES = ['littlewild', 'emberworks', 'office', 'rts-frontier', 'pocket-pet', 'agency-delivery'] as const;
/** Inventory bounds: folders are reviewable data, not archives. */
export const LIMITS = Object.freeze({files: 2048, fileBytes: 8 * 1024 * 1024, totalBytes: 32 * 1024 * 1024, depth: 8});
const DOCUMENT = /^(?:README\.md|PROVENANCE\.md|LICENSE(?:[.-][A-Za-z0-9.-]{1,32})?)$/;
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
/** Code, markup and binaries a v1 data-only folder never contains (checked before references). */
const CODE = /\.(?:[cm]?[jt]sx?|html?|xhtml|css|svg|wasm|node|sh|bash|zsh|fish|ps1|psm1|bat|cmd|com|exe|dll|so|dylib|py|pyc|rb|pl|php|lua|jar|class|gd|gdextension)$/i;
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export interface GameFile {readonly path: string; readonly bytes: number; readonly sha256: string;}
export interface LoadedGame {
 readonly root: string;
 readonly manifest: GameManifest;
 /** Closed inventory in byte order of path. */
 readonly files: readonly GameFile[];
 /**
  * SHA-256 over `path NUL sha256 LF` lines of `files` except README.md files: byte-based, so any
  * edit of game input (also whitespace or key order, or PROVENANCE/LICENSE text) changes it.
  */
 readonly digest: string;
}
export interface CompiledGame extends LoadedGame {
 readonly profile: Profile;
 /** Artifact data globals (`artifact-profiles.cts` DATA_GLOBALS names) for this game, including LWGameProfile. */
 readonly data: ReadonlyMap<string, unknown>;
 /** Colony only: generated `.generated/content` documents keyed by name (without `.json`). */
 readonly documents?: RecordValue;
 /** Discovered asset definitions of the folder. */
 readonly packages: readonly Definition[];
}

/** Directory holding game folders: `WILDLANDS_GAMES_DIR`, else the repository's `docs/concepts`. */
export function gamesRoot(): string {
 const override = process.env.WILDLANDS_GAMES_DIR;
 return override ? path.resolve(override) : path.resolve(PROJECT, '../../docs/concepts');
}
export function gameDirectory(id: string): string {
 if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) throw Error('Invalid game id: ' + id);
 const directory = path.join(gamesRoot(), id);
 if (!fs.existsSync(path.join(directory, 'game.json')))
  throw Error(`Game folder ${id} was not found at ${directory}; set WILDLANDS_GAMES_DIR to the directory that holds game folders.`);
 return directory;
}

const sha256 = (data: Uint8Array | string): string => createHash('sha256').update(data).digest('hex');
/**
 * README.md files document a folder; they are not game input. They stay in the closed inventory and
 * its size limits but not in the digest, so editing one leaves the digest and every demo built from
 * the folder unchanged. PROVENANCE.md and LICENSE* files are licence-relevant and stay in it.
 */
export const DIGEST_EXCLUDED = /(?:^|\/)README\.md$/;
export function digest(files: readonly GameFile[]): string {
 return sha256([...files].filter(file => !DIGEST_EXCLUDED.test(file.path)).sort((a, b) => compare(a.path, b.path))
  .map(file => file.path + '\0' + file.sha256 + '\n').join(''));
}
function text(root: string, relative: string): string {
 try { return new TextDecoder('utf-8', {fatal: true}).decode(fs.readFileSync(path.join(root, relative))); }
 catch { throw Error('Game folder file is not UTF-8 text: ' + relative); }
}
function json(root: string, relative: string): unknown {
 try { return JSON.parse(text(root, relative)) as unknown; }
 catch (error) { throw Error('Game folder file is not valid JSON: ' + relative + (error instanceof SyntaxError ? ' (' + error.message + ')' : '')); }
}

/** Every regular file under `root`, rejecting links, special files, hidden or odd names and size/depth bounds. */
function walk(root: string): {path: string; bytes: number; mode: number}[] {
 const found: {path: string; bytes: number; mode: number}[] = [];
 let total = 0;
 const visit = (relative: string, depth: number): void => {
  if (depth > LIMITS.depth) throw Error('Game folder is nested deeper than ' + LIMITS.depth + ' levels: ' + relative);
  for (const name of fs.readdirSync(path.join(root, relative)).sort(compare)) {
   const child = relative ? relative + '/' + name : name, stat = fs.lstatSync(path.join(root, child));
   if (!SEGMENT.test(name)) throw Error('Game folder entry has an unsupported name: ' + child);
   if (stat.isSymbolicLink()) throw Error('Game folder entry is a symbolic link: ' + child);
   if (stat.isDirectory()) { visit(child, depth + 1); continue; }
   if (!stat.isFile()) throw Error('Game folder entry is not a regular file: ' + child);
   if (CODE.test(name)) throw Error('Game folder contains code or markup, which data-only game folders do not allow: ' + child);
   if (stat.mode & 0o111) throw Error('Game folder file is executable: ' + child);
   if (stat.size > LIMITS.fileBytes) throw Error('Game folder file exceeds ' + LIMITS.fileBytes + ' bytes: ' + child);
   total += stat.size;
   if (total > LIMITS.totalBytes) throw Error('Game folder exceeds ' + LIMITS.totalBytes + ' bytes.');
   found.push({path: child, bytes: stat.size, mode: stat.mode});
   if (found.length > LIMITS.files) throw Error('Game folder exceeds ' + LIMITS.files + ' files.');
  }
 };
 visit('', 0);
 return found.sort((a, b) => compare(a.path, b.path));
}

/** Files the manifest names (JSON documents), plus `game.json`; asset folders are expanded separately. */
function referenced(manifest: GameManifest): {files: string[]; assets: string | null} {
 const content = manifest.content;
 if (manifest.template === 'colony') {
  const colony = content as ColonyContent;
  return {assets: colony.assets, files: ['game.json', colony.balancing, colony.creatures.catalog, colony.creatures.editorFields,
   colony.interactions, ...colony.packs, ...colony.skillTree ? [colony.skillTree] : [], ...colony.adventureExamples ?? []]};
 }
 if (manifest.template === 'process') return {assets: null, files: ['game.json', (content as ProcessContent).definition]};
 if (manifest.template === 'pet') { const pet = content as PetContent; return {assets: pet.assets ?? null, files: ['game.json', pet.catalog]}; }
 return {assets: null, files: ['game.json', (content as RtsContent).catalog]};
}

/** Load and check a folder: inventory bounds, manifest grammar and semantics, closed file inventory. */
export function loadGame(directory: string): LoadedGame {
 const root = path.resolve(directory);
 if (fs.lstatSync(root).isSymbolicLink() || !fs.statSync(root).isDirectory()) throw Error('Game folder must be a real directory: ' + root);
 const entries = walk(root);
 if (!entries.some(entry => entry.path === 'game.json')) throw Error('Game folder has no game.json manifest: ' + root);
 const value = json(root, 'game.json'), errors = manifestErrors(value);
 if (errors.length) throw Error('Invalid game.json: ' + errors.join('; '));
 const manifest = value as GameManifest;
 if (manifest.id !== path.basename(root)) throw Error(`Game id ${manifest.id} must equal its folder name ${path.basename(root)}.`);
 const {files, assets} = referenced(manifest), names = new Set(files);
 if (names.size !== files.length) throw Error('game.json names a file more than once.');
 const assetFile = assets ? new RegExp('^' + assets.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/(?:items|buildings|creatures|pets)/[a-z0-9][a-z0-9_-]{0,60}/definition\\.json$') : null;
 for (const file of files) if (!entries.some(entry => entry.path === file)) throw Error('game.json names a missing file: ' + file);
 for (const entry of entries) {
  const allowed = names.has(entry.path) || assetFile?.test(entry.path) || DOCUMENT.test(path.posix.basename(entry.path));
  if (!allowed) throw Error('Game folder file is not referenced by game.json: ' + entry.path);
  if (entry.path.endsWith('.md')) text(root, entry.path);
 }
 const inventory = entries.map(entry => ({path: entry.path, bytes: entry.bytes, sha256: sha256(fs.readFileSync(path.join(root, entry.path)))}));
 return {root, manifest, files: inventory, digest: digest(inventory)};
}

/**
 * Engine-owned schemas as literal requires (detached copies), so a bundled distribution
 * (`bin/wildlands`, tools/cli-bundle.cts) embeds exactly these engine documents and builds games
 * without a source checkout. Resolves to source/content under tsx and .generated/content compiled.
 */
const ENGINE_SCHEMAS: Readonly<Record<string, () => unknown>> = {
 'library.schema.json': () => require('../content/library.schema.json'),
 'adventure.schema.json': () => require('../content/adventure.schema.json'),
 'world.schema.json': () => require('../content/world.schema.json'),
 'simulation.schema.json': () => require('../content/simulation.schema.json'),
 'growth.schema.json': () => require('../content/growth.schema.json'),
 'scenario.schema.json': () => require('../content/scenario.schema.json')
};
const engineSchema = (name: string): unknown => plain(ENGINE_SCHEMAS[name]!());

/**
 * The authored engine content directory, checked for standalone library mirrors, when this is a
 * checkout. A bundled distribution has no such tree (and may not be allowed to look for one).
 */
function engineContent(): string[] {
 const directory = path.join(ENGINE_SOURCE, 'content');
 try { return fs.statSync(directory).isDirectory() ? [directory] : []; } catch { return []; }
}

/** Colony projection: balancing defaults, compiled library schema, creature/asset catalogs and the scenario catalog. */
function colony(game: LoadedGame): CompiledGame {
 const content = game.manifest.content as ColonyContent, file = (relative: string): string => path.join(game.root, relative);
 const packs = content.packs.map(relative => json(game.root, relative)), ids = packs.map(pack => record(pack) ? pack.id : undefined);
 if (ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) throw Error('Scenario packs need unique string ids.');
 for (const id of [content.defaultId, content.canonicalId]) if (id !== undefined && !ids.includes(id)) throw Error('Scenario catalog names an unknown pack: ' + id);
 const canonical = content.canonicalId === undefined ? undefined : content.packs[ids.indexOf(content.canonicalId)]!;
 const packages = definitions(file(content.assets));
 const documents = contentDocuments({balancing: file(content.balancing), ...canonical ? {templatePack: file(canonical)} : {},
  librarySchema: {document: engineSchema('library.schema.json')}, contentDirectories: [...engineContent(), file('content')], packages});
 const balance = documents.balancing as RecordValue & {libraries: RecordValue & {base: unknown; adventure: unknown; world: unknown; growth: unknown}; simulation: RecordValue & {rules: {actor: unknown; economy: unknown}}};
 // Skill tree and adventure examples are not profile sections: parse them here, admit the tree in validateGame.
 for (const relative of [...content.skillTree ? [content.skillTree] : [], ...content.adventureExamples ?? []]) json(game.root, relative);
 const interactions = json(game.root, content.interactions);
 if (JSON.stringify(interactions) !== JSON.stringify(balance.interactions)) throw Error('The interaction catalog must equal the balancing interactions section (one authority).');
 const template = canonical ? path.posix.basename(canonical, '.json') : null;
 const scenarioPacks = packs.map((pack, index) => content.packs[index] === canonical ? documents[template!] : pack);
 const creatures = {configuration: creatureConfig(file(content.creatures.catalog), packages), definitions: creatureDefinitions(packages), editorFields: json(game.root, content.creatures.editorFields)};
 const profile: Profile = plain({format: 'wildlands-content-profile', version: 1, id: game.manifest.id, storage: game.manifest.storage,
  balancing: balance, librarySchema: documents['library.schema'], creatures, assets: assetDefinitions(packages),
  scenarios: {packs: scenarioPacks, defaultId: content.defaultId, ...content.canonicalId === undefined ? {} : {canonicalId: content.canonicalId}}});
 const sections = profile as Profile & {creatures: Required<LWContentProvider.CreatureContent>; scenarios: LWContentProvider.ScenarioCatalog};
 const plainBalance = sections.balancing as typeof balance;
 const data = new Map<string, unknown>([
  ['LWGameProfile', {storage: profile.storage}], ['LWDefaultBalancing', plainBalance], ['LWDefaultLibrary', plainBalance.libraries.base],
  ['LWContentSchema', profile.librarySchema], ['LWInteriorDefinitions', plainBalance.interiors], ['LWInteractionLibrary', plainBalance.interactions],
  ['LWCreatureDefinitions', sections.creatures.definitions], ['LWCreatureEditorFieldDefinitions', sections.creatures.editorFields],
  ['LWCreatureConfig', sections.creatures.configuration], ['LWDefaultAdventure', plainBalance.libraries.adventure], ['LWAdventureSchema', engineSchema('adventure.schema.json')],
  ['LWDefaultWorld', plainBalance.libraries.world], ['LWWorldSchema', engineSchema('world.schema.json')], ['LWActorRules', plainBalance.simulation.rules.actor],
  ['LWEconomyRules', plainBalance.simulation.rules.economy], ['LWDefaultSimulationProfile', plainBalance.simulation], ['LWSimulationSchema', engineSchema('simulation.schema.json')],
  ['LWDefaultGrowth', plainBalance.libraries.growth], ['LWGrowthSchema', engineSchema('growth.schema.json')], ['LWDefaultProfile', plainBalance.world],
  ['LWScenarioSchema', engineSchema('scenario.schema.json')], ['LWAssetDefinitions', profile.assets], ['LWScenarioPacks', sections.scenarios.packs]
 ]);
 return {...game, profile, data, documents, packages};
}

/** Project a loaded (or still unloaded) game folder into its content profile and artifact data globals. */
export function compileGame(input: string | LoadedGame): CompiledGame {
 const game = typeof input === 'string' ? loadGame(input) : input, manifest = game.manifest;
 if (manifest.template === 'colony') return colony(game);
 const base = {format: 'wildlands-content-profile' as const, version: 1 as const, id: manifest.id, storage: plain(manifest.storage)};
 if (manifest.template === 'process') {
  const definition = json(game.root, (manifest.content as ProcessContent).definition);
  return {...game, packages: [], profile: {...base, process: definition}, data: new Map<string, unknown>([['LWGameProfile', {storage: base.storage}], ['LWProcessDefinition', definition]])};
 }
 if (manifest.template === 'rts') {
  const catalog = json(game.root, (manifest.content as RtsContent).catalog);
  return {...game, packages: [], profile: {...base, rts: catalog}, data: new Map<string, unknown>([['LWGameProfile', {storage: base.storage}], ['LWRTSDefinitions', catalog]])};
 }
 const content = manifest.content as PetContent, packages = content.assets ? definitions(path.join(game.root, content.assets)) : [];
 if (packages.some(definition => definition.family !== 'pets')) throw Error('Pet game assets may contain only pets definitions.');
 const catalog = json(game.root, content.catalog), assets = packages.length ? petAssetDefinitions(packages) : undefined;
 return {...game, packages, profile: {...base, pet: {definitions: catalog, ...assets ? {assets} : {}}},
  data: new Map<string, unknown>([['LWGameProfile', {storage: base.storage}], ['LWPetDefinitions', catalog], ...assets ? [['LWPetAssetDefinitions', assets] as [string, unknown]] : []])};
}
export const profile = (directory: string): Profile => compileGame(directory).profile;
export const dataGlobals = (directory: string): ReadonlyMap<string, unknown> => compileGame(directory).data;

export interface GameValidation {readonly ok: boolean; readonly id: string | null; readonly digest: string | null; readonly errors: readonly string[];}
/**
 * Full validation: folder, manifest and projections here, then the engine's own runtime validators
 * (balancing, scenario packs, skill tree, adventure examples, interaction library, RTS/pet catalogs,
 * creature/asset/interior admission and the balancing consumption audit) in a fresh Node process.
 */
export function validateGame(directory: string): GameValidation {
 let game: CompiledGame;
 try { game = compileGame(directory); }
 catch (error) { return {ok: false, id: null, digest: null, errors: [error instanceof Error ? error.message : String(error)]}; }
 const validator = path.join(PROJECT, '.generated', 'tools', 'build-validation.cjs');
 if (!fs.existsSync(validator)) return {ok: false, id: game.manifest.id, digest: game.digest, errors: ['Engine validators are not built; run npm run build in source/wildlands first.']};
 const run = spawnSync(process.execPath, [validator, '--game', game.root], {encoding: 'utf8', timeout: 120000, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024});
 const errors = run.error ? [run.error.message] : run.status === 0 ? [] : [(run.stderr || run.stdout || 'Engine validation failed.').trim()];
 return {ok: errors.length === 0, id: game.manifest.id, digest: game.digest, errors};
}
