/// <reference path="./renderer-contracts.d.ts" />
/// <reference path="./storytelling-renderer-contracts.d.ts" />
/// <reference path="./animation-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getEventListeners} from 'node:events';
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
 const generation=registry.generation('test');assert.equal(registry.generation('basic'),0);assert.equal(typeof generation,'number');
 assert.equal(registry.list().length,2);assert(Object.isFrozen(registry.list()));assert(Object.isFrozen(registry.list()[1]!.capabilities));
 assert.throws(()=>registry.register(metadata(),()=>instance),/already registered/);dispose();dispose();assert.equal(registry.list().length,1);assert.equal(registry.generation('test'),null);
 const replacement=registry.register(metadata(),()=>instance);assert.notEqual(registry.generation('test'),generation);replacement();
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
async function previewContract(basic:boolean,projectionOnly=false):Promise<void>{
 const name=basic?'Paused Basic previews reuse immutable geometry and repaint every visual change':projectionOnly?'Registered projection-only instances reuse paused paints while retaining query, overlay and invalidation cadence':'Registered preview callbacks retain elapsed time, queries and disposal across cached frames';
 const cached=basic||projectionOnly,nativeBefore=JSON.stringify(engine);
 const keys=['document','LWStorytellingPreview','LWRendererObserver','LWAnimations','LWStorytellingRenderer'],prior=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 let release=()=>{};
 try{
  require('./content-runtime.js');require('./storytelling-projection.js');
  const base=root.LWRendererFrame.create(engine,options),frames:LittlewildRenderer.Frame[]=[],overlays:LittlewildRenderer.Frame[]=[],overlayPhases:number[]=[];
  let sourceFrames=0,disposals=0,rejectPaint=false,deferResize=false,context:LittlewildRenderer.Context|null=null,resolve:(value:LittlewildRenderer.Instance)=>void=()=>{};
  const canvas=Object.assign(new EventTarget(),{dataset:{},style:{},width:800,height:600,isConnected:true,remove(){}});
  const container={clientWidth:800,clientHeight:600,querySelector:()=>canvas,prepend(){},append(){}};
  const backend:LittlewildRenderer.Instance={...(cached?{redrawPolicy:'projection' as const}:{}),mount(){},resize(viewport){if(!deferResize){canvas.width=viewport.width;canvas.height=viewport.height;}},draw(frame){if(rejectPaint){rejectPaint=false;throw Error('Injected paint failure');}frames.push(frame);},dispose(){disposals++;}};
  const animation:LWAnimations.Layer={ready:Promise.resolve({ok:true}),looping:false,draw(frame,descriptors,phase){overlays.push(frame);if(descriptors.length)overlayPhases.push(phase);},dispose(){}};
  const status:LWStorytelling.Status={cutsceneId:'clip',sceneId:'scene',state:'paused',time:0,duration:5,completion:0,generation:0};
  const playback:LWStorytelling.Playback={status:()=>({...status}),sample:()=>({cutsceneId:'clip',sceneId:'scene',time:status.time,duration:5,poses:[{target:{category:'creatures',id:'c1'},values:{x:status.time}}],camera:{},animations:projectionOnly?[{id:'effect',presetId:'orbit',start:0,duration:5,x:9,y:9,radius:45,color:'#77aaff',count:8}]:[]}),
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
  assert.equal(sourceFrames,built,'Paused geometry is immutable and reusable');assert.equal(frames.length,cached?1:3);
  assert.equal(overlays.length,3,'p5 retains every host draw');assert(Object.isFrozen(overlays.at(-1)));assert.equal(overlays.at(-1)!.delta,.5);
  if(projectionOnly)assert.deepEqual(overlayPhases,[0,0,0],'Nonempty p5 overlays retain every paused host draw independently of geometry reuse');
  const query=(context as unknown as LittlewildRenderer.Context).query.frame();assert.equal(query.delta,.5);assert(Object.isFrozen(query));assert.equal(query.actors,first.actors);
  if(!cached){assert.equal(frames[1]!.delta,.25);assert.equal(frames[2]!.delta,.5);assert.notEqual(frames[1],frames[2]);}
  let count=frames.length;
  playback.seek(2);preview.draw(2,0);assert.equal(frames.length,++count);assert.equal(frames.at(-1)!.actors[0]!.x,2);assert.equal(first.actors[0]!.x,0);
  playback.seek(0);preview.draw(0,0);assert.equal(frames.length,++count);assert.equal(frames.at(-1)!.actors[0]!.x,0);
  container.clientWidth=900;preview.draw(0,.1);assert.equal(frames.length,++count);assert.equal(frames.at(-1)!.viewport.width,900);
  container.clientHeight=650;preview.draw(0,.1);assert.equal(frames.length,++count);assert.equal(frames.at(-1)!.viewport.height,650);
  playback.stop();preview.draw(0,0);assert.equal(frames.length,++count);
  playback.replay();preview.draw(0,0);assert.equal(frames.length,++count);
  playback.pause();preview.draw(0,0);assert.equal(frames.length,++count);
  if(cached){playback.seek(3);rejectPaint=true;assert.throws(()=>preview.draw(3,0),/Injected paint failure/);assert.equal(frames.length,count);preview.draw(3,0);assert.equal(frames.length,++count,'A failed paint must remain eligible for retry');}
  if(projectionOnly){
   status.generation++;preview.draw(3,.1);assert.equal(frames.length,++count,'Generation invalidates a paused projection even when time and state match');
   deferResize=true;container.clientWidth=901;preview.draw(3,.1);assert.equal(frames.length,++count,'Resize invalidates paint even when the backend has not updated canvas dimensions');
   deferResize=false;preview.draw(3,.1);assert.equal(frames.length,++count);assert.equal(frames.at(-1)!.viewport.width,901);
   preview.draw(3,.1);assert.equal(frames.length,count,'The resized bitmap becomes reusable after its successful paint');
   for(const type of ['webglcontextrestored','contextrestored']){
    assert.equal(getEventListeners(canvas,type).length,1);const built=sourceFrames,event=new Event(type,{cancelable:true});canvas.dispatchEvent(event);
    assert.equal(event.defaultPrevented,false,'The preview does not claim backend resource recovery');assert.equal(frames.length,count,'Restoration waits for the application-owned draw');
    preview.draw(3,.1);assert.equal(frames.length,++count,'Each delivered restoration repaints exactly once');
    preview.draw(3,.1);assert.equal(frames.length,count);assert.equal(sourceFrames,built,'Restoration retains immutable projection geometry');
   }
  }
  preview.dispose();preview.dispose();assert.equal(disposals,1);preview.draw(3,.1);assert.equal(frames.length,count);assert.throws(()=>preview.snapshot(),/disposed/);
  for(const type of ['webglcontextrestored','contextrestored']){assert.equal(getEventListeners(canvas,type).length,0);canvas.dispatchEvent(new Event(type));}
  // A pending factory must release its eventual instance when the preview closes.
  let expectedDisposals=1;
  if(projectionOnly){
   const replacement=api.create(container as unknown as HTMLElement,{...pack,scenes:[{id:'scene',graph:{rendering:{dimension:'2d',rendererId:'preview-delta-test'}}}]} as unknown as LWContentPorts.ScenarioPack,'scene',playback);resolve(backend);assert.equal((await replacement.ready).ok,true);assert.equal(frames.length,++count,'A replacement dimension must paint its own initial bitmap');replacement.dispose();assert.equal(disposals,++expectedDisposals);
  }
  if(!basic){context=null;const pending=api.create(container as unknown as HTMLElement,{...pack,scenes:[{id:'scene',graph:{rendering:{dimension:'3d',rendererId:'preview-delta-test'}}}]} as unknown as LWContentPorts.ScenarioPack,'scene',playback);pending.dispose();resolve(backend);assert.equal((await pending.ready).ok,false);await Promise.resolve();await Promise.resolve();assert.equal(disposals,++expectedDisposals);assert.equal(frames.length,count);}
  assert.equal(JSON.stringify(engine),nativeBefore);
  results.push({name,passed:true});
 }catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}
 finally{release();for(const key of keys){const descriptor=prior.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
}
async function retargetContract():Promise<void>{
 const name='Validated timeline retargets reuse opted instances atomically while native changes and factory replacement rebuild';
 const keys=['document','LWStorytellingPreview','LWRendererObserver','LWAnimations','LWStorytellingRenderer','LWScenarios','LWStorytelling','LWStorytellingEditorPreview'],prior=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)])),nativeBefore=JSON.stringify(engine);
 let release=()=>{};
 try{
  for(const mode of ['basic','registered','custom'] as const){
   let validations=0,created=0,sourceCreates=0,backendCreates=0,backendDisposals=0,animationCreates=0,animationDisposals=0,rejectPlayback=false;
   const owned:{status:LWStorytelling.Status;disposed:number}[]=[],frames:LittlewildRenderer.Frame[]=[],phases:number[]=[],base=root.LWRendererFrame.create(engine,options);
   const canvas=Object.assign(new EventTarget(),{dataset:{},style:{},width:800,height:600,isConnected:true,remove(){}}),container={clientWidth:800,clientHeight:600,querySelector:()=>canvas,prepend(){},append(){}};
   const rendererId=mode==='basic'?'basic':'timeline-retarget';
   const pack={name:'Native presentation',worlds:[{id:'world',terrain:['...']}],resources:{assets:[{id:'asset'}]},scenes:[{id:'scene',initialState:{nodes:[{id:'node',x:2}]},graph:{rendering:{dimension:'3d',rendererId}}}],storytelling:{version:1,storyboards:[],cutscenes:[{id:'clip',sceneId:'scene',name:'Before',duration:5,tracks:[]}]}} as unknown as LWContentPorts.ScenarioPack;
   const makePlayback=(input:LWContentPorts.ScenarioPack,id:string):LWStorytelling.Playback=>{
    created++;if(rejectPlayback)throw Error('Injected timeline admission failure');const clip=input.storytelling!.cutscenes.find(value=>value.id===id)!,record={status:{cutsceneId:id,sceneId:clip.sceneId,state:'ready' as LWStorytelling.State,time:0,duration:5,completion:0,generation:0},disposed:0};owned.push(record);
    const offset=clip.name==='After'?4:0;
    return{status:()=>({...record.status}),sample:()=>({cutsceneId:id,sceneId:clip.sceneId,time:record.status.time,duration:5,poses:[{target:{category:'creatures',id:'c1'},values:{x:offset+record.status.time}}],camera:{},animations:[]}),play(){record.status.state='playing';},pause(){record.status.state='paused';},resume(){record.status.state='playing';},stop(){record.status.time=0;record.status.state='stopped';},replay(){record.status.generation++;record.status.state='playing';},seek(time){record.status.time=time;},skip(){},advance(){},drainEvents:()=>[],dispose(){record.disposed++;record.status.state='disposed';}};
   };
   const factory=():LittlewildRenderer.Instance=>{backendCreates++;return{redrawPolicy:'projection',...(mode==='custom'?{}:{previewReuse:'timeline' as const}),mount(){},resize(){},draw(frame){frames.push(frame);},dispose(){backendDisposals++;}};};
   Object.assign(globalThis,{document:{createElement:()=>({dataset:{},style:{},width:0,height:0,remove(){}})},LWStorytellingRenderer:previewApi,
    LWStorytellingPreview:{create(){sourceCreates++;return{frame(value:{viewport:LittlewildRenderer.Viewport;time:number;delta:number;camera:LittlewildRenderer.Camera}){return{...base,...value};},asset:()=>null,definition:()=>null};}},LWRendererObserver:{create:factory},
    LWAnimations:{create(){animationCreates++;return{ready:Promise.resolve({ok:true}),looping:false,draw(_frame:LittlewildRenderer.Frame,_descriptors:readonly LWAnimations.Descriptor[],time:number){phases.push(time);},dispose(){animationDisposals++;}};}},
    LWScenarios:{validate(input:LWContentPorts.ScenarioPack){validations++;if(input.name==='Invalid')return{ok:false,errors:['Injected full pack rejection']};return{ok:true,pack:structuredClone(input)};}},LWStorytelling:{create:makePlayback}});
   if(mode!=='basic')release=registry.register(metadata(rendererId),factory);
   require('./storytelling-editor-preview.js');const api=(globalThis as unknown as {LWStorytellingEditorPreview:{create(canvas:HTMLCanvasElement,pack:LWContentPorts.ScenarioPack,id:string):LWStorytellingUI.Preview}}).LWStorytellingEditorPreview;
   const mounted=Object.assign(canvas,{parentElement:container}),preview=api.create(mounted as unknown as HTMLCanvasElement,pack,'clip'),ready=preview.ready;
   const next=structuredClone(pack);next.storytelling!.cutscenes[0]!.name='After';
   assert.equal(preview.update!(next,'clip'),false,'Pending instances cannot be retargeted');assert.equal(owned[1]!.disposed,1);assert.equal(owned[0]!.disposed,0);
   assert.equal((await ready).ok,true);assert.equal(frames.length,1);preview.seek(2);preview.draw(0);const oldFrame=frames.at(-1)!;assert.equal(oldFrame.actors[0]!.x,2);
   const beforePaints=frames.length;
   assert.throws(()=>preview.update!({...pack,name:'Invalid'},'clip'),/full pack rejection/);assert.equal(preview.status().time,2);assert.equal(frames.length,beforePaints);
   rejectPlayback=true;assert.throws(()=>preview.update!(next,'clip'),/timeline admission failure/);rejectPlayback=false;assert.equal(preview.status().time,2);assert.equal(owned[0]!.disposed,0);
   for(const change of ['native','resources','world','rendering','scene','clip'] as const){
    const changed=structuredClone(next);
    if(change==='native')changed.scenes[0]!.initialState.nodes=[{id:'other',x:3}];
    if(change==='resources')changed.resources!.assets=[{id:'other'}];
    if(change==='world')changed.worlds[0]!.name='Changed world';
    if(change==='rendering')changed.scenes[0]!.graph!.rendering!.dimension='2d';
    if(change==='scene')changed.storytelling!.cutscenes[0]!.sceneId='other';
    assert.equal(preview.update!(changed,change==='clip'?'other':'clip'),false,change+' must retain the prior preview until normal rebuilding');assert.equal(preview.status().time,2);
   }
   const updates=preview.update!(next,'clip');assert.equal(updates,mode!=='custom');assert.equal(preview.ready,ready);assert.equal(backendCreates,1);assert.equal(animationCreates,1);assert.equal(sourceCreates,1);assert.equal(backendDisposals,0);assert.equal(animationDisposals,0);
   if(updates){assert.equal(preview.status().time,0);assert.equal(preview.status().state,'ready');assert.equal(owned[0]!.disposed,1);assert.equal(frames.length,beforePaints,'Admission does not create an extra paint or clock');preview.draw(0);assert.equal(frames.length,beforePaints+1);assert.equal(frames.at(-1)!.actors[0]!.x,4);assert.equal(oldFrame.actors[0]!.x,2);preview.draw(.1);assert.equal(frames.length,beforePaints+1);assert.equal(phases.at(-1),0);}
   else{assert.equal(owned[0]!.disposed,0);assert.equal(owned.at(-1)!.disposed,1);assert.equal(preview.status().time,2);}
   if(mode==='basic')(globalThis as unknown as {LWRendererObserver:{create:()=>LittlewildRenderer.Instance}}).LWRendererObserver.create=()=>factory();
   else{release();release=registry.register(metadata(rendererId),factory);}
   assert.equal(preview.update!(next,'clip'),false,'Identical renderer metadata cannot conceal a replacement executable factory');assert.equal(owned.at(-1)!.disposed,1);assert.equal(backendCreates,1);
   assert(validations>=12,'Every update preserves full pack admission');assert(created>=5,'Successful and eligible timeline updates retain application validation');preview.dispose();preview.dispose();assert.equal(backendDisposals,1);assert.equal(animationDisposals,1);assert.equal(owned.filter(value=>value.disposed!==1).length,0);assert.equal(JSON.stringify(engine),nativeBefore);release();release=()=>{};
  }
  results.push({name,passed:true});
 }catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}
 finally{release();for(const key of keys){const descriptor=prior.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
}
async function retirementContract():Promise<void>{
 const name='Explicit preview retirement stops ownership immediately and releases every captured resource once, including errors and late preparation';
 const keys=['document','LWStorytellingPreview','LWRendererObserver','LWAnimations','LWStorytellingRenderer','LWScenarios','LWStorytelling','LWStorytellingEditorPreview','p5','LWAnimationCatalogRecords','LWAnimationCatalog'];
 const prior=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)])),nativeBefore=JSON.stringify(engine);let unregister=()=>{};
 try{
  delete require.cache[require.resolve('./storytelling-editor-preview.js')];require('./storytelling-editor-preview.js');
  const base=root.LWRendererFrame.create(engine,options);
  for(const mode of ['opted','errors','custom','pending','candidate','drain','wrapped'] as const){
   const counts={draw:0,mount:0,dispose:0,lifecycle:0,resource:0,extra:0,animation:0,quiesce:0,pb:0,wrapper:0};
   const canvas=Object.assign(new EventTarget(),{dataset:{},style:{},width:800,height:600,isConnected:true,parentElement:null as unknown,remove(){this.isConnected=false;}});
   const overlay={dataset:{},style:{},width:0,height:0,isConnected:true,remove(){this.isConnected=false;}};
   const container={clientWidth:800,clientHeight:600,querySelector:()=>canvas,prepend(){},append(){}};canvas.parentElement=container;
   let context:LittlewildRenderer.Context|null=null,resolveFactory:(value:LittlewildRenderer.Instance)=>void=()=>{},resolveAnimation:(value:LittlewildRenderer.SwitchResult)=>void=()=>{},finishResource:()=>void=()=>{};
   const resourceDone=new Promise<void>(resolve=>{finishResource=resolve;});
   const backend:LittlewildRenderer.Instance={...(mode==='custom'?{}:{retirementPolicy:'deferred' as const}),quiesce(){counts.quiesce++;},mount(){counts.mount++;},resize(){},draw(){counts.draw++;},dispose(){counts.dispose++;if(mode==='errors'||mode==='custom')throw Error('Backend disposal failed');}};
   const factory=(value:LittlewildRenderer.Context)=>{context=value;value.onDispose(()=>{counts.lifecycle++;if(mode==='errors')throw Error('Lifecycle failed');});value.onRelease!(()=>{counts.resource++;return resourceDone;});value.onRelease!(()=>{counts.extra++;if(mode==='errors')throw Error('Resource failed');});return mode==='pending'||mode==='candidate'?new Promise<LittlewildRenderer.Instance>(resolve=>{resolveFactory=resolve;}):Promise.resolve(backend);};
   let animationFinal:Promise<void>|null=null;
   const layer:LWAnimations.Layer={ready:mode==='candidate'?new Promise(resolve=>{resolveAnimation=resolve;}):Promise.resolve({ok:true}),looping:false,draw(){},dispose(){counts.animation++;},retire(){overlay.remove();return()=>animationFinal??=(async()=>{counts.animation++;if(mode==='errors')throw Error('p5 removal failed');})();}};
   const status:LWStorytelling.Status={cutsceneId:'clip',sceneId:'scene',state:'ready',time:0,duration:5,completion:0,generation:0};
   const playback:LWStorytelling.Playback={status:()=>({...status}),sample:()=>({cutsceneId:'clip',sceneId:'scene',time:0,duration:5,poses:[],camera:{},animations:[]}),play(){},pause(){},resume(){},stop(){},replay(){},seek(){},skip(){},advance(){},drainEvents:()=>[],dispose(){counts.pb++;status.state='disposed';if(mode==='errors')throw Error('Playback disposal failed');}};
   Object.assign(globalThis,{document:{createElement:()=>overlay},LWStorytellingRenderer:previewApi,LWStorytellingPreview:{create:()=>({frame:()=>base,asset:()=>null,definition:()=>null})},LWRendererObserver:{create:()=>backend},LWAnimations:{create:()=>layer},LWScenarios:{validate:(pack:LWContentPorts.ScenarioPack)=>({ok:true,pack})},LWStorytelling:{create:()=>playback}});
   unregister=registry.registerAsync(metadata('retirement-test'),factory);
   const pack={scenes:[{id:'scene',graph:{rendering:{dimension:'2d',rendererId:'retirement-test'}}}],storytelling:{cutscenes:[{id:'clip',sceneId:'scene'}]}} as unknown as LWContentPorts.ScenarioPack;
   const renderer=previewApi!.create(container as unknown as HTMLElement,pack,'scene',playback);
   // Compose against this exact scoped renderer so PB ownership is tested too.
   (globalThis as unknown as {LWStorytellingRenderer:LWStorytellingRenderer.Api}).LWStorytellingRenderer={create:()=>renderer};
   const composition=(globalThis as unknown as {LWStorytellingEditorPreview:{create(canvas:HTMLCanvasElement,pack:LWContentPorts.ScenarioPack,id:string):LWStorytellingUI.Preview}}).LWStorytellingEditorPreview.create(canvas as unknown as HTMLCanvasElement,pack,'clip');
   if(mode==='pending'){
    assert.equal(composition.retire!(),undefined);assert.equal(canvas.isConnected,true);assert.equal(counts.pb,0,'Unresolved factories cannot imply future retirement permission');
    composition.dispose();resolveFactory(backend);finishResource();assert.equal((await composition.ready).ok,false);await Promise.resolve();await Promise.resolve();assert.equal(counts.dispose,1);assert.equal(counts.mount,0);assert.equal(counts.pb,1);
   }else if(mode==='custom'||mode==='wrapped'){
    assert((await composition.ready).ok);
    if(mode==='wrapped'){const originalDispose=renderer.dispose;renderer.dispose=function(){counts.wrapper++;return Reflect.apply(originalDispose,this,[]);};}
    assert.equal(composition.retire!(),undefined);assert.equal(canvas.isConnected,true);assert.equal(counts.lifecycle,0);assert.equal(counts.animation,0,'Undefined retirement leaves p5 ownership unchanged');assert.equal((await composition.ready).ok,true);
    if(mode==='custom')assert.throws(()=>composition.dispose(),/disposal/);else{composition.dispose();assert.equal(counts.wrapper,1,'An in-place renderer lifecycle wrapper keeps synchronous disposal');}finishResource();assert.equal(counts.pb,1,'Synchronous backend errors cannot skip playback disposal');assert.equal(counts.resource,1);assert.equal(counts.extra,1);
   }else{
    if(mode==='candidate'){resolveFactory(backend);for(let turn=0;turn<8;turn++)await Promise.resolve();assert.equal(counts.mount,0);}
    else assert((await composition.ready).ok);
    const originalDispose=renderer.dispose;renderer.dispose=function(){counts.wrapper++;return Reflect.apply(originalDispose,this,[]);};
    assert.equal(composition.retire!(),undefined,'A changed scoped renderer disposal hook cannot implicitly inherit retirement');assert.equal(counts.lifecycle,0);assert.equal(counts.pb,0);assert.equal(canvas.isConnected,true);renderer.dispose=originalDispose;
    const copiedRenderer={...renderer,dispose(){counts.wrapper++;renderer.dispose();}};assert.equal(copiedRenderer.retire!(),undefined,'Copied scoped retirement cannot bypass a new lifecycle owner');
    const copied={...composition,dispose(){counts.wrapper++;composition.dispose();}};assert.equal(copied.retire!(),undefined,'Copied composition retirement has no effects');assert.equal(counts.wrapper,0);assert.equal(counts.pb,0);assert.equal(overlay.isConnected,true);
    const explicit={...composition,retire(){return composition.retire!();},dispose(){counts.wrapper++;composition.dispose();}};
    const draws=counts.draw,finalize=explicit.retire();assert(finalize,mode+' explicit delegation must capture the original eligible owner');assert.equal(canvas.isConnected,false);assert.equal(overlay.isConnected,false);assert.equal(counts.pb,1);
    assert((context as unknown as LittlewildRenderer.Context).signal.aborted);assert.equal(counts.lifecycle,1);assert.equal(counts.resource,0);assert.equal(counts.dispose,0);
    assert.throws(()=>renderer.snapshot(),/disposed/);assert.equal(renderer.updatePlayback(playback),false);renderer.draw(0,0);assert.equal(counts.draw,draws);assert.throws(()=>composition.play(),/closed/);
    assert.equal(composition.retire!(),undefined);if(mode==='drain')composition.dispose();const completion=finalize();assert.equal(finalize(),completion);let completed=false;void completion.then(()=>{completed=true;},()=>{completed=true;});
    await Promise.resolve();assert.equal(counts.dispose,1);assert.equal(counts.resource,1);assert.equal(counts.extra,1);assert.equal(completed,false,'The release Promise retains asynchronous resource ownership');
    finishResource();if(mode==='errors')await assert.rejects(completion,error=>{
     const messages=(error:unknown):string[]=>error instanceof AggregateError?error.errors.flatMap(messages):[String(error)];
     const collected=messages(error);for(const expected of ['Backend disposal','Lifecycle','Resource','p5 removal','Playback disposal'])assert(collected.some(value=>value.includes(expected)),expected+' must remain observable after all releases');return true;
    });else await completion;
    if(mode==='candidate'){resolveAnimation({ok:true});assert.equal((await composition.ready).ok,false);await Promise.resolve();assert.equal(counts.mount,0);assert.equal(counts.dispose,1,'Late readiness cannot republish or double-release a retired actual candidate');}
    assert.equal(counts.animation,1);assert.equal(finalize(),completion);assert.equal(counts.dispose,1);assert.equal(counts.pb,1);
    if(mode!=='errors'){composition.dispose();await Promise.resolve();assert.equal(counts.dispose,1);}
   }
   assert.equal(getEventListeners(canvas,'contextrestored').length,0);assert.equal(JSON.stringify(engine),nativeBefore);unregister();unregister=()=>{};
  }
  // Exercise real layer cancellation while p5 is awaiting its own presetup.
  require('./animation-catalog.js');require('./renderer-animations.js');const animations=(globalThis as unknown as {LWAnimations:LWAnimations.Api}).LWAnimations;
  let pendingSketch:Sketch|null=null,removeCalls=0,adoptions=0,reported=0;const savedError=console.error;
  class Sketch {
   setup=()=>{};draw=()=>{};constructor(configure:(value:Sketch)=>void){configure(this);pendingSketch=this;}
   noLoop(){}isLooping(){return false;}pixelDensity(){}push(){}pop(){}clear(){}resizeCanvas(){}createCanvas(){adoptions++;}redraw(){return Promise.resolve();}
   remove():Promise<void>{removeCalls++;return Promise.reject(Error('Injected pending p5 removal rejection'));}
  }
  Object.assign(globalThis,{p5:Sketch});console.error=()=>{reported++;};
  try{const canvas={width:800,height:400,parentElement:{},remove(){}};const layer=animations.create(canvas as unknown as HTMLCanvasElement);assert.equal(layer.retire!(),undefined);layer.dispose();layer.dispose();assert.equal(removeCalls,0);(pendingSketch as unknown as Sketch).setup();(pendingSketch as unknown as Sketch).draw();assert.equal((await layer.ready).ok,false);await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();assert.equal(removeCalls,1);assert.equal(adoptions,0,'Late setup never reattaches the supplied canvas');assert.equal(reported,1,'Removal rejection is consumed and reported once');}
  finally{console.error=savedError;}
  let completeRemoval:()=>void=()=>{},readyRemovals=0;class ReadySketch extends Sketch {override remove(){readyRemovals++;return new Promise<void>(resolve=>{completeRemoval=resolve;});}}
  Object.assign(globalThis,{p5:ReadySketch});const retainedCanvas={width:800,height:400,parentElement:{},connected:true,remove(){this.connected=false;}};
  const retained=animations.create(retainedCanvas as unknown as HTMLCanvasElement);(pendingSketch as unknown as Sketch).setup();(pendingSketch as unknown as Sketch).draw();assert((await retained.ready).ok);
  const releaseLayer=retained.retire!();assert(releaseLayer);assert.equal(retainedCanvas.connected,false);assert.equal(readyRemovals,0);(pendingSketch as unknown as Sketch).draw();assert.equal(readyRemovals,0);
  const layerCompletion=releaseLayer();assert.equal(releaseLayer(),layerCompletion);retained.dispose();assert.equal(readyRemovals,1,'Public dispose drains the same captured layer release');completeRemoval();await layerCompletion;assert.equal(readyRemovals,1);
  results.push({name,passed:true});
 }catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}
 finally{unregister();for(const key of keys){const descriptor=prior.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
}
async function finish():Promise<void>{
 const name='Asynchronous factories remain separate from synchronous creation without requiring browser globals';
 try{let calls=0;const release=registry.registerAsync(metadata('async-test'),async()=>{calls++;return instance;});assert.throws(()=>registry.create('async-test',{} as LittlewildRenderer.Context),/selectRendererAsync/);assert.equal(calls,0);assert.equal(await registry.prepare('async-test',{} as LittlewildRenderer.Context),instance);assert.equal(calls,1);release();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});}
 await previewContract(true);await previewContract(false);await previewContract(false,true);
 await retargetContract();
 await retirementContract();
 const report={passed:results.filter(result=>result.passed).length,total:results.length,results};
 fs.writeFileSync(__dirname+'/renderer-results.json',JSON.stringify(report,null,2)+'\n');console.log(report.passed+'/'+report.total+' renderer checks passed');if(report.passed!==report.total)process.exitCode=1;
}
finish().catch(error=>{console.error(error);process.exitCode=1;});
