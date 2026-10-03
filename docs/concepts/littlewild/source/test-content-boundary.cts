'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('./content-runtime.js'),A=require('./actor-ecs.js'),E=require('./economy-ecs.js');
const results=[];function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.message);}}

test('Content parse rejects accessors without invoking them',()=>{
 let touched=0;const value={safe:1};Object.defineProperty(value,'hidden',{enumerable:true,get(){touched++;return 2;}});
 assert.throws(()=>C.parse(value),/Accessors|JSON content/);assert.equal(touched,0);
});
test('Content copy rejects symbols, sparse arrays, hidden properties and cycles',()=>{
 const symbol={a:1};symbol[Symbol('x')]=2;assert.throws(()=>C.copy(symbol),/Symbol-keyed/);
 const sparse=[];sparse.length=2;sparse[1]=1;assert.throws(()=>C.copy({sparse}),/dense JSON lists/);
 const hidden={a:1};Object.defineProperty(hidden,'x',{value:2});assert.throws(()=>C.copy(hidden),/hidden properties/);
 const cycle={};cycle.self=cycle;assert.throws(()=>C.copy(cycle),/Cyclic/);
});
test('Public fingerprints reject behavior-shaped objects without invoking accessors',()=>{
 let touched=0;const doc={schemaVersion:1,library:{id:'x',version:1},components:{}};
 Object.defineProperty(doc.components,'bad',{enumerable:true,get(){touched++;return 1;}});
 assert.throws(()=>C.fingerprint(doc),/Accessors|JSON content/);assert.equal(touched,0);
});
test('Actor rule validation fails closed on executable or undefined fields',()=>{
 const base=JSON.parse(fs.readFileSync(__dirname+'/content/actor-rules.json'));
 const executable=JSON.parse(JSON.stringify(base));executable.execute=()=>true;assert.throws(()=>A.validateRules(executable),/JSON data/);
 const missing=JSON.parse(JSON.stringify(base));missing.needs.foodIdle=undefined;assert.throws(()=>A.validateRules(missing),/JSON data/);
});
test('Economy rule validation fails closed on executable fields',()=>{
 const base=JSON.parse(fs.readFileSync(__dirname+'/content/economy-rules.json'));base.callback=()=>true;
 assert.throws(()=>E.validateRules(base),/JSON data/);
});
function state(){return {player:{level:1,xp:0,coins:20},creature:{level:1,xp:0,coins:5},bond:10,rp:3,stats:{earned:0,researchEarned:0},completedQuests:[],ledger:[],log:[],progression:{prestige:4,earnedPrestige:4}};}
function actor(s){return {id:'c1',creature:s.creature,bond:s.bond,stats:s.stats,rpg:{cp:0}};}
test('Economy boundary validates real stat, chapter and actor identities',()=>{
 const s=state(),a=actor(s),ecs=E.create();
 assert.throws(()=>ecs.settle(s,a,{id:'bad:stat',stats:{'':1}}),/settlement stats/);
 assert.throws(()=>ecs.settle(s,a,{id:'bad:chapter',chapterId:'',guide:1}),/chapter ID/);
 const invalid={...a,id:'bad id'};assert.throws(()=>ecs.settle(s,invalid,{id:'bad:actor',guide:1}),/actor identity/);
});

