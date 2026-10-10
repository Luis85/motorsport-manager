/** Complete staged admission for deterministic tracked-force reconstruction inputs. */
(function(input:unknown){
 'use strict';
 const root=input as {LWECS:LWArmoredRuntime.Ecs;LWArmoredCatalog:LWArmoredData.CatalogApi;LWArmoredCheckpoint?:unknown};
 type D=LWArmoredRuntime.Data;type CP=LWArmoredRuntime.Checkpoint;
 const fail=(message:string):never=>{throw Error('Armored checkpoint: '+message);};
 function number(value:unknown,min=-1e9,max=1e9):number{
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)fail('invalid numeric state');return value as number;
 }
 function whole(value:unknown,min=0,max=0xffffffff):void{if(!Number.isSafeInteger(number(value,min,max)))fail('expected bounded integer');}
 function record(value:unknown):D{if(!value||typeof value!=='object'||Array.isArray(value))fail('expected record');return value as D;}
 function vector(value:unknown):void{const v=record(value);for(const key of ['x','y','z'])number(v[key]);}
 function list(value:unknown,max:number):unknown[]{if(!Array.isArray(value)||value.length>max)fail('invalid bounded collection');return value as unknown[];}
 function exact(value:D,keys:string[]):void{if(Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))fail('missing or excess record field');}
 function validate(value:unknown):CP{
  // ECS rejects accessors, cycles, executable properties, non-finite numbers and prototypes before copying.
  const preview=new root.LWECS.World();preview.create('admission');preview.set('admission','checkpoint',value as D);
  const save=JSON.parse(JSON.stringify(value)) as CP;
  if(save.format!=='wildlands-armored-checkpoint'||save.version!==1||save.solver!=='tracked-force-v1'||save.fixedStep!==1/60)fail('unsupported format or solver');
  save.catalog=root.LWArmoredCatalog.validate(save.catalog);
  const mission=save.catalog.missions.find(m=>m.id===save.missionId);if(!mission)fail('unknown mission');
  const entities=list(save.entities,2048) as CP['entities'],ids=new Set<string>();
  const components=new Map<string,D>();
  const allowed=new Set(['armored-state','armored-transform','armored-previous','armored-body','armored-motor','armored-identity','armored-weapon','armored-damage','armored-order','armored-perception','armored-projectile','armored-obstacle','armored-smoke']);
  for(const entity of entities){
   if(typeof entity.id!=='string'||ids.has(entity.id))fail('duplicate or invalid entity');ids.add(entity.id);
   preview.create(entity.id);const data=record(entity.components);components.set(entity.id,data);
   for(const [kind,entry]of Object.entries(data)){if(!allowed.has(kind))fail('unknown component');preview.set(entity.id,kind,record(entry));}
  }
  const state=record(components.get('armored-state')?.['armored-state']) as LWArmoredRuntime.State;
  whole(state.tick,0,Number.MAX_SAFE_INTEGER);whole(state.sequence,0,Number.MAX_SAFE_INTEGER);whole(state.serial);whole(state.rng);whole(state.terrainRevision);
  if(state.mission!==mission!.id||!['running','victory','defeat'].includes(state.status))fail('invalid mission state');
  const vehicles=new Set<string>();
  for(const [id,data]of components){
   if(data['armored-identity']){
    exact(data,['armored-identity','armored-transform','armored-previous','armored-body','armored-motor','armored-weapon','armored-damage','armored-order','armored-perception']);
    vehicles.add(id);const identity=record(data['armored-identity']);const spec=save.catalog.vehicles.find(v=>v.id===identity.definition);
    const spawn=mission!.spawns.find(s=>s.id===id);
    if(!spec||!spawn||spawn.vehicle!==identity.definition||spawn.faction!==identity.faction)fail('vehicle identity changed');
    for(const kind of ['armored-transform','armored-previous']){const t=record(data[kind]);vector(t.position);for(const key of ['yaw','pitch','roll'])number(t[key],-Math.PI*2,Math.PI*2);}
    const body=record(data['armored-body']);vector(body.velocity);for(const key of ['yawVelocity','leftForce','rightForce','slip'])number(body[key]);whole(body.contacts,0,6);if(typeof body.grounded!=='boolean')fail('invalid grounding');
    const motor=record(data['armored-motor']);number(motor.throttle,-1,1);number(motor.steer,-1,1);number(motor.brake,0,1);number(motor.cruise,-spec!.reverseSpeed,spec!.maxSpeed);
    const weapon=record(data['armored-weapon']);for(const key of ['turretYaw','aimYaw'])number(weapon[key],-Math.PI*2,Math.PI*2);
    for(const key of ['elevation','aimElevation'])number(weapon[key],spec!.minElevation,spec!.maxElevation);
    number(weapon.reload,0,spec!.reloadSeconds*2);number(weapon.recoil,0,1);if(typeof weapon.trigger!=='boolean'||!spec!.ammunition.includes(String(weapon.ammo)))fail('invalid weapon');
    exact(record(weapon.reserves),spec!.ammunition);let total=0;for(const [ammo,count]of Object.entries(record(weapon.reserves))){if(!spec!.ammunition.includes(ammo))fail('unknown reserve');whole(count,0,spec!.ammoCapacity);total+=Number(count);}if(total>spec!.ammoCapacity)fail('excess ammunition');
    const damage=record(data['armored-damage']);if(!['operational','impaired','immobilized','disabled','destroyed'].includes(String(damage.status)))fail('invalid damage status');
    exact(record(damage.components),['leftTrack','rightTrack','engine','transmission','turretDrive','mantlet','gun','ammunition']);
    exact(record(damage.crew),['commander','gunner','driver','loader']);whole(damage.repairKits,0,spec!.repairKits);number(damage.componentMaximum,spec!.componentHealth,spec!.componentHealth);
    for(const value of Object.values(record(damage.components)))number(value,0,spec!.componentHealth);
    for(const value of Object.values(record(damage.crew)))number(value,0,1);number(damage.fire,0,1e5);number(damage.repair,0,1e5);
    const order=record(data['armored-order']);if(!['hold','follow','charge','secure'].includes(String(order.kind)))fail('invalid order');vector(order.position);if(typeof order.targetId!=='string'||order.targetId&&!mission!.spawns.some(s=>s.id===order.targetId))fail('invalid order target');
    if(order.kind==='follow'){const leader=mission!.spawns.find(s=>s.id===order.targetId);if(!leader||leader.id===id||leader.faction!==identity.faction)fail('invalid follow leader');}
    if(order.path!==undefined){const route=list(order.path,2048);for(const point of route)vector(point);whole(order.cursor,0,route.length);}
    if(order.pathGoal!==undefined)vector(order.pathGoal);if(order.pathRevision!==undefined)whole(order.pathRevision,-1,state.terrainRevision);
    if(order.stuck!==undefined)number(order.stuck,0,3600);if(order.reason!==undefined&&(typeof order.reason!=='string'||order.reason.length>256))fail('invalid path reason');
    const perception=record(data['armored-perception']);number(perception.acquired,0,1e9);if(typeof perception.targetId!=='string'||perception.targetId&&!mission!.spawns.some(s=>s.id===perception.targetId))fail('invalid perception target');
    if(perception.visible!==undefined)for(const target of list(perception.visible,256))if(typeof target!=='string'||!mission!.spawns.some(s=>s.id===target))fail('invalid visibility');
    for(const contact of list(perception.contacts,256)){const c=record(contact);if(typeof c.id!=='string'||!mission!.spawns.some(s=>s.id===c.id))fail('invalid contact');vector(c.position);whole(c.tick,0,state.tick);}
   }else if(data['armored-projectile']){
    if(!/^shell:[0-9]{6,10}$/.test(id)||Number(id.slice(6))>state.serial)fail('invalid shell serial');
    exact(data,['armored-projectile']);const p=record(data['armored-projectile']);const source=mission!.spawns.find(s=>s.id===p.source);if(!source||source.faction!==p.faction||!save.catalog.ammunition.some(a=>a.id===p.ammo))fail('invalid projectile source');
    vector(p.position);vector(p.previous);vector(p.velocity);number(p.age,0,120);if(p.ricochets!==undefined)whole(p.ricochets,0,1);
   }else if(data['armored-obstacle']){
    exact(data,['armored-obstacle']);const o=record(data['armored-obstacle']),spec=mission!.obstacles.find(o=>id==='obstacle:'+o.id);
    if(!spec||o.definition!==spec.id||typeof o.destroyed!=='boolean')fail('invalid obstacle');number(o.health,0,spec!.health);
   }else if(data['armored-smoke']){if(!/^smoke:[0-9]{6,10}$/.test(id)||Number(id.slice(6))>state.serial)fail('invalid smoke serial');exact(data,['armored-smoke']);const s=record(data['armored-smoke']);vector(s.position);number(s.radius,0,1000);number(s.remaining,0,3600);}
   else if(id!=='armored-state')fail('unrecognized entity');else exact(data,['armored-state']);
  }
  if(vehicles.size!==mission!.spawns.length||!vehicles.has(state.controlled)||mission!.spawns.find(s=>s.id===state.controlled)!.faction!==mission!.playerFaction)fail('missing vehicles or invalid control');
  if(mission!.obstacles.some(o=>!components.get('obstacle:'+o.id)?.['armored-obstacle']))fail('missing obstacle');
  exact(record(state.objectives),mission!.objectives.map(o=>o.id));
  for(const [key,progress]of Object.entries(record(state.objectives))){if(!mission!.objectives.some(o=>o.id===key))fail('unknown objective');number(progress,0,1e9);}
  for(const event of list(save.events,128)){const e=record(event);if(typeof e.kind!=='string')fail('invalid event');whole(e.tick,0,state.tick);if(e.sequence!==undefined)whole(e.sequence,0,state.sequence);for(const key of ['source','target','entityId'])if(e[key]!==undefined&&(typeof e[key]!=='string'||!ids.has(String(e[key]))&&e[key]!=='terrain'))fail('invalid event entity');}
  return save;
 }
 root.LWArmoredCheckpoint=Object.freeze({validate});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWArmoredCheckpoint;
})(globalThis);
