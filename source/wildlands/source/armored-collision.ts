/** Yaw-oriented hull contacts for the terrain-supported tracked adapter.
 * Translation uses continuous SAT; angular travel is conservatively enclosed between
 * bounded subdivisions. This is not a rigid-body manifold or suspension solver. */
declare namespace LWArmoredCollisionTypes {
 interface Api {move(ctx:LWArmoredRuntime.Context,id:string,transform:LWArmoredRuntime.Transform,body:LWArmoredRuntime.Body,spec:LWArmoredData.Vehicle,dt:number):void;}
}
(function(input:unknown){
 'use strict';
 type C=LWArmoredRuntime.Context;type T=LWArmoredRuntime.Transform;type B=LWArmoredRuntime.Body;
 type V=LWArmoredData.Vehicle;
 interface Axis {x:number;z:number;}
 interface Box {x:number;z:number;right:Axis;forward:Axis;halfWidth:number;halfLength:number;bottom:number;top:number;}
 interface Contact {time:number;normal:Axis;depth:number;}
 const root=input as {LWArmoredCollision?:LWArmoredCollisionTypes.Api};
 const EPS=1e-8,SKIN=1e-6,MAX_STEPS=64,ANGLE_STEP=.025;
 const dot=(a:Axis,b:Axis)=>a.x*b.x+a.z*b.z;
 function hull(t:T,v:V,yaw=t.yaw):Box{
  const sin=Math.sin(yaw),cos=Math.cos(yaw),bottom=t.position.y-v.groundClearance;
  return {x:t.position.x,z:t.position.z,right:{x:cos,z:-sin},forward:{x:sin,z:cos},halfWidth:v.width/2,halfLength:v.length/2,bottom,top:bottom+v.height};
 }
 function radius(box:Box,axis:Axis):number{return Math.abs(dot(box.right,axis))*box.halfWidth+Math.abs(dot(box.forward,axis))*box.halfLength;}
 function boxes(ctx:C,id:string):Box[]{
  const result:Box[]=[];
  for(const o of ctx.mission.obstacles){
   if(ctx.world.get('obstacle:'+o.id,'armored-obstacle')?.destroyed)continue;
   result.push({x:o.position.x,z:o.position.z,right:{x:1,z:0},forward:{x:0,z:1},halfWidth:o.size.x/2,halfLength:o.size.z/2,bottom:o.position.y,top:o.position.y+o.size.y});
  }
  for(const other of ctx.world.query(['armored-transform','armored-identity'])){
   if(other===id)continue;
   const t=ctx.world.get<T>(other,'armored-transform')!;
   const identity=ctx.world.get<LWArmoredRuntime.Identity>(other,'armored-identity')!;
   result.push(hull(t,ctx.catalog.vehicles.find(v=>v.id===identity.definition)!));
  }
  return result;
 }
 function vertical(a:Box,b:Box):boolean{return a.bottom<b.top-EPS&&a.top>b.bottom+EPS;}
 function overlap(a:Box,b:Box,padding=0):Contact|null{
  if(!vertical(a,b))return null;
  let depth=Infinity,normal={x:0,z:0};
  for(const axis of [a.right,a.forward,b.right,b.forward]){
   const distance=(a.x-b.x)*axis.x+(a.z-b.z)*axis.z;
   const penetration=radius(a,axis)+radius(b,axis)+padding-Math.abs(distance);
   if(penetration<=EPS)return null;
   if(penetration<depth){depth=penetration;const sign=distance<0?-1:1;normal={x:axis.x*sign,z:axis.z*sign};}
  }
  return {time:0,normal,depth};
 }
 function sweep(a:Box,b:Box,delta:Axis):Contact|null{
  if(!vertical(a,b))return null;
  let enter=-Infinity,leave=Infinity,normal={x:0,z:0};
  for(const axis of [a.right,a.forward,b.right,b.forward]){
   const distance=(a.x-b.x)*axis.x+(a.z-b.z)*axis.z,speed=dot(delta,axis);
   const extent=radius(a,axis)+radius(b,axis);
   if(Math.abs(speed)<EPS){if(Math.abs(distance)>=extent-EPS)return null;continue;}
   const first=(-extent-distance)/speed,last=(extent-distance)/speed;
   const near=Math.min(first,last),far=Math.max(first,last);
   if(near>enter){enter=near;normal={x:axis.x*(speed>0?-1:1),z:axis.z*(speed>0?-1:1)};}
   leave=Math.min(leave,far);if(enter>leave)return null;
  }
  if(enter< -EPS||enter>1||leave<0)return null;
  return {time:Math.max(0,enter),normal,depth:0};
 }
 function stop(body:B,normal:Axis):void{
  const speed=body.velocity.x*normal.x+body.velocity.z*normal.z;
  if(speed<0){body.velocity.x-=speed*normal.x;body.velocity.z-=speed*normal.z;}
 }
 function bounds(ctx:C,box:Box):{minX:number;maxX:number;minZ:number;maxZ:number}{
  const x=radius(box,{x:1,z:0}),z=radius(box,{x:0,z:1}),terrain=ctx.mission.terrain;
  return {minX:x,maxX:(terrain.width-1)*terrain.cellSize-x,minZ:z,maxZ:(terrain.depth-1)*terrain.cellSize-z};
 }
 function contain(ctx:C,t:T,b:B,v:V):void{
  const bound=bounds(ctx,hull(t,v));
  for(const axis of ['x','z'] as const){
   const min=axis==='x'?bound.minX:bound.minZ,max=axis==='x'?bound.maxX:bound.maxZ;
   const before=t.position[axis],after=min>max?(min+max)/2:Math.max(min,Math.min(max,before));
   if(before!==after){t.position[axis]=after;if(b.velocity[axis]*(before-after)>0)b.velocity[axis]=0;}
  }
 }
 function separate(ctx:C,t:T,b:B,v:V,others:Box[]):boolean{
  contain(ctx,t,b,v);
  for(let iteration=0;iteration<8;iteration++){
   let changed=false;
   for(const other of others){
    const hit=overlap(hull(t,v),other);if(!hit)continue;
    t.position.x+=hit.normal.x*(hit.depth+SKIN);t.position.z+=hit.normal.z*(hit.depth+SKIN);
    stop(b,hit.normal);changed=true;
   }
   contain(ctx,t,b,v);if(!changed)break;
  }
  if(others.some(other=>overlap(hull(t,v),other)!==null)){
   // An infeasible authored overlap must not become a path through solid geometry.
   b.velocity.x=0;b.velocity.z=0;b.yawVelocity=0;return false;
  }
  return true;
 }
 function rotate(ctx:C,t:T,b:B,v:V,others:Box[],angle:number):void{
  if(angle===0)return;
  const middle=hull(t,v,t.yaw+angle/2),padding=Math.hypot(v.width,v.length)/2*Math.abs(angle)/2;
  const bound=bounds(ctx,middle);
  const blocked=middle.x<bound.minX+padding||middle.x>bound.maxX-padding||middle.z<bound.minZ+padding||middle.z>bound.maxZ-padding||others.some(other=>overlap(middle,other,padding)!==null);
  if(blocked){b.yawVelocity=0;return;}
  t.yaw=Math.atan2(Math.sin(t.yaw+angle),Math.cos(t.yaw+angle));
 }
 function translate(ctx:C,t:T,b:B,v:V,others:Box[],dt:number):void{
  let delta={x:b.velocity.x*dt,z:b.velocity.z*dt};
  for(let contact=0;contact<4;contact++){
   const box=hull(t,v),bound=bounds(ctx,box);
   let hit:Contact|null=null;
   for(const other of others){const candidate=sweep(box,other,delta);if(candidate&&(!hit||candidate.time<hit.time))hit=candidate;}
   for(const [distance,speed,normal] of [
    [bound.minX-box.x,delta.x,{x:1,z:0}],[bound.maxX-box.x,delta.x,{x:-1,z:0}],
    [bound.minZ-box.z,delta.z,{x:0,z:1}],[bound.maxZ-box.z,delta.z,{x:0,z:-1}]
   ] as [number,number,Axis][]){
    if(speed===0||dot(delta,normal)>=0)continue;
    const time=distance/speed;if(time>=-EPS&&time<=1&&(!hit||time<hit.time))hit={time:Math.max(0,time),normal,depth:0};
   }
   if(!hit){t.position.x+=delta.x;t.position.z+=delta.z;return;}
   const travel=Math.max(0,hit.time-SKIN/Math.max(EPS,Math.hypot(delta.x,delta.z)));
   t.position.x+=delta.x*travel;t.position.z+=delta.z*travel;
   stop(b,hit.normal);
   delta={x:delta.x*(1-hit.time),z:delta.z*(1-hit.time)};
   const toward=dot(delta,hit.normal);if(toward<0){delta.x-=toward*hit.normal.x;delta.z-=toward*hit.normal.z;}
   if(Math.hypot(delta.x,delta.z)<EPS)return;
  }
 }
 function move(ctx:C,id:string,t:T,b:B,v:V,dt:number):void{
  const others=boxes(ctx,id);
  if(!separate(ctx,t,b,v,others))return;
  // Finite work even for hostile admitted velocities. Translation remains swept at
  // any speed; angular travel is capped to the conservative subdivision budget.
  const requested=b.yawVelocity*dt,angle=Math.max(-MAX_STEPS*ANGLE_STEP,Math.min(MAX_STEPS*ANGLE_STEP,requested));
  if(angle!==requested)b.yawVelocity=angle/dt;
  const steps=Math.min(MAX_STEPS,Math.max(1,Math.ceil(Math.abs(angle)/ANGLE_STEP),Math.ceil(Math.hypot(b.velocity.x,b.velocity.z)*dt/.25)));
  for(let i=0;i<steps;i++){
   rotate(ctx,t,b,v,others,b.yawVelocity*dt/steps);
   translate(ctx,t,b,v,others,dt/steps);
  }
  contain(ctx,t,b,v);
 }
 const api={move};root.LWArmoredCollision=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
