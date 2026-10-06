/// <reference path="./building-interior-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
require('./developer-sdk.cjs');
interface Native extends LWInterior.Engine {s:LWInterior.World & {seed:number};step(dt:number):void;advance(seconds:number):void;export():{version:number;state:LWInterior.World};visitBuildingFloor(a:unknown,b:unknown,f:unknown):LWPhysicalPorts.ActionResult;orderBuildingProduction(b:unknown,f:unknown,s:unknown,r:unknown,n:unknown):LWPhysicalPorts.ActionResult;buildingInterior(id:string):LWInterior.Snapshot|null;}
const root=globalThis as unknown as {
 LW:{Engine:{import(input:unknown):Native};createWorldDemo():Native};
 LWInteriors:LWInterior.CatalogApi;LWInteriorState:{validate(input:unknown,world:LWInterior.World):unknown};
 LWStory:{encode(engine:Native):unknown;inspect(input:unknown):{engine:Native};commit(input:unknown):Native};
 LWScenarios:{capture(engine:Native):{scenes:{id:string}[]};prepareScene(pack:unknown,id:string):unknown;commitScene(preview:unknown):Native};
};
const copy=<T,>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
function demo():Native{const e=root.LW.createWorldDemo();for(const b of e.s.buildings)if(b.storage)e.configureBuilding(b.id,'clear',null);for(const c of e.creatures){c.task=null;c.orders=[];c.training=null;c.learning.queue=[];c.stockTargets=Object.fromEntries(Object.keys(c.stockTargets).map(id=>[id,0]));c.needs.food=c.needs.water=c.needs.energy=95;}return e;}
function tick(e:Native,until:(e:Native)=>boolean,limit=2400):boolean{for(let i=0;i<limit;i++){e.step(.1);if(until(e))return true;}return false;}
const bench=(e:Native):LWPhysicalPorts.Building=>e.s.buildings.find(b=>b.kind==='bench')!;
function roundtrip(e:Native):Native{const save=e.export(),other=root.LW.Engine.import(save);assert.deepEqual(other.export(),save);return other;}

