/// <reference path="./storytelling-ui-contracts.d.ts" />
/* Browser storytelling intent, detached file review and presentation controls. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWAnimationCatalog?:{list():readonly LWAnimations.Metadata[]};LWContent:LWContentPorts.ContentApi;LWScenarios:LWContentPorts.ScenarioApi;LWStorytellingEditor:{create(editor:LWSceneEditor.Session):LWStorytelling.Authoring};LWStorytellingView:LWStorytellingUI.View;LWFiles:{downloadJSON(value:unknown,name:string):void};LWStorytellingUI?:LWStorytellingUI.Api};
 function create(host:LWStorytellingUI.Host):LWStorytellingUI.Surface{
  const state:LWStorytellingUI.State={active:false,tab:'boards',boardId:'',shotId:'',clipId:'',trackId:'',keyIndex:-1,creating:'',notice:'',error:'',confirm:''};
  const input=document.createElement('input');input.type='file';input.id='storytelling-import';input.accept='.json,application/json';input.hidden=true;document.body.append(input);
  let preview:LWStorytellingUI.Preview|null=null,mounted:HTMLCanvasElement|null=null,previewSession:LWSceneEditor.Session|null=null,previewKey='',readId=0;
  let cancelPreparation:(()=>void)|null=null,pendingPreparation=false,preparationGeneration=0;
  let failedPreparation:{session:LWSceneEditor.Session;key:string;canvas:HTMLCanvasElement}|null=null;
  let review:{pack:LWContentPorts.ScenarioPack;session:LWSceneEditor.Session;revision:number}|null=null;
  const e=host.esc,copy=<T>(v:T):T=>structuredClone(v);
  function session():LWSceneEditor.Session{const value=host.session();if(!value)throw Error('Open a scenario pack draft first.');return value;}
  const pack=():LWContentPorts.ScenarioPack=>session().snapshot();
  const author=():LWStorytelling.Authoring=>root.LWStorytellingEditor.create(session());
  function clip():LWStorytelling.Cutscene{const found=pack().storytelling?.cutscenes.find(c=>c.id===state.clipId);if(!found)throw Error('Select a cutscene first.');return found;}
  function board():LWStorytelling.Storyboard{const found=pack().storytelling?.storyboards.find(b=>b.id===state.boardId);if(!found)throw Error('Select a storyboard first.');return found;}
  function cancelPreparationJob():void{preparationGeneration++;const cancel=cancelPreparation;cancelPreparation=null;pendingPreparation=false;cancel?.();}
  function stopPreview():void{try{cancelPreparationJob();}finally{try{preview?.dispose();}finally{preview=null;mounted=null;previewSession=null;previewKey='';failedPreparation=null;}}}
  function sameClip():boolean{return previewKey.slice(0,previewKey.lastIndexOf(':'))===state.clipId;}
  function redraw():void{
   const current=host.session(),retain=(preview||pendingPreparation)&&host.modal()==='scene-editor'&&state.active&&state.tab==='timeline'&&current===previewSession&&sameClip()&&(previewKey===state.clipId+':'+current?.revision||!!preview?.update);
   const surface=retain?mounted?.parentElement:null,notice=retain&&previewKey!==state.clipId+':'+current?.revision?'Preparing a detached scene preview…':document.querySelector('[data-story-preview-notice]')?.textContent;
   if(!surface)stopPreview();
   try{
    host.redraw();
    if(surface){
     const replacement=document.querySelector('.storytelling-preview');
     if(replacement){replacement.replaceWith(surface);const label=document.querySelector('[data-story-preview-notice]');if(label&&notice)label.textContent=notice;}
    }
   }finally{if(surface&&!surface.isConnected)stopPreview();}
  }
  function failed(error:unknown):void{
   state.error=error instanceof Error?error.message:String(error);state.notice='';host.toast(state.error,true);
   const workspace=document.querySelector('.storytelling-workspace');if(!workspace){redraw();return;}
   let message=workspace.querySelector<HTMLElement>('.storytelling-feedback');if(!message){message=document.createElement('p');workspace.querySelector('.storytelling-tabs')?.after(message);}
   message.className='storytelling-feedback is-error';message.setAttribute('role','alert');message.textContent=state.error;
  }
  function focus(selector:string):void{document.querySelector<HTMLElement>(selector)?.focus();}
  function preparing():boolean{if(!pendingPreparation)return false;host.toast('The detached preview is preparing. Try again when it is ready.');return true;}
  function mutate(work:()=>void,message:string):void{work();state.notice=message;state.error='';state.confirm='';redraw();}
  function cancelRead():void{readId++;review=null;input.value='';}
  function cancel():void{cancelRead();stopPreview();}
  function normalize():void{
   const value=pack().storytelling;
   if(!value?.storyboards.some(b=>b.id===state.boardId)){state.boardId=value?.storyboards[0]?.id??'';state.shotId='';}
   if(!value?.cutscenes.some(c=>c.id===state.clipId)){state.clipId=value?.cutscenes[0]?.id??'';state.trackId='';state.keyIndex=-1;}
   const current=value?.cutscenes.find(c=>c.id===state.clipId);if(!current?.tracks.some(t=>t.id===state.trackId)){state.trackId='';state.keyIndex=-1;}
  }
  function render():string{
   if(!host.session())return '';normalize();const p=pack();let entities:LWSceneGraph.Entity[]=[];
   const selected=p.storytelling?.cutscenes.find(c=>c.id===state.clipId);if(selected)entities=session().entities(selected.sceneId);
   const markup=root.LWStorytellingView.render({presets:root.LWAnimationCatalog?.list()??['sparkles','orbit','ripple'].map(id=>({id,name:id,description:''})),selectedSceneId:host.sceneId()??p.scenes[0]?.id??'',pack:p,state,entities,revision:session().revision,canUndo:session().canUndo,canRedo:session().canRedo,status:preview?.status()??null,esc:e});
   const reviewing=review?`<section class="storytelling-import-review" aria-label="Storytelling import review"><h3>Review storytelling import</h3><p>${review.pack.storytelling?.storyboards.length??0} storyboards and ${review.pack.storytelling?.cutscenes.length??0} cutscenes replace the draft’s storytelling data. Scene references and timelines have passed complete pack validation.</p><button class="btn" type="button" data-story="cancel-import">Cancel</button><button class="btn primary" type="button" data-story="apply-import">Apply storytelling to draft</button></section>`:'';
   return markup+reviewing;
  }
  function draw(delta=0):void{
   if(host.modal()!=='scene-editor'||!state.active||state.tab!=='timeline'){if(preview||pendingPreparation)stopPreview();return;}
   let canvas=document.querySelector<HTMLCanvasElement>('[data-story-preview]');if(!canvas||!state.clipId)return;
   const current=session(),key=state.clipId+':'+current.revision;
   if(failedPreparation?.session===current&&failedPreparation.key===key&&failedPreparation.canvas===canvas)return;
   if(canvas!==mounted||key!==previewKey||current!==previewSession){
    const retained=canvas===mounted&&current===previewSession&&sameClip()&&preview?.update?preview:null;
    const replaceMount=canvas===mounted;
    if(retained)cancelPreparationJob();else stopPreview();
    if(replaceMount&&!retained){host.redraw();canvas=document.querySelector<HTMLCanvasElement>('[data-story-preview]');if(!canvas)return;}
    let target=canvas;const selectedClip=state.clipId,generation=preparationGeneration;mounted=target;previewSession=current;previewKey=key;
    if(host.preview){
     pendingPreparation=true;const notice=document.querySelector('[data-story-preview-notice]');if(notice)notice.textContent='Preparing a detached scene preview…';
     const ownsScope=():boolean=>generation===preparationGeneration&&host.modal()==='scene-editor'&&state.active&&state.tab==='timeline'&&host.session()===current&&state.clipId===selectedClip&&state.clipId+':'+current.revision===key;
     const ownsMount=():boolean=>ownsScope()&&mounted===target&&target.isConnected;
     const readyNotice='Detached scene ready. Play, pause or seek to inspect animation.';
     const rejected=(error:unknown):void=>{
      if(!ownsScope())return;
      const label=document.querySelector('[data-story-preview-notice]');let reason=String(error);
      failedPreparation={session:current,key,canvas:target};
      const removed=preview;preview=null;mounted=null;previewSession=null;previewKey='';
      try{removed?.dispose();}catch(disposalError){reason+='; '+String(disposalError);}
      if(ownsScope()&&label?.isConnected)label.textContent=reason;
     };
     const prepare=():void=>{
      if(generation!==preparationGeneration||!pendingPreparation||mounted!==target)return;
      cancelPreparation=null;
      if(!ownsMount()){stopPreview();return;}
      try{
       const next=pack();
       if(retained?.update?.(next,selectedClip)){
        if(!ownsMount()||preview!==retained)return;
        retained.draw(0);const label=document.querySelector('[data-story-preview-notice]');if(label)label.textContent=readyNotice;return;
       }
       if(!ownsMount())return;
       if(retained){
        const parent=target.parentElement;try{retained.dispose();}finally{if(preview===retained)preview=null;}
        if(!ownsScope())return;
        if(parent?.isConnected){const replacement=target.cloneNode(false) as HTMLCanvasElement;target.remove();target=replacement;parent.prepend(target);}
        else{host.redraw();const replacement=document.querySelector<HTMLCanvasElement>('[data-story-preview]');if(!replacement)return;target=replacement;}
        mounted=target;
       }
       if(!ownsMount())return;
       const instance=host.preview!(target,next,selectedClip);
       if(!ownsMount()){instance.dispose();return;}
       preview=instance;instance.ready.then(result=>{
        if(preview!==instance||!ownsMount())return;const label=document.querySelector('[data-story-preview-notice]');if(label)label.textContent=result.ok?readyNotice:result.reason??'The selected renderer could not prepare this scene.';
       }).catch(error=>{if(preview===instance&&ownsMount()){const label=document.querySelector('[data-story-preview-notice]');if(label)label.textContent=String(error);}});
      }catch(error){rejected(error);}
      finally{if(generation===preparationGeneration)pendingPreparation=false;}
     };
     try{if(host.deferPreview)cancelPreparation=host.deferPreview(prepare);else prepare();}
     catch(error){rejected(error);preparationGeneration++;pendingPreparation=false;}
    }
   }
   if(pendingPreparation)return;
   preview?.draw(delta);
   const status=preview?.status();if(!status)return;
   const time=document.querySelector('[data-story-time]');if(time)time.textContent=status.time.toFixed(2)+' / '+status.duration.toFixed(2)+' s · '+status.state;
   const seek=document.querySelector<HTMLInputElement>('[data-story-seek]');if(seek&&document.activeElement!==seek)seek.value=String(status.time);
   for(const head of document.querySelectorAll<HTMLElement>('.storytelling-playhead'))head.style.setProperty('--playhead',status.completion*100+'%');
  }
  const text=(form:HTMLFormElement,name:string):string=>(form.elements.namedItem(name) as HTMLInputElement|null)?.value??'';
  function event(form:HTMLFormElement):LWSceneGraph.Event{
   const kind=text(form,'event-type');
   if(kind==='play-cutscene')return {type:kind,cutsceneId:text(form,'event-clip'),once:text(form,'event-once')==='true'};
   if(kind==='scene-switch')return {type:kind,connectionId:text(form,'event-connection')};
   if(kind==='pause')return {type:kind,paused:text(form,'event-paused')==='true'};
   return {type:'message',text:text(form,'event-text')};
  }
  function apply(form:HTMLFormElement):void{
   const kind=form.dataset.storyForm;
   if(kind==='create'){
    const id=text(form,'id'),name=text(form,'name');
    if(state.creating==='board'){if(author().list().storyboards.some(b=>b.id===id))throw Error('Storyboard ID already exists.');author().setStoryboard({id,name,shots:[]});state.boardId=id;state.tab='boards';}
    else{if(author().list().cutscenes.some(c=>c.id===id))throw Error('Cutscene ID already exists.');author().setCutscene({id,name,sceneId:text(form,'scene'),duration:Number(text(form,'duration')),tracks:[],skipPolicy:'finish'});state.clipId=id;state.tab='timeline';}
    state.creating='';return;
   }
   if(kind==='board'){const value=board();value.name=text(form,'name');author().setStoryboard(value);return;}
   if(kind==='shot'){
    const value=board(),id=text(form,'id'),sceneId=text(form,'scene'),cutsceneId=text(form,'cutscene');
    const shot:LWStorytelling.Shot={id,name:text(form,'name'),sceneId,narrative:text(form,'narrative')};
    if(cutsceneId){shot.cutsceneId=cutsceneId;if(text(form,'start')!=='')shot.start=Number(text(form,'start'));if(text(form,'end')!=='')shot.end=Number(text(form,'end'));}
    const index=value.shots.findIndex(a=>a.id===state.shotId);if(index>=0)value.shots[index]=shot;else{if(value.shots.some(a=>a.id===id))throw Error('Shot ID already exists.');value.shots.push(shot);}author().setStoryboard(value);state.shotId=id;return;
   }
   if(kind==='rendering'){
    const value=clip(),next=pack(),scene=next.scenes.find(s=>s.id===value.sceneId)!,dimension=text(form,'dimension'),rendererId=text(form,'renderer');
    if((dimension!=='2d'&&dimension!=='3d')||!['basic','pixi-2d','excalibur-2d'].includes(rendererId))throw Error('Choose a compiled scene renderer.');
    scene.graph??={kind:'level'};scene.graph.rendering={...scene.graph.rendering,dimension,rendererId:rendererId as LWSceneGraph.Rendering['rendererId']};session().replace(next);return;
   }
   if(kind==='animation'){
    const value=clip(),preset=text(form,'preset');if(!(root.LWAnimationCatalog?.list().some(entry=>entry.id===preset)??['sparkles','orbit','ripple'].includes(preset)))throw Error('Choose a compiled animation preset.');
    value.animations??=[];value.animations.push({id:text(form,'id'),presetId:preset as LWStorytelling.Animation['presetId'],start:Number(text(form,'start')),duration:Number(text(form,'duration')),x:Number(text(form,'x')),y:Number(text(form,'y')),radius:Number(text(form,'radius')),color:text(form,'color'),count:Number(text(form,'count')),...(text(form,'seed')!==''?{seed:Number(text(form,'seed'))}:{})});author().setCutscene(value);return;
   }
   if(kind==='clip'){const value=clip();value.name=text(form,'name');value.sceneId=text(form,'scene');value.duration=Number(text(form,'duration'));value.skipPolicy=text(form,'skip')==='cancel'?'cancel':'finish';author().setCutscene(value);return;}
   if(kind==='track'){
    const value=clip(),id=text(form,'id'),target=text(form,'target'),property=text(form,'property'),old=value.tracks.find(t=>t.id===state.trackId);
    const keyframes=old?copy(old.keyframes):[{time:0,value:Number(text(form,'first'))},{time:value.duration,value:Number(text(form,'last'))}];
    let track:LWStorytelling.Track;
    if(target==='camera'){if(!['x','y','zoom'].includes(property))throw Error('Camera tracks support x, y or zoom.');track={id,target:{category:'camera'},property:property as LWStorytelling.CameraProperty,keyframes};}
    else{const split=target.indexOf(':'),category=target.slice(0,split),targetId=target.slice(split+1);if(!['creatures','buildings','nodes','props'].includes(category)||!['x','y','height','rotation','scale','opacity','pose'].includes(property))throw Error('Choose a supported entity and property.');track={id,target:{category:category as LWSceneGraph.Entity['category'],id:targetId},property:property as LWStorytelling.Property,keyframes};}
    const index=value.tracks.findIndex(t=>t.id===state.trackId);if(index>=0)value.tracks[index]=track;else{if(value.tracks.some(t=>t.id===id))throw Error('Track ID already exists.');value.tracks.push(track);}author().setCutscene(value);state.trackId=id;state.keyIndex=-1;return;
   }
   if(kind==='key'){
    const value=clip(),track=value.tracks.find(t=>t.id===state.trackId);if(!track)throw Error('Select an animation track first.');
    const key:LWStorytelling.Keyframe={time:Number(text(form,'time')),value:Number(text(form,'value')),easing:text(form,'easing')==='step'?'step':'linear'};
    if(state.keyIndex>=0)track.keyframes[state.keyIndex]=key;else track.keyframes.push(key);track.keyframes.sort((a,b)=>a.time-b.time);author().setCutscene(value);state.keyIndex=track.keyframes.indexOf(key);return;
   }
   if(kind==='cue'||kind==='finish'){const value=clip();if(kind==='cue'){value.events??=[];value.events.push({id:text(form,'id'),time:Number(text(form,'time')),event:event(form)});value.events.sort((a,b)=>a.time-b.time);}else{value.onFinish??=[];value.onFinish.push(event(form));}author().setCutscene(value);return;}
   if(kind==='trigger'){
    const value=clip(),next=pack(),selected=next.scenes.find(s=>s.id===value.sceneId)!,type=text(form,'requirement-type'),reference=text(form,'reference');
    const requirement:LWSceneGraph.Requirement=type==='player-level'?{type,minimum:Number(text(form,'minimum'))}:type==='quest-complete'?{type,questId:reference}:type==='building'?{type,kind:reference}:{type:'item',itemId:reference,quantity:Number(text(form,'quantity'))};
    selected.graph??={kind:'level'};selected.graph.triggers??=[];selected.graph.triggers.push({id:text(form,'id'),requirements:[requirement],events:[event(form)],once:text(form,'once')==='true'});session().replace(next);return;
   }
   if(kind==='entry'){const value=clip(),selected=pack().scenes.find(a=>a.id===value.sceneId)!;author().setEvents(value.sceneId,[...(selected.graph?.events??[]),event(form)]);}
  }
  document.addEventListener('submit',ev=>{
   if(host.modal()!=='scene-editor'||!(ev.target instanceof HTMLFormElement)||!ev.target.dataset.storyForm)return;ev.preventDefault();
   try{mutate(()=>apply(ev.target as HTMLFormElement),'Storytelling updated in this draft.');}catch(error){failed(error);}
  });
  document.addEventListener('click',ev=>{
   if(host.modal()!=='scene-editor'||!(ev.target instanceof Element))return;const button=ev.target.closest<HTMLButtonElement>('[data-story]');if(!button||button.disabled)return;
   const action=button.dataset.story,id=button.dataset.id??'';
   try{
    if(action==='open'||action==='close'){state.active=action==='open';state.error='';state.notice='';redraw();focus(state.active?'[data-story="boards"]':'[data-story="open"]');return;}
    if(action==='boards'||action==='timeline'){state.tab=action;state.creating='';state.error='';redraw();return;}
    if(action==='new-board'||action==='new-clip'){state.creating=action==='new-board'?'board':'clip';redraw();focus('[data-story-form=create] input[name=id]');return;}
    if(action==='cancel-create'){const target=state.creating==='board'?'new-board':'new-clip';state.creating='';redraw();focus('[data-story="'+target+'"]');return;}
    if(action==='select-board'){state.boardId=id;state.shotId='';redraw();return;}
    if(action==='select-shot'){state.shotId=id;redraw();focus('[data-story-form=shot] input[name=name]');return;}
    if(action==='add-shot'){state.shotId='';redraw();focus('[data-story-form=shot] input[name=id]');return;}
    if(action==='shot-timeline'||action==='select-clip'){state.clipId=id;state.tab='timeline';state.trackId='';state.keyIndex=-1;redraw();return;}
    if(action==='select-track'||action==='select-key'){state.trackId=id;state.keyIndex=action==='select-key'?Number(button.dataset.index):-1;redraw();if(action==='select-key')focus('[data-story-form=key] input[name=time]');return;}
    if(action==='new-track'){state.trackId='';state.keyIndex=-1;redraw();focus('[data-story-form=track] input[name=id]');return;}
    if(action==='new-key'){state.keyIndex=-1;redraw();focus('[data-story-form=key] input[name=time]');return;}
    if(action==='undo'||action==='redo'){mutate(()=>session()[action](),'Draft history updated.');return;}
    if(action==='play'||action==='pause'||action==='stop'||action==='replay'){draw();if(preparing())return;if(!preview)throw Error('This build cannot prepare a detached cinematic preview.');preview[action==='play'?'play':action]();draw();return;}
    if(action==='shot-earlier'||action==='shot-later'){const value=board(),index=value.shots.findIndex(a=>a.id===id),next=index+(action==='shot-earlier'?-1:1);if(next<0||next>=value.shots.length)return;const shot=value.shots.splice(index,1)[0]!;value.shots.splice(next,0,shot);mutate(()=>author().setStoryboard(value),'Shot order updated.');return;}
    if(action?.startsWith('confirm-')){state.confirm=action.slice(8)+':'+id;redraw();focus('[data-story="cancel-delete"]');return;}
    if(action==='cancel-delete'){const split=state.confirm.indexOf(':'),kind=state.confirm.slice(0,split),target=state.confirm.slice(split+1);state.confirm='';redraw();focus('[data-story="confirm-'+kind+'"][data-id="'+CSS.escape(target)+'"]');return;}
    if(action==='delete'){
     const split=state.confirm.indexOf(':'),kind=state.confirm.slice(0,split),target=state.confirm.slice(split+1);
     mutate(()=>{if(kind==='board')author().removeStoryboard(target);if(kind==='clip')author().removeCutscene(target);if(kind==='shot'){const value=board();value.shots=value.shots.filter(a=>a.id!==target);author().setStoryboard(value);state.shotId='';}if(kind==='track'){const value=clip();value.tracks=value.tracks.filter(t=>t.id!==target);author().setCutscene(value);state.trackId='';state.keyIndex=-1;}},'Deleted from the storytelling draft. Undo restores it.');return;
    }
    if(action==='delete-key'){const value=clip(),track=value.tracks.find(t=>t.id===state.trackId)!;track.keyframes.splice(state.keyIndex,1);mutate(()=>author().setCutscene(value),'Keyframe removed.');state.keyIndex=-1;return;}
    if(action==='delete-cue'||action==='delete-finish'){const value=clip();if(action==='delete-cue')value.events=value.events?.filter(c=>c.id!==id)??[];else value.onFinish=value.onFinish?.filter((_event,index)=>index!==Number(id))??[];mutate(()=>author().setCutscene(value),'Cutscene event removed.');return;}
    if(action==='delete-animation'){const value=clip();value.animations=value.animations?.filter(a=>a.id!==id)??[];mutate(()=>author().setCutscene(value),'Animation preset removed.');return;}
    if(action==='delete-trigger'){const value=clip(),next=pack(),selected=next.scenes.find(s=>s.id===value.sceneId)!;selected.graph!.triggers=selected.graph?.triggers?.filter(t=>t.id!==id)??[];mutate(()=>session().replace(next),'Scene trigger removed.');return;}
    if(action==='delete-entry'){const value=clip(),selected=pack().scenes.find(s=>s.id===value.sceneId)!;mutate(()=>author().setEvents(selected.id,(selected.graph?.events??[]).filter((_event,index)=>index!==Number(id))),'Scene event removed.');return;}
    if(action==='import'){input.click();return;}
    if(action==='export'){root.LWFiles.downloadJSON(author().list(),pack().id+'.storytelling.json');state.notice='Storyboards and cinematic timelines exported.';redraw();return;}
    if(action==='cancel-import'){cancelRead();state.notice='Import cancelled. Your storytelling draft is unchanged.';redraw();focus('[data-story="import"]');return;}
    if(action==='apply-import'){if(!review||review.session!==session()||review.revision!==session().revision)throw Error('Draft changed after import review. Import again to review the current draft.');const next=review.pack;mutate(()=>{session().replace(next);cancelRead();},'Storytelling imported into the validated draft.');return;}
   }catch(error){failed(error);}
  });
  document.addEventListener('input',ev=>{if(host.modal()==='scene-editor'&&ev.target instanceof HTMLInputElement&&ev.target.matches('[data-story-seek]'))try{const time=Number(ev.target.value);draw();if(preparing())return;if(!preview)throw Error('A detached preview must be ready before seeking.');preview.seek(time);draw();}catch(error){failed(error);}});
  document.addEventListener('change',ev=>{
   if(host.modal()!=='scene-editor'||!(ev.target instanceof HTMLSelectElement))return;
   const field=ev.target.dataset.storyField,form=ev.target.closest('form');if(!form)return;
   if(field==='shot-scene'){
    const control=form.elements.namedItem('cutscene') as HTMLSelectElement;control.innerHTML='<option value="">Normal scene</option>'+author().list().cutscenes.filter(c=>c.sceneId===(ev.target as HTMLSelectElement).value).map(c=>'<option value="'+e(c.id)+'">'+e(c.name)+'</option>').join('');
   }
   if(field==='shot-scene'||field==='shot-cutscene'){
    const cutscene=(form.elements.namedItem('cutscene') as HTMLSelectElement).value;
    for(const name of ['start','end']){const input=form.elements.namedItem(name) as HTMLInputElement;input.disabled=!cutscene;if(!cutscene)input.value='';}
   }
  });
  document.addEventListener('keydown',ev=>{if(host.modal()!=='scene-editor'||!(ev.target instanceof Element)||!ev.target.closest('.storytelling-key'))return;const keys=Array.from(document.querySelectorAll<HTMLButtonElement>('.storytelling-key')),index=keys.indexOf(ev.target as HTMLButtonElement),next=index+(ev.key==='ArrowRight'?1:ev.key==='ArrowLeft'?-1:0);if(next!==index&&keys[next]){ev.preventDefault();keys[next]!.focus();}});
  input.addEventListener('change',async()=>{
   const file=input.files?.[0],current=host.session(),token=++readId;if(!file||!current)return;const revision=current.revision;review=null;
   try{if(file.size>8*1024*1024)throw Error('Storytelling files must be at most 8 MiB.');const text=await file.text();if(token!==readId||current!==host.session()||revision!==current.revision||host.modal()!=='scene-editor')return;
    const next=current.snapshot();next.storytelling=root.LWContent.parse(text,8*1024*1024) as LWStorytelling.Data;const validation=root.LWScenarios.validate(next);if(!validation.ok)throw Error(validation.errors.join('\n'));
    review={pack:validation.pack,session:current,revision};state.error='';state.notice='Storytelling import validated. Review before applying.';redraw();focus('[data-story="cancel-import"]');
   }catch(error){if(token===readId)failed(error);}finally{input.value='';}
  });
  return {get active(){return state.active;},render,cancel,draw};
 }
 root.LWStorytellingUI={create};
})(globalThis);
