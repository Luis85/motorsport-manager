/// <reference path="./rts-economy-contracts.d.ts" />
// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const ecs=require('./ecs.js');
const catalog=require('./rts-catalog.js') as LWRTSData.CatalogApi;
const production=require('./rts-production.js') as LWRTSEconomyTypes.ProductionAPI;
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void {try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
function fixture(){
 const world=new ecs.World(),events:unknown[]=[],spawned:unknown[]=[];
 const faction=catalog.data.factions.find(value=>value.buildings.some(id=>catalog.get('buildings',id)!.produces.length))!;
 const building=catalog.get('buildings',faction.buildings.find(id=>catalog.get('buildings',id)!.produces.length)!)!;
 const unit=catalog.get('units',building.produces.find(id=>faction.units.includes(id))!)!;
 const state={resources:Object.fromEntries(catalog.data.resources.map(value=>[value.id,10000])),technologies:[],population:0,populationCap:0,power:0};
 world.create('rts-faction:'+faction.id);world.set('rts-faction:'+faction.id,'rts-owner',{faction:faction.id});world.set('rts-faction:'+faction.id,'rts-faction',state);
 world.create('factory');world.set('factory','rts-owner',{faction:faction.id});world.set('factory','rts-kind',{definition:building.id,category:'building'});
 world.set('factory','rts-building',{complete:true,progress:1});world.set('factory','rts-production',{queue:[]});world.set('factory','rts-position',{x:3,y:3});
 const capacity=catalog.data.buildings.find(value=>value.population>=unit.population)!;
 world.create('housing');world.set('housing','rts-owner',{faction:faction.id});world.set('housing','rts-kind',{definition:capacity.id,category:'building'});world.set('housing','rts-building',{complete:true,progress:1});
 const context={world,catalog,data:catalog.data,mission:catalog.data.missions[0],map:{width:32,height:32,tiles:Array(1024).fill(catalog.data.missions[0]!.defaultTerrain),blocked:[]},spawn(definition:string,owner:string,x:number,y:number){spawned.push({definition,owner,x,y});return 'new-unit';},emit(event:unknown){events.push(event);}};
 production.refresh(context);return {world,context,faction,building,unit,state,events,spawned};
}
test('Production pays once, reserves population, refunds cancellation exactly, and rejects repeated cancellation',()=>{
 const f=fixture(),before=JSON.stringify(f.state.resources),population=f.state.population;
 assert.equal(production.command(f.context,{kind:'train',faction:f.faction.id,entities:['factory'],definition:f.unit.id})!.ok,true);
 for(const [id,cost]of Object.entries(f.unit.cost))assert.equal(f.state.resources[id],10000-cost);
 assert.equal(f.state.population,population+f.unit.population);assert.equal(f.world.get('factory','rts-production').queue.length,1);
 assert.equal(production.command(f.context,{kind:'cancel',faction:f.faction.id,entityId:'factory'})!.ok,true);
 assert.equal(JSON.stringify(f.state.resources),before);assert.equal(f.state.population,population);
 const events=f.events.length;assert.equal(production.command(f.context,{kind:'cancel',faction:f.faction.id,entityId:'factory'})!.ok,false);
 assert.equal(JSON.stringify(f.state.resources),before);assert.equal(f.events.length,events);
});
test('Unaffordable, foreign, invalid and missing production requests preserve all resources and queue entries',()=>{
 const f=fixture();for(const id of Object.keys(f.state.resources))f.state.resources[id]=0;
 const before=JSON.stringify({state:f.state,queue:f.world.get('factory','rts-production'),events:f.events});
 for(const input of [
  {kind:'train',faction:f.faction.id,entityId:'factory',definition:f.unit.id},
  {kind:'train',faction:'other-faction',entityId:'factory',definition:f.unit.id},
  {kind:'train',faction:f.faction.id,entityId:'missing',definition:f.unit.id},
  {kind:'train',faction:f.faction.id,entityId:'factory',definition:'missing'},
  {kind:'cancel',faction:f.faction.id,entityId:'factory',index:-1}
 ])assert.equal(production.command(f.context,input)!.ok,false);
 assert.equal(JSON.stringify({state:f.state,queue:f.world.get('factory','rts-production'),events:f.events}),before);
});
test('Fixed ECS production steps publish one unit once and never charge resources twice',()=>{
 const f=fixture(),scheduler=new ecs.Scheduler();production.register(scheduler,f.context);
 assert.equal(production.command(f.context,{kind:'train',faction:f.faction.id,entities:['factory'],definition:f.unit.id})!.ok,true);
 const paid=JSON.stringify(f.state.resources);
 const ticks=Math.ceil(f.unit.buildTime/.1)+2;
 for(let i=0;i<ticks;i++)scheduler.step(f.world,.1);
 assert.equal(f.spawned.length,1);assert.equal(f.world.get('factory','rts-production').queue.length,0);
 assert.equal(JSON.stringify(f.state.resources),paid);
 for(let i=0;i<ticks;i++)scheduler.step(f.world,.1);assert.equal(f.spawned.length,1);
});
test('Pending research is exclusive, prerequisites gate acceptance, and completion preserves payment',()=>{
 const f=fixture(),building=catalog.data.buildings.find(value=>value.researches.some(id=>f.faction.technologies.includes(id)&&!catalog.get('technologies',id)!.prerequisites.length));
 assert(building,'Demo needs accessible basic technology');
 f.world.set('factory','rts-kind',{definition:building.id,category:'building'});
 const tech=catalog.get('technologies',building.researches.find(id=>f.faction.technologies.includes(id)&&!catalog.get('technologies',id)!.prerequisites.length)!)!;
 const input={kind:'research',faction:f.faction.id,entityId:'factory',definition:tech.id};
 assert.equal(production.command(f.context,input)!.ok,true);const paid=JSON.stringify(f.state.resources);
 assert.equal(production.command(f.context,input)!.ok,false);assert.equal(JSON.stringify(f.state.resources),paid);
 const scheduler=new ecs.Scheduler();production.register(scheduler,f.context);
 for(let i=0;i<Math.ceil(tech.researchTime/.1)+2;i++)scheduler.step(f.world,.1);
 assert.deepEqual(f.state.technologies,[tech.id]);assert.equal(JSON.stringify(f.state.resources),paid);
 assert.equal(production.command(f.context,input)!.ok,false);assert.deepEqual(f.state.technologies,[tech.id]);
});
const passed=results.filter(result=>result.passed).length;
fs.writeFileSync(__dirname+'/rts-production-results.json',JSON.stringify({passed,total:results.length,results},null,2)+'\n');
console.log(`${passed}/${results.length} RTS production checks passed`);if(passed!==results.length)process.exitCode=1;
