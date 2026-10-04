import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import type {Page} from 'playwright';

// Test-only, bounded observation. No protocol payloads or shipping hooks are saved.
type Row={clock:'node'|'page';time:number;phase:string;detail?:string|undefined;id?:number;session?:string|undefined};
type Case={name:string;rows:Row[];rowLimit:number;dropped:number;oversizeMessages:number};
const navigationEvents=new Set(['Page.frameScheduledNavigation','Page.frameRequestedNavigation','Page.frameClearedScheduledNavigation','Page.frameStartedLoading','Page.frameStoppedLoading','Page.frameNavigated']);
interface Debug {enable(pattern:string):void;disable():string;enabled(namespace:string):boolean;log:(...args:unknown[])=>unknown;}
export function storyClickDiagnostics(out:string){
 const enabled=process.env.LITTLEWILD_STORY_CLICK_DIAGNOSTICS==='1',cases:Case[]=[],setup:string[]=[];
 const origin=performance.now(),pending=new Map<string,{method:string;detail:string}>();
 let active:Case|null=null,debug:Debug|null=null,previous='',sink:Debug['log']|null=null,forward=false,captured=false;
 const closeCase='Mobile reflow, 44px controls and preview cleanup when returning to scenes at 1440px';
 const target=(name:string)=>name===closeCase||name.endsWith('1440px')&&(name.startsWith('Actual 3D cinematic timeline')||name.startsWith('Actual 2D preview renderer'));
 function record(row:Row){if(!active)return;if(row.phase==='input.capture')captured=true;if(!captured&&active.rows.length>=32)active.rows.splice(1,1);if(active.rows.length<active.rowLimit)active.rows.push(row);else active.dropped++;}
 function protocol(this:unknown,...args:unknown[]){
  const header=typeof args[0]==='string'?args[0].slice(0,256):'';
  const isProtocol=header.includes('pw:protocol'),returned=(!isProtocol||forward)&&sink?Reflect.apply(sink,this,args):undefined;
  if(isProtocol)observe(args,header);return returned;
 }
 function observe(args:unknown[],header:string){
  const payload=args.find((arg):arg is string=>typeof arg==='string'&&/\{"(?:id|method)":/.test(arg.slice(0,256)));if(!payload)return;
  const start=payload.slice(0,256).search(/\{"(?:id|method)":/),prefix=payload.slice(start,start+512),id=/^\{"id":(\d+)/.exec(prefix)?.[1],send=header.includes('SEND');
  const method=/"method":"([^"]+)"/.exec(prefix)?.[1],navigation=!send&&!!method&&navigationEvents.has(method);
  if(!navigation&&(!id||!send&&!pending.has(id)))return;
  if(send&&!['Input.dispatchMouseEvent','Runtime.callFunctionOn','Runtime.evaluate','Page.enable'].includes(method??''))return;
  if(payload.length-start>8192){if(active)active.oversizeMessages++;return;}
  try{
   const message=JSON.parse(payload.slice(start)) as {id:number;sessionId?:string;method?:string;params?:{type?:string;button?:string;arguments?:{value?:unknown}[];expression?:string};error?:unknown};
   if(navigation){record({clock:'node',time:performance.now()-origin,phase:'cdp.navigation-event',detail:message.method,session:message.sessionId});return;}
   const key=String(message.id);
   if(send){
    const params=message.params,stop=(params?.arguments??[]).some(arg=>typeof arg.value==='string'&&arg.value.length<200&&arg.value.includes('h.stop()'));
    const input=message.method==='Input.dispatchMouseEvent',epilogue=message.method==='Page.enable';
    if(!input&&!stop&&!epilogue)return;
    const detail=input?String(params?.type)+'/'+String(params?.button):epilogue?'input epilogue candidate':'h.stop';
    if(pending.size>=32){active&&(active.dropped++);return;}
    pending.set(key,{method:message.method??'',detail});record({clock:'node',time:performance.now()-origin,phase:'cdp.send',detail:(message.method??'')+' '+detail,id:message.id,session:message.sessionId});
   }else{
    const sent=pending.get(key);if(!sent)return;pending.delete(key);
    record({clock:'node',time:performance.now()-origin,phase:message.error?'cdp.error':'cdp.ack',detail:sent.method+' '+sent.detail,id:message.id,session:message.sessionId});
   }
  }catch{if(active)active.dropped++;}
 }
 if(enabled){
  try{
   const diagnosticRequire=createRequire(__filename),core=path.dirname(diagnosticRequire.resolve('playwright-core/package.json'));
   debug=(diagnosticRequire(path.join(core,'lib/utilsBundle.js')) as {debug:Debug}).debug;setup.push('Pinned Playwright shared debug sink available');
  }catch(error){setup.push('CDP observer unavailable: '+String(error));}
 }
 return{
  enabled,
  begin(name:string){
   if(!enabled||!target(name))return;active={name,rows:[],rowLimit:name===closeCase?64:192,dropped:0,oversizeMessages:0};cases.push(active);pending.clear();captured=false;
   if(debug){forward=debug.enabled('pw:protocol');previous=debug.disable();sink=debug.log;debug.log=protocol;debug.enable([previous,'pw:protocol'].filter(Boolean).join(','));}
   record({clock:'node',time:performance.now()-origin,phase:'case.begin'});
  },
  end(){
   if(!active)return;record({clock:'node',time:performance.now()-origin,phase:'case.end',detail:'pending CDP acknowledgements: '+pending.size});
   if(debug&&sink){debug.disable();debug.log=sink;debug.enable(previous);}active=null;sink=null;pending.clear();
  },
  async attach(page:Page,width:number){
   if(!enabled||width!==1440)return;
   try{
    await page.exposeBinding('__littlewildStoryClickPhase',(_source,row:Row)=>{record(row);});
    const installed=await page.evaluate(()=>{
     type Host=Record<string,unknown>;
     const host=window as unknown as Host,send=host.__littlewildStoryClickPhase as (row:Row)=>Promise<void>;
     let capturing=false,rows=0;const seen=new Set<string>(),restores:(()=>void)[]=[],available:string[]=[],missing:string[]=[];
     const emit=(phase:string,detail?:string)=>{if(capturing&&rows++<192)void send({clock:'page',time:performance.timeOrigin+performance.now(),phase,detail}).catch(()=>{});};
     function wrap(object:Host|undefined,key:string,label:string,after?:(value:unknown)=>void,mapReturn?:(value:unknown)=>unknown){
      const original=object?.[key];if(!object||typeof original!=='function'){missing.push(label);emit('observer.missing',label);return;}
      const replacement=function(this:unknown,...args:unknown[]){emit(label+'.begin');try{const value=Reflect.apply(original,this,args);try{after?.(value);}catch(error){emit(label+'.observer-unavailable',String(error).slice(0,160));}emit(label+'.return');return mapReturn?mapReturn(value):value;}catch(error){emit(label+'.throw',String(error).slice(0,160));throw error;}};
      try{object[key]=replacement;if(object[key]!==replacement){missing.push(label);emit('observer.missing',label);return;}restores.push(()=>{object[key]=original;});available.push(label);emit('observer.available',label);}catch{missing.push(label);emit('observer.missing',label);}
     }
     function wrapRetirement(object:Host,label:string){
      wrap(object,'retire',label,undefined,value=>{
       if(typeof value!=='function')return value;
       // Preserve protected dispose identities and the finalizer's receiver,
       // arguments and original promise; observe settlement without awaiting it.
       return function(this:unknown,...args:unknown[]){emit(label+'.release.begin');try{const result=Reflect.apply(value,this,args);emit(label+'.release.return');if(result&&typeof result.then==='function')void Promise.resolve(result).then(()=>emit(label+'.release.resolved'),error=>emit(label+'.release.rejected',String(error).slice(0,160)));return result;}catch(error){emit(label+'.release.throw',String(error).slice(0,160));throw error;}};
      });
     }
     const editor=(host.Littlewild as {scenarioUI:{editor:{session:Host;storytelling:Host}}}).scenarioUI.editor;
     wrap(editor.session,'replace','session.replace');wrap(editor as unknown as Host,'render','sceneEditor.render');
     wrap(editor.storytelling,'render','surface.render');wrap(editor.storytelling,'cancel','surface.cancel');
     wrap(host.LWScenarios as Host,'validate','admission.validate');wrap(host.LWStorytelling as Host,'create','playback.create');
     wrap(host.LWStorytellingEditorPreview as Host,'create','preview.create',value=>{
      const preview=value as Host;missing.push('preview.dispose: protected lifecycle identity');emit('observer.missing','preview.dispose: protected lifecycle identity');wrapRetirement(preview,'preview.retire');
      const ready=(value as {ready?:Promise<unknown>}).ready;if(ready)void ready.then(()=>emit('preview.ready'),()=>emit('preview.ready.rejected'));
     });
     wrap(host.LWStorytellingRenderer as Host,'create','renderer.create',value=>{
      const renderer=value as Host;let first=true,retarget=false;
      wrap(renderer,'updatePlayback','renderer.updatePlayback',value=>{if(value===true)retarget=true;});
      missing.push('renderer.dispose: protected lifecycle identity');emit('observer.missing','renderer.dispose: protected lifecycle identity');wrapRetirement(renderer,'renderer.retire');
      const draw=renderer.draw;if(typeof draw==='function')renderer.draw=function(this:unknown,...args:unknown[]){const phase=first?'renderer.firstDraw':retarget?'renderer.retargetDraw':null;if(phase)emit(phase+'.begin');try{const value=Reflect.apply(draw,this,args);if(phase)emit(phase+'.return');first=false;retarget=false;return value;}catch(error){if(phase)emit(phase+'.throw',String(error).slice(0,160));throw error;}};
     });
     const idle=window.requestIdleCallback;
     if(idle){window.requestIdleCallback=function(this:Window,callback,options){emit('idle.schedule');return Reflect.apply(idle,this,[function(this:unknown,deadline:IdleDeadline){
      emit('idle.start','timeout='+deadline.didTimeout+' remaining='+deadline.timeRemaining());
      try{const result=Reflect.apply(callback,this,[deadline]);emit('idle.return');return result;}
      catch(error){emit('idle.throw',String(error).slice(0,160));throw error;}
      finally{setTimeout(()=>emit('idle.nextTask'),0);requestAnimationFrame(()=>emit('idle.nextFrame'));}
     },options]);};restores.push(()=>{window.requestIdleCallback=idle;});available.push('idle');}else missing.push('idle');
     const capture=(event:Event)=>{
      const element=event.target instanceof Element?event.target.closest('button'):null;
      const action=element?.matches('[data-story-form=track] button[type=submit]')?'track-submit':element?.matches('[data-story=apply-import]')?'apply-import':element?.matches('[data-story=close]')?'close':null;
      if(!action||seen.has(action))return;seen.add(action);capturing=true;rows=0;emit('input.capture',action);
      queueMicrotask(()=>emit('input.microtask',action));setTimeout(()=>emit('input.nextTask',action),0);requestAnimationFrame(()=>emit('input.nextFrame',action));
     };
     const bubble=(event:Event)=>{if(capturing&&event.target instanceof Element&&event.target.closest('[data-story-form=track] button[type=submit],[data-story=apply-import],[data-story=close]'))emit('input.bubble');};
     document.addEventListener('click',capture,true);document.addEventListener('click',bubble);
     window.addEventListener('pagehide',()=>{for(const restore of restores.reverse())restore();document.removeEventListener('click',capture,true);document.removeEventListener('click',bubble);},{once:true});
     return{available,missing,timeOrigin:performance.timeOrigin};
    });
    setup.push(JSON.stringify(installed));
   }catch(error){setup.push('Page observer unavailable: '+String(error).slice(0,400));}
  },
  write(){
   if(!enabled)return;this.end();
   const report={schema:1,enabled,scope:'Private diagnostic extension of original desktop Add track, Apply storytelling import and return-to-scenes close cases. Page.enable is an epilogue candidate, not proof of navigation; navigation rows save event names only. Idle return observes the callback; finalizer promise rows separately observe asynchronous resource release settlement. Original bounded pre-target ring and limits remain; observations do not establish unobserved phases.',clock:{nodeOrigin:origin,nodeUnixOrigin:performance.timeOrigin+origin,page:'Unix milliseconds, streamed without awaiting bindings'},setup,cases};
   let json=JSON.stringify(report,null,2)+'\n';
   while(Buffer.byteLength(json)>65536&&cases.some(value=>value.rows.length)){const close=cases.find(value=>value.name===closeCase&&value.rows.length),trim=close??cases.reduce((a,b)=>a.rows.length>b.rows.length?a:b);trim.rows.pop();trim.dropped++;json=JSON.stringify(report,null,2)+'\n';}
   fs.writeFileSync(path.join(out,'storytelling-click-diagnostics.json'),json);
  }
 };
}
