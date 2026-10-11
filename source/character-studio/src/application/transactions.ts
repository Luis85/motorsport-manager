import { assertCharacter, CharacterError, createCharacter, isJsonData, stagePreset, stageRandomize, type Character } from '../domain/character.js';
import { clone } from '../domain/catalog.js';
import { randomizeSection, resetSection } from './section-actions.js';

export type Operation =
  | {op: 'set' | 'add'; path: string; value: unknown}
  | {op: 'remove'; path: string}
  | {op: 'preset'; preset: string}
  | {op: 'look'; look: unknown}
  | {op: 'reset'; section: 'identity' | 'body' | 'coat' | 'skills' | 'outfits'}
  | {op: 'randomize'; seed: number; scope?: 'all' | 'body' | 'coat'};

function invalid(path: string, message: string): never {
  throw new CharacterError([{path, message}]);
}

function pointer(path: unknown): string[] {
  if (typeof path !== 'string' || !path.startsWith('/') || path.length > 256 || /~(?![01])/.test(path)) invalid('/path', 'Use an RFC 6901 JSON pointer beginning with /.');
  const parts = path.slice(1).split('/').map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (parts.some(p => ['__proto__', 'prototype', 'constructor'].includes(p))) invalid('/path', 'Unsafe property path.');
  if (['id', 'format', 'schemaVersion'].includes(parts[0])) invalid(path, 'Character identity and format are immutable. Import a copy with a new ID instead.');
  return parts;
}

function index(value: unknown[], key: string, append: boolean): number {
  if (append && key === '-') return value.length;
  if (!/^(0|[1-9]\d*)$/.test(key)) invalid('/path', 'Expected an array index.');
  const n = Number(key);
  if (!Number.isSafeInteger(n) || n >= value.length + (append ? 1 : 0)) invalid('/path', 'Array index is out of range.');
  return n;
}

function patch(character: Character, operation: Extract<Operation, {path: string}>) {
  const keys = pointer(operation.path);
  let parent: any = character;
  for (const key of keys.slice(0, -1)) {
    if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, key)) invalid(operation.path, 'Parent path does not exist.');
    parent = parent[key];
  }
  if (!parent || typeof parent !== 'object') invalid(operation.path, 'Parent must be an object or array.');
  const key = keys.at(-1)!;
  if (Array.isArray(parent)) {
    const i = index(parent, key, operation.op === 'add');
    if (operation.op === 'add') parent.splice(i, 0, clone(operation.value));
    else if (operation.op === 'remove') parent.splice(i, 1);
    else parent[i] = clone(operation.value);
  } else {
    if (operation.op !== 'add' && !Object.hasOwn(parent, key)) invalid(operation.path, 'Field does not exist; use add to create an optional field.');
    if (operation.op === 'add' && Object.hasOwn(parent, key)) invalid(operation.path, 'Field already exists; use set to replace it.');
    if (operation.op === 'remove') delete parent[key];
    else parent[key] = clone(operation.value);
  }
}

