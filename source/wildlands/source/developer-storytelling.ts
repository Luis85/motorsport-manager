/// <reference path="./storytelling-contracts.d.ts" />
/* Typed, detached developer tools. The application supplies playback elapsed time. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWContent:LWContentPorts.ContentApi;LWScenarios:LWContentPorts.ScenarioApi;LWSceneEditor:LWSceneEditor.Api;LWStorytelling:LWStorytelling.Api;LWStorytellingEditor:{create(editor:LWSceneEditor.Session):LWStorytelling.Authoring};LWDeveloperStorytelling?:unknown};
 function accepted(input:unknown):LWContentPorts.ScenarioPack{const checked=root.LWScenarios.validate(input);if(!checked.ok)throw Error(checked.errors.join('\n'));return checked.pack;}
 const api={
  inspect(input:unknown):LWStorytelling.Data{return root.LWContent.copy(accepted(input).storytelling??{version:1,cutscenes:[],storyboards:[]});},
  createEditor(input:unknown):{scene:LWSceneEditor.Session;storytelling:LWStorytelling.Authoring}{const scene=root.LWSceneEditor.create(input);return Object.freeze({scene,storytelling:root.LWStorytellingEditor.create(scene)});},
  createPlayback(input:unknown,id:string):LittlewildDeveloper.CutscenePlayback{const owned=root.LWStorytelling.create(accepted(input),id);return Object.freeze({status:owned.status,sample:owned.sample,play:owned.play,pause:owned.pause,resume:owned.resume,stop:owned.stop,replay:owned.replay,seek:owned.seek,skip:owned.skip,dispose:owned.dispose});},
  sample(input:unknown,id:string,time:number):LWStorytelling.Sample{return root.LWStorytelling.sample(accepted(input),id,time);}
 };
 root.LWDeveloperStorytelling=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
