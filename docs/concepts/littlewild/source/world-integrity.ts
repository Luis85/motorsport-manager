/* Shared world invariants. Pure checks: never move resources, consume RNG or edit a story.
 * Runtime guards and the importer use the same entity/production contracts. */
(function(inputRoot: unknown){
 'use strict';

 interface Point { x:number; y:number; }
 interface ResourceNode extends Point { kind:string; }
 interface StorageJob { id:string; orderId?:string|null; }
 interface Storage { job?:StorageJob|null; }
 interface Building extends Point { id:string; kind:string; storage?:Storage; }
 interface Order extends Point { id:string; type:string; kind:string; }
 interface Creature { orders:Order[]; }
 interface WorldState {
  buildings:Building[];
  nodes:ResourceNode[];
  colony:{creatures:Creature[]};
  nextId:number;
  world:{sequence:number};
 }
 interface EngineLike {
  s:WorldState;
  allOrders():Order[];
  nodeAvailable(node:ResourceNode):boolean;
  nodeAt(x:number,y:number):ResourceNode|undefined;
  remaining(node:ResourceNode):number;
 }
 interface Recipe { depletion:number; }
 interface NodeDefinition { direct?:boolean; name:string; }
 interface BuildingDefinition { requiresNode?:string; }
 interface WorldContentApi {
  node(kind:string):NodeDefinition|undefined;
  building(kind:string):BuildingDefinition|undefined;
 }
 interface NavigationGrid { approach(target:Point):boolean; }
 interface NavigationApi { Grid:new(size:number,terrain:(x:number,y:number)=>string,blockers:readonly Point[])=>NavigationGrid; }
 interface LittlewildFacade { SIZE:number; terrain(x:number,y:number):string; }
 interface WorldIntegrityApi {
  sameQuantities(a:unknown,b:unknown):boolean;
  resourceAccessIssue(engine:EngineLike,candidate:Point):string|null;
  substrateIssue(engine:EngineLike,building:Building,recipe?:Recipe|null):string|null;
  validateIdentities(state:WorldState):void;
 }
 interface LittlewildRoot { LW?:LittlewildFacade; LWWorldContent?:WorldContentApi; LWNavigation?:NavigationApi; LWWorldIntegrity?:WorldIntegrityApi; }
 const root=inputRoot as LittlewildRoot;

 const at=(point:Point):string=>`${point.x},${point.y}`;
 const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 function sameQuantities(a:unknown,b:unknown):boolean{
  if(!record(a)||!record(b))return false;
  const right=b;
  const keys=Object.keys(a);
  return keys.length===Object.keys(right).length&&keys.every(key=>Object.hasOwn(right,key)&&a[key]===right[key]);
 }
 function resourceAccessIssue(engine:EngineLike,candidate:Point):string|null{
  const L=root.LW,W=root.LWWorldContent,Navigation=root.LWNavigation;
  if(!L||!W||!Navigation)throw Error('World integrity dependencies are missing.');
  const state=engine.s;
  const places:Point[]=[...state.buildings,...engine.allOrders().filter(order=>order.type==='build'),candidate];
  const covered=new Set(places.map(at));
  const blockers:Point[]=[...state.nodes.filter(node=>node.kind==='wood'||node.kind==='stone'),...places];
  const grid=new Navigation.Grid(L.SIZE,L.terrain,blockers);
  for(const node of state.nodes){
   const definition=W.node(node.kind);
   if(definition?.direct&&engine.nodeAvailable(node)&&!covered.has(at(node))&&!grid.approach(node))
    return `Keep an open approach to ${definition.name.toLowerCase()} at ${node.x}, ${node.y}.`;
  }
  return null;
 }
 function substrateIssue(engine:EngineLike,building:Building,recipe:Recipe|null=null):string|null{
  const W=root.LWWorldContent;if(!W)throw Error('World content runtime missing.');
  const required=W.building(building.kind)?.requiresNode;
  if(!required||building.storage?.job)return null;
  const node=engine.nodeAt(building.x,building.y);
  if(!node||node.kind!==required)return 'Missing required node';
  if(!engine.nodeAvailable(node))return 'Node exhausted';
  if(recipe&&engine.remaining(node)<recipe.depletion)return 'Insufficient deposit remaining';
  return null;
 }
 function validateIdentities(state:WorldState):void{
  const W=root.LWWorldContent;if(!W)throw Error('World content runtime missing.');
  function bad(message:string):never{throw Error('World save: '+message);}
  const used=new Set<string>(),planTiles=new Set(state.buildings.map(at)),workIds=new Set<string>();
  let maxEntity=0,maxWork=0;
  function use(id:unknown):void{
   if(typeof id!=='string')bad('duplicate or invalid entity ID');
   if(used.has(id))bad('duplicate or invalid entity ID');
   used.add(id);
   const numeric=/^[bo](\d+)$/.exec(id);
   if(numeric)maxEntity=Math.max(maxEntity,Number(numeric[1]));
  }
  for(const building of state.buildings){
   use(building.id);
   const job=building.storage?.job;
   if(!job)continue;
   const numeric=/^work-(\d+)$/.exec(job.id);
   if(!numeric)bad('duplicate or invalid paid-batch ID');
   if(workIds.has(job.id))bad('duplicate or invalid paid-batch ID');
   workIds.add(job.id);maxWork=Math.max(maxWork,Number(numeric[1]));
   if(job.orderId!=null&&(typeof job.orderId!=='string'||job.orderId.length>64))bad('invalid originating order');
  }
  for(const creature of state.colony.creatures)for(const order of creature.orders){
   use(order.id);
   if(order.type==='build'){
    if(planTiles.has(at(order)))bad('overlapping construction plans');
    planTiles.add(at(order));
    const node=state.nodes.find(candidate=>at(candidate)===at(order));
    const required=W.building(order.kind)?.requiresNode;
    if((node&&node.kind!==required)||(required&&node?.kind!==required))bad('construction plan has an incompatible site');
   }
  }
  if(state.nextId<=maxEntity)bad('next entity ID would overwrite an existing identity');
  if(state.world.sequence<=maxWork)bad('next work ID would reuse a paid-batch identity');
 }
 const api:WorldIntegrityApi=Object.freeze({sameQuantities,resourceAccessIssue,substrateIssue,validateIdentities});
 root.LWWorldIntegrity=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
