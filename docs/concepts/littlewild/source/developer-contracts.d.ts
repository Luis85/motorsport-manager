/** Public data contracts shared by the browser global and the typed Node entry point. */
declare namespace LittlewildDeveloper {
 type Json = null | boolean | number | string | Json[] | { [key:string]:Json };
 type Document = { [key:string]:Json };
 type ErrorCode = 'invalid-input' | 'session-active' | 'session-disposed' | 'review-invalid' | 'operation-failed';
 interface DeveloperError extends Error { readonly code:ErrorCode; }
 interface CommandArgs {
  'select-creature':[actorId:string]; 'care':[action:string];
  'research-skill':[skillId:string]; 'teach-skill':[skillId:string];
  'practice-skill':[skillId:string,count?:number]; 'cancel-lesson':[skillId:string];
  'set-learning-style':[style:string]; 'pause-learning':[];
  'choose-specialization':[discipline:string,specialization:string];
  'start-study':[discipline:string]; 'pause-study':[];
  'set-allowance':[coins:number]; 'top-up':[];
  'set-stock-target':[itemId:string,amount:number];
  'place-building':[kind:string,x:number,y:number]; 'upgrade-building':[buildingId:string];
  'request-task':[type:string,itemId?:string|null,quantity?:number|null];
  'cancel-plan':[orderId:string]; 'pause-plan':[orderId:string];
  'prioritize-plan':[orderId:string]; 'request-equipment':[itemId:string];
  'unequip':[slot:string]; 'cancel-equipment':[itemId:string];
  'accept-quest':[offerId:string]; 'cancel-quest-plan':[]; 'abort-quest':[];
  'suggest-social':[actorId:string]; 'request-unpack':[]; 'spend-point':[attribute:string];
  'research-feature':[researchId:string];
  'configure-building': [buildingId:string,action:'enabled',value:boolean]
   | [buildingId:string,action:'priority',value:number]
   | [buildingId:string,action:'batch'|'target',value:{recipe:string;amount:number}]
   | [buildingId:string,action:'flush'|'reclaim'|'clear'];
  'assign-home':[actorId:string,buildingId:string]; 'buy-island':[ix:number,iy:number];
  'unlock-slot':[]; 'create-sale':[itemId:string,amount:number,actorId?:string|null];
  'control-sale':[saleId:string,action:'cancel'|'pause'|'stop'|'resume']
   | [saleId:string,action:'priority',value:number]
   | [saleId:string,action:'assign',value:string|null];
 }
 type CommandId=keyof CommandArgs;
 type WorldCommandId='select-creature'|'research-feature'|'configure-building'|'assign-home'|'buy-island'|'unlock-slot'|'create-sale'|'control-sale';
 type Command={ [Id in CommandId]:{id:Id;args:CommandArgs[Id]} &
  (Id extends WorldCommandId ? {actorId?:never} : {actorId:string}) }[CommandId];
 interface CommandResult { readonly ok:boolean; readonly reason?:string; readonly data:Json; }
 interface CommandDefinition {readonly id:CommandId;readonly scope:'actor'|'world';readonly maxArgs:number;readonly away:boolean;}
 interface ScenarioSummary {readonly id:string;readonly name:string;readonly scenes:readonly {id:string;name:string;worldId:string}[];}
 interface CreateOptions {readonly scenarioId:string;readonly sceneId?:string;}
 interface StoryReview {readonly format:'littlewild-story-review';readonly version:10;readonly simulationFingerprint:string;readonly scenarioId:string|null;readonly sceneId:string|null;}
 interface ActorSnapshot {
  readonly id:string;readonly name:string;readonly archetype:string;readonly personality:string;
  readonly position:{x:number;y:number};readonly needs:Readonly<Record<string,number>>;
  readonly task:Document|null;readonly inventory:Readonly<Record<string,number>>;
 }
 interface Snapshot {
  readonly simTime:number;readonly day:number;readonly hour:number;readonly started:boolean;readonly paused:boolean;
  readonly actors:readonly ActorSnapshot[];readonly buildings:readonly Document[];readonly nodes:readonly Document[];
  readonly player:Document;readonly scenarioId:string|null;readonly sceneId:string|null;
 }
 interface StepResult {readonly steps:number;readonly advancedSeconds:number;readonly simTime:number;}
 interface Session {
  readonly disposed:boolean;
  start():void;pause():void;resume():void;
  command(command:Command):CommandResult;
  /** Whole fixed steps only: 0..36000 per call, always 0.1 simulation seconds. */
  step(count?:number):StepResult;
  /** Seconds must be an exact multiple of 0.1, between 0 and 3600. */
  advance(seconds:number):StepResult;
  inspect():Snapshot;save():Document;story():Document;captureScenario():Document;
  dispose():void;
 }
 interface Validation {readonly ok:boolean;readonly errors:readonly string[];readonly data:Document|null;}
 interface HostLease {dispose():void;}
 interface HostApi {claimHost():HostLease;}
 interface SessionApi {
  readonly version:1;readonly fixedStep:0.1;readonly maxSteps:36000;
  scenarios():readonly ScenarioSummary[];commands():readonly CommandDefinition[];
  create(options:CreateOptions):Session;
  validateScenario(input:unknown):Validation;
  createScenario(input:unknown,sceneId:string):Session;
  reviewStory(input:unknown):StoryReview;openStory(review:StoryReview):Session;
  creatures():readonly Document[];validateCreature(input:unknown):Validation;
 }
 type AssetCategory='actor'|'building'|'item';
 interface AssetSummary {readonly category:AssetCategory;readonly id:string;readonly name:string;readonly models:readonly string[];}
 interface AssetApi {
  list(category?:AssetCategory):readonly AssetSummary[];
  get(category:AssetCategory,id:string):Document|null;
  validate(input:unknown):Validation;
 }
 interface Toolbox extends SessionApi {readonly assets:AssetApi;}
}

/** Globals supplied by the standalone/embedding composition, never by imported content. */
declare var LWDeveloper:LittlewildDeveloper.Toolbox;
declare var LWDeveloperSession:LittlewildDeveloper.SessionApi & LittlewildDeveloper.HostApi;
