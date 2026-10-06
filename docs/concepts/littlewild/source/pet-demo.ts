/// <reference path="./pet-contracts.d.ts" />
/** Detached Pocket Pet presentation: buttons emit command intent; the host owns the clock. */
declare namespace LWPetDemo {
 interface Host {
  parent:HTMLElement;query():LWPetRuntime.Snapshot;command(input:LWPetRuntime.Command):LWPetRuntime.Result;
  control(action:'pause'|'resume'|'speed'|'restart'|'exit',value?:number|{species:string;name?:string}):void;
  status():{paused:boolean;speed:number};catalog:LWPetData.Catalog;assets:readonly unknown[];speeds:readonly number[];
 }
 interface Surface {refresh(force?:boolean):void;draw(time:number,dt:number):void;feedback(message:string,error?:boolean):void;renderer:LWPetRenderer.Surface;destroy():void;}
 interface Api {create(host:Host):Surface;}
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWPetDemo?:LWPetDemo.Api;LWPetRenderer:LWPetRenderer.Api};
 const escape=(value:unknown):string=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const icons:Record<string,string>={feed:'🍙',treat:'🧁',play:'⚽',clean:'🫧',cuddle:'💗',medicine:'💊',lights:'💡'};
 const moods:Record<string,{label:string;emote:string}>={happy:{label:'Happy',emote:'♪'},content:{label:'Content',emote:''},hungry:{label:'Hungry',emote:'🍙?'},sleepy:{label:'Sleepy',emote:'…'},dirty:{label:'Wants a bath',emote:'💦'},sad:{label:'Lonely',emote:'💧'},sick:{label:'Sick',emote:'🤒'},sleeping:{label:'Sleeping',emote:'Zzz'},egg:{label:'Waiting to hatch',emote:''},departed:{label:'Departed',emote:''}};
 const time=(minutes:number):string=>{const h=Math.floor(minutes/60),m=Math.floor(minutes%60);return h?h+' h '+m+' min':m+' min';};
 function create(host:LWPetDemo.Host):LWPetDemo.Surface{
  const workspace=document.createElement('section');workspace.id='pet-demo';workspace.setAttribute('aria-label','Pocket Pet virtual pet demonstration');
  const speciesOptions=host.catalog.species.map(s=>`<option value="${escape(s.id)}">${escape(s.name)}</option>`).join('');
  workspace.innerHTML=`<header class="pet-header"><div><h1>Pocket Pet</h1><p class="pet-subtitle" data-pet-subtitle></p></div><div class="pet-time"><span class="pet-clock" data-pet-clock></span><button type="button" data-pet="pause">Pause</button><label>Speed <select data-pet="speed">${host.speeds.map(s=>`<option value="${s}">${s}×</option>`).join('')}</select></label><button type="button" data-pet="exit">Return to colony</button></div></header>
<div class="pet-layout"><div class="pet-stage"><div class="pet-device"><canvas class="pet-view" tabindex="0" aria-label="3D pet room built from Scene Forge models. Drag or use the arrow keys to look around; plus and minus zoom."></canvas><div class="pet-emote" aria-hidden="true"></div><p class="pet-webgl" hidden>This 3D room needs WebGL 2. Every need, action and the diary below still work.</p><div class="pet-view-tools"><button type="button" data-pet="orbit-left" aria-label="Turn view left">◀</button><button type="button" data-pet="zoom-in" aria-label="Zoom in">+</button><button type="button" data-pet="zoom-out" aria-label="Zoom out">−</button><button type="button" data-pet="orbit-right" aria-label="Turn view right">▶</button></div></div>
<div class="pet-actions" role="group" aria-label="Care actions"></div><p class="pet-status" role="status" aria-live="polite"></p></div>
<aside class="pet-panel"><section class="pet-needs" aria-label="Needs"></section><dl class="pet-facts"></dl><ul class="pet-alerts" aria-label="Care alerts"></ul>
<section class="pet-adopt" hidden aria-labelledby="pet-adopt-title"><h2 id="pet-adopt-title">Adopt a new egg</h2><label>Species <select data-pet-adopt-species>${speciesOptions}</select></label><label>Name <input data-pet-adopt-name maxlength="24" placeholder="Default species name"></label><button type="button" data-pet="adopt">Welcome the new egg</button></section>
<details><summary>Name &amp; new egg</summary><form class="pet-rename"><label>Name <input data-pet-name maxlength="24" required></label><button type="submit">Rename</button></form><div class="pet-restart"><label>Species <select data-pet-restart-species>${speciesOptions}</select></label><button type="button" data-pet="restart-ask">Start over…</button><div class="pet-confirm" hidden role="group" aria-label="Confirm starting over"><p>Starting over replaces your current pet. Export a checkpoint first to keep it.</p><button type="button" data-pet="restart-cancel">Cancel</button><button type="button" data-pet="restart-confirm" class="pet-danger">Replace my pet</button></div></div></details>
<details open><summary>Diary</summary><ol class="pet-log" aria-label="Recent pet events"></ol></details>
<details><summary>How to care</summary><p>Every need slowly drops. Feed meals, play, cuddle and clean up before a need reaches zero. Leaving a need empty, letting your pet collapse from exhaustion or staying sick without medicine each count as a care mistake.</p><p>Turn the lights off when your pet is sleepy; it wakes by itself once rested. Too many snacks in one hour cause a tummy ache. At most one care mistake before adulthood grows a Bloom adult; more grow a Bramble.</p><p>Speed changes only this demo's clock. Exporting a checkpoint keeps your pet.</p></details>
<details><summary>Engine field guide</summary><ul class="pet-features"><li>Models: authored as Scene Forge recipes, exported with <code>forge3d littlewild sync</code> into Littlewild definitions with rig tags.</li><li>Rules: catalog data on the shared ECS – metabolism, digestion, sleep, health and growth systems.</li><li>Clock: fixed 0.1 s ticks advanced only by this application; queries and drawing never advance time.</li><li>Saves: versioned checkpoints restore the exact ECS state.</li></ul></details></aside></div>`;
  host.parent.append(workspace);
  const canvas=workspace.querySelector<HTMLCanvasElement>('.pet-view')!,renderer=root.LWPetRenderer.create(canvas,host.assets,host.catalog.scene);
  const $=<T extends HTMLElement>(selector:string):T=>workspace.querySelector<T>(selector)!;
  const actions=$('.pet-actions'),needs=$('.pet-needs'),facts=$('.pet-facts'),alerts=$('.pet-alerts'),log=$('.pet-log'),status=$('.pet-status'),emote=$('.pet-emote');
  if(renderer.mode==='Unavailable')$('.pet-webgl').hidden=false;
  status.textContent=host.query().status!=='alive'?'Your pet has departed. Adopt a new egg when you are ready.':host.query().pet.stage==='egg'?'Cuddle the egg to keep it warm. It hatches by itself soon.':'Choose a care action below.';
  let snapshot=host.query(),stamp='',drag:{x:number;y:number}|null=null;
  function feedback(message:string,error=false):void{status.textContent=message;status.classList.toggle('pet-error',error);}
  function command(input:LWPetRuntime.Command):void{const result=host.command(input);feedback(result.message,!result.ok);refresh(true);}
  function button(id:string,label:string,icon:string,enabled:boolean,reason:string,data:string):string{
   const described=enabled?'':` aria-describedby="pet-reason-${escape(id)}"`;
   return `<button type="button" ${data} ${enabled?'':'aria-disabled="true"'}${described}><span class="pet-icon" aria-hidden="true">${icon}</span><span class="pet-label">${escape(label)}</span>${enabled?'':`<span class="pet-disabled-reason" id="pet-reason-${escape(id)}">${escape(reason)}</span>`}</button>`;
  }
  function paintActions():void{
   const focused=document.activeElement instanceof HTMLElement&&actions.contains(document.activeElement)?document.activeElement.dataset.petAction??document.activeElement.dataset.pet:null;
   const lights=snapshot.lightsAction;
   actions.innerHTML=snapshot.actions.map(a=>button(a.id,a.name,icons[a.kind]??'•',a.enabled,a.reason,`data-pet-action="${escape(a.id)}"`)).join('')+button('lights',lights.label,icons.lights!,lights.enabled,lights.reason,`data-pet="${lights.command}"`);
   if(focused)actions.querySelector<HTMLElement>(`[data-pet-action="${focused}"],[data-pet="${focused}"]`)?.focus();
  }
  function refresh(force=false):void{
   snapshot=host.query();
   const next=JSON.stringify([snapshot.actions,snapshot.lightsAction,snapshot.needs,snapshot.health,snapshot.events.length,snapshot.mood,snapshot.pet,snapshot.alerts,snapshot.status,host.status()]);
   if(!force&&next===stamp)return;stamp=next;
   const p=snapshot.pet,c=snapshot.clock,state=host.status();
   $('[data-pet-subtitle]').textContent=`${p.name} · ${p.speciesName} · ${p.stage==='adult'?p.formName+' adult':p.stageName}`;
   $('[data-pet-clock]').textContent=`Day ${c.day} · ${String(c.hour).padStart(2,'0')}:${String(c.minute).padStart(2,'0')}${c.night?' · night':''}`;
   const pause=$<HTMLButtonElement>('[data-pet=pause]');pause.textContent=state.paused?'Resume':'Pause';pause.setAttribute('aria-pressed',String(state.paused));
   $<HTMLSelectElement>('[data-pet=speed]').value=String(state.speed);
   paintActions();
   needs.innerHTML=[...snapshot.needs,{id:'health',name:'Health',value:snapshot.health,warn:snapshot.health<40}].map(n=>`<div class="pet-need${n.warn?' pet-warn':''}"><span id="pet-need-${n.id}">${escape(n.name)}</span><meter aria-labelledby="pet-need-${n.id}" min="0" max="100" low="30" high="70" optimum="100" value="${n.value}"></meter><b>${Math.round(n.value)}</b></div>`).join('');
   const mood=moods[snapshot.mood]??moods.content!;
   facts.innerHTML=`<div><dt>Mood</dt><dd>${escape(mood.label)}</dd></div><div><dt>Age</dt><dd>${escape(time(p.age))}</dd></div><div><dt>Stage</dt><dd>${escape(p.stage==='adult'?p.formName:p.stageName)}${p.stage!=='adult'?` · ${Math.round(p.stageProgress*100)}%`:''}</dd></div><div><dt>Weight</dt><dd>${p.weight} g</dd></div><div><dt>Care mistakes</dt><dd>${p.mistakes}</dd></div><div><dt>Activity</dt><dd>${snapshot.activity?escape(host.catalog.actions.find(a=>a.id===snapshot.activity!.action)?.name)+' · '+Math.ceil(snapshot.activity.remaining)+' min':snapshot.status!=='alive'?'—':snapshot.sleeping?'Sleeping':'Free'}</dd></div>`;
   alerts.innerHTML=snapshot.alerts.map(a=>`<li>${escape(a)}</li>`).join('');alerts.hidden=!snapshot.alerts.length;
   $('.pet-adopt').hidden=snapshot.status==='alive';
   log.innerHTML=snapshot.events.slice(-14).reverse().map(e=>`<li><time>${e.minute===undefined?'':escape(time(e.minute))}</time> ${escape(e.message)}</li>`).join('');
   const name=$<HTMLInputElement>('[data-pet-name]');if(document.activeElement!==name)name.value=p.name;
  }
  function draw(now:number,dt:number):void{
   snapshot=host.query();renderer.draw(snapshot,now,dt);
   const point=renderer.anchor(),mood=moods[snapshot.mood]??moods.content!,text=snapshot.activity?icons[snapshot.activity.kind]??'':mood.emote;
   emote.textContent=text;emote.hidden=!point||!text;if(point)emote.style.transform=`translate(${Math.round(point.x)}px,${Math.round(point.y)}px) translate(-50%,-100%)`;
  }
  workspace.addEventListener('click',event=>{
   const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-pet],[data-pet-action]'):null;if(!target)return;
   if(target.getAttribute('aria-disabled')==='true'){feedback(target.querySelector('.pet-disabled-reason')?.textContent+'.',true);return;}
   const action=target.dataset.petAction,kind=target.dataset.pet;
   if(action){command({kind:'care',action});return;}
   switch(kind){
    case 'pause':host.control(host.status().paused?'resume':'pause');refresh(true);break;
    case 'exit':host.control('exit');break;
    case 'sleep':case 'wake':command({kind});break;
    case 'orbit-left':renderer.orbit(-.2);break;case 'orbit-right':renderer.orbit(.2);break;
    case 'zoom-in':renderer.zoom(.88);break;case 'zoom-out':renderer.zoom(1.14);break;
    case 'adopt':{const name=$<HTMLInputElement>('[data-pet-adopt-name]').value.trim();command({kind:'adopt',species:$<HTMLSelectElement>('[data-pet-adopt-species]').value,...(name?{name}:{})});break;}
    case 'restart-ask':$('.pet-confirm').hidden=false;$<HTMLButtonElement>('[data-pet=restart-cancel]').focus();break;
    case 'restart-cancel':$('.pet-confirm').hidden=true;$<HTMLButtonElement>('[data-pet=restart-ask]').focus();break;
    case 'restart-confirm':$('.pet-confirm').hidden=true;host.control('restart',{species:$<HTMLSelectElement>('[data-pet-restart-species]').value});feedback('A new egg arrived. Cuddle it to keep it warm.');refresh(true);$<HTMLButtonElement>('[data-pet=restart-ask]').focus();break;
   }
  });
  $<HTMLSelectElement>('[data-pet=speed]').addEventListener('change',event=>{host.control('speed',Number((event.target as HTMLSelectElement).value));refresh(true);});
  $<HTMLFormElement>('.pet-rename').addEventListener('submit',event=>{event.preventDefault();command({kind:'name',name:$<HTMLInputElement>('[data-pet-name]').value.trim()});});
  canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(!drag)return;renderer.orbit((drag.x-event.clientX)*.006,(event.clientY-drag.y)*.004);drag={x:event.clientX,y:event.clientY};});
  canvas.addEventListener('pointerup',()=>{drag=null;});
  canvas.addEventListener('wheel',event=>{event.preventDefault();renderer.zoom(event.deltaY>0?1.08:.92);},{passive:false});
  canvas.addEventListener('keydown',event=>{
   const keys:Record<string,()=>void>={ArrowLeft:()=>renderer.orbit(-.12),ArrowRight:()=>renderer.orbit(.12),ArrowUp:()=>renderer.orbit(0,.08),ArrowDown:()=>renderer.orbit(0,-.08),'+':()=>renderer.zoom(.9),'-':()=>renderer.zoom(1.1)};
   const handler=keys[event.key];if(handler){event.preventDefault();handler();}
  });
  refresh(true);
  return {refresh,draw,feedback,renderer,destroy(){renderer.destroy();workspace.remove();}};
 }
 root.LWPetDemo={create};
})(globalThis);
