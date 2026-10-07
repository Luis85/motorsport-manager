/// <reference path="../content-provider-contracts.d.ts" />
/// <reference path="../developer-contracts.d.ts" />
/// <reference path="../rts-contracts.d.ts" />
/// <reference path="../pet-contracts.d.ts" />
/// <reference path="../engine-export-contracts.d.ts" />
/**
 * Build games from their folders (`wildlands validate-game`, `inspect-game`, `build-game`).
 *
 * This module runs inside the bundled CLI without node_modules, a compiler or a minifier. The
 * engine half of every artifact comes from the engine kit (tools/engine-kit.cts): expanded HTML
 * templates, the exact inline text of every insert a game profile can select (minified for play,
 * verbatim for studio), the engine's gameplay tuner consumers and the identity of all of it. The
 * bundled CLI embeds the kit precomputed at `npm run build:cli`; a checkout computes the same kit
 * from `.generated` (cached by input digest). The game half is the folder's compiled profile and
 * data globals (tools/game-folder.cts). Placement is artifact-placement.cts, shared with the build,
 * so output is byte-identical wherever it is built.
 *
 * Validation runs the engine's runtime validators (tools/game-admission.cts, shared with the build)
 * in this process with the folder's profile installed (one game per realm), so a CLI process
 * validates or builds exactly one game. The balancing audit uses the tuner consumers the kit recorded.
 */
import path from 'node:path';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {compileGame, loadGame, type CompiledGame} from './game-folder.cjs';
import {admitGameProfile} from './game-admission.cjs';
import type {Insert} from './build-inserts.cjs';
import {GAME_BUILD_KINDS, gameProfile, profileBundles, type ArtifactProfile, type GameBuildKind} from './artifact-profiles.cjs';
import {inlineElement, placeArtifact, substituteVariables, type ArtifactManifest} from './artifact-placement.cjs';
import {declaredTunerErrors} from './balancing-audit.cjs';
import {engineOnlySources, sourceLoader} from './engine-sources.cjs';
// pako ships no declarations; the pinned pure-JS encoder keeps payload bytes independent of Node's zlib.
const pako = require('pako') as {gzip(data: Uint8Array, options: {level: number}): Uint8Array};

/** Engine half of every game artifact; see tools/engine-kit.cts for how it is made. */
export interface EngineKit {
 readonly format: 'wildlands-engine-kit';
 readonly schemaVersion: 1;
 /** SHA-256 of everything below: the `wildlands-engine` meta value of every artifact. */
 readonly identity: string;
 /** Include-expanded templates with their `{{NAME}}` tokens, by template path. */
 readonly templates: Readonly<Record<string, string>>;
 /**
  * Inline content by insert marker: `min` for minified play scripts, `raw` for verbatim content, or
  * `vendor`/`sha256` naming a verbatim vendor script by its path in the engine sources.
  */
 readonly inserts: Readonly<Record<string, {readonly min?: string; readonly raw?: string; readonly vendor?: string; readonly sha256?: string}>>;
 /** Gameplay tuner locations the engine consumes (balancing consumption audit). */
 readonly tuners: readonly string[];
 /** Digests of the studio export payloads this kit was built with. */
 readonly payloads: {readonly runtime: string; readonly godotTemplates: string; readonly engineSources: string};
}
export interface GameValidation {readonly ok: boolean; readonly id: string | null; readonly template: string | null; readonly digest: string | null; readonly errors: readonly string[];}
export interface GameArtifact {
 readonly html: string;
 readonly bytes: number;
 readonly sha256: string;
 readonly id: string;
 readonly kind: GameBuildKind;
 readonly profile: string;
 readonly digest: string;
 readonly engine: string;
 /** Play budget from `targets.html.budgetBytes`; studio builds are not budgeted. */
 readonly budgetBytes: number | null;
 readonly manifest: ArtifactManifest;
}
/** A game folder that cannot be built: rejected by the folder or engine validators, or over its play budget. */
export class GameBuildError extends Error {
 constructor(readonly code: 'invalid-game' | 'over-budget', message: string, readonly details: Readonly<Record<string, unknown>> = {}) { super(message); }
}

const PROJECT = path.resolve(__dirname, '../..');
const sha256 = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');
const message = (error: unknown): string => error instanceof Error ? error.message : String(error);
let kit: EngineKit | null = null;

