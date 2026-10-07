// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {WildlandsRuntime,MAX_REQUEST_BYTES,type RuntimeResponse} from './wildlands-runtime.cjs';
import {projects,toolbox} from './wildlands-project-sdk.cjs';

const results:{name:string;passed:boolean;error?:string}[]=[];
const object=(input:unknown):Record<string,unknown>=>input as Record<string,unknown>;
let sequence=0;
async function call(runtime:WildlandsRuntime,method:string,params:Record<string,unknown>={}):Promise<unknown>{
 const response=await runtime.execute({id:++sequence,method,params});
 assert.equal(response.ok,true,JSON.stringify(response.error));return response.result;
}
async function test(name:string,work:()=>Promise<void>|void):Promise<void>{
 try{await work();results.push({name,passed:true});console.log('PASS '+name);}
 catch(error){results.push({name,passed:false,error:error instanceof Error?error.stack??error.message:String(error)});console.error('FAIL '+name,error);}
}
async function using(work:(runtime:WildlandsRuntime)=>Promise<void>,options:ConstructorParameters<typeof WildlandsRuntime>[0]={}):Promise<void>{
 const runtime=new WildlandsRuntime(options);try{await work(runtime);}finally{runtime.dispose();}
}
function graphPack():LWContentPorts.ScenarioPack{
 const pack=projects.create().pack,home=pack.scenes[0]!;
 home.graph={kind:'level',connections:[{id:'far',label:'Far',targetSceneId:pack.scenes[1]!.id}]};
 pack.scenes[1]!.graph={kind:'level',connections:[{id:'home',label:'Home',targetSceneId:home.id}]};
 return pack;
}
async function main():Promise<void>{
 await test('Discovery describes every transported operation and SDK allowlist without ticking',()=>using(async runtime=>{
  const before=await call(runtime,'story'),discovery=object(await call(runtime,'discover'));
  assert.equal(discovery.fixedStep,.1);assert.equal(discovery.maxSteps,36000);
  assert.equal(discovery.maxRequestBytes,MAX_REQUEST_BYTES);
  assert(Array.isArray(discovery.operations));assert((discovery.commands as unknown[]).length>30);
  assert.deepEqual(await call(runtime,'story'),before);
 }));
 await test('Detached native view includes canonical physical world, assets and scenario profile',()=>using(async runtime=>{
  const before=await call(runtime,'story'),view=object(await call(runtime,'inspect'));
  assert(object(view.state).estate);assert(object(view.worldProfile).terrain);assert((view.assets as unknown[]).length);
  assert(object(view.state).colony);assert(Array.isArray(object(view.snapshot).actors));
  object(view.state).simTime=123456;object(view.worldProfile).name='tampered';
  assert.deepEqual(await call(runtime,'story'),before);
 }));
 await test('Bridge commands and exact fixed steps produce the same authoritative SDK continuation',async()=>{
  let bridgeStory:unknown;
  const command={id:'set-stock-target',actorId:'c1',args:['berries',4]} as const;
  await using(async runtime=>{
   await call(runtime,'command',{command});await call(runtime,'start');await call(runtime,'step',{count:75});
   bridgeStory=await call(runtime,'story');
  });
  const session=toolbox.create({scenarioId:'littlewild'});
  try{assert(session.command(command as unknown as LittlewildDeveloper.Command).ok);session.start();session.step(75);assert.deepEqual(bridgeStory,session.story());}
  finally{session.dispose();}
 });
 await test('Invalid clock and command input preserve the full RNG and production story',()=>using(async runtime=>{
  await call(runtime,'start');const before=await call(runtime,'story');
  for(const params of [{count:-1},{count:.1},{count:36001},{count:'1'}])assert.equal((await runtime.execute({id:1,method:'step',params})).ok,false);
  assert.equal((await runtime.execute({id:2,method:'advance',params:{seconds:.15}})).ok,false);
  assert.equal((await runtime.execute({id:3,method:'command',params:{command:{id:'eval',args:[]}}})).ok,false);
  assert.deepEqual(await call(runtime,'story'),before);
 }));
 await test('Pause, inspection and authoring queries never advance simulation time',()=>using(async runtime=>{
  await call(runtime,'start');await call(runtime,'step',{count:3});await call(runtime,'pause');
  const before=await call(runtime,'story'),stepped=object(await call(runtime,'step',{count:25}));
  assert.equal(object(stepped.step).advancedSeconds,0);
  await call(runtime,'query',{name:'terraform'});await call(runtime,'query',{name:'constructionOptions'});
  assert.deepEqual(await call(runtime,'story'),before);
 }));
 await test('Failed scenario/story replacements preserve an existing complete continuation',()=>using(async runtime=>{
  await call(runtime,'start');await call(runtime,'step',{count:19});const before=await call(runtime,'story');
  for(const params of [{scenarioId:'missing'},{scenarioId:'emberworks',sceneId:'missing'},{pack:{invalid:true}}]){
   assert.equal((await runtime.execute({id:1,method:'session.create',params})).ok,false);assert.deepEqual(await call(runtime,'story'),before);
  }
  assert.equal((await runtime.execute({id:2,method:'session.openStory',params:{story:{version:10}}})).ok,false);
  assert.deepEqual(await call(runtime,'story'),before);
 }));
 await test('Portable story restore retains exact state and permits deterministic continuation',()=>using(async runtime=>{
  await call(runtime,'start');await call(runtime,'step',{count:27});const story=await call(runtime,'story');
  await call(runtime,'step',{count:13});const expected=await call(runtime,'story');
  await call(runtime,'session.openStory',{story});assert.deepEqual(await call(runtime,'story'),story);
  await call(runtime,'step',{count:13});assert.deepEqual(await call(runtime,'story'),expected);
 }));
 await test('Scenario switching uses canonical built-in ownership and rejects stale reflection',()=>using(async runtime=>{
  const view=object(await call(runtime,'session.create',{scenarioId:'office'}));assert.equal(object(view.snapshot).scenarioId,'office');
  for(const params of [{name:'dispose'},{name:'step',args:[1]},{name:'__proto__'},{name:'terrain',args:[1]}])assert.equal((await runtime.execute({id:1,method:'query',params})).ok,false);
  assert.equal((await runtime.execute({id:2,method:'tools.call',params:{facet:'toolbox',method:'create',args:[{scenarioId:'littlewild'}]}})).ok,false);
 }));
 await test('Reviewed scene transitions retain canonical visited checkpoint ownership',()=>using(async runtime=>{
  const initial=object(await call(runtime,'inspect')),before=await call(runtime,'save');
  assert((initial.connections as unknown[]).length);await call(runtime,'scene.review',{connectionId:'far'});
  assert.deepEqual(await call(runtime,'save'),before);
  const far=object(await call(runtime,'scene.enter',{connectionId:'far'}));assert.notEqual(object(far.snapshot).sceneId,object(initial.snapshot).sceneId);
  await call(runtime,'scene.enter',{connectionId:'home'});assert.deepEqual(await call(runtime,'save'),before);
 },{pack:graphPack()}));
 await test('Retained scene drafts edit, undo and export without mutating a running world',()=>using(async runtime=>{
  const before=await call(runtime,'story'),pack=await call(runtime,'session.capture'),handle=object(await call(runtime,'authoring.create',{kind:'scene',pack}));
  const editorId=handle.editorId,sceneId=object(object(await call(runtime,'inspect')).snapshot).sceneId;
  await call(runtime,'authoring.call',{editorId,method:'updateScene',args:[sceneId,{name:'Agent authored'}]});
  const edited=object(await call(runtime,'authoring.call',{editorId,method:'export'}));
  assert.equal(object((object(edited.result).scenes as unknown[])[0]).name,'Agent authored');
  await call(runtime,'authoring.call',{editorId,method:'undo'});const undone=object(await call(runtime,'authoring.call',{editorId,method:'export'}));
  assert.notEqual(object((object(undone.result).scenes as unknown[])[0]).name,'Agent authored');
  assert.deepEqual(await call(runtime,'story'),before);
  await call(runtime,'authoring.close',{editorId});assert.equal((await runtime.execute({id:2,method:'authoring.call',params:{editorId,method:'export'}})).ok,false);
 }));
 await test('Asynchronous SDK validation is awaited and returns its detached result',()=>using(async runtime=>{
  const result=object(await call(runtime,'tools.call',{facet:'engineExport',method:'validate',args:[{}]}));
  assert.equal(result.ok,false);assert(Array.isArray(result.errors));
  const before=await call(runtime,'story');assert.deepEqual(await call(runtime,'story'),before);
 }));
 await test('Complete source export can roundtrip through the same bounded protocol validator',()=>using(async runtime=>{
  const before=await call(runtime,'story'),pack=object(await call(runtime,'session.capture')),sceneId=object((pack.scenes as unknown[])[0]).id;
  const exported=await call(runtime,'tools.call',{facet:'engineExport',method:'export',args:[pack,sceneId]});
  const request=JSON.stringify({id:77,method:'tools.call',params:{facet:'engineExport',method:'validate',args:[exported]}});
  assert(Buffer.byteLength(request)<=MAX_REQUEST_BYTES);
  const checked=await runtime.execute(request);assert.equal(checked.ok,true,JSON.stringify(checked.error));
  assert.equal(object(checked.result).ok,true,JSON.stringify(object(checked.result).errors));
  assert.deepEqual(await call(runtime,'story'),before);
 }));
 await test('Graph-less prototype captures and cinematic sampling preserve all authored scenes',async()=>{
  const pack=projects.create().pack,scene=pack.scenes[0]!;
  pack.storytelling={version:1,storyboards:[],cutscenes:[{id:'arrival',name:'Arrival',sceneId:scene.id,duration:2,skipPolicy:'cancel',tracks:[{id:'camera-x',target:{category:'camera'},property:'x',keyframes:[{time:0,value:1},{time:2,value:5}]}]}]};
  await using(async runtime=>{
   const before=await call(runtime,'story'),clips=object(await call(runtime,'storytelling.inspect'));
   assert.equal((clips.cutscenes as unknown[]).length,1);
   const sample=object(await call(runtime,'storytelling.sample',{id:'arrival',time:1}));assert.equal(object(sample.camera).x,3);
   const captured=object(await call(runtime,'session.capture'));assert.equal((captured.scenes as unknown[]).length,pack.scenes.length);assert(captured.storytelling);
   assert.deepEqual(await call(runtime,'story'),before);
  },{pack});
 });
 await test('Malformed and duplicate-key envelopes fail without accessors or mutation',()=>using(async runtime=>{
  const before=await call(runtime,'story');let reads=0;
  const getter={id:1,get method(){reads++;return 'shutdown';}};
  assert.equal((await runtime.execute(getter)).ok,false);assert.equal(reads,0);
  for(const input of ['{"id":1,"method":"shutdown","method":"story"}',{id:1,method:'story',extra:true},{id:'',method:'story'},{id:1,method:'missing'}])assert.equal((await runtime.execute(input)).ok,false);
  assert.deepEqual(await call(runtime,'story'),before);
 }));
 await test('Project startup applies the same strict admission as web and CLI',()=>{
  const project=projects.create();
  for(const candidate of [{...project,scenarioId:'wrong'},{...project,name:''},{...project,extra:true}])assert.throws(()=>new WildlandsRuntime({project:candidate}));
  const runtime=new WildlandsRuntime({project});runtime.dispose();
 });
 await test('JSON-lines process correlates UTF8 requests, recovers malformed lines and closes cleanly',()=>{
  const input=['{invalid',JSON.stringify({id:'déjà-vu',method:'query',params:{name:'settings'}}),JSON.stringify({id:2,method:'tools.call',params:{facet:'engineExport',method:'validate',args:[{}]}}),JSON.stringify({id:3,method:'shutdown'})].join('\n')+'\n';
  const child=spawnSync(process.execPath,[path.join(__dirname,'tools','wildlands-runtime.cjs'),'--stdio'],{input,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
  assert.ifError(child.error);assert.equal(child.status,0,child.stderr);assert.equal(child.stderr,'');
  const replies=child.stdout.trim().split('\n').map(line=>JSON.parse(line) as RuntimeResponse);
  assert.equal(replies.length,4);assert.equal(replies[0]!.ok,false);assert.equal(replies[1]!.id,'déjà-vu');assert.equal(replies[1]!.ok,true);
  assert.equal(object(replies[2]!.result).ok,false);assert.equal(replies[3]!.id,3);
 });
 await test('Oversized line is drained with bounded memory and next request still succeeds',()=>{
  const child=spawnSync(process.execPath,[path.join(__dirname,'tools','wildlands-runtime.cjs')],{input:'x'.repeat(MAX_REQUEST_BYTES+1)+'\n'+JSON.stringify({id:4,method:'shutdown'})+'\n',encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  assert.ifError(child.error);assert.equal(child.status,0,child.stderr);
  const replies=child.stdout.trim().split('\n').map(line=>JSON.parse(line) as RuntimeResponse);
  assert.equal(replies.length,2);assert.equal(replies[0]!.error!.code,'request-too-large');assert.equal(replies[1]!.ok,true);
 });
 await test('Pack/project startup files preserve authored scene and reject duplicate JSON keys',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'wildlands-runtime-'));
  try{
   const project=projects.create({scenarioId:'office'}),file=path.join(directory,'project.json');fs.writeFileSync(file,JSON.stringify(project));
   const input=JSON.stringify({id:1,method:'query',params:{name:'inspect'}})+'\n';
   const child=spawnSync(process.execPath,[path.join(__dirname,'tools','wildlands-runtime.cjs'),'--project',file],{input,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
   assert.ifError(child.error);assert.equal(child.status,0,child.stderr);assert.equal(object((JSON.parse(child.stdout) as RuntimeResponse).result).scenarioId,'office');
   fs.writeFileSync(file,JSON.stringify(project).replace('"format":','"format":"ignored","format":'));
   const bad=spawnSync(process.execPath,[path.join(__dirname,'tools','wildlands-runtime.cjs'),'--project',file],{input,encoding:'utf8',timeout:30000});
   assert.ifError(bad.error);assert.equal(bad.status,1);assert.match(bad.stderr,/Duplicate/);
   fs.writeFileSync(file,JSON.stringify(project.pack));
   const pack=spawnSync(process.execPath,[path.join(__dirname,'tools','wildlands-runtime.cjs'),'--pack',file,'--scene',project.sceneId],{input,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
   assert.ifError(pack.error);assert.equal(pack.status,0,pack.stderr);assert.equal(object((JSON.parse(pack.stdout) as RuntimeResponse).result).scenarioId,'office');
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
 });
 await test('Shutdown and EOF release owned session so a fresh SDK session can open',()=>using(async runtime=>{
  await call(runtime,'shutdown');assert(runtime.stopped);assert.equal((await runtime.execute({id:1,method:'story'})).ok,false);
  const session=toolbox.create({scenarioId:'littlewild'});session.dispose();
 }));
 const report={passed:results.filter(result=>result.passed).length,total:results.length,results};
 fs.writeFileSync(path.join(__dirname,'wildlands-runtime-results.json'),JSON.stringify(report,null,2));
 console.log(report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
}
void main();
