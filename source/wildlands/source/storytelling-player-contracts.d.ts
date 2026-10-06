/// <reference path="./storytelling-contracts.d.ts" />
/// <reference path="./renderer-contracts.d.ts" />
/** Browser composition ports for cinematic transport and existing scene admission UI. */
declare namespace LWStorytellingPlayer {
 interface Host {
  engine():LWContentPorts.ScenarioEngine;setEngine(engine:LWContentPorts.ScenarioEngine,options?:{sceneTransition:boolean}):void;
  backup():void;save():void;close():void;open(type:string):void;modal():string|null;redraw():void;
  toast(message:string,error?:boolean):void;esc(value:unknown):string;head(title:string,description?:string,eyebrow?:string):string;footer():string;
  camera?():LittlewildRenderer.Camera;presentScene?(target:LWSceneGraph.BindingTarget|null,camera?:LittlewildRenderer.Camera):void;
  admitScene?(pack:LWContentPorts.ScenarioPack,sceneId:string):void;
  presentation(playback:LWStorytelling.Playback|null):void;pause?(paused:boolean):void;
 }
 interface Player {entered(events?:LWSceneGraph.Event[]):void;isPresenting():boolean;draw(seconds:number):void;render(type:string):string|null;controls():string;reset():void;dispose():void;}
 interface Api {create(host:Host):Player;}
}
