/** Finite depot service, owned by the fixed-step simulation and persisted with its vehicles. */
(function(input:unknown){
 'use strict';
 type C=LWArmoredRuntime.Context;type S=LWArmoredRuntime.Supply;
 const root=input as {LWArmoredLogistics?:LWArmoredRuntime.Extension};
 function condition(d:LWArmoredRuntime.Damage):string{return JSON.stringify([d.components,d.crew,d.fire]);}
 function reason(ctx:C,id:string,depot:LWArmoredData.SupplyDepot|undefined):string{
  const w=ctx.world,identity=w.get<LWArmoredRuntime.Identity>(id,'armored-identity')!;
  if(!depot||depot.faction!==identity.faction)return 'No friendly depot in range.';
  const p=w.get<LWArmoredRuntime.Transform>(id,'armored-transform')!.position;
  if(Math.hypot(p.x-depot.position.x,p.z-depot.position.z)>depot.radius)return 'Vehicle left the depot service area.';
  const d=w.get<LWArmoredRuntime.Damage>(id,'armored-damage')!,body=w.get<LWArmoredRuntime.Body>(id,'armored-body')!,motor=w.get<LWArmoredRuntime.Motor>(id,'armored-motor')!;
  if(d.status==='destroyed'||!Object.values(d.crew).some(n=>n>0))return 'No surviving crew available.';
  if(d.repair>0||d.fire>0)return 'Finish repairs and extinguish the fire first.';
  if(Math.hypot(body.velocity.x,body.velocity.y,body.velocity.z)>.3||Math.abs(body.yawVelocity)>.03||motor.throttle!==0||motor.steer!==0||motor.cruise!==0)return 'Stop the vehicle to receive supplies.';
  if(w.get<LWArmoredRuntime.Weapon>(id,'armored-weapon')!.trigger)return 'Release the fire control to receive supplies.';
  return '';
 }
 function transfer(ctx:C,id:string,depot:LWArmoredData.SupplyDepot,apply:boolean):number{
  const w=ctx.world,spec=ctx.catalog.vehicles.find(v=>v.id===w.get<LWArmoredRuntime.Identity>(id,'armored-identity')!.definition)!;
  const weapon=w.get<LWArmoredRuntime.Weapon>(id,'armored-weapon')!,damage=w.get<LWArmoredRuntime.Damage>(id,'armored-damage')!;
  const stocks=w.get<LWArmoredRuntime.Depot>('depot:'+depot.id,'armored-depot')!;
  let space=spec.ammoCapacity-Object.values(weapon.reserves).reduce((sum,n)=>sum+n,0),amount=0;
  // Selected ammunition has priority; remaining types keep their authored order.
  for(const ammo of [weapon.ammo,...spec.ammunition.filter(a=>a!==weapon.ammo)]){
   const count=Math.min(space,stocks.ammunition[ammo]??0);space-=count;amount+=count;
   if(apply&&count){stocks.ammunition[ammo]!-=count;weapon.reserves[ammo]!+=count;}
  }
  const kits=Math.min(spec.repairKits-Number(damage.repairKits),stocks.repairKits);amount+=kits;
  if(apply){damage.repairKits=Number(damage.repairKits)+kits;stocks.repairKits-=kits;}
  return amount;
 }
 function clear(s:S):void{s.depotId='';s.remaining=0;s.condition='';}
 function cancel(ctx:C,id:string,s:S,message:string):void{clear(s);ctx.emit({kind:'resupply-cancelled',entityId:id,message});}
 function selectedDepot(ctx:C,id:string):LWArmoredData.SupplyDepot|undefined{
  const p=ctx.world.get<LWArmoredRuntime.Transform>(id,'armored-transform')!.position;
  const faction=ctx.world.get<LWArmoredRuntime.Identity>(id,'armored-identity')!.faction;
  const candidates=(ctx.mission.supplies??[]).filter(d=>d.faction===faction&&Math.hypot(p.x-d.position.x,p.z-d.position.z)<=d.radius)
   .sort((a,b)=>Math.hypot(p.x-a.position.x,p.z-a.position.z)-Math.hypot(p.x-b.position.x,p.z-b.position.z)||a.id.localeCompare(b.id));
  return candidates.find(d=>transfer(ctx,id,d,false)>0)??candidates[0];
 }
 function availability(ctx:C,id:string):LWArmoredRuntime.ActionAvailability{
  if(ctx.solver!=='tracked-force-v2')return {available:false,reason:'This saved solver does not support depot resupply.'};
  if(ctx.world.get<LWArmoredRuntime.Damage>(id,'armored-damage')!.status==='destroyed')return {available:false,reason:'Vehicle unavailable.'};
  if(ctx.world.get<S>(id,'armored-supply')!.remaining>0)return {available:true,reason:''};
  const depot=selectedDepot(ctx,id),message=reason(ctx,id,depot)||(!transfer(ctx,id,depot!,false)?'No compatible supplies needed or depot stocks exhausted.':'');
  return {available:message==='',reason:message};
 }
 function command(ctx:C,input:LWArmoredRuntime.Command):LWArmoredRuntime.Result|null{
  if(input.kind!=='resupply')return null;
  const id=input.entityId!,ready=availability(ctx,id);if(!ready.available)return {ok:false,message:ready.reason};
  const s=ctx.world.get<S>(id,'armored-supply')!;
  if(s.remaining>0){cancel(ctx,id,s,'Resupply cancelled.');return {ok:true,message:'Resupply cancelled.'};}
  const depot=selectedDepot(ctx,id),message=reason(ctx,id,depot);
  if(message)return {ok:false,message};
  if(!transfer(ctx,id,depot!,false))return {ok:false,message:'No compatible supplies needed or depot stocks exhausted.'};
  s.depotId=depot!.id;s.remaining=depot!.transferSeconds;s.condition=condition(ctx.world.get<LWArmoredRuntime.Damage>(id,'armored-damage')!);
  ctx.emit({kind:'resupply-started',entityId:id,depotId:s.depotId,seconds:s.remaining});
  return {ok:true,message:'Receiving supplies. Movement, firing or damage interrupts service.'};
 }
 function register(scheduler:LWArmoredRuntime.Scheduler,ctx:C):void{
  if(ctx.solver!=='tracked-force-v2')return;
  scheduler.register({id:'armored.logistics',phase:'post',order:30,query:['armored-supply'],update(_world,id,dt){
   const s=ctx.world.get<S>(id,'armored-supply')!;if(s.remaining===0)return;
   const depot=ctx.mission.supplies?.find(d=>d.id===s.depotId),message=reason(ctx,id,depot);
   if(message){cancel(ctx,id,s,message);return;}
   if(s.condition!==condition(ctx.world.get<LWArmoredRuntime.Damage>(id,'armored-damage')!)){cancel(ctx,id,s,'Damage interrupted resupply.');return;}
   s.remaining=Math.max(0,s.remaining-dt);
   if(s.remaining<=1e-9){const depotId=s.depotId,amount=transfer(ctx,id,depot!,true);clear(s);
    ctx.emit({kind:amount?'resupply-completed':'resupply-cancelled',entityId:id,depotId,amount,message:amount?'Supplies transferred.':'Depot stocks were exhausted before service completed.'});}
  }});
 }
 root.LWArmoredLogistics=Object.freeze({register,command,availability});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWArmoredLogistics;
})(globalThis);
