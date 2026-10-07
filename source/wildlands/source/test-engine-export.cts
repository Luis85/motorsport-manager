/// <reference path="./engine-export-contracts.d.ts" />
/// <reference path="./renderer-contracts.d.ts" />
/// <reference path="./animation-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';
import {INSERTS} from './tools/build-inserts.cjs';
import {PROFILES,P5_SOURCE_ARCHIVE,payloadErrors,profileBundles,type ArtifactProfile} from './tools/artifact-profiles.cjs';
const X=require('./scenario-runtime.js') as LWContentPorts.ScenarioApi,E=require('./engine-export.js') as LWEngineExport.Api,D=require('./engine-export-data.js') as LWEngineExport.Decoder;
const results:{name:string;passed:boolean;error?:string}[]=[];
const project=path.resolve(__dirname,'..'),walk=(directory:string):string[]=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]);
/** Vendor scripts every engine-source artifact inlines verbatim; the loader stores exactly these empty. */
const inlineVendor=INSERTS.filter(insert=>insert[2]==='script'&&insert[1].startsWith('../vendor/')).map(insert=>insert[1].slice(3)).sort();
/** Decode the shipped browser loader exactly as stored, before any inline restoration. */
function storedLoader():{loader:LWEngineExport.SourceLoader;stored:LWEngineExport.SourceBundle;decoded:Buffer}{
 const loader=JSON.parse(fs.readFileSync(path.join(__dirname,'engine-source-loader.json'),'utf8')) as LWEngineExport.SourceLoader,decoded=gunzipSync(Buffer.from(loader.data,'base64'));
 return {loader,stored:JSON.parse(decoded.toString()) as LWEngineExport.SourceBundle,decoded};
}
async function test(name:string,fn:()=>Promise<void>|void):Promise<void>{try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,String(error));}}
async function main():Promise<void>{
 const pack=X.builtins().find(value=>value.id==='office')!,before=JSON.stringify(pack),exchanged=await E.export(pack,pack.scenes[0]!.id),source=exchanged.sources;
 await test('Ignored generated suite evidence cannot change the source bundle or its metadata',()=>{
  const builder=require('./tools/engine-export-bundle.cjs') as {createSourceBundle(project:string):LWEngineExport.SourceBundle};
  const project=path.resolve(__dirname,'..'),evidence=path.join(project,'source/engine-export-audit-results.json');
  assert.equal(fs.existsSync(evidence),false);const original=builder.createSourceBundle(project);
  try{fs.writeFileSync(evidence,JSON.stringify({passed:1,total:1,results:[{name:'Prior run',passed:true}]}));const rebuilt=builder.createSourceBundle(project);assert.deepEqual(rebuilt,original);assert.equal(rebuilt.files.some(file=>file.path==='source/engine-export-audit-results.json'),false);}
  finally{fs.rmSync(evidence,{force:true});}
 });
 await test('Complete versioned inert input preserves native pack/checkpoints and has cryptographic inventory',async()=>{
  assert.equal(exchanged.format,'littlewild-engine-export');assert.deepEqual(exchanged.pack,pack);assert.equal(JSON.stringify(pack),before);assert(source.files.length>300);assert.equal(source.identity,exchanged.sourceIdentity);assert.equal(new Set(source.files.map(file=>file.path)).size,source.files.length);assert.deepEqual(source.inventory.included,source.files.map(file=>file.path));assert((await E.validate(exchanged)).ok);
  for(const required of ['source/engine.ts','source/physical-ecs-contracts.d.ts','source/storytelling-player.ts','source/content/balancing.json','source/content/balancing-inventory.json','source/assets/creatures/sproutling/definition.json','package-lock.json','vendor/p5-source-2.3.4.tar.gz','toolchain/typescript/lib/typescript.js','toolchain/@types/node/index.d.ts'])assert(source.files.some(file=>file.path===required),required);
  for(const required of ['source/wildlands-godot/main.gd','source/wildlands-godot/bridge.gd','source/wildlands-godot/assets.gd','source/tools/wildlands-bundle.cts'])assert(source.files.some(file=>file.path===required),required);
  assert(!source.files.some(file=>file.path==='source/wildlands-godot/test-native.gd'),'Native verification code must not become playable export source');
 });
 await test('Real system/command/schedule capabilities and Godot transforms remain explicit',()=>{
  const runtime=exchanged.runtime,commands=(runtime.commands as {manifest:{id:string}[]}).manifest,systems=runtime.systems as {id:string;source:string;components:string[]}[];assert(commands.some(command=>command.id==='apply-terraform'));assert(commands.some(command=>command.id==='request-interaction'));assert(systems.some(system=>system.id==='production-settlement'));assert(systems.some(system=>system.id==='task-movement'));assert.equal((runtime.schedule as {compiled:unknown[]}).compiled.length,6);assert(systems.every(system=>system.components.length&&source.files.some(file=>file.path===system.source)));
  const coordinates=exchanged.godot.coordinateSystem as {islandCells:number;islandStride:number;mapping:{z:string}};assert.equal(coordinates.islandCells,19);assert.equal(coordinates.islandStride,23);assert.equal(coordinates.mapping.z,'native.y');assert((exchanged.godot.requiredWork as string[]).some(value=>value.includes('gameplay parity')));
 });
 await test('Dimension-aware Godot scenes retain actual floor geometry, embeds and native elevation',async()=>{
  const p=D.parse(pack) as LWContentPorts.ScenarioPack,scene=p.scenes[0]!,state=scene.initialState,buildings=state.buildings as {id:string;kind:string}[],building=buildings.find(value=>value.kind==='bench')!,interiors=(globalThis as unknown as {LWInteriors:LWInterior.CatalogApi}).LWInteriors,floor=interiors.forBuilding(state as unknown as LWInterior.CatalogWorld,building).floors[0]!,point=floor.cells?.[0]??{x:1,y:1};
  scene.graph={kind:'level',rendering:{dimension:'3d',rendererId:'basic',embeds:[{id:'room-panel',sceneId:'room-export',role:'panel'}]}};p.scenes.push({id:'room-export',name:'Room',description:'Bound canonical floor',worldId:scene.worldId,initialState:{},graph:{kind:'interior',parentId:scene.id,binding:{type:'interior',sourceSceneId:scene.id,buildingId:building.id,floorId:floor.id},rendering:{dimension:'2d',rendererId:'pixi-2d'},props:[{id:'floor-prop',name:'Wood',category:'item',assetId:'wood',model:'world',x:point.x,y:point.y}]}});
  const actor=(state.colony as {creatures:{creature:{x:number;y:number}}[]}).creatures[0]!.creature;state.terraform={version:1,revision:0,sequence:1,tiles:{[Math.round(actor.x)+','+Math.round(actor.y)]:{ground:'grass',height:1}},plants:{}};
  const result=await E.export(p,'room-export'),scenes=result.godot.scenes as {id:string;node:string;floor:LWInterior.Floor;bounds:{width:number;height:number};rendering:{dimension:string};embeds:unknown[];entities:{category:string;node:string;position:number[]}[]}[],room=scenes.find(value=>value.id==='room-export')!,rootScene=scenes.find(value=>value.id===scene.id)!;
  assert.equal(room.node,'Node2D');assert.equal(room.rendering.dimension,'2d');assert.deepEqual(room.floor,floor);assert.equal(room.bounds.width,floor.width);assert.equal(room.bounds.height,floor.height);assert.equal(room.entities[0]!.node,'Node2D');assert.deepEqual(room.entities[0]!.position,[point.x,point.y]);assert.equal(rootScene.embeds.length,1);assert.equal(rootScene.entities.find(value=>value.category==='creatures')!.position[1],1);assert((await E.validate(result)).ok);
 });
 await test('Every manifest source reference resolves the trusted source inventory and all RNG streams are declared',()=>{
  function visit(value:unknown):void{if(typeof value==='string'&&value.startsWith('source/'))assert(source.files.some(file=>file.path===value),'Unresolved '+value);else if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')Object.values(value).forEach(visit);}
  visit(exchanged.runtime);visit(exchanged.godot);assert((exchanged.runtime.determinism as {rng:{streams:string}}).rng.streams.includes('creatureInteractions.rng'));assert(source.files.some(file=>file.path==='toolchain/undici-types/index.d.ts'));
 });
 await test('Registered custom main and embedded renderers export metadata and explicit missing-module/manual-port requirements',async()=>{
  const registry=require('./renderer-registry.js') as LittlewildRenderer.Registry;let calls=0;
  const withdraw3d=registry.register({id:'export-custom-3d',name:'Export3D',description:'Trusted compiled extension',capabilities:['camera'],dimensions:['3d']},()=>{calls++;throw Error('Export must never invoke renderer factories.');});
  const withdraw2d=registry.register({id:'export-custom-2d',name:'Export2D',description:'Trusted embedded extension',capabilities:['camera','hit-test'],dimensions:['2d']},()=>{calls++;throw Error('Export must never invoke renderer factories.');});
  try{
   const p=D.parse(pack) as LWContentPorts.ScenarioPack,scene=p.scenes[0]!;scene.graph={kind:'level',rendering:{dimension:'3d',rendererId:'export-custom-3d',embeds:[{id:'custom-map',sceneId:'custom-embedded',role:'minimap'}]}};
   const building=(scene.initialState.buildings as {id:string;kind:string}[]).find(value=>value.kind==='bench')!,interiors=(globalThis as unknown as {LWInteriors:LWInterior.CatalogApi}).LWInteriors,floor=interiors.forBuilding(scene.initialState as unknown as LWInterior.CatalogWorld,building).floors[0]!;
   for(const [id,name,rendererId] of [['custom-embedded','Custom embedded view','export-custom-2d'],['portable-unavailable','Unavailable renderer','constructor']] as const)p.scenes.push({id,name,description:'Native bound floor projection',worldId:scene.worldId,initialState:{},graph:{kind:'interior',parentId:scene.id,binding:{type:'interior',sourceSceneId:scene.id,buildingId:building.id,floorId:floor.id},rendering:{dimension:'2d',rendererId}}});
   const result=await E.export(p,scene.id),entries=result.godot.renderers as {id:string;metadata:LittlewildRenderer.Metadata|null;registered:boolean;source:string|null;sourceIncluded:boolean;requiresModule:boolean;uses:{sceneId:string;dimension:string;embeddedBy:string[]}[];requiredWork:string}[];
   for(const id of ['export-custom-3d','export-custom-2d','constructor']){const entry=entries.find(value=>value.id===id)!;assert(entry);assert.equal(entry.source,null);assert.equal(entry.sourceIncluded,false);assert.equal(entry.requiresModule,true);assert(entry.requiredWork.includes('compiled renderer extension module'));assert(result.limitations.some(value=>value.includes(id)&&value.includes('manual semantic port')));assert(!Object.hasOwn(entry,'factory'));}
   const embedded=entries.find(value=>value.id==='export-custom-2d')!;assert.deepEqual(embedded.metadata?.dimensions,['2d']);assert(embedded.uses.some(use=>use.sceneId==='custom-embedded'&&use.embeddedBy.includes(scene.id)));assert.equal(entries.find(value=>value.id==='export-custom-3d')!.registered,true);assert.equal(entries.find(value=>value.id==='constructor')!.metadata,null);assert.equal(entries.find(value=>value.id==='constructor')!.registered,false);withdraw3d();withdraw2d();assert((await E.validate(result)).ok);assert.equal(calls,0);
   for(const mutate of [(doc:LWEngineExport.Document)=>{doc.extensions.renderers[0]!.metadata={...doc.extensions.renderers[0]!.metadata!,dimensions:['2d']};},(doc:LWEngineExport.Document)=>{doc.extensions.renderers[0]!.id='wrong-id';},(doc:LWEngineExport.Document)=>{Object.assign(doc.extensions.renderers[0]!.metadata!,{factory:'unsafe'});},(doc:LWEngineExport.Document)=>{doc.extensions.renderers.pop();}]){const invalid=D.parse(result) as LWEngineExport.Document;mutate(invalid);assert.equal((await E.validate(invalid)).ok,false);}
  }finally{withdraw3d();withdraw2d();}
 });
 await test('Custom animation snapshots survive immediate withdrawal and cold validation without installing callbacks',async()=>{
  require('./developer-data.js');require('./renderer-animations.js');const animations=(globalThis as unknown as {LWAnimations:LWAnimations.Api}).LWAnimations;let calls=0;
  const withdraw=animations.register({id:'export-custom-preset',name:'Custom export preset',description:'Compiled draw extension',source:'source/renderer-example.ts'},()=>{calls++;throw Error('Never draw during inert export.');});
  const p=D.parse(pack) as LWContentPorts.ScenarioPack,scene=p.scenes[0]!;p.storytelling={version:1,cutscenes:[{id:'export-clip',name:'Export',sceneId:scene.id,duration:2,skipPolicy:'finish',tracks:[],animations:['sparkles','orbit','ripple','export-custom-preset'].map((presetId,index)=>({id:'animation-'+index,presetId,start:0,duration:1,x:1,y:1,radius:4,color:'#ffffff',count:3}))}],storyboards:[]};
  try{const pending=E.export(p,scene.id);withdraw();const result=await pending;assert.deepEqual(result.pack,p);assert.equal(result.extensions.animations[0]!.metadata.source,'source/renderer-example.ts');assert((await E.validate(result)).ok);assert.equal(calls,0);assert.equal(X.validate(p).ok,false);
   for(const mutate of [(doc:LWEngineExport.Document)=>{doc.extensions.animations[0]!.metadata={...doc.extensions.animations[0]!.metadata,source:'../escape.ts'};},(doc:LWEngineExport.Document)=>{doc.extensions.animations[0]!.metadata={...doc.extensions.animations[0]!.metadata,id:'wrong-id'};},(doc:LWEngineExport.Document)=>{Object.assign(doc.extensions.animations[0]!.metadata,{parameters:'unknown'});},(doc:LWEngineExport.Document)=>{doc.pack.storytelling!.cutscenes[0]!.animations![0]!.count=Infinity;}]){const invalid=D.parse(result) as LWEngineExport.Document;mutate(invalid);assert.equal((await E.validate(invalid)).ok,false);}
  }finally{withdraw();}
 });
 await test('Exact source hashes include binary vendor source archive without UTF8 corruption',()=>{
  for(const file of source.files){const raw=Buffer.from(file.text,file.encoding==='base64'?'base64':'utf8');assert.equal(raw.byteLength,file.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),file.sha256);}
  const archive=source.files.find(file=>file.path==='vendor/p5-source-2.3.4.tar.gz')!;assert.equal(archive.encoding,'base64');assert(gunzipSync(Buffer.from(archive.text,'base64')).byteLength>archive.bytes);
 });
 await test('Browser compressed loader expands into byte-identical Node bundle',()=>{
  const {loader,stored,decoded}=storedLoader(),bytes=Buffer.from(loader.data,'base64');assert.equal(bytes.byteLength,loader.compressedBytes);assert.equal(decoded.byteLength,loader.decodedBytes);assert.equal(loader.identity,source.identity);
  // Inline vendor scripts are stored empty; restoring the artifact's identical inline copies (the vendor files) is byte-identical.
  assert.deepEqual((loader.inlineScripts??[]).map(entry=>entry.path).sort(),inlineVendor);assert.equal(inlineVendor.length,5);
  for(const file of stored.files){const entry=loader.inlineScripts!.find(item=>item.path===file.path);if(!entry)continue;assert.equal(file.text,'');assert.equal(entry.bytes,file.bytes);assert.equal(entry.sha256,file.sha256);file.text=fs.readFileSync(path.join(project,file.path),'utf8');}
  assert.deepEqual(Buffer.from(JSON.stringify(stored)),fs.readFileSync(path.join(__dirname,'engine-source-bundle.json')));assert.deepEqual(stored,source);
 });
 await test('Incomplete inventory, path traversal, hash tampering and derived manifest edits reject',async()=>{
  for(const mutate of [(value:LWEngineExport.Document)=>{value.sources.files.pop();},(value:LWEngineExport.Document)=>{value.sources.files[0]!.path='../engine.ts';},(value:LWEngineExport.Document)=>{value.sources.files[0]!.text+='\n//changed';},(value:LWEngineExport.Document)=>{value.sources.inventory.included.pop();},(value:LWEngineExport.Document)=>{value.godot.selectedSceneId='missing';}]){const changed=D.parse(exchanged) as LWEngineExport.Document;mutate(changed);assert.equal((await E.validate(changed)).ok,false);}assert.equal(JSON.stringify(pack),before);
 });
 await test('Long inert source text is data and object accessors/functions/prototypes never run',()=>{
  let calls=0;const accessor={};Object.defineProperty(accessor,'text',{enumerable:true,get(){calls++;return 'executed';}});assert.throws(()=>D.parse(accessor));assert.equal(calls,0);assert.throws(()=>D.parse({run:()=>calls++}));assert.throws(()=>D.parse(Object.create({source:'unsafe'}) as unknown));assert.throws(()=>D.parse(JSON.parse('{"__proto__":{}}')));assert.throws(()=>D.parse('{"key":1,"key":2}'));assert.throws(()=>D.parse(new Array(1)));assert.throws(()=>D.parse(new Array(250001)));assert.deepEqual(D.parse({source:'globalThis.shouldNeverExecute=true;'}),{source:'globalThis.shouldNeverExecute=true;'});assert.equal((globalThis as unknown as {shouldNeverExecute?:boolean}).shouldNeverExecute,undefined);assert.throws(()=>D.parse({value:Infinity}));assert.throws(()=>D.parse({text:'x'.repeat(16*1024*1024+1)}));
 });
 await test('Engine input is rejected by playable scenario admission; canonical JSON object order is immaterial',async()=>{
  assert.equal(X.validate({format:exchanged.format,schemaVersion:1}).ok,false);const ordered={...exchanged,sources:{...source,files:source.files.map(file=>({text:file.text,dependencies:file.dependencies,sha256:file.sha256,bytes:file.bytes,role:file.role,encoding:file.encoding,path:file.path}))}};assert((await E.validate(ordered)).ok);
 });
 await test('Paid native work/actor fractional coordinates survive export without losing continuation state',async()=>{
  const engine=X.commitScene(X.prepareScene(pack,pack.scenes[0]!.id)) as LWContentPorts.ScenarioEngine&{advance(seconds:number):void};let paid=false;for(let i=0;i<1000;i++){engine.advance(.1);const buildings=engine.export().state.buildings as {storage?:{job?:{progress:number}}}[];if(buildings.some(building=>(building.storage?.job?.progress??0)>0)){paid=true;break;}}assert(paid);const captured=X.capture(engine),snapshot=engine.export(),value=await E.export(captured,captured.scenes[0]!.id);assert.deepEqual(value.pack,captured);assert.deepEqual(engine.export(),snapshot);assert.deepEqual(value.checkpoint.owners.find(owner=>owner.id===captured.scenes[0]!.id)!.state,captured.scenes[0]!.initialState);assert((await E.validate(value)).ok);const restored=X.commitScene(X.prepareScene(value.pack,value.sceneId)) as LWContentPorts.ScenarioEngine&{advance(seconds:number):void};engine.advance(1);restored.advance(1);assert.deepEqual(restored.export(),engine.export());
 });

 await test('Inline vendor restoration needs the exact inline script bytes and never accepts a missing or altered copy',async()=>{
  const loader=JSON.parse(fs.readFileSync(path.join(__dirname,'engine-source-loader.json'),'utf8')) as LWEngineExport.SourceLoader,scripts=inlineVendor.map(file=>'\n'+fs.readFileSync(path.join(project,file),'utf8')+'\n');
  assert.deepEqual(await D.sources(loader,['\nunrelated();\n',...scripts]),source);
  await assert.rejects(D.sources(loader,scripts.slice(1)),/is not inlined in this artifact; the engine-source payload is incomplete/);
  const altered=scripts.map((text,index)=>index?text:text.slice(0,-2)+(text.at(-2)==='x'?'y':'x')+'\n');
  await assert.rejects(D.sources(loader,altered),/is not inlined in this artifact/);await assert.rejects(D.sources(loader),/is not inlined in this artifact/);
  const forged={...loader,inlineScripts:[{...loader.inlineScripts![0]!,path:'source/engine.ts'}]};await assert.rejects(D.sources(forged,scripts),/Invalid inline engine source reference: source\/engine\.ts/);
  // The browser Godot opt-in reads the page's scripts (infrastructure adapter) and must publish the exact Node bundle bytes.
  const browser=globalThis as unknown as {LWEngineSourceLoader?:unknown;document?:{scripts:{text:string}[]}};browser.LWEngineSourceLoader=loader;browser.document={scripts:scripts.map(text=>({text}))};
  try{
   require('./developer-sdk.cjs');const P=require('./wildlands-project.js') as {create():unknown},G=require('./wildlands-godot.js') as {compile(project:unknown,resources:unknown,options:{withEngineSources:boolean}):Promise<{files:{path:string;content:string}[]}>};
   const resources={bundle:JSON.parse(fs.readFileSync(path.join(__dirname,'wildlands-runtime-bundle.json'),'utf8')) as unknown,templates:JSON.parse(fs.readFileSync(path.join(__dirname,'wildlands-godot-templates.json'),'utf8')) as unknown};
   const compiled=await G.compile(P.create(),resources,{withEngineSources:true});
   assert.equal(compiled.files.find(file=>file.path==='runtime/engine-source-bundle.json')?.content,fs.readFileSync(path.join(__dirname,'engine-source-bundle.json'),'utf8'));
  }finally{delete browser.LWEngineSourceLoader;delete browser.document;}
 });
 await test('Trimmed toolchain keeps exactly the declarations the project compiler loads and drops unloaded TypeScript files',()=>{
  const paths=new Set(source.files.map(file=>file.path)),toolchain=source.files.filter(file=>file.role==='toolchain'||file.path.startsWith('toolchain/'));
  assert.equal(source.build.compiler,'toolchain/typescript/lib/typescript.js');assert(paths.has(source.build.compiler));
  for(const dropped of ['toolchain/typescript/lib/_tsc.js','toolchain/typescript/lib/tsc.js','toolchain/typescript/lib/_tsserver.js','toolchain/typescript/lib/lib.webworker.d.ts','toolchain/typescript/lib/de/diagnosticMessages.generated.json','toolchain/@types/node/ts5.6/index.d.ts']){assert(!paths.has(dropped),dropped);assert(source.inventory.excluded.includes(dropped),dropped);}
  assert(!toolchain.some(file=>/diagnosticMessages|tsserver|typingsInstaller|\/ts5\.\d\//.test(file.path)));
  for(const kept of ['toolchain/typescript/lib/lib.es2022.d.ts','toolchain/typescript/lib/lib.dom.iterable.d.ts','toolchain/typescript/lib/typescript.d.ts','toolchain/typescript/LICENSE.txt','toolchain/typescript/ThirdPartyNoticeText.txt','toolchain/undici-types/package.json'])assert(paths.has(kept),kept);
  // Independent oracle: the real full-project program may load only inventoried toolchain declarations.
  const config=ts.readConfigFile(path.join(project,'tsconfig.json'),ts.sys.readFile),parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,project);
  const modules=path.join(project,'node_modules'),loaded=ts.createProgram({rootNames:parsed.fileNames,options:{...parsed.options,noEmit:true}}).getSourceFiles().map(file=>path.relative(modules,path.resolve(file.fileName)).replaceAll(path.sep,'/')).filter(file=>/^(typescript|@types\/node|undici-types)\//.test(file));
  assert(loaded.length>150);for(const file of loaded)assert(paths.has('toolchain/'+file),'Missing loaded declaration toolchain/'+file);
  assert(toolchain.reduce((sum,file)=>sum+file.bytes,0)<16*1024*1024);
 });
 await test('Bundled sources and trimmed toolchain recompile to the gate\'s exact compiled JavaScript',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'wildlands-engine-rebuild-'));
  try{
   for(const file of source.files){const target=path.join(directory,file.path.startsWith('toolchain/')?'node_modules/'+file.path.slice('toolchain/'.length):file.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.from(file.text,file.encoding==='base64'?'base64':'utf8'));}
   const compiler=path.join(directory,'node_modules',source.build.compiler.slice('toolchain/'.length)),out=path.join(directory,'rebuilt');
   const child=spawnSync(process.execPath,['-e','const ts=require(process.argv[1]);ts.executeCommandLine(ts.sys,()=>{},process.argv.slice(2))',compiler,'-p','tsconfig.json','--outDir',out],{cwd:directory,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
   assert.equal(child.status,0,child.stdout+child.stderr);
   const authored=source.files.filter(file=>/^source\/.*\.c?ts$/.test(file.path)&&!file.path.endsWith('.d.ts')).map(file=>file.path.slice('source/'.length).replace(/\.ts$/,'.js').replace(/\.cts$/,'.cjs')).sort();
   const emitted=walk(out).map(file=>path.relative(out,file).replaceAll(path.sep,'/')).sort();
   assert.deepEqual(emitted,authored);assert(emitted.length>200);
   for(const file of emitted)assert(fs.readFileSync(path.join(out,file)).equals(fs.readFileSync(path.join(__dirname,file))),'Rebuilt '+file+' differs from the gate build');
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
 });
 await test('Engine-source payload profiles inline vendors verbatim and every p5 artifact carries its LGPL source',()=>{
  for(const candidate of PROFILES)assert.deepEqual(payloadErrors(candidate),[],candidate.id);
  const carrying=PROFILES.filter(candidate=>candidate.data.includes('LWEngineSourceLoader')).map(candidate=>candidate.id);assert.deepEqual(carrying,['showcase','studio']);
  for(const candidate of PROFILES.filter(entry=>entry.kind==='play'))assert(!profileBundles(candidate).includes('animation-p5'),candidate.id);
  assert(source.files.some(file=>file.path===P5_SOURCE_ARCHIVE&&file.role==='source-archive'));
  const studio=PROFILES.find(candidate=>candidate.id==='studio')!,variant=(change:Partial<ArtifactProfile>):string[]=>payloadErrors({...studio,...change});
  assert.match(variant({minify:true}).join('\n'),/must inline vendor scripts unminified/);
  assert.match(variant({bundles:studio.bundles.filter(bundle=>bundle!=='renderers-2d')}).join('\n'),/does not inline PIXI_VENDOR/);
  assert.match(variant({data:studio.data.filter(name=>name!=='LWEngineSourceLoader')}).join('\n'),/inlines p5 \(P5_VENDOR\) without its LGPL source offer/);
 });
}
main().catch(error=>{results.push({name:'Setup',passed:false,error:String(error)});}).finally(()=>{const report={suite:'engine-export',passed:results.filter(result=>result.passed).length,total:results.length,results};fs.writeFileSync(path.join(__dirname,'engine-export-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(results.some(result=>!result.passed))process.exitCode=1;});
