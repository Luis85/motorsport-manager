import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reviewCharacter,reviewPlan} from '../src/infra/review.ts';
import {captureCharacter} from '../src/infra/capture.ts';
import {createCharacter} from '../src/domain/character.ts';

test('review plan safely replays explicit views and bounds browser work',()=>{
  const plan=reviewPlan();
  assert.equal(plan.views.length,7);
  assert.deepEqual(reviewPlan(JSON.parse(JSON.stringify(plan))),plan);
  const custom={format:plan.format,schemaVersion:1,views:[{id:'profile',camera:'three-quarter',yaw:-.4,elevation:.2,zoom:1.25,time:.35,height:512,width:1024}]};
  const view=reviewPlan(custom).views[0];
  assert.equal(view.camera,'three-quarter');
  assert.deepEqual([view.yaw,view.elevation,view.zoom,view.time],[-.4,.2,1.25,.35]);
  assert.deepEqual(reviewPlan(JSON.parse(JSON.stringify(reviewPlan(custom)))),reviewPlan(custom));
  for(const value of [null,{}, {...plan,extra:true},{...plan,views:[]},{...plan,views:Array(13).fill(plan.views[0])},
    {...plan,views:[{id:'../escape'}]},{...plan,views:[{id:'same'},{id:'same'}]},
    {...plan,views:[{id:'one',camera:'fake'}]},{...plan,views:[{id:'one',extra:true}]},
    {...plan,views:[{id:'one',width:4096}]},{...plan,views:[{id:'one',time:3601}]},
    {...plan,views:Array.from({length:5},(_,i)=>({id:`view-${i}`,width:2048,height:2048}))}]) {
    assert.throws(()=>reviewPlan(value));
  }
});

test('review and capture preserve existing outputs before optional browser startup',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'studio-review-'));
  const file=join(directory,'existing.png');
  try{
    await writeFile(file,'original');
    await assert.rejects(reviewCharacter(createCharacter(),directory),{code:'OUTPUT_EXISTS'});
    await assert.rejects(captureCharacter(createCharacter(),file),{code:'OUTPUT_EXISTS'});
    assert.equal(await readFile(file,'utf8'),'original');
  }finally{await rm(directory,{recursive:true,force:true});}
});
