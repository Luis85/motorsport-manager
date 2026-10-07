/// <reference path="./rts-contracts.d.ts" />
/** Mission authoring owns detached revisions, never an ECS world or simulation clock. */
declare namespace LWRTSMissionEditor {
 type Collection = 'spawns'|'deposits'|'items'|'objectives';
 type Metadata = Partial<Pick<LWRTSData.Mission,'name'|'description'|'width'|'height'|'playerFaction'|'defaultTerrain'|'fog'|'seed'>>;
 type RecordValue = LWRTSData.Spawn|LWRTSData.Deposit|LWRTSData.ItemDrop|LWRTSData.Objective;
 type Command = {revision:number} & (
  {action:'select-mission';missionId:string} |
  {action:'clone-mission';id:string;name:string} |
  {action:'remove-mission'} |
  {action:'metadata';values:Metadata} |
  {action:'paint';terrain:string;x:number;y:number;width:number;height:number} |
  {action:'set-record';collection:Collection;index:number|null;value:RecordValue} |
  {action:'remove-record';collection:Collection;index:number} |
  {action:'import-catalog';catalog:LWRTSData.Catalog;missionId?:string} |
  {action:'undo'|'redo'}
 );
 interface Snapshot {
  catalog:LWRTSData.Catalog; mission:LWRTSData.Mission; revision:number;
  canUndo:boolean; canRedo:boolean; dirty:boolean; historyLimit:number;
 }
 interface Result {ok:boolean;message:string;revision:number;}
 interface Session {
  query():Snapshot;
  command(input:unknown):Result;
  exportCatalog():LWRTSData.Catalog;
 }
 interface Api {create(input?:unknown,missionId?:string):Session;}
}
