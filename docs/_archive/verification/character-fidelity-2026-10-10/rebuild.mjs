/** Replay with Node.js 22+ and the matching final Wildlands executable. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const [binaryArgument, outputArgument] = process.argv.slice(2);
if (!binaryArgument || !outputArgument || process.argv.length !== 4)
  throw new Error('Usage: node rebuild.mjs /path/to/bin/wildlands /new/path/showcase.html');
const binary = resolve(binaryArgument), output = resolve(outputArgument);
const root = dirname(fileURLToPath(import.meta.url));
const manifest = resolve(root, 'storyboard.json');
const receiptFile = output.replace(/\.html$/i, '.receipt.json');
const provenanceFile = output.replace(/\.html$/i, '.provenance.json');
if (!output.toLowerCase().endsWith('.html')) throw new Error('Output must end in .html.');
for (const file of [output, receiptFile, provenanceFile])
  if (existsSync(file)) throw new Error(`Choose new output paths; file already exists: ${file}`);
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const binaryHash = hash(binary);
function invoke(args) {
  const result = spawnSync(process.execPath, [binary, ...args], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stdout || result.stderr);
  const value = JSON.parse(result.stdout);
  if (!value.ok) throw new Error(JSON.stringify(value));
  return value;
}
const proposed = invoke(['storyboard', 'build', '--input', manifest, '--dry-run']);
if (proposed.receipt.html.bytes >= 24 * 1024 * 1024) throw new Error('Showcase exceeds the 24 MiB presentation budget.');
const result = invoke(['storyboard', 'build', '--input', manifest, '--output', output]);
if (result.receipt.html.sha256 !== proposed.receipt.html.sha256 || hash(binary) !== binaryHash)
  throw new Error('Inputs or executable changed between dry-run and publication. Inspect the new output.');
writeFileSync(receiptFile, JSON.stringify(result.receipt, null, 2) + '\n', { flag: 'wx' });
writeFileSync(provenanceFile, JSON.stringify({
  format: 'character-fidelity-showcase-build', schemaVersion: 1,
  historicalDate: '2026-10-10', executable: 'bin/wildlands', executableSha256: binaryHash,
  nodeVersion: process.version, manifest: 'storyboard.json', manifestSha256: hash(manifest),
  output: basename(output), outputSha256: result.receipt.html.sha256,
  validation: 'Presentation composition only; supplied review images are hash checked when declared.',
}, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ ok: true, output, receiptFile, provenanceFile, bytes: result.receipt.html.bytes }) + '\n');
