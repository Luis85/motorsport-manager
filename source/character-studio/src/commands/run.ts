import { resolve } from 'node:path';
import {previewNumbers, validatePreviewConfiguration} from '../application/preview-configuration.js';
import { catalog } from '../domain/catalog.js';
import { createCharacter, validateCharacter, assertCharacter } from '../domain/character.js';
import { characterSchema } from '../domain/schema.js';
import { compileDefinition, compilePackage, compileVisual, importCharacter } from '../application/compiler.js';
import { applyOperations, batchOperations } from '../application/transactions.js';
import * as store from '../infra/store.js';
import { renderHtml } from '../infra/html.js';
import { serve } from '../infra/server.js';
import { captureCharacter, captureDoctor } from '../infra/capture.js';
import { reviewCharacter, reviewPlanSchema } from '../infra/review.js';
import { argumentSchema, commands, discovery, operationSchema, previewValues } from './discovery.js';
import { CommandError, failure, integerFlag, parse, readJson, stringFlag, writeOutput, type Flags } from './protocol.js';

function guards(flags: Flags) {
  const state = stringFlag(flags, 'expected-state');
  if (!/^[a-f0-9]{64}$/.test(state)) throw new CommandError('INVALID_ARGUMENT', '--expected-state must be the SHA-256 stateHash from inspect.');
  return {expectedRevision: integerFlag(flags, 'expected-revision')!, expectedState: state, dryRun: flags['dry-run'] === true};
}

function previewOptions(flags: Flags) {
  const result: Record<string, string | number> = {};
  for (const [key, allowed] of Object.entries(previewValues)) {
    const value = stringFlag(flags, key, allowed[0]);
    if (!(allowed as readonly string[]).includes(value)) throw new CommandError('INVALID_ARGUMENT', `--${key} must be ${allowed.join(', ')}.`);
    result[key] = value;
  }
  for (const key of Object.keys(previewNumbers)) if (flags[key] !== undefined) {
    const raw = stringFlag(flags, key);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw))
      throw new CommandError('INVALID_ARGUMENT', `--${key} requires a finite decimal number.`);
    result[key] = Number(raw);
  }
  try { return validatePreviewConfiguration(result); }
  catch (error) { throw new CommandError('INVALID_ARGUMENT', (error as Error).message); }
}

