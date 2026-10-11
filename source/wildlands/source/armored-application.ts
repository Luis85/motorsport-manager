/** The presentation receives view only; its runner owns elapsed-clock admission. */
(function(input:unknown){
 'use strict';
 const root=input as {LWArmored:LWArmoredRuntime.SessionApi;LWArmoredApplication?:unknown};
 function create(catalog:LWArmoredData.Catalog,missionId?:string):LWArmoredRuntime.Application{
  let session=root.LWArmored.create(catalog,missionId),pending=0,active=false,paused=false;
  const view:LWArmoredRuntime.ApplicationView={
   query:()=>session.query(),command:cmd=>session.command(cmd),checkpoint:()=>session.checkpoint(),
   status:()=>({active,paused,mission:session.query().missionId}),
   control(action){
    if(action==='restart'){const saved=session.checkpoint();const next=root.LWArmored.create(saved.catalog,saved.missionId);session=next;paused=false;}
    else if(action==='pause'||action==='resume')paused=action==='pause';else throw Error('Unknown armored application action.');
    pending=0;
   },
   replace(value){const next=root.LWArmored.restore(value);session=next;pending=0;paused=true;}
  };
  return {view,enter(){active=true;pending=0;},exit(){active=false;pending=0;},advance(seconds){
   if(!Number.isFinite(seconds)||seconds<0)throw Error('Frame interval must be finite and non-negative.');
   if(!active||paused){pending=0;return;}
   // Discard long background gaps; at most six 60 Hz steps per presentation frame.
   pending+=Math.min(seconds,.1);const ticks=Math.min(6,Math.floor(pending*60+1e-9));
   if(ticks){pending=Math.max(0,pending-ticks/60);try{session.step(ticks);}catch(error){paused=true;pending=0;throw error;}}
  }};
 }
 root.LWArmoredApplication=Object.freeze({create});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWArmoredApplication;
})(globalThis);
