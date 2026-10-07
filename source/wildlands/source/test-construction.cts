/// <reference path="./construction-contracts.d.ts" />
/// <reference path="./developer-contracts.d.ts" />
// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
require('./simulation.cjs');
const {toolbox}=require('./developer-sdk.cjs') as {toolbox:LittlewildDeveloper.Toolbox};
interface Save {app:string;version:number;state:LWConstruction.World;}
interface Native extends LWConstruction.Engine {
 step(dt:number):void;advance(seconds:number):void;selectCreature(id:string):unknown;
 dispatchCommand(input:unknown):LWPhysicalPorts.ActionResult;
 constructBuildingDesign(input:unknown,x:unknown,y:unknown):LWPhysicalPorts.ActionResult;
 improveBuildingDesign(id:unknown,input:unknown):LWPhysicalPorts.ActionResult;
 previewBuildingDesign(input:unknown,buildingId?:string):LWConstruction.Preview;
 constructionOptions():LWConstruction.Options;buildingDesign(id:unknown):LWConstruction.Draft|null;
 researchFeature(id:string):LWPhysicalPorts.ActionResult;
 configureBuilding(id:string,command:string,value:unknown):LWPhysicalPorts.ActionResult;
 export():Save;cancel(id:string):void;orderTask(o:LWConstruction.Order):LWPhysicalPorts.Draft|null;
 orderIssue(o:LWConstruction.Order):{text:string}|null;
 commandActor(id:string,work:()=>LWPhysicalPorts.ActionResult):LWPhysicalPorts.ActionResult;
}
const root=globalThis as unknown as {LW:{createWorldDemo():Native;Engine:{import(input:unknown):Native};RES:Record<string,unknown>};LWConstructionDesigns:LWConstruction.DesignsApi;LWConstructionGeometry:LWConstruction.GeometryApi;LWScenarioResources:{snapshot():unknown};LWAssets:{all():readonly unknown[]};LWCreatures:{all():readonly unknown[];readonly configuration:unknown};LWGeography:{grid(s:unknown):{pass(x:number,y:number):boolean}};LWInteriors:LWInterior.CatalogApi;LWWorldContent:LWContentPorts.WorldApi;LWGrowth:LWContentPorts.GrowthApi;LWStory:{encode(e:Native):unknown;inspect(input:unknown):{engine:Native};commit(p:unknown):Native}};
const copy=<T,>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error instanceof Error?error.stack||error.message:String(error)});console.error(name,error);}}
function clean():Native{
 const e=root.LW.createWorldDemo();e.selectCreature('c1');e.s.started=true;e.s.paused=false;
 e.s.buildings=e.s.buildings.filter(b=>b.kind==='storehouse');e.s.world.transfers=[];
 for(const a of e.creatures){a.homeId=null;a.orders=[];a.task=null;a.activeQuest=null;a.questPlan=null;a.training=null;a.learning.queue=[];a.learning.paused=true;a.equipQueue=[];a.stockTargets={};a.focus='builder';a.socialIntent=null;for(const key of Object.keys(a.needs))a.needs[key]=100;for(const key of Object.keys(a.inventory))a.inventory[key]=0;}
 e.s.colony.warehouse.inventory={};return e;
}
function draft(kind='shelter',width=4,height=4):LWConstruction.Draft{
 return {name:'Pip’s handmade place',kind,layout:{id:'handmade',label:'Handmade place',floors:[{id:'ground',label:'Ground floor',width,height,door:{x:1,y:height-1},stairs:[],stations:[{id:'work',label:'Working spot',kind:'workbench',production:true,x:2,y:1}]}]}};
}
function site(e:Native,d:LWConstruction.Draft):LWInterior.Point{
 const definition=root.LWConstructionDesigns.validate(d);for(let y=3;y<16;y++)for(let x=3;x<15;x++)if(!root.LWConstructionGeometry.issue(e,definition,x,y))return {x,y};throw Error('No fixture construction site');
}
function supply(e:Native,d:LWConstruction.Draft):void{const p=e.previewBuildingDesign(d);assert(p.ok);for(const [id,n]of Object.entries(p.cost))e.actor.inventory[id]=n;}
function command(e:Native,d:LWConstruction.Draft):LWConstruction.Order{const p=site(e,d);assert(e.dispatchCommand({id:'construct-design',actorId:e.actor.id,args:[d,p.x,p.y]}).ok);return e.actor.orders.at(-1)!;}
function complete(e:Native,o:LWConstruction.Order):LWConstruction.Building{
 for(let i=0;i<2000&&e.actor.orders.some(v=>v.id===o.id);i++)e.step(.1);
 assert(!e.actor.orders.some(v=>v.id===o.id),'physical work must finish: '+JSON.stringify({issue:e.orderIssue(o),stage:o.stage,paid:o.paid,progress:o.progress,task:e.actor.task?.label,inventory:e.actor.inventory}));const b=e.s.buildings.find(b=>b.designId===o.designId);assert(b);return b;
}

