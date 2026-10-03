import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchBrowser,monitorContext} from './browser-harness';
const ROOT=path.resolve(__dirname,'../..'),OUT=process.env.LITTLEWILD_TERRAFORM_EVIDENCE??path.join(ROOT,'verification','v15');
const results:{name:string;passed:boolean;error?:string}[]=[];
async function check(name:string,work:()=>Promise<void>):Promise<void>{try{await work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
async function main():Promise<void>{
 fs.mkdirSync(OUT,{recursive:true});const browser=await launchBrowser(),context=await browser.newContext({viewport:{width:1440,height:900}}),diagnostics=monitorContext(context);
 try{
  const page=await context.newPage();page.setDefaultTimeout(8000);
  await page.setContent(fs.readFileSync(process.env.LITTLEWILD_BROWSER_ARTIFACT??path.join(ROOT,'littlewild.html'),'utf8'),{waitUntil:'load',timeout:30000});
  await page.waitForFunction(()=>!!(window as unknown as {Littlewild?:unknown}).Littlewild);await page.locator('[data-act=begin]').click();
  await page.evaluate("Littlewild.open('scenarios')");await page.locator('[data-scenario=review][data-id=charted-home]').click();
  await page.evaluate("document.querySelector('[data-scenario=launch]').click();Littlewild.engine.s.paused=true;Littlewild.refresh()");
  let tile:{x:number;y:number}={x:5,y:5};
  await check('Terraform is discoverable from More and opens a keyboard-accessible map workbench',async()=>{
   await page.locator('#world-more-button').click();await page.getByRole('button',{name:'Terraform this world',exact:true}).click();
   assert(await page.locator('#terraform-panel').isVisible());assert.equal(await page.locator('#terraform-title').evaluate(el=>el===document.activeElement),true);
   assert.equal(await page.locator('[data-terraform=apply]').isDisabled(),true);assert.match(await page.locator('#terraform-panel').innerText(),/Water blocks walking/);
  });
  await check('Map keyboard selection previews elevation without mutating the story; Apply raises actual terrain',async()=>{
   tile=await page.evaluate(`(()=>{const e=Littlewild.engine;for(let y=2;y<=16;y++)for(let x=2;x<=16;x++)if(e.previewTerraform({revision:e.terraformSnapshot().revision,tiles:[{x,y,height:1}],plants:[]}).ok)return {x,y};throw Error('No safe tile');})()`);
   await page.locator('#terraform-tool').selectOption('raise');const before=await page.evaluate('JSON.stringify(Littlewild.engine.export())');
   await page.evaluate(`Littlewild.world.keyboardTile=${JSON.stringify(tile)};Littlewild.world.focus(${tile.x},${tile.y});Littlewild.world.canvas.focus()`);await page.keyboard.press('Enter');
   assert.match(await page.locator('.terraform-changes').innerText(),/height 1/);assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'),before);
   assert.equal(await page.locator('[data-terraform=apply]').isDisabled(),false);await page.locator('[data-terraform=apply]').click();
   assert.equal(await page.evaluate(`Littlewild.engine.terrainHeight(${tile.x},${tile.y})`),1);
   assert.equal(await page.evaluate(`LWGeography.heightAt(Littlewild.engine.s,${tile.x},${tile.y})`),1);assert.match(await page.locator('.terraform-feedback').innerText(),/Changes applied/);
   if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1')await page.screenshot({path:path.join(OUT,'terraform-desktop.png'),fullPage:true});
  });
  await check('Unsafe resource flooding explains rejection and disables Apply without erasing stock',async()=>{
   await page.locator('#terraform-tool').selectOption('water');const before=await page.evaluate('JSON.stringify(Littlewild.engine.export())');
   await page.evaluate('Littlewild.world.keyboardTile=Littlewild.engine.s.nodes.find(n=>n.kind===\'wood\');Littlewild.world.canvas.focus()');await page.keyboard.press('Enter');
   assert.equal(await page.locator('[data-terraform=apply]').isDisabled(),true);assert.match(await page.locator('.terraform-feedback').innerText(),/preserve terrain|resource/);
   assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'),before);await page.locator('[data-terraform=clear]').click();
  });
  await check('Water previews and applies through the same authority used by normal creature routes',async()=>{
   const point=await page.evaluate(`(()=>{const e=Littlewild.engine;for(let y=2;y<=16;y++)for(let x=2;x<=16;x++)if(e.previewTerraform({revision:e.terraformSnapshot().revision,tiles:[{x,y,ground:'water'}],plants:[]}).ok)return {x,y};throw Error('No safe tile');})()`) as {x:number;y:number};
   await page.evaluate(`Littlewild.world.keyboardTile=${JSON.stringify(point)};Littlewild.world.canvas.focus()`);await page.keyboard.press('Enter');await page.locator('[data-terraform=apply]').click();
   assert.equal(await page.evaluate(`LWGeography.grid(Littlewild.engine.s).pass(${point.x},${point.y})`),false);assert.equal(await page.evaluate(`Littlewild.engine.terrainAt(${point.x},${point.y})`),'water');
  });
  await check('Mobile workbench reflows without horizontal overflow and Escape restores map focus',async()=>{
   await page.setViewportSize({width:390,height:844});await page.locator('#terraform-tool').selectOption('plant');
   assert(await page.locator('#terraform-kind').isVisible());assert(await page.locator('#terraform-model').isVisible());
   const geometry=await page.locator('#terraform-panel').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,viewport:innerWidth,overflow:el.scrollWidth>el.clientWidth};});
   assert(geometry.left>=0&&geometry.right<=geometry.viewport);assert.equal(geometry.overflow,false);
   if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1')await page.screenshot({path:path.join(OUT,'terraform-mobile.png'),fullPage:true});
   const point=await page.evaluate(`(()=>{const e=Littlewild.engine;for(let y=2;y<=16;y++)for(let x=2;x<=16;x++)if(e.previewTerraform({revision:e.terraformSnapshot().revision,tiles:[],plants:[{x,y,kind:'wood',model:'world'}]}).ok)return {x,y};throw Error('No safe plant tile');})()`) as {x:number;y:number};
   await page.locator('[data-terraform=map]').click();assert.equal(await page.locator('#terraform-tool').isVisible(),false);
   await page.evaluate(`Littlewild.world.focus(${point.x},${point.y})`);if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1')await page.screenshot({path:path.join(OUT,'terraform-mobile-map.png'),fullPage:true});
   const screen=await page.evaluate(`Littlewild.world.toScreen(${point.x},${point.y})`) as {x:number;y:number},canvas=await page.locator('#world').boundingBox();assert(canvas);
   await page.mouse.click(canvas.x+screen.x,canvas.y+screen.y);assert(await page.locator('#terraform-tool').isVisible());assert.match(await page.locator('.terraform-changes').innerText(),/plant Branching grove/);
   await page.keyboard.press('Escape');assert.equal(await page.locator('#terraform-panel').isVisible(),false);
   assert.equal(await page.locator('#world').evaluate(el=>el===document.activeElement),true);
  });
  await check('Actual Canvas pointer picking follows positive and negative terrain heights after camera pan and zoom',async()=>{
   await page.setViewportSize({width:1440,height:900});
   await page.evaluate(`(()=>{const canvas=document.createElement('canvas');canvas.id='terraform-canvas-proof';canvas.tabIndex=0;canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:10000';document.body.appendChild(canvas);window.terraformCanvasHits=[];window.terraformCanvasView=new LWArt.World2D(canvas,Littlewild.engine,{inspect:tile=>terraformCanvasHits.push(tile),place:(_,tile)=>terraformCanvasHits.push(tile)});terraformCanvasView.terraformMode=true;})()`);
   await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
   try{
    for(const height of [1,-1]){
     const point=await page.evaluate(`(()=>{const e=Littlewild.engine;for(let y=2;y<=16;y++)for(let x=2;x<=16;x++){const edit={revision:e.terraformSnapshot().revision,tiles:[{x,y,height:${height}}],plants:[]};if(e.previewTerraform(edit).ok){const result=e.applyTerraform(edit);if(!result.ok)throw Error(result.reason);return {x,y};}}throw Error('No safe height tile');})()`) as {x:number;y:number};
     const screen=await page.evaluate(`(()=>{const w=terraformCanvasView;w.camera={z:${height===1?.6:1.4},x:53,y:-27};w.manual=true;const p=w.toScreen(${point.x},${point.y});w.camera.x+=innerWidth/2-p.x;w.camera.y+=innerHeight/2-p.y;w.placement=${height===1?'null':"'bench'"};w.draw(0,0);const screen=w.toScreen(${point.x},${point.y}),picked=w.toTile(screen.x,screen.y);if(picked.x!==${point.x}||picked.y!==${point.y})throw Error('Height inverse selected '+JSON.stringify(picked));return screen;})()`) as {x:number;y:number};
     await page.mouse.click(screen.x,screen.y);
     assert.deepEqual(await page.evaluate('terraformCanvasHits.at(-1)'),point);assert.deepEqual(await page.evaluate('({x:terraformCanvasView.hover.x,y:terraformCanvasView.hover.y})'),point);
    }
    assert.equal(await page.evaluate('Array.from(terraformCanvasView.c.getImageData(innerWidth/2,innerHeight/2,1,1).data).slice(0,3).some(channel=>channel>0)'),true);
    if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1')await page.screenshot({path:path.join(OUT,'terraform-canvas-heights.png'),fullPage:true});
   }finally{await page.evaluate('terraformCanvasView.dispose();terraformCanvasView.canvas.remove();delete window.terraformCanvasView;delete window.terraformCanvasHits');}
  });
  await check('Actual 3D geometry rebuild and draw render a newly planted tree without script or console failures',async()=>{
   const point=await page.evaluate(`(()=>{const e=Littlewild.engine;for(let y=2;y<=16;y++)for(let x=2;x<=16;x++){const edit={revision:e.terraformSnapshot().revision,tiles:[],plants:[{x,y,kind:'wood',model:'world'}]};if(e.previewTerraform(edit).ok){const result=e.applyTerraform(edit);if(!result.ok)throw Error(result.reason);return {x,y};}}throw Error('No safe tree tile');})()`) as {x:number;y:number};
   try{
    await page.evaluate(`(()=>{const canvas=document.createElement('canvas');canvas.id='terraform-three-proof';canvas.tabIndex=0;canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:10000';document.body.appendChild(canvas);window.terraformThreeView=new LWArt.World(canvas,Littlewild.engine);if(!terraformThreeView.scene||!terraformThreeView.renderer)throw Error('Actual 3D renderer unavailable');terraformThreeView.focus(${point.x},${point.y});terraformThreeView.rebuild();terraformThreeView.draw(0,0);})()`);
    if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1')await page.screenshot({path:path.join(OUT,'terraform-three-plant.png'),fullPage:true});assert.deepEqual(diagnostics.errors,[]);assert.deepEqual(diagnostics.consoleProblems,[]);
   }finally{await page.evaluate("window.terraformThreeView?.dispose();document.querySelector('#terraform-three-proof')?.remove();delete window.terraformThreeView");}
  });
  await check('Indoor Office terrain uses the same editable ground and elevation while preserving its authored stage',async()=>{
   await page.setViewportSize({width:1440,height:900});await page.evaluate("Littlewild.open('scenarios')");
   await page.locator('[data-scenario=select]').filter({hasText:/office/i}).click();await page.locator('[data-scenario=review]').first().click();
   await page.evaluate("document.querySelector('[data-scenario=launch]').click();Littlewild.engine.s.paused=true;Littlewild.refresh();Littlewild.terraform.open()");
   const point=await page.evaluate(`(()=>{const e=Littlewild.engine;for(let y=3;y<=15;y++)for(let x=3;x<=15;x++)if(e.previewTerraform({revision:0,tiles:[{x,y,height:1,ground:'water'}],plants:[]}).ok)return {x,y};throw Error('No safe office tile');})()`) as {x:number;y:number};
   await page.locator('#terraform-tool').selectOption('raise');await page.evaluate(`Littlewild.world.keyboardTile=${JSON.stringify(point)};Littlewild.world.canvas.focus()`);await page.keyboard.press('Enter');
   await page.locator('#terraform-tool').selectOption('water');await page.evaluate('Littlewild.world.canvas.focus()');await page.keyboard.press('Enter');await page.locator('[data-terraform=apply]').click();
   assert.equal(await page.evaluate(`Littlewild.engine.terrainHeight(${point.x},${point.y})`),1);assert.equal(await page.evaluate(`Littlewild.engine.terrainAt(${point.x},${point.y})`),'water');
   if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1')await page.screenshot({path:path.join(OUT,'terraform-office.png'),fullPage:true});
  });
  await check('Terraform browser runs offline without script or console failures',async()=>{assert.deepEqual(diagnostics.errors,[]);assert.deepEqual(diagnostics.consoleProblems,[]);assert.deepEqual(diagnostics.requests,[]);});
 }finally{await context.close();await browser.close();}
 const report={suite:'terraform-browser',passed:results.filter(r=>r.passed).length,total:results.length,results,diagnostics};fs.writeFileSync(path.join(OUT,'terraform-browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(`${report.passed}/${report.total} Terraform browser checks passed`);if(report.passed!==report.total)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
