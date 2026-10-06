/**
 * Build-only artifact profiles: which bundles, data globals and template make one HTML artifact.
 *
 * A profile never names individual files. It selects bundle tags from build-inserts.cts, and the
 * assembler filters the canonical INSERTS order, so every artifact keeps the showcase load order.
 * `transitional` bundles are included only until a runtime seam makes them optional; each carries
 * the reason and is listed separately so the debt stays visible in reports and checks.
 */
import fs from 'node:fs';
import path from 'node:path';
import {BUNDLES, INSERTS, type BundleTag} from './build-inserts.cjs';

export type DataGroup = 'export-payloads' | 'colony-content' | 'asset-catalog' | 'rts-content' | 'pet-content';
export type ProfileKind = 'fixture' | 'studio' | 'play';

/** Canonical declaration order of every injectable data global (the showcase order). */
export const DATA_GLOBALS: readonly (readonly [name: string, group: DataGroup])[] = [
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

export interface ArtifactProfile {
  readonly id: string;
  readonly kind: ProfileKind;
  /** Template path relative to the authored source root. */
  readonly template: string;
  readonly bundles: readonly BundleTag[];
  readonly transitional?: {readonly bundles: readonly BundleTag[]; readonly reason: string};
  /** Data globals to declare; serialized in DATA_GLOBALS order. */
  readonly data: readonly string[];
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
const COLONY_SHELL_SEAMS = 'ui.ts mounts the RTS and Pet hosts (and so the RTS mission editor) unconditionally, and ui.ts, scenario-ui, ' +
  'developer-toolbox and wildlands-ui hard-wire the editors, developer session and export UI at boot (tangles T3/T4/T5). ' +
  'Phase 1C optionality seams remove these; export payloads are already excluded and their controls report unavailability.';

export const PROFILES: readonly ArtifactProfile[] = [
  {id: 'showcase', kind: 'fixture', template: 'index.html', minify: false, variables: SHOWCASE_TEXT,
    bundles: BUNDLES.filter(bundle => bundle !== 'play-boot'), data: DATA_GLOBALS.map(([name]) => name)},
  {id: 'studio', kind: 'studio', template: 'templates/colony.html', minify: false, variables: SHOWCASE_TEXT,
    bundles: ['engine-kernel', 'asset-catalog', 'colony-styles', 'core-sim', 'colony-shell', 'renderer-3d', 'renderer-host', 'renderers-2d', 'animation-p5',
      'storytelling-player', 'editors', 'developer', 'export'],
    transitional: {bundles: ['template-rts', 'rts-editor', 'template-pet'], reason: COLONY_SHELL_SEAMS},
    data: groups('export-payloads', 'colony-content', 'asset-catalog', 'rts-content', 'pet-content')},
  {id: 'colony-play', kind: 'play', template: 'templates/colony.html', minify: true, variables: SHOWCASE_TEXT,
    bundles: ['engine-kernel', 'asset-catalog', 'colony-styles', 'core-sim', 'colony-shell', 'renderer-3d', 'renderer-host', 'storytelling-player'],
    transitional: {bundles: ['editors', 'developer', 'export', 'template-rts', 'rts-editor', 'template-pet'], reason: COLONY_SHELL_SEAMS},
    data: groups('colony-content', 'asset-catalog', 'rts-content', 'pet-content')},
  {id: 'rts-play', kind: 'play', template: 'templates/standalone.html', minify: true,
    variables: {APP: 'rts', TITLE: 'Wildlands RTS', DESCRIPTION: 'An offline isometric real-time strategy match built with Wildlands.'},
    bundles: ['engine-kernel', 'template-rts', 'play-boot'], data: groups('rts-content')},
  {id: 'pet-play', kind: 'play', template: 'templates/standalone.html', minify: true,
    variables: {APP: 'pet', TITLE: 'Pocket Pet', DESCRIPTION: 'An offline virtual pet built with Wildlands.'},
    bundles: ['engine-kernel', 'asset-catalog', 'renderer-3d', 'template-pet', 'play-boot'], data: groups('asset-catalog', 'pet-content')}
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
    if (!fs.existsSync(path.join(source, candidate.template))) errors.push(`${where} template is missing.`);
    if (candidate.kind === 'play') {
      for (const bundle of candidate.bundles) if (PLAY_EXCLUDED_BUNDLES.includes(bundle)) errors.push(`${where} requires excluded bundle ${bundle}; declare it transitional with a reason.`);
      for (const name of candidate.data) if (DATA_GLOBALS.find(([data]) => data === name)?.[1] === 'export-payloads') errors.push(`${where} must not embed export payload ${name}.`);
      if (!candidate.minify) errors.push(`${where} must be minified.`);
    }
    const resolved = INSERTS.filter(insert => profileBundles(candidate).includes(insert[3])).map(insert => insert[0]);
    if (!subsequence(resolved, names)) errors.push(`${where} insert order is not a subsequence of INSERTS.`);
  }
  // Standalone templates do not load the colony stylesheet; their tokens must mirror it exactly.
  const base = tokens(fs.readFileSync(path.join(source, 'style.css'), 'utf8')), play = tokens(fs.readFileSync(path.join(source, 'play.css'), 'utf8'));
  if (!play.size) errors.push('play.css declares no design tokens.');
  for (const [name, value] of play) if (base.get(name) !== value) errors.push(`play.css token ${name} differs from style.css.`);
  return errors;
}
