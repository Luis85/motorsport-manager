/// <reference path="./rts-demo-contracts.d.ts" />
/// <reference path="./rts-runtime-contracts.d.ts" />
/** Browser composition: mount/retire the demo and route file intent into application admission. */
declare namespace LWRTSHost {
 interface Surface {open():void;close():void;advance(seconds:number):void;readonly active:boolean;view:LWRTSApplication.View;}
 interface Api {create(options:{beforeOpen():void;afterClose():void}):Surface;}
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {
  LWRTSApplication:LWRTSApplication.Api;LWRTSDemo:LWRTSDemo.Api;LWRTSHost?:LWRTSHost.Api;
  LWFiles:{downloadJSON(input:unknown,name:string):void};
 };
 function create(options:{beforeOpen():void;afterClose():void}):LWRTSHost.Surface {
  const application=root.LWRTSApplication.create(),view=application.view;
  let surface:LWRTSDemo.Surface|null=null,invoker:HTMLElement|null=null,revision=0,paintDebt=0;
  const workspace=document.createElement('section');workspace.id='rts-mode';workspace.hidden=true;
  workspace.setAttribute('aria-label','RTS engine demonstration');
  const toolbar=document.createElement('div');toolbar.className='rts-exchange';
  toolbar.innerHTML='<label>Mission <select data-rts-mission></select></label><button type="button" data-rts-file="mission">Start mission</button><button type="button" data-rts-file="save">Export checkpoint</button><button type="button" data-rts-file="catalog">Export game data</button><label>Import <select data-rts-import-kind><option value="catalog">Game data</option><option value="checkpoint">Checkpoint</option></select></label><button type="button" data-rts-file="load">Open JSON</button><span role="status" aria-live="polite" data-rts-file-status></span>';
  const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.id='rts-import-file';
  toolbar.append(file);workspace.append(toolbar);
  const content=document.createElement('div');content.className='rts-play-surface';workspace.append(content);document.body.append(workspace);
  const missions=toolbar.querySelector<HTMLSelectElement>('[data-rts-mission]')!,kind=toolbar.querySelector<HTMLSelectElement>('[data-rts-import-kind]')!,feedback=toolbar.querySelector<HTMLElement>('[data-rts-file-status]')!;
  function status(message:string,error=false):void {feedback.textContent=message;feedback.setAttribute('role',error?'alert':'status');}
  function syncMissions():void {
   missions.replaceChildren(...view.catalog().missions.map(mission=>{const option=document.createElement('option');option.value=mission.id;option.textContent=mission.name;return option;}));
   missions.value=view.status().mission;
  }
  function query():LWRTSDemo.Snapshot {
   const snapshot=view.query(),player=snapshot.playerFaction;
   return {...snapshot,fog:{visible:snapshot.fog.visible[player]??[],explored:snapshot.fog.explored[player]??[]}};
  }
  function mount():void {
   surface?.destroy();content.replaceChildren();
   surface=root.LWRTSDemo.create({parent:content,query,
    command(input){const result=view.command({...input});return {ok:result.ok,...(!result.ok?{reason:result.message}:{})};},
    control(action,value){if(action==='exit')close();else {view.control(action,value);surface?.refresh();}},
    paused:()=>view.status().paused,speed:()=>view.status().speed});
   syncMissions();
  }
  function open():void {
   if(application.view.status().active)return;
   invoker=document.activeElement instanceof HTMLElement?document.activeElement:null;
   options.beforeOpen();application.enter();document.body.classList.add('rts-active');workspace.hidden=false;
   paintDebt=0;mount();workspace.querySelector<HTMLButtonElement>('button')?.focus();
  }
  function close():void {
   revision++;application.exit();surface?.destroy();surface=null;content.replaceChildren();
   workspace.hidden=true;document.body.classList.remove('rts-active');options.afterClose();invoker?.focus();
  }
  toolbar.addEventListener('click',event=>{
   const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-rts-file]'):null;
   if(!target)return;
   try{
    switch(target.dataset.rtsFile){
     case 'save':root.LWFiles.downloadJSON(view.checkpoint(),'wildlands-rts.checkpoint.json');status('Checkpoint exported.');break;
     case 'catalog':root.LWFiles.downloadJSON(view.catalog(),'wildlands-rts.game.json');status('Editable game data exported.');break;
     case 'load':file.click();break;
     case 'mission':view.replace(view.catalog(),'catalog',missions.value);mount();status('Mission ready. Resume when you are ready.');break;
    }
   }catch(error){status(error instanceof Error?error.message:String(error),true);}
  });
  file.addEventListener('change',async()=>{
   const selected=file.files?.[0],intent=kind.value==='checkpoint'?'checkpoint':'catalog',ticket=++revision;
   file.value='';if(!selected)return;
   try{
    if(selected.size>4*1024*1024)throw Error('Choose a JSON file smaller than 4 MiB.');
    const input=JSON.parse(await selected.text()) as unknown;
    if(ticket!==revision||!view.status().active)return;
    view.replace(input,intent);mount();status('Imported and paused. Resume when you are ready.');
   }catch(error){if(ticket===revision)status(error instanceof Error?error.message:String(error),true);}
  });
  return {open,close,view,get active(){return view.status().active;},
   advance(seconds){if(!view.status().active)return;try{application.advance(seconds);if(view.status().paused){paintDebt=0;return;}paintDebt+=seconds;if(paintDebt>=1/30){paintDebt=0;surface?.refresh();}}catch(error){status(error instanceof Error?error.message:String(error),true);}}
  };
 }
 root.LWRTSHost={create};
})(globalThis);
