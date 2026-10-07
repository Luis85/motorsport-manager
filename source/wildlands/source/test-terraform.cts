/// <reference path="./terraform-contracts.d.ts" />
// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {toolbox} from './developer-sdk.cjs';
interface Native extends LWTerraform.Engine {
 terraformSnapshot():LWTerraform.Snapshot;previewTerraform(input:unknown):LWTerraform.Preview;applyTerraform(input:unknown):LWPhysicalPorts.ActionResult;
 terrainAt(x:number,y:number):string;terrainHeight(x:number,y:number):number;
 step(dt:number):void;advance(dt:number):void;export():{version:number;state:LWTerraform.World};
 resourceTask(id:string,orderId?:string|null,force?:boolean,quantity?:number):LWPhysicalPorts.Draft|null;
 startTask(input:LWPhysicalPorts.Draft|null):boolean;withActor<T>(actor:LWApplication.Actor,fn:()=>T):T;
 orderBuildingProduction(b:string,f:string,s:string,r:string,n:number):LWPhysicalPorts.ActionResult;
}
const root=globalThis as unknown as {
 LW:{Engine:{import(input:unknown):Native};createWorldDemo():Native};LWGeography:LWTerraform.Geography;
 LWStory:{encode(engine:Native):unknown;inspect(input:unknown):{engine:Native};commit(input:unknown):Native};
 LWScenarios:{capture(engine:Native):unknown;prepareScene(pack:unknown,id:string):unknown;commitScene(preview:unknown):Native};
 LWAssets:{revision:number};LWCreatures:{revision:number};
};
const results:{name:string;passed:boolean;error?:string}[]=[];
const copy=<T,>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
function demo():Native{return root.LW.createWorldDemo();}
function edit(e:Native,tiles:LWTerraform.TileEdit[]=[],plants:LWTerraform.PlantEdit[]=[]):LWTerraform.Edit{return {revision:e.terraformSnapshot().revision,tiles,plants};}
function accepted(e:Native,make:(p:LWApplication.Point)=>LWTerraform.Edit):LWTerraform.Edit{
 for(let y=2;y<=16;y++)for(let x=2;x<=16;x++){const proposed=make({x,y});if(e.previewTerraform(proposed).ok)return proposed;}
 throw Error('No safe editable tile found.');
}
function roundtrip(e:Native):Native{const native=e.export(),other=root.LW.Engine.import(native);assert.deepEqual(other.export(),native);return other;}
function unchanged(e:Native,proposal:unknown):void{const before=e.export();assert.equal(e.previewTerraform(proposal).ok,false);assert.equal(e.applyTerraform(proposal).ok,false);assert.deepEqual(e.export(),before);}
const bootstrap=toolbox.create({scenarioId:'littlewild',sceneId:'charted-home'});bootstrap.dispose();

