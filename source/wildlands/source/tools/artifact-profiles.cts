/**
 * Build-only artifact profiles: which bundles, data globals and template make one HTML artifact.
 *
 * A profile never names individual files. It selects bundle tags from build-inserts.cts, and the
 * assembler filters the canonical INSERTS order, so every artifact keeps the showcase load order.
 * `transitional` bundles are included only until a runtime seam makes them optional; each carries
 * the reason and is listed separately so the debt stays visible in reports and checks.
 * `game` is the profile's own LWGameProfile data global (today only its storage namespace); the
 * showcase never declares one, so the composite fixture keeps the legacy Littlewild save keys.
 */
import fs from 'node:fs';
import path from 'node:path';
import {BUNDLES, INSERTS, type BundleTag} from './build-inserts.cjs';

export type DataGroup = 'game-profile' | 'export-payloads' | 'colony-content' | 'asset-catalog' | 'rts-content' | 'pet-content';
export type ProfileKind = 'fixture' | 'studio' | 'play';

/** Canonical declaration order of every injectable data global (the showcase order). */
export const DATA_GLOBALS: readonly (readonly [name: string, group: DataGroup])[] = [
  ['LWGameProfile', 'game-profile'],
  ['WildlandsGodotRuntimeLoader', 'export-payloads'],
  ['WildlandsGodotTemplates', 'export-payloads'],
  ['LWEngineSourceLoader', 'export-payloads'],
  ['LWDefaultBalancing', 'colony-content'],
  ['LWDefaultLibrary', 'colony-content'],
  ['LWRTSDefinitions', 'rts-content'],
  ['LWPetDefinitions', 'pet-content'],
  ['LWPetAssetDefinitions', 'pet-content'],
  ['LWContentSchema', 'colony-content'],
  ['LWInteriorDefinitions', 'colony-content'],
  ['LWInteractionLibrary', 'colony-content'],
  ['LWCreatureDefinitions', 'colony-content'],
  ['LWCreatureEditorFieldDefinitions', 'colony-content'],
  ['LWCreatureConfig', 'colony-content'],
  ['LWDefaultAdventure', 'colony-content'],
  ['LWAdventureSchema', 'colony-content'],
  ['LWDefaultWorld', 'colony-content'],
  ['LWWorldSchema', 'colony-content'],
  ['LWActorRules', 'colony-content'],
  ['LWEconomyRules', 'colony-content'],
  ['LWDefaultSimulationProfile', 'colony-content'],
  ['LWSimulationSchema', 'colony-content'],
  ['LWDefaultGrowth', 'colony-content'],
  ['LWGrowthSchema', 'colony-content'],
  ['LWDefaultProfile', 'colony-content'],
  ['LWScenarioSchema', 'colony-content'],
  ['LWAssetDefinitions', 'asset-catalog'],
  ['LWScenarioPacks', 'colony-content']
];

/** Runtime game profile read by the colony shell (RUNTIME-CONTRACTS.md, storage namespaces). */
export interface GameProfile {readonly storage: {readonly namespace: string};}
/** Same rule as LWStoryStorage: the `littlewild` namespace keeps the legacy v5 keys. */
const STORAGE_NAMESPACE = /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)*$/;

export interface ArtifactProfile {
  readonly id: string;
  readonly kind: ProfileKind;
  /** Template path relative to the authored source root. */
  readonly template: string;
  readonly bundles: readonly BundleTag[];
  readonly transitional?: {readonly bundles: readonly BundleTag[]; readonly reason: string};
  /** Data globals to declare; serialized in DATA_GLOBALS order. */
  readonly data: readonly string[];
  /** Per-profile LWGameProfile value; declared exactly when `data` names LWGameProfile. */
  readonly game?: GameProfile;
  /** Deterministic esbuild whitespace+syntax minification of scripts (identifiers kept). */
  readonly minify: boolean;
  /** Template `{{NAME}}` values; HTML-escaped on substitution. */
  readonly variables: Readonly<Record<string, string>>;
}

