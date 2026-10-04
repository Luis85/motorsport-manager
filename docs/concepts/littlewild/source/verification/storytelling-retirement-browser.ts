/// <reference path="../storytelling-ui-contracts.d.ts" />
import assert from 'node:assert/strict';
import type {Page} from 'playwright';

type Test=(name:string,work:()=>Promise<void>)=>Promise<void>;

export async function storytellingRetirementTests(page:Page,width:number,test:Test):Promise<void>{
 await test('Actual preview retirement detaches canvases, releases once and readmits after reopening at '+width+'px',async()=>{
  await page.evaluate('Littlewild.open("scene-editor")');
  if(await page.locator('[data-story=close]').count())await page.locator('[data-story=close]').click();
  const observer=await page.evaluateHandle(()=>{
   const root=window as unknown as {LWStorytellingEditorPreview:{create(canvas:HTMLCanvasElement,pack:LWContentPorts.ScenarioPack,id:string):LWStorytellingUI.Preview}};
   const api=root.LWStorytellingEditorPreview,create=api.create,records:{retired:number;released:number;disposed:number;completed:boolean}[]=[];
   api.create=(...args)=>{
    const instance=create(...args),record={retired:0,released:0,disposed:0,completed:false};records.push(record);
    return{...instance,retire(){const release=instance.retire?.();if(!release)return undefined;record.retired++;return()=>{record.released++;const done=release();void done.then(()=>{record.completed=true;},()=>{record.completed=true;});return done;};},dispose(){record.disposed++;instance.dispose();}};
   };
   return{records,restore(){api.create=create;}};
  });
  try{
   await page.locator('[data-story=open]').click();await page.locator('[data-story=timeline]').click();
   await page.locator('[data-story=select-clip][data-id=opening-clip]').click();
   await page.waitForFunction(()=>document.querySelector('[data-story-preview-notice]')?.textContent?.includes('Detached scene ready'));
   const main=await page.locator('[data-story-preview]').elementHandle(),overlay=await page.locator('[data-p5-animation]').elementHandle();assert(main&&overlay);
   const native=await page.evaluate('JSON.stringify(Littlewild.engine.export())');
   assert.equal(await observer.evaluate(o=>o.records.length),1);
   await page.locator('[data-story=close]').click();
   assert(!await main.evaluate(canvas=>canvas.isConnected));assert(!await overlay.evaluate(canvas=>canvas.isConnected));
   assert.equal(await page.locator('[data-p5-animation]').count(),0);assert(await page.locator('.scene-editor-layout').isVisible());
   await page.locator('[data-story=open]').click();await page.locator('[data-story=timeline]').click();
   await page.waitForFunction(()=>document.querySelector('[data-story-preview-notice]')?.textContent?.includes('Detached scene ready'));
   assert.equal(await observer.evaluate(o=>o.records.length),2);
   assert.deepEqual(await observer.evaluate(o=>o.records[0]),{retired:1,released:1,disposed:0,completed:true});
   assert(await page.locator('[data-story-preview]').evaluate(canvas=>{
    const actual=canvas as HTMLCanvasElement,blank=document.createElement('canvas');blank.width=actual.width;blank.height=actual.height;
    return actual.toDataURL()!==blank.toDataURL();
   }),'The readmitted actual renderer paints its owned canvas');
   assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'),native);
   await page.locator('[data-story=close]').click();
   await page.waitForFunction(()=>document.querySelectorAll('[data-p5-animation]').length===0);
   await page.waitForFunction(o=>o.records[1]!.completed,observer);
   assert.deepEqual(await observer.evaluate(o=>o.records.map(r=>r.retired)),[1,1]);
   assert.deepEqual(await observer.evaluate(o=>o.records.map(r=>r.released)),[1,1]);
   await main.dispose();await overlay.dispose();
  }finally{await observer.evaluate(o=>o.restore());await observer.dispose();}
 });
 if(width!==1440)return;
 await test('Synthetic retirement queue survives cancellation, bounds admission and recovers from cleanup scheduling errors',async()=>{
  await page.evaluate(async()=>{
   const root=window as unknown as {Littlewild:{open(id:string):void;scenarioUI:{editor:{session:LWSceneEditor.Session}}};LWSceneEditor:LWSceneEditor.Api;LWStorytellingUI:LWStorytellingUI.Api};
   root.Littlewild.open('scenarios');const original=root.Littlewild.scenarioUI.editor.session.snapshot();
   const mount=document.createElement('section');document.body.append(mount);
   const jobs:{run:()=>void;cancelled:boolean}[]=[],cleanupJobs:(()=>void)[]=[],messages:string[]=[];
   const records:{canvas:HTMLCanvasElement;overlay:HTMLCanvasElement;retired:number;released:number;disposed:number;draws:number;completed:number;resolveReady:(result:LittlewildRenderer.SwitchResult)=>void;release:()=>void}[]=[];
   let snapshotReads=0,entityReads=0,modal:string|null='scene-editor',surface:LWStorytellingUI.Surface,schedulerThrows=false,cleanupThrows=false,synchronous=false,retirementThrows=false,toastThrows=false;
   const instrument=(session:LWSceneEditor.Session):LWSceneEditor.Session=>({...session,get revision(){return session.revision;},snapshot(){snapshotReads++;return session.snapshot();},entities(id){entityReads++;return session.entities(id);}});
   let owner=instrument(root.LWSceneEditor.create(original));
   const ensure=(condition:unknown,message:string)=>{if(!condition)throw Error(message);};
   const redraw=()=>{mount.innerHTML=surface.render();};
   const turn=()=>new Promise<void>(done=>setTimeout(done,0));
   surface=root.LWStorytellingUI.create({session:()=>owner,sceneId:()=>original.scenes[0]!.id,modal:()=>modal,redraw,esc:String,toast(message){messages.push(message);if(toastThrows)throw Error('Cleanup toast rejected');},
    deferPreview(run){const job={run,cancelled:false};jobs.push(job);return()=>{job.cancelled=true;};},
    deferPreviewCleanup(run){cleanupJobs.push(run);if(schedulerThrows)throw Error('Cleanup scheduler rejected');},
    preview(canvas,pack,id){
     const clip=pack.storytelling!.cutscenes.find(c=>c.id===id)!,overlay=document.createElement('canvas');overlay.dataset.p5Animation='';canvas.parentElement!.append(overlay);
     let resolveReady:(result:LittlewildRenderer.SwitchResult)=>void=()=>{},release=()=>{};
     const ready=new Promise<LittlewildRenderer.SwitchResult>(resolve=>{resolveReady=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
     const record={canvas,overlay,retired:0,released:0,disposed:0,draws:0,completed:0,resolveReady,release};records.push(record);
     const status:LWStorytelling.Status={cutsceneId:id,sceneId:clip.sceneId,state:'ready',time:0,duration:clip.duration,completion:0,generation:0};
     return{ready,status(){ensure(!record.retired,'Retired playback cannot be queried');return status;},draw(){ensure(!record.retired,'Retired playback cannot advance');record.draws++;},play(){ensure(!record.retired,'Retired playback cannot play');},pause(){},stop(){},replay(){},seek(){},
      dispose(){record.disposed++;},
      ...(!synchronous?{retire(){if(retirementThrows)throw Error('Retirement boundary rejected');record.retired++;canvas.remove();overlay.remove();return async()=>{record.released++;try{await gate;if(cleanupThrows)throw Error('Resource release rejected');}finally{record.completed++;}};}}:{})};
    }
   });
   const click=(action:string)=>{const button=mount.querySelector<HTMLButtonElement>('[data-story='+action+']');ensure(button,'Missing retirement control '+action);button!.click();surface.draw(0);};
   try{
    redraw();ensure(snapshotReads===0&&entityReads===0,'Inactive entry rendering does not snapshot or query entities');
    click('open');click('timeline');jobs.at(-1)!.run();const first=records[0]!;const reads=snapshotReads,queries=entityReads;
    click('close');ensure(snapshotReads===reads&&entityReads===queries,'Closing uses the pure inactive entry without pack or entity queries');
    ensure(first.retired===1&&first.disposed===0&&!first.canvas.isConnected&&!first.overlay.isConnected,'Close retires ownership and both canvases synchronously');
    ensure(cleanupJobs.length===1,'Exactly one noncancelable batch is scheduled');
    click('open');const admitted=jobs.length;for(let i=0;i<8;i++)surface.draw(1/60);
    ensure(jobs.length===admitted&&records.length===1,'Reopen cannot admit resources before the retired batch completes');
    click('close');click('open');modal=null;surface.cancel();owner=instrument(root.LWSceneEditor.create(original));modal='scene-editor';redraw();surface.draw(0);
    cleanupJobs[0]!();cleanupJobs[0]!();await turn();ensure(first.released===1,'Duplicate delivery still releases captured resources once');
    first.release();await turn();ensure(jobs.length===admitted+1,'Only the latest session and mount schedules after release');
    jobs.at(-1)!.run();const second=records[1]!;first.resolveReady({ok:false,reason:'Obsolete retired ready'});await turn();
    ensure(!mount.textContent?.includes('Obsolete retired ready'),'Late retired readiness cannot publish into a replacement');
    const draws=second.draws;schedulerThrows=true;cleanupThrows=true;toastThrows=true;click('close');await turn();
    ensure(second.retired===1&&second.released===1&&second.disposed===0,'Scheduler failure starts captured finalization directly');
    cleanupJobs.at(-1)!();ensure(second.released===1,'A partially scheduled callback cannot duplicate fallback cleanup');
    click('open');const pending=jobs.length;surface.draw(1/60);ensure(jobs.length===pending&&second.draws===draws,'Pending release blocks new preparation and old advancement');
    second.release();await turn();ensure(second.completed===1&&messages.some(m=>m.includes('Resource release rejected')),'Cleanup attempts complete and report their actual failure');
    ensure(messages.some(m=>m.includes('Cleanup scheduler rejected')),'Scheduler failure remains visible');
    ensure(Array.from(document.querySelectorAll('[role=alert]')).some(node=>node.textContent?.includes('Cleanup toast rejected')),'Throwing feedback falls back to a visible DOM error without an unhandled rejection');
    schedulerThrows=false;cleanupThrows=false;toastThrows=false;synchronous=true;ensure(jobs.length===pending+1,'Cleanup failure does not poison the next owned preparation barrier');
    jobs.at(-1)!.run();const third=records[2]!;click('close');
    ensure(third.disposed===1&&third.retired===0&&cleanupJobs.length===2,'Custom previews without retirement keep synchronous disposal');
    ensure(records.filter(r=>r.retired>0).every(r=>r.retired===1&&r.released===1&&r.completed===1),'Each captured opt-in instance finishes exactly one retired batch');
    synchronous=false;retirementThrows=true;click('open');jobs.at(-1)!.run();const fourth=records[3]!;click('close');
    ensure(fourth.disposed===1&&messages.some(m=>m.includes('Retirement boundary rejected')),'Throwing retirement falls back to exactly one synchronous disposal with visible reason');
    retirementThrows=false;click('open');const input=Array.from(document.querySelectorAll<HTMLInputElement>('#storytelling-import')).at(-1)!;
    let read=(_:string)=>{},readStarted=0;const file=new File([JSON.stringify(original.storytelling)],'delayed.storytelling.json',{type:'application/json'});
    Object.defineProperty(file,'text',{value:()=>new Promise<string>(resolve=>{readStarted++;read=resolve;})});
    const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change'));
    ensure(readStarted===1,'The fixture has a genuinely pending file text read before close');
    const revision=owner.revision;click('close');click('open');read(JSON.stringify(original.storytelling));await turn();
    ensure(owner.revision===revision&&!mount.querySelector('[data-story=apply-import]'),'Close invalidates a pending file read across reopen without staging stale review');
    click('close');
   }finally{modal=null;surface.cancel();for(const record of records)record.release();for(const job of cleanupJobs)job();await turn();mount.remove();}
  });
 });
}
