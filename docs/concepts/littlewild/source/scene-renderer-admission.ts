/// <reference path="./renderer-contracts.d.ts" />
/* Presentation capabilities are admitted before the UI adopts a reviewed native scene. */
(function(inputRoot:unknown){
 'use strict';
 interface Api {assertAvailable(pack:LWContentPorts.ScenarioPack,sceneId:string):void;}
 const root=inputRoot as {LWRenderers:LittlewildRenderer.Registry;LWSceneRendererAdmission?:Api;};
 function assertAvailable(pack:LWContentPorts.ScenarioPack,sceneId:string):void {
  const visited=new Set<string>(),available=root.LWRenderers.list();
  function inspect(id:string):void {
   if(visited.has(id))return;visited.add(id);if(visited.size>64)throw Error('Scene rendering admission limit exceeded.');
   const scene=pack.scenes.find(row=>row.id===id);if(!scene)throw Error('Scene rendering target is missing.');
   const rendering:LWSceneGraph.Rendering=scene.graph?.rendering??{rendererId:'basic',dimension:'3d'};const metadata=available.find(row=>row.id===rendering.rendererId);
   if(!metadata)throw Error('Renderer '+rendering.rendererId+' is unavailable in this application.');
   if(metadata.dimensions&&!metadata.dimensions.includes(rendering.dimension))throw Error('Renderer '+metadata.id+' does not support dimension '+rendering.dimension+'.');
   if(scene.graph?.binding?.type==='interior'&&!metadata.capabilities.includes('interiors'))throw Error('Renderer '+metadata.id+' cannot present building interiors.');
   for(const embed of rendering.embeds??[])inspect(embed.sceneId);
  }
  inspect(sceneId);
 }
 const api:Api=Object.freeze({assertAvailable});root.LWSceneRendererAdmission=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
