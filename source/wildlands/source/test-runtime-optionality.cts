'use strict';
// Tests run the composite showcase game: install its content profile before any engine module loads.
require('./test-support/install-games.cjs');
/* Runtime optionality seams: per-game storage namespaces, declared payload capabilities and
 * optional developer-toolbox facets. Absent bundles must fail with explicit reasons. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';

interface StoragePort {getItem(key:string):string|null;setItem(key:string,value:string):void;}
interface Keys {namespace:string;primary:string;backup:string;legacy:readonly string[];oldBackups:readonly string[];}
interface StoryStorage {load():{value?:unknown;error?:string};write(payload:Record<string,unknown>,force?:boolean):boolean;backup(payload:Record<string,unknown>):boolean;recovery():unknown;}
interface StorageClass {
 new(provider:()=>StoragePort,validate:(input:unknown)=>unknown,keys:Keys):StoryStorage;
 readonly LEGACY_NAMESPACE:string;namespace(profile:unknown):string;keys(namespace:string):Keys;
 scopedKey(namespace:string,key:string):string;scoped(provider:()=>StoragePort,namespace:string):()=>StoragePort;
}
interface Capability {available:boolean;reason?:string;}
interface PauseApi {create(provider:()=>StoragePort):{readonly pauseOnOpen:boolean;set(value:boolean):{persisted:boolean}};KEY:string;}

const Storage=require('./story-storage.js') as StorageClass;
const Pause=require('./interface-pause.js') as PauseApi;
const results:Array<{name:string;passed:boolean;error?:string}>=[];
const pending:Array<Promise<void>>=[];
function test(name:string,action:()=>void|Promise<void>):void{
 const record=(error?:unknown):void=>{if(error===undefined)results.push({name,passed:true});else{results.push({name,passed:false,error:String(error)});console.error(name,error);}};
 try{const value=action();if(value instanceof Promise)pending.push(value.then(()=>record(),error=>record(error??'rejected')));else record();}
 catch(error){record(error??'thrown');}
}
function memory():{data:Map<string,string>;provider:()=>StoragePort}{
 const data=new Map<string,string>();
 return {data,provider:()=>({getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,value);}})};
}
const validate=(input:unknown):Record<string,unknown>=>{const value=(typeof input==='string'?JSON.parse(input):input) as Record<string,unknown>;assert.equal(value.version,10);return value;};

test('Legacy littlewild storage namespace keeps the exact v5 save, backup and migration keys',()=>{
 const legacy={namespace:'littlewild',primary:'littlewild.save.v5',backup:'littlewild.backup.v5',
  legacy:['littlewild.save.v4','littlewild.save.v3','littlewild.save.v2','littlewild.save.v1'],oldBackups:['littlewild.backup.v3']};
 for(const profile of [undefined,null,{},{storage:{}},{storage:{namespace:'littlewild'}}])assert.deepEqual(Storage.keys(Storage.namespace(profile)),legacy);
 assert.equal(Storage.LEGACY_NAMESPACE,'littlewild');
});
test('A configured game storage namespace scopes saves and never migrates another game story',()=>{
 const shared=memory();shared.data.set('littlewild.save.v5',JSON.stringify({version:10,savedAt:null,game:'littlewild'}));
 const keys=Storage.keys(Storage.namespace({storage:{namespace:'wildlands.emberworks'}}));
 assert.deepEqual(keys,{namespace:'wildlands.emberworks',primary:'wildlands.emberworks.save.v5',backup:'wildlands.emberworks.backup.v5',legacy:[],oldBackups:[]});
 const storage=new Storage(shared.provider,validate,keys);
 assert.deepEqual(storage.load(),{value:null});
 assert(storage.write({version:10,savedAt:null,game:'emberworks'}));
 assert(storage.backup({version:10,savedAt:null,game:'emberworks'}));
 assert.equal(JSON.parse(shared.data.get('littlewild.save.v5')!).game,'littlewild');
 assert.equal(JSON.parse(shared.data.get('wildlands.emberworks.save.v5')!).game,'emberworks');
 assert.equal(JSON.parse(shared.data.get('wildlands.emberworks.backup.v5')!).game,'emberworks');
 assert.throws(()=>new Storage(memory().provider,validate,keys).recovery(),/no recovery copy/);
});
test('Two games sharing one file origin keep independent saves and recovery copies',()=>{
 const shared=memory();
 const office=new Storage(shared.provider,validate,Storage.keys('wildlands.office'));
 const littlewild=new Storage(shared.provider,validate,Storage.keys(Storage.namespace(undefined)));
 office.write({version:10,savedAt:null,game:'office'});littlewild.write({version:10,savedAt:null,game:'littlewild'});
 office.backup({version:10,savedAt:null,game:'office-backup'});
 assert.equal((office.load().value as {game:string}).game,'office');
 assert.equal((littlewild.load().value as {game:string}).game,'littlewild');
 assert.equal((office.recovery() as {game:string}).game,'office-backup');
 assert.throws(()=>littlewild.recovery(),/no recovery copy/);
 assert.deepEqual([...shared.data.keys()].sort(),['littlewild.save.v5','wildlands.office.backup.v5','wildlands.office.save.v5']);
});
test('Invalid game storage namespaces are rejected with an actionable message',()=>{
 for(const namespace of ['','Wildlands.Office','../escape','wildlands..office','wildlands.office.','-x','a'.repeat(65),42,true,{}])
  assert.throws(()=>Storage.namespace({storage:{namespace}}),/Invalid game storage namespace\. Use 1-64 lowercase letters/);
 assert.throws(()=>Storage.keys('Bad Namespace'),/Invalid game storage namespace/);
});
test('Scoped device preferences follow the game namespace while littlewild keeps its keys',()=>{
 assert.equal(Storage.scopedKey('littlewild','littlewild.interface.v1'),'littlewild.interface.v1');
 assert.equal(Storage.scopedKey('wildlands.office','littlewild.interface.v1'),'wildlands.office.interface.v1');
 assert.equal(Storage.scopedKey('wildlands.office','camera'),'wildlands.office.camera');
 const shared=memory();
 Pause.create(Storage.scoped(shared.provider,'wildlands.office')).set(false);
 Pause.create(Storage.scoped(shared.provider,'littlewild')).set(true);
 assert.equal(JSON.parse(shared.data.get('wildlands.office.interface.v1')!).pauseOnOpen,false);
 assert.equal(JSON.parse(shared.data.get(Pause.KEY)!).pauseOnOpen,true);
 assert.equal(Pause.create(Storage.scoped(shared.provider,'wildlands.office')).pauseOnOpen,false);
 assert.equal(Pause.create(Storage.scoped(shared.provider,'littlewild')).pauseOnOpen,true);
});
test('Denied browser storage under a game namespace still reports session-only preferences',()=>{
 const preferences=Pause.create(Storage.scoped(()=>{throw Error('denied');},'wildlands.office'));
 assert.equal(preferences.pauseOnOpen,true);assert.equal(preferences.set(false).persisted,false);
});

/** Run compiled browser modules in an isolated global without CommonJS, as a play-only page would. */
function browserContext(globals:Record<string,unknown>,modules:readonly string[]):Record<string,unknown>{
 const context=vm.createContext({TextEncoder,TextDecoder,atob,btoa,Blob,DecompressionStream,crypto:globalThis.crypto,console,...globals});
 for(const file of modules)vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),context,{filename:file});
 return context as Record<string,unknown>;
}
const project={format:'wildlands-project',schemaVersion:1,id:'demo',name:'Demo',target:'godot',scenarioId:'demo',sceneId:'home',pack:{scenes:[{id:'home'}]}};
const projectValidator={validate:(input:unknown)=>({ok:true,project:input,errors:[]})};
interface Godot {capability():Capability;compile(input:unknown):Promise<unknown>;}
const godotIn=(globals:Record<string,unknown>):Godot=>browserContext(globals,['wildlands-godot.js']).WildlandsGodot as Godot;

