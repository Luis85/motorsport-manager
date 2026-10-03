/// <reference path="./developer-contracts.d.ts" />
/// <reference path="./application-records.d.ts" />
/// <reference path="./content-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {toolbox}=require('./developer-sdk.cjs') as {toolbox:LittlewildDeveloper.Toolbox};
type Document=LittlewildDeveloper.Document;
interface CustomerOrder {id:string;dealId:string;fact:string;item:string;amount:number;actorId:string;created:number;saleId:string|null;status:string;shippedAt:number|null;}
interface Workflow {schemaVersion:1;roles:{id:string;label:string;actorId:string}[];deals:{id:string;questId:string;salesRole:string;fulfillmentRole:string;item:string;amount:number;cooldown:number;venueBuildingId:string|null}[];supply:{roleId:string;item:string;target:number;orderType:string}[];nextDealAt:Record<string,number>;seen:string[];orders:CustomerOrder[];sequence:number;}
interface OfficeState extends LWApplication.State {scenarioWorkflow:Workflow;scenarioResources:LWContentPorts.Resources;settings:{duels:boolean;quests:boolean};}
interface NativeEngine {s:OfficeState;scenarioContext?:LWContentPorts.ExperienceContext;export():{app:string;version:number;state:OfficeState};advance(seconds:number):void;stepWorld(dt:number):void;}
const root=globalThis as unknown as {
 LW:{Engine:{import(input:unknown):NativeEngine}};LWScenarios:LWContentPorts.ScenarioApi;
 LWContent:LWContentPorts.ContentApi;LWAdventure:LWContentPorts.AdventureApi;LWWorldContent:LWContentPorts.WorldApi;LWGrowth:LWContentPorts.GrowthApi;
 LWWorldProfile:{current:LWContentPorts.WorldProfile;hash:string};LWSimulationProfile:{hash:string};
 LWAssets:{all():unknown[];revision:number;building(id:string):{models:{world:{nodes:{primitive:string}[]}}}};
 LWCreatures:{all():unknown[];configuration:unknown;revision:number};LWScenarioResources:{defaults():LWContentPorts.Resources};
};
const authored=JSON.parse(fs.readFileSync(__dirname+'/content/office.pack.json','utf8')) as LWContentPorts.ScenarioPack;
const copy=<T,>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error instanceof Error?error.stack||error.message:String(error)});}}
function state(game:LittlewildDeveloper.Session):OfficeState{return game.save().state as unknown as OfficeState;}
function useOffice(work:(game:LittlewildDeveloper.Session)=>void,pack:LWContentPorts.ScenarioPack=authored):void{const game=toolbox.createScenario(pack,'operations-shift');try{work(game);}finally{game.dispose();}}
function context():string{return root.LWContent.stable({base:root.LWContent.registry.export(),adventure:root.LWAdventure.content,world:root.LWWorldContent.content,growth:root.LWGrowth.content,worldProfile:root.LWWorldProfile.current,simulation:root.LWSimulationProfile.hash,assets:root.LWAssets.all(),creatures:root.LWCreatures.all(),configuration:root.LWCreatures.configuration,assetRevision:root.LWAssets.revision,creatureRevision:root.LWCreatures.revision});}
function builtin():void{const game=toolbox.create({scenarioId:'littlewild'});game.dispose();}
function rejected(edit:(p:LWContentPorts.ScenarioPack)=>void):void{useOffice(game=>{const before=context(),saved=game.save(),bad=copy(authored);edit(bad);assert.equal(toolbox.validateScenario(bad).ok,false);assert.equal(context(),before);assert.deepEqual(game.save(),saved);});}

test('Office is discovered and ships a complete isolated data pack',()=>{
 assert(toolbox.scenarios().some(s=>s.id==='office'&&s.scenes.some(scene=>scene.id==='operations-shift')));
 assert(toolbox.validateScenario(authored).ok);
 assert(authored.resources?.assets.length);assert(authored.resources?.creatures.definitions.length);
 const start=authored.scenes[0]!.initialState as unknown as OfficeState;
 assert.equal(start.settings.duels,false);assert.equal(start.settings.quests,true);
 assert.equal(authored.worlds[0]!.environment?.mode,'indoor');assert.equal(start.nodes.length,3);
 assert.deepEqual(start.scenarioResources,authored.resources);
 useOffice(game=>{assert.equal(game.inspect().scenarioId,'office');assert.deepEqual(game.inspect().actors.map(a=>a.name),['Angela','Phil','Marty']);assert(root.LWAssets.building('bench').models.world.nodes.every(n=>n.primitive!=='roof'));});
});

