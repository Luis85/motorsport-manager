import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const bin=resolve(import.meta.dirname,'../../../../bin/character-studio');
async function command(args:string[],cwd:string) {
  const env={...process.env};
  if(!env.CHARACTER_STUDIO_CHROMIUM_PATH) {
    try{await access('/usr/bin/chromium');env.CHARACTER_STUDIO_CHROMIUM_PATH='/usr/bin/chromium';}catch{ /* Use Playwright's installed browser. */ }
  }
  return new Promise<any>((accept,reject)=>{
    const child=spawn(process.execPath,[bin,...args],{cwd,env,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    const timer=setTimeout(()=>{child.kill();reject(new Error('Review command exceeded its bounded runtime.'));},120_000);
    child.stdout.on('data',value=>stdout+=value);child.stderr.on('data',value=>stderr+=value);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('close',code=>{
      clearTimeout(timer);
      try{assert.equal(stderr,'');accept({exitCode:code,...JSON.parse(stdout)});}catch(error){reject(error);}
    });
  });
}
const sha=(value:Buffer)=>createHash('sha256').update(value).digest('hex');

test('CLI review produces replayable bound images and keeps existing outputs unchanged',{timeout:240_000},async()=>{
  const project=await mkdtemp(join(tmpdir(),'character-review-'));
  try{
    const identity=['--project',project,'--id','moss'];
    const created=await command(['create',...identity,'--name','Moss'],project);
    assert.equal(created.exitCode,0);
    const catalog=(await command(['catalog'],project)).catalog;
    const batch=join(project,'dress.json');
    await writeFile(batch,JSON.stringify({operations:['trail_cap','rain_cape','walking_boots'].map(id=>{
      const item=catalog.outfits.find((value:any)=>value.id===id);
      assert.ok(item,`discoverable outfit ${id}`);
      return {op:'set',path:`/outfits/${item.slot}`,value:id};
    })}));
    const character=await command(['apply',...identity,'--file',batch,'--expected-revision',String(created.revision),'--expected-state',created.stateHash],project);
    assert.equal(character.exitCode,0,JSON.stringify(character));
    const plan=join(project,'plan.json');
    await writeFile(plan,JSON.stringify({format:'character-studio-review-plan',schemaVersion:1,views:[
      {id:'contact-sheet',mode:'portrait',pose:'walk',camera:'three-quarter',yaw:-.4,elevation:.2,zoom:1.1,time:.35,width:256,height:256},
      {id:'other-phase',mode:'portrait',pose:'walk',camera:'three-quarter',yaw:-.4,elevation:.2,zoom:1.1,time:0,width:256,height:256},
      {id:'rear',camera:'back',width:256,height:256},
      {id:'dressed-work',pose:'work',camera:'three-quarter',time:.9,width:256,height:256},
    ]}));
    const first=join(project,'first'),second=join(project,'second');
    const result=await command(['review',...identity,'--plan',plan,'--out',first],project);
    assert.equal(result.exitCode,0,JSON.stringify(result));
    const manifest=JSON.parse(await readFile(join(first,'manifest.json'),'utf8'));
    assert.equal(manifest.recipeHash,character.stateHash);
    assert.equal(manifest.frames.length,4);
    assert.equal(Object.hasOwn(manifest,'time'),false,'mixed phases are recorded per frame without a false common time');
    assert.equal(manifest.compilerRevision,4);
    assert.deepEqual([manifest.frames[0].preview.yaw,manifest.frames[0].preview.elevation,manifest.frames[0].preview.zoom,manifest.frames[0].preview.time],[-.4,.2,1.1,.35]);
    assert.notEqual(manifest.frames[0].sha256,manifest.frames[1].sha256,'animation phase changes actual rendered pixels');
    assert.match(manifest.visualHash,/^[a-f0-9]{64}$/);
    for(const frame of manifest.frames){
      const png=await readFile(join(first,frame.file));
      assert.equal(png.readUInt32BE(16),256);assert.equal(png.readUInt32BE(20),256);
      assert.equal(sha(png),frame.sha256);
    }
    assert.equal(sha(await readFile(join(first,manifest.contactSheet.file))),manifest.contactSheet.sha256);
    const replay=await command(['review',...identity,'--plan',join(first,'replay-plan.json'),'--out',second],project);
    assert.equal(replay.exitCode,0,JSON.stringify(replay));
    assert.deepEqual(JSON.parse(await readFile(join(second,'manifest.json'),'utf8')),manifest);
    assert.equal((await command(['review',...identity,'--out',first],project)).exitCode,3);
    assert.equal((await command(['inspect',...identity],project)).stateHash,character.stateHash);
  }finally{await rm(project,{recursive:true,force:true});}
});


test('offline CLI preview initializes an explicit orbit and phase paused even without reduced motion',{timeout:120_000},async()=>{
  const project=await mkdtemp(join(tmpdir(),'character-phase-preview-'));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const identity=['--project',project,'--id','moss'];
    assert.equal((await command(['create',...identity],project)).exitCode,0);
    const file=join(project,'phase.html');
    const result=await command(['preview',...identity,'--out',file,'--camera','three-quarter','--pose','walk',
      '--yaw','-0.4','--elevation','0.2','--zoom','1.1','--time','0.35'],project);
    assert.equal(result.exitCode,0,JSON.stringify(result));
    let executablePath=process.env.CHARACTER_STUDIO_CHROMIUM_PATH;
    if (!executablePath) {try {await access('/usr/bin/chromium');executablePath='/usr/bin/chromium';} catch { /* Use installed Playwright browser. */ }}
    browser=await chromium.launch({headless:true,executablePath,args:['--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'no-preference'});
    await page.setContent(await readFile(file,'utf8'),{waitUntil:'domcontentloaded',timeout:60_000});
    await page.waitForFunction(()=>!!(window as any).characterStudio?.preview,null,{timeout:60_000});
    const initial=await page.evaluate(()=>(window as any).characterStudio.preview.inspect());
    assert.deepEqual([initial.yaw,initial.elevation,initial.zoom,initial.time,initial.paused],[-.4,.2,1.1,.35,true]);
    assert.equal(initial.pose,'walk');
    const isolated=await page.evaluate(()=>{
      const api=(window as any).characterStudio;
      const discovery=api.discover(); discovery.preview.configure.optional.camera.push('invalid');
      let rejected=false; try {api.preview.configure({camera:'invalid'});} catch {rejected=true;}
      return {rejected,cameras:api.discover().preview.configure.optional.camera};
    });
    assert.equal(isolated.rejected,true);
    assert.equal(isolated.cameras.includes('invalid'),false,'discovery is detached from validation tables');
  } finally {await browser?.close();await rm(project,{recursive:true,force:true});}
});
