/// <reference path="./terraform-contracts.d.ts" />
/* Atomic local terrain transactions reuse physical nodes and the settlement topology authority. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWRuntimeResults:LWRuntime.ResultsApi;LWTerraformState:LWTerraform.StateApi;LWGeography:LWTerraform.Geography;LWConstructionGeometry:LWConstruction.GeometryApi;LWWorldContent:LWContentPorts.WorldApi;LWTerraformRuntime?:LWTerraform.RuntimeApi};
 const S=root.LWTerraformState,G=root.LWGeography;
 const key=(p:LWRuntime.Point):string=>p.x+','+p.y;
 function routeIssue(world:LWTerraform.World):string|null{
  const grid=new G.Grid(world);
  function route(origin:LWRuntime.Point,path:LWRuntime.Point[]):boolean{
   let previous={x:Math.round(origin.x),y:Math.round(origin.y)};
   for(const p of path){if(key(previous)!==key(p)&&!grid.canStep(previous,p))return false;if(!grid.pass(p.x,p.y))return false;previous=p;}return true;
  }
  const homes=world.interiors?.locations||{};
  for(const actor of world.colony.creatures){
   if(actor.activeQuest)continue;
   if(actor.task?.path?.length&&!route(actor.creature,actor.task.path))return 'Keep the current creature routes open; let this trip finish first.';
   if(actor.task?.target&&!homes[actor.id]&&!grid.path({x:Math.round(actor.creature.x),y:Math.round(actor.creature.y)},actor.task.target,true))return 'Keep an approach to each active work target.';
  }
  for(const visit of world.interiors?.visits||[]){const actor=world.colony.creatures.find(c=>c.id===visit.actorId);if(actor&&visit.path.length&&!route(actor.creature,visit.path))return 'Keep the current building visit route open.';}
  return null;
 }
 function stage(engine:LWTerraform.Engine,input:unknown):{candidate:LWTerraform.World;edit:LWTerraform.Edit}{
  const world=engine.s,edit=S.edit(input,world),terraform=S.copy(world.terraform||S.empty());
  if(edit.revision!==terraform.revision)throw Error('Terraform: this world changed; preview the edit again.');
  if(terraform.revision>=1e9)throw Error('Terraform: terrain revision limit reached.');
  const candidate:LWTerraform.World={...world,terraform,nodes:[...world.nodes]};
  for(const change of edit.tiles){
   const prior={ground:G.terrainAt(world,change.x,change.y) as LWTerraform.Ground,height:G.heightAt(world,change.x,change.y)};
   terraform.tiles[key(change)]={ground:change.ground??prior.ground,height:change.height??prior.height};
  }
  const occupied=new Set(root.LWConstructionGeometry.blockers(world).map(key));
  for(const change of edit.plants){
   if(occupied.has(key(change))||candidate.nodes.some(n=>key(n)===key(change)))throw Error('Terraform: plant on clear ground away from buildings and reserved plans.');
   if(G.terrainAt(candidate,change.x,change.y)!=='grass')throw Error('Terraform: plants need grass.');
   if(world.colony.creatures.some(c=>!c.activeQuest&&Math.hypot(c.creature.x-change.x,c.creature.y-change.y)<.8))throw Error('Terraform: give the creature room before planting here.');
   const definition=root.LWWorldContent.node(change.kind);if(!definition)throw Error('Terraform: unknown plant.');
   if(terraform.sequence>=1e9)throw Error('Terraform: planting sequence limit reached.');
   const id='terraform-node-'+terraform.sequence++;if(candidate.nodes.some(n=>n.id===id))throw Error('Terraform: resource identity already exists.');
   candidate.nodes.push({id,kind:change.kind,x:change.x,y:change.y,stock:definition.quantity,max:definition.quantity,regen:0});
   terraform.plants[id]={kind:change.kind,model:change.model};
  }
  for(const node of candidate.nodes)if(edit.tiles.some(t=>key(t)===key(node))&&G.terrainAt(candidate,node.x,node.y)!==G.terrainAt(world,node.x,node.y))throw Error('Terraform: preserve terrain beneath existing resource sources.');
  terraform.revision++;
  S.validate(terraform,candidate);
  const issue=root.LWConstructionGeometry.topologyIssue(candidate)||routeIssue(candidate);if(issue)throw Error('Terraform: '+issue);
  return {candidate,edit};
 }
 function preview(engine:LWTerraform.Engine,input:unknown):LWTerraform.Preview{
  try{const {edit}=stage(engine,input);return {ok:true,revision:edit.revision,tiles:edit.tiles,plants:edit.plants};}
  catch(error){return root.LWRuntimeResults.failure(error instanceof Error?error.message:String(error));}
 }
 function apply(engine:LWTerraform.Engine,input:unknown):LWPhysicalPorts.ActionResult{
  try{
   const {candidate,edit}=stage(engine,input);engine.s.terraform=candidate.terraform!;engine.s.nodes=candidate.nodes;
   engine.log('Reshaped '+edit.tiles.length+' terrain tile(s) and planted '+edit.plants.length+' living source(s).','leaf');return {ok:true};
  }catch(error){return root.LWRuntimeResults.failure(error instanceof Error?error.message:String(error));}
 }
 function snapshot(engine:LWTerraform.Engine):LWTerraform.Snapshot{
  const state=engine.s.terraform||S.empty();return S.copy({revision:state.revision,tiles:state.tiles,plants:state.plants,choices:S.choices()});
 }
 root.LWTerraformRuntime=Object.freeze({preview,apply,snapshot,routeIssue});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWTerraformRuntime;
})(globalThis);