test('Normal role work creates, produces, carries and ships a customer order with conserved stock',()=>useOffice(game=>{
 const tasks=new Map<string,Set<string>>();let onsite=false;const engine=root.LW.Engine.import(game.save());
 for(let i=0;i<1000;i++){
  engine.advance(.1);const s=engine.s;
  for(const actor of s.colony.creatures){if(actor.task){const kinds=tasks.get(actor.id)||new Set<string>();kinds.add(actor.task.kind);tasks.set(actor.id,kinds);}if(actor.id==='c2'&&actor.activeQuest){onsite=true;assert(Math.hypot(actor.creature.x-11,actor.creature.y-6)<=1.5);}}
 }
 const s=engine.export().state,shipment=s.scenarioWorkflow.orders.find(o=>o.status==='shipped');
 assert(shipment);assert.equal(shipment.actorId,'c1');assert(onsite);
 assert(tasks.get('c3')?.has('gather'));for(const kind of ['stockbuilding','craft','collectbuilding','market-pickup','market-deliver','market-sell'])assert(tasks.get('c1')?.has(kind),kind);
 const receipt=s.market.history.find(r=>r.id===shipment.saleId);assert(receipt);assert.equal(receipt.actorId,'c1');assert.equal(receipt.amount,2);
 assert(s.colony.warehouse.transfers.some(r=>r.actorId==='c3'&&r.direction==='in'&&r.items.wood!>0));
 assert(s.colony.warehouse.transfers.some(r=>r.actorId==='c1'&&r.direction==='out'&&r.items.wood!>0));
 const harvested=180-s.nodes.find(n=>n.id==='receiving-blanks')!.stock;
 const wood=s.colony.warehouse.inventory.wood!+s.colony.creatures.reduce((n,c)=>n+(c.inventory.wood||0),0)+s.buildings.reduce((n,b)=>n+(b.storage?.input.wood||0)+(b.storage?.job?.cost.wood||0),0);
 const cartons=s.colony.warehouse.inventory.planks!+s.colony.creatures.reduce((n,c)=>n+(c.inventory.planks||0),0)+s.buildings.reduce((n,b)=>n+(b.storage?.output.planks||0)+(b.marketInventory?.planks||0),0)+s.market.orders.reduce((n,o)=>n+o.sold,0);
 assert.equal(harvested,wood+2*cartons);
}));

test('Native, portable and captured-scenario checkpoints preserve exact running continuation',()=>useOffice(game=>{
 game.advance(36);const native=game.save(),a=root.LW.Engine.import(native);
 assert.deepEqual(a.export(),native);
 const portable=game.story(),captured=game.captureScenario(),review=toolbox.reviewStory(portable);
 game.advance(24);a.advance(24);const expected=game.save();assert.deepEqual(a.export(),expected);
 game.dispose();builtin();
 const restored=toolbox.openStory(review);try{assert.deepEqual(restored.save(),native);restored.advance(24);assert.deepEqual(restored.save(),expected);assert.equal(root.LWWorldProfile.current.environment?.mode,'indoor');}finally{restored.dispose();}
 builtin();const replay=toolbox.createScenario(captured,'operations-shift');try{assert.deepEqual(replay.save(),native);replay.advance(24);assert.deepEqual(replay.save(),expected);}finally{replay.dispose();}
}));

