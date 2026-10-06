/// <reference path="./rts-runtime-contracts.d.ts" />
/// <reference path="./rts-contracts.d.ts" />
/** Detached hostile-checkpoint admission, before any authoritative world is constructed. */
(function(input:unknown){
 'use strict';
 type D=LWRTSRuntime.Data;
 interface RecordEntity {id:string;components:D;}
 const root=input as {LWRTSCatalog:LWRTSData.CatalogApi;LWRTSCheckpoint?:unknown};
 const fail=(reason:string):never=>{throw Error('RTS checkpoint: '+reason);};
 const plain=(value:unknown):value is D=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
 const record=(value:unknown,label:string):D=>plain(value)?value:fail(label+' must be a plain object');
 function exact(value:unknown,keys:string[],label:string,optional:string[]=[]):D {
  const out=record(value,label);
  if(keys.some(key=>!Object.hasOwn(out,key))||Object.keys(out).some(key=>!keys.includes(key)&&!optional.includes(key)))fail(label+' has missing or unknown fields');
  return out;
 }
 function number(value:unknown,label:string,min=0,max=1e12,whole=false):number {
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(whole&&!Number.isSafeInteger(value)))return fail(label+' must be a bounded number');
  return value;
 }
 function text(value:unknown,label:string,empty=false):string {
  if(typeof value!=='string'||value.length>128||(!empty&&!value.length))return fail(label+' must be bounded text');
  return value;
 }
 function list(value:unknown,label:string,max=4096):unknown[] {
  if(!Array.isArray(value)||value.length>max)return fail(label+' must be a bounded array');
  return value;
 }
 function boolean(value:unknown,label:string):boolean {if(typeof value!=='boolean')return fail(label+' must be boolean');return value;}
 function inert(value:unknown):void {
  const ancestors=new Set<object>();let count=0;
  function visit(entry:unknown,depth:number):void {
   if(++count>1000000||depth>32)fail('complexity limit');
   if(typeof entry==='string'&&entry.length>8192)fail('string length limit');
   if(entry===null||typeof entry==='string'||typeof entry==='boolean'||(typeof entry==='number'&&Number.isFinite(entry)))return;
   if(!Array.isArray(entry)&&!plain(entry))fail('only inert JSON values are supported');
   const object=entry as object;
   if(ancestors.has(object)||Object.getOwnPropertySymbols(object).length)fail('cycle or symbol');
   ancestors.add(object);const descriptors=Object.getOwnPropertyDescriptors(object);
   if(Array.isArray(entry)&&(Object.keys(descriptors).length!==entry.length+1||Array.from({length:entry.length},(_,i)=>i).some(i=>!Object.hasOwn(descriptors,String(i)))))fail('sparse or extended array');
   for(const [key,descriptor] of Object.entries(descriptors)) {
    if(Array.isArray(entry)&&key==='length')continue;
    if(['__proto__','constructor','prototype'].includes(key)||descriptor.get||descriptor.set||!descriptor.enumerable)fail('reserved or executable property');
    visit(descriptor.value,depth+1);
   }
   ancestors.delete(object);
  }
  visit(value,0);
 }
 function validate(value:unknown):D {
  inert(value);const save=exact(value,['format','version','catalog','missionId','entities','events'],'checkpoint');
  if(save.format!=='wildlands-rts-checkpoint'||save.version!==1)fail('unsupported format/version');
  const catalog=root.LWRTSCatalog.validate(save.catalog);
  const mission=catalog.missions.find(entry=>entry.id===save.missionId);if(!mission)fail('unknown mission');
  const selected=mission!;
  const entities=list(save.entities,'entities',1200).map(raw=>exact(raw,['id','components'],'entity') as unknown as RecordEntity);
  const byId=new Map<string,RecordEntity>();
  for(const entity of entities) {
   const id=text(entity.id,'entity ID');
   if(!/^(rts-state|faction:[a-z][a-z0-9_-]{0,63}|deposit:[0-9]{1,4}|item:[0-9]{1,4}|projectile:[0-9]{1,12}|rts:[0-9]{6,12})$/.test(id)||byId.has(id))fail('invalid or duplicate entity ID');
   record(entity.components,'components');byId.set(id,entity);
  }
  const stateEntity=byId.get('rts-state');if(!stateEntity)fail('missing state entity');
  const singleton=exact(stateEntity!.components,['rts-state','rts-map','rts-fog'],'state components',['rts-reveal']);
  const state=exact(singleton['rts-state'],['tick','status','serial','mission'],'state');
  number(state.tick,'tick',0,1e12,true);number(state.serial,'serial',0,1e12,true);
  if(state.mission!==selected.id||!['running','victory','defeat'].includes(String(state.status)))fail('invalid mission/status');
  const map=exact(singleton['rts-map'],['width','height','tiles','blocked'],'map');
  if(map.width!==selected.width||map.height!==selected.height)fail('map dimensions disagree with mission');
  const tiles=list(map.tiles,'tiles',65536),blocked=list(map.blocked,'blocked',65536);
  if(tiles.length!==selected.width*selected.height||tiles.some(id=>!catalog.terrain.some(terrain=>terrain.id===id)))fail('invalid terrain tiles');
  const authoredTiles=Array<string>(selected.width*selected.height).fill(selected.defaultTerrain);
  for(const patch of selected.terrain)for(let y=patch.y;y<patch.y+patch.height;y++)for(let x=patch.x;x<patch.x+patch.width;x++)authoredTiles[y*selected.width+x]=patch.terrain;
  if(tiles.some((tile,index)=>tile!==authoredTiles[index]))fail('terrain map disagrees with frozen mission');
  const cell=(value:unknown):string=>{
   const key=text(value,'cell'),parts=key.split(',');
   if(parts.length!==2||!parts.every(part=>/^(0|[1-9][0-9]*)$/.test(part)))return fail('invalid map cell');
   const x=Number(parts[0]),y=Number(parts[1]);if(x>=selected.width||y>=selected.height)fail('cell outside map');return key;
  };
  blocked.forEach(cell);if(new Set(blocked).size!==blocked.length)fail('duplicate blocked cell');
  const position=(value:unknown,label:string):D=>{
   const out=exact(value,['x','y'],label);number(out.x,label+'.x',0,selected.width);number(out.y,label+'.y',0,selected.height);
   if(Number(out.x)>=selected.width||Number(out.y)>=selected.height)fail(label+' outside map');return out;
  };
  const faction=(value:unknown):string=>{
   const id=text(value,'faction');if(!catalog.factions.some(entry=>entry.id===id))fail('unknown faction');return id;
  };
  const resources=(value:unknown,label:string):D=>{
   const out=record(value,label);for(const [id,amount]of Object.entries(out)){if(!catalog.resources.some(entry=>entry.id===id))fail('unknown resource');number(amount,label+'.'+id);}return out;
  };
  const fog=exact(singleton['rts-fog'],['visible','explored'],'fog');
  for(const key of ['visible','explored']) {
   const values=record(fog[key],'fog '+key);
   if(Object.keys(values).length!==catalog.factions.length||catalog.factions.some(faction=>!Object.hasOwn(values,faction.id)))fail('fog missing faction projection');
   for(const [id,cells]of Object.entries(values)) {
   faction(id);const entries=list(cells,'fog cells',65536);entries.forEach(cell);if(new Set(entries).size!==entries.length)fail('duplicate fog cell');
  }
  }
  if(singleton['rts-reveal']) {
   const reveal=exact(singleton['rts-reveal'],['areas'],'reveal');
   for(const raw of list(reveal.areas,'reveal areas',256)) {
    const area=exact(raw,['faction','x','y','radius','expires'],'reveal area');faction(area.faction);position({x:area.x,y:area.y},'reveal position');number(area.radius,'reveal radius',0,256);number(area.expires,'reveal expiry',0,1e12,true);
   }
  }
  const expectedBlocked=new Set<string>();let maximumSerial=0;
  for(const entity of entities) {
   if(entity.id==='rts-state')continue;
   const components=entity.components;
   if(entity.id.startsWith('projectile:')) {
    exact(components,['rts-projectile'],'projectile components');
    const projectile=exact(components['rts-projectile'],['source','target','x','y','targetX','targetY','speed','damage','splash','faction','targets'],'projectile');
    faction(projectile.faction);text(projectile.source,'projectile source');text(projectile.target,'projectile target');
    position({x:projectile.x,y:projectile.y},'projectile position');position({x:projectile.targetX,y:projectile.targetY},'projectile target');
    number(projectile.speed,'projectile speed',.000001,1e6);number(projectile.damage,'projectile damage',0,1e12);number(projectile.splash,'projectile splash',0,1e6);
    const targets=list(projectile.targets,'projectile targets',3);if(targets.some(value=>!['land','water','air'].includes(String(value)))||new Set(targets).size!==targets.length)fail('invalid projectile target classes');
    maximumSerial=Math.max(maximumSerial,Number(entity.id.slice(11)));continue;
   }
   if(entity.id.startsWith('item:')) {
    exact(components,['rts-position','rts-kind','rts-item'],'item components');position(components['rts-position'],'item position');
    const kind=exact(components['rts-kind'],['definition','category'],'item kind'),item=catalog.items.find(entry=>entry.id===kind.definition),charges=exact(components['rts-item'],['charges'],'item charges');
    if(!item||kind.category!=='item')fail('unknown item archetype');
    const authored=selected.items[Number(entity.id.slice(5))],pos=components['rts-position'] as D;
    if(!authored||authored.item!==item!.id||pos.x!==authored.x||pos.y!==authored.y)fail('item placement mismatch');
    number(charges.charges,'item charges',1,item!.charges,true);continue;
   }
   if(entity.id.startsWith('faction:')) {
    exact(components,['rts-owner','rts-faction'],'faction components');
    const owner=exact(components['rts-owner'],['faction'],'faction owner'),id=faction(owner.faction);
    if(entity.id!=='faction:'+id)fail('faction entity identity mismatch');
    const bank=exact(components['rts-faction'],['resources','technologies','population','populationCap','power'],'faction state');resources(bank.resources,'faction resources');
    const technologies=list(bank.technologies,'technologies',128);
    if(new Set(technologies).size!==technologies.length)fail('duplicate researched technology');
    const allowed=catalog.factions.find(entry=>entry.id===id)!;
    for(const technology of technologies)if(typeof technology!=='string'||!allowed.technologies.includes(technology))fail('unknown or unavailable researched technology');
    for(const technology of technologies)if(!catalog.technologies.find(entry=>entry.id===technology)!.prerequisites.every(required=>technologies.includes(required)))fail('researched technology missing prerequisites');
    number(bank.population,'population',0,1e6);number(bank.populationCap,'population capacity',0,1e6);number(bank.power,'power',-1e6,1e6);continue;
   }
   if(entity.id.startsWith('deposit:')) {
    exact(components,['rts-position','rts-kind','rts-node'],'deposit components');position(components['rts-position'],'deposit position');
    const kind=exact(components['rts-kind'],['definition','category'],'deposit kind'),node=exact(components['rts-node'],['resource','remaining'],'deposit');
    const index=Number(entity.id.slice(8)),definition=selected.deposits[index];
    if(!definition||kind.category!=='resource'||kind.definition!==definition.resource||node.resource!==definition.resource)fail('deposit identity mismatch');
    const pos=components['rts-position'] as D;if(pos.x!==definition!.x||pos.y!==definition!.y)fail('deposit placement mismatch');
    number(node.remaining,'deposit stock',0,definition!.amount);continue;
   }
   maximumSerial=Math.max(maximumSerial,Number(entity.id.slice(4)));
   const kind=exact(components['rts-kind'],['definition','category'],'kind');
   const unit=catalog.units.find(entry=>entry.id===kind.definition),building=catalog.buildings.find(entry=>entry.id===kind.definition),definition=unit||building;
   if(!definition||kind.category!==(unit?'unit':'building'))fail('unknown entity archetype/category');
   const required=['rts-position','rts-owner','rts-kind','rts-health','rts-order','rts-abilities','rts-inventory',...(unit?['rts-unit']:['rts-building','rts-production']),...(definition!.attack?['rts-weapon']:[]),...(unit?.role==='worker'?['rts-worker']:[])];
   exact(components,required,'actor components',unit?['rts-patrol']:[]);
   if(components['rts-patrol'])position(components['rts-patrol'],'patrol origin');position(components['rts-position'],'actor position');
   const owner=exact(components['rts-owner'],['faction'],'owner'),ownerId=faction(owner.faction),factionDefinition=catalog.factions.find(entry=>entry.id===ownerId)!;
   if(!(unit?factionDefinition.units:factionDefinition.buildings).includes(definition!.id))fail('entity archetype unavailable to owner');
   const health=exact(components['rts-health'],['hp','max','armor'],'health');number(health.max,'maximum HP',.000001);number(health.hp,'HP',0,Number(health.max));
   if(health.armor!==definition!.armor)fail('archetype armor mismatch');
   const researched=(byId.get('faction:'+ownerId)!.components['rts-faction'] as D).technologies as string[];
   let maximum=definition!.hp;const permittedMaxima=[maximum];
   if(unit)for(const technology of researched) {
    for(const effect of catalog.technologies.find(entry=>entry.id===technology)!.effects)if(effect.stat==='maxHp'&&(!effect.roles.length||effect.roles.includes(unit.role)))maximum*=effect.factor;
    permittedMaxima.push(maximum);
   }
   if(!permittedMaxima.includes(Number(health.max)))fail('maximum HP disagrees with archetype and research');
   const order=exact(components['rts-order'],['kind','targetId','x','y','path','cursor'],'order');
   if(!['stop','move','attack','attackMove','patrol','gather','build','repair'].includes(String(order.kind)))fail('unknown order kind');
   text(order.targetId,'order target',true);position({x:order.x,y:order.y},'order destination');
   const path=list(order.path,'path',65536);path.forEach(point=>position(point,'path point'));number(order.cursor,'path cursor',0,path.length,true);
   const inventory=exact(components['rts-inventory'],['items'],'inventory');
   for(const [id,count]of Object.entries(record(inventory.items,'inventory items'))) {if(!catalog.items.some(item=>item.id===id))fail('unknown inventory item');number(count,'item quantity',0,1e6,true);}
   const abilities=exact(components['rts-abilities'],['cooldowns'],'abilities');
   for(const [id,expiry]of Object.entries(record(abilities.cooldowns,'cooldowns'))) {if(!unit?.abilities.includes(id)&&!catalog.items.some(item=>item.ability===id))fail('unavailable ability cooldown');number(expiry,'cooldown expiry',0,1e12,true);}
   if(unit) {
    const actual=exact(components['rts-unit'],['speed','movement','sight','radius','population','role'],'unit');
    for(const key of ['speed','movement','sight','radius','population','role'] as const)if(actual[key]!==unit[key])fail('unit archetype field mismatch '+key);
    if(unit.role==='worker') {
     const worker=exact(components['rts-worker'],['capacity','rate','buildRate','carried','resource'],'worker',['nodeId','returning']);
     if(worker.capacity!==unit.carryCapacity||worker.rate!==unit.gatherRate||worker.buildRate!==unit.buildRate)fail('worker archetype mismatch');
     number(worker.carried,'worker cargo',0,unit.carryCapacity);text(worker.resource,'worker resource',true);
     if(worker.resource!==''&&!catalog.resources.some(entry=>entry.id===worker.resource))fail('unknown worker resource');
     if(worker.nodeId!==undefined)text(worker.nodeId,'worker node',true);if(worker.returning!==undefined)boolean(worker.returning,'worker returning');
    }
   }else {
    const construction=exact(components['rts-building'],['complete','progress'],'building');boolean(construction.complete,'construction complete');number(construction.progress,'construction progress',0,1);
    if(construction.complete!==((construction.progress as number)>=1))fail('construction completion mismatch');
    const queue=exact(components['rts-production'],['queue'],'production');
    for(const raw of list(queue.queue,'queue',20)) {
     const job=exact(raw,['kind','definitionId','remaining','total','cost','population'],'production job');
     if(job.kind!=='unit'&&job.kind!=='technology')fail('unknown production job kind');
     const entry=job.kind==='unit'?catalog.units.find(value=>value.id===job.definitionId):catalog.technologies.find(value=>value.id===job.definitionId);
     if(!entry||!(job.kind==='unit'?building!.produces:building!.researches).includes(entry!.id))fail('invalid queued definition');
     if(!(job.kind==='unit'?factionDefinition.units:factionDefinition.technologies).includes(entry!.id)||!entry!.prerequisites.every(required=>researched.includes(required)))fail('queued definition unavailable to owner');
     if(job.kind==='technology'&&researched.includes(entry!.id))fail('queued technology already researched');
     const total=job.kind==='unit'?(entry as LWRTSData.Unit).buildTime:(entry as LWRTSData.Technology).researchTime;
     if(job.total!==total||job.population!==(job.kind==='unit'?(entry as LWRTSData.Unit).population:0))fail('production reservation mismatch');
     number(job.remaining,'job remaining',0,total);resources(job.cost,'reserved cost');
     if(JSON.stringify(Object.entries(job.cost as D).sort())!==JSON.stringify(Object.entries(entry!.cost).sort()))fail('reserved cost mismatch');
    }
    const pos=components['rts-position'] as D,def=building!;
    const startX=Math.floor(Number(pos.x)-def.footprint.width/2),startY=Math.floor(Number(pos.y)-def.footprint.height/2);
    for(let dy=0;dy<def.footprint.height;dy++)for(let dx=0;dx<def.footprint.width;dx++)expectedBlocked.add(cell((startX+dx)+','+(startY+dy)));
   }
   if(definition!.attack) {
    const weapon=exact(components['rts-weapon'],['damage','range','cooldown','projectileSpeed','splash','targets','remaining'],'weapon');
    for(const key of ['damage','range','cooldown','projectileSpeed','splash','targets'] as const)if(JSON.stringify(weapon[key])!==JSON.stringify(definition!.attack[key]))fail('weapon archetype mismatch');
    number(weapon.remaining,'weapon cooldown',0,definition!.attack.cooldown);
   }
  }
  if(Number(state.serial)<maximumSerial)fail('serial would collide with retained entity');
  for(const entry of catalog.factions)if(!byId.has('faction:'+entry.id))fail('missing faction state');
  for(const [index]of selected.deposits.entries())if(!byId.has('deposit:'+index))fail('missing retained deposit');
  if(blocked.length!==expectedBlocked.size||blocked.some(value=>!expectedBlocked.has(String(value))))fail('blocked map disagrees with building footprints');
  const events=list(save.events,'events',128);
  for(const raw of events) {
   const event=record(raw,'event');text(event.kind,'event kind');number(event.tick,'event tick',0,Number(state.tick),true);
  }
  const result=JSON.parse(JSON.stringify(save)) as D;result.catalog=catalog;return result;
 }
 root.LWRTSCheckpoint=Object.freeze({validate});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWRTSCheckpoint;
})(globalThis);
