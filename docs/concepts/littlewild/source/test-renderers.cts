/// <reference path="./renderer-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
interface Result {name:string;passed:boolean;error?:string;}
const results:Result[]=[];
function test(name:string,work:()=>void):void {try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
const root=globalThis as unknown as {LWRenderers:LittlewildRenderer.Registry;LWRendererFrame:{create(engine:unknown,options:unknown):LittlewildRenderer.Frame}};
for(const file of ['developer-data','renderer-registry','renderer-frame'])require('./'+file+'.js');
const registry=root.LWRenderers!;
function metadata(id='test'){return JSON.parse(JSON.stringify({id,name:'Test',description:'A test renderer.',capabilities:['hit-test']})) as LittlewildRenderer.Metadata;}
const instance:LittlewildRenderer.Instance={mount(){},resize(){},draw(){},dispose(){}};
test('Registry exposes default metadata and accepts trusted factories separately',()=>{
 assert.equal(registry.list()[0]!.id,'basic');const dispose=registry.register(metadata(),()=>instance);
 assert.equal(registry.list().length,2);assert(Object.isFrozen(registry.list()));assert(Object.isFrozen(registry.list()[1]!.capabilities));
 assert.throws(()=>registry.register(metadata(),()=>instance),/already registered/);dispose();dispose();assert.equal(registry.list().length,1);
});
test('Authored JSON cannot install executable renderer code',()=>{
 const data=metadata();assert.equal(registry.validate(data).ok,true);
 assert.equal(registry.validate({...data,factory:'alert(1)'}).ok,false);
 assert.throws(()=>registry.register(metadata(),null as unknown as LittlewildRenderer.Factory),/executable/);
 assert.throws(()=>registry.create('missing',{} as LittlewildRenderer.Context),/Unknown/);
 assert.throws(()=>registry.register(metadata('basic'),()=>instance),/already registered/);
});
test('Renderer metadata rejects accessors without executing them and bounds identifiers',()=>{
 let reads=0;const data=metadata();Object.defineProperty(data,'id',{get(){reads++;return 'unsafe';},enumerable:true});
 assert.equal(registry.validate(data).ok,false);assert.equal(reads,0);
 for(const id of ['Upper','bad id','x'.repeat(65)])assert.equal(registry.validate(metadata(id)).ok,false);
 const caps=['hit-test'];Object.defineProperty(caps,'0',{get(){reads++;return 'hit-test';},enumerable:true});
 assert.equal(registry.validate({...metadata(),capabilities:caps}).ok,false);assert.equal(reads,0);
});
test('Renderer metadata ignores hostile inherited array behavior and counts Unicode characters',()=>{
 let calls=0;const caps=['hit-test'];Object.setPrototypeOf(caps,Object.create(Array.prototype,{[Symbol.iterator]:{value(){calls++;throw Error('Unexpected iterator');}}}));
 assert.equal(registry.validate({...metadata(),capabilities:caps}).ok,false);assert.equal(calls,0);
 assert.equal(registry.validate({...metadata(),name:'🌱'.repeat(80),description:'🌱'.repeat(400)}).ok,true);
 assert.equal(registry.validate({...metadata(),name:'🌱'.repeat(81)}).ok,false);assert.equal(registry.validate({...metadata(),description:'🌱'.repeat(401)}).ok,false);
});
const engine=JSON.parse(JSON.stringify({s:{simTime:1,nodes:[{id:'n1',kind:'wood',x:2,y:3,stock:10}],buildings:[{id:'b1',kind:'house',x:4,y:5,design:{width:2}}],terraform:{revision:0,tiles:{},plants:{}}},creatures:[{id:'c1',name:'Pip',archetype:'pip',creature:{x:7,y:8}}],selected:null})) as {s:{simTime:number;nodes:{stock:number}[];buildings:unknown[]};creatures:{name:string}[];selected:unknown};
const options=JSON.parse(JSON.stringify({time:2,delta:.02,running:false,alpha:1,camera:{x:0,y:0,z:1},viewport:{width:800,height:600,pixelRatio:1},presentation:{placement:null}})) as object;
test('Scene frames are detached and recursively frozen with no engine authority',()=>{
 const before=JSON.stringify(engine),frame=root.LWRendererFrame!.create(engine,options);
 assert.equal(frame.actors[0]!.name,'Pip');assert.equal(frame.nodes[0]!.details.stock,10);
 assert(Object.isFrozen(frame));assert(Object.isFrozen(frame.actors[0]));assert(Object.isFrozen(frame.buildings[0]!.details));
 assert.throws(()=>{(frame.actors[0] as {name:string}).name='Changed';},TypeError);
 assert.equal(JSON.stringify(engine),before);assert.equal('engine' in frame,false);assert.equal('step' in frame,false);
 engine.creatures[0]!.name='Later';engine.s.nodes[0]!.stock=3;
 assert.equal(frame.actors[0]!.name,'Pip');assert.equal(frame.nodes[0]!.details.stock,10);
});
test('Scene observation rejects excessive collections without mutation',()=>{
 const large=JSON.parse(JSON.stringify(engine)) as {s:{nodes:unknown[]}};large.s.nodes=Array.from({length:4097},()=>({id:'n1',kind:'wood',x:0,y:0}));
 const before=JSON.stringify(large);assert.throws(()=>root.LWRendererFrame!.create(large,options),/4096/);assert.equal(JSON.stringify(large),before);
});
test('Valid connected island query fixtures project all 11 and 49 islands within the bounded frame',()=>{
 for(const count of [11,49]){
  const world={...engine,s:{...engine.s,estate:{islands:Array.from({length:count},(_,ix)=>({ix,iy:0}))}}},before=JSON.stringify(world);
  const frame=root.LWRendererFrame.create(world,options);assert.equal(frame.tiles.length,count*361);assert.equal(frame.tiles[frame.tiles.length-1]!.x,(count-1)*23+18);assert(Object.isFrozen(frame.tiles[frame.tiles.length-1]));assert.equal(JSON.stringify(world),before);
 }
 const world={...engine,s:{...engine.s,estate:{islands:Array.from({length:50},(_,ix)=>({ix,iy:0}))}}};assert.throws(()=>root.LWRendererFrame.create(world,options),/admitted 49/);
});
test('Custom frames retain venue-bound quest actors and hide remote quest actors using the shared stage policy',()=>{
 require('./workflow-venues.js');require('./scene-environment.js');
 const state={...engine.s,scenarioWorkflow:{roles:[{id:'sales',label:'Sales',actorId:'c1'}],deals:[{questId:'call',salesRole:'sales',venueBuildingId:'desk'}]}};
 const onsite={id:'c1',name:'Phil',archetype:'pip',activeQuest:{questId:'call'},creature:{x:7,y:8}},remote={...onsite,id:'c2',name:'Remote'};
 const world={s:state,creatures:[onsite,remote],selected:null},before=JSON.stringify(world);
 const frame=root.LWRendererFrame.create(world,options);assert.deepEqual(frame.actors.map(actor=>actor.away),[false,true]);assert.equal(JSON.stringify(world),before);
 state.scenarioWorkflow.deals[0]!.venueBuildingId='';assert.deepEqual(root.LWRendererFrame.create(world,options).actors.map(actor=>actor.away),[true,true]);
});
const report={passed:results.filter(result=>result.passed).length,total:results.length,results};
fs.writeFileSync(__dirname+'/renderer-results.json',JSON.stringify(report,null,2)+'\n');console.log(report.passed+'/'+report.total+' renderer checks passed');if(report.passed!==report.total)process.exitCode=1;
