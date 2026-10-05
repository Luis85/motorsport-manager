/// <reference path="./rts-mission-editor-contracts.d.ts" />
/// <reference path="./rts-demo-contracts.d.ts" />
/** Authoring presentation receives copied values and command/file/navigation intent ports. */
declare namespace LWRTSMissionEditorUI {
 interface Host {
  parent:HTMLElement; editor:LWRTSMissionEditor.Session;
  onPlay():void; onExit():void; onExport():void; onImport():void;
 }
 interface Surface {refresh():void;feedback(message:string,error?:boolean):void;destroy():void;}
 interface Api {create(host:Host):Surface;}
 interface FormsApi {
  escape(value:unknown):string;
  metadata(snapshot:LWRTSMissionEditor.Snapshot):string;
  brush(snapshot:LWRTSMissionEditor.Snapshot):string;
  objectives(snapshot:LWRTSMissionEditor.Snapshot):string;
  records(snapshot:LWRTSMissionEditor.Snapshot):string;
 }
 interface ProjectionApi {snapshot(value:LWRTSMissionEditor.Snapshot):LWRTSDemo.Snapshot;}
}
