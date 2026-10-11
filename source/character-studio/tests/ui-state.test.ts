import test from 'node:test';
import assert from 'node:assert/strict';
import { StudioState } from '../src/ui/state.js';
import { createCharacter } from '../src/domain/character.js';
import { randomizeSection, resetSection } from '../src/application/section-actions.js';
import { applyOperations } from '../src/application/transactions.js';

const memory = new Map<string, string>();
function setup(project = 'test') {
  (globalThis as any).window = {__STUDIO__: {server: true, token: 'token', storageKey: project}};
  (globalThis as any).localStorage = {getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value)};
}
function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {status, headers: {'content-type': 'application/json'}});
}

test('pending disk save never discards subsequent edits or switches the active companion', async () => {
  setup(); memory.clear();
  const state = new StudioState();
  state.newCharacter('pip');
  let release!: (response: Response) => void;
  let payload: any;
  globalThis.fetch = async (_url, options) => {
    payload = JSON.parse(options!.body as string);
    return new Promise(resolve => { release = resolve; });
  };
  const saving = state.save(true);
  state.apply([{op:'set',path:'/identity/name',value:'Newer name'}]);
  release(response({ok:true,character:payload.character,revision:1,stateHash:'one'}));
  await saving;
  assert.equal(state.character.identity.name, 'Newer name');
  assert.equal(state.character.status, 'draft');
  assert.equal(state.committed, true);
  assert.equal(state.remote.get(state.character.id)!.revision, 1);
  const originalId = state.character.id;
  const secondSave = state.save(true);
  state.newCharacter('fern');
  const nextId = state.character.id;
  release(response({ok:true,character:payload.character,revision:2,stateHash:'two'}));
  await secondSave;
  assert.equal(state.character.id, nextId);
  assert.equal(state.character.identity.name, 'Fern');
  assert.equal(state.records.get(originalId)!.committed, true);
});

test('project recovery keeps stale draft guards, clean libraries refresh, and conflict recovery preserves both', async () => {
  setup(); memory.clear();
  const original = createCharacter('pip');
  let disk = {ok:true,character:original,revision:1,stateHash:'one'};
  globalThis.fetch = async () => response({ok:true,characters:[disk]});
  const state = new StudioState();
  await state.load(); state.open('pip'); state.recover();
  disk = {...disk,character:{...original,identity:{...original.identity,name:'On disk'}},revision:2,stateHash:'two'};
  const clean = new StudioState(); await clean.load(); clean.open('pip');
  assert.equal(clean.character.identity.name, 'On disk');
  clean.apply([{op:'set',path:'/identity/name',value:'Local draft'}]);
  disk = {...disk,revision:3,stateHash:'three'};
  const recovered = new StudioState(); await recovered.load(); recovered.open('pip');
  assert.equal(recovered.remote.get('pip')!.revision, 2);
  assert.equal(recovered.character.identity.name, 'Local draft');
  globalThis.fetch = async () => response(disk);
  await recovered.reloadDisk();
  assert.equal(recovered.character.identity.name, 'On disk');
  assert.ok([...recovered.records.values()].some(item => item.character.id !== 'pip' && item.character.identity.name === 'Local draft'));
  setup('different-project');
  const isolated = new StudioState();
  assert.equal(isolated.records.size, 0);
});

test('unsupported browser recovery data remains byte-for-byte preserved after edits', () => {
  setup(); memory.clear();
  const broken = '[{"character":{"schemaVersion":999}}]';
  memory.set('littlewild.character-studio.v1.test', broken);
  const state = new StudioState();
  assert.equal(state.recoverySource, broken);
  state.newCharacter('mochi');
  assert.equal(state.storageAvailable, false);
  assert.equal(memory.get(state.storageKey), broken);
  assert.equal(state.character.identity.name, 'Mochi');
});

test('section randomization and reset stay scoped and retain independently owned choices', () => {
  const original = createCharacter('pip', 'Personal name');
  original.locks = ['appearance.coat'];
  original.appearance.coat = '#123456';
  original.appearance.headSize = 1.2;
  original.identity.voice = 'My voice';
  const coat = randomizeSection(original, 'coat', 7);
  assert.ok(coat.every(operation => 'path' in operation && ['/appearance/coat','/appearance/belly','/appearance/inner'].includes(operation.path)));
  const randomized = coat.length ? applyOperations(original, coat) : original;
  assert.equal(randomized.appearance.coat, '#123456');
  assert.equal(randomized.appearance.headSize, 1.2);
  assert.deepEqual(randomized.identity, original.identity);
  const reset = applyOperations(original, resetSection(original, 1));
  assert.equal(reset.appearance.headSize, 1);
  assert.equal(reset.appearance.coat, '#123456');
  assert.deepEqual(reset.identity, original.identity);
  assert.deepEqual(reset.locks, original.locks);
});
