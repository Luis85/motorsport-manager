/// <reference path="./pet-contracts.d.ts" />
/// <reference path="./embedded-app-contracts.d.ts" />
/** Browser composition: mount/retire the pet demo and route file intent into application admission. */
declare namespace LWPetHost {
 interface Surface extends LWEmbeddedApp.Surface {view:LWPetApplication.View;renderer():LWPetRenderer.Stats|null;useStore(adapter:unknown):void;unlock(sku:string):Promise<LWPetRuntime.Result>;}
 /** Detached page API installed as `window.WildlandsPet` by a shell or the standalone runner. */
 interface PublicApi {
  open():void;close():void;query():LWPetRuntime.Snapshot;command(input:unknown):LWPetRuntime.Result;checkpoint():LWPetRuntime.Checkpoint;catalog():LWPetData.Catalog;
  status():LWPetApplication.Status;control(action:'pause'|'resume'|'speed'|'restart',value?:number|{species:string;name?:string}):void;
  renderer():LWPetRenderer.Stats|null;useStore(adapter:unknown):void;unlock(sku:string):Promise<LWPetRuntime.Result>;
 }
 type Api=LWEmbeddedApp.Descriptor<Surface,PublicApi>;
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {
  LWPetApplication:LWPetApplication.Api;LWPetDemo:LWPetDemo.Api;LWPetHost?:LWPetHost.Api;LWPetAssetDefinitions?:unknown;LWPetStore:LWPetStore.Api;
  WildlandsPet?:LWPetHost.PublicApi;__wildlandsReady?:boolean;
  LWFiles:{downloadJSON(input:unknown,name:string):void};
 };
 function create(options:LWEmbeddedApp.Hooks):LWPetHost.Surface{
  const application=root.LWPetApplication.create(),view=application.view,assets=Array.isArray(root.LWPetAssetDefinitions)?root.LWPetAssetDefinitions as unknown[]:[];
  let surface:LWPetDemo.Surface|null=null,invoker:HTMLElement|null=null,ticket=0,paint=0,clock=0,store=root.LWPetStore.demo();
  const workspace=document.createElement('section');workspace.id='pet-mode';workspace.hidden=true;workspace.setAttribute('aria-label','Pocket Pet engine demonstration');
  const toolbar=document.createElement('div');toolbar.className='pet-exchange';
  toolbar.innerHTML='<button type="button" data-pet-file="save">Export checkpoint</button><button type="button" data-pet-file="catalog">Export game data</button><label>Import <select data-pet-import-kind><option value="checkpoint">Checkpoint</option><option value="catalog">Game data</option></select></label><button type="button" data-pet-file="load">Open JSON</button><span role="status" aria-live="polite" data-pet-file-status></span>';
  const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.id='pet-import-file';toolbar.append(file);
  const content=document.createElement('div');content.className='pet-play-surface';workspace.append(toolbar,content);document.body.append(workspace);
  const kind=toolbar.querySelector<HTMLSelectElement>('[data-pet-import-kind]')!,feedback=toolbar.querySelector<HTMLElement>('[data-pet-file-status]')!;
  function status(message:string,error=false):void{feedback.textContent=message;feedback.setAttribute('role',error?'alert':'status');}
  /** The store adapter reports a purchase; only a successful result becomes an entitlement command. */
  async function unlock(sku:string):Promise<LWPetRuntime.Result>{
   const adapter=store,lifecycle=ticket;
   let result:LWPetStore.Result;
   try{result=await adapter.purchase(sku);}catch(error){return {ok:false,message:adapter.name+' failed: '+(error instanceof Error?error.message:String(error))};}
   if(lifecycle!==ticket||!view.status().active)return {ok:false,message:'The pet demo closed before the store finished.'};
   if(!result||result.ok!==true||result.sku!==sku)return {ok:false,message:typeof result?.message==='string'?result.message:'The store did not unlock this product.'};
   return view.command({kind:'entitle',sku,source:adapter.id});
  }
  function mount():void{
   surface?.destroy();content.replaceChildren();
   surface=root.LWPetDemo.create({parent:content,catalog:view.catalog(),assets,speeds:root.LWPetApplication.SPEEDS,
    store,unlock,query:()=>view.query(),command:input=>view.command(input),status:()=>view.status(),
    control(action,value){if(action==='exit')close();else view.control(action,value);}});
   // A standalone page has no colony to return to; the exit control closes the pet instead.
   if(options.standalone){const exit=content.querySelector<HTMLButtonElement>('[data-pet=exit]');if(exit)exit.textContent='Close Pocket Pet';}
  }
  function open():void{
   if(view.status().active)return;
   invoker=document.activeElement instanceof HTMLElement?document.activeElement:null;
   options.beforeOpen();application.enter();document.body.classList.add('pet-active');workspace.hidden=false;
   mount();workspace.querySelector<HTMLButtonElement>('#pet-demo [data-pet-action]')?.focus();
  }
  function close():void{
   ticket++;application.exit();surface?.destroy();surface=null;content.replaceChildren();
   workspace.hidden=true;document.body.classList.remove('pet-active');options.afterClose();invoker?.focus();
  }
  toolbar.addEventListener('click',event=>{
   const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-pet-file]'):null;if(!target)return;
   try{
    if(target.dataset.petFile==='save'){root.LWFiles.downloadJSON(view.checkpoint(),'wildlands-pet.checkpoint.json');status('Checkpoint exported.');}
    else if(target.dataset.petFile==='catalog'){root.LWFiles.downloadJSON(view.catalog(),'wildlands-pet.game.json');status('Editable game data exported.');}
    else{ticket++;file.click();}
   }catch(error){status(error instanceof Error?error.message:String(error),true);}
  });
  file.addEventListener('change',async()=>{
   const selected=file.files?.[0],mine=++ticket,chosen=kind.value==='catalog'?'catalog' as const:'checkpoint' as const;file.value='';
   if(!selected||!view.status().active)return;
   try{
    if(selected.size>4*1024*1024)throw Error('Choose a JSON file smaller than 4 MiB.');
    const input=JSON.parse(await selected.text()) as unknown;
    if(mine!==ticket||!view.status().active)return;
    view.replace(input,chosen);mount();status('Imported and paused. Resume when you are ready.');
   }catch(error){if(mine===ticket)status('Import rejected; your pet is unchanged. '+(error instanceof Error?error.message:String(error)),true);}
  });
  return {open,close,view,unlock,get active(){return view.status().active;},renderer:()=>surface?.renderer.stats()??null,
   useStore(adapter){store=root.LWPetStore.validate(adapter);if(surface)mount();},
   advance(seconds){
    if(!view.status().active)return;
    try{application.advance(seconds);}catch(error){status(error instanceof Error?error.message:String(error),true);}
    clock+=seconds;paint+=seconds;surface?.draw(clock,seconds);
    if(paint>=.25){paint=0;surface?.refresh();}
   }
  };
 }
 function api(surface:LWPetHost.Surface):LWPetHost.PublicApi{
  const view=surface.view;
  return Object.freeze({open:()=>surface.open(),close:()=>surface.close(),query:()=>view.query(),command:(input:unknown)=>view.command(input),checkpoint:()=>view.checkpoint(),catalog:()=>view.catalog(),status:()=>view.status(),
   control:(action:'pause'|'resume'|'speed'|'restart',value?:number|{species:string;name?:string})=>view.control(action,value),renderer:()=>surface.renderer(),useStore:(adapter:unknown)=>surface.useStore(adapter),unlock:(sku:string)=>surface.unlock(sku)});
 }
 function install(surface:LWPetHost.Surface):LWPetHost.PublicApi{const installed=api(surface);root.WildlandsPet=installed;return installed;}
 let standaloneSurface:LWPetHost.Surface|null=null;
 /** Run the Pocket Pet application as the whole page: own frame loop, no colony shell. */
 function standalone(options:LWEmbeddedApp.StandaloneOptions={}):LWPetHost.Surface{
  if(standaloneSurface)return standaloneSurface;
  let launcher:HTMLElement|null=null;
  function showLauncher():void{
   launcher=document.createElement('main');launcher.className='embedded-app-closed';launcher.style.cssText='padding:24px;font:16px/1.5 system-ui,sans-serif';
   const heading=document.createElement('h1');heading.textContent='Pocket Pet';heading.style.fontSize='22px';
   const button=document.createElement('button');button.type='button';button.dataset.wildlandsPet='open';button.textContent='Open Pocket Pet';button.style.cssText='min-height:44px;padding:8px 16px;font:inherit';
   button.addEventListener('click',()=>surface.open());launcher.append(heading,button);document.body.append(launcher);button.focus();
  }
  const surface=create({beforeOpen(){launcher?.remove();launcher=null;},afterClose:showLauncher,standalone:true});
  standaloneSurface=surface;document.body.classList.add('pet-standalone');
  install(surface);
  if(options.autoOpen===false)showLauncher();else surface.open();
  let last=performance.now();
  const frame=(now:number):void=>{const seconds=Math.max(0,Math.min((now-last)/1000,.1));last=now;if(!document.hidden&&surface.active)surface.advance(seconds);requestAnimationFrame(frame);};
  requestAnimationFrame(frame);
  ready('pet');
  return surface;
 }
 function ready(host:string):void{
  root.__wildlandsReady=true;document.documentElement.dataset.wildlandsReady=host;
  dispatchEvent(new CustomEvent<LWEmbeddedApp.ReadyDetail>('wildlands:ready',{detail:{host}}));
 }
 const descriptor:LWPetHost.Api=Object.freeze({id:'pet',label:'Pet demo',launcher:'wildlandsPet',global:'WildlandsPet',create,api,install,standalone});
 root.LWPetHost=descriptor;
})(globalThis);
