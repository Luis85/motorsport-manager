/** Monotonic, checkpointed mission progress. Terminal outcomes publish once. */
(function(input:unknown){
 'use strict';
 const root=input as {LWArmoredMission?:unknown};
 type C=LWArmoredRuntime.Context;
 function update(ctx:C):void{
  if(ctx.state.status!=='running')return;
  const actors=ctx.world.query(['armored-identity','armored-damage','armored-transform']);
  const alive=actors.filter(id=>ctx.world.get<LWArmoredRuntime.Damage>(id,'armored-damage')!.status!=='destroyed');
  const friendly=alive.filter(id=>ctx.world.get<LWArmoredRuntime.Identity>(id,'armored-identity')!.faction===ctx.mission.playerFaction);
  const finish=(status:'victory'|'defeat',reason:string)=>{ctx.state.status=status;ctx.emit({kind:'mission-ended',status,reason,mission:ctx.mission.id});};
  if(!friendly.length){finish('defeat','The platoon was destroyed.');return;}
  if(ctx.mission.timeLimit>0&&ctx.state.tick/60>=ctx.mission.timeLimit){finish('defeat','Mission time expired.');return;}
  for(const objective of ctx.mission.objectives){
   const previous=ctx.state.objectives[objective.id]||0;
   let progress=previous;
   if(objective.kind==='eliminate'){
    const targets=actors.filter(id=>ctx.world.get<LWArmoredRuntime.Identity>(id,'armored-identity')!.faction===objective.target||id===objective.target);
    progress=targets.filter(id=>['disabled','destroyed'].includes(ctx.world.get<LWArmoredRuntime.Damage>(id,'armored-damage')!.status)).length;
   }else if(objective.kind==='survive')progress=ctx.state.tick/60;
   else if(friendly.some(id=>{const p=ctx.world.get<LWArmoredRuntime.Transform>(id,'armored-transform')!.position;return Math.hypot(p.x-objective.position.x,p.z-objective.position.z)<=objective.radius;}))progress=objective.required;
   ctx.state.objectives[objective.id]=Math.min(objective.required,Math.max(previous,progress));
   if(previous<objective.required&&ctx.state.objectives[objective.id]!>=objective.required)ctx.emit({kind:'objective-completed',objectiveId:objective.id,name:objective.name});
  }
  if(ctx.mission.objectives.length&&ctx.mission.objectives.every(goal=>ctx.state.objectives[goal.id]!>=goal.required))finish('victory','All objectives completed.');
 }
 function register(scheduler:LWArmoredRuntime.Scheduler,ctx:C):void{
  scheduler.register({id:'armored.mission',phase:'post',order:90,query:['armored-state'],update(){update(ctx);}});
 }
 root.LWArmoredMission=Object.freeze({register});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWArmoredMission;
})(globalThis);
