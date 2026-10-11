/// <reference path="./armored-presentation-contracts.d.ts" />
/** Browser composition owns elapsed-time delivery and storage adapters, not presentation rules. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {
  LWContentProvider:{get(label?:string):{armored?:LWArmoredData.Catalog;armoredVisuals?:{assets:LWArmoredPresentation.Models}}};
  LWArmoredApplication:{create(catalog:LWArmoredData.Catalog,mission?:string):LWArmoredRuntime.Application};
  LWArmoredRenderer:{create(canvas:HTMLCanvasElement,catalog:LWArmoredData.Catalog,mission:LWArmoredData.Mission,models:LWArmoredPresentation.Models,camera:LWArmoredPresentation.Camera,lost:()=>void):LWArmoredPresentation.Surface};
  LWArmoredUI:{create(parent:HTMLElement,catalog:LWArmoredData.Catalog,hooks:LWArmoredPresentation.Hooks):LWArmoredPresentation.UI};
  LWArmoredControls:{create(canvas:HTMLCanvasElement,hooks:LWArmoredPresentation.Hooks,ui:LWArmoredPresentation.UI,catalog:LWArmoredData.Catalog):LWArmoredPresentation.Controls};
  LWArmoredAudio:{create():LWArmoredPresentation.Audio};LWArmoredHost?:unknown;WildlandsArmored?:unknown;__wildlandsReady?:boolean;
 };
 function boot():void {
  const parent=document.getElementById('armored-app');if(!parent)return;
  const content=root.LWContentProvider.get('Armored Platoon'),catalog=content.armored,models=content.armoredVisuals?.assets;
  if(!catalog||!models)throw Error('The armored catalog and visual asset pack must be installed by the Wildlands content provider.');
  let application=root.LWArmoredApplication.create(catalog),renderer:LWArmoredPresentation.Surface|null=null,ui:LWArmoredPresentation.UI,controls:LWArmoredPresentation.Controls|null=null;
  let previousTime=0,frame=0,destroyed=false,lastHudTime=0;
  const canvas=document.createElement('canvas');canvas.id='armored-canvas';canvas.tabIndex=0;canvas.setAttribute('aria-label','Tank battlefield. W A S D to drive. Click to capture mouse. Escape to pause.');
  parent.replaceChildren(canvas);const audio=root.LWArmoredAudio.create(),storageKey='wildlands.armored-platoon.checkpoint.v1',lifecycle=new AbortController();
  const hooks:LWArmoredPresentation.Hooks={
   query:()=>application.view.query(),command:input=>application.view.command(input),paused:()=>application.view.status().paused,
   control(action){if(action==='pause'&&!application.view.status().paused)controls?.release();application.view.control(action);if(action==='resume')audio.activate();},
   save(){try{localStorage.setItem(storageKey,JSON.stringify(application.view.checkpoint()));ui.notice('Checkpoint saved in this browser.');}catch(error){ui.notice('Checkpoint could not be saved. Browser storage may be full or disabled. '+String(error),true);}},
   load(){try{const json=localStorage.getItem(storageKey);if(!json){ui.notice('No checkpoint is saved in this browser.',true);return;}restore(JSON.parse(json));ui.notice('Checkpoint restored. Resume when ready.');}catch(error){ui.notice('Checkpoint could not be loaded. Your current match is retained. '+String(error),true);}},
   mission(id){const candidate=root.LWArmoredApplication.create(catalog,id);candidate.enter();candidate.view.control('pause');controls?.release();application.exit();application=candidate;mountRenderer();}
  };
  function mountRenderer():void {
   const mission=catalog!.missions.find(item=>item.id===application.view.query().missionId);if(!mission)throw Error('Checkpoint mission is absent from the installed catalog.');
   renderer?.destroy();renderer=root.LWArmoredRenderer.create(canvas,catalog!,mission,models!,ui.camera(),()=>{hooks.control('pause');ui.screen('pause');ui.notice('Graphics context interrupted. Reload this page and restore your checkpoint to recover.',true);});
  }
  function restore(value:unknown):void {
   // Application admission is staged; invalid data cannot retire the current match.
   if(!value||typeof value!=='object'||JSON.stringify((value as {catalog?:unknown}).catalog)!==JSON.stringify(catalog))throw Error('Checkpoint content differs from the installed game pack. Load it with the matching build.');
   const previous=application.view.query().missionId;application.view.replace(value);controls?.reset();
   if(application.view.query().missionId!==previous)mountRenderer();ui.screen('pause');
  }
  application.enter();application.view.control('pause');ui=root.LWArmoredUI.create(parent,catalog,hooks);mountRenderer();controls=root.LWArmoredControls.create(canvas,hooks,ui,catalog);
  parent.addEventListener('pointerdown',()=>audio.activate(),{signal:lifecycle.signal});
  parent.addEventListener('keydown',()=>audio.activate(),{signal:lifecycle.signal});
  function draw(timestamp:number):void {
   if(destroyed)return;const seconds=previousTime?Math.min(.1,(timestamp-previousTime)/1000):0;previousTime=timestamp;
   try{
    const before=application.view.query();controls?.update(before,seconds);application.advance(seconds);const snapshot=application.view.query();renderer?.render(snapshot,application.view.status().paused?0:seconds);
    if(timestamp-lastHudTime>=100||application.view.status().paused){ui.render(snapshot,seconds);lastHudTime=timestamp;}audio.render(snapshot,application.view.status().paused);root.__wildlandsReady=true;document.documentElement.dataset.wildlandsReady='armored';
   }catch(error){hooks.control('pause');ui.screen('pause');ui.notice('Battle interrupted: '+String(error),true);}
   frame=requestAnimationFrame(draw);
  }
  frame=requestAnimationFrame(draw);
  root.WildlandsArmored={query:()=>application.view.query(),command:(command:LWArmoredRuntime.Command)=>application.view.command(command),checkpoint:()=>application.view.checkpoint(),status:()=>application.view.status(),control:(action:'pause'|'resume'|'restart')=>{hooks.control(action);ui.screen(action==='pause'?'pause':'battle');},restore,
   destroy(){destroyed=true;cancelAnimationFrame(frame);lifecycle.abort();controls?.destroy();renderer?.destroy();ui.destroy();audio.destroy();application.exit();parent.replaceChildren();root.__wildlandsReady=false;}};
 }
 root.LWArmoredHost={boot};
 if(typeof document!=='undefined'&&document.documentElement.dataset.wildlandsApp==='armored'){
  const start=()=>{try{boot();}catch(error){const parent=document.getElementById('armored-app');if(parent){parent.replaceChildren();const message=document.createElement('div');message.className='ap-fatal';const heading=document.createElement('h1');heading.textContent='The battlefield could not start';const detail=document.createElement('p');detail.textContent=String(error)+' Check WebGL2 support and rebuild the complete game pack.';message.append(heading,detail);parent.append(message);}}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 }
})(typeof globalThis!=='undefined'?globalThis:this);
