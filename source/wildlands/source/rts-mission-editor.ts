/// <reference path="./rts-mission-editor-contracts.d.ts" />
/// <reference path="./rts-mission-editor-data.ts" />
/** Atomic application-owned mission drafts. This module has no runtime or clock port. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {
  LWRTSCatalog:LWRTSData.CatalogApi;
  LWRTSMissionEditorData:LWRTSMissionEditorData.Api;
  LWRTSMissionEditor?:LWRTSMissionEditor.Api;
 };
 const node=typeof module!=='undefined'&&module.exports;
 const catalogApi=(node?require('./rts-catalog.js'):root.LWRTSCatalog) as LWRTSData.CatalogApi;
 const data=(node?require('./rts-mission-editor-data.js'):root.LWRTSMissionEditorData) as LWRTSMissionEditorData.Api;
 const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
 const historyLimit=64;
 interface State {catalog:LWRTSData.Catalog;missionId:string;}
 type MutableMission={-readonly [K in keyof LWRTSData.Mission]:LWRTSData.Mission[K]};
 const fields:Record<string,readonly string[]>={
  'select-mission':['missionId'], 'clone-mission':['id','name'], 'remove-mission':[],
  metadata:['values'],paint:['terrain','x','y','width','height'],
  'set-record':['collection','index','value'],'remove-record':['collection','index'],
  'import-catalog':['catalog'],undo:[],redo:[]
 };
 const metadata=['name','description','width','height','playerFaction','defaultTerrain','fog','seed'];
 const collections:LWRTSMissionEditor.Collection[]=['spawns','deposits','items','objectives'];
 function selected(state:State):MutableMission {
  const mission=state.catalog.missions.find(entry=>entry.id===state.missionId);
  if(!mission)throw Error('Choose an existing mission.');
  return mission;
 }
 function admitCatalog(input:unknown):LWRTSData.Catalog {
  const catalog=catalogApi.validate(data.admit(input));
  for(const mission of catalog.missions){
   if(new Set(mission.objectives.map(objective=>objective.id)).size!==mission.objectives.length)throw Error('Objective IDs must be unique within a mission.');
  }
  return catalog;
 }
 function create(input:unknown=catalogApi.defaults,missionId?:string):LWRTSMissionEditor.Session {
  const admitted=admitCatalog(input);
  let state:State={catalog:admitted,missionId:missionId??admitted.missions[0]!.id};
  selected(state);
  const initial=JSON.stringify(admitted),previous:State[]=[],future:State[]=[];
  let revision=0;
  function publish(next:State):void {
   next.catalog=admitCatalog(next.catalog);
   selected(next);
   if(JSON.stringify(next)===JSON.stringify(state))return;
   previous.push(state);
   if(previous.length>historyLimit)previous.shift();
   future.length=0;state=next;revision++;
  }
  function edit(command:Record<string,unknown>):void {
   const action=command.action as string;
   if(action==='select-mission'){
    const next={catalog:state.catalog,missionId:command.missionId as string};
    selected(next);
    if(next.missionId!==state.missionId){state=next;revision++;}
    return;
   }
   if(action==='undo'||action==='redo'){
    const source=action==='undo'?previous:future,destination=action==='undo'?future:previous;
    const next=source.pop();
    if(!next)throw Error(action==='undo'?'No earlier edit to undo.':'No later edit to redo.');
    destination.push(state);state=next;revision++;
    return;
   }
   if(action==='import-catalog'){
    const catalog=admitCatalog(command.catalog);
    const requested=command.missionId as string|undefined;
    const nextMission=requested??(catalog.missions.some(mission=>mission.id===state.missionId)?state.missionId:catalog.missions[0]!.id);
    publish({catalog,missionId:nextMission});return;
   }
   const next=copy(state),mission=selected(next);
   if(action==='clone-mission'){
    const clone={...copy(mission),id:command.id as string,name:command.name as string};
    (next.catalog.missions as LWRTSData.Mission[]).push(clone);next.missionId=clone.id;
   }else if(action==='remove-mission'){
    if(next.catalog.missions.length===1)throw Error('Keep at least one mission in the catalog.');
    next.catalog.missions=(next.catalog.missions as LWRTSData.Mission[]).filter(entry=>entry.id!==mission.id);
    next.missionId=next.catalog.missions[0]!.id;
   }else if(action==='metadata'){
    const values=command.values;
    if(values===null||typeof values!=='object'||Array.isArray(values))throw Error('Choose mission metadata fields.');
    if(Object.keys(values).some(key=>!metadata.includes(key)))throw Error('Mission metadata contains unsupported fields.');
    Object.assign(mission,values);
   }else if(action==='paint'){
    const patch={terrain:command.terrain as string,x:command.x as number,y:command.y as number,width:command.width as number,height:command.height as number};
    if(!next.catalog.terrain.some(terrain=>terrain.id===patch.terrain))throw Error('Choose a catalog terrain.');
    mission.terrain=data.paint(mission,patch);
   }else {
    const collection=command.collection as LWRTSMissionEditor.Collection;
    if(!collections.includes(collection))throw Error('Choose a mission record collection.');
    const records=mission[collection] as LWRTSMissionEditor.RecordValue[],index=command.index;
    if(index!==null&&(!Number.isSafeInteger(index)||Number(index)<0||Number(index)>=records.length))throw Error('Choose an existing mission record.');
    if(action==='remove-record'){
     if(index===null)throw Error('Choose an existing mission record.');
     records.splice(index as number,1);
    }else if(index===null)records.push(command.value as LWRTSMissionEditor.RecordValue);
    else records[index as number]=command.value as LWRTSMissionEditor.RecordValue;
   }
   publish(next);
  }
  return {
   query:()=>({catalog:copy(state.catalog),mission:copy(selected(state)),revision,canUndo:previous.length>0,canRedo:future.length>0,dirty:JSON.stringify(state.catalog)!==initial,historyLimit}),
   exportCatalog:()=>copy(state.catalog),
   command(input){
    try {
     const command=data.admit(input),action=command.action;
     if(typeof action!=='string'||!Object.hasOwn(fields,action))throw Error('Choose a supported editor action.');
     const required=['revision','action',...fields[action]!];
     const optional=action==='import-catalog'?['missionId']:[];
     if(required.some(key=>!Object.hasOwn(command,key))||Object.keys(command).some(key=>!required.includes(key)&&!optional.includes(key)))throw Error('Editor command has missing or unsupported fields.');
     if(!Number.isSafeInteger(command.revision)||command.revision!==revision)throw Error('Editor revision changed. Refresh the draft before applying this edit.');
     edit(command);
     return {ok:true,message:'Mission draft updated.',revision};
    }catch(error){return {ok:false,message:error instanceof Error?error.message:'Mission edit rejected.',revision};}
   }
  };
 }
 const api={create};root.LWRTSMissionEditor=api;
 if(node)module.exports=api;
})(globalThis);
