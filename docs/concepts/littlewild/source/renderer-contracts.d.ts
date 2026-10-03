/// <reference path="./renderer-data-contracts.d.ts" />
/// <reference path="./animation-data-contracts.d.ts" />
/// <reference path="./storytelling-render-contracts.d.ts" />
/// <reference path="./developer-contracts.d.ts" />
/** Trusted renderer plugins are executable developer code, never imported story content. */
declare namespace LittlewildRenderer {
 type Json=LittlewildDeveloper.Json;
 type Value<T> = T extends readonly (infer U)[] ? readonly Value<U>[] : T extends object ? {readonly [K in keyof T]:Value<T[K]>} : T;
 interface Point {readonly x:number;readonly y:number;}
 interface Surface extends Point {readonly width:number;readonly height:number;}
 interface Camera extends Point {readonly z:number;}
 interface Hit extends Point {readonly actorId?:string|null;readonly objectId?:string|null;readonly objectType?:string;}
 interface Pose {readonly rotation?:number;readonly scale?:number;readonly opacity?:number;readonly pose?:number;}
 interface Actor extends Point,Pose {readonly height:number;readonly id:string;readonly name:string;readonly archetype:string;readonly visualAsset:string;readonly personality:string;readonly equipment:Value<LittlewildDeveloper.Document>;readonly away:boolean;readonly selected:boolean;}
 interface ObjectRecord extends Point,Pose {readonly height:number;readonly id:string;readonly kind:string;readonly details:Value<LittlewildDeveloper.Document>;}
 interface Room extends Omit<Value<LittlewildDeveloper.BuildingInteriorSnapshot>,'actors'> {readonly actors:readonly (Value<LittlewildDeveloper.BuildingInteriorSnapshot['actors'][number]>&Pose&{readonly personality?:string;readonly height?:number;readonly equipment?:Value<LittlewildDeveloper.Document>;readonly cargoItems?:readonly {readonly id:string;readonly quantity:number}[]})[];}
 interface Frame {
  readonly scene?:{readonly id:string;readonly name:string;readonly dimension:Dimension;readonly kind?:LWSceneGraph.Kind;readonly bounds:Value<LWSceneGraph.Bounds>|null};
  readonly props:readonly (Value<LittlewildDeveloper.SceneProp>&Pose&{readonly height?:number})[];
  /** Presentation time and delta are seconds, supplied by the existing application cadence. */
  readonly version:1;readonly time:number;readonly delta:number;readonly simTime:number;readonly running:boolean;readonly alpha:number;
  readonly camera:Camera;readonly viewport:Viewport;readonly actors:readonly Actor[];readonly nodes:readonly ObjectRecord[];readonly buildings:readonly ObjectRecord[];
  readonly tiles:readonly (Point & {readonly ground:string;readonly height:number})[];readonly terrain:Value<LittlewildDeveloper.Document>;readonly construction:Value<LittlewildDeveloper.Document>;readonly interiors:Value<LittlewildDeveloper.Document>;readonly environment:Value<LittlewildDeveloper.Document>|null;
  readonly presentation:Value<LittlewildDeveloper.Document>;readonly interiorView:{readonly buildingId:string;readonly floorId:string;readonly surface:Surface|null}|null;readonly room:Room|null;
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
 type AsyncFactory=(context:Context)=>Promise<Instance>;
 interface SwitchResult {readonly ok:boolean;readonly reason?:string;}
 interface Registry {
  readonly version:1;
  register(metadata:Metadata,factory:Factory):()=>void;
  registerAsync(metadata:Metadata,factory:AsyncFactory):()=>void;
  list():readonly Metadata[];
  validate(metadata:unknown):{readonly ok:boolean;readonly errors:readonly string[];readonly data:Metadata|null};
  create(id:string,context:Context):Instance;
  prepare(id:string,context:Context):Promise<Instance>;
 }
 interface Host {
  readonly hasDetachedPresentation:boolean;readonly rendererId:string;readonly rendererDimension:Dimension;readonly capabilities:readonly Capability[];readonly canvas:HTMLCanvasElement;
  selectRenderer(id:string):SwitchResult;
  selectRendererAsync(id:string):Promise<SwitchResult>;
  selectSceneRendering(rendering:LWSceneGraph.Rendering):Promise<SwitchResult>;
  setInteriorView(buildingId:string|null,floorId?:string,surface?:Surface):void;
  /** Trusted detached source and externally advanced playback; neither creates a game clock. */
  setPreview(source:LWStorytelling.PreviewSource|null):void;
  setPlayback(playback:LWStorytelling.Playback|null):void;
  setAnimations(descriptors:readonly LWAnimations.Descriptor[]|null):void;
  snapshot():Frame;
  project(point:Point):Point;
  dispose():void;
 }
}
declare var LWRenderers:LittlewildRenderer.Registry;
declare var LWRendererHost:{player():LittlewildRenderer.Host};
declare var LWRendererExample:{register():()=>void;activate():{readonly ok:boolean;readonly reason?:string}};
