/// <reference path="./renderer-contracts.d.ts" />
/// <reference path="./renderer-scene-2d.ts" />
/* Scoped scene views share the owning player's draw cadence, never a simulation. */
(function(inputRoot:unknown){
 'use strict';
 type Frame=LittlewildRenderer.Frame;type Instance=LittlewildRenderer.Instance;
 interface Source {frame(options:{time:number;delta:number;running:boolean;alpha:number;camera:LittlewildRenderer.Camera;viewport:LittlewildRenderer.Viewport;presentation:unknown}):Frame;asset(category:'actor'|'building'|'item',id:string):LittlewildRenderer.Value<LittlewildDeveloper.Document>|null;definition(id:string):LittlewildRenderer.Value<LittlewildDeveloper.Document>|null;}
 interface Slot {canvas:HTMLCanvasElement;controller:AbortController;cleanups:(()=>void)[];instance:Instance|null;source:Source;frame:Frame|null;observer:ResizeObserver;disposed:boolean;}
 const root=inputRoot as {LWSceneRendering:{source(engine:unknown,id:string):Source};LWRenderers:LittlewildRenderer.Registry;LWRendererScene2D:LittlewildRenderer2D.Api;LWRendererCompositor?:unknown;};
 function create(container:HTMLElement,engine:unknown,embeds:readonly LWSceneGraph.Embed[],pack:LWContentPorts.ScenarioPack){
  if(embeds.length>4)throw Error('At most four embedded scene views are supported.');
  const slots:Slot[]=[],panels:HTMLElement[]=[],placements:{panel:HTMLElement;anchor:string;width:number;height:number}[]=[];let disposed=false;
  const owner=container.parentElement||container;
  function layout(){
   const rect=owner.getBoundingClientRect(),width=rect.width,height=rect.height;if(!width||!height)return;
   const header=owner.querySelector<HTMLElement>('.world-top')?.getBoundingClientRect(),tools=owner.querySelector<HTMLElement>('.world-tools')?.getBoundingClientRect();
   const roster=width<600?document.getElementById('creature-roster')?.getBoundingClientRect():null;const top=Math.max(64,header&&header.height?header.bottom-rect.top+12:0,roster&&roster.height?roster.bottom-rect.top+12:0),bottom=Math.max(64,tools&&tools.height?rect.bottom-tools.top+12:0),available=Math.max(96,height-top-bottom);
   for(const [index,placement] of placements.entries()){
    let cellWidth:number,cellHeight:number,left:number,offset:number;
    if(width<600){const columns=Math.min(2,placements.length),rows=Math.ceil(placements.length/columns);cellWidth=(width-24-(columns-1)*8)/columns;cellHeight=available/rows;left=12+(index%columns)*(cellWidth+8);offset=top+Math.floor(index/columns)*cellHeight;}
    else{const leftColumn=placement.anchor.endsWith('left'),group=placements.filter(value=>value.anchor.endsWith('left')===leftColumn);cellWidth=Math.min(placement.width,(width-32)/2);cellHeight=available/group.length;left=leftColumn?12:width-cellWidth-12;const same=group.filter(value=>value.anchor===placement.anchor),rank=same.indexOf(placement);offset=placement.anchor.startsWith('top')?top+rank*cellHeight:height-bottom-(rank+1)*cellHeight;}
    const scale=Math.max(.1,Math.min(1,cellWidth/placement.width,(cellHeight-44)/placement.height)),actualWidth=placement.width*scale;
    Object.assign(placement.panel.style,{width:actualWidth+'px',left:Math.max(12,Math.min(width-actualWidth-12,left))+'px',top:offset+'px',bottom:'auto',right:'auto'});
   }
  }
  const layoutObserver=new ResizeObserver(layout);layoutObserver.observe(owner);
  function close(slot:Slot){if(slot.disposed)return;slot.disposed=true;slot.controller.abort();slot.observer.disconnect();try{slot.instance?.dispose();}catch(_){}for(const cleanup of slot.cleanups.splice(0).reverse()){try{cleanup();}catch(_){}}slot.canvas.parentElement?.remove();}
  function draw(time:number,delta:number){for(const slot of slots){if(slot.disposed||!slot.instance)continue;try{const viewport={width:slot.canvas.width,height:slot.canvas.height,pixelRatio:1};slot.frame=slot.source.frame({time,delta,running:false,alpha:1,camera:{x:0,y:0,z:1},viewport,presentation:{embedded:true}});slot.instance.draw(slot.frame);}catch(_){close(slot);}}}
  let cancelled:((result:LittlewildRenderer.SwitchResult)=>void)|null=null;const cancellation=new Promise<LittlewildRenderer.SwitchResult>(resolve=>{cancelled=resolve;});let timeout:ReturnType<typeof setTimeout>|null=null;const expired=new Promise<LittlewildRenderer.SwitchResult>(resolve=>{timeout=setTimeout(()=>{layoutObserver.disconnect();slots.forEach(close);panels.forEach(panel=>panel.remove());resolve({ok:false,reason:"Embedded scene preparation timed out."});},10000);});
  const prepared=Promise.all(embeds.map(async embed=>{
   const target=pack.scenes.find(scene=>scene.id===embed.sceneId),rendering=target?.graph?.rendering;if(!target||rendering?.dimension!=='2d')throw Error('Embedded scene must reference an authored 2d scene.');
   const panel=document.createElement('section'),heading=document.createElement('h2'),canvas=document.createElement('canvas');panel.className='scene-embed scene-embed-'+embed.role;panel.dataset.sceneEmbed=embed.id;heading.textContent=target.name;canvas.setAttribute('aria-label',target.name+' '+embed.role);canvas.dataset.renderer=rendering.rendererId;canvas.width=embed.bounds?.width??(embed.role==='minimap'?240:320);canvas.height=embed.bounds?.height??(embed.role==='minimap'?180:220);
   const anchor=embed.bounds?.anchor??'bottom-right';Object.assign(panel.style,{position:'absolute',zIndex:'3',width:canvas.width+'px',maxWidth:'calc(100% - 24px)',background:'#e8eddf',border:'1px solid #9aa88f',borderRadius:'10px',overflow:'hidden',pointerEvents:'none',[anchor.startsWith('top')?'top':'bottom']:'12px',[anchor.endsWith('left')?'left':'right']:'12px'});Object.assign(heading.style,{font:'600 12px sans-serif',margin:'6px 10px'});Object.assign(canvas.style,{display:'block',width:'100%',height:'auto'});panel.append(heading,canvas);container.append(panel);panels.push(panel);placements.push({panel,anchor,width:canvas.width,height:canvas.height});layout();
   const controller=new AbortController(),cleanups:(()=>void)[]=[],source=root.LWSceneRendering.source(engine,embed.sceneId);
   const initialWidth=canvas.width,initialHeight=canvas.height;const observer=new ResizeObserver(()=>{if(slot.disposed)return;const box=canvas.getBoundingClientRect();if(!box.width)return;canvas.width=Math.round(box.width);canvas.height=Math.round(box.width*initialHeight/initialWidth);try{slot.instance?.resize({width:canvas.width,height:canvas.height,pixelRatio:1});}catch(_){close(slot);}});
   const slot:Slot={canvas,controller,cleanups,source,observer,instance:null,frame:null,disposed:false};slots.push(slot);observer.observe(canvas);
   const frame=()=>{if(slot.disposed)throw Error('Embedded view is disposed.');return slot.source.frame({time:0,delta:0,running:false,alpha:1,camera:{x:0,y:0,z:1},viewport:{width:canvas.width,height:canvas.height,pixelRatio:1},presentation:{embedded:true}});};
   const context:LittlewildRenderer.Context={canvas,signal:controller.signal,query:{frame,buildingInterior:(id:string)=>{const room=frame().room;return room?.buildingId===id?room:null;},asset:(category,id)=>{if(slot.disposed)throw Error('Embedded view is disposed.');return source.asset(category,id);},creatureDefinition:(id:string)=>{if(slot.disposed)throw Error('Embedded view is disposed.');return source.definition(id);}},commands:{submit:()=>({ok:false,code:'unavailable-command',reason:'Embedded views are read-only.',data:null})},onDispose(cleanup){if(controller.signal.aborted)cleanup();else cleanups.push(cleanup);}};
   let instance:Instance;
   if(rendering.rendererId==='basic'){
    const c=canvas.getContext('2d');if(!c)throw Error('Embedded Canvas context is unavailable.');
    const painter:LittlewildRenderer2D.Painter={polygon(points,color,opacity=1){c.globalAlpha=opacity;c.fillStyle=color;c.beginPath();points.forEach((point,index)=>index?c.lineTo(point.x,point.y):c.moveTo(point.x,point.y));c.closePath();c.fill();c.globalAlpha=1;},circle(x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();},text(value,x,y,color,size){c.fillStyle=color;c.font=size+'px sans-serif';c.fillText(value,x,y);}};
    instance={mount(){},resize(){},draw(frame){c.clearRect(0,0,canvas.width,canvas.height);root.LWRendererScene2D.draw(frame,context,painter);},dispose(){}};
   }else instance=await root.LWRenderers.prepare(rendering.rendererId,context);
   if(disposed||slot.disposed){instance.dispose();return;}slot.instance=instance;instance.mount();instance.resize({width:canvas.width,height:canvas.height,pixelRatio:1});slot.frame=frame();instance.draw(slot.frame);
  })).then(()=>({ok:true}),(error:unknown)=>{layoutObserver.disconnect();slots.forEach(close);panels.forEach(panel=>panel.remove());return {ok:false,reason:String(error instanceof Error?error.message:error)};});
  const ready=Promise.race([prepared,expired,cancellation]).then(result=>{if(timeout!==null)clearTimeout(timeout);return result;});
  return {ready,draw,dispose(){if(disposed)return;disposed=true;cancelled?.({ok:false,reason:'Embedded scene preparation was cancelled.'});layoutObserver.disconnect();slots.forEach(close);panels.forEach(panel=>panel.remove());if(timeout!==null)clearTimeout(timeout);},get canvases(){return slots.filter(slot=>!slot.disposed).map(slot=>slot.canvas);}};
 }
 root.LWRendererCompositor={create};
})(globalThis);
