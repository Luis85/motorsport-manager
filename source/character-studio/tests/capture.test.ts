import test from 'node:test';
import assert from 'node:assert/strict';
import {captureOptions,captureCharacter} from '../src/infra/capture.ts';
import {createCharacter} from '../src/domain/character.ts';

test('capture options document defaults and reject invalid, unbounded views before browser loading',()=>{
  assert.deepEqual(captureOptions(),{mode:'studio',light:'studio',pose:'idle',camera:'front',yaw:0,elevation:.08,zoom:1,time:0,width:1024,height:1024});
  assert.equal(captureOptions({mode:'portrait',pose:'work',width:256,height:512}).width,256);
  for (const options of [{mode:'game'},{light:'bright'},{pose:'dance'},{camera:'top'},{width:NaN},{height:255},{width:4097},{width:4096,height:4096},{width:512.5},{extra:true}]) {
    assert.throws(()=>captureOptions(options as any));
  }
});
test('capture rejects unsupported output formats before optional browser discovery',async()=>{
  await assert.rejects(captureCharacter(createCharacter(),'/tmp/character.jpg'),/\.png extension/);
});


test('capture resolves presets before explicit orbit and phase, and rejects invalid fields before I/O',async()=>{
  assert.equal(captureOptions({camera:'three-quarter'}).yaw,.4);
  assert.equal(captureOptions({camera:'side'}).yaw,Math.PI/2);
  const config=captureOptions({camera:'back',yaw:-.4,elevation:.2,zoom:1.25,time:.35});
  assert.deepEqual([config.yaw,config.elevation,config.zoom,config.time],[-.4,.2,1.25,.35]);
  for(const options of [{time:NaN},{zoom:3},{paused:true},{reset:true},{yaw:undefined},{width:undefined}])
    await assert.rejects(captureCharacter(createCharacter(),'/tmp/unused.png',options as any),{code:'INVALID_ARGUMENT'});
  let read=false;
  assert.throws(()=>captureOptions({get width(){read=true;return 256;}}));
  assert.equal(read,false);
});