test('External scenario edits change named roles, actor physiology and nonbundled visuals after context switches',()=>{
 const draft=copy(authored),resources=draft.resources!;
 const creature=resources.creatures.definitions[0] as {visualAsset:string;physiology:{energy:number}};
 const visual=copy(resources.assets.find(d=>(d as {category:string;id:string}).category==='actor'&&(d as {id:string}).id===creature.visualAsset)) as {id:string;name:string};
 visual.id='office-staff-custom';visual.name='Custom office staff';resources.assets.push(visual);creature.visualAsset=visual.id;creature.physiology.energy=.75;
 const s=draft.scenes[0]!.initialState as unknown as OfficeState;s.colony.creatures[0]!.name='Dawn';s.scenarioWorkflow.roles[0]!.label='Fulfillment Lead';s.scenarioResources=copy(resources);
 builtin();let portable:Document={},captured:Document={};
 useOffice(game=>{game.advance(45);assert.equal(game.inspect().actors[0]!.name,'Dawn');assert.equal(state(game).scenarioWorkflow.roles[0]!.label,'Fulfillment Lead');assert(toolbox.assets.list('actor').some(a=>a.id===visual.id));portable=game.story();captured=game.captureScenario();},draft);
 builtin();assert(!toolbox.assets.list('actor').some(a=>a.id===visual.id));
 const opened=toolbox.openStory(toolbox.reviewStory(portable));try{assert.equal(opened.inspect().actors[0]!.name,'Dawn');assert(toolbox.assets.list('actor').some(a=>a.id===visual.id));assert(toolbox.validateScenario(opened.captureScenario()).ok);}finally{opened.dispose();}
 builtin();const replay=toolbox.createScenario(captured,'operations-shift');try{assert.equal(state(replay).scenarioWorkflow.roles[0]!.label,'Fulfillment Lead');assert(toolbox.assets.list('actor').some(a=>a.id===visual.id));}finally{replay.dispose();}
});

test('Invalid role, item, venue and cross-catalog bindings reject without partial activation',()=>{
 for(const edit of [
  (p:LWContentPorts.ScenarioPack)=>{(p.scenes[0]!.initialState as unknown as OfficeState).scenarioWorkflow.roles[0]!.actorId='missing';},
  (p:LWContentPorts.ScenarioPack)=>{(p.scenes[0]!.initialState as unknown as OfficeState).scenarioWorkflow.deals[0]!.item='missing';},
  (p:LWContentPorts.ScenarioPack)=>{(p.scenes[0]!.initialState as unknown as OfficeState).scenarioWorkflow.deals[0]!.venueBuildingId='missing';},
  (p:LWContentPorts.ScenarioPack)=>{(p.resources!.creatures.definitions[0] as {visualAsset:string}).visualAsset='missing';},
  (p:LWContentPorts.ScenarioPack)=>{p.resources!.assets=p.resources!.assets.filter(a=>(a as {id:string}).id!=='bench');},
  (p:LWContentPorts.ScenarioPack)=>{(p.resources!.assets[0] as {callback:string}).callback='run';}
 ])rejected(edit);
});

test('Story resource mismatch and missing required visual reject even with recomputed experience fingerprint',()=>useOffice(game=>{
 const before=context(),saved=game.save();
 for(const replacement of [root.LWScenarioResources.defaults(),{...copy(authored.resources!),assets:authored.resources!.assets.filter(a=>(a as {id:string}).id!=='bench')}]){
  const story=game.story(),experience=story.experience as unknown as LWContentPorts.ExperienceContext;
  experience.resources=replacement;story.experienceFingerprint=root.LWScenarios.hash(experience);
  assert.throws(()=>toolbox.reviewStory(story),/resources|visual/i);assert.equal(context(),before);assert.deepEqual(game.save(),saved);
 }
}));

test('Reviewed catalog mutations and forged scene review fail atomically',()=>useOffice(game=>{
 const pack=game.captureScenario(),preview=root.LWScenarios.prepareScene(pack,'operations-shift'),before=context();
 (preview.pack.resources!.assets[0] as {name:string}).name='Changed after review';assert.throws(()=>root.LWScenarios.commitScene(preview),/review|preview/i);assert.equal(context(),before);
 const story=game.story(),engine=root.LWScenarios.commitScene(root.LWScenarios.prepareScene(pack,'operations-shift'));assert.deepEqual(engine.export().state,state(game));
 assert.throws(()=>toolbox.openStory({...toolbox.reviewStory(story)}),/session is active/);
}));