/** The embedded kit of a bundled CLI, else the kit of this checkout's `.generated` build. */
export function engineKit(): EngineKit {
 if (kit) return kit;
 let embedded: EngineKit | undefined;
 // Resolved only inside the bundled CLI (tools/cli-bundle.cts); a checkout has no such module.
 try { embedded = require('wildlands-engine-kit') as EngineKit; }
 catch (error) { if ((error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') throw error; }
 return kit = embedded ?? (require('./engine-kit.cjs') as typeof import('./engine-kit.cjs')).cachedEngineKit(PROJECT);
}

/** Compile and fully validate one folder in this process (its profile stays installed). */
export function admitGame(directory: string): CompiledGame {
 let game: CompiledGame;
 try { game = compileGame(directory); }
 catch (error) { throw new GameBuildError('invalid-game', message(error)); }
 const tuners = engineKit().tuners;
 try { admitGameProfile(game, balancing => declaredTunerErrors(tuners, balancing)); }
 catch (error) { throw new GameBuildError('invalid-game', message(error), {id: game.manifest.id, template: game.manifest.template, digest: game.digest}); }
 return game;
}

/** `validate-game`: folder, manifest, projections and the engine runtime validators. */
export function validateGameFolder(directory: string): GameValidation {
 try {
  const game = admitGame(directory);
  return {ok: true, id: game.manifest.id, template: game.manifest.template, digest: game.digest, errors: []};
 } catch (error) {
  // Only the folder is rejected here; a missing or broken engine (kit) stays an operation failure.
  if (!(error instanceof GameBuildError)) throw error;
  const details = error.details;
  return {ok: false, id: (details.id as string) ?? null, template: (details.template as string) ?? null, digest: (details.digest as string) ?? null, errors: [message(error)]};
 }
}

const jsonBytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
/** `inspect-game`: manifest summary, closed inventory, digest, profile section and build data sizes. */
export function inspectGame(directory: string): Record<string, unknown> {
 const loaded = loadGame(directory), game = compileGame(loaded), manifest = game.manifest;
 const sections = Object.fromEntries(Object.entries(game.profile).filter(([key]) => !['format', 'version', 'id'].includes(key)).map(([key, value]) => [key, jsonBytes(value)]));
 const builds = Object.fromEntries(GAME_BUILD_KINDS[manifest.template].map(kind => {
  const candidate = gameProfile(manifest, kind, new Set(game.data.keys()));
  return [kind, {profile: candidate.id, template: candidate.template, minified: candidate.minify, bundles: profileBundles(candidate),
   data: candidate.data.filter(name => game.data.has(name)).map(name => ({name, bytes: jsonBytes(game.data.get(name))}))}];
 }));
 return {id: manifest.id, name: manifest.name, version: manifest.version, template: manifest.template, features: manifest.features ?? [],
  presentation: manifest.presentation, storage: manifest.storage, targets: manifest.targets, digest: game.digest,
  inventory: {files: game.files.length, bytes: game.files.reduce((total, file) => total + file.bytes, 0), entries: game.files},
  profile: {id: game.profile.id, sections}, builds};
}

/** The trusted engine sources of this distribution (without games), checked against the kit. */
function trustedSources(engine: EngineKit): LWEngineExport.SourceBundle {
 const sources = JSON.parse(engineOnlySources(JSON.stringify(require('../engine-source-bundle.json')))) as LWEngineExport.SourceBundle;
 if (sources.identity !== engine.payloads.engineSources) throw Error('Engine sources differ from the engine kit. Rebuild Wildlands (npm run build, then npm run build:cli).');
 return sources;
}

/** Studio export payloads, derived from this distribution's trusted runtime and engine sources. */
function exportPayloads(engine: EngineKit, sources: LWEngineExport.SourceBundle): Map<string, unknown> {
 // Built by JSON.stringify, so re-serializing a parsed trusted file reproduces its exact bytes.
 const runtime = Buffer.from(JSON.stringify(require('../wildlands-runtime-bundle.json')), 'utf8');
 const templates = require('../wildlands-godot-templates.json') as unknown;
 const actual = {runtime: sha256(runtime), godotTemplates: sha256(JSON.stringify(templates)), engineSources: sources.identity};
 if (JSON.stringify(actual) !== JSON.stringify(engine.payloads)) throw Error('Studio export payloads differ from the engine kit. Rebuild Wildlands (npm run build, then npm run build:cli).');
 return new Map<string, unknown>([
  ['WildlandsGodotRuntimeLoader', {encoding: 'gzip-base64', decodedBytes: runtime.length, sha256: actual.runtime, data: Buffer.from(pako.gzip(runtime, {level: 9})).toString('base64')}],
  ['WildlandsGodotTemplates', templates], ['LWEngineSourceLoader', sourceLoader(sources)]
 ]);
}

/** Final inline text of one insert from the kit; verbatim vendor scripts come from the engine sources. */
function kitInsert(engine: EngineKit, candidate: ArtifactProfile, sources: () => LWEngineExport.SourceBundle): (insert: Insert) => string {
 return insert => {
  const entry = engine.inserts[insert[0]], minified = insert[2] === 'script' && candidate.minify;
  let content = minified ? entry?.min : entry?.raw;
  if (!minified && content === undefined && entry?.vendor) {
   const file = sources().files.find(value => value.path === entry.vendor);
   if (!file || file.encoding !== 'utf8' || file.sha256 !== entry.sha256) throw Error(`Engine sources lack the exact ${entry.vendor}. Rebuild Wildlands.`);
   content = file.text;
  }
  if (content === undefined) throw Error(`The engine kit lacks ${insert[0]} for ${candidate.id}. Rebuild Wildlands.`);
  return inlineElement(insert, content);
 };
}

/** Identity meta elements, placed immediately before the template's single `<title>`. */
function identify(html: string, engine: string, digest: string): string {
 const at = html.indexOf('<title>');
 if (at < 0 || html.indexOf('<title>', at + 1) >= 0 || at > html.indexOf('</head>')) throw Error('Game templates need exactly one <title> in their head.');
 return html.slice(0, at) + `<meta name="wildlands-engine" content="${engine}"><meta name="wildlands-game-digest" content="${digest}">\n` + html.slice(at);
}

/** Assemble an already admitted game (its profile installed in this realm) into one HTML document. */
export function assembleGame(game: CompiledGame, kind: GameBuildKind): GameArtifact {
 const engine = engineKit(), manifest = game.manifest;
 const candidate = gameProfile(manifest, kind, new Set(game.data.keys()));
 let loaded: LWEngineExport.SourceBundle | null = null;
 const sources = (): LWEngineExport.SourceBundle => loaded ??= trustedSources(engine);
 const data = kind === 'studio' && manifest.template === 'colony' ? new Map([...game.data, ...exportPayloads(engine, sources())]) : game.data;
 const expanded = engine.templates[candidate.template];
 if (expanded === undefined) throw Error(`The engine kit lacks template ${candidate.template}. Rebuild Wildlands.`);
 const template = identify(substituteVariables(expanded, candidate.variables, candidate.template), engine.identity, game.digest);
 const placed = placeArtifact(candidate, template, kitInsert(engine, candidate, sources), data);
 const budgetBytes = kind === 'play' ? manifest.targets.html.budgetBytes : null;
 const artifact: GameArtifact = {html: placed.html, bytes: placed.manifest.bytes, sha256: placed.manifest.sha256, id: manifest.id, kind,
  profile: candidate.id, digest: game.digest, engine: engine.identity, budgetBytes, manifest: placed.manifest};
 if (budgetBytes !== null && artifact.bytes > budgetBytes)
  throw new GameBuildError('over-budget', `${manifest.id} play artifact is ${artifact.bytes} bytes, over its budget of ${budgetBytes} bytes (game.json targets.html.budgetBytes).`,
   {id: manifest.id, bytes: artifact.bytes, budgetBytes});
 return artifact;
}

/** Validate a folder and build one artifact of it in memory. */
export function buildGame(directory: string, kind: GameBuildKind = 'play'): GameArtifact {
 return assembleGame(admitGame(directory), kind);
}

/** Every game folder (`<root>/<id>/game.json`) in id order. */
export function gameFolders(root: string): string[] {
 return fs.readdirSync(root, {withFileTypes: true}).filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'game.json')))
  .map(entry => entry.name).sort().map(name => path.join(root, name));
}
