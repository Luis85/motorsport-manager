/* Stable actor-scoped compatibility view over one authoritative root state.
 * Personal fields resolve through an explicit actor identity; the serialized root receives
 * no accessor properties and remains suitable for persistence, validation and tooling.
 */
(function(root){
 'use strict';
 const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),roots=new WeakMap();
 function create(engine,state,personal,pinnedId=null){
  if(!engine||!state||!Array.isArray(personal))throw Error('Invalid actor state view.');
  const keys=new Set(personal),target=Object.create(null);
  const actor=()=>{
   const id=pinnedId||engine._actor?.id;
   const value=state.colony?.creatures?.find?.(c=>c.id===id)||engine._actor;
   if(!value)throw Error('Actor state view has no active actor.');return value;
  };
  const view=new Proxy(target,{
   get(_t,key){if(key===Symbol.toStringTag)return 'LittlewildActorStateView';if(key==='__root__')return state;if(keys.has(key))return actor()[key];return state[key];},
   set(_t,key,value){if(keys.has(key))actor()[key]=value;else state[key]=value;return true;},
   has(_t,key){return keys.has(key)||key in state;},
   ownKeys(){return [...new Set([...Reflect.ownKeys(state),...personal])];},
   getOwnPropertyDescriptor(_t,key){if(keys.has(key)||has(state,key))return {configurable:true,enumerable:true,writable:true,value:keys.has(key)?actor()[key]:state[key]};},
   deleteProperty(_t,key){if(keys.has(key))return delete actor()[key];return delete state[key];},
   defineProperty(_t,key,descriptor){if(!('value'in descriptor))throw Error('Actor state view accepts data properties only.');if(keys.has(key))actor()[key]=descriptor.value;else state[key]=descriptor.value;return true;},
   getPrototypeOf(){return Object.getPrototypeOf(state);}
  });
  roots.set(view,state);return view;
 }
 const api=Object.freeze({create,rootOf:value=>roots.get(value)||value,isView:value=>roots.has(value)});root.LWActorStateView=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
