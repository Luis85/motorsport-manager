/// <reference path="./armored-contracts.d.ts" />
/** Browser presentation ports: detached data and intentions, never a session or solver. */
declare namespace LWArmoredPresentation {
 type CameraMode='chase'|'gunner'|'binocular';
 interface Camera {mode:CameraMode;yaw:number;pitch:number;fov:number;sensitivity:number;shake:number;}
 interface Models { [asset:string]:unknown; }
 interface Boot {catalog:LWArmoredData.Catalog;models:Models;}
 interface Hooks {
  query():LWArmoredRuntime.Snapshot;command(input:LWArmoredRuntime.Command):LWArmoredRuntime.Result;
  paused():boolean;control(action:'pause'|'resume'|'restart'):void;
  save():void;load():void;mission(id:string):void;
 }
 interface Surface {render(snapshot:LWArmoredRuntime.Snapshot,seconds:number):void;destroy():void;}
 interface UI extends Surface {
  notice(message:string,error?:boolean):void;screen(name:'menu'|'briefing'|'battle'|'pause'|'debrief'):void;
  order():string|null;camera():Camera;setCamera(mode:CameraMode):void;activate():void;
 }
 interface Controls {update(snapshot:LWArmoredRuntime.Snapshot,seconds:number):void;release():void;reset():void;destroy():void;}
 interface Audio {activate():void;render(snapshot:LWArmoredRuntime.Snapshot,paused:boolean):void;destroy():void;}
}
