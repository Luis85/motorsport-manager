/// <reference path="./construction-contracts.d.ts" />
/// <reference path="./physical-ecs-contracts.d.ts" />
/// <reference path="./runtime-contracts.d.ts" />
/// <reference path="./legacy-task-records.d.ts" />
/// <reference path="./content-contracts.d.ts" />
/** Physical records remain authoritative save data; ECS bindings only borrow them. */
/** Capabilities borrowed by the physical world layer from its colony predecessor. */
declare namespace LWPhysicalPorts {
 type Point=LWRuntime.Point;
 type Order=LWTaskPorts.Order;
 interface Task extends LWTaskPorts.Task {buildingId?:string;buffered?:boolean;jobId?:string|null;recipeId?:string;forDelivery?:boolean;supplyFor?:string;worldGather?:boolean;}
 type Draft=Partial<Omit<Task,'target'>> & {kind:string;target?:Point|undefined};
 interface CarryIntent {buildingId:string;resource:string;amount:number;recipeId?:string|undefined;}
 interface Actor extends Omit<LWTaskPorts.Actor,'task'|'learning'> {
  task:Task|null;orders:Order[];worldSupply:CarryIntent|null;worldPickup:CarryIntent|null;
  metrics:{gathered:Inventory;crafts:Inventory};stats:LWTaskPorts.Statistics;memory:{lastAchievement:number};
  researched:Record<string,boolean>;stockTargets:Inventory;training:LWTaskPorts.Lesson|null;
  learning:{recovering:boolean;queue:LWTaskPorts.Lesson[];paused:boolean};
 }
 interface Building extends Point {designId?:string;id:string;kind:string;level:number;stock:number;regen:number;storage?:BuildingStorage;}
 type Worksite=Building & {storage:BuildingStorage};
 interface ResourceNode extends Point,Deposit {id:string;kind:string;max:number;regen:number;}
 interface TransferRecord {time:number;actorId:string;name:string;buildingId:string;direction:'in'|'out';resource:string;amount:number;}
 interface State extends Omit<LWTaskPorts.State,'buildings'|'nodes'|'task'|'colony'|'player'> {
  construction?:LWConstruction.State;version:number;started:boolean;paused:boolean;rp:number;buildings:Building[];nodes:ResourceNode[];task:Task|null;
  player:{level:number;coins:number};world:{version:number;sequence:number;transfers:TransferRecord[]};
  colony:LWTaskPorts.State['colony'] & {creatures:Actor[];selectedId:string|null};
 }
 type ActionResult=LWRuntime.ActionResult;
 interface Options {demo?:boolean;preserveSeededStock?:boolean;}
 interface Engine {
  s:State;actor:Actor;creatures:Actor[];worldEcs:Runtime;_worldTransactionIds:WeakMap<object,string>;_worldTransactionSequence:number;_placementKind?:string|null;
  allOrders():Order[];canBuild(x:number,y:number,kind?:string|null):boolean;place(kind:string,x:number,y:number):ActionResult;interactionIssue():string|null;
  findPath(target:Point,approach:boolean):Point[]|null;nearest<T extends Point>(places:T[]):T|undefined;warehouse():Building;
  load(actor?:Actor):{maximumKg:number;grams:number};constructionCost(order:Order):Inventory;specialization(id:string):boolean;
  resourceTask(id:string,orderId?:string|null,force?:boolean,quantity?:number,visited?:string[]):Draft|null;
  depositTask(reason?:string):Draft|null;shoppingTask(id:string,orderId?:string|null,essential?:boolean):Draft|null;
  assessResource(id:string,amount:number,seen?:Set<string>):LWTaskPorts.Issue|null;createNeedTask(which:string):Draft|null;depositKeep(actor?:Actor):Inventory;
  orderTask(order:Order):Draft|null;handlers():Record<string,()=>string> & {homecoming:()=>string;plans:()=>string;deposit:()=>string};
  startTask(task:Draft|null):boolean;stepWorld():void;stepActor(dt:number):void;finishTask(task:Task):void;workRate(task:Task):number;
  at(target:Point):boolean;check(skill:string,extra:number,label:string|undefined):LWTaskPorts.Roll;xp(who:string,amount:number):void;
  changeFeeling(reason:string,joy:number,anger:number):void;log(text:string,icon?:string):void;emit(type:LWRuntime.EventKind,text:string,extra?:LWRuntime.EventPayload):void;
  record(key:string,amount:number):void;practiceSkill(skill:string|undefined):void;researchGain(amount:number):void;
  care(kind:string):ActionResult;cancel(id:string):ActionResult;cancelEquipment(id:string):ActionResult;depart():boolean;upgradeEffect(building:Building,level?:number):string;
  export():{version:number;state:State};
 }
 interface WorldEngine extends Engine {
  initWorld(options?:Options):void;syncBuildings(options?:Options):void;seedExistingSites():void;physicalToken(kind:string,record:object,subject?:string):string;
  releaseProduction(building:Building,progress?:number):Result|null;nodeAt(x:number,y:number):ResourceNode|null;nodeAvailable(node:ResourceNode|null|undefined):boolean;remaining(node:ResourceNode):number;
  capacity(building:Building,which:'input'|'output'):number;buildingRecipes(building:Building):Recipe[];recipe(building:Building,id:string|undefined):Recipe|null;
  originatingOrder(job:Pick<PaidJob,'originId'|'orderId'>):Order|null;
 }
 interface IntegrityApi {
  resourceAccessIssue(engine:WorldEngine,candidate:Point & {kind?:string|null|undefined}):string|null;
  substrateIssue(engine:WorldEngine,building:Building,recipe?:Recipe|null):string|null;
  validateIdentities(state:State):void;sameQuantities(left:unknown,right:unknown):boolean;
 }
 interface ProductionQueries {creatures:Actor[];originatingOrder(job:PaidJob):Order|null;nodeAt(x:number,y:number):ResourceNode|null;nodeAvailable(node:ResourceNode|null):boolean;buildingRecipes(building:Building):Recipe[];demandStock(id:string):number;substrateIssue(building:Building,recipe:Recipe):string|null;remaining(node:ResourceNode):number;capacity(building:Building,which:'input'|'output'):number;skillName(id:string):string;itemName(id:string):string;}
 interface ProductionApi {capacity(building:Building,which:'input'|'output',profile:LWContentPorts.WorldBuilding|undefined):number;recipes(building:Building,definitions:Record<string,LWTaskPorts.Recipe>,equipment:LWContentPorts.Equipment[],profile:LWContentPorts.WorldBuilding|undefined):Recipe[];status(queries:ProductionQueries,building:Building,profile:LWContentPorts.WorldBuilding|undefined):{label:string;kind:string;detail:string};}
 interface TasksApi {gather(node:ResourceNode,rule:{id:string;resource:string;mode:string;seconds:number},names:{item:string},orderId:string|null):Draft;transfer(kind:string,building:Building,id:string,amount:number,orderId:string|null,names:{item:string;building:string},extra?:Partial<Draft>):Draft;work(building:Building,recipe:Recipe,job:PaidJob|null,orderId:string|null,names:{item:string;building:string}):Draft;}
 interface Composition {register(layer:{id:string;order:number;define(base:new()=>Engine):new()=>WorldEngine;prepare(state:State):State;initialize(self:WorldEngine,state:State,options?:Options):void;installFactories():void}):void;constructThrough(layer:string,state?:State,options?:Options):WorldEngine;}
 interface Facade {RES:LWTaskPorts.Tables['RES'];RECIPES:LWTaskPorts.Tables['RECIPES'];BUILDINGS:LWTaskPorts.Tables['BUILDINGS'];SKILLS:LWTaskPorts.Tables['SKILLS'];clamp(value:number,minimum:number,maximum:number):number;terrain(x:number,y:number):string;SIZE:number;CROP_RES:Record<string,string>;EngineComposition:Composition;colony:{item(id:string):{name:string;weight:number};definition(id:string):LWTaskPorts.Gear|undefined;PERSONAL:readonly string[]};worldTaskKinds?:string[];createWorkshopDemo():WorldEngine;createColonyDemo():WorldEngine;createWorldDemo?:()=>WorldEngine;WorldSystem?:{validateState(state:State):void;siteIssues(world:LWContentPorts.World):string[];sum(inventory:Inventory|null|undefined):number;taskKinds:string[]};}
}
