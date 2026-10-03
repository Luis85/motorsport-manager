/// <reference path="./renderer-contracts.d.ts" />
/// <reference path="./storytelling-renderer-contracts.d.ts" />
/// <reference path="./animation-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
interface Result {name:string;passed:boolean;error?:string;}
const results:Result[]=[];
function test(name:string,work:()=>void):void {try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
const root=globalThis as unknown as {LWRenderers:LittlewildRenderer.Registry;LWRendererCatalog:LittlewildRenderer.Catalog;LWRendererFrame:{create(engine:unknown,options:unknown):LittlewildRenderer.Frame}};
for(const file of ['developer-data','renderer-catalog','renderer-registry','renderer-frame'])require('./'+file+'.js');
const registry=root.LWRenderers!;
function metadata(id='test'){return JSON.parse(JSON.stringify({id,name:'Test',description:'A test renderer.',capabilities:['hit-test']})) as LittlewildRenderer.Metadata;}
const instance:LittlewildRenderer.Instance={mount(){},resize(){},draw(){},dispose(){}};
test('Registry exposes default metadata and accepts trusted factories separately',()=>{
 assert.equal(registry.list()[0]!.id,'basic');const dispose=registry.register(metadata(),()=>instance);
 assert.equal(registry.list().length,2);assert(Object.isFrozen(registry.list()));assert(Object.isFrozen(registry.list()[1]!.capabilities));
 assert.throws(()=>registry.register(metadata(),()=>instance),/already registered/);dispose();dispose();assert.equal(registry.list().length,1);
});
test('Trusted renderer metadata is published to the pure catalog and withdrawn with its factory',()=>{
 const release=registry.register({...metadata('custom-3d'),dimensions:['3d']},()=>instance),entry=root.LWRendererCatalog.list().find(row=>row.id==='custom-3d');
 assert.deepEqual(entry?.dimensions,['3d']);assert(Object.isFrozen(entry));assert(Object.isFrozen(entry?.dimensions));assert.equal('factory' in entry!,false);assert.equal('create' in root.LWRendererCatalog,false);
 release();assert.equal(root.LWRendererCatalog.list().some(row=>row.id==='custom-3d'),false);
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
test('Dimension metadata is bounded detached data and executes no inherited caller behavior',()=>{
 const valid=registry.validate({...metadata(),dimensions:['2d','3d']});assert(valid.ok);assert.deepEqual(valid.data?.dimensions,['2d','3d']);assert(Object.isFrozen(valid.data?.dimensions));
 for(const dimensions of [[],['4d'],['2d','2d'],['2d','3d','2d']])assert(!registry.validate({...metadata(),dimensions}).ok);
 let reads=0;const dimensions=['2d'];Object.defineProperty(dimensions,'0',{get(){reads++;return '2d';},enumerable:true});assert(!registry.validate({...metadata(),dimensions}).ok);
 const inherited=['2d'];Object.setPrototypeOf(inherited,Object.create(Array.prototype,{[Symbol.iterator]:{value(){reads++;throw Error('No caller iterator');}}}));assert(!registry.validate({...metadata(),dimensions:inherited}).ok);assert.equal(reads,0);
});
let previewApi:LWStorytellingRenderer.Api|null=null;
async function previewContract(basic:boolean):Promise<void>{
 const name=basic?'Paused Basic previews reuse immutable geometry and repaint every visual change':'Registered preview callbacks retain elapsed time, queries and disposal across cached frames';
 const keys=['document','LWStorytellingPreview','LWRendererObserver','LWAnimations','LWStorytellingRenderer'],prior=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 let release=()=>{};
 try{
  require('./content-runtime.js');require('./storytelling-projection.js');
  const base=root.LWRendererFrame.create(engine,options),frames:LittlewildRenderer.Frame[]=[],overlays:LittlewildRenderer.Frame[]=[];
  let sourceFrames=0,disposals=0,rejectPaint=false,context:LittlewildRenderer.Context|null=null,resolve:(value:LittlewildRenderer.Instance)=>void=()=>{};
  const canvas={dataset:{},style:{},width:800,height:600,isConnected:true,remove(){}};
  const container={clientWidth:800,clientHeight:600,querySelector:()=>canvas,prepend(){},append(){}};
  const backend:LittlewildRenderer.Instance={mount(){},resize(viewport){canvas.width=viewport.width;canvas.height=viewport.height;},draw(frame){if(rejectPaint){rejectPaint=false;throw Error('Injected paint failure');}frames.push(frame);},dispose(){disposals++;}};
  const animation:LWAnimations.Layer={ready:Promise.resolve({ok:true}),looping:false,draw(frame){overlays.push(frame);},dispose(){}};
  const status:LWStorytelling.Status={cutsceneId:'clip',sceneId:'scene',state:'paused',time:0,duration:5,completion:0,generation:0};
  const playback:LWStorytelling.Playback={status:()=>({...status}),sample:()=>({cutsceneId:'clip',sceneId:'scene',time:status.time,duration:5,poses:[{target:{category:'creatures',id:'c1'},values:{x:status.time}}],camera:{},animations:[]}),
   play(){status.state='playing';},pause(){status.state='paused';},resume(){status.state='playing';},stop(){status.time=0;status.state='stopped';},replay(){status.time=0;status.generation++;status.state='playing';},seek(time){status.time=time;},skip(){},advance(){},drainEvents:()=>[],dispose(){status.state='disposed';}};
  Object.assign(globalThis,{document:{createElement:()=>({dataset:{},style:{},width:0,height:0,remove(){}})},
   LWStorytellingPreview:{create:()=>({frame(value:{viewport:LittlewildRenderer.Viewport;time:number;delta:number;camera:LittlewildRenderer.Camera}){sourceFrames++;return {...base,...value};},asset:()=>null,definition:()=>null})},
   LWRendererObserver:{create(value:LittlewildRenderer.Context){context=value;return backend;}},LWAnimations:{create:()=>animation}});
  if(!basic)release=registry.registerAsync(metadata('preview-delta-test'),value=>{context=value;return new Promise<LittlewildRenderer.Instance>(accept=>{resolve=accept;});});
  require('./storytelling-renderer.js');
  const api=previewApi??=(globalThis as unknown as {LWStorytellingRenderer:LWStorytellingRenderer.Api}).LWStorytellingRenderer;
  const rendering={dimension:'3d' as const,rendererId:basic?'basic':'preview-delta-test'};
  const pack={scenes:[{id:'scene',graph:{rendering}}]} as unknown as LWContentPorts.ScenarioPack;
  const preview=api.create(container as unknown as HTMLElement,pack,'scene',playback);
  preview.draw(0,.1);assert.equal(frames.length,0,'Preparation must finish before painting');
  rendering.rendererId=basic?'preview-delta-test':'basic';if(!basic)resolve(backend);
  assert.equal((await preview.ready).ok,true);assert.equal(frames.length,1,'Ready must paint the initial bitmap');
  const first=frames[0]!,built=sourceFrames;
  preview.draw(0,.25);preview.draw(0,.5);
  assert.equal(sourceFrames,built,'Paused geometry is immutable and reusable');assert.equal(frames.length,basic?1:3);
  assert.equal(overlays.length,3,'p5 retains every host draw');assert(Object.isFrozen(overlays.at(-1)));assert.equal(overlays.at(-1)!.delta,.5);
  const query=(context as unknown as LittlewildRenderer.Context).query.frame();assert.equal(query.delta,.5);assert(Object.isFrozen(query));assert.equal(query.actors,first.actors);
  if(!basic){assert.equal(frames[1]!.delta,.25);assert.equal(frames[2]!.delta,.5);assert.notEqual(frames[1],frames[2]);}
  let count=frames.length;
  playback.seek(2);preview.draw(2,0);assert.equal(frames.length,++count);assert.equal(frames.at(-1)!.actors[0]!.x,2);assert.equal(first.actors[0]!.x,0);
  playback.seek(0);preview.draw(0,0);assert.equal(frames.length,++count);assert.equal(frames.at(-1)!.actors[0]!.x,0);
  container.clientWidth=900;preview.draw(0,.1);assert.equal(frames.length,++count);assert.equal(frames.at(-1)!.viewport.width,900);
  container.clientHeight=650;preview.draw(0,.1);assert.equal(frames.length,++count);assert.equal(frames.at(-1)!.viewport.height,650);
  playback.stop();preview.draw(0,0);assert.equal(frames.length,++count);
  playback.replay();preview.draw(0,0);assert.equal(frames.length,++count);
  playback.pause();preview.draw(0,0);assert.equal(frames.length,++count);
  if(basic){playback.seek(3);rejectPaint=true;assert.throws(()=>preview.draw(3,0),/Injected paint failure/);assert.equal(frames.length,count);preview.draw(3,0);assert.equal(frames.length,++count,'A failed paint must remain eligible for retry');}
  preview.dispose();preview.dispose();assert.equal(disposals,1);preview.draw(3,.1);assert.equal(frames.length,count);assert.throws(()=>preview.snapshot(),/disposed/);
  // A pending factory must release its eventual instance when the preview closes.
  if(!basic){context=null;const pending=api.create(container as unknown as HTMLElement,{...pack,scenes:[{id:'scene',graph:{rendering:{dimension:'3d',rendererId:'preview-delta-test'}}}]} as unknown as LWContentPorts.ScenarioPack,'scene',playback);pending.dispose();resolve(backend);assert.equal((await pending.ready).ok,false);await Promise.resolve();await Promise.resolve();assert.equal(disposals,2);assert.equal(frames.length,count);}
  results.push({name,passed:true});
 }catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}
 finally{release();for(const key of keys){const descriptor=prior.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
}
async function finish():Promise<void>{
 const name='Asynchronous factories remain separate from synchronous creation without requiring browser globals';
 try{let calls=0;const release=registry.registerAsync(metadata('async-test'),async()=>{calls++;return instance;});assert.throws(()=>registry.create('async-test',{} as LittlewildRenderer.Context),/selectRendererAsync/);assert.equal(calls,0);assert.equal(await registry.prepare('async-test',{} as LittlewildRenderer.Context),instance);assert.equal(calls,1);release();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});}
 await previewContract(true);await previewContract(false);
 const report={passed:results.filter(result=>result.passed).length,total:results.length,results};
 fs.writeFileSync(__dirname+'/renderer-results.json',JSON.stringify(report,null,2)+'\n');console.log(report.passed+'/'+report.total+' renderer checks passed');if(report.passed!==report.total)process.exitCode=1;
}
finish().catch(error=>{console.error(error);process.exitCode=1;});
