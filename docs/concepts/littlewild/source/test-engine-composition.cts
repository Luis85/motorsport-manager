'use strict';
/* M5 contracts for explicit engine composition and actor-scoped state views. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const L=require('./simulation.cjs'),S=require('./story-codec.js');
const results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.message);}}
const source=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const canonical=e=>JSON.stringify(e.export());
const layers=['systems','colony','world-simulation','village','planner','cartography'];
function isolatedComposition(){
 let composition;
 class Facade {
  constructor(state={},options={}){this.s=composition.prepare(state,options);composition.initialize(this,this.s,options);}
  chain(){return 'base';}
 }
 const sandbox={LW:{Engine:Facade}};require('node:vm').runInNewContext(source('engine-composition.js'),sandbox);
 composition=sandbox.LWEngineComposition;return {composition,Facade,L:sandbox.LW};
}

test('Composition registration rejects malformed metadata before calling authored layer code',()=>{
 const {composition:C,Facade}=isolatedComposition();let calls=0;
 const valid={id:'first',order:10,define:Base=>{calls++;return class extends Base{};}};
 for(const invalid of [null,{...valid,id:'Bad layer'},{...valid,order:1.5},{...valid,define:null},{...valid,prepare:1}])assert.throws(()=>C.register(invalid),/Invalid|requires/);
 assert.equal(calls,0);C.register(valid);assert.throws(()=>C.register(valid),/Duplicate/);
 C.finalize(['first']);assert.equal(calls,1);assert.equal(C.Engine,Facade);
 assert.throws(()=>C.register({...valid,id:'late'}),/finalized/);
});
test('A rejected root order leaves no published layers and can be corrected',()=>{
 const {composition:C,Facade}=isolatedComposition();const calls=[];
 for(const [id,order]of [['first',10],['second',20]])C.register({id,order,define:Base=>{calls.push(id);return class extends Base{};}});
 for(const ids of [['first'],['first','first'],['first','unknown'],['second','first']]){
  assert.throws(()=>C.finalize(ids),/every engine layer|Unknown or duplicate|root order/);
  assert.equal(C.finalized,false);assert.deepEqual(Array.from(C.describe().layers),[]);assert.deepEqual(calls,[]);assert.equal(new Facade().chain(),'base');
 }
 C.finalize(['first','second']);assert.deepEqual(calls,['first','second']);
});
test('Composition preserves predecessor methods and the reverse-prepare forward-initialize lifecycle',()=>{
 const {composition:C,Facade}=isolatedComposition(),calls=[];
 C.register({id:'first',order:10,define:Base=>class extends Base{chain(){return super.chain()+':first';}},prepare:state=>{calls.push('prepare:first');return {...state,first:true};},initialize:instance=>{calls.push('initialize:first');assert.equal(instance.s.second,true);}});
 C.register({id:'second',order:20,define:Base=>class extends Base{chain(){return super.chain()+':second';}},prepare:state=>{calls.push('prepare:second');return {...state,second:true};},initialize:instance=>{calls.push('initialize:second');assert.equal(instance.s.first,true);}});
 assert.strictEqual(C.finalize(['first','second']),Facade);const e=new Facade({seed:7});
 assert.equal(e.chain(),'base:first:second');assert.deepEqual(e.s,{seed:7,second:true,first:true});
 assert.deepEqual(calls,['prepare:second','prepare:first','initialize:first','initialize:second']);
 C.initialize(e,e.s);assert.equal(calls.length,4);assert.equal(Object.getPrototypeOf(Facade.prototype),Object.prototype);
});
test('Historical composition boundaries run only their own state lifecycles',()=>{
 const {composition:C}=isolatedComposition(),calls=[];
 for(const [id,order]of [['first',10],['second',20]])C.register({id,order,define:Base=>class extends Base{},prepare:state=>{calls.push('prepare:'+id);return state;},initialize:()=>calls.push('initialize:'+id)});
 C.finalize(['first','second']);const e=C.constructThrough('first',{seed:1});
 assert.deepEqual(calls,['prepare:first','initialize:first']);assert.deepEqual(Array.from(e.composition.layers),['first']);
 calls.length=0;const base=C.constructThrough('base');assert.deepEqual(calls,[]);assert.deepEqual(Array.from(base.composition.layers),[]);
 assert.throws(()=>C.constructThrough('missing'),/Unknown engine composition boundary/);
});
test('A failed layer definition rolls back predecessor methods before retry',()=>{
 const {composition:C,Facade}=isolatedComposition();let broken=true;
 C.register({id:'first',order:10,define:Base=>class extends Base{chain(){return super.chain()+':first';}}});
 C.register({id:'second',order:20,define:Base=>{if(broken)throw Error('definition failed');return class extends Base{chain(){return super.chain()+':second';}};}});
 assert.throws(()=>C.finalize(['first','second']),/definition failed/);assert.equal(C.finalized,false);assert.equal(new Facade().chain(),'base');assert.deepEqual(Array.from(C.describe().layers),[]);
 broken=false;C.finalize(['first','second']);assert.equal(new Facade().chain(),'base:first:second');
});
test('A failed factory installation rolls back factory replacements and published metadata',()=>{
 const {composition:C,Facade,L:facade}=isolatedComposition(),original=()=> 'original';facade.create=original;let broken=true;
 C.register({id:'first',order:10,define:Base=>class extends Base{chain(){return super.chain()+':first';}},installFactories:({L})=>{L.create=()=> 'replacement';L.partialFactory=()=> 'partial';if(broken)throw Error('factory failed');}});
 assert.throws(()=>C.finalize(['first']),/factory failed/);assert.equal(C.finalized,false);assert.strictEqual(facade.create,original);assert.equal(Object.hasOwn(facade,'partialFactory'),false);assert.equal(Object.hasOwn(Facade,'composition'),false);assert.equal(new Facade().chain(),'base');
 broken=false;C.finalize(['first']);assert.equal(facade.create(),'replacement');assert.equal(new Facade().chain(),'base:first');
});

test('One explicit composition root publishes the complete deterministic layer order',()=>{
 assert.deepEqual(L.Engine.composition.layers,layers);
 assert.deepEqual(L.EngineComposition.describe().layers,layers.map((id,index)=>({id,order:(index+1)*10})));
});

test('Feature modules register layers and never replace LW.Engine',()=>{
 for(const file of ['systems.js','colony.js','world-simulation.js','village-systems.js','planner.js','cartography.js']){
  const text=source(file);
  assert(!/class\s+Engine\s+extends/.test(text),file+' retains an Engine subclass replacement');
  assert(!/L\.Engine\s*=/.test(text),file+' still replaces the facade');
  assert(text.includes('Composition.register('),file+' does not register a layer');
 }
 assert.equal((source('engine-composition-root.js').match(/C\.finalize\(/g)||[]).length,1);
});

test('The public facade identity is stable and every composed instance is an Engine',()=>{
 assert.equal(Object.getPrototypeOf(L.Engine.prototype),Object.prototype);
 const e=new L.Engine();
 assert(e instanceof L.Engine);
 assert.deepEqual(e.composition.layers,layers);
 assert(e.ecs&&e.worldEcs&&Object.hasOwn(e,'economyEcs')&&typeof e.settleEconomy==='function');
});

test('Serialized root state contains plain data and no active-actor accessors',()=>{
 const e=L.createColonyDemo();
 assert.notEqual(e.state,e.s);
 for(const key of L.colony.PERSONAL){
  assert(!Object.hasOwn(e.state,key),key+' leaked onto root state');
  const descriptor=Object.getOwnPropertyDescriptor(e.state,key);
  assert.equal(descriptor,undefined);
 }
 assert.equal(e.s.__root__,e.state);
 assert.equal(global.LWActorStateView.rootOf(e.s),e.state);
});

test('Actor-scoped view follows explicit identity without moving authoritative records',()=>{
 const e=L.createColonyDemo(),first=e.creatures[0],second=e.creatures[1];
 e.selectCreature(first.id);const original=first.name;e.s.name=original+' A';assert.equal(first.name,original+' A');
 e.selectCreature(second.id);const secondOriginal=second.name;assert.equal(e.s.name,secondOriginal);e.s.name=secondOriginal+' B';assert.equal(second.name,secondOriginal+' B');assert.equal(first.name,original+' A');
 assert.equal(e.state.colony.creatures[0],first);assert.equal(e.state.colony.creatures[1],second);
});

test('Passing an actor view into the facade unwraps the same root without corrupting actors',()=>{
 const sourceEngine=L.createColonyDemo(),before=canonical(sourceEngine),ids=sourceEngine.creatures.map(c=>c.id);
 const rebuilt=new L.Engine(sourceEngine.s);
 assert.deepEqual(rebuilt.creatures.map(c=>c.id),ids);
 assert.equal(canonical(sourceEngine),before);
 assert(!Object.hasOwn(rebuilt.state,'name'));
});

test('Explicit partial construction boundaries reproduce historical save stages',()=>{
 const expected=[['systems',3],['colony',5],['world-simulation',6],['village',7],['planner',7],['cartography',8]];
 for(const [id,version] of expected){const e=L.EngineComposition.constructThrough(id);assert.equal(e.export().version,version,id);assert.deepEqual(e.composition.layers,layers.slice(0,layers.indexOf(id)+1));}
});

test('Authored factories return the canonical fully composed facade',()=>{
 for(const factory of ['createWorkshopDemo','createColonyDemo','createWorldDemo']){
  const e=L[factory]();assert(e instanceof L.Engine);assert.equal(e.export().version,8);assert.deepEqual(e.composition.layers,layers);
 }
});

test('Save import and deterministic continuation remain exact through the composed static chain',()=>{
 const a=L.createWorldDemo();a.s.started=true;a.s.paused=false;const initial=a.s.simTime;
 a.advance(20);assert(Math.abs(a.s.simTime-initial-20)<1e-8);const b=L.Engine.import(a.export());
 a.advance(15);b.advance(15);assert(Math.abs(a.s.simTime-initial-35)<1e-8);assert.equal(canonical(a),canonical(b));
 const c=S.commit(S.inspect(S.encode(a)));a.advance(10);c.advance(10);assert(Math.abs(c.s.simTime-initial-45)<1e-8);assert.equal(canonical(a),canonical(c));
});
test('Simulation and default story exports are wall-clock independent',()=>{
 const e=L.createWorldDemo(),first=e.export(),second=e.export();
 assert.deepEqual(first,second);assert(!Object.hasOwn(first,'savedAt'));
 const a=S.encode(e),b=S.encode(e);assert.deepEqual(a,b);assert.equal(a.savedAt,null);
 const stamped=S.encode(e,'2026-10-02T00:00:00.000Z');assert.equal(stamped.savedAt,'2026-10-02T00:00:00.000Z');
 assert.throws(()=>S.encode(e,'not-a-time'),/timestamp/);
});

test('Composed methods remain replaceable for deterministic test and adapter seams',()=>{
 const e=L.createWorldDemo(),original=e.check;
 e.check=()=>({success:true});assert.equal(e.check().success,true);e.check=original;assert.equal(typeof e.check,'function');
});
test('Extracted base task helpers retain nonenumerable, replaceable method descriptors',()=>{
 for(const name of ['materialForecast','planStatus','decisionSummary','resourceTask','needTask','shoppingTask','orderTask','decide','finishTask']){
  const descriptor=Object.getOwnPropertyDescriptor(L.Engine.prototype,name);assert(descriptor,name);assert.equal(typeof descriptor.value,'function',name);
  assert.equal(descriptor.enumerable,false,name);assert.equal(descriptor.writable,true,name);assert.equal(descriptor.configurable,true,name);
 }
});
test('Extracted colony activity calls predecessor methods with the active receiver and arguments',()=>{
 const activity=require('./colony-activity.js'),target={},calls=[];let host;
 const predecessor=Object.fromEntries(['workRate','taskSkill','startTask','decisionSummary'].map(name=>[name,function(...args){
  assert.strictEqual(this,host);calls.push({name,args});
  if(name==='workRate')return 2;if(name==='taskSkill')return 'woodwork';if(name==='startTask'){this.s.task=args[0];return true;}return {source:'Base choice',text:'Rest'};
 }]));
 activity.install(target,predecessor,{definition:()=>undefined,item:()=>undefined,profile:()=>({preferences:{build:3,train:1,social:0}}),arrivalPoint:()=>({x:0,y:0})});
 const trace=[{id:'rest',status:'success'}];host=Object.assign(Object.create(target),{s:{focus:'builder'},actor:{personality:'curious',feelings:{anger:0},activeQuest:null,behavior:{trace}}});
 const build={kind:'build'};assert(Math.abs(host.workRate(build)-2.86)<1e-9);assert.strictEqual(calls.at(-1).args[0],build);
 host.actor.feelings.anger=60;assert(Math.abs(host.workRate(build)-2.431)<1e-9);
 const craft={kind:'craft'};assert.equal(host.taskSkill(craft),'woodwork');assert.strictEqual(calls.at(-1).args[0],craft);
 assert.equal(host.taskSkill({kind:'practice',skillId:'woodwork'}),'woodwork');
 const rest={kind:'rest'};assert.equal(host.startTask(rest),true);assert.strictEqual(host.s.task,rest);assert.strictEqual(calls.at(-1).args[0],rest);
 assert.deepEqual(host.decisionSummary(),{source:'Base choice',text:'Rest',trace});
 const count=calls.length;host.actor.activeQuest={};assert.equal(host.startTask(rest),false);assert.equal(calls.length,count);
});

test('High-level simulation phases are explicit, ordered and presentation-free',()=>{
 const expected=['clock','world','quest-board','actor-daily','actor-quest','actor-simulation'];
 assert.deepEqual(L.SimulationPipeline.schedule.map(x=>x.id),expected);
 assert.deepEqual(L.SimulationPipeline.schedule.map(x=>x.order),[10,20,30,40,50,60]);
 assert(L.SimulationPipeline.schedule.every(x=>!['ui','render','camera'].includes(x.scope)));
});

test('Command manifest is explicit, unique and cannot dispatch arbitrary methods',()=>{
 const ids=L.Engine.commandManifest.map(x=>x.id);assert.equal(new Set(ids).size,ids.length);assert(Object.isFrozen(L.Engine.commandManifest));const probe=new L.Engine();assert(L.Engine.commandManifest.every(x=>typeof probe[x.method]==='function'));
 const e=L.createColonyDemo(),before=canonical(e);assert.equal(e.dispatchCommand({id:'constructor',args:[]}).ok,false);assert.equal(e.dispatchCommand({id:'care',actorId:'c1',args:null}).ok,false);assert.equal(e.dispatchCommand({id:'care',actorId:'c1',args:[()=>{}]}).ok,false);assert.equal(canonical(e),before);
});
test('Command validation rejects accessors, symbols, cycles and sparse arrays without executing them',()=>{
 const e=L.createColonyDemo(),before=canonical(e);let touched=0;
 const accessor={actorId:'c1',args:[]};Object.defineProperty(accessor,'id',{enumerable:true,get(){touched++;return 'care';}});
 assert.equal(e.dispatchCommand(accessor).ok,false);assert.equal(touched,0);
 const nested={};Object.defineProperty(nested,'value',{enumerable:true,get(){touched++;return 1;}});
 assert.equal(e.dispatchCommand({id:'care',actorId:'c1',args:[nested]}).ok,false);assert.equal(touched,0);
 const cyclic={};cyclic.self=cyclic;assert.equal(e.dispatchCommand({id:'care',actorId:'c1',args:[cyclic]}).ok,false);
 const sparse=[];sparse.length=1;assert.equal(e.dispatchCommand({id:'care',actorId:'c1',args:sparse}).ok,false);
 const hiddenIndex=[];Object.defineProperty(hiddenIndex,'0',{value:'x',enumerable:false});hiddenIndex.length=1;
 assert.equal(e.dispatchCommand({id:'care',actorId:'c1',args:hiddenIndex}).ok,false);
 const symbolEnvelope={id:'select-creature',args:['c1']};symbolEnvelope[Symbol('hidden')]=true;
 assert.equal(e.dispatchCommand(symbolEnvelope).ok,false);
 assert.equal(canonical(e),before);
});

test('Actor commands dispatch through an explicit identity and preserve direct-command parity',()=>{
 const seed=L.createColonyDemo().export(),a=L.Engine.import(seed),b=L.Engine.import(seed);
 const direct=a.commandActor('c1',()=>a.setStockTarget('wood',3));
 const routed=b.dispatchCommand({id:'set-stock-target',actorId:'c1',args:['wood',3]});
 assert.deepEqual(routed,direct);assert.equal(canonical(a),canonical(b));
});

test('Composition internals remain transient and absent from exported stories',()=>{
 const e=L.createWorldDemo(),doc=e.export(),json=JSON.stringify(doc);
 for(const key of ['composition','engine-composition','actor-state-view','worldEcs','economyEcs'])assert(!json.includes('"'+key+'"'));
 assert.equal(doc.version,8);assert.equal(doc.state.version,8);
});

const passed=results.filter(r=>r.passed).length;
fs.writeFileSync(__dirname+'/engine-composition-results.json',JSON.stringify({passed,total:results.length,failed:results.length-passed,results},null,2)+'\n');
console.log(`${passed}/${results.length} engine composition checks passed`);if(passed!==results.length)process.exitCode=1;
