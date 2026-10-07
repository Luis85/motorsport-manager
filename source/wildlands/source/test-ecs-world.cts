'use strict';
// Tests run the composite showcase game: install its content profile before any engine module loads.
require('./test-support/install-games.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),W=require('./world-ecs.js'),E=require('./ecs.js');
const results=[];function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.message);}}
const total=(...inventories)=>inventories.reduce((n,inv)=>n+Object.values(inv).reduce((a,q)=>a+q,0),0);
const transfer=(id,source,destination,resource,requested,destinationLimit)=>({id,sourceId:'inventory:source',destinationId:'inventory:destination:'+id,source,destination,resource,requested,destinationLimit});
test('Inventory transfer binds native records, conserves ownership and settles once',()=>{const ecs=W.create(),source={wood:5},destination={wood:1},before=total(source,destination),spec=transfer('transfer:c1:1',source,destination,'wood',3,4);const r=ecs.transfer(spec);assert.deepEqual(r,{ok:true,state:'settled',amount:3});assert.equal(ecs.world.get('inventory:source','Inventory').items,source);assert.equal(source.wood,2);assert.equal(destination.wood,4);assert.equal(total(source,destination),before);assert.equal(ecs.transfer(spec).state,'duplicate');assert.equal(total(source,destination),before);});
test('Transfer capacity failure is atomic',()=>{const ecs=W.create(),source={stone:2},destination={stone:7},before=JSON.stringify([source,destination]);assert.equal(ecs.transfer(transfer('transfer:c1:2',source,destination,'stone',2,0)).state,'blocked');assert.equal(JSON.stringify([source,destination]),before);});
test('Concurrent carrier contention resolves by stable transaction ID',()=>{const ecs=W.create(),source={wood:3},a={},b={};const out=ecs.transfers([{...transfer('z-carrier',source,b,'wood',3,3),destinationId:'inventory:b'},{...transfer('a-carrier',source,a,'wood',3,3),destinationId:'inventory:a'}]);assert.deepEqual(out.map(x=>[x.id,x.amount]),[['a-carrier',3],['z-carrier',0]]);assert.equal(a.wood,3);assert.equal(b.wood||0,0);assert.equal(source.wood,0);const guarded=W.create(),stock={wood:4},x={},y={},before=JSON.stringify([stock,x,y]);assert.throws(()=>guarded.transfers([transfer('a-valid',stock,x,'wood',2,2),transfer('b-invalid',stock,y,'wood',0,2)]),/Invalid transfer/);assert.equal(JSON.stringify([stock,x,y]),before);});
test('Finite harvest binds a resource deposit and conserves carried stock',()=>{const ecs=W.create(),deposit={stock:2},inventory={ore:1},before=deposit.stock+inventory.ore;const r=ecs.harvest({id:'harvest:c1:n1',depositId:'deposit:n1',deposit,finite:true,destinationId:'inventory:c1',destination:inventory,resource:'ore',requested:5,destinationLimit:4});assert.equal(r.amount,2);assert.equal(ecs.world.get('deposit:n1','ResourceDeposit').record,deposit);assert.equal(deposit.stock,0);assert.equal(inventory.ore,3);assert.equal(deposit.stock+inventory.ore,before);});
test('Infinite harvest leaves the authored deposit record unchanged',()=>{const ecs=W.create(),deposit={stock:0},inventory={berries:0};assert.equal(ecs.harvest({id:'harvest:c1:n2',depositId:'deposit:n2',deposit,finite:false,destinationId:'inventory:c1',destination:inventory,resource:'berries',requested:3,destinationLimit:3}).amount,3);assert.equal(deposit.stock,0);assert.equal(inventory.berries,3);});
function reservation(id,storage,deposit,job){return {id:'reserve:'+id,worksiteId:'worksite:bench',storage,recipe:{cost:{wood:2}},outputCapacity:8,outputAmount:1,depositId:'deposit:site',deposit,substrateResource:'wood',substrateFinite:true,substrateDepletion:2,job};}
test('Production reservation consumes inputs and substrate exactly once',()=>{const ecs=W.create(),storage={input:{wood:2},output:{},job:null},deposit={stock:5},job={id:'work-1',output:'planks',amount:1,duration:10,progress:0,attempts:0,workerId:'c1'},spec=reservation('work-1',storage,deposit,job);assert.equal(ecs.reserveProduction(spec).created,true);assert.equal(ecs.world.get('worksite:bench','Worksite').storage,storage);assert.equal(ecs.world.get('worksite:bench','ProductionJob').record,job);assert.equal(storage.input.wood,0);assert.equal(deposit.stock,3);assert.equal(ecs.reserveProduction(spec).state,'duplicate');assert.equal(deposit.stock,3);});
test('Production reservation failure changes no record',()=>{const ecs=W.create(),storage={input:{wood:1},output:{},job:null},deposit={stock:1},job={id:'work-2',output:'planks',amount:1,duration:10,progress:0,attempts:0,workerId:'c1'},before=JSON.stringify([storage,deposit]);assert.equal(ecs.reserveProduction(reservation('work-2',storage,deposit,job)).state,'blocked');assert.equal(JSON.stringify([storage,deposit]),before);});
test('Production progress, release and takeover retain one paid job',()=>{const ecs=W.create(),job={id:'work-3',output:'rope',amount:1,duration:8,progress:0,attempts:0,workerId:'c1'},storage={input:{},output:{},job},base={worksiteId:'worksite:bench',storage,jobId:job.id};ecs.updateProduction({...base,id:'progress:work-3',action:'progress',progress:3});ecs.updateProduction({...base,id:'release:work-3',action:'release',progress:3});assert.equal(job.workerId,null);assert.equal(ecs.updateProduction({...base,id:'claim:work-3:c2',action:'claim',workerId:'c2',allowTakeover:false}).state,'settled');assert.equal(storage.job,job);assert.equal(job.workerId,'c2');assert.equal(job.progress,3);});
test('Failed production attempt keeps reserved inputs and requires more work',()=>{const ecs=W.create(),job={id:'work-4',output:'planks',amount:1,duration:10,progress:10,attempts:0,workerId:'c1',cost:{wood:2}},storage={input:{},output:{},job,completed:0,lastOutput:0,lastMessage:''},base={worksiteId:'worksite:bench',storage,jobId:job.id,success:false,outputCapacity:8,time:20,message:'Setback'};const before=JSON.stringify(storage);assert.throws(()=>ecs.settleProduction({...base,id:'attempt:work-4:invalid',retryProgress:-1}),/Invalid production settlement/);assert.equal(JSON.stringify(storage),before);const r=ecs.settleProduction({...base,id:'attempt:work-4:1',retryProgress:4});assert.equal(r.success,false);assert.equal(storage.job,job);assert.equal(job.progress,4);assert.equal(job.attempts,1);assert.equal(job.workerId,null);assert.deepEqual(job.cost,{wood:2});});
test('Successful production emits output and clears the job exactly once',()=>{const ecs=W.create(),job={id:'work-5',output:'planks',amount:2,duration:10,progress:10,attempts:0,workerId:'c1'},storage={input:{},output:{planks:1},job,completed:0,lastOutput:0,lastMessage:''};const spec={id:'attempt:work-5:1',worksiteId:'worksite:bench',storage,jobId:job.id,success:true,retryProgress:0,outputCapacity:8,time:30,message:'Finished'};const r=ecs.settleProduction(spec);assert.equal(r.amount,2);assert.equal(storage.output.planks,3);assert.equal(storage.completed,1);assert.equal(storage.lastOutput,30);assert.equal(storage.job,null);assert.equal(ecs.world.get('worksite:bench','ProductionJob').record,null);assert.equal(ecs.settleProduction(spec).state,'duplicate');assert.equal(storage.output.planks,3);});
test('World settlement uses explicit components and the deterministic ECS scheduler',()=>{const ecs=W.create();assert(ecs.world instanceof E.World);assert(ecs.scheduler instanceof E.Scheduler);assert.deepEqual(ecs.scheduler.systems.map(s=>s.id),['inventory-transfer','resource-harvest','production-reserve','production-job-update','production-settlement']);});
test('Transfers and harvests cannot overflow a validated inventory quantity',()=>{
 const ecs=W.create(),source={wood:2},destination={wood:1e9},deposit={stock:2},before=JSON.stringify([source,destination,deposit]);
 assert.equal(ecs.transfer(transfer('transfer:overflow',source,destination,'wood',1,1)).state,'blocked');
 assert.equal(ecs.harvest({id:'harvest:overflow',depositId:'deposit:overflow',deposit,finite:true,destinationId:'inventory:overflow',destination,resource:'wood',requested:1,destinationLimit:1}).state,'blocked');
 assert.equal(JSON.stringify([source,destination,deposit]),before);
});
test('Invalid production jobs and mismatched output reject before inputs are charged',()=>{
 for(const patch of [{output:'bad output'},{amount:-1},{amount:2},{duration:NaN},{duration:0},{progress:-1},{attempts:-1},{cost:{wood:1}}]){
  const ecs=W.create(),storage={input:{wood:2},output:{},job:null},deposit={stock:5},job={id:'preflight',output:'planks',amount:1,duration:10,progress:0,attempts:0,workerId:'c1',...patch};
  const before=JSON.stringify([storage,deposit]);assert.throws(()=>ecs.reserveProduction(reservation('preflight',storage,deposit,job)),/production|reserved/);
  assert.equal(JSON.stringify([storage,deposit]),before);assert.equal(ecs.hasSettled('reserve:preflight'),false);
 }
});
test('Missing substrate depletion means zero and non-finite depletion is rejected',()=>{
 const ecs=W.create(),storage={input:{wood:2},output:{},job:null},deposit={stock:5},job={id:'no-depletion',output:'planks',amount:1,duration:10,progress:0,attempts:0,workerId:'c1'},spec=reservation('no-depletion',storage,deposit,job);
 spec.substrateDepletion=NaN;const before=JSON.stringify([storage,deposit]);assert.throws(()=>ecs.reserveProduction(spec),/Invalid production reservation/);assert.equal(JSON.stringify([storage,deposit]),before);
 delete spec.substrateDepletion;assert.equal(ecs.reserveProduction(spec).state,'settled');assert.equal(deposit.stock,5);
});
test('Existing worksite bindings reject corrupt jobs without mutating production records',()=>{
 const ecs=W.create(),job={id:'corrupt',output:'planks',amount:1,duration:10,progress:0,attempts:0,workerId:'c1'},storage={input:{},output:{},job};ecs.bindWorksite('worksite:corrupt',storage);
 job.amount=-1;const before=JSON.stringify(storage);assert.throws(()=>ecs.settleProduction({id:'attempt:corrupt',worksiteId:'worksite:corrupt',storage,jobId:job.id,success:true,outputCapacity:8,time:1}),/Invalid production job/);assert.equal(JSON.stringify(storage),before);
});
test('Production counter overflow rejects before output, attempts or settlement markers change',()=>{
 for(const counters of [{attempts:1e9,completed:0},{attempts:0,completed:1e9}]){
  const ecs=W.create(),job={id:'counter',output:'planks',amount:1,duration:10,progress:10,attempts:counters.attempts,workerId:'c1'},storage={input:{},output:{},job,completed:counters.completed};
  const spec={id:'attempt:counter',worksiteId:'worksite:counter',storage,jobId:job.id,success:true,outputCapacity:8,time:1},before=JSON.stringify(storage);
  assert.throws(()=>ecs.settleProduction(spec),/Production count limit/);assert.equal(JSON.stringify(storage),before);assert.equal(ecs.hasSettled(spec.id),false);
 }
});
test('Rejected batch staging discards earlier commands before the next valid batch',()=>{
 const ecs=W.create(),source={wood:4},a={},b={},next={},first=transfer('a-staged',source,a,'wood',2,2),invalid={...transfer('b-invalid-data',source,b,'wood',1,1),callback:()=>true},before=JSON.stringify([source,a,b]);
 assert.throws(()=>ecs.transfers([first,invalid]),/behavior-free/);assert.equal(JSON.stringify([source,a,b]),before);
 assert.equal([...ecs.world.entities].some(id=>id.startsWith('tx:')),false);assert.equal(ecs.hasSettled(first.id),false);
 assert.equal(ecs.transfers([transfer('c-next',source,next,'wood',1,1)])[0].amount,1);assert.equal(source.wood,3);assert.deepEqual(a,{});assert.deepEqual(b,{});
 assert.throws(()=>ecs.transfer({...transfer('single-invalid',source,next,'wood',1,1),callback:()=>true}),/behavior-free/);
 assert.equal([...ecs.world.entities].some(id=>id.startsWith('tx:')),false);
});
test('Inventory write preflight rejects immutable targets without binding or receipts',()=>{
 const locked=value=>Object.defineProperty({wood:value},'wood',{writable:false});
 for(const [source,destination] of [
  [{wood:5},Object.freeze({wood:1})],[Object.freeze({wood:5}),{wood:1}],
  [{wood:5},locked(1)],[locked(5),{wood:1}],[{wood:5},Object.seal({})]
 ]){
  const ecs=W.create(),spec=transfer('immutable',source,destination,'wood',2,2),before=JSON.stringify([source,destination]);
  assert.throws(()=>ecs.transfer(spec),/write target/);
  assert.equal(JSON.stringify([source,destination]),before);assert.equal(ecs.hasSettled(spec.id),false);
  assert.equal(ecs.world.entities.size,0);assert.equal(ecs.world.stores.size,0);
 }
});
test('Accessor inventories reject without executing getters or modifying existing ECS bindings',()=>{
 for(const accessorSide of ['source','destination']){
  const ecs=W.create(),original={wood:9};ecs.bindInventory('inventory:source',original);
  const binding=ecs.world.get('inventory:source','Inventory'),source={wood:5},destination={wood:1};let reads=0;
  Object.defineProperty(accessorSide==='source'?source:destination,'wood',{enumerable:true,get(){reads++;return 5;}});
  const spec=transfer('accessor',source,destination,'wood',2,2),entities=[...ecs.world.entities],stores=[...ecs.world.stores.keys()];
  assert.throws(()=>ecs.transfer(spec),/behavior-free/);assert.equal(reads,0);assert.equal(ecs.hasSettled(spec.id),false);
  assert.deepEqual([...ecs.world.entities],entities);assert.deepEqual([...ecs.world.stores.keys()],stores);
  assert.equal(ecs.world.get('inventory:source','Inventory'),binding);assert.deepEqual(original,{wood:9});
  if(accessorSide==='destination')assert.equal(source.wood,5);else assert.equal(destination.wood,1);
 }
});
test('Every batch command is prepared before any transfer or receipt is accepted',()=>{
 for(const patch of [spec=>({...spec,destination:Object.freeze({wood:0})}),spec=>({...spec,metadata:{late:()=>true}})]){
  const ecs=W.create(),source={wood:5},first={},second={},a=transfer('a-first',source,first,'wood',1,1);
  const b=patch(transfer('b-second',source,second,'wood',1,1)),before=JSON.stringify([source,first,b.destination]);
  assert.throws(()=>ecs.transfers([a,b]),/write target|behavior-free/);
  assert.equal(JSON.stringify([source,first,b.destination]),before);assert.equal(ecs.hasSettled(a.id),false);assert.equal(ecs.hasSettled(b.id),false);
  assert.equal(ecs.world.entities.size,0);assert.equal(ecs.world.stores.size,0);
  assert.equal(ecs.transfer(transfer('retry',source,second,'wood',1,1)).amount,1);assert.equal(source.wood,4);
 }
});
test('Contested IDs use codepoint ordering and preserve input order for equal IDs',()=>{
 const ecs=W.create(),source={wood:1},lower={},upper={},first={},second={};
 const out=ecs.transfers([transfer('i',source,lower,'wood',1,1),transfer('I',source,upper,'wood',1,1)]);
 assert.deepEqual(out.map(x=>[x.id,x.amount]),[['I',1],['i',0]]);assert.deepEqual(upper,{wood:1});assert.deepEqual(lower,{});
 const shared={wood:1},a={...transfer('same',shared,first,'wood',1,1),destinationId:'inventory:first'},b={...transfer('same',shared,second,'wood',1,1),destinationId:'inventory:second'};
 const tied=ecs.transfers([a,b]);assert.equal(tied[0].state,'settled');assert.equal(tied[1].state,'duplicate');assert.deepEqual(first,{wood:1});assert.deepEqual(second,{});
});
test('Harvest and production write targets reject before any resource debit',()=>{
 const ecs=W.create(),deposit=Object.freeze({stock:5}),destination={wood:0};
 assert.throws(()=>ecs.harvest({id:'locked-harvest',depositId:'deposit:locked',deposit,finite:true,destinationId:'inventory:locked',destination,resource:'wood',requested:2,destinationLimit:2}),/write target/);
 assert.deepEqual(destination,{wood:0});assert.equal(ecs.world.entities.size,0);
 const storage=Object.freeze({input:{wood:2},output:{},job:null}),job={id:'locked-production',output:'planks',amount:1,duration:10,progress:0,attempts:0,workerId:'c1'},substrate={stock:5};
 assert.throws(()=>ecs.reserveProduction(reservation('locked-production',storage,substrate,job)),/write target/);
 assert.deepEqual(storage.input,{wood:2});assert.equal(substrate.stock,5);assert.equal(storage.job,null);
 assert.equal(ecs.hasSettled('reserve:locked-production'),false);assert.equal(ecs.world.entities.size,0);
});
test('Internal transaction entity collisions reject before single or batch projections change',()=>{
 for(const mode of ['single','first','late'])for(const reference of ['sourceId','destinationId']){
  const ecs=W.create(),original={wood:9},source={wood:5},a={},b={};ecs.bindInventory('inventory:source',original);
  const specs=mode==='single'?[transfer('collision',source,a,'wood',1,1)]:[transfer('a-collision',source,a,'wood',1,1),transfer('b-collision',source,b,'wood',1,1)];
  const index=mode==='late'?1:0;specs[index][reference]='tx:'+String(index+1).padStart(10,'0')+':'+specs[index].id;
  const entities=[...ecs.world.entities],stores=ecs.world.stores,before=JSON.stringify([original,source,a,b]);
  assert.throws(()=>mode==='single'?ecs.transfer(specs[0]):ecs.transfers(specs),/Invalid physical entity ID/);
  assert.equal(JSON.stringify([original,source,a,b]),before);assert.deepEqual([...ecs.world.entities],entities);
  assert.deepEqual([...ecs.world.stores.keys()],[...stores.keys()]);
  for(const [type,store]of stores){assert.equal(ecs.world.stores.get(type).size,store.size);for(const [id,data]of store)assert.equal(ecs.world.get(id,type),data);}
  for(const spec of specs)assert.equal(ecs.hasSettled(spec.id),false);
  const allowed=transfer('tx:receipt',source,b,'wood',1,1);assert.equal(ecs.transfer(allowed).state,'settled');assert.equal(ecs.hasSettled(allowed.id),true);
 }
});
test('All public physical bindings reserve the internal transaction entity namespace',()=>{
 const ecs=W.create(),items={wood:5},deposit={stock:5},storage={input:{wood:2},output:{},job:null};
 for(const bind of [()=>ecs.bindInventory('tx:inventory',items),()=>ecs.bindDeposit('tx:deposit',deposit,'wood',true),()=>ecs.bindWorksite('tx:worksite',storage)]){
  assert.throws(bind,/Invalid physical entity ID/);assert.equal(ecs.world.entities.size,0);assert.equal(ecs.world.stores.size,0);
 }
 assert.deepEqual(items,{wood:5});assert.deepEqual(deposit,{stock:5});assert.deepEqual(storage,{input:{wood:2},output:{},job:null});
});
const passed=results.filter(r=>r.passed).length;fs.writeFileSync(__dirname+'/ecs-world-results.json',JSON.stringify({passed,total:results.length,failed:results.length-passed,results},null,2)+'\n');console.log(`${passed}/${results.length} ECS world checks passed`);if(passed!==results.length)process.exitCode=1;
