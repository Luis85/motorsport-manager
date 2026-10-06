/** Authored worksite identity shared by application authorities and presentation queries. */
declare namespace LWWorkflowVenue {
 interface Workflow {roles?:readonly {id:string;actorId:string|null}[];deals?:readonly {questId:string;salesRole:string;venueBuildingId:string|null}[];}
 interface State {scenarioWorkflow?:Workflow;}
 interface Api {buildingId(state:State,actorId:string,questId:unknown):string|null;}
}
