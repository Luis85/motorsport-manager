/// <reference path="./legacy-task-records.d.ts" />
/// <reference path="./content-contracts.d.ts" />
/** Physical records remain authoritative save data; ECS bindings only borrow them. */
declare namespace LWPhysicalPorts {
 type Inventory = Record<string, number>;
 interface Deposit { stock:number; }
 interface Job { id:string;output:string;amount:number;duration:number;progress:number;attempts?:number;workerId?:string|null;cost?:Inventory; }
 interface PaidJob extends Job { recipe:string;originId:string;orderId:string|null;attempts:number;workerId:string|null;cost:Inventory; }
 interface Storage { input:Inventory;output:Inventory;job?:Job|null;completed?:number;lastOutput?:number;lastMessage?:string; }
 interface BuildingStorage extends Storage { job:PaidJob|null;completed:number;lastOutput:number;lastMessage:string;targets:Inventory;requests:Inventory;enabled:boolean;priority:number;emptyInputs:boolean;flushOutput?:boolean; }
 interface Recipe { id:string;output:string;cost:Inventory;amount:number;time:number;skill:string;kind:string;depletion:number; }
 interface Transfer { id:string;sourceId:string;destinationId:string;source:Inventory;destination:Inventory;resource:string;requested:number;destinationLimit:number; }
 interface Harvest { id:string;depositId:string;deposit:Deposit;finite:boolean;destinationId:string;destination:Inventory;resource:string;requested:number;destinationLimit:number; }
 interface Reservation { id:string;worksiteId:string;storage:Storage;recipe:{cost:Inventory;output?:string};job:Job;outputCapacity:number;outputAmount:number;depositId?:string|null;deposit?:Deposit|null;substrateResource?:string;substrateFinite?:boolean;substrateDepletion?:number; }
 interface UpdateBase { id:string;worksiteId:string;storage:Storage;jobId:string; }
 type JobUpdate = UpdateBase & ({action:'progress';progress:number}|{action:'claim';workerId:string;allowTakeover:boolean}|{action:'release';progress?:number|undefined});
 interface Settlement extends UpdateBase { success:boolean;outputCapacity:number;time:number;retryProgress:number;message?:string; }
 interface Specs { CarrierTask:Transfer;HarvestTask:Harvest;ProductionReservation:Reservation;ProductionJobUpdate:JobUpdate;ProductionSettlement:Settlement; }
 type TaskKind=keyof Specs;
 type Spec=Specs[TaskKind];
 interface Result {ok:boolean;state:'settled'|'duplicate'|'blocked'|'stale';amount:number;duplicate?:boolean;job?:Job|null;created?:boolean;success?:boolean;}
 interface Command<S> {spec:S;result:Result|null;}
 interface Components { Inventory:{items:Inventory};ResourceDeposit:{record:Deposit;resource:string;finite:boolean};Worksite:{storage:Storage};ProductionJob:{record:Job|null};CarrierTask:Command<Transfer>;HarvestTask:Command<Harvest>;ProductionReservation:Command<Reservation>;ProductionJobUpdate:Command<JobUpdate>;ProductionSettlement:Command<Settlement>; }
 interface World {readonly entities:ReadonlySet<string>;readonly running:boolean;readonly pendingStructural:number;create(id:string):string;destroy(id:string):boolean;set<K extends keyof Components>(id:string,type:K,data:Components[K]):Components[K];get<K extends keyof Components>(id:string,type:K):Components[K]|undefined;}
 interface Scheduler {register(spec:{id:string;phase:'simulate';order:number;query:TaskKind[];update(world:World,id:string):void}):Scheduler;step(world:World,dt:number,context?:{entityId:string}):void;}
 interface EcsApi {World:new()=>World;Scheduler:new()=>Scheduler;}
 interface Runtime {world:World;scheduler:Scheduler;bindInventory(id:string,items:Inventory):Components['Inventory'];bindDeposit(id:string,record:Deposit,resource:string,finite:boolean):Components['ResourceDeposit'];bindWorksite(id:string,storage:Storage):Components['ProductionJob'];transfer(spec:Transfer):Result;transfers(specs:Transfer[]):(Result & {id:string})[];harvest(spec:Harvest):Result;reserveProduction(spec:Reservation):Result;updateProduction(spec:JobUpdate):Result;settleProduction(spec:Settlement):Result;hasSettled(id:string):boolean;forget(id:string):boolean;}
 interface EcsPhysicalApi {create():Runtime;total(inventory:Inventory|null|undefined):number;}
}

/** Capabilities borrowed by the physical world layer from its colony predecessor. */
declare namespace LWPhysicalPorts {
 type Point=LWTaskPorts.Point;
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
 interface Building extends Point {id:string;kind:string;level:number;stock:number;regen:number;storage?:BuildingStorage;}
 type Worksite=Building & {storage:BuildingStorage};
 interface ResourceNode extends Point,Deposit {id:string;kind:string;max:number;regen:number;}
 interface TransferRecord {time:number;actorId:string;name:string;buildingId:string;direction:'in'|'out';resource:string;amount:number;}
 interface State extends Omit<LWTaskPorts.State,'buildings'|'nodes'|'task'|'colony'|'player'> {
  version:number;started:boolean;paused:boolean;rp:number;buildings:Building[];nodes:ResourceNode[];task:Task|null;
  player:{level:number;coins:number};world:{version:number;sequence:number;transfers:TransferRecord[]};
  colony:LWTaskPorts.State['colony'] & {creatures:Actor[];selectedId:string|null};
 }
 type ActionResult={ok:true}|{ok:false;reason:string};
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
  changeFeeling(reason:string,joy:number,anger:number):void;log(text:string,icon?:string):void;emit(type:string,text:string,extra?:object):void;
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
