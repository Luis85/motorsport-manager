/* Stable actor-scoped compatibility view over one authoritative root state.
 * Personal fields resolve through an explicit actor identity; the serialized root receives
 * no accessor properties and remains suitable for persistence, validation and tooling.
 */
(function(inputRoot: unknown){
 'use strict';

 type ViewKey = string | symbol;
 type DataRecord = Record<PropertyKey, unknown>;
 interface ActorRecord extends DataRecord { id?: string; }
 interface ColonyRecord extends DataRecord { creatures?: ActorRecord[]; }
 interface RootState extends DataRecord { colony?: ColonyRecord; }
 interface EngineLike { _actor?: ActorRecord; }
 interface ActorStateViewApi {
  create(engine: EngineLike, state: RootState, personal: readonly ViewKey[], pinnedId?: string | null): RootState;
  rootOf(value: unknown): RootState | unknown;
  isView(value: unknown): boolean;
 }
 interface LittlewildRoot { LWActorStateView?: ActorStateViewApi; }
  const root = inputRoot as LittlewildRoot;

 const has=(object:object,key:PropertyKey):boolean=>Object.prototype.hasOwnProperty.call(object,key);
 const roots=new WeakMap<object,RootState>();
 const isObject=(value:unknown):value is object=>(typeof value==='object'&&value!==null)||typeof value==='function';

 function create(engine:EngineLike,state:RootState,personal:readonly ViewKey[],pinnedId:string|null=null):RootState{
  if(!engine||!state||!Array.isArray(personal))throw Error('Invalid actor state view.');
  const keys=new Set<ViewKey>(personal),target:DataRecord=Object.create(null) as DataRecord;
  const actor=():ActorRecord=>{
   const id=pinnedId||engine._actor?.id;
   const value=state.colony?.creatures?.find(creature=>creature.id===id)||engine._actor;
   if(!value)throw Error('Actor state view has no active actor.');
   return value;
  };
  const view=new Proxy(target,{
   get(_target,key){if(key===Symbol.toStringTag)return 'LittlewildActorStateView';if(key==='__root__')return state;if(keys.has(key))return actor()[key];return state[key];},
   set(_target,key,value){if(keys.has(key))actor()[key]=value;else state[key]=value;return true;},
   has(_target,key){return keys.has(key)?has(actor(),key):key in state;},
   ownKeys(){const current=actor();return [...new Set<ViewKey>([...Reflect.ownKeys(state).filter(key=>!keys.has(key)),...personal.filter(key=>has(current,key))])];},
   getOwnPropertyDescriptor(_target,key){const value=keys.has(key)?actor():state;if(has(value,key))return {configurable:true,enumerable:true,writable:true,value:value[key]};return undefined;},
   deleteProperty(_target,key){if(keys.has(key))return delete actor()[key];return delete state[key];},
   defineProperty(_target,key,descriptor){if(!('value'in descriptor))throw Error('Actor state view accepts data properties only.');if(keys.has(key))actor()[key]=descriptor.value;else state[key]=descriptor.value;return true;},
   getPrototypeOf(){return Object.getPrototypeOf(state);}
  });
  roots.set(view,state);
  return view as RootState;
 }
 const api:ActorStateViewApi=Object.freeze({
  create,
  rootOf:(value:unknown)=>isObject(value)?roots.get(value)||value:value,
  isView:(value:unknown)=>isObject(value)&&roots.has(value)
 });
 root.LWActorStateView=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
