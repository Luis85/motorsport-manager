/* Explicit application-command boundary for the composed simulation facade.
 * Command IDs and handler mappings are compiled capabilities; imported JSON cannot add code.
 */
(function(root){
 'use strict';
 const L=root.LW;
 const entries=[
  ['select-creature','selectCreature','world',1,false],
  ['care','care','actor',1,false],
  ['research-skill','research','actor',1,false],
  ['teach-skill','teach','actor',1,false],
  ['practice-skill','practice','actor',2,false],
  ['cancel-lesson','cancelLesson','actor',1,false],
  ['set-learning-style','setLearningStyle','actor',1,false],
  ['pause-learning','pauseLearning','actor',0,false],
  ['choose-specialization','chooseSpecialization','actor',2,false],
  ['start-study','startStudy','actor',1,false],
  ['pause-study','pauseStudy','actor',0,false],
  ['set-allowance','setAllowance','actor',1,false],
  ['top-up','topUp','actor',0,false],
  ['set-stock-target','setStockTarget','actor',2,false],
  ['place-building','place','actor',3,false],
  ['upgrade-building','upgrade','actor',2,false],
  ['request-task','request','actor',3,false],
  ['cancel-plan','cancel','actor',1,false],
  ['pause-plan','pauseOrder','actor',2,false],
  ['prioritize-plan','prioritize','actor',1,false],
  ['request-equipment','requestEquipment','actor',1,false],
  ['unequip','unequip','actor',1,false],
  ['cancel-equipment','cancelEquipment','actor',1,false],
  ['accept-quest','acceptQuest','actor',1,false],
  ['cancel-quest-plan','cancelQuestPlan','actor',0,false],
  ['abort-quest','abortQuest','actor',0,true],
  ['suggest-social','suggestSocial','actor',1,false],
  ['request-unpack','requestUnpack','actor',0,false],
  ['spend-point','spendPoint','actor',1,false],
  ['research-feature','researchFeature','world',1,false],
  ['configure-building','configureBuilding','world',3,false],
  ['assign-home','assignHome','world',2,false],
  ['buy-island','buyIsland','world',2,false],
  ['unlock-slot','unlockSlot','world',0,false],
  ['create-sale','sellItem','world',3,false],
  ['control-sale','controlSale','world',3,false]
 ];
 const manifest=Object.freeze(entries.map(([id,method,scope,maxArgs,away])=>Object.freeze({id,method,scope,maxArgs,away})));
 const byId=new Map(manifest.map(d=>[d.id,d]));
 const safeValue=(value,depth=0)=>{
  if(depth>6)return false;
  if(value===null||['string','boolean'].includes(typeof value))return true;
  if(typeof value==='number')return Number.isFinite(value);
  if(Array.isArray(value))return value.length<=64&&value.every(v=>safeValue(v,depth+1));
  if(typeof value==='object')return Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).length<=64&&!Object.keys(value).some(k=>['__proto__','constructor','prototype'].includes(k))&&Object.values(value).every(v=>safeValue(v,depth+1));
  return false;
 };
 const fail=reason=>({ok:false,reason});
 function dispatch(engine,envelope){
  if(!engine||!envelope||Object.getPrototypeOf(envelope)!==Object.prototype)return fail('Invalid command envelope.');
  if(Object.keys(envelope).some(k=>!['id','actorId','args'].includes(k)))return fail('Unknown command field.');
  const definition=byId.get(envelope.id);if(!definition)return fail('Unknown command.');
  const args=envelope.args??[];
  if(!Array.isArray(args)||args.length>definition.maxArgs||!args.every(v=>safeValue(v)))return fail('Invalid command arguments.');
  const handler=engine[definition.method];if(typeof handler!=='function')return fail('Command handler is unavailable.');
  if(definition.scope==='actor'){
   if(typeof envelope.actorId!=='string'||!/^c[1-9][0-9]*$/.test(envelope.actorId))return fail('Select a valid creature.');
   if(typeof engine.commandActor!=='function')return fail('Actor command boundary is unavailable.');
   return engine.commandActor(envelope.actorId,()=>handler.apply(engine,args),{away:definition.away});
  }
  if(envelope.actorId!==undefined)return fail('This command does not accept an actor.');
  return handler.apply(engine,args);
 }
 function install(Engine){
  if(typeof Engine!=='function')throw Error('Command router requires an engine facade.');
  Object.defineProperty(Engine.prototype,'dispatchCommand',{configurable:false,enumerable:false,writable:false,value:function(envelope){return dispatch(this,envelope);}});
  Object.defineProperty(Engine,'commandManifest',{configurable:false,enumerable:true,value:manifest});
  return Engine;
 }
 const api=Object.freeze({manifest,dispatch,install});root.LWCommandRouter=api;L.CommandRouter=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
