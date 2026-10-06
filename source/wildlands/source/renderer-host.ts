/// <reference path="./renderer-contracts.d.ts" />
/// <reference path="./storytelling-renderer-contracts.d.ts" />
/// <reference path="./animation-contracts.d.ts" />
/* Presentation lifecycle and compatibility facade. The application remains the sole RAF owner. */
(function(inputRoot:unknown){
 'use strict';
 type Frame=LittlewildRenderer.Frame;type Point=LittlewildRenderer.Point;type Instance=LittlewildRenderer.Instance;
 interface Legacy {
  canvas:HTMLCanvasElement;camera:{x:number;y:number;z:number};hover:LittlewildRenderer.Hit|null;keyboardTile?:Point|null;
  placement:string|null;manual:boolean;lastDrawAt:number;running:boolean;presentationAlpha:number;
  observer:ResizeObserver;labels?:HTMLElement;atmosphere?:HTMLElement;
  toScreen(x:number,y:number):Point;toTile(x:number,y:number):Point;hitTest(x:number,y:number):LittlewildRenderer.Hit;
  invalidate?():void;[key:string]:unknown;
 }
 interface Basic {world:Legacy;mount():void;suspend():void;draw(time:number,delta:number):void;setEngine(engine:unknown):void;dispose():void;}
 interface Handlers {inspect?(hit:LittlewildRenderer.Hit):void;place?(kind:string,hit:LittlewildRenderer.Hit):void;context?(hit:LittlewildRenderer.Hit,point:Point,source:string):void;pan?():void;blocked?():boolean;}
 interface Options {canvas:HTMLCanvasElement;engine:unknown;handlers:Handlers;command(command:LittlewildDeveloper.Command):unknown;rendererId?:string;}
 interface Active {id:string;metadata:LittlewildRenderer.Metadata;instance:Instance;canvas:HTMLCanvasElement;controller:AbortController;cleanups:(()=>void)[];observer:ResizeObserver|null;disposed:boolean;dimension:LittlewildRenderer.Dimension;}
 const root=inputRoot as {LWRenderers:LittlewildRenderer.Registry;LWRendererBasic:{create(canvas:HTMLCanvasElement,engine:unknown,handlers:Handlers):Basic;create2D(canvas:HTMLCanvasElement,engine:unknown,camera:LittlewildRenderer.Camera):Instance};
  LWRendererFrame:{create(engine:unknown,options:unknown):Frame;interior(engine:unknown,id:string):LittlewildRenderer.Value<LittlewildDeveloper.BuildingInteriorSnapshot>|null;asset(category:'actor'|'building'|'item',id:string):LittlewildRenderer.Value<LittlewildDeveloper.Document>|null;definition(id:string):LittlewildRenderer.Value<LittlewildDeveloper.Document>|null};LWDeveloperData:{copy(value:unknown):LittlewildDeveloper.Json;record(value:unknown):LittlewildDeveloper.Document};
  LWDeveloperCommands:{validate(value:unknown,scope:'world'|'actor'):LittlewildDeveloper.Command};LWRuntimeResults:{codes:readonly LWRuntime.FailureCode[]};LWCommandRouter:{manifest:readonly {id:string;scope:'world'|'actor'}[]};LWRendererCompositor?:{create(container:HTMLElement,engine:unknown,embeds:readonly LWSceneGraph.Embed[],pack:LWContentPorts.ScenarioPack):{ready:Promise<LittlewildRenderer.SwitchResult>;draw(time:number,delta:number):void;dispose():void}};LWRendererObserver:{create(context:LittlewildRenderer.Context,dimension:LittlewildRenderer.Dimension):Instance};LWStorytellingProjection:LWStorytelling.RenderingApi;LWAnimations:LWAnimations.Api;LWRendererHost?:unknown;};
 let playerHost:LittlewildRenderer.Host|null=null;
 function create(options:Options){
  const basic=root.LWRendererBasic.create(options.canvas,options.engine,options.handlers),w=basic.world;
  let interiorView:{buildingId:string;floorId:string;surface:LittlewildRenderer.Surface|null}|null=null;
  let engine=options.engine,active:Active|null=null,disposed=false,lastFrame:Frame|null=null,time=0,delta=0,observing=0,dimension:LittlewildRenderer.Dimension='3d';
  let pending:{cancel():void}|null=null,sceneRevision=0,preview:LWStorytelling.PreviewSource|null=null,playback:LWStorytelling.Playback|null=null;
  let animation:LWAnimations.Layer|null=null,animationCanvas:HTMLCanvasElement|null=null,generalAnimations:readonly LWAnimations.Descriptor[]=[],animationStartedAt=0;
  let compositor:ReturnType<NonNullable<typeof root.LWRendererCompositor>['create']>|null=null;
  function clearEmbeds(){sceneRevision++;compositor?.dispose();compositor=null;}
  function cancelPending(){pending?.cancel();pending=null;}
  function requestedFor(id:string):LittlewildRenderer.Dimension {const dimensions=root.LWRenderers.list().find(entry=>entry.id===id)?.dimensions;return dimensions?.length===1?dimensions[0]!:dimension;}
  function observe<T>(work:()=>T):T {observing++;try{return work();}finally{observing--;}}
  const viewport=():LittlewildRenderer.Viewport=>({width:active?.canvas.width||w.canvas.width,height:active?.canvas.height||w.canvas.height,pixelRatio:1});
  const frame=():Frame=>{const value=preview?preview.frame({time,delta,camera:w.camera,viewport:viewport()}):root.LWRendererFrame.create(engine,{time,delta,running:!!w.running,alpha:w.presentationAlpha??1,camera:w.camera,viewport:viewport(),interiorView,
   presentation:{placement:w.placement??null,hover:w.hover??null,selected:w.selected??null,resourceLens:!!w.resourceLens,landSelected:w.landSelected??null,terraformPreview:w.terraformPreview??null,constructionPreview:w.constructionPreview??null}});return playback?root.LWStorytellingProjection.frame(value,playback.sample()):value;};
  function cleanup(candidate:Active){
   if(candidate.disposed)return;candidate.disposed=true;candidate.controller.abort();candidate.observer?.disconnect();
   try{candidate.instance.dispose();}catch(_){}for(const release of candidate.cleanups.splice(0).reverse()){try{release();}catch(_){}}
   candidate.canvas.remove();
  }
  function invalidate(){w.lastDrawAt=0;w.invalidate?.();lastFrame=null;}
  function project(x:number,y:number):Point {
   if(!active)return w.toScreen(x,y);const f=frame();
   return observe(()=>active!.instance.project?.({x,y},f))||{x:f.viewport.width/2+(x-9)*24*w.camera.z+w.camera.x,y:f.viewport.height/2+(y-9)*24*w.camera.z+w.camera.y};
  }
  function tile(x:number,y:number):Point {
   if(!active)return w.toTile(x,y);const f=frame();
   return observe(()=>active!.instance.toTile?.({x,y},f))||{x:Math.round((x-f.viewport.width/2-w.camera.x)/(24*w.camera.z)+9),y:Math.round((y-f.viewport.height/2-w.camera.y)/(24*w.camera.z)+9)};
  }
  function hit(x:number,y:number):LittlewildRenderer.Hit {return active?observe(()=>active!.instance.hitTest?.({x,y},frame()))||tile(x,y):w.hitTest(x,y);}
  function bind(candidate:Active){
   const canvas=candidate.canvas,signal=candidate.controller.signal;let drag:{x:number;y:number;cameraX:number;cameraY:number}|null=null,moved=false;
   const local=(event:MouseEvent):Point=>{const box=canvas.getBoundingClientRect();return{x:(event.clientX-box.left)*canvas.width/box.width,y:(event.clientY-box.top)*canvas.height/box.height};};
   canvas.addEventListener('pointerdown',event=>{if(event.button!==0||options.handlers.blocked?.())return;const p=local(event);drag={x:p.x,y:p.y,cameraX:w.camera.x,cameraY:w.camera.y};moved=false;canvas.focus({preventScroll:true});try{canvas.setPointerCapture(event.pointerId);}catch(_){}},{signal});
   canvas.addEventListener('pointerup',()=>{drag=null;},{signal});canvas.addEventListener('pointercancel',()=>{drag=null;moved=true;},{signal});
   canvas.addEventListener('pointermove',event=>{if(options.handlers.blocked?.())return;const p=local(event);if(drag){const dx=p.x-drag.x,dy=p.y-drag.y;if(Math.hypot(dx,dy)>7)moved=true;if(moved){w.camera.x=drag.cameraX+dx;w.camera.y=drag.cameraY+dy;w.manual=true;options.handlers.pan?.();}}w.hover=w.placement||w.terraformMode?tile(p.x,p.y):hit(p.x,p.y);invalidate();},{signal});
   canvas.addEventListener('click',event=>{if(moved||options.handlers.blocked?.())return;const p=local(event),target=w.placement||w.terraformMode?tile(p.x,p.y):hit(p.x,p.y);w.keyboardTile=target;if(w.placement)options.handlers.place?.(w.placement,target);else options.handlers.inspect?.(target);},{signal});
   canvas.addEventListener('contextmenu',event=>{event.preventDefault();if(options.handlers.blocked?.())return;const p=local(event);options.handlers.context?.(hit(p.x,p.y),p,'mouse');},{signal});
   canvas.addEventListener('wheel',event=>{event.preventDefault();w.camera.z=Math.max(.3,Math.min(3,w.camera.z*Math.exp(-event.deltaY*.0018)));w.manual=true;options.handlers.pan?.();observe(()=>candidate.instance.cameraChanged?.({...w.camera}));invalidate();},{signal,passive:false});
   canvas.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.altKey||event.metaKey||options.handlers.blocked?.())return;
    const dirs:Record<string,readonly [number,number]>={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]},direction=dirs[event.key];
    if(direction){event.preventDefault();event.stopPropagation();if(event.shiftKey||w.placement){const p=w.keyboardTile||w.hover||{x:9,y:9};w.keyboardTile={x:p.x+direction[0],y:p.y+direction[1]};w.hover=w.keyboardTile;}else{w.camera.x-=direction[0]*35;w.camera.y-=direction[1]*35;options.handlers.pan?.();}invalidate();}
    else if(['+','=','-'].includes(event.key)){event.preventDefault();w.camera.z=Math.max(.3,Math.min(3,w.camera.z*(event.key==='-'?1/1.15:1.15)));invalidate();}
    else if(event.key.toLowerCase()==='h'){event.preventDefault();Object.assign(w.camera,{x:0,y:0,z:1});invalidate();}
    else if(event.key==='Enter'||event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();const p=w.keyboardTile||w.hover||{x:9,y:9};if(w.placement)options.handlers.place?.(w.placement,p);else options.handlers.context?.(p,project(p.x,p.y),'keyboard');}
   },{signal});
  }
  function candidateFor(id:string,requestedDimension:LittlewildRenderer.Dimension){
   const found=root.LWRenderers.list().find(entry=>entry.id===id);if(!found)throw Error('Unknown renderer: '+id+'.');const metadata:LittlewildRenderer.Metadata=found;
   if(metadata.dimensions&&!metadata.dimensions.includes(requestedDimension))throw Error('Renderer does not support '+requestedDimension+'.');
   const canvas=w.canvas.cloneNode(false) as HTMLCanvasElement;canvas.removeAttribute('id');canvas.hidden=true;canvas.width=active?.canvas.width??w.canvas.width;canvas.height=active?.canvas.height??w.canvas.height;w.canvas.parentElement!.appendChild(canvas);
   const controller=new AbortController(),cleanups:(()=>void)[]=[];
   let candidate:Active|null=null,instance:Instance|null=null;
   function cancel(){if(candidate)cleanup(candidate);else{controller.abort();try{instance?.dispose();}catch(_){}for(const release of cleanups.splice(0).reverse()){try{release();}catch(_){}}canvas.remove();}}
   const context:LittlewildRenderer.Context=Object.freeze({canvas,signal:controller.signal,query:Object.freeze({frame:()=>{if(disposed||controller.signal.aborted)throw Error('Renderer context is disposed.');return frame();},buildingInterior:(id:string)=>{if(controller.signal.aborted)throw Error('Renderer context is disposed.');return root.LWRendererFrame.interior(engine,id);},asset:(category:'actor'|'building'|'item',id:string)=>{if(controller.signal.aborted)throw Error('Renderer context is disposed.');return preview?preview.asset(category,id):root.LWRendererFrame.asset(category,id);},creatureDefinition:(id:string)=>{if(controller.signal.aborted)throw Error('Renderer context is disposed.');return preview?preview.definition(id):root.LWRendererFrame.definition(id);}}),
     commands:Object.freeze({submit:(input:LittlewildDeveloper.Command):LittlewildDeveloper.CommandResult=>{
      if(preview||disposed||controller.signal.aborted)return {ok:false,reason:'Renderer is inactive.',code:'unavailable-command',data:null};
      if(observing>0)return {ok:false,reason:'Commands require a user intent outside observation callbacks.',code:'busy',data:null};
      if(active!==candidate||!candidate)return {ok:false,reason:'Renderer is inactive.',code:'unavailable-command',data:null};
      try{const raw=root.LWDeveloperData.record(input),definition=root.LWCommandRouter.manifest.find(entry=>entry.id===raw.id);if(!definition)throw Error('Unknown command.');
       const command=root.LWDeveloperCommands.validate(raw,definition.scope),data=root.LWDeveloperData.copy(options.command(command)??null),record=data&&typeof data==='object'&&!Array.isArray(data)?data:null;
       const code=root.LWRuntimeResults.codes.find(candidate=>candidate===record?.code);
       return {ok:data!==false&&record?.ok!==false,...(typeof record?.reason==='string'?{reason:record.reason}:{}),...(code===undefined?{}:{code}),data};
      }catch(error){return {ok:false,reason:String(error instanceof Error?error.message:error),code:'invalid-command',data:null};}
     }}),onDispose:(release:()=>void)=>{if(typeof release!=='function')throw Error('Cleanup must be a function.');if(controller.signal.aborted)release();else cleanups.push(release);}});
   function finish(value:Instance):LittlewildRenderer.SwitchResult{
    instance=value;if(disposed||controller.signal.aborted){try{value.dispose();}catch(_){}return {ok:false,reason:'Renderer preparation was cancelled.'};}
    try{
    if(!instance||['mount','draw','resize','dispose'].some(name=>typeof (instance as unknown as Record<string,unknown>)[name]!=='function'))throw Error('Renderer requires mount, draw, resize and dispose methods.');
    candidate={id,metadata,instance,canvas,controller,cleanups,observer:null,disposed:false,dimension:requestedDimension};observe(()=>{instance!.mount();instance!.resize({width:canvas.width,height:canvas.height,pixelRatio:1});instance!.draw(frame());});
    const previous=active;if(!previous)basic.suspend();else previous.canvas.id='';w.canvas.id='world-basic';w.canvas.hidden=true;active=candidate;canvas.id='world';canvas.hidden=false;bind(candidate);
    const installed=candidate;installed.observer=new ResizeObserver(()=>{if(active!==installed)return;const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;canvas.width=Math.round(box.width);canvas.height=Math.round(box.height);try{observe(()=>instance!.resize(viewport()));invalidate();}catch(_){selectRenderer('basic');}});installed.observer.observe(canvas);
    if(previous)cleanup(previous);invalidate();return {ok:true};
    }catch(error){cancel();return {ok:false,reason:String(error instanceof Error?error.message:error)};}
   }
   return {context,finish,cancel};
  }
  function selectRenderer(id:string):LittlewildRenderer.SwitchResult{
   cancelPending();const requestedDimension:LittlewildRenderer.Dimension=requestedFor(id);if(disposed)return {ok:false,reason:'Renderer host is disposed.'};if(id===(active?.id||'basic')&&requestedDimension===(active?.dimension||'3d'))return {ok:true};
   if(id==='basic'&&requestedDimension==='3d'&&!playback&&!preview){
    const previous=active;active=null;if(previous){previous.canvas.id='';w.canvas.id='world';w.canvas.hidden=false;basic.mount();cleanup(previous);}invalidate();return {ok:true};
   }
   let prepared:ReturnType<typeof candidateFor>|null=null;
   try{prepared=candidateFor(id,requestedDimension);const result=prepared.finish(id==='basic'?(playback||preview?root.LWRendererObserver.create(prepared.context,requestedDimension):root.LWRendererBasic.create2D(prepared.context.canvas,engine,w.camera)):observe(()=>root.LWRenderers.create(id,prepared!.context)));if(result.ok)dimension=requestedDimension;return result;}
   catch(error){prepared?.cancel();return {ok:false,reason:String(error instanceof Error?error.message:error)};}
  }
  async function selectRendererAsync(id:string):Promise<LittlewildRenderer.SwitchResult>{
   cancelPending();const requestedDimension:LittlewildRenderer.Dimension=requestedFor(id);if(disposed)return {ok:false,reason:'Renderer host is disposed.'};
   if(id==='basic'||id===(active?.id||'basic')&&requestedDimension===(active?.dimension||'3d'))return selectRenderer(id);
   let prepared:ReturnType<typeof candidateFor>;
   try{prepared=candidateFor(id,requestedDimension);}catch(error){return {ok:false,reason:String(error instanceof Error?error.message:error)};}
   let timer:ReturnType<typeof setTimeout>|null=null,resolveCancelled:((result:LittlewildRenderer.SwitchResult)=>void)|null=null;
   const cancelled=new Promise<LittlewildRenderer.SwitchResult>(resolve=>{resolveCancelled=resolve;});
   const token={cancel(){prepared.cancel();resolveCancelled?.({ok:false,reason:'Renderer preparation was cancelled.'});}};pending=token;
   timer=setTimeout(()=>token.cancel(),10000);
   const ready=root.LWRenderers.prepare(id,prepared.context).then(instance=>{const result=prepared.finish(instance);if(result.ok)dimension=requestedDimension;return result;},error=>{prepared.cancel();return {ok:false,reason:String(error instanceof Error?error.message:error)};});
   const result=await Promise.race([ready,cancelled]);if(timer!==null)clearTimeout(timer);if(pending===token)pending=null;return result;
  }
  async function selectSceneRendering(rendering:LWSceneGraph.Rendering):Promise<LittlewildRenderer.SwitchResult>{
   if(!rendering||!['2d','3d'].includes(rendering.dimension)||!/^([a-z][a-z0-9-]{0,63})$/.test(rendering.rendererId))return {ok:false,reason:'Invalid scene renderer configuration.'};
   const metadata=root.LWRenderers.list().find(row=>row.id===rendering.rendererId);if(!metadata)return {ok:false,reason:'Renderer is unavailable: '+rendering.rendererId+'.'};if(metadata.dimensions&&!metadata.dimensions.includes(rendering.dimension))return {ok:false,reason:'Renderer '+metadata.id+' does not support dimension '+rendering.dimension+'.'};
   cancelPending();if(disposed)return {ok:false,reason:'Renderer host is disposed.'};
   const revision=++sceneRevision,requestedDimension=rendering.dimension,id=rendering.rendererId;
   let prepared:ReturnType<typeof candidateFor>|null=null,next:typeof compositor=null,stage:HTMLElement|null=null,instance:Instance|null=null,cancelled=false,committed=false;
   let resolveCancelled:((result:LittlewildRenderer.SwitchResult)=>void)|null=null;
   const cancellation=new Promise<LittlewildRenderer.SwitchResult>(resolve=>{resolveCancelled=resolve;});
   function discard(){prepared?.cancel();if(instance&&!committed){try{instance.dispose();}catch(_){}instance=null;}next?.dispose();stage?.remove();}
   const token={cancel(){cancelled=true;discard();resolveCancelled?.({ok:false,reason:'Scene presentation was cancelled.'});}};
   try{
    const needsMain=id!==(active?.id||'basic')||requestedDimension!==(active?.dimension||'3d');
    if(needsMain&&!(id==='basic'&&requestedDimension==='3d'&&!playback&&!preview))prepared=candidateFor(id,requestedDimension);
    if(rendering.embeds?.length){
     const pack=(engine as {scenarioContext?:LWContentPorts.ExperienceContext}).scenarioContext?.journey?.pack;if(!pack||!root.LWRendererCompositor)throw Error('Embedded scene context is unavailable.');
     stage=document.createElement('div');stage.className='renderer-embedded-scenes';stage.hidden=true;Object.assign(stage.style,{position:'absolute',inset:'0',pointerEvents:'none',background:'transparent',border:'0'});w.canvas.parentElement!.append(stage);
     const composed=root.LWRendererCompositor.create(stage,engine,rendering.embeds,pack),container=stage;
     next={ready:composed.ready,draw:composed.draw,dispose(){composed.dispose();container.remove();}};
    }
    pending=token;const timer=setTimeout(()=>token.cancel(),10000);
    const main=prepared?(id==='basic'?Promise.resolve((playback||preview?root.LWRendererObserver.create(prepared.context,requestedDimension):root.LWRendererBasic.create2D(prepared.context.canvas,engine,w.camera))):root.LWRenderers.prepare(id,prepared.context)).then(value=>{if(cancelled){try{value.dispose();}catch(_){}return null;}instance=value;return value;}):Promise.resolve(null);
    const work=Promise.all([main,next?.ready??Promise.resolve({ok:true})]).then(([value,embedded]):LittlewildRenderer.SwitchResult=>{
     if(cancelled||disposed||revision!==sceneRevision){discard();return {ok:false,reason:'Scene presentation was cancelled.'};}
     if(!embedded.ok){discard();return embedded;}
     const priorDimension=dimension;if(pending===token)pending=null;if(id==='basic'&&requestedDimension==='3d')dimension='3d';
     const result=prepared&&value?prepared.finish(value):id==='basic'&&requestedDimension==='3d'?selectRenderer('basic'):{ok:true};
     if(!result.ok){dimension=priorDimension;instance=null;next?.dispose();stage?.remove();return result;}
     dimension=requestedDimension;committed=true;instance=null;compositor?.dispose();compositor=next;next=null;if(stage)stage.hidden=false;invalidate();return result;
    },error=>{discard();return {ok:false,reason:String(error instanceof Error?error.message:error)};});
    const result=await Promise.race([work,cancellation]);clearTimeout(timer);if(pending===token)pending=null;return result;
   }catch(error){discard();return {ok:false,reason:String(error instanceof Error?error.message:error)};}
  }
  function clearAnimation(){animation?.dispose();animation=null;animationCanvas?.remove();animationCanvas=null;}
  function createAnimation(){if(animation||!playback&&!generalAnimations.length)return;const canvas=document.createElement('canvas');canvas.dataset.p5Animation='';canvas.width=viewport().width;canvas.height=viewport().height;Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',background:'transparent',border:'0'});w.canvas.parentElement!.append(canvas);animationCanvas=canvas;try{animation=root.LWAnimations.create(canvas);}catch(error){canvas.remove();animationCanvas=null;throw error;}}
  function updateObservation(){
   if((active?.id||'basic')!=='basic')return;
   const requested=active?.dimension||'3d';
   if(!playback&&!preview&&requested==='3d'){const previous=active;active=null;if(previous){previous.canvas.id='';w.canvas.id='world';w.canvas.hidden=false;basic.mount();cleanup(previous);}return;}
   const prepared=candidateFor('basic',requested);try{const instance=playback||preview?root.LWRendererObserver.create(prepared.context,requested):root.LWRendererBasic.create2D(prepared.context.canvas,engine,w.camera);const result=prepared.finish(instance);if(!result.ok)throw Error(result.reason);}catch(error){prepared.cancel();throw error;}
  }
  const methods={selectRenderer,selectRendererAsync,selectSceneRendering,
   setPreview(source:LWStorytelling.PreviewSource|null){if(disposed)throw Error('Renderer host is disposed.');if(source===preview)return;cancelPending();const previous=preview;preview=source;try{updateObservation();invalidate();}catch(error){preview=previous;throw error;}},
   setPlayback(value:LWStorytelling.Playback|null){if(disposed)throw Error('Renderer host is disposed.');if(value===playback)return;cancelPending();const previous=playback;playback=value;try{updateObservation();clearAnimation();createAnimation();invalidate();}catch(error){playback=previous;throw error;}},
   snapshot(){if(disposed)throw Error('Renderer host is disposed.');return frame();},project(point:Point){return project(point.x,point.y);},
   setAnimations(input:readonly LWAnimations.Descriptor[]|null){if(disposed)throw Error('Renderer host is disposed.');const next=root.LWAnimations.validate(input??[]);generalAnimations=next;animationStartedAt=time;if(!playback)clearAnimation();createAnimation();},
   setInteriorView(buildingId:string|null,floorId='',surface?:LittlewildRenderer.Surface){const next=buildingId?{buildingId,floorId,surface:surface?{...surface}:null}:null;if(JSON.stringify(next)!==JSON.stringify(interiorView)){interiorView=next;invalidate();}},
   setEngine(value:unknown){generalAnimations=[];playback=null;preview=null;clearAnimation();cancelPending();clearEmbeds();interiorView=null;engine=value;basic.setEngine(value);if(active?.id==='basic'){const previous=active;active=null;w.canvas.id='world';w.canvas.hidden=false;basic.mount();cleanup(previous);}invalidate();},
   draw(now:number,elapsed:number){if(disposed)return;time=now;delta=elapsed;compositor?.draw(now,elapsed);if(!active)basic.draw(now,elapsed);else try{lastFrame=frame();observe(()=>active!.instance.draw(lastFrame!));}catch(_){selectRenderer('basic');basic.draw(now,elapsed);}if(animation){const current=lastFrame??frame(),sample=playback?.sample();try{animation.draw(current,sample?.animations??generalAnimations,sample?.time??Math.max(0,now-animationStartedAt),point=>active?.instance.project?.(point,current)||project(point.x,point.y));}catch{clearAnimation();}}},
   toScreen:project,toTile:tile,hitTest:hit,
   focus(x:number,y:number){if(!active){const fn=w.focus;if(typeof fn==='function')fn.call(w,x,y);return;}const p=project(x,y);w.camera.x+=active.canvas.width/2-p.x;w.camera.y+=active.canvas.height/2-p.y;w.manual=true;invalidate();},
   home(){if(!active){const fn=w.home;if(typeof fn==='function')fn.call(w);return;}Object.assign(w.camera,{x:0,y:0,z:1});w.manual=false;invalidate();},
   zoom(factor:number){if(!active){const fn=w.zoom;if(typeof fn==='function')fn.call(w,factor);return;}w.camera.z=Math.max(.3,Math.min(3,w.camera.z*factor));invalidate();},
   invalidate,dispose(){if(disposed)return;disposed=true;clearAnimation();cancelPending();clearEmbeds();if(active)cleanup(active);active=null;basic.dispose();}
  };
  const host=new Proxy(methods,{get(target,key){if(key==='rendererId')return active?.id||'basic';if(key==='rendererDimension')return active?.dimension||'3d';if(key==='capabilities')return active?.metadata.capabilities||root.LWRenderers.list()[0]!.capabilities;if(key==='canvas')return active?.canvas||w.canvas;if(key==='mode'&&active)return active.id==='basic'?active.dimension==='3d'?'Three observer 3D':'Canvas 2D':active.metadata.name;if(key==='hasDetachedPresentation')return !!(preview||playback);if(key==='setQuality'&&active)return ()=>false;
   if(key in target)return Reflect.get(target,key);const value=w[String(key)];return typeof value==='function'?value.bind(w):value;},set(_target,key,value:unknown){w[String(key)]=value;return true;}});
  playerHost=host as unknown as LittlewildRenderer.Host;if(options.rendererId)selectRenderer(options.rendererId);return host;
 }
 root.LWRendererHost={create,player(){if(!playerHost)throw Error('A browser player host is not mounted.');return playerHost;}};
})(globalThis);
