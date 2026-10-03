/// <reference path="./workflow-venue-contracts.d.ts" />
/* One authored role/deal policy decides which worksite owns an onsite activity. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWWorkflowVenues?:LWWorkflowVenue.Api};
 function buildingId(state:LWWorkflowVenue.State,actorId:string,questId:unknown):string|null {
  if(typeof questId!=='string')return null;
  const workflow=state.scenarioWorkflow;
  return workflow?.deals?.find(deal=>deal.questId===questId&&deal.venueBuildingId&&workflow.roles?.some(role=>role.id===deal.salesRole&&role.actorId===actorId))?.venueBuildingId||null;
 }
 root.LWWorkflowVenues=Object.freeze({buildingId});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWWorkflowVenues;
})(globalThis);
