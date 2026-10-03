/// <reference path="./application-records.d.ts" />
/// <reference path="./content-contracts.d.ts" />
/** Capabilities used by the village layer. Earlier layers retain ownership of
 * actor scope, pathfinding, physical jobs, and atomic economic settlement. */
declare namespace LWVillagePorts {
 type Actor=LWApplication.Actor;type Building=LWApplication.Building;
 type State=LWApplication.State & {buildPolicy:Actor['buildPolicy']};
 type Draft=Partial<LWApplication.Task>&{kind:string};
 type Result={ok:true}|{ok:false;reason:string};
 type Purchase={ok:true;creature:Actor;price:number}|{ok:false;reason:string};
 type Category=LWContentPorts.RequirementCategory;
 interface BaseHost {
  s:State;actor:Actor;creatures:Actor[];selected:Actor|null|undefined;
  _authorizedActorId:string|undefined;_placementKind?:string|null;
  withActor<T>(actor:Actor,fn:()=>T):T;interactionIssue():string|null;
  research(id:string):Result;teach(id:string):Result;request(type:string,id?:string,qty?:number):Result;
  requestEquipment(id:string):Result;acceptQuest(id:string):Result;depart():boolean;returnQuest():boolean;
  resourceTask(id:string,orderId?:string|null,force?:boolean,quantity?:number,visited?:string[]):Draft|null;
  productionTask(building:Building,id:string,orderId?:string|null):Draft|null;
  configureBuilding(id:string,command:string,value?:unknown):Result;abortQuest():Result;
  questRewardSpec(quest:LWApplication.Quest,completed:boolean):LWTaskPorts.EconomySpec & {prestige?:number;earnedPrestige?:number};
  economySettlementId(scope:string,key?:string):string;
  settleEconomy(spec:LWTaskPorts.EconomySpec & {prestige?:number;earnedPrestige?:number},label?:string):{ok:boolean};
  purchaseCreature(personality:string,archetype?:string):Purchase;
  findPath(target:LWApplication.Point|null|undefined,adjacent?:boolean):LWApplication.Point[]|null;
  walkable(x:number,y:number):boolean;has(id:string):boolean;allOrders():LWApplication.Order[];
  nodeAt(x:number,y:number):(LWTaskPorts.Place&{max:number})|null;
  nodeAvailable(node:LWTaskPorts.Place|null|undefined):boolean;
  placementIssue(kind:string,x:number,y:number):string|null;canBuild(x:number,y:number,kind?:string|null):boolean;
  place(kind:string,x:number,y:number):Result;createNeedTask(which:string):Draft|null;
  releaseSocial(task:LWApplication.Task):void;releaseDetachedWork():void;
  startTask(task:Draft|null):boolean;stepWorld():void;finishTask(task:LWApplication.Task):void;
  emit(type:string,text:string,extra?:{actorId?:string}):void;log(text:string,icon?:string):void;
  careIssue(kind:string):string|null;care(kind:string):Result;changeFeeling(reason:string,joy:number,anger:number):void;
  visual(kind:string):void;warehouse():Building;depositKeep(actor?:Actor):LWApplication.Numbers;
  room(id:string):number;nearest<T extends LWApplication.Point>(places:T[]):T|undefined;reachable(point:LWApplication.Point):boolean;
  at(point:LWApplication.Point):boolean;recordTransfer(direction:string,items:LWApplication.Numbers):void;
  handlers():Record<string,()=>string>&{plans:()=>string;quest:()=>string};export():LWApplication.EngineDocument;
 }
 interface Host extends BaseHost {ensureDoors():void;assignUnhoused(events?:boolean):void;}
 interface Grid {cells:ReadonlySet<string>;pass(x:number,y:number):boolean;flood(point:LWApplication.Point):Set<string>;approach(point:LWApplication.Point):unknown;}
 interface Geography {
  describe(ix:number,iy:number):{name:string;biome:string};key(ix:number,iy:number):string;
  readonly DIRS:readonly(readonly[number,number])[];
  cell(x:number,y:number):{x:number;y:number};available(state:LWApplication.State,x:number,y:number):boolean;
  frontier(state:LWApplication.State):{ix:number;iy:number}[];ownedSet?(state:LWApplication.State):Set<string>;
  generatedNodes(ix:number,iy:number,world:LWContentPorts.WorldApi):(LWTaskPorts.Place&{max:number})[];
  Grid:new(state:LWApplication.State,plans?:LWApplication.Point[])=>Grid;
 }
 interface Root {
  LW:{worldTaskKinds:string[];clamp(n:number,min:number,max:number):number;
   RES:LWContentPorts.Tables['RES'];RECIPES:Record<string,LWContentPorts.Recipe>;
   BUILDINGS:LWContentPorts.Tables['BUILDINGS'];colony:{item(id:string):{name:string;price:number}|null};
   EngineComposition:{register(spec:{id:string;order:number;define(Base:new()=>BaseHost):new()=>BaseHost;initialize(host:Host,state:State):void;installFactories():void}):void;constructThrough(id:string,state:LWApplication.State,options:{demo:boolean}):Host};
   createWorldDemo():Host;Village?:{validate(state:unknown):void;indoor:Set<string>;marketKinds:string[]}};
  LWGeography:Geography;LWGrowth:LWContentPorts.GrowthApi;LWWorldContent:LWContentPorts.WorldApi;LWAdventure:LWContentPorts.AdventureApi;
  LWNavigation:{path(state:State,target:LWApplication.Point,adjacent:boolean):LWApplication.Point[]|null};
 }
}
