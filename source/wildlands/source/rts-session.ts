/** RTS application authority. Queries are detached; only explicit fixed steps advance ECS time. */
(function(input:unknown){
 'use strict';
 const root=input as {LWECS:LWRTSRuntime.Ecs;LWRTSCatalog:LWRTSData.CatalogApi;LWRTSSystems:LWRTSRuntime.Systems;LWRTSEconomy:LWRTSRuntime.Economy;LWRTS?:unknown};
 type C=LWRTSRuntime.Context;type D=LWRTSRuntime.Data;type P=LWRTSRuntime.Point;
 const copy=<T>(data:T):T=>JSON.parse(JSON.stringify(data)) as T;
 function create(catalogInput?:LWRTSData.Catalog,missionId?:string,saved?:D):LWRTSRuntime.Session{
  const data=copy(root.LWRTSCatalog.validate(catalogInput||root.LWRTSCatalog.defaults));
  const catalog:LWRTSData.CatalogApi={data,defaults:data,validate:root.LWRTSCatalog.validate,get(kind,id){return data[kind].find(entry=>entry.id===id) as LWRTSData.Entry<typeof kind>|undefined||null;},all(kind){return data[kind];},clone(){return copy(data);}};
  const mission=catalog.get('missions',missionId||data.missions[0]!.id);if(!mission)throw Error('Unknown RTS mission.');
  const world=new root.LWECS.World(),scheduler=new root.LWECS.Scheduler();
  const map:LWRTSRuntime.Map={width:mission.width,height:mission.height,tiles:Array(mission.width*mission.height).fill(mission.defaultTerrain) as string[],blocked:[]};
  for(const patch of mission.terrain)for(let y=patch.y;y<patch.y+patch.height;y++)for(let x=patch.x;x<patch.x+patch.width;x++)map.tiles[y*map.width+x]=patch.terrain;
  world.create('rts-state');world.set('rts-state','rts-state',{tick:0,status:'running',serial:0,mission:mission.id});world.set('rts-state','rts-map',map);world.set('rts-state','rts-fog',{visible:{},explored:{}});
  let events:LWRTSRuntime.Event[]=[];
  const ctx:C={world,catalog,data,map,mission,spawn,emit(event){const tick=world.get<LWRTSRuntime.State>('rts-state','rts-state')!.tick;events.push({...event,tick});if(events.length>128)events.shift();}};
  function put(id:string,type:string,value:D):void{if(world.running)world.defer('set',id,type,value);else world.set(id,type,value);}
  function spawn(definitionId:string,faction:string,x:number,y:number):string{
   if(world.entities.size+world.pendingStructural>=1200)throw Error('RTS entity capacity reached.');
   const unit=catalog.get('units',definitionId),building=catalog.get('buildings',definitionId);if(!unit&&!building)throw Error('Unknown RTS archetype.');
   const definition=unit||building!;const state=world.get<LWRTSRuntime.State>('rts-state','rts-state')!;
   const id='rts:'+String(++state.serial).padStart(6,'0');if(world.running)world.defer('create',id);else world.create(id);
   put(id,'rts-position',{x,y});put(id,'rts-owner',{faction});put(id,'rts-kind',{definition:definitionId,category:unit?'unit':'building'});
   put(id,'rts-health',{hp:definition.hp,max:definition.hp,armor:definition.armor});
   put(id,'rts-order',{kind:'stop',targetId:'',x,y,path:[],cursor:0});
   if(definition.attack)put(id,'rts-weapon',{...copy(definition.attack),remaining:0});
   put(id,'rts-abilities',{cooldowns:{}});put(id,'rts-inventory',{items:{}});
   if(unit){
    put(id,'rts-unit',{speed:unit.speed,movement:unit.movement,sight:unit.sight,radius:unit.radius,population:unit.population,role:unit.role});
    if(unit.role==='worker')put(id,'rts-worker',{capacity:unit.carryCapacity,rate:unit.gatherRate,buildRate:unit.buildRate,carried:0,resource:''});
   }else{
    put(id,'rts-building',{complete:true,progress:1});put(id,'rts-production',{queue:[]});
    for(let row=Math.floor(y-building!.footprint.height/2);row<Math.floor(y-building!.footprint.height/2)+building!.footprint.height;row++)for(let column=Math.floor(x-building!.footprint.width/2);column<Math.floor(x-building!.footprint.width/2)+building!.footprint.width;column++)map.blocked.push(column+','+row);
   }
   return id;
  }
  for(const faction of data.factions){const id='faction:'+faction.id;world.create(id);world.set(id,'rts-owner',{faction:faction.id});world.set(id,'rts-faction',{resources:copy(faction.startingResources),technologies:[],population:0,populationCap:0,power:0});}
  for(const spec of mission.spawns)for(let i=0;i<spec.count;i++)spawn(spec.archetype,spec.faction,spec.x+(i%3)*.35,spec.y+Math.floor(i/3)*.35);
  for(const [index,drop]of mission.items.entries()){const item=catalog.get('items',drop.item)!;const id='item:'+index;world.create(id);world.set(id,'rts-position',{x:drop.x,y:drop.y});world.set(id,'rts-kind',{definition:item.id,category:'item'});world.set(id,'rts-item',{charges:item.charges});}
  for(const [index,node] of mission.deposits.entries()){const id='deposit:'+index;world.create(id);world.set(id,'rts-position',{x:node.x,y:node.y});world.set(id,'rts-kind',{definition:node.resource,category:'resource'});world.set(id,'rts-node',{resource:node.resource,remaining:node.amount});}
  if(saved){
   const records=saved.entities as {id:string;components:D}[];
   for(const id of world.entities)world.destroy(id);
   for(const record of records){world.create(record.id);for(const [type,value] of Object.entries(record.components))world.set(record.id,type,value as D);}
   const retained=world.get<LWRTSRuntime.Map>('rts-state','rts-map');if(!retained)throw Error('Checkpoint missing map.');
   Object.assign(map,retained);world.set('rts-state','rts-map',map);events=copy(saved.events as LWRTSRuntime.Event[]);
  }
  root.LWRTSSystems.register(scheduler,ctx);root.LWRTSEconomy.register(scheduler,ctx);
  // Initial shroud/population projection executes only read-model systems, never advances gameplay.
  if(!saved)for(const system of schedulerSystems(scheduler))if(['rts.fog','rts.population'].includes(system.id))for(const id of world.query(system.query))system.update(world,id,.1,{});
  function command(raw:LWRTSRuntime.Command):LWRTSRuntime.Result{
   if(!raw||typeof raw!=='object')return {ok:false,message:'Invalid command.'};
   let cmd:LWRTSRuntime.Command;try{const preview=new root.LWECS.World();preview.create('command');preview.set('command','command',raw);cmd=copy(raw);}catch{return {ok:false,message:'Command must be plain data.'};}
   const allowed=new Set(['kind','faction','entities','entityIds','entityId','definition','definitionId','targetId','x','y','ability','workerId','index']);
   if(Object.keys(cmd).some(key=>!allowed.has(key)))return {ok:false,message:'Unknown command field.'};
   if(typeof cmd.kind!=='string'||typeof cmd.faction!=='string')return {ok:false,message:'Invalid command.'};
   if(world.get<LWRTSRuntime.State>('rts-state','rts-state')!.status!=='running')return {ok:false,message:'Mission ended.'};
   if(!catalog.get('factions',cmd.faction))return {ok:false,message:'Unknown faction.'};
   const ids=cmd.entities||cmd.entityIds||(cmd.entityId?[cmd.entityId]:[]);
   if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!world.has(id,'rts-owner')||world.get<LWRTSRuntime.Owner>(id,'rts-owner')!.faction!==cmd.faction))return {ok:false,message:'Select owned entities.'};
   cmd.entities=ids;cmd.entityIds=ids;if(ids[0])cmd.entityId=ids[0];cmd.definitionId=cmd.definitionId||cmd.definition||'';
   if(cmd.targetId){const targetPosition=world.get<P>(cmd.targetId,'rts-position');if(targetPosition&&world.get<LWRTSRuntime.Owner>(cmd.targetId,'rts-owner')?.faction!==cmd.faction&&!canSee(cmd.faction,targetPosition))return {ok:false,message:'Target is outside current visibility.'};}
   const economy=root.LWRTSEconomy.command(ctx,cmd);if(economy)return economy;
   if(cmd.kind==='ability')return ability(ctx,cmd,ids);
   if(cmd.kind==='interact')return item(ctx,cmd,ids);
   if(!['move','attack','attackMove','stop','patrol','interact'].includes(cmd.kind)||!ids.length)return {ok:false,message:'Unsupported RTS order.'};
   const target=cmd.targetId?world.get<P>(cmd.targetId,'rts-position'):undefined;
   if(cmd.kind==='attack'&&(!target||world.get<LWRTSRuntime.Owner>(cmd.targetId!,'rts-owner')?.faction===cmd.faction||!canSee(cmd.faction,target)))return {ok:false,message:'Choose a visible enemy.'};
   const x=target?.x??cmd.x,y=target?.y??cmd.y;
   if(cmd.kind!=='stop'&&(!Number.isFinite(x)||!Number.isFinite(y)||x!<0||y!<0||x!>=map.width||y!>=map.height))return {ok:false,message:'Choose a valid map position.'};
   for(const id of ids){const p=world.get<P>(id,'rts-position')!,unit=world.get<LWRTSRuntime.Unit>(id,'rts-unit');
    if(cmd.kind!=='stop'&&!unit)return {ok:false,message:'Buildings cannot move.'};
    if(cmd.kind==='attack'&&!world.has(id,'rts-weapon'))return {ok:false,message:'Unit cannot attack.'};
    if(cmd.kind==='attack'&&!world.get<LWRTSRuntime.Weapon>(id,'rts-weapon')!.targets.includes(world.get<LWRTSRuntime.Unit>(cmd.targetId!,'rts-unit')?.movement||'land'))return {ok:false,message:'Weapon cannot attack that movement type.'};
    if(cmd.kind==='interact')return {ok:false,message:'Select a supported item ability.'};
    if(unit&&cmd.kind!=='stop'&&cmd.kind!=='attack'&&!root.LWRTSSystems.path(ctx,p,{x:x!,y:y!},unit.movement).length&&(Math.floor(p.x)!==Math.floor(x!)||Math.floor(p.y)!==Math.floor(y!)))return {ok:false,message:'Destination is unreachable.'};
   }
   for(const id of ids){const p=world.get<P>(id,'rts-position')!;if(cmd.kind==='patrol')world.set(id,'rts-patrol',{x:p.x,y:p.y});world.set(id,'rts-order',{kind:cmd.kind,targetId:cmd.targetId||'',x:x??p.x,y:y??p.y,path:[],cursor:0});}
   ctx.emit({kind:'order',order:cmd.kind,entities:ids});return {ok:true,message:'Order accepted.'};
  }
  function canSee(faction:string,p:P):boolean{return !mission!.fog||world.get<LWRTSRuntime.Fog>('rts-state','rts-fog')!.visible[faction]?.includes(Math.floor(p.x)+','+Math.floor(p.y))||false;}
  function query(faction=mission!.playerFaction):LWRTSRuntime.Snapshot{
   const fog=world.get<LWRTSRuntime.Fog>('rts-state','rts-fog')!,state=world.get<LWRTSRuntime.State>('rts-state','rts-state')!;
   const entities=world.query(['rts-position','rts-kind']).flatMap(id=>{
    const p=world.get<P>(id,'rts-position')!,kind=world.get<LWRTSRuntime.Kind>(id,'rts-kind')!,owner=world.get<LWRTSRuntime.Owner>(id,'rts-owner'),h=world.get<LWRTSRuntime.Health>(id,'rts-health'),building=world.get(id,'rts-building');
    if(faction&&owner?.faction!==faction&&!canSee(faction,p))return [];
    return [{id,definition:kind.definition,category:kind.category,faction:owner?.faction||'',x:p.x,y:p.y,hp:h?.hp||0,maxHp:h?.max||0,order:world.get<LWRTSRuntime.Order>(id,'rts-order')?.kind||'',complete:building?.complete!==false,progress:Number(building?.progress??1),remaining:world.get(id,'rts-node')?.remaining??0,inventory:world.get(id,'rts-inventory')?.items||{},queue:world.get(id,'rts-production')?.queue||[],carried:world.get(id,'rts-worker')?.carried||0}];
   });
   const exposed=new Set(entities.map(entity=>entity.id));
   const safeEvents=events.filter(event=>!faction||(!event.source||exposed.has(String(event.source)))&&(!event.target||exposed.has(String(event.target)))&&(!event.entity||exposed.has(String(event.entity)))&&(!event.entityId||exposed.has(String(event.entityId)))&&(!event.faction||event.faction===faction));
   const projectiles=world.query(['rts-projectile']).flatMap(id=>{const shot=world.get(id,'rts-projectile')!,position={x:Number(shot.x),y:Number(shot.y)};if(faction&&shot.faction!==faction&&!canSee(faction,position))return [];return [{id,x:position.x,y:position.y,faction:String(shot.faction)}];});
   return copy({projectiles,tick:state.tick,status:state.status,map,entities,factions:world.query(['rts-faction','rts-owner']).filter(id=>!faction||world.get<LWRTSRuntime.Owner>(id,'rts-owner')!.faction===faction).map(id=>({id:world.get<LWRTSRuntime.Owner>(id,'rts-owner')!.faction,...world.get<LWRTSRuntime.Faction>(id,'rts-faction')!})),events:safeEvents,fog:faction?{visible:{[faction]:fog.visible[faction]||[]},explored:{[faction]:fog.explored[faction]||[]}}:fog,catalog:data,playerFaction:mission!.playerFaction});
  }
  function step(ticks=1):void{
   if(!Number.isSafeInteger(ticks)||ticks<0||ticks>20000)throw Error('RTS step count must be 0..20000.');
   const state=world.get<LWRTSRuntime.State>('rts-state','rts-state')!;
   for(let i=0;i<ticks&&state.status==='running';i++){state.tick++;scheduler.step(world,.1);root.LWRTSEconomy.completeStep(ctx);}
  }
  function checkpoint():D{return copy({format:'wildlands-rts-checkpoint',version:1,catalog:data,missionId:mission!.id,entities:[...world.entities].sort().map(id=>({id,components:componentRecords(world,id)})),events});}
  return Object.freeze({command,query,step,checkpoint});
 }
 function schedulerSystems(s:LWRTSRuntime.Scheduler):LWRTSRuntime.System[]{return (s as unknown as {systems:LWRTSRuntime.System[]}).systems;}
 function componentRecords(world:LWRTSRuntime.World,id:string):D{
  const stores=(world as unknown as {stores:ReadonlyMap<string,ReadonlyMap<string,D>>}).stores;const result:D={};for(const [type,store]of stores){const value=store.get(id);if(value)result[type]=value;}return result;
 }
 function ability(ctx:C,cmd:LWRTSRuntime.Command,ids:string[]):LWRTSRuntime.Result{
  if(ids.length!==1)return {ok:false,message:'Select one ability user.'};
  const id=ids[0]!,kind=ctx.world.get<LWRTSRuntime.Kind>(id,'rts-kind')!,unit=ctx.catalog.get('units',kind.definition),spec=ctx.catalog.get('abilities',cmd.ability||cmd.definitionId||'');
  const target=cmd.targetId?ctx.world.get<P>(cmd.targetId,'rts-position'):undefined,pos=ctx.world.get<P>(id,'rts-position')!;
  const center=target||{x:cmd.x??pos.x,y:cmd.y??pos.y};
  const inventory=ctx.world.get(id,'rts-inventory')?.items as Record<string,number>|undefined;const carried=ctx.data.items.find(item=>item.ability===spec?.id&&(inventory?.[item.id]||0)>0);
  if(!spec||(!unit?.abilities.includes(spec.id)&&!carried)||!Number.isFinite(center.x)||!Number.isFinite(center.y)||center.x<0||center.y<0||center.x>=ctx.map.width||center.y>=ctx.map.height||Math.hypot(pos.x-center.x,pos.y-center.y)>spec.range)return {ok:false,message:'Ability target unavailable.'};
  const cooldowns=ctx.world.get(id,'rts-abilities')!.cooldowns as Record<string,number>,state=ctx.world.get<LWRTSRuntime.State>('rts-state','rts-state')!,faction=ctx.world.get<LWRTSRuntime.Faction>('faction:'+cmd.faction,'rts-faction')!;
  if((cooldowns[spec.id]||0)>state.tick||Object.entries(spec.cost).some(([key,n])=>(faction.resources[key]||0)<n))return {ok:false,message:'Ability cooling down or resources missing.'};
  // Bound active reveal state to the checkpoint admission budget before any payment.
  const reveals=(ctx.world.get('rts-state','rts-reveal')?.areas||[]) as D[];
  const activeReveals=reveals.filter(area=>Number(area.expires)>state.tick);
  if(spec.effect==='reveal'&&activeReveals.length>=256)return {ok:false,message:'Active reveal capacity is full.'};
  for(const [key,n]of Object.entries(spec.cost))faction.resources[key]=(faction.resources[key]||0)-n;
  if(carried&&inventory)inventory[carried.id]!--;
  cooldowns[spec.id]=state.tick+Math.ceil(spec.cooldown/.1);
  if(spec.effect==='reveal'){
   const reveal={areas:activeReveals};reveal.areas.push({faction:cmd.faction,x:center.x,y:center.y,radius:spec.radius,expires:state.tick+Math.ceil(spec.duration/.1)});ctx.world.set('rts-state','rts-reveal',reveal);
  }else for(const actor of ctx.world.query(['rts-health','rts-position','rts-owner'])){
   const p=ctx.world.get<P>(actor,'rts-position')!,h=ctx.world.get<LWRTSRuntime.Health>(actor,'rts-health')!,owner=ctx.world.get<LWRTSRuntime.Owner>(actor,'rts-owner')!;
   if(Math.hypot(p.x-center.x,p.y-center.y)>spec.radius)continue;
   if(spec.effect==='damage'&&owner.faction!==cmd.faction)h.hp=Math.max(0,h.hp-spec.amount);
   if((spec.effect==='heal'||spec.effect==='repair')&&owner.faction===cmd.faction)h.hp=Math.min(h.max,h.hp+spec.amount);
  }
  ctx.emit({kind:'ability',source:id,ability:spec.id,x:center.x,y:center.y});return {ok:true,message:'Ability activated.'};
 }
 function item(ctx:C,cmd:LWRTSRuntime.Command,ids:string[]):LWRTSRuntime.Result{
  if(ids.length!==1)return {ok:false,message:'Select one unit for pickup.'};
  const id=ids[0]!,target=cmd.targetId||'',kind=ctx.world.get<LWRTSRuntime.Kind>(target,'rts-kind'),position=ctx.world.get<P>(target,'rts-position'),actor=ctx.world.get<P>(id,'rts-position');
  if(!ctx.world.has(id,'rts-unit')||kind?.category!=='item'||!position||!actor||Math.hypot(position.x-actor.x,position.y-actor.y)>1.5)return {ok:false,message:'Move close to an item to collect it.'};
  const inventory=ctx.world.get(id,'rts-inventory')!.items as Record<string,number>,charges=Number(ctx.world.get(target,'rts-item')?.charges||0);
  inventory[kind.definition]=(inventory[kind.definition]||0)+charges;ctx.world.destroy(target);ctx.emit({kind:'item-collected',entityId:id,item:kind.definition});return {ok:true,message:'Item collected; its ability is available.'};
 }
 function restore(value:unknown):LWRTSRuntime.Session{
  const checkpoint=(root as unknown as {LWRTSCheckpoint:{validate(value:unknown):D}}).LWRTSCheckpoint;
  if(!checkpoint)throw Error('RTS checkpoint validator is missing.');
  const save=checkpoint.validate(value);return create(save.catalog as LWRTSData.Catalog,save.missionId as string,save);
 }
 root.LWRTS=Object.freeze({create,restore});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWRTS;
})(globalThis);
