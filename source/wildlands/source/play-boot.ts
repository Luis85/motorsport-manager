/* Standalone template composition: mount exactly one game host without the colony shell.
 * Selected by <html data-wildlands-app>. It only calls the host descriptor's create/api surface;
 * time advances from animation frames exactly as in the colony shell. A missing or failing host
 * degrades to an accessible message instead of an uncaught boot error and never signals ready.
 * The game API is the descriptor's detached api() (the same shape as WildlandsRTS/WildlandsPet),
 * published as WildlandsPlay.game; the shell keeps sole ownership of those two global names.
 * Once WildlandsPlay exists the page publishes the shared ready signal (RUNTIME-CONTRACTS.md):
 * window.__wildlandsReady, documentElement.dataset.wildlandsReady = app id, then one
 * `wildlands:ready` event. Optional bundle controls keep the host's explicit disabled reason. */
declare namespace LWPlayBoot {
 /** Published as globalThis.WildlandsPlay once boot finishes; a readiness signal for tests and tools. */
 interface Ready {readonly app:string;readonly ready:boolean;readonly error?:string;readonly game?:object;}
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {
  LWRTSHost?:LWRTSHost.Api;LWPetHost?:LWPetHost.Api;
  WildlandsPlay?:LWPlayBoot.Ready;__wildlandsReady?:boolean;
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
 /** Mount one host through its descriptor; the detached api() is the published game surface. */
 function boot<S extends LWEmbeddedApp.Surface,P extends object>(descriptor:LWEmbeddedApp.Descriptor<S,P>,label:string):object{
  const host=descriptor.create({beforeOpen:opened,afterClose:closed(label),standalone:true});
  const game=descriptor.api(host);run(host,label);return game;
 }
 function ready(host:string):void{
  root.__wildlandsReady=true;document.documentElement.dataset.wildlandsReady=host;
  dispatchEvent(new CustomEvent<LWEmbeddedApp.ReadyDetail>('wildlands:ready',{detail:{host}}));
 }
 try{
  let game:object;
  if(app==='rts'){if(!root.LWRTSHost)return fail('This artifact does not contain the RTS game.');game=boot(root.LWRTSHost,'The match');}
  else if(app==='pet'){if(!root.LWPetHost)return fail('This artifact does not contain the pet game.');game=boot(root.LWPetHost,'Your pet');}
  else return fail('This artifact names no standalone game.');
  root.WildlandsPlay=Object.freeze({app,ready:true,game});
  ready(app);
 }catch(error){fail('The game could not start: '+(error instanceof Error?error.message:String(error)));}
})(globalThis);