const groups = (...wanted: DataGroup[]): string[] => DATA_GLOBALS.filter(([, group]) => wanted.includes(group)).map(([name]) => name);
const SHOWCASE_TEXT = {
  TITLE: 'Wildlands — Worlds of Possibility · v15',
  DESCRIPTION: 'A little life. A shared adventure. Littlewild is an offline, autonomous-buddy RPG prototype.'
};
/** Bundles that a play artifact may carry only as declared transitional debt. */
export const PLAY_EXCLUDED_BUNDLES: readonly BundleTag[] = ['editors', 'developer', 'export', 'renderers-2d', 'animation-p5', 'renderer-examples', 'rts-editor'];

export const PROFILES: readonly ArtifactProfile[] = [
  {id: 'showcase', kind: 'fixture', template: 'index.html', minify: false, variables: SHOWCASE_TEXT,
    bundles: BUNDLES.filter(bundle => bundle !== 'play-boot'), data: DATA_GLOBALS.filter(([, group]) => group !== 'game-profile').map(([name]) => name)},
  {id: 'studio', kind: 'studio', template: 'templates/colony.html', minify: false, variables: SHOWCASE_TEXT,
    bundles: ['engine-kernel', 'asset-catalog', 'colony-styles', 'core-sim', 'colony-shell', 'renderer-3d', 'renderer-host', 'renderers-2d', 'animation-p5',
      'storytelling-player', 'editors', 'developer', 'export'],
    data: groups('export-payloads', 'colony-content', 'asset-catalog')},
  {id: 'colony-play', kind: 'play', template: 'templates/colony.html', minify: true, variables: SHOWCASE_TEXT,
    bundles: ['engine-kernel', 'asset-catalog', 'colony-styles', 'core-sim', 'colony-shell', 'renderer-3d', 'renderer-host', 'storytelling-player'],
    game: {storage: {namespace: 'littlewild'}}, data: groups('game-profile', 'colony-content', 'asset-catalog')},
  {id: 'rts-play', kind: 'play', template: 'templates/standalone.html', minify: true,
    variables: {APP: 'rts', TITLE: 'Wildlands RTS', DESCRIPTION: 'An offline isometric real-time strategy match built with Wildlands.'},
    bundles: ['engine-kernel', 'template-rts', 'play-boot'], data: groups('rts-content')},
  {id: 'pet-play', kind: 'play', template: 'templates/standalone.html', minify: true,
    variables: {APP: 'pet', TITLE: 'Pocket Pet', DESCRIPTION: 'An offline virtual pet built with Wildlands.'},
    bundles: ['engine-kernel', 'asset-catalog', 'renderer-3d', 'template-pet', 'play-boot'], data: groups('pet-content')}
];

export function profile(id: string): ArtifactProfile {
  const found = PROFILES.find(candidate => candidate.id === id);
  if (!found) throw Error(`Unknown artifact profile: ${id}. Known: ${PROFILES.map(candidate => candidate.id).join(', ')}.`);
  return found;
}

/** All bundles a profile includes, in canonical bundle order. */
export function profileBundles(input: ArtifactProfile): BundleTag[] {
  const wanted = new Set<BundleTag>([...input.bundles, ...(input.transitional?.bundles ?? [])]);
  return BUNDLES.filter(bundle => wanted.has(bundle));
}

const subsequence = <T,>(items: readonly T[], canonical: readonly T[]): boolean => {
  let cursor = 0;
  for (const item of items) { cursor = canonical.indexOf(item, cursor); if (cursor < 0) return false; cursor += 1; }
  return true;
};
const markers = (template: string): string[] => [...template.matchAll(/<!-- INLINE_([A-Z0-9_]+) -->/g)].map(match => match[1]!);
const tokens = (css: string): Map<string, string> => {
  const block = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  return new Map([...block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g)].map(match => [match[1]!, match[2]!]));
};

/**
 * Members a module declares as required in its `inputRoot as {...}` shape (no `?`). Modules
 * without that declaration are not covered; optional members (`Name?:`) are optional bundles.
 */
