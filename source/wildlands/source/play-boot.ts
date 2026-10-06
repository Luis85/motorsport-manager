/* Standalone template composition: mount exactly one game host without the colony shell.
 * Selected by <html data-wildlands-app>. It only calls the hosts' public create/open/advance
 * surface; time advances from animation frames exactly as in the colony shell. A missing or
 * failing host degrades to an accessible message instead of an uncaught boot error.
 * The game API (same shape as the shell's WildlandsRTS/WildlandsPet) is published as
 * WildlandsPlay.game; the shell keeps sole ownership of those two global names. */
declare namespace LWPlayBoot {
 /** Published as globalThis.WildlandsPlay once boot finishes; a readiness signal for tests and tools. */
 interface Ready {readonly app:string;readonly ready:boolean;readonly error?:string;readonly game?:object;}
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {
  LWRTSHost?:LWRTSHost.Api;LWPetHost?:LWPetHost.Api;LWRTSMissionEditorUI?:unknown;
  WildlandsPlay?:LWPlayBoot.Ready;
 };
 const app=document.documentElement.dataset.wildlandsApp??'';
 const status=document.getElementById('play-status'),resume=document.getElementById('play-resume');
 function say(message:string,error=false):void{
  if(!status)return;status.textContent=message;status.setAttribute('role',error?'alert':'status');
 }
 function fail(message:string):void{
  root.WildlandsPlay=Object.freeze({app,ready:false,error:message});say(message,true);if(resume)resume.hidden=true;
 }
 interface Mounted {readonly active:boolean;open():void;advance(seconds:number):void;}
 function run(host:Mounted,label:string):void{
  let last=performance.now();
  function frame(now:number):void{
   const dt=Math.max(0,Math.min((now-last)/1000,.1));last=now;
   if(!document.hidden&&host.active)host.advance(dt);
   requestAnimationFrame(frame);
  }
  resume?.addEventListener('click',()=>{last=performance.now();host.open();});
  host.open();say(label+' is running.');requestAnimationFrame(frame);
 }
 const closed=(label:string)=>():void=>{say(label+' is closed. Your progress stays in this page until you reload it.');if(resume){resume.hidden=false;resume.focus();}};
 const opened=():void=>{if(resume)resume.hidden=true;};
 function bootRTS(api:LWRTSHost.Api):object{
  const host=api.create({beforeOpen:opened,afterClose:closed('The match')});
  // The mission editor bundle is optional in play artifacts; never offer a control that cannot work.
  if(!root.LWRTSMissionEditorUI)for(const button of document.querySelectorAll<HTMLButtonElement>('[data-rts-file="editor"]')){button.hidden=true;button.disabled=true;}
  const game=Object.freeze({open:()=>host.open(),close:()=>host.close(),query:()=>host.view.query(),
   command:(input:LWRTSRuntime.Command)=>host.view.command(input),checkpoint:()=>host.view.checkpoint(),catalog:()=>host.view.catalog(),
   status:()=>host.view.status(),editorQuery:()=>host.editorQuery()});
  run(host,'The match');return game;
 }
 function bootPet(api:LWPetHost.Api):object{
  const host=api.create({beforeOpen:opened,afterClose:closed('Your pet')});
  const game=Object.freeze({open:()=>host.open(),close:()=>host.close(),query:()=>host.view.query(),
   command:(input:unknown)=>host.view.command(input),checkpoint:()=>host.view.checkpoint(),catalog:()=>host.view.catalog(),
   status:()=>host.view.status(),control:(action:Parameters<LWPetApplication.View['control']>[0],value?:Parameters<LWPetApplication.View['control']>[1])=>host.view.control(action,value),
   renderer:()=>host.renderer(),useStore:(adapter:unknown)=>host.useStore(adapter),unlock:(sku:string)=>host.unlock(sku)});
  run(host,'Your pet');return game;
 }
 try{
  let game:object;
  if(app==='rts'){if(!root.LWRTSHost)return fail('This artifact does not contain the RTS game.');game=bootRTS(root.LWRTSHost);}
  else if(app==='pet'){if(!root.LWPetHost)return fail('This artifact does not contain the pet game.');game=bootPet(root.LWPetHost);}
  else return fail('This artifact names no standalone game.');
  root.WildlandsPlay=Object.freeze({app,ready:true,game});
 }catch(error){fail('The game could not start: '+(error instanceof Error?error.message:String(error)));}
})(globalThis);
