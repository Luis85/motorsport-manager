/**
 * Build-only: bundle src/cli.cts into the checked-in, dependency-free executable bin/process-studio.
 *
 *   node --import tsx scripts/bundle.cts --output ../../bin/process-studio   (npm run build:cli)
 *   node --import tsx scripts/bundle.cts --check ../../bin/process-studio    (npm run check:cli)
 *
 * The result is one CommonJS file for Node.js 22+: the Process Studio sources, the bridged Wildlands closure
 * (exactly scripts/bridge.cts) and one raw-deflate payload holding the process play slice of the Wildlands engine kit,
 * extracted from the checked-in bin/wildlands and verified (src/kit-source.cts). It needs no node_modules and never
 * reads bin/wildlands. The payload is compressed with the pinned pure-JavaScript pako, not Node's zlib, so the bytes do
 * not depend on the Node release; there are no timestamps, absolute paths or source maps. Every candidate is smoke-tested
 * (scripts/smoke.cts) before it is written or accepted. `--check` fails when the checked-in file differs or is not executable;
 * because the payload carries the engine identity, any Wildlands engine change makes it stale until it is rebuilt.
 */
import fs from 'node:fs';
import path from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {build, type Metafile, type Plugin} from 'esbuild';
import {BRIDGE, CLOSURE, WILDLANDS_SOURCE} from './bridge.cjs';
import {smoke} from './smoke.cjs';
import {checkoutKit} from '../src/kit-source.cjs';
import {sha256} from '../src/payload.cjs';

// pako ships no declarations; this is the one deterministic encoder entry point used here.
const pako = require('pako') as {deflateRaw(data: Uint8Array, options: {level: number}): Uint8Array};
export const PROJECT = path.resolve(__dirname, '..');
export const REPOSITORY = path.resolve(PROJECT, '../..');
const ENTRY = 'src/cli.cts';
const EMBEDDED = 'process-studio-embedded';
const BUILD_ONLY = 'process-studio-build-only';
const WILDLANDS = path.relative(PROJECT, path.join(REPOSITORY, WILDLANDS_SOURCE)).replaceAll(path.sep, '/') + '/';

export interface BundleResult {readonly bytes: Buffer; readonly sha256: string; readonly engine: string; readonly sourceIdentity: string;}

/** Deterministic payload; src/payload.cts verifies size and SHA-256 after inflating. */
function payload(text: string): {bytes: number; sha256: string; data: string} {
 const raw = Buffer.from(text, 'utf8'), data = Buffer.from(pako.deflateRaw(raw, {level: 9}));
 if (!inflateRawSync(data).equals(raw)) throw Error('Embedded payload does not round-trip.');
 return {bytes: raw.length, sha256: sha256(raw), data: data.toString('base64')};
}

/** The embedded module and the checkout-only kit extractor's stub. */
function resources(embedded: () => string): Plugin {
 return {name: 'process-studio-resources', setup(context) {
  context.onResolve({filter: new RegExp('^' + EMBEDDED + '$')}, () => ({path: EMBEDDED, namespace: EMBEDDED}));
  context.onLoad({filter: /.*/, namespace: EMBEDDED}, () => ({contents: embedded(), loader: 'js'}));
  // A checkout extracts the kit from bin/wildlands; the distribution never does.
  context.onResolve({filter: /^\.\/kit-source\.cjs$/}, () => ({path: 'kit-source', namespace: BUILD_ONLY}));
  context.onLoad({filter: /.*/, namespace: BUILD_ONLY},
   () => ({contents: 'exports.checkoutKit = () => { throw Error("The engine kit is embedded in this distribution."); };', loader: 'js'}));
 }};
}

async function bundleOnce(embedded: () => string): Promise<{text: string; metafile: Metafile}> {
 const result = await build({
  absWorkingDir: PROJECT, entryPoints: [ENTRY], bundle: true, write: false, metafile: true,
  platform: 'node', format: 'cjs', target: 'node22', charset: 'ascii', legalComments: 'eof',
  sourcemap: false, minify: false, treeShaking: true, logLevel: 'silent', outfile: 'process-studio', plugins: [resources(embedded)]
 });
 if (result.warnings.length) throw Error('esbuild warnings: ' + result.warnings.map(warning => warning.text).join('; '));
 const output = result.outputFiles[0];
 if (!output || result.outputFiles.length !== 1) throw Error('Expected exactly one bundled output.');
 return {text: output.text, metafile: result.metafile};
}