export function requiredRootMembers(text: string): string[] {
  const at = text.search(/inputRoot\s+as\s+\{/);
  if (at < 0) return [];
  const required: string[] = [];
  let depth = 0, member = true;
  for (let index = text.indexOf('{', at); index < text.length; index += 1) {
    const char = text[index]!;
    if (depth === 1 && member && /[A-Za-z_$]/.test(char)) {
      const match = /^([A-Za-z_$][\w$]*)\s*(\?)?\s*:/.exec(text.slice(index, index + 160));
      if (match && !match[2]) required.push(match[1]!);
      member = false;
    }
    if ('{(['.includes(char)) depth += 1;
    else if ('})]'.includes(char)) { depth -= 1; if (depth === 0) break; }
    else if (depth === 1 && (char === ';' || char === ',')) member = true;
    else if (depth === 1 && !/\s/.test(char)) member = false;
  }
  return required;
}

/** Every global a profile's modules require must be published by a module or data global it includes. */
function closureErrors(source: string, candidate: ArtifactProfile): string[] {
  const scripts = INSERTS.filter(insert => insert[2] === 'script' && !insert[1].startsWith('../vendor/'));
  const text = (file: string): string => { const authored = path.join(source, file.replace(/\.js$/, '.ts')); return fs.existsSync(authored) ? fs.readFileSync(authored, 'utf8') : ''; };
  const publishers = new Map<string, string[]>();
  for (const [marker, file] of scripts) for (const match of text(file).matchAll(/\.([A-Z][\w$]*)\s*=(?![=>])/g)) publishers.set(match[1]!, [...publishers.get(match[1]!) ?? [], marker]);
  const bundles = profileBundles(candidate), included = new Set(INSERTS.filter(insert => bundles.includes(insert[3])).map(insert => insert[0]));
  const data = new Set(DATA_GLOBALS.map(([name]) => name)), errors: string[] = [];
  for (const [marker, file] of scripts.filter(insert => included.has(insert[0]))) {
    for (const name of requiredRootMembers(text(file))) {
      if (data.has(name)) { if (!candidate.data.includes(name)) errors.push(`Profile ${candidate.id}: ${marker} requires data global ${name}.`); continue; }
      const owners = publishers.get(name);
      if (owners && !owners.some(owner => included.has(owner))) errors.push(`Profile ${candidate.id}: ${marker} requires ${name}, published only by ${owners.join(', ')}.`);
    }
  }
  return errors;
}

/** p5 is LGPL-2.1: wherever it is inlined, its corresponding source must ship in the same artifact. */
export const P5_SOURCE_ARCHIVE = 'vendor/p5-source-2.3.4.tar.gz';
/**
 * Payload policy (ENGINE-EXPORT.md). The engine-source loader stores vendor scripts empty and the
 * browser restores them from the artifact's identical inline scripts, so a profile carrying it must
 * inline every vendor script verbatim (unminified). A profile that inlines p5 must carry the loader,
 * whose inventory holds the matching p5 source archive (the LGPL source offer).
 */
export function payloadErrors(candidate: ArtifactProfile): string[] {
  const errors: string[] = [], where = `Profile ${candidate.id}`, bundles = profileBundles(candidate);
  const vendor = INSERTS.filter(insert => insert[2] === 'script' && insert[1].startsWith('../vendor/'));
  if (candidate.data.includes('LWEngineSourceLoader')) {
    if (candidate.minify) errors.push(`${where} carries the engine-source loader and must inline vendor scripts unminified.`);
    for (const [name, , , bundle] of vendor) if (!bundles.includes(bundle)) errors.push(`${where} carries the engine-source loader but does not inline ${name} (bundle ${bundle}).`);
  }
  const p5 = vendor.filter(insert => /(^|\/)p5-[^/]*\.js$/.test(insert[1]) && bundles.includes(insert[3]));
  if (p5.length && !candidate.data.includes('LWEngineSourceLoader')) errors.push(`${where} inlines p5 (${p5.map(insert => insert[0]).join(', ')}) without its LGPL source offer; declare LWEngineSourceLoader, which carries ${P5_SOURCE_ARCHIVE}.`);
  return errors;
}

/** Structural contract between INSERTS, bundle tags, data globals, templates and profiles. */
export function profileErrors(source: string): string[] {
  const errors: string[] = [], known = new Set<string>(BUNDLES), names = INSERTS.map(insert => insert[0]);
  if (new Set(names).size !== names.length) errors.push('Duplicate insert marker.');
  for (const [name, file, , bundle] of INSERTS) {
    if (!known.has(bundle)) errors.push(`${name} has unknown bundle ${String(bundle)}.`);
    if (!/^(?:\.\.\/vendor\/)?[a-z0-9.-]+\.(?:css|js)$/.test(file)) errors.push(`${name} has an invalid file ${file}.`);
  }
  for (const bundle of BUNDLES) if (!INSERTS.some(insert => insert[3] === bundle)) errors.push(`Bundle ${bundle} has no inserts.`);
  const dataNames = DATA_GLOBALS.map(([name]) => name);
  if (new Set(dataNames).size !== dataNames.length) errors.push('Duplicate data global.');
  const showcase = PROFILES.find(candidate => candidate.id === 'showcase');
  if (!showcase) errors.push('The showcase fixture profile is missing.');
  else {
    if (showcase.game || showcase.data.includes('LWGameProfile')) errors.push('The showcase fixture must not declare LWGameProfile; it keeps the legacy Littlewild save keys.');
    const order = markers(fs.readFileSync(path.join(source, showcase.template), 'utf8')).filter(name => name !== 'CONTENT_DATA');
    const selected = new Set(profileBundles(showcase));
    const expected = INSERTS.filter(insert => selected.has(insert[3])).map(insert => insert[0]);
    if (JSON.stringify(order) !== JSON.stringify(expected)) errors.push('INSERTS order must equal the showcase template marker order (canonical load order).');
  }
  const ids = PROFILES.map(candidate => candidate.id);
  if (new Set(ids).size !== ids.length) errors.push('Duplicate profile id.');
  for (const candidate of PROFILES) {
    const where = `Profile ${candidate.id}`, transitional = candidate.transitional?.bundles ?? [];
    if (!/^[a-z][a-z0-9-]*$/.test(candidate.id)) errors.push(`${where} has an invalid id.`);
    if (!subsequence(candidate.bundles, BUNDLES)) errors.push(`${where} bundles are not a subsequence of the canonical bundle order.`);
    if (!subsequence(transitional, BUNDLES)) errors.push(`${where} transitional bundles are not in canonical bundle order.`);
    if (transitional.some(bundle => candidate.bundles.includes(bundle))) errors.push(`${where} lists a bundle as both required and transitional.`);
    if (candidate.transitional && candidate.transitional.reason.trim().length < 40) errors.push(`${where} needs a concrete transitional reason.`);
    if (!subsequence(candidate.data, dataNames)) errors.push(`${where} data globals are unknown or not in canonical order.`);
    if (!!candidate.game !== candidate.data.includes('LWGameProfile')) errors.push(`${where} must declare LWGameProfile exactly when it has a game profile.`);
    if (candidate.game && !STORAGE_NAMESPACE.test(candidate.game.storage.namespace)) errors.push(`${where} has an invalid storage namespace.`);
    if (!fs.existsSync(path.join(source, candidate.template))) errors.push(`${where} template is missing.`);
    if (candidate.kind === 'play') {
      for (const bundle of candidate.bundles) if (PLAY_EXCLUDED_BUNDLES.includes(bundle)) errors.push(`${where} requires excluded bundle ${bundle}; declare it transitional with a reason.`);
      for (const name of candidate.data) if (DATA_GLOBALS.find(([data]) => data === name)?.[1] === 'export-payloads') errors.push(`${where} must not embed export payload ${name}.`);
      if (!candidate.minify) errors.push(`${where} must be minified.`);
    }
    const resolved = INSERTS.filter(insert => profileBundles(candidate).includes(insert[3])).map(insert => insert[0]);
    if (!subsequence(resolved, names)) errors.push(`${where} insert order is not a subsequence of INSERTS.`);
    errors.push(...closureErrors(source, candidate), ...payloadErrors(candidate));
    // The asset catalog starts empty without a bundled list; only the standalone pet admits its own.
    if (profileBundles(candidate).includes('colony-shell') && !candidate.data.includes('LWAssetDefinitions')) errors.push(`${where} runs the colony and must declare LWAssetDefinitions.`);
  }
  // Standalone templates do not load the colony stylesheet; their tokens must mirror it exactly.
  const base = tokens(fs.readFileSync(path.join(source, 'style.css'), 'utf8')), play = tokens(fs.readFileSync(path.join(source, 'play.css'), 'utf8'));
  if (!play.size) errors.push('play.css declares no design tokens.');
  for (const [name, value] of play) if (base.get(name) !== value) errors.push(`play.css token ${name} differs from style.css.`);
  return errors;
}
