/// <reference path="./runtime-contracts.d.ts" />
/** Pure room/layout and location records. Aggregate and engine capabilities belong to application ports. */
declare namespace LWInterior {
 type Point=LWRuntime.Point;
 interface Station extends Point {id:string;label:string;kind:'workbench'|'storage'|'desk'|'hearth'|'bed'|'planter';production:boolean;}
 interface Stair extends Point {to:string;arrival:Point;seconds:number;}
 interface Edge extends Point {side:'n'|'e'|'s'|'w';kind:'wall'|'window'|'door';}
 interface Floor {cells?:Point[];edges?:Edge[];id:string;label:string;width:number;height:number;door:Point;stairs:Stair[];stations:Station[];}
 interface Layout {id:string;label:string;floors:Floor[];}
 interface Catalog {version:1;layouts:Layout[];bindings:Record<string,string>;fallback:string;}
 interface Location extends Point {buildingId:string;floorId:string;stationId:string|null;route:Waypoint[];purpose:'work'|'visit'|'exit';}
 interface Waypoint extends Point {floorId:string;seconds:number;}
 interface Visit {actorId:string;buildingId:string;floorId:string;created:number;phase:'queued'|'walk'|'inside';path:Point[];hold:number;}
 interface Binding {floorId:string;stationId:string;recipe:string;remaining:number;}
 interface State {version:1;catalog:Catalog;locations:Record<string,Location>;visits:Visit[];production:Record<string,Binding[]>;jobs:Record<string,{floorId:string;stationId:string;recipe:string}>;}
 interface CatalogWorld {interiors?:{catalog:Catalog};construction?:{designs:Record<string,{layout:Layout}>};}
 interface CatalogBuilding {kind:string;designId?:string;}
 interface CatalogApi {defaults:Catalog;validate(input:unknown):Catalog;layout(catalog:Catalog,kind:string):Layout;floor(layout:Layout,id:string):Floor|null;forBuilding(world:CatalogWorld,building:CatalogBuilding):Layout;copy<T>(value:T):T;}
}
