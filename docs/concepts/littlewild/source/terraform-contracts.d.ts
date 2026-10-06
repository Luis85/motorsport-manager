/// <reference path="./construction-contracts.d.ts" />
/// <reference path="./runtime-contracts.d.ts" />
/** Local terrain is saved with its world. Plants are references to physical resource nodes. */
declare namespace LWTerraform {
 type Ground='grass'|'water';
 interface Tile {ground:Ground;height:number;}
 interface Plant {kind:string;model:string;}
 interface State {version:1;revision:number;sequence:number;tiles:Record<string,Tile>;plants:Record<string,Plant>;}
 interface TileEdit extends LWRuntime.Point {ground?:Ground;height?:number;}
 interface PlantEdit extends LWRuntime.Point,Plant {}
 interface Edit {revision:number;tiles:TileEdit[];plants:PlantEdit[];}
 interface World extends LWConstruction.World {terraform?:State;}
 interface Engine extends Omit<LWConstruction.Engine,'s'|'actor'|'creatures'> {
  s:World;actor:LWApplication.Actor;creatures:LWApplication.Actor[];
 }
 interface Snapshot {revision:number;tiles:Record<string,Tile>;plants:Record<string,Plant>;choices:{kind:string;label:string;models:string[]}[];}
 type Preview={ok:true;revision:number;tiles:TileEdit[];plants:PlantEdit[]}|LWRuntime.Failure;
 interface StateApi {empty():State;validate(input:unknown,world:World):State|undefined;edit(input:unknown,world:World):Edit;choices():Snapshot['choices'];copy<T>(input:T):T;}
 interface RuntimeApi {preview(engine:Engine,input:unknown):Preview;apply(engine:Engine,input:unknown):LWPhysicalPorts.ActionResult;snapshot(engine:Engine):Snapshot;routeIssue(world:World):string|null;}
 interface Geography {
  SIZE:number;STRIDE:number;cell(x:number,y:number):LWRuntime.Point & {ix:number;iy:number};
  terrainAt(world:World,x:number,y:number):string;heightAt(world:World,x:number,y:number):number;
  ownedTile(world:World,x:number,y:number):boolean;
  Grid:new(world:World)=>{pass(x:number,y:number):boolean;canStep(from:LWRuntime.Point,to:LWRuntime.Point):boolean;path(from:LWRuntime.Point,to:LWRuntime.Point,adjacent?:boolean):LWRuntime.Point[]|null;};
 }
}
