/// <reference path="./application-records.d.ts" />
/// <reference path="./content-contracts.d.ts" />
/** The colony layer borrows one scoped actor and one authoritative root from composition. */
declare namespace LWColonyPorts {
 type Actor=LWApplication.Actor;
 type State=LWApplication.State;
 type ScopedState=State & Actor;
 type Result={ok:boolean;reason?:string};
 type Item=LWContentPorts.Equipment|LWContentPorts.Adventure['chest']|(LWContentPorts.Item & {weight:number|undefined});
 interface Load {level:number;grams:number;maximumKg:number;overloaded:boolean;move:number;}
 interface Modifier {name:string;value:number;}
 interface Rating {skill:string;attribute:string;base:number;points:number;difficulty:string|null;modifiers:Modifier[];target:number;chance:number;}
 interface BaseHost {
  s:ScopedState;state:State;_blockedKey:string;
  has(id:string):boolean;canBuild(x:number,y:number):boolean;
  place(kind:string,x:number,y:number):Result;upgrade(id:string,approach?:string):Result;
  emit(type:string,text:string,extra?:object):void;log(text:string,icon?:string):void;
  transaction(label:string,guide?:number,pocket?:number,research?:number):void;
  xp(who:string,amount:number):void;practiceSkill(id:string,amount?:number):void;
  careIssue(kind:string):string|null;care(kind:string):Result;mood():string;
  economySettlementId(scope:string):string;settleEconomy(input:LWTaskPorts.EconomySpec,label?:string):Result;
  export():{app:string;version:number;state:object};
  research(id:string):Result;teach(id:string):Result;practice(id:string,count?:number):Result;
  cancelLesson(id:string):Result;setLearningStyle(style:string):Result;pauseLearning():Result;
  chooseSpecialization(discipline:string,specialization:string):Result;startStudy(discipline:string):Result;pauseStudy():Result;claimStudy():Result;
  setAllowance(coins:number):void;topUp():Result;setStockTarget(id:string,amount:number):Result;
  request(type:string,id?:string|null,amount?:number|null):Result;cancel(id:string):void;pauseOrder(id:string):void;prioritize(id:string):void;
 }
 interface Services {
  handlers():Record<string,(context:object)=>unknown>;
  addOffer(id:string,source:string):void;releaseSocial(task:LWApplication.Task|null):void;
  requestEquipment(id:string):Result;unequip(slot:string):Result;cancelEquipment(id:string):Result;
  acceptQuest(id:string):Result;cancelQuestPlan():Result;suggestSocial(id:string):Result;
 }
 interface Host extends BaseHost,Services {
  cancel(id:string):Result;
  _simulating:boolean;_actor:Actor|null;readonly actor:Actor;readonly creatures:Actor[];readonly selected:Actor|null|undefined;
  simulationProfile?:LWContentPorts.SimulationProfile|null|undefined;
  behaviorTree:object;ecs:{sync(actors:readonly Actor[]):void};domainPipeline:{step(engine:Host,dt:number):void};
  withActor<T>(actor:Actor|string,work:()=>T):T;interactionIssue():string|null;ensureWarehouse():void;
  purchaseCreature(personality:string,archetype?:string):Result;requestUnpack():Result;spendPoint(id:string):Result;
 }
 interface Constructor {new():BaseHost;readonly prototype:BaseHost;}
 interface LayerConstructor {new():Host;readonly prototype:Host;}
 interface Composition {
  register(layer:{id:string;order:number;define(base:Constructor):LayerConstructor;initialize(self:Host):void;decorate(layer:LayerConstructor,base:Constructor):void;installFactories():void}):void;
  constructThrough(layer:string,state:ScopedState):Host;
 }
 interface Facade extends LWContentPorts.Tables {
  EngineComposition:Composition;clamp(value:number,min:number,max:number):number;terrain(x:number,y:number):string;SIZE:number;
  createWorkshopDemo():Host;createColonyDemo?:()=>Host;
  colony?:{item(id:string):Item|null;definition(id:string):LWContentPorts.Equipment|undefined;profile(id:string):LWContentPorts.Personality;PERSONAL:readonly (keyof Actor)[];arrivalPoint(archetype?:string,personality?:string):LWApplication.Point};
 }
 interface Rpg {
  next(seed:number):{seed:number;value:number};encumbrance(strength:number,grams:number):Load;
  skillLevel(attribute:number,difficulty:'E'|'A'|'H'|'VH',points:number):number;nextCost(points:number):number;odds(target:number):{success:number};
  resolve(target:number,dice:number[]):LWTaskPorts.Roll;
 }
 interface CreatureDefinition {movement:{baseSpeed:number;bondThreshold:number;bondedSpeedBonus:number};}
 interface FactoryOptions {id:string;archetype:string;personality:string;mode:'arrival'|'founder';sequence:number;day:number;simTime:number;}
 interface Factory {
  readonly personalFields:readonly (keyof Actor)[];supportsPersonality(archetype:string,personality:string):boolean;
  hydrate(base:Partial<Actor>,options:FactoryOptions):Actor;create(options:FactoryOptions):Actor;definitionFor(actor:Actor):CreatureDefinition;
 }
 interface Creatures {readonly defaultArchetype:string;readonly defaultPersonality:string;seed(archetype:string,personality:string,mode:'arrival'|'founder',sequence:number):{creature:LWApplication.Point};}
 interface Dependencies {definition(id:string):LWContentPorts.Equipment|undefined;item(id:string):Item|null;profile(id:string):LWContentPorts.Personality;arrivalPoint(archetype?:string,personality?:string):LWApplication.Point;}
 interface Installer {install(target:object,predecessor:object,dependencies:Dependencies):void;}
 type GuardedName='care'|'research'|'teach'|'practice'|'cancelLesson'|'setLearningStyle'|'pauseLearning'|'chooseSpecialization'|'startStudy'|'pauseStudy'|'claimStudy'|'setAllowance'|'topUp'|'setStockTarget'|'place'|'upgrade'|'request'|'cancel'|'pauseOrder'|'prioritize'|'requestEquipment'|'unequip'|'cancelEquipment'|'acceptQuest'|'cancelQuestPlan'|'suggestSocial'|'requestUnpack'|'spendPoint';
 interface Root {
  LW:Facade;LWRPG:Rpg;LWAdventure:LWContentPorts.AdventureApi;LWCreatures:Creatures;LWCreatureFactory:Factory;
  LWColonyAdventures:Installer;LWColonyActivity:Installer;LWColonyLogistics:Installer;LWColonyTaskCompletion:Installer;
  LWActorStateView:{create(engine:Host,state:ScopedState,personal:readonly (keyof Actor)[]):ScopedState};
  LWBehaviorTree:new(handlers:Record<string,(context:object)=>unknown>)=>object;
  LWActorECS:{create(rules:unknown):Host['ecs']};LWSimulationPipeline:{create(archetype:unknown):Host['domainPipeline']};
 }
}
