/* Deterministic ECS settlement for physical world resources, inventories and jobs.
 * Existing save records are bound by reference to explicit components; no ECS state is
 * serialized. Policy, skill rolls, rewards and presentation remain in the domain facade.
 */
(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 const E=node?require('./ecs.js'):root.LWECS;
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
 const integer=(n,min=0,max=1e9)=>Number.isInteger(n)&&n>=min&&n<=max;
 const identity=s=>typeof s==='string'&&/^[a-zA-Z][a-zA-Z0-9._:-]{0,95}$/.test(s);
 const quantity=(inv,id)=>own(inv,id)?inv[id]:0;
 const total=inv=>Object.values(inv||{}).reduce((sum,n)=>sum+n,0);
 function inventory(inv,label){
  if(!plain(inv))throw Error('Invalid '+label+' inventory.');
  for(const [id,n]of Object.entries(inv))if(!identity(id)||!integer(n))throw Error('Invalid '+label+' inventory quantity.');
  return inv;
 }
 function transaction(spec,kind){if(!plain(spec)||!identity(spec.id))throw Error('Invalid '+kind+' transaction.');return spec;}
 function create(){
  const world=new E.World(),scheduler=new E.Scheduler(),completed=new Set();let serial=0;
  const result=(state,extra={})=>Object.assign({ok:state==='settled',state,amount:0},extra);
  function component(entityId,type,data){
   if(!identity(entityId))throw Error('Invalid physical entity ID.');
   if(!world.entities.has(entityId))world.create(entityId);
   const existing=world.get(entityId,type);if(existing){Object.assign(existing,data);return existing;}
   return world.set(entityId,type,data);
  }
  const bindInventory=(id,items)=>component(id,'Inventory',{items:inventory(items,id)});
  const bindDeposit=(id,record,resource,finite)=>{
   if(!plain(record)||!identity(resource)||typeof finite!=='boolean'||finite&&!integer(record.stock))throw Error('Invalid resource deposit.');
   return component(id,'ResourceDeposit',{record,resource,finite});
  };
  const bindWorksite=(id,storage)=>{
   if(!plain(storage)||!plain(storage.input)||!plain(storage.output))throw Error('Invalid worksite.');
   inventory(storage.input,'worksite input');inventory(storage.output,'worksite output');
   component(id,'Worksite',{storage});return component(id,'ProductionJob',{record:storage.job||null});
  };
  scheduler.register({id:'inventory-transfer',phase:'simulate',order:10,query:['CarrierTask'],update(w,id){
   const x=w.get(id,'CarrierTask'),s=x.spec;
   if(completed.has(s.id)){x.result=result('duplicate',{duplicate:true});return;}
   const source=w.get(s.sourceId,'Inventory')?.items,destination=w.get(s.destinationId,'Inventory')?.items;
   if(!source||!destination||!identity(s.resource)||!integer(s.requested,1)||!integer(s.destinationLimit))throw Error('Invalid transfer request.');
   const amount=Math.min(s.requested,quantity(source,s.resource),s.destinationLimit);
   if(amount<=0){x.result=result('blocked');return;}
   source[s.resource]=quantity(source,s.resource)-amount;destination[s.resource]=quantity(destination,s.resource)+amount;
   completed.add(s.id);x.result=result('settled',{amount});
  }});
  scheduler.register({id:'resource-harvest',phase:'simulate',order:20,query:['HarvestTask'],update(w,id){
   const x=w.get(id,'HarvestTask'),s=x.spec;
   if(completed.has(s.id)){x.result=result('duplicate',{duplicate:true});return;}
   const deposit=w.get(s.depositId,'ResourceDeposit'),destination=w.get(s.destinationId,'Inventory')?.items;
   if(!deposit||!destination||deposit.resource!==s.resource||!integer(s.requested,1)||!integer(s.destinationLimit))throw Error('Invalid harvest request.');
   const available=deposit.finite?deposit.record.stock:s.requested,amount=Math.min(s.requested,available,s.destinationLimit);
   if(amount<=0){x.result=result('blocked');return;}
   destination[s.resource]=quantity(destination,s.resource)+amount;if(deposit.finite)deposit.record.stock-=amount;
   completed.add(s.id);x.result=result('settled',{amount});
  }});
  scheduler.register({id:'production-reserve',phase:'simulate',order:30,query:['ProductionReservation'],update(w,id){
   const x=w.get(id,'ProductionReservation'),s=x.spec,site=w.get(s.worksiteId,'Worksite'),jobComponent=w.get(s.worksiteId,'ProductionJob'),st=site?.storage,r=s.recipe;
   if(completed.has(s.id)){x.result=result('duplicate',{duplicate:true,job:st?.job||null});return;}
   if(!st||!jobComponent||!plain(r)||!plain(r.cost)||!plain(s.job)||!integer(s.outputCapacity)||!integer(s.outputAmount,1)||!identity(s.job.id))throw Error('Invalid production reservation.');
   if(st.job){x.result=result(st.job.id===s.job.id?'duplicate':'blocked',{duplicate:st.job.id===s.job.id,job:st.job});return;}
   if(total(st.output)+s.outputAmount>s.outputCapacity||Object.entries(r.cost).some(([k,q])=>!identity(k)||!integer(q)||quantity(st.input,k)<q)){x.result=result('blocked');return;}
   const substrate=s.depositId?w.get(s.depositId,'ResourceDeposit'):null;
   if(s.depositId&&!substrate)throw Error('Missing production substrate.');
   if(substrate?.finite&&substrate.record.stock<s.substrateDepletion){x.result=result('blocked');return;}
   if(!integer(s.substrateDepletion||0))throw Error('Invalid substrate depletion.');
   for(const [k,q]of Object.entries(r.cost))st.input[k]=quantity(st.input,k)-q;
   if(substrate?.finite)substrate.record.stock-=s.substrateDepletion;
   st.job=s.job;jobComponent.record=s.job;completed.add(s.id);x.result=result('settled',{amount:s.outputAmount,job:st.job,created:true});
  }});
  scheduler.register({id:'production-job-update',phase:'simulate',order:40,query:['ProductionJobUpdate'],update(w,id){
   const x=w.get(id,'ProductionJobUpdate'),s=x.spec,site=w.get(s.worksiteId,'Worksite'),jobComponent=w.get(s.worksiteId,'ProductionJob'),job=site?.storage?.job;
   if(!job||job.id!==s.jobId){x.result=result('stale');return;}
   if(s.action==='progress'){
    if(!Number.isFinite(s.progress)||s.progress<0)throw Error('Invalid production progress.');
    job.progress=Math.min(job.duration,Math.max(job.progress||0,s.progress));x.result=result('settled',{job});
   }else if(s.action==='claim'){
    if(!identity(s.workerId)||job.workerId&&job.workerId!==s.workerId&&!s.allowTakeover){x.result=result('blocked',{job});return;}
    job.workerId=s.workerId;x.result=result('settled',{job});
   }else if(s.action==='release'){
    if(Number.isFinite(s.progress))job.progress=Math.min(job.duration,Math.max(0,s.progress));job.workerId=null;x.result=result('settled',{job});
   }else throw Error('Invalid production update action.');
   jobComponent.record=job;
  }});
  scheduler.register({id:'production-settlement',phase:'simulate',order:50,query:['ProductionSettlement'],update(w,id){
   const x=w.get(id,'ProductionSettlement'),s=x.spec,site=w.get(s.worksiteId,'Worksite'),jobComponent=w.get(s.worksiteId,'ProductionJob'),st=site?.storage,job=st?.job;
   if(completed.has(s.id)){x.result=result('duplicate',{duplicate:true});return;}
   if(!job||job.id!==s.jobId){x.result=result('stale');return;}
   if(typeof s.success!=='boolean'||!integer(s.outputCapacity)||!Number.isFinite(s.time))throw Error('Invalid production settlement.');
   if(s.success&&total(st.output)+job.amount>s.outputCapacity){x.result=result('blocked',{job});return;}
   job.attempts=(job.attempts||0)+1;
   if(!s.success){
    if(!Number.isFinite(s.retryProgress)||s.retryProgress<0)throw Error('Invalid retry progress.');
    job.progress=Math.min(job.duration,s.retryProgress);job.workerId=null;if(typeof s.message==='string')st.lastMessage=s.message;
    jobComponent.record=job;completed.add(s.id);x.result=result('settled',{job,success:false});return;
   }
   st.output[job.output]=quantity(st.output,job.output)+job.amount;st.lastOutput=s.time;st.completed=(st.completed||0)+1;
   if(typeof s.message==='string')st.lastMessage=s.message;
   const finished=job;st.job=null;jobComponent.record=null;completed.add(s.id);x.result=result('settled',{amount:finished.amount,job:finished,success:true});
  }});
  function prepare(type,s){
   if(type==='CarrierTask'){bindInventory(s.sourceId,s.source);bindInventory(s.destinationId,s.destination);}
   else if(type==='HarvestTask'){bindDeposit(s.depositId,s.deposit,s.resource,s.finite);bindInventory(s.destinationId,s.destination);}
   else if(type==='ProductionReservation'){
    bindWorksite(s.worksiteId,s.storage);if(s.depositId)bindDeposit(s.depositId,s.deposit,s.substrateResource,s.substrateFinite);
   }else if(type==='ProductionJobUpdate'||type==='ProductionSettlement')bindWorksite(s.worksiteId,s.storage);
  }
  function validateTask(type,s){
   transaction(s,type);
   if(type==='CarrierTask'){
    if(!identity(s.sourceId)||!identity(s.destinationId)||s.sourceId===s.destinationId||s.source===s.destination||
     !identity(s.resource)||!integer(s.requested,1)||!integer(s.destinationLimit))throw Error('Invalid transfer request.');
    inventory(s.source,'source');inventory(s.destination,'destination');
   }else if(type==='HarvestTask'){
    if(!identity(s.depositId)||!identity(s.destinationId)||!identity(s.resource)||!integer(s.requested,1)||
     !integer(s.destinationLimit))throw Error('Invalid harvest request.');
    if(!plain(s.deposit)||typeof s.finite!=='boolean'||s.finite&&!integer(s.deposit.stock))throw Error('Invalid resource deposit.');
    inventory(s.destination,'destination');
   }else if(type==='ProductionReservation'){
    if(!identity(s.worksiteId)||!plain(s.storage)||!plain(s.storage.input)||!plain(s.storage.output)||
     !plain(s.recipe)||!plain(s.recipe.cost)||!plain(s.job)||!identity(s.job.id)||
     !integer(s.outputCapacity)||!integer(s.outputAmount,1)||!integer(s.substrateDepletion||0)||
     Object.entries(s.recipe.cost).some(([id,n])=>!identity(id)||!integer(n)))throw Error('Invalid production reservation.');
    inventory(s.storage.input,'worksite input');inventory(s.storage.output,'worksite output');
    if(s.depositId&&(!identity(s.depositId)||!plain(s.deposit)||!identity(s.substrateResource)||
     typeof s.substrateFinite!=='boolean'||s.substrateFinite&&!integer(s.deposit.stock)))throw Error('Invalid production substrate.');
   }else if(type==='ProductionJobUpdate'){
    if(!identity(s.worksiteId)||!plain(s.storage)||!plain(s.storage.input)||!plain(s.storage.output)||
     !identity(s.jobId)||!['progress','claim','release'].includes(s.action))throw Error('Invalid production update.');
    inventory(s.storage.input,'worksite input');inventory(s.storage.output,'worksite output');
    if(s.action==='progress'&&(!Number.isFinite(s.progress)||s.progress<0) ||
     s.action==='claim'&&(!identity(s.workerId)||typeof s.allowTakeover!=='boolean') ||
     s.action==='release'&&s.progress!==undefined&&(!Number.isFinite(s.progress)||s.progress<0))throw Error('Invalid production update.');
   }else if(type==='ProductionSettlement'){
    if(!identity(s.worksiteId)||!plain(s.storage)||!plain(s.storage.input)||!plain(s.storage.output)||
     !identity(s.jobId)||typeof s.success!=='boolean'||!integer(s.outputCapacity)||!Number.isFinite(s.time)||
     !s.success&&(!Number.isFinite(s.retryProgress)||s.retryProgress<0))throw Error('Invalid production settlement.');
    inventory(s.storage.input,'worksite input');inventory(s.storage.output,'worksite output');
   }else throw Error('Invalid physical transaction type.');
   return s;
  }
  function stage(type,spec){
   validateTask(type,spec);prepare(type,spec);const id='tx:'+String(++serial).padStart(10,'0')+':'+spec.id;
   world.create(id);const command={spec,result:null};world.set(id,type,command);
   try{scheduler.step(world,.1,{entityId:id});return command.result;}finally{world.destroy(id);}
  }
  function batch(type,specs){
   if(!Array.isArray(specs)||!specs.length)throw Error('Expected transactions.');const records=[],ordered=specs.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id))),bindings=new Map();
   for(const spec of ordered){validateTask(type,spec);for(const[id,record]of[[spec.sourceId,spec.source],[spec.destinationId,spec.destination]])if(id){if(bindings.has(id)&&bindings.get(id)!==record)throw Error('Conflicting physical entity binding.');bindings.set(id,record);}}
   for(const spec of ordered){
    prepare(type,spec);const id='tx:'+String(++serial).padStart(10,'0')+':'+spec.id;
    world.create(id);const command={spec,result:null};world.set(id,type,command);records.push({id,command,spec});
   }
   try{scheduler.step(world,.1);return records.map(x=>({id:x.spec.id,...x.command.result}));}finally{for(const x of records)world.destroy(x.id);}
  }
  return Object.freeze({world,scheduler,bindInventory,bindDeposit,bindWorksite,
   transfer:spec=>stage('CarrierTask',spec),transfers:specs=>batch('CarrierTask',specs),
   harvest:spec=>stage('HarvestTask',spec),reserveProduction:spec=>stage('ProductionReservation',spec),
   updateProduction:spec=>stage('ProductionJobUpdate',spec),settleProduction:spec=>stage('ProductionSettlement',spec),
   hasSettled:id=>completed.has(id),forget:id=>completed.delete(id)});
 }
 const api=Object.freeze({create,total});root.LWWorldECS=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
