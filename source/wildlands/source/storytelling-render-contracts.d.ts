/// <reference path="./storytelling-contracts.d.ts" />
/// <reference path="./renderer-contracts.d.ts" />
/** Detached renderer-facing cinematic projection. */
declare namespace LWStorytelling {
 interface PreviewSource {frame(options:{camera:LittlewildRenderer.Camera;viewport:LittlewildRenderer.Viewport;time:number;delta:number}):LittlewildRenderer.Frame;asset(category:'actor'|'building'|'item',id:string):LittlewildDeveloper.Document|null;definition(id:string):LittlewildDeveloper.Document|null;}
 interface RenderingApi {frame(frame:LittlewildRenderer.Frame,sample:Sample):LittlewildRenderer.Frame;}
}
