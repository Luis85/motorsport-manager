'use strict';
/* Real-engine boundary tests for ECS-owned deposits, worksite inventories and jobs. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const L=require('./simulation.cjs'),S=require('./story-codec.js'),E=require('./ecs.js');
const results=[];function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.message);}}
const copy=x=>JSON.parse(JSON.stringify(x)),snap=e=>JSON.stringify(e.export());
function clean(){const e=L.createWorldDemo();e.s.started=true;e.s.paused=false;e.selectCreature('c1');for(const c of e.creatures){c.task=null;c.orders=[];c.training=null;c.learning.queue=[];c.equipQueue=[];c.activeQuest=null;c.stockTargets={};c.worldPickup=null;c.worldSupply=null;c.needsDeposit=false;for(const k in c.needs)c.needs[k]=95;}for(const b of e.s.buildings)if(b.storage)Object.assign(b.storage,{input:{},output:{},job:null,requests:{},targets:{},enabled:true});return e;}
function arrive(e,t){assert(t);assert(e.startTask(t));const p=t.path.at(-1)||e.actor.creature;Object.assign(e.actor.creature,{x:p.x,y:p.y});t.path=[];t.phase='work';return t;}
function physicalTotal(e,id){return (e.s.colony.warehouse.inventory[id]||0)+e.creatures.reduce((n,c)=>n+(c.inventory[id]||0),0)+e.s.buildings.reduce((n,b)=>n+(b.storage?.input[id]||0)+(b.storage?.output[id]||0)+(b.storage?.job?.cost[id]||0),0)+e.s.nodes.reduce((n,node)=>n+(global.LWWorldContent.node(node.kind)?.resource===id&&global.LWWorldContent.node(node.kind).mode==='finite'?node.stock:0),0);}
test('World ECS is transient and uses the shared deterministic ECS core',()=>{const e=clean();assert(e.worldEcs?.world instanceof E.World);assert(!Object.hasOwn(e.export().state,'worldEcs'));assert(!Object.hasOwn(e.export().state,'ecs'));});
test('A real finite harvest settles through ResourceDeposit and Inventory components',()=>{
 const e=clean(),n=e.s.nodes.find(n=>n.kind==='stone');n.stock=2;e.actor.inventory.stone=0;e.check=()=>({success:true});
 const gathered=e.actor.stats.gathered,t=arrive(e,{kind:'gather',worldGather:true,nodeId:n.id,resource:'stone',target:n,duration:2,label:'ECS harvest'}),before=physicalTotal(e,'stone');
 e.finishTask(t);assert.equal(n.stock,0);assert.equal(e.actor.inventory.stone,2);assert.equal(e.actor.stats.gathered,gathered+2);assert.equal(e.actor.task,null);
 assert.equal(physicalTotal(e,'stone'),before);assert.equal(e.worldEcs.world.get('deposit:'+n.id,'ResourceDeposit').record,n);
 assert.equal(e.worldEcs.world.get('inventory:actor:'+e.actor.id,'Inventory').items,e.actor.inventory);
 const after=snap(e);e.finishTask(t);assert.equal(snap(e),after);
});
test('A real carrier transfer changes only source and destination ownership',()=>{const e=clean(),b=e.s.buildings.find(b=>b.kind==='bench');b.storage.output.planks=3;const before=physicalTotal(e,'planks'),t=arrive(e,e.collectTask(b,'planks',2));e.finishTask(t);assert.equal(physicalTotal(e,'planks'),before);assert.equal(b.storage.output.planks,1);assert.equal(e.actor.inventory.planks,2);assert.equal(e.worldEcs.world.get('inventory:worksite:'+b.id+':output','Inventory').items,b.storage.output);});
test('Production reservation binds one worksite job and charges inputs once',()=>{
 const e=clean(),b=e.s.buildings.find(b=>b.kind==='bench');e.actor.skills.woodwork=true;b.storage.input={wood:2};
 const before=physicalTotal(e,'wood');arrive(e,e.productionTask(b,'planks'));
 assert(b.storage.job);assert.equal(b.storage.input.wood,0);assert.deepEqual(b.storage.job.cost,{wood:2});assert.equal(b.storage.output.planks||0,0);
 assert.equal(e.worldEcs.world.get('worksite:'+b.id,'Worksite').storage,b.storage);assert.equal(e.worldEcs.world.get('worksite:'+b.id,'ProductionJob').record,b.storage.job);assert.equal(physicalTotal(e,'wood'),before);
 const job=copy(b.storage.job);e.care('space');assert.deepEqual(b.storage.job.cost,job.cost);arrive(e,e.productionTask(b,'planks'));
 assert.equal(b.storage.input.wood,0);assert.equal(b.storage.job.id,job.id);assert.deepEqual(b.storage.job.cost,{wood:2});assert.equal(physicalTotal(e,'wood'),before);
});
test('Production completion emits once and clears the ECS job binding',()=>{const e=clean(),b=e.s.buildings.find(b=>b.kind==='bench');e.actor.skills.woodwork=true;const r=e.recipe(b,'planks');b.storage.input=copy(r.cost);const t=arrive(e,e.productionTask(b,'planks'));e.check=()=>({success:true});t.elapsed=t.duration;e.finishTask(t);const after=snap(e);assert.equal(b.storage.output.planks,1);assert.equal(b.storage.job,null);assert.equal(e.worldEcs.world.get('worksite:'+b.id,'ProductionJob').record,null);e.finishTask(t);assert.equal(snap(e),after);});
test('Failed production retains its paid batch across save and resume',()=>{const e=clean(),b=e.s.buildings.find(b=>b.kind==='bench');e.actor.skills.woodwork=true;const r=e.recipe(b,'planks');b.storage.input=copy(r.cost);const t=arrive(e,e.productionTask(b,'planks'));e.check=()=>({success:false});t.elapsed=t.duration;e.finishTask(t);assert(b.storage.job);assert.equal(b.storage.job.progress,b.storage.job.duration*.4);const restored=S.commit(S.inspect(S.encode(e))),rb=restored.s.buildings.find(x=>x.id===b.id);assert.deepEqual(rb.storage.job,b.storage.job);assert(restored.worldEcs?.world instanceof E.World);assert(!Object.hasOwn(restored.export().state,'worldEcs'));});
const passed=results.filter(r=>r.passed).length;fs.writeFileSync(__dirname+'/ecs-world-integration-results.json',JSON.stringify({passed,total:results.length,failed:results.length-passed,results},null,2)+'\n');console.log(`${passed}/${results.length} ECS world integration checks passed`);if(passed!==results.length)process.exitCode=1;
