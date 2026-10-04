/// <reference path="./renderer-contracts.d.ts" />
/// <reference path="./renderer-scene-2d.ts" />
/* Excalibur's graphics context is used directly: no Engine, ticker, input or audio. */
(function(inputRoot:unknown){
 'use strict';
 interface Vector {x:number;y:number;}
 interface Color {a:number;}
 interface Graphics {beginDrawLifecycle():void;endDrawLifecycle():void;clear():void;flush():void;updateViewport(viewport:{width:number;height:number}):void;dispose():void;textureLoader:{delete(image:HTMLCanvasElement):void};drawCircle(point:Vector,radius:number,color:Color):void;debug:{drawText(value:string,point:Vector):void};}
 interface Font {size:number;family:string;color:Color;}
 interface Label {text:string;color:Color;font:Font;readonly width:number;draw(context:Graphics,x:number,y:number):void;}
 interface Polygon {_bitmap:HTMLCanvasElement;draw(context:Graphics,x:number,y:number):void;}
 interface Library {ExcaliburGraphicsContextWebGL:new(options:{canvasElement:HTMLCanvasElement;antialiasing:boolean;multiSampleAntialiasing:boolean;backgroundColor:Color})=>Graphics;Vector:new(x:number,y:number)=>Vector;Color:{fromHex(value:string):Color};Font:new(options:{family:string;size:number;color:Color})=>Font;Text:new(options:{text:string;font:Font;color:Color})=>Label;FontCache:{cacheSize:number;clearCache():void};Polygon:new(options:{points:Vector[];color:Color})=>Polygon;}
 const root=inputRoot as {ex?:Library;LWRenderers:LittlewildRenderer.Registry;LWRendererScene2D:LittlewildRenderer2D.Api;};
 root.LWRenderers.register({id:'excalibur-2d',name:'ExcaliburJS 2D',description:'ExcaliburJS 0.32.0 graphics context, driven by the player frame loop.',dimensions:['2d'],capabilities:['camera','hit-test','interiors','terrain-preview','construction-preview']},context=>{
  const library=root.ex;if(!library)throw Error('Pinned ExcaliburJS 0.32.0 is unavailable.');
  const graphics=new library.ExcaliburGraphicsContextWebGL({canvasElement:context.canvas,antialiasing:false,multiSampleAntialiasing:false,backgroundColor:library.Color.fromHex('#dfeade')});
  let disposed=false,labelIndex=0;const labels:Label[]=[];const polygons=new Map<string,Polygon>(),colors=new Map<string,Color>();
  function color(value:string,opacity=1):Color {const key=value+':'+opacity;let found=colors.get(key);if(!found){found=library!.Color.fromHex(value);found.a=opacity;if(colors.size>=128)colors.clear();colors.set(key,found);}return found;}
  function release(){if(disposed)return;disposed=true;polygons.clear();colors.clear();graphics.dispose();}context.onDispose(release);
  const painter:LittlewildRenderer2D.Painter={
   polygon(points,fill,opacity=1){if(!points.length)return;const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));const normalized=points.map(p=>new library.Vector(p.x-x,p.y-y)),key=fill+':'+opacity+':'+normalized.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).join(';');let shape=polygons.get(key);if(!shape){shape=new library.Polygon({points:normalized,color:color(fill,opacity)});if(polygons.size>=2048){graphics.flush();for(const cached of polygons.values())graphics.textureLoader.delete(cached._bitmap);polygons.clear();}polygons.set(key,shape);}shape.draw(graphics,x,y);},
   circle(x,y,r,fill){graphics.drawCircle(new library.Vector(x,y),r,color(fill));},
   text(value,x,y,fill,size){if(labelIndex>=160)return;let label=labels[labelIndex];if(!label){label=new library.Text({text:value,font:new library.Font({family:'sans-serif',size,color:color(fill)}),color:color(fill)});labels.push(label);}label.text=value;label.color=color(fill);label.font.size=size;label.draw(graphics,x-label.width/2,y);labelIndex++;}
  };
  return {redrawPolicy:'projection',mount(){},resize(viewport){if(disposed)throw Error('Excalibur renderer is disposed.');graphics.updateViewport({width:viewport.width,height:viewport.height});},
   draw(frame){if(disposed)throw Error('Excalibur renderer is disposed.');graphics.beginDrawLifecycle();try{graphics.clear();labelIndex=0;if(library.FontCache.cacheSize>256)library.FontCache.clearCache();root.LWRendererScene2D.draw(frame,context,painter);graphics.flush();}finally{graphics.endDrawLifecycle();}},
   dispose:release,project:root.LWRendererScene2D.project,toTile:root.LWRendererScene2D.toTile,hitTest:root.LWRendererScene2D.hitTest};
 });
})(globalThis);
