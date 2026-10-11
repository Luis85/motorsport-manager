/** Deterministic v2 route planning and motor intent. No transforms or hidden contacts are mutated. */
declare namespace LWArmoredNavigationTypes {
 interface Api {
  path(ctx:LWArmoredRuntime.Context,id:string,goal:LWArmoredRuntime.Vec3):LWArmoredRuntime.Vec3[];
  move(ctx:LWArmoredRuntime.Context,id:string,goal:LWArmoredRuntime.Vec3,pace:number,stopDistance:number,dt:number):void;
 }
}
(function(input:unknown){
 'use strict';
 type C=LWArmoredRuntime.Context;type V=LWArmoredRuntime.Vec3;type T=LWArmoredRuntime.Transform;
 interface Block {x:number;z:number;hx:number;hz:number;bottom:number;top:number;}
 interface Field {ctx:C;spec:LWArmoredData.Vehicle;blocks:Block[];radius:number;maxX:number;maxZ:number;}
 const root=input as {LWArmoredNavigation?:LWArmoredNavigationTypes.Api;LWArmoredPhysics:LWArmoredRuntime.Physics};
 const distance=(a:V,b:V)=>Math.hypot(a.x-b.x,a.z-b.z);
 const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
 const wrap=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
 function field(ctx:C,id:string):Field{
  const own=ctx.world.get<LWArmoredRuntime.Identity>(id,'armored-identity')!;
  const spec=ctx.catalog.vehicles.find(v=>v.id===own.definition)!;
  const blocks:Block[]=ctx.mission.obstacles.filter(o=>!ctx.world.get('obstacle:'+o.id,'armored-obstacle')?.destroyed).map(o=>({x:o.position.x,z:o.position.z,hx:o.size.x/2,hz:o.size.z/2,bottom:o.position.y,top:o.position.y+o.size.y}));
  const perception=ctx.world.get<LWArmoredRuntime.Perception>(id,'armored-perception');
  for(const other of ctx.world.query(['armored-identity','armored-transform','armored-damage'])){
   if(other===id)continue;
   const identity=ctx.world.get<LWArmoredRuntime.Identity>(other,'armored-identity')!;
   // Allied positions are shared. Opponents only contribute detached observed contacts,
   // including between perception refreshes; neither live pose nor damage is consulted.
   if(identity.faction!==own.faction){
    const contact=perception?.contacts.find(c=>c.id===other);if(!contact)continue;
    const v=ctx.catalog.vehicles.find(v=>v.id===identity.definition)!,radius=Math.hypot(v.width,v.length)/2;
    blocks.push({x:contact.position.x,z:contact.position.z,hx:radius,hz:radius,bottom:contact.position.y-v.groundClearance,top:contact.position.y-v.groundClearance+v.height});
    continue;
   }
   const damage=ctx.world.get<LWArmoredRuntime.Damage>(other,'armored-damage')!;
   const body=ctx.world.get<LWArmoredRuntime.Body>(other,'armored-body');
   if(damage.status!=='destroyed'&&Math.hypot(body?.velocity.x||0,body?.velocity.z||0)>.5)continue;
   const t=ctx.world.get<T>(other,'armored-transform')!,v=ctx.catalog.vehicles.find(v=>v.id===identity.definition)!;
   const s=Math.abs(Math.sin(t.yaw)),c=Math.abs(Math.cos(t.yaw));
   blocks.push({x:t.position.x,z:t.position.z,hx:v.width/2*c+v.length/2*s,hz:v.width/2*s+v.length/2*c,bottom:t.position.y-v.groundClearance,top:t.position.y-v.groundClearance+v.height});
  }
  const terrain=ctx.mission.terrain;
  return {ctx,spec,blocks,radius:Math.hypot(spec.width,spec.length)/2+.2,maxX:(terrain.width-1)*terrain.cellSize,maxZ:(terrain.depth-1)*terrain.cellSize};
 }
 function height(f:Field,x:number,z:number):number{return root.LWArmoredPhysics.height(f.ctx.mission.terrain,x,z);}
 /** Continuous SAT over a translating rectangle, with terrain sampled at half-cell intervals.
  * Other hulls use conservative world AABBs; turns reserve the full hull diagonal. */
 function clear(f:Field,a:V,b:V,yaw=Math.atan2(b.x-a.x,b.z-a.z),turn=false,margin=.2):boolean{
  const sin=Math.sin(yaw),cos=Math.cos(yaw),hw=turn?f.radius:f.spec.width/2+margin,hl=turn?f.radius:f.spec.length/2+margin;
  const right={x:turn?1:cos,z:turn?0:-sin},forward={x:turn?0:sin,z:turn?1:cos};
  const rx=Math.abs(right.x)*hw+Math.abs(forward.x)*hl,rz=Math.abs(right.z)*hw+Math.abs(forward.z)*hl;
  if(Math.min(a.x,b.x)<rx||Math.max(a.x,b.x)>f.maxX-rx||Math.min(a.z,b.z)<rz||Math.max(a.z,b.z)>f.maxZ-rz)return false;
  const length=distance(a,b),steps=Math.max(1,Math.ceil(length/Math.min(2,f.ctx.mission.terrain.cellSize/2)));
  if(steps>512)return false;
  let low=Infinity,high=-Infinity,previous=height(f,a.x,a.z);
  for(let i=0;i<=steps;i++){
   const h=height(f,a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps);
   if(i&&Math.abs(Math.atan2(h-previous,length/steps))>f.spec.maxSlope)return false;
   low=Math.min(low,h);high=Math.max(high,h);previous=h;
  }
  for(const block of f.blocks){
   if(low>=block.top||high+f.spec.height<=block.bottom)continue;
   let enter=0,leave=1;
   for(const axis of [right,forward,{x:1,z:0},{x:0,z:1}]){
    const extent=Math.abs(right.x*axis.x+right.z*axis.z)*hw+Math.abs(forward.x*axis.x+forward.z*axis.z)*hl+Math.abs(axis.x)*block.hx+Math.abs(axis.z)*block.hz;
    const offset=(a.x-block.x)*axis.x+(a.z-block.z)*axis.z,speed=(b.x-a.x)*axis.x+(b.z-a.z)*axis.z;
    if(Math.abs(speed)<1e-9){if(Math.abs(offset)>=extent){enter=2;break;}continue;}
    const first=(-extent-offset)/speed,last=(extent-offset)/speed;
    enter=Math.max(enter,Math.min(first,last));leave=Math.min(leave,Math.max(first,last));
    if(enter>leave)break;
   }
   if(enter<=leave)return false;
  }
  return true;
 }
 function plan(f:Field,start:V,goal:V):V[]{
  if(clear(f,start,goal))return [{...goal,y:height(f,goal.x,goal.z)}];
  const cell=Math.max(3,f.spec.width),key=(x:number,z:number)=>x+','+z;
  // Anchor the lattice at the actual start; no unchecked first snapped-grid segment.
  const point=(x:number,z:number):V=>({x:start.x+x*cell,y:0,z:start.z+z*cell});
  const first=key(0,0),open=[first],cost=new Map([[first,0]]),parent=new Map<string,string>(),closed=new Set<string>();
  const coords=new Map<string,[number,number]>([[first,[0,0]]]);let end='';
  const score=(id:string)=>cost.get(id)!+distance(point(...coords.get(id)!),goal)/cell;
  for(let count=0;open.length&&count<2048;count++){
   open.sort((a,b)=>score(a)-score(b)||a.localeCompare(b));const current=open.shift()!,[x,z]=coords.get(current)!,from=point(x,z);
   if(distance(from,goal)<=cell*1.5&&clear(f,from,goal)){end=current;break;}
   closed.add(current);
   for(const [dx,dz] of [[0,1],[1,0],[0,-1],[-1,0]] as [number,number][]){
    const nx=x+dx,nz=z+dz,next=key(nx,nz),to=point(nx,nz);
    if(closed.has(next)||!clear(f,to,to,0,true)||!clear(f,from,to))continue;
    const nextCost=cost.get(current)!+1+Math.abs(height(f,to.x,to.z)-height(f,from.x,from.z))/cell;
    if(nextCost>=(cost.get(next)??Infinity))continue;
    cost.set(next,nextCost);coords.set(next,[nx,nz]);parent.set(next,current);if(!open.includes(next))open.push(next);
   }
  }
  if(!end)return [];
  const route:V[]=[{...goal,y:height(f,goal.x,goal.z)}];
  while(end!==first){const p=point(...coords.get(end)!);p.y=height(f,p.x,p.z);route.push(p);end=parent.get(end)!;}
  route.reverse();const result:V[]=[];let from=start,index=0;
  // Bounded greedy smoothing only skips edges after continuous clearance succeeds.
  while(index<route.length){let next=index;for(let candidate=index+1;candidate<Math.min(route.length,index+32);candidate++){if(clear(f,from,route[candidate]!))next=candidate;}
   from=route[next]!;result.push(from);index=next+1;}
  return result;
 }
 function path(ctx:C,id:string,goal:V):V[]{return plan(field(ctx,id),ctx.world.get<T>(id,'armored-transform')!.position,goal);}
 function move(ctx:C,id:string,goal:V,pace:number,stopDistance:number,dt:number):void{
  const order=ctx.world.get<LWArmoredRuntime.Order>(id,'armored-order')!,motor=ctx.world.get<LWArmoredRuntime.Motor>(id,'armored-motor')!;
  const t=ctx.world.get<T>(id,'armored-transform')!,body=ctx.world.get<LWArmoredRuntime.Body>(id,'armored-body')!;
  const speed=Math.hypot(body.velocity.x,body.velocity.z);motor.cruise=0;motor.throttle=0;motor.steer=0;motor.brake=1;
  if(distance(t.position,goal)<stopDistance){order.stuck=0;order.reason='On station';return;}
  const f=field(ctx,id),oldGoal=order.pathGoal as V|undefined;
  const reverse=order.reason==='Reverse escape';
  if(reverse){
   order.stuck=Number(order.stuck||0)+dt;
   const back={x:t.position.x-Math.sin(t.yaw)*2,y:t.position.y,z:t.position.z-Math.cos(t.yaw)*2};
   if(Number(order.stuck)>=3.5||!clear(f,t.position,back,t.yaw,false,0)){
    order.stuck=0;order.pathRevision=-1;order.reason='Replanning';return;
   }
   motor.throttle=-.45;motor.brake=0;order.reason='Reverse escape';return;
  }
  if(!Array.isArray(order.path)||!oldGoal||distance(goal,oldGoal)>6||Number(order.pathRevision)!==ctx.state.terrainRevision||ctx.state.tick%120===0){
   order.path=plan(f,t.position,goal);order.pathGoal={...goal};order.pathRevision=ctx.state.terrainRevision;order.cursor=0;
  }
  const route=order.path as V[];let cursor=Number(order.cursor||0);
  while(cursor<route.length-1&&distance(t.position,route[cursor]!)<1)cursor++;
  order.cursor=cursor;const waypoint=route[cursor];
  if(!waypoint){order.reason='No safe route';order.stuck=0;return;}
  const range=distance(t.position,waypoint),error=wrap(Math.atan2(waypoint.x-t.position.x,waypoint.z-t.position.z)-t.yaw);
  motor.steer=clamp(error*1.8-body.yawVelocity*.8,-1,1);
  const turning=Math.abs(error)>.3;
  // Stop translation before a sharp turn. Differential track forces own the pivot.
  motor.brake=turning&&speed>.4?1:0;
  motor.throttle=turning?0:pace*clamp(range/8,.18,1)*clamp(1-Math.abs(error),0,1);
  const ahead={x:t.position.x+Math.sin(t.yaw)*(1+speed*.6),y:t.position.y,z:t.position.z+Math.cos(t.yaw)*(1+speed*.6)};
  const safe=clear(f,t.position,ahead,t.yaw);
  if(!safe&&!turning){motor.throttle=0;motor.brake=1;if(ctx.state.tick%30===0)order.pathRevision=-1;}
  const stalled=speed<.25&&(!turning||Math.abs(body.yawVelocity)<.025);
  order.stuck=stalled?Number(order.stuck||0)+dt:0;
  order.reason=turning?'Aligning hull':safe?'Advancing':'Route obstructed';
  if(Number(order.stuck)>2){
   const back={x:t.position.x-Math.sin(t.yaw)*2,y:t.position.y,z:t.position.z-Math.cos(t.yaw)*2};
   if(clear(f,t.position,back,t.yaw,false,0)){order.stuck=2;order.reason='Reverse escape';motor.throttle=-.45;motor.steer=0;motor.brake=0;}
   else {order.stuck=0;order.pathRevision=-1;order.reason='No safe escape';}
  }
 }
 const api={path,move};root.LWArmoredNavigation=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
