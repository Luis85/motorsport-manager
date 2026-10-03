/// <reference path="./renderer-contracts.d.ts" />
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
 interface Active {id:string;metadata:LittlewildRenderer.Metadata;instance:Instance;canvas:HTMLCanvasElement;controller:AbortController;cleanups:(()=>void)[];observer:ResizeObserver|null;disposed:boolean;}
 const root=inputRoot as {LWRenderers:LittlewildRenderer.Registry;LWRendererBasic:{create(canvas:HTMLCanvasElement,engine:unknown,handlers:Handlers):Basic};
  LWRendererFrame:{create(engine:unknown,options:unknown):Frame;interior(engine:unknown,id:string):LittlewildRenderer.Value<LittlewildDeveloper.BuildingInteriorSnapshot>|null;asset(category:'actor'|'building'|'item',id:string):LittlewildRenderer.Value<LittlewildDeveloper.Document>|null;definition(id:string):LittlewildRenderer.Value<LittlewildDeveloper.Document>|null};LWDeveloperData:{copy(value:unknown):LittlewildDeveloper.Json;record(value:unknown):LittlewildDeveloper.Document};
  LWDeveloperCommands:{validate(value:unknown,scope:'world'|'actor'):LittlewildDeveloper.Command};LWRuntimeResults:{codes:readonly LWRuntime.FailureCode[]};LWCommandRouter:{manifest:readonly {id:string;scope:'world'|'actor'}[]};LWRendererHost?:unknown;};
 let playerHost:LittlewildRenderer.Host|null=null;
 function create(options:Options){
  const basic=root.LWRendererBasic.create(options.canvas,options.engine,options.handlers),w=basic.world;
  let interiorView:{buildingId:string;floorId:string;surface:LittlewildRenderer.Surface|null}|null=null;
  let engine=options.engine,active:Active|null=null,disposed=false,lastFrame:Frame|null=null,time=0,delta=0,observing=0;
  function observe<T>(work:()=>T):T {observing++;try{return work();}finally{observing--;}}
  const viewport=():LittlewildRenderer.Viewport=>({width:active?.canvas.width||w.canvas.width,height:active?.canvas.height||w.canvas.height,pixelRatio:1});
  const frame=():Frame=>root.LWRendererFrame.create(engine,{time,delta,running:!!w.running,alpha:w.presentationAlpha??1,camera:w.camera,viewport:viewport(),interiorView,
   presentation:{placement:w.placement??null,hover:w.hover??null,selected:w.selected??null,resourceLens:!!w.resourceLens,landSelected:w.landSelected??null,terraformPreview:w.terraformPreview??null,constructionPreview:w.constructionPreview??null}});
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
  function selectRenderer(id:string):{ok:boolean;reason?:string}{
   if(disposed)return {ok:false,reason:'Renderer host is disposed.'};if(id===(active?.id||'basic'))return {ok:true};
   if(id==='basic'){
    const previous=active;active=null;if(previous){previous.canvas.id='';w.canvas.id='world';w.canvas.hidden=false;basic.mount();cleanup(previous);}invalidate();return {ok:true};
   }
   const metadata=root.LWRenderers.list().find(entry=>entry.id===id);if(!metadata)return {ok:false,reason:'Unknown renderer: '+id+'.'};
   const canvas=w.canvas.cloneNode(false) as HTMLCanvasElement;canvas.removeAttribute('id');canvas.hidden=true;canvas.width=w.canvas.width;canvas.height=w.canvas.height;w.canvas.parentElement!.appendChild(canvas);
   const controller=new AbortController(),cleanups:(()=>void)[]=[];
   let candidate:Active|null=null,instance:Instance|null=null;
   try {
    const context:LittlewildRenderer.Context=Object.freeze({canvas,signal:controller.signal,query:Object.freeze({frame:()=>{if(disposed||controller.signal.aborted)throw Error('Renderer context is disposed.');return frame();},buildingInterior:(id:string)=>{if(controller.signal.aborted)throw Error('Renderer context is disposed.');return root.LWRendererFrame.interior(engine,id);},asset:(category:'actor'|'building'|'item',id:string)=>{if(controller.signal.aborted)throw Error('Renderer context is disposed.');return root.LWRendererFrame.asset(category,id);},creatureDefinition:(id:string)=>{if(controller.signal.aborted)throw Error('Renderer context is disposed.');return root.LWRendererFrame.definition(id);}}),
     commands:Object.freeze({submit:(input:LittlewildDeveloper.Command):LittlewildDeveloper.CommandResult=>{
      if(disposed||controller.signal.aborted)return {ok:false,reason:'Renderer is inactive.',code:'unavailable-command',data:null};
      if(observing>0)return {ok:false,reason:'Commands require a user intent outside observation callbacks.',code:'busy',data:null};
      if(active!==candidate||!candidate)return {ok:false,reason:'Renderer is inactive.',code:'unavailable-command',data:null};
      try{const raw=root.LWDeveloperData.record(input),definition=root.LWCommandRouter.manifest.find(entry=>entry.id===raw.id);if(!definition)throw Error('Unknown command.');
       const command=root.LWDeveloperCommands.validate(raw,definition.scope),data=root.LWDeveloperData.copy(options.command(command)??null),record=data&&typeof data==='object'&&!Array.isArray(data)?data:null;
       const code=root.LWRuntimeResults.codes.find(candidate=>candidate===record?.code);
       return {ok:data!==false&&record?.ok!==false,...(typeof record?.reason==='string'?{reason:record.reason}:{}),...(code===undefined?{}:{code}),data};
      }catch(error){return {ok:false,reason:String(error instanceof Error?error.message:error),code:'invalid-command',data:null};}
     }}),onDispose:(release:()=>void)=>{if(typeof release!=='function')throw Error('Cleanup must be a function.');if(controller.signal.aborted)release();else cleanups.push(release);}});
    instance=root.LWRenderers.create(id,context);
    if(!instance||['mount','draw','resize','dispose'].some(name=>typeof (instance as unknown as Record<string,unknown>)[name]!=='function'))throw Error('Renderer requires mount, draw, resize and dispose methods.');
    candidate={id,metadata,instance,canvas,controller,cleanups,observer:null,disposed:false};observe(()=>{instance!.mount();instance!.resize({width:canvas.width,height:canvas.height,pixelRatio:1});instance!.draw(frame());});
    const previous=active;if(!previous)basic.suspend();else previous.canvas.id='';w.canvas.id='world-basic';w.canvas.hidden=true;active=candidate;canvas.id='world';canvas.hidden=false;bind(candidate);
    const installed=candidate;installed.observer=new ResizeObserver(()=>{if(active!==installed)return;const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;canvas.width=Math.round(box.width);canvas.height=Math.round(box.height);try{observe(()=>instance!.resize(viewport()));invalidate();}catch(_){selectRenderer('basic');}});installed.observer.observe(canvas);
    if(previous)cleanup(previous);invalidate();return {ok:true};
   }catch(error){if(candidate)cleanup(candidate);else{controller.abort();try{instance?.dispose();}catch(_){}for(const release of cleanups.reverse()){try{release();}catch(_){}}canvas.remove();}return {ok:false,reason:String(error instanceof Error?error.message:error)};}
  }
  const methods={selectRenderer,
   setInteriorView(buildingId:string|null,floorId='',surface?:LittlewildRenderer.Surface){const next=buildingId?{buildingId,floorId,surface:surface?{...surface}:null}:null;if(JSON.stringify(next)!==JSON.stringify(interiorView)){interiorView=next;invalidate();}},
   setEngine(value:unknown){interiorView=null;engine=value;basic.setEngine(value);invalidate();},
   draw(now:number,elapsed:number){if(disposed)return;time=now;delta=elapsed;if(!active){basic.draw(now,elapsed);return;}try{lastFrame=frame();observe(()=>active!.instance.draw(lastFrame!));}catch(_){selectRenderer('basic');basic.draw(now,elapsed);}},
   toScreen:project,toTile:tile,hitTest:hit,
   focus(x:number,y:number){if(!active){const fn=w.focus;if(typeof fn==='function')fn.call(w,x,y);return;}const p=project(x,y);w.camera.x+=active.canvas.width/2-p.x;w.camera.y+=active.canvas.height/2-p.y;w.manual=true;invalidate();},
   home(){if(!active){const fn=w.home;if(typeof fn==='function')fn.call(w);return;}Object.assign(w.camera,{x:0,y:0,z:1});invalidate();},
   zoom(factor:number){if(!active){const fn=w.zoom;if(typeof fn==='function')fn.call(w,factor);return;}w.camera.z=Math.max(.3,Math.min(3,w.camera.z*factor));invalidate();},
   invalidate,dispose(){if(disposed)return;disposed=true;if(active)cleanup(active);active=null;basic.dispose();}
  };
  const host=new Proxy(methods,{get(target,key){if(key==='rendererId')return active?.id||'basic';if(key==='capabilities')return active?.metadata.capabilities||root.LWRenderers.list()[0]!.capabilities;if(key==='canvas')return active?.canvas||w.canvas;if(key==='mode'&&active)return active.metadata.name;if(key==='setQuality'&&active)return ()=>false;
   if(key in target)return Reflect.get(target,key);const value=w[String(key)];return typeof value==='function'?value.bind(w):value;},set(_target,key,value:unknown){w[String(key)]=value;return true;}});
  playerHost=host as unknown as LittlewildRenderer.Host;if(options.rendererId)selectRenderer(options.rendererId);return host;
 }
 root.LWRendererHost={create,player(){if(!playerHost)throw Error('A browser player host is not mounted.');return playerHost;}};
})(globalThis);
