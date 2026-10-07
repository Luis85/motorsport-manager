/**
 * Pure HTML artifact placement shared by the build-time assembler (artifact-assembler.cts, which
 * reads and minifies inserts from disk) and the game builder (game-build.cts, which reads them
 * from the precomputed engine kit). Both hand this module an expanded template and a function
 * returning each insert's final text, so a profile places identically from either source.
 * No file system, compiler or minifier is used here: the bundled CLI runs it without node_modules.
 */
import {createHash} from 'node:crypto';
import {INSERTS, type BundleTag, type Insert, type InsertKind} from './build-inserts.cjs';
import {DATA_GLOBALS, profileBundles, type ArtifactProfile} from './artifact-profiles.cjs';

export interface ArtifactSegment {readonly kind: InsertKind | 'data'; readonly name: string; readonly bundle: BundleTag | null; readonly bytes: number;}
export interface ArtifactManifest {
  readonly format: 'wildlands-artifact-manifest';
  readonly schemaVersion: 1;
  readonly profile: string;
  readonly template: string;
  readonly minified: boolean;
  readonly bytes: number;
  readonly sha256: string;
  readonly bundles: readonly BundleTag[];
  readonly transitionalBundles: readonly BundleTag[];
  readonly segments: readonly ArtifactSegment[];
}
export interface AssembledArtifact {readonly html: string; readonly manifest: ArtifactManifest;}
/** Final inline text of one insert (`<script>…</script>` or `<style>…</style>`). */
export type InsertText = (insert: Insert) => string;

const MARKER = /<!-- INLINE_([A-Z0-9_]+) -->/g;
const GROUPS: Readonly<Record<string, InsertKind>> = {STYLES: 'style', SCRIPTS: 'script'};
const byteLength = (text: string): number => Buffer.byteLength(text, 'utf8');
export const escapeHtml = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** Replace `{{NAME}}` tokens of an include-expanded template with HTML-escaped profile variables. */
export function substituteVariables(expanded: string, variables: Readonly<Record<string, string>>, template: string): string {
  if (expanded.includes('<!-- INCLUDE')) throw Error('Template include directives must occupy a whole line.');
  const used = new Set<string>();
  const resolved = expanded.replace(/\{\{([A-Z][A-Z0-9_]*)\}\}/g, (_token, name: string) => {
    const value = variables[name];
    if (value === undefined) throw Error(`Template variable ${name} has no profile value.`);
    used.add(name);
    return escapeHtml(value);
  });
  if (/\{\{|\}\}/.test(resolved)) throw Error('Template contains a malformed {{variable}} token.');
  const unused = Object.keys(variables).filter(name => !used.has(name));
  if (unused.length) throw Error(`Profile variables are not used by ${template}: ${unused.join(', ')}.`);
  return resolved;
}

/** Inline data script; JSON is escaped so no `<`, `>` or `&` can end the script element. */
export function dataScript(names: readonly string[], data: ReadonlyMap<string, unknown>): {script: string; segments: ArtifactSegment[]} {
  const declarations = DATA_GLOBALS.map(([name]) => name).filter(name => names.includes(name)).map(name => {
    if (!data.has(name)) throw Error(`Artifact data global ${name} is unavailable.`);
    const line = `window.${name} = ${JSON.stringify(data.get(name))};`.replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
    return {name, line};
  });
  return {script: `<script>\n${declarations.map(entry => entry.line).join('\n')}\n</script>`,
    segments: declarations.map(entry => ({kind: 'data', name: entry.name, bundle: null, bytes: byteLength(entry.line) + 1}))};
}

/** Wrap insert content as its inline element, rejecting text that could close the element early. */
export function inlineElement(insert: Insert, content: string): string {
  const [, file, kind] = insert;
  if (content.toLowerCase().includes(`</${kind}`)) throw Error(`${file} contains an unsafe inline closing tag.`);
  return `<${kind}>\n${content}\n</${kind}>`;
}

/**
 * Place one profile into a variable-resolved template: canonical INSERTS order, explicit markers
 * or style/script groups, and the profile's data globals at `<!-- INLINE_CONTENT_DATA -->`.
 */
export function placeArtifact(profile: ArtifactProfile, template: string, text: InsertText, data: ReadonlyMap<string, unknown>): AssembledArtifact {
  const bundles = profileBundles(profile), selected = INSERTS.filter(insert => bundles.includes(insert[3]));
  const actual = [...template.matchAll(MARKER)].map(match => match[1]!);
  const duplicates = [...new Set(actual.filter((name, index) => actual.indexOf(name) !== index))];
  const explicit = actual.filter(name => name !== 'CONTENT_DATA' && !(name in GROUPS));
  const unknown = explicit.filter(name => !selected.some(insert => insert[0] === name));
  const grouped = new Set(Object.entries(GROUPS).filter(([name]) => actual.includes(name)).map(([, kind]) => kind));
  const missing = selected.filter(insert => !explicit.includes(insert[0]) && !grouped.has(insert[2])).map(insert => insert[0]);
  const mixed = selected.filter(insert => explicit.includes(insert[0]) && grouped.has(insert[2])).map(insert => insert[0]);
  if (!actual.includes('CONTENT_DATA')) missing.push('CONTENT_DATA');
  const canonical = selected.map(insert => insert[0]).filter(name => explicit.includes(name));
  if (duplicates.length || missing.length || unknown.length || mixed.length || JSON.stringify(canonical) !== JSON.stringify(explicit)) {
    throw Error('Inline template contract mismatch: ' + JSON.stringify({profile: profile.id, duplicates, missing, unknown, mixed,
      outOfOrder: JSON.stringify(canonical) !== JSON.stringify(explicit)}));
  }
  const blocks = new Map<string, {text: string; segments: ArtifactSegment[]}>();
  const available = profile.game ? new Map([...data, ['LWGameProfile', profile.game]]) : data;
  const declared = dataScript(profile.data, available);
  blocks.set('CONTENT_DATA', {text: declared.script, segments: declared.segments});
  for (const insert of selected) {
    const inline = text(insert), segment: ArtifactSegment = {kind: insert[2], name: insert[0], bundle: insert[3], bytes: byteLength(inline)};
    if (explicit.includes(insert[0])) { blocks.set(insert[0], {text: inline, segments: [segment]}); continue; }
    const group = insert[2] === 'style' ? 'STYLES' : 'SCRIPTS', prior = blocks.get(group);
    blocks.set(group, prior ? {text: prior.text + '\n' + inline, segments: [...prior.segments, segment]} : {text: inline, segments: [segment]});
  }
  const order: ArtifactSegment[] = [];
  const html = template.replace(MARKER, (_marker, name: string) => {
    const block = blocks.get(name) ?? (name in GROUPS ? {text: '', segments: []} : undefined);
    if (!block) throw Error(`Unknown inline build key: ${name}`);
    order.push(...block.segments);
    return block.text;
  });
  if (html.includes('<!-- INLINE_')) throw Error('Unresolved inline build marker.');
  return {html, manifest: {format: 'wildlands-artifact-manifest', schemaVersion: 1, profile: profile.id, template: profile.template,
    minified: profile.minify, bytes: byteLength(html), sha256: createHash('sha256').update(html, 'utf8').digest('hex'),
    bundles, transitionalBundles: [...(profile.transitional?.bundles ?? [])], segments: order}};
}
