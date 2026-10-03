/// <reference path="./renderer-contracts.d.ts" />
/// <reference path="./renderer-scene-2d.ts" />
/* Pixi owns GPU resources; the player owns every frame and simulation clock. */
(function(inputRoot:unknown){
 'use strict';
 interface Container {addChild(child:Container):void;destroy(options?:{children:boolean}):void;visible:boolean;}
 interface Graphics extends Container {clear():void;poly(points:number[]):Graphics;circle(x:number,y:number,r:number):Graphics;fill(options:{color:string;alpha?:number}):Graphics;}
 interface Label extends Container {text:string;x:number;y:number;style:{fill:string;fontSize:number};}
 interface Renderer {init(options:{canvas:HTMLCanvasElement;width:number;height:number;resolution:number;antialias:boolean;background:string;autoDensity:boolean;powerPreference:string}):Promise<void>;render(stage:Container):void;resize(width:number,height:number):void;destroy(options?:{removeView:boolean}):void;}
 interface Library {VERSION:string;WebGLRenderer:new()=>Renderer;Container:new()=>Container;Graphics:new()=>Graphics;Text:new(options:{text:string;style:{fill:string;fontSize:number;fontFamily:string}})=>Label;}
 const root=inputRoot as {PIXI?:Library;LWRenderers:LittlewildRenderer.Registry;LWRendererScene2D:LittlewildRenderer2D.Api;};
 root.LWRenderers.registerAsync({id:'pixi-2d',name:'PixiJS 2D',description:'PixiJS 8.22.0 WebGL scene renderer with CSP-safe shader synchronization.',dimensions:['2d'],capabilities:['camera','hit-test','interiors','terrain-preview','construction-preview']},async context=>{
  const library=root.PIXI;if(!library||library.VERSION!=='8.22.0')throw Error('Pinned PixiJS 8.22.0 is unavailable.');
  const renderer=new library.WebGLRenderer(),stage=new library.Container(),graphics=new library.Graphics(),labels:Label[]=[];
  let disposed=false,initialized=false,releaseRequested=false,labelIndex=0;
  const release=()=>{releaseRequested=true;if(disposed||!initialized)return;disposed=true;stage.destroy({children:true});try{renderer.destroy({removeView:false});}catch(_){}};
  context.onDispose(release);stage.addChild(graphics);
  try{await renderer.init({canvas:context.canvas,width:context.canvas.width,height:context.canvas.height,resolution:1,antialias:true,background:'#dfeade',autoDensity:false,powerPreference:'low-power'});}catch(error){initialized=true;release();throw error;}initialized=true;
  if(context.signal.aborted||releaseRequested){release();throw Error('PixiJS preparation was cancelled.');}
  const painter:LittlewildRenderer2D.Painter={
   polygon(points,color,opacity=1){graphics.poly(points.flatMap(p=>[p.x,p.y])).fill({color,alpha:opacity});},
   circle(x,y,r,color){graphics.circle(x,y,r).fill({color});},
   text(value,x,y,color,size){if(labelIndex>=160)return;let label=labels[labelIndex];if(!label){label=new library.Text({text:value,style:{fill:color,fontSize:size,fontFamily:'sans-serif'}});labels.push(label);stage.addChild(label);}label.text=value;label.x=x;label.y=y;label.style.fill=color;label.style.fontSize=size;label.visible=true;labelIndex++;}
  };
  return {mount(){},resize(viewport){if(disposed)throw Error('PixiJS renderer is disposed.');renderer.resize(viewport.width,viewport.height);},
   draw(frame){if(disposed)throw Error('PixiJS renderer is disposed.');graphics.clear();labelIndex=0;root.LWRendererScene2D.draw(frame,context,painter);for(let i=labelIndex;i<labels.length;i++)labels[i]!.visible=false;renderer.render(stage);},
   dispose:release,project:root.LWRendererScene2D.project,toTile:root.LWRendererScene2D.toTile,hitTest:root.LWRendererScene2D.hitTest};
 });
})(globalThis);
