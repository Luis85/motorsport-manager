import test from 'node:test';
import assert from 'node:assert/strict';
import {captureOptions,captureCharacter} from '../src/infra/capture.ts';
import {createCharacter} from '../src/domain/character.ts';

test('capture options document defaults and reject invalid, unbounded views before browser loading',()=>{
  assert.deepEqual(captureOptions(),{mode:'studio',light:'studio',pose:'idle',camera:'front',width:1024,height:1024});
  assert.equal(captureOptions({mode:'portrait',pose:'work',width:256,height:512}).width,256);
  for (const options of [{mode:'game'},{light:'bright'},{pose:'dance'},{camera:'top'},{width:NaN},{height:255},{width:4097},{width:4096,height:4096},{width:512.5},{extra:true}]) {
    assert.throws(()=>captureOptions(options as any));
  }
});
test('capture rejects unsupported output formats before optional browser discovery',async()=>{
  await assert.rejects(captureCharacter(createCharacter(),'/tmp/character.jpg'),/\.png extension/);
});
