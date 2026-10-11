import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { hostname } from 'node:os';
import { createHash } from 'node:crypto';
import { assertCharacter, type Character } from '../domain/character.js';
import { readJson, replaceJson, StudioError } from './files.js';

export interface Guards {
  expectedRevision: number;
  expectedState: string | null;
  dryRun?: boolean;
}
interface Document {
  format: 'littlewild-character-document';
  version: 1;
  revision: number;
  character: Character;
  past: Character[];
  future: Character[];
}
const copy = <T>(value: T): T => structuredClone(value);
function canonical(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}
export const stateHash = (value: Character) => createHash('sha256').update(canonical(value)).digest('hex');
function paths(project: string, id?: string) {
  if (id !== undefined && !/^[a-z][a-z0-9_-]{0,60}$/.test(id)) {
    throw new StudioError('INVALID_ID', 'Use a lowercase stable ID starting with a letter (maximum 61 characters).');
  }
  const root = resolve(project, '.character-studio');
  return { root, directory: join(root, 'characters'), file: join(root, 'characters', `${id}.json`), lock: join(root, 'write.lock') };
}
function envelope(doc: Document) {
  return { ok: true as const, id: doc.character.id, revision: doc.revision, stateHash: stateHash(doc.character), character: copy(doc.character) };
}
async function load(project: string, id: string): Promise<Document> {
  const doc = await readJson(paths(project, id).file) as Document;
  if (doc.format !== 'littlewild-character-document' || doc.version !== 1 || !Number.isSafeInteger(doc.revision) || doc.revision < 1 || doc.character?.id !== id || !Array.isArray(doc.past) || !Array.isArray(doc.future) || doc.past.length > 50 || doc.future.length > 50) {
    throw new StudioError('INVALID_DOCUMENT', `Stored character ${id} has an invalid document envelope.`);
  }
  assertCharacter(doc.character);
  for (const entry of [...doc.past, ...doc.future]) {
    assertCharacter(entry);
    if (entry.id !== id) throw new StudioError('INVALID_DOCUMENT', 'History cannot change a character identity.');
  }
  return doc;
}
export async function read(project: string, id: string) {
  return envelope(await load(project, id));
}
export async function list(project: string) {
  const { directory } = paths(project);
  let files: string[];
  try { files = await readdir(directory); } catch (error: any) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return Promise.all(files.filter(file => /^[a-z][a-z0-9_-]{0,60}\.json$/.test(file)).sort().map(file => read(project, file.slice(0, -5))));
}
async function locked<T>(project: string, action: () => Promise<T>): Promise<T> {
  const { root, lock } = paths(project);
  await mkdir(root, { recursive: true });
  try { await mkdir(lock); } catch (error: any) {
    if (error.code === 'EEXIST') throw new StudioError('BUSY', `Another writer holds ${lock}. Retry after it finishes; do not remove a live writer's lock.`);
    throw error;
  }
  try {
    await writeFile(join(lock,'owner.json'),JSON.stringify({pid:process.pid,hostname:hostname(),createdAt:new Date().toISOString()}),{flag:'wx',mode:0o600});
    return await action();
  } finally { await rm(lock, { recursive: true }); }
}
function guard(current: Document | null, guards: Guards) {
  if (guards.dryRun !== undefined && typeof guards.dryRun !== 'boolean') throw new StudioError('INVALID_REQUEST','dryRun must be a boolean.');
  const revision = current?.revision ?? 0;
  const hash = current ? stateHash(current.character) : null;
  if (!Number.isSafeInteger(guards.expectedRevision) || guards.expectedRevision < 0 || guards.expectedState !== null && typeof guards.expectedState !== 'string') {
    throw new StudioError('GUARDS_REQUIRED', 'Supply expectedRevision and expectedState from inspect; use 0 and null only for a new character.');
  }
  if (guards.expectedRevision !== revision || guards.expectedState !== hash) {
    throw new StudioError('CONFLICT', 'Character changed. Inspect it again before preparing a new edit.', { revision, stateHash: hash });
  }
}
function result(current: Document | null, proposed: Document, dryRun = false) {
  if (!dryRun) return envelope(proposed);
  return { ...envelope(proposed), revision: current?.revision ?? 0, stateHash: current ? stateHash(current.character) : null,
    dryRun: true, proposedRevision: proposed.revision, proposedStateHash: stateHash(proposed.character) };
}
export async function write(project: string, input: Character, guards: Guards) {
  const character = copy(input);
  assertCharacter(character, { commit: character.status === 'ready' });
  const { file } = paths(project, character.id);
  return locked(project, async () => {
    let current: Document | null = null;
    try { current = await load(project, character.id); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    guard(current, guards);
    const proposed: Document = { format: 'littlewild-character-document', version: 1, revision: (current?.revision ?? 0) + 1,
      character, past: current ? [...current.past, current.character].slice(-50) : [], future: [] };
    if (!guards.dryRun) await replaceJson(file, proposed);
    return result(current, proposed, guards.dryRun);
  });
}
async function travel(project: string, id: string, guards: Guards, direction: 'undo' | 'redo') {
  return locked(project, async () => {
    const current = await load(project, id);
    guard(current, guards);
    const proposed = copy(current);
    const from = direction === 'undo' ? proposed.past : proposed.future;
    const to = direction === 'undo' ? proposed.future : proposed.past;
    const next = from.pop();
    if (!next) throw new StudioError('NO_HISTORY', `There is no ${direction} entry.`);
    to.push(proposed.character);
    proposed.character = next;
    proposed.revision++;
    if (!guards.dryRun) await replaceJson(paths(project, id).file, proposed);
    return result(current, proposed, guards.dryRun);
  });
}
export const undo = (project: string, id: string, guards: Guards) => travel(project, id, guards, 'undo');
export const redo = (project: string, id: string, guards: Guards) => travel(project, id, guards, 'redo');
export async function history(project: string, id: string) {
  const doc = await load(project, id);
  return { ...envelope(doc), undo: doc.past.length, redo: doc.future.length };
}

/** Diagnostic only: an uncertain or live lock is never reclaimed automatically. */
export async function lockStatus(project: string) {
  const {lock} = paths(project);
  try {
    const owner = await readJson(join(lock,'owner.json'));
    let state = 'unknown';
    if (owner.hostname === hostname() && Number.isSafeInteger(owner.pid) && owner.pid > 0) {
      try { process.kill(owner.pid,0); state = 'active'; }
      catch (error: any) { state = error.code === 'ESRCH' ? 'stale' : 'unknown'; }
    }
    return {locked:true,state,path:lock,owner};
  } catch (error: any) {
    try { await readdir(lock); } catch (missing: any) {
      if (missing.code === 'ENOENT') return {locked:false,state:'unlocked',path:lock};
    }
    return {locked:true,state:'unknown',path:lock,reason:error.message};
  }
}
