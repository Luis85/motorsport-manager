/** Shared test helpers: repository paths, a freshly bundled candidate executable and child-process runners. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {bundle, type BundleResult} from '../scripts/bundle.cjs';

export const PROJECT = path.resolve(__dirname, '..');
export const REPOSITORY = path.resolve(PROJECT, '../..');
export const WILDLANDS_BIN = path.join(REPOSITORY, 'bin/wildlands');
export const CHECKED_IN = path.join(REPOSITORY, 'bin/process-studio');
export const AGENCY = path.join(REPOSITORY, 'docs/concepts/agency-delivery/content');
export const BPMN_EXAMPLES = path.join(REPOSITORY, 'source/wildlands/examples/bpmn');

export interface Outcome {readonly status: number | null; readonly stdout: string; readonly stderr: string;}
export interface JsonOutcome extends Outcome {readonly json: Record<string, unknown>;}

/** A fresh, empty, real (symlink-resolved) temporary directory, removed when the process exits. */
export function temporaryDirectory(prefix: string): string {
 const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
 process.on('exit', () => fs.rmSync(directory, {recursive: true, force: true}));
 return directory;
}

let built: Promise<{file: string; result: BundleResult}> | null = null;
/** The bundle of the current sources, written once per test process to its own directory with no node_modules. */
export function candidate(): Promise<{file: string; result: BundleResult}> {
 return built ??= bundle().then(result => {
  const file = path.join(temporaryDirectory('process-studio-candidate-'), 'process-studio');
  fs.writeFileSync(file, result.bytes, {mode: 0o755});
  return {file, result};
 });
}

/** Run a CLI file with Node in `cwd`. */
export function execute(entry: string, args: readonly string[], cwd: string, flags: readonly string[] = []): Outcome {
 const child = spawnSync(process.execPath, [...flags, entry, ...args], {cwd, encoding: 'utf8', timeout: 300000, maxBuffer: 256 * 1024 * 1024});
 if (child.error) throw child.error;
 return {status: child.status, stdout: child.stdout, stderr: child.stderr};
}

/** Run and parse the one JSON object a command prints (fails on stderr output or non-JSON stdout). */
export function executeJson(entry: string, args: readonly string[], cwd: string, flags: readonly string[] = []): JsonOutcome {
 const outcome = execute(entry, args, cwd, flags);
 if (outcome.stderr) throw Error(`${args.join(' ')} wrote to stderr: ${outcome.stderr.slice(0, 2000)}`);
 return {...outcome, json: JSON.parse(outcome.stdout) as Record<string, unknown>};
}

/** Every file below `directory`, relative, sorted, with its bytes. */
export function tree(directory: string): Map<string, Buffer> {
 const files = new Map<string, Buffer>();
 const walk = (relative: string): void => {
  for (const entry of fs.readdirSync(path.join(directory, relative), {withFileTypes: true}).sort((a, b) => a.name < b.name ? -1 : 1)) {
   const name = relative ? relative + '/' + entry.name : entry.name;
   if (entry.isDirectory()) walk(name); else files.set(name, fs.readFileSync(path.join(directory, name)));
  }
 };
 walk('');
 return files;
}

/** The seven agency demo definitions by id (file name without `.process.json`). */
export function agencyDefinitions(): Map<string, string> {
 const names = fs.readdirSync(AGENCY).filter(name => name.endsWith('.process.json')).sort();
 return new Map(names.map(name => [name.replace('.process.json', ''), path.join(AGENCY, name)]));
}
