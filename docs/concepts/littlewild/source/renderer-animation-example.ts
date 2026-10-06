/// <reference path="./animation-contracts.d.ts" />
/** A coding-agent-ready compiled extension; JSON only selects the registered ID. */
declare var LWAnimationExample:{register():()=>void;create(canvas:HTMLCanvasElement,project:(point:LittlewildRenderer.Point,frame:LittlewildRenderer.Frame)=>LittlewildRenderer.Point):{ready:Promise<LittlewildRenderer.SwitchResult>;draw(frame:LittlewildRenderer.Frame,seconds:number):void;dispose():void}};
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWAnimations:LWAnimations.Api;LWAnimationExample?:typeof LWAnimationExample};
 root.LWAnimationExample={
  register(){return root.LWAnimations.register({id:'gentle-pulse',name:'Gentle pulse',description:'A deterministic breathing ring.',source:'source/renderer-animation-example.ts'},({p5,center,radius,color,phase})=>{p5.noFill();p5.stroke(color);p5.strokeWeight(3);const width=radius*(1+.2*Math.sin(phase*Math.PI*2));p5.ellipse(center.x,center.y,width,width*.5);});},
  create(canvas,project){
   const descriptors=root.LWAnimations.validate([{id:'example-pulse',presetId:'gentle-pulse',start:0,duration:4,x:9,y:9,radius:80,color:'#dfab58',count:1,seed:42}]),layer=root.LWAnimations.create(canvas);
   return{ready:layer.ready,draw(frame,seconds){layer.draw(frame,descriptors,seconds%4,point=>project(point,frame));},dispose:layer.dispose};
  }
 };
})(globalThis);
