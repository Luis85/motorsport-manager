/// <reference path="./construction-contracts.d.ts" />
/* Atomic intent submission. Existing creature tasks own supply carrying, payment and work. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LW:{BUILDINGS:Record<string,{name:string;unique?:boolean}>};LWConstructionDesigns:LWConstruction.DesignsApi;LWConstructionGeometry:LWConstruction.GeometryApi;LWInteriors:LWInterior.CatalogApi;LWConstructionRuntime?:unknown};
 const D=root.LWConstructionDesigns,G=root.LWConstructionGeometry;
 const fail=(reason:string):LWPhysicalPorts.ActionResult=>({ok:false,reason});
 const empty=():LWConstruction.State=>({version:1,sequence:1,designs:{}});
 function preview(input:unknown,engine?:LWBalanceRules.Owner):LWConstruction.Preview{
  try{const design=D.validate(input);return {ok:true,design,cost:D.cost(design,engine),phases:D.phases(design,engine)};}catch(error){return {ok:false,reason:error instanceof Error?error.message:String(error)};}
 }
 function buildingDesign(e:LWConstruction.Engine,id:unknown):LWConstruction.Draft|null{
  const b=e.s.buildings.find(b=>b.id===id);if(!b)return null;
  const design=b.designId?e.s.construction?.designs[b.designId]:undefined;
  const layout=design?.layout||root.LWInteriors.forBuilding(e.s as unknown as LWInterior.World,b);
  return D.copy({name:design?.name||root.LW.BUILDINGS[b.kind]!.name,kind:b.kind,layout,mapUnit:design?.mapUnit||{width:layout.floors[0]!.width,height:layout.floors[0]!.height}});
 }
 function busy(e:LWConstruction.Engine,b:LWConstruction.Building):boolean{
  const interiors=e.s.interiors;
  return !!b.storage?.job||Object.values(interiors?.locations||{}).some(l=>l.buildingId===b.id)||!!interiors?.visits.some(v=>v.buildingId===b.id)||!!interiors?.production[b.id]?.length;
 }
 function submit(e:LWConstruction.Engine,input:unknown,x:unknown,y:unknown,replacing?:LWConstruction.Building):LWPhysicalPorts.ActionResult{
  const prior=replacing?buildingDesign(e,replacing.id):null;
  const initial=preview(input,e);if(!initial.ok)return initial;
  const checked=prior?preview({name:initial.design.name,kind:initial.design.kind,layout:initial.design.layout,mapUnit:prior.mapUnit},e):initial;if(!checked.ok)return checked;
  const design=checked.design;
  if(typeof x!=='number'||typeof y!=='number')return fail('Choose integer map coordinates.');
  const issue=e.interactionIssue();if(issue)return fail(issue);
  if(!e.unlocked('buildings',design.kind))return fail('Research this building type first.');
  if(e.actor.orders.length>=12)return fail('Finish or cancel one of this creature’s twelve plans.');
  const reusable=Object.values(e.s.construction?.designs||{}).find(d=>d.name===design.name&&d.kind===design.kind&&JSON.stringify(d.mapUnit)===JSON.stringify(design.mapUnit)&&JSON.stringify(d.layout)===JSON.stringify(design.layout));
  if(!reusable&&((e.s.construction?.sequence||1)>100000||Object.keys(e.s.construction?.designs||{}).length>=128))return fail('The authored blueprint library is full. Reuse a saved design.');
  if(replacing){
   if(replacing.kind!==design.kind)return fail('An improvement must keep the existing building type.');
   if(e.allOrders().some(o=>o.type==='upgrade'&&o.x===x&&o.y===y))return fail('This place already has an improvement planned.');
   if(busy(e,replacing))return fail('Finish paid batches and visits before redesigning this building.');
   const prior=buildingDesign(e,replacing.id)!;const mismatch=D.preserve(prior.layout,design.layout);if(mismatch)return fail(mismatch);
   if(JSON.stringify(prior.layout)===JSON.stringify(design.layout))return fail('Change the design or add a supported floor first.');
  }
  const geometry=G.issue(e,design,x,y,replacing);if(geometry)return fail(geometry);
  // Allocate references only after every rejection guard. No material or money changes here.
  const state=e.s.construction||empty(),id=reusable?.id||'design-'+state.sequence++;
  if(!reusable)state.designs[id]={...design,id};e.s.construction=state;
  const order:LWConstruction.Order={id:'o'+e.s.nextId++,type:replacing?'upgrade':'build',kind:design.kind,x,y,designId:id,stage:0,progress:0,paid:false,paused:false,priority:0,created:e.s.simTime,approach:e.actor.buildPolicy.approach,...(replacing?{buildingId:replacing.id,targetLevel:Math.min(3,replacing.level+1)}:{})};
  e.actor.orders.push(order);e.log(e.actor.name+' will build '+design.name+' in three physical stages.','plan');return {ok:true};
 }
 function previewImprovement(e:LWConstruction.Engine,input:unknown,id:unknown):LWConstruction.Preview{
  let checked=preview(input,e);if(!checked.ok)return checked;const b=e.s.buildings.find(b=>b.id===id),old=b&&buildingDesign(e,id);if(!b||!old)return {ok:false,reason:'This building is no longer here.'};
  checked=preview({name:checked.design.name,kind:checked.design.kind,layout:checked.design.layout,mapUnit:old.mapUnit},e);if(!checked.ok)return checked;
  if(b.kind!==checked.design.kind)return {ok:false,reason:'Keep the existing building type.'};const mismatch=D.preserve(old.layout,checked.design.layout);if(mismatch)return {ok:false,reason:mismatch};
  const cost=D.improvementCost(D.validate(old),checked.design,e),phases=checked.phases.map(p=>({...p,cost:{} as Record<string,number>}));for(const [resource,n]of Object.entries(cost))phases[['stone','clay','bricks'].includes(resource)?0:['wood','planks','beams','iron','rope'].includes(resource)?1:2]!.cost[resource]=n;
  return {...checked,cost,phases};
 }
 function construct(e:LWConstruction.Engine,input:unknown,x:unknown,y:unknown):LWPhysicalPorts.ActionResult{return submit(e,input,x,y);}
 function improve(e:LWConstruction.Engine,id:unknown,input:unknown):LWPhysicalPorts.ActionResult{const b=e.s.buildings.find(b=>b.id===id);return b?submit(e,input,b.x,b.y,b):fail('This building is no longer here.');}
 function options(e:LWConstruction.Engine):LWConstruction.Options{return D.copy({types:Object.entries(root.LW.BUILDINGS).filter(([id])=>e.unlocked('buildings',id)).map(([id,b])=>({id,name:b.name})),designs:Object.values(e.s.construction?.designs||{}),buildings:e.s.buildings.map(b=>({id:b.id,kind:b.kind,name:b.designId?e.s.construction?.designs[b.designId]?.name||b.kind:root.LW.BUILDINGS[b.kind]!.name}))});}
 root.LWConstructionRuntime=Object.freeze({empty,preview,previewImprovement,buildingDesign,busy,construct,improve,options});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWConstructionRuntime;
})(globalThis);
