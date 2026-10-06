/// <reference path="./interaction-contracts.d.ts" />
/* Littlewild nonlethal scoring, composed with the existing 3d6 resolver, not full combat. */
(function(inputRoot:unknown){
 'use strict';
 function winner(profile:LWInteraction.DuelProfile,a:LWInteraction.Roll,b:LWInteraction.Roll,sourceId:string,targetId:string):string|null{
  if(profile.scoring==='margin')return a.margin===b.margin?null:a.margin>b.margin?sourceId:targetId;
  return a.success&&!b.success?sourceId:b.success&&!a.success?targetId:
   a.success&&b.success&&a.margin!==b.margin?(a.margin>b.margin?sourceId:targetId):null;
 }
 const api=Object.freeze({winner});
 (inputRoot as {LWInteractionDuelRules?:unknown}).LWInteractionDuelRules=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
