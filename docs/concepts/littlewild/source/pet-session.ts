/// <reference path="./pet-contracts.d.ts" />
/** Pocket Pet application authority. Queries are detached; only explicit fixed steps advance ECS time. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWECS:LWPetRuntime.Ecs;LWPetCatalog:LWPetData.CatalogApi;LWPetSystems:LWPetRuntime.Systems;LWPet?:LWPetRuntime.Api};
 type Life=LWPetRuntime.Life;type Needs=LWPetRuntime.Needs;type Care=LWPetRuntime.Care;type Clock=LWPetRuntime.Clock;type Data=LWPetRuntime.Data;
 const STEP=.1,MAX_EVENTS=64,copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
 const plain=(v:unknown):v is Data=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
 const NAME=/^[\p{L}\p{N}][\p{L}\p{N} '’-]{0,23}$/u;
 function initial(catalog:LWPetData.Catalog,species:LWPetData.Species,name:string):{id:string;components:Data}[]{
  const egg=catalog.stages[0]!.models[0]!,needs:Data={health:100};
  for(const need of catalog.needs)needs[need.id]=need.start;
  return [
   {id:'pet-state',components:{'pet-clock':{tick:0,minute:0,serial:0,status:'alive'}}},
   {id:'pet',components:{
    'pet-life':{species:species.id,name,stage:'egg',form:egg.id,model:egg.model,age:0,stageAge:0,mistakes:0,weight:catalog.rules.startWeight,born:0},
    'pet-needs':needs,
    'pet-care':{sleeping:false,lights:true,sick:false,sickFor:0,filthFor:0,neglect:{},snacks:[],digesting:[]}
   }}
  ];
 }
 /** Restored component values must have the authored shape before any system may read them. */
 function checkEntities(catalog:LWPetData.Catalog,entities:unknown):{id:string;components:Data}[]{
  if(!Array.isArray(entities)||entities.length>16)throw Error('Pet checkpoint entities are invalid.');
  const finite=(value:unknown):boolean=>typeof value==='number'&&Number.isFinite(value);
  const records=entities.map(entry=>{
   if(!plain(entry)||typeof entry.id!=='string'||!plain(entry.components))throw Error('Pet checkpoint entity is invalid.');
   return {id:entry.id,components:entry.components};
  });
  const find=(id:string)=>records.find(r=>r.id===id)?.components;
  const clock=find('pet-state')?.['pet-clock'],pet=find('pet');
  if(!plain(clock)||!['alive','departed'].includes(String(clock.status))||!['tick','minute','serial'].every(k=>finite(clock[k])))throw Error('Pet checkpoint clock is invalid.');
  const life=pet?.['pet-life'],needs=pet?.['pet-needs'],care=pet?.['pet-care'];
  if(!plain(life)||!plain(needs)||!plain(care))throw Error('Pet checkpoint pet is incomplete.');
  const stage=catalog.stages.find(s=>s.id===life.stage);
  if(!stage||!stage.models.some(f=>f.id===life.form&&f.model===life.model)||!catalog.species.some(s=>s.id===life.species)||typeof life.name!=='string'||!NAME.test(life.name))throw Error('Pet checkpoint life stage is invalid.');
  if(!['age','stageAge','mistakes','weight','born'].every(k=>finite(life[k]))||!['health',...catalog.needs.map(n=>n.id)].every(k=>finite(needs[k])&&(needs[k] as number)>=0&&(needs[k] as number)<=100))throw Error('Pet checkpoint values are invalid.');
  if(!['sleeping','lights','sick'].every(k=>typeof care[k]==='boolean')||!Array.isArray(care.snacks)||!Array.isArray(care.digesting)||!plain(care.neglect))throw Error('Pet checkpoint care is invalid.');
  const activity=pet!['pet-activity'];
  if(activity!==undefined&&(!plain(activity)||!catalog.actions.some(a=>a.id===activity.action)||!finite(activity.remaining)))throw Error('Pet checkpoint activity is invalid.');
  for(const record of records)if(record.id.startsWith('mess:')){const mess=record.components['pet-mess'];if(!plain(mess)||!finite(mess.x)||!finite(mess.z))throw Error('Pet checkpoint mess is invalid.');}
  else if(record.id!=='pet'&&record.id!=='pet-state')throw Error('Pet checkpoint has an unknown entity.');
  return copy(records);
 }
 function create(catalogInput?:unknown,speciesId?:string,petName?:string,saved?:{entities:unknown;events:unknown}):LWPetRuntime.Session{
  const catalog=root.LWPetCatalog.validate(catalogInput??root.LWPetCatalog.defaults);
  const species=catalog.species.find(s=>s.id===(speciesId??catalog.species[0]!.id));if(!species)throw Error('Unknown pet species.');
  const name=petName??species.name;if(!NAME.test(name))throw Error('Pet names use 1–24 letters, digits, spaces, apostrophes or hyphens.');
  const world=new root.LWECS.World(),scheduler=new root.LWECS.Scheduler(),minutesPerTick=catalog.rules.minutesPerSecond*STEP;
  let events:LWPetRuntime.Event[]=saved?copy(saved.events as LWPetRuntime.Event[]):[];
  if(saved&&(!Array.isArray(events)||events.length>MAX_EVENTS||events.some(e=>!plain(e)||typeof e.kind!=='string'||typeof e.message!=='string')))throw Error('Pet checkpoint events are invalid.');
  function install(records:{id:string;components:Data}[]):void{
   for(const id of world.entities)world.destroy(id);
   for(const record of records){world.create(record.id);for(const [type,value] of Object.entries(record.components))world.set(record.id,type,value as Data);}
  }
  install(saved?checkEntities(catalog,saved.entities):initial(catalog,species,name));
  const clock=():Clock=>world.get<Clock>('pet-state','pet-clock')!,life=():Life=>world.get<Life>('pet','pet-life')!;
  const needs=():Needs=>world.get<Needs>('pet','pet-needs')!,care=():Care=>world.get<Care>('pet','pet-care')!;
  function emit(kind:string,message:string):void{events.push({kind,message,minute:Math.round(clock().minute)});if(events.length>MAX_EVENTS)events.shift();}
  // Messes created during one tick are deferred, so their spots are reserved until the flush.
  const pending:string[]=[];
  const ctx:LWPetRuntime.Context={world,catalog,minutesPerTick,emit,spawnMess(){
   const current=world.query(['pet-mess']);
   if(current.length+pending.length>=catalog.rules.maxMesses)return;
   const used=new Set([...pending,...current.map(id=>{const m=world.get<LWPetRuntime.Mess>(id,'pet-mess')!;return m.x+','+m.z;})]);
   const spot=catalog.scene.messSpots.find(s=>!used.has(s.x+','+s.z));if(!spot)return;
   const id='mess:'+String(++clock().serial).padStart(6,'0');pending.push(spot.x+','+spot.z);
   world.defer('create',id);world.defer('set',id,'pet-mess',{x:spot.x,z:spot.z,minute:clock().minute});
   emit('mess',life().name+' made a little mess.');
  }};
  root.LWPetSystems.register(scheduler,ctx);
  /** One precondition source for commands and for the detached action projection. */
  function blocked(action:LWPetData.Action):string{
   const l=life(),n=needs(),c=care();
   if(clock().status!=='alive')return l.name+' has departed';
   if(!action.stages.includes(l.stage))return l.stage==='egg'?'The egg can only be cuddled or cleaned':'Not available at this stage';
   const current=world.get<LWPetRuntime.Activity>('pet','pet-activity');
   if(current)return l.name+' is busy: '+(catalog.actions.find(a=>a.id===current.action)?.name.toLowerCase()??'busy');
   if(c.sleeping)return l.name+' is asleep';
   if(action.kind==='feed'&&n.hunger>=95)return l.name+' is full';
   if(action.kind==='play'&&n.energy<10)return l.name+' is too tired to play';
   if(action.kind==='medicine'&&!c.sick)return l.name+' is not sick';
   if(action.kind==='clean'&&!world.query(['pet-mess']).length&&n.hygiene>=95)return 'Everything is already clean';
   return '';
  }
  function lights():{command:'sleep'|'wake';label:string;enabled:boolean;reason:string}{
   const c=care(),l=life(),busy=world.has('pet','pet-activity');
   const command=c.lights?'sleep':'wake',label=c.lights?'Lights off':'Lights on';
   const reason=clock().status!=='alive'?l.name+' has departed':l.stage==='egg'?'Eggs do not sleep yet':busy?l.name+' is busy':'';
   return {command,label,enabled:!reason,reason};
  }
  function command(input:unknown):LWPetRuntime.Result{
   let raw:Data;try{if(!plain(input))throw Error();raw=copy(input);}catch{return {ok:false,message:'Commands must be plain JSON objects.'};}
   const allowed:Record<string,string[]>={care:['kind','action'],sleep:['kind'],wake:['kind'],name:['kind','name'],adopt:['kind','species','name']};
   const kind=String(raw.kind);
   if(!Object.hasOwn(allowed,kind))return {ok:false,message:'Unknown pet command.'};
   if(Object.keys(raw).some(key=>!allowed[kind]!.includes(key)))return {ok:false,message:'Unknown command field.'};
   const l=life(),c=care();
   if(kind==='adopt'){
    if(clock().status==='alive')return {ok:false,message:l.name+' still needs you. Restart from the toolbar to begin again.'};
    const next=catalog.species.find(s=>s.id===raw.species);if(!next)return {ok:false,message:'Choose a known species.'};
    const nextName=raw.name===undefined?next.name:String(raw.name);if(!NAME.test(nextName))return {ok:false,message:'Use 1–24 letters, digits, spaces, apostrophes or hyphens.'};
    install(initial(catalog,next,nextName));events=[];emit('adopted','A new '+next.name+' egg arrived. Cuddle it to keep it warm.');
    return {ok:true,message:'A new egg arrived.'};
   }
   if(kind==='name'){
    if(typeof raw.name!=='string'||!NAME.test(raw.name))return {ok:false,message:'Use 1–24 letters, digits, spaces, apostrophes or hyphens.'};
    l.name=raw.name;emit('named','Your pet is now called '+raw.name+'.');return {ok:true,message:'Renamed to '+raw.name+'.'};
   }
   if(kind==='sleep'||kind==='wake'){
    const state=lights();
    if(state.command!==kind)return {ok:false,message:kind==='sleep'?'The lights are already off.':'The lights are already on.'};
    if(!state.enabled)return {ok:false,message:state.reason+'.'};
    if(kind==='sleep'){c.lights=false;c.sleeping=true;emit('sleep','Lights off. '+l.name+' curled up to sleep.');return {ok:true,message:'Lights off. Sweet dreams.'};}
    c.lights=true;
    if(c.sleeping){c.sleeping=false;const n=needs();if(n.energy<50){n.joy=Math.max(0,n.joy-5);emit('woke',l.name+' woke up grumpy.');}else emit('woke',l.name+' woke up.');}
    return {ok:true,message:'Lights on.'};
   }
   const action=catalog.actions.find(a=>a.id===raw.action);
   if(!action)return {ok:false,message:'Choose a known care action.'};
   const reason=blocked(action);if(reason)return {ok:false,message:reason+'.'};
   world.set('pet','pet-activity',{action:action.id,remaining:action.minutes,total:action.minutes});
   emit('started',l.name+': '+action.name+' ('+action.minutes+' min).');
   return {ok:true,message:action.name+' started.'};
  }
  function mood():string{
   const l=life(),n=needs(),c=care();
   if(clock().status!=='alive')return 'departed';if(l.stage==='egg')return 'egg';if(c.sick)return 'sick';if(c.sleeping)return 'sleeping';
   const low=catalog.needs.filter(need=>n[need.id]<need.warnBelow).sort((a,b)=>n[a.id]-n[b.id])[0];
   if(low)return {hunger:'hungry',energy:'sleepy',hygiene:'dirty',joy:'sad'}[low.id];
   const average=catalog.needs.reduce((sum,need)=>sum+n[need.id],0)/catalog.needs.length;
   return average>=72?'happy':'content';
  }
  function query():LWPetRuntime.Snapshot{
   const l=life(),n=needs(),c=care(),k=clock(),stage=catalog.stages.find(s=>s.id===l.stage)!,form=stage.models.find(f=>f.id===l.form)!;
   const species=catalog.species.find(s=>s.id===l.species)!,total=catalog.rules.startHour*60+k.minute;
   const activity=world.get<LWPetRuntime.Activity>('pet','pet-activity'),action=activity?catalog.actions.find(a=>a.id===activity.action):undefined;
   const messes=world.query(['pet-mess']).map(id=>({id,...world.get<LWPetRuntime.Mess>(id,'pet-mess')!}));
   const hour=Math.floor(total/60)%24;
   const alerts:string[]=[];
   if(k.status==='alive'&&l.stage!=='egg'){
    for(const need of catalog.needs)if(n[need.id]<need.warnBelow&&!(need.id==='energy'&&c.sleeping))alerts.push(need.name+' is low');
    if(c.sick)alerts.push(l.name+' is sick');if(messes.length)alerts.push(messes.length===1?'A mess needs cleaning':messes.length+' messes need cleaning');
    if(c.sleeping&&c.lights)alerts.push('The lights are on while '+l.name+' sleeps');
   }
   return copy({
    tick:k.tick,minute:k.minute,clock:{day:Math.floor(total/1440)+1,hour,minute:Math.floor(total%60),night:hour<7||hour>=20},status:k.status,
    pet:{species:species.id,speciesName:species.name,asset:species.asset,name:l.name,stage:l.stage,stageName:stage.name,form:form.id,formName:form.name,model:l.model,
     age:l.age,stageProgress:stage.minutes?Math.min(1,l.stageAge/stage.minutes):1,weight:l.weight,mistakes:l.mistakes},
    needs:catalog.needs.map(need=>({id:need.id,name:need.name,value:Math.round(n[need.id]*10)/10,warn:n[need.id]<need.warnBelow})),
    health:Math.round(n.health*10)/10,sick:c.sick,sleeping:c.sleeping,lights:c.lights,mood:mood(),
    activity:activity&&action?{...activity,kind:action.kind,prop:action.prop}:null,messes,alerts,
    actions:catalog.actions.map(a=>{const reason=blocked(a);return {id:a.id,name:a.name,kind:a.kind,enabled:!reason,reason};}),
    lightsAction:lights(),events
   });
  }
  function step(ticks=1):void{
   if(!Number.isSafeInteger(ticks)||ticks<1||ticks>100000)throw Error('Pet steps must be 1–100000 whole ticks.');
   for(let i=0;i<ticks;i++){pending.length=0;scheduler.step(world,STEP,{});}
  }
  function checkpoint():LWPetRuntime.Checkpoint{
   const entities=[...world.entities].sort().map(id=>{const components:Data={};for(const [type,store] of world.stores)if(store.has(id))components[type]=store.get(id) as Data;return {id,components};});
   return copy({format:'wildlands-pet-checkpoint',schemaVersion:1,catalog,entities,events});
  }
  return {command,query,step,checkpoint,get catalog(){return catalog;}};
 }
 function restore(input:unknown):LWPetRuntime.Session{
  if(!plain(input)||input.format!=='wildlands-pet-checkpoint'||input.schemaVersion!==1)throw Error('Choose a Pocket Pet checkpoint JSON file.');
  return create(input.catalog,undefined,undefined,{entities:input.entities,events:input.events});
 }
 const api:LWPetRuntime.Api={create:(catalog,species,name)=>create(catalog,species,name),restore,STEP};
 root.LWPet=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
