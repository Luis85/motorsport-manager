/**
 * Guarded publication of one generated content file of a game folder (`wildlands generate`).
 *
 * A proposal replaces exactly one canonical content file that `game.json` names. It is staged in a
 * temporary copy of the whole folder (named like the folder, so the id rule holds), validated there
 * with the engine's own validators (`validate-game`), and only then published: in place, after the
 * folder digest still equals the caller's `--expected-digest`, by an atomic rename of that one file;
 * or as a new file outside the folder (`--output`, resolved through symlinks, created exclusively). Dry runs stop after validation. Files are only
 * rewritten when they are canonical two-space JSON, so a generated edit never reformats other bytes.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {writeTextFile} from './cli-io.cjs';
import {GenerateError} from './generate-rts-terrain.cjs';

/** Canonical JSON layouts: `JSON.stringify(value, null, 2)` plus a newline, optionally with non-ASCII escaped as \uXXXX. */
export type JsonStyle = 'json2' | 'json2-ascii';
const ascii = (text: string): string => text.replace(/[\u0080-\uffff]/g, character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
export function serialize(value: unknown, style: JsonStyle): string {
 const text = JSON.stringify(value, null, 2) + '\n';
 return style === 'json2-ascii' ? ascii(text) : text;
}
/** The parsed document and its canonical layout, or a `non-canonical-file` refusal with a hint. */
export function readCanonical(root: string, relative: string): {value: unknown; style: JsonStyle; text: string} {
 const text = fs.readFileSync(path.join(root, relative), 'utf8');
 let value: unknown;
 try { value = JSON.parse(text) as unknown; }
 catch { throw new GenerateError('invalid-game', `${relative} is not valid JSON; run validate-game on the folder.`); }
 for (const style of ['json2', 'json2-ascii'] as const) if (serialize(value, style) === text) return {value, style, text};
 throw new GenerateError('non-canonical-file', `${relative} is not canonical two-space JSON, so a generated edit would also reformat unrelated bytes. ` +
  `Reformat it in its own reviewed change (JSON.stringify(value, null, 2) plus a final newline, optionally with non-ASCII characters escaped), run validate-game, then generate again.`);
}

const inside = (root: string, target: string): boolean => target === root || target.startsWith(root + path.sep);

export interface Staged {readonly proposedDigest: string; readonly template: string | null;}
/**
 * Copy the folder to a fresh temporary directory, replace `relative` with `text` there and run the
 * engine's validators on the copy (this installs the copy's profile: one validation per process).
 */
export function stageAndValidate(root: string, id: string, relative: string, text: string): Staged {
 const games = require('./game-build.cjs') as typeof import('./game-build.cjs');
 const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'wildlands-generate-')), staged = path.join(scratch, id);
 try {
  fs.cpSync(root, staged, {recursive: true, errorOnExist: true, force: false});
  fs.writeFileSync(path.join(staged, relative), text);
  const result = games.validateGameFolder(staged);
  if (!result.ok) throw new GenerateError('invalid-generated', 'The engine validators rejected the generated content: ' + result.errors.join('; ') + ' Run validate-game on the original folder; if it passes, report this seed and recipe.');
  return {proposedDigest: result.digest!, template: result.template};
 } finally { fs.rmSync(scratch, {recursive: true, force: true}); }
}

/** Publish in place: the folder must still have `expected` as its digest, then one atomic rename. */
export function publishInPlace(root: string, relative: string, text: string, expected: string): string {
 const folders = require('./game-folder.cjs') as typeof import('./game-folder.cjs');
 const current = folders.loadGame(root).digest;
 if (current !== expected) throw new GenerateError('stale-digest', `The game folder changed while generating (digest ${current}); inspect it again and pass the new --expected-digest.`);
 return writeTextFile(path.join(root, relative), text);
}

const refuse = (message: string): never => { throw new GenerateError('output-refused', message, 2); };
const exists = (file: string): boolean => { try { fs.lstatSync(file); return true; } catch { return false; } };

/**
 * Publish as a new file outside the game folder; an existing path is refused. Containment is
 * decided on real paths (the game root and the output's directory resolved through symlinks), so
 * a link can never route the copy into the folder. The file appears exclusively: it is written to
 * a private temporary name and then hard-linked to the target, which fails if anything (even a
 * concurrently created file or a dangling link) took the name, so an existing file is never
 * replaced. Where hard links are unsupported, the target is created with exclusive `wx` instead.
 */
export function publishCopy(root: string, output: string, text: string): string {
 const requested = path.resolve(output);
 if (!requested.endsWith('.json')) refuse('--output must name a new .json file.');
 let directory = '';
 try { directory = fs.realpathSync(path.dirname(requested)); }
 catch { refuse('--output directory does not exist: ' + path.dirname(requested)); }
 const target = path.join(directory, path.basename(requested));
 if (inside(fs.realpathSync(root), target)) refuse('--output must lie outside the game folder (after resolving symlinks); use --expected-digest to change the folder in place.');
 if (exists(target)) refuse('--output must name a new file; ' + requested + ' exists.');
 // A private staging directory beside the target (same filesystem, so the link is cheap).
 const staging = fs.mkdtempSync(path.join(directory, '.wildlands-output-')), temporary = path.join(staging, 'output.json');
 try {
  fs.writeFileSync(temporary, text, {encoding: 'utf8', flag: 'wx'});
  try { fs.linkSync(temporary, target); }
  catch (error) {
   const code = (error as NodeJS.ErrnoException).code;
   if (code === 'EEXIST') refuse('--output must name a new file; ' + requested + ' was created meanwhile and was left unchanged.');
   if (code !== 'EPERM' && code !== 'ENOTSUP' && code !== 'EOPNOTSUPP' && code !== 'EXDEV') throw error;
   writeExclusive(target, text, requested);
  }
 } finally { fs.rmSync(staging, {recursive: true, force: true}); }
 return target;
}
function writeExclusive(target: string, text: string, requested: string): void {
 let descriptor: number;
 try { descriptor = fs.openSync(target, 'wx'); }
 catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'EEXIST') refuse('--output must name a new file; ' + requested + ' was created meanwhile and was left unchanged.');
  throw error;
 }
 let written = false;
 try { fs.writeFileSync(descriptor, text, 'utf8'); written = true; }
 finally {
  fs.closeSync(descriptor);
  if (!written) fs.rmSync(target, {force: true});
 }
}
