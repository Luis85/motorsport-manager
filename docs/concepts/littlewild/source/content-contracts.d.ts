/// <reference path="./balancing-contracts.d.ts" />
/// <reference path="./storytelling-data-contracts.d.ts" />
/// <reference path="./scene-graph-contracts.d.ts" />
/// <reference path="./canvas-authoring-contracts.d.ts" />
/** Data and ports at the four authored-content boundaries. JSON stays unknown until validation. */
declare namespace LWContentPorts {
 type Json = null | boolean | number | string | Json[] | { [key:string]:Json };
 type QuantityMap = Record<string,number>;
 type SchemaType = 'object'|'array'|'string'|'number'|'integer'|'boolean'|'null';
 interface Schema {
  $ref?:string;$defs?:Record<string,Schema>;allOf?:Schema[];oneOf?:Schema[];if?:Schema;then?:Schema;else?:Schema;propertyNames?:Schema;
  type?:SchemaType|SchemaType[]; const?:unknown; enum?:unknown[]; anyOf?:Schema[];
  properties?:Record<string,Schema>; additionalProperties?:boolean|Schema; required?:string[];
  items?:Schema; minItems?:number; maxItems?:number; uniqueItems?:boolean;
  minProperties?:number; maxProperties?:number; minLength?:number; maxLength?:number;
  pattern?:string; minimum?:number; maximum?:number;
 }
 interface Recipe {station:string;skill:string;time:number;cost:QuantityMap;amount:number;}
 interface Tables {RES:Record<string,Omit<Item,'id'|'extensions'>>;SKILLS:Record<string,Omit<Skill,'id'|'extensions'>>;BUILDINGS:Record<string,Omit<Blueprint,'id'|'extensions'>>;RECIPES:Record<string,Recipe>;DRILLS:Record<string,Omit<Drill,'id'|'extensions'>>;DISCIPLINES:Record<string,Omit<Discipline,'id'|'extensions'>>;STYLES:Record<string,Omit<TeachingStyle,'id'|'extensions'>>;APPROACHES:Record<string,Omit<BuildingApproach,'id'|'extensions'>>;STUDIES:Record<string,Omit<Study,'id'|'extensions'>>;PATHS:Record<string,Omit<LearningPath,'id'|'extensions'>>;SPECIALIZATIONS:Record<string,{id:string;name:string;desc:string}[]>;CONTRACTS:Omit<Delivery,'id'|'extensions'>[];QUESTS:(Omit<Chapter,'checks'|'extensions'> & {checks:[string,(state:ChapterState)=>boolean,string][]})[];}
 interface ChapterState {stats:Record<string,number>;skills:Record<string,unknown>;buildings:{kind:string}[];bond:number;}
 interface ContentApi {readonly registry:Registry;readonly ContentError:new(issues:Diagnostic[])=>Error & {issues:Diagnostic[]};copy<T>(value:T):T;parse(input:unknown,limit?:number):unknown;stable(value:object):string;stable(value:unknown):string|undefined;fingerprint(value:unknown):string;readonly tables:Tables;}
 interface Production {output:string;skill:string;cost:QuantityMap;amount:number;seconds:number;depletion:number;}
 interface WorldNode {id:string;name:string;resource:string|null;mode:'infinite'|'finite';quantity:number;batch:number;seconds:number;skill:string|null;direct:boolean;}
 interface WorldBuilding {id:string;requiresNode:string|null;inputCapacity:number;outputCapacity:number;production:Production|null;defaultTarget:number;}
 interface Site {id:string;kind:string;x:number;y:number;}
 interface World {format:'littlewild-world';version:1;id:string;name:string;description:string;nodes:WorldNode[];buildings:WorldBuilding[];sites:Site[];logistics:{batch:number;outputAge:number};extensions?:Record<string,Json>;}
 type Validation<T>={ok:true;errors:string[];content:T}|{ok:false;errors:string[];content?:T|undefined};
 interface Change {path:string;before:unknown;after:unknown;}
 interface WorldApi {
  readonly defaults:World;readonly schema:Schema;readonly content:World;readonly hash:string;
  clone<T>(value:T):T;validate(input:unknown):Validation<World>;replace(input:unknown):World;
  withLibrary<T>(input:unknown,work:()=>T):T;diff(before:unknown,after:unknown,path?:string):Change[];
  hashOf(value:World):string;node(id:string):WorldNode|undefined;building(id:string):WorldBuilding|undefined;
 }
 interface Equipment {id:string;name:string;description:string;slot:string;visual:string;color:string;weight:number;price:number;travel:number;bonuses:QuantityMap;recipe:Omit<Recipe,'amount'>;}
 interface Trait {id:string;name:string;description:string;bonuses:QuantityMap;angerRate:number;soothing:number;social:number;travel:number;}
 interface Personality {id:string;name:string;description:string;traits:string[];color:string;accent:string;attributes:QuantityMap;selfControl:number;preferences:QuantityMap;}
 interface Quest {id:string;name:string;biome:string;description:string;tier:number;duration:number;energy:number;coins:number;research:number;cost:QuantityMap;steps:{name:string;skill:string;modifier:number}[];loot:{item:string;min:number;max:number;chance:number}[];}
 interface BehaviorNode {id:string;name:string;type:'selector'|'sequence'|'cooldown'|'action';action?:string;seconds?:number;children?:BehaviorNode[];}
 interface Adventure {format:'littlewild-adventure-content';schemaVersion:1;revision:string;weights:QuantityMap;equipment:Equipment[];traits:Trait[];personalities:Personality[];quests:Quest[];skillRules:Record<string,{attribute:'ST'|'DX'|'IQ'|'HT';difficulty:'E'|'A'|'H'|'VH'}>;rules:{purchaseBase:number;purchaseGrowth:number;maxCreatures:number;questCooldown:number;eventChance:number;questOfferLife:number;abortEnergy:number;abortReturnSeconds:number;returnSeconds:number;cpPerLevel:number;practicePerPoint:number};behaviorTree:BehaviorNode;chest:{id:string;name:string;description:string;weight:number;price:number;equipmentPool:string[];supplies:QuantityMap};extensions?:Record<string,Json>;}
 interface AdventureApi {readonly content:Adventure;readonly defaultContent:Adventure;readonly hash:string;readonly slots:string[];readonly visuals:string[];readonly ACTIONS:string[];copy<T>(value:T):T;hashOf(input:unknown):string;diff(before:unknown,after:unknown,limit?:number):{changes:(Change & {kind:string})[];total:number;truncated:boolean};parse(input:unknown):unknown;validate(input:unknown):Validation<Adventure>;replace(input:unknown):void;}
 type RequirementCategory='buildings'|'recipes'|'skills'|'items'|'features';
 interface Requirement {playerLevel:number;features:QuantityMap;research?:string;}
 interface Research {id:string;name:string;description:string;playerLevel:number;requires:QuantityMap;cost:number;grants:{feature:string;rank:number}|null;initial?:boolean;unlocks:string[];}
 interface Interaction {id:string;label:string;description:string;icon:string;handler:'care'|'moment';action?:'feed'|'water'|'bond'|'praise'|'soothe'|'space';eventOnly:boolean;cooldown:number;cost:QuantityMap;effects:QuantityMap;}
 interface Growth {
  format:'littlewild-growth-content';schemaVersion:2;revision:string;name:string;
  rules:{maxSlots:number;initialSlots:number;slotPrestigeBase:number;slotGrowth:number;slotLevelBase:number;slotLevelStep:number;questPrestigeBase:number;questPrestigePerTier:number;landLevel:number;landCoinsBase:number;landPrestigeBase:number;landGrowth:number;maxIslands:number;marketBatch:number;marketCapacity:number;marketSeconds:number};
  homes:Record<string,{places:number;perLevel:number}>;features:{id:string;name:string;maxRank:number}[];
  requirements:Record<RequirementCategory,Record<string,Requirement>>;research:Research[];
  shop:{id:string;name:string;prestige:number;playerLevel:number;items:QuantityMap}[];interactions:Interaction[];
  events:{id:string;trigger:string;interaction:string;seconds:number}[];extensions?:Record<string,Json>;
  cartography:{tableBuilding:string;distanceLevelStep:number;cooldown:number;eventChance:number;guaranteedAfterMisses:number;biomes:{id:string;minimumLevel:number;description:string;questIds:string[]}[]};
 }
 interface GrowthApi {readonly defaults:Growth;readonly schema:Schema;readonly content:Growth;readonly hash:string;clone<T>(value:T):T;validate(input:unknown):Validation<Growth>;replace(input:unknown):Growth;withLibrary<T>(input:unknown,work:()=>T):T;mechanicalHash(input:Growth):string;hashOf(input:unknown):string;}
 interface Definition {id:string;extensions?:Record<string,Json>;}
 interface Item extends Definition {name:string;icon:string;price:number;}
 interface Skill extends Definition {name:string;short:string;tier:number;rp:number;coins:number;time:number;desc:string;unlocks:string;requires:string[];icon:string;discipline:string;practical?:{skill:string;points:number};}
 interface Blueprint extends Definition {name:string;desc:string;skill:string;cost:QuantityMap;time:number;icon:string;effect:string;unique:boolean;category:string;placement?:string;}
 interface Drill extends Definition {cost:QuantityMap;station?:string;}
 interface Discipline extends Definition {name:string;icon:string;description:string;}
 interface TeachingStyle extends Definition {name:string;rate:number;practice:number;bond:number;joy:number;desc:string;}
 interface BuildingApproach extends Definition {name:string;time:number;quality:number;desc:string;}
 interface Talent extends Definition {name:string;desc:string;discipline:string;}
 interface Study extends Definition {name:string;discipline:string;desc:string;requires:string|null;goals:{event:string;amount:number;label:string}[];reward:QuantityMap;}
 interface LearningPath extends Definition {name:string;desc:string;skills:string[];buildings:string[];}
 interface Delivery extends Definition {name:string;desc:string;cost:QuantityMap;coins:number;rp:number;}
 type ChapterCondition={type:'stat';key:string;gte:number}|{type:'skill'|'building';key:string}|{type:'bond';gte:number};
 interface Chapter extends Definition {title:string;chapter:string;desc:string;checks:{label:string;action:string;condition:ChapterCondition}[];reward:QuantityMap;}
 interface DefinitionMap {items:Item;recipes:Recipe & Definition & {output:string};skills:Skill;buildings:Blueprint;drills:Drill;disciplines:Discipline;teachingStyles:TeachingStyle;buildingApproaches:BuildingApproach;talents:Talent;studies:Study;paths:LearningPath;deliveries:Delivery;chapters:Chapter;}
 type Category=keyof DefinitionMap;
 type Components={[K in Category]:DefinitionMap[K][]};
 interface Library { $schema?:string|undefined;format:'littlewild-content';schemaVersion:1;kind:'library';library:{id:string;name:string;version:string;description:string};components:Components;base?:{libraryId:string;fingerprint:string};}
 interface Patch extends Omit<Library,'kind'|'components'|'base'> {kind:'patch';components:Partial<Components>;base:{libraryId:string;fingerprint:string};}
 interface Diagnostic {severity:string;code:string;path:string;message:string;hint:string;}
 interface FieldChange extends Change {kind:'mechanics'|'economy'|'presentation';}
 interface LibraryDiff {components:{category:Category;id:string;name:string;fields:FieldChange[]}[];metadata:FieldChange[];fields:FieldChange[];mechanics:number;economy:number;presentation:number;}
 interface Preview {ok:true;errors:Diagnostic[];warnings:Diagnostic[];kind:'library'|'patch';baseFingerprint:string;fingerprint:string;candidate:Library;diff:LibraryDiff;counts:Record<string,number>;}
 type Preparation=Preview|{ok:false;errors:Diagnostic[];warnings:Diagnostic[];baseFingerprint:string};
 interface Registry {readonly current:Library;readonly hash:string;readonly defaults:Library;readonly tables:Tables;export():Library;export(category:Category,id?:string|null):Library|Patch;prepare(input:unknown):Preparation;reviewed(preview:unknown):Preview;commit(preview:unknown):string;withLibrary<T>(candidate:Library,work:()=>T):T;}

