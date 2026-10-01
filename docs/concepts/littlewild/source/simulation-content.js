/* Versioned, data-only ECS tuning and entity-composition declarations.
 * Profiles may select validated numeric rules and a known component contract.
 * They cannot register systems, callbacks, handlers, methods, or new component types.
 */
(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 const C=node?require('./content-runtime.js'):root.LWContent;
 const Actor=node?require('./actor-ecs.js'):root.LWActorECS;
 const Economy=node?require('./economy-ecs.js'):root.LWEconomyECS;
 const DEFAULT=node?require('./content/default-simulation.json'):root.LWDefaultSimulation;
 const PROFILE_KEYS=['format','schemaVersion','id','name','description','actor','economy'];
 const ARCHETYPE_KEYS=['format','schemaVersion','id','name','description','entity','persistentComponents','transientComponents'];
 const SET_KEYS=['format','schemaVersion','ruleProfiles','compositionArchetypes'];
 const SELECTION_KEYS=['format','schemaVersion','ruleProfile','actorArchetype'];
 const PERSISTED=Object.freeze(['Transform','Needs','Learning','Feelings','Inventory']);
 const TRANSIENT=Object.freeze(['Activity','Task','Intent']);
 const BINDINGS=Object.freeze({Transform:'creature',Needs:'needs',Learning:'learning',Feelings:'feelings',Inventory:'inventory'});
 const id=value=>typeof value==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(value);
 const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[<>\u0000-\u001f\u007f]/u.test(value);
 const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
 const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
 function dataOnly(value,depth=0){
  if(depth>16)throw Error('Simulation content is too deeply nested.');
  if(value===null||['string','boolean'].includes(typeof value))return;
  if(typeof value==='number'&&Number.isFinite(value))return;
  if(Array.isArray(value)){if(value.length>128)throw Error('Simulation content collection is too large.');for(const item of value)dataOnly(item,depth+1);return;}
  if(!plain(value))throw Error('Simulation content must contain JSON data only.');
  const keys=Object.keys(value);if(keys.length>128||keys.some(key=>key==='__proto__'||key==='prototype'||key==='constructor'))throw Error('Simulation content contains a forbidden field.');
  for(const item of Object.values(value))dataOnly(item,depth+1);
 }
 function deepFreeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const item of Object.values(value))deepFreeze(item);Object.freeze(value);}return value;
 }
 function sameMembers(actual,expected){return Array.isArray(actual)&&actual.length===expected.length&&new Set(actual).size===actual.length&&expected.every(value=>actual.includes(value));}
 function validateRuleProfile(input){
  dataOnly(input);
  if(!exact(input,PROFILE_KEYS)||input.format!=='littlewild-ecs-rule-profile'||input.schemaVersion!==1||!id(input.id)||!text(input.name,80)||!text(input.description,500))
   throw Error('Invalid ECS rule profile.');
  const actor=Actor.validateRules(input.actor),economy=Economy.validateRules(input.economy);
  return deepFreeze({...C.copy(input),actor,economy});
 }
 function validateArchetype(input){
  dataOnly(input);
  if(!exact(input,ARCHETYPE_KEYS)||input.format!=='littlewild-composition-archetype'||input.schemaVersion!==1||!id(input.id)||!text(input.name,80)||!text(input.description,500)||input.entity!=='creature'||!sameMembers(input.persistentComponents,PERSISTED)||!sameMembers(input.transientComponents,TRANSIENT))
   throw Error('Invalid creature composition archetype.');
  return deepFreeze({...C.copy(input),persistentComponents:[...PERSISTED],transientComponents:[...TRANSIENT]});
 }
 function validateSet(input){
  dataOnly(input);
  if(!exact(input,SET_KEYS)||input.format!=='littlewild-simulation-content'||input.schemaVersion!==1||!Array.isArray(input.ruleProfiles)||!Array.isArray(input.compositionArchetypes)||!input.ruleProfiles.length||input.ruleProfiles.length>8||!input.compositionArchetypes.length||input.compositionArchetypes.length>8)
   throw Error('Invalid simulation content set.');
  const ruleProfiles=input.ruleProfiles.map(validateRuleProfile),compositionArchetypes=input.compositionArchetypes.map(validateArchetype);
  for(const [name,entries]of [['rule profile',ruleProfiles],['composition archetype',compositionArchetypes]])if(new Set(entries.map(entry=>entry.id)).size!==entries.length)throw Error('Duplicate '+name+' ID.');
  return deepFreeze({format:'littlewild-simulation-content',schemaVersion:1,ruleProfiles,compositionArchetypes});
 }
 function makeSelection(ruleProfile,actorArchetype){return deepFreeze({format:'littlewild-simulation-selection',schemaVersion:1,ruleProfile,actorArchetype});}
 function validateSelection(input){
  dataOnly(input);
  if(!exact(input,SELECTION_KEYS)||input.format!=='littlewild-simulation-selection'||input.schemaVersion!==1)throw Error('Invalid simulation selection.');
  return makeSelection(validateRuleProfile(input.ruleProfile),validateArchetype(input.actorArchetype));
 }
 function resolve(input,ruleProfileId,actorArchetypeId){
  const set=validateSet(input),ruleProfile=set.ruleProfiles.find(entry=>entry.id===ruleProfileId),actorArchetype=set.compositionArchetypes.find(entry=>entry.id===actorArchetypeId);
  if(!ruleProfile)throw Error('Unknown ECS rule profile: '+String(ruleProfileId));
  if(!actorArchetype)throw Error('Unknown composition archetype: '+String(actorArchetypeId));
  return makeSelection(ruleProfile,actorArchetype);
 }
 function apply(engine,input){
  if(!engine||!Array.isArray(engine.creatures))throw Error('Simulation selection requires a composed Littlewild engine.');
  const selection=validateSelection(input);
  for(const actor of engine.creatures)for(const component of selection.actorArchetype.persistentComponents){const field=BINDINGS[component],record=actor?.[field];if(!record||typeof record!=='object'||Array.isArray(record))throw Error('Actor '+String(actor?.id)+' does not satisfy '+component+'.');}
  engine.ecs=Actor.create(selection.ruleProfile.actor);engine.ecs.sync(engine.creatures);
  engine.economyEcs=Economy.create(selection.ruleProfile.economy);
  Object.defineProperty(engine,'simulationSelection',{configurable:true,enumerable:false,writable:false,value:selection});
  return engine;
 }
 const defaults=validateSet(DEFAULT),defaultSelection=resolve(defaults,'standard','creature-standard');
 const api=Object.freeze({validateRuleProfile,validateArchetype,validateSet,validateSelection,resolve,apply,
  defaults,defaultSelection,persistentComponents:PERSISTED,transientComponents:TRANSIENT,
  exportDefaults:()=>C.copy(defaults),copySelection:selection=>C.copy(validateSelection(selection))});
 root.LWSimulationContent=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
