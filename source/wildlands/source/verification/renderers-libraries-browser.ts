/// <reference path="../renderer-contracts.d.ts" />
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {launchBrowser,monitorContext,READY_TIMEOUT_MS,waitForReady} from './browser-harness';
interface Result {name:string;passed:boolean;error?:string;}
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'verification','v15'),SHOTS=process.env.LITTLEWILD_SCREENSHOT_DIR||'/tmp/littlewild-renderer-libraries',results:Result[]=[];
fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(SHOTS,{recursive:true});
async function check(name:string,work:()=>Promise<void>):Promise<void>{try{await work();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
/** Installed in the page so capture starts in the same task as the actual draw. */
function installLibraryPixelReader():void{
 (window as unknown as {readLibraryPixels:(canvas:HTMLCanvasElement,palette:number[][])=>Promise<{colors:number;geometry:number}>}).readLibraryPixels=async(canvas,palette)=>{
  const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
  if(!gl)throw Error('Actual library GPU context is unavailable.');
  const width=canvas.width,height=canvas.height;
  let values:Uint8Array|Uint8ClampedArray;
  if(gl instanceof WebGL2RenderingContext){
   values=new Uint8Array(width*height*4);
   const buffer=gl.createBuffer();
   if(!buffer)throw Error('Unable to allocate GPU pixel readback buffer.');
   let fence:WebGLSync|null=null;
   try{
    const binding=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING) as WebGLBuffer|null;
    const pack=[gl.PACK_ALIGNMENT,gl.PACK_ROW_LENGTH,gl.PACK_SKIP_PIXELS,gl.PACK_SKIP_ROWS].map(parameter=>({parameter,value:gl.getParameter(parameter) as number}));
    try{
     gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buffer);
     gl.bufferData(gl.PIXEL_PACK_BUFFER,values.byteLength,gl.STREAM_READ);
     gl.pixelStorei(gl.PACK_ALIGNMENT,1);
     for(const parameter of [gl.PACK_ROW_LENGTH,gl.PACK_SKIP_PIXELS,gl.PACK_SKIP_ROWS])gl.pixelStorei(parameter,0);
     // A numeric offset queues GPU-to-GPU readback rather than blocking on a CPU array.
     gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,0);
     fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
     if(!fence)throw Error('Unable to fence GPU pixel readback.');
     gl.flush();
    }finally{
     gl.bindBuffer(gl.PIXEL_PACK_BUFFER,binding);
     for(const state of pack)gl.pixelStorei(state.parameter,state.value);
    }
    // Restore renderer state before yielding: its normal RAF may draw during the wait.
    const deadline=performance.now()+10000;
    for(;;){
     if(gl.isContextLost())throw Error('GPU context was lost during pixel readback.');
     const status=gl.clientWaitSync(fence,0,0);
     if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)break;
     if(status===gl.WAIT_FAILED)throw Error('GPU pixel readback fence failed.');
     if(performance.now()>=deadline)throw Error('GPU pixel readback fence timed out.');
     await new Promise<void>(resolve=>setTimeout(resolve,0));
    }
    const bindingAfterWait=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING) as WebGLBuffer|null;
    try{
     gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buffer);
     gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,values);
    }finally{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,bindingAfterWait);}
   }finally{
    if(fence)gl.deleteSync(fence);
    gl.deleteBuffer(buffer);
   }
  }else{
   // WebGL1 has no pixel-pack buffers. Browser canvas snapshotting still proves
   // actual geometry, without issuing a synchronous GL readPixels into CPU memory.
   const bitmap=await createImageBitmap(canvas);
   try{
    const snapshot=new OffscreenCanvas(width,height),context=snapshot.getContext('2d',{willReadFrequently:true});
    if(!context)throw Error('Unable to sample the actual GPU canvas snapshot.');
    context.drawImage(bitmap,0,0);
    values=context.getImageData(0,0,width,height).data;
   }finally{bitmap.close();}
  }
  const colors=new Set<string>();let geometry=0;
  for(let index=0;index<values.length;index+=16){
   if(values[index+3]===0)continue;
   const rgb=[values[index]!,values[index+1]!,values[index+2]!];
   colors.add(rgb.join(','));
   if(palette.some(color=>rgb.every((channel,axis)=>Math.abs(channel-color[axis]!)<=2)))geometry++;
  }
  return{colors:colors.size,geometry};
 };
}
async function main():Promise<void>{
 const browser=await launchBrowser(),context=await browser.newContext({viewport:{width:1440,height:900}}),diagnostics=monitorContext(context);
 try{
  const p=await context.newPage();p.setDefaultTimeout(10000);await p.setContent(fs.readFileSync(process.env.LITTLEWILD_BROWSER_ARTIFACT??path.join(ROOT,'.generated/artifacts/showcase.html'),'utf8'),{waitUntil:'load',timeout:30000});await waitForReady(p,{timeout:READY_TIMEOUT_MS});await p.locator('[data-act=begin]').click();await p.evaluate('Littlewild.engine.s.paused=true');await p.keyboard.press('Escape');
  await p.evaluate(installLibraryPixelReader);

  await check('Pinned library metadata is discoverable and synchronous Pixi selection retains the active renderer',async()=>{
   const value=await p.evaluate(`(()=>{const w=Littlewild.world,before=JSON.stringify(Littlewild.engine.export()),id=w.rendererId,result=w.selectRenderer('pixi-2d');return {version:PIXI.VERSION,ids:LWRenderers.list().map(m=>m.id),rejected:!result.ok,reason:result.reason,id:w.rendererId,unchanged:before===JSON.stringify(Littlewild.engine.export()),original:id};})()`) as {version:string;ids:string[];rejected:boolean;reason:string;id:string;unchanged:boolean;original:string};assert.equal(value.version,'8.22.0');assert(value.ids.includes('pixi-2d')&&value.ids.includes('excalibur-2d'));assert(value.rejected);assert.match(value.reason,/selectRendererAsync/);assert.equal(value.id,value.original);assert(value.unchanged);
  });
  for(const id of ['pixi-2d','excalibur-2d']){
   await check('Actual '+id+' draws canonical scenes and switches without simulation mutation',async()=>{
    const value=await p.evaluate(`(async()=>{const before=JSON.stringify(Littlewild.engine.export()),result=await Littlewild.world.selectRendererAsync('${id}');Littlewild.world.draw(0,.02);return{result,id:Littlewild.world.rendererId,unchanged:before===JSON.stringify(Littlewild.engine.export()),canvases:document.querySelectorAll('canvas#world').length,pixels:await readLibraryPixels(Littlewild.world.canvas,[[182,200,160],[190,208,169]])};})()` ) as {result:{ok:boolean};id:string;unchanged:boolean;canvases:number;pixels:{colors:number;geometry:number}};assert.deepEqual({...value,pixels:undefined},{result:{ok:true},id,unchanged:true,canvases:1,pixels:undefined});assert(value.pixels.colors>12);assert(value.pixels.geometry>100);if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1')await p.screenshot({path:path.join(SHOTS,id+'-1440.png'),animations:'disabled'});
   });
   await check(id+' actual pointer picking follows validated raised/lowered ground under pan and zoom',async()=>{
    await p.evaluate(`window.libraryPointerHits=[];window.libraryPriorInspect=Littlewild.world.handlers.inspect;Littlewild.world.handlers.inspect=hit=>libraryPointerHits.push(hit);Littlewild.world.terraformMode=true;`);
    try{for(const height of [2,-1]){
     const tile=await p.evaluate(`(()=>{const e=Littlewild.engine;for(let y=2;y<17;y++)for(let x=2;x<17;x++){const edit={revision:e.terraformSnapshot().revision,tiles:[{x,y,height:${height}}],plants:[]};if(e.previewTerraform(edit).ok){const result=e.applyTerraform(edit);if(!result.ok)throw Error(result.reason);return{x,y};}}throw Error('No admitted elevation tile');})()` ) as {x:number;y:number};
     const screen=await p.evaluate(`(()=>{const w=Littlewild.world;Object.assign(w.camera,{x:73,y:-29,z:${height===2?.8:1.4}});w.focus(${tile.x},${tile.y});const before=JSON.stringify(Littlewild.engine.export());w.draw(0,.02);const point=w.toScreen(${tile.x},${tile.y}),picked=w.toTile(point.x,point.y);if(picked.x!==${tile.x}||picked.y!==${tile.y})throw Error('Wrong height inverse');if(before!==JSON.stringify(Littlewild.engine.export()))throw Error('Observation changed simulation');return point;})()` ) as {x:number;y:number};
     await p.locator('#world').click({position:screen});assert.deepEqual(await p.evaluate('libraryPointerHits.at(-1)'),tile);assert.deepEqual(await p.evaluate('({x:Littlewild.world.hover.x,y:Littlewild.world.hover.y})'),tile);
    }}finally{await p.evaluate('Littlewild.world.handlers.inspect=libraryPriorInspect;Littlewild.world.terraformMode=false;delete window.libraryPriorInspect;delete window.libraryPointerHits');}
   });
  }
  await check('Scene dimensions select retained Canvas and Three without adding clocks',async()=>{
   const value=await p.evaluate(`(async()=>{const before=JSON.stringify(Littlewild.engine.export()),two=await Littlewild.world.selectSceneRendering({dimension:'2d',rendererId:'basic'});Littlewild.world.draw(0,.02);const canvas=!!Littlewild.world.canvas.getContext('2d'),three=await Littlewild.world.selectSceneRendering({dimension:'3d',rendererId:'basic'}),invalid=await Littlewild.world.selectSceneRendering({dimension:'3d',rendererId:'pixi-2d'});return{two,canvas,three,invalid:!invalid.ok,id:Littlewild.world.rendererId,unchanged:before===JSON.stringify(Littlewild.engine.export())};})()`);assert.deepEqual(value,{two:{ok:true},canvas:true,three:{ok:true},invalid:true,id:'basic',unchanged:true});
  });
  await check('Superseded asynchronous factories clean up, cannot activate late and lose command authority',async()=>{
   const value=await p.evaluate(`(async()=>{await Littlewild.world.selectSceneRendering({dimension:'3d',rendererId:'basic'});let release,disposed=0,cleanup=0,late;LWRenderers.registerAsync({id:'async-probe',name:'Async probe',description:'Cancellation proof',capabilities:[]},context=>{late=context;context.onDispose(()=>cleanup++);return new Promise(resolve=>release=()=>resolve({mount(){},resize(){},draw(){},dispose(){disposed++;}}));});const pending=Littlewild.world.selectRendererAsync('async-probe');Littlewild.world.selectRenderer('basic');release();const result=await pending;await Promise.resolve();return{cancelled:!result.ok,id:Littlewild.world.rendererId,disposed,cleanup,code:late.commands.submit({id:'select-creature',args:['c1']}).code,canvases:document.querySelectorAll('.world-canvas').length};})()`);assert.deepEqual(value,{cancelled:true,id:'basic',disposed:1,cleanup:1,code:'unavailable-command',canvases:1});
  });
  await check('Actual authored 3D scene composes live Pixi minimap and dormant Excalibur interior panel',async()=>{
   const value=await p.evaluate(`(async()=>{const pack=LWScenarios.builtins().find(p=>p.id==='littlewild');pack.resources=LWScenarioResources.snapshot();const first=pack.scenes.find(s=>s.id==='first-morning'),home=pack.scenes.find(s=>s.id==='charted-home');first.graph={kind:'level',rendering:{dimension:'3d',rendererId:'basic',embeds:[{id:'live-map',sceneId:'meadow-map',role:'minimap',bounds:{anchor:'bottom-right',width:260,height:200}},{id:'workshop-panel',sceneId:'workshop-room',role:'panel',bounds:{anchor:'top-right',width:280,height:220}}]}};home.graph={kind:'level',rendering:{dimension:'2d',rendererId:'excalibur-2d'}};pack.scenes.push({id:'meadow-map',name:'Live meadow',description:'Active native owner map',worldId:first.worldId,initialState:{},graph:{kind:'island',parentId:first.id,binding:{type:'island',sourceSceneId:first.id,ix:0,iy:0},bounds:{x:0,y:0,width:19,height:19},rendering:{dimension:'2d',rendererId:'pixi-2d'}}},{id:'workshop-room',name:'Dormant upper workshop',description:'Checkpoint room observer',worldId:home.worldId,initialState:{},graph:{kind:'interior',parentId:home.id,binding:{type:'interior',sourceSceneId:home.id,buildingId:'b2',floorId:'upper'},rendering:{dimension:'2d',rendererId:'excalibur-2d'}}});const checked=LWScenarios.validate(pack);if(!checked.ok)throw Error(checked.errors.join('\\n'));window.rendererLibraryPack=checked.pack;const engine=LWScenarios.commitScene(LWScenarios.prepareScene(checked.pack,first.id));Littlewild.setEngine(engine);engine.s.paused=true;const before=JSON.stringify(engine.export()),result=await Littlewild.world.selectSceneRendering(first.graph.rendering);Littlewild.world.draw(0,.02);return{result,id:Littlewild.world.rendererId,unchanged:before===JSON.stringify(engine.export()),embeds:document.querySelectorAll('[data-scene-embed]').length,room:LWSceneRendering.source(engine,'workshop-room').frame({time:0,delta:0,running:false,alpha:1,camera:{x:0,y:0,z:1},viewport:{width:280,height:220,pixelRatio:1},presentation:{}}).interiorView.floorId};})()`);assert.deepEqual(value,{result:{ok:true},id:'basic',unchanged:true,embeds:2,room:'upper'});const pixels=await p.evaluate(`(async()=>{Littlewild.world.draw(0,.02);return await Promise.all([...document.querySelectorAll('[data-scene-embed] canvas')].map(canvas=>readLibraryPixels(canvas,canvas.dataset.renderer==='excalibur-2d'?[[221,209,173],[230,217,182]]:[[182,200,160],[190,208,169]])));})()` ) as {colors:number;geometry:number}[];for(const view of pixels){assert(view.colors>12);assert(view.geometry>40);}if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1')await p.screenshot({path:path.join(SHOTS,'three-with-pixi-minimap-excalibur-panel-1440.png'),animations:'disabled'});
  });
  await check('Failed main or embedded preparation keeps the previous scene, dimensions and scoped canvases',async()=>{
   const value=await p.evaluate(`(async()=>{const w=Littlewild.world,canvases=[...document.querySelectorAll('[data-scene-embed] canvas')],before=JSON.stringify(Littlewild.engine.export());LWRenderers.registerAsync({id:'async-failed',name:'Failed async',description:'Failure rollback proof',dimensions:['2d'],capabilities:[]},async()=>{throw Error('Expected async failure');});const failed=await w.selectRendererAsync('async-failed'),embedded=await w.selectSceneRendering({dimension:'2d',rendererId:'pixi-2d',embeds:[{id:'missing-view',sceneId:'missing',role:'panel'}]});const same=canvases.every(canvas=>canvas.isConnected)&&document.querySelectorAll('[data-scene-embed]').length===2;const restore=w.selectRenderer('basic');return{failed:!failed.ok,embedded:!embedded.ok,same,id:w.rendererId,dimension:w.rendererDimension,restore,unchanged:before===JSON.stringify(Littlewild.engine.export()),worldCanvases:document.querySelectorAll('.world-canvas').length};})()`);assert.deepEqual(value,{failed:true,embedded:true,same:true,id:'basic',dimension:'3d',restore:{ok:true},unchanged:true,worldCanvases:1});
  });
  await check('Live minimap tracks actual native movement while observation preserves state and dormant checkpoints',async()=>{
   const canvas=p.locator('[data-scene-embed=live-map] canvas'),before=await canvas.screenshot();
   const value=await p.evaluate(`(()=>{const e=Littlewild.engine,source=LWSceneRendering.source(e,'meadow-map'),options={time:0,delta:0,running:false,alpha:1,camera:{x:0,y:0,z:1},viewport:{width:260,height:200,pixelRatio:1},presentation:{}},initial=source.frame(options).actors,checkpoint=JSON.stringify(e.scenarioContext.journey.checkpoints);e.s.paused=false;for(let i=0;i<80;i++){e.step(.1);if(e.creatures.some((actor,index)=>actor.creature.x!==initial[index].x||actor.creature.y!==initial[index].y))break;}e.s.paused=true;const saved=JSON.stringify(e.export());Littlewild.world.draw(100,.02);return{moved:source.frame(options).actors.some((actor,index)=>actor.x!==initial[index].x||actor.y!==initial[index].y),unchanged:saved===JSON.stringify(e.export()),dormant:checkpoint===JSON.stringify(e.scenarioContext.journey.checkpoints)};})()`);assert.deepEqual(value,{moved:true,unchanged:true,dormant:true});const after=await canvas.screenshot();assert.notDeepEqual(before,after);
  });
  await check('Composed views resize at 390px and dispose on scene replacement',async()=>{
   await p.setViewportSize({width:390,height:844});await p.waitForTimeout(200);assert.equal(await p.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);assert.equal(await p.evaluate(`(()=>{const roster=document.querySelector('#creature-roster').getBoundingClientRect(),tools=document.querySelector('.world-tools').getBoundingClientRect();return [...document.querySelectorAll('[data-scene-embed]')].every(panel=>{const r=panel.getBoundingClientRect();return r.top>=roster.bottom&&r.bottom<=tools.top;});})()`),true);if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1')await p.screenshot({path:path.join(SHOTS,'three-with-pixi-minimap-excalibur-panel-390.png'),animations:'disabled'});const value=await p.evaluate(`(async()=>{const result=await Littlewild.world.selectSceneRendering({dimension:'2d',rendererId:'pixi-2d'});Littlewild.world.draw(0,.02);return{result,embeds:document.querySelectorAll('[data-scene-embed]').length,id:Littlewild.world.rendererId};})()`);assert.deepEqual(value,{result:{ok:true},embeds:0,id:'pixi-2d'});
  });
  await p.setViewportSize({width:1440,height:900});
  await p.evaluate(`(async()=>{const pack=window.rendererLibraryPack,engine=LWScenarios.commitScene(LWScenarios.prepareScene(pack,'charted-home'));Littlewild.setEngine(engine);engine.s.paused=true;await Littlewild.world.selectSceneRendering({dimension:'2d',rendererId:'excalibur-2d'});Littlewild.land.show('building','b2');})()`);await p.locator('[data-act=land-visit]').click({force:true});await p.locator('[data-interior=floor][data-floor=upper]').click();await p.locator('#interior-production [name=recipe]').selectOption('planks');await p.locator('#interior-production [name=batches]').fill('2');await p.locator('#interior-production button[type=submit]').click();
  await p.evaluate(`(()=>{const e=Littlewild.engine;e.s.paused=false;for(let i=0;i<1200;i++){e.step(.1);if(e.buildingInterior('b2').actors.some(actor=>actor.floorId==='upper'&&actor.progress>0))break;}e.s.paused=true;Littlewild.refresh();window.libraryPainterOriginal=LWRendererScene2D;window.LWRendererScene2D={...libraryPainterOriginal,draw(frame,context,painter){if(frame.room)window.libraryRoomFrame={floor:frame.interiorView.floorId,workers:frame.room.actors.filter(actor=>actor.floorId===frame.interiorView.floorId).map(actor=>({id:actor.id,x:actor.x,y:actor.y,progress:actor.progress})),frozen:Object.isFrozen(frame.room),canonical:frame.room.actors.every(actor=>!!context.query.asset('actor',actor.visualAsset))};libraryPainterOriginal.draw(frame,context,painter);}};})()`);
  for(const id of ['pixi-2d','excalibur-2d'])await check(id+' keeps the visited floor, real paid work, canonical workers and room-local picking across switches',async()=>{
   const value=await p.evaluate(`(async()=>{const e=Littlewild.engine,before=JSON.stringify(e.export()),result=await Littlewild.world.selectSceneRendering({dimension:'2d',rendererId:'${id}'});Littlewild.refresh();Littlewild.world.draw(100,.02);const observed=libraryRoomFrame,worker=observed.workers.find(actor=>actor.progress>0);if(!worker)throw Error('No native upper-floor work');const point=Littlewild.world.toScreen(worker.x,worker.y),hit=Littlewild.world.hitTest(point.x,point.y);return{result,floor:observed.floor,canonical:observed.canonical,frozen:observed.frozen,picked:hit.actorId===worker.id,unchanged:before===JSON.stringify(e.export()),custom:document.querySelector('#building-interior').classList.contains('custom-interior-renderer')};})()`);assert.deepEqual(value,{result:{ok:true},floor:'upper',canonical:true,frozen:true,picked:true,unchanged:true,custom:true});if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1')await p.screenshot({path:path.join(SHOTS,id+'-upper-paid-work-1440.png'),animations:'disabled'});await p.locator('[data-interior=floor][data-floor=ground]').click();await p.evaluate('Littlewild.world.draw(100,.02)');assert.equal(await p.evaluate('libraryRoomFrame.floor'),'ground');await p.locator('[data-interior=floor][data-floor=upper]').click();
  });
  await p.evaluate('window.LWRendererScene2D=libraryPainterOriginal;delete window.libraryPainterOriginal');
  await check('Library rendering respects offline CSP without browser errors or warnings',async()=>{assert.deepEqual(diagnostics.errors,[]);assert.deepEqual(diagnostics.consoleProblems,[]);assert.deepEqual(diagnostics.requests,[]);});
 }finally{await browser.close();}
 const report={passed:results.filter(result=>result.passed).length,total:results.length,results,...diagnostics};fs.writeFileSync(path.join(OUT,'renderers-libraries-browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(report.passed+'/'+report.total+' library renderer checks passed');if(report.passed!==report.total)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