function changed(registry,mechanical=true){
 const doc=registry.export();
 if(mechanical)doc.components.recipes[0].time+=1;
 else doc.components.items[0].name+=' reviewed';
 return registry.prepare(doc);
}
test('Content commits require an unchanged registry-issued review',()=>{
 const registry=new C.Registry(),before=registry.export(),hash=registry.hash;
 for(const edit of [
  p=>p.diff.mechanics=0,
  p=>p.diff.fields[0].kind='presentation',
  p=>{p.candidate=C.copy(p.candidate);p.candidate.components.recipes[0].time+=1;},
  p=>p.fingerprint='fabricated'
 ]){const preview=changed(registry);assert(preview.ok);edit(preview);assert.throws(()=>registry.commit(preview),/review changed/i);assert.equal(registry.hash,hash);assert.deepEqual(registry.export(),before);}
 const preview=changed(registry);
 for(const forged of [C.copy(preview),{...preview},new C.Registry().prepare(preview.candidate)])assert.throws(()=>registry.commit(forged),/review.*again/i);
 assert.equal(registry.hash,hash);
 assert.equal(registry.commit(preview),preview.fingerprint);
 assert.throws(()=>registry.commit(preview),/review.*again/i);
});
test('Modified review descriptors reject accessor fields without invoking them',()=>{
 const registry=new C.Registry(),before=registry.hash;
 for(const target of [p=>p,p=>p.diff,p=>p.candidate]){
  const preview=changed(registry);let reads=0;
  // The candidate is frozen; replace it with detached data before tampering.
  preview.candidate=C.copy(preview.candidate);const object=target(preview),key=Object.keys(object)[0];
  Object.defineProperty(object,key,{enumerable:true,get(){reads++;return true;}});
  assert.throws(()=>registry.commit(preview),/review changed/i);assert.equal(reads,0);assert.equal(registry.hash,before);
 }
});
test('Review envelopes retain valid content near the document complexity budget',()=>{
 const registry=new C.Registry(),original=registry.export(),doc=registry.export();
 // These values fit the library node/byte limits; a mechanical diff duplicates the authored array.
 doc.components.items[0].extensions={samples:Array(25000).fill(1)};
 const first=registry.prepare(doc);assert(first.ok,JSON.stringify(first.errors));registry.commit(first);
 const next=registry.export();next.components.items[0].extensions.samples.fill(2);
 const preview=registry.prepare(next);assert(preview.ok,JSON.stringify(preview.errors));
 assert.equal(registry.commit(preview),preview.fingerprint);
 assert.notDeepEqual(registry.export(),original);
});
test('Content reviews expire after intervening commits even if the original hash returns',()=>{
 const registry=new C.Registry(),original=registry.export(),pending=changed(registry);
 registry.commit(changed(registry));registry.commit(registry.prepare(original));
 assert.equal(registry.hash,pending.baseFingerprint);
 assert.throws(()=>registry.commit(pending),/review.*again/i);
});
test('Temporary content validation preserves reviewed persistent revisions',()=>{
 const registry=new C.Registry(),preview=changed(registry),before=registry.hash;
 registry.withLibrary(preview.candidate,()=>assert.equal(registry.hash,preview.fingerprint));
 assert.equal(registry.hash,before);assert.equal(registry.commit(preview),preview.fingerprint);
});
const L=require('./simulation.cjs'),S=require('./story-codec.js');
test('Edited or fabricated content reviews cannot bypass committed-work policy',()=>{
 const registry=C.registry,engine=new L.Engine(),story=engine.export(),base=registry.export(),hash=registry.hash;
 engine.creatures[0].orders.push({kind:'build'});const committed=engine.export();assert(S.committed(engine));
 const preview=changed(registry);assert.equal(S.currentStoryPolicy(preview,engine).ok,false);
 assert.throws(()=>S.applyContent(preview,engine),/committed work/);
 preview.diff.mechanics=0;
 assert.equal(S.currentStoryPolicy(preview,engine).ok,false);
 assert.throws(()=>S.applyContent(preview,engine),/review changed/i);
 assert.throws(()=>S.applyContent({...changed(registry)},engine,true),/review.*again/i);
 assert.equal(registry.hash,hash);assert.deepEqual(registry.export(),base);assert.deepEqual(engine.export(),committed);
 assert.notDeepEqual(committed,story);
});
test('Valid content applies preserve presentation and deterministic mechanical continuation',()=>{
 const registry=C.registry,base=registry.export(),engine=new L.Engine();
 try{
  const text=changed(registry,false),next=S.applyContent(text,engine);assert.strictEqual(next,engine);assert.equal(registry.hash,text.fingerprint);
  const mechanical=changed(registry),expected=registry.withLibrary(mechanical.candidate,()=>L.Engine.import(engine.export()));
  const continued=S.applyContent(mechanical,engine);assert.notStrictEqual(continued,engine);
  continued.advance(5);expected.advance(5);assert.deepEqual(continued.export(),expected.export());
 }finally{registry.commit(registry.prepare(base));}
});
test('New stories permit reviewed mechanical edits around committed work',()=>{
 const registry=C.registry,base=registry.export(),engine=new L.Engine();engine.creatures[0].orders.push({kind:'build'});
 try{const preview=changed(registry),next=S.applyContent(preview,engine,true);assert.notStrictEqual(next,engine);assert.equal(registry.hash,preview.fingerprint);assert.equal(S.committed(next),false);}
 finally{registry.commit(registry.prepare(base));}
});
test('Public content text limits count Unicode code points consistently with JSON Schema',()=>{
 const Ajv=require('ajv/dist/2020').default,ajv=new Ajv({strict:false}),X=require('./scenario-runtime.js');
 const fixtures=[
  ['Base',C.registry.export(),C.SCHEMA,90,d=>d.library,input=>C.registry.prepare(input).ok],
  ['Adventure',global.LWAdventure.content,require('./content/adventure.schema.json'),80,d=>d.equipment[0],input=>global.LWAdventure.validate(input).ok],
  ['World',global.LWWorldContent.content,global.LWWorldContent.schema,100,d=>d,input=>global.LWWorldContent.validate(input).ok],
  ['Growth',global.LWGrowth.content,global.LWGrowth.schema,500,d=>d,input=>global.LWGrowth.validate(input).ok],
  ['Scenario',X.builtins()[0],require('./content/scenario.schema.json'),80,d=>d,input=>X.validate(input).ok],
  ['Simulation',global.LWSimulationProfile.defaults,require('./content/simulation.schema.json'),100,d=>d,input=>{try{global.LWSimulationProfile.validate(input);return true;}catch{return false;}}]
 ];
 for(const [label,base,schema,limit,target,accepts] of fixtures){
  const validate=ajv.compile(schema);
  for(const count of [limit,limit+1]){const input=C.copy(base);target(input).name='🌱'.repeat(count);const expected=count===limit;
   assert.equal(validate(input),expected,label+' schema at '+count);assert.equal(accepts(input),expected,label+' runtime at '+count);
  }
 }
 // The generic data boundary follows the same unit for metadata without a tighter schema cap.
 assert.doesNotThrow(()=>C.copy({text:'🌱'.repeat(10000)}));assert.throws(()=>C.copy({text:'🌱'.repeat(10001)}),/10,000/);
 const behavior=C.copy(global.LWAdventure.content);behavior.behaviorTree.name='🌱'.repeat(100);assert(global.LWAdventure.validate(behavior).ok);
 behavior.behaviorTree.name+='🌱';assert.equal(global.LWAdventure.validate(behavior).ok,false);
});

const passed=results.filter(r=>r.passed).length;fs.writeFileSync(__dirname+'/content-boundary-results.json',JSON.stringify({passed,total:results.length,failed:results.length-passed,results},null,2)+'\n');console.log(`${passed}/${results.length} content-boundary checks passed`);if(passed!==results.length)process.exitCode=1;
