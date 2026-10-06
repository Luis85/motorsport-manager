/// <reference path="./storytelling-render-contracts.d.ts" />
declare namespace LWStorytellingRenderer {
 interface Preview {readonly ready:Promise<LittlewildRenderer.SwitchResult>;snapshot():LittlewildRenderer.Frame;draw(time:number,delta:number):void;
  /** Composition must admit the same native scene/catalog before replacing its detached timeline. Does not paint or advance time. */
  updatePlayback(playback:LWStorytelling.Playback):boolean;
  /** Undefined has no effects. Bound to the original receiver and disposal method: copied or wrapped lifecycles must explicitly delegate retirement to the original owner. Success detaches both canvases. Call and await the captured idempotent finalizer; dispose starts that same release. */
  retire?():(()=>Promise<void>)|undefined;
  dispose():void;
 }
 interface Api {create(container:HTMLElement,pack:LWContentPorts.ScenarioPack,sceneId:string,playback:LWStorytelling.Playback):Preview;}
}
declare var LWStorytellingRenderer:LWStorytellingRenderer.Api;
declare var LWRendererObserver:{create(context:LittlewildRenderer.Context,dimension:LittlewildRenderer.Dimension):LittlewildRenderer.Instance};
declare var LWStorytellingPreview:{create(pack:LWContentPorts.ScenarioPack,sceneId:string):LWStorytelling.PreviewSource};
declare var LWStorytellingProjection:LWStorytelling.RenderingApi;
