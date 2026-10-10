/** Deterministic tracked-force adapter. Contact-plane approximation, not a full rigid-body solver.
 * Six terrain probes support pitch/roll. No airborne angular dynamics, articulated suspension,
 * joint constraints, full hull collision footprint or rollover: those remain a measured Rapier integration milestone. */
(function(input:unknown){
 'use strict';
 const root=input as {LWArmoredPhysics?:LWArmoredRuntime.Physics};
 type C=LWArmoredRuntime.Context;type T=LWArmoredRuntime.Transform;type B=LWArmoredRuntime.Body;
 const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
 function height(t:LWArmoredData.Terrain,x:number,z:number):number{
  const gx=clamp(x/t.cellSize,0,t.width-1),gz=clamp(z/t.cellSize,0,t.depth-1);
  const ix=Math.min(t.width-2,Math.floor(gx)),iz=Math.min(t.depth-2,Math.floor(gz));
  const a=gx-ix,b=gz-iz;
  const sample=(dx:number,dz:number)=>t.heights[(iz+dz)*t.width+ix+dx]!;
  return (sample(0,0)*(1-a)+sample(1,0)*a)*(1-b)+(sample(0,1)*(1-a)+sample(1,1)*a)*b;
 }
 function obstacleCollision(ctx:C,id:string,t:T,b:B,radius:number):void{
  for(const obstacle of ctx.mission.obstacles){
   if(ctx.world.get('obstacle:'+obstacle.id,'armored-obstacle')?.destroyed)continue;
   if(t.position.y>obstacle.position.y+obstacle.size.y)continue;
   const hx=obstacle.size.x/2+radius,hz=obstacle.size.z/2+radius;
   const dx=t.position.x-obstacle.position.x,dz=t.position.z-obstacle.position.z;
   if(Math.abs(dx)>=hx||Math.abs(dz)>=hz)continue;
   if(hx-Math.abs(dx)<hz-Math.abs(dz)){t.position.x=obstacle.position.x+(dx>=0?hx:-hx);b.velocity.x=0;}
   else {t.position.z=obstacle.position.z+(dz>=0?hz:-hz);b.velocity.z=0;}
   b.yawVelocity*=.8;
  }
  for(const other of ctx.world.query(['armored-transform','armored-identity'])){
   if(other===id)continue;
   const position=ctx.world.get<T>(other,'armored-transform')!.position;
   const spec=ctx.catalog.vehicles.find(v=>v.id===ctx.world.get<LWArmoredRuntime.Identity>(other,'armored-identity')!.definition)!;
   const dx=t.position.x-position.x,dz=t.position.z-position.z,distance=Math.hypot(dx,dz),minimum=radius+spec.width/2;
   if(distance>=minimum||Math.abs(position.y-t.position.y)>spec.height)continue;
   const nx=distance>1e-8?dx/distance:(id<other?-1:1),nz=distance>1e-8?dz/distance:0;
   t.position.x=position.x+nx*minimum;t.position.z=position.z+nz*minimum;
   const toward=b.velocity.x*nx+b.velocity.z*nz;
   if(toward<0){b.velocity.x-=toward*nx;b.velocity.z-=toward*nz;}
  }
 }
 function integrate(ctx:C,id:string,dt:number):void{
  const w=ctx.world,t=w.get<T>(id,'armored-transform')!,previous=w.get<T>(id,'armored-previous')!;
  previous.position={...t.position};previous.yaw=t.yaw;previous.pitch=t.pitch;previous.roll=t.roll;
  const b=w.get<B>(id,'armored-body')!,motor=w.get<LWArmoredRuntime.Motor>(id,'armored-motor')!;
  const identity=w.get<LWArmoredRuntime.Identity>(id,'armored-identity')!;
  const spec=ctx.catalog.vehicles.find(v=>v.id===identity.definition)!;
  const damage=w.get<LWArmoredRuntime.Damage>(id,'armored-damage')!;
  const terrain=ctx.mission.terrain,surface=ctx.catalog.surfaces.find(v=>v.id===terrain.surface)!;
  const sin=Math.sin(t.yaw),cos=Math.cos(t.yaw),forward=b.velocity.x*sin+b.velocity.z*cos;
  const lateral=b.velocity.x*cos-b.velocity.z*sin;
  let front=0,rear=0,left=0,right=0,total=0;
  for(const side of [-1,1])for(const offset of [-1,0,1]){
   const lx=side*spec.trackWidth/2,lz=offset*spec.length*.4;
   const h=height(terrain,t.position.x+lx*cos+lz*sin,t.position.z-lx*sin+lz*cos);
   total+=h;if(offset===1)front+=h;if(offset===-1)rear+=h;if(side===-1)left+=h;else right+=h;
  }
  const support=total/6+spec.groundClearance;
  b.grounded=t.position.y<=support+spec.suspensionTravel;
  b.contacts=b.grounded?6:0;
  const slope=(front-rear)/(spec.length*1.6),crossSlope=(right-left)/(3*spec.trackWidth);
  const inclination=Math.atan(Math.hypot(slope,crossSlope));
  let throttle=motor.throttle;
  if(motor.cruise!==0&&throttle===0)throttle=clamp((motor.cruise-forward)*.5,-1,1);
  const mobility=damage.status==='destroyed'||damage.status==='disabled'||damage.status==='immobilized'?0:Math.min(1,(damage.components.engine??spec.componentHealth)/spec.componentHealth);
  const traction=b.grounded?surface.friction*spec.mass*9.81/2:0;
  const demand=spec.engineForce*mobility/2;
  b.leftForce=clamp((throttle+motor.steer)*demand,-traction,traction);
  b.rightForce=clamp((throttle-motor.steer)*demand,-traction,traction);
  if(inclination>spec.maxSlope&&throttle*slope>0){
   if(throttle>0){b.leftForce=Math.min(0,b.leftForce);b.rightForce=Math.min(0,b.rightForce);}
   else {b.leftForce=Math.max(0,b.leftForce);b.rightForce=Math.max(0,b.rightForce);}
  }
  const maxSpeed=throttle>=0?spec.maxSpeed:spec.reverseSpeed;
  if(Math.abs(forward)>=maxSpeed&&throttle*forward>0){
   const propulsive=(b.leftForce+b.rightForce)/2;
   if(propulsive*forward>0){b.leftForce-=propulsive;b.rightForce-=propulsive;}
  }
  const resistance=(spec.rollingResistance+surface.rollingResistance)*spec.mass*9.81;
  const braking=motor.brake*spec.brakeForce;
  const drag=forward===0?0:Math.sign(forward)*Math.min(Math.abs(forward)*spec.mass/dt,resistance+braking);
  const acceleration=(b.leftForce+b.rightForce-drag)/spec.mass-(b.grounded?9.81*slope:0);
  const sideAcceleration=b.grounded?clamp(-lateral/dt,-surface.friction*9.81,surface.friction*9.81)-9.81*crossSlope:0;
  b.velocity.x+=(sin*acceleration+cos*sideAcceleration)*dt;
  b.velocity.z+=(cos*acceleration-sin*sideAcceleration)*dt;
  const inertia=spec.mass*(spec.length*spec.length+spec.width*spec.width)/12;
  const torque=(b.leftForce-b.rightForce)*spec.trackWidth/2;
  b.yawVelocity+=torque/inertia*dt;
  b.yawVelocity*=Math.exp(-(b.grounded?1.8+motor.brake*4:0)*dt);
  t.yaw=Math.atan2(Math.sin(t.yaw+b.yawVelocity*dt),Math.cos(t.yaw+b.yawVelocity*dt));
  t.position.x+=b.velocity.x*dt;t.position.z+=b.velocity.z*dt;
  if(b.grounded){t.position.y=support;b.velocity.y=0;t.pitch=Math.atan(slope);t.roll=Math.atan(crossSlope);}
  else {b.velocity.y-=9.81*dt;t.position.y+=b.velocity.y*dt;}
  const radius=spec.width/2,maxX=(terrain.width-1)*terrain.cellSize-radius,maxZ=(terrain.depth-1)*terrain.cellSize-radius;
  const x=clamp(t.position.x,radius,maxX),z=clamp(t.position.z,radius,maxZ);
  if(x!==t.position.x)b.velocity.x=0;if(z!==t.position.z)b.velocity.z=0;
  t.position.x=x;t.position.z=z;
  obstacleCollision(ctx,id,t,b,radius);
  b.slip=Math.abs(lateral)+Math.max(0,Math.abs((throttle+motor.steer)*demand)-traction)/spec.mass;
 }
 function register(scheduler:LWArmoredRuntime.Scheduler,ctx:C):void{
  scheduler.register({id:'armored.physics',phase:'simulate',order:10,query:['armored-transform','armored-body','armored-motor'],update(_world,id,dt){integrate(ctx,id,dt);}});
 }
 const api={height,register};root.LWArmoredPhysics=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
