/// <reference path="./storytelling-contracts.d.ts" />
/* Application event sequencing. Scene changes remain reviewed navigation admissions. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWSceneGraph:LWSceneGraph.Api;LWStorytelling:LWStorytelling.Api;LWSceneNavigation:LWSceneNavigation.NavigationApi;LWStorytellingDirector?:LWStorytelling.DirectorApi};
 function create(ports:LWStorytelling.EventPorts):LWStorytelling.Director {
  let playback:LWStorytelling.Playback|null=null,pending:{public:LWStorytelling.EventReview;native:LWSceneNavigation.TransitionPreview;resume:boolean}|null=null,disposed=false,serial=0;
  let presenting:LWStorytelling.Playback|null=null;
  let due:{playback:LWStorytelling.Playback;events:LWSceneGraph.Event[]}|null=null;
  const issued=new WeakMap<LWStorytelling.EventReview,object>();
  const queue:LWSceneGraph.Event[]=[],once=new Set<string>(),chain=new Set<string>(),triggered=new Set<string>(),edges=new Map<string,boolean>(),stagedTriggers=new Set<string>();
  const alive=():void=>{if(disposed)throw Error('Storytelling director is disposed.');};
  const context=():LWContentPorts.ExperienceContext=>ports.engine().scenarioContext??fail('An authored scene is required.');
  const pack=():LWContentPorts.ScenarioPack=>context().journey?.pack??fail('An authored scene journey is required.');
  function fail(message:string):never{throw Error('Storytelling: '+message);}
  function ledger():LWSceneGraph.StoryProgress {const journey=context().journey!;journey.storytelling??={version:1,once:[],triggers:[],completed:[]};return journey.storytelling;}
  function remember(field:'once'|'triggers'|'completed',key:string):void{const ids=ledger()[field];if(!ids.includes(key)){if(ids.length>=1024)fail('Story progress limit exceeded.');ids.push(key);}}
  function present(value:LWStorytelling.Playback|null):void{if(presenting===value)return;ports.presentation(value);presenting=value;}
  function releaseFinished():void{if(!pending&&playback?.status().state==='finished')present(null);}
  function clear():void{due=null;playback?.dispose();playback=null;present(null);}
  function play(id:string):void{
   alive();const data=pack(),clip=data.storytelling?.cutscenes.find(row=>row.id===id);if(!clip||clip.sceneId!==context().sceneId)fail('Choose a cutscene in the active scene.');
   // Construct before replacing the current presentation: failed admission is atomic.
   const next=root.LWStorytelling.create(data,id);next.play();clear();playback=next;present(next);
  }
  function dispatch(event:LWSceneGraph.Event,cue=false):void {
   if(event.type==='message')ports.message(event.text);
   if(event.type==='pause'){
    if(!ports.pause)fail('This host cannot apply a native pause event.');ports.pause(event.paused);
   }
   if(event.type==='play-cutscene'){
    const key=context().sceneId+'|'+event.cutsceneId;
    if(event.once&&(once.has(key)||ledger().once.includes(key)))return;
    if(chain.has('clip:'+key)){queue.length=0;ports.message('Storytelling stopped a repeated cutscene event.');return;}
    play(event.cutsceneId);chain.add('clip:'+key);if(event.once){once.add(key);remember('once',key);}
   }
   if(event.type==='scene-switch'){
    const key=context().sceneId+':'+event.connectionId;
    if(chain.has('link:'+key)){queue.length=0;ports.message('Storytelling stopped a repeated scene transition.');return;}
    // Review admission precedes pausing, so a rejected gate retains the cue-time presentation.
    const preview=root.LWSceneNavigation.prepare(ports.engine(),event.connectionId);
    const resume=cue&&playback?.status().state==='playing';if(resume)playback!.pause();
    chain.add('link:'+key);pending={native:preview,resume,public:{id:++serial,connectionId:preview.connectionId,sourceSceneId:preview.sourceSceneId,sceneId:preview.sceneId,sceneName:preview.sceneName,messages:structuredClone(preview.messages)}};
   }
  }
  function process():void {
   let count=0;
   while(queue.length&&!pending&&playback?.status().state!=='playing'&&playback?.status().state!=='paused'){
    if(++count>64){queue.length=0;fail('Event chain limit exceeded.');}dispatch(queue.shift()!);
   }
  }
  function timed():void {
   let count=0;
   // Due tails survive cancelled/rejected admission. Only real presentation replacement discards them.
   while(playback&&!pending){
    const current=playback;if(!due||due.playback!==current)due={playback:current,events:current.drainEvents()};
    if(!due.events.length){due=null;return;}
    const event=due.events.shift()!;if(++count>128)fail('Cue chain limit exceeded.');dispatch(event,true);
    if(playback!==current)due=null;
   }
  }
  function advancePlayback(seconds:number):void {
   let remaining=seconds,count=0;timed();
   while(playback?.status().state==='playing'&&!pending&&remaining>0){
    if(++count>256)fail('Cue advancement limit exceeded.');
    const current=playback,status=current.status(),clip=pack().storytelling!.cutscenes.find(row=>row.id===status.cutsceneId)!;
    const boundary=clip.events?.find(cue=>cue.time>status.time)?.time??status.duration;
    const elapsed=Math.min(remaining,boundary-status.time);current.advance(elapsed);remaining-=elapsed;
    if(current.status().state==='finished')remember('completed',status.sceneId+'|'+status.cutsceneId);
    timed();process();
   }
  }
  function observeTriggers():void {
   const ctx=context(),scene=pack().scenes.find(row=>row.id===ctx.sceneId)!;
   if(!(scene.graph?.triggers?.length))return;
   const state=ports.engine().export().state;if(state.paused===true)return;
   for(const trigger of scene.graph.triggers){
    const key=ctx.sceneId+'|'+trigger.id,passed=root.LWSceneGraph.entryIssue(trigger.requirements,state)===null,prior=edges.get(key)??false;edges.set(key,passed);
    if(!passed||prior||trigger.once!==false&&(triggered.has(key)||ledger().triggers.includes(key)))continue;
    triggered.add(key);if(trigger.once!==false){remember('triggers',key);stagedTriggers.add(key);}chain.clear();queue.push(...structuredClone(trigger.events));
   }
  }
  function enter(events:LWSceneGraph.Event[]=[]):void{
   alive();clear();pending=null;queue.length=0;
   const scene=pack().scenes.find(row=>row.id===context().sceneId)!;
   queue.push(...structuredClone(events),...structuredClone((scene.graph?.events??[]).filter(event=>event.type==='play-cutscene'||event.type==='scene-switch')));process();timed();
  }
  const director:LWStorytelling.Director={
   enter,play(id){chain.clear();queue.length=0;pending=null;play(id);chain.add('clip:'+context().sceneId+'|'+id);timed();},
   advance(seconds){alive();if(!Number.isFinite(seconds)||seconds<0||seconds>60)fail('Elapsed time must be between 0 and 60 seconds.');if(pending)return;const journey=context().journey,priorStory=journey?.storytelling?structuredClone(journey.storytelling):undefined,priorOnce=new Set(once),priorTriggered=new Set(triggered),priorEdges=new Map(edges);try{observeTriggers();advancePlayback(seconds);process();timed();releaseFinished();if(pending||!queue.length)stagedTriggers.clear();}catch(error){if(journey){if(priorStory)journey.storytelling=priorStory;else delete journey.storytelling;}once.clear();priorOnce.forEach(key=>once.add(key));triggered.clear();priorTriggered.forEach(key=>triggered.add(key));edges.clear();priorEdges.forEach((value,key)=>edges.set(key,value));for(const key of stagedTriggers){if(journey?.storytelling)journey.storytelling.triggers=journey.storytelling.triggers.filter(id=>id!==key);triggered.delete(key);edges.set(key,false);}stagedTriggers.clear();queue.length=0;throw error;}},
   status:()=>playback?.status()??null,
   pause(){alive();playback?.pause();},resume(){alive();playback?.resume();},
   stop(){alive();due=null;playback?.stop();present(null);queue.length=0;pending=null;chain.clear();},
   skip(){alive();playback?.skip();if(playback){if(playback.status().state==='finished')remember('completed',playback.status().sceneId+'|'+playback.status().cutsceneId);timed();if(playback?.status().state==='stopped'){present(null);queue.length=0;due=null;chain.clear();}}process();releaseFinished();},
   replay(){alive();if(!playback)return;due=null;queue.length=0;pending=null;chain.clear();playback.replay();chain.add('clip:'+playback.status().sceneId+'|'+playback.status().cutsceneId);present(playback);timed();},
   review(){if(!pending)return null;const value=Object.freeze({...pending.public,messages:Object.freeze([...pending.public.messages])}) as unknown as LWStorytelling.EventReview;issued.set(value,pending);return value;},
   accept(review){alive();if(!pending||issued.get(review)!==pending||JSON.stringify(review)!==JSON.stringify(pending.public))fail('Scene event review is stale.');const trusted=pending.native;ports.transition(trusted);pending=null;enter(trusted.scene.pack.scenes.find(row=>row.id===trusted.sourceSceneId)?.graph?.connections?.find(row=>row.id===trusted.connectionId)?.events?.filter(event=>event.type==='play-cutscene'||event.type==='scene-switch')??[]);},
   cancel(review){alive();if(!pending||issued.get(review)!==pending||JSON.stringify(review)!==JSON.stringify(pending.public))fail('Scene event review is stale.');const resume=pending.resume;pending=null;queue.length=0;chain.clear();if(resume)playback?.resume();releaseFinished();},
   dispose(){if(disposed)return;clear();queue.length=0;pending=null;once.clear();chain.clear();triggered.clear();edges.clear();stagedTriggers.clear();disposed=true;}
  };
  return Object.freeze(director);
 }
 const api={create};root.LWStorytellingDirector=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
