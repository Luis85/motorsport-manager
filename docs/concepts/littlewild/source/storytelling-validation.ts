/// <reference path="./content-contracts.d.ts" />
/// <reference path="./storytelling-data-contracts.d.ts" />
/* Pure reference checks: validating an event never executes it. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWAnimationCatalog?:{list():readonly {id:string}[]};LWContent:LWContentPorts.ContentApi;LWScenarioShape:(input:unknown,schema:LWContentPorts.Schema)=>string[];LWScenarioSchema:LWContentPorts.Schema;LWSceneGraph:LWSceneGraph.Api;LWStorytellingValidation?:{validate(pack:LWContentPorts.ScenarioPack):void;reconcile(before:LWContentPorts.ScenarioPack,next:LWContentPorts.ScenarioPack):void}};
 const graph=():LWSceneGraph.Api=>typeof module!=='undefined'&&module.exports?require('./scene-graph.js') as LWSceneGraph.Api:root.LWSceneGraph;
 function validate(pack:LWContentPorts.ScenarioPack):void {
  root.LWContent.parse(pack,8*1024*1024);
  const node=typeof module!=='undefined'&&module.exports;
  const shape=(node?require('./scenario-shape.js'):root.LWScenarioShape) as typeof root.LWScenarioShape;
  const schema=(node?require('./content/scenario.schema.json'):root.LWScenarioSchema) as LWContentPorts.Schema;
  if(pack.storytelling){const errors=shape(pack.storytelling,{$ref:'#/$defs/storytelling',$defs:schema.$defs!});if(errors.length)throw Error(errors.join('\n'));}
  const data=pack.storytelling,clips=data?.cutscenes??[];
  const scene=(id:string):LWContentPorts.Scene=>pack.scenes.find(row=>row.id===id)??fail('Unknown scene '+id+'.');
  function fail(message:string):never {throw Error('Storytelling: '+message);}
  function unique(rows:{id:string}[],label:string):void{if(new Set(rows.map(row=>row.id)).size!==rows.length)fail('Duplicate '+label+' IDs.');}
  function events(values:LWSceneGraph.Event[]|undefined,sceneId:string):void {
   if((values?.length??0)>64)fail('At most 64 events are allowed.');
   for(const event of values??[]){
    if(event.type==='play-cutscene'){
     const clip=clips.find(row=>row.id===event.cutsceneId);if(!clip)fail('Unknown cutscene '+event.cutsceneId+'.');
     if(clip.sceneId!==sceneId)fail('Play-cutscene events must reference a cutscene in the current scene.');
    }
    if(event.type==='scene-switch'&&!scene(sceneId).graph?.connections?.some(link=>link.id===event.connectionId))fail('Scene-switch events must use an existing connection in their source scene.');
   }
  }
  for(const selected of pack.scenes){unique(selected.graph?.triggers??[],'scene trigger');for(const trigger of selected.graph?.triggers??[])events(trigger.events,selected.id);events(selected.graph?.events,selected.id);for(const link of selected.graph?.connections??[])events(link.events,link.targetSceneId);}
  if(!data)return;
  if(data.progress){
   for(const field of ['once','triggers','completed'] as const)for(const key of data.progress[field]){
    const [sceneId,id,...rest]=key.split('|'),selected=pack.scenes.find(row=>row.id===sceneId);
    if(rest.length||!selected||!id)fail('Unknown storytelling progress scene.');
    if(field==='triggers'?!selected.graph?.triggers?.some(row=>row.id===id):!clips.some(row=>row.id===id&&row.sceneId===sceneId))fail('Unknown storytelling progress reference.');
   }
  }
  unique(clips,'cutscene');unique(data.storyboards,'storyboard');
  let keys=0;
  for(const clip of clips){
   scene(clip.sceneId);unique(clip.tracks,'track');unique(clip.animations??[],'animation');
   for(const animation of clip.animations??[]){if(animation.start+animation.duration>clip.duration)fail('Animation range must fit its cutscene.');if(!(root.LWAnimationCatalog?.list()??[{id:'sparkles'},{id:'orbit'},{id:'ripple'}]).some(preset=>preset.id===animation.presetId))fail('Animation references an unregistered compiled preset.');}unique(clip.events??[],'cue');
   const entities=graph().entities(pack,clip.sceneId),channels=new Set<string>();
   for(const track of clip.tracks){
    if(track.property==='pose'&&track.target.category!=='creatures')fail('Rig pose tracks require a creature target.');
    const target=track.target,channel=target.category+':'+('id'in target?target.id:'')+':'+track.property;
    if(channels.has(channel))fail('Each target property can have only one track.');channels.add(channel);
    if(target.category!=='camera'&&!entities.some(entity=>entity.category===target.category&&entity.id===target.id))fail('Track '+track.id+' references an unavailable scene entity.');
    let prior=-1;
    for(const key of track.keyframes){
     if(++keys>16384)fail('Aggregate keyframe limit exceeded.');
     if(key.time<=prior||key.time>clip.duration)fail('Keyframe times must increase within the cutscene duration.');prior=key.time;
     if((track.property==='opacity'||track.property==='pose')&&(key.value<0||key.value>1))fail('Opacity and pose must lie between 0 and 1.');
     if((track.property==='scale'||track.property==='zoom')&&(key.value<.01||key.value>10))fail('Scale and zoom must lie between 0.01 and 10.');
    }
   }
   let prior=-1;for(const cue of clip.events??[]){if(cue.time<prior||cue.time>clip.duration)fail('Cue times must be ordered within duration.');prior=cue.time;events([cue.event],clip.sceneId);}
   events(clip.onFinish,clip.sceneId);
  }
  for(const board of data.storyboards){
   unique(board.shots,'shot');
   for(const shot of board.shots){
    scene(shot.sceneId);
    if(shot.cutsceneId){
     const clip=clips.find(row=>row.id===shot.cutsceneId);if(!clip||clip.sceneId!==shot.sceneId)fail('Storyboard shot cutscene must belong to its scene.');
     const start=shot.start??0,end=shot.end??clip.duration;if(start<0||end>clip.duration||start>=end)fail('Storyboard shot range must fit its cutscene.');
    }else if(shot.start!==undefined||shot.end!==undefined)fail('Timed shots require a cutscene.');
   }
  }
 }
 function reconcile(before:LWContentPorts.ScenarioPack,next:LWContentPorts.ScenarioPack):void {
  const progress=next.storytelling?.progress;if(!progress)return;
  function exists(pack:LWContentPorts.ScenarioPack,key:string,field:'once'|'triggers'|'completed'):boolean {
   const [sceneId,id,...rest]=key.split('|');if(rest.length||!sceneId||!id)return false;
   return field==='triggers'?!!pack.scenes.find(row=>row.id===sceneId)?.graph?.triggers?.some(row=>row.id===id):!!pack.storytelling?.cutscenes.some(row=>row.sceneId===sceneId&&row.id===id);
  }
  for(const field of ['once','triggers','completed'] as const)progress[field]=progress[field].filter(key=>!exists(before,key,field)||exists(next,key,field));
 }
 const api={validate,reconcile};root.LWStorytellingValidation=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
