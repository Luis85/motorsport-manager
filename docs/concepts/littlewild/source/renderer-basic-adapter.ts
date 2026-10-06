/// <reference path="./renderer-contracts.d.ts" />
/* Only this compatibility adapter knows the legacy world renderer and its live engine. */
(function(inputRoot:unknown){
 'use strict';
 interface Legacy {
  canvas:HTMLCanvasElement;camera:{x:number;y:number;z:number};engine:unknown;motion:unknown;
  observer:ResizeObserver;input?:{cancel():void;dispose?():void};labels?:HTMLElement;atmosphere?:HTMLElement;
  draw(time:number,delta:number):void;resize():void;home():void;resetPresentation?():void;
  suspend?():void;resume?():void;dispose?():void;
  [key:string]:unknown;
 }
 const root=inputRoot as {LWArt:{World:new(canvas:HTMLCanvasElement,engine:unknown,handlers:unknown)=>Legacy;World2D:new(canvas:HTMLCanvasElement,engine:unknown,handlers:unknown)=>Legacy};LWRendererBasic?:unknown;};
 function create(canvas:HTMLCanvasElement,engine:unknown,handlers:unknown){
  const world=new root.LWArt.World(canvas,engine,handlers);
  return {world,mount(){world.resume?.();},suspend(){world.suspend?.();},draw(time:number,delta:number){world.draw(time,delta);},
   setEngine(value:unknown){world.engine=value;world.resetPresentation?.();world.home();},dispose(){world.dispose?.();}};
 }
 function create2D(canvas:HTMLCanvasElement,engine:unknown,camera:LittlewildRenderer.Camera):LittlewildRenderer.Instance {
  const world=new root.LWArt.World2D(canvas,engine,{});world.suspend?.();world.camera=camera;let sceneView='';
  function fit(frame:LittlewildRenderer.Frame){const bounds=frame.scene?.bounds;if(!bounds||frame.scene?.kind==='interior')return;const signature=frame.scene!.id+':'+JSON.stringify(bounds);if(signature===sceneView)return;sceneView=signature;world.camera.z=Math.max(.3,Math.min(2.6,(frame.viewport.width-60)/((bounds.width+bounds.height)*24),(frame.viewport.height-100)/((bounds.width+bounds.height)*12)));const center={x:bounds.x+(bounds.width-1)/2,y:bounds.y+(bounds.height-1)/2},point=(world.toScreen as (x:number,y:number)=>LittlewildRenderer.Point)(center.x,center.y);world.camera.x+=frame.viewport.width/2-point.x;world.camera.y+=frame.viewport.height/2-point.y;}
  return {mount(){},resize(viewport){canvas.width=viewport.width;canvas.height=viewport.height;},draw(frame){fit(frame);world.running=frame.running;world.presentationAlpha=frame.alpha;world.draw(frame.time,frame.delta);},dispose(){world.dispose?.();},
   project(point){return (world.toScreen as (x:number,y:number)=>LittlewildRenderer.Point)(point.x,point.y);},toTile(point){return (world.toTile as (x:number,y:number)=>LittlewildRenderer.Point)(point.x,point.y);},hitTest(point){return (world.hitTest as (x:number,y:number)=>LittlewildRenderer.Hit)(point.x,point.y);}};
 }
 root.LWRendererBasic={create,create2D};
})(globalThis);
