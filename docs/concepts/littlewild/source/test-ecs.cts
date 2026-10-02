'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('./ecs.js'),A=require('./actor-ecs.js');
const results=[];function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.message);}}
const close=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('Queries are deterministic and independent of entity insertion order',()=>{const w=new E.World();for(const id of['c3','c1','c2']){w.create(id);w.set(id,'Needs',{});}assert.deepEqual(w.query(['Needs']),['c1','c2','c3']);});
test('Systems cannot make structural changes during a query',()=>{const w=new E.World();w.create('c1');w.set('c1','Needs',{});const s=new E.Scheduler().register({id:'guard',phase:'simulate',order:1,query:['Needs'],update(world){assert.throws(()=>world.create('c2'),/deferred/);world.defer('create','c2');}});s.step(w,.1);assert(w.entities.has('c2'));});
test('Components reject behavior, accessors, class instances and non-finite values',()=>{
 const w=new E.World();w.create('c1');
 assert.throws(()=>w.set('c1','Bad',{nested:{run:()=>true}}),/behavior-free/);
 assert.throws(()=>w.set('c1','Bad',{value:Infinity}),/behavior-free/);
 assert.throws(()=>w.set('c1','Bad',{value:undefined}),/behavior-free/);
 assert.throws(()=>w.set('c1','Bad',{nested:new Date()}),/behavior-free/);
 const accessor={};Object.defineProperty(accessor,'value',{enumerable:true,get(){return 1;}});
 assert.throws(()=>w.set('c1','Bad',accessor),/behavior-free/);
 assert.equal(w.get('c1','Bad'),undefined);
});
test('Queries and systems reject malformed or duplicate component declarations',()=>{
 const w=new E.World();w.create('c1');
 assert.throws(()=>w.query(['bad component!']),/component type/);
 assert.throws(()=>new E.Scheduler().register({id:'dup',phase:'simulate',order:1,query:['Needs','Needs'],update(){}}),/Invalid or duplicate system/);
});
test('ECS collection views cannot bypass world or scheduler invariants',()=>{
 const w=new E.World();w.create('c1');w.set('c1','Needs',{food:1});
 const entities=w.entities;entities.add('c2');assert(!w.entities.has('c2'));
 const stores=w.stores;stores.get('Needs').set('c2',{food:9});assert.equal(w.get('c2','Needs'),undefined);
 w.defer('create','c3');const queued=w.structural;assert.throws(()=>queued.push({operation:'create',id:'c4'}),TypeError);
 assert.equal(Object.hasOwn(queued[0],'data'),false);
 assert.equal(w.structural.length,1);w.flush();assert(w.entities.has('c3'));assert(!w.entities.has('c4'));
 const scheduler=new E.Scheduler().register({id:'one',phase:'simulate',order:1,query:['Needs'],update(){}});
 const systems=scheduler.systems;assert.throws(()=>systems.push({id:'zero'}),TypeError);
 assert.deepEqual(scheduler.systems.map(system=>system.id),['one']);
});
test('Deferred structural commands expose exact operation-specific shapes and reject incomplete runtime calls',()=>{
 const w=new E.World();
 assert.throws(()=>w.defer('remove','c1'),/component type/);
 assert.throws(()=>w.defer('set','c1','Data'),/behavior-free/);
 w.defer('create','c1');w.defer('set','c1','Data',{value:1});w.defer('remove','c1','Data');w.defer('destroy','c1');
 const byOp=Object.fromEntries(w.structural.map(command=>[command.operation,command]));
 assert.deepEqual(byOp.create,{operation:'create',id:'c1'});
 assert.deepEqual(byOp.set,{operation:'set',id:'c1',type:'Data'});
 assert.deepEqual(byOp.remove,{operation:'remove',id:'c1',type:'Data'});
 assert.deepEqual(byOp.destroy,{operation:'destroy',id:'c1'});
 assert.equal(Object.hasOwn(byOp.set,'data'),false);
 w.flush();assert.equal(w.entities.has('c1'),false);
});
test('Actor ECS mutates native records without introducing ECS save state',()=>{const c={id:'c1',creature:{x:1,y:1},inventory:{berries:2},needs:{food:80,water:70,energy:60,comfort:50,joy:40},learning:{practiceDay:1,practicedToday:{x:1},fatigue:20,recovering:false},feelings:{social:50,anger:10},task:{kind:'build',phase:'walk',style:'together'}};const e=A.create();const refs=[c.needs,c.learning,c.feelings];const r=e.step(c,.1,{day:2,socialPreference:2,loadLevel:3,hasShelter:true});assert.equal(r.studying,false);assert.equal(c.learning.practiceDay,2);assert.deepEqual(c.learning.practicedToday,{});assert.equal(e.world.get('c1','Needs'),refs[0]);close(c.learning.fatigue,19.984);close(c.feelings.social,49.9945);close(c.feelings.anger,9.991);close(c.needs.food,79.99);close(c.needs.water,69.987);close(c.needs.energy,59.9808);close(c.needs.comfort,49.998);close(c.needs.joy,39.9965);assert(!Object.hasOwn(c,'ecs'));});
test('Learning thresholds and playful tuning are data-driven',()=>{const rules=JSON.parse(fs.readFileSync(__dirname+'/content/actor-rules.json'));rules.learning.playfulFatigue=1;const c={id:'c1',creature:{x:1,y:1},inventory:{berries:2},needs:{food:100,water:100,energy:100,comfort:100,joy:100},learning:{practiceDay:4,practicedToday:{},fatigue:69.95,recovering:false},feelings:{social:100,anger:0},task:{kind:'practice',phase:'work',style:'playful'}};A.create(rules).step(c,.1,{day:4,socialPreference:0,loadLevel:0,hasShelter:false});close(c.learning.fatigue,70.05);assert.equal(c.learning.recovering,true);});
test('Rule manifests reject behavior-shaped or unknown data',()=>{const rules=JSON.parse(fs.readFileSync(__dirname+'/content/actor-rules.json'));rules.execute='alert(1)';assert.throws(()=>A.validateRules(rules),/schema/);rules.execute=undefined;delete rules.execute;rules.needs.workingKinds.push('bad task!');assert.throws(()=>A.validateRules(rules),/needs/);});
test('Failed systems discard structural requests rather than partially applying them',()=>{
 const w=new E.World();w.create('c1');w.set('c1','Needs',{});
 const scheduler=new E.Scheduler().register({id:'throwing',phase:'simulate',order:1,query:['Needs'],update(world){
   world.defer('create','c2');throw Error('intentional failure');
 }});
 assert.throws(()=>scheduler.step(w,.1),/intentional failure/);
 assert.deepEqual(w.query([]),['c1']);assert.equal(w.structural.length,0);
});
test('Invalid deferred batches cannot leave partially created entities',()=>{
 const w=new E.World();w.defer('create','c1');w.defer('create','c1');
 assert.throws(()=>w.flush(),/Duplicate deferred entity/);
 assert.deepEqual(w.query([]),[]);assert.equal(w.structural.length,0);
 w.defer('create','c2');w.flush();assert.deepEqual(w.query([]),['c2']);
 new E.Scheduler().step(w,.1);assert.deepEqual(w.query([]),['c2']);
});
test('Deferred component payload mutation cannot break structural atomicity',()=>{
 const w=new E.World(),payload={value:1};
 w.defer('create','c1');w.defer('set','c1','Data',payload);
 payload.behavior=()=>true;
 assert.throws(()=>w.flush(),/behavior-free/);
 assert.deepEqual(w.query([]),[]);
 assert.equal(w.structural.length,0);
});
test('Component data rejects sparse arrays and hidden array properties',()=>{
 const w=new E.World();w.create('c1');
 const sparse=[];sparse.length=2;sparse[1]=1;
 assert.throws(()=>w.set('c1','Sparse',{items:sparse}),/behavior-free/);
 const decorated=[1];Object.defineProperty(decorated,'hidden',{value:2});
 assert.throws(()=>w.set('c1','Decorated',{items:decorated}),/behavior-free/);
 const hiddenIndex=[];Object.defineProperty(hiddenIndex,'0',{value:1,enumerable:false});hiddenIndex.length=1;
 assert.throws(()=>w.set('c1','HiddenIndex',{items:hiddenIndex}),/behavior-free/);
});
test('Component lifecycle tracks a changing creature roster',()=>{
 const mk=id=>({id,creature:{x:1,y:2},inventory:{wood:1},needs:{},learning:{},feelings:{}});
 const first=mk('c1'),second=mk('c2'),ecs=A.create();
 ecs.sync([first,second]);assert.deepEqual(ecs.world.query(['Inventory','Transform']),['c1','c2']);
 assert.equal(ecs.world.get('c1','Needs'),first.needs);
 first.needs={food:40};ecs.sync([first]);assert.equal(ecs.world.get('c1','Needs'),first.needs);
 assert(!ecs.world.entities.has('c2'));
});
test('Stable system order is phase then order then id',()=>{const w=new E.World();w.create('c1');w.set('c1','X',{});const log=[],s=new E.Scheduler();for(const [id,phase,order] of[['z','simulate',1],['b','pre',3],['a','pre',3],['p','post',0]])s.register({id,phase,order,query:['X'],update(){log.push(id);}});s.step(w,.1);assert.deepEqual(log,['a','b','z','p']);});
const passed=results.filter(r=>r.passed).length;fs.writeFileSync(__dirname+'/ecs-results.json',JSON.stringify({passed,total:results.length,results},null,2));console.log(`${passed}/${results.length} ECS checks passed`);if(passed!==results.length)process.exitCode=1;