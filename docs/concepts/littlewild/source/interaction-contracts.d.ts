/// <reference path="./runtime-contracts.d.ts" />
/** Data records and inward ports for the shared creature/world interaction authority. */
declare namespace LWInteraction {
 type Scope='creature'|'building'|'node';
 type Executor='effects'|'duel'|'care'|'social'|'world-task';
 interface Target {scope:Scope;id:string;}
 interface Effects {joy:number;energy:number;social:number;anger:number;bond:number;}
 interface Definition {
  id:string;label:string;description:string;executor:Executor;
  sources:('player'|'creature')[];targets:Scope[];targetKinds:string[];
  range:number;cooldown:number;minimumEnergy:number;maximumAnger:number;
  requireIdle:boolean;cost:{energy:number;items:{[key:string]:number}};
  effects:{source:Effects;target:Effects};action:string|null;
  autonomous:boolean;duel:DuelProfile|null;
 }
 interface DuelProfile {
  skill:string;sourceModifier:number;targetModifier:number;scoring:'success-margin'|'margin';
  sourceEnergyPerRound:number;targetEnergyPerRound:number;
  maxRounds:number;pointsToWin:number;roundSeconds:number;responseSeconds:number;
 }
 type Metric='energy'|'food'|'water'|'joy'|'anger'|'social'|'bond'|'personality'|'trait'|'idle';
 interface Condition {metric:Metric;operator:'gte'|'lte'|'eq'|'contains';value:number|string|boolean;}
 interface Trigger {
  id:string;definitionId:string;priority:number;intervalSeconds:number;chancePercent:number;
  source:Condition[];target:Condition[];maximumDistance:number;minimumAffinity:number;
 }
 interface Seek {actorId:string;definitionId:string|null;ruleId:string|null;created:number;expires:number;nextSearchAt:number;}
 interface Library {
  format:'littlewild-interactions';schemaVersion:1;id:string;version:number;
  definitions:Definition[];triggers:Trigger[];
 }
 interface Roll {target:number;dice:number[];total:number;margin:number;success:boolean;critical:boolean;outcome:string;}
 interface Round {number:number;time:number;sourceRoll:Roll;targetRoll:Roll;winnerId:string|null;}
 type Status='requested'|'active'|'completed'|'delegated'|'declined'|'cancelled'|'expired';
 interface Record {
  id:string;definitionId:string;sourceId:string;target:Target;status:Status;
  created:number;respondAt:number;expires:number;nextRoundAt:number;round:number;
  scores:[number,number];winnerId:string|null;reason:string|null;rounds:Round[];
 }
 interface State {
  version:1;rng?:number;library:Library;fingerprint:string;sequence:number;
  active:Record[];history:Record[];cooldowns:{[key:string]:number};
  triggerAt:{[key:string]:number};seeks:Seek[];
 }
 interface Creature {
  id:string;name:string;personality:string;creature:{x:number;y:number};
  needs:{food:number;water:number;energy:number;joy:number};
  feelings:{anger:number;social:number};bond:number;inventory:{[key:string]:number};
  task:{kind:string}|null;activeQuest?:unknown;skills:{[key:string]:boolean};
  traits:string[];
 }
 interface Engine {
  s:{colony:{rng:number};simTime:number;started:boolean;paused:boolean;creatureInteractions?:State;
   interiors?:{locations:{[actorId:string]:LWRuntime.Point & {buildingId:string;floorId:string;route:readonly unknown[]}}};
   settings:{duels?:boolean;quests?:boolean};
   buildings:{id:string;kind:string;x:number;y:number}[];nodes:{id:string;kind:string;x:number;y:number;stock:number}[]};
  creatures:Creature[];actor:Creature;
  withActor<T>(creature:Creature,work:()=>T):T;
  check(skill:string,extra:number,label:string):Roll;
  random(stream:'world'):number;
  interruptActor(creature:Creature):void;
  suggestSocial(id:string):Result;
  care(kind:string):Result;careIssue(kind:string):string|null;
  interactions(creature:Creature):{id:string;instance:string;label:string;description?:string}[];
  interactionReason(creature:Creature,id:string):string|null;
  interact(actorId:string,instance:string):Result;
  commandActor(actorId:string,work:()=>unknown,options?:{away?:boolean}):unknown;
  ecs:{step(creature:Creature,dt:number,inputs:{day:number;socialPreference:number;loadLevel:number;hasShelter:boolean}):unknown};
  load():{level:number};has(kind:string):boolean;
  relationship(a:string,b:string):{affinity:number};
  nodeAvailable(node:{id:string;kind:string;stock:number}):boolean;
  reachable(point:{x:number;y:number}):boolean;room(resource:string):number;
  gateIssue(category:string,id:string):string|null;startTask(task:unknown):boolean;
  log(message:string,icon:string):void;emit(kind:LWRuntime.EventKind,message:string,extra?:LWRuntime.EventPayload):void;
 }
 interface Result extends LWRuntime.Result {interactionId?:string;taskStarted?:boolean;}
 interface Option {id:string;label:string;description:string;available:boolean;reason:string|null;}
 interface Catalog {
  defaults:Library;all():Definition[];validate(input:unknown):Library;definition(input:unknown):Definition;
  copy<T>(input:T):T;fingerprint(input:unknown):string;
 }
 interface Runtime {
  state(engine:Engine):State;options(engine:Engine,sourceId:string,target:unknown):Option[];
  request(engine:Engine,definitionId:unknown,sourceId:unknown,target:unknown):Result;
  respond(engine:Engine,id:unknown,actorId:string,accept:unknown):Result;
  cancel(engine:Engine,id:unknown):Result;step(engine:Engine):void;
  busy(engine:Engine,id:string):boolean;setLibrary(engine:Engine,input:unknown):Result;
  distance(engine:Engine,source:Creature,target:Creature):number;
  eligible(engine:Engine,definition:Definition,sourceId:string,target:Target):string|null;
 }
}
