/// <reference path="./storytelling-player-contracts.d.ts" />
/* Composition binds cinematic intents to the established reviewed scene adoption path. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWStorytellingDirector:LWStorytelling.DirectorApi;LWSceneNavigation:LWSceneNavigation.NavigationApi;LWStorytellingPlayer?:LWStorytellingPlayer.Api};
 function create(host:LWStorytellingPlayer.Host):LWStorytellingPlayer.Player {
  let engine:LWContentPorts.ScenarioEngine|null=null,director:LWStorytelling.Director|null=null,review:LWStorytelling.EventReview|null=null,disposed=false,lastIssue='';
  const cameras=new Map<string,LittlewildRenderer.Camera>(),e=host.esc;
  function adopt(preview:LWSceneNavigation.TransitionPreview):void{
   const current=host.engine(),key=current.scenarioContext!.packId+'/'+current.scenarioContext!.sceneId,camera=host.camera?.();
   host.admitScene?.(preview.scene.pack,preview.sceneId);host.backup();const next=root.LWSceneNavigation.commit(current,preview);
   if(camera)cameras.set(key,camera);
   host.setEngine(next,{sceneTransition:true});engine=next;host.close();
   host.presentScene?.(root.LWSceneNavigation.target(next),cameras.get(next.scenarioContext!.packId+'/'+next.scenarioContext!.sceneId));host.save();host.toast('Entered '+next.scenarioContext!.sceneName+'.');
  }
  function bind(events:LWSceneGraph.Event[]=[]):void{
   const current=host.engine();if(engine===current)return;
   director?.dispose();director=null;engine=current;review=null;
   if(!current.scenarioContext?.journey)return;
   director=root.LWStorytellingDirector.create({engine:host.engine,transition:adopt,presentation:host.presentation,message:text=>host.toast(text),...(host.pause?{pause:host.pause}:{})});director.enter(events);
  }
  function showReview():void{
   const pending=director?.review();if(!pending||review?.id===pending.id)return;review=pending;host.open('storytelling-transition');document.querySelector<HTMLButtonElement>('[data-storytelling-player=cancel]')?.focus({preventScroll:true});
  }
  function controls():string{
   const data=host.engine().scenarioContext?.journey?.pack.storytelling,sceneId=host.engine().scenarioContext?.sceneId,clips=data?.cutscenes.filter(clip=>clip.sceneId===sceneId)??[];if(!clips.length)return '';
   const status=director?.status();return `<section class="scenario-connections storytelling-player"><h3>Scene cutscenes</h3><div class="scene-editor-actions">${clips.map(clip=>`<button type="button" class="btn" data-storytelling-player="play" data-id="${e(clip.id)}">Play ${e(clip.name)}</button>`).join('')}</div>${status?`<p role="status">${e(status.state)} · ${status.time.toFixed(1)} / ${status.duration.toFixed(1)} seconds</p><div class="scene-editor-actions"><button class="btn" data-storytelling-player="pause">Pause</button><button class="btn" data-storytelling-player="resume">Resume</button><button class="btn" data-storytelling-player="stop">Stop</button><button class="btn" data-storytelling-player="skip">Skip</button><button class="btn" data-storytelling-player="replay">Replay</button></div>`:''}</section>`;
  }
  function render(type:string):string|null{
   if(type!=='storytelling-transition')return null;
   if(!review)return host.head('No scene event pending.')+host.footer();
   return host.head('Enter '+e(review.sceneName)+'?','A storytelling event requested this connection. Its entry rules and the current story were reviewed.','SCENE EVENT')+`<div class="modal-body"><p>Current work remains in this scene’s checkpoint for your return.</p>${review.messages.map(text=>`<p class="notice-box">${e(text)}</p>`).join('')}</div><footer class="modal-footer"><button type="button" class="btn" data-storytelling-player="cancel">Cancel</button><button type="button" class="btn primary" data-storytelling-player="accept">Enter scene</button></footer>`;
  }
  const controller=new AbortController();
  document.addEventListener('click',event=>{
   const target=event.target instanceof Element?event.target.closest<HTMLButtonElement>('[data-storytelling-player]'):null;if(!target||target.disabled)return;
   try{bind();if(!director)return;const action=target.dataset.storytellingPlayer;
    if(action==='play')director.play(target.dataset.id||'');if(action==='pause')director.pause();if(action==='resume')director.resume();if(action==='stop')director.stop();if(action==='skip')director.skip();if(action==='replay')director.replay();
    if(action==='cancel'&&review){director.cancel(review);review=null;host.open('scenarios');}
    if(action==='accept'&&review){director.accept(review);review=null;}
    showReview();host.redraw();
   }catch(error){host.toast(error instanceof Error?error.message:String(error),true);}
  },{signal:controller.signal});
  return {entered(events=[]){director?.dispose();director=null;engine=null;review=null;bind(events);showReview();},isPresenting(){const status=director?.status();return review!==null||status?.state==='playing'||status?.state==='paused';},draw(seconds){if(disposed)return;try{if(review&&host.modal()!=='storytelling-transition'){director?.cancel(review);review=null;}bind();director?.advance(seconds);showReview();lastIssue='';}catch(error){const issue=error instanceof Error?error.message:String(error);if(issue!==lastIssue){lastIssue=issue;host.toast(issue,true);}}},render,controls,
   reset(){director?.dispose();director=null;engine=null;review=null;cameras.clear();lastIssue='';},dispose(){if(disposed)return;controller.abort();director?.dispose();director=null;cameras.clear();disposed=true;}
  };
 }
 const api={create};root.LWStorytellingPlayer=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
