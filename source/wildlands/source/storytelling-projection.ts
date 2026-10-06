/// <reference path="./storytelling-render-contracts.d.ts" />
/* Pure detached renderer transformation; application playback knows no renderer. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWContent:LWContentPorts.ContentApi;LWStorytellingProjection?:LWStorytelling.RenderingApi};
 const copy=<T>(value:T):T=>root.LWContent.copy(value);
 function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
 function frame(base:LittlewildRenderer.Frame,sample:LWStorytelling.Sample):LittlewildRenderer.Frame {
  const result=copy(base) as unknown as Record<string,unknown>;
  for(const pose of sample.poses){
   const collection=pose.target.category==='creatures'?'actors':pose.target.category;
   for(const row of result[collection] as Record<string,unknown>[])if(row.id===pose.target.id)Object.assign(row,pose.values);
   const room=result.room as {actors:Record<string,unknown>[];sceneProps?:{props:Record<string,unknown>[]}}|null;
   if(room)for(const row of pose.target.category==='creatures'?room.actors:pose.target.category==='props'?room.sceneProps?.props??[]:[])if(row.id===pose.target.id)Object.assign(row,pose.values);
  }
  const camera=result.camera as Record<string,unknown>;
  if(sample.camera.x!==undefined)camera.x=sample.camera.x;if(sample.camera.y!==undefined)camera.y=sample.camera.y;if(sample.camera.zoom!==undefined)camera.z=sample.camera.zoom;
  result.running=false;
  return freeze(result) as unknown as LittlewildRenderer.Frame;
 }
 const api={frame};root.LWStorytellingProjection=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
