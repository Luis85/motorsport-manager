/// <reference path="./storytelling-contracts.d.ts" />
/** UI emits detached authoring/preview intent; composition owns cinematic elapsed time. */
declare namespace LWStorytellingUI {
 interface Preview {readonly ready:Promise<LittlewildRenderer.SwitchResult>;status():LWStorytelling.Status;play():void;pause():void;stop():void;replay():void;seek(time:number):void;draw(delta:number):void;dispose():void;}
 interface Host {session():LWSceneEditor.Session|null;sceneId():string|undefined;modal():string|null;redraw():void;esc(value:unknown):string;toast(message:string,error?:boolean):void;preview?(canvas:HTMLCanvasElement,pack:LWContentPorts.ScenarioPack,id:string):Preview;
  /** Presentation preparation may yield after input; cancellation prevents an obsolete queued factory. */
  deferPreview?(work:()=>void):()=>void;
 }
 interface State {active:boolean;tab:'boards'|'timeline';boardId:string;shotId:string;clipId:string;trackId:string;keyIndex:number;creating:'board'|'clip'|'';notice:string;error:string;confirm:string;}
 interface ViewInput {presets:readonly LWAnimations.Metadata[];selectedSceneId:string;pack:LWContentPorts.ScenarioPack;state:State;entities:LWSceneGraph.Entity[];revision:number;canUndo:boolean;canRedo:boolean;status:LWStorytelling.Status|null;esc(value:unknown):string;}
 interface View {render(input:ViewInput):string;}
 interface Surface {readonly active:boolean;render():string;cancel():void;draw(delta?:number):void;}
 interface Api {create(host:Host):Surface;}
}
