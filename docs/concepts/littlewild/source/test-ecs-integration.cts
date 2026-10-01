'use strict';
/* Run from the complete PR checkout. Tests the real legacy facade after ECS adoption. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const L=require('./simulation.cjs'),S=require('./story-codec.js'),E=require('./ecs.js');
const results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.message);}}
const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-8,actual+' != '+expected);
test('All simulated creatures bind authoritative v8 component records',()=>{
 const e=L.createWorldDemo();assert(e.ecs && e.ecs.world instanceof E.World);
 e.ecs.sync(e.creatures);
 assert.deepEqual(e.ecs.world.query(['Needs']),e.creatures.map(c=>c.id).slice().sort());
 for(const c of e.creatures){
  for(const [type,field] of Object.entries(global.LWActorECS.FIELDS))
   assert.equal(e.ecs.world.get(c.id,type),c[field]);
 }
 assert(!Object.hasOwn(e.export().state,'ecs'));
});
test('A world tick advances migrated actor dynamics once for every active actor',()=>{
 const e=L.createWorldDemo();e.s.started=true;e.s.paused=false;
 for(const c of e.creatures){c.needs={food:80,water:80,energy:80,comfort:80,joy:80};c.learning.fatigue=15;c.learning.recovering=false;c.task=null;}
 const before=e.creatures.map(c=>({id:c.id,food:c.needs.food,fatigue:c.learning.fatigue}));
 e.step(.1);
 for(const b of before){const c=e.creatures.find(a=>a.id===b.id);assert(c.needs.food<b.food);assert(c.learning.fatigue<=b.fatigue);}
});
test('Story roundtrip resumes deterministic legacy-plus-ECS stepping',()=>{
 const e=L.createWorldDemo();e.s.paused=false;e.s.started=true;e.advance(12);
 const doc=S.encode(e),restored=S.commit(S.inspect(doc));
 assert.deepEqual(restored.export().state,e.export().state);
 assert(restored.ecs?.world instanceof E.World);
 e.advance(20);restored.advance(20);
 assert.deepEqual(restored.export().state,e.export().state);
});
test('ECS structural lifetime follows actor roster explicitly',()=>{
 const e=L.createWorldDemo();e.ecs.sync(e.creatures);
 const removed=e.creatures[0];const count=e.ecs.world.query(['Needs']).length;
 const copy=JSON.parse(JSON.stringify(removed));copy.id='ecs-temp';
 e.ecs.sync([...e.creatures,copy]);assert.equal(e.ecs.world.query(['Needs']).length,count+1);
 e.ecs.sync(e.creatures);assert(!e.ecs.world.has('ecs-temp'));
});
test('Legacy facade delegates movement to ECS without spending work time on arrival',()=>{
 const e=L.createWorldDemo(),c=e.creatures[0];e.selectCreature(c.id);
 c.needs={food:90,water:90,energy:90,comfort:90,joy:90};c.creature.x=5;c.creature.y=5;
 c.task={kind:'gather',phase:'walk',path:[{x:6,y:5}],duration:5,elapsed:0,label:'Walking'};
 e.withActor(c,()=>e.stepActor(.1));assert(c.creature.x>5&&c.creature.x<6);assert.equal(c.task.phase,'walk');near(c.task.elapsed,0);
 assert.equal(e.ecs.world.get(c.id,'Intent').status,'active');
});
test('Legacy facade mirrors ECS work progress and completes once',()=>{
 const e=L.createWorldDemo(),c=e.creatures[0];e.selectCreature(c.id);
 c.needs={food:90,water:90,energy:90,comfort:90,joy:90};
 c.task={kind:'rest',phase:'work',path:[],duration:.05,elapsed:0,label:'Resting',need:'energy'};
 e.withActor(c,()=>e.stepActor(.1));assert.equal(c.task,null);
});
test('Blocked ECS movement is resolved through the domain interruption boundary',()=>{
 const e=L.createWorldDemo(),c=e.creatures[0];e.selectCreature(c.id);
 c.needs={food:90,water:90,energy:90,comfort:90,joy:90};
 c.task={kind:'gather',phase:'walk',path:[{x:-1,y:-1}],duration:5,elapsed:0,label:'Blocked'};
 e.withActor(c,()=>e.stepActor(.1));assert.equal(c.task,null);
});
const passed=results.filter(r=>r.passed).length;
fs.writeFileSync(__dirname+'/ecs-integration-results.json',JSON.stringify({passed,total:results.length,failed:results.length-passed,results},null,2)+'\n');
console.log(passed+'/'+results.length+' ECS integration checks passed');if(passed!==results.length)process.exitCode=1;