test('Authored layouts enforce return stairs and all room cells, stations and doors are reachable',()=>{
 const catalog=root.LWInteriors.validate(root.LWInteriors.defaults);assert(catalog.layouts.every(l=>l.floors.length===2));
 const disconnected=copy(catalog);disconnected.layouts[0]!.floors[1]!.stairs=[];assert.throws(()=>root.LWInteriors.validate(disconnected),/disconnected/);
 const blocked=copy(catalog),floor=blocked.layouts[0]!.floors[0]!;floor.cells=[{x:1,y:5},{x:1,y:4},{x:3,y:2},{x:6,y:1}];assert.throws(()=>root.LWInteriors.validate(blocked),/disconnected/);
 const wall=copy(catalog),f=wall.layouts[0]!.floors[0]!;f.edges=[{x:1,y:5,side:'n',kind:'wall'},{x:1,y:5,side:'e',kind:'wall'},{x:1,y:5,side:'w',kind:'wall'}];assert.throws(()=>root.LWInteriors.validate(wall),/disconnected/);
});
test('Catalog validation rejects accessors without executing caller code',()=>{
 let reads=0;const catalog=copy(root.LWInteriors.defaults);Object.defineProperty(catalog,'version',{enumerable:true,get(){reads++;return 1;}});assert.throws(()=>root.LWInteriors.validate(catalog));assert.equal(reads,0);
});
test('Interior projections and player observation are detached and leave RNG, inventories and time untouched',()=>{
 const e=demo(),before=e.export(),snapshot=e.buildingInterior(bench(e).id)!;assert.equal(e.s.interiors,undefined);snapshot.floors[0]!.label='corrupted';snapshot.input.wood=999;assert.deepEqual(e.export(),before);assert.notEqual(e.buildingInterior(bench(e).id)!.floors[0]!.label,'corrupted');
});
test('Invalid exact floor, station, recipe and quantities reject atomically',()=>{
 const e=demo(),id=bench(e).id,before=e.export();
 for(const args of [[id,'missing','work','planks',1],[id,'upper','supplies','planks',1],[id,'upper','work','missing',1],[id,'upper','work','planks',0],[id,'upper','work','planks',13],['missing','upper','work','planks',1]] as const){assert.equal(e.orderBuildingProduction(args[0],args[1],args[2],args[3],args[4]).ok,false);assert.deepEqual(e.export(),before);}
 assert.equal(e.visitBuildingFloor('missing',id,'upper').ok,false);assert.deepEqual(e.export(),before);
});
test('A paid batch remains at zero progress during actual doorway and stair travel, then works upstairs',()=>{
 const e=demo(),b=bench(e),input=b.storage!.input.wood!;assert(e.orderBuildingProduction(b.id,'upper','work','planks',1).ok);
 assert(tick(e,()=>!!b.storage?.job&&e.creatures.some(c=>c.task?.jobId===b.storage!.job!.id&&c.task.phase==='work'&&!!e.s.interiors?.locations[c.id]?.route.length)),'No real worker reached the workplace');
 const j=b.storage!.job!,worker=e.creatures.find(c=>c.id===j.workerId)!,food=worker.needs.food,position={...worker.creature};assert.equal(j.progress,0);assert.equal(b.storage!.input.wood,input-2);assert(e.s.interiors!.jobs[j.id]?.floorId==='upper');const walking=roundtrip(e);e.step(.1);walking.step(.1);assert.deepEqual(walking.export(),e.export());assert(worker.needs.food<food);assert.deepEqual(worker.creature,position);assert.equal(j.progress,0);
 assert(tick(e,()=>j.progress>0));const location=e.s.interiors!.locations[worker.id]!;assert.equal(location.floorId,'upper');assert.equal(location.stationId,'work');assert.equal(location.route.length,0);assert(e.buildingInterior(b.id)!.actors.some(a=>a.id===worker.id&&a.floorId==='upper'&&a.progress!>0));roundtrip(e);
});
test('Item and equipment orders use the same physical paid jobs and complete with real outputs',()=>{
 for(const recipe of ['planks','friendship_charm']){
  const e=demo(),b=bench(e),completed=b.storage!.completed;assert(e.orderBuildingProduction(b.id,'upper','work',recipe,1).ok);assert(tick(e,()=>b.storage!.completed>completed),'Requested '+recipe+' never completed');assert.equal(b.storage!.requests[recipe],0);assert(e.creatures.some(c=>(c.metrics.crafts[recipe]||0)>0));assert.equal(Object.keys(e.s.interiors!.jobs).length,0);roundtrip(e);
 }
});
test('Creature floor visits queue without teleporting, walk the map, climb stairs and preserve task continuation',()=>{
 const e=demo(),actor=e.creatures[0]!,b=e.s.buildings.find(b=>b.kind==='shelter')!,before=copy(actor.creature),seed=e.s.seed,inventory=copy(actor.inventory);
 assert(e.visitBuildingFloor(actor.id,b.id,'upper').ok);assert.deepEqual(actor.creature,before);assert.deepEqual(actor.inventory,inventory);assert.equal(e.s.seed,seed);
 assert(tick(e,()=>e.s.interiors!.visits.some(v=>v.actorId===actor.id&&v.phase==='walk'&&v.path.length>0)));const copyWorld=roundtrip(e);for(let i=0;i<20;i++){e.step(.1);copyWorld.step(.1);}assert.deepEqual(copyWorld.export(),e.export());
 assert(tick(e,()=>e.s.interiors?.locations[actor.id]?.floorId==='upper'));const location=e.s.interiors!.locations[actor.id]!;assert.equal(location.buildingId,b.id);assert(Math.hypot(actor.creature.x-b.x,actor.creature.y-b.y)<=1.51);assert(actor.needs.food<95);roundtrip(e);
 assert(tick(e,()=>!e.s.interiors!.visits.some(v=>v.actorId===actor.id)));assert(tick(e,()=>!e.s.interiors!.locations[actor.id]));roundtrip(e);
});
test('Paid work on the same floor waits for the exact workstation location',()=>{
 const e=demo(),b=bench(e);assert(e.orderBuildingProduction(b.id,'upper','work','planks',1).ok);assert(tick(e,()=>!!b.storage?.job&&b.storage.job.progress>0));const job=b.storage!.job!,worker=e.creatures.find(c=>c.id===job.workerId)!,location=e.s.interiors!.locations[worker.id]!,floor=root.LWInteriors.forBuilding(e.s,b).floors.find(f=>f.id==='upper')!,point=floor.stations.find(s=>s.id==='work')!,before=job.progress;
 location.x=point.x+1;location.y=point.y;location.stationId=null;e.step(.1);assert.equal(job.progress,before);assert(location.route.length>0);assert(tick(e,()=>job.progress>before));assert.equal(location.x,point.x);assert.equal(location.y,point.y);assert.equal(location.stationId,'work');roundtrip(e);
});
test('Manual pause freezes indoor travel, task progress and visit timing',()=>{
 const e=demo(),b=bench(e);assert(e.orderBuildingProduction(b.id,'upper','work','planks',1).ok);assert(tick(e,()=>Object.values(e.s.interiors?.locations||{}).some(l=>l.route.length>0)));e.s.paused=true;const before=e.export();e.advance(10);assert.deepEqual(e.export(),before);
});
test('Malformed floor locations, station jobs and unmatched future batches reject imported saves',()=>{
 const e=demo(),b=bench(e);assert(e.orderBuildingProduction(b.id,'upper','work','planks',2).ok);assert(tick(e,()=>!!b.storage?.job&&Object.values(e.s.interiors?.locations||{}).some(l=>l.route.length>0)));const source=e.export();
 for(const edit of [(s:LWInterior.World)=>{Object.values(s.interiors!.locations)[0]!.floorId='missing';},(s:LWInterior.World)=>{Object.values(s.interiors!.jobs)[0]!.stationId='supplies';},(s:LWInterior.World)=>{s.interiors!.production[b.id]![0]!.remaining=12;},(s:LWInterior.World)=>{Object.values(s.interiors!.locations)[0]!.x=999;}]){const bad=copy(source);edit(bad.state);assert.throws(()=>root.LW.Engine.import(bad),/interior/i);assert.deepEqual(e.export(),source);}
});
test('Saved visits reject an occupant in another building and room positions outside authored cells',()=>{
 const e=demo(),actor=e.creatures[0]!,b=e.s.buildings.find(b=>b.kind==='shelter')!;assert(e.visitBuildingFloor(actor.id,b.id,'upper').ok);assert(tick(e,()=>e.s.interiors!.visits.some(v=>v.actorId===actor.id&&v.phase==='inside')));const source=e.export(),wrong=copy(source);wrong.state.interiors!.locations[actor.id]!.purpose='work';assert.throws(()=>root.LW.Engine.import(wrong),/matching interior location/);assert.deepEqual(e.export(),source);
 const floor=root.LWInteriors.forBuilding(e.s,b).floors[0]!,outside=copy(source);outside.state.interiors!.catalog.layouts.find(l=>l.id===root.LWInteriors.forBuilding(e.s,b).id)!.floors[0]!.cells=Array.from({length:floor.width*floor.height},(_,i)=>({x:i%floor.width,y:Math.floor(i/floor.width)})).filter(p=>p.x!==0||p.y!==0);Object.assign(outside.state.interiors!.locations[actor.id]!,{x:0,y:0,route:[]});assert.throws(()=>root.LW.Engine.import(outside),/position outside floor/);assert.deepEqual(e.export(),source);
 for(const x of [1,1.6]){const blocked=copy(source),layout=blocked.state.interiors!.catalog.layouts.find(l=>l.id===root.LWInteriors.forBuilding(e.s,b).id)!;layout.floors[0]!.edges=[{x:1,y:5,side:'e',kind:'wall'}];Object.assign(blocked.state.interiors!.locations[actor.id]!,{x,y:5,route:[{floorId:'ground',x:2,y:5,seconds:(2-x)/2}]});assert.throws(()=>root.LW.Engine.import(blocked),/route skips indoor cells/);assert.deepEqual(e.export(),source);}
});
test('Native and portable stories preserve exact running floor and job continuation',()=>{
 const e=demo(),b=bench(e);assert(e.orderBuildingProduction(b.id,'upper','work','planks',2).ok);assert(tick(e,()=>!!b.storage?.job&&Object.values(e.s.interiors?.locations||{}).some(l=>l.route.length>0)));const save=e.export(),native=roundtrip(e),portable=root.LWStory.commit(root.LWStory.inspect(root.LWStory.encode(e)));assert.deepEqual(portable.export(),save);
 for(let i=0;i<400;i++){e.step(.1);native.step(.1);portable.step(.1);}assert.deepEqual(native.export(),e.export());assert.deepEqual(portable.export(),e.export());
});
test('Captured scenarios retain their embedded layouts and exact active stair continuation',()=>{
 const e=demo(),b=bench(e);assert(e.orderBuildingProduction(b.id,'upper','work','planks',2).ok);assert(tick(e,()=>!!b.storage?.job&&Object.values(e.s.interiors?.locations||{}).some(l=>l.route.length>0)));const pack=root.LWScenarios.capture(e),restored=root.LWScenarios.commitScene(root.LWScenarios.prepareScene(pack,pack.scenes[0]!.id));assert.deepEqual(restored.export(),e.export());for(let i=0;i<200;i++){e.step(.1);restored.step(.1);}assert.deepEqual(restored.export(),e.export());
});
test('Clearing future work removes station requests while retaining a paid batch and its reserved materials',()=>{
 const e=demo(),b=bench(e);assert(e.orderBuildingProduction(b.id,'upper','work','planks',2).ok);assert(tick(e,()=>!!b.storage?.job));const paid=copy(b.storage!.job);assert(e.configureBuilding(b.id,'clear',null).ok);assert.deepEqual(b.storage!.job,paid);assert.equal(e.s.interiors!.production[b.id],undefined);roundtrip(e);
});
test('Authored onsite customer calls remain real visible occupants with portable quest continuation',()=>{
 const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'content','office.pack.json'),'utf8')) as unknown,e=root.LWScenarios.commitScene(root.LWScenarios.prepareScene(pack,'operations-shift'));assert(tick(e,()=>e.creatures.some(c=>c.id==='c2'&&!!c.activeQuest)));e.step(.1);const actor=e.creatures.find(c=>c.id==='c2')!,location=e.s.interiors!.locations[actor.id]!;assert.equal(location.buildingId,'office-sales');assert.equal(location.floorId,'ground');const view=e.buildingInterior('office-sales')!.actors.find(c=>c.id===actor.id)!;assert.match(view.action,/Customer discovery call/);assert(view.progress!==null);const native=roundtrip(e),story=root.LWStory.commit(root.LWStory.inspect(root.LWStory.encode(e))),captured=root.LWScenarios.capture(e),scene=root.LWScenarios.commitScene(root.LWScenarios.prepareScene(captured,captured.scenes[0]!.id));for(let i=0;i<100;i++){e.step(.1);native.step(.1);story.step(.1);scene.step(.1);}assert.deepEqual(native.export(),e.export());assert.deepEqual(story.export(),e.export());assert.deepEqual(scene.export(),e.export());
});
const report={suite:'building-interiors',passed:results.filter(r=>r.passed).length,total:results.length,results};
fs.mkdirSync(path.resolve(__dirname),{recursive:true});fs.writeFileSync(path.join(__dirname,'building-interiors-results.json'),JSON.stringify(report,null,2)+'\n');console.log(`${report.passed}/${report.total} building interior checks passed`);if(report.passed!==report.total)process.exitCode=1;