test('Detached terrain choices and preview leave all state and RNG untouched',()=>{
 const e=demo(),before=e.export(),snapshot=e.terraformSnapshot();assert(snapshot.choices.some(c=>c.kind==='wood'&&c.models.includes('world-pine')));
 snapshot.choices[0]!.models.length=0;snapshot.tiles['9,9']={ground:'water',height:4};assert.deepEqual(e.export(),before);
 const proposal=accepted(e,p=>edit(e,[{...p,height:1}]));assert(e.previewTerraform(proposal).ok);assert.deepEqual(e.export(),before);assert.equal(e.terrainHeight(9,9),0);
});
test('Current-world water changes actual navigation, and grass restores it without a global profile change',()=>{
 const e=demo(),proposal=accepted(e,p=>edit(e,[{...p,ground:'water'}])),tile=proposal.tiles[0]!;
 const independent=demo();assert(e.applyTerraform(proposal).ok);assert.equal(e.terrainAt(tile.x,tile.y),'water');assert.equal(new root.LWGeography.Grid(e.s).pass(tile.x,tile.y),false);
 assert.equal(independent.terrainAt(tile.x,tile.y),'grass');assert(e.applyTerraform(edit(e,[{x:tile.x,y:tile.y,ground:'grass'}])).ok);assert.equal(new root.LWGeography.Grid(e.s).pass(tile.x,tile.y),true);roundtrip(e);
});
test('Elevation is authoritative and cliffs cannot disconnect a walkable settlement',()=>{
 const e=demo(),proposal=accepted(e,p=>edit(e,[{...p,height:1}])),tile=proposal.tiles[0]!;assert(e.applyTerraform(proposal).ok);assert.equal(e.terrainHeight(tile.x,tile.y),1);
 const grid=new root.LWGeography.Grid(e.s),neighbour=[{x:tile.x+1,y:tile.y},{x:tile.x-1,y:tile.y},{x:tile.x,y:tile.y+1},{x:tile.x,y:tile.y-1}].find(p=>grid.pass(p.x,p.y))!;
 assert(grid.canStep(neighbour,tile));unchanged(e,edit(e,[{x:tile.x,y:tile.y,height:4}]));roundtrip(e);
});
test('Unsafe occupancy, bridge, actor, resource and mixed-batch changes reject atomically',()=>{
 const e=demo(),building=e.s.buildings[0]!,node=e.s.nodes[0]!,actor=e.creatures[0]!;
 for(const p of [building,node,{x:Math.round(actor.creature.x),y:Math.round(actor.creature.y)}])unchanged(e,edit(e,[{x:p.x,y:p.y,ground:'water'}]));
 unchanged(e,edit(e,[{x:20,y:9,ground:'grass'}]));unchanged(e,edit(e,[{x:2000,y:9,ground:'grass'}]));
 const safe=accepted(e,p=>edit(e,[{...p,height:1}]));unchanged(e,{...safe,tiles:[...safe.tiles,{x:node.x,y:node.y,ground:'water'}]});
 unchanged(e,edit(e,[],[{x:building.x,y:building.y,kind:'wood',model:'world'}]));
});
test('Existing paid storage and jobs survive terrain transactions exactly',()=>{
 const e=demo(),bench=e.s.buildings.find(b=>b.kind==='bench')!;assert(e.orderBuildingProduction(bench.id,'upper','work','planks',1).ok);
 for(let i=0;i<2000&&!bench.storage?.job;i++)e.step(.1);assert(bench.storage?.job,'No real paid job was reserved');
 const physical=structuredClone(e.s.buildings.map(b=>b.storage)),before=copy(e.creatures.map(c=>({inventory:c.inventory,task:c.task,orders:c.orders})));
 assert(e.applyTerraform(accepted(e,p=>edit(e,[{...p,height:1}]))).ok);assert.deepEqual(e.s.buildings.map(b=>b.storage),physical);assert.deepEqual(e.creatures.map(c=>({inventory:c.inventory,task:c.task,orders:c.orders})),before);
});
test('Planted trees and plants become real sources using authored assets and existing harvesting tasks',()=>{
 const e=demo(),proposal=accepted(e,p=>edit(e,[],[{...p,kind:'herbs',model:'world'}]));assert(e.applyTerraform(proposal).ok);
 const id=Object.keys(e.s.terraform!.plants)[0]!,node=e.s.nodes.find(n=>n.id===id)!;assert.equal(node.kind,'herbs');assert.equal(node.max,80);assert.equal(node.regen,0);
 const actor=e.creatures[0]!;actor.task=null;actor.orders=[];actor.training=null;actor.skills.herbalism=true;actor.needs.food=actor.needs.water=actor.needs.energy=95;actor.inventory.herbs=0;
 // Make this source the only available herbs node, without changing its authority or task code.
 for(const n of e.s.nodes)if(n.kind==='herbs'&&n.id!==id)n.kind='fiber';
 const task=e.withActor(actor,()=>e.resourceTask('herbs',null,true,3));assert(task&&task.target?.x===node.x&&task.target.y===node.y);assert(e.withActor(actor,()=>e.startTask(task)));
 for(let i=0;i<1600&&(actor.inventory.herbs||0)===0;i++)e.step(.1);assert((actor.inventory.herbs||0)>0,'Planted source was never physically harvested');roundtrip(e);
});
test('Stale previews and non-JSON inputs cannot mutate the world or execute getters',()=>{
 const e=demo(),proposal=accepted(e,p=>edit(e,[{...p,height:1}]));assert(e.applyTerraform(proposal).ok);unchanged(e,proposal);
 let reads=0;const getter={get revision(){reads++;return 0;},tiles:[],plants:[]};unchanged(e,getter);assert.equal(reads,0);
 unchanged(e,{revision:e.terraformSnapshot().revision,tiles:[{x:8,y:8,height:1,execute:true}],plants:[]});
 unchanged(e,edit(e,[],[{x:3,y:3,kind:'wood',model:'script'}]));
 const sparse:unknown[]=Array(1);Object.defineProperty(sparse,'extra',{value:{x:3,y:3,height:1},enumerable:true});unchanged(e,{revision:e.terraformSnapshot().revision,tiles:sparse,plants:[]});
 let iterations=0;const inherited:unknown[]=[];Object.setPrototypeOf(inherited,{[Symbol.iterator](){iterations++;return [][Symbol.iterator]();}});unchanged(e,{revision:e.terraformSnapshot().revision,tiles:inherited,plants:[]});assert.equal(iterations,0);
});
test('Save imports deeply validate tile bounds, assets, references and sequence counters',()=>{
 const e=demo();assert(e.applyTerraform(accepted(e,p=>edit(e,[],[{...p,kind:'wood',model:'world-pine'}]))).ok);
 const save=e.export(),plant=Object.keys(e.s.terraform!.plants)[0]!;
 for(const mutate of [
  (s:LWTerraform.World)=>{s.terraform!.tiles['20,9']={ground:'grass',height:0};},
  (s:LWTerraform.World)=>{s.terraform!.plants[plant]!.model='missing';},
  (s:LWTerraform.World)=>{s.nodes=s.nodes.filter(n=>n.id!==plant);},
  (s:LWTerraform.World)=>{s.terraform!.sequence=1;},
  (s:LWTerraform.World)=>{delete s.terraform;},
  (s:LWTerraform.World)=>{const b=s.buildings[0]!;s.terraform!.tiles[b.x+','+b.y]={ground:'water',height:0};}
 ]){const bad=copy(save);mutate(bad.state);assert.throws(()=>root.LW.Engine.import(bad));assert.deepEqual(e.export(),save);}
 roundtrip(e);
});
test('Native and portable story save/resume preserve exact terrain and simulation continuation',()=>{
 const e=demo();assert(e.applyTerraform(accepted(e,p=>edit(e,[{...p,height:1}]))).ok);
 const native=roundtrip(e),story=root.LWStory.encode(e),resumed=root.LWStory.commit(root.LWStory.inspect(story));assert.deepEqual(resumed.export(),e.export());
 for(let i=0;i<30;i++){e.step(.1);native.step(.1);resumed.step(.1);}assert.deepEqual(native.export(),e.export());assert.deepEqual(resumed.export(),e.export());
});
test('Scenario capture and launch preserve current-world terrain and plants without changing the original',()=>{
 const e=demo();assert(e.applyTerraform(accepted(e,p=>edit(e,[],[{...p,kind:'wood',model:'world-amber'}]))).ok);
 assert(e.applyTerraform(accepted(e,p=>edit(e,[{...p,height:1}]))).ok);const before=e.export(),pack=root.LWScenarios.capture(e) as {scenes:{id:string}[]};
 const preview=root.LWScenarios.prepareScene(pack,pack.scenes[0]!.id);assert.deepEqual(e.export(),before);
 const launched=root.LWScenarios.commitScene(preview);assert.deepEqual(launched.export().state.terraform,e.s.terraform);assert.deepEqual(launched.export().state.nodes,e.s.nodes);roundtrip(launched);
});
test('Typed SDK preview and commands share native terrain authority and detached queries',()=>{
 const game=toolbox.create({scenarioId:'littlewild',sceneId:'charted-home'});
 try{
  const before=game.save(),snapshot=game.terraform();snapshot.tiles['9,9']={ground:'water',height:4};assert.deepEqual(game.save(),before);
  let proposal:LittlewildDeveloper.TerraformEdit|undefined;
  for(let y=2;y<=16&&!proposal;y++)for(let x=2;x<=16&&!proposal;x++){const candidate={revision:game.terraform().revision,tiles:[{x,y,height:1}],plants:[]};if(game.previewTerraform(candidate).ok)proposal=candidate;}
  assert(proposal);assert(game.command({id:'preview-terraform',args:[proposal]}).ok);assert.deepEqual(game.save(),before);
  const point=proposal.tiles[0]!;assert(game.command({id:'apply-terraform',args:[proposal]}).ok);assert.equal(game.terrain(point.x,point.y).height,1);
  const query=game.terrain(point.x,point.y);query.height=99;assert.equal(game.terrain(point.x,point.y).height,1);assert.equal(game.command({id:'apply-terraform',args:[proposal]}).ok,false);
 }finally{game.dispose();}
});
test('Office choices respect current-world source labels and assets; edits remain local and portable',()=>{
 const office=toolbox.create({scenarioId:'office',sceneId:'operations-shift'});
 try{
  const source=office.terraform().choices.find(c=>c.kind==='wood')!;assert(source);assert.notEqual(source.label,'Branching grove');assert.deepEqual(source.models,['world']);
  let proposal:LittlewildDeveloper.TerraformEdit|undefined;
  for(let y=3;y<=15&&!proposal;y++)for(let x=3;x<=15&&!proposal;x++){const candidate={revision:office.terraform().revision,tiles:[{x,y,ground:'water' as const,height:1}],plants:[]};if(office.previewTerraform(candidate).ok)proposal=candidate;}
  assert(proposal);assert(office.command({id:'apply-terraform',args:[proposal]}).ok);const tile=proposal.tiles[0]!;assert.deepEqual(office.terrain(tile.x,tile.y),{ground:'water',height:1});assert.equal(toolbox.reviewStory(office.story()).scenarioId,'office');
 }finally{office.dispose();}
});
test('Malformed native post-topology import preserves scoped catalog revisions and the live SDK session',()=>{
 const game=toolbox.create({scenarioId:'littlewild',sceneId:'charted-home'});
 try{
  const before=game.save(),assets=root.LWAssets.revision,creatures=root.LWCreatures.revision,bad=copy(before),world=bad.state as unknown as LWTerraform.World;
  const building=world.buildings[0]!;world.terraform={version:1,revision:1,sequence:1,tiles:{[building.x+','+building.y]:{ground:'water',height:0}},plants:{}};
  assert.throws(()=>root.LW.Engine.import(bad));assert.equal(root.LWAssets.revision,assets);assert.equal(root.LWCreatures.revision,creatures);assert.deepEqual(game.save(),before);assert(game.terraform().choices.length>0);
 }finally{game.dispose();}
});
const report={suite:'terraform',passed:results.filter(r=>r.passed).length,total:results.length,results};
fs.writeFileSync(path.join(__dirname,'terraform-results.json'),JSON.stringify(report,null,2)+'\n');console.log(`${report.passed}/${report.total} Terraform checks passed`);if(report.passed!==report.total)process.exitCode=1;
