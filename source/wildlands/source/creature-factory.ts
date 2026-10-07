/// <reference path="./content-provider-contracts.d.ts" />
/* Actor creation service: immutable creature definitions -> mutable authoritative actor records. */
(function(inputRoot: unknown){
 'use strict';

 type Plain=Record<string,unknown>;type Mode='founder'|'arrival';
 interface Personality{id:string;traits:string[];attributes:Record<string,number>;}
 interface Adventure{content:{personalities:Personality[]};slots:readonly string[];}
 interface Content{tables:{RES:Record<string,unknown>};copy<T>(value:T):T;}
 interface Definition{id:string;defaultPersonality:string;personalities:readonly string[];movement:{baseSpeed:number;bondThreshold:number;bondedSpeedBonus:number};}
 interface Creatures{readonly defaultArchetype:string;readonly defaultPersonality:string;readonly personalFields:readonly string[];readonly personalities:readonly string[];all():readonly Definition[];get(id:string):Definition|null;supports(archetype:string,personality:string):boolean;seed(archetype:string,personality:string,mode:Mode,sequence:number):Plain;}
 interface Options{id:string;archetype:string;personality:string;mode:Mode;sequence:number;day:number;simTime:number;}
 interface Api{readonly defaultArchetype:string;readonly personalFields:readonly string[];readonly personalities:readonly string[];create(options:Options):Plain;hydrate(base:Plain,options:Options):Plain;supportsPersonality(archetype:string,personality:string):boolean;definitionFor(actor:Plain):Definition;}
 interface Root{LWBehaviorTree?:unknown;LWAdventure?:Adventure;LWContent?:Content;LWContentProvider?:LWContentProvider.Api;LWCreatures?:Creatures;LWCreatureFactory?:Api;}

 const root=inputRoot as Root,node=typeof module!=='undefined'&&module.exports;
 if(node&&!root.LWBehaviorTree)require('./behavior-tree.js');
 const creatures=(node?require('./creature-catalog.js'):root.LWCreatures) as Creatures|undefined;
 const content=(node?require('./content-runtime.js'):root.LWContent) as Content|undefined;
 const adventure=(node?require('./adventure-content.js'):root.LWAdventure) as Adventure|undefined;
 const provider=(node?require('./content-provider.js'):root.LWContentProvider) as LWContentProvider.Api|undefined;
 if(!creatures||!content||!adventure||!provider)throw Error('Creature factory dependencies are missing.');
 const Creatures:Creatures=creatures,C:Content=content,A:Adventure=adventure;
 const plain=(value:unknown):value is Plain=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const copy=<T>(value:T):T=>C.copy(value);

 function merge(base:Plain,override:Plain):Plain{const out=copy(base);for(const [key,value] of Object.entries(override)){const current=out[key];out[key]=plain(current)&&plain(value)?merge(current,value):copy(value);}return out;}
 function profile(id:string):Personality{const value=A.content.personalities.find(personality=>personality.id===id);if(!value)throw Error('Creature factory: unknown personality '+id);return value;}
 function definitionFor(actor:Plain):Definition{
  const archetype=actor.archetype,personality=actor.personality;
  if(typeof archetype!=='string'||typeof personality!=='string')throw Error('Creature factory: actor identity is incomplete');
  const definition=Creatures.get(archetype);
  if(!definition||!Creatures.supports(archetype,personality))throw Error('Creature factory: invalid archetype/personality pairing');
  return definition;
 }
 function normalize(state:Plain,options:Options):Plain{
  const definition=Creatures.get(options.archetype),personality=profile(options.personality);
  if(!definition||!Creatures.supports(options.archetype,options.personality))throw Error('Creature factory: unsupported archetype/personality pairing');
  state.id=options.id;state.archetype=definition.id;state.personality=personality.id;state.traits=copy(personality.traits);
  const rpg=state.rpg;if(!plain(rpg))throw Error('Creature factory: missing RPG state');
  rpg.attributes=copy(personality.attributes);rpg.cp??=0;rpg.points=plain(rpg.points)?rpg.points:{};rpg.practiceCredit=plain(rpg.practiceCredit)?rpg.practiceCredit:{};rpg.rolls=Array.isArray(rpg.rolls)?rpg.rolls:[];
  const skills=state.skills,practice=state.practice;if(!plain(skills)||!plain(practice))throw Error('Creature factory: missing skill state');
  const points=rpg.points as Plain;for(const [skill,learned] of Object.entries(skills))if(learned&&typeof points[skill]!=='number')points[skill]=Math.min(12,1+Math.floor((Number(practice[skill])||0)/8));
  const inventory=state.inventory,targets=state.stockTargets;if(!plain(inventory)||!plain(targets))throw Error('Creature factory: missing resource maps');
  for(const id of Object.keys(C.tables.RES)){inventory[id]??=0;targets[id]??=0;}
  const equipment=state.equipment;if(!plain(equipment))throw Error('Creature factory: missing equipment state');for(const slot of A.slots)equipment[slot]??=null;
  const daily=state.daily,learning=state.learning;if(!plain(daily)||!plain(learning))throw Error('Creature factory: missing daily or learning state');daily.day=options.day;learning.practiceDay=options.day;
  const feelings=state.feelings;if(options.mode==='arrival'&&plain(feelings)&&Array.isArray(feelings.causes))feelings.causes=feelings.causes.map(cause=>plain(cause)?{...cause,time:options.simTime}:cause);
  return state;
 }
 function hydrate(base:Plain,options:Options):Plain{
  verify();
  if(!options||(options.mode!=='founder'&&options.mode!=='arrival')||typeof options.id!=='string'||!/^c[1-9][0-9]*$/.test(options.id)||typeof options.archetype!=='string'||typeof options.personality!=='string'||!Number.isSafeInteger(options.sequence)||options.sequence<0||!Number.isSafeInteger(options.day)||options.day<1||!Number.isFinite(options.simTime)||options.simTime<0)throw Error('Creature factory: invalid creation options');
  if(!Creatures.supports(options.archetype,options.personality))throw Error('Creature factory: unsupported archetype/personality pairing');
  return normalize(merge(Creatures.seed(options.archetype,options.personality,options.mode,options.sequence),base),options);
 }
 function create(options:Options):Plain{return hydrate({},options);}
 function supportsPersonality(archetype:string,personality:string):boolean{return Creatures.supports(archetype,personality);}
 /** Cross-check the installed game's creatures against its adventure profiles once, before first use. */
 let verified=false;
 function verify():void{
  if(verified)return;
 for(const definition of Creatures.all()){
  for(const personality of definition.personalities)profile(personality);
  const sample=Creatures.seed(definition.id,definition.defaultPersonality,'founder',0),equipment=sample.equipment;
  if(!plain(equipment)||A.slots.some(slot=>!Object.hasOwn(equipment,slot)))throw Error('Creature factory: '+definition.id+' does not define every equipment slot');
 }
  verified=true;
 }
 const api:Api=Object.freeze({get defaultArchetype(){return Creatures.defaultArchetype;},get personalFields(){return Creatures.personalFields;},get personalities(){return Creatures.personalities;},create,hydrate,supportsPersonality,definitionFor});
 provider.whenInstalled(verify,'creatures');
 root.LWCreatureFactory=api;if(node)module.exports=api;
})(globalThis);
