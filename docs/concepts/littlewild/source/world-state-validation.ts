/// <reference path="./physical-world-contracts.d.ts" />
/* Pure saved-world validation. Physical transactions and orchestration own mutation. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LW:LWPhysicalPorts.Facade;LWWorldContent:LWContentPorts.WorldApi;LWAdventure:LWContentPorts.AdventureApi;LWWorldIntegrity:LWPhysicalPorts.IntegrityApi;LWWorldProduction:LWPhysicalPorts.ProductionApi;LWWorldStateValidation?:{validate:typeof validateWorldState}};
 const L=root.LW,W=root.LWWorldContent,A=root.LWAdventure,I=root.LWWorldIntegrity,Production=root.LWWorldProduction;
 const {BUILDINGS,RECIPES}=L,item=L.colony.item,PROFILE=(id:string)=>W.building(id);
 const sum=(inventory:LWPhysicalPorts.Inventory):number=>Object.values(inventory).reduce((total,count)=>total+count,0);
 const isInt=(value:unknown,min=0,max=1e7):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>=min&&value<=max;
 function validateWorldState(s:LWPhysicalPorts.State,CUSTOM:readonly string[]):void{
  const bad:(msg:string)=>never=(msg)=>{throw Error('World save: '+msg);};
  const configuration=W.validate(W.content);if(!configuration.ok)bad(configuration.errors.join('; '));
  if(!s.world||s.world.version!==1||!isInt(s.world.sequence,1,1e9)||!Array.isArray(s.world.transfers)||s.world.transfers.length>60)bad('invalid world bookkeeping');
  const inv=(v:unknown,where:string):void=>{if(!v||Array.isArray(v)||typeof v!=='object')bad(where+' must be an inventory');for(const [id,n]of Object.entries(v))if(!item(id)||!isInt(n,0,1e7))bad('invalid '+where+' item');};
  const ids=new Set<string>(),tiles=new Set<string>();for(const n of s.nodes){if(ids.has(n.id)||tiles.has(n.x+','+n.y)||!W.node(n.kind))bad('unknown or duplicate node');ids.add(n.id);tiles.add(n.x+','+n.y);if(!isInt(n.stock,0,1000)||!isInt(n.max,1,1000)||n.stock>n.max)bad('invalid node stock');}
  const bids=new Set(s.buildings.map(b=>b.id));if(bids.size!==s.buildings.length)bad('duplicate building IDs');
  const creatures=s.colony.creatures;I.validateIdentities(s);
  for(const b of s.buildings){const st=b.storage,p=PROFILE(b.kind);if(!p){if(st)bad('inventory on an unsupported building');continue;}if(!st)bad('missing building inventory');inv(st.input,'building input');inv(st.output,'building output');
   if(sum(st.input)>p.inputCapacity+((b.level||1)-1)*4||sum(st.output)+(st.job?.amount||0)>p.outputCapacity+((b.level||1)-1)*6)bad('building inventory exceeds its capacity');
   if(typeof st.enabled!=='boolean'||!isInt(st.priority,0,2)||!isInt(st.completed)||typeof st.lastOutput!=='number'||!Number.isFinite(st.lastOutput))bad('invalid production settings');
   const recs=Production.recipes(b,RECIPES,A.content.equipment,PROFILE(b.kind));
   for(const key of ['targets','requests'] as const){if(!st[key]||typeof st[key]!=='object'||Array.isArray(st[key]))bad('invalid '+key);for(const [id,q]of Object.entries(st[key]))if(!recs.some(r=>r.id===id)||!isInt(q,0,key==='targets'?48:12))bad('invalid production '+key);}
   if(p.requiresNode&&!s.nodes.some(n=>n.x===b.x&&n.y===b.y&&n.kind===p.requiresNode))bad('missing substrate below '+BUILDINGS[b.kind]!.name);
   const j=st.job;if(j){const r=recs.find(r=>r.id===j.recipe);if(!r||j.output!==r.output||!isInt(j.amount,r.amount,r.amount+1)||j.duration!==r.time||!Number.isFinite(j.progress)||j.progress<0||j.progress>j.duration||!isInt(j.attempts,0,1e7)||!I.sameQuantities(j.cost,r.cost)||typeof j.id!=='string'||!creatures.some(c=>c.id===j.originId))bad('invalid paid batch');if(j.workerId!==null&&!creatures.some(c=>c.id===j.workerId&&c.task?.jobId===j.id))bad('invalid batch worker');}
  }
  for(const c of creatures){
   for(const key of ['worldSupply','worldPickup'] as const)if(c[key]){const v=c[key];if(!bids.has(v.buildingId)||!item(v.resource)||!isInt(v.amount,1,128))bad('invalid carried logistics intent');}
   const t=c.task;if(t&&(CUSTOM.includes(t.kind)||t.buffered)){const b=s.buildings.find(b=>b.id===t.buildingId);if(!b?.storage||t.target?.x!==b.x||t.target?.y!==b.y)bad('invalid building task destination');if(t.buffered){if(b!.storage!.job?.id!==t.jobId||b!.storage!.job?.workerId!==c.id||b!.storage!.job!.recipe!==t.resource)bad('orphaned building work');}else if(!isInt(t.amount,1,128))bad('invalid transfer amount');}
  }
  for(const t of s.world.transfers)if(!bids.has(t.buildingId)||!creatures.some(c=>c.id===t.actorId)||!item(t.resource)||!isInt(t.amount,1,128)||!['in','out'].includes(t.direction)||!Number.isFinite(t.time)||typeof t.name!=='string'||t.name.length>24)bad('invalid transfer record');
 }

 const api={validate:validateWorldState};root.LWWorldStateValidation=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
