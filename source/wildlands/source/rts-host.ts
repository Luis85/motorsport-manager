/// <reference path="./rts-demo-contracts.d.ts" />
/// <reference path="./rts-runtime-contracts.d.ts" />
/// <reference path="./rts-mission-editor-ui-contracts.d.ts" />
/// <reference path="./embedded-app-contracts.d.ts" />
/** Browser composition: mount/retire the demo and route file intent into application admission. */
declare namespace LWRTSHost {
 interface Surface extends LWEmbeddedApp.Surface {view:LWRTSApplication.View;editorQuery():LWRTSMissionEditor.Snapshot|null;}
 /** Detached page API installed as `window.WildlandsRTS` by a shell or the standalone runner. */
 interface PublicApi {open():void;close():void;query():LWRTSRuntime.Snapshot;command(input:LWRTSRuntime.Command):LWRTSRuntime.Result;checkpoint():LWRTSRuntime.Data;catalog():LWRTSData.Catalog;status():LWRTSApplication.Status;editorQuery():LWRTSMissionEditor.Snapshot|null;}
 type Api=LWEmbeddedApp.Descriptor<Surface,PublicApi>;
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {
  LWRTSApplication:LWRTSApplication.Api;LWRTSDemo:LWRTSDemo.Api;LWRTSHost?:LWRTSHost.Api;
  WildlandsRTS?:LWRTSHost.PublicApi;__wildlandsReady?:boolean;
  LWRTSMissionEditor?:LWRTSMissionEditor.Api;LWRTSMissionEditorUI?:LWRTSMissionEditorUI.Api;
  LWFiles:{downloadJSON(input:unknown,name:string):void};
 };
 const EDITOR_UNAVAILABLE='The mission editor is unavailable in this build: the RTS mission editor bundle is not included.';
 function create(options:LWEmbeddedApp.Hooks):LWRTSHost.Surface {
  const application=root.LWRTSApplication.create(),view=application.view;
  let surface:LWRTSDemo.Surface|null=null,invoker:HTMLElement|null=null,revision=0,paintDebt=0;
  let editor:LWRTSMissionEditor.Session|null=null,editorSurface:LWRTSMissionEditorUI.Surface|null=null,editing=false;
  let fileIntent:{ticket:number;editing:boolean;kind:'catalog'|'checkpoint';editorRevision?:number}|null=null;
  const workspace=document.createElement('section');workspace.id='rts-mode';workspace.hidden=true;
  workspace.setAttribute('aria-label','RTS engine demonstration');
  const toolbar=document.createElement('div');toolbar.className='rts-exchange';
  toolbar.innerHTML='<label>Mission <select data-rts-mission></select></label><button type="button" data-rts-file="mission">Start mission</button><button type="button" data-rts-file="save">Export checkpoint</button><button type="button" data-rts-file="catalog">Export game data</button><label>Import <select data-rts-import-kind><option value="catalog">Game data</option><option value="checkpoint">Checkpoint</option></select></label><button type="button" data-rts-file="load">Open JSON</button><span role="status" aria-live="polite" data-rts-file-status></span>';
  const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.id='rts-import-file';
  toolbar.append(file);workspace.append(toolbar);
  const editButton=document.createElement('button');editButton.type='button';editButton.dataset.rtsFile='editor';editButton.textContent='Mission editor';toolbar.prepend(editButton);
  // The mission editor is an optional bundle: without it the launcher stays focusable with an explicit reason.
  const editorAvailable=():boolean=>!!root.LWRTSMissionEditor&&!!root.LWRTSMissionEditorUI;
  if(!editorAvailable()){
   const reason=document.createElement('span');reason.id='rts-editor-unavailable';reason.className='rts-unavailable';reason.textContent=EDITOR_UNAVAILABLE;
   editButton.setAttribute('aria-disabled','true');editButton.setAttribute('aria-describedby',reason.id);editButton.after(reason);
  }
  const content=document.createElement('div');content.className='rts-play-surface';workspace.append(content);document.body.append(workspace);
  const missions=toolbar.querySelector<HTMLSelectElement>('[data-rts-mission]')!,kind=toolbar.querySelector<HTMLSelectElement>('[data-rts-import-kind]')!,feedback=toolbar.querySelector<HTMLElement>('[data-rts-file-status]')!;
  function status(message:string,error=false):void {feedback.textContent=message;feedback.setAttribute('role',error?'alert':'status');}
  function requestFile():void {
   const editorRevision=editor?.query().revision;
   fileIntent={ticket:++revision,editing,kind:kind.value==='checkpoint'?'checkpoint':'catalog',...(editorRevision===undefined?{}:{editorRevision})};
   file.click();
  }
  function syncMissions():void {
   missions.replaceChildren(...view.catalog().missions.map(mission=>{const option=document.createElement('option');option.value=mission.id;option.textContent=mission.name;return option;}));
   missions.value=view.status().mission;
  }
  function query():LWRTSDemo.Snapshot {
   const snapshot=view.query(),player=snapshot.playerFaction;
   return {...snapshot,fog:{visible:snapshot.fog.visible[player]??[],explored:snapshot.fog.explored[player]??[]}};
  }
  function mount():void {
   editorSurface?.destroy();editorSurface=null;editing=false;toolbar.hidden=false;
   surface?.destroy();content.replaceChildren();
   surface=root.LWRTSDemo.create({parent:content,query,
    command(input){const result=view.command({...input});return {ok:result.ok,...(!result.ok?{reason:result.message}:{})};},
    control(action,value){if(action==='exit')close();else {view.control(action,value);surface?.refresh();}},
    paused:()=>view.status().paused,speed:()=>view.status().speed});
   // A standalone page has no colony to return to; the exit control closes the demo instead.
   if(options.standalone){const exit=content.querySelector<HTMLButtonElement>('[data-rts=exit]');if(exit)exit.textContent='Close RTS demo';}
   syncMissions();
  }
  function mountEditor():void {
   const editorApi=root.LWRTSMissionEditor,editorUI=root.LWRTSMissionEditorUI;
   if(!editorApi||!editorUI)throw Error(EDITOR_UNAVAILABLE);
   // Stage authoring admission before retiring the retained match presentation.
   const admitted=editor??editorApi.create(view.catalog(),view.status().mission);
   revision++;surface?.destroy();surface=null;content.replaceChildren();paintDebt=0;
   editor=admitted;
   editing=true;toolbar.hidden=true;
   editorSurface=editorUI.create({parent:content,editor,
    onExit(){revision++;mount();editButton.focus();},
    onPlay(){
     if(!editor)return;
     view.replace(editor.exportCatalog(),'catalog',editor.query().mission.id);
     revision++;mount();status('Authored mission ready. Resume when you are ready.');
     workspace.querySelector<HTMLButtonElement>('[data-rts=pause]')?.focus();
    },
    onExport(){if(editor)root.LWFiles.downloadJSON(editor.exportCatalog(),'wildlands-rts.game.json');},
    onImport:requestFile
   });
  }
  function open():void {
   if(application.view.status().active)return;
   invoker=document.activeElement instanceof HTMLElement?document.activeElement:null;
   options.beforeOpen();application.enter();document.body.classList.add('rts-active');workspace.hidden=false;
   paintDebt=0;mount();workspace.querySelector<HTMLButtonElement>('button')?.focus();
  }
  function close():void {
   revision++;application.exit();surface?.destroy();surface=null;editorSurface?.destroy();editorSurface=null;editing=false;toolbar.hidden=false;content.replaceChildren();
   workspace.hidden=true;document.body.classList.remove('rts-active');options.afterClose();invoker?.focus();
  }
  toolbar.addEventListener('click',event=>{
   const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-rts-file]'):null;
   if(!target)return;
   try{
    switch(target.dataset.rtsFile){
     case 'editor':mountEditor();break;
     case 'save':root.LWFiles.downloadJSON(view.checkpoint(),'wildlands-rts.checkpoint.json');status('Checkpoint exported.');break;
     case 'catalog':root.LWFiles.downloadJSON(view.catalog(),'wildlands-rts.game.json');status('Editable game data exported.');break;
     case 'load':requestFile();break;
     case 'mission':view.replace(view.catalog(),'catalog',missions.value);mount();status('Mission ready. Resume when you are ready.');break;
    }
   }catch(error){status(error instanceof Error?error.message:String(error),true);}
  });
  file.addEventListener('change',async()=>{
   const selected=file.files?.[0];
   // Programmatic file adapters may supply a file directly; native picker requests retain their initiating context.
   const intent=fileIntent??{ticket:++revision,editing,kind:kind.value==='checkpoint'?'checkpoint' as const:'catalog' as const,editorRevision:editor?.query().revision};
   fileIntent=null;
   const ticket=intent.ticket,editorIntent=intent.editing,editorRevision=intent.editorRevision;
   file.value='';if(!selected)return;
   if(ticket!==revision||editorIntent!==editing||!view.status().active)return;
   try{
    if(selected.size>4*1024*1024)throw Error('Choose a JSON file smaller than 4 MiB.');
    const input=JSON.parse(await selected.text()) as unknown;
    if(ticket!==revision||!view.status().active)return;
    if(editorIntent&&editor){
     const result=editor.command({action:'import-catalog',revision:editorRevision,catalog:input});
     if(!result.ok)throw Error(result.message);
     editorSurface?.refresh();
     editorSurface?.feedback('Imported game data into the mission draft. Your retained match is unchanged.');
    }else {view.replace(input,intent.kind);mount();status('Imported and paused. Resume when you are ready.');}
   }catch(error){if(ticket===revision){
    const message=error instanceof Error?error.message:String(error);
    if(editorIntent)editorSurface?.feedback('Import rejected. Your draft and retained match are unchanged. Choose a complete exported RTS game data JSON file. '+message,true);
    else status(message,true);
   }}
  });
  return {open,close,view,editorQuery:()=>editor?.query()??null,get active(){return view.status().active;},
   advance(seconds){if(!view.status().active||editing)return;try{application.advance(seconds);if(view.status().paused){paintDebt=0;return;}paintDebt+=seconds;if(paintDebt>=1/30){paintDebt=0;surface?.refresh();}}catch(error){status(error instanceof Error?error.message:String(error),true);}}
  };
 }
 function api(surface:LWRTSHost.Surface):LWRTSHost.PublicApi {
  const view=surface.view;
  return Object.freeze({open:()=>surface.open(),close:()=>surface.close(),query:()=>view.query(),command:(input:LWRTSRuntime.Command)=>view.command(input),checkpoint:()=>view.checkpoint(),catalog:()=>view.catalog(),status:()=>view.status(),editorQuery:()=>surface.editorQuery()});
 }
 function install(surface:LWRTSHost.Surface):LWRTSHost.PublicApi {const installed=api(surface);root.WildlandsRTS=installed;return installed;}
 let standaloneSurface:LWRTSHost.Surface|null=null;
 /** Run the RTS application as the whole page: own frame loop, no colony shell. */
 function standalone(options:LWEmbeddedApp.StandaloneOptions={}):LWRTSHost.Surface {
  if(standaloneSurface)return standaloneSurface;
  let launcher:HTMLElement|null=null;
  function showLauncher():void {
   launcher=document.createElement('main');launcher.className='embedded-app-closed';launcher.style.cssText='padding:24px;font:16px/1.5 system-ui,sans-serif';
   const heading=document.createElement('h1');heading.textContent='RTS demo';heading.style.fontSize='22px';
   const button=document.createElement('button');button.type='button';button.dataset.wildlandsRts='open';button.textContent='Open the RTS demo';button.style.cssText='min-height:44px;padding:8px 16px;font:inherit';
   button.addEventListener('click',()=>surface.open());launcher.append(heading,button);document.body.append(launcher);button.focus();
  }
  const surface=create({beforeOpen(){launcher?.remove();launcher=null;},afterClose:showLauncher,standalone:true});
  standaloneSurface=surface;document.body.classList.add('rts-standalone');
  install(surface);
  if(options.autoOpen===false)showLauncher();else surface.open();
  let last=performance.now();
  const frame=(now:number):void=>{const seconds=Math.max(0,Math.min((now-last)/1000,.1));last=now;if(!document.hidden&&surface.active)surface.advance(seconds);requestAnimationFrame(frame);};
  requestAnimationFrame(frame);
  ready('rts');
  return surface;
 }
 function ready(host:string):void {
  root.__wildlandsReady=true;document.documentElement.dataset.wildlandsReady=host;
  dispatchEvent(new CustomEvent<LWEmbeddedApp.ReadyDetail>('wildlands:ready',{detail:{host}}));
 }
 const descriptor:LWRTSHost.Api=Object.freeze({id:'rts',label:'RTS demo',launcher:'wildlandsRts',global:'WildlandsRTS',create,api,install,standalone});
 root.LWRTSHost=descriptor;
})(globalThis);
