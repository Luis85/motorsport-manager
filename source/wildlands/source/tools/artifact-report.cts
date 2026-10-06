/**
 * Read-only size report for built artifacts: per insert, bundle, data global and compressed
 * payload of an HTML artifact, and the embedded payloads of the bundled CLI (bin/wildlands).
 *
 *   node --import tsx source/tools/artifact-report.cts [--html FILE]... [--cli FILE]... [--top N] [--out FILE]
 *
 * Without --html/--cli it reports littlewild.html, every .generated/artifacts/*.html and
 * ../../bin/wildlands when present. A sidecar <name>.manifest.json written by the assembler is
 * used when its sha256 matches; otherwise inline blocks are identified by content against the
 * current INSERTS sources (unmatched blocks are reported as unknown, never guessed).
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync, inflateRawSync} from 'node:zlib';
import {INSERTS} from './build-inserts.cjs';
import type {ArtifactManifest, ArtifactSegment} from './artifact-assembler.cjs';

const PROJECT = path.resolve(__dirname, '../..');
const SOURCE = path.join(PROJECT, 'source');
const GENERATED = path.join(PROJECT, '.generated');
const MAX_DECODED = 256 * 1024 * 1024;

interface FileEntry {path: string; bytes: number; role?: string;}
interface PayloadReport {encoding: string; storedBytes: number; decodedBytes: number; files: number; byRole?: Record<string, number>; largest: FileEntry[];}
const sha256 = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
const bytes = (text: string): number => Buffer.byteLength(text, 'utf8');
const add = (record: Record<string, number>, key: string, value: number): void => { record[key] = (record[key] ?? 0) + value; };
/** Paths inside the repository are reported relative to the project; anything else stays absolute. */
const display = (file: string): string => {
  const relative = path.relative(path.resolve(PROJECT, '../..'), file);
  return relative.startsWith('..') || path.isAbsolute(relative) ? file : relative.replaceAll(path.sep, '/');
};
const sorted = (record: Record<string, number>): Record<string, number> => Object.fromEntries(Object.entries(record).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)));

function largest(entries: FileEntry[], top: number): FileEntry[] {
  return [...entries].sort((a, b) => b.bytes - a.bytes || (a.path < b.path ? -1 : 1)).slice(0, top);
}

/** Summarize a decoded {files:[...]} bundle: engine sources carry roles, runtime files carry content. */
function bundleReport(encoding: string, storedBytes: number, raw: Buffer, top: number): PayloadReport {
  if (raw.length > MAX_DECODED) throw Error('Decoded payload exceeds the report bound.');
  const bundle = JSON.parse(raw.toString('utf8')) as {files?: Array<{path: string; role?: string; bytes?: number; text?: string; content?: string}>};
  const files: FileEntry[] = (bundle.files ?? []).map(file => ({path: file.path, bytes: file.bytes ?? bytes(file.text ?? file.content ?? ''), ...(file.role ? {role: file.role} : {})}));
  const byRole: Record<string, number> = {};
  for (const file of files) if (file.role) add(byRole, file.role, file.bytes);
  return {encoding, storedBytes, decodedBytes: raw.length, files: files.length, ...(Object.keys(byRole).length ? {byRole: sorted(byRole)} : {}), largest: largest(files, top)};
}

function payload(name: string, value: unknown, top: number): PayloadReport | null {
  const loader = value as {encoding?: string; data?: string} | null;
  if (!loader || loader.encoding !== 'gzip-base64' || typeof loader.data !== 'string') return null;
  const compressed = Buffer.from(loader.data, 'base64');
  try { return bundleReport('gzip-base64', compressed.length, gunzipSync(compressed, {maxOutputLength: MAX_DECODED}), top); }
  catch (error) { throw Error(`${name} payload could not be decoded: ${error instanceof Error ? error.message : String(error)}`); }
}

/** Identify inline blocks by exact content against the current INSERTS sources. */
function knownInserts(): Map<string, {name: string; bundle: string}> {
  const known = new Map<string, {name: string; bundle: string}>();
  for (const [name, file, kind, bundle] of INSERTS) {
    const location = kind === 'style' ? path.join(SOURCE, file) : file.startsWith('../vendor/') ? path.resolve(SOURCE, file) : path.join(GENERATED, file);
    if (fs.existsSync(location)) known.set(sha256(fs.readFileSync(location, 'utf8')), {name, bundle});
  }
  return known;
}

function parsedSegments(html: string): ArtifactSegment[] {
  const known = knownInserts(), segments: ArtifactSegment[] = [];
  let unknown = 0;
  for (const match of html.matchAll(/<(style|script)>\n([\s\S]*?)\n<\/\1>/g)) {
    const kind = match[1] as 'style' | 'script', content = match[2]!;
    if (kind === 'script' && /^window\.[A-Za-z]\w* = /.test(content)) {
      for (const line of content.split('\n')) segments.push({kind: 'data', name: /^window\.(\w+) = /.exec(line)?.[1] ?? 'unknown-data', bundle: null, bytes: bytes(line) + 1});
      continue;
    }
    const insert = known.get(sha256(content));
    segments.push({kind, name: insert?.name ?? `unknown-${kind}-${++unknown}`, bundle: (insert?.bundle ?? null) as ArtifactSegment['bundle'], bytes: bytes(match[0])});
  }
  return segments;
}

