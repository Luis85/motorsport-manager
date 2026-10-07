/// <reference path="./scene-editor-contracts.d.ts" />
/// <reference path="./storytelling-ui-contracts.d.ts" />
/// <reference path="./building-interior-data-contracts.d.ts" />
/** Browser editor ports consume detached pack projections and emit draft intent. */
declare namespace LWSceneEditorSurface {
 interface State {
  selection:{type:string;id:string};category:LWSceneEditor.Category;entityId:string;placement:boolean;
  errors:string[];notice:string;confirm:string;creating:string;readId:number;
 }
 interface Asset {id:string;name:string;category:'building'|'item'|'actor';models:Record<string,unknown>;}
 interface ViewInput {pack:LWContentPorts.ScenarioPack;state:State;entities:LWSceneGraph.Entity[];revision:number;canUndo?:boolean;canRedo?:boolean;assets?:readonly Asset[];interior?:LWInterior.Floor;row?:string;esc(value:unknown):string;}
 interface View {render(input:ViewInput):string;}
 interface Host {
  esc(value:unknown):string;head(title:string,description?:string,eyebrow?:string):string;footer():string;
  open(type:string):void;modal():string|null;redraw():void;toast(message:string,error?:boolean):void;
  review(pack:LWContentPorts.ScenarioPack,sceneId:string):void;engine():unknown;
 }
 interface Editor {readonly storytelling?:LWStorytellingUI.Surface;readonly state:State;readonly session:LWSceneEditor.Session|null;render(type?:string):string|null;open(pack?:LWContentPorts.ScenarioPack):void;cancelRead():void;reset():void;}
 interface Api {create(ctx:Host):Editor;}
}