 interface Environment {camera?:{center:[number,number];zoom:number};mode:'indoor';background:string;floor:string;alternateFloor:string;wall:string;trim:string;}
 interface Resources {assets:unknown[];creatures:{configuration:unknown;definitions:unknown[]};}
 interface WorldProfile {nodePolicy?:'profile-only';environment?:Environment;id:string;name:string;description:string;terrain:string[];biomeNames:Record<string,string>;resourceCounts:QuantityMap;fixedSites:{kind:string;x:number;y:number}[];groundColors:Record<string,string[]>;materialColors:Record<string,string>;placementPolicy:string;}
 interface SimulationProfile {format:string;schemaVersion:number;id:string;version:number;name:string;description:string;rules:{actor:unknown;economy:unknown;gameplay?:LWBalanceRules.Rules|undefined};archetype:{id:string;version:number;engineLayers:string[];simulationPipeline:string[];actorDynamics:string[];actorActivity:string[];worldTransactions:string[];economyTransactions:string[]};}
 interface Libraries {base:Library;adventure:Adventure;world:World;growth:Growth;}
 interface Presentation {title:string;tagline:string;worldSubtitle:string;accent:string;paper:string;ink:string;}
 interface Tutorial {id:string;title:string;body:string;action:string;}
 interface Scene {graph?:LWSceneGraph.Metadata;id:string;name:string;description:string;worldId:string;initialState:Record<string,unknown>;}
 interface ScenarioPack {storytelling?:LWStorytelling.Data;canvasAuthoring?:LWCanvasAuthoring.Authoring;format:'living-worlds-pack';schemaVersion:2;id:string;version:string;name:string;description:string;resources?:Resources;presentation:Presentation;simulation:SimulationProfile;worlds:WorldProfile[];scenes:Scene[];tutorial:Tutorial[];libraries:Libraries;}
 interface ExperienceContext {journey?:LWSceneGraph.Journey;resources?:Resources;schemaVersion:2;packId:string;name:string;version:string;sceneId:string;sceneName:string;worldId:string;presentation:Presentation;simulation:SimulationProfile;world:WorldProfile;tutorial:Tutorial[];}
 interface ScenarioEngine {scenarioContext?:ExperienceContext;simulationProfile?:SimulationProfile;export():{state:Record<string,unknown>};s?:{scenarioResources?:Resources};}
 type PackValidation={ok:true;errors:string[];pack:ScenarioPack;fingerprint:string;sceneCount:number}|{ok:false;errors:string[]};
 interface ScenePreview {messages:string[];ok:true;errors:string[];pack:ScenarioPack;fingerprint:string;sceneCount:number;sceneId:string;engine:ScenarioEngine;context:ExperienceContext;}
 interface ScenarioApi {validate(input:unknown):PackValidation;prepareScene(pack:unknown,id:string,entryState?:Record<string,unknown>,connectionEvents?:LWSceneGraph.Event[]):ScenePreview;commitScene(preview:ScenePreview):ScenarioEngine;activate(engine:ScenarioEngine):void;capture(engine:ScenarioEngine):ScenarioPack;checkContext(input:unknown):ExperienceContext;checkWorld(world:WorldProfile,library:World):void;hash(value:unknown):string;withLibraries<T>(libraries:Libraries,work:()=>T):T;withRuntime<T>(libraries:Libraries,simulation:SimulationProfile,work:()=>T):T;transaction<T>(work:()=>T):T;readonly schema:Schema;builtins():ScenarioPack[];defaultTutorial():Tutorial[];defaultPresentation():Presentation;defaultSimulation():SimulationProfile;}

}