function htmlReport(file: string, top: number): Record<string, unknown> {
  const html = fs.readFileSync(file, 'utf8'), digest = sha256(html), sidecar = file.replace(/\.html$/, '.manifest.json');
  let manifest: ArtifactManifest | null = null;
  if (sidecar !== file && fs.existsSync(sidecar)) {
    const candidate = JSON.parse(fs.readFileSync(sidecar, 'utf8')) as ArtifactManifest;
    if (candidate.format === 'wildlands-artifact-manifest' && candidate.sha256 === digest) manifest = candidate;
  }
  const segments = manifest ? [...manifest.segments] : parsedSegments(html);
  const totals: Record<string, number> = {style: 0, script: 0, data: 0}, byBundle: Record<string, number> = {};
  for (const segment of segments) { add(totals, segment.kind, segment.bytes); if (segment.bundle) add(byBundle, segment.bundle, segment.bytes); }
  const payloads: Record<string, PayloadReport> = {};
  for (const match of html.matchAll(/^window\.(LWEngineSourceLoader|WildlandsGodotRuntimeLoader) = (.*);$/gm)) {
    const report = payload(match[1]!, JSON.parse(match[2]!) as unknown, top);
    if (report) payloads[match[1]!] = report;
  }
  const accounted = totals.style! + totals.script! + totals.data!;
  return {kind: 'html', path: display(file), bytes: bytes(html), sha256: digest,
    segmentSource: manifest ? 'manifest' : 'parsed', ...(manifest ? {profile: manifest.profile, minified: manifest.minified, transitionalBundles: manifest.transitionalBundles} : {}),
    totals: {...totals, markupAndWrappers: bytes(html) - accounted}, byBundle: sorted(byBundle),
    data: segments.filter(segment => segment.kind === 'data').map(segment => ({name: segment.name, bytes: segment.bytes})).sort((a, b) => b.bytes - a.bytes),
    largestInserts: segments.filter(segment => segment.kind !== 'data').sort((a, b) => b.bytes - a.bytes).slice(0, top), payloads};
}

/** The bundled CLI embeds `RUNTIME = {...};` and `ENGINE = {...};` raw-deflate payloads (esbuild may indent them). */
function cliReport(file: string, top: number): Record<string, unknown> {
  const text = fs.readFileSync(file, 'utf8'), payloads: Record<string, PayloadReport> = {};
  let payloadBytes = 0;
  for (const match of text.matchAll(/^[ \t]*(?:const|var|let) (RUNTIME|ENGINE) = (\{.*\});$/gm)) {
    const item = JSON.parse(match[2]!) as {bytes: number; sha256: string; data: string};
    const compressed = Buffer.from(item.data, 'base64'), raw = inflateRawSync(compressed, {maxOutputLength: MAX_DECODED});
    if (raw.length !== item.bytes || sha256(raw) !== item.sha256) throw Error(`${file} ${match[1]} payload integrity failed.`);
    payloads[match[1]!] = bundleReport('deflate-raw-base64', compressed.length, raw, top);
    payloadBytes += bytes(match[0]);
  }
  return {kind: 'cli', path: display(file), bytes: bytes(text), sha256: sha256(text),
    totals: {embeddedPayloadLines: payloadBytes, codeAndResources: bytes(text) - payloadBytes}, payloads};
}

function main(argv: readonly string[]): void {
  const html: string[] = [], cli: string[] = [];
  let top = 10, out: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index], value = argv[index + 1];
    if (flag === '--help' || flag === '-h') { process.stdout.write('Usage: artifact-report [--html FILE]... [--cli FILE]... [--top N] [--out FILE]\n'); return; }
    if (!value || value.startsWith('--')) throw Error(`Missing value for ${flag}.`);
    index += 1;
    if (flag === '--html') html.push(path.resolve(value));
    else if (flag === '--cli') cli.push(path.resolve(value));
    else if (flag === '--top' && /^[1-9]\d{0,3}$/.test(value)) top = Number(value);
    else if (flag === '--out') out = path.resolve(value);
    else throw Error(`Unknown or invalid argument: ${flag}`);
  }
  if (!html.length && !cli.length) {
    const artifacts = path.join(GENERATED, 'artifacts');
    for (const candidate of [path.join(PROJECT, 'littlewild.html'), ...(fs.existsSync(artifacts) ? fs.readdirSync(artifacts).sort().filter(name => name.endsWith('.html')).map(name => path.join(artifacts, name)) : [])])
      if (fs.existsSync(candidate)) html.push(candidate);
    const bundled = path.resolve(PROJECT, '../../bin/wildlands');
    if (fs.existsSync(bundled)) cli.push(bundled);
  }
  const report = {format: 'wildlands-artifact-report', schemaVersion: 1, artifacts: [...html.map(file => htmlReport(file, top)), ...cli.map(file => cliReport(file, top))]};
  const text = JSON.stringify(report, null, 2) + '\n';
  if (out) fs.writeFileSync(out, text); else process.stdout.write(text);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write('Artifact report failed: ' + (error instanceof Error ? error.message : String(error)) + '\n'); process.exitCode = 2; }
}