test('Godot export declares an unavailable capability when the runtime payload is absent',async()=>{
 const godot=godotIn({WildlandsProject:projectValidator,WildlandsGodotTemplates:{'main.gd':'x'}});
 const capability=godot.capability();
 assert.equal(capability.available,false);assert.match(capability.reason!,/trusted Godot runtime payload is not included/);
 await assert.rejects(godot.compile(project),/Godot export is unavailable in this build: the trusted Godot runtime payload is not included/);
});
test('Godot export names missing templates and a missing project validator explicitly',async()=>{
 const loader={encoding:'gzip-base64',decodedBytes:2,data:zlib.gzipSync('{}').toString('base64')};
 const noTemplates=godotIn({WildlandsProject:projectValidator,WildlandsGodotRuntimeLoader:loader});
 assert.match(noTemplates.capability().reason!,/Godot scene templates are not included/);
 await assert.rejects(noTemplates.compile(project),/Godot scene templates are not included/);
 const noValidator=godotIn({WildlandsGodotRuntimeLoader:loader,WildlandsGodotTemplates:{}});
 assert.match(noValidator.capability().reason!,/Wildlands project validator is not included/);
 assert.equal(JSON.stringify(godotIn({WildlandsProject:projectValidator,WildlandsGodotRuntimeLoader:loader,WildlandsGodotTemplates:{}}).capability()),'{"available":true}');
});
test('Godot export that needs shared engine sources fails with the opt-in payload message',async()=>{
 const runtime=JSON.stringify({format:'wildlands-runtime-bundle',schemaVersion:1,sharedEngineSources:true,files:[]});
 const loader={encoding:'gzip-base64',decodedBytes:Buffer.byteLength(runtime),data:zlib.gzipSync(runtime).toString('base64')};
 const godot=godotIn({WildlandsProject:projectValidator,WildlandsGodotRuntimeLoader:loader,WildlandsGodotTemplates:{}});
 await assert.rejects(godot.compile(project),/Shared trusted engine sources are unavailable\. Godot export needs the engine-source payload, which is not included in this build/);
});

