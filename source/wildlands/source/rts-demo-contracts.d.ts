/// <reference path="./rts-contracts.d.ts" />
/** Value-only RTS presentation ports. The application owns scheduling and persistence. */
declare namespace LWRTSDemo {
 interface Entity {
  id:string; definition:string; category:string; faction:string; x:number; y:number;
  hp:number; maxHp:number; order?:unknown; complete?:boolean; progress?:number;
  amount?:number; remaining?:number; carried?:number; resource?:string; cargo?:Record<string,number>; inventory?:Record<string,number>; queue?:unknown[];
 }
 interface Snapshot {
  tick:number; status:string; mission?:string; playerFaction?:string;
  map:{width:number;height:number;tiles:readonly (string | {terrain:string})[]};
  entities:readonly Entity[]; projectiles?:readonly {id:string;x:number;y:number;faction:string}[];
  factions:readonly {id:string;resources:Record<string,number>;technologies:readonly string[];population:number;populationCap:number;power:number}[];
  fog:{visible:readonly (number|string)[];explored:readonly (number|string)[]};
  events:readonly (string | {text?:string;kind?:string;message?:string;tick?:number;source?:string;target?:string;x?:number;y?:number})[];
  catalog:LWRTSData.Catalog;
 }
 interface Intent {kind:string;faction:string;entities:string[];x?:number;y?:number;targetId?:string;definition?:string;ability?:string;index?:number;}
 interface Host {
  query():Snapshot; command(intent:Intent):{ok:boolean;reason?:string};
  control(intent:'pause'|'resume'|'speed'|'restart'|'exit',value?:number):void;
  parent?:HTMLElement; paused?():boolean; speed?():number;
 }
 interface Surface {refresh():void;destroy():void;}
 interface Api {create(host:Host):Surface;}
 interface Point {x:number;y:number;}
 interface Renderer {
  draw(view:Snapshot,selected:readonly string[],placement:string|null,hover:Point|null):void;
  world(point:Point):Point; screen(point:Point):Point; hit(point:Point):Entity|null;
  zoom(delta:number):void; center(point:Point):void; reset():void;
 }
 interface RendererApi {create(canvas:HTMLCanvasElement):Renderer; minimap(canvas:HTMLCanvasElement,view:Snapshot):void;}
}
