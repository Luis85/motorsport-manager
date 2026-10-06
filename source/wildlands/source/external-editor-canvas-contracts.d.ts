/// <reference path="./external-editor-contracts.d.ts" />
/// <reference path="./canvas-authoring-contracts.d.ts" />
/** Canvas pixels and plugin styles are inert authoring data, never world geometry. */
declare namespace LWCanvasEditors {
 type Data=Record<string,unknown>;
 type Authoring=LWCanvasAuthoring.Authoring;
 interface Mapping {nodeId:string;kind:'world'|'scene';entityId?:string;templateId?:string;id?:string;}
 interface Config {kind:'world'|'scene';id:string;nodeId:string;properties:Data;}
 interface Graph {nodes:Data[];edges:Data[];warnings:string[];}
 interface StoryApi {write(pack:LWContentPorts.ScenarioPack):Data[];read(nodes:Data[],pack:LWContentPorts.ScenarioPack):Set<string>;}
 interface DataApi {
  inspect(document:Data,advanced:boolean):Graph;
  visual(value:Data,edge:boolean,advanced:boolean,warnings:string[]):Data;
  parent(value:Data,groups:Data[]):Data|undefined;
  geometry(value:Data):Data;
  text(value:unknown,label:string,max?:number):string;
  key(kind:string,id:string):string;
 }
}
declare namespace LWExternalEditors {interface Options {canvasMappings?:LWCanvasEditors.Mapping[];}}