interface EngineExport {capability():Capability;export(pack:unknown,sceneId:string):Promise<unknown>;validate(input:unknown):Promise<{ok:boolean;errors:string[]}>;}
function exportIn(globals:Record<string,unknown>):EngineExport&{realm(input:unknown):unknown}{
 const context=browserContext({LWEngineExportManifest:{},LWScenarios:{},...globals},['engine-export-data.js','engine-export.js']);
 // Plain JSON values must belong to the isolated page realm, as a decoded upload would.
 return Object.assign(context.LWEngineExport as EngineExport,{realm:(input:unknown)=>vm.runInContext('('+JSON.stringify(input)+')',context)});
}
const exportShape={format:'littlewild-engine-export',schemaVersion:1,sourceIdentity:'x',sources:{},extensions:{},pack:{},sceneId:'home',checkpoint:{},catalogs:{},runtime:{},godot:{},limitations:[]};

test('Engine export declares the absent engine-source payload without inflating anything',async()=>{
 const engineExport=exportIn({});
 const capability=engineExport.capability();
 assert.equal(capability.available,false);assert.match(capability.reason!,/trusted engine-source payload is not included/);
 const checked=await engineExport.validate(engineExport.realm(exportShape));
 assert.equal(checked.ok,false);assert.match(checked.errors.join(' '),/Engine export is unavailable in this build: the trusted engine-source payload is not included/);
 assert.equal(exportIn({LWEngineSourceLoader:{format:'littlewild-engine-source-loader'}}).capability().available,true);
});
test('Engine export in the node composition reports its bundled sources as available',()=>{
 const engineExport=require('./engine-export.js') as EngineExport;
 assert.deepEqual(engineExport.capability(),{available:true});
});

