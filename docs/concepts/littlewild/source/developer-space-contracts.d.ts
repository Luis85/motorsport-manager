/// <reference path="./runtime-contracts.d.ts" />
/** Public JSON shapes for portable building layouts, observations and design authoring. */
declare namespace LittlewildDeveloper {
 interface InteriorPoint {x:number;y:number;}
 interface InteriorStation extends InteriorPoint {id:string;label:string;kind:'workbench'|'storage'|'desk'|'hearth'|'bed'|'planter';production:boolean;}
 interface InteriorStair extends InteriorPoint {to:string;arrival:InteriorPoint;seconds:number;}
 interface InteriorEdge extends InteriorPoint {side:'n'|'e'|'s'|'w';kind:'wall'|'window'|'door';}
 interface InteriorFloor {id:string;label:string;width:number;height:number;door:InteriorPoint;stairs:InteriorStair[];stations:InteriorStation[];cells?:InteriorPoint[];edges?:InteriorEdge[];}
 interface InteriorLayout {id:string;label:string;floors:InteriorFloor[];}
 interface InteriorActor extends InteriorPoint {id:string;name:string;archetype:string;visualAsset:string;floorId:string;stationId:string|null;action:string;mood:string;progress:number|null;remainingSeconds:number|null;moving:boolean;direction:number;cargo:string;transfer:boolean;}
 interface BuildingInteriorSnapshot {
  fixtureAsset:string;fixtureModel:string;buildingId:string;buildingName:string;kind:string;floors:InteriorFloor[];actors:InteriorActor[];time:number;
  status:{label:string;kind:string;detail:string};input:Record<string,number>;output:Record<string,number>;
  recipes:{id:string;name:string;amount:number;time:number;cost:Record<string,number>;skill:string;queued:number}[];
  transfers:{actorId:string;name:string;direction:string;resource:string;amount:number;time:number}[];
 }
 interface BuildingDesignDraft {name:string;kind:string;layout:InteriorLayout;mapUnit?:{width:number;height:number};}
 interface BuildingDesign extends BuildingDesignDraft {id:string;footprint:InteriorPoint[];mapUnit:{width:number;height:number};}
 interface ConstructionPhase {name:string;cost:Record<string,number>;time:number;}
 type BuildingDesignPreview={ok:true;design:BuildingDesign;cost:Record<string,number>;phases:ConstructionPhase[]}|LWRuntime.Failure;
 interface ConstructionOptions {types:{id:string;name:string}[];designs:BuildingDesign[];buildings:{id:string;kind:string;name:string}[];}
 type TerrainGround='grass'|'water';
 interface TerrainTile {ground:TerrainGround;height:number;}
 interface TerrainPlant {kind:string;model:string;}
 interface TerrainTileEdit extends InteriorPoint {ground?:TerrainGround;height?:number;}
 interface TerrainPlantEdit extends InteriorPoint,TerrainPlant {}
 interface TerraformEdit {revision:number;tiles:TerrainTileEdit[];plants:TerrainPlantEdit[];}
 interface TerraformSnapshot {revision:number;tiles:Record<string,TerrainTile>;plants:Record<string,TerrainPlant>;choices:{kind:string;label:string;models:string[]}[];}
 type TerraformPreview={ok:true;revision:number;tiles:TerrainTileEdit[];plants:TerrainPlantEdit[]}|LWRuntime.Failure;
 type RendererCapability='camera'|'hit-test'|'terrain-preview'|'construction-preview'|'resource-lens'|'interiors';
 interface RendererMetadata {readonly id:string;readonly name:string;readonly description:string;readonly capabilities:readonly RendererCapability[];}
 interface RendererValidation {readonly ok:boolean;readonly errors:readonly string[];readonly data:RendererMetadata|null;}
 interface RendererDiscovery {list():readonly RendererMetadata[];validate(input:unknown):RendererValidation;}

}
