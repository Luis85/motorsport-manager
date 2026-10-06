/// <reference path="./creature-editor-contracts.d.ts" />
/// <reference path="./creature-editor-preview-contracts.d.ts" />
declare namespace LWCreatureEditorSurface {
 interface Host extends LWSceneEditorSurface.Host {capture():{pack:LWContentPorts.ScenarioPack;sceneId:string;instanceId?:string};}
 interface Editor {readonly session:LWCreatureEditor.Session|null;open(pack?:LWContentPorts.ScenarioPack,sceneId?:string,instanceId?:string):void;render(type?:string):string|null;draw():void;cancelRead():void;reset():void;dispose():void;}
 interface Api {create(host:Host):Editor;}
}
