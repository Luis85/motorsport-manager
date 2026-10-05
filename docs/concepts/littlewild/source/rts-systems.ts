/** RTS warfare, shroud, declarative abilities and mission systems on the shared ECS. */
(function(input:unknown){
 'use strict';
 const root=input as {LWRTSSystems?:unknown;LWRTSNavigation:LWRTSRuntime.Systems;LWRTSStats:{value(ctx:LWRTSRuntime.Context,id:string,stat:LWRTSData.Effect['stat'],base:number):number}};
 type C=LWRTSRuntime.Context;type W=LWRTSRuntime.World;type P=LWRTSRuntime.Point;
 const distance=(a:P,b:P):number=>Math.hypot(a.x-b.x,a.y-b.y);
 function visible(ctx:C,faction:string,pos:P):boolean{
  if(!ctx.mission.fog)return true;
  return ctx.world.get<LWRTSRuntime.Fog>('rts-state','rts-fog')?.visible[faction]?.includes(Math.floor(pos.x)+','+Math.floor(pos.y))||false;
 }
 function enemies(world:W,faction:string):string[]{return world.query(['rts-position','rts-owner','rts-health']).filter(id=>world.get<LWRTSRuntime.Owner>(id,'rts-owner')!.faction!==faction&&world.get<LWRTSRuntime.Health>(id,'rts-health')!.hp>0);}
 function register(scheduler:LWRTSRuntime.Scheduler,ctx:C):void{
  root.LWRTSNavigation.register(scheduler,ctx);
  scheduler.register({id:'rts.technology',phase:'pre',order:5,query:['rts-unit','rts-health','rts-kind'],update(world,id){
   const health=world.get<LWRTSRuntime.Health>(id,'rts-health')!,definition=ctx.catalog.get('units',world.get<LWRTSRuntime.Kind>(id,'rts-kind')!.definition)!;const maximum=root.LWRTSStats.value(ctx,id,'maxHp',definition.hp);
   if(health.max!==maximum){health.hp=Math.max(0,Math.min(maximum,health.hp+maximum-health.max));health.max=maximum;}
  }});
  scheduler.register({id:'rts.ai',phase:'pre',order:10,query:['rts-faction','rts-owner'],update(world,id){
   const owner=world.get<LWRTSRuntime.Owner>(id,'rts-owner')!,faction=ctx.catalog.get('factions',owner.faction)!;
   const state=world.get<LWRTSRuntime.State>('rts-state','rts-state')!;
   if(!faction.ai.enabled||state.tick%Math.max(1,Math.round(faction.ai.attackInterval/.1))!==0)return;
   for(const actor of world.query(['rts-unit','rts-owner','rts-order','rts-weapon'])){
    if(world.get<LWRTSRuntime.Owner>(actor,'rts-owner')!.faction!==owner.faction)continue;
    const p=world.get<P>(actor,'rts-position')!;
    const target=enemies(world,owner.faction).filter(enemy=>visible(ctx,owner.faction,world.get<P>(enemy,'rts-position')!)).sort((a,b)=>distance(p,world.get<P>(a,'rts-position')!)-distance(p,world.get<P>(b,'rts-position')!)||(a<b?-1:a>b?1:0))[0];
    const fallback=ctx.mission.spawns.find(spawn=>spawn.faction===ctx.mission.playerFaction&&ctx.catalog.get('units',spawn.archetype))||ctx.mission.spawns.find(spawn=>spawn.faction===ctx.mission.playerFaction);
    if(!target&&fallback&&(world.get<LWRTSRuntime.Order>(actor,'rts-order')!.kind==='stop'||(world.get<LWRTSRuntime.Order>(actor,'rts-order')!.kind==='attack'&&!world.has(world.get<LWRTSRuntime.Order>(actor,'rts-order')!.targetId,'rts-health'))))Object.assign(world.get(actor,'rts-order')!,{kind:'attackMove',targetId:'',x:fallback.x,y:fallback.y,path:[],cursor:0});
    if(target){const t=world.get<P>(target,'rts-position')!;Object.assign(world.get(actor,'rts-order')!,{kind:'attack',targetId:target,x:t.x,y:t.y,path:[],cursor:0});}
   }
  }});
  scheduler.register({id:'rts.combat',phase:'simulate',order:30,query:['rts-position','rts-owner','rts-health','rts-weapon'],update(world,id,dt){
   const health=world.get<LWRTSRuntime.Health>(id,'rts-health')!;if(health.hp<=0)return;
   const weapon=world.get<LWRTSRuntime.Weapon>(id,'rts-weapon')!,p=world.get<P>(id,'rts-position')!,owner=world.get<LWRTSRuntime.Owner>(id,'rts-owner')!;
   weapon.remaining=Math.max(0,weapon.remaining-dt);
   const order=world.get<LWRTSRuntime.Order>(id,'rts-order');
   let target=order?.kind==='attack'?order.targetId:'';
   if(!target&&(!order||['stop','attackMove','patrol'].includes(order.kind))){
    target=enemies(world,owner.faction).find(enemy=>distance(p,world.get<P>(enemy,'rts-position')!)<=weapon.range&&visible(ctx,owner.faction,world.get<P>(enemy,'rts-position')!))||'';
   }
   const tp=world.get<P>(target,'rts-position'),th=world.get<LWRTSRuntime.Health>(target,'rts-health'),to=world.get<LWRTSRuntime.Owner>(target,'rts-owner');
   if(!tp||!th||th.hp<=0||to?.faction===owner.faction||distance(p,tp)>weapon.range||weapon.remaining>0||!visible(ctx,owner.faction,tp))return;
   const movement=world.get<LWRTSRuntime.Unit>(target,'rts-unit')?.movement||'land';
   if(!weapon.targets.includes(movement))return;
   if(weapon.projectileSpeed>0&&world.entities.size+world.pendingStructural>=1200)return;
   weapon.remaining=weapon.cooldown;
   const victims=weapon.splash>0?enemies(world,owner.faction).filter(enemy=>distance(tp,world.get<P>(enemy,'rts-position')!)<=weapon.splash&&weapon.targets.includes(world.get<LWRTSRuntime.Unit>(enemy,'rts-unit')?.movement||'land')):[target];
   const damage=root.LWRTSStats.value(ctx,id,'damage',weapon.damage);
   if(weapon.projectileSpeed>0){
    const state=world.get<LWRTSRuntime.State>('rts-state','rts-state')!,projectile='projectile:'+String(++state.serial).padStart(6,'0');
    world.defer('create',projectile);world.defer('set',projectile,'rts-projectile',{source:id,target,x:p.x,y:p.y,targetX:tp.x,targetY:tp.y,speed:weapon.projectileSpeed,damage,splash:weapon.splash,faction:owner.faction,targets:[...weapon.targets]});
   }else for(const victim of victims){const h=world.get<LWRTSRuntime.Health>(victim,'rts-health')!;h.hp=Math.max(0,h.hp-Math.max(1,damage-root.LWRTSStats.value(ctx,victim,'armor',h.armor)));}
   ctx.emit({kind:'attack',source:id,target,damage:weapon.damage,projectileSpeed:weapon.projectileSpeed});
  }});
  scheduler.register({id:'rts.projectiles',phase:'simulate',order:35,query:['rts-projectile'],update(world,id,dt){
   const shot=world.get(id,'rts-projectile')!,p={x:Number(shot.x),y:Number(shot.y)},target=world.get<P>(String(shot.target),'rts-position')||{x:Number(shot.targetX),y:Number(shot.targetY)};
   const d=distance(p,target),travel=Number(shot.speed)*dt;
   if(d>travel){shot.x=p.x+(target.x-p.x)*travel/d;shot.y=p.y+(target.y-p.y)*travel/d;return;}
   const movementTargets=shot.targets as LWRTSData.Movement[];
   const victims=Number(shot.splash)>0?enemies(world,String(shot.faction)).filter(actor=>distance(target,world.get<P>(actor,'rts-position')!)<=Number(shot.splash)):[String(shot.target)];
   for(const actor of victims){const h=world.get<LWRTSRuntime.Health>(actor,'rts-health');if(h&&h.hp>0&&movementTargets.includes(world.get<LWRTSRuntime.Unit>(actor,'rts-unit')?.movement||'land'))h.hp=Math.max(0,h.hp-Math.max(1,Number(shot.damage)-root.LWRTSStats.value(ctx,actor,'armor',h.armor)));}
   world.defer('destroy',id);ctx.emit({kind:'impact',source:shot.source,target:shot.target,x:target.x,y:target.y});
  }});
  scheduler.register({id:'rts.death',phase:'post',order:10,query:['rts-health'],update(world,id){
   if(world.get<LWRTSRuntime.Health>(id,'rts-health')!.hp>0)return;
   const kind=world.get<LWRTSRuntime.Kind>(id,'rts-kind'),pos=world.get<P>(id,'rts-position');
   if(kind?.category==='building'&&pos){const def=ctx.catalog.get('buildings',kind.definition);if(def)for(let y=Math.floor(pos.y-def.footprint.height/2);y<Math.floor(pos.y-def.footprint.height/2)+def.footprint.height;y++)for(let x=Math.floor(pos.x-def.footprint.width/2);x<Math.floor(pos.x-def.footprint.width/2)+def.footprint.width;x++){const cell=x+','+y;ctx.map.blocked=ctx.map.blocked.filter(value=>value!==cell);}}
   world.defer('destroy',id);ctx.emit({kind:'destroyed',entity:id});
  }});
  scheduler.register({id:'rts.fog',phase:'post',order:40,query:['rts-fog'],update(world,id){
   const fog=world.get<LWRTSRuntime.Fog>(id,'rts-fog')!;
   const tick=world.get<LWRTSRuntime.State>(id,'rts-state')!.tick,reveal=world.get(id,'rts-reveal');
   const areas=((reveal?.areas||[]) as LWRTSRuntime.Data[]).filter(area=>Number(area.expires)>tick);
   if(reveal)reveal.areas=areas;
   for(const faction of ctx.data.factions){
    const cells=new Set<string>();
    for(const actor of world.query(['rts-position','rts-owner','rts-health'])){
     if(world.get<LWRTSRuntime.Owner>(actor,'rts-owner')!.faction!==faction.id||world.get<LWRTSRuntime.Health>(actor,'rts-health')!.hp<=0)continue;
     const p=world.get<P>(actor,'rts-position')!,kind=world.get<LWRTSRuntime.Kind>(actor,'rts-kind')!;
     const sight=root.LWRTSStats.value(ctx,actor,'sight',world.get<LWRTSRuntime.Unit>(actor,'rts-unit')?.sight||ctx.catalog.get('buildings',kind.definition)?.sight||0);
     for(let y=Math.max(0,Math.floor(p.y-sight));y<Math.min(ctx.map.height,Math.ceil(p.y+sight));y++)for(let x=Math.max(0,Math.floor(p.x-sight));x<Math.min(ctx.map.width,Math.ceil(p.x+sight));x++)if(Math.hypot(x+.5-p.x,y+.5-p.y)<=sight)cells.add(x+','+y);
    }
    for(const area of areas)if(area.faction===faction.id&&Number(area.expires)>tick)for(let y=0;y<ctx.map.height;y++)for(let x=0;x<ctx.map.width;x++)if(Math.hypot(x+.5-Number(area.x),y+.5-Number(area.y))<=Number(area.radius))cells.add(x+','+y);
    fog.visible[faction.id]=[...cells].sort();fog.explored[faction.id]=[...new Set([...(fog.explored[faction.id]||[]),...cells])].sort();
   }
  }});
  scheduler.register({id:'rts.objectives',phase:'post',order:90,query:['rts-state'],update(world,id){
   const state=world.get<LWRTSRuntime.State>(id,'rts-state')!;
   const alive=world.query(['rts-owner','rts-health']).filter(actor=>world.get<LWRTSRuntime.Health>(actor,'rts-health')!.hp>0);
   if(!alive.some(actor=>world.get<LWRTSRuntime.Owner>(actor,'rts-owner')!.faction===ctx.mission.playerFaction)){state.status='defeat';return;}
   const faction=world.get<LWRTSRuntime.Faction>('faction:'+ctx.mission.playerFaction,'rts-faction')!;
   const objectives=ctx.mission.objectives;
   if(objectives.length&&objectives.every(goal=>goal.type==='survive'?state.tick*.1>=goal.amount:goal.type==='stockpile'?(faction.resources[goal.target]||0)>=goal.amount:!alive.some(actor=>world.get<LWRTSRuntime.Owner>(actor,'rts-owner')!.faction===goal.target)))state.status='victory';
  }});
 }
 root.LWRTSSystems=Object.freeze({register,path:root.LWRTSNavigation.path,visible});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWRTSSystems;
})(globalThis);
