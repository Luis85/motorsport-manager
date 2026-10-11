/// <reference path="../engine-export-contracts.d.ts" />
/**
 * Build-only: the engine kit, the engine half of every game artifact (see game-build.cts).
 *
 * It holds the include-expanded templates of every game profile, the exact inline text of every
 * insert any game profile can select (esbuild-minified for play scripts, verbatim otherwise; a
 * verbatim vendor script is named by its engine-source path and SHA-256 rather than copied), the
 * engine's gameplay tuner consumers and the digests of the studio export payloads. Its identity is
 * the SHA-256 of that content. `npm run build:cli` embeds it in bin/wildlands, so the CLI builds
 * games without esbuild; in a checkout `cachedEngineKit` computes the same kit from `.generated`
 * and caches it there, keyed by a digest of every input file, so repeated builds stay fast.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {INSERTS, type Insert} from './build-inserts.cjs';
import {GAME_BUILD_KINDS, featureSets, gameProfile, gameProfileErrors, profileBundles, type ArtifactProfile} from './artifact-profiles.cjs';
import {expandTemplate, insertContent} from './artifact-assembler.cjs';
import {engineConsumers} from './balancing-audit.cjs';
import {engineOnlySources} from './engine-sources.cjs';
import type {EngineKit} from './game-build.cjs';

const sha256 = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');
const CACHE = 'engine-kit.json';

/** Every game profile the kit must serve: each template, build kind and feature set. */
export function kitProfiles(): ArtifactProfile[] {
 return (['colony', 'rts', 'pet', 'process', 'armored'] as const).flatMap(template => GAME_BUILD_KINDS[template].flatMap(kind => featureSets(template).map(features =>
  gameProfile({id: 'kit', template, features, presentation: {title: 'Kit'}, storage: {namespace: 'wildlands.kit'}}, kind))));
}

/** Files whose bytes determine the kit (templates and partials, inserts, tuner sources, build tools, payloads). */
function inputs(project: string): string[] {
 const source = path.join(project, 'source'), generated = path.join(project, '.generated');
 const inserted = INSERTS.map(([, file, kind]) => kind === 'style' ? path.join(source, file) : file.startsWith('../vendor/') ? path.resolve(source, file) : path.join(generated, file));
 const templates = fs.readdirSync(path.join(source, 'templates')).sort().map(name => path.join(source, 'templates', name));
 const tuners = fs.readdirSync(source).sort().filter(name => name.endsWith('.ts')).map(name => path.join(source, name));
 const tools = fs.readdirSync(path.join(generated, 'tools')).sort().filter(name => name.endsWith('.cjs')).map(name => path.join(generated, 'tools', name));
 return [...inserted, ...templates, ...tuners, ...tools, path.join(source, 'content/balancing-inventory.json'),
  ...['wildlands-runtime-bundle.json', 'wildlands-godot-templates.json', 'engine-source-bundle.json'].map(name => path.join(generated, name))];
}
function inputDigest(project: string): string {
 const hash = createHash('sha256');
 for (const file of inputs(project)) hash.update(path.relative(project, file) + '\0' + sha256(fs.readFileSync(file)) + '\n');
 return hash.digest('hex');
}

/** Compute the kit from a built checkout (`npm run build` first). Deterministic for the same inputs. */
export function createEngineKit(project: string): EngineKit {
 const source = path.join(project, 'source'), generated = path.join(project, '.generated');
 const problems = gameProfileErrors(source);
 if (problems.length) throw Error('Game build profiles are inconsistent: ' + problems.join('; '));
 const profiles = kitProfiles(), cache = new Map<string, string>();
 const templates = Object.fromEntries([...new Set(profiles.map(candidate => candidate.template))].sort().map(template => [template, expandTemplate(source, template)]));
 const wanted = new Map<string, {min: boolean; raw: boolean}>();
 for (const candidate of profiles) {
  const bundles = profileBundles(candidate);
  for (const insert of INSERTS.filter(entry => bundles.includes(entry[3]))) {
   const entry = wanted.get(insert[0]) ?? {min: false, raw: false};
   if (insert[2] === 'script' && candidate.minify) entry.min = true; else entry.raw = true;
   wanted.set(insert[0], entry);
  }
 }
 const text = (name: string): string => fs.readFileSync(path.join(generated, name), 'utf8');
 const engine = JSON.parse(engineOnlySources(text('engine-source-bundle.json'))) as LWEngineExport.SourceBundle;
 /** Verbatim vendor scripts are the engine sources' own vendor files: the kit names them instead of copying them. */
 const vendor = (insert: Insert): {vendor: string; sha256: string} | null => {
  const file = insert[1].startsWith('../vendor/') ? engine.files.find(entry => entry.path === insert[1].slice(3) && entry.encoding === 'utf8') : undefined;
  return file && file.text === insertContent(insert, source, generated, false) ? {vendor: file.path, sha256: file.sha256} : null;
 };
 const inserts = Object.fromEntries(INSERTS.filter(insert => wanted.has(insert[0])).map(insert => {
  const entry = wanted.get(insert[0])!, shared = entry.raw ? vendor(insert) : null;
  return [insert[0], {...entry.min ? {min: insertContent(insert, source, generated, true, cache)} : {},
   ...entry.raw ? shared ?? {raw: insertContent(insert, source, generated, false)} : {}}];
 }));
 const audit = engineConsumers(source);
 if (audit.issues.length) throw Error('Engine balancing inventory drift: ' + audit.issues.join('; '));
 const payloads = {runtime: sha256(text('wildlands-runtime-bundle.json')), godotTemplates: sha256(text('wildlands-godot-templates.json')), engineSources: engine.identity};
 const body = {templates, inserts, tuners: audit.consumed, payloads};
 return {format: 'wildlands-engine-kit', schemaVersion: 1, identity: sha256(JSON.stringify({format: 'wildlands-engine-kit', schemaVersion: 1, ...body})), ...body};
}

/** The checkout's kit, reused from `.generated/engine-kit.json` while every input is byte-identical. */
export function cachedEngineKit(project: string): EngineKit {
 const generated = path.join(project, '.generated'), file = path.join(generated, CACHE);
 if (!fs.existsSync(path.join(generated, 'tools', 'wildlands-cli.cjs'))) throw Error('Wildlands is not built; run npm run build in source/wildlands first.');
 const key = inputDigest(project);
 try {
  const cached = JSON.parse(fs.readFileSync(file, 'utf8')) as {inputs: string; kit: EngineKit};
  if (cached.inputs === key && cached.kit.format === 'wildlands-engine-kit') return cached.kit;
 } catch { /* absent or unreadable: recompute */ }
 const kit = createEngineKit(project), temporary = file + '.' + process.pid + '.tmp';
 try { fs.writeFileSync(temporary, JSON.stringify({inputs: key, kit})); fs.renameSync(temporary, file); }
 finally { fs.rmSync(temporary, {force: true}); }
 return kit;
}
