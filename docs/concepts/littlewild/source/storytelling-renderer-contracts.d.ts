/// <reference path="./storytelling-render-contracts.d.ts" />
declare namespace LWStorytellingRenderer {
 interface Preview {readonly ready:Promise<LittlewildRenderer.SwitchResult>;snapshot():LittlewildRenderer.Frame;draw(time:number,delta:number):void;dispose():void;}
 interface Api {create(container:HTMLElement,pack:LWContentPorts.ScenarioPack,sceneId:string,playback:LWStorytelling.Playback):Preview;}
}
declare var LWStorytellingRenderer:LWStorytellingRenderer.Api;
declare var LWRendererObserver:{create(context:LittlewildRenderer.Context,dimension:LittlewildRenderer.Dimension):LittlewildRenderer.Instance};
declare var LWStorytellingPreview:{create(pack:LWContentPorts.ScenarioPack,sceneId:string):LWStorytelling.PreviewSource};
declare var LWStorytellingProjection:LWStorytelling.RenderingApi;
