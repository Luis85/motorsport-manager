/// <reference path="./developer-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import ts from 'typescript';
import {toolbox, type Session} from './developer-sdk.cjs';
const results:Array<{name:string;passed:boolean;error?:string}>=[];
function test(name:string,work:()=>void):void {
 try{work();results.push({name,passed:true});}
 catch(error){results.push({name,passed:false,error:error instanceof Error?error.stack??error.message:String(error)});console.error(name,error);}
}
function withSession(work:(session:Session)=>void,scenarioId='littlewild',sceneId?:string):void {
 const options=sceneId===undefined?{scenarioId}:{scenarioId,sceneId};
 const session=toolbox.create(options);try{work(session);}finally{session.dispose();}
}
const runtime=globalThis as unknown as {
 LWDeveloperSession:{claimHost():{dispose():void}};
 LWScenarios:{commitScene(preview:unknown):unknown;prepareScene(input:unknown,id:string):unknown;builtins():Array<{id:string;scenes:Array<{id:string}>}>};
};
const clone=(value:unknown):unknown=>JSON.parse(JSON.stringify(value)) as unknown;

test('Scenario and command discovery publish detached useful contracts',()=>{
 const scenarios=toolbox.scenarios();assert.deepEqual(scenarios.map(p=>p.id),['littlewild','emberworks','office']);
 assert(scenarios.filter(pack=>pack.id!=='office').every(pack=>pack.scenes.length===2));assert(scenarios.find(pack=>pack.id==='office')?.scenes.length);
 assert.equal(toolbox.commands().find(c=>c.id==='cancel-lesson')?.maxArgs,1);
 const first=scenarios[0];assert(first);(first as {name:string}).name='changed';
 assert.notEqual(toolbox.scenarios()[0]?.name,'changed');
 assert(toolbox.commands().every(command=>!Object.hasOwn(command,'method')));
});
test('Unknown scenarios, scenes and options fail before acquiring a session',()=>{
 assert.throws(()=>toolbox.create({scenarioId:'missing'}),/Unknown scenario/);
 assert.throws(()=>toolbox.create({scenarioId:'littlewild',sceneId:'missing'}),/scene/i);
 assert.throws(()=>toolbox.create({scenarioId:'littlewild',extra:true} as LittlewildDeveloper.CreateOptions),/unknown fields/);
 withSession(session=>assert.equal(session.disposed,false));
});
test('Explicit session ownership rejects replacement without changing the live world',()=>withSession(session=>{
 const before=session.story();assert.throws(()=>toolbox.create({scenarioId:'emberworks'}),/session is active/);
 assert.deepEqual(session.story(),before);
 assert.throws(()=>toolbox.openStory(toolbox.reviewStory(before)),/session is active/);
 assert.deepEqual(session.story(),before);
}));
test('Lifecycle uses the native started and pause gates with fixed steps',()=>withSession(session=>{
 const initial=session.inspect();assert.equal(session.advance(.2).advancedSeconds,initial.started&&!initial.paused?.2:0);
 session.start();assert(session.step(10).advancedSeconds>.99);
 session.pause();const paused=session.save();assert.equal(session.advance(2).advancedSeconds,0);assert.deepEqual(session.save(),paused);
 session.resume();assert(session.advance(.5).advancedSeconds>.49);
}));
test('Bounded time input rejects malformed values without advancing or consuming RNG',()=>withSession(session=>{
 session.start();const before=session.story();
 for(const count of [-1,.5,36001,NaN,Infinity])assert.throws(()=>session.step(count),/step count/);
 for(const seconds of [-.1,.15,3600.1,NaN,Infinity])assert.throws(()=>session.advance(seconds),/multiple of 0.1/);
 assert.deepEqual(session.story(),before);assert.equal(session.step(0).advancedSeconds,0);
}));
test('All command envelope validation runs before mutation or accessors',()=>withSession(session=>{
 const before=session.story();let reads=0;
 const invalid:unknown[]=[{id:'script',args:[]},{id:'care',actorId:'c1',args:[]},
  {id:'care',actorId:'c1',args:[()=>42]},{id:'care',actorId:'c1',args:['feed'],extra:true},
  {id:'place-building',actorId:'c1',args:['shelter',NaN,3]},
  {id:'care',actorId:'c1',args:[{get execute(){reads++;return true;}}]},
  {get id(){reads++;return 'care';},actorId:'c1',args:['feed']},
  {id:'pause-plan',actorId:'c1',args:['o1',false]},
  {id:'configure-building',args:['b1','enabled','yes']},
  {id:'configure-building',args:['b1','batch',{recipe:'planks',amount:1,extra:true}]},
  {id:'control-sale',args:['sale1','cancel',1]}];
 for(const command of invalid)assert.throws(()=>session.command(command as LittlewildDeveloper.Command));
 assert.equal(reads,0);assert.deepEqual(session.story(),before);
}));
test('Router rejection returns a useful detached result without mutation',()=>withSession(session=>{
 const before=session.save(),result=session.command({id:'care',actorId:'c999',args:['feed']});
 assert.equal(result.ok,false);assert(result.reason);assert.deepEqual(session.save(),before);
 const unknown=session.command({id:'cancel-plan',actorId:'c1',args:['missing']});assert.equal(unknown.ok,false);assert.match(unknown.reason??'',/no longer queued/);
}));
test('Typed actor commands go through the compiled router',()=>withSession(session=>{
 assert.equal(session.command({id:'set-stock-target',actorId:'c1',args:['berries',4]}).ok,true);
 const state=session.save().state as LittlewildDeveloper.Document;
 const colony=state.colony as LittlewildDeveloper.Document;
 const actor=(colony.creatures as LittlewildDeveloper.Document[])[0];assert(actor);
 assert.equal((actor.stockTargets as LittlewildDeveloper.Document).berries,4);
}));
test('Cancel lesson accepts its required skill identity and preserves unused tuition',()=>withSession(session=>{
 const before=session.save();
 assert.equal(session.command({id:'cancel-lesson',actorId:'c1',args:['missing']}).ok,false);
 assert.deepEqual(session.save(),before);
 const snapshot=session.inspect();const actor=snapshot.actors[0];assert(actor);
 // The established charted-home scene includes learned/unlocked lessons; create a real queued lesson through commands.
 const captured=session.captureScenario(),libraries=captured.libraries as LittlewildDeveloper.Document;
 const base=libraries.base as LittlewildDeveloper.Document;
 const components=base.components as LittlewildDeveloper.Document;
 const skills=components.skills as LittlewildDeveloper.Document[];
 assert(Array.isArray(skills));let queued=false;
 for(const skill of skills){
  const id=String(skill.id);session.command({id:'research-skill',actorId:actor.id,args:[id]});
  const taught=session.command({id:'teach-skill',actorId:actor.id,args:[id]});
  if(taught.ok){assert(session.command({id:'cancel-lesson',actorId:actor.id,args:[id]}).ok);queued=true;break;}
 }
 assert(queued,'A real available lesson should be queued and cancelled.');
},'littlewild','charted-home'));
test('Native saves, snapshots and portable stories are detached projections',()=>withSession(session=>{
 const before=session.story(),view=session.inspect(),state=session.save();
 (view.actors[0]?.position as {x:number}).x=999;
 ((state.state as LittlewildDeveloper.Document).player as LittlewildDeveloper.Document).coins=999;
 const story=session.story();(story as {version:number}).version=1;
 assert.deepEqual(session.story(),before);assert(!Object.hasOwn(session,'engine'));
}));
test('Reviewed story opens once after disposal and continues deterministically',()=>{
 const a=toolbox.create({scenarioId:'littlewild',sceneId:'charted-home'});
 a.start();a.command({id:'set-stock-target',actorId:'c1',args:['berries',3]});a.advance(5);
 const checkpoint=a.story(),review=toolbox.reviewStory(checkpoint);
 a.advance(3);const expected=a.save();a.dispose();
 const b=toolbox.openStory(review);try{b.advance(3);assert.deepEqual(b.save(),expected);}finally{b.dispose();}
 assert.throws(()=>toolbox.openStory(review),/original review token/);
});
test('Forged and obsolete story reviews cannot activate registries',()=>{
 const a=toolbox.create({scenarioId:'littlewild'}),doc=a.story(),review=toolbox.reviewStory(doc);a.dispose();
 assert.throws(()=>toolbox.openStory(clone(review) as LittlewildDeveloper.StoryReview),/original review token/);
 doc.version=9;assert.throws(()=>toolbox.reviewStory(doc),/current.*format/i);
 const reopened=toolbox.openStory(review);reopened.dispose();
});
test('Captured and customized validated scenarios can be opened through data only',()=>{
 const a=toolbox.create({scenarioId:'littlewild'}),pack=a.captureScenario();a.dispose();
 assert(toolbox.validateScenario(pack).ok);
 const b=toolbox.createScenario(pack,'first-morning');try{assert.equal(b.inspect().scenarioId,'littlewild');}finally{b.dispose();}
 const bad={...pack,script:'arbitrary code'};assert.equal(toolbox.validateScenario(bad).ok,false);
});
test('Disposal is idempotent and all retained operation handles expire',()=>{
 const a=toolbox.create({scenarioId:'littlewild'}),step=a.step;a.dispose();a.dispose();assert(a.disposed);
 for(const work of [()=>step(1),()=>a.start(),()=>a.command({id:'select-creature',args:['c1']}),()=>a.inspect(),()=>a.story(),()=>a.captureScenario()])
  assert.throws(work,/disposed/);
 withSession(b=>assert.equal(b.disposed,false),'emberworks');
});
test('External registry changes fail visibly instead of running a different context',()=>{
 const a=toolbox.create({scenarioId:'littlewild'}),pack=runtime.LWScenarios.builtins().find(p=>p.id==='emberworks');assert(pack);
 runtime.LWScenarios.commitScene(runtime.LWScenarios.prepareScene(pack,pack.scenes[0]?.id??''));
 try{assert.throws(()=>a.step(),/registries changed/);assert.throws(()=>a.command({id:'select-creature',args:['c1']}),/registries changed/);}finally{a.dispose();}
 withSession(b=>assert.equal(b.inspect().scenarioId,'littlewild'));
});
test('Asset and creature discovery validates data without mutable registry registration',()=>{
 const assets=toolbox.assets.list('actor');assert(assets.length>=1);const asset=assets[0];assert(asset);
 const data=toolbox.assets.get(asset.category,asset.id);assert(data);assert(toolbox.assets.validate(data).ok);
 assert.equal(toolbox.assets.validate({...data,script:'execute'}).ok,false);
 const creature=toolbox.creatures()[0];assert(creature);assert(toolbox.validateCreature(creature).ok);
 assert.equal(toolbox.validateCreature({...creature,script:'execute'}).ok,false);
 assert.equal(toolbox.assets.get('item','missing'),null);
 assert.throws(()=>toolbox.assets.list('wrong' as LittlewildDeveloper.AssetCategory),/category/);
});
test('Player host lease permits discovery while blocking all developer context activation',()=>{
 const lease=runtime.LWDeveloperSession.claimHost();try{
  assert(toolbox.scenarios().length>0);assert(toolbox.assets.list().length>0);
  assert.throws(()=>toolbox.create({scenarioId:'littlewild'}),/player host owns/);
  assert.throws(()=>toolbox.createScenario({},'missing'),/player host owns/);
  assert.throws(()=>toolbox.openStory({} as LittlewildDeveloper.StoryReview),/player host owns/);
  assert.throws(()=>runtime.LWDeveloperSession.claimHost(),/player host owns/);
 }finally{lease.dispose();lease.dispose();}
 withSession(a=>assert.equal(a.disposed,false));
});
test('Browser global composes the same toolbox without CommonJS or player UI',()=>{
 const context=vm.createContext({console,TextEncoder,TextDecoder});
 const globals:Record<string,string>={LWDefaultLibrary:'default-library.json',LWContentSchema:'library.schema.json',LWDefaultAdventure:'adventure-library.json',
  LWAdventureSchema:'adventure.schema.json',LWDefaultWorld:'world-library.json',LWWorldSchema:'world.schema.json',LWActorRules:'actor-rules.json',
  LWEconomyRules:'economy-rules.json',LWDefaultSimulationProfile:'simulation-profile.json',LWSimulationSchema:'simulation.schema.json',
  LWDefaultGrowth:'growth-library.json',LWGrowthSchema:'growth.schema.json',LWDefaultProfile:'default-profile.json',LWScenarioSchema:'scenario.schema.json'};
 for(const [name,file] of Object.entries(globals))vm.runInContext(name+'='+fs.readFileSync(path.join(__dirname,'content',file),'utf8'),context);
 for(const [name,file] of [['LWCreatureDefinitions','creature-definitions.json'],['LWCreatureConfig','creature-config.json'],['LWAssetDefinitions','asset-definitions.json'],['LWInteractionLibrary','interaction-library.json']])
  vm.runInContext(name+'='+fs.readFileSync(path.join(__dirname,file!),'utf8'),context);
 vm.runInContext('LWScenarioPacks=['+['littlewild.pack.json','emberworks.pack.json','office.pack.json'].map(file=>fs.readFileSync(path.join(__dirname,'content',file),'utf8')).join(',')+']',context);
 const composition=fs.readFileSync(path.join(__dirname,'simulation.cjs'),'utf8');
 vm.runInContext("LWAssetDefinitions[0].name='🌱'.repeat(120)",context);
 const modules=[...composition.matchAll(/require\('\.\/([^']+)\.js'\)/g)].map(match=>match[1]!);
 for(const name of [...modules,'story-codec','scenario-shape','scenario-runtime','scenario-story','developer-data','developer-commands','developer-session','developer-toolbox'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,name+'.js'),'utf8'),context,{filename:name+'.js'});
 const outcome=vm.runInContext(`(()=>{const t=LWDeveloper,s=t.create({scenarioId:'littlewild'});s.start();const advanced=s.advance(.3).advancedSeconds;s.dispose();const lease=LWDeveloperSession.claimHost();let blocked=false;try{t.create({scenarioId:'emberworks'});}catch(e){blocked=e.code==='session-active';}const count=t.scenarios().length;lease.dispose();return {advanced,blocked,count,astral:t.assets.list()[0].name};})()`,context) as {advanced:number;blocked:boolean;count:number;astral:string};
 assert(Math.abs(outcome.advanced-.3)<1e-9);assert(outcome.blocked);assert.equal(outcome.count,3);assert.equal([...outcome.astral].length,120);
});
test('Generated SDK types accept valid intent and reject unavailable capabilities',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'littlewild-sdk-types-'));
 try {
  const entry=path.join(__dirname,'developer-sdk.cjs').replaceAll('\\','/');
  const prefix='import {toolbox, type Command} from '+JSON.stringify(entry)+';\n';
  const good=path.join(directory,'good.cts'),bad=path.join(directory,'bad.cts');
  fs.writeFileSync(good,prefix+"const c:Command={id:'set-stock-target',actorId:'c1',args:['berries',4]}; const s=toolbox.create({scenarioId:'littlewild'});s.command(c);s.dispose();");
  fs.writeFileSync(bad,prefix+"const c:Command={id:'set-stock-target',args:['berries',true]};const s=toolbox.create({scenarioId:'littlewild'});s.engine.step(.1);");
  const compilerOptions:ts.CompilerOptions={strict:true,noEmit:true,skipLibCheck:true,module:ts.ModuleKind.Node16,moduleResolution:ts.ModuleResolutionKind.Node16,target:ts.ScriptTarget.ES2022};
  const diagnostics=(file:string):readonly ts.Diagnostic[]=>ts.getPreEmitDiagnostics(ts.createProgram([file],compilerOptions));
  const accepted=diagnostics(good);assert.equal(accepted.length,0,accepted.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
  const rejected=diagnostics(bad),messages=rejected.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n');
  assert(rejected.length>0);assert.match(messages,/boolean.*number|not assignable/);assert.match(messages,/engine.*does not exist/);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
const report={passed:results.filter(result=>result.passed).length,total:results.length,results};
fs.writeFileSync(path.join(__dirname,'developer-toolbox-results.json'),JSON.stringify(report,null,2));
console.log(report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
