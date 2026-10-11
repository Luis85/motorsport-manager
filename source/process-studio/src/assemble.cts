/**
 * `process build`: one self-contained offline HTML file from an admitted definition and the embedded engine kit.
 *
 * Byte-identical to `wildlands process build`, which hands the same one-definition game to
 * game-build.cts `assembleGame(game, 'play')`. The profile and placement rules are Wildlands' own (bridged:
 * artifact-profiles, artifact-placement); this module repeats only the few steps of `assembleGame` a process play
 * build takes: the variable substitution, the identity meta elements before the single `<title>`, the kit's insert
 * text and the play budget. tests/build.test.cts compares every agency demo definition byte for byte with bin/wildlands.
 */
import {catalog, gameProfile, inlineElement, placeArtifact, substituteVariables, type Insert} from './kernel.cjs';
import {sha256} from './payload.cjs';
import type {ProcessKit} from './kit.cjs';

/** Play budget `wildlands process build` gives a single-definition game (16 MiB). */
export const BUILD_BUDGET_BYTES = 16 * 1024 * 1024;

/** Identity meta elements, placed immediately before the template's single `<title>` (as game-build.cts does). */
function identify(html: string, engine: string, digest: string): string {
 const at = html.indexOf('<title>');
 if (at < 0 || html.indexOf('<title>', at + 1) >= 0 || at > html.indexOf('</head>')) throw Error('Game templates need exactly one <title> in their head.');
 return html.slice(0, at) + `<meta name="wildlands-engine" content="${engine}"><meta name="wildlands-game-digest" content="${digest}">\n` + html.slice(at);
}

export function buildHtml(input: unknown, kit: ProcessKit): {html: string; bytes: number; sha256: string} {
 const d = catalog.admit(input), digest = sha256(JSON.stringify(d)), namespace = 'wildlands.' + d.id;
 const data = new Map<string, unknown>([['LWProcessDefinition', d], ['LWGameProfile', {storage: {namespace}}]]);
 const candidate = gameProfile({id: d.id, template: 'process', presentation: {title: d.name}, storage: {namespace}}, 'play', new Set(data.keys()));
 if (candidate.id !== kit.profile || candidate.template !== kit.template) {
  throw Error(`The embedded engine kit serves ${kit.profile} (${kit.template}), not ${candidate.id} (${candidate.template}). Rebuild bin/process-studio.`);
 }
 const template = identify(substituteVariables(kit.templateText, candidate.variables, candidate.template), kit.engine, digest);
 const text = (insert: Insert): string => {
  const content = kit.inserts[insert[0]];
  if (content === undefined) throw Error(`The engine kit lacks ${insert[0]} for ${candidate.id}. Rebuild Wildlands.`);
  return inlineElement(insert, content);
 };
 const placed = placeArtifact(candidate, template, text, data);
 if (placed.manifest.bytes > BUILD_BUDGET_BYTES) {
  throw Error(`${d.id} play artifact is ${placed.manifest.bytes} bytes, over its budget of ${BUILD_BUDGET_BYTES} bytes (game.json targets.html.budgetBytes).`);
 }
 return {html: placed.html, bytes: placed.manifest.bytes, sha256: placed.manifest.sha256};
}
