/// <reference path="./runtime-contracts.d.ts" />
/** Domain ECS records and transaction ports. Application state remains outside this contract. */
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
 interface Result extends LWRuntime.Result {state:'settled'|'duplicate'|'blocked'|'stale';amount:number;duplicate?:boolean;job?:Job|null;created?:boolean;success?:boolean;}
 interface Command<S> {spec:S;result:Result|null;}
 interface Components { Inventory:{items:Inventory};ResourceDeposit:{record:Deposit;resource:string;finite:boolean};Worksite:{storage:Storage};ProductionJob:{record:Job|null};CarrierTask:Command<Transfer>;HarvestTask:Command<Harvest>;ProductionReservation:Command<Reservation>;ProductionJobUpdate:Command<JobUpdate>;ProductionSettlement:Command<Settlement>; }
 interface World {readonly entities:ReadonlySet<string>;readonly running:boolean;readonly pendingStructural:number;create(id:string):string;destroy(id:string):boolean;set<K extends keyof Components>(id:string,type:K,data:Components[K]):Components[K];get<K extends keyof Components>(id:string,type:K):Components[K]|undefined;}
 interface Scheduler {register(spec:{id:string;phase:'simulate';order:number;query:TaskKind[];update(world:World,id:string):void}):Scheduler;step(world:World,dt:number,context?:{entityId:string}):void;}
 interface EcsApi {World:new()=>World;Scheduler:new()=>Scheduler;}
 interface Runtime {world:World;scheduler:Scheduler;bindInventory(id:string,items:Inventory):Components['Inventory'];bindDeposit(id:string,record:Deposit,resource:string,finite:boolean):Components['ResourceDeposit'];bindWorksite(id:string,storage:Storage):Components['ProductionJob'];transfer(spec:Transfer):Result;transfers(specs:Transfer[]):(Result & {id:string})[];harvest(spec:Harvest):Result;reserveProduction(spec:Reservation):Result;updateProduction(spec:JobUpdate):Result;settleProduction(spec:Settlement):Result;hasSettled(id:string):boolean;forget(id:string):boolean;}
 interface EcsPhysicalApi {create():Runtime;total(inventory:Inventory|null|undefined):number;}
}

