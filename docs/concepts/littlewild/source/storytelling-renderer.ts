/// <reference path="./storytelling-renderer-contracts.d.ts" />
/// <reference path="./animation-contracts.d.ts" />
/* A scoped observer preview. Application composition supplies playback and the only elapsed time. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWStorytellingPreview:{create(pack:LWContentPorts.ScenarioPack,id:string):LWStorytelling.PreviewSource};LWStorytellingProjection:LWStorytelling.RenderingApi;LWRendererObserver:{create(context:LittlewildRenderer.Context,dimension:LittlewildRenderer.Dimension):LittlewildRenderer.Instance};LWRenderers:LittlewildRenderer.Registry;LWAnimations:LWAnimations.Api;LWStorytellingRenderer?:LWStorytellingRenderer.Api;};
 function create(container:HTMLElement,pack:LWContentPorts.ScenarioPack,sceneId:string,playback:LWStorytelling.Playback):LWStorytellingRenderer.Preview {
  const source=root.LWStorytellingPreview.create(pack,sceneId),scene=pack.scenes.find(value=>value.id===sceneId);if(!scene)throw Error('Missing preview scene.');
  const {dimension,rendererId}=scene.graph?.rendering??{dimension:'3d',rendererId:'basic'},canvas=container.querySelector<HTMLCanvasElement>('[data-story-preview]')??document.createElement('canvas');
  const registration=root.LWRenderers.generation(rendererId),observerFactory=root.LWRendererObserver.create;
  let currentPlayback=playback,preparedSuccessfully=false;
  canvas.dataset.storyPreview='';if(!canvas.isConnected)container.prepend(canvas);canvas.style.width='100%';canvas.style.height='100%';canvas.width=Math.max(64,Math.round(container.clientWidth)||960);canvas.height=Math.max(64,Math.round(container.clientHeight)||420);
  const lifecycle=new AbortController(),cleanups:(()=>void)[]=[];let disposed=false,instance:LittlewildRenderer.Instance|null=null,time=0,delta=0;
  const viewport=():LittlewildRenderer.Viewport=>({width:canvas.width,height:canvas.height,pixelRatio:1});
  let projection:LittlewildRenderer.Frame|null=null,projectionKey='',paintedKey='';
  // Backends own resource recovery. A delivered restoration invalidates only
  // the retained bitmap; the next application-owned draw repaints its projection.
  const restored=()=>{paintedKey='';};
  canvas.addEventListener('webglcontextrestored',restored,{signal:lifecycle.signal});
  canvas.addEventListener('contextrestored',restored,{signal:lifecycle.signal});
  function frame():LittlewildRenderer.Frame{
   if(disposed)throw Error('The preview is disposed.');
   const status=currentPlayback.status(),key=[status.time,status.state,status.generation,canvas.width,canvas.height].join(':');
   // Authored source and playback channels are detached immutable values. Reuse
   // geometry while paused; every renderer query still observes current elapsed time.
   if(!projection||key!==projectionKey){projection=root.LWStorytellingProjection.frame(source.frame({camera:{x:0,y:0,z:1},viewport:viewport(),time,delta}),currentPlayback.sample());projectionKey=key;}
   return Object.freeze({...projection,time,delta});
  }
  const context:LittlewildRenderer.Context=Object.freeze({canvas,signal:lifecycle.signal,query:Object.freeze({frame,asset:(category:'actor'|'building'|'item',id:string)=>{if(disposed)throw Error('The preview is disposed.');return source.asset(category,id);},creatureDefinition:(id:string)=>{if(disposed)throw Error('The preview is disposed.');return source.definition(id);},buildingInterior:(id:string)=>{const current=frame();return current.room?.buildingId===id?current.room:null;}}),commands:Object.freeze({submit:():LittlewildDeveloper.CommandResult=>({ok:false,code:'unavailable-command',reason:'Draft previews are observation only.',data:null})}),onDispose(cleanup:()=>void){if(lifecycle.signal.aborted)cleanup();else cleanups.push(cleanup);}});
  const overlay=document.createElement('canvas');overlay.dataset.p5Animation='';Object.assign(overlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',background:'transparent',border:'0'});overlay.width=canvas.width;overlay.height=canvas.height;container.append(overlay);
  const animation=root.LWAnimations.create(overlay);
  function draw(now:number,elapsed:number){if(disposed||!instance)return;time=now;delta=elapsed;const width=Math.max(64,Math.round(container.clientWidth)||canvas.width),height=Math.max(64,Math.round(container.clientHeight)||canvas.height);if(width!==canvas.width||height!==canvas.height){instance.resize({width,height,pixelRatio:1});projection=null;paintedKey='';}const value=frame();
   // Only the actual instance can opt into projection-only bitmap reuse. Custom
   // instances retain every callback by default; queries and p5 keep fresh cadence.
   if(instance.redrawPolicy!=='projection'||paintedKey!==projectionKey){instance.draw(value);paintedKey=projectionKey;}
   const sample=currentPlayback.sample();animation.draw(value,sample.animations,sample.time,point=>instance!.project?.(point,value)??{x:value.viewport.width/2+(point.x-9)*24,y:value.viewport.height/2+(point.y-9)*12});}
  let timer:ReturnType<typeof setTimeout>|null=null,resolveCancel:(result:LittlewildRenderer.SwitchResult)=>void=()=>{};
  const cancelled=new Promise<LittlewildRenderer.SwitchResult>(resolve=>{resolveCancel=resolve;});
  const prepared=rendererId==='basic'?Promise.resolve().then(()=>observerFactory(context,dimension)):root.LWRenderers.prepare(rendererId,context);
  const work=Promise.all([prepared,animation.ready]).then(([value,animated]):LittlewildRenderer.SwitchResult=>{if(disposed){value.dispose();return{ok:false,reason:'Preview preparation was cancelled.'};}instance=value;if(!animated.ok){dispose();return animated;}try{instance.mount();instance.resize(viewport());draw(0,0);preparedSuccessfully=true;return{ok:true};}catch(error){dispose();return{ok:false,reason:String(error)};}},error=>{dispose();return{ok:false,reason:String(error)};});
  timer=setTimeout(()=>dispose(),10000);const ready=Promise.race([work,cancelled]).then(result=>{if(timer!==null)clearTimeout(timer);return result;});
  function dispose(){if(disposed)return;disposed=true;lifecycle.abort();if(timer!==null)clearTimeout(timer);resolveCancel({ok:false,reason:'Preview preparation was cancelled.'});try{instance?.dispose();}finally{instance=null;animation.dispose();for(const cleanup of cleanups.splice(0).reverse()){try{cleanup();}catch{}}canvas.remove();}}
  function updatePlayback(next:LWStorytelling.Playback):boolean{
   if(disposed||!preparedSuccessfully||instance?.previewReuse!=='timeline')return false;
   if(registration!==root.LWRenderers.generation(rendererId)||(rendererId==='basic'&&observerFactory!==root.LWRendererObserver.create))return false;
   const status=next.status(),prior=currentPlayback.status();if(status.cutsceneId!==prior.cutsceneId||status.sceneId!==sceneId)return false;
   // Scene/catalog identity is admitted by composition before this staged swap.
   currentPlayback=next;projection=null;projectionKey='';paintedKey='';time=0;delta=0;return true;
  }
  return{ready,snapshot(){if(disposed)throw Error('The preview is disposed.');return frame();},draw,updatePlayback,dispose};
 }
 root.LWStorytellingRenderer={create};
})(globalThis);