test('Turning quests off stops new sales calls while existing physical fulfillment can finish',()=>useOffice(game=>{
 game.advance(30);assert(state(game).scenarioWorkflow.orders.length>0);
 assert(game.command({id:'set-game-settings',args:[{quests:false}]}).ok);game.advance(90);
 const s=state(game);assert.equal(s.scenarioWorkflow.orders.length,1);assert.equal(s.scenarioWorkflow.orders[0]!.status,'shipped');assert.equal(s.colony.creatures[1]!.activeQuest,null);
 const story=game.story(),review=toolbox.reviewStory(story);game.dispose();const restored=toolbox.openStory(review);try{assert.deepEqual(restored.settings(),{duels:false,quests:false});restored.advance(60);assert.equal(state(restored).scenarioWorkflow.orders.length,1);}finally{restored.dispose();}
}));

test('Pending customer demand blocks mechanical library replacement',()=>useOffice(game=>{
 game.advance(30);const engine=root.LW.Engine.import(game.save());engine.scenarioContext=copy(root.LWScenarios.checkContext(game.story().experience));
 const content=copy(root.LWContent.registry.export());content.components.recipes.find(r=>r.id==='planks')!.time+=1;
 const preview=root.LWContent.registry.prepare(content);assert(preview.ok);
 const S=require('./scenario-story.js') as {currentStoryPolicy(preview:unknown,engine:NativeEngine):{ok:boolean;reason:string}};
 assert.equal(S.currentStoryPolicy(preview,engine).ok,false);
}));

test('Retained shipment authorities and live markers survive cleanup and native reconstruction',()=>useOffice(game=>{
 game.advance(100);const native=game.save(),s=native.state as unknown as OfficeState,shipped=s.scenarioWorkflow.orders.find(o=>o.status==='shipped');assert(shipped);const first=s.market.orders.find(o=>o.id===shipped.saleId)!;assert.equal(first.status,'done');
 for(let i=2;i<=121;i++){const sale=copy(first);sale.id='sale-'+i;s.market.orders.push(sale);}s.market.sequence=122;
 const e=root.LW.Engine.import(native);e.stepWorld(.1);assert(e.s.market.orders.some(o=>o.id===s.scenarioWorkflow.orders[0]!.saleId));assert.deepEqual(root.LW.Engine.import(e.export()).export(),e.export());
 const pending=copy(e.export());pending.state.scenarioWorkflow.orders=[{...pending.state.scenarioWorkflow.orders[0]!,saleId:null,status:'waiting-stock',shippedAt:null}];
 const marker=pending.state.scenarioWorkflow.orders[0]!.fact;pending.state.scenarioWorkflow.seen=[marker,...Array.from({length:255},(_,i)=>'older-'+i)];
 const continued=root.LW.Engine.import(pending);continued.advance(150);assert(continued.s.scenarioWorkflow.seen.includes(marker));assert.deepEqual(root.LW.Engine.import(continued.export()).export(),continued.export());
}));

test('A long normal operations shift remains bounded and importable across market retention',()=>{
 const p=copy(authored),s=p.scenes[0]!.initialState as unknown as OfficeState;
 s.nodes.find(n=>n.id==='receiving-blanks')!.stock=1000;s.nodes.find(n=>n.id==='receiving-blanks')!.max=1000;
 s.scenarioWorkflow.deals[0]!.amount=1;s.scenarioWorkflow.deals[0]!.cooldown=25;
 useOffice(game=>{const engine=root.LW.Engine.import(game.save());for(let i=0;i<220&&engine.s.market.sequence<=125;i++)engine.advance(30);
  assert(engine.s.market.sequence>121,'Expected at least 121 real shipments');assert(engine.s.scenarioWorkflow.orders.length<=104);assert(engine.s.scenarioWorkflow.seen.length<=256);
  assert.deepEqual(root.LW.Engine.import(engine.export()).export(),engine.export());
 },p);
});

builtin();
const report={passed:results.filter(r=>r.passed).length,total:results.length,results};fs.writeFileSync(__dirname+'/office-scenario-results.json',JSON.stringify(report,null,2)+'\n');
process.stdout.write(report.passed+'/'+report.total+' Office scenario checks passed\n');for(const r of results)if(!r.passed)process.stderr.write(r.name+': '+r.error+'\n');if(report.passed!==report.total)process.exitCode=1;
