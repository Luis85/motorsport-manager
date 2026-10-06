/// <reference path="./rts-economy-contracts.d.ts" />
/* Resource cargo, footprint placement and construction share the RTS ECS authority. */
(function(inputRoot:unknown){
 'use strict';
 type Context=LWRTSEconomyTypes.Context;
 type Command=LWRTSEconomyTypes.Command;
 type Result=LWRTSEconomyTypes.Result;
 type Position=LWRTSEconomyTypes.Position;
 type Owner=LWRTSEconomyTypes.Owner;
 type Kind=LWRTSEconomyTypes.Kind;
 type Building=LWRTSEconomyTypes.Building;
 type Order=LWRTSEconomyTypes.Order;
 interface Worker extends LWRTSEconomyTypes.Worker {nodeId?:string;returning?:boolean;}
 const root=inputRoot as {LWRTSProduction?:LWRTSEconomyTypes.ProductionAPI;LWRTSEconomy?:LWRTSRuntime.Economy};
 const production=(typeof module!=='undefined'&&module.exports?require('./rts-production.js'):root.LWRTSProduction) as LWRTSEconomyTypes.ProductionAPI;
 if(!production)throw Error('RTS production module is missing.');
 const distance=(a:Position,b:Position):number=>Math.hypot(a.x-b.x,a.y-b.y);
 const reject=(message:string):Result=>({ok:false,message});
 const accept=(entityId?:string):Result=>entityId?{ok:true,message:'Accepted.',entityId}:{ok:true,message:'Accepted.'};
 function definition(context:Context,id:string):LWRTSData.Building|null {
  const kind=context.world.get<Kind>(id,'rts-kind');return kind?context.catalog.get('buildings',kind.definition):null;
 }
 function owned(context:Context,id:string,faction:string):boolean {
  const health=context.world.get<LWRTSRuntime.Health>(id,'rts-health');
  return context.world.get<Owner>(id,'rts-owner')?.faction===faction && (!health||health.hp>0);
 }
 function order(context:Context,id:string,kind:string,targetId:string,position:Position):void {
  const next:Order={kind,targetId,x:position.x,y:position.y,path:[],cursor:0};
  if(context.world.running)context.world.defer('set',id,'rts-order',next);else context.world.set(id,'rts-order',next);
 }
 function storage(context:Context,faction:string,resource:string,position:Position):string|null {
  return context.world.query(['rts-building','rts-owner','rts-position']).filter(id=>
   owned(context,id,faction)&&context.world.get<Building>(id,'rts-building')!.complete&&definition(context,id)?.storage.includes(resource))
   .sort((a,b)=>distance(position,context.world.get<Position>(a,'rts-position')!)-distance(position,context.world.get<Position>(b,'rts-position')!) || a.localeCompare(b))[0] || null;
 }
 function footprint(context:Context,building:LWRTSData.Building,x:number,y:number):string|null {
  const width=building.footprint.width,height=building.footprint.height;
  if(!Number.isFinite(x)||!Number.isFinite(y)||x-width/2<0||y-height/2<0||x+width/2>context.map.width||y+height/2>context.map.height)return 'Footprint lies outside the map.';
  for(let row=Math.floor(y-height/2);row<Math.ceil(y+height/2);row++){
   for(let column=Math.floor(x-width/2);column<Math.ceil(x+width/2);column++){
    const tile=context.map.tiles[row*context.map.width+column];
    const terrain=tile?context.catalog.get('terrain',tile):null;
    if(terrain&&!terrain.passable.includes('land'))return 'Construction requires passable land.';
    if(context.map.blocked.includes(column+','+row))return 'Footprint overlaps blocked terrain.';
   }
  }
  for(const id of context.world.query(['rts-position'])){
   const position=context.world.get<Position>(id,'rts-position')!,existing=definition(context,id);
   if(existing && Math.abs(position.x-x)<(existing.footprint.width+width)/2 && Math.abs(position.y-y)<(existing.footprint.height+height)/2)return 'Footprint overlaps a building.';
   if(context.world.get(id,'rts-node')&&Math.abs(position.x-x)<width/2+.5&&Math.abs(position.y-y)<height/2+.5)return 'Footprint overlaps a resource deposit.';
  }
  return null;
 }
 function command(context:Context,input:Command):Result|null {
  const queued=production.command(context,input);if(queued)return queued;
  if(!['build','gather','return','repair','purchase'].includes(input.kind))return null;
  const world=context.world,ids=input.entityIds || input.entities || (input.entityId?[input.entityId]:[]);
  if(input.kind==='purchase'){
   const id=ids[0] || '',item=context.catalog.get('items',input.definitionId || input.definition || '');
   if(ids.length!==1||!owned(context,id,input.faction)||!world.has(id,'rts-unit','rts-inventory'))return reject('Select one friendly unit to carry the item.');
   if(!item)return reject('Unknown item.');
   const inventory=world.get(id,'rts-inventory')!.items as Record<string,number>,state=production.bank(context,input.faction);
   if(!state)return reject('Unknown faction.');
   if((inventory[item.id] || 0)+item.charges>1000000)return reject('Item charge capacity is full.');
   if(!Object.entries(item.cost).every(([resource,cost])=>(state.resources[resource] || 0)>=cost))return reject('Insufficient resources.');
   for(const [resource,cost]of Object.entries(item.cost))state.resources[resource]=(state.resources[resource] || 0)-cost;
   inventory[item.id]=(inventory[item.id] || 0)+item.charges;context.emit({kind:'item-purchased',entityId:id,item:item.id,charges:item.charges});return accept();
  }
  if(input.kind==='build'){
   const building=context.catalog.get('buildings',input.definitionId || input.definition || ''),faction=context.catalog.get('factions',input.faction);
   if(!building||!faction?.buildings.includes(building.id))return reject('Unknown or unavailable building.');
   if(typeof input.x!=='number'||typeof input.y!=='number')return reject('Choose a construction location.');
   const x=Math.floor(input.x-building.footprint.width/2)+building.footprint.width/2,y=Math.floor(input.y-building.footprint.height/2)+building.footprint.height/2;
   const invalid=footprint(context,building,x,y);if(invalid)return reject(invalid);
   const workerId=input.workerId || ids[0] || world.query(['rts-worker','rts-owner']).find(id=>owned(context,id,input.faction));
   if(!workerId||!owned(context,workerId,input.faction)||!world.has(workerId,'rts-worker'))return reject('Select a friendly builder.');
   const workerKind=world.get<Kind>(workerId,'rts-kind'),worker=workerKind?context.catalog.get('units',workerKind.definition):null;
   if(!worker||worker.buildRate<=0)return reject('That unit cannot construct buildings.');
   const state=production.bank(context,input.faction);if(!state)return reject('Unknown faction.');
   if(!Object.entries(building.cost).every(([resource,cost])=>(state.resources[resource] || 0)>=cost))return reject('Insufficient resources.');
   if(world.entities.size+world.pendingStructural>=1200)return reject('Entity capacity is full.');
   const entityId=context.spawn(building.id,input.faction,x,y);
   world.set<Building>(entityId,'rts-building',{complete:false,progress:0});
   const health=world.get<LWRTSRuntime.Health>(entityId,'rts-health');if(health)health.hp=Math.max(1,health.max*.05);
   if(!world.has(entityId,'rts-production'))world.set(entityId,'rts-production',{queue:[]});
   for(const [resource,cost]of Object.entries(building.cost))state.resources[resource]=(state.resources[resource] || 0)-cost;
   order(context,workerId,'build',entityId,{x,y});context.emit({kind:'construction-started',entityId,definitionId:building.id});return accept(entityId);
  }
  if(!ids.length||ids.some(id=>!owned(context,id,input.faction)||!world.has(id,'rts-worker','rts-position')))return reject('Select friendly workers.');
  if(input.kind==='repair'){
   const target=input.targetId || '',health=world.get<LWRTSRuntime.Health>(target,'rts-health'),position=world.get<Position>(target,'rts-position');
   if(!owned(context,target,input.faction)||!health||!position)return reject('Choose a friendly repair target.');
   for(const id of ids)order(context,id,'repair',target,position);return accept();
  }
  if(input.kind==='return'){
   const targets=ids.map(id=>{const worker=world.get<Worker>(id,'rts-worker')!;return storage(context,input.faction,worker.resource,world.get<Position>(id,'rts-position')!);});
   if(targets.some(target=>!target))return reject('No storage accepts this cargo.');
   ids.forEach((id,index)=>{world.get<Worker>(id,'rts-worker')!.returning=true;order(context,id,'gather',targets[index]!,world.get<Position>(targets[index]!,'rts-position')!);});return accept();
  }
  const target=input.targetId || '',node=world.get<LWRTSEconomyTypes.Node>(target,'rts-node'),position=world.get<Position>(target,'rts-position');
  if(!node||node.remaining<=0||!position)return reject('Choose a resource deposit with remaining resources.');
  if(!storage(context,input.faction,node.resource,position))return reject('Build storage for this resource first.');
  if(ids.some(id=>{const worker=world.get<Worker>(id,'rts-worker')!;return worker.carried>0&&!storage(context,input.faction,worker.resource,world.get<Position>(id,'rts-position')!);}))return reject('Existing cargo requires compatible storage.');
  for(const id of ids){
   const worker=world.get<Worker>(id,'rts-worker')!;worker.nodeId=target;
   if(worker.carried>0){const depot=storage(context,input.faction,worker.resource,world.get<Position>(id,'rts-position')!);if(!depot)return reject('Existing cargo requires compatible storage.');worker.returning=true;order(context,id,'gather',depot,world.get<Position>(depot,'rts-position')!);}
   else {worker.resource=node.resource;worker.returning=false;order(context,id,'gather',target,position);}
  }
  return accept();
 }
 function gather(context:Context,id:string,dt:number):void {
  const world=context.world,worker=world.get<Worker>(id,'rts-worker')!,current=world.get<Order>(id,'rts-order')!;
  if(current.kind!=='gather')return;
  const position=world.get<Position>(id,'rts-position')!,faction=world.get<Owner>(id,'rts-owner')!.faction;
  if(!owned(context,id,faction))return;
  const target=world.get<Position>(current.targetId,'rts-position');if(!target)return;
  const depotDefinition=definition(context,current.targetId),reach=depotDefinition?Math.max(depotDefinition.footprint.width,depotDefinition.footprint.height)/2+1:1;
  if(distance(position,target)>reach)return;
  if(worker.returning){
   if(!world.get<Building>(current.targetId,'rts-building')?.complete||!depotDefinition?.storage.includes(worker.resource)||!owned(context,current.targetId,faction))return;
   const state=production.bank(context,faction);if(!state)return;
   state.resources[worker.resource]=(state.resources[worker.resource] || 0)+worker.carried;
   if(worker.carried>0)context.emit({kind:'resources-delivered',entityId:id,resource:worker.resource,amount:worker.carried});
   worker.carried=0;worker.returning=false;
   const nodeId=worker.nodeId || '',node=world.get<LWRTSEconomyTypes.Node>(nodeId,'rts-node'),nodePosition=world.get<Position>(nodeId,'rts-position');
   if(node&&node.remaining>0&&nodePosition){worker.resource=node.resource;order(context,id,'gather',nodeId,nodePosition);}else order(context,id,'stop','',position);
   return;
  }
  const node=world.get<LWRTSEconomyTypes.Node>(current.targetId,'rts-node');if(!node)return;
  worker.resource=node.resource;worker.nodeId=current.targetId;
  const resource=context.catalog.get('resources',node.resource),state=production.bank(context,faction),kind=world.get<Kind>(id,'rts-kind');
  const unit=kind?context.catalog.get('units',kind.definition):null;
  let rate=worker.rate*(resource?.gatherRate || 1);
  for(const tech of state?.technologies || [])for(const effect of context.catalog.get('technologies',tech)?.effects || [])if(effect.stat==='gatherRate'&&unit&&(!effect.roles.length||effect.roles.includes(unit.role)))rate*=effect.factor;
  const amount=Math.max(0,Math.min(node.remaining,worker.capacity-worker.carried,rate*dt));node.remaining-=amount;worker.carried+=amount;
  if(worker.carried>=worker.capacity-1e-9||node.remaining<=1e-9){
   const depot=storage(context,faction,worker.resource,position);
   if(depot){worker.returning=true;order(context,id,'gather',depot,world.get<Position>(depot,'rts-position')!);}
  }
 }
 function construct(context:Context,id:string,dt:number):void {
  const world=context.world,current=world.get<Order>(id,'rts-order')!;if(current.kind!=='build'&&current.kind!=='repair')return;
  const target=current.targetId,position=world.get<Position>(id,'rts-position')!,destination=world.get<Position>(target,'rts-position');
  const faction=world.get<Owner>(id,'rts-owner')!.faction;if(!owned(context,id,faction)||!destination||!owned(context,target,faction))return;
  const building=world.get<Building>(target,'rts-building'),buildingDef=definition(context,target),kind=world.get<Kind>(id,'rts-kind'),unit=kind?context.catalog.get('units',kind.definition):null;
  const reach=buildingDef?Math.max(buildingDef.footprint.width,buildingDef.footprint.height)/2+1:1;
  if(!unit||distance(position,destination)>reach)return;
  const health=world.get<LWRTSRuntime.Health>(target,'rts-health');
  if(current.kind==='repair'){
   if(!health)return;
   const targetKind=world.get<Kind>(target,'rts-kind'),targetUnit=targetKind?context.catalog.get('units',targetKind.definition):null;
   const costs=buildingDef?.cost || targetUnit?.cost,state=production.bank(context,faction);if(!costs||!state)return;
   let healing=Math.min(health.max-health.hp,unit.buildRate*dt);
   for(const [resource,cost]of Object.entries(costs))if(cost>0)healing=Math.min(healing,(state.resources[resource] || 0)*health.max/cost);
   if(healing<=0)return;
   for(const [resource,cost]of Object.entries(costs))state.resources[resource]=Math.max(0,(state.resources[resource] || 0)-cost*healing/health.max);
   health.hp=Math.min(health.max,health.hp+healing);if(health.hp===health.max)order(context,id,'stop','',position);return;
  }
  if(!building||!buildingDef)return;
  if(building.complete){order(context,id,'stop','',position);return;}
  building.progress=Math.min(1,building.progress+unit.buildRate*dt/buildingDef.buildTime);
  if(health)health.hp=Math.max(health.hp,health.max*building.progress);
  if(building.progress>=1){building.complete=true;if(health)health.hp=health.max;order(context,id,'stop','',position);context.emit({kind:'construction-completed',entityId:target});}
 }
 function register(scheduler:LWRTSEconomyTypes.Scheduler,context:Context):void {
  production.register(scheduler,context);
  scheduler.register({id:'rts-gathering',phase:'simulate',order:40,query:['rts-worker','rts-position','rts-owner','rts-order'],update(_world,id,dt){gather(context,id,dt);}});
  scheduler.register({id:'rts-construction',phase:'simulate',order:45,query:['rts-worker','rts-position','rts-owner','rts-order'],update(_world,id,dt){construct(context,id,dt);}});
 }
 const api:LWRTSRuntime.Economy=Object.freeze({register,command,completeStep:production.completeStep});root.LWRTSEconomy=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