/** Closure rules: only Process Studio sources, its package.json and the allowlisted Wildlands files; Wildlands only via the bridge. */
export function closureErrors(metafile: Metafile): string[] {
 const errors: string[] = [], inputs = Object.keys(metafile.inputs), used = new Set<string>();
 for (const input of inputs) {
  if (input.startsWith(WILDLANDS)) {
   const file = input.slice(WILDLANDS.length);
   if (CLOSURE.includes(file)) used.add(file);
   else errors.push(`${WILDLANDS_SOURCE}/${file} is not in the bridge closure allowlist (scripts/bridge.cts); add it there only if the bridge needs it.`);
  } else if (!/^src\/[a-z0-9/-]+\.cts$/.test(input) && input !== 'package.json' && !input.startsWith(EMBEDDED + ':') && !input.startsWith(BUILD_ONLY + ':')) {
   errors.push(`The bundle would contain ${input}; bin/process-studio carries no dependency and no file outside src/ and the bridge closure.`);
  }
  if (input.startsWith('src/') && input !== BRIDGE) {
   for (const entry of metafile.inputs[input]!.imports) {
    if (entry.path.startsWith(WILDLANDS)) errors.push(`${input} imports ${entry.path}; only ${BRIDGE} may import Wildlands.`);
   }
  }
 }
 for (const file of CLOSURE) {
  if (!used.has(file)) errors.push(`Stale bridge closure entry ${file}: the bundle no longer uses it; remove it from scripts/bridge.cts.`);
 }
 return errors;
}

/** SHA-256 over every bundled source file (repository-relative path and content digest), in path order. */
function sourceIdentity(metafile: Metafile): string {
 const files = Object.keys(metafile.inputs).filter(input => !input.includes(':')).map(input => path.resolve(PROJECT, input));
 const lines = files.map(file => path.relative(REPOSITORY, file).replaceAll(path.sep, '/') + '\0' + sha256(fs.readFileSync(file)))
  .sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
 return sha256(lines.join('\n') + '\n');
}

/** The in-memory bundle analysis used by npm run architecture: closure errors of the current sources. */
export async function analyse(): Promise<string[]> {
 return closureErrors((await bundleOnce(() => 'module.exports = {};')).metafile);
}

/** Build the executable's bytes. Two passes: the second embeds the identity of the closure the first one found. */
export async function bundle(): Promise<BundleResult> {
 const kit = checkoutKit(), kitPayload = payload(JSON.stringify(kit));
 const first = await bundleOnce(() => 'module.exports = {};');
 const errors = closureErrors(first.metafile);
 if (errors.length) throw Error('Bundle closure check failed:\n' + errors.join('\n'));
 const identity = sourceIdentity(first.metafile);
 const embedded = () => `"use strict";\nmodule.exports = {sourceIdentity: ${JSON.stringify(identity)}, kit: ${JSON.stringify(kitPayload)}};\n`;
 const second = await bundleOnce(embedded);
 if (sourceIdentity(second.metafile) !== identity) throw Error('The bundle closure changed between passes.');
 const banner = '// Generated by source/process-studio/scripts/bundle.cts - do not edit.\n'
  + '// Rebuild: cd source/process-studio && npm ci && npm run build:cli. Handbook: docs/reference/process-studio-cli.md\n'
  + `// Embeds the process play slice of Wildlands engine kit ${kit.engine} (from bin/wildlands); rebuild after any engine change.\n`;
 if (!second.text.startsWith('#!/usr/bin/env node\n')) throw Error('Bundled CLI lacks its node shebang.');
 const text = '#!/usr/bin/env node\n' + banner + second.text.slice('#!/usr/bin/env node\n'.length);
 if (text.includes(PROJECT) || text.includes(REPOSITORY)) throw Error('Bundled CLI contains an absolute build path.');
 const bytes = Buffer.from(text, 'utf8');
 return {bytes, sha256: sha256(bytes), engine: kit.engine, sourceIdentity: identity};
}

function writeExecutable(file: string, bytes: Buffer): void {
 fs.mkdirSync(path.dirname(file), {recursive: true});
 const temporary = file + '.' + process.pid + '.tmp';
 try { fs.writeFileSync(temporary, bytes, {flag: 'wx', mode: 0o755}); fs.chmodSync(temporary, 0o755); fs.renameSync(temporary, file); }
 finally { fs.rmSync(temporary, {force: true}); }
}

async function main(argv: readonly string[]): Promise<void> {
 const usage = 'Usage: node --import tsx scripts/bundle.cts (--output FILE | --check FILE)';
 const [mode, target] = argv;
 if (argv.length !== 2 || !target || (mode !== '--output' && mode !== '--check')) throw Error(usage);
 const file = path.resolve(target), built = await bundle();
 smoke(built.bytes, built.engine);
 const size = `${built.bytes.length.toLocaleString('en-US')} bytes, sha256 ${built.sha256}, engine ${built.engine}`;
 if (mode === '--output') {
  writeExecutable(file, built.bytes);
  process.stdout.write(`Built ${file} (${size})\n`);
  return;
 }
 const current = fs.existsSync(file) ? fs.readFileSync(file) : undefined;
 const executable = current === undefined || process.platform === 'win32' || (fs.statSync(file).mode & 0o111) === 0o111;
 if (!current || !current.equals(built.bytes) || !executable) {
  const checkedIn = current ? current.length + ' bytes, sha256 ' + sha256(current) : 'missing';
  throw Error(`${file} is stale (checked-in ${checkedIn}${executable ? '' : ', not executable'}; `
   + `rebuilt ${size}). Run npm run build:cli and commit bin/process-studio (a Wildlands engine change also needs it).`);
 }
 process.stdout.write(`${file} is current (${size})\n`);
}

if (require.main === module) {
 main(process.argv.slice(2)).catch(error => {
  process.stderr.write('process-studio bundle failed: ' + (error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
 });
}
