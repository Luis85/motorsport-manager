'use strict';
// Bounded observational workload. It does not replace requestAnimationFrame, advance
// a private clock, alter game definitions, force garbage collection, or mutate state.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..'),OUT=__dirname;
const {chromium}=require(path.join(ROOT,'source/wildlands/node_modules/playwright'));
const harness=require(path.join(ROOT,'source/wildlands/.generated/verification/browser-harness.js'));
const DURATION_MS=30*60*1000,SAMPLE_MS=15000,TRANSITION_MS=120000;
const VIEWPORT={width:960,height:600},URL='https://armored-stability.localhost/published-demo.html';
const EXPECTED_HEAD='187dd821316cb334f13947780bb5e135878bda2c';
const artifactPath=path.join(ROOT,'demos/armored-platoon.html');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();
const append=(file,value)=>fs.appendFileSync(path.join(OUT,file),JSON.stringify(value)+'\n');
const persist=(file,value)=>fs.writeFileSync(path.join(OUT,file),JSON.stringify(value,null,2)+'\n');
const results={startedAt:now(),method:'30 wall minutes; original published HTML bytes; native requestAnimationFrame; Playwright UI actions and public command/query/checkpoint/restore ports; no injected gameplay state or private ticks',samples:[],transitions:[],commands:[],errors:[],consoleProblems:[],requests:[],failures:[],screenshots:[],cleanup:[]};
let browser,context,page,cdp,observationStart,aborted=false;
function fail(message){const item={time:now(),message};results.failures.push(item);append('failures.jsonl',item);console.error('OBSERVATION FAILURE '+message);}
process.on('SIGTERM',()=>{aborted=true;fail('SIGTERM interrupted the bounded observation');});
process.on('SIGINT',()=>{aborted=true;fail('SIGINT interrupted the bounded observation');});
async function metrics(){
 const measured=await cdp.send('Performance.getMetrics');
 const m=Object.fromEntries(measured.metrics.map(item=>[item.name,item.value]));
 return {jsHeapUsedBytes:m.JSHeapUsedSize??null,jsHeapTotalBytes:m.JSHeapTotalSize??null,documents:m.Documents??null,nodes:m.Nodes??null,jsEventListeners:m.JSEventListeners??null,layoutCount:m.LayoutCount??null,recalcStyleCount:m.RecalcStyleCount??null};
}
async function sample(label){
 const snapshot=await page.evaluate(()=>{
  const api=window.WildlandsArmored,q=api.query(),status=api.status(),v=q.vehicles.find(vehicle=>vehicle.id===q.controlled);
  return {tick:q.tick,simulationSeconds:q.seconds,missionId:q.missionId,missionStatus:q.status,application:status,
   projectedCounts:{vehicles:q.vehicles.length,projectiles:q.projectiles.length,obstacles:q.obstacles.length,smoke:q.smoke.length,events:q.events.length},
   controlled:q.controlled,controlledVehicle:v?{position:v.transform.position,yaw:v.transform.yaw,velocity:v.body.velocity,damageStatus:v.damage.status,motor:v.motor,ammo:v.weapon.ammo,reserves:v.weapon.reserves,reload:v.weapon.reload}:null,
   objectives:q.objectives,visibleScreens:Array.from(document.querySelectorAll('[data-ap-screen]')).filter(element=>!element.hidden).map(element=>element.dataset.apScreen),
   feedback:document.querySelector('[data-ap-feedback]')?.textContent??'',pauseFeedback:document.querySelector('[data-ap-pause-feedback]')?.textContent??'',canvasCount:document.querySelectorAll('#armored-canvas').length,domElementCount:document.querySelectorAll('*').length};
 });
 const entry={at:now(),elapsedWallSeconds:(Date.now()-observationStart)/1000,label,...snapshot,cdp:await metrics()};
 results.samples.push(entry);append('samples.jsonl',entry);
 if(snapshot.canvasCount!==1)fail('Observed canvas count '+snapshot.canvasCount+' at '+label);
 if(snapshot.pauseFeedback.startsWith('Battle interrupted:')||snapshot.pauseFeedback.startsWith('Graphics context interrupted.'))fail(snapshot.pauseFeedback);
 console.log(JSON.stringify({kind:'sample',elapsed:entry.elapsedWallSeconds,mission:entry.missionId,tick:entry.tick,status:entry.missionStatus,paused:entry.application.paused,heap:entry.cdp.jsHeapUsedBytes,counts:entry.projectedCounts}));
 return entry;
}
async function capture(label){
 const file=label+'.png';await page.screenshot({path:path.join(OUT,file),timeout:30000});
 const bytes=fs.readFileSync(path.join(OUT,file));const item={file,bytes:bytes.length,sha256:sha(bytes),at:now()};results.screenshots.push(item);append('captures.jsonl',item);
}
async function gameplay(sample,index){
 if(sample.missionStatus!=='running'){await page.evaluate(()=>window.WildlandsArmored.control('restart'));results.transitions.push({kind:'mission-ended-restart',at:now(),mission:sample.missionId,status:sample.missionStatus});return;}
 if(sample.application.paused)return;
 const commandResults=await page.evaluate(step=>{
  const api=window.WildlandsArmored,q=api.query();let v=q.vehicles.find(vehicle=>vehicle.id===q.controlled);if(!v)return [];
  const result=[],send=command=>result.push({command,result:api.command(command)}),wrap=n=>Math.atan2(Math.sin(n),Math.cos(n));
  if(['disabled','destroyed'].includes(v.damage.status)){const next=q.vehicles.find(vehicle=>vehicle.faction===q.playerFaction&&!['disabled','destroyed'].includes(vehicle.damage.status));if(!next)return [];send({kind:'control',entityId:next.id});v=next;}
  // A bounded route near deployment exercises force-based drive/turn/brake and terrain.
  const points=[{x:264,z:145},{x:300,z:150},{x:295,z:95},{x:250,z:100}],goal=points[Math.floor(step/2)%points.length];
  const distance=Math.hypot(goal.x-v.transform.position.x,goal.z-v.transform.position.z),error=wrap(Math.atan2(goal.x-v.transform.position.x,goal.z-v.transform.position.z)-v.transform.yaw);
  send({kind:'drive',entityId:v.id,throttle:distance<8?0:Math.abs(error)>.6?0:.5,steer:distance<8?0:Math.max(-1,Math.min(1,error*1.4-v.body.yawVelocity*.5)),brake:distance<8?1:0,cruise:0});
  send({kind:'aim',entityId:v.id,yaw:wrap(v.transform.yaw+.35*Math.sin(step*.7)),elevation:.04});
  send({kind:'fire',entityId:v.id,pressed:step%4===0});
  if(step%8===0){const friends=q.vehicles.filter(vehicle=>vehicle.faction===q.playerFaction&&vehicle.id!==q.controlled).map(vehicle=>vehicle.id);if(friends.length)send({kind:'order',entityIds:friends,order:step%16===0?'follow':'hold',targetId:v.id,position:{x:goal.x,y:v.transform.position.y,z:goal.z}});}
  return result;
 },index);
 for(const item of commandResults){const record={at:now(),elapsedWallSeconds:(Date.now()-observationStart)/1000,...item};results.commands.push(record);append('commands.jsonl',record);if(!item.result.ok)fail('Public command rejected: '+JSON.stringify(item));}
}
async function checkpointTransition(index){
 const began=now();await page.evaluate(()=>window.WildlandsArmored.control('pause'));
 const saved=await page.evaluate(()=>window.WildlandsArmored.checkpoint());
 const serialized=JSON.stringify(saved);fs.writeFileSync(path.join(OUT,`checkpoint-${index}.json`),serialized+'\n');
 const restored=await page.evaluate(value=>{const api=window.WildlandsArmored;api.restore(value);return {serialized:JSON.stringify(api.checkpoint()),status:api.status()};},saved);
 const exact=restored.serialized===serialized;
 if(!exact)fail('Untouched checkpoint roundtrip differed at transition '+index);
 if(!restored.status.paused)fail('Restored checkpoint did not remain paused at transition '+index);
 const entry={kind:'checkpoint-roundtrip',index,began,finishedAt:now(),exact,paused:restored.status.paused,bytes:Buffer.byteLength(serialized),checkpointSha256:sha(serialized),restoredSha256:sha(restored.serialized)};
 results.transitions.push(entry);append('transitions.jsonl',entry);
 await capture(`transition-${String(index).padStart(2,'0')}-checkpoint`);
 await page.locator('[data-ap-screen=pause] [data-ap-action=resume]').click();
}
async function missionTransition(index){
 const began=now();await page.evaluate(()=>window.WildlandsArmored.control('pause'));
 await page.locator('[data-ap-screen=pause] [data-ap-action=menu]').click();
 await page.locator('[data-ap-screen=menu] [data-ap-action=briefing]').click();
 const missions=await page.locator('[data-ap-mission] option').evaluateAll(options=>options.map(option=>({id:option.value,name:option.textContent})));
 const current=await page.locator('[data-ap-mission]').inputValue(),next=missions[(missions.findIndex(m=>m.id===current)+1)%missions.length];
 await page.locator('[data-ap-mission]').selectOption(next.id);await page.locator('[data-ap-action=deploy]').click();
 const observed=await page.evaluate(()=>window.WildlandsArmored.query().missionId);
 if(observed!==next.id)fail('Selected mission '+next.id+' but query reported '+observed);
 const entry={kind:'menu-mission-deployment',index,began,finishedAt:now(),from:current,to:next.id,observed};results.transitions.push(entry);append('transitions.jsonl',entry);
 await capture(`transition-${String(index).padStart(2,'0')}-mission`);
}
async function main(){
 const head=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
 if(head!==EXPECTED_HEAD)throw Error('Frozen source changed before launch: '+head);
 const artifact=fs.readFileSync(artifactPath);fs.writeFileSync(path.join(OUT,'served-demo.html'),artifact);
 const args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'];
 const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium';
 results.identity={gitHead:head,artifact:{path:path.relative(ROOT,artifactPath),bytes:artifact.length,sha256:sha(artifact)},scriptSha256:sha(fs.readFileSync(__filename)),harnessSha256:sha(fs.readFileSync(path.join(ROOT,'source/wildlands/.generated/verification/browser-harness.js'))),node:process.version,playwright:require(path.join(ROOT,'source/wildlands/node_modules/playwright/package.json')).version,os:{platform:os.platform(),release:os.release(),architecture:os.arch(),logicalCpus:os.cpus().length,cpuModel:os.cpus()[0]?.model,totalMemoryBytes:os.totalmem()},viewport:VIEWPORT,deviceScaleFactor:1,executablePath,args};
 persist('identity.json',results.identity);
 browser=await chromium.launch({executablePath,headless:true,args});results.identity.browser=browser.version();
 context=await browser.newContext({viewport:VIEWPORT,deviceScaleFactor:1});
 await context.route('**/*',route=>{if(route.request().url()===URL)return route.continue();fail('Unexpected external request: '+route.request().url());return route.abort();});
 context.on('page',opened=>{opened.on('pageerror',error=>{const record={at:now(),message:String(error)};results.errors.push(record);append('page-errors.jsonl',record);});opened.on('console',message=>{if(['error','warning'].includes(message.type())){const record={at:now(),type:message.type(),message:message.text()};results.consoleProblems.push(record);append('console-problems.jsonl',record);}});opened.on('request',request=>{const record={at:now(),url:request.url(),resourceType:request.resourceType(),fixture:request.url()===URL};results.requests.push(record);append('requests.jsonl',record);});opened.on('crash',()=>fail('Browser page crashed'));});
 page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(60000);
 await harness.openArtifact(page,artifactPath,{url:URL,html:artifact.toString('utf8'),actionTimeout:15000});await harness.waitForReady(page,{host:'armored',timeout:60000});
 cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
 results.identity.webgl=await page.evaluate(()=>{const canvas=document.querySelector('#armored-canvas'),gl=canvas.getContext('webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');return {version:gl.getParameter(gl.VERSION),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),drawingBuffer:{width:gl.drawingBufferWidth,height:gl.drawingBufferHeight}};});
 persist('identity.json',results.identity);
 await page.locator('[data-ap-screen=menu] [data-ap-action=briefing]').click();await page.locator('[data-ap-action=deploy]').click();
 observationStart=Date.now();results.observationStartedAt=now();persist('started.json',{...results.identity,observationStartedAt:results.observationStartedAt,plannedDurationSeconds:DURATION_MS/1000});
 await capture('start');let sampleIndex=0,nextSample=observationStart,nextTransition=observationStart+TRANSITION_MS,transition=0;
 while(!aborted&&Date.now()-observationStart<DURATION_MS){
  if(Date.now()>=nextTransition){transition++;try{if(transition%2)await checkpointTransition(transition);else await missionTransition(transition);}catch(error){fail('Transition '+transition+': '+String(error));}nextTransition+=TRANSITION_MS;}
  if(Date.now()>=nextSample){const measured=await sample('periodic-'+sampleIndex);await gameplay(measured,sampleIndex++);nextSample=Date.now()+SAMPLE_MS;persist('progress.json',{elapsedWallSeconds:(Date.now()-observationStart)/1000,samples:results.samples.length,transitions:results.transitions.length,failures:results.failures.length,errors:results.errors.length,latest:measured});}
  // Wall-time pacing is the experimental variable; the page's native RAF remains untouched.
  const remaining=Math.min(nextSample,nextTransition,observationStart+DURATION_MS)-Date.now();
  if(remaining>0)await new Promise(resolve=>setTimeout(resolve,Math.min(1000,remaining)));
 }
 results.observationEndedAt=now();results.observedWallSeconds=(Date.now()-observationStart)/1000;results.completedPlannedDuration=!aborted&&results.observedWallSeconds>=DURATION_MS/1000;
 await sample('final');await page.evaluate(()=>window.WildlandsArmored.control('pause'));await capture('final');
}
(async()=>{
 try{await main();}catch(error){fail(String(error));results.fatal=String(error);}
 finally{
  for(const [name,action] of [['cdp',()=>cdp?.detach()],['context',()=>context?.close()],['browser',()=>browser?.close()]]){try{await action();results.cleanup.push({name,closed:true,at:now()});}catch(error){results.cleanup.push({name,closed:false,error:String(error)});}}
  results.finishedAt=now();results.observedWallSeconds??=observationStart?(Date.now()-observationStart)/1000:0;
  results.finalArtifactSha256=sha(fs.readFileSync(artifactPath));results.publishedBytesUnchanged=results.finalArtifactSha256===results.identity?.artifact.sha256;
  results.coverageLimits=['Software SwiftShader at 960x600; no hardware performance conclusion.','Entity counts are detached visible projection counts, not total live ECS or GPU allocations.','JS heap is CDP heap usage without forced garbage collection; fluctuations do not establish leak freedom.','GPU memory, resource residency, renderer geometry/texture counters, hardware VRAM and thermal/power data are unavailable.','Native RAF elapsed times are retained; no private ticks, RAF replacement, altered content, or fabricated checkpoint state.','This bounded observation is not full Q03 acceptance or reference-fidelity evidence.'];
  persist('observations.json',results);
  const heaps=results.samples.map(s=>s.cdp.jsHeapUsedBytes).filter(Number.isFinite);
  const report=['# Armored Platoon: bounded software-browser observation','',`Source: ${results.identity?.gitHead??'unavailable'}`,`Published artifact SHA-256: ${results.identity?.artifact.sha256??'unavailable'}`,`Observed wall duration: ${results.observedWallSeconds.toFixed(3)} seconds; planned duration completed: ${!!results.completedPlannedDuration}.`,`Samples: ${results.samples.length}; transitions: ${results.transitions.length}; commands: ${results.commands.length}.`,`Page errors: ${results.errors.length}; recorded console warnings/errors: ${results.consoleProblems.length}; observation failures: ${results.failures.length}.`,`Published bytes unchanged: ${results.publishedBytesUnchanged}.`,heaps.length?`CDP JS heap: first ${heaps[0]}, final ${heaps.at(-1)}, observed minimum ${Math.min(...heaps)}, maximum ${Math.max(...heaps)} bytes. No GC was forced.`:'CDP JS heap unavailable.','',...results.coverageLimits.map(line=>'- '+line),'','Raw evidence: observations.json, samples.jsonl, commands.jsonl, transitions.jsonl, identity.json, captures.jsonl and PNG captures.','',...results.failures.map(f=>'- Failure: '+f.message),'','Cleanup: '+JSON.stringify(results.cleanup)].join('\n');
  fs.writeFileSync(path.join(OUT,'report.md'),report+'\n');console.log(report);
  if(results.fatal||results.errors.length||results.failures.length||!results.completedPlannedDuration||!results.publishedBytesUnchanged)process.exitCode=1;
 }
})();
