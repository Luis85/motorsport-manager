/// <reference path="./storytelling-ui-contracts.d.ts" />
/* Composition forwards the existing application RAF; previews never own a clock. */
(function(inputRoot:unknown){
 'use strict';
 interface Renderer {ready:Promise<LittlewildRenderer.SwitchResult>;draw(time:number,delta:number):void;updatePlayback(playback:LWStorytelling.Playback):boolean;retire?():(()=>Promise<void>)|undefined;dispose():void;}
 const root=inputRoot as {LWScenarios:LWContentPorts.ScenarioApi;LWStorytelling:LWStorytelling.Api;LWStorytellingRenderer:{create(container:HTMLElement,pack:LWContentPorts.ScenarioPack,sceneId:string,playback:LWStorytelling.Playback):Renderer};LWStorytellingEditorPreview?:{create(canvas:HTMLCanvasElement,pack:LWContentPorts.ScenarioPack,id:string):LWStorytellingUI.Preview};};
 function create(canvas:HTMLCanvasElement,input:LWContentPorts.ScenarioPack,id:string):LWStorytellingUI.Preview{
  const admission=root.LWScenarios.validate(input);if(!admission.ok)throw Error(admission.errors.join('\n'));
  const pack=admission.pack,clip=pack.storytelling?.cutscenes.find(c=>c.id===id);if(!clip)throw Error('Choose an existing cutscene.');
  const sceneId=clip.sceneId;
  const container=canvas.parentElement;if(!container)throw Error('Mount the preview canvas before preparing a cutscene.');
  const presentationIdentity=(pack:LWContentPorts.ScenarioPack):string=>JSON.stringify({...pack,storytelling:null});
  const identity=presentationIdentity(pack);
  let playback=root.LWStorytelling.create(pack,id),disposed=false,renderer:Renderer,retired:(()=>Promise<void>)|null=null;
  try{renderer=root.LWStorytellingRenderer.create(container,pack,clip.sceneId,playback);}catch(error){playback.dispose();throw error;}
  function alive():void{if(disposed)throw Error('The cinematic preview is closed.');}
  function update(input:LWContentPorts.ScenarioPack,nextId:string):boolean{
   alive();const admission=root.LWScenarios.validate(input);if(!admission.ok)throw Error(admission.errors.join('\n'));
   const next=admission.pack,nextClip=next.storytelling?.cutscenes.find(value=>value.id===nextId);
   if(nextId!==id||!nextClip||nextClip.sceneId!==sceneId||presentationIdentity(next)!==identity)return false;
   const staged=root.LWStorytelling.create(next,nextId);
   try{if(!renderer.updatePlayback(staged)){staged.dispose();return false;}}
   catch(error){staged.dispose();throw error;}
   const prior=playback;playback=staged;prior.dispose();return true;
  }
  function dispose():void{if(disposed){if(retired)void retired().catch(error=>console.error('Cinematic preview resource release failed.',error));return;}disposed=true;try{renderer.dispose();}finally{playback.dispose();}}
  const preview:LWStorytellingUI.Preview=Object.freeze({ready:renderer.ready,status:()=>playback.status(),update,
   play(){alive();playback.play();},pause(){alive();playback.pause();},stop(){alive();playback.stop();},replay(){alive();playback.replay();},seek(time:number){alive();playback.seek(time);},
   draw(delta:number){alive();playback.advance(delta);playback.drainEvents();renderer.draw(playback.status().time,delta);},
   retire(this:LWStorytellingUI.Preview){if(this!==preview||this.dispose!==dispose||disposed)return undefined;const finalize=renderer.retire?.();if(!finalize)return undefined;disposed=true;
    const errors:unknown[]=[];try{playback.dispose();}catch(error){errors.push(error);}let completion:Promise<void>|null=null;
    retired=()=>completion??=(async()=>{try{await finalize();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Cinematic preview retirement failed.');})();return retired;},
   dispose
  });return preview;
 }
 const api={create};root.LWStorytellingEditorPreview=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
