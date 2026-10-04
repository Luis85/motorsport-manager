import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {projects,runProject,editProject,inspectProject,discover,toolbox} from './wildlands-project-sdk.cjs';
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const littlewild=projects.create();
test('Default project is a complete detached Littlewild prototype',()=>{
 assert.equal(littlewild.format,'wildlands-project');assert.equal(littlewild.target,'godot');assert.equal(littlewild.scenarioId,'littlewild');assert.equal(littlewild.sceneId,'first-morning');assert.equal(littlewild.pack.scenes.length,2);
 const changed=projects.create();changed.pack.name='Changed';assert.notEqual(projects.create().pack.name,'Changed');
 const checked=projects.validate(littlewild);assert(checked.ok);assert.equal(projects.validate(JSON.stringify(littlewild)).ok,true);assert(checked.fingerprint);
});
test('Versioned discovery describes useful portable and bounded agent operations',()=>{
 const found=discover();assert.equal(found.protocolVersion,1);assert.equal(found.projectSchemaVersion,1);assert.deepEqual(found.scenarios.map(value=>value.id),['littlewild','emberworks','office']);
 assert(found.operations.find(value=>value.operation==='edit'));assert(found.operations.find(value=>value.operation==='compile'));assert(found.commands.length>40);assert.equal(found.recipes.maxSteps,36000);
});
test('Project fields, target, identity and scene selection are validated strictly',()=>{
 for(const patch of [{schemaVersion:2},{target:'unity'},{extra:true},{scenarioId:'office'},{sceneId:'missing'},{id:'../path'},{name:''}])assert.equal(projects.validate({...littlewild,...patch}).ok,false);
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
const report={suite:'wildlands-project',passed:results.filter(value=>value.passed).length,total:results.length,results};fs.writeFileSync(path.join(__dirname,'wildlands-project-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(results.some(value=>!value.passed))process.exitCode=1;
