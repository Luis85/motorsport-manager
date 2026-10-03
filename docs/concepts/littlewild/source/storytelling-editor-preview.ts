/// <reference path="./storytelling-ui-contracts.d.ts" />
/* Composition forwards the existing application RAF; previews never own a clock. */
(function(inputRoot:unknown){
 'use strict';
 interface Renderer {ready:Promise<LittlewildRenderer.SwitchResult>;draw(time:number,delta:number):void;dispose():void;}
 const root=inputRoot as {LWScenarios:LWContentPorts.ScenarioApi;LWStorytelling:LWStorytelling.Api;LWStorytellingRenderer:{create(container:HTMLElement,pack:LWContentPorts.ScenarioPack,sceneId:string,playback:LWStorytelling.Playback):Renderer};LWStorytellingEditorPreview?:{create(canvas:HTMLCanvasElement,pack:LWContentPorts.ScenarioPack,id:string):LWStorytellingUI.Preview};};
 function create(canvas:HTMLCanvasElement,input:LWContentPorts.ScenarioPack,id:string):LWStorytellingUI.Preview{
  const admission=root.LWScenarios.validate(input);if(!admission.ok)throw Error(admission.errors.join('\n'));
  const pack=admission.pack,clip=pack.storytelling?.cutscenes.find(c=>c.id===id);if(!clip)throw Error('Choose an existing cutscene.');
  const container=canvas.parentElement;if(!container)throw Error('Mount the preview canvas before preparing a cutscene.');
  const playback=root.LWStorytelling.create(pack,id);let disposed=false,renderer:Renderer;
  try{renderer=root.LWStorytellingRenderer.create(container,pack,clip.sceneId,playback);}catch(error){playback.dispose();throw error;}
  function alive():void{if(disposed)throw Error('The cinematic preview is closed.');}
  return Object.freeze({ready:renderer.ready,status:playback.status,
   play(){alive();playback.play();},pause(){alive();playback.pause();},stop(){alive();playback.stop();},replay(){alive();playback.replay();},seek(time:number){alive();playback.seek(time);},
   draw(delta:number){alive();playback.advance(delta);playback.drainEvents();renderer.draw(playback.status().time,delta);},
   dispose(){if(disposed)return;disposed=true;renderer.dispose();playback.dispose();}
  });
 }
 const api={create};root.LWStorytellingEditorPreview=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
