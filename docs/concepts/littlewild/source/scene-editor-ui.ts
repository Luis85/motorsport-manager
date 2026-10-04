/// <reference path="./scene-editor-ui-contracts.d.ts" />
/// <reference path="./external-editor-ui.ts" />
/// <reference path="./storytelling-ui-contracts.d.ts" />
/* Pack authoring uses a separate draft session. Review is the only live-story boundary. */
(function(inputRoot:unknown){
 'use strict';
 type Data=Record<string,unknown>;
 const record=(value:unknown):Data=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Data:{};
 const root=inputRoot as {LWInteriors:LWInterior.CatalogApi;LWAssets:{defaults:readonly LWSceneEditorSurface.Asset[]};LWSceneEditor:LWSceneEditor.Api;LWScenarios:LWContentPorts.ScenarioApi;LWFiles:{downloadJSON(value:unknown,name:string):void};LWSceneEditorView:LWSceneEditorSurface.View;LWSceneEditorUI?:LWSceneEditorSurface.Api;LWExternalEditorUI?:LWExternalEditorUI.Api;LWEngineExportUI?:LWEngineExportUI.Api;LWStorytellingUI?:LWStorytellingUI.Api;LWStorytellingEditorPreview?:{create(canvas:HTMLCanvasElement,pack:LWContentPorts.ScenarioPack,id:string):LWStorytellingUI.Preview}};
 function assets(pack:LWContentPorts.ScenarioPack):readonly LWSceneEditorSurface.Asset[] {
  const values=pack.resources?.assets;
  if(!values)return root.LWAssets.defaults;
  return values.map(value=>{const data=record(value);return {id:String(data.id),name:String(data.name),category:data.category as LWSceneEditorSurface.Asset['category'],models:record(data.models)};});
 }
 function create(ctx:LWSceneEditorSurface.Host):LWSceneEditorSurface.Editor {
  let session:LWSceneEditor.Session|null=null,sourcePackId='',pendingPack:LWContentPorts.ScenarioPack|null=null;
  const state:LWSceneEditorSurface.State={selection:{type:'scene',id:''},category:'creatures',entityId:'',placement:false,errors:[],notice:'',confirm:'',creating:'',readId:0};
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.id='scene-editor-import';input.hidden=true;document.body.append(input);
  const e=ctx.esc;
  const exchange=root.LWExternalEditorUI?.create({session:()=>session,sceneId:()=>state.selection.type==='scene'?state.selection.id:undefined,modal:ctx.modal,redraw,toast:ctx.toast,esc:e,onApplied:id=>select('scene',id)});
  const engineExport=root.LWEngineExportUI?.create({session:()=>session,sceneId:()=>state.selection.type==='scene'?state.selection.id:undefined,modal:ctx.modal,redraw,toast:ctx.toast,esc:e});
  const storytelling=root.LWStorytellingUI?.create({session:()=>session,sceneId:()=>state.selection.type==='scene'?state.selection.id:undefined,modal:ctx.modal,redraw,toast:ctx.toast,esc:e,deferPreview,
   ...(root.LWStorytellingEditorPreview?{preview:(canvas,pack,id)=>root.LWStorytellingEditorPreview!.create(canvas,pack,id)}:{})});
  function deferPreview(work:()=>void):()=>void {
   // Authoring commits synchronously. Expensive observation preparation yields
   // to input acknowledgements; this one-shot job never advances gameplay time.
   if(typeof requestIdleCallback==='function'){const id=requestIdleCallback(work,{timeout:1000});return()=>cancelIdleCallback(id);}
   const id=setTimeout(work,0);return()=>clearTimeout(id);
  }
  function current():LWContentPorts.ScenarioPack {if(!session)throw Error('Open a pack draft first.');return session.snapshot();}
  function redraw():void {ctx.redraw();}
  function select(type:string,id:string):void {state.selection={type,id};state.category='creatures';state.entityId='';state.placement=false;state.confirm='';state.creating='';state.notice='';state.errors=[];}
  function outcome(value:unknown):void {
   if(value&&typeof value==='object'&&'ok' in value&&(value as Data).ok===false){const errors=(value as Data).errors;throw Error(Array.isArray(errors)?errors.map(String).join('\n'):'The edit was rejected.');}
  }
  function mutate(work:()=>unknown,message='Draft updated.'):void {
   outcome(work());state.errors=[];state.notice=message;state.placement=false;redraw();
  }
  function open(pack?:LWContentPorts.ScenarioPack):void {
   state.readId++;exchange?.cancel();engineExport?.cancel();storytelling?.cancel();
   if(pack&&session&&pack.id!==sourcePackId&&session.revision>0){pendingPack=pack;ctx.open('scene-editor');document.querySelector<HTMLButtonElement>('[data-scene-editor=cancel-replace]')?.focus();return;}
   if(!session||pack&&pack.id!==sourcePackId){const next=pack||root.LWScenarios.builtins()[0]!;session=root.LWSceneEditor.create(next);sourcePackId=next.id;select('scene',session.snapshot().scenes[0]?.id||'');}
   ctx.open('scene-editor');
  }
  function creation():string {
   if(!state.creating)return '';
   const p=current(),selected=p.scenes.find((a)=>a.id===state.selection.id),world=p.worlds.find((w)=>w.id===(selected?.worldId||state.selection.id))||p.worlds[0];
   return `<form class="scene-editor-creation" data-scene-editor-form="create"><h3>${state.creating==='world'?'Add world':state.creating==='child'?'Add child scene':'Add scene'}</h3><div class="scene-editor-pair"><label>Name<input name="name" required maxlength="100"></label><label>ID<input name="id" required pattern="[a-z](?:[a-z0-9]|-){0,63}" placeholder="quiet-garden"></label>${state.creating!=='world'?`<label>World<select name="worldId">${p.worlds.map((w)=>`<option value="${e(w.id)}" ${w.id===world?.id?'selected':''}>${e(w.name)}</option>`).join('')}</select></label><label>Scene kind<select name="kind">${['level','island','interior','dungeon'].map(k=>`<option>${k}</option>`).join('')}</select></label><label>Binding source scene<select name="binding-source">${p.scenes.filter((a)=>!a.graph?.binding).map((a)=>`<option value="${e(a.id)}" ${a.id===selected?.id?'selected':''}>${e(a.name)}</option>`).join('')}</select></label><label>Island X<input type="number" name="binding-ix" value="0"></label><label>Island Y<input type="number" name="binding-iy" value="0"></label><label>Building ID<input name="binding-building" placeholder="b2"></label><label>Floor ID<input name="binding-floor" value="ground"></label>`:''}</div><p>${state.creating==='world'?'Copies the selected world’s terrain and settings.':'Copies the selected scene’s canonical initial state. Configure a runtime binding to use an existing island or interior.'}</p><div class="scene-editor-actions"><button type="submit" class="btn primary">Create draft ${state.creating==='world'?'world':'scene'}</button><button type="button" class="btn" data-scene-editor="cancel-create">Cancel</button></div></form>`;
  }
  function floorFor(pack:LWContentPorts.ScenarioPack):LWInterior.Floor|undefined {
   const selected=pack.scenes.find(scene=>scene.id===state.selection.id),binding=selected?.graph?.binding;
   if(binding?.type!=='interior')return undefined;
   const source=pack.scenes.find(scene=>scene.id===binding.sourceSceneId),buildings=source?.initialState.buildings;
   const building=Array.isArray(buildings)?buildings.map(record).find(row=>row.id===binding.buildingId):undefined;
   if(!source||!building)return undefined;
   try{return root.LWInteriors.forBuilding(source.initialState as LWInterior.CatalogWorld,building as unknown as LWInterior.CatalogBuilding).floors.find(floor=>floor.id===binding.floorId);}catch{return undefined;}
  }
  function render(type='scene-editor'):string|null {
   if(type!=='scene-editor')return null;
   if(!session){const pack=root.LWScenarios.builtins()[0]!;session=root.LWSceneEditor.create(pack);sourcePackId=pack.id;}
   const p=current();if(!state.selection.id)state.selection.id=p.scenes[0]?.id||p.worlds[0]?.id||'';
   let entities:LWSceneGraph.Entity[]=[];try{if(state.selection.type==='scene')entities=session.entities(state.selection.id);}catch(error){state.errors=[error instanceof Error?error.message:String(error)];}
   if(state.entityId&&!entities.some(c=>c.category===state.category&&c.id===state.entityId))state.entityId='';
   const markup=root.LWSceneEditorView.render({pack:p,state,entities,revision:session.revision,canUndo:session.canUndo,canRedo:session.canRedo,assets:assets(p),...(floorFor(p)?{interior:floorFor(p)!}:{}),esc:e});
   const replacement=pendingPack?`<section class="scene-editor-creation" role="alert"><h3>Replace this draft with ${e(pendingPack.name)}?</h3><p>Export the current draft first if you want to keep its edits.</p><button type="button" class="btn" data-scene-editor="cancel-replace">Cancel</button><button type="button" class="btn" data-scene-editor="replace-draft">Replace draft</button></section>`:'';
   return ctx.head('World & Scene Editor','Author worlds, connected scenes and starting entities in a separate pack draft.','')+(exchange?.render()||'')+(engineExport?.render()||'')+replacement+creation()+(storytelling?.render()||'')+markup+ctx.footer();
  }
  function readJSON<T>(form:HTMLFormElement,name:string,fallback:T):T {
   const control=form.elements.namedItem(name) as HTMLInputElement|null;
   if(!control)return fallback;
   try{return JSON.parse(control.value) as T;}catch{throw Error(name+': enter valid JSON, then apply the settings.');}
  }
  const text=(form:HTMLFormElement,name:string):string=>(form.elements.namedItem(name) as HTMLInputElement)?.value||'';
  const rowText=(row:HTMLElement,name:string):string=>(row.querySelector<HTMLInputElement>(`[name="${name}"]`))?.value||'';
  function rowJSON(row:HTMLElement,name:string):unknown {try{return JSON.parse(rowText(row,name));}catch{throw Error(name+': enter valid JSON.');}}
  function bindingFrom(form:HTMLFormElement):LWSceneGraph.Binding|null {
   const type=text(form,'binding-type')||(['island','interior'].includes(text(form,'kind'))?text(form,'kind'):'');
   if(!type)return null;
   const sourceSceneId=text(form,'binding-source');
   return type==='island'?{type,sourceSceneId,ix:Number(text(form,'binding-ix')),iy:Number(text(form,'binding-iy'))}:{type:'interior',sourceSceneId,buildingId:text(form,'binding-building'),floorId:text(form,'binding-floor')};
  }
  function apply(form:HTMLFormElement):void {
   if(!session)return;
   const p=current(),kind=form.dataset.sceneEditorForm,id=state.selection.id;
   if(kind==='world'){
    const settings=readJSON<Data>(form,'settings',{});if(!settings||Array.isArray(settings)||typeof settings!=='object')throw Error('World settings must be a JSON object.');
    const previous=p.worlds.find((w)=>w.id===id);if(!previous)throw Error('Select a world.');const resourceCounts={...previous.resourceCounts};for(const key of Object.keys(resourceCounts))resourceCounts[key as keyof typeof resourceCounts]=Number(text(form,'resource-'+key));
    mutate(()=>session!.updateWorld(id,{...settings,name:text(form,'name'),description:text(form,'description'),terrain:text(form,'terrain').split('\n'),resourceCounts}),'World settings updated in the draft.');
   }
   if(kind==='scene'){
    const previous=p.scenes.find((a)=>a.id===id);if(!previous)throw Error('Select a scene.');const graph:LWSceneGraph.Metadata={...previous!.graph,kind:text(form,'kind') as LWSceneGraph.Kind};
    const parent=text(form,'parentId');if(parent)graph.parentId=parent;else delete graph.parentId;
    graph.rendering={dimension:text(form,'render-dimension') as LWSceneGraph.Rendering['dimension'],rendererId:text(form,'render-id') as LWSceneGraph.Rendering['rendererId'],embeds:Array.from(form.querySelectorAll<HTMLElement>('[data-editor-row=embed]')).map(row=>({id:rowText(row,'embed-id'),sceneId:rowText(row,'embed-scene'),role:rowText(row,'embed-role') as LWSceneGraph.Embed['role'],bounds:{anchor:rowText(row,'embed-anchor') as NonNullable<LWSceneGraph.Embed['bounds']>['anchor'],width:Number(rowText(row,'embed-width')),height:Number(rowText(row,'embed-height'))}}))};
    graph.bounds={x:Number(text(form,'bounds-x')),y:Number(text(form,'bounds-y')),width:Number(text(form,'bounds-width')),height:Number(text(form,'bounds-height'))};
    graph.connections=Array.from(form.querySelectorAll<HTMLElement>('[data-editor-row=connection]')).map(row=>({id:rowText(row,'connection-id'),label:rowText(row,'connection-label'),targetSceneId:rowText(row,'connection-target'),requirements:rowJSON(row,'connection-requirements') as LWSceneGraph.Requirement[],events:rowJSON(row,'connection-events') as LWSceneGraph.Event[]}));
    graph.requirements=Array.from(form.querySelectorAll<HTMLElement>('[data-editor-row=requirement]')).map<LWSceneGraph.Requirement>(row=>{const type=rowText(row,'requirement-type');return type==='player-level'?{type,minimum:Number(rowText(row,'requirement-minimum'))}:type==='quest-complete'?{type,questId:rowText(row,'requirement-id')}:type==='building'?{type,kind:rowText(row,'requirement-id')}:{type:'item',itemId:rowText(row,'requirement-id'),quantity:Number(rowText(row,'requirement-quantity'))};});
    graph.events=Array.from(form.querySelectorAll<HTMLElement>('[data-editor-row=event]')).map<LWSceneGraph.Event>(row=>{const type=rowText(row,'event-type');return type==='pause'?{type,paused:rowText(row,'event-paused')==='true'}:type==='play-cutscene'?{type,cutsceneId:rowText(row,'event-cutscene'),once:rowText(row,'event-once')==='true'}:type==='scene-switch'?{type,connectionId:rowText(row,'event-connection')}:{type:'message',text:rowText(row,'event-text')};});
    const binding=bindingFrom(form);if(binding)graph.binding=binding;else delete graph.binding;
    mutate(()=>session!.updateScene(id,{name:text(form,'name'),description:text(form,'description'),worldId:text(form,'worldId'),graph,initialState:binding?{}:readJSON(form,'initialState',previous.initialState)}),'Scene settings updated in the draft.');
   }
   if(kind==='entity'){
    const entity=session.entities(id).find(a=>a.id===state.entityId&&a.category===state.category);if(!entity)throw Error('Select an entity first.');
    const patch=readJSON<Data>(form,'entity',entity.data);if(!patch||Array.isArray(patch)||typeof patch!=='object')throw Error('Entity settings must be a JSON object.');
    const x=Number(text(form,'x')),y=Number(text(form,'y'));
    if(state.category==='props'){patch.name=text(form,'name');const [category,assetId]=text(form,'assetId').split('/');patch.category=category;patch.assetId=assetId;patch.model=text(form,'model');}
    if(state.category==='creatures'){patch.name=text(form,'name');patch.inventory={...record(entity.data.inventory)};for(const quantity of Array.from(form.querySelectorAll<HTMLInputElement>('[data-inventory-item]')))(patch.inventory as Data)[quantity.dataset.inventoryItem!]=Number(quantity.value);if(p.scenes.find((a)=>a.id===id)?.graph?.binding?.type!=='interior')patch.creature={...record(patch.creature),x,y};}else{patch.x=x;patch.y=y;}
    mutate(()=>session!.setEntity(id,state.category,state.entityId,patch),'Canonical entity settings updated.');
   }
   if(kind==='prop-add'){const [category,assetId]=text(form,'assetId').split('/');const prop={id:text(form,'newId'),name:text(form,'name'),category:category as 'building'|'item',assetId:assetId||'',model:text(form,'model'),x:Number(text(form,'x')),y:Number(text(form,'y'))};mutate(()=>session!.addProp(id,prop),'Decorative prop added to the draft.');state.entityId=prop.id;redraw();}
   if(kind==='entity-add'){const newId=text(form,'newId');mutate(()=>session!.addEntity(id,state.category,text(form,'templateId'),newId,Number(text(form,'x')),Number(text(form,'y'))),'Entity added to the canonical draft.');state.entityId=newId;redraw();}
   if(kind==='create'){
    const name=text(form,'name'),newId=text(form,'id'),selected=p.scenes.find((a)=>a.id===id)||p.scenes[0],worldId=text(form,'worldId');
    if(state.creating==='world'){
     const world=p.worlds.find((w)=>w.id===(selected?.worldId||id))||p.worlds[0];outcome(session.addWorld(world!,newId,name));select('world',newId);
    }else{
     const binding=bindingFrom(form),graph:LWSceneGraph.Metadata={kind:text(form,'kind') as LWSceneGraph.Kind};if(binding)graph.binding=binding;
     outcome(session.addScene({...selected!,name,graph,initialState:binding?{}:selected!.initialState},newId,worldId,binding?binding.sourceSceneId:state.creating==='child'?id:undefined));select('scene',newId);
    }
    state.creating='';state.notice='Created in the draft.';redraw();
   }
  }
  document.addEventListener('submit',event=>{
   const form=(event.target as Element).closest<HTMLFormElement>('[data-scene-editor-form]');if(!form||ctx.modal()!=='scene-editor')return;event.preventDefault();
   try{apply(form);}catch(error){state.errors=[error instanceof Error?error.message:String(error)];redraw();}
  });
  document.addEventListener('change',event=>{
   const assetControl=(event.target as Element).closest<HTMLSelectElement>('select[name=assetId]');if(assetControl&&ctx.modal()==='scene-editor'){const [category,id]=assetControl.value.split('/'),asset=assets(current()).find(a=>a.category===category&&a.id===id),model=assetControl.closest('form')?.querySelector<HTMLSelectElement>('[name=model]');if(model&&asset)model.innerHTML=Object.keys(asset.models).map(name=>`<option value="${e(name)}">${e(name)}</option>`).join('');return;}
   const control=(event.target as Element).closest<HTMLSelectElement>('[data-scene-editor-field]');if(!control||ctx.modal()!=='scene-editor')return;
   if(control.dataset.sceneEditorField==='selection'){const [type,id]=control.value.split(':');select(type||'scene',id||'');redraw();return;}
   if(control.dataset.sceneEditorField==='category'){state.category=control.value as LWSceneEditor.Category;state.entityId='';}
   if(control.dataset.sceneEditorField==='entity')state.entityId=control.value;
   state.placement=false;redraw();
  });
  document.addEventListener('click',event=>{
   const button=(event.target as Element).closest<HTMLButtonElement>('[data-scene-editor]');if(!button||button.disabled||ctx.modal()!=='scene-editor'||!session)return;event.preventDefault();
   const action=button.dataset.sceneEditor||'',id=button.dataset.id||'';
   try{
    if(action==='cancel-replace'){pendingPack=null;redraw();}
    if(action==='replace-draft'&&pendingPack){const pack=pendingPack;pendingPack=null;session=null;open(pack);return;}
    if(action==='select-world'||action==='select-scene'){select(action==='select-world'?'world':'scene',id);redraw();}
    if(action==='submit')button.closest('form')?.requestSubmit();
    if(action==='add-inventory'){const form=button.closest('form')!,item=text(form,'inventory-new-item');if(!form.querySelector(`[data-inventory-item="${CSS.escape(item)}"]`))form.querySelector('[data-inventory-list]')?.insertAdjacentHTML('beforeend',`<label>${e(item)}<input type="number" min="0" step="1" value="0" data-inventory-item="${e(item)}"></label>`);}
    if(action==='remove-row')button.closest('[data-editor-row]')?.remove();
    if(action==='add-embed'||action==='add-connection'||action==='add-requirement'||action==='add-event'){const rowType=action.slice(4),container=button.closest('form')?.querySelector(`[data-editor-rows="${rowType==='embed'?'embeds':rowType==='connection'?'connections':rowType==='requirement'?'requirements':'events'}"]`);container?.insertAdjacentHTML('beforeend',root.LWSceneEditorView.render({pack:current(),state,entities:[],revision:session.revision,esc:e,row:rowType}));}
    if(action==='new-world'||action==='new-scene'||action==='new-child'){state.creating=action==='new-world'?'world':action==='new-child'?'child':'scene';redraw();document.querySelector<HTMLInputElement>('.scene-editor-creation input')?.focus();}
    if(action==='cancel-create'){state.creating='';redraw();}
    if(action==='undo'||action==='redo')mutate(()=>session![action](),action==='undo'?'Undid draft edit.':'Redid draft edit.');
    if(action==='validate'){const check=session.validate();state.errors=check.errors;state.notice=check.ok?'The complete pack is valid. Review a scene to play it.':'';redraw();}
    if(action==='import')input.click();
    if(action==='export'){root.LWFiles.downloadJSON(session.export(),current().id+'.pack.json');state.notice='Full pack exported, including its worlds, scenes and content catalogs.';redraw();}
    if(action==='review'){const check=session.validate();if(!check.ok){state.errors=check.errors;redraw();}else ctx.review(session.export(),id);}
    if(action==='move'){state.placement=!state.placement;state.notice=state.placement?'Choose a destination tile for the selected entity.':'';redraw();}
    if(action==='tile'){
     const x=Number(button.dataset.x),y=Number(button.dataset.y),sceneId=state.selection.id;
     if(state.placement)mutate(()=>session!.place(sceneId,state.category,state.entityId,x,y),'Entity moved in the draft.');
     else{const entity=session.entities(sceneId).find(a=>Math.floor(a.x)===x&&Math.floor(a.y)===y);if(entity){state.category=entity.category;state.entityId=entity.id;redraw();}}
    }
    if(action==='confirm-world'||action==='confirm-scene'||action==='confirm-entity'){state.confirm=action==='confirm-entity'?'entity:'+id:id;redraw();document.querySelector<HTMLButtonElement>('[data-scene-editor="cancel-delete"]')?.focus();}
    if(action==='cancel-delete'){state.confirm='';redraw();}
    if(action==='delete'){
     if(state.confirm.startsWith('entity:')){mutate(()=>session!.removeEntity(state.selection.id,state.category,state.confirm.slice(7)),'Entity removed from the draft.');state.entityId='';state.confirm='';redraw();return;}
     const deleting=state.selection.type;if(deleting==='world')outcome(session.removeWorld(state.confirm));else outcome(session.removeScene(state.confirm));
     const p=current();select(p.scenes.length?'scene':'world',p.scenes[0]?.id||p.worlds[0]?.id||'');state.notice='Deleted from the draft. Undo restores the removed content.';redraw();
    }
   }catch(error){state.errors=[error instanceof Error?error.message:String(error)];state.placement=false;redraw();}
  });
  document.addEventListener('keydown',event=>{
   const tile=(event.target as Element).closest<HTMLButtonElement>('.scene-editor-cell');if(!tile||ctx.modal()!=='scene-editor')return;
   const shifts:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
   const shift=shifts[event.key];if(!shift)return;event.preventDefault();
   const x=Number(tile.dataset.x)+shift[0],y=Number(tile.dataset.y)+shift[1];
   const next=document.querySelector<HTMLButtonElement>(`.scene-editor-cell[data-x="${x}"][data-y="${y}"]`);if(next){tile.tabIndex=-1;next.tabIndex=0;next.focus();}
  });
  input.addEventListener('change',async()=>{
   const file=input.files?.[0];if(!file||!session)return;const token=++state.readId,owner=session,revision=owner.revision;
   const currentRead=():boolean=>token===state.readId&&session===owner&&owner.revision===revision&&ctx.modal()==='scene-editor';
   try{
    if(file.size>8*1024*1024)throw Error('Pack imports must be smaller than 8 MiB.');
    const value=await file.text();if(!currentRead())return;
    outcome(owner.replace(value));const p=current();select('scene',p.scenes[0]?.id||'');state.notice='Imported and validated a complete pack draft. The active story is unchanged.';redraw();
   }catch(error){if(currentRead()){state.errors=[error instanceof Error?error.message:String(error)];redraw();}}
   finally{if(token===state.readId)input.value='';}
  });
  return {state,...(storytelling?{storytelling}:{}),get session(){return session;},render,open,cancelRead(){state.readId++;exchange?.cancel();engineExport?.cancel();storytelling?.cancel();},reset(){exchange?.cancel();engineExport?.cancel();storytelling?.cancel();session=null;pendingPack=null;sourcePackId='';state.readId++;state.errors=[];state.notice='';state.confirm='';state.creating='';state.placement=false;}};
 }
 root.LWSceneEditorUI={create};
})(typeof globalThis!=='undefined'?globalThis:this);
