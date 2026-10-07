/// <reference path="./construction-contracts.d.ts" />
/* Local draft geometry only. Queries are detached; accepted work is routed to the engine. */
(function(inputRoot:unknown){
 'use strict';
 type Point=LWInterior.Point;
 type Edge=NonNullable<LWInterior.Floor['edges']>[number];
 type Tool='floor'|'wall'|'window'|'door'|'station'|'stairs'|'erase';
 interface Engine {
  constructionOptions():LWConstruction.Options;
  buildingDesign(id:string):LWConstruction.Draft|null;
  previewBuildingDesign(input:unknown,buildingId?:string):LWConstruction.Preview;
  creatures:LWApplication.Actor[];
  selected?:LWApplication.Actor|null;
  dispatchCommand(input:unknown):LWPhysicalPorts.ActionResult;
 }
 interface Host {engine():Engine;esc(value:unknown):string;world():{canvas:HTMLCanvasElement};save():void;toast(message:string,error?:boolean):void;}
 interface Editor {open(buildingId?:string,kind?:string):boolean;close(restore?:boolean):void;reset():void;isOpen():boolean;host:HTMLElement;}
 const root=inputRoot as {LWConstructionEditor?:{create(h:Host):Editor;open(buildingId?:string,kind?:string):boolean}};
 const same=(a:Point,b:Point):boolean=>a.x===b.x&&a.y===b.y;
 const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
 const stationKinds:LWInterior.Station['kind'][]=['workbench','storage','desk','hearth','bed','planter'];
 function freshFloor(id:string,label:string,width=6,height=6):LWInterior.Floor {
  const cells:Point[]=[],edges:Edge[]=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   cells.push({x,y});
   for(const side of ['n','e','s','w'] as const)if(side==='n'&&y===0||side==='e'&&x===width-1||side==='s'&&y===height-1||side==='w'&&x===0)edges.push({x,y,side,kind:side==='s'&&x===2?'door':'wall'});
  }
  return {id,label,width,height,door:{x:2,y:height-1},cells,edges,stairs:[],stations:[]};
 }
 function create(h:Host):Editor {
  const panel=document.createElement('aside'),e=h.esc;
  panel.id='construction-editor';panel.className='world-panel construction-editor';panel.hidden=true;panel.setAttribute('aria-labelledby','construction-editor-title');document.getElementById('app')!.append(panel);
  const state={draft:null as LWConstruction.Draft|null,original:null as LWInterior.Layout|null,buildingId:'',floorId:'ground',tool:'floor' as Tool,side:'s' as Edge['side'],station:'workbench' as LWInterior.Station['kind'],production:true,to:'',actorId:'',x:0,y:0,feedback:'',origin:null as HTMLElement|null};
  let sequence=0,options:LWConstruction.Options={types:[],designs:[],buildings:[]};
  const button=(label:string,action:string,extra=''):string=>`<button type="button" data-design="${action}" ${extra}>${label}</button>`;
  const floor=():LWInterior.Floor=>state.draft!.layout.floors.find(f=>f.id===state.floorId)!;
  const cells=(f:LWInterior.Floor):Point[]=>f.cells||Array.from({length:f.width*f.height},(_,i)=>({x:i%f.width,y:Math.floor(i/f.width)}));
  function draft(kind:string):LWConstruction.Draft {
   const name=options.types.find(t=>t.id===kind)?.name||'Building';
   return {name:`My ${name.toLowerCase()}`,kind,layout:{id:'custom-layout',label:name,floors:[freshFloor('ground','Ground floor')]}};
  }
  function setDraft(value:LWConstruction.Draft):void {state.draft=copy(value);state.floorId=value.layout.floors[0]!.id;state.to=value.layout.floors[1]?.id||'';state.feedback='';}
  function grid():string {
   const f=floor(),occupied=cells(f);
   return `<div class="design-grid-scroll"><div class="design-grid" style="--design-columns:${f.width}" role="group" aria-label="${e(f.label)} tiles">${Array.from({length:f.width*f.height},(_,i)=>{
    const p={x:i%f.width,y:Math.floor(i/f.width)},has=occupied.some(c=>same(c,p)),station=f.stations.find(s=>same(s,p)),stair=f.stairs.find(s=>same(s,p)),edges=(f.edges||[]).filter(edge=>same(edge,p));
    const content=station?e(station.kind.slice(0,4)):stair?'Stair':same(f.door,p)?'Entry':'';
    const label=`Tile ${p.x+1}, ${p.y+1}: ${has?'floor':'empty'}${station?', '+station.label:''}${stair?', stairs to '+stair.to:''}${same(f.door,p)?', entrance':''}${edges.length?', '+edges.map(edge=>edge.side+' '+edge.kind).join(', '):''}`;
    return `<button type="button" data-cell="${p.x},${p.y}" class="design-cell ${has?'has-floor':''} ${station?'has-station':''}" aria-label="${e(label)}"><span>${content}</span>${edges.map(edge=>`<i class="design-edge edge-${edge.side} edge-${edge.kind}" aria-hidden="true"></i>`).join('')}</button>`;
   }).join('')}</div></div>`;
  }
  function site(preview:LWConstruction.Preview):string {
   if(state.buildingId)return '<p class="panel-hint">This improvement keeps the building’s map location. Work finishes before the new layout opens.</p>';
   const footprint=preview.ok?preview.design.footprint:[];
   return `<section class="panel-section"><h3>Place on the world map</h3><p class="panel-hint">Choose an entrance tile. The outlined footprint extends east and north. Check the ground on the world map; placement is validated when you send the plan.</p><div class="design-pair"><label>World X<input id="design-x" type="number" step="1" value="${state.x}"></label><label>World Y<input id="design-y" type="number" step="1" value="${state.y}"></label></div><div class="design-site" role="group" aria-label="World tile placement preview">${Array.from({length:49},(_,i)=>{
    const x=state.x+i%7-3,y=state.y-3+Math.floor(i/7),anchor=x===state.x&&y===state.y,covered=footprint.some(p=>p.x===x-state.x&&p.y===y-state.y);
    return `<button type="button" data-site="${x},${y}" class="${covered?'footprint':''}" aria-pressed="${anchor}" aria-label="World tile ${x}, ${y}${anchor?', entrance':''}${covered?', footprint':''}">${anchor?'Entry':`${x},${y}`}</button>`;
   }).join('')}</div></section>`;
  }
  function render(focus=''):void {
   if(!state.draft)return;
   const f=floor(),original=state.original?.floors.find(item=>item.id===f.id),preview=h.engine().previewBuildingDesign(copy(state.draft),state.buildingId||undefined),actors=h.engine().creatures;
   const actor=actors.find(a=>a.id===state.actorId),blocked=!preview.ok?preview.reason:!actor?'Choose a builder.':actor.activeQuest?'This companion is away. Choose a builder at home.':'';
   const scroll=panel.querySelector('.panel-body')?.scrollTop||0;
   panel.innerHTML=`<header class="panel-header"><div><h2 id="construction-editor-title" tabindex="-1">${state.buildingId?'Improve a building':'Design a building'}</h2></div>${button('Close','close','aria-label="Close building designer" class="text-button"')}</header><div class="panel-body">
    <p class="panel-hint">${state.buildingId?'Keep existing rooms and connections. Add supported floors, new stations, walls or windows.':'Paint a floor plan, fit its rooms, then give your companion the construction work.'} Closing keeps this draft.</p>
    <div class="design-pair"><label>Design name<input id="design-name" maxlength="80" value="${e(state.draft.name)}"></label><label>Building type<select id="design-kind" ${state.buildingId?'disabled':''}>${options.types.map(t=>`<option value="${e(t.id)}" ${t.id===state.draft!.kind?'selected':''}>${e(t.name)}</option>`).join('')}</select></label></div>
    ${options.designs.length&&!state.buildingId?`<label>Reuse a saved design<select id="design-reuse"><option value="">Choose a design…</option>${options.designs.map(d=>`<option value="${e(d.id)}">${e(d.name)}</option>`).join('')}</select></label>`:''}
    <section class="panel-section"><h3>Floor plan</h3><div class="design-floor-tabs" role="group" aria-label="Floors">${state.draft.layout.floors.map(item=>button(e(item.label),'floor',`data-floor="${e(item.id)}" aria-pressed="${item.id===f.id}"`)).join('')}${button('Add floor','add',state.draft.layout.floors.length>=8?'disabled title="Eight floors is the maximum"':'')}</div>
    <div class="design-pair"><label>Floor name<input id="design-floor-label" maxlength="80" value="${e(f.label)}"></label><label>Floor size<span class="design-size"><input id="design-width" aria-label="Floor width" type="number" min="4" max="20" value="${f.width}" ${original?'disabled title="Existing floor dimensions stay supported"':''}><span>×</span><input id="design-height" aria-label="Floor height" type="number" min="4" max="20" value="${f.height}" ${original?'disabled title="Existing entrances stay in place"':''}></span></label></div>
    <div class="design-tools" role="group" aria-label="Drawing tools">${(['floor','wall','window','door','station','stairs','erase'] as Tool[]).map(tool=>button(tool[0]!.toUpperCase()+tool.slice(1),'tool',`data-tool="${tool}" aria-pressed="${tool===state.tool}"`)).join('')}</div>
    ${['wall','window','door','erase'].includes(state.tool)?`<label>Tile edge<select id="design-side">${(['n','e','s','w'] as const).map((side,i)=>`<option value="${side}" ${state.side===side?'selected':''}>${['North','East','South','West'][i]}</option>`).join('')}</select></label>`:''}
    ${state.tool==='station'?`<div class="design-pair"><label>Station kind<select id="design-station">${stationKinds.map(kind=>`<option value="${kind}" ${state.station===kind?'selected':''}>${kind[0]!.toUpperCase()+kind.slice(1)}</option>`).join('')}</select></label><label class="design-check"><input id="design-production" type="checkbox" ${state.production?'checked':''}>Production station</label></div>`:''}
    ${state.tool==='stairs'?`<label>Connect to floor<select id="design-stairs"><option value="">Choose another floor…</option>${state.draft.layout.floors.filter(item=>item.id!==f.id).map(item=>`<option value="${e(item.id)}" ${state.to===item.id?'selected':''}>${e(item.label)}</option>`).join('')}</select></label>`:''}
    <p class="panel-hint">${state.tool==='floor'?'Click a tile to add or remove flooring. Upper floors need ground support.':state.tool==='erase'?'Click to remove a station, stair or selected edge. Flooring stays.':state.tool==='door'?'Click a floor tile to fit a door. The ground entrance faces south in its first four columns.':state.tool==='stairs'?'Click to add stairs at this tile on both floors.':`Click a floor tile to add a ${state.tool}.`} Use Tab and Enter to draw with the keyboard.</p>${grid()}<div class="design-floor-actions">${button('Remove this floor','remove',original||f.id===state.draft.layout.floors[0]!.id?'disabled title="Existing floors and ground support stay in place"':'') }<span>Walls · dark line &nbsp; Windows · double line &nbsp; Doors · dashed line</span></div></section>
    <section class="panel-section"><h3>${state.buildingId?'Improvement materials':'Construction estimate'}</h3>${state.buildingId?'<p class="panel-hint">The builder carries added materials and reinforcement, then pays for each physical stage.</p>':''}${preview.ok?`<div class="design-cost">${Object.entries(preview.cost).map(([id,n])=>`<span><strong>${n}</strong> ${e(id.replaceAll('_',' '))}</span>`).join('')}</div><ol class="design-phases">${preview.phases.map(phase=>`<li>${e(phase.name)} <span>${Math.ceil(phase.time)}s base work</span></li>`).join('')}</ol>`:`<p class="design-error">${e(preview.reason)}</p>`}</section>
    <label>Builder<select id="design-actor"><option value="">Choose a companion…</option>${actors.map(a=>`<option value="${e(a.id)}" ${a.id===state.actorId?'selected':''} ${a.activeQuest?'disabled':''}>${e(a.name)}${a.activeQuest?' · away':''}</option>`).join('')}</select></label>${site(preview)}
    <p id="design-feedback" class="${blocked?'design-error':'panel-hint'}" role="status">${e(state.feedback||blocked||'Materials are sourced and carried by the builder. This draft has not started any work.')}</p></div>
    <footer class="panel-footer">${button('Focus world','world','class="text-button"')}${button(state.buildingId?'Plan improvement':'Plan construction','submit',`class="btn primary" ${blocked?'disabled aria-describedby="design-feedback"':''}`)}</footer>`;
   panel.querySelector('.panel-body')!.scrollTop=scroll;
   if(focus)panel.querySelector<HTMLElement>(focus)?.focus({preventScroll:true});
  }
  function open(buildingId='',kind=''):boolean {
   options=h.engine().constructionOptions();if(!options.types.length){h.toast('Research a building type before designing.',true);return false;}
   if(buildingId!==state.buildingId||!state.draft){const value=buildingId?h.engine().buildingDesign(buildingId):draft(kind||options.types[0]!.id);if(!value)return false;setDraft(value);state.original=buildingId?copy(value.layout):null;}
   else if(kind&&kind!==state.draft.kind)setDraft(draft(kind));
   state.buildingId=buildingId;state.origin=document.activeElement as HTMLElement|null;
   state.actorId=h.engine().selected?.id||state.actorId||h.engine().creatures[0]?.id||'';
   panel.hidden=false;render('#construction-editor-title');return true;
  }
  function close(restore=true):void {panel.hidden=true;if(restore)(state.origin?.isConnected&&!state.origin.closest('[hidden]')?state.origin:h.world().canvas).focus({preventScroll:true});}
  function editTile(p:Point):void {
   const f=floor(),original=state.original?.floors.find(item=>item.id===f.id);f.cells=copy(cells(f));f.edges=f.edges||[];const present=f.cells.some(c=>same(c,p));state.feedback='';
   if(original&&(state.tool==='floor'&&cells(original).some(c=>same(c,p))||['station','stairs','erase'].includes(state.tool)&&(original.stations.some(s=>same(s,p))||original.stairs.some(s=>same(s,p)))||['wall','window','door','erase'].includes(state.tool)&&same(original.door,p)&&state.side==='s')){state.feedback='Keep this existing tile or connection. Add new fittings on an empty supported tile.';return;}
   if(state.tool==='floor'){
    if(present){f.cells=f.cells.filter(c=>!same(c,p));f.edges=f.edges.filter(edge=>!same(edge,p));f.stations=f.stations.filter(s=>!same(s,p));removeStairs(f,p);}else f.cells.push(p);
   }else if(!present){state.feedback='Add a floor tile here first.';return;}
   else if(state.tool==='station'){
    if(same(f.door,p)||f.stairs.some(s=>same(s,p))){state.feedback='Keep the entrance and stairs clear. Choose another floor tile.';return;}
    f.stations=f.stations.filter(s=>!same(s,p));f.stations.push({...p,id:`station-${f.id}-${p.x}-${p.y}`,label:state.station,kind:state.station,production:state.production});
   }else if(state.tool==='stairs'){
    const target=state.draft!.layout.floors.find(item=>item.id===state.to);
    if(!target||!cells(target).some(c=>same(c,p))||same(f.door,p)||same(target.door,p)||f.stations.some(s=>same(s,p))||target.stations.some(s=>same(s,p))){state.feedback='Choose another floor with an empty supported tile at the same position.';return;}
    removeStairs(f,p);removeStairs(target,p);f.stairs.push({...p,to:target.id,arrival:{...p},seconds:2});target.stairs.push({...p,to:f.id,arrival:{...p},seconds:2});
   }else if(state.tool==='erase'){
    f.stations=f.stations.filter(s=>!same(s,p));removeStairs(f,p);f.edges=f.edges.filter(edge=>!same(edge,p)||edge.side!==state.side);
   }else{
    f.edges=f.edges.filter(edge=>!same(edge,p)||edge.side!==state.side);f.edges.push({...p,side:state.side,kind:state.tool});
    if(state.tool==='door'&&state.side==='s'&&p.y===f.height-1&&p.x<=3)f.door={...p};
   }
  }
  function removeStairs(f:LWInterior.Floor,p:Point):void {
   for(const stair of f.stairs.filter(s=>same(s,p))){const target=state.draft!.layout.floors.find(item=>item.id===stair.to);if(target)target.stairs=target.stairs.filter(s=>s.to!==f.id||!same(s,stair.arrival));}
   f.stairs=f.stairs.filter(s=>!same(s,p));
  }
  function addFloor():void {
   const fs=state.draft!.layout.floors;if(fs.length>=8)return;const base=fs[0]!;
   let id='';do{id=`floor-${++sequence}`;}while(fs.some(item=>item.id===id));
   const point=cells(base).find(p=>!same(base.door,p)&&!base.stations.some(s=>same(s,p))&&!base.stairs.some(s=>same(s,p)));
   if(!point){state.feedback='Clear a ground-floor tile before connecting another floor.';return;}
   const next=freshFloor(id,`Floor ${fs.length+1}`,base.width,base.height);next.cells=copy(cells(base));fs.push(next);
   base.stairs.push({...point,to:id,arrival:{...point},seconds:2});next.stairs.push({...point,to:base.id,arrival:{...point},seconds:2});state.floorId=id;state.to=base.id;
  }
  function resize():void {
   const f=floor(),width=Number(panel.querySelector<HTMLInputElement>('#design-width')!.value),height=Number(panel.querySelector<HTMLInputElement>('#design-height')!.value);
   if(!Number.isInteger(width)||!Number.isInteger(height)||width<4||width>20||height<4||height>20){state.feedback='Floor width and height must be whole numbers from 4 to 20.';return;}
   const inside=(p:Point):boolean=>p.x<width&&p.y<height;
   for(const stair of [...f.stairs])if(!inside(stair))removeStairs(f,stair);
   f.cells=cells(f).filter(inside);f.edges=(f.edges||[]).filter(inside);f.stations=f.stations.filter(inside);f.width=width;f.height=height;
   f.door={x:Math.min(f.door.x,3,width-1),y:height-1};if(!f.cells.some(p=>same(p,f.door)))f.cells.push({...f.door});
   f.edges=f.edges.filter(edge=>!same(edge,f.door)||edge.side!=='s');f.edges.push({...f.door,side:'s',kind:'door'});
  }
  panel.addEventListener('change',event=>{
   const input=event.target as HTMLInputElement;if(!state.draft)return;state.feedback='';
   if(input.id==='design-name'){state.draft.name=input.value;state.draft.layout.label=input.value;}
   if(input.id==='design-kind')state.draft.kind=input.value;
   if(input.id==='design-floor-label')floor().label=input.value;
   if(input.id==='design-width'||input.id==='design-height')resize();
   if(input.id==='design-actor')state.actorId=input.value;
   if(input.id==='design-side')state.side=input.value as Edge['side'];
   if(input.id==='design-station')state.station=input.value as LWInterior.Station['kind'];
   if(input.id==='design-production')state.production=input.checked;
   if(input.id==='design-stairs')state.to=input.value;
   if(input.id==='design-x'||input.id==='design-y'){const n=Number(input.value);if(Number.isSafeInteger(n)){if(input.id==='design-x')state.x=n;else state.y=n;}else state.feedback='World coordinates must be whole numbers.';}
   if(input.id==='design-reuse'){const value=options.designs.find(d=>d.id===input.value);if(value)setDraft({name:value.name,kind:value.kind,layout:value.layout,mapUnit:value.mapUnit});}
   render('#'+input.id);
  });
  panel.addEventListener('click',event=>{
   const target=(event.target as Element).closest<HTMLButtonElement>('button');if(!target||target.disabled)return;event.stopPropagation();
   if(target.dataset.cell){const [x,y]=target.dataset.cell.split(',').map(Number);editTile({x:x!,y:y!});render(`[data-cell="${target.dataset.cell}"]`);return;}
   if(target.dataset.site){const [x,y]=target.dataset.site.split(',').map(Number);state.x=x!;state.y=y!;state.feedback='';render('[data-site="'+state.x+','+state.y+'"]');return;}
   const action=target.dataset.design;
   if(action==='close')close();
   if(action==='world')h.world().canvas.focus({preventScroll:true});
   if(action==='floor'){state.floorId=target.dataset.floor!;state.to=state.draft!.layout.floors.find(item=>item.id!==state.floorId)?.id||'';render(`[data-floor="${state.floorId}"]`);}
   if(action==='tool'){state.tool=target.dataset.tool as Tool;render(`[data-tool="${state.tool}"]`);}
   if(action==='add'){addFloor();render(`[data-floor="${state.floorId}"]`);}
   if(action==='remove'){const fs=state.draft!.layout.floors;if(state.original?.floors.some(item=>item.id===state.floorId)){state.feedback='Keep existing floors. You can remove a newly added floor.';render();}else if(floor().id!==fs[0]!.id){const removed=floor();for(const item of fs)item.stairs=item.stairs.filter(s=>s.to!==removed.id);state.draft!.layout.floors=fs.filter(item=>item.id!==removed.id);state.floorId=state.draft!.layout.floors[0]!.id;render();}}
   if(action==='submit'){
    const preview=h.engine().previewBuildingDesign(copy(state.draft),state.buildingId||undefined);if(!preview.ok){state.feedback=preview.reason;render();return;}
    const data={name:preview.design.name,kind:preview.design.kind,layout:preview.design.layout,mapUnit:preview.design.mapUnit};
    const result=h.engine().dispatchCommand(state.buildingId?{id:'improve-design',actorId:state.actorId,args:[state.buildingId,data]}:{id:'construct-design',actorId:state.actorId,args:[data,state.x,state.y]});
    state.feedback=result.ok?'Plan queued. Your builder will source supplies and work through its phases.':result.reason||'The plan could not be queued.';
    if(result.ok){h.save();h.toast(state.feedback);close();}else render('[data-design=submit]');
   }
  });
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
  const editor:Editor={host:panel,open,close,isOpen:()=>!panel.hidden,reset(){close(false);state.draft=null;state.original=null;state.buildingId='';state.actorId='';state.feedback='';}};
  root.LWConstructionEditor!.open=open;return editor;
 }
 root.LWConstructionEditor={create,open:()=>false};
})(globalThis);
