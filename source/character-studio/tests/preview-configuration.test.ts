import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePreviewConfiguration} from '../src/ui/preview-configuration.ts';

test('preview configuration returns detached validated settings for a single render transaction', () => {
  const input = {mode:'world',light:'night',pose:'walk',camera:'three-quarter',yaw:-.4,elevation:.2,zoom:1.25,time:.35,paused:true,reset:true};
  const result = validatePreviewConfiguration(input);
  assert.deepEqual(result, input);
  assert.notEqual(result, input);
  assert.deepEqual(validatePreviewConfiguration({}), {});
});

test('preview configuration rejects unknown, invalid and executable fields before reading them', () => {
  for (const input of [null, [], {mode:'world',light:'invalid'}, {reset:1}, {paused:'true'}, {zoom:3}, {constructor:'x'}]) {
    assert.throws(() => validatePreviewConfiguration(input));
  }
  let read = false;
  assert.throws(() => validatePreviewConfiguration({get mode() { read = true; return 'studio'; }}));
  assert.equal(read, false);
});


test('preview numeric bounds reject coercion and non-finite values without invoking accessors', () => {
  for (const input of [{yaw:Math.PI+.01},{yaw:-Math.PI-.01},{elevation:-.31},{elevation:.81},
    {zoom:.49},{time:-1},{time:3601},{yaw:'0.4'},{zoom:NaN},{time:Infinity},{elevation:undefined}])
    assert.throws(() => validatePreviewConfiguration(input));
  assert.deepEqual(validatePreviewConfiguration({yaw:-Math.PI,elevation:-.3,zoom:.5,time:0}), {yaw:-Math.PI,elevation:-.3,zoom:.5,time:0});
  assert.deepEqual(validatePreviewConfiguration({yaw:Math.PI,elevation:.8,zoom:2.5,time:3600}), {yaw:Math.PI,elevation:.8,zoom:2.5,time:3600});
  let read = false;
  assert.throws(() => validatePreviewConfiguration({get time() {read=true;return 0;}}));
  assert.equal(read,false);
});
