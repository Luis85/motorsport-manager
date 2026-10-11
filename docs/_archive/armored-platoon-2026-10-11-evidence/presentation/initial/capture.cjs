const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('../../source/wildlands/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),artifact=path.join(root,'source/wildlands/.generated/artifacts/armored-play.html');
(async()=>{
 const html=fs.readFileSync(artifact,'utf8'),errors=[],warnings=[],records=[];
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 let context,failed='';
 try{
  context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  await page.route('https://localhost/presentation.html',r=>r.fulfill({contentType:'text/html',body:html}));
  await page.goto('https://localhost/presentation.html');await page.waitForFunction(()=>document.documentElement.dataset.wildlandsReady==='armored');
  async function capture(name){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(__dirname,name+'.png')});records.push({name,snapshot:await page.evaluate(()=>window.WildlandsArmored.query()),service:await page.locator('[data-ap-service]').innerText()});}
  await page.locator('[data-ap-screen=menu] [data-ap-action=briefing]').click();await page.locator('[data-ap-action=deploy]').click();
  await capture('staging-live');
  async function fixture(mode){
   await page.evaluate(mode=>{
    const api=window.WildlandsArmored,save=api.checkpoint(),mission=save.catalog.missions.find(m=>m.id===save.missionId),state=save.entities.find(e=>e.id==='armored-state').components['armored-state'];
    const c=save.entities.find(e=>e.id===state.controlled).components,d=save.catalog.vehicles.find(d=>d.id===c['armored-identity'].definition),depot=mission.supplies[0];
    let p=mode==='service'?depot.position:mode==='village'?{x:264,z:250}: {x:139,z:256};
    if(p.y===undefined){const t=mission.terrain,gx=p.x/t.cellSize,gz=p.z/t.cellSize,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz;p.y=(t.heights[iz*t.width+ix]*(1-fx)+t.heights[iz*t.width+ix+1]*fx)*(1-fz)+(t.heights[(iz+1)*t.width+ix]*(1-fx)+t.heights[(iz+1)*t.width+ix+1]*fx)*fz;}
    c['armored-transform']={position:{...p,y:p.y+d.groundClearance},yaw:0,pitch:0,roll:0};c['armored-previous']=structuredClone(c['armored-transform']);c['armored-body'].velocity={x:0,y:0,z:0};c['armored-body'].yawVelocity=0;c['armored-motor']={throttle:0,steer:0,brake:1,cruise:0};
    if(mode==='service')c['armored-weapon'].reserves[c['armored-weapon'].ammo]--;
    for(const e of save.entities)if(e.components['armored-identity']?.faction!==mission.playerFaction&&e.components['armored-weapon'])for(const id of Object.keys(e.components['armored-weapon'].reserves))e.components['armored-weapon'].reserves[id]=0;
    api.restore(save);
   },mode);
   await page.locator('[data-ap-action=resume]').click();await page.locator('#armored-canvas').focus();await page.keyboard.down('Space');
  }
  await fixture('service');await page.locator('[data-ap-action=resupply]').click();
  await page.waitForFunction(()=>Number(document.querySelector('[data-ap-supply-progress]').getAttribute('aria-valuenow'))>=15);
  await capture('service-active-fixture');
  await page.waitForFunction(()=>window.WildlandsArmored.query().events.some(e=>e.kind==='resupply-completed'),{},{timeout:90000});
  await capture('service-complete-fixture');await page.keyboard.up('Space');
  await fixture('village');await capture('village-fixture');await page.keyboard.up('Space');
  await page.keyboard.press('Escape');await page.locator('[data-ap-screen=pause] [data-ap-action=menu]').click();await page.locator('[data-ap-screen=menu] [data-ap-action=briefing]').click();await page.locator('[data-ap-mission]').selectOption('pine-ridge');await page.locator('[data-ap-action=deploy]').click();
  await fixture('pine');await capture('pine-fixture');await page.setViewportSize({width:390,height:844});await capture('narrow-fixture');await page.keyboard.up('Space');
 }catch(e){failed=String(e);}finally{if(context)await context.close();await browser.close();}
 fs.writeFileSync(path.join(__dirname,'report.json'),JSON.stringify({artifact:{path:artifact,bytes:Buffer.byteLength(html),sha256:crypto.createHash('sha256').update(html).digest('hex')},environment:{browser:browser.version(),renderer:'SwiftShader software'},method:'Unmodified artifact; native RAF. Explicit admitted checkpoint positioning and enemy empty-ammo fixtures for service/village/pine images; service progresses by real application clock and UI action. No performance or mission-play acceptance claim.',errors,warnings,failed,cleanup:'context and browser closed',records},null,2));
 console.log(JSON.stringify({failed,errors,warnings,captures:records.map(r=>r.name)}));if(failed||errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
