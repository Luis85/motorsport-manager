'use strict';
/* M5 contracts for explicit engine composition and actor-scoped state views. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const L=require('./simulation.cjs'),S=require('./story-codec.js');
const results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.message);}}
const source=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const canonical=e=>JSON.stringify(e.export());
const layers=['systems','colony','world-simulation','village','planner','cartography'];

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
 const a=L.createWorldDemo();a.s.paused=false;a.advance(20);const b=L.Engine.import(a.export());
 a.advance(15);b.advance(15);assert.equal(canonical(a),canonical(b));
 const c=S.commit(S.inspect(S.encode(a)));a.advance(10);c.advance(10);assert.equal(canonical(a),canonical(c));
});

test('Composed methods remain replaceable for deterministic test and adapter seams',()=>{
 const e=L.createWorldDemo(),original=e.check;
 e.check=()=>({success:true});assert.equal(e.check().success,true);e.check=original;assert.equal(typeof e.check,'function');
});

test('High-level simulation phases are explicit, ordered and presentation-free',()=>{
 const expected=['clock','world','quest-board','actor-daily','actor-quest','actor-simulation'];
 assert.deepEqual(L.SimulationPipeline.schedule.map(x=>x.id),expected);
 assert.deepEqual(L.SimulationPipeline.schedule.map(x=>x.order),[10,20,30,40,50,60]);
 assert(L.SimulationPipeline.schedule.every(x=>!['ui','render','camera'].includes(x.scope)));
});

test('Command manifest is explicit, unique and cannot dispatch arbitrary methods',()=>{
 const ids=L.Engine.commandManifest.map(x=>x.id);assert.equal(new Set(ids).size,ids.length);assert(Object.isFrozen(L.Engine.commandManifest));const probe=new L.Engine();assert(L.Engine.commandManifest.every(x=>typeof probe[x.method]==='function'));
 const e=L.createColonyDemo(),before=canonical(e);assert.equal(e.dispatchCommand({id:'constructor',args:[]}).ok,false);assert.equal(e.dispatchCommand({id:'care',actorId:'c1',args:[()=>{}]}).ok,false);assert.equal(canonical(e),before);
});
test('Command validation rejects accessors, symbols, cycles and sparse arrays without executing them',()=>{
 const e=L.createColonyDemo(),before=canonical(e);let touched=0;
 const accessor={actorId:'c1',args:[]};Object.defineProperty(accessor,'id',{enumerable:true,get(){touched++;return 'care';}});
 assert.equal(e.dispatchCommand(accessor).ok,false);assert.equal(touched,0);
 const nested={};Object.defineProperty(nested,'value',{enumerable:true,get(){touched++;return 1;}});
 assert.equal(e.dispatchCommand({id:'care',actorId:'c1',args:[nested]}).ok,false);assert.equal(touched,0);
 const cyclic={};cyclic.self=cyclic;assert.equal(e.dispatchCommand({id:'care',actorId:'c1',args:[cyclic]}).ok,false);
 const sparse=[];sparse.length=1;assert.equal(e.dispatchCommand({id:'care',actorId:'c1',args:sparse}).ok,false);
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
