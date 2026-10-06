/// <reference path="./pet-contracts.d.ts" />
/** Browser composition: mount/retire the pet demo and route file intent into application admission. */
declare namespace LWPetHost {
 interface Surface {open():void;close():void;advance(seconds:number):void;readonly active:boolean;view:LWPetApplication.View;renderer():LWPetRenderer.Stats|null;}
 interface Api {create(options:{beforeOpen():void;afterClose():void}):Surface;}
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {
  LWPetApplication:LWPetApplication.Api;LWPetDemo:LWPetDemo.Api;LWPetHost?:LWPetHost.Api;LWPetAssetDefinitions?:unknown;
  LWFiles:{downloadJSON(input:unknown,name:string):void};
 };
 function create(options:{beforeOpen():void;afterClose():void}):LWPetHost.Surface{
  const application=root.LWPetApplication.create(),view=application.view,assets=Array.isArray(root.LWPetAssetDefinitions)?root.LWPetAssetDefinitions as unknown[]:[];
  let surface:LWPetDemo.Surface|null=null,invoker:HTMLElement|null=null,ticket=0,paint=0,clock=0;
  const workspace=document.createElement('section');workspace.id='pet-mode';workspace.hidden=true;workspace.setAttribute('aria-label','Pocket Pet engine demonstration');
  const toolbar=document.createElement('div');toolbar.className='pet-exchange';
  toolbar.innerHTML='<button type="button" data-pet-file="save">Export checkpoint</button><button type="button" data-pet-file="catalog">Export game data</button><label>Import <select data-pet-import-kind><option value="checkpoint">Checkpoint</option><option value="catalog">Game data</option></select></label><button type="button" data-pet-file="load">Open JSON</button><span role="status" aria-live="polite" data-pet-file-status></span>';
  const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.id='pet-import-file';toolbar.append(file);
  const content=document.createElement('div');content.className='pet-play-surface';workspace.append(toolbar,content);document.body.append(workspace);
  const kind=toolbar.querySelector<HTMLSelectElement>('[data-pet-import-kind]')!,feedback=toolbar.querySelector<HTMLElement>('[data-pet-file-status]')!;
  function status(message:string,error=false):void{feedback.textContent=message;feedback.setAttribute('role',error?'alert':'status');}
  function mount():void{
   surface?.destroy();content.replaceChildren();
   surface=root.LWPetDemo.create({parent:content,catalog:view.catalog(),assets,speeds:root.LWPetApplication.SPEEDS,
    query:()=>view.query(),command:input=>view.command(input),status:()=>view.status(),
    control(action,value){if(action==='exit')close();else view.control(action,value);}});
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
  return {open,close,view,get active(){return view.status().active;},renderer:()=>surface?.renderer.stats()??null,
   advance(seconds){
    if(!view.status().active)return;
    try{application.advance(seconds);}catch(error){status(error instanceof Error?error.message:String(error),true);}
    clock+=seconds;paint+=seconds;surface?.draw(clock,seconds);
    if(paint>=.25){paint=0;surface?.refresh();}
   }
  };
 }
 root.LWPetHost={create};
})(globalThis);
