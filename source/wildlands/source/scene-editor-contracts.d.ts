/// <reference path="./content-contracts.d.ts" />
/** Detached authoring revisions. A draft never holds or ticks the active engine. */
declare namespace LWSceneEditor {
 type Category=LWSceneGraph.Entity['category'];
 interface Session {
  readonly revision:number;readonly canUndo:boolean;readonly canRedo:boolean;
  snapshot():LWContentPorts.ScenarioPack;export():LWContentPorts.ScenarioPack;
  validate():LWContentPorts.PackValidation;replace(input:unknown):void;
  updateScene(id:string,patch:Partial<LWContentPorts.Scene>):void;
  updateWorld(id:string,patch:Partial<LWContentPorts.WorldProfile>):void;
  addWorld(template:LWContentPorts.WorldProfile,id:string,name:string):void;
  addScene(template:LWContentPorts.Scene,id:string,worldId:string,parentId?:string):void;
  removeScene(id:string):void;removeWorld(id:string):void;
  entities(sceneId:string):LWSceneGraph.Entity[];
  place(sceneId:string,category:Category,id:string,x:number,y:number):void;
  setEntity(sceneId:string,category:Category,id:string,patch:Record<string,unknown>):void;
  addProp(sceneId:string,prop:LWSceneGraph.Prop):void;
  addEntity(sceneId:string,category:Category,templateId:string,id:string,x?:number,y?:number):void;
  removeEntity(sceneId:string,category:Category,id:string):void;
  undo():void;redo():void;
 }
 interface Api {create(input:unknown):Session;}
}
