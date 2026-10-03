/// <reference path="./interaction-contracts.d.ts" />
/* Compose paired interactions around existing creature, social and physical-care authorities. */
(function(inputRoot:unknown){
 'use strict';
 interface FacadeConstructor extends Function {prototype:Record<string,unknown>;import(input:unknown):unknown;}
 const root=inputRoot as {
  LW:{Engine:FacadeConstructor;colony:{profile(id:string):{preferences:{social:number}}}};
  LWContent:{parse(input:unknown,limit:number):unknown};LWInteractions:LWInteraction.Catalog;
  LWInteractionRuntime:LWInteraction.Runtime;
  LWInteractionState:{validate(input:unknown,state:unknown):LWInteraction.State|undefined};
  LWInteractionTriggers:{seek(engine:LWInteraction.Engine,actorId:unknown,definitionId?:unknown,ruleId?:unknown):LWInteraction.Result;cancelSeek(engine:LWInteraction.Engine,actorId:unknown):LWInteraction.Result;step(engine:LWInteraction.Engine):void};
  LWInteractionIntegration?:{install(Engine:FacadeConstructor):void};
 };
 const R=root.LWInteractionRuntime,C=root.LWInteractions,bypass=new WeakSet<object>();
 function install(Engine:FacadeConstructor):void{
  const p=Engine.prototype;
  const care=p.care as LWInteraction.Engine['care'],interact=p.interact as LWInteraction.Engine['interact'];
  const commandActor=p.commandActor as LWInteraction.Engine['commandActor'];
  function delegated<T>(e:LWInteraction.Engine,work:()=>T):T{
   const prior=bypass.has(e);bypass.add(e);try{return work();}finally{if(!prior)bypass.delete(e);}
  }
  Object.assign(p,{
   interactionOptions(this:LWInteraction.Engine,sourceId:string,target:unknown){return R.options(this,sourceId,target);},
   interactionState(this:LWInteraction.Engine){return C.copy(R.state(this));},
   interactionDefinitions(this:LWInteraction.Engine){return C.copy(R.state(this).library);},
   requestInteraction(this:LWInteraction.Engine,id:unknown,sourceId:unknown,target:unknown){return delegated(this,()=>R.request(this,id,sourceId,target));},
   respondInteraction(this:LWInteraction.Engine,id:unknown,accept:unknown){return R.respond(this,id,this.actor.id,accept);},
   cancelInteraction(this:LWInteraction.Engine,id:unknown){return R.cancel(this,id);},
   setInteractionLibrary(this:LWInteraction.Engine,input:unknown){return R.setLibrary(this,input);},
   interactionBusy(this:LWInteraction.Engine,id:string){return R.busy(this,id);},
   stepInteractions(this:LWInteraction.Engine){R.step(this);root.LWInteractionTriggers.step(this);},
   seekDuel(this:LWInteraction.Engine,actorId:unknown,definitionId:unknown=null,ruleId:unknown=null){return root.LWInteractionTriggers.seek(this,actorId,definitionId,ruleId);},
   cancelDuelSeek(this:LWInteraction.Engine,actorId:unknown){return root.LWInteractionTriggers.cancelSeek(this,actorId);},
   stageDuel(this:LWInteraction.Engine,definitionId:unknown,actorA:unknown,actorB:unknown){
    if(!R.state(this).library.definitions.some(d=>d.id===definitionId&&d.executor==='duel'))return {ok:false,reason:'Choose a known duel profile.'};
    return delegated(this,()=>R.request(this,definitionId,actorA,{scope:'creature',id:actorB}));
   },
   disableDuels(this:LWInteraction.Engine){
    const s=this.s.creatureInteractions;if(!s)return;
    for(const r of [...s.active])R.cancel(this,r.id);s.seeks=[];
   },
   stepInteractionActor(this:LWInteraction.Engine,dt:number){
    const day=(this.s as LWInteraction.Engine['s']&{day:number}).day;
    this.ecs.step(this.actor,dt,{day,socialPreference:root.LW.colony.profile(this.actor.personality).preferences.social,loadLevel:this.load().level,hasShelter:this.has('shelter')});
   },
   care(this:LWInteraction.Engine,kind:string){
    if(bypass.has(this))return care.call(this,kind);
    const d=R.state(this).library.definitions.find(d=>d.executor==='care'&&d.action===kind);
    return d?delegated(this,()=>R.request(this,d.id,'player',{scope:'creature',id:this.actor.id})):{ok:false,reason:'Unknown care action.'};
   },
   interact(this:LWInteraction.Engine,actorId:string,instance:string){
    if(bypass.has(this))return interact.call(this,actorId,instance);
    return delegated(this,()=>R.request(this,'growth:'+instance,'player',{scope:'creature',id:actorId}));
   },
   commandActor(this:LWInteraction.Engine,id:string,work:()=>unknown,options?:{away?:boolean}){
    if(!options?.away&&R.busy(this,id))return {ok:false,reason:'Finish or cancel this creature’s interaction first.'};
    return commandActor.call(this,id,work,options);
   }
  });
  // Direct legacy calls share the same pair lock, including simulation-internal task starts.
  for(const name of ['startTask','acceptQuest','depart','suggestSocial','request','requestEquipment','teach','practice']){
   const original=p[name];if(typeof original!=='function')continue;
   p[name]=function(this:LWInteraction.Engine,...args:unknown[]):unknown{
    if(R.busy(this,this.actor.id))return name==='startTask'||name==='depart'?false:{ok:false,reason:'Finish or cancel this creature’s interaction first.'};
    return Reflect.apply(original,this,args);
   };
  }
  const importer=Engine.import;
  Engine.import=function(input:unknown):unknown{
   const copy=root.LWContent.parse(input,12*1024*1024) as {state?:{creatureInteractions?:unknown}};
   if(copy?.state)root.LWInteractionState.validate(copy.state.creatureInteractions,copy.state);
   const result=Reflect.apply(importer,this,[copy]) as {s:{creatureInteractions?:unknown}};
   root.LWInteractionState.validate(result.s.creatureInteractions,result.s);return result;
  };
 }
 root.LWInteractionIntegration=Object.freeze({install});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWInteractionIntegration;
})(globalThis);
