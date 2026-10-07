/// <reference path="./rts-runtime-contracts.d.ts" />
/** One application-owned RTS session; queries and navigation never consume simulation time. */
declare namespace LWRTSApplication {
 interface Status {active:boolean;paused:boolean;speed:number;mission:string;}
 interface View {
  query():LWRTSRuntime.Snapshot; command(input:LWRTSRuntime.Command):LWRTSRuntime.Result;
  status():Status; control(action:'pause'|'resume'|'speed'|'restart',value?:number):void;
  checkpoint():LWRTSRuntime.Data; catalog():LWRTSData.Catalog;
  replace(input:unknown,kind:'catalog'|'checkpoint',mission?:string):void;
 }
 interface Application {view:View;enter():void;exit():void;advance(seconds:number):void;}
 interface Api {create():Application;}
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {
  LWRTS:{create(input?:LWRTSData.Catalog,mission?:string):LWRTSRuntime.Session;restore(input:unknown):LWRTSRuntime.Session};
  LWRTSCatalog:LWRTSData.CatalogApi; LWRTSApplication?:LWRTSApplication.Api;
 };
 function create():LWRTSApplication.Application {
  let catalog=root.LWRTSCatalog.defaults,mission=catalog.missions[0]!.id;
  let session:LWRTSRuntime.Session|null=null,active=false,paused=false,speed=1,pending=0;
  function current():LWRTSRuntime.Session {
   if(!session)session=root.LWRTS.create(catalog,mission);
   return session;
  }
  const view:LWRTSApplication.View={
   query:()=>current().query(),
   command:input=>current().command(input),
   status:()=>({active,paused,speed,mission}),
   control(action,value){
    if(action==='speed'){
     if(![1,2,4].includes(value??0))throw Error('Choose RTS speed 1, 2 or 4.');
     speed=value!;
    }else if(action==='restart'){
     const replacement=root.LWRTS.create(catalog,mission);
     session=replacement;pending=0;paused=false;
    }else {paused=action==='pause';pending=0;}
   },
   checkpoint:()=>current().checkpoint(),
   catalog:()=>JSON.parse(JSON.stringify(catalog)) as LWRTSData.Catalog,
   replace(input,kind,selectedMission){
    // Admission stages a whole replacement before touching the active session.
    const admitted=kind==='catalog'?root.LWRTSCatalog.validate(input):null;
    const nextMission=admitted?(selectedMission??admitted.missions[0]!.id):mission;
    const replacement=admitted?root.LWRTS.create(admitted,nextMission):root.LWRTS.restore(input);
    const snapshot=replacement.query();
    catalog=snapshot.catalog;
    mission=String((replacement.checkpoint().missionId)??nextMission);
    session=replacement;pending=0;paused=true;
   }
  };
  return {view,
   enter(){current();active=true;pending=0;},
   exit(){active=false;pending=0;},
   advance(seconds){
    if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid RTS frame interval.');
    if(!active||paused){pending=0;return;}
    pending=Math.min(3.2,pending+Math.min(seconds,.1)*speed);
    const ticks=Math.min(32,Math.floor(pending/.1+1e-9));
    if(ticks){pending=Math.max(0,pending-ticks*.1);try{current().step(ticks);}catch(error){paused=true;pending=0;throw error;}}
   }
  };
 }
 const api={create};root.LWRTSApplication=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
