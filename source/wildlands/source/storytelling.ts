/// <reference path="./storytelling-contracts.d.ts" />
/* Cinematic time and interpolation own detached presentation values, never gameplay. */
(function(inputRoot:unknown){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 const root=inputRoot as {LWContent:LWContentPorts.ContentApi;LWStorytellingValidation:{validate(pack:LWContentPorts.ScenarioPack):void};LWStorytelling?:LWStorytelling.Api};
 const validation=(node?require('./storytelling-validation.js'):root.LWStorytellingValidation) as typeof root.LWStorytellingValidation;
 const copy=<T>(value:T):T=>structuredClone(value);
 function clipFor(pack:LWContentPorts.ScenarioPack,id:string):LWStorytelling.Cutscene{return pack.storytelling?.cutscenes.find(row=>row.id===id)??fail('Choose an existing cutscene.');}
 function fail(message:string):never{throw Error('Cutscene: '+message);}
 function value(track:LWStorytelling.Track,time:number):number {
  const first=track.keyframes[0]!,last=track.keyframes.at(-1)!;
  if(time<=first.time)return first.value;if(time>=last.time)return last.value;
  const end=track.keyframes.findIndex(key=>key.time>time),a=track.keyframes[end-1]!,b=track.keyframes[end]!;
  return a.easing==='step'?a.value:a.value+(b.value-a.value)*(time-a.time)/(b.time-a.time);
 }
 function sampled(clip:LWStorytelling.Cutscene,time:number):LWStorytelling.Sample {
  if(!Number.isFinite(time))fail('Time must be finite.');
  const result:LWStorytelling.Sample={cutsceneId:clip.id,sceneId:clip.sceneId,time:Math.max(0,Math.min(clip.duration,time)),duration:clip.duration,poses:[],camera:{},animations:[]};
  result.animations=copy((clip.animations??[]).filter(animation=>result.time>=animation.start&&result.time<animation.start+animation.duration));
  for(const track of clip.tracks){
   const sampledValue=value(track,result.time);
   if(track.target.category==='camera')result.camera[track.property as LWStorytelling.CameraProperty]=sampledValue;
   else{
    const target=track.target;
    let pose=result.poses.find(row=>row.target.category===target.category&&row.target.id===target.id);
    if(!pose){pose={target:copy(target),values:{}};result.poses.push(pose);}
    pose.values[track.property as LWStorytelling.Property]=sampledValue;
   }
  }
  return result;
 }
 function sample(pack:LWContentPorts.ScenarioPack,id:string,time:number):LWStorytelling.Sample{validation.validate(pack);return sampled(clipFor(pack,id),time);}
 function create(pack:LWContentPorts.ScenarioPack,id:string):LWStorytelling.Playback {
  validation.validate(pack);const clip=copy(clipFor(pack,id));
  let state:LWStorytelling.State='ready',time=0,generation=0,finishEmitted=false;
  const queue:LWSceneGraph.Event[]=[],fired=new Set<string>();
  function alive():void{if(state==='disposed')fail('Playback is disposed.');}
  function cues(from:number,to:number):void {
   for(const cue of clip.events??[])if(!fired.has(cue.id)&&cue.time>=from&&cue.time<=to){fired.add(cue.id);queue.push(copy(cue.event));}
  }
  function finish():void{if(state==='finished')return;time=clip.duration;state='finished';if(!finishEmitted){finishEmitted=true;queue.push(...copy(clip.onFinish??[]));}}
  function restart():void{alive();time=0;generation++;queue.length=0;fired.clear();finishEmitted=false;state='playing';cues(0,0);}
  const playback:LWStorytelling.Playback={
   status:()=>({cutsceneId:clip.id,sceneId:clip.sceneId,state,time,duration:clip.duration,completion:time/clip.duration,generation}),
   sample:()=>{alive();return sampled(clip,time);},
   play(){alive();if(state==='playing')return;if(state==='paused'){state='playing';return;}restart();},
   pause(){alive();if(state==='playing')state='paused';},resume(){alive();if(state==='paused')state='playing';},
   stop(){alive();state='stopped';time=0;queue.length=0;fired.clear();},replay:restart,
   seek(seconds){alive();if(!Number.isFinite(seconds)||seconds<0||seconds>clip.duration)fail('Seek time must fit the duration.');time=seconds;queue.length=0;for(const cue of clip.events??[])if(cue.time<=time)fired.add(cue.id);if(state==='finished')state='paused';},
   skip(){alive();if(state==='finished'||state==='stopped')return;if(clip.skipPolicy==='cancel'){playback.stop();return;}cues(time,clip.duration);finish();},
   advance(seconds){alive();if(!Number.isFinite(seconds)||seconds<0||seconds>60)fail('Elapsed time must be between 0 and 60 seconds.');if(state!=='playing')return;const next=Math.min(clip.duration,time+seconds);cues(time,next);time=next;if(time===clip.duration)finish();},
   drainEvents:()=>{alive();return queue.splice(0);},dispose(){state='disposed';queue.length=0;fired.clear();}
  };
  return Object.freeze(playback);
 }
 const api:LWStorytelling.Api={validate:validation.validate,sample,create};root.LWStorytelling=api;if(node)module.exports=api;
})(globalThis);
