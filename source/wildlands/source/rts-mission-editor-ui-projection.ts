/// <reference path="./rts-mission-editor-ui-contracts.d.ts" />
/** Authored records project to renderer values. No session, ECS or clock is created. */
(function(input:unknown){
 'use strict';
 const root=input as {LWRTSMissionEditorProjection?:LWRTSMissionEditorUI.ProjectionApi};
 function snapshot(value:LWRTSMissionEditor.Snapshot):LWRTSDemo.Snapshot {
  const {catalog,mission}=value;
  const tiles=Array<string>(mission.width*mission.height).fill(mission.defaultTerrain);
  for(const patch of mission.terrain){
   for(let y=patch.y;y<patch.y+patch.height;y++){
    for(let x=patch.x;x<patch.x+patch.width;x++)tiles[y*mission.width+x]=patch.terrain;
   }
  }
  const entities:LWRTSDemo.Entity[]=[];
  mission.spawns.forEach((record,index)=>{
   const definition=catalog.units.find(row=>row.id===record.archetype)||catalog.buildings.find(row=>row.id===record.archetype);
   for(let offset=0;offset<record.count;offset++)entities.push({
    id:'spawns:'+index+':'+offset,definition:record.archetype,category:'unit',faction:record.faction,
    x:record.x+(offset%3)*.35,y:record.y+Math.floor(offset/3)*.35,hp:definition?.hp||1,maxHp:definition?.hp||1
   });
  });
  mission.deposits.forEach((record,index)=>entities.push({id:'deposits:'+index,definition:record.resource,
   category:'deposit',faction:'',x:record.x,y:record.y,hp:1,maxHp:1,resource:record.resource,amount:record.amount}));
  mission.items.forEach((record,index)=>entities.push({id:'items:'+index,definition:record.item,
   category:'item',faction:'',x:record.x,y:record.y,hp:1,maxHp:1}));
  const all=tiles.map((_,index)=>index);
  return {tick:0,status:'authoring',mission:mission.id,playerFaction:mission.playerFaction,
   map:{width:mission.width,height:mission.height,tiles},entities,factions:[],fog:{visible:all,explored:all},events:[],catalog};
 }
 root.LWRTSMissionEditorProjection={snapshot};
})(globalThis);
