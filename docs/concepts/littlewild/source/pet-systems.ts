/// <reference path="./pet-contracts.d.ts" />
/** Pocket Pet rules on the shared ECS. Every system reads catalog values; only fixed ticks run them. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWPetSystems?:LWPetRuntime.Systems};
 type C=LWPetRuntime.Context;type W=LWPetRuntime.World;
 type Life=LWPetRuntime.Life;type Needs=LWPetRuntime.Needs;type Care=LWPetRuntime.Care;type Clock=LWPetRuntime.Clock;
 const clamp=(value:number,min=0,max=100):number=>Math.min(max,Math.max(min,value));
 const NEEDS=['hunger','joy','energy','hygiene'] as const;
 function alive(world:W):boolean{return world.get<Clock>('pet-state','pet-clock')?.status==='alive';}
 function stage(ctx:C,life:Life):LWPetData.Stage{return ctx.catalog.stages.find(s=>s.id===life.stage)!;}
 function minute(world:W):number{return world.get<Clock>('pet-state','pet-clock')!.minute;}
 /** Apply a finished action exactly once; effects, weight and side effects all come from catalog data. */
 function finish(ctx:C,world:W,id:string):void{
  const activity=world.get<LWPetRuntime.Activity>(id,'pet-activity')!,action=ctx.catalog.actions.find(a=>a.id===activity.action);
  world.defer('remove',id,'pet-activity');
  if(!action)return;
  const life=world.get<Life>(id,'pet-life')!,needs=world.get<Needs>(id,'pet-needs')!,care=world.get<Care>(id,'pet-care')!,now=minute(world);
  const values=needs as unknown as Record<string,number>;
  for(const [key,amount] of Object.entries(action.effects))values[key]=clamp((values[key]??0)+(amount??0));
  life.weight=clamp(life.weight+action.weight,ctx.catalog.rules.minWeight,ctx.catalog.rules.maxWeight);
  if(action.digestMinutes>0)care.digesting.push(now+action.digestMinutes);
  if(action.kind==='treat'){care.snacks.push(now);}
  if(action.kind==='clean')for(const mess of world.query(['pet-mess']))world.defer('destroy',mess);
  if(action.kind==='medicine'){care.sick=false;care.sickFor=0;}
  if(action.kind==='cuddle'&&life.stage==='egg')life.stageAge+=ctx.catalog.rules.eggWarmMinutes;
  ctx.earn(action.coins);
  ctx.emit('finished',life.name+' enjoyed: '+action.name+'.');
 }
 function register(scheduler:LWPetRuntime.Scheduler,ctx:C):void{
  const rules=ctx.catalog.rules,dm=ctx.minutesPerTick,perHour=(rate:number):number=>rate*dm/60;
  scheduler.register({id:'pet.clock',phase:'pre',order:0,query:['pet-clock'],update(world,id){
   const clock=world.get<Clock>(id,'pet-clock')!;clock.tick++;if(clock.status==='alive')clock.minute=Math.round((clock.minute+dm)*1e6)/1e6;
  }});
  scheduler.register({id:'pet.activity',phase:'pre',order:10,query:['pet-activity','pet-life'],update(world,id){
   if(!alive(world))return;
   const activity=world.get<LWPetRuntime.Activity>(id,'pet-activity')!;
   activity.remaining=Math.max(0,activity.remaining-dm);
   if(activity.remaining<=1e-9)finish(ctx,world,id);
  }});
  scheduler.register({id:'pet.metabolism',phase:'simulate',order:10,query:['pet-needs','pet-life','pet-care'],update(world,id){
   if(!alive(world))return;
   const life=world.get<Life>(id,'pet-life')!,needs=world.get<Needs>(id,'pet-needs')!,care=world.get<Care>(id,'pet-care')!,factor=stage(ctx,life).decayFactor;
   if(!factor)return;
   for(const need of ctx.catalog.needs){
    if(need.id==='energy'&&care.sleeping){needs.energy=clamp(needs.energy+perHour(rules.sleepEnergyPerHour)*(care.lights?.5:1));continue;}
    needs[need.id]=clamp(needs[need.id]-perHour(need.decayPerHour)*factor*(care.sleeping?need.sleepFactor:1));
   }
   needs.hygiene=clamp(needs.hygiene-perHour(rules.messHygienePerHour)*world.query(['pet-mess']).length);
   if(care.sleeping&&care.lights)needs.joy=clamp(needs.joy-perHour(rules.lightsOnSleepJoyPerHour));
  }});
  scheduler.register({id:'pet.digestion',phase:'simulate',order:20,query:['pet-care'],update(world,id){
   if(!alive(world))return;
   const care=world.get<Care>(id,'pet-care')!,now=minute(world),due=care.digesting.filter(time=>time<=now);
   if(!due.length)return;
   care.digesting=care.digesting.filter(time=>time>now);
   for(let i=0;i<due.length;i++)ctx.spawnMess();
  }});
  scheduler.register({id:'pet.sleep',phase:'simulate',order:30,query:['pet-care','pet-needs','pet-life'],update(world,id){
   if(!alive(world))return;
   const life=world.get<Life>(id,'pet-life')!,care=world.get<Care>(id,'pet-care')!,needs=world.get<Needs>(id,'pet-needs')!;
   if(life.stage==='egg')return;
   if(!care.sleeping&&needs.energy<=0&&!world.has(id,'pet-activity')){care.sleeping=true;life.mistakes++;ctx.emit('exhausted',life.name+' collapsed from exhaustion. That counts as a care mistake.');}
   else if(care.sleeping&&needs.energy>=rules.wakeEnergy){care.sleeping=false;care.lights=true;ctx.emit('woke',life.name+' woke up refreshed and turned on the lights.');}
  }});
  scheduler.register({id:'pet.health',phase:'simulate',order:40,query:['pet-care','pet-needs','pet-life'],update(world,id){
   if(!alive(world))return;
   const life=world.get<Life>(id,'pet-life')!,care=world.get<Care>(id,'pet-care')!,needs=world.get<Needs>(id,'pet-needs')!,now=minute(world);
   if(life.stage==='egg')return;
   care.snacks=care.snacks.filter(time=>time>now-rules.snackWindowMinutes);
   care.filthFor=needs.hygiene<rules.sickHygieneBelow?care.filthFor+dm:0;
   if(!care.sick&&(care.filthFor>=rules.sickAfterMinutes||care.snacks.length>rules.snackLimit)){
    care.sick=true;care.sickFor=0;ctx.emit('sick',care.snacks.length>rules.snackLimit?life.name+' has a tummy ache from too many treats.':life.name+' got sick from the mess.');
    if(care.snacks.length>rules.snackLimit)care.snacks=[];
   }
   if(care.sick){
    const before=care.sickFor;care.sickFor+=dm;
    if(before<rules.mistakeAfterMinutes&&care.sickFor>=rules.mistakeAfterMinutes){life.mistakes++;ctx.emit('mistake',life.name+' stayed sick without medicine. Care mistake.');}
   }
   let empty=0;
   for(const need of NEEDS){
    const zero=needs[need]<=0&&!(need==='energy'&&care.sleeping);
    const before=care.neglect[need]??0;care.neglect[need]=zero?before+dm:0;
    if(zero)empty++;
    if(zero&&before<rules.mistakeAfterMinutes&&care.neglect[need]!>=rules.mistakeAfterMinutes){
     life.mistakes++;ctx.emit('mistake',life.name+' was left with no '+ctx.catalog.needs.find(n=>n.id===need)!.name.toLowerCase()+' too long. Care mistake.');
    }
   }
   if(care.sick)needs.health=clamp(needs.health-perHour(rules.sickHealthLossPerHour));
   if(empty)needs.health=clamp(needs.health-perHour(rules.healthLossPerHour)*empty);
   else if(!care.sick&&NEEDS.every(need=>needs[need]>=50))needs.health=clamp(needs.health+perHour(rules.healthGainPerHour));
   if(needs.health<=0){
    const clock=world.get<Clock>('pet-state','pet-clock')!;clock.status='departed';care.sleeping=true;
    ctx.emit('departed',life.name+' has returned to the wild meadow. Adopt a new egg when you are ready.');
   }
  }});
  scheduler.register({id:'pet.growth',phase:'post',order:10,query:['pet-life','pet-needs'],update(world,id){
   if(!alive(world))return;
   const life=world.get<Life>(id,'pet-life')!,current=stage(ctx,life);
   life.age+=dm;life.stageAge+=dm;
   if(!current.minutes||life.stageAge<current.minutes)return;
   const next=ctx.catalog.stages[ctx.catalog.stages.indexOf(current)+1];if(!next)return;
   const form=next.models.find(f=>life.mistakes<=f.maxMistakes)!;
   life.stage=next.id;life.form=form.id;life.model=form.model;life.stageAge=0;ctx.earn(ctx.catalog.economy.growthCoins);
   if(current.id==='egg'){
    const needs=world.get<Needs>(id,'pet-needs')!;for(const need of ctx.catalog.needs)needs[need.id]=need.start;
    ctx.emit('hatched',life.name+' hatched! Keep an eye on every need.');
   }else ctx.emit(next.id==='adult'?'evolved':'grew',life.name+' grew into a '+form.name+' '+next.name.toLowerCase()+'.');
  }});
 }
 root.LWPetSystems={register};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWPetSystems;
})(globalThis);
