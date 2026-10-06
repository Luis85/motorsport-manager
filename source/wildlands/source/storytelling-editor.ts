/// <reference path="./storytelling-contracts.d.ts" />
/* All authoring writes travel through the existing detached pack revision authority. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWContent:LWContentPorts.ContentApi;LWStorytellingEditor?:{create(editor:LWSceneEditor.Session):LWStorytelling.Authoring}};
 function create(editor:LWSceneEditor.Session):LWStorytelling.Authoring {
  const copy=<T>(value:T):T=>root.LWContent.copy(value);
  function edit(expected:number|undefined,apply:(pack:LWContentPorts.ScenarioPack,data:LWStorytelling.Data)=>void):void {
   if(expected!==undefined&&expected!==editor.revision)throw Error('Storytelling revision is stale; inspect the current draft.');
   const pack=editor.snapshot();pack.storytelling??={version:1,cutscenes:[],storyboards:[]};apply(pack,pack.storytelling);editor.replace(pack);
  }
  return Object.freeze({
   get revision(){return editor.revision;},list:():LWStorytelling.Data=>copy(editor.snapshot().storytelling??{version:1,cutscenes:[],storyboards:[]}),
   setCutscene(input:LWStorytelling.Cutscene,expected?:number){input=copy(input);edit(expected,(_pack,data)=>{const index=data.cutscenes.findIndex(row=>row.id===input.id);if(index<0)data.cutscenes.push(copy(input));else data.cutscenes[index]=copy(input);});},
   removeCutscene(id:string,expected?:number){edit(expected,(_pack,data)=>{const index=data.cutscenes.findIndex(row=>row.id===id);if(index<0)throw Error('Choose an existing cutscene.');data.cutscenes.splice(index,1);if(data.progress){data.progress.once=data.progress.once.filter(key=>key.split('|')[1]!==id);data.progress.completed=data.progress.completed.filter(key=>key.split('|')[1]!==id);}});},
   setStoryboard(input:LWStorytelling.Storyboard,expected?:number){input=copy(input);edit(expected,(_pack,data)=>{const index=data.storyboards.findIndex(row=>row.id===input.id);if(index<0)data.storyboards.push(copy(input));else data.storyboards[index]=copy(input);});},
   removeStoryboard(id:string,expected?:number){edit(expected,(_pack,data)=>{const index=data.storyboards.findIndex(row=>row.id===id);if(index<0)throw Error('Choose an existing storyboard.');data.storyboards.splice(index,1);});},
   setEvents(sceneId:string,events:LWSceneGraph.Event[],expected?:number){events=copy(events);edit(expected,(pack)=>{const scene=pack.scenes.find(row=>row.id===sceneId);if(!scene)throw Error('Choose an existing scene.');scene.graph??={kind:'level'};scene.graph.events=copy(events);});}
  });
 }
 const api={create};root.LWStorytellingEditor=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
