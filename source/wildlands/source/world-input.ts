/* Pointer ownership for the 3D view. A camera gesture never becomes a job.
 * The simulation is not consulted or mutated except the existing follow preference. */
(function(root){'use strict';
 function bind(w){
  const controller=new AbortController();const on=(target,name,fn,options={})=>target.addEventListener(name,fn,{...options,signal:controller.signal});
  const el=w.canvas,pointers=new Map();let drag=null,pinch=null,hold=null,consumed=false,suppressMenuUntil=0;
  const local=e=>{const r=el.getBoundingClientRect();return{x:(e.clientX-r.left)*el.width/r.width,y:(e.clientY-r.top)*el.height/r.height};};
  const stopHold=()=>{if(hold!==null)clearTimeout(hold);hold=null;};
  const invalidate=()=>{w.lastDrawAt=0;w.invalidate?.();};
  const pan=()=>{w.manual=true;w.handlers.pan?.();w.engine.s.settings.follow=false;invalidate();};
  const context=(p,source,explicitTile=null)=>{stopHold();consumed=true;w.hover=explicitTile||w.toTile(p.x,p.y);w.keyboardTile={x:w.hover.x,y:w.hover.y};w.handlers.context?.(w.hover,p,source);invalidate();};
  on(el,'pointerdown',e=>{
   if(e.button>2||w.handlers.blocked?.())return;
   stopHold();el.focus({preventScroll:true});try{el.setPointerCapture(e.pointerId);}catch(_){}
   const p=local(e);pointers.set(e.pointerId,p);
   if(pointers.size===1){consumed=false;drag={...p,cx:w.camera.x,cy:w.camera.y,button:e.button,moved:false};w.drag=drag;
    if(e.pointerType==='touch')hold=setTimeout(()=>{if(pointers.size===1&&drag&&!drag.moved){context(p,'touch');drag=null;w.drag=null;}},550);
   }else{consumed=true;drag=null;w.drag=null;const[a,b]=[...pointers.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};pan();}
  });
  on(el,'pointermove',e=>{
   const p=local(e);w.hover=(w.placement||w.terraformMode)?w.toTile(p.x,p.y):w.hitTest(p.x,p.y);
   if(!pointers.size){w.keyboardTile=null;invalidate();return;}
   if(pointers.has(e.pointerId))pointers.set(e.pointerId,p);
   if(pointers.size>1){stopHold();const[a,b]=[...pointers.values()],n={d:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    if(pinch?.d>0){w.zoomAt(n.d/pinch.d,pinch.x,pinch.y);w.camera.x+=n.x-pinch.x;w.camera.y+=n.y-pinch.y;w.limitCamera();}pinch=n;pan();return;}
   if(drag){const dx=p.x-drag.x,dy=p.y-drag.y;if(Math.hypot(dx,dy)>7){drag.moved=true;stopHold();}if(drag.moved){w.camera.x=drag.cx+dx;w.camera.y=drag.cy+dy;w.limitCamera();pan();}}
  });
  function finish(e){
   stopHold();const d=drag,p=local(e);if(d?.button===2){suppressMenuUntil=performance.now()+450;}
   if(e.type==='pointerup'&&d&&!d.moved&&!consumed){
    if(d.button===2)context(p,'mouse');else if(d.button===0){const tile=(w.placement||w.terraformMode)?w.toTile(p.x,p.y):w.hitTest(p.x,p.y);w.keyboardTile={x:tile.x,y:tile.y};if(w.placement)w.handlers.place?.(w.placement,tile);else w.handlers.inspect?.(tile);}
   }
   pointers.delete(e.pointerId);drag=null;w.drag=null;pinch=null;
   if(pointers.size===1){const p=[...pointers.values()][0];drag={...p,cx:w.camera.x,cy:w.camera.y,button:0,moved:true};w.drag=drag;consumed=true;}
   invalidate();
  }
  on(el,'pointerup',finish);on(el,'pointercancel',finish);
  on(el,'lostpointercapture',e=>{if(pointers.has(e.pointerId))finish(e);});
  on(el,'pointerleave',()=>{if(!pointers.size){stopHold();w.hover=null;invalidate();}});
  on(el,'contextmenu',e=>{e.preventDefault();if(performance.now()<suppressMenuUntil||w.handlers.blocked?.())return;
   // Native contextmenu may fire before the right-button release on some platforms.
   const p=e.clientX||e.clientY?local(e):w.toScreen((w.keyboardTile||w.hover||{x:9,y:9}).x,(w.keyboardTile||w.hover||{x:9,y:9}).y);
   if(drag?.moved)return;context(p,'native');suppressMenuUntil=performance.now()+450;
  });
  on(el,'wheel',e=>{e.preventDefault();stopHold();consumed=true;pan();const p=local(e);w.zoomAt(Math.exp(Math.max(-.4,Math.min(.4,-e.deltaY*.0018))),p.x,p.y);},{passive:false});
  on(el,'keydown',e=>{
   if(e.ctrlKey||e.metaKey||e.altKey)return;
   if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();e.stopImmediatePropagation();const tile=w.keyboardTile||w.hover||w.toTile(el.width/2,el.height/2);context(w.toScreen(tile.x,tile.y),'keyboard',tile);return;}
   const dirs={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
   if(dirs[e.key]){e.preventDefault();e.stopPropagation();const[dx,dy]=dirs[e.key];
    if(w.placement||e.shiftKey){const t=w.keyboardTile||w.hover||w.toTile(el.width/2,el.height/2);w.keyboardTile={x:t.x+dx,y:t.y+dy};w.hover={...w.keyboardTile};const p=w.toScreen(w.hover.x,w.hover.y);if(p.x<60||p.x>el.width-60||p.y<130||p.y>el.height-120)w.focus(w.hover.x,w.hover.y);w.handlers.cursor?.(w.hover);}
    else{w.camera.x-=dx*35;w.camera.y-=dy*35;pan();w.limitCamera();}invalidate();
   }else if(e.key==='Enter'){e.preventDefault();const t=w.keyboardTile||w.hover||w.toTile(el.width/2,el.height/2);if(w.placement)w.handlers.place?.(w.placement,t);else context(w.toScreen(t.x,t.y),'keyboard',t);}
   else if(['+','=','-'].includes(e.key)){e.preventDefault();pan();w.zoom(e.key==='-'?1/1.15:1.15);}
   else if(e.key.toLowerCase()==='h'){e.preventDefault();pan();w.home();}
  });
  const cancel=()=>{stopHold();pointers.clear();drag=null;w.drag=null;pinch=null;consumed=true;};
  on(root,'blur',cancel);on(document,'visibilitychange',()=>{if(document.hidden)cancel();});
  return{cancel,dispose(){cancel();controller.abort();}};
 }
 root.LWWorldInput={bind};
})(typeof globalThis!=='undefined'?globalThis:this);
