// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {gunzipSync} from 'node:zlib';
import {writeWildlandsBundle,runtimeClosure,RUNTIME_ROOTS,INSTALLER_SHIM} from './tools/wildlands-bundle.cjs';
import {profile as installed} from './test-support/install-games.cjs';
import {projects,runProject,editProject,inspectProject,discover,toolbox} from './wildlands-project-sdk.cjs';
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const littlewild=projects.create();
test('Default project is a complete detached Littlewild prototype',()=>{
 assert.equal(littlewild.format,'wildlands-project');assert.equal(littlewild.target,'godot');assert.equal(littlewild.scenarioId,'littlewild');assert.equal(littlewild.sceneId,'first-morning');assert.equal(littlewild.pack.scenes.length,2);
 const changed=projects.create();changed.pack.name='Changed';assert.notEqual(projects.create().pack.name,'Changed');
 // schemaVersion 2: the installed game is embedded and detached from the realm's profile.
 assert.equal(littlewild.schemaVersion,2);assert.equal(littlewild.game.id,installed.id);assert.notEqual(littlewild.game.profile,installed);
 const checked=projects.validate(littlewild);assert(checked.ok);assert.equal(projects.validate(JSON.stringify(littlewild)).ok,true);assert(checked.fingerprint);
 const text=projects.validate(JSON.stringify(littlewild)),renamed=projects.validate({...littlewild,name:'Renamed'});assert(text.ok&&renamed.ok);assert.match(checked.fingerprint,/^[0-9a-f]{16}$/);assert.equal(text.fingerprint,checked.fingerprint);assert.notEqual(renamed.fingerprint,checked.fingerprint);
});
test('Versioned discovery describes useful portable and bounded agent operations',()=>{
 const found=discover();assert.equal(found.protocolVersion,1);assert.equal(found.projectSchemaVersion,2);assert.deepEqual(found.legacySchemaVersions,[1]);
 assert.equal(found.game?.id,installed.id);assert.equal(found.game?.defaultScenario,'littlewild');assert.deepEqual(found.game?.scenarios.map(value=>value.id),['littlewild','emberworks','office']);
 for(const operation of ['create','upgrade','validate-game','inspect-game','build-game'])assert(found.operations.find(value=>value.operation===operation),operation);
 assert(found.operations.find(value=>value.operation==='edit'));assert(found.operations.find(value=>value.operation==='compile'));assert(found.commands.length>40);assert.equal(found.recipes.maxSteps,36000);
});
test('Project fields, target, identity and scene selection are validated strictly',()=>{
 for(const patch of [{schemaVersion:3},{schemaVersion:1},{target:'unity'},{extra:true},{scenarioId:'office'},{sceneId:'missing'},{id:'../path'},{name:''}])assert.equal(projects.validate({...littlewild,...patch}).ok,false);
 const broken=clone(littlewild);delete (broken as unknown as Record<string,unknown>).name;assert.equal(projects.validate(broken).ok,false);
 assert.equal(projects.validate('{').ok,false);assert.throws(()=>projects.create({scenarioId:'unknown'}),/Unknown scenario/);
 assert.throws(()=>projects.create({unknown:true} as Wildlands.CreateOptions),/unknown fields/);
});
test('Authoritative scenario validation rejects semantic world corruption',()=>{
 const broken=clone(littlewild);broken.pack.scenes[0]!.initialState.player={level:0,xp:0,coins:0};assert.equal(projects.validate(broken).ok,false);
});
test('Scenario switching preserves project identity and supports portable custom packs',()=>{
 const office=projects.select(littlewild,'office');assert.equal(office.scenarioId,'office');assert.equal(office.id,littlewild.id);assert.equal(office.name,littlewild.name);
 const pack=clone(littlewild.pack);pack.id='my-prototype';pack.name='Custom prototype';const custom=projects.create({pack});assert.equal(custom.scenarioId,'my-prototype');
 assert.equal(projects.select(custom,'my-prototype',pack.scenes[1]!.id).sceneId,pack.scenes[1]!.id);
 assert.throws(()=>projects.create({pack,scenarioId:'littlewild'}),/must match/);assert.throws(()=>projects.select(custom,'missing'),/Unknown scenario/);
});
const recipe={format:'wildlands-recipe',schemaVersion:1,operations:[{operation:'start'},{operation:'advance',seconds:1},{operation:'inspect'}]};
test('Deterministic bounded recipes capture changed state without losing authored scenes',()=>{
 const first=runProject(littlewild,recipe),second=runProject(littlewild,recipe);assert.equal(first.requestedSteps,10);assert(Math.abs(first.advancedSeconds-1)<1e-9);assert.deepEqual(first.snapshot,second.snapshot);assert.deepEqual(first.project,second.project);
 assert.equal(first.project.pack.scenes.length,littlewild.pack.scenes.length);assert.deepEqual(first.project.pack.scenes[1],littlewild.pack.scenes[1]);assert.equal(projects.validate(first.project).ok,true);
 assert.notDeepEqual(first.project.pack.scenes[0]!.initialState,littlewild.pack.scenes[0]!.initialState);assert.equal(littlewild.pack.scenes[0]!.initialState.simTime,0);
});
test('Paused steps report requested clock work independently from actual advancement',()=>{
 const result=runProject(littlewild,{format:'wildlands-recipe',schemaVersion:1,operations:[{operation:'pause'},{operation:'step',count:10}]});assert.equal(result.requestedSteps,10);assert.equal(result.advancedSeconds,0);
});
test('Capture preserves every scene in all three built-in prototypes',()=>{
 for(const builtin of projects.scenarios()){
  const original=projects.create({scenarioId:builtin.id}),played=runProject(original,recipe);
  assert.deepEqual(played.project.pack.scenes.map(value=>value.id),original.pack.scenes.map(value=>value.id));
  for(const authored of original.pack.scenes.filter(value=>value.id!==original.sceneId))assert.deepEqual(played.project.pack.scenes.find(value=>value.id===authored.id),authored);
  assert.equal(projects.validate(played.project).ok,true);
 }
});
test('Shared capture preserves a third authored scene and timeline metadata',()=>{
 const pack=clone(littlewild.pack),third=clone(pack.scenes[1]!);third.id='third-meadow';third.name='Third meadow';pack.scenes.push(third);
 pack.storytelling={version:1,cutscenes:[{id:'arrival',name:'Arrival',sceneId:pack.scenes[0]!.id,duration:2,skipPolicy:'finish',tracks:[],events:[{id:'hello',time:1,event:{type:'message',text:'Welcome'}}]}],storyboards:[{id:'journey',name:'Journey',shots:[{id:'opening',name:'Opening',sceneId:pack.scenes[0]!.id,cutsceneId:'arrival',narrative:'Our authored story'}]}]};
 const authored=projects.create({pack}),session=toolbox.createScenario(pack,authored.sceneId);
 let captured:unknown;
 try{session.start();session.advance(.5);captured=session.captureScenario();}finally{session.dispose();}
 const next=projects.capture(authored,captured);assert.equal(next.pack.scenes.length,3);assert.deepEqual(next.pack.storytelling,authored.pack.storytelling);assert.deepEqual(next.pack.scenes[2],authored.pack.scenes[2]);assert.equal(projects.validate(next).ok,true);
 const wrong=clone((captured as LWContentPorts.ScenarioPack));wrong.id='wrong-prototype';assert.throws(()=>projects.capture(authored,wrong),/identity/);
 assert.throws(()=>projects.capture(authored,captured,'missing'),/does not exist/);assert.deepEqual(authored.pack,pack);
});
test('Recipe count, clock bounds and reflection are rejected before opening sessions',()=>{
 const bad=[{operations:[{operation:'advance',seconds:.15}]},{operations:[{operation:'step',count:36001}]},{operations:[{operation:'step',count:36000},{operation:'step',count:1}]},{operations:[{operation:'eval',script:'bad'}]},{operations:[{operation:'inspect',extra:true}]},{operations:Array.from({length:257},()=>({operation:'inspect'}))},{schemaVersion:2}];
 for(const patch of bad)assert.throws(()=>runProject(littlewild,{...recipe,...patch}));assert.equal(inspectProject(littlewild).snapshot.scenarioId,'littlewild');
});
test('Rejected native commands release their session and preserve input project',()=>{
 const before=clone(littlewild);assert.throws(()=>runProject(littlewild,{format:'wildlands-recipe',schemaVersion:1,operations:[{operation:'command',command:{id:'care',actorId:'c999',args:['feed']}}]}),/Command rejected/);
 assert.deepEqual(littlewild,before);assert.equal(inspectProject(littlewild).snapshot.scenarioId,'littlewild');
});
test('Scene authoring recipes use native revisions and validators',()=>{
 const edited=editProject(littlewild,{format:'wildlands-editor-recipe',schemaVersion:1,operations:[{operation:'updateScene',args:['first-morning',{name:'My meadow'}]}]});assert.equal(edited.project.pack.scenes[0]!.name,'My meadow');assert.equal(edited.revision,1);assert.equal(projects.validate(edited.project).ok,true);assert.notEqual(littlewild.pack.scenes[0]!.name,'My meadow');
 assert.throws(()=>editProject(littlewild,{format:'wildlands-editor-recipe',schemaVersion:1,operations:[{operation:'__proto__',args:[]}]}));
 assert.throws(()=>editProject(littlewild,{format:'wildlands-editor-recipe',schemaVersion:1,operations:[{operation:'updateScene',args:['missing',{}]}]}));
});
test('Runtime builds preserve owned data and ignore generated verification artifacts and stale executables',()=>{
 const source=path.resolve(__dirname,'../source'),directory=fs.mkdtempSync(path.join(path.resolve(__dirname,'..'),'.wildlands-bundle-test-'));
 const expected=fs.readFileSync(path.join(__dirname,'wildlands-runtime-bundle.json'),'utf8');
 const bundle=JSON.parse(expected) as {files:{path:string;content:string}[]};
 try{
  for(const file of bundle.files){const target=path.join(directory,file.path.slice('runtime/'.length));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,file.content);}
  writeWildlandsBundle(source,directory);assert.equal(fs.readFileSync(path.join(directory,'wildlands-runtime-bundle.json'),'utf8'),expected);
  const loader=fs.readFileSync(path.join(directory,'wildlands-runtime-loader.json'),'utf8');
  fs.writeFileSync(path.join(directory,'earned-progression-story.json'),JSON.stringify({format:'test-checkpoint',state:{simTime:12}}));
  fs.writeFileSync(path.join(directory,'stale-runtime.js'),'module.exports = "retired source";');
  fs.mkdirSync(path.join(directory,'runtime'));fs.writeFileSync(path.join(directory,'runtime','another-checkpoint.json'),'{}');
  writeWildlandsBundle(source,directory);assert.equal(fs.readFileSync(path.join(directory,'wildlands-runtime-bundle.json'),'utf8'),expected);
  assert.equal(fs.readFileSync(path.join(directory,'wildlands-runtime-loader.json'),'utf8'),loader);
  // Owned data is engine data only: the bundle carries no game content (projects embed their game).
  assert(bundle.files.some(file=>file.path==='runtime/content/scenario.schema.json'));
  for(const name of ['asset-definitions.json','creature-definitions.json','creature-config.json','content/balancing.json','content/littlewild.pack.json'])assert(!bundle.files.some(file=>file.path==='runtime/'+name),name);
  // The native export rejects test files (test-wildlands-godot); runtime installers must live outside test-support.
  assert.equal(bundle.files.find(file=>file.path==='runtime/content-installers/littlewild-game.cjs')?.content,INSTALLER_SHIM);assert(!bundle.files.some(file=>file.path.includes('test-')),'Godot runtime closure contains test code');
  const data=path.join(directory,'content','scenario.schema.json'),changed=fs.readFileSync(data,'utf8')+'\n';fs.writeFileSync(data,changed);
  writeWildlandsBundle(source,directory);const updated=JSON.parse(fs.readFileSync(path.join(directory,'wildlands-runtime-bundle.json'),'utf8')) as {files:{path:string;content:string}[]};
  assert.equal(updated.files.find(file=>file.path==='runtime/content/scenario.schema.json')?.content,changed);assert.equal(updated.files.length,bundle.files.length);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('Godot runtime bundle is exactly the static require closure of the bridge entry points',()=>{
 const source=path.resolve(__dirname,'../source'),text=fs.readFileSync(path.join(__dirname,'wildlands-runtime-bundle.json'),'utf8');
 const bundle=JSON.parse(text) as {format:string;sharedEngineSources?:boolean;files:{path:string;content:string}[]},paths=bundle.files.map(file=>file.path.slice('runtime/'.length));
 assert.deepEqual([...paths].sort(),[...runtimeClosure(source,__dirname)].sort());for(const root of RUNTIME_ROOTS)assert(paths.includes(root),root);
 // Browser presentation, other templates, opt-in engine sources, unrequired generated data and test fixtures stay out.
 for(const excluded of ['engine-source-bundle.json','scenario-v3-grown.json','interaction-library.json','asset-definitions.json','content-installers/littlewild-game.js','ui.js','world-3d.js','colony-ui.js','scenario-ui.js','wildlands-ui.js','play-boot.js','rts-host.js','pet-host.js','wildlands-godot.js','wildlands-sdk.cjs','tools/wildlands-cli.cjs'])assert(!paths.includes(excluded),excluded);
 assert(paths.length<160);assert.equal(bundle.sharedEngineSources,undefined);
 const loader=JSON.parse(fs.readFileSync(path.join(__dirname,'wildlands-runtime-loader.json'),'utf8')) as {decodedBytes:number;data:string};assert.equal(gunzipSync(Buffer.from(loader.data,'base64')).toString(),text);assert.equal(loader.decodedBytes,Buffer.byteLength(text));
 // Isolate generated fixtures from concurrent architecture scans of authored source.
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'wildlands-closure-test-'));
 try{
  for(const file of bundle.files){const target=path.join(directory,file.path.slice('runtime/'.length));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,file.content);}
  const entry=path.join(directory,'tools/wildlands-runtime.cjs'),original=fs.readFileSync(entry,'utf8');
  for(const [addition,error] of [['\nrequire(process.env.WILDLANDS_PLUGIN);',/non-literal require/],['\nconsole.log(__dirname);',/__dirname/],['\nvoid import("./engine.js");',/dynamic import\(\)/],['\nrequire("./missing-runtime-module.js");',/requires tools\/missing-runtime-module\.js, which is not an authored or generated runtime file/],['\nrequire("../../escape.js");',/outside the runtime/]] as const){
   fs.writeFileSync(entry,original+addition);assert.throws(()=>writeWildlandsBundle(source,directory),error);
  }
  fs.writeFileSync(entry,original);writeWildlandsBundle(source,directory);assert.equal(fs.readFileSync(path.join(directory,'wildlands-runtime-bundle.json'),'utf8'),text);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('Schema version 2 projects embed the colony sections of the installed game and round-trip',()=>{
 const sections=Object.keys(littlewild.game.profile).sort();
 assert.deepEqual(sections,['assets','balancing','creatures','format','id','librarySchema','scenarios','version'].filter(key=>key in installed).sort());
 assert(!('rts' in littlewild.game.profile)&&!('pet' in littlewild.game.profile),'RTS and Pocket Pet catalogs are not project content');
 assert.deepEqual(clone(littlewild.game.profile.balancing),clone(installed.balancing));
 const text=JSON.stringify(littlewild),roundTrip=projects.validate(text);assert(roundTrip.ok);assert.deepEqual(roundTrip.project,JSON.parse(text));
 assert.equal(roundTrip.fingerprint,(projects.validate(littlewild) as Extract<Wildlands.Validation,{ok:true}>).fingerprint);
 // The fingerprint covers the whole document, the embedded game included.
 const tuned=clone(littlewild);(tuned.game.profile as unknown as {storage?:unknown}).storage={namespace:'wildlands.tuned'};
 const retuned=projects.validate(tuned);assert(retuned.ok);assert.notEqual(retuned.fingerprint,roundTrip.fingerprint);
 const rejected:[string,(doc:Record<string,unknown>&{game:Record<string,unknown>&{profile:Record<string,unknown>}})=>void,RegExp][]=[
  ['missing game',doc=>{delete (doc as Record<string,unknown>).game;},/missing or unknown fields/],
  ['extra game field',doc=>{doc.game.extra=true;},/game has missing or unknown fields/],
  ['profile id mismatch',doc=>{doc.game.profile.id='other-game';},/whose id is/],
  ['newer profile',doc=>{doc.game.profile.version=2;},/version 1/],
  ['RTS section',doc=>{doc.game.profile.rts={};},/does not embed: rts/],
  ['no scenario catalog',doc=>{delete doc.game.profile.scenarios;},/no scenario catalog/],
  ['another game',doc=>{doc.game.id='office';doc.game.profile.id='office';},/embeds the game office, but this runtime runs/]
 ];
 for(const [name,change,error] of rejected){const doc=clone(littlewild) as unknown as Parameters<typeof change>[0];change(doc);const checked=projects.validate(doc);assert.equal(checked.ok,false,name);assert.match(checked.errors.join(' '),error,name);}
});
test('Legacy schemaVersion 1 projects stay readable and every write upgrades them to the installed game',()=>{
 const {game:_game,...rest}=littlewild,legacy={...rest,schemaVersion:1} as Wildlands.LegacyProject;
 const checked=projects.validate(JSON.stringify(legacy));assert(checked.ok);assert.equal(checked.project.schemaVersion,1);assert(!('game' in checked.project));
 assert.notEqual(checked.fingerprint,(projects.validate(littlewild) as Extract<Wildlands.Validation,{ok:true}>).fingerprint);
 assert.equal(projects.validate({...legacy,game:littlewild.game}).ok,false);
 const upgraded=projects.upgrade(legacy);assert.deepEqual(upgraded,littlewild);assert.deepEqual(projects.upgrade(littlewild),littlewild);
 assert.equal(projects.select(legacy,'littlewild','charted-home').schemaVersion,2);
 assert.equal(runProject(legacy,recipe).project.schemaVersion,2);assert.equal(inspectProject(legacy).project.schemaVersion,1);
});
test('Engine distributions install no game: the engine-only installer leaves the game to its entry point',()=>{
 const engine=require('./tools/engine-installer.cjs') as typeof import('./tools/engine-installer.cjs');
 assert.equal(engine.installLittlewild(),installed);assert.equal(engine.installTemplate('pet'),installed);assert.equal(engine.petAssets(),undefined);
 for(const make of [engine.littlewildProfile,engine.rtsProfile,engine.petProfile])assert.throws(()=>make(),/carries no game content/);
 assert.equal(engine.contentProvider(),require('./content-provider.js'));
 assert.match(INSTALLER_SHIM,/^"use strict";\n\/\/ Engine distributions carry no game[^\n]*\nmodule\.exports = require\("\.\.\/tools\/engine-installer\.cjs"\);\n$/);
});
const report={suite:'wildlands-project',passed:results.filter(value=>value.passed).length,total:results.length,results};fs.writeFileSync(path.join(__dirname,'wildlands-project-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(results.some(value=>!value.passed))process.exitCode=1;
