/// <reference path="./balancing-contracts.d.ts" />
/// <reference path="./runtime-contracts.d.ts" />
/// <reference path="./building-interior-contracts.d.ts" />
/// <reference path="./application-records.d.ts" />
declare namespace LWConstruction {
 interface MapUnit {width:number;height:number;}
 interface Draft {name:string;kind:string;layout:LWInterior.Layout;mapUnit?:MapUnit;}
 interface Design extends Draft {mapUnit:MapUnit;id:string;footprint:LWRuntime.Point[];}
 interface State {version:1;sequence:number;designs:Record<string,Design>;}
 interface Order extends LWApplication.Order {designId?:string;buildingId?:string;}
 interface Building extends LWApplication.Building {designId?:string;}
 interface World extends Omit<LWApplication.State,'buildings'> {world:LWPhysicalPorts.State['world'];construction?:State;interiors?:LWInterior.State;buildings:Building[];}
 interface Phase {name:string;cost:Record<string,number>;time:number;}
 type Preview={ok:true;design:Design;cost:Record<string,number>;phases:Phase[]}|{ok:false;reason:string};
 interface Options {types:{id:string;name:string}[];designs:Design[];buildings:{id:string;kind:string;name:string}[];}
 interface Engine extends LWBalanceRules.Owner {
  s:World;actor:LWApplication.Actor;creatures:LWApplication.Actor[];
  allOrders():Order[];unlocked(category:'buildings',kind:string):boolean;
  interactionIssue():string|null;placementIssue(kind:string,x:number,y:number):string|null;
  constructionPhases(order:Order):Phase[];totalCost(order:Order):Record<string,number>;
  constructionSkill(order:Order):string;finishTask(task:LWApplication.Task):void;
  canBuild(x:number,y:number,kind?:string|null):boolean;place(kind:string,x:number,y:number):LWPhysicalPorts.ActionResult;
  log(text:string,icon?:string):void;export():unknown;
 }
 interface DesignsApi {preserve(previous:LWInterior.Layout,next:LWInterior.Layout):string|null;validate(input:unknown,id?:string):Design;cost(design:Design,engine?:LWBalanceRules.Owner):Record<string,number>;improvementCost(previous:Design,next:Design,engine?:LWBalanceRules.Owner):Record<string,number>;phases(design:Design,engine?:LWBalanceRules.Owner):Phase[];copy<T>(v:T):T;}
 interface GeometryApi {cells(world:World,place:LWRuntime.Point & {designId?:string}):LWRuntime.Point[];blockers(world:World):LWRuntime.Point[];issue(engine:Engine,design:Design,x:number,y:number,replacing?:Building):string|null;topologyIssue(world:World):string|null;}
}
