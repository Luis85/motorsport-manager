/// <reference path="./interaction-contracts.d.ts" />
/// <reference path="./developer-contracts.d.ts" />
/** Detached observations and intent ports consumed by the interaction workspace. */
declare namespace LWInteractionPresentation {
 type Definition=Pick<LWInteraction.Definition,'id'|'label'|'executor'>&{duel?:Pick<LWInteraction.DuelProfile,'scoring'>|null};
 type Roll=Pick<LWInteraction.Roll,'total'|'target'|'margin'|'success'>;
 interface Round {number:number;sourceRoll:Roll;targetRoll:Roll;winnerId:string|null;}
 type Record=Pick<LWInteraction.Record,'id'|'definitionId'|'sourceId'|'target'|'status'|'round'|'scores'|'nextRoundAt'|'reason'|'winnerId'>&{rounds:Round[]};
 interface View {active:Record[];history:Record[];seeks:LWInteraction.Seek[];}
 interface Creature {id:string;name:string;activeQuest?:unknown;task?:{kind:string}|null;}
 interface Place {id:string;kind:string;x:number;y:number;}
 interface Engine {
  selected?:{id:string}|null;creatures:Creature[];
  s:{simTime:number;buildings:Place[];nodes:Place[]};
  interactionDefinitions?():{definitions:Definition[]};
  interactionOptions(sourceId:string,target:LWInteraction.Target):LWInteraction.Option[];
  interactionState():View;dispatchCommand(command:LittlewildDeveloper.Command):LWInteraction.Result;
  gameSettings?():{duels:boolean};
 }
 interface Host {
  engine():Engine;esc(value:unknown):string;modal():string|null;
  open(id:string):void;redraw():void;result(value:LWInteraction.Result,message?:string):void;
 }
 interface State {sourceId:string;scope:LWInteraction.Scope;targetId:string;duelDefinitionId:string;feedback:string;error:boolean;}
 interface Api {
  state:State;render():string;action(action:string,id:string):boolean;
  change(element:{id:string;value:string}):boolean;update():void;
  prepare(target?:LWInteraction.Target|null):void;reset():void;
 }
 interface Factory {create(host:Host):Api;}
}
