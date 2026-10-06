/** Application boundaries and authoritative ECS component records for RTS games. */
declare namespace LWRTSRuntime {
 type Data = Record<string, unknown>;
 interface Point extends Data {x:number;y:number;}
 interface Owner extends Data {faction:string;}
 interface Kind extends Data {definition:string;category:'unit'|'building'|'resource'|'item';}
 interface Health extends Data {hp:number;max:number;armor:number;}
 interface Unit extends Data {speed:number;movement:LWRTSData.Movement;sight:number;radius:number;population:number;role:string;}
 interface Order extends Data {kind:string;targetId:string;x:number;y:number;path:Point[];cursor:number;}
 interface Weapon extends Data {damage:number;range:number;cooldown:number;remaining:number;projectileSpeed:number;splash:number;targets:readonly LWRTSData.Movement[];}
 interface Faction extends Data {resources:Record<string,number>;technologies:string[];population:number;populationCap:number;power:number;}
 interface Map extends Data {width:number;height:number;tiles:string[];blocked:string[];}
 interface State extends Data {tick:number;status:'running'|'victory'|'defeat';serial:number;mission:string;}
 interface Fog extends Data {visible:Record<string,string[]>;explored:Record<string,string[]>;}
 interface Event extends Data {kind:string;tick?:number;}
 interface World {
  readonly entities:ReadonlySet<string>;readonly running:boolean;readonly pendingStructural:number;
  create(id:string):string;destroy(id:string):boolean;
  get<T extends Data=Data>(id:string,type:string):T|undefined;
  set<T extends Data>(id:string,type:string,value:T):T;
  has(id:string,...types:string[]):boolean;query(types:readonly string[],except?:readonly string[]):string[];
  defer(operation:'create'|'destroy',id:string):void;
  defer(operation:'set',id:string,type:string,data:Data):void;
  defer(operation:'remove',id:string,type:string):void;
 }
 interface System {id:string;phase:'pre'|'simulate'|'post';order:number;query:readonly string[];update(world:World,id:string,dt:number,context:Data):void;}
 interface Scheduler {register(spec:System):Scheduler;step(world:World,dt:number,context?:Data):void;}
 interface Ecs {World:new()=>World;Scheduler:new()=>Scheduler;}
 interface Command extends Data {kind:string;faction:string;entities?:string[];entityIds?:string[];entityId?:string;definition?:string;definitionId?:string;targetId?:string;x?:number;y?:number;ability?:string;}
 interface Result {ok:boolean;message:string;entityId?:string;}
 interface Context {
  world:World;catalog:LWRTSData.CatalogApi;data:LWRTSData.Catalog;map:Map;mission:LWRTSData.Mission;
  spawn(definitionId:string,faction:string,x:number,y:number):string;emit(event:Event):void;
 }
 interface EntityView extends Data {id:string;definition:string;category:string;faction:string;x:number;y:number;hp:number;maxHp:number;order:string;complete:boolean;progress:number;}
 interface Snapshot {projectiles:{id:string;x:number;y:number;faction:string}[];tick:number;status:string;map:Map;entities:EntityView[];factions:(Faction & {id:string})[];events:Event[];fog:Fog;catalog:LWRTSData.Catalog;playerFaction:string;}
 interface Session {command(input:Command):Result;query(faction?:string):Snapshot;step(ticks?:number):void;checkpoint():Data;}
 interface Economy {register(scheduler:Scheduler,context:Context):void;command(context:Context,input:Command):Result|null;completeStep(context:Context):void;}
 interface Systems {register(scheduler:Scheduler,context:Context):void;path(context:Context,start:Point,end:Point,movement:LWRTSData.Movement):Point[];}
}
