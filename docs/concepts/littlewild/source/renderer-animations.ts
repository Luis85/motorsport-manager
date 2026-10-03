/// <reference path="./animation-contracts.d.ts" />
/* Real p5 instance-mode sketches, sampled by the existing host cadence. No p5 loop or gameplay RNG. */
(function(inputRoot:unknown){
 'use strict';
 interface Sketch extends LWAnimations.Drawing {setup:()=>void;draw:()=>void;noLoop():void;isLooping():boolean;pixelDensity(value:number):void;createCanvas(width:number,height:number,canvas:HTMLCanvasElement):unknown;resizeCanvas(width:number,height:number,noRedraw:boolean):void;clear():void;redraw():Promise<void>;remove():Promise<void>;}
 const root=inputRoot as {p5?:new(sketch:(instance:Sketch)=>void,node:HTMLElement)=>Sketch;LWDeveloperData:{copy(input:unknown):LittlewildDeveloper.Json;record(input:unknown):LittlewildDeveloper.Document};LWAnimationCatalogRecords:{add(metadata:LWAnimations.Metadata):()=>void};LWAnimations?:LWAnimations.Api;};
 const presets=new Map<string,{metadata:LWAnimations.Metadata;draw:LWAnimations.Preset}>();
 function register(input:LWAnimations.Metadata,draw:LWAnimations.Preset):()=>void {
  const value=root.LWDeveloperData.record(input),{id,name,description}=value;
  if(typeof id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(id)||presets.has(id)||typeof name!=='string'||!name.trim()||[...name].length>80||typeof description!=='string'||[...description].length>400||typeof draw!=='function')throw Error('Invalid or duplicate compiled animation preset.');
  if(value.source!==undefined&&(typeof value.source!=='string'||value.source.length>200||!value.source.trim()))throw Error('Invalid animation source provenance.');
  const entry={metadata:Object.freeze({id,name,description,...(typeof value.source==='string'?{source:value.source}:{})}),draw},remove=root.LWAnimationCatalogRecords.add(entry.metadata);presets.set(id,entry);return()=>{if(presets.get(id)===entry){presets.delete(id);remove();}};
 }
 function validate(input:unknown):readonly LWAnimations.Descriptor[] {
  const values=root.LWDeveloperData.copy(input);if(!Array.isArray(values)||values.length>16)throw Error('Animations require at most 16 descriptors.');const ids=new Set<string>();
  const result=values.map(raw=>{const v=root.LWDeveloperData.record(raw);if(Object.keys(v).some(key=>!['id','presetId','start','duration','x','y','radius','color','count','seed'].includes(key)))throw Error('Unknown animation field.');
   const numeric=(key:string,min:number,max:number):number=>{const value=v[key];if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error('Invalid animation '+key+'.');return value;};
   if(typeof v.id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(v.id)||ids.has(v.id)||typeof v.presetId!=='string'||!presets.has(v.presetId)||typeof v.color!=='string'||!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v.color))throw Error('Invalid animation identifier, preset or color.');ids.add(v.id);
   const count=numeric('count',1,128);if(!Number.isInteger(count))throw Error('Animation count must be an integer.');const seed=v.seed===undefined?undefined:numeric('seed',0,4294967295);if(seed!==undefined&&!Number.isInteger(seed))throw Error('Animation seed must be an integer.');
   return Object.freeze({id:v.id,presetId:v.presetId,start:numeric('start',0,86400),duration:numeric('duration',.001,86400),x:numeric('x',-10000,10000),y:numeric('y',-10000,10000),radius:numeric('radius',1,1000),color:v.color,count,...(seed===undefined?{}:{seed})});
  });return Object.freeze(result);
 }
 const hash=(value:string):number=>{let result=2166136261;for(const character of value)result=Math.imul(result^character.codePointAt(0)!,16777619);return result>>>0;};
 function create(canvas:HTMLCanvasElement):LWAnimations.Layer {
  const P5=root.p5;if(!P5)throw Error('Pinned p5.js 2.3.4 is unavailable.');const parent=canvas.parentElement;if(!parent)throw Error('Mount the animation canvas before creating its layer.');
  let disposed=false,initialized=false,busy=false,request:{frame:LittlewildRenderer.Frame;descriptors:readonly LWAnimations.Descriptor[];time:number;project:(point:LittlewildRenderer.Point)=>LittlewildRenderer.Point}|null=null;
  let resolveReady:(result:LittlewildRenderer.SwitchResult)=>void=()=>{};const ready=new Promise<LittlewildRenderer.SwitchResult>(resolve=>{resolveReady=resolve;});
  const sketch=new P5(p=>{
   p.noLoop();p.setup=()=>{p.noLoop();p.pixelDensity(1);p.createCanvas(canvas.width,canvas.height,canvas);if(disposed){void p.remove();resolveReady({ok:false,reason:'Animation layer was disposed.'});}};
   p.draw=()=>{if(disposed){void p.remove();return;}p.clear();if(!initialized){initialized=true;void Promise.resolve().then(()=>Promise.resolve()).then(()=>resolveReady({ok:true}));}const current=request;if(!current)return;
    for(const descriptor of current.descriptors){if(current.time<descriptor.start||current.time>=descriptor.start+descriptor.duration)continue;const preset=presets.get(descriptor.presetId);if(!preset)continue;p.push();try{preset.draw(Object.freeze({p5:p,time:current.time-descriptor.start,phase:(current.time-descriptor.start)/descriptor.duration,seed:descriptor.seed??hash(descriptor.id),center:current.project({x:descriptor.x,y:descriptor.y}),radius:descriptor.radius,color:descriptor.color,count:descriptor.count,viewport:current.frame.viewport}));}finally{p.pop();}}
   };
  },parent);
  const timer=setTimeout(()=>{if(!initialized){resolveReady({ok:false,reason:'Animation preparation timed out.'});dispose();}},10000);void ready.then(()=>clearTimeout(timer));
  function dispose(){if(disposed)return;disposed=true;request=null;clearTimeout(timer);resolveReady({ok:false,reason:'Animation layer was disposed.'});void sketch.remove();canvas.remove();}
  return{ready,get looping(){return sketch.isLooping();},draw(frame,descriptors,time,project){if(disposed)return;if(!Number.isFinite(time)||time<0)throw Error('Animation time must be finite and nonnegative.');request={frame,descriptors:validate(descriptors),time,project};if(!initialized||busy)return;if(canvas.width!==frame.viewport.width||canvas.height!==frame.viewport.height)sketch.resizeCanvas(frame.viewport.width,frame.viewport.height,true);busy=true;void sketch.redraw().catch(error=>{resolveReady({ok:false,reason:String(error)});dispose();}).finally(()=>{busy=false;});},dispose};
 }
 register({id:'sparkles',name:'Sparkles',source:'source/renderer-animations.ts',description:'Deterministic drifting points around a scene position.'},({p5:p,phase,seed,center,radius,color,count})=>{p.noStroke();p.fill(color);for(let i=0;i<count;i++){const angle=((Math.imul(seed+i,2654435761)>>>0)/4294967296+phase*.2)*Math.PI*2,distance=radius*(.2+((i*37+seed)%101)/126);p.circle(center.x+Math.cos(angle)*distance,center.y+Math.sin(angle)*distance,2+4*(1-Math.abs((phase*2+i/count)%2-1)));}});
 register({id:'orbit',name:'Orbit',source:'source/renderer-animations.ts',description:'Evenly spaced lights orbit their scene position.'},({p5:p,phase,center,radius,color,count})=>{p.noStroke();p.fill(color);for(let i=0;i<count;i++){const angle=(phase+i/count)*Math.PI*2;p.circle(center.x+Math.cos(angle)*radius,center.y+Math.sin(angle)*radius*.5,6);}});
 register({id:'ripple',name:'Ripple',source:'source/renderer-animations.ts',description:'Expanding rings around a scene position.'},({p5:p,phase,center,radius,color,count})=>{p.noFill();p.stroke(color);p.strokeWeight(2);for(let i=0;i<count;i++){const size=((phase+i/count)%1)*radius*2;p.ellipse(center.x,center.y,size,size*.5);}});
 root.LWAnimations={version:1,list:()=>Object.freeze([...presets.values()].map(value=>value.metadata)),register,validate,create};
})(globalThis);