async function execute(command: string, flags: Flags): Promise<unknown> {
  const project = flags.project ? resolve(stringFlag(flags, 'project')) : '';
  const id = stringFlag(flags, 'id');
  if (command === 'help' || command === 'discover') return discovery();
  if (command === 'version') return {ok: true, tool: 'character-studio', version: '0.1.0', protocolVersion: 1};
  if (command === 'doctor') return {ok: true, project, node: process.versions.node, lock: await store.lockStatus(project),
    ...(flags.capture ? {capture:await captureDoctor()} : {}), recovery: 'If the lock is stale, confirm its owner is no longer running before removing it. Never remove an active or unknown-owner lock.'};
  if (command === 'catalog') return {ok: true, catalog};
  if (command === 'describe') {
    const name = stringFlag(flags, 'command');
    if (!Object.hasOwn(commands, name)) throw new CommandError('UNKNOWN_COMMAND', `Unknown command: ${name}.`);
    return {ok: true, command: name, ...commands[name], arguments: argumentSchema(name)};
  }
  if (command === 'schema') {
    const kind = stringFlag(flags, 'kind', 'character');
    if (!['character', 'batch', 'review'].includes(kind)) throw new CommandError('INVALID_ARGUMENT', '--kind must be character, batch or review.');
    return {ok: true, kind, schema: kind === 'review' ? reviewPlanSchema : kind === 'batch' ? operationSchema : characterSchema};
  }
  if (command === 'create') return store.write(project, createCharacter(id, stringFlag(flags, 'name', id), stringFlag(flags, 'preset', 'pip')), {expectedRevision: 0, expectedState: null, dryRun: flags['dry-run'] === true});
  if (command === 'list') return {ok: true, characters: await store.list(project)};
  if (command === 'inspect') return store.read(project, id);
  if (command === 'validate') {
    if (flags.file && (flags.project || flags.id)) throw new CommandError('INVALID_ARGUMENT', 'Use --file or both --project and --id.');
    if (!flags.file && (!flags.project || !flags.id)) throw new CommandError('MISSING_ARGUMENT', 'Use --file or both --project and --id.');
    const character = flags.file ? await readJson(stringFlag(flags, 'file')) : (await store.read(project, id)).character;
    const result = validateCharacter(character);
    if (!result.ok) throw new CommandError('VALIDATION', 'Character validation failed.', 1, result);
    return {ok: true, valid: true, warnings: result.warnings};
  }
  if (command === 'apply') {
    const guard = guards(flags);
    const operations = batchOperations(await readJson(stringFlag(flags, 'file')));
    const current = await store.read(project, id);
    if (current.revision !== guard.expectedRevision || current.stateHash !== guard.expectedState) {
      throw new CommandError('CONFLICT', 'Character changed. Inspect again before applying edits.', 3, {revision: current.revision, stateHash: current.stateHash});
    }
    return store.write(project, applyOperations(current.character, operations), guard);
  }
  if (command === 'history') return store.history(project, id);
  if (command === 'undo' || command === 'redo') return store[command](project, id, guards(flags));
  if (command === 'import') {
    let character = assertCharacter({...importCharacter(await readJson(stringFlag(flags, 'file'))),status:'draft'});
    if (id) character = assertCharacter({...character, id});
    return store.write(project, character, {expectedRevision: 0, expectedState: null, dryRun: flags['dry-run'] === true});
  }
  if (command === 'export') {
    const character = (await store.read(project, id)).character;
    const format = stringFlag(flags, 'format', 'recipe');
    let value: unknown;
    if (format === 'recipe') value = character;
    else if (format === 'package') value = compilePackage(character);
    else if (format === 'definition') value = compileDefinition(character);
    else if (format === 'visual') value = compileVisual(character);
    else if (format === 'look') value = {format: 'littlewild-look', schemaVersion: 1, appearance: character.appearance, outfits: character.outfits};
    else throw new CommandError('INVALID_ARGUMENT', '--format must be recipe, package, definition, visual, or look.');
    if (flags.out) return {ok: true, format, path: await writeOutput(stringFlag(flags, 'out'), value)};
    return {ok: true, format, value};
  }
  if (command === 'preview') {
    const preview = {...previewOptions(flags), ...(flags.time !== undefined ? {paused:true} : {})};
    const character = (await store.read(project, id)).character;
    return {ok: true, preview, path: await writeOutput(stringFlag(flags, 'out'), renderHtml({initial: character, preview}), true)};
  }
  if (command === 'capture') {
    const preview = previewOptions(flags);
    const width = integerFlag(flags, 'width', 1024)!, height = integerFlag(flags, 'height', 1024)!;
    if (width < 256 || height < 256 || width > 4096 || height > 4096 || width * height > 8388608) throw new CommandError('INVALID_ARGUMENT', 'Capture dimensions must be 256–4096 pixels, at most 8,388,608 pixels total.');
    const character = (await store.read(project, id)).character;
    return {ok: true, ...await captureCharacter(character, stringFlag(flags, 'out'), {...preview, width, height})};
  }
  if (command === 'review') {
    const character = (await store.read(project, id)).character;
    return {ok:true,...await reviewCharacter(character,stringFlag(flags,'out'),flags.plan ? await readJson(stringFlag(flags,'plan')) : undefined)};
  }
  if (command === 'serve') {
    const port = integerFlag(flags, 'port', 4317)!;
    if (port > 65535) throw new CommandError('INVALID_ARGUMENT', '--port must be between 0 and 65535; 0 selects an available port.');
    const server = await serve(project, {port});
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void server.close(); });
    return {ok: true, url: server.url, token: server.token, project, api: 'Use discover for the CLI and GET /api/discover for HTTP capabilities.'};
  }
  throw new CommandError('UNKNOWN_COMMAND', `Unknown command: ${command}.`);
}

export async function run(argv: string[]): Promise<number> {
  try {
    const {command, flags} = parse(argv, commands);
    process.stdout.write(`${JSON.stringify(await execute(command, flags))}\n`);
    return 0;
  } catch (error) {
    const failed = failure(error);
    process.stdout.write(`${JSON.stringify(failed.result)}\n`);
    return failed.exitCode;
  }
}
