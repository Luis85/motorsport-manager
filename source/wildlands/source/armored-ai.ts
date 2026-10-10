/** Perception, contact memory and bounded navigation feed the same motor and weapon inputs as the player. */
(function(input:unknown){
 'use strict';
 type C=LWArmoredRuntime.Context;type V=LWArmoredRuntime.Vec3;type T=LWArmoredRuntime.Transform;
 type Perception=LWArmoredRuntime.Perception;type Order=LWArmoredRuntime.Order;
 const root=input as {LWArmoredAI?:unknown;LWArmoredPhysics:LWArmoredRuntime.Physics;LWArmoredCombat:{trace(ctx:C,from:V,to:V,ignoreId?:string,vehicles?:boolean):{id:string;fraction:number}|null}};
 const distance=(a:V,b:V)=>Math.hypot(a.x-b.x,a.z-b.z);
 const wrap=(value:number)=>Math.atan2(Math.sin(value),Math.cos(value));
 const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
 const vehicle=(ctx:C,id:string)=>ctx.catalog.vehicles.find(v=>v.id===ctx.world.get<LWArmoredRuntime.Identity>(id,'armored-identity')!.definition)!;
 function smokeObscures(ctx:C,from:V,to:V):boolean{
  const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,length=dx*dx+dy*dy+dz*dz;
  for(const id of ctx.world.query(['armored-smoke'])){
   const smoke=ctx.world.get(id,'armored-smoke')!,p=smoke.position as V;
   const t=clamp(((p.x-from.x)*dx+(p.y-from.y)*dy+(p.z-from.z)*dz)/Math.max(.001,length),0,1);
   if(Math.hypot(from.x+dx*t-p.x,from.y+dy*t-p.y,from.z+dz*t-p.z)<Number(smoke.radius))return true;
  }
  return false;
 }
 function visible(ctx:C,observer:string,target:string):boolean{
  const a=ctx.world.get<T>(observer,'armored-transform'),b=ctx.world.get<T>(target,'armored-transform');
  if(!a||!b)return false;
  const va=vehicle(ctx,observer),vb=vehicle(ctx,target);
  if(distance(a.position,b.position)>va.sightRange)return false;
  const from={x:a.position.x,y:a.position.y-va.groundClearance+va.height*.88,z:a.position.z};
  const to={x:b.position.x,y:b.position.y-vb.groundClearance+vb.height*.6,z:b.position.z};
  if(smokeObscures(ctx,from,to))return false;
  const hit=root.LWArmoredCombat.trace(ctx,from,to,observer);
  return !hit||hit.id===target;
 }
 function perception(ctx:C,id:string,dt:number):void{
  const p=ctx.world.get<Perception>(id,'armored-perception')!,own=ctx.world.get<LWArmoredRuntime.Identity>(id,'armored-identity')!;
  if(ctx.state.tick%6===0){
   const seen:string[]=[],position=ctx.world.get<T>(id,'armored-transform')!.position;
   for(const target of ctx.world.query(['armored-identity','armored-transform','armored-damage'])){
    if(target===id||ctx.world.get<LWArmoredRuntime.Identity>(target,'armored-identity')!.faction===own.faction||ctx.world.get<LWArmoredRuntime.Damage>(target,'armored-damage')!.status==='destroyed')continue;
    if(!visible(ctx,id,target))continue;
    seen.push(target);
    const contact={id:target,position:{...ctx.world.get<T>(target,'armored-transform')!.position},tick:ctx.state.tick},existing=p.contacts.find(c=>c.id===target);
    if(existing)Object.assign(existing,contact);else p.contacts.push(contact);
   }
   p.contacts=p.contacts.filter(c=>ctx.state.tick-c.tick<=180);
   seen.sort((a,b)=>distance(position,ctx.world.get<T>(a,'armored-transform')!.position)-distance(position,ctx.world.get<T>(b,'armored-transform')!.position)||a.localeCompare(b));
   const target=seen.includes(p.targetId)?p.targetId:seen[0]||'';
   if(target!==p.targetId){p.targetId=target;p.acquired=0;}
   p.visible=seen;
  }
  if(p.targetId)p.acquired+=dt;else p.acquired=0;
 }
 function blocked(ctx:C,x:number,z:number,radius:number,ignore:string):boolean{
  const terrain=ctx.mission.terrain;
  if(x<radius||z<radius||x>(terrain.width-1)*terrain.cellSize-radius||z>(terrain.depth-1)*terrain.cellSize-radius)return true;
  for(const o of ctx.mission.obstacles){
   if(ctx.world.get('obstacle:'+o.id,'armored-obstacle')?.destroyed)continue;
   if(Math.abs(x-o.position.x)<o.size.x/2+radius&&Math.abs(z-o.position.z)<o.size.z/2+radius)return true;
  }
  for(const id of ctx.world.query(['armored-damage','armored-transform'])){
   if(id===ignore||ctx.world.get<LWArmoredRuntime.Damage>(id,'armored-damage')!.status!=='destroyed')continue;
   const p=ctx.world.get<T>(id,'armored-transform')!.position;
   if(Math.hypot(x-p.x,z-p.z)<vehicle(ctx,id).length*.5+radius)return true;
  }
  return false;
 }
 /** A* is bounded and conservative about hull width; motor integration still owns all transforms. */
 function path(ctx:C,id:string,goal:V):V[]{
  const v=vehicle(ctx,id),start=ctx.world.get<T>(id,'armored-transform')!.position,cell=Math.max(3,v.width*1.3),radius=v.width*.55;
  const key=(x:number,z:number)=>x+','+z,sx=Math.round(start.x/cell),sz=Math.round(start.z/cell),gx=Math.round(goal.x/cell),gz=Math.round(goal.z/cell);
  const first=key(sx,sz),last=key(gx,gz),open=[first],cost=new Map([[first,0]]),parent=new Map<string,string>(),closed=new Set<string>();
  const coords=(value:string)=>value.split(',').map(Number) as [number,number];
  let end='';
  for(let count=0;open.length&&count<2048;count++){
   open.sort((a,b)=>{const aa=coords(a),bb=coords(b);return (cost.get(a)!+Math.hypot(aa[0]-gx,aa[1]-gz))-(cost.get(b)!+Math.hypot(bb[0]-gx,bb[1]-gz))||a.localeCompare(b);});
   const current=open.shift()!;
   if(current===last){end=current;break;}
   closed.add(current);const [x,z]=coords(current);
   for(const [dx,dz] of [[0,1],[1,0],[0,-1],[-1,0]] as [number,number][]){
    const nx=x+dx,nz=z+dz,next=key(nx,nz);if(closed.has(next)||blocked(ctx,nx*cell,nz*cell,radius,id))continue;
    const elevation=root.LWArmoredPhysics.height(ctx.mission.terrain,nx*cell,nz*cell)-root.LWArmoredPhysics.height(ctx.mission.terrain,x*cell,z*cell);
    if(Math.abs(Math.atan2(elevation,cell))>v.maxSlope)continue;
    const nextCost=cost.get(current)!+1+Math.abs(elevation)/cell;
    if(nextCost>=(cost.get(next)??Infinity))continue;
    cost.set(next,nextCost);parent.set(next,current);if(!open.includes(next))open.push(next);
   }
  }
  if(!end)return [];
  const result:V[]=[];
  while(end!==first){const [x,z]=coords(end);result.push({x:x*cell,y:root.LWArmoredPhysics.height(ctx.mission.terrain,x*cell,z*cell),z:z*cell});end=parent.get(end)!;}
  result.reverse();if(!blocked(ctx,goal.x,goal.z,radius,id))result.push({...goal});return result;
 }
 function move(ctx:C,id:string,goal:V,pace:number,stopDistance:number):void{
  const order=ctx.world.get<Order>(id,'armored-order')!,motor=ctx.world.get<LWArmoredRuntime.Motor>(id,'armored-motor')!,t=ctx.world.get<T>(id,'armored-transform')!;
  motor.cruise=0;
  if(distance(t.position,goal)<stopDistance){motor.throttle=0;motor.steer=0;motor.brake=1;order.stuck=0;order.reason='On station';return;}
  const oldGoal=order.pathGoal as V|undefined;
  if(!Array.isArray(order.path)||!oldGoal||distance(goal,oldGoal)>6||Number(order.pathRevision)!==ctx.state.terrainRevision||ctx.state.tick%120===0){
   order.path=path(ctx,id,goal);order.pathGoal={...goal};order.pathRevision=ctx.state.terrainRevision;order.cursor=0;
  }
  const route=order.path as V[];let cursor=Number(order.cursor||0);
  while(cursor<route.length-1&&distance(t.position,route[cursor]!)<3)cursor++;
  order.cursor=cursor;
  const waypoint=route[cursor];
  if(!waypoint){motor.throttle=0;motor.steer=0;motor.brake=1;order.reason='No safe route';return;}
  const error=wrap(Math.atan2(waypoint.x-t.position.x,waypoint.z-t.position.z)-t.yaw);
  motor.steer=clamp(error*1.6,-1,1);motor.brake=0;motor.throttle=pace*clamp(1-Math.abs(error)/1.8,.12,1);
  const body=ctx.world.get<LWArmoredRuntime.Body>(id,'armored-body')!;
  order.stuck=Math.hypot(body.velocity.x,body.velocity.z)<.25?Number(order.stuck||0)+1/60:0;
  if(Number(order.stuck)>2){motor.throttle=-.45;motor.steer=error>=0?-1:1;order.reason='Reverse escape';if(Number(order.stuck)>3.5){order.stuck=0;order.pathRevision=-1;}}
  else order.reason='Advancing';
 }
 function drive(ctx:C,id:string):void{
  if(id===ctx.state.controlled)return;
  const damage=ctx.world.get<LWArmoredRuntime.Damage>(id,'armored-damage')!,motor=ctx.world.get<LWArmoredRuntime.Motor>(id,'armored-motor')!,w=ctx.world.get<LWArmoredRuntime.Weapon>(id,'armored-weapon')!;
  const order=ctx.world.get<Order>(id,'armored-order')!,p=ctx.world.get<Perception>(id,'armored-perception')!,t=ctx.world.get<T>(id,'armored-transform')!,v=vehicle(ctx,id);
  motor.throttle=0;motor.steer=0;motor.brake=1;motor.cruise=0;w.trigger=false;
  if(damage.status==='destroyed'||damage.repair>0)return;
  let enemy:V|null=null;
  if(p.targetId&&(p.visible as string[]||[]).includes(p.targetId)&&visible(ctx,id,p.targetId)){
   const target=ctx.world.get<T>(p.targetId,'armored-transform');
   if(target){
    enemy=target.position;const targetVehicle=vehicle(ctx,p.targetId),height=targetVehicle.height*.5+enemy.y-targetVehicle.groundClearance-t.position.y+v.groundClearance-v.muzzleHeight,range=distance(t.position,enemy);
    const ammo=ctx.catalog.ammunition.find(a=>a.id===w.ammo)!;
    w.aimYaw=Math.atan2(enemy.x-t.position.x,enemy.z-t.position.z);
    w.aimElevation=clamp(Math.atan2(height+4.905*Math.pow(range/ammo.velocity,2),range),v.minElevation,v.maxElevation);
    const settled=Math.abs(wrap(w.aimYaw-w.turretYaw))<.025&&Math.abs(w.aimElevation-w.elevation)<.018;
    w.trigger=p.acquired>=v.aimSeconds&&settled;
   }
  }
  if(['immobilized','disabled'].includes(damage.status))return;
  if(order.kind==='hold'){order.reason='Holding';return;}
  if(order.kind==='follow'){
   const leader=ctx.world.get<T>(order.targetId||ctx.state.controlled,'armored-transform');if(!leader||order.targetId===id)return;
   const own=ctx.world.get<LWArmoredRuntime.Identity>(id,'armored-identity')!.faction;
   const followers=ctx.world.query(['armored-order','armored-identity']).filter(actor=>{const other=ctx.world.get<Order>(actor,'armored-order')!;return actor!==ctx.state.controlled&&ctx.world.get<LWArmoredRuntime.Identity>(actor,'armored-identity')!.faction===own&&other.kind==='follow'&&other.targetId===order.targetId;});
   const slot=followers.indexOf(id),back=12+Math.floor(slot/2)*10,side=(slot%2?1:-1)*7;
   const goal={x:leader.position.x-Math.sin(leader.yaw)*back+Math.cos(leader.yaw)*side,y:leader.position.y,z:leader.position.z-Math.cos(leader.yaw)*back-Math.sin(leader.yaw)*side};
   move(ctx,id,goal,.7,5);return;
  }
  if(order.kind==='secure'&&enemy){order.reason='Clearing observed contact';return;}
  move(ctx,id,order.position,order.kind==='charge'?.9:.42,6);
 }
 function command(ctx:C,input:LWArmoredRuntime.Command):LWArmoredRuntime.Result|null{
  if(input.kind!=='order')return null;
  if(!['hold','follow','charge','secure'].includes(String(input.order)))return {ok:false,message:'Unknown platoon order.'};
  const ids=input.entityIds||[input.entityId||ctx.state.controlled],terrain=ctx.mission.terrain;
  if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!ctx.world.has(id,'armored-order','armored-transform','armored-motor')))return {ok:false,message:'Choose available order recipients.'};
  let position=input.position;
  if(['charge','secure'].includes(input.order!)){
   if(!position||!['x','y','z'].every(axis=>typeof position![axis as keyof V]==='number'&&Number.isFinite(position![axis as keyof V]))||position.x<0||position.z<0||position.x>(terrain.width-1)*terrain.cellSize||position.z>(terrain.depth-1)*terrain.cellSize)return {ok:false,message:'Choose a destination inside the battlefield.'};
  }
  const leader=input.targetId||ctx.state.controlled;
  if(input.order==='follow'){
   const identity=ctx.world.get<LWArmoredRuntime.Identity>(leader,'armored-identity');
   if(!identity||ctx.world.get<LWArmoredRuntime.Damage>(leader,'armored-damage')?.status==='destroyed'||ids.some(id=>id===leader||ctx.world.get<LWArmoredRuntime.Identity>(id,'armored-identity')!.faction!==identity.faction))return {ok:false,message:'Follow requires a different allied leader.'};
  }
  for(const id of ids){
   const order=ctx.world.get<Order>(id,'armored-order')!,motor=ctx.world.get<LWArmoredRuntime.Motor>(id,'armored-motor')!;
   Object.assign(order,{kind:input.order,targetId:input.order==='follow'?leader:'',position:{...(position||ctx.world.get<T>(id,'armored-transform')!.position)},path:[],pathRevision:-1,cursor:0,stuck:0,reason:'Order accepted'});
   motor.throttle=0;motor.steer=0;motor.brake=1;motor.cruise=0;
   ctx.emit({kind:'order',entityId:id,order:input.order,position:order.position,targetId:order.targetId});
  }
  return {ok:true,message:'Platoon order replaced.'};
 }
 function register(scheduler:LWArmoredRuntime.Scheduler,ctx:C):void{
  scheduler.register({id:'armored.perception',phase:'pre',order:5,query:['armored-perception','armored-identity','armored-transform'],update(world,id,dt){if(world.get<LWArmoredRuntime.Damage>(id,'armored-damage')?.status!=='destroyed')perception(ctx,id,dt);}});
  scheduler.register({id:'armored.ai',phase:'pre',order:10,query:['armored-perception','armored-order','armored-motor'],update(_world,id){drive(ctx,id);}});
 }
 root.LWArmoredAI=Object.freeze({register,command,visible,smokeObscures,path});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWArmoredAI;
})(globalThis);