/** Every operation stages on a detached value; only the final state is validated. */
export function applyOperations(input: Character, operations: unknown): Character {
  let next = assertCharacter(input);
  if (!isJsonData(operations)) invalid('/operations', 'Expected plain, finite JSON data without accessors or executable values.');
  if (!Array.isArray(operations) || !operations.length || operations.length > 256) invalid('/operations', 'Use 1–256 operations.');
  for (const [i, raw] of operations.entries()) {
    try {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) invalid('/operation', 'Expected an operation object.');
      const operation = raw as Operation;
      const required = operation.op === 'reset' ? ['op', 'section'] : operation.op === 'look' ? ['op', 'look'] : operation.op === 'preset' ? ['op', 'preset'] : operation.op === 'randomize' ? ['op', 'seed'] : operation.op === 'remove' ? ['op', 'path'] : ['op', 'path', 'value'];
      const allowed = operation.op === 'randomize' ? [...required, 'scope'] : required;
      if (Object.keys(raw).some(k => !allowed.includes(k)) || required.some(k => !Object.hasOwn(raw, k))) invalid('/operation', 'Unexpected or missing operation fields.');
      if (operation.op === 'preset') next = stagePreset(next, operation.preset);
      else if (operation.op === 'look') {
        const look = operation.look as any;
        if (!look || look.format !== 'littlewild-look' || look.schemaVersion !== 1 || Object.keys(look).some(k => !['format', 'schemaVersion', 'appearance', 'outfits'].includes(k))) invalid('/look', 'Expected a littlewild-look schemaVersion 1 export.');
        const candidate = assertCharacter({...createCharacter(), appearance: look.appearance, outfits: look.outfits});
        next.appearance = candidate.appearance;
        next.outfits = candidate.outfits;
        next.status = 'draft';
      } else if (operation.op === 'randomize') {
        if (!Number.isInteger(operation.seed) || operation.seed < 0 || operation.seed > 4294967295) invalid('/seed', 'Use an integer from 0 to 4294967295.');
        const scope = operation.scope === undefined ? 'all' : operation.scope;
        if (!['all', 'body', 'coat'].includes(scope)) invalid('/scope', 'Choose all, body, or coat.');
        if (scope === 'all') next = stageRandomize(next, operation.seed);
        else for (const edit of randomizeSection(next, scope, operation.seed)) patch(next, edit as Extract<Operation, {path: string}>);
        next.status = 'draft';
      } else if (operation.op === 'reset') {
        const section = ['identity', 'body', 'coat', 'skills', 'outfits'].indexOf(operation.section);
        if (section < 0) invalid('/section', 'Choose identity, body, coat, skills, or outfits.');
        for (const edit of resetSection(next, section)) patch(next, edit as Extract<Operation, {path: string}>);
        next.status = 'draft';
      } else if (['set', 'add', 'remove'].includes(operation.op)) {
        const edit = operation as Extract<Operation, {path: string}>;
        pointer(edit.path);
        if (edit.path !== '/locks' && !edit.path.startsWith('/locks/') && edit.path !== '/status') next.status = 'draft';
        patch(next, edit);
      } else invalid('/op', 'Unknown operation. Use set, add, remove, preset, randomize, look, or reset.');
    } catch (error) {
      if (error instanceof CharacterError) {
        error.errors = error.errors.map(issue => ({...issue, path: `/operations/${i}${issue.path}`}));
        error.message = error.errors.map(issue => `${issue.path}: ${issue.message}`).join('; ');
      }
      throw error;
    }
  }
  return assertCharacter(next);
}

export function batchOperations(input: unknown): Operation[] {
  if (!isJsonData(input)) invalid('/', 'Expected plain, finite JSON data.');
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => k !== 'operations')) invalid('/', 'Expected an object containing only operations.');
  const operations = (input as {operations?: unknown}).operations;
  if (!Array.isArray(operations) || !operations.length || operations.length > 256) invalid('/operations', 'Use 1–256 operations.');
  return operations as Operation[];
}

/** Browser-local draft history. Persistence and concurrency belong to the store. */
export class EditorSession {
  private character: Character;
  private baseline: string;
  private past: Character[] = [];
  private future: Character[] = [];
  constructor(character: Character) {
    this.character = assertCharacter(character);
    this.baseline = JSON.stringify(this.character);
  }
  inspect(): Character { return clone(this.character); }
  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
  get dirty(): boolean { return JSON.stringify(this.character) !== this.baseline; }
  apply(operations: unknown): Character {
    const next = applyOperations(this.character, operations);
    if (JSON.stringify(next) === JSON.stringify(this.character)) return this.inspect();
    this.past.push(this.inspect());
    if (this.past.length > 100) this.past.shift();
    this.future = [];
    this.character = next;
    return this.inspect();
  }
  undo(): Character {
    if (!this.canUndo) invalid('/history', 'Nothing to undo.');
    this.future.push(this.inspect());
    this.character = {...this.past.pop()!, locks: [...this.character.locks]};
    return this.inspect();
  }
  redo(): Character {
    if (!this.canRedo) invalid('/history', 'Nothing to redo.');
    this.past.push(this.inspect());
    this.character = {...this.future.pop()!, locks: [...this.character.locks]};
    return this.inspect();
  }
  setLocks(locks: string[]): Character {
    this.character = assertCharacter({...this.character, locks});
    return this.inspect();
  }
  markSaved(): void { this.baseline = JSON.stringify(this.character); }
  replace(character: Character): Character {
    this.character = assertCharacter(character);
    this.past = [];
    this.future = [];
    this.markSaved();
    return this.inspect();
  }
}
