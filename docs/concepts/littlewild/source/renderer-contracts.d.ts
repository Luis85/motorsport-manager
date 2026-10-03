/// <reference path="./developer-contracts.d.ts" />
/** Trusted renderer plugins are executable developer code, never imported story content. */
declare namespace LittlewildRenderer {
 type Json=LittlewildDeveloper.Json;
 type Value<T> = T extends readonly (infer U)[] ? readonly Value<U>[] : T extends object ? {readonly [K in keyof T]:Value<T[K]>} : T;
 interface Point {readonly x:number;readonly y:number;}
 interface Surface extends Point {readonly width:number;readonly height:number;}
 interface Camera extends Point {readonly z:number;}
 interface Hit extends Point {readonly actorId?:string|null;readonly objectId?:string|null;readonly objectType?:string;}
 type Capability='camera'|'hit-test'|'terrain-preview'|'construction-preview'|'resource-lens'|'interiors';
 interface Metadata {readonly id:string;readonly name:string;readonly description:string;readonly capabilities:readonly Capability[];}
 interface Actor extends Point {readonly height:number;readonly id:string;readonly name:string;readonly archetype:string;readonly visualAsset:string;readonly personality:string;readonly equipment:Value<LittlewildDeveloper.Document>;readonly away:boolean;readonly selected:boolean;}
 interface ObjectRecord extends Point {readonly height:number;readonly id:string;readonly kind:string;readonly details:Value<LittlewildDeveloper.Document>;}
 interface Frame {
  readonly version:1;readonly time:number;readonly delta:number;readonly simTime:number;readonly running:boolean;readonly alpha:number;
  readonly camera:Camera;readonly viewport:Viewport;readonly actors:readonly Actor[];readonly nodes:readonly ObjectRecord[];readonly buildings:readonly ObjectRecord[];
  readonly tiles:readonly (Point & {readonly ground:string;readonly height:number})[];readonly terrain:Value<LittlewildDeveloper.Document>;readonly construction:Value<LittlewildDeveloper.Document>;readonly interiors:Value<LittlewildDeveloper.Document>;readonly environment:Value<LittlewildDeveloper.Document>|null;
  readonly presentation:Value<LittlewildDeveloper.Document>;readonly interiorView:{readonly buildingId:string;readonly floorId:string;readonly surface:Surface|null}|null;readonly room:Value<LittlewildDeveloper.BuildingInteriorSnapshot>|null;
 }
 interface Viewport {readonly width:number;readonly height:number;readonly pixelRatio:number;}
 interface Context {
  readonly canvas:HTMLCanvasElement;readonly signal:AbortSignal;
  readonly query:{frame():Frame;buildingInterior(id:string):Value<LittlewildDeveloper.BuildingInteriorSnapshot>|null;asset(category:'actor'|'building'|'item',id:string):Value<LittlewildDeveloper.Document>|null;creatureDefinition(id:string):Value<LittlewildDeveloper.Document>|null};
  readonly commands:{submit(command:LittlewildDeveloper.Command):LittlewildDeveloper.CommandResult};
  /** Register external resources immediately, so factory or mount failure still cleans them up. */
  onDispose(cleanup:()=>void):void;
 }
 interface Instance {
  mount():void;draw(frame:Frame):void;resize(viewport:Viewport):void;dispose():void;
  hitTest?(point:Point,frame:Frame):Hit|null;
  project?(tile:Point,frame:Frame):Point;
  toTile?(point:Point,frame:Frame):Point;
  cameraChanged?(camera:Camera):void;
 }
 type Factory=(context:Context)=>Instance;
 interface Registry {
  readonly version:1;
  register(metadata:Metadata,factory:Factory):()=>void;
  list():readonly Metadata[];
  validate(metadata:unknown):{readonly ok:boolean;readonly errors:readonly string[];readonly data:Metadata|null};
  create(id:string,context:Context):Instance;
 }
 interface Host {
  readonly rendererId:string;readonly capabilities:readonly Capability[];readonly canvas:HTMLCanvasElement;
  selectRenderer(id:string):{readonly ok:boolean;readonly reason?:string};
  setInteriorView(buildingId:string|null,floorId?:string,surface?:Surface):void;
  dispose():void;
 }
}
declare var LWRenderers:LittlewildRenderer.Registry;
declare var LWRendererHost:{player():LittlewildRenderer.Host};
declare var LWRendererExample:{register():()=>void;activate():{readonly ok:boolean;readonly reason?:string}};