test('Detached geometry previews reuse known mechanics without changing catalogs or time',()=>{
 const e=clean(),before=e.export(),d=draft(),preview=e.previewBuildingDesign(d);assert(preview.ok);assert.equal(preview.phases.length,3);assert(preview.cost.wood!>=8);
 preview.design.layout.floors[0]!.width=19;const options=e.constructionOptions();options.types.length=0;assert(e.constructionOptions().types.length);assert.deepEqual(e.export(),before);
 assert.equal(e.previewBuildingDesign({...d,kind:'unreviewed-mechanic'}).ok,false);let reads=0;const malformed=Object.defineProperty({},'name',{enumerable:true,get(){reads++;return 'unsafe';}});assert.equal(e.previewBuildingDesign(malformed).ok,false);assert.equal(reads,0);
});
test('Unsupported geometry, disconnected rooms and forged commands reject without charge or orphan',()=>{
 const e=clean(),before=e.export(),d=draft();
 for(const bad of [{...d,callback:'run'},{...d,layout:{...d.layout,floors:[]}},{...d,kind:'unknown'}]){assert.equal(e.constructBuildingDesign(bad,8,8).ok,false);assert.deepEqual(e.export(),before);}
 const disconnected=copy(d);disconnected.layout.floors[0]!.cells=[{x:1,y:3},{x:1,y:2},{x:1,y:1},{x:3,y:0}];assert.equal(e.previewBuildingDesign(disconnected).ok,false);
 const badDoor=copy(d);badDoor.layout.floors[0]!.door.y=0;assert.equal(e.previewBuildingDesign(badDoor).ok,false);
 assert.equal(e.dispatchCommand({id:'construct-design',actorId:'c999',args:[d,8,8]}).ok,false);assert.deepEqual(e.export(),before);
});
test('Whole footprints reserve land and reject collisions for both standard and authored plans',()=>{
 const e=clean(),d=draft('shelter',8,8),o=command(e,d);assert(o.designId);assert.equal(e.s.buildings.some(b=>b.designId===o.designId),false);
 const blocked={x:o.x!+1,y:o.y!-1};assert.equal(root.LWGeography.grid(e.s).pass(blocked.x,blocked.y),false);
 const before=e.export();assert.equal(e.constructBuildingDesign(d,blocked.x,blocked.y).ok,false);assert.equal(e.place('shelter',blocked.x,blocked.y).ok,false);assert.deepEqual(e.export(),before);
});
test('Creatures pay each physical stage, carry their own supplies and only activate finished designs',()=>{
 const e=clean(),d=draft();supply(e,d);const initial={...e.actor.inventory},o=command(e,d),phases=e.constructionPhases(o);let paidCheckpoint=false,walked=false;
 for(let i=0;i<1200&&e.actor.orders.some(v=>v.id===o.id);i++){e.step(.1);if(e.actor.task?.orderId===o.id&&e.actor.task.phase==='walk')walked=true;
  const pending=e.actor.orders.find(v=>v.id===o.id);if(pending&&pending.stage===0&&pending.paid){paidCheckpoint=true;assert.equal(e.actor.inventory.stone,initial.stone!-phases[0]!.cost.stone!);assert(!e.s.buildings.some(b=>b.designId===o.designId));}
 }
 assert(walked);assert(paidCheckpoint);const building=e.s.buildings.find(b=>b.designId===o.designId);assert(building);assert.equal(root.LWInteriors.forBuilding(e.s as unknown as LWInterior.World,building).id,d.layout.id);
 const cost=root.LWConstructionDesigns.cost(e.s.construction!.designs[o.designId!]!);for(const [id,n]of Object.entries(cost))assert.equal(e.actor.inventory[id],initial[id]!-n);
});
test('Paid interrupted work resumes exactly through native and portable checkpoints',()=>{
 const e=clean(),d=draft();supply(e,d);const o=command(e,d);for(let i=0;i<300&&!o.paid;i++)e.step(.1);assert(o.paid);assert(e.actor.orders.some(v=>v.id===o.id));
 const saved=e.export(),native=root.LW.Engine.import(saved);assert.deepEqual(native.export(),saved);
 const portable=root.LWStory.encode(e),opened=root.LWStory.commit(root.LWStory.inspect(portable));assert.deepEqual(opened.export(),saved);
 for(let i=0;i<150;i++){e.step(.1);native.step(.1);opened.step(.1);}assert.deepEqual(native.export(),e.export());assert.deepEqual(opened.export(),e.export());
});
test('Cancel returns reserved stage supplies and frees every footprint tile without a phantom building',()=>{
 const e=clean(),d=draft('shelter',8,8);supply(e,d);const o=command(e,d);for(let i=0;i<300&&!o.paid;i++)e.step(.1);assert(o.paid);
 e.cancel(o.id);assert(!e.actor.orders.some(v=>v.id===o.id));assert(!e.s.buildings.some(b=>b.designId===o.designId));assert(root.LWGeography.grid(e.s).pass(o.x!+1,o.y!-1));
 assert.deepEqual(root.LW.Engine.import(e.export()).export(),e.export());
});
test('Add-floor improvement keeps the old layout during paid stages and activates on completion',()=>{
 const e=clean(),d=draft();supply(e,d);const b=complete(e,command(e,d)),old=b.designId,next=e.buildingDesign(b.id)!;const ground=next.layout.floors[0]!,upper=copy(ground);upper.id='upper';upper.label='New upper floor';upper.stairs=[{x:0,y:0,to:ground.id,arrival:{x:0,y:0},seconds:2}];ground.stairs.push({x:0,y:0,to:'upper',arrival:{x:0,y:0},seconds:2});next.layout.floors.push(upper);
 supply(e,next);assert(e.improveBuildingDesign(b.id,next).ok);const order=e.actor.orders.at(-1)!;assert.equal(b.designId,old);
 for(let i=0;i<100;i++){e.step(.1);if(e.actor.orders.some(o=>o.id===order.id))assert.equal(b.designId,old);}
 const upgraded=complete(e,order);assert.equal(upgraded.id,b.id);assert.equal(root.LWInteriors.forBuilding(e.s as unknown as LWInterior.World,b).floors.length,2);
});
test('A vertical floor addition preserves a standard foundation beside an unrelated neighbor',()=>{
 const e=clean(),building=e.s.buildings[0]!,draft=e.buildingDesign(building.id)!;e.actor.skills.logistics=true;e.actor.practice.logistics=12;assert.equal(building.designId,undefined);
 const neighbor={id:'b'+e.s.nextId++,kind:'bench',x:building.x+1,y:building.y,level:1,quality:60,stock:0,regen:0};e.s.buildings.push(neighbor);
 const old=draft.layout.floors.at(-1)!,floor=copy(old);floor.id='attic';floor.label='New attic';floor.stairs=[{x:0,y:0,to:old.id,arrival:{x:0,y:0},seconds:2}];old.stairs.push({x:0,y:0,to:floor.id,arrival:{x:0,y:0},seconds:2});draft.layout.floors.push(floor);
 const estimate=e.previewBuildingDesign(draft,building.id);assert(estimate.ok);assert.deepEqual(estimate.design.footprint,[{x:0,y:0}]);for(const [id,n]of Object.entries(estimate.cost))e.actor.inventory[id]=n;
 const accepted=e.improveBuildingDesign(building.id,draft);assert(accepted.ok,accepted.ok?'':accepted.reason);const order=e.actor.orders.at(-1)!;assert.equal(building.designId,undefined);assert.equal(root.LWConstructionGeometry.cells(e.s,{x:order.x!,y:order.y!,designId:order.designId!}).length,1);
 const upgraded=complete(e,order);assert.equal(upgraded.id,building.id);assert(e.s.buildings.some(b=>b.id===neighbor.id));assert.deepEqual(e.s.construction!.designs[upgraded.designId!]!.footprint,[{x:0,y:0}]);
});
test('Expanded improvement reservations reject neighboring footprints through commands and native saves',()=>{
 const e=clean(),base=draft(),expanded=draft('shelter',8,4),p=site(e,expanded);supply(e,base);assert(e.constructBuildingDesign(base,p.x,p.y).ok);const b=complete(e,e.actor.orders.at(-1)!),next=e.buildingDesign(b.id)!;next.layout.floors[0]!.width=8;
 const neighbor={id:'b'+e.s.nextId++,kind:'bench',x:b.x+1,y:b.y,level:1,quality:60,stock:0,regen:0};e.s.buildings.push(neighbor);const before=e.export();assert.equal(e.improveBuildingDesign(b.id,next).ok,false);assert.deepEqual(e.export(),before);
 e.s.buildings=e.s.buildings.filter(v=>v.id!==neighbor.id);assert(e.improveBuildingDesign(b.id,next).ok);assert.equal(root.LWGeography.grid(e.s).pass(b.x+1,b.y),false);
 const saved=e.export(),forged=copy(saved);forged.state.buildings.push(neighbor);assert.throws(()=>root.LW.Engine.import(forged),/overlapping footprints/);assert.deepEqual(e.export(),saved);const removed=copy(saved);removed.state.construction!.designs[e.actor.orders.at(-1)!.designId!]!.layout.floors[0]!.stations=[];assert.throws(()=>root.LW.Engine.import(removed),/workstation/i);assert.deepEqual(root.LW.Engine.import(saved).export(),saved);
});
test('Authored farm plots require and exhaust real finite substrate with paid water input',()=>{
 const land=copy(root.LWWorldContent.content);land.nodes.find(n=>n.id==='soil')!.mode='finite';root.LWWorldContent.withLibrary(land,()=>{
 const e=clean(),d=draft('garden'),p=site(e,draft());assert.equal(e.constructBuildingDesign(d,p.x,p.y).ok,false);
 assert(e.researchFeature('homestead-1').ok);assert(e.researchFeature('blueprint-garden').ok);
 const soil={id:'authored-soil',kind:'soil',x:p.x,y:p.y,stock:3,max:3,regen:0};e.s.nodes.push(soil);supply(e,d);
 const result=e.constructBuildingDesign(d,p.x,p.y);assert(result.ok,result.ok?'':result.reason);const b=complete(e,e.actor.orders.at(-1)!);assert.equal(soil.stock,3);assert.equal(b.storage!.completed,0);assert.equal(b.stock,0);
 b.storage!.targets={};e.actor.inventory.water=3;assert(e.configureBuilding(b.id,'batch',{recipe:'berries',amount:3}).ok);
 let paidWater=false;for(let i=0;i<2400&&b.storage!.completed<3;i++){e.step(.1);if(b.storage!.job){assert.equal(b.storage!.job.cost.water,1);paidWater=true;}}
 assert.equal(b.storage!.completed,3);assert.equal(soil.stock,0);
 assert(paidWater);assert(e.s.world.transfers.filter(t=>t.buildingId===b.id&&t.direction==='in'&&t.resource==='water').reduce((n,t)=>n+t.amount,0)>=3);
 assert.deepEqual(root.LW.Engine.import(e.export()).export(),e.export());
 });
});
test('Typed SDK commands and captured scenarios preserve complete unfinished design values',()=>{
 const game=toolbox.create({scenarioId:'littlewild',sceneId:'charted-home'});let captured:LittlewildDeveloper.Document={},native:LittlewildDeveloper.Document={};
 try{const before=game.save(),e=root.LW.Engine.import(before),d=draft(),p=site(e,d);
  assert(game.command({id:'construct-design',actorId:'c1',args:[d,p.x,p.y]}).ok);native=game.save();captured=game.captureScenario();assert(toolbox.validateScenario(captured).ok);
  const view=game.constructionOptions();assert(view.designs.length);view.designs[0]!.name='Detached edit';assert.notEqual(game.constructionOptions().designs[0]!.name,'Detached edit');
 }finally{game.dispose();}
 const replay=toolbox.createScenario(captured,'charted-home');try{assert.deepEqual(replay.save(),native);}finally{replay.dispose();}
});
test('Malformed saved design references, footprints and upgrade identities reject without mutation',()=>{
 const e=clean(),d=draft(),o=command(e,d),before=e.export();
 for(const change of [(s:Save)=>{s.state.construction!.sequence=1;},(s:Save)=>{s.state.construction!.designs[o.designId!]!.footprint.push({x:9,y:9});},(s:Save)=>{s.state.colony.creatures[0]!.orders[0]!.designId='missing';},(s:Save)=>{delete s.state.construction;},(s:Save)=>{s.state.colony.creatures[0]!.orders[0]!.x=0;s.state.colony.creatures[0]!.orders[0]!.y=0;}]){const bad=copy(before);change(bad);const resources=root.LWScenarioResources.snapshot(),assets=root.LWAssets.all(),creatures=root.LWCreatures.all(),configuration=root.LWCreatures.configuration;assert.throws(()=>root.LW.Engine.import(bad),/construction|design|footprint/i);assert.deepEqual(e.export(),before);assert.deepEqual(root.LWScenarioResources.snapshot(),resources);assert.strictEqual(root.LWAssets.all(),assets);assert.strictEqual(root.LWCreatures.all(),creatures);assert.strictEqual(root.LWCreatures.configuration,configuration);}
});
fs.writeFileSync(__dirname+'/construction-results.json',JSON.stringify({passed:results.filter(r=>r.passed).length,total:results.length,results},null,2));console.log(results.filter(r=>r.passed).length+'/'+results.length+' construction checks passed.');if(results.some(r=>!r.passed))process.exit(1);
