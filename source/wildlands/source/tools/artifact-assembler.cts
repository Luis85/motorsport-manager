/**
 * Build-only HTML artifact assembler. build.ts compiles once; this module turns one profile
 * {template, bundles, data, minify, variables} into one self-contained HTML document.
 *
 * Templates are authored HTML under the source root. Whole-line `<!-- INCLUDE name.html -->`
 * directives expand partials from source/templates; `{{NAME}}` tokens take HTML-escaped profile
 * variables. Inserts are placed by explicit `<!-- INLINE_<MARKER> -->` lines (showcase) or by
 * the group markers `<!-- INLINE_STYLES -->` / `<!-- INLINE_SCRIPTS -->`, always in canonical
 * INSERTS order. `<!-- INLINE_CONTENT_DATA -->` receives the profile's data globals.
 * Output is deterministic: no timestamps, absolute paths or environment-dependent bytes. Placement
 * itself lives in artifact-placement.cts, shared with the game builder (game-build.cts).
 */
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {transformSync} from 'esbuild';
import type {Insert} from './build-inserts.cjs';
import type {ArtifactProfile} from './artifact-profiles.cjs';
import {inlineElement, placeArtifact, substituteVariables, type AssembledArtifact} from './artifact-placement.cjs';

export {dataScript, type ArtifactManifest, type ArtifactSegment, type AssembledArtifact} from './artifact-placement.cjs';
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

/** Expand whole-line `<!-- INCLUDE name.html -->` partials (bounded depth) of an authored template. */
export function expandTemplate(source: string, template: string): string {
  const templates = path.join(source, 'templates');
  const expand = (text: string, depth: number): string => text.replace(/^<!-- INCLUDE ([a-z0-9-]+\.html) -->\n/gm, (_line, name: string) => {
    if (depth >= 4) throw Error(`Template include nesting is too deep at ${name}.`);
    const partial = fs.readFileSync(path.join(templates, name), 'utf8');
    if (!partial.endsWith('\n')) throw Error(`Template partial ${name} must end with a newline.`);
    return expand(partial, depth + 1);
  });
  const expanded = expand(fs.readFileSync(path.join(source, template), 'utf8'), 0);
  if (expanded.includes('<!-- INCLUDE')) throw Error('Template include directives must occupy a whole line.');
  return expanded;
}

/** Expand whole-line includes (bounded depth) and `{{NAME}}` variables in authored template text. */
export function resolveTemplate(source: string, template: string, variables: Readonly<Record<string, string>>): string {
  return substituteVariables(expandTemplate(source, template), variables, template);
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

/** Authored or compiled content of one insert, minified for scripts when `minify` is set. */
export function insertContent(insert: Insert, source: string, generated: string, minify: boolean, cache?: Map<string, string>): string {
  const [, file, kind] = insert;
  const location = kind === 'style' ? path.join(source, file) : file.startsWith('../vendor/') ? path.resolve(source, file) : path.join(generated, file);
  const raw = fs.readFileSync(location, 'utf8');
  return minify && kind === 'script' ? minifyScript(raw, cache) : raw;
}

/** Assemble one profile into HTML plus a manifest of every inlined segment. */
export function assembleArtifact(profile: ArtifactProfile, input: AssemblyInput): AssembledArtifact {
  const template = resolveTemplate(input.source, profile.template, profile.variables);
  return placeArtifact(profile, template, insert => inlineElement(insert, insertContent(insert, input.source, input.generated, profile.minify, input.minified)), input.data);
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
