/// <reference path="./scene-environment-ports.d.ts" />
/* Drawing-only adapters for validated room profiles. No scenario names, mutable
 * registry, entity writes, clocks or random draws belong to the stage. */
(function(inputRoot:unknown){
 'use strict';
 interface Root {LWWorldProfile?:{readonly current:LWEnvironmentPorts.Profile;readonly hash:string};LWSceneEnvironment?:LWEnvironmentPorts.Api;}
 const root=inputRoot as Root;
 function read(profile=root.LWWorldProfile?.current):LWEnvironmentPorts.Environment|null{
  const environment=profile?.environment;if(environment?.mode!=='indoor')return null;
  const copy={...environment};
  if(environment.camera)copy.camera={center:[environment.camera.center[0],environment.camera.center[1]],zoom:environment.camera.zoom};
  return copy;
 }
 function role(state:LWEnvironmentPorts.RoleState,actorId:string):string{return state.scenarioWorkflow?.roles?.find(entry=>entry.actorId===actorId)?.label||'';}
 function onsite(state:LWEnvironmentPorts.RoleState,actor:{id:string;activeQuest?:unknown}):boolean{
  if(!actor.activeQuest||typeof actor.activeQuest!=='object')return false;
  const questId=(actor.activeQuest as {questId?:unknown}).questId;
  return !!state.scenarioWorkflow?.deals?.some(deal=>deal.venueBuildingId&&deal.questId===questId&&state.scenarioWorkflow?.roles?.some(entry=>entry.id===deal.salesRole&&entry.actorId===actor.id));
 }
 function populate3D(kit:LWEnvironmentPorts.Kit,parent:unknown,e:LWEnvironmentPorts.Environment,origins:readonly LWEnvironmentPorts.Point[],size=19):void{
  for(const origin of origins){
   const center=(size-1)/2,x=origin.x,y=origin.y;
   kit.box(parent,x+center,-.15,y+center,size,.30,size,e.trim);
   for(let a=0;a<size;a++)for(let b=0;b<size;b++)kit.piece(parent,'ground',x+a,.038,y+b,1,1,1,(a+b)%2?e.alternateFloor:e.floor);
   // Back walls give an open, readable cutaway rather than hiding workers under a roof.
   kit.box(parent,x-.56,.82,y+center,.14,1.64,size+.25,e.wall);
   kit.box(parent,x+center,.82,y-.56,size+.25,1.64,.14,e.wall);
   kit.box(parent,x-.465,.13,y+center,.035,.14,size,e.trim);
   kit.box(parent,x+center,.13,y-.465,size,.14,.035,e.trim);
   kit.box(parent,x-.56,1.67,y+center,.19,.08,size+.25,e.trim);
   kit.box(parent,x+center,1.67,y-.56,size+.25,.08,.19,e.trim);
   for(let p=2;p<size-1;p+=4){
    kit.box(parent,x-.46,1.05,y+p,.025,.75,2.1,e.trim);
    kit.box(parent,x-.44,1.05,y+p,.022,.63,1.94,e.background);
    kit.box(parent,x-.425,1.05,y+p,.012,.63,.035,e.wall);
    kit.box(parent,x+p,1.05,y-.46,2.1,.75,.025,e.trim);
    kit.box(parent,x+p,1.05,y-.44,1.94,.63,.022,e.background);
    kit.box(parent,x+p,1.05,y-.425,.035,.63,.012,e.wall);
   }
  }
 }
 function groundCanvas(c:CanvasRenderingContext2D,art:LWEnvironmentPorts.Art,e:LWEnvironmentPorts.Environment,size:number,tw:number,th:number):void{
  const project=(x:number,y:number):readonly[number,number]=>[(x-y)*tw/2,(x+y)*th/2];
  const floorHeight=12,wallHeight=64;
  for(let diagonal=0;diagonal<size*2;diagonal++)for(let x=0;x<size;x++){
   const y=diagonal-x;if(y<0||y>=size)continue;
   const [px,py]=project(x,y);art.diamond(c,px,py,tw,th,(x+y)%2?e.alternateFloor:e.floor);
   if(x===size-1)art.poly(c,[[px,py+th/2],[px+tw/2,py],[px+tw/2,py+floorHeight],[px,py+th/2+floorHeight]],e.trim);
   if(y===size-1)art.poly(c,[[px-tw/2,py],[px,py+th/2],[px,py+th/2+floorHeight],[px-tw/2,py+floorHeight]],e.trim);
  }
  for(let n=0;n<size;n++){
   for(const [x,y,side]of [[n,0,1],[0,n,-1]] as const){
    const [px,py]=project(x,y),edge=side*tw/2;
    art.poly(c,[[px,py-th/2],[px+edge,py],[px+edge,py-wallHeight],[px,py-th/2-wallHeight]],e.wall);
    art.poly(c,[[px,py-th/2],[px+edge,py],[px+edge,py-5],[px,py-th/2-5]],e.trim);
    art.poly(c,[[px,py-th/2-wallHeight],[px+edge,py-wallHeight],[px+edge,py-wallHeight-3],[px,py-th/2-wallHeight-3]],e.trim);
    if(n%4===2||n%4===3)art.poly(c,[[px+side*3,py-th/2-16],[px+edge-side*3,py-16],[px+edge-side*3,py-49],[px+side*3,py-th/2-49]],e.background);
   }
  }
 }
 function backdropCanvas(c:CanvasRenderingContext2D,width:number,height:number,e:LWEnvironmentPorts.Environment):void{c.fillStyle=e.background;c.fillRect(0,0,width,height);}
 const api:LWEnvironmentPorts.Api=Object.freeze({read,key:()=>root.LWWorldProfile?.hash||'',role,onsite,populate3D,groundCanvas,backdropCanvas});
 root.LWSceneEnvironment=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
