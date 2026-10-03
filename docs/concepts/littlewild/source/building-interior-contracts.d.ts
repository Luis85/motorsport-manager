/// <reference path="./scene-graph-contracts.d.ts" />
/// <reference path="./physical-world-contracts.d.ts" />
/// <reference path="./building-interior-data-contracts.d.ts" />
/// <reference path="./workflow-venue-contracts.d.ts" />
declare namespace LWInterior {
 type Task=LWPhysicalPorts.Task;
 interface Actor extends LWPhysicalPorts.Actor {bond:number;creature:Point & {dir:number};task:Task|null;}
 interface World extends LWPhysicalPorts.State {interiors?:State;scenarioWorkflow?:LWWorkflowVenue.Workflow;}
 interface Engine extends Omit<LWPhysicalPorts.WorldEngine,'s'|'actor'|'creatures'> {
  s:World;actor:Actor;creatures:Actor[];
  withActor<T>(actor:Actor,work:()=>T):T;
  commandActor(id:string,work:()=>LWPhysicalPorts.ActionResult):LWPhysicalPorts.ActionResult;
  interactionBusy?(id:string):boolean;
  configureBuilding(id:string,command:string,value:unknown):LWPhysicalPorts.ActionResult;
  setGameSettings?(value:unknown):LWPhysicalPorts.ActionResult;
  ecs:{step(actor:Actor,dt:number,context:{day:number;socialPreference:number;loadLevel:number;hasShelter:boolean}):unknown};
  has(id:string):boolean;load(actor?:Actor):{maximumKg:number;grams:number;level:number};
  dispatchCommand(input:unknown):LWPhysicalPorts.ActionResult;
  stepInteractionActor(dt:number):void;
  stepQuest(dt:number):void;
  mood(actor?:Actor):string;
  gateIssue(category:'items'|'recipes',id:string):string|null;
  buildingStatus(b:LWPhysicalPorts.Building):{label:string;kind:string;detail:string};
 }
 interface ActorView extends Point {archetype:string;visualAsset:string;id:string;name:string;floorId:string;stationId:string|null;action:string;mood:string;progress:number|null;remainingSeconds:number|null;moving:boolean;direction:number;cargo:string;transfer:boolean;}
 interface Snapshot {sceneProps?:{floorId:string;props:LWSceneGraph.Prop[]};fixtureAsset:string;fixtureModel:string;buildingId:string;buildingName:string;kind:string;floors:Floor[];actors:ActorView[];time:number;status:{label:string;kind:string;detail:string};input:Record<string,number>;output:Record<string,number>;recipes:{id:string;name:string;amount:number;time:number;cost:Record<string,number>;skill:string;queued:number}[];transfers:{actorId:string;name:string;direction:string;resource:string;amount:number;time:number}[];}
 interface Renderer {draw(snapshot:Snapshot,floorId:string,presentationTime:number):void;resize():void;destroy():void;}
}
