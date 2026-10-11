/** Fixed muzzle ballistics and component damage. Armor equations are authored game approximations. */
(function(input:unknown){
 'use strict';
 const root=input as {LWArmoredCombat?:unknown;LWArmoredPhysics:LWArmoredRuntime.Physics};
 type C=LWArmoredRuntime.Context;type V=LWArmoredRuntime.Vec3;type T=LWArmoredRuntime.Transform;
 type W=LWArmoredRuntime.Weapon;type D=LWArmoredRuntime.Damage;type P=LWArmoredRuntime.Projectile;
 interface Hit {id:string;kind:'vehicle'|'obstacle'|'terrain';fraction:number;position:V;normal:V;local:V;}
 const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
 const wrap=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
 const magnitude=(v:V)=>Math.hypot(v.x,v.y,v.z);
 const mix=(a:V,b:V,t:number):V=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
 const direction=(yaw:number,elevation:number):V=>({x:Math.sin(yaw)*Math.cos(elevation),y:Math.sin(elevation),z:Math.cos(yaw)*Math.cos(elevation)});
 const definition=(ctx:C,id:string)=>ctx.catalog.vehicles.find(v=>v.id===ctx.world.get<LWArmoredRuntime.Identity>(id,'armored-identity')!.definition)!;
 const modern=(ctx:C)=>ctx.solver==='tracked-force-v2';
 // Aggregate status describes combat effectiveness; each station retains separate authority.
 const canMove=(d:D)=>d.status!=='destroyed'&&d.crew.driver!>0&&['engine','transmission','leftTrack','rightTrack'].every(key=>d.components[key]!>0);
 const canAim=(d:D)=>d.status!=='destroyed'&&d.crew.gunner!>0&&d.repair===0;
 const canFire=(d:D)=>canAim(d)&&d.components.gun!>0&&Object.values(d.crew).filter(value=>value>0).length>=2;
 function interruptServices(ctx:C,id:string,d:D):void{
  if(d.repair>0){d.repair=0;ctx.emit({kind:'repair-cancelled',entityId:id});}
  const supply=modern(ctx)?ctx.world.get<LWArmoredRuntime.Supply>(id,'armored-supply'):undefined;
  if(supply&&supply.remaining>0){
   supply.depotId='';supply.remaining=0;supply.condition='';
   ctx.emit({kind:'resupply-cancelled',entityId:id,message:'Combat interrupted resupply.'});
  }
 }
 function serviceStationary(ctx:C,id:string):boolean{
  const body=ctx.world.get<LWArmoredRuntime.Body>(id,'armored-body')!,motor=ctx.world.get<LWArmoredRuntime.Motor>(id,'armored-motor')!;
  return magnitude(body.velocity)<=.3&&Math.abs(body.yawVelocity)<=.03&&Math.abs(motor.throttle)<=.01&&Math.abs(motor.steer)<=.01&&motor.cruise===0;
 }
 function initialDamage(v:LWArmoredData.Vehicle):D{
  return {status:'operational',components:Object.fromEntries(['leftTrack','rightTrack','engine','transmission','turretDrive','mantlet','gun','ammunition'].map(k=>[k,v.componentHealth])),crew:{commander:1,gunner:1,driver:1,loader:1},fire:0,repair:0,repairKits:v.repairKits,componentMaximum:v.componentHealth};
 }
 function initialWeapon(v:LWArmoredData.Vehicle,_catalog:LWArmoredData.Catalog):W{
  const reserves:Record<string,number>={};
  v.ammunition.forEach((id,index)=>{reserves[id]=Math.floor(v.ammoCapacity/v.ammunition.length)+(index<v.ammoCapacity%v.ammunition.length?1:0);});
  return {turretYaw:0,elevation:0,aimYaw:0,aimElevation:0,reload:0,ammo:v.ammunition[0]!,reserves,trigger:false,recoil:0};
 }
 function local(point:V,transform:T):V{
  const x=point.x-transform.position.x,z=point.z-transform.position.z,c=Math.cos(transform.yaw),s=Math.sin(transform.yaw);
  return {x:c*x-s*z,y:point.y-transform.position.y,z:s*x+c*z};
 }
 /** Segment vs closed box, retaining the entry normal (including muzzle-inside-cover). */
 function box(from:V,to:V,min:V,max:V):{fraction:number;normal:V}|null{
  let near=0,far=1,normal:V={x:0,y:1,z:0};
  for(const axis of ['x','y','z'] as const){
   const delta=to[axis]-from[axis];
   if(Math.abs(delta)<1e-10){if(from[axis]<min[axis]||from[axis]>max[axis])return null;continue;}
   const a=(min[axis]-from[axis])/delta,b=(max[axis]-from[axis])/delta,entry=Math.min(a,b),exit=Math.max(a,b);
   if(entry>near){near=entry;normal={x:0,y:0,z:0};normal[axis]=delta>0?-1:1;}
   far=Math.min(far,exit);if(near>far)return null;
  }
  return near>=0&&near<=1?{fraction:near,normal}:null;
 }
 function trace(ctx:C,from:V,to:V,ignoreId='',vehicles=true):Hit|null{
  let best:Hit|null=null;
  const accept=(hit:Hit)=>{if(!best||hit.fraction<best.fraction)best=hit;};
  if(vehicles)for(const id of ctx.world.query(['armored-transform','armored-identity','armored-damage'])){
   if(id===ignoreId)continue;
   const t=ctx.world.get<T>(id,'armored-transform')!,v=definition(ctx,id),ground={...t,position:{...t.position,y:t.position.y-v.groundClearance}},a=local(from,ground),b=local(to,ground);
   const hit=box(a,b,{x:-v.width/2,y:0,z:-v.length/2},{x:v.width/2,y:v.height,z:v.length/2});
   if(hit){const c=Math.cos(t.yaw),s=Math.sin(t.yaw);accept({id,kind:'vehicle',fraction:hit.fraction,position:mix(from,to,hit.fraction),local:mix(a,b,hit.fraction),normal:{x:c*hit.normal.x+s*hit.normal.z,y:hit.normal.y,z:-s*hit.normal.x+c*hit.normal.z}});}
  }
  for(const obstacle of ctx.mission.obstacles){
   if(ctx.world.get('obstacle:'+obstacle.id,'armored-obstacle')?.destroyed)continue;
   const p=obstacle.position,s=obstacle.size;
   const hit=box(from,to,{x:p.x-s.x/2,y:p.y,z:p.z-s.z/2},{x:p.x+s.x/2,y:p.y+s.y,z:p.z+s.z/2});
   if(hit)accept({id:'obstacle:'+obstacle.id,kind:'obstacle',fraction:hit.fraction,position:mix(from,to,hit.fraction),normal:hit.normal,local:{x:0,y:0,z:0}});
  }
  const distance=magnitude({x:to.x-from.x,y:to.y-from.y,z:to.z-from.z}),steps=Math.max(1,Math.min(2048,Math.ceil(distance/.5)));
  let previous=0;
  for(let index=0;index<=steps;index++){
   const fraction=index/steps,p=mix(from,to,fraction);
   if(p.y<=root.LWArmoredPhysics.height(ctx.mission.terrain,p.x,p.z)){
    let low=previous,high=fraction;
    for(let n=0;n<10;n++){const middle=(low+high)/2,q=mix(from,to,middle);if(q.y<=root.LWArmoredPhysics.height(ctx.mission.terrain,q.x,q.z))high=middle;else low=middle;}
    accept({id:'terrain',kind:'terrain',fraction:high,position:mix(from,to,high),normal:{x:0,y:1,z:0},local:{x:0,y:0,z:0}});break;
   }
   previous=fraction;
  }
  return best;
 }
 function refresh(d:D):D['status']{
  if(d.status==='destroyed')return d.status;
  if(d.components.ammunition!<=0){d.status='destroyed';return d.status;}
  if(d.components.gun!<=0||d.crew.gunner!<=0||Object.values(d.crew).filter(n=>n>0).length<2)d.status='disabled';
  else if(d.components.engine!<=0||d.components.transmission!<=0||d.components.leftTrack!<=0||d.components.rightTrack!<=0||d.crew.driver!<=0)d.status='immobilized';
  else if(d.fire>0||Object.values(d.components).some(n=>n<Number(d.componentMaximum))||Object.values(d.crew).some(n=>n<=0))d.status='impaired';
  else d.status='operational';
  return d.status;
 }
 function damage(ctx:C,id:string,hit:Hit,shot:P,ammo:LWArmoredData.Ammunition):boolean{
  const d=ctx.world.get<D>(id,'armored-damage')!,v=definition(ctx,id),t=ctx.world.get<T>(id,'armored-transform')!;
  if(d.status==='destroyed')return false;
  const n=local({x:t.position.x+hit.normal.x,y:t.position.y+hit.normal.y,z:t.position.z+hit.normal.z},t);
  const region: keyof LWArmoredData.Armor=n.y>.5?'roof':n.z>.5?'front':n.z<-.5?'rear':'side';
  const speed=magnitude(shot.velocity),cosine=clamp(-(shot.velocity.x*hit.normal.x+shot.velocity.y*hit.normal.y+shot.velocity.z*hit.normal.z)/Math.max(.001,speed),.001,1);
  const angle=Math.acos(cosine),effective=v.armor[region]/cosine,penetration=ammo.penetration*Math.min(1,speed/ammo.velocity);
  const ricochet=ammo.kind==='AP'&&angle>=ammo.ricochetAngle&&Number(shot.ricochets||0)<1;
  let outcome=ricochet?'ricochet':penetration>=effective?'penetration':'non-penetration';
  let component='',amount=0;
  if(outcome==='penetration'){
   if(hit.local.y<v.height*.28&&Math.abs(hit.local.x)>v.width*.32)component=hit.local.x<0?'leftTrack':'rightTrack';
   else if(hit.local.y>v.height*.55)component=region==='front'?'mantlet':'turretDrive';
   else component=region==='rear'?'engine':region==='front'?'transmission':'ammunition';
   amount=ammo.damage*clamp((penetration-effective)/Math.max(1,penetration)+.3,.3,1);
   d.components[component]=Math.max(0,d.components[component]!-amount);
   if(component==='engine'&&d.components.engine===0)d.fire=1;
   const station=component==='transmission'?'driver':component==='turretDrive'?'gunner':component==='ammunition'?'loader':'';
   if(station&&d.components[component]!<=v.componentHealth*.3)d.crew[station]=0;
  }else if(ammo.kind==='HE'&&hit.local.y<v.height*.35){
   component=hit.local.x<0?'leftTrack':'rightTrack';amount=ammo.damage*.25;
   d.components[component]=Math.max(0,d.components[component]!-amount);
  }
  if(amount>0)interruptServices(ctx,id,d);
  refresh(d);
  ctx.emit({kind:'armor-impact',source:shot.source,target:id,position:hit.position,normal:hit.normal,ammo:ammo.id,region,outcome,angle,effectiveArmor:effective,penetration,component,damage:amount,status:d.status});
  if(refresh(d)==='destroyed')ctx.emit({kind:'destroyed',entityId:id,position:hit.position});
  if(ricochet){const dot=shot.velocity.x*hit.normal.x+shot.velocity.y*hit.normal.y+shot.velocity.z*hit.normal.z;for(const axis of ['x','y','z'] as const)shot.velocity[axis]=(shot.velocity[axis]-2*dot*hit.normal[axis])*.45;shot.ricochets=1;shot.position={x:hit.position.x+hit.normal.x*.06,y:hit.position.y+hit.normal.y*.06,z:hit.position.z+hit.normal.z*.06};}
  return ricochet;
 }
 /** HE fragments damage exposed tracks, not sealed crew or internal components.
  * One nearest hull point per actor; linear distance falloff and hard geometry occlusion.
  * Direct target is excluded: its armor resolution already owns the single direct hit. */
 function blast(ctx:C,shot:P,hit:Hit,ammo:LWArmoredData.Ammunition):void{
  if(ammo.kind!=='HE'||ammo.blastRadius<=0)return;
  const origin={x:hit.position.x+hit.normal.x*.06,y:hit.position.y+hit.normal.y*.06,z:hit.position.z+hit.normal.z*.06};
  for(const id of ctx.world.query(['armored-transform','armored-identity','armored-damage'])){
   if(id===hit.id)continue;
   const d=ctx.world.get<D>(id,'armored-damage')!;if(d.status==='destroyed')continue;
   const v=definition(ctx,id),t=ctx.world.get<T>(id,'armored-transform')!,ground={...t,position:{...t.position,y:t.position.y-v.groundClearance}},p=local(origin,ground);
   const q={x:clamp(p.x,-v.width/2,v.width/2),y:clamp(p.y,0,v.height),z:clamp(p.z,-v.length/2,v.length/2)};
   const range=magnitude({x:p.x-q.x,y:p.y-q.y,z:p.z-q.z});if(range>=ammo.blastRadius)continue;
   const c=Math.cos(t.yaw),s=Math.sin(t.yaw),point={x:ground.position.x+c*q.x+s*q.z,y:ground.position.y+q.y,z:ground.position.z-s*q.x+c*q.z};
   const obstruction=trace(ctx,origin,point);if(obstruction&&obstruction.id!==id)continue;
   const component=q.x<0?'leftTrack':'rightTrack',amount=ammo.damage*.25*(1-range/ammo.blastRadius);
   const applied=Math.min(d.components[component]!,amount);if(applied<=0)continue;
   d.components[component]=Math.max(0,d.components[component]!-applied);interruptServices(ctx,id,d);refresh(d);
   ctx.emit({kind:'blast-damage',source:shot.source,target:id,position:point,ammo:ammo.id,component,damage:applied,distance:range,status:d.status});
  }
 }
 function impact(ctx:C,shot:P,hit:Hit):boolean{
  const ammo=ctx.catalog.ammunition.find(a=>a.id===shot.ammo)!;
  // Resolve occlusion before direct destruction can remove the impact cover.
  if(modern(ctx))blast(ctx,shot,hit,ammo);
  if(ammo.kind==='SMOKE'){
   const id='smoke:'+String(++ctx.state.serial).padStart(6,'0');ctx.world.defer('create',id);ctx.world.defer('set',id,'armored-smoke',{position:hit.position,radius:ammo.blastRadius,remaining:ammo.smokeSeconds});
  }else if(hit.kind==='vehicle')return damage(ctx,hit.id,hit,shot,ammo);
  else if(hit.kind==='obstacle'){
   const obstacle=ctx.mission.obstacles.find(o=>'obstacle:'+o.id===hit.id)!,state=ctx.world.get(hit.id,'armored-obstacle');
   if(obstacle.destructible&&state&&!state.destroyed){state.health=Math.max(0,Number(state.health)-ammo.damage);if(state.health===0){state.destroyed=true;ctx.state.terrainRevision++;ctx.emit({kind:'obstacle-destroyed',source:shot.source,entityId:hit.id,position:hit.position,terrainRevision:ctx.state.terrainRevision});}}
  }
  ctx.emit({kind:'impact',source:shot.source,target:hit.id,position:hit.position,ammo:ammo.id,material:hit.kind});return false;
 }
 function weapons(ctx:C,id:string,dt:number):void{
  const w=ctx.world.get<W>(id,'armored-weapon')!,d=ctx.world.get<D>(id,'armored-damage')!,v=definition(ctx,id),t=ctx.world.get<T>(id,'armored-transform')!;
  w.reload=Math.max(0,w.reload-dt);w.recoil=Math.max(0,w.recoil-dt*2.8);
  if(d.status==='destroyed'){w.trigger=false;return;}
  if(modern(ctx)&&!canAim(d)){w.trigger=false;return;}
  const impaired=d.components.mantlet!/v.componentHealth,drive=d.components.turretDrive!/v.componentHealth;
  w.turretYaw=wrap(w.turretYaw+clamp(wrap(w.aimYaw-w.turretYaw),-v.turretSpeed*dt,v.turretSpeed*dt)*(.15+.85*Math.min(impaired,drive)));
  w.elevation=clamp(w.elevation+clamp(w.aimElevation-w.elevation,-v.elevationSpeed*dt,v.elevationSpeed*dt)*(.15+.85*impaired),v.minElevation,v.maxElevation);
  if(!w.trigger||w.reload>1e-9||w.reserves[w.ammo]!<=0||d.status==='disabled'||d.components.gun!<=0||d.crew.gunner!<=0||d.repair>0)return;
  if(ctx.world.query(['armored-projectile']).length+ctx.world.pendingStructural>1024)return;
  const ammo=ctx.catalog.ammunition.find(a=>a.id===w.ammo)!,spread=v.accuracy;
  const dir=direction(w.turretYaw+(ctx.random()-.5)*spread,w.elevation+(ctx.random()-.5)*spread);
  const base={x:t.position.x,y:t.position.y-v.groundClearance+v.muzzleHeight,z:t.position.z};
  const muzzle={x:base.x+dir.x*v.barrelLength,y:base.y+dir.y*v.barrelLength,z:base.z+dir.z*v.barrelLength};
  const shot:P={source:id,faction:ctx.world.get<LWArmoredRuntime.Identity>(id,'armored-identity')!.faction,ammo:ammo.id,position:muzzle,previous:{...muzzle},velocity:{x:dir.x*ammo.velocity,y:dir.y*ammo.velocity,z:dir.z*ammo.velocity},age:0,ricochets:0};
  w.reserves[w.ammo]=w.reserves[w.ammo]!-1;w.reload=v.reloadSeconds*(d.crew.loader!<=0?1.8:1);w.recoil=1;
  ctx.emit({kind:'shot',entityId:id,position:muzzle,velocity:shot.velocity,ammo:ammo.id});
  const blocked=trace(ctx,base,muzzle,id);
  if(blocked&&!impact(ctx,shot,blocked))return;
  const projectile='shell:'+String(++ctx.state.serial).padStart(6,'0');ctx.world.defer('create',projectile);ctx.world.defer('set',projectile,'armored-projectile',shot);
 }
 function projectiles(ctx:C,id:string,dt:number):void{
  const shot=ctx.world.get<P>(id,'armored-projectile')!,ammo=ctx.catalog.ammunition.find(a=>a.id===shot.ammo)!;
  shot.previous={...shot.position};shot.age+=dt;
  const next={x:shot.position.x+shot.velocity.x*dt,y:shot.position.y+shot.velocity.y*dt-4.905*dt*dt,z:shot.position.z+shot.velocity.z*dt};
  const hit=trace(ctx,shot.position,next,shot.source);
  shot.velocity.y-=9.81*dt;
  const drag=Math.max(0,1-ammo.drag*dt);shot.velocity.x*=drag;shot.velocity.y*=drag;shot.velocity.z*=drag;
  if(hit){if(!impact(ctx,shot,hit))ctx.world.defer('destroy',id);return;}
  shot.position=next;
  if(shot.age>30||magnitude(shot.velocity)<1)ctx.world.defer('destroy',id);
 }
 function repairReason(ctx:C,id:string):string{
  const d=ctx.world.get<D>(id,'armored-damage')!;
  if(d.status==='destroyed')return 'Vehicle unavailable.';
  const v=definition(ctx,id),body=ctx.world.get<LWArmoredRuntime.Body>(id,'armored-body')!;
  if(modern(ctx)&&Number(ctx.world.get(id,'armored-supply')?.remaining)>0)return 'Finish or cancel resupply before repairing.';
  if(modern(ctx)&&(!serviceStationary(ctx,id)||!Object.values(d.crew).some(value=>value>0)))return 'Repair needs a living crew, neutral drive controls and no hull motion.';
  if(d.repair>0||Number(d.repairKits)<=0||magnitude(body.velocity)>.3)return 'Repair needs a stationary vehicle and an available kit.';
  if(d.fire===0&&!Object.values(d.components).some(n=>n<v.componentHealth))return 'No repairable damage.';
  return '';
 }
 /** Read-only readiness uses the same station and service rules as execution. */
 function availability(ctx:C,id:string):Pick<LWArmoredRuntime.VehicleActions,'aim'|'fire'|'repair'>{
  const d=ctx.world.get<D>(id,'armored-damage')!,w=ctx.world.get<W>(id,'armored-weapon')!;
  const action=(reason:string)=>({available:reason==='',reason});
  const aim=d.status==='destroyed'?'Vehicle unavailable.':modern(ctx)&&!canAim(d)?'Aiming requires an available gunner outside repair.':'';
  const fire=aim||d.status==='disabled'||d.components.gun!<=0||d.crew.gunner!<=0||d.repair>0||modern(ctx)&&!canFire(d)
   ?aim||'Gun or crew unavailable while repairing or combat-disabled.'
   :w.reload>1e-9?'Reloading.':w.reserves[w.ammo]!<=0?'Selected ammunition exhausted.':ctx.world.query(['armored-projectile']).length+ctx.world.pendingStructural>=1024?'Projectile capacity reached.':'';
  return {aim:action(aim),fire:action(fire),repair:action(repairReason(ctx,id))};
 }
 function command(ctx:C,input:LWArmoredRuntime.Command):LWArmoredRuntime.Result|null{
  if(!['aim','ammo','fire','repair'].includes(input.kind))return null;
  const id=input.entityId||ctx.state.controlled,w=ctx.world.get<W>(id,'armored-weapon'),d=ctx.world.get<D>(id,'armored-damage');
  if(!w||!d||d.status==='destroyed')return {ok:false,message:'Vehicle unavailable.'};
  if(input.kind==='aim'){
   if(modern(ctx)&&!canAim(d))return {ok:false,message:'Aiming requires an available gunner outside repair.'};
   const v=definition(ctx,id);
   if(typeof input.yaw!=='number'||!Number.isFinite(input.yaw)||Math.abs(input.yaw)>Math.PI*2||typeof input.elevation!=='number'||!Number.isFinite(input.elevation)||input.elevation<v.minElevation||input.elevation>v.maxElevation)return {ok:false,message:'Aim outside weapon limits.'};
   w.aimYaw=wrap(input.yaw);w.aimElevation=input.elevation;return {ok:true,message:'Aim accepted.'};
  }
  if(input.kind==='ammo'){
   if(typeof input.ammo!=='string'||!definition(ctx,id).ammunition.includes(input.ammo))return {ok:false,message:'Unsupported ammunition.'};
   if(w.reload>0)return {ok:false,message:'Wait for the current reload.'};
   w.ammo=input.ammo;return {ok:true,message:'Ammunition selected.'};
  }
  if(input.kind==='fire'){
   if(typeof input.pressed!=='boolean')return {ok:false,message:'Fire requires a pressed flag.'};
   if(modern(ctx)&&input.pressed&&!canFire(d))return {ok:false,message:'Gun or crew unavailable while repairing or combat-disabled.'};
   w.trigger=input.pressed;return {ok:true,message:'Trigger updated.'};
  }
  const v=definition(ctx,id),reason=repairReason(ctx,id);if(reason)return {ok:false,message:reason};
  d.repair=v.repairSeconds;w.trigger=false;ctx.emit({kind:'repair-started',entityId:id,seconds:d.repair});return {ok:true,message:'Repair started; moving or taking damage interrupts it.'};
 }
 function service(ctx:C,id:string,dt:number):void{
  const d=ctx.world.get<D>(id,'armored-damage')!,v=definition(ctx,id);
  if(d.status==='destroyed'){if(modern(ctx))interruptServices(ctx,id,d);return;}
  if(d.repair>0){
   const body=ctx.world.get<LWArmoredRuntime.Body>(id,'armored-body')!,motor=ctx.world.get<LWArmoredRuntime.Motor>(id,'armored-motor')!;
   if(modern(ctx)?!serviceStationary(ctx,id)||!Object.values(d.crew).some(value=>value>0):magnitude(body.velocity)>.3||Math.abs(motor.throttle)>.01)interruptServices(ctx,id,d);
   else {d.repair=Math.max(0,d.repair-dt);if(d.repair<=1e-9){d.repair=0;d.repairKits=Number(d.repairKits)-1;for(const key of Object.keys(d.components))d.components[key]=Math.min(v.componentHealth,d.components[key]!+v.componentHealth*v.repairRate);d.fire=0;refresh(d);ctx.emit({kind:'repair-completed',entityId:id});}}
  }
  if(d.fire>0){
   d.components.engine=Math.max(0,d.components.engine!-dt*v.componentHealth*.025);d.components.ammunition=Math.max(0,d.components.ammunition!-dt*v.componentHealth*.01);refresh(d);
   if(refresh(d)==='destroyed'){if(modern(ctx))interruptServices(ctx,id,d);ctx.emit({kind:'destroyed',entityId:id});}
  }
 }
 function register(scheduler:LWArmoredRuntime.Scheduler,ctx:C):void{
  scheduler.register({id:'armored.weapons',phase:'simulate',order:20,query:['armored-weapon','armored-damage','armored-transform'],update(_world,id,dt){weapons(ctx,id,dt);}});
  scheduler.register({id:'armored.projectiles',phase:'simulate',order:30,query:['armored-projectile'],update(_world,id,dt){projectiles(ctx,id,dt);}});
  scheduler.register({id:'armored.repairs',phase:'post',order:20,query:['armored-damage'],update(_world,id,dt){service(ctx,id,dt);}});
  scheduler.register({id:'armored.smoke',phase:'post',order:30,query:['armored-smoke'],update(world,id,dt){const smoke=world.get(id,'armored-smoke')!;smoke.remaining=Number(smoke.remaining)-dt;if(Number(smoke.remaining)<=0)world.defer('destroy',id);}});
 }
 root.LWArmoredCombat=Object.freeze({register,command,initialDamage,initialWeapon,trace,box,refresh,canMove,canAim,canFire,availability});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWArmoredCombat;
})(globalThis);
