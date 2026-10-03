/// <reference path="./runtime-contracts.d.ts" />
/// <reference path="./application-records.d.ts" />
/// <reference path="./content-contracts.d.ts" />
/** Base-engine capabilities. Fresh founder state precedes colony initialization;
 * the same personal fields later resolve through the actor-scoped state view. */
declare namespace LWCorePorts {
 type Numbers=LWApplication.Numbers;
 type Point=LWRuntime.Point;
 type Order=LWApplication.Order;
 type OrderView=Pick<Order,'type'> & Partial<Order>;
 type Task=LWApplication.Task;
 type Draft=Partial<Omit<Task,'target'>> & {kind:string;target?:Point|undefined};
 interface Lesson {id:string;progress:number;style?:string;tuition?:number;}
 interface Memory {key:string;title:string;description:string;icon:string;day:number;hour:number;}
 interface Wish {stat:string;amount:number;title:string;thought:string;action:string;day:number;start:number;complete:boolean;}
 interface Personal extends Omit<LWApplication.Actor,'id'|'training'|'orders'|'task'|'homeId'|'worldPickup'|'worldSupply'> {
  training:Lesson|null;orders:Order[];task:Task|null;memories:Memory[];wish:Wish|null;
 }
 interface State extends Personal {
  version:number;seed:number;simTime:number;day:number;hour:number;started:boolean;speed:number;paused:boolean;
  player:{level:number;xp:number;coins:number};rp:number;buildings:LWApplication.Building[];
  nodes:(LWTaskPorts.Place & {max:number})[];completedQuests:string[];contractIndex:number;nextId:number;
  settings:{sound:boolean;follow:boolean;reducedMotion:boolean;highContrast:boolean;duels?:boolean;quests?:boolean};
  log:{text:string;icon:string;time:number;day:number;hour:number}[];
  ledger:{label:string;guide:number;pocket:number;research:number;day:number;hour:number}[];
  colony?:LWApplication.State['colony'];
 }
 interface Issue {text:string;skill?:string;building?:string;paused?:boolean;practice?:string;}
 interface Result extends LWRuntime.Result {amount?:number;}
 type PlanResult=LWRuntime.ActionResult<{order:Order}>;
 interface EconomySpec {id?:string;actorCpPerLevel?:number;guide?:number;pocket?:number;research?:number;actorXp?:number;playerXp?:number;chapterId?:string;stats?:Numbers;}
 interface EconomyResult extends LWRuntime.Result {state:string;deltas:{guide:number;pocket:number;research:number}|null;levelUps:{who:'player'|'actor';level:number}[];actorCp:number;}
 interface EconomyRuntime {settle(state:unknown,actor:LWApplication.Actor|null,spec:EconomySpec):EconomyResult;splitIncome(amount:number):{guide:number;pocket:number};rules:{xp:{playerResearchPerLevel:number}};}
 interface EngineFields {s:State;simulationProfile:LWContentPorts.SimulationProfile|null;events:LWRuntime.Event[];acc:number;refreshTimer:number;_blockedKey:string;_blocked:Set<string>;economyEcs:EconomyRuntime|null;_economySettlementSequence:number;_actor?:LWApplication.Actor;}
 interface InstalledMethods {
  remember(key:string,title:string,description:string,icon?:string):void;newWish():void;checkWish():void;
  mastery(id:string|null|undefined):{points:number;rank:number;label:string;bonus:number;next:number|null};
  practiceSkill(id:string|null|undefined,amount?:number):void;taskSkill(task:Task):string|null|undefined;workRate(task:Task):number;
  setStockTarget(resource:string,amount:number):Result;careIssue(kind:string):string|null;mood():string;friendship():string;
  quest():LWContentPorts.Tables['QUESTS'][number]|null;claimQuest():Result;care(kind:string):Result;research(id:string):Result;teach(id:string):Result;
  setAllowance(amount:number):void;topUp(automatic?:boolean):Result;
  resourceTask(resource:string,orderId?:string|null,force?:boolean):Draft|null;shoppingTask(resource:string,orderId?:string|null,essential?:boolean):Draft|null;
  needTask(which:string):Draft|null;createNeedTask(which:string):Draft|null;orderTask(order:Order):Draft|null;
  decide():void;finishTask(task:Task):void;planStatus(order:Order):LWTaskPorts.PlanStatus;
  constructionCost?(order:OrderView):Numbers;
 }
 interface BaseEngine extends EngineFields,InstalledMethods {
  has(kind:string):boolean;walkable(x:number,y:number):boolean;canBuild(x:number,y:number):boolean;place(kind:string,x:number,y:number):PlanResult;
  request(type:string,resource?:string|null,quantity?:number|null):PlanResult;orderName(order:Order):string;cancel(id:string):void;pauseOrder(id:string):void;prioritize(id:string):void;
  missingSkill(resource:string):string|null;assessResource(resource:string,amount:number,seen?:Set<string>):Issue|null;orderIssue(order:OrderView):Issue|null;
  nearest<T extends Point>(nodes:T[]):T|undefined;findPath(target:Point,adjacent?:boolean):Point[]|null;startTask(task:Draft):boolean;
  splitIncome(amount:number):EconomyResult;trade(resource:string,mode:string,quantity?:number):Result;step(dt:number):void;advance(seconds:number):void;
  export():{app:string;version:number;state:State};emit(type:LWRuntime.EventKind,text:string,extra?:LWRuntime.EventPayload):void;log(text:string,icon?:string):void;
  economyRuntime():EconomyRuntime;economyActor():LWApplication.Actor|null;economySettlementId(scope:string,key?:string):string;settleEconomy(input:EconomySpec,label?:string|null):EconomyResult;
  xp(who:string,amount:number):EconomyResult;researchGain(amount:number,label?:string):EconomyResult;transaction(label:string,guide?:number,pocket?:number,research?:number):void;
 }
 interface SystemsEngine extends BaseEngine {
  addResourceNodes():void;buildingLevel(kind:string):number;specialization(id:string):boolean;stationBonus(kind:string):number;
  learningRate(style?:string):number;lessonIssue(id:string):Issue|null;startStudy(id:string):Result;
  constructionSkill(order:OrderView):string;constructionCost(order:OrderView):Numbers;constructionPhases(order:OrderView):{name:string;cost:Numbers;time:number}[];
  totalCost(order:OrderView):Numbers;projectProgress(order:OrderView):number;remainingCost(order:OrderView):Numbers;refundPreview(order:OrderView):Numbers;
  upgradeEffect(building:LWApplication.Building,level?:number):string;qualityName(quality:number):string;buildQuality(order:OrderView):number;record(event:string,amount?:number):void;
 }
 interface CompositionOptions {demo?:boolean;}
 interface Composition {
  prepare(state:State|null|undefined,options:CompositionOptions):State|null|undefined;
  initialize(engine:BaseEngine,state:State,options:CompositionOptions):void;
  constructThrough(layer:string):SystemsEngine;
  register(spec:{id:string;order:number;define(base:new()=>BaseEngine):new()=>SystemsEngine;initialize(engine:SystemsEngine):void;installFactories(context:{L:Facade}):void}):void;
 }
 interface BaseFacade extends Pick<LWContentPorts.Tables,'SKILLS'|'BUILDINGS'|'RES'|'RECIPES'|'QUESTS'|'CONTRACTS'> {
  Engine:new(state?:State|null,options?:CompositionOptions)=>BaseEngine;initial():State;SIZE:number;terrain(x:number,y:number):string;seeded(seed:number):()=>number;threshold(level:number):number;clamp(value:number,minimum:number,maximum:number):number;
 }
 interface Facade extends BaseFacade,LWContentPorts.Tables {EngineComposition:Composition;createWorkshopDemo?:()=>SystemsEngine;
 }
 interface Root {
  LWGameSettings?:{validateState(state:unknown):void};
  LW?:BaseFacade;LWContent:LWContentPorts.ContentApi;LWEngineComposition?:Composition;
  LWNavigation:{grid(state:State):{pass(x:number,y:number):boolean};path(state:State,target:Point,adjacent:boolean):Point[]|null};
  LWCreatures:{defaultArchetype:string;defaultPersonality:string;seed(archetype:string,personality:string,mode:'founder',sequence:number):unknown};
  LWEngineTaskPlanning:{install(target:object):void};LWEngineTaskCompletion:{install(target:object):void};LWEngineCompanion:{install(target:object):void};
  LWGeography?:{terrain(x:number,y:number):string};LWSimulationProfile?:{current:LWContentPorts.SimulationProfile};
  LWEconomyECS?:{create(rules?:unknown):EconomyRuntime};LWAdventure?:LWContentPorts.AdventureApi;
  LWActorStateView?:{rootOf(state:State):unknown};
 }
}
