/// <reference path="./rts-demo-contracts.d.ts" />
/** Detached RTS presentation: commands are intentions, application controls the clock. */
(function(input:unknown){
 'use strict';
 const root=input as {LWRTSDemo?:LWRTSDemo.Api;LWRTSRenderer:LWRTSDemo.RendererApi};
 const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
 function create(host:LWRTSDemo.Host):LWRTSDemo.Surface {
  const workspace=document.createElement('section');workspace.id='rts-demo';workspace.setAttribute('aria-label','Frontier command RTS demonstration');
  workspace.innerHTML=`<header class="rts-header"><div><h1>Frontier command</h1></div><div class="rts-time"><button type="button" data-rts="pause">Pause</button><label>Speed <select data-rts="speed"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label><button type="button" data-rts="restart">Restart mission</button><button type="button" data-rts="exit">Return to colony</button></div></header><div class="rts-resources" aria-label="Faction resources"></div><div class="rts-layout"><div class="rts-field"><div class="rts-map-label"><span>Frontier valley</span><span data-rts-clock></span></div><canvas class="rts-world" tabindex="0" aria-label="Isometric battlefield. Select with click or drag, then right click to give orders. Arrow keys move selected units, S stops, Escape cancels placement."></canvas><div class="rts-drag" hidden></div><div class="rts-map-tools"><button type="button" data-rts="zoom-out" aria-label="Zoom out">−</button><button type="button" data-rts="zoom-reset">Fit map</button><button type="button" data-rts="zoom-in" aria-label="Zoom in">+</button></div><p class="rts-status" role="status" aria-live="polite">Select workers, gather supplies, and build your frontier.</p></div><aside class="rts-inspector"><canvas class="rts-minimap" width="220" height="150" tabindex="0" role="button" aria-label="Battlefield minimap. Click to center the camera on terrain; Enter centers your selection."></canvas><div class="rts-selection"></div><div class="rts-actions"></div><form class="rts-command-form" aria-label="Order target and position"><h3 data-rts-pending>Choose an order</h3><label>Visible target <select data-rts-target><option value="">Terrain / position</option></select></label><div class="rts-coordinates"><label>Tile X <input data-rts-x type="number" min="0" step="1" required value="0"></label><label>Tile Y <input data-rts-y type="number" min="0" step="1" required value="0"></label></div><button type="submit" data-rts-apply disabled>Apply selected order</button><p class="rts-small" data-rts-order-help>Choose your units and an order first.</p></form><details><summary>Units &amp; visible targets</summary><div class="rts-roster"></div></details><details open><summary>Mission objectives</summary><div class="rts-objectives"></div></details><details><summary>How to command</summary><p>Click a unit or drag a group. Shift adds to your selection. Right click terrain to move, a deposit to gather, or a rival to attack.</p><p>On touch screens, choose an order below, then tap the map. Build with selected workers; select a completed building to train units or research technology.</p><p>Keyboard: open Units &amp; visible targets and select your unit. Choose an order, construction, or ability, then choose a Visible target or enter Tile X and Tile Y. Press Apply selected order. Choosing a target fills its position without changing your selected units. Clear the target to use terrain coordinates.</p><p>Mouse wheel zooms. Arrow keys move the selection. S stops. Escape cancels. Pause and speed controls change application time.</p></details><details><summary>Engine field guide</summary><div class="rts-features"></div></details></aside></div><footer class="rts-footer"><div class="rts-orders" aria-label="Unit orders"></div><div class="rts-log" aria-label="Recent battlefield events"></div></footer>`;
  (host.parent||document.body).append(workspace);
  const canvas=workspace.querySelector<HTMLCanvasElement>('.rts-world')!,minimap=workspace.querySelector<HTMLCanvasElement>('.rts-minimap')!,renderer=root.LWRTSRenderer.create(canvas);
  const selection=workspace.querySelector<HTMLElement>('.rts-selection')!,actions=workspace.querySelector<HTMLElement>('.rts-actions')!,resources=workspace.querySelector<HTMLElement>('.rts-resources')!,status=workspace.querySelector<HTMLElement>('.rts-status')!,drag=workspace.querySelector<HTMLElement>('.rts-drag')!;
  const commandForm=workspace.querySelector<HTMLFormElement>('.rts-command-form')!,targetSelect=workspace.querySelector<HTMLSelectElement>('[data-rts-target]')!,positionX=workspace.querySelector<HTMLInputElement>('[data-rts-x]')!,positionY=workspace.querySelector<HTMLInputElement>('[data-rts-y]')!;
  let snapshot=host.query(),selected:string[]=[],placement:string|null=null,mode:string|null=null,hover:LWRTSDemo.Point|null=null,down:LWRTSDemo.Point|null=null,pointerId:number|null=null,shift=false,signature='',rosterSignature='',disposed=false;
  const faction=()=>snapshot.playerFaction||snapshot.catalog.missions[0]?.playerFaction||snapshot.factions[0]?.id||'player';
  const selectedEntities=()=>snapshot.entities.filter(value=>selected.includes(value.id));
  const name=(entity:LWRTSDemo.Entity)=>snapshot.catalog.units.find(row=>row.id===entity.definition)?.name||snapshot.catalog.buildings.find(row=>row.id===entity.definition)?.name||snapshot.catalog.resources.find(row=>row.id===(entity.resource||entity.definition))?.name||entity.definition;
  function feedback(text:string,error=false):void {status.textContent=text;status.classList.toggle('is-error',error);}
  function send(kind:string,extra:Partial<LWRTSDemo.Intent>={}):void {
   const result=host.command({kind,faction:faction(),entities:[...selected],...extra});
   feedback(result.ok?(kind==='build'?'Construction ordered.':kind==='train'?'Production queued.':kind==='research'?'Research queued.':kind+' order accepted.'):(result.reason||'This order is unavailable.'),!result.ok);
   refresh();
  }
  const cost=(value:LWRTSData.Cost)=>Object.entries(value).map(([id,count])=>count+' '+(snapshot.catalog.resources.find(row=>row.id===id)?.name||id)).join(' · ')||'Free';
  function button(label:string,kind:string,id='',disabledReason=''):string {return `<button type="button" data-rts="${kind}" data-definition="${escape(id)}" ${disabledReason?'disabled aria-label="'+escape(label+'. '+disabledReason)+'"':''} title="${escape(disabledReason)}">${escape(label)}${disabledReason?'<small class="rts-disabled-reason">'+escape(disabledReason)+'</small>':''}</button>`;}
  function available(value:LWRTSData.Cost):string {
   const own=snapshot.factions.find(row=>row.id===faction());
   return Object.entries(value).some(([id,n])=>(own?.resources[id]||0)<n)?'Insufficient resources: '+cost(value):'';
  }
  function presentActions():void {
   const values=selectedEntities(),friendly=values.filter(value=>value.faction===faction()),worker=friendly.some(value=>snapshot.catalog.units.find(row=>row.id===value.definition)?.role==='worker');
   selection.innerHTML=values.length?`<h2>${values.length===1?escape(name(values[0]!)):values.length+' entities selected'}</h2>${values.slice(0,6).map(value=>`<div class="rts-unit-row"><span>${escape(name(value))}</span><small>${value.category==='resource'?(value.remaining||0)+' remaining':Math.ceil(value.hp)+' / '+value.maxHp+' HP'}</small></div>`).join('')}${values.length===1?`<p>${escape(snapshot.catalog.units.find(row=>row.id===values[0]!.definition)?.description||snapshot.catalog.buildings.find(row=>row.id===values[0]!.definition)?.description||'Select your own units to give commands.')}</p><p class="rts-small">Order: ${escape(typeof values[0]!.order==='string'?values[0]!.order:JSON.stringify(values[0]!.order||'idle'))}</p>`:''}`:`<h2>Every unit has a role.</h2><p>Select a worker to gather and build. Select your headquarters to train a force.</p>`;
   let html='';
   if(worker)html+=`<h3>Construct</h3><div class="rts-action-grid">${snapshot.catalog.buildings.filter(row=>snapshot.catalog.factions.find(value=>value.id===faction())?.buildings.includes(row.id)).map(row=>button(row.name+' · '+cost(row.cost),'build',row.id,available(row.cost))).join('')}</div>`;
   for(const entity of friendly){const building=snapshot.catalog.buildings.find(row=>row.id===entity.definition);if(!building)continue;
    if(entity.complete===false){html+='<p>Construction in progress. Assign more workers with Repair / build.</p>';continue;}
    const queue=(entity.queue||[]) as {definitionId:string;remaining:number;total:number}[];
    if(queue.length)html+=`<h3>Queue · ${queue.length}</h3>${queue.map((entry,index)=>`<div class="rts-queue-row"><span>${escape(snapshot.catalog.units.find(row=>row.id===entry.definitionId)?.name||snapshot.catalog.technologies.find(row=>row.id===entry.definitionId)?.name||entry.definitionId)}<small>${Math.ceil(entry.remaining)}s remaining</small></span>${button('Cancel','cancel',entity.id+':'+index)}</div>`).join('')}`;
    html+=`<h3>${escape(building.name)} production</h3><div class="rts-action-grid">${building.produces.map(id=>{const row=snapshot.catalog.units.find(value=>value.id===id);return row?button(row.name+' · '+cost(row.cost),'train',id,available(row.cost)):'';}).join('')}</div>`;
    html+=building.researches.length?`<h3>Research</h3><div class="rts-action-grid">${building.researches.map(id=>{const row=snapshot.catalog.technologies.find(value=>value.id===id),own=snapshot.factions.find(value=>value.id===faction());return row?button(row.name+' · '+cost(row.cost),'research',id,own?.technologies.includes(id)?'Already researched':row.prerequisites.some(value=>!own?.technologies.includes(value))?'Research prerequisites first':available(row.cost)):'';}).join('')}</div>`:'';
   }
   if(friendly.length===1&&snapshot.catalog.units.some(value=>value.id===friendly[0]!.definition))html+=`<h3>Buy supplies</h3><div class="rts-action-grid">${snapshot.catalog.items.map(value=>button(value.name+' · '+cost(value.cost),'purchase',value.id,available(value.cost))).join('')}</div>`;
   const abilities=[...new Set(friendly.flatMap(value=>[...(snapshot.catalog.units.find(row=>row.id===value.definition)?.abilities||[]),...Object.keys(value.inventory||{}).flatMap(id=>{const item=snapshot.catalog.items.find(row=>row.id===id);return item?[item.ability]:[];})]))];
   for(const value of friendly)if(Object.keys(value.inventory||{}).length)html+=`<h3>Carried items</h3><p>${Object.entries(value.inventory||{}).map(([id,charges])=>escape(snapshot.catalog.items.find(row=>row.id===id)?.name||id)+' · '+charges+' charges').join('<br>')}</p>`;
   html+=button('Pick up / use item','order','interact',friendly.length?'':'Select your units first');
   if(abilities.length)html+=`<h3>Abilities</h3>${abilities.map(id=>button(snapshot.catalog.abilities.find(row=>row.id===id)?.name||id,'ability',id)).join('')}`;
   actions.innerHTML=html;
   workspace.querySelector<HTMLElement>('.rts-orders')!.innerHTML=['move','attackMove','attack','gather','repair','stop'].map(kind=>button(({move:'Move',attackMove:'Attack move',attack:'Attack',gather:'Gather',repair:'Repair / build',stop:'Stop'} as Record<string,string>)[kind]!,'order',kind,friendly.length?'':'Select your units first')).join('')+button('Clear selection','clear');
  }
  function presentOrder():void {
   const pending=placement?'Build '+(snapshot.catalog.buildings.find(row=>row.id===placement)?.name||placement):mode?.startsWith('ability:')?(snapshot.catalog.abilities.find(row=>row.id===mode!.slice(8))?.name||mode):mode||'Choose an order';
   const friendly=selectedEntities().some(value=>value.faction===faction());
   workspace.querySelector<HTMLElement>('[data-rts-pending]')!.textContent=pending;
   workspace.querySelector<HTMLButtonElement>('[data-rts-apply]')!.disabled=!friendly||(!placement&&!mode);
   workspace.querySelector<HTMLElement>('[data-rts-order-help]')!.textContent=!friendly?'Select your own units first.':!placement&&!mode?'Choose an order, construction, or ability first.':'Choose a visible target or clear it and enter a tile position. Application rules validate the order.';
   positionX.max=String(snapshot.map.width-1);positionY.max=String(snapshot.map.height-1);
  }
  function refresh():void {
   if(disposed)return;snapshot=host.query();selected=selected.filter(id=>snapshot.entities.some(value=>value.id===id));
   const own=snapshot.factions.find(value=>value.id===faction());
   resources.innerHTML=snapshot.catalog.resources.map(row=>`<span><i style="background:${escape(row.color)}"></i>${escape(row.name)} <b>${Math.floor(own?.resources[row.id]||0)}</b></span>`).join('')+`<span>Population <b>${own?.population||0} / ${own?.populationCap||0}</b></span><span>Power <b>${own?.power||0}</b></span>`;
   workspace.querySelector<HTMLElement>('[data-rts-clock]')!.textContent='Tick '+snapshot.tick+' · '+(snapshot.status==='running'&&host.paused?.()?'paused':snapshot.status);
   const pause=workspace.querySelector<HTMLButtonElement>('[data-rts="pause"]')!;pause.textContent=host.paused?.()?'Resume':'Pause';
   const nextSignature=JSON.stringify([selected,selectedEntities().map(value=>[value.id,value.hp,value.order,value.complete,value.remaining,JSON.stringify(value.queue),JSON.stringify(value.inventory)]),own?.resources,own?.technologies]);
   if(signature!==nextSignature){
    const focused=workspace.contains(document.activeElement)?document.activeElement as HTMLElement:null;
    const focusIntent=focused?.dataset.rts,focusId=focused?.dataset.definition;signature=nextSignature;presentActions();
    if(focusIntent)Array.from(workspace.querySelectorAll<HTMLButtonElement>('button[data-rts]')).find(value=>value.dataset.rts===focusIntent&&value.dataset.definition===focusId)?.focus({preventScroll:true});
   }
   const roster=snapshot.entities.filter(value=>value.faction===faction()||snapshot.fog.visible.includes(Math.floor(value.y)*snapshot.map.width+Math.floor(value.x))||snapshot.fog.visible.includes(Math.floor(value.x)+','+Math.floor(value.y)));
   const nextRoster=roster.map(value=>value.id).join('|');
   if(nextRoster!==rosterSignature){
    rosterSignature=nextRoster;workspace.querySelector<HTMLElement>('.rts-roster')!.innerHTML=roster.map(value=>button((value.faction===faction()?'Own · ':'Target · ')+name(value),'select',value.id)).join('');
    const targetId=targetSelect.value;targetSelect.innerHTML='<option value="">Terrain / position</option>'+roster.map(value=>`<option value="${escape(value.id)}">${escape((value.faction===faction()?'Own · ':'Target · ')+name(value)+' · '+value.id)}</option>`).join('');
    targetSelect.value=roster.some(value=>value.id===targetId)?targetId:'';
   }
   presentOrder();
   const mission=snapshot.catalog.missions.find(value=>value.id===snapshot.mission)||snapshot.catalog.missions[0];
   workspace.querySelector<HTMLElement>('.rts-objectives')!.innerHTML=`<p>${escape(mission?.description||'Build an economy and command your army.')}</p><ul>${(mission?.objectives||[]).map(value=>`<li>${escape(value.name)}<small>${escape(value.description)}</small></li>`).join('')}</ul>`;
   workspace.querySelector<HTMLElement>('.rts-features')!.innerHTML=`<p>Content defines ${snapshot.catalog.units.length} unit archetypes, ${snapshot.catalog.buildings.length} structures, ${snapshot.catalog.technologies.length} technologies, ${snapshot.catalog.abilities.length} abilities, and ${snapshot.catalog.items.length} items.</p><p>Workers gather and construct. Buildings train units and research. Infantry, cavalry, siege, vehicles, naval units, aircraft, and creatures share the ECS. Terrain movement, sight, fog, projectiles, armor, splash damage, resource costs, population, power, enemy decisions, and mission objectives are engine systems.</p><p>Catalog records are data; the application owns the simulation clock. Inspect the content tools to author another setting.</p>`;
   workspace.querySelector<HTMLElement>('.rts-log')!.textContent=snapshot.events.slice(-3).map(value=>typeof value==='string'?value:value.text||value.message||value.kind||'Event').join(' · ');
   renderer.draw(snapshot,selected,placement,hover);root.LWRTSRenderer.minimap(minimap,snapshot);
  }
  function local(event:PointerEvent|MouseEvent):LWRTSDemo.Point {const rect=canvas.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};}
  function order(point:LWRTSDemo.Point,explicit=false):void {
   const target=renderer.hit(point),friendly=target?.faction===faction();
   if(placement){send('build',{definition:placement,x:Math.floor(point.x),y:Math.floor(point.y)});placement=null;return;}
   if(mode?.startsWith('ability:')){send('ability',{definition:mode.slice(8),ability:mode.slice(8),...(target?{targetId:target.id}:{}),x:point.x,y:point.y});mode=null;return;}
   const kind=mode||(target&&!friendly?(target.category==='resource'||target.category==='deposit'?'gather':target.category==='item'?'interact':'attack'):'move');
   if(!selected.length){feedback('Select your own units before giving an order.',true);return;}
   send(kind,{x:Math.floor(point.x),y:Math.floor(point.y),...(target?{targetId:target.id}:{})});if(explicit)mode=null;
  }
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;down=local(event);pointerId=event.pointerId;shift=event.shiftKey;canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{const point=local(event);hover=renderer.world(point);if(down&&Math.hypot(point.x-down.x,point.y-down.y)>5){drag.hidden=false;drag.style.left=Math.min(point.x,down.x)+'px';drag.style.top=Math.min(point.y,down.y)+30+'px';drag.style.width=Math.abs(point.x-down.x)+'px';drag.style.height=Math.abs(point.y-down.y)+'px';}renderer.draw(snapshot,selected,placement,hover);});
  canvas.addEventListener('pointerup',event=>{
   if(event.pointerId!==pointerId||!down)return;const end=local(event),start=down;down=null;pointerId=null;drag.hidden=true;
   if(Math.hypot(start.x-end.x,start.y-end.y)>5){const ids=snapshot.entities.filter(value=>value.faction===faction()).filter(value=>{const p=renderer.screen(value);return p.x>=Math.min(start.x,end.x)&&p.x<=Math.max(start.x,end.x)&&p.y>=Math.min(start.y,end.y)&&p.y<=Math.max(start.y,end.y);}).map(value=>value.id);selected=shift?[...new Set([...selected,...ids])]:ids;}
   else if(placement||mode)order(renderer.world(end),true);
   else{const target=renderer.hit(renderer.world(end));selected=target?(shift?[...new Set([...selected,target.id])]:[target.id]):[];}
   refresh();
  });
  canvas.addEventListener('pointercancel',()=>{down=null;pointerId=null;drag.hidden=true;});
  canvas.addEventListener('contextmenu',event=>{event.preventDefault();order(renderer.world(local(event)));refresh();});
  canvas.addEventListener('wheel',event=>{event.preventDefault();renderer.zoom(event.deltaY<0?1.1:1/1.1);refresh();},{passive:false});
  canvas.addEventListener('keydown',event=>{
   if(event.key==='Escape'){placement=null;mode=null;feedback('Order cancelled.');refresh();}
   if(event.key.toLowerCase()==='s'){event.preventDefault();send('stop');}
   const offset=({ArrowUp:[0,-2],ArrowDown:[0,2],ArrowLeft:[-2,0],ArrowRight:[2,0]} as Record<string,number[]>)[event.key];
   if(offset&&selected.length){event.preventDefault();const unit=selectedEntities()[0]!;send('move',{x:Math.max(0,Math.min(snapshot.map.width-1,Math.floor(unit.x+offset[0]!))),y:Math.max(0,Math.min(snapshot.map.height-1,Math.floor(unit.y+offset[1]!)))});}
  });
  workspace.addEventListener('click',event=>{
   const button=event.target instanceof Element?event.target.closest<HTMLButtonElement>('button[data-rts]'):null;if(!button||button.disabled)return;
   const kind=button.dataset.rts!,definition=button.dataset.definition!;
   if(kind==='pause')host.control(host.paused?.()?'resume':'pause');
   else if(kind==='exit'||kind==='restart')host.control(kind);
   else if(kind==='select'){selected=[definition];placement=null;mode=null;feedback('Selected '+name(snapshot.entities.find(value=>value.id===definition)!)+'.');}
   else if(kind==='clear'){selected=[];placement=null;mode=null;}
   else if(kind==='zoom-in')renderer.zoom(1.2);else if(kind==='zoom-out')renderer.zoom(1/1.2);else if(kind==='zoom-reset')renderer.reset();
   else if(kind==='build'){placement=definition;mode=null;feedback('Place '+(snapshot.catalog.buildings.find(value=>value.id===definition)?.name||definition)+' on the map. Escape cancels.');}
   else if(kind==='train'||kind==='research'||kind==='purchase')send(kind,{definition});
   else if(kind==='cancel'){const split=definition.lastIndexOf(':');send('cancel',{entities:[definition.slice(0,split)],index:Number(definition.slice(split+1))});}
   else if(kind==='ability'){mode='ability:'+definition;placement=null;feedback('Tap an ability target on the map.');}
   else if(kind==='order'){if(definition==='stop')send('stop');else{mode=definition;placement=null;feedback('Tap the map to issue '+button.textContent+'.');}}
   refresh();
  });
  targetSelect.addEventListener('change',()=>{
   const target=snapshot.entities.find(value=>value.id===targetSelect.value);
   if(target){positionX.value=String(Math.floor(target.x));positionY.value=String(Math.floor(target.y));}
  });
  commandForm.addEventListener('submit',event=>{
   event.preventDefault();if(!mode&&!placement){feedback('Choose an order first.',true);return;}
   const target=snapshot.entities.find(value=>value.id===targetSelect.value),point={x:target?.x??Number(positionX.value),y:target?.y??Number(positionY.value)};
   if(!Number.isFinite(point.x)||!Number.isFinite(point.y)){feedback('Enter a valid tile position.',true);return;}
   if(placement)send('build',{definition:placement,x:Math.floor(point.x),y:Math.floor(point.y)});
   else if(mode?.startsWith('ability:'))send('ability',{definition:mode.slice(8),ability:mode.slice(8),x:point.x,y:point.y,...(target?{targetId:target.id}:{})});
   else send(mode!,{x:Math.floor(point.x),y:Math.floor(point.y),...(target?{targetId:target.id}:{})});
  });
  workspace.querySelector<HTMLSelectElement>('[data-rts="speed"]')!.addEventListener('change',event=>host.control('speed',Number((event.target as HTMLSelectElement).value)));
  minimap.addEventListener('click',event=>{const rect=minimap.getBoundingClientRect();renderer.center({x:(event.clientX-rect.left)/rect.width*snapshot.map.width,y:(event.clientY-rect.top)/rect.height*snapshot.map.height});refresh();});
  minimap.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();const unit=selectedEntities()[0];if(unit)renderer.center(unit);else renderer.reset();refresh();}});
  const resize=new ResizeObserver(()=>refresh());resize.observe(canvas);refresh();
  return {refresh,destroy(){disposed=true;resize.disconnect();workspace.remove();}};
 }
 root.LWRTSDemo={create};
})(typeof window!=='undefined'?window:globalThis);
