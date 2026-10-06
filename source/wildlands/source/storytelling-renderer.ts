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
  const lifecycle=new AbortController(),cleanups:(()=>void)[]=[],releases:(()=>void|Promise<void>)[]=[];
  let disposed=false,instance:LittlewildRenderer.Instance|null=null,candidate:LittlewildRenderer.Instance|null=null,time=0,delta=0;
  let finalizer:(()=>Promise<void>)|null=null;const released=new WeakSet<LittlewildRenderer.Instance>();
  const reportRelease=(error:unknown)=>console.error('Preview resource release failed.',error);
  function releaseInstance(value:LittlewildRenderer.Instance):void{if(released.has(value))return;released.add(value);value.dispose();}
  function releaseNow(cleanup:()=>void|Promise<void>):void{const result=cleanup();if(result)void Promise.resolve(result).catch(reportRelease);}
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
  const context:LittlewildRenderer.Context=Object.freeze({canvas,signal:lifecycle.signal,query:Object.freeze({frame,asset:(category:'actor'|'building'|'item',id:string)=>{if(disposed)throw Error('The preview is disposed.');return source.asset(category,id);},creatureDefinition:(id:string)=>{if(disposed)throw Error('The preview is disposed.');return source.definition(id);},buildingInterior:(id:string)=>{const current=frame();return current.room?.buildingId===id?current.room:null;}}),commands:Object.freeze({submit:():LittlewildDeveloper.CommandResult=>({ok:false,code:'unavailable-command',reason:'Draft previews are observation only.',data:null})}),onDispose(cleanup:()=>void){if(lifecycle.signal.aborted)cleanup();else cleanups.push(cleanup);},onRelease(cleanup:()=>void|Promise<void>){if(lifecycle.signal.aborted)releaseNow(cleanup);else releases.push(cleanup);}});
  const overlay=document.createElement('canvas');overlay.dataset.p5Animation='';Object.assign(overlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',background:'transparent',border:'0'});overlay.width=canvas.width;overlay.height=canvas.height;container.append(overlay);
  const animation=root.LWAnimations.create(overlay);
  function draw(now:number,elapsed:number){if(disposed||!instance)return;time=now;delta=elapsed;const width=Math.max(64,Math.round(container.clientWidth)||canvas.width),height=Math.max(64,Math.round(container.clientHeight)||canvas.height);if(width!==canvas.width||height!==canvas.height){instance.resize({width,height,pixelRatio:1});projection=null;paintedKey='';}const value=frame();
   // Only the actual instance can opt into projection-only bitmap reuse. Custom
   // instances retain every callback by default; queries and p5 keep fresh cadence.
   if(instance.redrawPolicy!=='projection'||paintedKey!==projectionKey){instance.draw(value);paintedKey=projectionKey;}
   const sample=currentPlayback.sample();animation.draw(value,sample.animations,sample.time,point=>instance!.project?.(point,value)??{x:value.viewport.width/2+(point.x-9)*24,y:value.viewport.height/2+(point.y-9)*12});}
  let timer:ReturnType<typeof setTimeout>|null=null,resolveCancel:(result:LittlewildRenderer.SwitchResult)=>void=()=>{};
  const cancelled=new Promise<LittlewildRenderer.SwitchResult>(resolve=>{resolveCancel=resolve;});
  const preparation=rendererId==='basic'?Promise.resolve().then(()=>observerFactory(context,dimension)):root.LWRenderers.prepare(rendererId,context);
  // Capture the actual resolved instance even while p5 is still preparing. An
  // unresolved factory grants no retirement permission to its future instance.
  const prepared=preparation.then(value=>{if(disposed){releaseInstance(value);}else candidate=value;return value;});
  const work=Promise.all([prepared,animation.ready]).then(([value,animated]):LittlewildRenderer.SwitchResult=>{
   if(disposed)return{ok:false,reason:'Preview preparation was cancelled.'};
   instance=value;if(!animated.ok){dispose();return animated;}
   try{instance.mount();instance.resize(viewport());draw(0,0);preparedSuccessfully=true;return{ok:true};}
   catch(error){dispose();return{ok:false,reason:String(error)};}
  },error=>{dispose();return{ok:false,reason:String(error)};});
  timer=setTimeout(()=>dispose(),10000);const ready=Promise.race([work,cancelled]).then(result=>{if(timer!==null)clearTimeout(timer);return result;});
  const attempt=(errors:unknown[],work:()=>void)=>{try{work();}catch(error){errors.push(error);}};
  function stop(errors:unknown[]):void{
   disposed=true;attempt(errors,()=>lifecycle.abort());if(timer!==null)clearTimeout(timer);
   resolveCancel({ok:false,reason:'Preview preparation was cancelled.'});
   for(const cleanup of cleanups.splice(0).reverse())attempt(errors,cleanup);
   attempt(errors,()=>canvas.remove());attempt(errors,()=>overlay.remove());
  }
  function dispose():void{
   if(disposed){if(finalizer)void finalizer().catch(reportRelease);return;}
   const errors:unknown[]=[],owned=candidate;stop(errors);instance=null;candidate=null;
   if(owned)attempt(errors,()=>releaseInstance(owned));attempt(errors,()=>animation.dispose());
   for(const cleanup of releases.splice(0).reverse())attempt(errors,()=>releaseNow(cleanup));
   if(errors.length)throw new AggregateError(errors,'Preview disposal failed.');
  }
  function retire(this:LWStorytellingRenderer.Preview):(()=>Promise<void>)|undefined{
   // A copied method or replacement disposal hook belongs to a new lifecycle
   // owner. It must explicitly delegate retirement rather than inherit permission.
   if(this!==preview||this.dispose!==dispose)return undefined;
   const owned=candidate;if(disposed||owned?.retirementPolicy!=='deferred'||!owned.quiesce)return undefined;
   const releaseAnimation=animation.retire?.();if(!releaseAnimation)return undefined;
   const errors:unknown[]=[];stop(errors);instance=null;candidate=null;attempt(errors,()=>owned.quiesce!());
   const resourceReleases=releases.splice(0).reverse();let completion:Promise<void>|null=null;
   // Lifecycle errors are reported only after every captured resource release:
   // no synchronous hook can strand the finalizer before the caller owns it.
   finalizer=()=>completion??=(async()=>{
    attempt(errors,()=>releaseInstance(owned));
    const outcomes=await Promise.allSettled([...resourceReleases.map(async cleanup=>{await cleanup();}),Promise.resolve().then(releaseAnimation)]);
    for(const outcome of outcomes)if(outcome.status==='rejected')errors.push(outcome.reason);
    if(errors.length)throw new AggregateError(errors,'Preview retirement failed.');
   })();return finalizer;
  }
  function updatePlayback(next:LWStorytelling.Playback):boolean{
   if(disposed||!preparedSuccessfully||instance?.previewReuse!=='timeline')return false;
   if(registration!==root.LWRenderers.generation(rendererId)||(rendererId==='basic'&&observerFactory!==root.LWRendererObserver.create))return false;
   const status=next.status(),prior=currentPlayback.status();if(status.cutsceneId!==prior.cutsceneId||status.sceneId!==sceneId)return false;
   // Scene/catalog identity is admitted by composition before this staged swap.
   currentPlayback=next;projection=null;projectionKey='';paintedKey='';time=0;delta=0;return true;
  }
  const preview:LWStorytellingRenderer.Preview={ready,snapshot(){if(disposed)throw Error('The preview is disposed.');return frame();},draw,updatePlayback,retire,dispose};return preview;
 }
 root.LWStorytellingRenderer={create};
})(globalThis);
