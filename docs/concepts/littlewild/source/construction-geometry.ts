/// <reference path="./construction-contracts.d.ts" />
/* Whole-footprint reservations, connected approaches and owned finite substrate. */
(function(inputRoot:unknown){
 'use strict';
 interface Grid {cells:Set<string>;pass(x:number,y:number):boolean;approach(p:LWRuntime.Point):boolean;flood(p:LWRuntime.Point):Set<string>;}
 interface Geography {Grid:new(state:unknown,extra?:LWRuntime.Point[])=>Grid;available(state:unknown,x:number,y:number):boolean;cell(x:number,y:number):{x:number;y:number};terrain(x:number,y:number):string;terrainAt(state:unknown,x:number,y:number):string;heightAt(state:unknown,x:number,y:number):number;}
 const root=inputRoot as {LWGeography:Geography;LWWorldContent:{building(kind:string):{requiresNode?:string}|undefined;node(kind:string):{direct?:boolean;name:string}|undefined};LWConstructionFootprints:Pick<LWConstruction.GeometryApi,'cells'|'blockers'>;LWConstructionGeometry?:LWConstruction.GeometryApi};
 const key=(p:LWRuntime.Point):string=>p.x+','+p.y;
 const cells=root.LWConstructionFootprints.cells,blockers=root.LWConstructionFootprints.blockers;
 function issue(e:LWConstruction.Engine,d:LWConstruction.Design,x:number,y:number,replacing?:LWConstruction.Building):string|null{
  const G=root.LWGeography,W=root.LWWorldContent,s=e.s;
  if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||Math.abs(x)>1200||Math.abs(y)>1200)return 'Choose integer map coordinates on owned ground.';
  if(!replacing){const placement=e.placementIssue(d.kind,x,y);if(placement)return placement;}
  const proposed=d.footprint.map(p=>({x:x+p.x,y:y+p.y})),covered=new Set(proposed.map(key));
  const otherBuildings=s.buildings.filter(b=>b!==replacing),plans=e.allOrders().filter(o=>o.type==='build'||o.type==='upgrade'&&o.designId);
  const occupied=new Set([...otherBuildings.flatMap(b=>cells(s,b)),...plans.flatMap(o=>o.x===undefined||o.y===undefined?[]:cells(s,{x:o.x,y:o.y,...(o.designId?{designId:o.designId}:{})}))].map(key));
  const required=W.building(d.kind)?.requiresNode;
  for(const p of proposed){
   const cell=G.cell(p.x,p.y);
   if(!G.available(s,p.x,p.y)||G.terrainAt(s,p.x,p.y)!=='grass'||cell.x<2||cell.x>16||cell.y<2||cell.y>16)return 'Every footprint tile must be owned grass, two tiles back from shore.';
   if(G.heightAt(s,p.x,p.y)!==G.heightAt(s,x,y))return 'Level the whole foundation before construction.';
   if(occupied.has(key(p)))return 'The complete footprint overlaps another building or construction plan.';
   const node=s.nodes.find(n=>n.x===p.x&&n.y===p.y);
   if(node&&!(p.x===x&&p.y===y&&required===node.kind))return 'Keep every resource deposit clear outside the required farm substrate.';
   if(s.colony.creatures.some(a=>!a.activeQuest&&Math.hypot(a.creature.x-p.x,a.creature.y-p.y)<.7))return 'Move the footprint away from a companion.';
  }
  if(required){const node=s.nodes.find(n=>n.x===x&&n.y===y&&n.kind===required);if(!node||node.stock<=0)return 'This building needs an available '+required+' deposit at its entrance tile.';}
  const reserved=[...otherBuildings.flatMap(b=>cells(s,b)),...plans.filter(o=>o.type==='build').flatMap(o=>o.x===undefined||o.y===undefined?[]:cells(s,{x:o.x,y:o.y,...(o.designId?{designId:o.designId}:{})})),...proposed];
  const grid=new G.Grid({...s,buildings:reserved,construction:undefined},[]);
  if(!grid.pass(x,y+1))return 'Keep the south entrance and its approach clear.';
  const actor=s.colony.creatures.find(a=>!a.activeQuest)?.creature||{x:9,y:9};
  const reachable=grid.flood({x:Math.round(actor.x),y:Math.round(actor.y)});
  if(reachable.size!==grid.cells.size)return 'The whole footprint must keep settlement paths connected.';
  for(const b of otherBuildings)if(!grid.approach(b)||((b.designId||b.door)&&!grid.pass(b.x+(b.door?.dx??0),b.y+(b.door?.dy??1))))return 'Keep every existing entrance reachable.';
  for(const n of s.nodes)if(W.node(n.kind)?.direct&&n.stock>0&&!covered.has(key(n))&&!grid.approach(n))return 'Keep an approach to '+(W.node(n.kind)?.name||n.kind)+'.';
  for(const a of s.colony.creatures)if(!a.activeQuest&&!reachable.has(key({x:Math.round(a.creature.x),y:Math.round(a.creature.y)})))return 'Keep every companion connected to the settlement.';
  return null;
 }
 function topologyIssue(s:LWConstruction.World):string|null{
  const G=root.LWGeography,W=root.LWWorldContent,grid=new G.Grid(s),seed=s.colony.creatures.find(a=>!a.activeQuest)?.creature||{x:9,y:9};
  const reachable=grid.flood({x:Math.round(seed.x),y:Math.round(seed.y)});
  if(reachable.size!==grid.cells.size)return 'Keep all settlement paths connected.';
  const places=[...s.buildings,...s.colony.creatures.flatMap(a=>a.orders.filter(o=>['build','upgrade'].includes(o.type)&&o.x!==undefined&&o.y!==undefined).map(o=>({x:o.x!,y:o.y!,kind:o.kind||'',...(o.designId?{designId:o.designId}:{})})))];
  const covered=new Set(places.flatMap(p=>cells(s,p)).map(key));
  for(const p of places){for(const tile of cells(s,p))if(G.terrainAt(s,tile.x,tile.y)!=='grass'||G.heightAt(s,tile.x,tile.y)!==G.heightAt(s,p.x,p.y))return 'Buildings and construction require flat grass foundations.';
   if(!grid.approach(p))return 'Keep construction and building approaches open.';
   const building=s.buildings.find(b=>b.x===p.x&&b.y===p.y),door=building?.door;
   if((p.designId||door)&&!grid.pass(p.x+(door?.dx??0),p.y+(door?.dy??1)))return 'Keep every doorway clear.';
  }
  for(const a of s.colony.creatures)if(!a.activeQuest&&!reachable.has(key({x:Math.round(a.creature.x),y:Math.round(a.creature.y)})))return 'Keep every companion on reachable ground.';
  for(const n of s.nodes)if(W.node(n.kind)?.direct&&n.stock>0&&!covered.has(key(n))&&!grid.approach(n))return 'Keep resource approaches open.';
  return null;
 }
 root.LWConstructionGeometry=Object.freeze({cells,blockers,issue,topologyIssue});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWConstructionGeometry;
})(globalThis);
