/* Deterministic ECS settlement for physical world resources, inventories and jobs.
 * Existing save records are bound by reference to explicit components; no ECS state is
 * serialized. Policy, skill rolls, rewards and presentation remain in the domain facade.
 */
/// <reference path="./physical-ecs-contracts.d.ts" />
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWECS?:LWPhysicalPorts.EcsApi;LWWorldECS?:LWPhysicalPorts.EcsPhysicalApi};
 type Inventory=LWPhysicalPorts.Inventory;type Spec=LWPhysicalPorts.Spec;type TaskKind=LWPhysicalPorts.TaskKind;
 type Job=LWPhysicalPorts.Job;type Storage=LWPhysicalPorts.Storage;type Result=LWPhysicalPorts.Result;
 type World=LWPhysicalPorts.World;type Components=LWPhysicalPorts.Components;
 const node=typeof module!=='undefined'&&module.exports;
 const E=(node?require('./ecs.js'):root.LWECS) as LWPhysicalPorts.EcsApi;
 const own=(o:object,k:PropertyKey):boolean=>Object.prototype.hasOwnProperty.call(o,k);
 const plain=(o:unknown):boolean=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&[Object.prototype,null].includes(Object.getPrototypeOf(o));
 const integer=(n:unknown,min=0,max=1e9):n is number=>typeof n==='number'&&Number.isInteger(n)&&n>=min&&n<=max;
 const identity=(s:unknown):s is string=>typeof s==='string'&&/^[a-zA-Z][a-zA-Z0-9._:-]{0,95}$/.test(s);
 const quantity=(inv:Inventory,id:string):number=>own(inv,id)?inv[id]!:0;
 const total=(inv:Inventory|null|undefined):number=>Object.values(inv||{}).reduce((sum,n)=>sum+n,0);
 const compareId=(a:string,b:string):number=>a<b?-1:a>b?1:0;
 function writable(record:object,keys:readonly string[],label:string):void{
  for(const key of keys){
   const descriptor=Object.getOwnPropertyDescriptor(record,key);
   if(descriptor){
    if(!own(descriptor,'value')||!descriptor.writable)throw Error('Invalid '+label+' write target.');
   }else{
    if(!Object.isExtensible(record))throw Error('Invalid '+label+' write target.');
    for(let prototype=Object.getPrototypeOf(record);prototype;prototype=Object.getPrototypeOf(prototype)){
     const inherited=Object.getOwnPropertyDescriptor(prototype,key);
     if(inherited&&(!own(inherited,'value')||!inherited.writable))throw Error('Invalid '+label+' write target.');
    }
   }
  }
 }
 function inventory(inv:Inventory,label:string):Inventory{
  if(!plain(inv))throw Error('Invalid '+label+' inventory.');
  for(const [id,descriptor]of Object.entries(Object.getOwnPropertyDescriptors(inv))){
   if(!own(descriptor,'value')||!descriptor.enumerable||!identity(id)||!integer(descriptor.value))throw Error('Invalid '+label+' inventory quantity.');
   writable(inv,[id],label+' inventory');
  }
  return inv;
 }
 function transaction(spec:Spec,kind:TaskKind):Spec{if(!plain(spec)||!identity(spec.id))throw Error('Invalid '+kind+' transaction.');return spec;}
 function create():LWPhysicalPorts.Runtime{
  const world=new E.World(),scheduler=new E.Scheduler(),completed=new Set<string>();let serial=0;
  const result=(state:Result['state'],extra:Partial<Result>={}):Result=>Object.assign({ok:state==='settled',state,amount:0},extra);
  function component<K extends keyof Components>(entityId:string,type:K,data:Components[K],target:World=world):Components[K]{
   // Command entities own tx:; native physical bindings must never occupy that namespace.
   if(!identity(entityId)||entityId.startsWith('tx:'))throw Error('Invalid physical entity ID.');
   if(!target.entities.has(entityId))target.create(entityId);
   return target.set(entityId,type,data);
  }
  const bindInventory=(id:string,items:Inventory)=>component(id,'Inventory',{items:inventory(items,id)});
  const bindDeposit=(id:string,record:LWPhysicalPorts.Deposit,resource:string,finite:boolean)=>{
   if(!plain(record)||!identity(resource)||typeof finite!=='boolean'||finite&&!integer(record.stock))throw Error('Invalid resource deposit.');
   return component(id,'ResourceDeposit',{record,resource,finite});
  };
  const bindWorksite=(id:string,storage:Storage)=>{
   validateStorage(storage);
   component(id,'Worksite',{storage});return component(id,'ProductionJob',{record:storage.job||null});
  };
  scheduler.register({id:'inventory-transfer',phase:'simulate',order:10,query:['CarrierTask'],update(w,id){
   const x=w.get(id,'CarrierTask')!,s=x.spec;
   if(completed.has(s.id)){x.result=result('duplicate',{duplicate:true});return;}
   const source=w.get(s.sourceId,'Inventory')?.items,destination=w.get(s.destinationId,'Inventory')?.items;
   if(!source||!destination||!identity(s.resource)||!integer(s.requested,1)||!integer(s.destinationLimit))throw Error('Invalid transfer request.');
   const amount=Math.min(s.requested,quantity(source,s.resource),s.destinationLimit);
   if(amount<=0||!integer(quantity(destination,s.resource)+amount)){x.result=result('blocked');return;}
   source[s.resource]=quantity(source,s.resource)-amount;destination[s.resource]=quantity(destination,s.resource)+amount;
   completed.add(s.id);x.result=result('settled',{amount});
  }});
  scheduler.register({id:'resource-harvest',phase:'simulate',order:20,query:['HarvestTask'],update(w,id){
   const x=w.get(id,'HarvestTask')!,s=x.spec;
   if(completed.has(s.id)){x.result=result('duplicate',{duplicate:true});return;}
   const deposit=w.get(s.depositId,'ResourceDeposit'),destination=w.get(s.destinationId,'Inventory')?.items;
   if(!deposit||!destination||deposit.resource!==s.resource||!integer(s.requested,1)||!integer(s.destinationLimit))throw Error('Invalid harvest request.');
   const available=deposit.finite?deposit.record.stock:s.requested,amount=Math.min(s.requested,available,s.destinationLimit);
   if(amount<=0||!integer(quantity(destination,s.resource)+amount)){x.result=result('blocked');return;}
   destination[s.resource]=quantity(destination,s.resource)+amount;if(deposit.finite)deposit.record.stock-=amount;
   completed.add(s.id);x.result=result('settled',{amount});
  }});
  scheduler.register({id:'production-reserve',phase:'simulate',order:30,query:['ProductionReservation'],update(w,id){
   const x=w.get(id,'ProductionReservation')!,s=x.spec,site=w.get(s.worksiteId,'Worksite'),jobComponent=w.get(s.worksiteId,'ProductionJob')!,st=site?.storage,r=s.recipe;
   if(completed.has(s.id)){x.result=result('duplicate',{duplicate:true,job:st?.job||null});return;}
   if(!st||!jobComponent||!plain(r)||!plain(r.cost)||!plain(s.job)||!integer(s.outputCapacity)||!integer(s.outputAmount,1)||!identity(s.job.id))throw Error('Invalid production reservation.');
   if(st.job){x.result=result(st.job.id===s.job.id?'duplicate':'blocked',{duplicate:st.job.id===s.job.id,job:st.job});return;}
   if(total(st.output)+s.outputAmount>s.outputCapacity||Object.entries(r.cost).some(([k,q])=>!identity(k)||!integer(q)||quantity(st.input,k)<q)){x.result=result('blocked');return;}
   const substrate=s.depositId?w.get(s.depositId,'ResourceDeposit'):null;
   if(s.depositId&&!substrate)throw Error('Missing production substrate.');
   const depletion=s.substrateDepletion===undefined?0:s.substrateDepletion;
   if(!integer(depletion))throw Error('Invalid substrate depletion.');
   if(substrate?.finite&&substrate.record.stock<depletion){x.result=result('blocked');return;}
   for(const [k,q]of Object.entries(r.cost))st.input[k]=quantity(st.input,k)-q;
   if(substrate?.finite)substrate.record.stock-=depletion;
   st.job=s.job;jobComponent.record=s.job;completed.add(s.id);x.result=result('settled',{amount:s.outputAmount,job:st.job,created:true});
  }});
  scheduler.register({id:'production-job-update',phase:'simulate',order:40,query:['ProductionJobUpdate'],update(w,id){
   const x=w.get(id,'ProductionJobUpdate')!,s=x.spec,site=w.get(s.worksiteId,'Worksite'),jobComponent=w.get(s.worksiteId,'ProductionJob')!,job=site?.storage?.job;
   if(!job||job.id!==s.jobId){x.result=result('stale');return;}
   if(s.action==='progress'){
    if(!Number.isFinite(s.progress)||s.progress<0)throw Error('Invalid production progress.');
    job.progress=Math.min(job.duration,Math.max(job.progress||0,s.progress));x.result=result('settled',{job});
   }else if(s.action==='claim'){
    if(!identity(s.workerId)||job.workerId&&job.workerId!==s.workerId&&!s.allowTakeover){x.result=result('blocked',{job});return;}
    job.workerId=s.workerId;x.result=result('settled',{job});
   }else if(s.action==='release'){
    if(Number.isFinite(s.progress))job.progress=Math.min(job.duration,Math.max(0,s.progress!));job.workerId=null;x.result=result('settled',{job});
   }else throw Error('Invalid production update action.');
   jobComponent.record=job;
  }});
  scheduler.register({id:'production-settlement',phase:'simulate',order:50,query:['ProductionSettlement'],update(w,id){
   const x=w.get(id,'ProductionSettlement')!,s=x.spec,site=w.get(s.worksiteId,'Worksite'),jobComponent=w.get(s.worksiteId,'ProductionJob')!,st=site?.storage,job=st?.job;
   if(completed.has(s.id)){x.result=result('duplicate',{duplicate:true});return;}
   if(!st||!job||job.id!==s.jobId){x.result=result('stale');return;}
   if(typeof s.success!=='boolean'||!integer(s.outputCapacity)||!Number.isFinite(s.time))throw Error('Invalid production settlement.');
   if(s.success&&total(st.output)+job.amount>s.outputCapacity){x.result=result('blocked',{job});return;}
   if(!integer((job.attempts||0)+1)||s.success&&!integer((st.completed||0)+1))throw Error('Production count limit exceeded.');
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
  function prepare(type:TaskKind,spec:Spec,target:World=world):void{
   if(type==='CarrierTask'){const s=spec as LWPhysicalPorts.Transfer;component(s.sourceId,'Inventory',{items:s.source},target);component(s.destinationId,'Inventory',{items:s.destination},target);}
   else if(type==='HarvestTask'){const s=spec as LWPhysicalPorts.Harvest;component(s.depositId,'ResourceDeposit',{record:s.deposit,resource:s.resource,finite:s.finite},target);component(s.destinationId,'Inventory',{items:s.destination},target);}
   else if(type==='ProductionReservation'){const s=spec as LWPhysicalPorts.Reservation;
    prepare('ProductionJobUpdate',s,target);
    if(s.depositId)component(s.depositId,'ResourceDeposit',{record:s.deposit!,resource:s.substrateResource!,finite:s.substrateFinite!},target);
   }else if(type==='ProductionJobUpdate'||type==='ProductionSettlement'){const s=spec as LWPhysicalPorts.JobUpdate|LWPhysicalPorts.Settlement;
    component(s.worksiteId,'Worksite',{storage:s.storage},target);component(s.worksiteId,'ProductionJob',{record:s.storage.job||null},target);
   }
  }
  function validateJob(job:Job):void{
   if(!plain(job)||!identity(job.id)||!identity(job.output)||!integer(job.amount,1)||
    !Number.isFinite(job.duration)||job.duration<=0||!Number.isFinite(job.progress)||job.progress<0||job.progress>job.duration||
    job.attempts!==undefined&&!integer(job.attempts)||job.workerId!==undefined&&job.workerId!==null&&!identity(job.workerId))throw Error('Invalid production job.');
  }
  function validateStorage(storage:Storage):void{
   if(!plain(storage)||!plain(storage.input)||!plain(storage.output)||storage.input===storage.output)throw Error('Invalid worksite.');
   inventory(storage.input,'worksite input');inventory(storage.output,'worksite output');
   if(storage.job!==undefined&&storage.job!==null)validateJob(storage.job);
   if(storage.completed!==undefined&&!integer(storage.completed))throw Error('Invalid completed production count.');
  }
  function validateTask(type:TaskKind,spec:Spec):void{
   const s=spec;
   transaction(s,type);
   if(type.startsWith('Production'))validateStorage((s as LWPhysicalPorts.Reservation|LWPhysicalPorts.JobUpdate|LWPhysicalPorts.Settlement).storage);
   if(type==='CarrierTask'){const s=spec as LWPhysicalPorts.Transfer;
    if(!identity(s.sourceId)||!identity(s.destinationId)||s.sourceId===s.destinationId||s.source===s.destination||
     !identity(s.resource)||!integer(s.requested,1)||!integer(s.destinationLimit))throw Error('Invalid transfer request.');
    inventory(s.source,'source');inventory(s.destination,'destination');
   }else if(type==='HarvestTask'){const s=spec as LWPhysicalPorts.Harvest;
    if(!identity(s.depositId)||!identity(s.destinationId)||!identity(s.resource)||!integer(s.requested,1)||
     !integer(s.destinationLimit))throw Error('Invalid harvest request.');
    if(!plain(s.deposit)||typeof s.finite!=='boolean'||s.finite&&!integer(s.deposit!.stock))throw Error('Invalid resource deposit.');
    inventory(s.destination,'destination');
   }else if(type==='ProductionReservation'){const s=spec as LWPhysicalPorts.Reservation;
    if(!identity(s.worksiteId)||!plain(s.storage)||!plain(s.storage.input)||!plain(s.storage.output)||
     !plain(s.recipe)||!plain(s.recipe.cost)||!plain(s.job)||!identity(s.job.id)||
     !integer(s.outputCapacity)||!integer(s.outputAmount,1)||!integer(s.substrateDepletion===undefined?0:s.substrateDepletion)||
     Object.entries(s.recipe.cost).some(([id,n])=>!identity(id)||!integer(n)))throw Error('Invalid production reservation.');
    validateJob(s.job);
    if(s.job.amount!==s.outputAmount||s.recipe.output!==undefined&&s.recipe.output!==s.job.output)throw Error('Mismatched production output.');
    if(s.job.cost!==undefined){inventory(s.job.cost,'reserved input');const keys=new Set([...Object.keys(s.recipe.cost),...Object.keys(s.job.cost)]);if([...keys].some(key=>quantity(s.recipe.cost,key)!==quantity(s.job.cost!,key)))throw Error('Mismatched reserved production input.');}
    if(s.depositId&&(!identity(s.depositId)||!plain(s.deposit)||!identity(s.substrateResource)||
     typeof s.substrateFinite!=='boolean'||s.substrateFinite&&!integer(s.deposit!.stock)))throw Error('Invalid production substrate.');
   }else if(type==='ProductionJobUpdate'){const s=spec as LWPhysicalPorts.JobUpdate;
    if(!identity(s.worksiteId)||!plain(s.storage)||!plain(s.storage.input)||!plain(s.storage.output)||
     !identity(s.jobId)||!['progress','claim','release'].includes(s.action))throw Error('Invalid production update.');
    inventory(s.storage.input,'worksite input');inventory(s.storage.output,'worksite output');
    if(s.action==='progress'&&(!Number.isFinite(s.progress)||s.progress<0) ||
     s.action==='claim'&&(!identity(s.workerId)||typeof s.allowTakeover!=='boolean') ||
     s.action==='release'&&s.progress!==undefined&&(!Number.isFinite(s.progress)||s.progress<0))throw Error('Invalid production update.');
   }else if(type==='ProductionSettlement'){const s=spec as LWPhysicalPorts.Settlement;
    if(!identity(s.worksiteId)||!plain(s.storage)||!plain(s.storage.input)||!plain(s.storage.output)||
     !identity(s.jobId)||typeof s.success!=='boolean'||!integer(s.outputCapacity)||!Number.isFinite(s.time)||
     !s.success&&(!Number.isFinite(s.retryProgress)||s.retryProgress<0))throw Error('Invalid production settlement.');
    inventory(s.storage.input,'worksite input');inventory(s.storage.output,'worksite output');
   }else throw Error('Invalid physical transaction type.');
   return;
  }
  function stage<K extends TaskKind>(type:K,spec:LWPhysicalPorts.Specs[K]):Result{
   preflight(type,[spec]);prepare(type,spec);const id='tx:'+String(++serial).padStart(10,'0')+':'+spec.id;
   world.create(id);const command:LWPhysicalPorts.Command<LWPhysicalPorts.Specs[K]>={spec,result:null};
   try{world.set(id,type,command as Components[K]);scheduler.step(world,.1,{entityId:id});return command.result!;}finally{world.destroy(id);}
  }
  function batch<K extends TaskKind>(type:K,specs:LWPhysicalPorts.Specs[K][]):(Result & {id:string})[]{
   if(!Array.isArray(specs)||!specs.length)throw Error('Expected transactions.');
   preflight(type,specs);
   const records:{id:string;command:LWPhysicalPorts.Command<LWPhysicalPorts.Specs[K]>;spec:LWPhysicalPorts.Specs[K]}[]=[],ordered=specs.slice().sort((a,b)=>compareId(a.id,b.id));
   try{
    for(const spec of ordered){
     prepare(type,spec);const id='tx:'+String(++serial).padStart(10,'0')+':'+spec.id;
     world.create(id);const command:LWPhysicalPorts.Command<LWPhysicalPorts.Specs[K]>={spec,result:null};records.push({id,command,spec});world.set(id,type,command as Components[K]);
    }
    scheduler.step(world,.1);return records.map(x=>({id:x.spec.id,...x.command.result!}));
   }finally{for(const x of records)world.destroy(x.id);}
  }
  function preflight(type:TaskKind,specs:Spec[]):void{
   if(world.running||world.pendingStructural)throw Error('Invalid physical transaction boundary.');
   const preview=new E.World(),bindings=new Map<string,Inventory>();
   // Validate complete component graphs before inspecting or binding any live record.
   for(let index=0;index<specs.length;index++){
    const id='preflight:'+index;preview.create(id);
    try{preview.set(id,type,{spec:specs[index]!,result:null} as Components[TaskKind]);}
    catch(error){throw Error('Invalid '+type.replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase()+': '+(error instanceof Error?error.message:String(error)));}
   }
   for(const spec of specs){
    validateTask(type,spec);writeTargets(type,spec);
    const bindingSpec=spec as Partial<LWPhysicalPorts.Transfer>;
    for(const[id,record]of[[bindingSpec.sourceId,bindingSpec.source],[bindingSpec.destinationId,bindingSpec.destination]] as const)if(id&&record){
     if(bindings.has(id)&&bindings.get(id)!==record)throw Error('Conflicting physical entity binding.');bindings.set(id,record);
    }
    prepare(type,spec,preview);
   }
  }
  function writeTargets(type:TaskKind,spec:Spec):void{
   if(type==='CarrierTask'){const s=spec as LWPhysicalPorts.Transfer;
    writable(s.source,[s.resource],'source inventory');writable(s.destination,[s.resource],'destination inventory');
   }else if(type==='HarvestTask'){const s=spec as LWPhysicalPorts.Harvest;
    writable(s.destination,[s.resource],'destination inventory');if(s.finite)writable(s.deposit!,['stock'],'deposit');
   }else if(type==='ProductionReservation'){const s=spec as LWPhysicalPorts.Reservation;
    writable(s.storage.input,Object.keys(s.recipe.cost),'worksite input');writable(s.storage,['job'],'worksite');
    if(s.substrateFinite&&s.depositId)writable(s.deposit!,['stock'],'deposit');
   }else{
    const s=spec as LWPhysicalPorts.JobUpdate|LWPhysicalPorts.Settlement;const job=s.storage.job;if(!job)return;
    if(type==='ProductionJobUpdate'){const s=spec as LWPhysicalPorts.JobUpdate;writable(job,s.action==='claim'?['workerId']:s.action==='release'?['progress','workerId']:['progress'],'production job');}
    else{const s=spec as LWPhysicalPorts.Settlement;
     writable(job,s.success?['attempts']:['attempts','progress','workerId'],'production job');
     if(s.success){writable(s.storage.output,[job.output],'worksite output');writable(s.storage,['lastOutput','completed','job'],'worksite');}
     if(typeof s.message==='string')writable(s.storage,['lastMessage'],'worksite');
    }
   }
  }
  return Object.freeze({world,scheduler,bindInventory,bindDeposit,bindWorksite,
   transfer:(spec:LWPhysicalPorts.Transfer)=>stage('CarrierTask',spec),transfers:(specs:LWPhysicalPorts.Transfer[])=>batch('CarrierTask',specs),
   harvest:(spec:LWPhysicalPorts.Harvest)=>stage('HarvestTask',spec),reserveProduction:(spec:LWPhysicalPorts.Reservation)=>stage('ProductionReservation',spec),
   updateProduction:(spec:LWPhysicalPorts.JobUpdate)=>stage('ProductionJobUpdate',spec),settleProduction:(spec:LWPhysicalPorts.Settlement)=>stage('ProductionSettlement',spec),
   hasSettled:(id:string)=>completed.has(id),forget:(id:string)=>completed.delete(id)});
 }
 const api=Object.freeze({create,total});root.LWWorldECS=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
