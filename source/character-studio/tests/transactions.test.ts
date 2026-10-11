import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter} from '../src/domain/character.js';
import {applyOperations, EditorSession} from '../src/application/transactions.js';
import {randomizeSection, resetSection} from '../src/application/section-actions.js';

test('draft transactions stage all edits, reject invalid final state and retain detached history', () => {
  const initial = createCharacter('moss', 'Moss');
  const session = new EditorSession(initial);
  initial.identity.name = 'Mutated outside';
  assert.equal(session.inspect().identity.name, 'Moss');
  assert.throws(() => session.apply([{op: 'set', path: '/identity/name', value: 'Changed'}, {op: 'set', path: '/appearance/eyeSize', value: 99}]));
  assert.equal(session.inspect().identity.name, 'Moss');
  assert.equal(session.canUndo, false);
  session.apply([{op: 'set', path: '/appearance/eyeSize', value: 99}, {op: 'set', path: '/appearance/eyeSize', value: 1.2}]);
  assert.equal(session.canUndo, true);
  assert.equal(session.dirty, true);
  session.undo();
  assert.equal(session.inspect().appearance.eyeSize, 1);
  assert.equal(session.dirty, false);
  session.redo();
  session.markSaved();
  assert.equal(session.dirty, false);
  session.apply([{op: 'set', path: '/identity/name', value: 'Fern'}]);
  assert.equal(session.canRedo, false);
  session.setLocks(['appearance.coat']);
  session.undo();
  assert.deepEqual(session.inspect().locks, ['appearance.coat']);
  session.redo();
  assert.deepEqual(session.inspect().locks, ['appearance.coat']);
});

test('seeded randomization preserves locks; explicit saved looks preserve independent gameplay fields', () => {
  const initial = createCharacter('moss', 'Moss');
  initial.locks = ['appearance.coat', 'outfits'];
  const first = applyOperations(initial, [{op: 'randomize', seed: 42}]);
  assert.deepEqual(first, applyOperations(initial, [{op: 'randomize', seed: 42}]));
  assert.equal(first.appearance.coat, initial.appearance.coat);
  const fern = createCharacter('fern', 'Fern', 'fern');
  const result = applyOperations(initial, [{op: 'look', look: {format: 'littlewild-look', schemaVersion: 1, appearance: fern.appearance, outfits: fern.outfits}}]);
  assert.equal(result.appearance.ears, 'long');
  assert.equal(result.appearance.coat, fern.appearance.coat);
  assert.deepEqual(result.identity, initial.identity);
  assert.deepEqual(result.skills, initial.skills);
  assert.throws(() => applyOperations(initial, [{op: 'randomize', seed: -1}]));
  assert.throws(() => applyOperations(initial, [{op: 'set', path: '/appearance~2coat', value: '#000000'}]));
  assert.throws(() => applyOperations(initial, [{op: 'remove', path: '/locks/99'}]));
});

test('specialized appearance operations permit invalid intermediate fields that the batch repairs', () => {
  const initial = createCharacter('moss', 'Moss');
  const result = applyOperations(initial, [
    {op: 'set', path: '/identity/name', value: 99},
    {op: 'set', path: '/appearance/headSize', value: 99},
    {op: 'preset', preset: 'fern'},
    {op: 'randomize', seed: 42},
    {op: 'set', path: '/identity/name', value: 'Fern'},
  ]);
  assert.equal(result.identity.name, 'Fern');
  assert.ok(result.appearance.headSize <= 1.3);
  assert.throws(() => applyOperations(initial, [{op: 'set', path: '/missing', value: 3}]), /operations\/0/);
  let accessed = false;
  const value = {get coat() { accessed = true; return '#ffffff'; }};
  assert.throws(() => applyOperations(initial, [{op: 'set', path: '/appearance', value}]));
  assert.equal(accessed, false);
});

test('agent scoped randomize and reset share UI section semantics and final-state validation', () => {
  const initial = createCharacter('moss', 'Moss', 'fern');
  initial.locks = ['appearance.coat'];
  initial.appearance.coat = '#123456';
  initial.appearance.headSize = 1.2;
  initial.identity.voice = 'Custom voice';
  for (const scope of ['body', 'coat'] as const) {
    const edits = randomizeSection(initial, scope, 27);
    const expected = edits.length ? applyOperations(initial, edits) : initial;
    assert.deepEqual(applyOperations(initial, [{op: 'randomize', seed: 27, scope}]), expected);
  }
  const sections = ['identity', 'body', 'coat', 'skills', 'outfits'] as const;
  for (const [chapter, section] of sections.entries()) {
    const edits = resetSection(initial, chapter);
    const expected = edits.length ? applyOperations(initial, edits) : initial;
    assert.deepEqual(applyOperations(initial, [{op: 'reset', section}]), expected);
  }
  const repaired = applyOperations(initial, [
    {op: 'set', path: '/identity/name', value: 99},
    {op: 'randomize', seed: 27, scope: 'coat'},
    {op: 'reset', section: 'body'},
    {op: 'set', path: '/identity/name', value: 'Repaired'},
  ]);
  assert.equal(repaired.identity.name, 'Repaired');
  assert.equal(repaired.appearance.headSize, 1);
  assert.throws(() => applyOperations(initial, [{op: 'randomize', seed: 1, scope: null}]));
  assert.throws(() => applyOperations(initial, [{op: 'reset', section: 'unknown'}]));
});
