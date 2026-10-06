/**
 * Build-only HTML artifact assembler. build.ts compiles once; this module turns one profile
 * {template, bundles, data, minify, variables} into one self-contained HTML document.
 *
 * Templates are authored HTML under the source root. Whole-line `<!-- INCLUDE name.html -->`
 * directives expand partials from source/templates; `{{NAME}}` tokens take HTML-escaped profile
 * variables. Inserts are placed by explicit `<!-- INLINE_<MARKER> -->` lines (showcase) or by
 * the group markers `<!-- INLINE_STYLES -->` / `<!-- INLINE_SCRIPTS -->`, always in canonical
 * INSERTS order. `<!-- INLINE_CONTENT_DATA -->` receives the profile's data globals.
 * Output is deterministic: no timestamps, absolute paths or environment-dependent bytes.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {transformSync} from 'esbuild';
import {INSERTS, type BundleTag, type Insert, type InsertKind} from './build-inserts.cjs';
import {DATA_GLOBALS, profileBundles, type ArtifactProfile} from './artifact-profiles.cjs';

export interface AssemblyInput {
  /** Authored source root (source/wildlands/source). */
  readonly source: string;
  /** Compiler output root (source/wildlands/.generated). */
  readonly generated: string;
  /** Available data globals; the profile's names must all be present. */
  readonly data: ReadonlyMap<string, unknown>;
  /** Optional per-build cache so each script is minified once across profiles. */
  readonly minified?: Map<string, string>;
}
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

const MARKER = /<!-- INLINE_([A-Z0-9_]+) -->/g;
const GROUPS: Readonly<Record<string, InsertKind>> = {STYLES: 'style', SCRIPTS: 'script'};
const byteLength = (text: string): number => Buffer.byteLength(text, 'utf8');
const escapeHtml = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** Expand whole-line includes (bounded depth) and `{{NAME}}` variables in authored template text. */
export function resolveTemplate(source: string, template: string, variables: Readonly<Record<string, string>>): string {
  const templates = path.join(source, 'templates');
  const expand = (text: string, depth: number): string => text.replace(/^<!-- INCLUDE ([a-z0-9-]+\.html) -->\n/gm, (_line, name: string) => {
    if (depth >= 4) throw Error(`Template include nesting is too deep at ${name}.`);
    const partial = fs.readFileSync(path.join(templates, name), 'utf8');
    if (!partial.endsWith('\n')) throw Error(`Template partial ${name} must end with a newline.`);
    return expand(partial, depth + 1);
  });
  const expanded = expand(fs.readFileSync(path.join(source, template), 'utf8'), 0);
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

/** esbuild 0.25.12 whitespace+syntax minification; identifiers and legal comments are kept. */
export function minifyScript(code: string, cache?: Map<string, string>): string {
  const cached = cache?.get(code);
  if (cached !== undefined) return cached;
  const result = transformSync(code, {loader: 'js', minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false,
    legalComments: 'inline', charset: 'utf8', logLevel: 'silent'}).code.replace(/\n$/, '');
  cache?.set(code, result);
  return result;
}

function insertText(insert: Insert, input: AssemblyInput, minify: boolean): string {
  const [, file, kind] = insert;
  const location = kind === 'style' ? path.join(input.source, file) : file.startsWith('../vendor/') ? path.resolve(input.source, file) : path.join(input.generated, file);
  const raw = fs.readFileSync(location, 'utf8');
  const content = minify && kind === 'script' ? minifyScript(raw, input.minified) : raw;
  if (content.toLowerCase().includes(`</${kind}`)) throw Error(`${file} contains an unsafe inline closing tag.`);
  return `<${kind}>\n${content}\n</${kind}>`;
}

/** Assemble one profile into HTML plus a manifest of every inlined segment. */
export function assembleArtifact(profile: ArtifactProfile, input: AssemblyInput): AssembledArtifact {
  const bundles = profileBundles(profile), selected = INSERTS.filter(insert => bundles.includes(insert[3]));
  const template = resolveTemplate(input.source, profile.template, profile.variables);
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
  const data = dataScript(profile.data, input.data);
  blocks.set('CONTENT_DATA', {text: data.script, segments: data.segments});
  for (const insert of selected) {
    const text = insertText(insert, input, profile.minify), segment: ArtifactSegment = {kind: insert[2], name: insert[0], bundle: insert[3], bytes: byteLength(text)};
    if (explicit.includes(insert[0])) { blocks.set(insert[0], {text, segments: [segment]}); continue; }
    const group = insert[2] === 'style' ? 'STYLES' : 'SCRIPTS', prior = blocks.get(group);
    blocks.set(group, prior ? {text: prior.text + '\n' + text, segments: [...prior.segments, segment]} : {text, segments: [segment]});
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

/** Exclusive temporary file plus rename, so readers never observe a partial artifact. */
export function writeArtifact(outputPath: string, content: string): void {
  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  const temporary = outputPath + '.' + randomUUID() + '.tmp';
  let owned = false;
  try {
    const descriptor = fs.openSync(temporary, 'wx'); owned = true;
    try { fs.writeFileSync(descriptor, content, 'utf8'); } finally { fs.closeSync(descriptor); }
    fs.renameSync(temporary, outputPath); owned = false;
  } finally { if (owned) fs.rmSync(temporary, {force: true}); }
}
