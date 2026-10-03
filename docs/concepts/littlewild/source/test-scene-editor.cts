/// <reference path="./scene-editor-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
const X=require('./scenario-runtime.js') as LWContentPorts.ScenarioApi,E=require('./scene-editor.js') as LWSceneEditor.Api,G=require('./scene-graph.js') as LWSceneGraph.Api;
const root=globalThis as unknown as {LWContent:LWContentPorts.ContentApi;LWInteriors:LWInterior.CatalogApi};
const C=root.LWContent;
interface State extends LWInterior.CatalogWorld,Record<string,unknown> {player:{coins:number};colony:{creatures:{id:string;creature:{x:number;y:number};inventory:Record<string,number>}[]};buildings:{id:string;kind:string}[];}
interface Scene extends Omit<LWContentPorts.Scene,'initialState'> {initialState:State;}
interface Pack extends Omit<LWContentPorts.ScenarioPack,'scenes'> {scenes:Scene[];}
const asPack=(pack:LWContentPorts.ScenarioPack):Pack=>pack as Pack;
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,fn:()=>void):void{try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,String(error));}}
const base=():Pack=>asPack(C.copy(X.builtins().find(p=>p.id==='office')!));
function graph():Pack{const p=base(),first=p.scenes[0]!;first.graph={kind:'level',bounds:{x:0,y:0,width:19,height:19},connections:[]};return p;}
test('Office draft and full pack export roundtrip retain every native field and catalog',()=>{
 const pack=base(),draft=E.create(pack);assert.deepEqual(asPack(draft.export()),pack);
 const next=E.create(JSON.stringify(asPack(draft.export())));assert.deepEqual(next.export(),pack);
 const copy=asPack(draft.snapshot());copy.scenes[0]!.initialState.player.coins=0;assert.notEqual(asPack(draft.snapshot()).scenes[0]!.initialState.player.coins,0);
});
test('Whole pack import removes omitted optional catalogs and undo restores them',()=>{
 const first=base(),next=C.copy(first);delete next.resources;for(const scene of next.scenes)delete scene.initialState.scenarioResources;assert(X.validate(next).ok);const editor=E.create(first);editor.replace(next);assert.deepEqual(asPack(editor.snapshot()),next);editor.undo();assert.deepEqual(asPack(editor.snapshot()),first);
});
test('Placed props reference canonical models and survive full pack export',()=>{
 const pack=graph(),editor=E.create(pack),asset=(pack.resources!.assets as {category:string;id:string}[]).find(a=>a.category==='building')!;
 editor.addProp(pack.scenes[0]!.id,{id:'desk-prop',name:'Scenery desk',category:'building',assetId:asset.id,model:'world',x:3,y:3});
 editor.place(pack.scenes[0]!.id,'props','desk-prop',4,4);const saved=asPack(editor.export());assert.equal(saved.scenes[0]!.graph!.props![0]!.x,4);assert(!saved.scenes[0]!.initialState.buildings.some(b=>b.id==='desk-prop'));
 const engine=X.commitScene(X.prepareScene(saved,saved.scenes[0]!.id)),props=require('./scene-props.js');assert.equal(props.read(engine)[0].id,'desk-prop');
 assert.throws(()=>editor.addProp(pack.scenes[0]!.id,{id:'invalid',name:'Bad',category:'building',assetId:'absent',model:'world',x:1,y:1}));
});
test('Visual placement writes actual canonical creature coordinates with undo redo',()=>{
 const draft=E.create(base()),scene=asPack(draft.snapshot()).scenes[0]!,actor=scene.initialState.colony.creatures[0]!;
 const original=C.copy(actor.creature),live=X.commitScene(X.prepareScene(base(),scene.id)),before=live.export();
 draft.place(scene.id,'creatures',actor.id,9,10);
 assert.equal(draft.entities(scene.id).find(e=>e.id===actor.id)!.x,9);
 assert.equal(asPack(draft.export()).scenes[0]!.initialState.colony.creatures[0]!.creature.y,10);
 assert.deepEqual(live.export(),before);assert.equal(draft.revision,1);
 draft.undo();assert.deepEqual(asPack(draft.snapshot()).scenes[0]!.initialState.colony.creatures[0]!.creature,original);
 draft.redo();assert.equal(asPack(draft.snapshot()).scenes[0]!.initialState.colony.creatures[0]!.creature.x,9);
});
test('Rejected placement is atomic and retains revision history',()=>{
 const draft=E.create(graph()),before=asPack(draft.snapshot()),id=before.scenes[0]!.id,actor=before.scenes[0]!.initialState.colony.creatures[0]!.id;
 assert.throws(()=>draft.place(id,'creatures',actor,999,999));assert.deepEqual(asPack(draft.snapshot()),before);assert.equal(draft.revision,0);
});
test('World and child scene creation changes complete scenario data',()=>{
 const draft=E.create(graph()),p=asPack(draft.snapshot()),scene=p.scenes[0]!;
 draft.addWorld(p.worlds[0]!,'new-office','Second office');draft.addScene(scene,'child',scene.worldId,scene.id);
 assert.equal(asPack(draft.export()).scenes.find(s=>s.id==='child')!.graph!.parentId,scene.id);
 assert.equal(asPack(draft.export()).worlds.find(w=>w.id==='new-office')!.name,'Second office');
 assert.throws(()=>draft.removeScene(scene.id),/child/);
 draft.removeScene('child');assert(!asPack(draft.export()).scenes.some(s=>s.id==='child'));
});
test('Hierarchy cycles, absent links and invalid requirements are rejected',()=>{
 for(const edit of [
  (p:Pack)=>p.scenes[0]!.graph!.parentId=p.scenes[0]!.id,
  (p:Pack)=>p.scenes[0]!.graph!.connections=[{id:'missing',targetSceneId:'missing',label:'Missing'}],
  (p:Pack)=>p.scenes[0]!.graph!.requirements=[{type:'item',itemId:'unknown',quantity:1}],
  (p:Pack)=>Object.assign(p.scenes[0]!.graph!,{events:[{type:'run',script:'alert(1)'}]})
 ]){const p=graph();edit(p);assert.equal(X.validate(p).ok,false);}
});
test('Bound island uses source authority and edits its actual entities',()=>{
 const pack=graph(),source=pack.scenes[0]!;pack.scenes.push({id:'island',name:'Existing island',description:'Native owned land',worldId:source.worldId,initialState:{} as State,graph:{kind:'island',parentId:source.id,binding:{type:'island',sourceSceneId:source.id,ix:0,iy:0}}});
 const draft=E.create(pack),actor=source.initialState.colony.creatures[0]!;
 draft.place('island','creatures',actor.id,9,10);
 const saved=asPack(draft.export());assert.deepEqual(saved.scenes.find(s=>s.id==='island')!.initialState,{});
 assert.equal(saved.scenes[0]!.initialState.colony.creatures[0]!.creature.x,9);
 assert.equal(G.owner(saved,'island').id,source.id);
 assert.throws(()=>draft.removeScene(source.id),/bindings|child/);
});
test('Bound interior rejects duplicated native state and dangling floor reference',()=>{
 const p=graph(),source=p.scenes[0]!,building=source.initialState.buildings.find(b=>b.kind==='bench')!;
 const floor=root.LWInteriors.forBuilding(source.initialState,building).floors[0]!.id;
 p.scenes.push({id:'room',name:'Packing room',description:'Existing room',worldId:source.worldId,initialState:{} as State,graph:{kind:'interior',parentId:source.id,binding:{type:'interior',sourceSceneId:source.id,buildingId:building.id,floorId:floor}}});
 assert(X.validate(p).ok);
 const draft=E.create(p);assert.throws(()=>draft.place('room','creatures','c1',3,3),/layout/);
 p.scenes.at(-1)!.initialState=C.copy(source.initialState);assert(!X.validate(p).ok);
 p.scenes.at(-1)!.initialState={} as State;(p.scenes.at(-1)!.graph!.binding as Extract<LWSceneGraph.Binding,{type:'interior'}>).floorId='absent';assert(!X.validate(p).ok);
});
test('New companions, buildings and finite items use canonical native collections',()=>{
 const draft=E.create(base()),id=asPack(draft.snapshot()).scenes[0]!.id;
 draft.addEntity(id,'creatures','c1','c4',9,10);draft.addEntity(id,'buildings','office-break','new-break',3,10);draft.addEntity(id,'nodes','snacks','new-snacks',3,12);
 const state=asPack(draft.export()).scenes[0]!.initialState;assert.equal(state.colony.creatures.length,4);assert.equal(state.buildings.length,6);assert(draft.entities(id).some(entity=>entity.category==='nodes'&&entity.id==='new-snacks'));assert(X.validate(draft.export()).ok);
});
test('Published graph schema agrees with runtime shape for compatible and unsupported grammar',()=>{
 const shape=require('./scenario-shape.js') as (input:unknown,schema:LWContentPorts.Schema)=>string[];
 const ajv=new Ajv2020({strict:true}),validate=ajv.compile(X.schema),pack=graph();pack.scenes[0]!.graph!.requirements=[{type:'building',kind:'map_table'},{type:'item',itemId:'field_satchel',quantity:1}];
 assert(validate(pack));assert.deepEqual(shape(pack,X.schema),[]);assert(X.validate(pack).ok);
 for(const graph of [{kind:'unsupported'},{kind:'level',rendering:{dimension:'4d',rendererId:'basic'}},{kind:'level',rendering:{dimension:'2d',rendererId:'script'}},{kind:'level',rendering:{dimension:'3d',rendererId:'basic',embeds:[{id:'map',sceneId:'remote',role:'frame'}]}}]){
  const bad:Pack=C.copy(pack);Object.assign(bad.scenes[0]!,{graph});assert.equal(validate(bad),false);assert(shape(bad,X.schema).length>0);assert.equal(X.validate(bad).ok,false);
 }
});
test('Rendering selections and embedded views reject mismatches, cycles and missing scenes',()=>{
 const pack=graph(),source=pack.scenes[0]!,map=C.copy(source);map.id='map';map.name='Map';map.graph={kind:'level',rendering:{dimension:'2d',rendererId:'pixi-2d'}};pack.scenes.push(map);
 source.graph!.rendering={dimension:'3d',rendererId:'basic',embeds:[{id:'minimap',sceneId:'map',role:'minimap',bounds:{anchor:'top-right',width:240,height:180}}]};assert(X.validate(pack).ok);
 const wrong=C.copy(pack);wrong.scenes[0]!.graph!.rendering!.rendererId='excalibur-2d';assert(!X.validate(wrong).ok);
 const cycle=C.copy(pack);cycle.scenes[0]!.graph!.rendering!.dimension='2d';cycle.scenes[1]!.graph!.rendering!.embeds=[{id:'back',sceneId:source.id,role:'panel'}];assert(!X.validate(cycle).ok);
 const missing=C.copy(pack);missing.scenes[0]!.graph!.rendering!.embeds![0]!.sceneId='missing';assert(!X.validate(missing).ok);
});
test('Invalid import leaves complete draft and revision unchanged',()=>{
 const draft=E.create(graph()),before=asPack(draft.snapshot()),bad=C.copy(before);bad.scenes[0]!.worldId='missing';
 assert.throws(()=>draft.replace(bad));assert.deepEqual(asPack(draft.snapshot()),before);assert.equal(draft.revision,0);
});
test('Visual inventory edit writes canonical actor inventory rather than a second item store',()=>{
 const draft=E.create(base()),scene=asPack(draft.snapshot()).scenes[0]!,actor=scene.initialState.colony.creatures[0]!;
 draft.setEntity(scene.id,'creatures',actor.id,{inventory:{...actor.inventory,berries:7}});
 assert.equal(asPack(draft.export()).scenes[0]!.initialState.colony.creatures[0]!.inventory.berries,7);
 assert(X.validate(asPack(draft.export())).ok);
});
const report={suite:'scene-editor',passed:results.filter(r=>r.passed).length,total:results.length,results};
fs.writeFileSync(__dirname+'/scene-editor-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
if(results.some(result=>!result.passed))process.exitCode=1;
