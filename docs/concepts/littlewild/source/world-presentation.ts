/* Frame-coherent world presentation. No gameplay state, random numbers or timers.
 * Positions are interpolated ONLY between two observed fixed-step samples. Labels,
 * selection, hit tests and context links all consume the resulting rendered anchor.
 * DOM geometry is observed on resize, not read back after per-frame style writes.
 */
(function(root){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function point(c){return {x:c.creature.x,z:c.creature.y,walk:c.task?.phase==='walk',kind:c.task?.kind||'',away:!!c.activeQuest};}
 class MotionSamples {
  constructor(){this.pairs=new Map();this.before=new Map();this.revision=0;}
  begin(creatures){this.before.clear();for(const c of creatures)this.before.set(c.id,point(c));}
  end(creatures,time){this.pairs.clear();for(const c of creatures){const b=point(c),a=this.before.get(c.id)||b;this.pairs.set(c.id,{a,b,time});}this.revision++;}
  sample(c,time,alpha=1,running=true){const p=this.pairs.get(c.id),b=point(c);
   // New tasks, teleportation, external advance/import and quest transitions snap.
   if(!p||p.time!==time||p.b.x!==b.x||p.b.z!==b.z||!running||!p.a.walk||!b.walk||p.a.kind!==b.kind||p.a.away!==b.away||Math.hypot(p.a.x-b.x,p.a.z-b.z)>.8)return {x:b.x,z:b.z};
   const t=clamp(Number.isFinite(alpha)?alpha:1,0,1);return {x:p.a.x+(b.x-p.a.x)*t,z:p.a.z+(b.z-p.a.z)*t};
  }
  reset(){this.pairs.clear();this.before.clear();this.revision++;}
 }
 class FramePacer {
  constructor(fps=30){if(!Number.isFinite(fps)||fps<1||fps>240)throw Error('Invalid presentation cadence');this.interval=1000/fps;this.next=null;}
  due(now,force=false){if(!Number.isFinite(now))return false;if(force||this.next===null){this.next=now+this.interval;return true;}if(now+.01<this.next)return false;
   this.next+=Math.max(1,Math.floor((now-this.next+.01)/this.interval)+1)*this.interval;return true;
  }
  reset(){this.next=null;}
 }
 function visibleAnchor(p,width,height){return !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=8&&p.x<=width-8&&p.y>=36&&p.y<=height-12;}
 function placeLabels(entries,width,height){
  // Greedy placement is intentionally bounded by the six-creature population.
  // A chosen lane is retained until it conflicts: adjacent companions cannot
  // continuously swap label lanes as their depth order changes.
  const used=[],out=[];
  const sorted=entries.slice().sort((a,b)=>(b.focused?1:0)-(a.focused?1:0)||(b.selected?1:0)-(a.selected?1:0)||a.id.localeCompare(b.id));
  for(const e of sorted){if(!visibleAnchor(e.anchor,width,height)){out.push({...e,hidden:true});continue;}
   const w=Math.min(e.width,width-16),h=e.height,x=clamp(e.anchor.x,w/2+8,width-w/2-8);
   const preferred=Number.isInteger(e.lane)?e.lane:0,lanes=[preferred,...[0,1,2,3,4,5].filter(n=>n!==preferred)];let row=null;
   for(const lane of lanes){const bottom=e.anchor.y-lane*(h+10),top=bottom-h;if(top<6)continue;const r={left:x-w/2-4,right:x+w/2+4,top:top-4,bottom:bottom+4};
    if(!used.some(q=>r.left<q.right&&r.right>q.left&&r.top<q.bottom&&r.bottom>q.top)){row={...e,x,y:bottom,lane,hidden:false,stem:lane*(h+10)+5};used.push(r);break;}}
   // A selected/focused label is never dropped solely because a crowd is dense.
   if(!row&&(e.selected||e.focused)){row={...e,x,y:Math.max(h+6,e.anchor.y),lane:0,hidden:false,stem:5};used.push({left:x-w/2-4,right:x+w/2+4,top:row.y-h-4,bottom:row.y+4});}
   out.push(row||{...e,hidden:true});
  }return out;
 }
 function setAttribute(el,key,value){value=String(value);if(el.getAttribute(key)!==value){el.setAttribute(key,value);return 1;}return 0;}
 class Labels {
  constructor(container,onSelect){this.container=container;this.onSelect=onSelect;this.nodes=new Map();this.records=new Map();this.stats={frames:0,created:0,removed:0,positionWrites:0,contentWrites:0,measurements:0,visible:0,hidden:0,lastMs:0};
   this.observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(entries=>{for(const e of entries){const r=this.records.get(e.target.dataset.actor);if(!r)continue;const s=e.borderBoxSize?.[0];r.width=s?.inlineSize||e.contentRect.width+20;r.height=s?.blockSize||e.contentRect.height+12;this.stats.measurements++;}}):null;
  }
  ensure(id){let r=this.records.get(id);if(r)return r;const b=document.createElement('button');b.type='button';b.className='v10-creature-label v14-creature-label';b.dataset.actor=id;b.hidden=true;
   const text=document.createElement('span');b.appendChild(text);b.addEventListener('pointerdown',e=>e.stopPropagation());b.addEventListener('click',()=>this.onSelect(id));
   this.container.appendChild(b);r={id,element:b,text,width:80,height:30,lane:0,transform:'',caption:''};this.records.set(id,r);this.nodes.set(id,b);this.observer?.observe(b);this.stats.created++;return r;
  }
  paint(entries,width,height,zoom=1){const start=typeof performance!=='undefined'?performance.now():0,live=new Set(entries.map(e=>e.id));this.stats.frames++;this.stats.visible=0;this.stats.hidden=0;
   for(const[id,r]of this.records)if(!live.has(id)){this.observer?.unobserve(r.element);r.element.remove();this.records.delete(id);this.nodes.delete(id);this.stats.removed++;}
   const viewportKey=width+','+height+','+zoom;if(this.viewportKey!==viewportKey){for(const r of this.records.values())r.lane=0;this.viewportKey=viewportKey;}
   const layouts=[];for(const e of entries){const r=this.ensure(e.id),b=r.element;if(r.caption!==e.caption){r.text.textContent=e.caption;r.caption=e.caption;r.width=Math.max(44,Math.min(216,e.caption.length*6.8+20));this.stats.contentWrites++;}
    this.stats.contentWrites+=setAttribute(b,'aria-label',e.accessible||e.caption)+setAttribute(b,'aria-pressed',!!e.selected);
    if(b.title!==e.title){b.title=e.title;this.stats.contentWrites++;}if(b.classList.contains('selected')!==!!e.selected)b.classList.toggle('selected',!!e.selected);
    layouts.push({...e,width:r.width,height:r.height,lane:r.lane,focused:document.activeElement===b});}
   for(const row of placeLabels(layouts,width,height)){const r=this.records.get(row.id),b=r.element,hide=row.away||row.hidden;if(b.hidden!==!!hide)b.hidden=!!hide;
    if(hide){this.stats.hidden++;continue;}this.stats.visible++;r.lane=row.lane;const transform=`translate3d(${row.x.toFixed(2)}px,${row.y.toFixed(2)}px,0) translate(-50%,-100%)`;
    if(r.transform!==transform){b.style.transform=transform;r.transform=transform;this.stats.positionWrites++;}
    const stem=row.stem+'px';if(r.stem!==stem){b.style.setProperty('--label-stem',stem);r.stem=stem;}const z=row.selected?'3':row.focused?'4':'1';if(b.style.zIndex!==z)b.style.zIndex=z;
   }this.stats.lastMs=typeof performance!=='undefined'?performance.now()-start:0;
  }
  clear(){this.observer?.disconnect();for(const r of this.records.values())r.element.remove();this.stats.removed+=this.records.size;this.records.clear();this.nodes.clear();}
  diagnostics(){return {...this.stats,nodes:this.nodes.size,lastMs:+this.stats.lastMs.toFixed(3)};}
 }
 // In-place reconciliation for a live context card. It does not replace canvases,
 // focused buttons, text inputs, or a native select while values update.
 function patchElement(current,next){
  if(current.nodeType===3){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
  if(current.nodeType!==1)return;
  for(const a of [...current.attributes])if(!next.hasAttribute(a.name))current.removeAttribute(a.name);
  for(const a of [...next.attributes])if(current.getAttribute(a.name)!==a.value)current.setAttribute(a.name,a.value);
  if(current.tagName==='CANVAS'||current.tagName==='INPUT'||current.tagName==='SELECT'&&document.activeElement===current)return;
  patchChildren(current,next);
 }
 function same(a,b){return a&&a.nodeType===b.nodeType&&(a.nodeType!==1||(a.tagName===b.tagName&&a.id===b.id&&a.getAttribute('data-act')===b.getAttribute('data-act')&&a.getAttribute('data-id')===b.getAttribute('data-id')));}
 function patchChildren(current,next){let i=0;for(const b of [...next.childNodes]){let a=current.childNodes[i];if(same(a,b)){patchElement(a,b);i++;continue;}let found=[...current.childNodes].slice(i+1).find(n=>same(n,b));if(found){current.insertBefore(found,a||null);patchElement(found,b);}else current.insertBefore(b.cloneNode(true),a||null);i++;}while(current.childNodes.length>i)current.lastChild.remove();}
 function reconcile(element,html){const template=document.createElement('template');template.innerHTML=html;patchChildren(element,template.content);}
 const api={MotionSamples,FramePacer,Labels,placeLabels,visibleAnchor,reconcile,setAttribute};root.LWPresentation=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
