/// <reference path="./engine-export-contracts.d.ts" />
/// <reference path="./scene-editor-contracts.d.ts" />
/** Local export intent; the detached editor session remains the authoring authority. */
declare namespace LWEngineExportUI {
 interface Host {session():LWSceneEditor.Session|null;sceneId():string|undefined;modal():string|null;redraw():void;toast(message:string,error?:boolean):void;esc(value:unknown):string;}
 interface Surface {render():string;cancel():void;}
 interface Api {create(host:Host):Surface;}
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWEngineExport:LWEngineExport.Api;LWEngineExportUI?:LWEngineExportUI.Api;LWFiles:{downloadJSON(value:unknown,name:string):void}};
 function create(host:LWEngineExportUI.Host):LWEngineExportUI.Surface{
  let busy=false,token=0,expanded=false,notice='',error='';
  function cancel():void{token++;busy=false;}
  function render():string{const ready=!!host.session()&&!!host.sceneId();return `<details class="scene-editor-details" data-engine-export-panel ${expanded||busy||error?'open':''}><summary>Engine and code generator export</summary><p>Download the complete canonical pack, checkpoints, assets, rules, contracts, exact engine sources, TypeScript compiler/declarations and locked dependency metadata as inert JSON, with SHA-256 inventory and Godot binding guidance. Porting systems and platform UI still requires reviewed code generation.</p><button type="button" class="btn" data-engine-export-download ${!ready||busy?'disabled':''}>${busy?'Preparing engine export…':'Export engine JSON'}</button>${!ready?'<p>Select a validated scene first.</p>':''}${notice?'<p role="status">'+host.esc(notice)+'</p>':''}${error?'<p class="is-error" role="alert">'+host.esc(error)+'</p>':''}</details>`;}
  document.addEventListener('toggle',event=>{if(event.target instanceof HTMLDetailsElement&&event.target.matches('[data-engine-export-panel]'))expanded=event.target.open;},true);
  document.addEventListener('click',async event=>{
   if(host.modal()!=='scene-editor'||!(event.target instanceof Element)||!event.target.closest('[data-engine-export-download]')||busy)return;
   const session=host.session(),sceneId=host.sceneId();if(!session||!sceneId)return;
   const current=++token,revision=session.revision;busy=true;error='';notice='';host.redraw();
   try{const exchanged=await root.LWEngineExport.export(session.export(),sceneId);if(current!==token||host.modal()!=='scene-editor'||host.session()!==session||session.revision!==revision)return;root.LWFiles.downloadJSON(exchanged,exchanged.pack.id+'.engine.json');notice='Exported '+exchanged.sources.files.length+' source files; identity '+exchanged.sourceIdentity.slice(0,12)+'….';}
   catch(value){if(current!==token)return;error=value instanceof Error?value.message:String(value);host.toast(error,true);}
   finally{if(current===token){busy=false;host.redraw();document.querySelector<HTMLButtonElement>('[data-engine-export-download]')?.focus();}}
  });
  return {render,cancel};
 }
 root.LWEngineExportUI={create};
})(globalThis);
