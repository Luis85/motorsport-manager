/// <reference path="./balancing-contracts.d.ts" />
/// <reference path="./building-interior-data-contracts.d.ts" />
/// <reference path="./interaction-contracts.d.ts" />
/** Detached complete balancing documents and bounded experiment output. */
declare namespace LWBalancing {
 interface Document {format:'littlewild-balancing';schemaVersion:1;sceneId:string;startingScenes:LWContentPorts.Scene[];libraries:LWContentPorts.Libraries;simulation:LWContentPorts.SimulationProfile;world:LWContentPorts.WorldProfile;creatures:LWContentPorts.Resources['creatures'];interactions:LWInteraction.Library;interiors:LWInterior.Catalog;}
 interface Diagnostic {path:string;code:string;message:string;}
 interface Validation {ok:boolean;errors:Diagnostic[];data:Document|null;}
 interface Change {path:string;before:unknown;after:unknown;}
 interface Review {readonly format:'littlewild-balancing-review';readonly baseFingerprint:string;readonly candidateFingerprint:string;readonly changes:readonly Change[];readonly total:number;readonly truncated:boolean;readonly blocked:string|null;}
 interface Metrics {seconds:number;actors:number;food:number;water:number;energy:number;joy:number;inventory:number;warehouse:number;nodeStock:number;produced:number;gathered:number;guideCoins:number;research:number;playerLevel:number;actorLevels:number;questSuccesses:number;duelRounds:number;}
 interface ProbeOptions {sceneId:string;seed:number;steps:number;commands?:readonly LittlewildDeveloper.Command[];}
 interface Probe {seed:number;steps:number;baseline:Metrics;candidate:Metrics;delta:Metrics;}
 interface SweepOptions extends ProbeOptions {path:string;values:readonly number[];}
 interface SweepRow {value:number;probe:Probe|null;errors:Diagnostic[];}
 interface Api {defaults():Document;startingPack(input:unknown,template?:unknown):LWContentPorts.ScenarioPack;capture(pack:unknown,sceneId?:string):Document;validate(input:unknown,pack?:unknown):Validation;review(pack:unknown,input:unknown):Review;apply(pack:unknown,review:Review):LWContentPorts.ScenarioPack;diff(before:unknown,after:unknown):{changes:Change[];total:number;truncated:boolean};probe(pack:unknown,input:unknown,options:ProbeOptions):Probe;sweep(pack:unknown,input:unknown,options:SweepOptions):SweepRow[];}
 interface Core extends Omit<Api,'probe'|'sweep'> {candidate(pack:unknown,input:unknown):LWContentPorts.ScenarioPack;}
}
