/// <reference path="./external-editor-contracts.d.ts" />
/** External exchange UI owns only a detached review and local file intent. */
declare namespace LWExternalEditorUI {
 interface Host {session():LWSceneEditor.Session|null;sceneId():string|undefined;modal():string|null;redraw():void;toast(message:string,error?:boolean):void;esc(value:unknown):string;onApplied?(sceneId:string):void;}
 interface Surface {render():string;cancel():void;}
 interface Api {create(host:Host):Surface;}
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWExternalEditors:LWExternalEditors.Api;LWFiles:{downloadJSON(value:unknown,name:string):void};LWExternalEditorUI?:LWExternalEditorUI.Api};
 function create(host:LWExternalEditorUI.Host):LWExternalEditorUI.Surface{
  let format:LWExternalEditors.Format='tiled',mappingText='[]',readId=0,notice='',error='',expanded=false;
  let review:{result:Extract<LWExternalEditors.Import,{ok:true}>;session:LWSceneEditor.Session;revision:number;baseline:LWContentPorts.ScenarioPack}|null=null;
  const input=document.createElement('input');input.type='file';input.id='scene-editor-external-import';input.accept='.tmj,.ldtk,.gltf,.glb,.canvas,application/json,model/gltf+json,model/gltf-binary';input.hidden=true;document.body.append(input);
  const esc=host.esc;
  function redraw():void{host.redraw();}
  function failed(value:unknown):void{error=value instanceof Error?value.message:String(value);notice='';host.toast(error,true);redraw();}
  function focus(action:string):void{document.querySelector<HTMLButtonElement>('[data-external-editor="'+action+'"]')?.focus();}
  function cancel():void{readId++;review=null;input.value='';}
  function preview():string{
   if(!review)return '';const before=review.baseline,after=review.result.pack;
   const changed:string[]=[];for(const category of ['worlds','scenes'] as const){for(const row of after[category]){const old=before[category].find(v=>v.id===row.id);if(!old)changed.push('Added '+(category==='worlds'?'world':'scene')+': '+row.name);else if(JSON.stringify(old)!==JSON.stringify(row))changed.push('Changed '+(category==='worlds'?'world':'scene')+': '+row.name);}for(const row of before[category])if(!after[category].some(v=>v.id===row.id))changed.push('Removed '+(category==='worlds'?'world':'scene')+': '+row.name);}
   const connections=after.scenes.reduce((sum,s)=>sum+(s.graph?.connections?.length??0),0),target=after.scenes.find(s=>s.id===review!.result.sceneId);
   return '<p>'+after.worlds.length+' worlds · '+after.scenes.length+' scenes · '+connections+' connections. Selected scene: '+esc(target?.name??review.result.sceneId)+'.</p>'+ (changed.length?'<ul>'+changed.map(message=>'<li>'+esc(message)+'</li>').join('')+'</ul>':'<p>Canonical pack data matches the current draft.</p>');
  }
  function render():string{
   const session=host.session(),id=host.sceneId(),ready=!!session&&!!id;
   const pending=review?`<section class="scene-editor-creation" role="region" aria-label="External conversion review"><h3>Review ${esc(review.result.format)} conversion</h3><p>The complete pack “${esc(review.result.pack.name)}” replaces this draft when applied. The active story stays paused in its existing state.</p>${preview()}<ul>${review.result.warnings.map(w=>'<li>'+esc(w)+'</li>').join('')}</ul><div class="scene-editor-actions"><button type="button" class="btn" data-external-editor="cancel">Cancel</button><button type="button" class="btn primary" data-external-editor="apply">Apply to draft</button></div></section>`:'';
   return `<details class="scene-editor-exchange scene-editor-details" data-external-editor-panel ${expanded||review||error?'open':''}><summary>External editor exchange <small>Tiled, LDtk, glTF and Obsidian Canvas</small></summary><div class="scene-editor-actions"><label>External editor<select data-external-editor-format>${root.LWExternalEditors.formats().map(f=>'<option value="'+f.id+'" '+(f.id===format?'selected':'')+'>'+esc(f.label)+'</option>').join('')}</select></label><button type="button" class="btn" data-external-editor="import" ${!ready?'disabled':''}>Import external file</button><button type="button" class="btn" data-external-editor="export" ${!ready?'disabled':''}>Export selected scene</button></div>${!ready?'<p>Select a scene to export its placements and complete canonical pack.</p>':''}<details class="scene-editor-details"><summary>Generic file entity mappings</summary><p>For files created elsewhere, use an entity mapping array, or an object with mappings, terrain and canvasMappings. Map each external type to an existing canonical entityId or a canonical templateId. Template instances need stable object names or EntityId fields. Inventory comes from that explicit native template.</p><label>Canonical mappings JSON<textarea data-external-editor-mappings rows="3" spellcheck="false">${esc(mappingText)}</textarea></label><p>Example: [{"externalType":"Worker","category":"creatures","templateId":"c1"}]</p></details>${error?'<p class="scene-editor-feedback is-error" role="alert">'+esc(error)+'</p>':''}${notice?'<p class="scene-editor-feedback" role="status">'+esc(notice)+'</p>':''}${pending}</details>`;
  }
  input.addEventListener('change',async()=>{
   const file=input.files?.[0],session=host.session(),sceneId=host.sceneId(),token=++readId;if(!file||!session||!sceneId)return;
   const revision=session.revision;review=null;error='';
   try{
    if(file.size>8*1024*1024)throw Error('External files must be at most 8 MiB.');
    const text=file.name.toLowerCase().endsWith('.glb')?new Uint8Array(await file.arrayBuffer()):await file.text();
    if(token!==readId||host.session()!==session||session.revision!==revision||host.modal()!=='scene-editor')return;
    const parsed:unknown=JSON.parse(mappingText);const settings=Array.isArray(parsed)?{mappings:parsed}:parsed;if(!settings||typeof settings!=='object')throw Error('Mappings must be a JSON array or an options object.');
    const baseline=session.snapshot(),result=root.LWExternalEditors.import(text,{...settings,pack:baseline,sceneId} as LWExternalEditors.Options);
    if(!result.ok)throw Error(result.errors.join('\n'));
    review={result,session,revision,baseline};notice='Conversion validated. Review the limitations before applying.';redraw();focus('cancel');
   }catch(value){if(token===readId&&host.modal()==='scene-editor')failed(value);}
   finally{input.value='';}
  });
  document.addEventListener('toggle',event=>{if(event.target instanceof HTMLDetailsElement&&event.target.matches('[data-external-editor-panel]'))expanded=event.target.open;},true);
  document.addEventListener('change',event=>{
   if(host.modal()!=='scene-editor'||!(event.target instanceof HTMLSelectElement)||!event.target.matches('[data-external-editor-format]'))return;
   format=event.target.value as LWExternalEditors.Format;
  });
  document.addEventListener('input',event=>{if(host.modal()==='scene-editor'&&event.target instanceof HTMLTextAreaElement&&event.target.matches('[data-external-editor-mappings]'))mappingText=event.target.value;});
  document.addEventListener('click',event=>{
   if(host.modal()!=='scene-editor'||!(event.target instanceof Element))return;
   const button=event.target.closest<HTMLButtonElement>('[data-external-editor]');if(!button||button.disabled)return;
   try{
    switch(button.dataset.externalEditor){
     case 'import':input.click();break;
     case 'cancel':cancel();notice='Conversion cancelled. Your draft is unchanged.';redraw();focus('import');break;
     case 'apply':if(!review)throw Error('Import a file for review first.');if(host.session()!==review.session||review.session.revision!==review.revision)throw Error('Draft changed after conversion. Import again to review the current draft.');review.session.replace(review.result.pack);host.onApplied?.(review.result.sceneId);notice='External conversion applied to the validated draft.';error='';cancel();redraw();focus('import');break;
     case 'export':{const session=host.session(),id=host.sceneId();if(!session||!id)throw Error('Select a scene to export.');const result=root.LWExternalEditors.export(session.export(),id,format);root.LWFiles.downloadJSON(result.document,result.filename);notice=result.warnings.join(' ');error='';redraw();focus('export');break;}
    }
   }catch(value){failed(value);}
  });
  return {render,cancel};
 }
 root.LWExternalEditorUI={create};
})(globalThis);
