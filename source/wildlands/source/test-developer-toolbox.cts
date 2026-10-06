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
 assert.equal(result.ok,false);assert(result.reason);assert(result.code&&toolbox.failureCodes().includes(result.code));assert.deepEqual(session.save(),before);
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
  LWDefaultGrowth:'growth-library.json',LWGrowthSchema:'growth.schema.json',LWDefaultProfile:'default-profile.json',LWScenarioSchema:'scenario.schema.json',LWInteriorDefinitions:'building-interiors.json',LWDefaultBalancing:'balancing.json'};
 for(const [name,file] of Object.entries(globals))vm.runInContext(name+'='+fs.readFileSync(path.join(__dirname,'content',file),'utf8'),context);
 vm.runInContext(`LWDefaultLibrary=LWDefaultBalancing.libraries.base;LWDefaultAdventure=LWDefaultBalancing.libraries.adventure;LWDefaultWorld=LWDefaultBalancing.libraries.world;LWDefaultGrowth=LWDefaultBalancing.libraries.growth;LWDefaultSimulationProfile=LWDefaultBalancing.simulation;LWDefaultProfile=LWDefaultBalancing.world;LWActorRules=LWDefaultBalancing.simulation.rules.actor;LWEconomyRules=LWDefaultBalancing.simulation.rules.economy;LWInteriorDefinitions=LWDefaultBalancing.interiors;`,context);
 for(const [name,file] of [['LWCreatureDefinitions','creature-definitions.json'],['LWCreatureConfig','creature-config.json'],['LWCreatureEditorFieldDefinitions','creature-editor-fields.json'],['LWAssetDefinitions','asset-definitions.json'],['LWInteractionLibrary','interaction-library.json']])
  vm.runInContext(name+'='+fs.readFileSync(path.join(__dirname,file!),'utf8'),context);
 vm.runInContext('LWScenarioPacks=['+['littlewild.pack.json','emberworks.pack.json','office.pack.json'].map(file=>fs.readFileSync(path.join(__dirname,'content',file),'utf8')).join(',')+']',context);
 const composition=fs.readFileSync(path.join(__dirname,'simulation.cjs'),'utf8');
 vm.runInContext("LWAssetDefinitions[0].name='🌱'.repeat(120)",context);
 const modules=[...composition.matchAll(/require\('\.\/([^']+)\.js'\)/g)].map(match=>match[1]!);
 for(const name of [...modules,'story-codec','scenario-shape','canvas-authoring','renderer-catalog','animation-catalog','storytelling-validation','scene-graph','scene-navigation','scene-props','scenario-runtime','scenario-story','scene-editor','storytelling','storytelling-editor','developer-storytelling','creature-editor-fields','creature-editor','developer-creatures','engine-export-data','engine-export-manifest','engine-export','external-editor-core','external-editor-canvas-data','external-editor-tiled','external-editor-ldtk','external-editor-gltf','external-editor-canvas-story','external-editor-canvas','external-editors','renderer-registry','renderer-scene-2d','renderer-pixi','renderer-excalibur','developer-data','renderer-animations','developer-commands','balancing-tools','balancing-probes','developer-scenes','developer-session','developer-toolbox'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,name+'.js'),'utf8'),context,{filename:name+'.js'});
 const outcome=vm.runInContext(`(()=>{const t=LWDeveloper,s=t.create({scenarioId:'littlewild'});s.start();const advanced=s.advance(.3).advancedSeconds;s.dispose();const lease=LWDeveloperSession.claimHost();let blocked=false;try{t.create({scenarioId:'emberworks'});}catch(e){blocked=e.code==='session-active';}const count=t.scenarios().length;lease.dispose();return {advanced,blocked,count,astral:t.assets.list()[0].name};})()`,context) as {advanced:number;blocked:boolean;count:number;astral:string};
 assert(Math.abs(outcome.advanced-.3)<1e-9);assert(outcome.blocked);assert.equal(outcome.count,3);assert.equal([...outcome.astral].length,120);
});
test('Portable spatial observations and authoring previews remain detached and state pure',()=>withSession(session=>{
 const before=session.save(),options=session.constructionOptions(),building=options.buildings[0];assert(building);
 const interior=session.buildingInterior(building.id),draft=session.buildingDesign(building.id);assert(interior&&draft);
 assert.equal(interior.buildingId,building.id);assert(draft.mapUnit);
 assert(session.previewBuildingDesign(draft,building.id).ok);
 const terrain=session.terraform();assert.equal(session.previewTerraform({revision:terrain.revision,tiles:[{x:0,y:0,height:session.terrain(0,0).height}],plants:[]}).ok,true);
 assert(Number.isFinite(session.terrain(0,0).height));
 interior.floors[0]!.label='Changed';draft.name='Changed';terrain.choices.splice(0);options.buildings.splice(0);
 assert.notEqual(session.buildingInterior(building.id)?.floors[0]?.label,'Changed');assert.notEqual(session.buildingDesign(building.id)?.name,'Changed');
 assert(session.terraform().choices.length);assert.deepEqual(session.save(),before);
},'littlewild','charted-home'));
test('Authored floor geometry traverses the same router with supported nested cell arrays',()=>withSession(session=>{
 const options=session.constructionOptions(),kind=options.types[0]?.id;assert(kind);
 const cells=Array.from({length:400},(_,index)=>({x:index%20,y:Math.floor(index/20)}));
 const draft:LittlewildDeveloper.BuildingDesignDraft={name:'Spacious workshop',kind,mapUnit:{width:20,height:20},layout:{id:'spacious',label:'Spacious',floors:[{id:'ground',label:'Ground',width:20,height:20,door:{x:1,y:19},stairs:[],stations:[],cells}]}};
 assert.equal(session.previewBuildingDesign(draft).ok,true);
 const before=session.save(),result=session.command({id:'construct-design',actorId:'c1',args:[draft,999,999]});
 assert.equal(result.ok,false);assert.notEqual(result.code,'invalid-command');assert.deepEqual(session.save(),before);
}));
test('Spatial commands reject missing identities through the same typed boundary atomically',()=>withSession(session=>{
 const before=session.save();
 for(const command of [
  {id:'visit-building-floor',args:['c1','missing','upper']},
  {id:'order-building-production',args:['missing','ground','bench','planks',1]},
  {id:'improve-design',actorId:'c1',args:['missing',{name:'Invalid',kind:'missing',layout:{id:'test',label:'Test',floors:[]}}]},
  {id:'apply-terraform',args:[{revision:-1,tiles:[],plants:[]}]}
 ] satisfies LittlewildDeveloper.Command[]){const result=session.command(command);assert.equal(result.ok,false);assert(result.reason);}
 assert.deepEqual(session.save(),before);
 assert.throws(()=>session.command({id:'visit-building-floor',args:['c1','missing','ground'],actorId:'c1'} as unknown as LittlewildDeveloper.Command),/does not accept/);
 assert.deepEqual(session.save(),before);
}));
test('Renderer discovery exposes detached metadata without factories or world activation',()=>{
 const metadata=toolbox.renderers.list();assert.equal(metadata[0]?.id,'basic');assert(metadata.every(value=>!Object.hasOwn(value,'factory')));
 assert(toolbox.renderers.validate(metadata[0]).ok);
 assert.equal(toolbox.renderers.validate({...metadata[0],factory:'executable'}).ok,false);
 assert.equal(toolbox.renderers.validate([]).ok,false);let reads=0;assert.equal(toolbox.renderers.validate({get id(){reads++;return 'unsafe';}}).ok,false);assert.equal(reads,0);
 const first=metadata[0];assert(first);const capabilities=first.capabilities as LittlewildDeveloper.RendererCapability[];capabilities.splice(0);
 assert(toolbox.renderers.list()[0]?.capabilities.length);
});
function scenePack():LWContentPorts.ScenarioPack {
 let captured:LittlewildDeveloper.Document={};withSession(session=>{captured=session.captureScenario();});
 const pack=toolbox.createSceneEditor(captured).snapshot(),home=pack.scenes[0]!;
 const world=structuredClone(pack.worlds[0]!);world.id='sdk-far-world';world.name='Far world';pack.worlds.push(world);
 home.graph={kind:'level',connections:[{id:'far',label:'Far world',targetSceneId:'sdk-far'},{id:'blocked',label:'Locked door',targetSceneId:'sdk-blocked',requirements:[{type:'player-level',minimum:999}]}]};
 const far=structuredClone(home);far.id='sdk-far';far.name='Far world';far.worldId=world.id;far.graph={kind:'dungeon',connections:[{id:'home',label:'Return home',targetSceneId:home.id}]};
 const blocked=structuredClone(far);blocked.id='sdk-blocked';pack.scenes.push(far,blocked);return pack;
}
test('Detached SDK drafts edit canonical entities without acquiring or mutating a session',()=>{
 const pack=scenePack(),draft=toolbox.createSceneEditor(pack),home=pack.scenes[0]!,before=structuredClone(pack);
 const actor=draft.entities(home.id).find(entity=>entity.category==='creatures')!;
 const session=toolbox.createScenario(pack,home.id);
 try{const saved=session.story();draft.setEntity(home.id,'creatures',actor.id,{name:'Draft creature'});
  assert.deepEqual(session.story(),saved);assert.deepEqual(pack,before);assert.equal(draft.entities(home.id).find(entity=>entity.id===actor.id)!.name,'Draft creature');
  const exported=draft.export();exported.name='Outside mutation';assert.notEqual(draft.snapshot().name,'Outside mutation');
  draft.undo();assert.deepEqual(draft.export(),before);draft.redo();assert.equal(draft.revision,3);
 }finally{session.dispose();}
});
test('Active-scene props are detached and remain scoped across transitions',()=>{
 const pack=scenePack(),asset=toolbox.assets.list('item')[0]!;
 pack.scenes[0]!.graph!.props=[{id:'sdk-prop',name:'A scene prop',category:'item',assetId:asset.id,model:asset.models[0]!,x:1,y:1}];
 const session=toolbox.createScenario(pack,pack.scenes[0]!.id);
 try{const before=session.story(),props=session.sceneProps();assert.equal(props[0]!.id,'sdk-prop');props[0]!.name='External edit';
  assert.equal(session.sceneProps()[0]!.name,'A scene prop');assert.deepEqual(session.story(),before);
  session.enterScene(session.reviewScene('far'));assert.deepEqual(session.sceneProps(),[]);session.enterScene(session.reviewScene('home'));assert.equal(session.sceneProps()[0]!.id,'sdk-prop');
 }finally{session.dispose();}
});
test('SDK scene discovery and review failures preserve the owned world and its lease',()=>{
 const pack=scenePack(),session=toolbox.createScenario(pack,pack.scenes[0]!.id);
 try{const before=session.story(),links=session.sceneConnections();assert.equal(links.find(link=>link.id==='blocked')!.available,false);
  assert.throws(()=>session.reviewScene('blocked'));assert.deepEqual(session.story(),before);
  const review=session.reviewScene('far');assert.equal('scene' in review,false);assert.deepEqual(session.story(),before);
  assert.throws(()=>session.enterScene(structuredClone(review)),/original review/);assert.deepEqual(session.story(),before);
  session.start();session.advance(.1);const advanced=session.story();assert.throws(()=>session.enterScene(review),/stale/);assert.deepEqual(session.story(),advanced);
  const current=session.reviewScene('far');session.enterScene(current);assert.equal(session.inspect().sceneId,'sdk-far');assert.throws(()=>session.enterScene(current),/original review/);
 }finally{session.dispose();}
});
test('One SDK session preserves dormant checkpoints and reopened journey continuations',()=>{
 const pack=scenePack(),homeId=pack.scenes[0]!.id,session=toolbox.createScenario(pack,homeId);let saved:LittlewildDeveloper.Document={};
 try{session.start();session.advance(2);const home=session.save();session.enterScene(session.reviewScene('far'));session.start();session.advance(3);
  saved=session.story();session.enterScene(session.reviewScene('home'));assert.deepEqual(session.save(),home);session.enterScene(session.reviewScene('far'));assert.deepEqual(session.story(),saved);
 }finally{session.dispose();}
 const reopened=toolbox.openStory(toolbox.reviewStory(saved));
 try{assert.equal(reopened.inspect().sceneId,'sdk-far');reopened.enterScene(reopened.reviewScene('home'));assert.equal(reopened.inspect().sceneId,homeId);reopened.enterScene(reopened.reviewScene('far'));assert.deepEqual(reopened.story(),saved);}
 finally{reopened.dispose();}
});
test('Failed scene activation restores catalog identity and leaves SDK ownership usable',()=>{
 const pack=scenePack(),session=toolbox.createScenario(pack,pack.scenes[0]!.id);
 const runtime=globalThis as unknown as {LWScenarios:LWContentPorts.ScenarioApi;LWAssets:{revision:number};LWCreatures:{revision:number}};
 const activate=runtime.LWScenarios.activate,assets=runtime.LWAssets.revision,creatures=runtime.LWCreatures.revision;
 try{const review=session.reviewScene('far'),before=session.story();runtime.LWScenarios.activate=engine=>{activate(engine);throw Error('Injected SDK activation failure');};
  assert.throws(()=>session.enterScene(review),/Injected SDK/);assert.equal(runtime.LWAssets.revision,assets);assert.equal(runtime.LWCreatures.revision,creatures);assert.deepEqual(session.story(),before);
  runtime.LWScenarios.activate=activate;session.enterScene(review);assert.equal(session.inspect().sceneId,'sdk-far');
 }finally{runtime.LWScenarios.activate=activate;session.dispose();}
});
test('External editor conversions stay detached while an SDK session owns the runtime',()=>{
 const pack=scenePack(),sceneId=pack.scenes[0]!.id,session=toolbox.createScenario(pack,sceneId);
 try{const before=session.story(),formats=toolbox.externalEditors.formats();assert.deepEqual(formats.map(row=>row.id),['tiled','ldtk','gltf','canvas','advanced-canvas']);
  formats[0]!.label='External edit';assert.notEqual(toolbox.externalEditors.formats()[0]!.label,'External edit');
  for(const format of formats){const exchange=toolbox.externalEditors.export(pack,sceneId,format.id);assert.equal(toolbox.externalEditors.detect(exchange.document),format.id);
   const converted=toolbox.externalEditors.import(exchange.document);assert(converted.ok,JSON.stringify(converted));assert.equal(converted.sceneId,sceneId);
   assert(toolbox.validateScenario(converted.pack).ok);converted.pack.name='Converted draft';assert.notEqual(pack.name,'Converted draft');assert.deepEqual(session.story(),before);
  }
 }finally{session.dispose();}
});
test('Animation discovery validates bounded authored descriptors without exposing renderers or callbacks',()=>{
 const presets=toolbox.animations.list();assert(presets.some(value=>value.id==='sparkles'));assert(presets.every(value=>!Object.hasOwn(value,'draw')));
 const value={id:'glow',presetId:'sparkles',start:0,duration:2,x:1,y:2,radius:20,color:'#ffffff',count:8};assert(toolbox.animations.validate([value]).ok);assert.equal(toolbox.animations.validate([{...value,presetId:'missing'}]).ok,false);let reads=0;assert.equal(toolbox.animations.validate([{get id(){reads++;return 'unsafe';}}]).ok,false);assert.equal(reads,0);
});
test('Storytelling SDK authors safe timelines and samples presentation without changing gameplay',()=>{
 const pack=scenePack(),sceneId=pack.scenes[0]!.id,session=toolbox.createScenario(pack,sceneId);
 try{const before=session.save(),draft=toolbox.storytelling.createEditor(pack),clip:LWStorytelling.Cutscene={id:'intro',name:'Arrival',sceneId,duration:2,skipPolicy:'cancel',tracks:[{id:'walk',target:{category:'creatures',id:'c1'},property:'x',keyframes:[{time:0,value:1},{time:2,value:3}]}]};
  draft.storytelling.setCutscene(clip,draft.scene.revision);assert.equal(toolbox.storytelling.inspect(draft.scene.export()).cutscenes.length,1);
  const playback=toolbox.storytelling.createPlayback(draft.scene.export(),'intro');assert(!Object.hasOwn(playback,'advance'));playback.play();playback.seek(1);assert.equal(playback.sample().poses[0]!.values.x,2);playback.pause();assert.equal(playback.status().state,'paused');playback.dispose();
  const revision=draft.scene.revision;assert.throws(()=>draft.storytelling.setCutscene({...clip,duration:-1}));assert.equal(draft.scene.revision,revision);assert.throws(()=>draft.storytelling.removeCutscene('intro',revision-1));assert.deepEqual(session.save(),before);
 }finally{session.dispose();}
});
test('Generated SDK types accept valid intent and reject unavailable capabilities',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'littlewild-sdk-types-'));
 try {
  const entry=path.join(__dirname,'developer-sdk.cjs').replaceAll('\\','/');
  const prefix='import {toolbox, type Command, type AnimationHost} from '+JSON.stringify(entry)+';\n';
  const good=path.join(directory,'good.cts'),bad=path.join(directory,'bad.cts');
  fs.writeFileSync(good,prefix+"function animate(host:AnimationHost){host.setAnimations([{id:'spark',presetId:'sparkles',start:0,duration:2,x:1,y:1,radius:8,color:'#fff',count:4}]);host.project({x:1,y:1});const frame=host.snapshot();frame.actors.forEach(actor=>actor.name);host.setAnimations(null);}const c:Command={id:'set-stock-target',actorId:'c1',args:['berries',4]}; const s=toolbox.create({scenarioId:'littlewild'});s.command(c);s.command({id:'visit-building-floor',args:['c1','b1','upper']});s.command({id:'order-building-production',args:['b1','upper','bench','planks',1]});const d=s.buildingDesign('b1');if(d){s.previewBuildingDesign(d,'b1');s.command({id:'improve-design',actorId:'c1',args:['b1',d]});s.command({id:'construct-design',actorId:'c1',args:[d,2,3]});}const t=s.terraform();s.command({id:'apply-terraform',args:[{revision:t.revision,tiles:[{x:1,y:2,height:1}],plants:[]}]});s.buildingInterior('b1');toolbox.renderers.validate(toolbox.renderers.list()[0]);const editor=toolbox.createSceneEditor(s.captureScenario());const pack=editor.snapshot();editor.updateScene(pack.scenes[0]!.id,{graph:{kind:'dungeon',connections:[]}});editor.addProp(pack.scenes[0]!.id,{id:'desk',name:'Desk',category:'building',assetId:'desk',model:'default',x:1,y:1});s.sceneConnections();s.sceneProps();s.sceneTarget();const exchanged=toolbox.externalEditors.export(pack,pack.scenes[0]!.id,'tiled');const converted=toolbox.externalEditors.import(exchanged.document,{pack,sceneId:pack.scenes[0]!.id,canvasMappings:[{nodeId:'scene:home',kind:'scene',entityId:'home'}]});if(converted.ok)editor.replace(converted.pack);const review=s.reviewScene('far');s.enterScene(review);const creature=toolbox.createCreatureEditor(pack,{sceneId:pack.scenes[0]!.id,archetypeId:'sproutling'});creature.updateDefinition({name:'Fern'});toolbox.animations.list();toolbox.balancing.capture(pack);const exportPromise=toolbox.engineExport.export(pack,pack.scenes[0]!.id);const storytelling=toolbox.storytelling.createEditor(pack);storytelling.storytelling.list();toolbox.storytelling.sample(pack,'intro',1);toolbox.validateCreaturePackage(creature.exportPackage());s.dispose();");
  fs.writeFileSync(bad,prefix+"function invalid(host:AnimationHost){host.engine.step(1);host.setAnimations([{id:'x',presetId:'sparkles',start:0,duration:2,x:1,y:1,radius:8,color:'#fff',count:'many'}]);}const c:Command={id:'set-stock-target',args:['berries',true]};const s=toolbox.create({scenarioId:'littlewild'});s.engine.step(.1);s.command({id:'visit-building-floor',actorId:'c1',args:['c1','b1','upper']});s.command({id:'apply-terraform',args:[{revision:0,tiles:[{x:1,y:2,ground:'lava'}],plants:[]}]});toolbox.renderers.register({},()=>null);const editor=toolbox.createSceneEditor(s.captureScenario());editor.engine.step(1);editor.updateScene('home',{graph:{kind:'invalid'}});editor.place('home','inventory','item',1,1);s.reviewScene('far').scene.engine.step(1);const review=s.reviewScene('shore');if(review.target?.type==='island'){review.target.ix=2;}toolbox.externalEditors.export({},'home','invalid-format');toolbox.createCreatureEditor({}, {sceneId:'home',archetypeId:'sproutling'}).engine.step(1);toolbox.createCreatureEditor({}, {sceneId:3,archetypeId:'sproutling'});toolbox.storytelling.createPlayback({},'intro').advance(1);toolbox.animations.register({},()=>null);toolbox.engineExport.export({},3);");
  const compilerOptions:ts.CompilerOptions={strict:true,noEmit:true,skipLibCheck:true,module:ts.ModuleKind.Node16,moduleResolution:ts.ModuleResolutionKind.Node16,target:ts.ScriptTarget.ES2022};
  const diagnostics=(file:string):readonly ts.Diagnostic[]=>ts.getPreEmitDiagnostics(ts.createProgram([file],compilerOptions));
  const accepted=diagnostics(good);assert.equal(accepted.length,0,accepted.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
  const rejected=diagnostics(bad),messages=rejected.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n');
  assert(rejected.length>0);assert.match(messages,/boolean.*number|not assignable/);assert.match(messages,/engine.*does not exist/);assert.match(messages,/scene.*does not exist/);assert.match(messages,/read-only property/);assert.match(messages,/invalid.*not assignable|inventory.*not assignable/);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('Creature authoring SDK edits detached canonical packages without changing a live session',()=>withSession(session=>{
 const before=session.save(),pack=toolbox.createSceneEditor(session.captureScenario()).snapshot(),scene=pack.scenes[0]!;
 const actor=(scene.initialState.colony as {creatures:Array<{id:string;archetype:string}>}).creatures[0]!;
 const editor=toolbox.createCreatureEditor(pack,{sceneId:scene.id,archetypeId:actor.archetype,instanceId:actor.id});
 const original=editor.exportPackage(),name=original.gameplayDefinition.name;
 editor.updateDefinition({name:name+' authored'});assert.equal(editor.snapshot().gameplayDefinition.name,name+' authored');
 const exported=editor.exportPackage();exported.gameplayDefinition.name='detached';assert.notEqual(editor.snapshot().gameplayDefinition.name,'detached');
 assert(toolbox.validateCreaturePackage(editor.exportPackage(),{pack:editor.exportScenario(),selection:editor.selection}).ok);
 const revision=editor.revision;assert.throws(()=>editor.updateInstance({inventory:{berries:-1}}));assert.equal(editor.revision,revision);
 editor.undo();assert.equal(editor.snapshot().gameplayDefinition.name,name);editor.redo();assert.equal(editor.snapshot().gameplayDefinition.name,name+' authored');
 assert.deepEqual(session.save(),before);assert(!Object.hasOwn(editor,'engine'));
}));
const report={passed:results.filter(result=>result.passed).length,total:results.length,results};
fs.writeFileSync(path.join(__dirname,'developer-toolbox-results.json'),JSON.stringify(report,null,2));
console.log(report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
