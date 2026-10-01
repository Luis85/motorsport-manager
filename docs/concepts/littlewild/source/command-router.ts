/* Explicit application-command boundary for the composed simulation facade.
 * Command IDs and handler mappings are compiled capabilities; imported JSON cannot add code.
 */
(function(root: any){
 'use strict';

 type Scope = 'world' | 'actor';
 type JsonScalar = null | string | boolean | number;
 type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };
 interface CommandDefinition {
  readonly id: string;
  readonly method: string;
  readonly scope: Scope;
  readonly maxArgs: number;
  readonly away: boolean;
 }
 interface CommandEnvelope {
  id: string;
  actorId?: string;
  args?: JsonValue[];
 }
 interface EngineLike {
  commandActor?: (actorId: string, action: () => unknown, options: { away: boolean }) => unknown;
  [key: string]: unknown;
 }
 interface Failure { ok: false; reason: string; }

 const L=root.LW;
 const definitions: readonly CommandDefinition[] = Object.freeze([
  {id:'select-creature',method:'selectCreature',scope:'world',maxArgs:1,away:false},
  {id:'care',method:'care',scope:'actor',maxArgs:1,away:false},
  {id:'research-skill',method:'research',scope:'actor',maxArgs:1,away:false},
  {id:'teach-skill',method:'teach',scope:'actor',maxArgs:2,away:false},
  {id:'practice-skill',method:'practice',scope:'actor',maxArgs:2,away:false},
  {id:'cancel-lesson',method:'cancelLesson',scope:'actor',maxArgs:0,away:false},
  {id:'set-learning-style',method:'setLearningStyle',scope:'actor',maxArgs:1,away:false},
  {id:'pause-learning',method:'pauseLearning',scope:'actor',maxArgs:0,away:false},
  {id:'choose-specialization',method:'chooseSpecialization',scope:'actor',maxArgs:2,away:false},
  {id:'start-study',method:'startStudy',scope:'actor',maxArgs:1,away:false},
  {id:'pause-study',method:'pauseStudy',scope:'actor',maxArgs:0,away:false},
  {id:'set-allowance',method:'setAllowance',scope:'actor',maxArgs:1,away:false},
  {id:'top-up',method:'topUp',scope:'actor',maxArgs:0,away:false},
  {id:'set-stock-target',method:'setStockTarget',scope:'actor',maxArgs:2,away:false},
  {id:'place-building',method:'place',scope:'actor',maxArgs:3,away:false},
  {id:'upgrade-building',method:'upgrade',scope:'actor',maxArgs:2,away:false},
  {id:'request-task',method:'request',scope:'actor',maxArgs:3,away:false},
  {id:'cancel-plan',method:'cancel',scope:'actor',maxArgs:1,away:false},
  {id:'pause-plan',method:'pauseOrder',scope:'actor',maxArgs:2,away:false},
  {id:'prioritize-plan',method:'prioritize',scope:'actor',maxArgs:1,away:false},
  {id:'request-equipment',method:'requestEquipment',scope:'actor',maxArgs:1,away:false},
  {id:'unequip',method:'unequip',scope:'actor',maxArgs:1,away:false},
  {id:'cancel-equipment',method:'cancelEquipment',scope:'actor',maxArgs:1,away:false},
  {id:'accept-quest',method:'acceptQuest',scope:'actor',maxArgs:1,away:false},
  {id:'cancel-quest-plan',method:'cancelQuestPlan',scope:'actor',maxArgs:0,away:false},
  {id:'abort-quest',method:'abortQuest',scope:'actor',maxArgs:0,away:true},
  {id:'suggest-social',method:'suggestSocial',scope:'actor',maxArgs:1,away:false},
  {id:'request-unpack',method:'requestUnpack',scope:'actor',maxArgs:0,away:false},
  {id:'spend-point',method:'spendPoint',scope:'actor',maxArgs:1,away:false},
  {id:'research-feature',method:'researchFeature',scope:'world',maxArgs:1,away:false},
  {id:'configure-building',method:'configureBuilding',scope:'world',maxArgs:3,away:false},
  {id:'assign-home',method:'assignHome',scope:'world',maxArgs:2,away:false},
  {id:'buy-island',method:'buyIsland',scope:'world',maxArgs:2,away:false},
  {id:'unlock-slot',method:'unlockSlot',scope:'world',maxArgs:0,away:false},
  {id:'create-sale',method:'sellItem',scope:'world',maxArgs:3,away:false},
  {id:'control-sale',method:'controlSale',scope:'world',maxArgs:3,away:false}
 ]);
 const manifest=Object.freeze(definitions.map(definition=>Object.freeze({...definition})));
 const byId=new Map(manifest.map(definition=>[definition.id,definition] as const));

 const safeValue=(value: unknown,depth=0): value is JsonValue=>{
  if(depth>6)return false;
  if(value===null||typeof value==='string'||typeof value==='boolean')return true;
  if(typeof value==='number')return Number.isFinite(value);
  if(Array.isArray(value))return value.length<=64&&value.every(entry=>safeValue(entry,depth+1));
  if(typeof value==='object'){
   const object=value as Record<string,unknown>;
   return Object.getPrototypeOf(object)===Object.prototype&&Object.keys(object).length<=64&&
    !Object.keys(object).some(key=>['__proto__','constructor','prototype'].includes(key))&&
    Object.values(object).every(entry=>safeValue(entry,depth+1));
  }
  return false;
 };
 const fail=(reason:string):Failure=>({ok:false,reason});

 function dispatch(engine:EngineLike,envelope:unknown):unknown{
  if(!engine||!envelope||typeof envelope!=='object'||Object.getPrototypeOf(envelope)!==Object.prototype)
   return fail('Invalid command envelope.');
  const candidate=envelope as Record<string,unknown>;
  if(Object.keys(candidate).some(key=>!['id','actorId','args'].includes(key)))return fail('Unknown command field.');
  if(typeof candidate.id!=='string')return fail('Unknown command.');
  const definition=byId.get(candidate.id);if(!definition)return fail('Unknown command.');
  const rawArgs=candidate.args??[];
  if(!Array.isArray(rawArgs)||rawArgs.length>definition.maxArgs||!rawArgs.every(value=>safeValue(value)))
   return fail('Invalid command arguments.');
  const args=rawArgs as JsonValue[];
  const handler=engine[definition.method];if(typeof handler!=='function')return fail('Command handler is unavailable.');
  if(definition.scope==='actor'){
   if(typeof candidate.actorId!=='string'||!/^c[1-9][0-9]*$/.test(candidate.actorId))return fail('Select a valid creature.');
   if(typeof engine.commandActor!=='function')return fail('Actor command boundary is unavailable.');
   return engine.commandActor(candidate.actorId,()=>handler.apply(engine,args),{away:definition.away});
  }
  if(candidate.actorId!==undefined)return fail('This command does not accept an actor.');
  return handler.apply(engine,args);
 }

 function install(Engine:Function&{prototype:Record<string,unknown>}):typeof Engine{
  if(typeof Engine!=='function')throw Error('Command router requires an engine facade.');
  Object.defineProperty(Engine.prototype,'dispatchCommand',{configurable:false,enumerable:false,writable:false,
   value:function(this:EngineLike,envelope:CommandEnvelope){return dispatch(this,envelope);}});
  Object.defineProperty(Engine,'commandManifest',{configurable:false,enumerable:true,value:manifest});
  return Engine;
 }

 const api=Object.freeze({manifest,dispatch,install});
 root.LWCommandRouter=api;L.CommandRouter=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
