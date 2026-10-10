/** One armored ECS authority. Fixed ticks, accepted-command sequence and RNG are explicit state. */
(function(input:unknown){
 'use strict';
 type R=LWArmoredRuntime.Result;type C=LWArmoredRuntime.Command;type D=LWArmoredRuntime.Data;type CP=LWArmoredRuntime.Checkpoint;
 const root=input as {
  LWECS:LWArmoredRuntime.Ecs;LWArmoredCatalog:LWArmoredData.CatalogApi;LWArmoredPhysics:LWArmoredRuntime.Physics;
  LWArmoredCombat:LWArmoredRuntime.Extension&{initialDamage(v:LWArmoredData.Vehicle):LWArmoredRuntime.Damage;initialWeapon(v:LWArmoredData.Vehicle,c:LWArmoredData.Catalog):LWArmoredRuntime.Weapon};
  LWArmoredAI:LWArmoredRuntime.Extension&{visible(ctx:LWArmoredRuntime.Context,observer:string,target:string):boolean};LWArmoredMission:LWArmoredRuntime.Extension;
  LWArmoredCheckpoint:{validate(input:unknown):CP};LWArmored?:LWArmoredRuntime.SessionApi;
 };
 const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
 function create(inputCatalog:LWArmoredData.Catalog,missionId?:string,inputSave?:CP):LWArmoredRuntime.Session{
  const saved=inputSave?root.LWArmoredCheckpoint.validate(inputSave):null;
  const catalog=copy(root.LWArmoredCatalog.validate(saved?.catalog??inputCatalog));
  const mission=catalog.missions.find(m=>m.id===(saved?.missionId??missionId??catalog.missions[0]?.id));
  if(!mission)throw Error('Unknown armored mission.');
  const world=new root.LWECS.World(),scheduler=new root.LWECS.Scheduler();
  let events:LWArmoredRuntime.Event[]=saved?copy(saved.events):[];
  if(saved){for(const entity of saved.entities){world.create(entity.id);for(const [kind,value]of Object.entries(entity.components))world.set(entity.id,kind,value as D);}}
  else{
   world.create('armored-state');
   world.set<LWArmoredRuntime.State>('armored-state','armored-state',{tick:0,sequence:0,serial:0,rng:mission.seed,mission:mission.id,controlled:mission.spawns.find(s=>s.player)?.id??mission.spawns.find(s=>s.faction===mission.playerFaction)!.id,status:'running',terrainRevision:0,objectives:Object.fromEntries(mission.objectives.map(o=>[o.id,0]))});
   for(const spawn of mission.spawns){
    const spec=catalog.vehicles.find(v=>v.id===spawn.vehicle)!;world.create(spawn.id);
    const transform:LWArmoredRuntime.Transform={position:{...spawn.position,y:root.LWArmoredPhysics.height(mission.terrain,spawn.position.x,spawn.position.z)+spec.groundClearance},yaw:spawn.yaw,pitch:0,roll:0};
    world.set(spawn.id,'armored-transform',transform);world.set(spawn.id,'armored-previous',copy(transform));
    world.set(spawn.id,'armored-identity',{definition:spec.id,faction:spawn.faction});
    world.set(spawn.id,'armored-body',{velocity:{x:0,y:0,z:0},yawVelocity:0,leftForce:0,rightForce:0,contacts:6,slip:0,grounded:true});
    world.set(spawn.id,'armored-motor',{throttle:0,steer:0,brake:0,cruise:0});
    const weapon=root.LWArmoredCombat.initialWeapon(spec,catalog);weapon.turretYaw=spawn.yaw;weapon.aimYaw=spawn.yaw;
    world.set(spawn.id,'armored-weapon',weapon);world.set(spawn.id,'armored-damage',root.LWArmoredCombat.initialDamage(spec));
    world.set(spawn.id,'armored-order',{kind:'hold',targetId:'',position:copy(spawn.position)});
    world.set(spawn.id,'armored-perception',{targetId:'',acquired:0,contacts:[]});
   }
   for(const obstacle of mission.obstacles){const id='obstacle:'+obstacle.id;world.create(id);world.set(id,'armored-obstacle',{definition:obstacle.id,health:obstacle.health,destroyed:false});}
  }
  const state=world.get<LWArmoredRuntime.State>('armored-state','armored-state')!;
  const ctx:LWArmoredRuntime.Context={world,catalog,mission,state,emit(event){events.push({...copy(event),tick:state.tick,sequence:state.sequence});if(events.length>128)events.shift();},random(){state.rng=(Math.imul(state.rng,1664525)+1013904223)>>>0;return state.rng/4294967296;}};
  root.LWArmoredAI.register(scheduler,ctx);root.LWArmoredPhysics.register(scheduler,ctx);
  root.LWArmoredCombat.register(scheduler,ctx);root.LWArmoredMission.register(scheduler,ctx);
  const reject=(message:string):R=>({ok:false,message});
  function command(raw:C):R{
   let cmd:C;
   try{const preview=new root.LWECS.World();preview.create('command');preview.set('command','command',raw);cmd=copy(raw);}catch{return reject('Commands must contain plain finite data.');}
   if(state.status!=='running')return reject('Mission has ended.');
   if(typeof cmd.kind!=='string')return reject('Command kind is required.');
   const fields:Record<string,string[]>={drive:['throttle','steer','brake','cruise'],control:[],aim:['yaw','elevation'],fire:['pressed'],ammo:['ammo'],order:['order','targetId','position'],repair:[],resupply:[]};
   const extra=fields[cmd.kind];if(!extra)return reject('Unknown armored command.');
   if(Object.keys(cmd).some(k=>!['kind','sequence','entityId','entityIds','faction',...extra].includes(k)))return reject('Unknown command field.');
   if(cmd.sequence!==undefined&&(!Number.isSafeInteger(cmd.sequence)||cmd.sequence!==state.sequence+1))return reject('Stale or out-of-order command.');
   if(cmd.position!==undefined&&(!cmd.position||!['x','y','z'].every(axis=>typeof cmd.position![axis as keyof LWArmoredData.Vec3]==='number'&&Number.isFinite(cmd.position![axis as keyof LWArmoredData.Vec3]))))return reject('Position requires finite x, y and z.');
   if(cmd.targetId!==undefined&&typeof cmd.targetId!=='string')return reject('Target ID must be a string.');
   const faction=cmd.faction??mission!.playerFaction;
   if(faction!==mission!.playerFaction)return reject('Only the player faction can submit local commands.');
   const ids=cmd.entityIds??[cmd.entityId??state.controlled];
   if(!Array.isArray(ids)||!ids.length||ids.length>64||new Set(ids).size!==ids.length)return reject('Choose unique owned vehicles.');
   for(const id of ids){const identity=world.get<LWArmoredRuntime.Identity>(id,'armored-identity');if(!identity||identity.faction!==faction||world.get<LWArmoredRuntime.Damage>(id,'armored-damage')?.status==='destroyed')return reject('Choose an available owned vehicle.');}
   if(cmd.kind!=='order'&&ids.length!==1)return reject('This command requires one vehicle.');
   cmd.entityIds=ids;cmd.entityId=ids[0]!;cmd.faction=faction;
   let result:R|null=null;
   if(cmd.kind==='control'){
    const previous=world.get<LWArmoredRuntime.Motor>(state.controlled,'armored-motor')!;previous.throttle=0;previous.steer=0;previous.brake=1;previous.cruise=0;
    world.get<LWArmoredRuntime.Weapon>(state.controlled,'armored-weapon')!.trigger=false;
    state.controlled=ids[0]!;result={ok:true,message:'Direct control transferred.'};
   }else if(cmd.kind==='drive'){
    if(ids[0]!==state.controlled)return reject('Driving requires direct control.');
    const spec=catalog.vehicles.find(v=>v.id===world.get<LWArmoredRuntime.Identity>(ids[0]!,'armored-identity')!.definition)!;
    for(const [key,min,max]of [['throttle',-1,1],['steer',-1,1],['brake',0,1],['cruise',-spec.reverseSpeed,spec.maxSpeed]] as const){const value=cmd[key];if(value!==undefined&&(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max))return reject('Motor input outside bounds.');}
    const motor=world.get<LWArmoredRuntime.Motor>(ids[0]!,'armored-motor')!;
    for(const key of ['throttle','steer','brake','cruise'] as const)if(cmd[key]!==undefined)motor[key]=cmd[key]!;
    result={ok:true,message:'Motor input accepted.'};
   }else result=root.LWArmoredCombat.command?.(ctx,cmd)??root.LWArmoredAI.command?.(ctx,cmd)??root.LWArmoredMission.command?.(ctx,cmd)??reject('Unsupported command.');
   if(result.ok){state.sequence++;result.sequence=state.sequence;}
   return result;
  }
  function query(faction=mission!.playerFaction):LWArmoredRuntime.Snapshot{
   const ids=world.query(['armored-identity','armored-transform']);const visible=new Set<string>();
   for(const id of ids){const owner=world.get<LWArmoredRuntime.Identity>(id,'armored-identity')!;if(!faction||owner.faction===faction){visible.add(id);for(const contact of world.get<LWArmoredRuntime.Perception>(id,'armored-perception')!.contacts)if(state.tick-contact.tick<6&&world.get<LWArmoredRuntime.Damage>(id,'armored-damage')!.status!=='destroyed'&&root.LWArmoredAI.visible(ctx,id,contact.id))visible.add(contact.id);}}
   const vehicles=ids.filter(id=>visible.has(id)).map(id=>({id,...world.get<LWArmoredRuntime.Identity>(id,'armored-identity')!,transform:world.get<LWArmoredRuntime.Transform>(id,'armored-transform')!,previous:world.get<LWArmoredRuntime.Transform>(id,'armored-previous')!,body:world.get<LWArmoredRuntime.Body>(id,'armored-body')!,motor:world.get<LWArmoredRuntime.Motor>(id,'armored-motor')!,weapon:world.get<LWArmoredRuntime.Weapon>(id,'armored-weapon')!,damage:world.get<LWArmoredRuntime.Damage>(id,'armored-damage')!,order:world.get<LWArmoredRuntime.Order>(id,'armored-order')!}));
   const projectiles=world.query(['armored-projectile']).map(id=>({id,...world.get<LWArmoredRuntime.Projectile>(id,'armored-projectile')!})).filter(p=>!faction||p.faction===faction||visible.has(p.source));
   const environment=new Set(['terrain',...mission!.obstacles.map(o=>'obstacle:'+o.id)]);
   function exposed(event:LWArmoredRuntime.Event,key:string):boolean{
    if(!event[key]||visible.has(String(event[key])))return true;
    return environment.has(String(event[key]))&&world.get<LWArmoredRuntime.Identity>(String(event.source),'armored-identity')?.faction===faction;
   }
   const safeEvents=events.filter(e=>!faction||exposed(e,'source')&&exposed(e,'target')&&exposed(e,'entityId'));
   return copy({format:'wildlands-armored-snapshot',version:1,tick:state.tick,seconds:state.tick/60,status:state.status,controlled:state.controlled,missionId:mission!.id,playerFaction:mission!.playerFaction,vehicles,projectiles,events:safeEvents,objectives:state.objectives,terrainRevision:state.terrainRevision,obstacles:mission!.obstacles.map(o=>({...o,...world.get('obstacle:'+o.id,'armored-obstacle')!})),smoke:world.query(['armored-smoke']).map(id=>({...world.get(id,'armored-smoke')!,id}))}) as LWArmoredRuntime.Snapshot;
  }
  function step(ticks=1):void{
   if(!Number.isSafeInteger(ticks)||ticks<0||ticks>36000)throw Error('Armored step count must be 0..36000.');
   for(let i=0;i<ticks&&state.status==='running';i++){state.tick++;scheduler.step(world,1/60);}
  }
  function checkpoint():CP{
   const stores=(world as unknown as {stores:ReadonlyMap<string,ReadonlyMap<string,D>>}).stores;
   const entities=[...world.entities].sort().map(id=>({id,components:Object.fromEntries([...stores].filter(([,store])=>store.has(id)).map(([kind,store])=>[kind,store.get(id)!]))}));
   return copy({format:'wildlands-armored-checkpoint',version:1,solver:'tracked-force-v1',fixedStep:1/60,catalog,missionId:mission!.id,entities,events});
  }
  return Object.freeze({command,query,step,checkpoint});
 }
 function restore(value:unknown):LWArmoredRuntime.Session{const save=root.LWArmoredCheckpoint.validate(value);return create(save.catalog,save.missionId,save);}
 const api={create,restore};root.LWArmored=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
