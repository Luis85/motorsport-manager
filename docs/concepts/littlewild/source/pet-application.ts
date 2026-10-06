/// <reference path="./pet-contracts.d.ts" />
/** One application-owned pet session; queries, rendering and navigation never consume simulation time. */
declare namespace LWPetApplication {
 interface Status {active:boolean;paused:boolean;speed:number;}
 interface View {
  query():LWPetRuntime.Snapshot;command(input:unknown):LWPetRuntime.Result;status():Status;
  control(action:'pause'|'resume'|'speed'|'restart',value?:number|{species:string;name?:string}):void;
  checkpoint():LWPetRuntime.Checkpoint;catalog():LWPetData.Catalog;replace(input:unknown,kind:'catalog'|'checkpoint'):void;
 }
 interface Application {view:View;enter():void;exit():void;advance(seconds:number):void;}
 interface Api {create():Application;readonly SPEEDS:readonly number[];}
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWPet:LWPetRuntime.Api;LWPetCatalog:LWPetData.CatalogApi;LWPetApplication?:LWPetApplication.Api};
 const SPEEDS=Object.freeze([1,4,16]);
 function create():LWPetApplication.Application{
  let catalog=root.LWPetCatalog.defaults,session:LWPetRuntime.Session|null=null,active=false,paused=false,speed=1,pending=0;
  const step=root.LWPet.STEP;
  function current():LWPetRuntime.Session{if(!session)session=root.LWPet.create(catalog);return session;}
  const view:LWPetApplication.View={
   query:()=>current().query(),
   command:input=>current().command(input),
   status:()=>({active,paused,speed}),
   control(action,value){
    if(action==='speed'){if(typeof value!=='number'||!SPEEDS.includes(value))throw Error('Choose pet speed '+SPEEDS.join(', ')+'.');speed=value;}
    else if(action==='restart'){
     const choice=typeof value==='object'&&value?value:{species:catalog.species[0]!.id};
     session=root.LWPet.create(catalog,choice.species,choice.name);pending=0;paused=false;
    }else{paused=action==='pause';pending=0;}
   },
   checkpoint:()=>current().checkpoint(),
   catalog:()=>JSON.parse(JSON.stringify(catalog)) as LWPetData.Catalog,
   replace(input,kind){
    // Admission stages a complete replacement before touching the active session.
    const replacement=kind==='catalog'?root.LWPet.create(input):root.LWPet.restore(input);
    replacement.query();
    catalog=replacement.catalog;session=replacement;pending=0;paused=true;
   }
  };
  return {view,
   enter(){current();active=true;pending=0;},
   exit(){active=false;pending=0;},
   advance(seconds){
    if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid pet frame interval.');
    if(!active||paused){pending=0;return;}
    pending=Math.min(step*64,pending+Math.min(seconds,.1)*speed);
    const ticks=Math.min(64,Math.floor(pending/step+1e-9));
    if(ticks){pending=Math.max(0,pending-ticks*step);try{current().step(ticks);}catch(error){paused=true;pending=0;throw error;}}
   }
  };
 }
 const api:LWPetApplication.Api={create,SPEEDS};root.LWPetApplication=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
