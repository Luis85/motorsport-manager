/* Explicit application-command boundary for the composed simulation facade.
 * Command IDs and handler mappings are compiled capabilities; imported JSON cannot add code.
 */
(function(inputRoot: unknown){
 'use strict';

 interface LittlewildFacade { CommandRouter?: unknown; }
 interface LittlewildRoot { LW?: LittlewildFacade; LWCommandRouter?: unknown; }
 const root=inputRoot as LittlewildRoot;

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

 const L=root.LW;if(!L)throw Error('Littlewild facade missing.');
 const definitions: readonly CommandDefinition[] = Object.freeze([
  {id:'seek-duel',method:'seekDuel',scope:'world',maxArgs:3,away:false},
  {id:'cancel-duel-seek',method:'cancelDuelSeek',scope:'world',maxArgs:1,away:false},
  {id:'stage-duel',method:'stageDuel',scope:'world',maxArgs:3,away:false},
  {id:'set-game-settings',method:'setGameSettings',scope:'world',maxArgs:1,away:false},
  {id:'request-interaction',method:'requestInteraction',scope:'world',maxArgs:3,away:false},
  {id:'respond-interaction',method:'respondInteraction',scope:'actor',maxArgs:2,away:true},
  {id:'cancel-interaction',method:'cancelInteraction',scope:'world',maxArgs:1,away:false},
  {id:'set-interaction-library',method:'setInteractionLibrary',scope:'world',maxArgs:1,away:false},
  {id:'select-creature',method:'selectCreature',scope:'world',maxArgs:1,away:false},
  {id:'care',method:'care',scope:'actor',maxArgs:1,away:false},
  {id:'research-skill',method:'research',scope:'actor',maxArgs:1,away:false},
  {id:'teach-skill',method:'teach',scope:'actor',maxArgs:2,away:false},
  {id:'practice-skill',method:'practice',scope:'actor',maxArgs:2,away:false},
  {id:'cancel-lesson',method:'cancelLesson',scope:'actor',maxArgs:1,away:false},
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

 const safeValue=(value: unknown,ancestors=new Set<object>(),depth=0): value is JsonValue=>{
  if(depth>6)return false;
  if(value===null||typeof value==='string'||typeof value==='boolean')return true;
  if(typeof value==='number')return Number.isFinite(value);
  if(typeof value!=='object')return false;
  const object=value as object;
  if(ancestors.has(object)||Object.getOwnPropertySymbols(object).length)return false;
  ancestors.add(object);
  let ok=true;
  if(Array.isArray(value)){
   if(value.length>64)ok=false;
   else{
    const names=Object.getOwnPropertyNames(value);
    if(names.length!==value.length+1||!names.includes('length'))ok=false;
    else for(let index=0;index<value.length;index+=1){
     const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
     if(!descriptor||!descriptor.enumerable||descriptor.get||descriptor.set||!safeValue(descriptor.value,ancestors,depth+1)){ok=false;break;}
    }
   }
  }else{
   if(Object.getPrototypeOf(value)!==Object.prototype)ok=false;
   else{
    const descriptors=Object.getOwnPropertyDescriptors(value);
    const keys=Object.keys(descriptors);
    if(keys.length>64||keys.some(key=>['__proto__','constructor','prototype'].includes(key)))ok=false;
    else for(const descriptor of Object.values(descriptors)){
     if(!descriptor.enumerable||descriptor.get||descriptor.set||!safeValue(descriptor.value,ancestors,depth+1)){ok=false;break;}
    }
   }
  }
  ancestors.delete(object);
  return ok;
 };
 const fail=(reason:string):Failure=>({ok:false,reason});

 function dispatch(engine:EngineLike,envelope:unknown):unknown{
  if(!engine||!envelope||typeof envelope!=='object'||Object.getPrototypeOf(envelope)!==Object.prototype||
   Object.getOwnPropertySymbols(envelope).length)return fail('Invalid command envelope.');
  const descriptors=Object.getOwnPropertyDescriptors(envelope);
  const keys=Object.keys(descriptors);
  if(keys.some(key=>!['id','actorId','args'].includes(key))||
   Object.values(descriptors).some(descriptor=>!descriptor.enumerable||descriptor.get||descriptor.set))
   return fail('Invalid command envelope.');
  const id=descriptors.id?.value;
  if(typeof id!=='string')return fail('Unknown command.');
  const definition=byId.get(id);if(!definition)return fail('Unknown command.');
  const actorId=descriptors.actorId?.value;
  const rawArgs=descriptors.args?.value===undefined?[]:descriptors.args.value;
  if(!Array.isArray(rawArgs)||rawArgs.length>definition.maxArgs||!safeValue(rawArgs))
   return fail('Invalid command arguments.');
  const args=rawArgs as JsonValue[];
  const handler=engine[definition.method];if(typeof handler!=='function')return fail('Command handler is unavailable.');
  if(definition.scope==='actor'){
   if(typeof actorId!=='string'||!/^c[1-9][0-9]*$/.test(actorId))return fail('Select a valid creature.');
   if(typeof engine.commandActor!=='function')return fail('Actor command boundary is unavailable.');
   return engine.commandActor(actorId,()=>handler.apply(engine,args),{away:definition.away});
  }
  if(actorId!==undefined)return fail('This command does not accept an actor.');
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
})(globalThis);
