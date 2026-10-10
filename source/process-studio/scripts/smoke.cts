/**
 * Build-only: run a bin/process-studio candidate from an empty temporary directory with no node_modules. Where Node's
 * permission model is available, file access is confined to that directory, proving that nothing comes from the checkout
 * (no bin/wildlands, no Wildlands sources). It checks version and doctor, creates, validates and runs a starter, builds it
 * and compares the HTML byte for byte with `bin/wildlands process build` of the same file.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {WILDLANDS_BIN} from '../src/kit-source.cjs';

type Result = Record<string, unknown>;

export function smoke(bytes: Buffer, engine: string): void {
 const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'process-studio-smoke-'))), cli = path.join(directory, 'process-studio');
 const confine = process.allowedNodeEnvironmentFlags.has('--permission')
  ? ['--permission', '--allow-fs-read=' + directory, '--allow-fs-write=' + directory] : [];
 const spawn = (entry: string, args: readonly string[], flags: readonly string[]) =>
  spawnSync(process.execPath, [...flags, entry, ...args], {cwd: directory, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024});
 try {
  fs.writeFileSync(cli, bytes, {mode: 0o755});
  const run = (args: readonly string[], status = 0, entry = cli, flags: readonly string[] = confine): Result => {
   const child = spawn(entry, args, flags);
   const parsed = child.error || child.stderr ? undefined : JSON.parse(child.stdout) as Result;
   if (!parsed || child.status !== status || parsed.ok !== (status === 0) || parsed.protocolVersion !== 1) {
    throw Error(`Bundled CLI smoke failed: process-studio ${args.join(' ')} (exit ${child.status}, expected ${status}) `
     + (child.error?.message ?? (child.stderr + child.stdout).slice(0, 2000)));
   }
   return parsed;
  };
  const version = run(['--version']);
  if (version.engine !== engine || version.distribution !== 'bundle' || !/^[0-9a-f]{64}$/.test(String(version.sourceIdentity))) {
   throw Error('Bundled CLI reports the wrong version identity: ' + JSON.stringify(version));
  }
  if (run(['doctor']).ok !== true) throw Error('Bundled CLI doctor failed.');
  run(['discover', '--compact']);
  run(['nope'], 2);
  run(['create', '--id', 'smoke', '--output', 'smoke.json']);
  run(['validate', '--input', 'smoke.json']);
  const report = run(['run', '--input', 'smoke.json', '--minutes', '100', '--output', 'smoke-run.json']);
  if (report.status !== 'completed') throw Error('Bundled runtime did not complete its starter.');
  run(['build', '--input', 'smoke.json', '--output', 'smoke.html']);
  run(['process', 'build', '--input', 'smoke.json', '--output', 'smoke-wildlands.html'], 0, WILDLANDS_BIN, []);
  if (!fs.readFileSync(path.join(directory, 'smoke.html')).equals(fs.readFileSync(path.join(directory, 'smoke-wildlands.html')))) {
   throw Error('process-studio build differs from bin/wildlands process build.');
  }
 } finally { fs.rmSync(directory, {recursive: true, force: true}); }
}
