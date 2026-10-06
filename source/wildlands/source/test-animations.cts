/// <reference path="./animation-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void){try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
for(const name of ['developer-data','animation-catalog','renderer-animations'])require('./'+name+'.js');
const root=globalThis as unknown as {LWAnimations:LWAnimations.Api;LWAnimationCatalog:typeof LWAnimationCatalog};
const animations=root.LWAnimations,descriptor:LWAnimations.Descriptor={id:'demo',presetId:'orbit',start:0,duration:4,x:9,y:9,radius:40,color:'#77aaff',count:8,seed:5};
test('Pure preset discovery and lazy Node registration initialize no browser library',()=>{
 assert.deepEqual(animations.list().map(row=>row.id),['sparkles','orbit','ripple']);assert(Object.isFrozen(animations.list()));assert(Object.isFrozen(root.LWAnimationCatalog.list()[0]!.parameters));
 assert.deepEqual(animations.validate([descriptor]),[descriptor]);assert(Object.isFrozen(animations.validate([descriptor])[0]));assert.equal('p5' in globalThis,false);
});
test('Animation descriptors are detached and reject executable properties and unsafe bounds',()=>{
 const copied=animations.validate([descriptor]);assert.notEqual(copied[0],descriptor);
 for(const patch of [{count:129},{count:1.5},{radius:0},{x:Infinity},{color:'red'},{seed:-1},{presetId:'missing'},{callback:()=>{}}])assert.throws(()=>animations.validate([{...descriptor,...patch}]));
 let invoked=false;const hostile={...descriptor};Object.defineProperty(hostile,'radius',{enumerable:true,get(){invoked=true;return 40;}});assert.throws(()=>animations.validate([hostile]));assert.equal(invoked,false);
});
test('Compiled custom presets publish data-only provenance and withdraw cleanly',()=>{
 let draws=0;const unregister=animations.register({id:'custom-pulse',name:'Custom pulse',description:'Compiled developer module.',source:'extensions/custom-pulse.ts'},()=>{draws++;});
 assert.equal(root.LWAnimationCatalog.list().find(row=>row.id==='custom-pulse')!.source,'extensions/custom-pulse.ts');assert.equal(animations.validate([{...descriptor,presetId:'custom-pulse'}])[0]!.presetId,'custom-pulse');assert.equal(draws,0);
 assert.throws(()=>animations.register({id:'custom-pulse',name:'Duplicate',description:''},()=>{}));unregister();assert.equal(root.LWAnimationCatalog.list().some(row=>row.id==='custom-pulse'),false);assert.throws(()=>animations.validate([{...descriptor,presetId:'custom-pulse'}]));
});
async function layerCheck(name:string,work:(layer:LWAnimations.Layer,frame:LittlewildRenderer.Frame,canvas:{width:number;height:number},metrics:{clears:number;callbacks:number;resizes:number;removals:number;ink:boolean},settle:()=>Promise<void>)=>Promise<void>):Promise<void>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'p5'),metrics={clears:0,callbacks:0,resizes:0,removals:0,ink:false};
 const pending:(()=>void)[]=[],canvas={width:800,height:320,parentElement:{},remove(){}};let layer:LWAnimations.Layer|null=null,unregister=()=>{};
 class Sketch {
  setup=()=>{};draw=()=>{};
  constructor(configure:(sketch:Sketch)=>void){configure(this);this.setup();this.draw();}
  noLoop(){}isLooping(){return false;}pixelDensity(){}push(){}pop(){}
  createCanvas(width:number,height:number){canvas.width=width;canvas.height=height;}
  resizeCanvas(width:number,height:number){metrics.resizes++;canvas.width=width;canvas.height=height;metrics.ink=false;}
  clear(){metrics.clears++;metrics.ink=false;}
  redraw():Promise<void>{this.draw();return new Promise(resolve=>pending.push(resolve));}
  async remove(){metrics.removals++;}
 }
 const settle=async()=>{for(const resolve of pending.splice(0))resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();};
 try{
  Object.assign(globalThis,{p5:Sketch});unregister=animations.register({id:'layer-pulse',name:'Layer pulse',description:'Controlled compiled callback.'},()=>{metrics.callbacks++;metrics.ink=true;});
  layer=animations.create(canvas as unknown as HTMLCanvasElement);assert.equal((await layer.ready).ok,true);
  const frame={viewport:{width:800,height:320,pixelRatio:1}} as unknown as LittlewildRenderer.Frame;
  await work(layer,frame,canvas,metrics,settle);results.push({name,passed:true});
 }catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}
 finally{layer?.dispose();unregister();if(original)Object.defineProperty(globalThis,'p5',original);else Reflect.deleteProperty(globalThis,'p5');}
}
async function finish():Promise<void>{
 const preset={...descriptor,presetId:'layer-pulse'},project=(point:LittlewildRenderer.Point)=>point;
 await layerCheck('Empty overlays retain clear pixels while validating requests, resize and every nonempty compiled callback',async(layer,frame,canvas,metrics,settle)=>{
  assert.equal(metrics.clears,1);for(let i=0;i<10;i++)layer.draw(frame,[],i,project);assert.equal(metrics.clears,1);
  assert.throws(()=>layer.draw(frame,[],NaN,project),/finite/);assert.throws(()=>layer.draw(frame,[{...preset,count:129}],0,project));assert.equal(metrics.clears,1);
  const larger={...frame,viewport:{...frame.viewport,width:900}};layer.draw(larger,[],0,project);await settle();assert.equal(canvas.width,900);assert.equal(metrics.resizes,1);assert.equal(metrics.clears,2);
  layer.draw(larger,[preset],1,project);await settle();layer.draw(larger,[preset],1,project);await settle();assert.equal(metrics.callbacks,2,'Nonempty callbacks retain unchanged sampled phases');assert(metrics.ink);
  layer.draw(larger,[],1,project);await settle();assert.equal(metrics.ink,false);const cleared=metrics.clears;layer.draw(larger,[],2,project);assert.equal(metrics.clears,cleared);
 });
 await layerCheck('Pending paints consume newer empty and resized requests and disposal prevents deferred repaint',async(layer,frame,canvas,metrics,settle)=>{
  layer.draw(frame,[preset],1,project);assert(metrics.ink);
  const larger={...frame,viewport:{width:900,height:400,pixelRatio:1}};layer.draw(larger,[],2,project);assert(metrics.ink,'An outstanding paint has not completed yet');
  await settle();await settle();assert.equal(metrics.ink,false,'Latest empty request clears without another host draw');assert.equal(canvas.width,900);assert.equal(canvas.height,400);
  layer.draw(larger,[preset],1,project);layer.draw(larger,[],2,project);layer.dispose();const calls=metrics.callbacks,clears=metrics.clears;await settle();await settle();assert.equal(metrics.callbacks,calls);assert.equal(metrics.clears,clears);assert.equal(metrics.removals,1);
 });
 const hookCase='Owned p5 focus hooks release by identity across concurrent, reentrant, rejected and failed construction lifecycles';
 const original=Object.getOwnPropertyDescriptor(globalThis,'p5'),savedError=console.error,sketches:Sketch[]=[],layers:LWAnimations.Layer[]=[];
 let foreignCalls=0,removedFocus=0,reported=0,reentrant:()=>void=()=>{},constructorFailure=false;
 const foreign=function(){foreignCalls++;};
 class Sketch {
  static lifecycleHooks:{remove:((this:Sketch)=>void)[]}={remove:[foreign]};
  setup=()=>{};draw=()=>{};focusActive=true;removals=0;reject=false;
  constructor(configure:(sketch:Sketch)=>void){sketches.push(this);configure(this);const self=this;Sketch.lifecycleHooks.remove.push(function(){self.focusActive=false;removedFocus++;});void this._runLifecycleHook('presetup');if(constructorFailure)throw Error('Constructor failed after registering focus');this.setup();this.draw();}
  async _runLifecycleHook(name:string){if(name==='presetup'){reentrant();return;}for(const hook of Sketch.lifecycleHooks.remove)hook.call(this);}
  noLoop(){}isLooping(){return false;}pixelDensity(){}push(){}pop(){}createCanvas(){}resizeCanvas(){}clear(){}async redraw(){this.draw();}
  async remove(){this.removals++;await this._runLifecycleHook('remove');if(this.reject)throw Error('Removal rejected');}
 }
 const create=()=>{const layer=animations.create({width:200,height:120,parentElement:{},remove(){}} as unknown as HTMLCanvasElement);layers.push(layer);return layer;};
 const retire=(layer:LWAnimations.Layer)=>{const finalize=layer.retire!()!;layers.splice(layers.indexOf(layer),1);return finalize;};
 try{
  Object.assign(globalThis,{p5:Sketch});console.error=()=>{reported++;};
  const first=create(),second=create();assert((await first.ready).ok&&(await second.ready).ok);assert.equal(Sketch.lifecycleHooks.remove.length,3);
  const releaseFirst=retire(first);const completion=releaseFirst();assert.equal(releaseFirst(),completion);await completion;
  assert.equal(sketches[0]!.focusActive,false);assert.equal(sketches[1]!.focusActive,true,'A removal must not invoke the other owned sketch focus cleanup');assert.equal(sketches[0]!.removals,1);assert.deepEqual(Sketch.lifecycleHooks.remove,[foreign,Sketch.lifecycleHooks.remove[1]]);
  await retire(second)();assert.deepEqual(Sketch.lifecycleHooks.remove,[foreign]);assert.equal(removedFocus,2);assert.equal(foreignCalls,2);
  const added=function(){};let nested:LWAnimations.Layer|null=null;reentrant=()=>{reentrant=()=>{};nested=create();Sketch.lifecycleHooks.remove.unshift(added);};const reordered=create();await reordered.ready;await retire(reordered)();assert.equal(sketches.at(-1)!.focusActive,true,'A reentrant live sketch keeps its focus listeners');await retire(nested as unknown as LWAnimations.Layer)();assert.deepEqual(Sketch.lifecycleHooks.remove,[added,foreign],'Presetup mutation must preserve foreign identities');Sketch.lifecycleHooks.remove.shift();
  const throwing=function(){throw Error('Foreign hook failed before owned cleanup');};Sketch.lifecycleHooks.remove.unshift(throwing);const rejected=create();await rejected.ready;
  await assert.rejects(retire(rejected)(),/resource release/);assert.equal(sketches.at(-1)!.focusActive,false);assert.equal(sketches.at(-1)!.removals,1);assert.deepEqual(Sketch.lifecycleHooks.remove,[throwing,foreign]);Sketch.lifecycleHooks.remove.shift();
  const failed=create();await failed.ready;sketches.at(-1)!.reject=true;await assert.rejects(retire(failed)(),/resource release/);assert.deepEqual(Sketch.lifecycleHooks.remove,[foreign]);
  constructorFailure=true;assert.throws(create,/construction failed/);for(let i=0;i<8;i++)await Promise.resolve();assert.equal(sketches.at(-1)!.focusActive,false);assert.equal(sketches.at(-1)!.removals,1);assert.deepEqual(Sketch.lifecycleHooks.remove,[foreign]);assert.equal(reported,0);
  results.push({name:hookCase,passed:true});
 }catch(error){results.push({name:hookCase,passed:false,error:String(error)});savedError(hookCase,error);}
 finally{for(const layer of layers)layer.dispose();console.error=savedError;if(original)Object.defineProperty(globalThis,'p5',original);else Reflect.deleteProperty(globalThis,'p5');}
 fs.mkdirSync('verification/v15',{recursive:true});fs.writeFileSync('verification/v15/animations-results.json',JSON.stringify({passed:results.filter(row=>row.passed).length,total:results.length,results},null,2)+'\n');
 console.log(results.filter(row=>row.passed).length+'/'+results.length+' animation registry checks passed');if(results.some(row=>!row.passed))process.exitCode=1;
}
finish().catch(error=>{console.error(error);process.exitCode=1;});