interface Toolbox {
 capabilities():Array<{id:string;label:string;available:boolean;reason?:string}>;
 engineExport:EngineExport&{maxBytes:number};balancing:{defaults():unknown};storytelling:{sample():unknown};
 createCreatureEditor(input:unknown,selection:unknown):unknown;externalEditors:{formats():unknown};
 renderers:{list():unknown[]};animations:{list():unknown[]};create(options:{scenarioId:string}):{dispose?():void};
}
const OPTIONAL=['LWEngineExport','LWBalancing','LWDeveloperStorytelling','LWDeveloperCreatures','LWExternalEditors'] as const;
function freshToolbox():Toolbox{
 const file=require.resolve('./developer-toolbox.js');delete require.cache[file];
 return require('./developer-toolbox.js') as Toolbox;
}
test('Developer toolbox reports every optional facet available in the complete composition',()=>{
 const toolbox=(require('./developer-sdk.cjs') as {toolbox:Toolbox}).toolbox;
 const capabilities=toolbox.capabilities();
 assert.deepEqual(capabilities.map(entry=>entry.id),['engineExport','balancing','storytelling','creatureEditor','externalEditors','animations','renderers']);
 assert(capabilities.every(entry=>entry.available&&entry.reason===undefined&&entry.label.length>0),JSON.stringify(capabilities));
});
test('Developer toolbox keeps absent editor and export facets explicit instead of failing obscurely',async()=>{
 require('./developer-sdk.cjs');
 const scope=globalThis as Record<string,unknown>,saved=OPTIONAL.map(name=>[name,scope[name]] as const);
 try{
  for(const name of OPTIONAL)delete scope[name];
  const toolbox=freshToolbox();
  const missing=toolbox.capabilities().filter(entry=>!entry.available);
  assert.deepEqual(missing.map(entry=>entry.id),['engineExport','balancing','storytelling','creatureEditor','externalEditors']);
  assert(missing.every(entry=>/capability is unavailable in this build: the (editors|export) bundle is not included\./.test(entry.reason??'')));
  const named=(pattern:RegExp)=>(error:unknown)=>error instanceof Error&&(error as {code?:string}).code==='operation-failed'&&pattern.test(error.message);
  assert.throws(()=>toolbox.balancing.defaults(),named(/balancing tools capability is unavailable.*editors bundle/));
  assert.throws(()=>toolbox.storytelling.sample(),named(/storytelling tools capability is unavailable/));
  assert.throws(()=>toolbox.createCreatureEditor({},{sceneId:'home',archetypeId:'sproutling'}),named(/creature editor capability is unavailable/));
  assert.throws(()=>toolbox.externalEditors.formats(),named(/external editor exchange capability is unavailable/));
  await assert.rejects(toolbox.engineExport.export({},'home'),named(/engine export capability is unavailable.*export bundle/));
  assert.equal((await toolbox.engineExport.validate({})).ok,false);
  assert.equal(toolbox.engineExport.capability().available,false);
  // Core simulation facets and renderer discovery remain usable without the optional bundles.
  assert(toolbox.renderers.list().length>0);
  const session=toolbox.create({scenarioId:'littlewild'});session.dispose?.();
 }finally{
  for(const [name,value] of saved)scope[name]=value;
  freshToolbox();
 }
});

void Promise.all(pending).then(()=>{
 const report={passed:results.filter(result=>result.passed).length,total:results.length,results};
 fs.writeFileSync(path.join(__dirname,'runtime-optionality-results.json'),JSON.stringify(report,null,2)+'\n');
 console.log(report.passed+'/'+report.total+' runtime optionality checks passed');
 if(report.passed!==report.total)process.exitCode=1;
});
