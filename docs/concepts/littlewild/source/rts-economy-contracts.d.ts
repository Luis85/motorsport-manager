/// <reference path="./rts-contracts.d.ts" />
/// <reference path="./rts-runtime-contracts.d.ts" />
declare namespace LWRTSEconomyTypes {
 type Data = LWRTSRuntime.Data;
 type World = LWRTSRuntime.World;
 type System = LWRTSRuntime.System;
 type Scheduler = LWRTSRuntime.Scheduler;
 type Context = LWRTSRuntime.Context;
 interface Position extends Data {x:number;y:number;}
 interface Owner extends Data {faction:string;}
 interface Kind extends Data {definition:string;category:string;}
 interface Bank extends Data {resources:Record<string,number>;technologies:string[];population:number;populationCap:number;power:number;}
 interface Worker extends Data {capacity:number;rate:number;carried:number;resource:string;}
 interface Node extends Data {resource:string;remaining:number;}
 interface Building extends Data {complete:boolean;progress:number;}
 interface Order extends Data {kind:string;targetId:string;x:number;y:number;path:Position[];cursor:number;}
 interface QueueEntry {kind:'unit'|'technology';definitionId:string;remaining:number;total:number;cost:Record<string,number>;population:number;published?:boolean;spawnedId?:string;}
 interface Production extends Data {queue:QueueEntry[];}
 type Command = LWRTSRuntime.Command & {workerId?:string;index?:number;};
 type Result = LWRTSRuntime.Result;
 type API = LWRTSRuntime.Economy;
 interface ProductionAPI extends API {refresh(context:Context):void;bank(context:Context,faction:string):Bank|undefined;}
}
