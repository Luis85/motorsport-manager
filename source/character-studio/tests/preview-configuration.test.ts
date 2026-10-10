import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePreviewConfiguration} from '../src/ui/preview-configuration.ts';

test('preview configuration returns detached validated settings for a single render transaction', () => {
  const input = {mode:'world',light:'night',pose:'walk',camera:'side',paused:true,reset:true};
  const result = validatePreviewConfiguration(input);
  assert.deepEqual(result, input);
  assert.notEqual(result, input);
  assert.deepEqual(validatePreviewConfiguration({}), {});
});

test('preview configuration rejects unknown, invalid and executable fields before reading them', () => {
  for (const input of [null, [], {mode:'world',light:'invalid'}, {reset:1}, {paused:'true'}, {zoom:2}, {constructor:'x'}]) {
    assert.throws(() => validatePreviewConfiguration(input));
  }
  let read = false;
  assert.throws(() => validatePreviewConfiguration({get mode() { read = true; return 'studio'; }}));
  assert.equal(read, false);
});
