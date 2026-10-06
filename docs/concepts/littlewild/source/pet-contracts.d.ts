/** Behavior-free Pocket Pet catalog records. Content chooses values; compiled systems own rules. */
declare namespace LWPetData {
 type NeedId='hunger'|'joy'|'energy'|'hygiene';
 type ActionKind='feed'|'treat'|'play'|'clean'|'cuddle'|'medicine';
 interface Need {id:NeedId;name:string;description:string;start:number;decayPerHour:number;sleepFactor:number;warnBelow:number;}
 interface Species {id:string;name:string;description:string;asset:string;}
 interface Form {id:string;name:string;model:string;maxMistakes:number;description:string;}
 interface Stage {id:'egg'|'baby'|'teen'|'adult';name:string;minutes:number;decayFactor:number;models:readonly Form[];}
 interface Action {
  id:string;name:string;description:string;kind:ActionKind;prop:string;minutes:number;
  effects:Readonly<Partial<Record<NeedId|'health',number>>>;weight:number;digestMinutes:number;
  stages:readonly Stage['id'][];
 }
 interface Rules {
  minutesPerSecond:number;startHour:number;maxWeight:number;minWeight:number;startWeight:number;
  messHygienePerHour:number;maxMesses:number;sleepEnergyPerHour:number;wakeEnergy:number;
  snackLimit:number;snackWindowMinutes:number;sickHygieneBelow:number;sickAfterMinutes:number;
  healthLossPerHour:number;healthGainPerHour:number;mistakeAfterMinutes:number;sickHealthLossPerHour:number;
  lightsOnSleepJoyPerHour:number;eggWarmMinutes:number;
 }
 interface Spot {x:number;z:number;}
 interface Scene {room:string;bed:string;mess:string;sparkle:string;pet:Spot;bedSpot:Spot;messSpots:readonly Spot[];}
 interface Catalog {
  format:'wildlands-pet';schemaVersion:1;id:string;name:string;description:string;
  rules:Rules;scene:Scene;needs:readonly Need[];species:readonly Species[];stages:readonly Stage[];actions:readonly Action[];
 }
 interface CatalogApi {readonly defaults:Catalog;validate(input:unknown):Catalog;}
}
/** Authoritative ECS records and session boundaries for one virtual pet. */
declare namespace LWPetRuntime {
 type Data=Record<string,unknown>;
 type Status='alive'|'departed';
 interface Clock extends Data {tick:number;minute:number;serial:number;status:Status;}
 interface Life extends Data {species:string;name:string;stage:LWPetData.Stage['id'];form:string;model:string;age:number;stageAge:number;mistakes:number;weight:number;born:number;}
 interface Needs extends Data {hunger:number;joy:number;energy:number;hygiene:number;health:number;}
 interface Care extends Data {sleeping:boolean;lights:boolean;sick:boolean;sickFor:number;filthFor:number;neglect:Record<string,number>;snacks:number[];digesting:number[];}
 interface Activity extends Data {action:string;remaining:number;total:number;}
 interface Mess extends Data {x:number;z:number;minute:number;}
 interface Event extends Data {kind:string;message:string;minute?:number;}
 interface Command extends Data {kind:'care'|'sleep'|'wake'|'name'|'adopt';action?:string;name?:string;species?:string;}
 interface Result {ok:boolean;message:string;}
 interface NeedView {id:LWPetData.NeedId;name:string;value:number;warn:boolean;}
 interface ActionView {id:string;name:string;kind:LWPetData.ActionKind;enabled:boolean;reason:string;}
 interface Snapshot {
  tick:number;minute:number;clock:{day:number;hour:number;minute:number;night:boolean};status:Status;
  pet:{species:string;speciesName:string;asset:string;name:string;stage:string;stageName:string;form:string;formName:string;model:string;age:number;stageProgress:number;weight:number;mistakes:number};
  needs:NeedView[];health:number;sick:boolean;sleeping:boolean;lights:boolean;mood:string;
  activity:(Activity & {kind:LWPetData.ActionKind;prop:string})|null;messes:(Mess & {id:string})[];
  alerts:string[];actions:ActionView[];lightsAction:{command:'sleep'|'wake';label:string;enabled:boolean;reason:string};events:Event[];
 }
 interface World {
  readonly entities:ReadonlySet<string>;readonly running:boolean;readonly pendingStructural:number;
  readonly stores:ReadonlyMap<string,ReadonlyMap<string,unknown>>;
  create(id:string):string;destroy(id:string):boolean;
  get<T extends Data=Data>(id:string,type:string):T|undefined;set<T extends Data>(id:string,type:string,value:T):T;remove(id:string,type:string):boolean;
  has(id:string,...types:string[]):boolean;query(types:readonly string[],except?:readonly string[]):string[];
  defer(operation:'create'|'destroy',id:string):void;defer(operation:'set',id:string,type:string,data:Data):void;defer(operation:'remove',id:string,type:string):void;
 }
 interface System {id:string;phase:'pre'|'simulate'|'post';order:number;query:readonly string[];update(world:World,id:string,dt:number,context:Data):void;}
 interface Scheduler {register(spec:System):Scheduler;step(world:World,dt:number,context?:Data):void;}
 interface Ecs {World:new()=>World;Scheduler:new()=>Scheduler;}
 /** System context: the frozen catalog, fixed minutes per tick and an event sink. */
 interface Context {world:World;catalog:LWPetData.Catalog;minutesPerTick:number;emit(kind:string,message:string):void;spawnMess():void;}
 interface Systems {register(scheduler:Scheduler,context:Context):void;}
 interface Checkpoint extends Data {format:'wildlands-pet-checkpoint';schemaVersion:1;catalog:LWPetData.Catalog;entities:{id:string;components:Data}[];events:Event[];}
 interface Session {command(input:unknown):Result;query():Snapshot;step(ticks?:number):void;checkpoint():Checkpoint;readonly catalog:LWPetData.Catalog;}
 interface Api {create(catalog?:unknown,species?:string,name?:string):Session;restore(input:unknown):Session;readonly STEP:number;}
}
