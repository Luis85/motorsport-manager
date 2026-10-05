/// <reference path="./rts-mission-editor-ui-contracts.d.ts" />
/** Map authoring gestures and staged forms issue revision-tagged application intentions. */
(function(input:unknown){
 'use strict';
 const root=input as {LWRTSMissionEditorUI?:LWRTSMissionEditorUI.Api;LWRTSMissionEditorForms:LWRTSMissionEditorUI.FormsApi;
  LWRTSMissionEditorProjection:LWRTSMissionEditorUI.ProjectionApi;LWRTSRenderer:LWRTSDemo.RendererApi};
 function create(host:LWRTSMissionEditorUI.Host):LWRTSMissionEditorUI.Surface {
  const forms=root.LWRTSMissionEditorForms,workspace=document.createElement('section');
  workspace.id='rts-mission-editor';workspace.setAttribute('aria-label','RTS mission editor');
  workspace.innerHTML='<header class="rts-editor-header"><div><h1>Mission workshop</h1><p>Shape the battlefield, then play your mission.</p></div><div class="rts-editor-actions"><button type="button" data-editor="play">Play mission</button><button type="button" data-editor="exit">Return to match</button></div></header><div class="rts-editor-toolbar"><label>Mission <select data-editor-mission></select></label><button type="button" data-editor="undo">Undo</button><button type="button" data-editor="redo">Redo</button><button type="button" data-editor="export">Export game data</button><button type="button" data-editor="import">Import game data</button><span data-editor-revision></span><small data-editor-history></small></div><div class="rts-editor-layout"><div class="rts-editor-field"><div class="rts-editor-map-label"><span data-editor-map-label></span><div><button type="button" data-editor="zoom-out" aria-label="Zoom out">−</button><button type="button" data-editor="fit">Fit map</button><button type="button" data-editor="zoom-in" aria-label="Zoom in">+</button></div></div><canvas class="rts-editor-map" tabindex="0" aria-label="Isometric mission map. Arrow keys choose a tile. Enter applies the selected map tool. Escape cancels a gesture."></canvas><p class="rts-editor-status" role="status" aria-live="polite">Your match is retained while you edit. Play mission starts a new paused match.</p></div><aside class="rts-editor-inspector"><div data-editor-brush></div><details><summary>Mission settings</summary><div data-editor-metadata></div></details><div data-editor-objectives></div><div data-editor-records></div><details><summary>Clone mission</summary><form data-editor-form="clone"><label>New mission ID<input name="id" required placeholder="my-mission"></label><label>New mission name<input name="name" required placeholder="My mission"></label><button type="submit" data-editor="clone">Clone mission</button><p>Cloning keeps the other missions and all game definitions in your catalog.</p></form></details></aside></div>';
  host.parent.append(workspace);
  const canvas=workspace.querySelector<HTMLCanvasElement>('canvas')!,renderer=root.LWRTSRenderer.create(canvas);
  let snapshot=host.editor.query(),disposed=false,hover:LWRTSDemo.Point|null=null,down:LWRTSDemo.Point|null=null;
  let brushIdentity='',gestureRevision=-1,gesturePointer:number|null=null;
  let editing:{collection:LWRTSMissionEditor.Collection;index:number}|null=null;
  const status=workspace.querySelector<HTMLElement>('.rts-editor-status')!;
  const missionSelect=workspace.querySelector<HTMLSelectElement>('[data-editor-mission]')!;
  const brushContainer=workspace.querySelector<HTMLElement>('[data-editor-brush]')!;
  function form(kind:string):HTMLFormElement {return workspace.querySelector<HTMLFormElement>(`[data-editor-form="${kind}"]`)!;}
  function field(group:HTMLFormElement,name:string):HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement {
   return group.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
  }
  function value(group:HTMLFormElement,name:string):string {return field(group,name).value;}
  function numeric(group:HTMLFormElement,name:string):number {return Number(value(group,name));}
  function feedback(message:string,error=false):void {
   status.textContent=message;status.classList.toggle('is-error',error);status.setAttribute('role',error?'alert':'status');
  }
  function draw():void {
   renderer.draw(root.LWRTSMissionEditorProjection.snapshot(snapshot),[],null,hover);
   if(!hover)return;
   const context=canvas.getContext('2d')!,center=renderer.screen(hover),a=renderer.screen({x:hover.x+.5,y:hover.y}),b=renderer.screen({x:hover.x,y:hover.y+.5});
   context.save();context.strokeStyle=getComputedStyle(workspace).getPropertyValue('--ink').trim()||'#31463d';context.lineWidth=2;
   context.beginPath();context.moveTo(center.x,center.y-Math.abs(b.y-center.y)*2);context.lineTo(center.x+Math.abs(a.x-center.x)*2,center.y);
   context.lineTo(center.x,center.y+Math.abs(b.y-center.y)*2);context.lineTo(center.x-Math.abs(a.x-center.x)*2,center.y);context.closePath();context.stroke();context.restore();
  }
  function refresh():void {
   if(disposed)return;
   const previousRevision=snapshot.revision;
   const objectivesOpen=workspace.querySelector<HTMLDetailsElement>('[data-editor-objectives] details')?.open,recordsOpen=workspace.querySelector<HTMLDetailsElement>('[data-editor-records] details')?.open;
   snapshot=host.editor.query();
   const identity=JSON.stringify([snapshot.mission.id,snapshot.catalog.factions,snapshot.catalog.units,snapshot.catalog.buildings,snapshot.catalog.resources,snapshot.catalog.items,snapshot.catalog.terrain]);
   missionSelect.replaceChildren(...snapshot.catalog.missions.map(row=>{const option=document.createElement('option');option.value=row.id;option.textContent=row.name;return option;}));
   missionSelect.value=snapshot.mission.id;
   const undo=workspace.querySelector<HTMLButtonElement>('[data-editor="undo"]')!,redo=workspace.querySelector<HTMLButtonElement>('[data-editor="redo"]')!;
   undo.disabled=!snapshot.canUndo;redo.disabled=!snapshot.canRedo;
   undo.title=snapshot.canUndo?'Undo last edit':'No earlier edit to undo';redo.title=snapshot.canRedo?'Redo last undone edit':'No undone edit to redo';
   undo.setAttribute('aria-label',undo.title);redo.setAttribute('aria-label',redo.title);
   workspace.querySelector<HTMLElement>('[data-editor-history]')!.textContent=!snapshot.canUndo&&!snapshot.canRedo?'No edits to undo or redo.':!snapshot.canUndo?'No earlier edit to undo.':!snapshot.canRedo?'No undone edit to redo.':'';
   workspace.querySelector<HTMLElement>('[data-editor-revision]')!.textContent=`Revision ${snapshot.revision} · ${snapshot.dirty?'Draft changed':'Draft unchanged'}`;
   workspace.querySelector<HTMLElement>('[data-editor-map-label]')!.textContent=`${snapshot.mission.name} · ${snapshot.mission.width} × ${snapshot.mission.height} · all tiles visible`;
   workspace.querySelector<HTMLElement>('[data-editor-metadata]')!.innerHTML=forms.metadata(snapshot);
   workspace.querySelector<HTMLElement>('[data-editor-objectives]')!.innerHTML=forms.objectives(snapshot);
   workspace.querySelector<HTMLElement>('[data-editor-records]')!.innerHTML=forms.records(snapshot);
   workspace.querySelector<HTMLDetailsElement>('[data-editor-objectives] details')!.open=!!objectivesOpen;
   workspace.querySelector<HTMLDetailsElement>('[data-editor-records] details')!.open=!!recordsOpen;
   if(brushIdentity!==identity){brushIdentity=identity;brushContainer.innerHTML=forms.brush(snapshot);editing=null;syncTool();}
   else if(previousRevision!==snapshot.revision){editing=null;syncTool();}
   field(form('brush'),'x').setAttribute('max',String(snapshot.mission.width-1));
   field(form('brush'),'y').setAttribute('max',String(snapshot.mission.height-1));
   draw();
  }
  function send(command:Record<string,unknown>):void {
   const focused=document.activeElement instanceof HTMLElement&&workspace.contains(document.activeElement)?document.activeElement:null;
   const group=focused?.closest<HTMLFormElement>('form'),name=focused?.getAttribute('name'),action=focused?.dataset.editor;
   const result=host.editor.command({...command,revision:snapshot.revision});
   if(result.ok){refresh();feedback(result.message);}
   else feedback(result.message,true);
   if(group&&name)workspace.querySelector<HTMLElement>(`[data-editor-form="${group.dataset.editorForm}"] [name="${name}"]`)?.focus({preventScroll:true});
   else if(action)workspace.querySelector<HTMLElement>(`[data-editor="${action}"]`)?.focus({preventScroll:true});
   else if(group)workspace.querySelector<HTMLElement>(`[data-editor-form="${group.dataset.editorForm}"] button[type="submit"]`)?.focus({preventScroll:true});
  }
  function syncTool():void {
   const brush=form('brush'),tool=value(brush,'tool');
   workspace.querySelectorAll<HTMLElement>('[data-editor-fields]').forEach(row=>{row.hidden=row.dataset.editorFields!==tool;});
   workspace.querySelector<HTMLElement>('[data-editor-apply]')!.textContent=editing?'Update placement':'Apply map tool';
   if(tool==='spawns'){
    const faction=snapshot.catalog.factions.find(row=>row.id===value(brush,'faction'));
    const selected=value(brush,'archetype'),permitted=[...snapshot.catalog.units,...snapshot.catalog.buildings].filter(row=>faction?.units.includes(row.id)||faction?.buildings.includes(row.id));
    const select=field(brush,'archetype') as HTMLSelectElement;
    select.innerHTML=permitted.map(row=>`<option value="${forms.escape(row.id)}">${forms.escape(row.name)}</option>`).join('');
    if(permitted.some(row=>row.id===selected))select.value=selected;
   }
  }
  function point():LWRTSDemo.Point {return {x:numeric(form('brush'),'x'),y:numeric(form('brush'),'y')};}
  function choose(point:LWRTSDemo.Point):void {
   field(form('brush'),'x').value=String(Math.max(0,Math.min(snapshot.mission.width-1,Math.floor(point.x))));
   field(form('brush'),'y').value=String(Math.max(0,Math.min(snapshot.mission.height-1,Math.floor(point.y))));
   hover={x:numeric(form('brush'),'x')+.5,y:numeric(form('brush'),'y')+.5};draw();
  }
  function nearest(point:LWRTSDemo.Point):{collection:LWRTSMissionEditor.Collection;index:number}|null {
   const projected=root.LWRTSMissionEditorProjection.snapshot(snapshot);
   const found=projected.entities.find(row=>Math.floor(row.x)===Math.floor(point.x)&&Math.floor(row.y)===Math.floor(point.y));
   if(!found)return null;
   const [collection,index]=found.id.split(':');return {collection:collection as LWRTSMissionEditor.Collection,index:Number(index)};
  }
  function editRecord(collection:LWRTSMissionEditor.Collection,index:number):void {
   if(collection==='objectives')return;
   const record=snapshot.mission[collection][index];if(!record)return;
   editing={collection,index};const brush=form('brush');field(brush,'tool').value=collection;
   for(const [key,entry] of Object.entries(record))if(brush.elements.namedItem(key))field(brush,key).value=String(entry);
   syncTool();hover={x:Math.floor(record.x)+.5,y:Math.floor(record.y)+.5};draw();feedback('Placement selected. Change its values or coordinates, then Update placement.');
  }
  function apply():void {
   const brush=form('brush'),tool=value(brush,'tool'),position=point();
   if(tool==='inspect'||tool==='remove'){
    const record=nearest(position);
    if(!record){feedback('No placement at this tile.',true);return;}
    if(tool==='inspect')editRecord(record.collection,record.index);
    else {send({action:'remove-record',...record});editing=null;syncTool();}
    return;
   }
   if(tool==='terrain'){send({action:'paint',terrain:value(brush,'terrain'),...position,width:numeric(brush,'width'),height:numeric(brush,'height')});return;}
   let record:LWRTSMissionEditor.RecordValue;
   if(tool==='spawns')record={archetype:value(brush,'archetype'),faction:value(brush,'faction'),...position,count:numeric(brush,'count')};
   else if(tool==='deposits')record={resource:value(brush,'resource'),...position,amount:numeric(brush,'amount')};
   else record={item:value(brush,'item'),...position};
   send({action:'set-record',collection:tool,index:editing?.collection===tool?editing.index:null,value:record});
  }
  workspace.addEventListener('submit',event=>{
   const group=event.target as HTMLFormElement;event.preventDefault();
   const kind=group.dataset.editorForm;
   if(kind==='brush'){apply();return;}
   if(kind==='metadata')send({action:'metadata',values:{name:value(group,'name'),description:value(group,'description'),
    width:numeric(group,'width'),height:numeric(group,'height'),seed:numeric(group,'seed'),playerFaction:value(group,'playerFaction'),
    defaultTerrain:value(group,'defaultTerrain'),fog:(field(group,'fog') as HTMLInputElement).checked}});
   if(kind==='clone')send({action:'clone-mission',id:value(group,'id'),name:value(group,'name')});
   if(kind==='objective')send({action:'set-record',collection:'objectives',index:value(group,'index')===''?null:numeric(group,'index'),
    value:{id:value(group,'id'),name:value(group,'name'),description:value(group,'description'),type:value(group,'type'),target:value(group,'target'),amount:numeric(group,'amount')}});
  });
  workspace.addEventListener('change',event=>{
   const target=event.target as HTMLElement;
   if(target===missionSelect){send({action:'select-mission',missionId:missionSelect.value});return;}
   if(target.matches('[data-editor-tool]')){editing=null;syncTool();}
   if(target.matches('[data-editor-faction]'))syncTool();
   if(target.matches('[data-editor-objective-type]')){
    const objective=form('objective'),type=value(objective,'type'),select=field(objective,'target') as HTMLSelectElement;
    const rows=type==='stockpile'?snapshot.catalog.resources:type==='eliminate'?snapshot.catalog.factions:[];
    select.innerHTML=type==='survive'?`<option value="${forms.escape(snapshot.mission.playerFaction)}">Time (target ignored)</option>`:rows.map(row=>`<option value="${forms.escape(row.id)}">${forms.escape(row.name)}</option>`).join('');
   }
  });
  workspace.addEventListener('click',event=>{
   const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-editor]'):null;if(!target)return;
   try{
    switch(target.dataset.editor){
     case 'undo':case 'redo':editing=null;send({action:target.dataset.editor});syncTool();break;
     case 'play':host.onPlay();break;
     case 'exit':host.onExit();break;
     case 'export':host.onExport();break;
     case 'import':host.onImport();break;
     case 'zoom-out':renderer.zoom(.8);draw();break;
     case 'zoom-in':renderer.zoom(1.25);draw();break;
     case 'fit':renderer.reset();draw();break;
     case 'remove-record':send({action:'remove-record',collection:target.dataset.collection,index:Number(target.dataset.index)});break;
     case 'edit-record':editRecord(target.dataset.collection as LWRTSMissionEditor.Collection,Number(target.dataset.index));break;
     case 'new-objective':workspace.querySelector<HTMLElement>('[data-editor-objectives]')!.innerHTML=forms.objectives(snapshot);form('objective').closest('details')!.open=true;break;
     case 'edit-objective':{
      const objective=snapshot.mission.objectives[Number(target.dataset.index)]!;const group=form('objective');
      field(group,'type').value=objective.type;field(group,'type').dispatchEvent(new Event('change',{bubbles:true}));
      for(const [key,entry] of Object.entries(objective))field(group,key).value=String(entry);
      field(group,'index').value=String(target.dataset.index);group.closest('details')!.open=true;field(group,'id').focus();break;
     }
    }
   }catch(error){feedback(error instanceof Error?error.message:String(error),true);}
  });
  function local(event:PointerEvent):LWRTSDemo.Point {const rect=canvas.getBoundingClientRect();return renderer.world({x:event.clientX-rect.left,y:event.clientY-rect.top});}
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;down=local(event);gestureRevision=snapshot.revision;gesturePointer=event.pointerId;canvas.setPointerCapture(event.pointerId);canvas.focus();});
  canvas.addEventListener('pointerup',event=>{
   if(!down||gesturePointer!==event.pointerId)return;
   if(gestureRevision!==host.editor.query().revision){down=null;gesturePointer=null;feedback('The draft changed during this gesture. Choose the tile again.',true);return;}
   const start=down,end=local(event);down=null;gesturePointer=null;
   if(end.x<0||end.y<0||end.x>=snapshot.mission.width||end.y>=snapshot.mission.height){feedback('Choose a tile inside the mission map.',true);return;}
   if(value(form('brush'),'tool')==='terrain'&&Math.hypot(start.x-end.x,start.y-end.y)>1){
    choose({x:Math.min(start.x,end.x),y:Math.min(start.y,end.y)});
    field(form('brush'),'width').value=String(Math.abs(Math.floor(end.x)-Math.floor(start.x))+1);
    field(form('brush'),'height').value=String(Math.abs(Math.floor(end.y)-Math.floor(start.y))+1);
   }else choose(end);
   apply();
  });
  canvas.addEventListener('pointercancel',()=>{down=null;gesturePointer=null;});
  canvas.addEventListener('keydown',event=>{
   const current=point(),offset=({ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1}} as Record<string,LWRTSDemo.Point>)[event.key];
   if(offset){event.preventDefault();choose({x:current.x+offset.x,y:current.y+offset.y});feedback(`Tile ${point().x}, ${point().y}. Enter applies the selected tool.`);}
   if(event.key==='Enter'){event.preventDefault();apply();}
   if(event.key==='Escape'){down=null;if(gesturePointer!==null&&canvas.hasPointerCapture(gesturePointer))canvas.releasePointerCapture(gesturePointer);gesturePointer=null;editing=null;syncTool();feedback('Gesture canceled.');}
  });
  const resize=new ResizeObserver(()=>{if(!disposed)draw();});resize.observe(canvas);
  refresh();workspace.querySelector<HTMLButtonElement>('[data-editor="play"]')!.focus();
  return {refresh,feedback,destroy(){disposed=true;resize.disconnect();workspace.remove();}};
 }
 root.LWRTSMissionEditorUI={create};
})(globalThis);
