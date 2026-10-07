/// <reference path="./content-contracts.d.ts" />
/** Detached creature authoring uses the existing whole-pack validation and review boundary. */
declare namespace LWCreatureEditor {
 type Data=Record<string,unknown>;
 interface Definition extends Data {id:string;name:string;visualAsset:string;personalities:string[];state:{defaults:Data;personalFields:string[];modes:Data};ecs:{components:{type:string;field:string}[]};}
 interface Appearance extends Data {id:string;category:'actor';materials:Data;models:Record<string,{nodes:Data[]}>;behaviors:Data;rig:Data;}
 interface Package {format:'littlewild-creature-package';schemaVersion:1;gameplayDefinition:Definition;appearanceManifest:Appearance;assetReferences:unknown[];selectedInstance?:Data;}
 interface Validation {ok:boolean;errors:string[];package?:Package;}
 interface Field {id:string;label:string;group:string;target:'definition'|'instance';path:string[];type:'number'|'text'|'boolean'|'json';min?:number;max?:number;step?:number;}
 interface Selection {sceneId:string;archetypeId:string;instanceId?:string;}
 interface Session {
  readonly revision:number;readonly canUndo:boolean;readonly canRedo:boolean;readonly selection:Selection;
  snapshot():Package;fields():Field[];exportPackage():Package;exportScenario():LWContentPorts.ScenarioPack;
  select(selection:Selection):void;setField(id:string,value:unknown):void;updateDefinition(patch:Data):void;updateAppearance(patch:Data):void;updateInstance(patch:Data):void;
  importPackage(input:unknown):void;duplicateArchetype(id:string,name:string):void;undo():void;redo():void;
 }
 interface Api {create(input:unknown,selection:Selection):Session;validatePackage(input:unknown,context?:{pack:LWContentPorts.ScenarioPack;selection:Selection}):Validation;}
}
