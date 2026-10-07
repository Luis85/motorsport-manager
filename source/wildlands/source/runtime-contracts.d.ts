/** Inward, value-only contracts. No renderer, DOM, engine instance or state owner. */
declare namespace LWRuntime {
 interface Point {x:number;y:number;}
 type FailureCode='rule-rejected'|'invalid-command'|'unknown-command'|'unavailable-command'|'invalid-target'|'invalid-data'|'busy'|'insufficient-resources'|'settlement-rejected';
 interface Result {ok:boolean;reason?:string;code?:FailureCode;}
 interface Failure extends Result {ok:false;reason:string;}
 type ActionResult<T extends object=object>=({ok:true}&T)|Failure;
 interface EventPayload {
  actorId?:string|undefined;icon?:string;roll?:unknown;kind?:string;x?:number;y?:number;
  interactionId?:string;target?:unknown;otherId?:string;success?:boolean;
  items?:Record<string,number>;direction?:string;buildingId?:string;resource?:string;amount?:number;
 }
 interface EventMap {
  arrival:EventPayload;'building-transfer':EventPayload;celebrate:EventPayload;change:EventPayload;
  done:EventPayload;harvest:EventPayload;heart:EventPayload;interaction:EventPayload;land:EventPayload;
  log:EventPayload;notice:EventPayload;production:EventPayload;'quest-check':EventPayload;
  return:EventPayload;roll:EventPayload;sale:EventPayload;social:EventPayload;temper:EventPayload;transfer:EventPayload;
 }
 type EventKind=keyof EventMap;
 type Event<K extends EventKind=EventKind>={type:K;text:string}&EventMap[K];
 interface ResultsApi {
  readonly codes:readonly FailureCode[];
  failure(reason:string,code?:FailureCode):Failure;
  success():{ok:true};
  success<T extends object>(data:T):{ok:true}&T;
  annotate<T>(value:T,code?:FailureCode):T;
 }
}
