/* Actor ECS: authoritative vitals and activity progression for data-defined creatures.
 * Components bind by reference to existing serialized actor records. Creature, Activity and
 * Intent are transient projections; no ECS-only state is serialized.
 */
(function (inputRoot: unknown) {
 'use strict';

 type ComponentData=Record<string,unknown>;
 type Point={x:number;y:number};
 type Transform=ComponentData&{x:number;y:number;dir?:number};
 type Needs=ComponentData&{food:number;water:number;energy:number;comfort:number;joy:number};
 type Learning=ComponentData&{practiceDay:number;practicedToday:Record<string,unknown>;fatigue:number;recovering:boolean};
 type Feelings=ComponentData&{social:number;anger:number};
 type Task=ComponentData&{kind:string;phase:string;orderId?:string|null;path?:Point[];elapsed?:number;duration:number;style?:string};
 type Intent=ComponentData&{kind:string;phase:string;orderId:string|null;status:'active'|'blocked'|'completed'|'arrived'};
 type Activity=ComponentData&{studying:boolean;working:boolean;walking:boolean;style:string;socialPreference:number;loadLevel:number;hasShelter:boolean};
 type CreatureMarker=ComponentData&{archetype:string;personality:string};
 interface ActorRecord{id:string;archetype:string;personality:string;creature:Transform;needs:Needs;learning:Learning;feelings:Feelings;task?:Task;[key:string]:unknown;}
 interface ActorRules{format:'littlewild-actor-rules';schemaVersion:1;learning:Readonly<{playfulFatigue:number;standardFatigue:number;recoveryRate:number;recoverAt:number;limitAt:number}>;feelings:Readonly<{socialRate:number;socialPreferenceRate:number;angerRate:number}>;needs:Readonly<{workingKinds:readonly string[];foodWork:number;foodIdle:number;waterWork:number;waterIdle:number;energyWork:number;energyIdle:number;walkLoadFactor:number;comfortShelter:number;comfortWithoutShelter:number;joyRate:number}>;}
 interface Binding{type:string;field:string;}
 interface CreatureDefinition{id:string;}
 interface CreatureCatalog{get(id:string):CreatureDefinition|null;supports(archetype:string,personality:string):boolean;componentBindings(archetype:string):readonly Binding[];}
 interface StepInputs{day:number;socialPreference:number;loadLevel:number;hasShelter:boolean;}
 interface ActivityInputs{walkable(x:number,y:number):boolean;moveRate:number;workRate:number;}
 interface ActivityOutcome{state:'idle'|'arrived'|'blocked'|'walking'|'working';completed:boolean;progress:number;intent:Intent|null;}
 interface DynamicsContext{entityId:string;day:number;}
 interface ActivityContext{entityId:string;walkable(x:number,y:number):boolean;moveRate:number;workRate:number;outcome:ActivityOutcome;}
 interface SystemSpec<C>{id:string;phase:'pre'|'simulate'|'post';order:number;query:readonly string[];update(world:WorldApi,id:string,dt:number,context:C):void;}
 interface WorldApi{readonly entities:ReadonlySet<string>;create(id:string):string;destroy(id:string):boolean;set<T extends ComponentData>(id:string,type:string,data:T):T;remove(id:string,type:string):boolean;get<T extends ComponentData=ComponentData>(id:string,type:string):T|undefined;has(id:string,...types:string[]):boolean;}
 interface SchedulerApi{readonly systems:readonly {id:string}[];register<C>(spec:SystemSpec<C>):SchedulerApi;step<C>(world:WorldApi,dt:number,context:C):void;}
 interface EcsApi{World:new()=>WorldApi;Scheduler:new()=>SchedulerApi;}
 interface ContentApi{parse(input:unknown,limit:number):unknown;}
 interface ActorEcsRuntime{readonly world:WorldApi;readonly scheduler:SchedulerApi;readonly dynamics:SchedulerApi;readonly activity:SchedulerApi;readonly rules:ActorRules;sync(actors:readonly ActorRecord[]):void;step(actor:ActorRecord,dt:number,inputs:StepInputs):{studying:boolean};advanceActivity(actor:ActorRecord,dt:number,inputs:ActivityInputs):ActivityOutcome;componentBindings(actor:ActorRecord):readonly Binding[];forget(id:string):boolean;}
 interface ActorEcsApi{create(rules?:unknown):ActorEcsRuntime;validateRules(input:unknown):ActorRules;}
 interface Root{LWECS?:EcsApi;LWContent?:ContentApi;LWActorRules?:unknown;LWCreatures?:CreatureCatalog;LWActorECS?:ActorEcsApi;}

 const root=inputRoot as Root,node=typeof module!=='undefined'&&module.exports;
 const ecs=(node?require('./ecs.js'):root.LWECS) as EcsApi|undefined;
 const content=(node?require('./content-runtime.js'):root.LWContent) as ContentApi|undefined;
 const creatures=(node?require('./creature-catalog.js'):root.LWCreatures) as CreatureCatalog|undefined;
 const DEFAULT=node?require('./content/actor-rules.json') as unknown:root.LWActorRules;
 if(!ecs||!content||!creatures||DEFAULT===undefined)throw Error('Actor ECS dependencies are missing.');
 const E:EcsApi=ecs,C:ContentApi=content,Creatures:CreatureCatalog=creatures;
 const clamp=(value:number):number=>Math.max(0,Math.min(100,value));
 const plain=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
 const exact=(value:unknown,expected:readonly string[],label:string):Record<string,unknown>=>{if(!plain(value)||Object.keys(value).length!==expected.length||expected.some(key=>!Object.hasOwn(value,key)))throw Error('Invalid '+label+' schema.');return value;};
 const bounded=(value:unknown,low:number,high:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=low&&value<=high;
 const number=(value:unknown,low:number,high:number,label:string):number=>{if(!bounded(value,low,high))throw Error('Invalid '+label+'.');return value;};
 const required=<T extends ComponentData>(world:WorldApi,id:string,type:string):T=>{const value=world.get<T>(id,type);if(!value)throw Error('Missing ECS component: '+type);return value;};

 function validateRules(input:unknown):ActorRules {
  const rootRules=exact(C.parse(input,64*1024),['format','schemaVersion','learning','feelings','needs'],'actor rules');
  if(rootRules.format!=='littlewild-actor-rules'||rootRules.schemaVersion!==1)throw Error('Invalid actor rules schema.');
  const learning=exact(rootRules.learning,['playfulFatigue','standardFatigue','recoveryRate','recoverAt','limitAt'],'actor learning rules');
  const feelings=exact(rootRules.feelings,['socialRate','socialPreferenceRate','angerRate'],'actor feelings rules');
  const needs=exact(rootRules.needs,['workingKinds','foodWork','foodIdle','waterWork','waterIdle','energyWork','energyIdle','walkLoadFactor','comfortShelter','comfortWithoutShelter','joyRate'],'actor needs rules');
  const workingKinds=needs.workingKinds;
  if(!Array.isArray(workingKinds)||!workingKinds.length||workingKinds.length>32||new Set(workingKinds).size!==workingKinds.length||workingKinds.some(kind=>typeof kind!=='string'||!(/^[a-z][a-z0-9_-]{0,50}$/.test(kind))))throw Error('Invalid needs rules.');
  const checkedLearning={playfulFatigue:number(learning.playfulFatigue,0,10,'learning rules'),standardFatigue:number(learning.standardFatigue,0,10,'learning rules'),recoveryRate:number(learning.recoveryRate,0,10,'learning rules'),recoverAt:number(learning.recoverAt,0,100,'learning rules'),limitAt:number(learning.limitAt,0,100,'learning rules')};
  if(checkedLearning.recoverAt>=checkedLearning.limitAt)throw Error('Invalid learning or social rules.');
  const checkedFeelings={socialRate:number(feelings.socialRate,0,10,'social rules'),socialPreferenceRate:number(feelings.socialPreferenceRate,0,10,'social rules'),angerRate:number(feelings.angerRate,0,10,'social rules')};
  const needsNumber=(key:string):number=>number(needs[key],0,10,'needs rules');
  return Object.freeze({format:'littlewild-actor-rules',schemaVersion:1,learning:Object.freeze(checkedLearning),feelings:Object.freeze(checkedFeelings),needs:Object.freeze({workingKinds:Object.freeze([...workingKinds] as string[]),foodWork:needsNumber('foodWork'),foodIdle:needsNumber('foodIdle'),waterWork:needsNumber('waterWork'),waterIdle:needsNumber('waterIdle'),energyWork:needsNumber('energyWork'),energyIdle:needsNumber('energyIdle'),walkLoadFactor:needsNumber('walkLoadFactor'),comfortShelter:needsNumber('comfortShelter'),comfortWithoutShelter:needsNumber('comfortWithoutShelter'),joyRate:needsNumber('joyRate')})});
 }

 function create(rules:unknown=DEFAULT):ActorEcsRuntime {
  const tuning=validateRules(rules),world=new E.World(),dynamics=new E.Scheduler(),activity=new E.Scheduler(),workingKinds=new Set(tuning.needs.workingKinds);
  const markers=new Map<string,CreatureMarker>(),boundTypes=new Map<string,Set<string>>(),boundRefs=new Map<string,Map<string,ComponentData>>();

  dynamics.register<DynamicsContext>({id:'practice-day',phase:'pre',order:10,query:['Creature','Learning'],update(w,id,_dt,ctx){const learning=required<Learning>(w,id,'Learning');if(learning.practiceDay!==ctx.day){learning.practiceDay=ctx.day;learning.practicedToday={};}}});
  dynamics.register<DynamicsContext>({id:'learning-fatigue',phase:'simulate',order:10,query:['Creature','Learning','Activity'],update(w,id,dt){const learning=required<Learning>(w,id,'Learning'),a=required<Activity>(w,id,'Activity');learning.fatigue=clamp(learning.fatigue+dt*(a.studying?(a.style==='playful'?tuning.learning.playfulFatigue:tuning.learning.standardFatigue):-tuning.learning.recoveryRate));if(learning.fatigue>=tuning.learning.limitAt)learning.recovering=true;if(learning.fatigue<=tuning.learning.recoverAt)learning.recovering=false;}});
  dynamics.register<DynamicsContext>({id:'social-decay',phase:'simulate',order:20,query:['Creature','Feelings','Activity'],update(w,id,dt){const feelings=required<Feelings>(w,id,'Feelings'),a=required<Activity>(w,id,'Activity');feelings.social=clamp(feelings.social-dt*(tuning.feelings.socialRate+tuning.feelings.socialPreferenceRate*a.socialPreference));feelings.anger=clamp(feelings.anger-dt*tuning.feelings.angerRate);}});
  dynamics.register<DynamicsContext>({id:'needs-decay',phase:'simulate',order:30,query:['Creature','Needs','Activity'],update(w,id,dt){const needs=required<Needs>(w,id,'Needs'),a=required<Activity>(w,id,'Activity'),r=tuning.needs;needs.food=clamp(needs.food-dt*(a.working?r.foodWork:r.foodIdle));needs.water=clamp(needs.water-dt*(a.working?r.waterWork:r.waterIdle));needs.energy=clamp(needs.energy-dt*(a.working?r.energyWork:r.energyIdle)*(a.walking?1+a.loadLevel*r.walkLoadFactor:1));needs.comfort=clamp(needs.comfort-dt*(a.hasShelter?r.comfortShelter:r.comfortWithoutShelter));needs.joy=clamp(needs.joy-dt*r.joyRate);}});

  activity.register<ActivityContext>({id:'task-intent',phase:'pre',order:10,query:['Creature','Task','Intent'],update(w,id,_dt,ctx){const task=required<Task>(w,id,'Task'),intent=required<Intent>(w,id,'Intent');intent.kind=task.kind||'unknown';intent.phase=task.phase||'work';intent.orderId=task.orderId||null;intent.status='active';ctx.outcome.intent=intent;}});
  activity.register<ActivityContext>({id:'task-movement',phase:'simulate',order:10,query:['Creature','Transform','Task','Intent'],update(w,id,dt,ctx){const transform=required<Transform>(w,id,'Transform'),task=required<Task>(w,id,'Task');if(task.phase!=='walk')return;const point=Array.isArray(task.path)?task.path[0]:undefined;if(!point){task.phase='work';ctx.outcome.state='arrived';return;}if(!ctx.walkable(point.x,point.y)){ctx.outcome.state='blocked';return;}const dx=point.x-transform.x,dy=point.y-transform.y,distance=Math.hypot(dx,dy),move=ctx.moveRate*dt;if(dx)transform.dir=dx>0?1:-1;if(distance<=move){transform.x=point.x;transform.y=point.y;task.path!.shift();if(!task.path!.length)task.phase='work';ctx.outcome.state=task.phase==='work'?'arrived':'walking';}else if(distance){transform.x+=dx/distance*move;transform.y+=dy/distance*move;ctx.outcome.state='walking';}else{task.path!.shift();if(!task.path!.length)task.phase='work';ctx.outcome.state=task.phase==='work'?'arrived':'walking';}}});
  activity.register<ActivityContext>({id:'task-work-progress',phase:'simulate',order:20,query:['Creature','Task','Intent'],update(w,id,dt,ctx){const task=required<Task>(w,id,'Task');if(task.phase==='walk'||ctx.outcome.state==='blocked'||ctx.outcome.state==='arrived')return;const before=Number.isFinite(task.elapsed)?task.elapsed as number:0;task.elapsed=before+dt*ctx.workRate;ctx.outcome.state='working';ctx.outcome.progress=task.elapsed-before;ctx.outcome.completed=task.elapsed>=task.duration;}});
  activity.register<ActivityContext>({id:'task-intent-result',phase:'post',order:10,query:['Creature','Intent'],update(w,id,_dt,ctx){const intent=required<Intent>(w,id,'Intent');if(ctx.outcome.state==='blocked')intent.status='blocked';else if(ctx.outcome.completed)intent.status='completed';else if(ctx.outcome.state==='arrived')intent.status='arrived';else intent.status='active';}});

  function componentBindings(actor:ActorRecord):readonly Binding[]{
   if(typeof actor.archetype!=='string'||typeof actor.personality!=='string'||!Creatures.get(actor.archetype)||!Creatures.supports(actor.archetype,actor.personality))throw Error('Unknown creature archetype/personality pairing.');
   return Creatures.componentBindings(actor.archetype);
  }
  function bind(actor:ActorRecord):void{
   if(!actor||typeof actor.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(actor.id))throw Error('Invalid actor entity.');
   const definition=Creatures.get(actor.archetype);
   if(!definition||!Creatures.supports(actor.archetype,actor.personality))throw Error('Unknown creature definition.');
   if(!world.entities.has(actor.id))world.create(actor.id);
   let marker=markers.get(actor.id);
   if(!marker||marker.archetype!==definition.id||marker.personality!==actor.personality){marker={archetype:definition.id,personality:actor.personality};markers.set(actor.id,marker);world.set(actor.id,'Creature',marker);}
   const bindings=componentBindings(actor),next=new Set(bindings.map(binding=>binding.type)),prior=boundTypes.get(actor.id),refs=boundRefs.get(actor.id)||new Map<string,ComponentData>();
   if(prior)for(const type of prior)if(!next.has(type)){if(world.has(actor.id,type))world.remove(actor.id,type);refs.delete(type);}
   for(const binding of bindings){const value=actor[binding.field];if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Missing actor component: '+binding.type);const component=value as ComponentData;if(refs.get(binding.type)!==component){world.set(actor.id,binding.type,component);refs.set(binding.type,component);}}
   boundTypes.set(actor.id,next);boundRefs.set(actor.id,refs);
  }

  const runtime:ActorEcsRuntime={
   world,scheduler:dynamics,dynamics,activity,rules:tuning,componentBindings,
   sync(actors:readonly ActorRecord[]):void{
    if(!Array.isArray(actors))throw Error('Actor sync expects an array.');
    const seen=new Set<string>();
    for(const actor of actors){if(!actor||seen.has(actor.id))throw Error('Invalid or duplicate actor.');seen.add(actor.id);bind(actor);if(actor.task){if(world.get(actor.id,'Task')!==actor.task)world.set(actor.id,'Task',actor.task);}else{if(world.has(actor.id,'Task'))world.remove(actor.id,'Task');if(world.has(actor.id,'Intent'))world.remove(actor.id,'Intent');}}
    for(const id of world.entities)if(!seen.has(id)){world.destroy(id);markers.delete(id);boundTypes.delete(id);boundRefs.delete(id);}
   },
   step(actor:ActorRecord,dt:number,inputs:StepInputs):{studying:boolean}{
    if(!inputs||!Number.isSafeInteger(inputs.day)||!Number.isFinite(inputs.socialPreference)||inputs.socialPreference<0||inputs.socialPreference>100||!Number.isFinite(inputs.loadLevel)||inputs.loadLevel<0||inputs.loadLevel>100||typeof inputs.hasShelter!=='boolean'||!Number.isFinite(dt)||dt<=0||dt>.25)throw Error('Invalid actor ECS inputs.');
    bind(actor);const task=actor.task,values={studying:!!task&&['train','practice'].includes(task.kind)&&task.phase==='work',working:!!task&&workingKinds.has(task.kind),walking:task?.phase==='walk',style:task?.style||'',socialPreference:inputs.socialPreference,loadLevel:inputs.loadLevel,hasShelter:inputs.hasShelter};
    let a=world.get<Activity>(actor.id,'Activity');
    if(!a){a={...values};world.set(actor.id,'Activity',a);}else Object.assign(a,values);
    dynamics.step(world,dt,{entityId:actor.id,day:inputs.day});return{studying:a.studying};
   },
   advanceActivity(actor:ActorRecord,dt:number,inputs:ActivityInputs):ActivityOutcome{
    if(!inputs||typeof inputs.walkable!=='function'||!Number.isFinite(inputs.moveRate)||inputs.moveRate<0||!Number.isFinite(inputs.workRate)||inputs.workRate<0||!Number.isFinite(dt)||dt<=0||dt>.25)throw Error('Invalid activity ECS inputs.');
    if(!actor||typeof actor!=='object')throw Error('Invalid actor entity.');
    const task=actor.task;
    // Native records retain their identity, so validate changed task values before any system runs.
    if(task){
     if(!plain(task)||typeof task.kind!=='string'||!task.kind||
      !['walk','work'].includes(task.phase)||!Number.isFinite(task.duration)||task.duration<0||
      task.elapsed!==undefined&&(!Number.isFinite(task.elapsed)||task.elapsed<0)||
      task.orderId!==undefined&&task.orderId!==null&&typeof task.orderId!=='string'||
      task.style!==undefined&&typeof task.style!=='string'||
      task.path!==undefined&&(!Array.isArray(task.path)||Array.from(task.path).some(point=>
       !plain(point)||!Number.isFinite(point.x)||!Number.isFinite(point.y))))throw Error('Invalid actor task.');
     const transform=actor.creature,point=task.phase==='walk'?task.path?.[0]:undefined;
     if(!plain(transform)||!Number.isFinite(transform.x)||!Number.isFinite(transform.y)||
      point&&(!Number.isFinite(point.x-transform.x)||!Number.isFinite(point.y-transform.y))||
      !Number.isFinite((task.elapsed??0)+dt*inputs.workRate))throw Error('Invalid actor activity state.');
    }
    bind(actor);const outcome:ActivityOutcome={state:'idle',completed:false,progress:0,intent:null},id=actor.id;
    if(!task){if(world.has(id,'Task'))world.remove(id,'Task');if(world.has(id,'Intent'))world.remove(id,'Intent');return outcome;}
    if(world.get(id,'Task')!==task)world.set(id,'Task',task);let intent=world.get<Intent>(id,'Intent');if(!intent){intent={kind:task.kind||'unknown',phase:task.phase||'work',orderId:task.orderId||null,status:'active'};world.set(id,'Intent',intent);}
    activity.step(world,dt,{entityId:id,walkable:inputs.walkable,moveRate:inputs.moveRate,workRate:inputs.workRate,outcome});return outcome;
   },
   forget(id:string):boolean{markers.delete(id);boundTypes.delete(id);boundRefs.delete(id);return world.destroy(id);}
  };
  return Object.freeze(runtime);
 }
 const api:ActorEcsApi=Object.freeze({create,validateRules});
 root.LWActorECS=api;
 if(node)module.exports=api;
})(globalThis);
