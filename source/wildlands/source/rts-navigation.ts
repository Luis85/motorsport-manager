/** Bounded deterministic grid navigation; terrain and building blockers are ECS data. */
(function(input:unknown){
 'use strict';
 const root=input as {LWRTSNavigation?:unknown;LWRTSStats:{value(ctx:LWRTSRuntime.Context,id:string,stat:LWRTSData.Effect['stat'],base:number):number}};
 type C=LWRTSRuntime.Context;type P=LWRTSRuntime.Point;
 const key=(x:number,y:number):string=>x+','+y;
 function passable(ctx:C,x:number,y:number,movement:LWRTSData.Movement):boolean {
  if(x<0||y<0||x>=ctx.map.width||y>=ctx.map.height)return false;
  const tile=ctx.catalog.get('terrain',ctx.map.tiles[y*ctx.map.width+x]||'');
  return !!tile?.passable.includes(movement)&&(movement==='air'||!ctx.map.blocked.includes(key(x,y)));
 }
 function path(ctx:C,start:P,end:P,movement:LWRTSData.Movement):P[]{
  const sx=Math.floor(start.x),sy=Math.floor(start.y),ex=Math.floor(end.x),ey=Math.floor(end.y);
  if(!passable(ctx,ex,ey,movement))return [];
  if(sx===ex&&sy===ey)return [{x:end.x,y:end.y}];
  const queue:P[]=[{x:sx,y:sy}],previous=new Map<string,P|null>([[key(sx,sy),null]]);
  for(let i=0;i<queue.length;i++){
   const cell=queue[i]!;
   if(cell.x===ex&&cell.y===ey){
    const route:P[]=[];let next:P|null=cell;
    while(next){route.push({x:next.x+.5,y:next.y+.5});next=previous.get(key(next.x,next.y))||null;}
    return route.reverse().slice(1);
   }
   for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]] as const){
    const x=cell.x+dx,y=cell.y+dy,k=key(x,y);
    if(!previous.has(k)&&passable(ctx,x,y,movement)){previous.set(k,cell);queue.push({x,y});}
   }
  }
  return [];
 }
 function register(scheduler:LWRTSRuntime.Scheduler,ctx:C):void{
  scheduler.register({id:'rts.movement',phase:'simulate',order:10,query:['rts-position','rts-unit','rts-order'],update(world,id,dt){
   const pos=world.get<P>(id,'rts-position')!,unit=world.get<LWRTSRuntime.Unit>(id,'rts-unit')!,order=world.get<LWRTSRuntime.Order>(id,'rts-order')!;
   if(!['move','attack','attackMove','gather','build','repair','patrol'].includes(order.kind))return;
   const target=order.targetId?world.get<P>(order.targetId,'rts-position'):undefined;
   if(target){order.x=target.x;order.y=target.y;}
   const weapon=world.get<LWRTSRuntime.Weapon>(id,'rts-weapon');
   const definition=target?ctx.catalog.get('buildings',world.get<LWRTSRuntime.Kind>(order.targetId,'rts-kind')?.definition||''):null;
   const range=order.kind==='attack'?weapon?.range||.8:['gather','build','repair'].includes(order.kind)?(definition?Math.max(definition.footprint.width,definition.footprint.height)/2+1:1):.12;
   if(Math.hypot(order.x-pos.x,order.y-pos.y)<=range){if(order.kind==='move')order.kind='stop';if(order.kind==='patrol'){const patrol=world.get(id,'rts-patrol');if(patrol){const ox=order.x,oy=order.y;order.x=Number(patrol.x);order.y=Number(patrol.y);patrol.x=ox;patrol.y=oy;order.path=[];order.cursor=0;}}return;}
   if(order.kind==='attackMove'&&weapon){const faction=world.get<LWRTSRuntime.Owner>(id,'rts-owner')!.faction;const fog=world.get<LWRTSRuntime.Fog>('rts-state','rts-fog')!;if(world.query(['rts-owner','rts-position','rts-health']).some(enemy=>{const ep=world.get<P>(enemy,'rts-position')!;return world.get<LWRTSRuntime.Owner>(enemy,'rts-owner')!.faction!==faction&&world.get<LWRTSRuntime.Health>(enemy,'rts-health')!.hp>0&&Math.hypot(pos.x-ep.x,pos.y-ep.y)<=weapon.range&&(!ctx.mission.fog||fog.visible[faction]?.includes(Math.floor(ep.x)+','+Math.floor(ep.y)));}))return;}
   const last=order.path[order.path.length-1];
   if(!last||Math.floor(last.x)!==Math.floor(order.x)||Math.floor(last.y)!==Math.floor(order.y)){
    let endpoint={x:order.x,y:order.y};
    if(target&&!passable(ctx,Math.floor(endpoint.x),Math.floor(endpoint.y),unit.movement)){
     const candidates:P[]=[];for(let y=Math.max(0,Math.floor(target.y-range));y<Math.min(ctx.map.height,Math.ceil(target.y+range));y++)for(let x=Math.max(0,Math.floor(target.x-range));x<Math.min(ctx.map.width,Math.ceil(target.x+range));x++)if(passable(ctx,x,y,unit.movement)&&Math.hypot(x+.5-target.x,y+.5-target.y)<=range)candidates.push({x:x+.5,y:y+.5});
     candidates.sort((a,b)=>Math.hypot(a.x-pos.x,a.y-pos.y)-Math.hypot(b.x-pos.x,b.y-pos.y)||a.y-b.y||a.x-b.x);
     endpoint=candidates[0]||endpoint;
    }
    order.path=path(ctx,pos,endpoint,unit.movement);order.cursor=0;
   }
   let budget=root.LWRTSStats.value(ctx,id,'speed',unit.speed)*dt;
   const terrain=ctx.catalog.get('terrain',ctx.map.tiles[Math.floor(pos.y)*ctx.map.width+Math.floor(pos.x)]||'');
   budget*=terrain?.speedFactor||1;
   while(budget>0&&order.cursor<order.path.length){
    const waypoint=order.path[order.cursor]!,distance=Math.hypot(waypoint.x-pos.x,waypoint.y-pos.y);
    if(!passable(ctx,Math.floor(waypoint.x),Math.floor(waypoint.y),unit.movement)){order.path=[];return;}
    if(distance<=budget){pos.x=waypoint.x;pos.y=waypoint.y;budget-=distance;order.cursor++;}
    else {pos.x+=(waypoint.x-pos.x)*budget/distance;pos.y+=(waypoint.y-pos.y)*budget/distance;budget=0;}
   }
   if(order.cursor>=order.path.length&&order.kind==='move')order.kind='stop';
  }});
  scheduler.register({id:'rts.separation',phase:'simulate',order:20,query:['rts-position','rts-unit'],update(world,id){
   const position=world.get<P>(id,'rts-position')!,unit=world.get<LWRTSRuntime.Unit>(id,'rts-unit')!;
   for(const otherId of world.query(['rts-position','rts-unit'])){
    if(otherId<=id)continue;
    const other=world.get<P>(otherId,'rts-position')!,otherUnit=world.get<LWRTSRuntime.Unit>(otherId,'rts-unit')!;
    if(unit.movement!==otherUnit.movement)continue;
    const dx=other.x-position.x,dy=other.y-position.y,distance=Math.hypot(dx,dy),minimum=unit.radius+otherUnit.radius;
    if(distance>=minimum)continue;
    const nx=distance>1e-9?dx/distance:1,ny=distance>1e-9?dy/distance:0,shift=(minimum-distance)/2;
    const a={x:position.x-nx*shift,y:position.y-ny*shift},b={x:other.x+nx*shift,y:other.y+ny*shift};
    const canA=passable(ctx,Math.floor(a.x),Math.floor(a.y),unit.movement),canB=passable(ctx,Math.floor(b.x),Math.floor(b.y),otherUnit.movement);
    if(canA){position.x=a.x;position.y=a.y;}if(canB){other.x=b.x;other.y=b.y;}
    if(canA&&!canB){const full={x:position.x-nx*shift,y:position.y-ny*shift};if(passable(ctx,Math.floor(full.x),Math.floor(full.y),unit.movement)){position.x=full.x;position.y=full.y;}}
    if(canB&&!canA){const full={x:other.x+nx*shift,y:other.y+ny*shift};if(passable(ctx,Math.floor(full.x),Math.floor(full.y),otherUnit.movement)){other.x=full.x;other.y=full.y;}}
   }
  }});

 }
 root.LWRTSNavigation=Object.freeze({path,passable,register});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWRTSNavigation;
})(globalThis);
