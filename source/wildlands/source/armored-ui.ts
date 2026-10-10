/// <reference path="./armored-presentation-contracts.d.ts" />
/** HUD and journey projection. Every gameplay action crosses the command/application ports. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWArmoredUI?:unknown};
 function create(parent:HTMLElement,catalog:LWArmoredData.Catalog,hooks:LWArmoredPresentation.Hooks):LWArmoredPresentation.UI {
  const lifecycle=new AbortController(),camera:LWArmoredPresentation.Camera={mode:'chase',yaw:0,pitch:-.025,fov:58,sensitivity:1,shake:.5};
  let currentScreen='menu',pendingOrder:string|null=null,lastSnapshot=hooks.query(),lastHud=-1,noticeUntil=0;
  const wrapper=document.createElement('div');
  wrapper.innerHTML=`<div class="ap-hud" hidden>
   <div class="ap-top"><div class="ap-operation"><h2 data-ap-title></h2><div data-ap-objectives></div></div><div class="ap-toolbar"><button data-ap-camera="chase">Chase · V</button><button data-ap-camera="gunner">Gunner · V</button><button data-ap-camera="binocular">Binoculars · B</button><button data-ap-action="pause" aria-label="Pause game">Pause · Esc</button></div></div>
   <div class="ap-compass"><strong data-ap-heading>000°</strong><span>W ─── N ─── E</span></div><div class="ap-optics"></div><div class="ap-sight"><b></b></div><div class="ap-sight-label" data-ap-sight>MAIN GUN</div>
   <div class="ap-bottom"><div><section class="ap-vehicle" aria-label="Vehicle status"><h3 data-ap-vehicle-name></h3><div class="ap-readouts"><strong class="ap-speed" data-ap-speed>0</strong><span class="ap-unit">KM/H</span><span class="ap-condition" data-ap-condition></span></div><div class="ap-ammo"><button data-ap-action="ammo" data-ap-ammo>AP</button><span data-ap-load-status>READY</span><strong data-ap-reserves>0</strong></div><div class="ap-reload" role="progressbar" aria-label="Main gun reload" aria-valuemin="0" aria-valuemax="100" data-ap-reload><i></i></div><div class="ap-components" data-ap-components></div><button class="ap-repair" data-ap-action="repair" data-ap-repair>Repair · T</button></section><div class="ap-platoon" data-ap-platoon></div></div>
   <div class="ap-center-bottom"><div class="ap-controls-hint"><kbd>W A S D</kbd> Drive &nbsp; <kbd>Space</kbd> Brake &nbsp; <kbd>Click</kbd> Fire<br><kbd>Q E</kbd> Traverse &nbsp; <kbd>↑ ↓</kbd> Elevation &nbsp; <kbd>Tab</kbd> Platoon orders</div></div>
   <section class="ap-map-wrap" aria-label="Tactical map"><div class="ap-map-title"><span>PLATOON NET</span><span>N ↑</span></div><canvas data-ap-map width="376" height="304" aria-label="Known vehicle positions"></canvas><div class="ap-orders-label" data-ap-active-order></div><button data-ap-action="orders">Platoon orders · Tab</button></section></div>
   <div class="ap-feedback" role="status" aria-live="polite" data-ap-feedback></div><section class="ap-orders" hidden data-ap-orders aria-label="Platoon order"><h3 data-ap-order-title>Choose an order</h3><div data-ap-order-options></div><p class="ap-order-help" data-ap-order-help></p></section>
  </div>
  <section class="ap-panel" data-ap-screen="menu"><div class="ap-panel-content"><h1>Armored<br>Platoon</h1><div class="ap-rule"></div><p>Take the commander's seat. Lead your platoon through the fields, find your firing line, and bring the armor home.</p><div class="ap-menu-actions"><button class="primary" data-ap-action="briefing">Enter the battlefield</button><button data-ap-action="load">Load checkpoint</button></div><div class="ap-help"><details><summary>Controls & settings</summary><dl><dt>W A S D / Space</dt><dd>Drive / brake</dd><dt>Mouse / Q E / ↑ ↓</dt><dd>Aim / turret / gun elevation</dd><dt>Click / R</dt><dd>Fire main gun</dd><dt>V / B / X</dt><dd>Camera / binoculars / ammunition</dd><dt>Tab / 1–4</dt><dd>Orders / command tank</dd><dt>C / T / Escape</dt><dd>Cruise / repair / pause</dd></dl><div class="ap-settings"><label>Look sensitivity<input data-ap-setting="sensitivity" type="range" min="0.2" max="2" step="0.1" value="1"></label><label>Chase field of view<input data-ap-setting="fov" type="range" min="45" max="85" step="1" value="58"></label><label>Camera shake<input data-ap-setting="shake" type="range" min="0" max="1" step="0.1" value="0.5"></label></div></details></div><div class="ap-version">INTEGRATED DEVELOPMENT BUILD<br>Original assets · Two opposing vehicles · Single-player missions<br>Full campaign, multiplayer and reference fidelity remain in development.</div></div></section>
  <section class="ap-panel" data-ap-screen="briefing" hidden><div class="ap-panel-content"><h2>Mission briefing</h2><label for="ap-mission">Choose a mission</label><select class="ap-mission-select" id="ap-mission" data-ap-mission></select><p data-ap-description></p><div class="ap-briefing-meta"><div><span>Command</span><b data-ap-force></b></div><div><span>Deployment</span>Armored platoon</div><div><span>Conditions</span>Daylight · Clear</div></div><ul class="ap-briefing-objectives" data-ap-briefing-objectives></ul><div class="ap-menu-actions"><button class="primary" data-ap-action="deploy">Deploy platoon</button><button data-ap-action="menu">Back</button></div><div class="ap-help">Drive with W A S D. Click the battlefield to capture your mouse; move it to aim. Escape releases the mouse and pauses. Use Q / E and arrow keys for keyboard aiming.</div></div></section>
  <section class="ap-panel" data-ap-screen="pause" hidden><div class="ap-panel-content"><h2>Battle paused</h2><p>Your platoon is holding position. Resume when you're ready.</p><div class="ap-menu-actions"><button class="primary" data-ap-action="resume">Return to battle</button><button data-ap-action="save">Save checkpoint</button><button data-ap-action="load">Load checkpoint</button><button data-ap-action="restart">Restart mission</button><button data-ap-action="menu">Main menu</button></div><div class="ap-help">Checkpoints are saved in this browser. Loading restores the complete admitted simulation state. A failed load leaves your current match intact.</div><p data-ap-pause-feedback role="status" aria-live="polite"></p></div></section>
  <section class="ap-panel" data-ap-screen="debrief" hidden><div class="ap-panel-content"><h2 data-ap-result></h2><p data-ap-summary></p><ul class="ap-briefing-objectives" data-ap-debrief-objectives></ul><div class="ap-menu-actions"><button class="primary" data-ap-action="briefing">Choose next mission</button><button data-ap-action="restart">Replay mission</button><button data-ap-action="menu">Main menu</button></div></div></section>`;
  parent.append(wrapper);
  const el=<T extends HTMLElement=HTMLElement>(selector:string)=>wrapper.querySelector<T>(selector)!;
  const set=(selector:string,text:string)=>{const node=el(selector);if(node.textContent!==text)node.textContent=text;};
  const options=el<HTMLSelectElement>('[data-ap-mission]');
  for(const mission of catalog.missions){const option=document.createElement('option');option.value=mission.id;option.textContent=mission.name;options.append(option);}
  const hud=el('.ap-hud'),feedback=el('[data-ap-feedback]'),map=el<HTMLCanvasElement>('[data-ap-map]'),mapContext=map.getContext('2d')!;
  function notice(message:string,error=false):void {feedback.textContent=message;feedback.classList.toggle('error',error);set('[data-ap-pause-feedback]',message);noticeUntil=performance.now()+5000;}
  function screen(name:'menu'|'briefing'|'battle'|'pause'|'debrief'):void {
   currentScreen=name;wrapper.querySelectorAll<HTMLElement>('[data-ap-screen]').forEach(panel=>panel.hidden=panel.dataset.apScreen!==name);hud.hidden=name!=='battle';
   if(name!=='battle'){hooks.control('pause');if(document.pointerLockElement)document.exitPointerLock();pendingOrder=null;el('[data-ap-orders]').hidden=true;el(`[data-ap-screen="${name}"]`).querySelector<HTMLElement>('button,select')?.focus();}
   if(name==='briefing')briefing();
   if(name==='battle'){hooks.control('resume');parent.querySelector<HTMLCanvasElement>('#armored-canvas')?.focus();}
  }
  function briefing():void {
   const mission=catalog.missions.find(m=>m.id===lastSnapshot.missionId)??catalog.missions[0]!;options.value=mission.id;
   set('[data-ap-description]',mission.description);set('[data-ap-force]',mission.spawns.filter(s=>s.faction===mission.playerFaction).length+' vehicles');
   el('[data-ap-briefing-objectives]').replaceChildren(...mission.objectives.map(objective=>{const li=document.createElement('li');li.textContent=objective.name;return li;}));
  }
  function setCamera(mode:LWArmoredPresentation.CameraMode):void {
   camera.mode=mode;hud.classList.toggle('ap-gunner',mode==='gunner');hud.classList.toggle('ap-binocular',mode==='binocular');
   wrapper.querySelectorAll<HTMLElement>('[data-ap-camera]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.apCamera===mode)));
   set('[data-ap-sight]',mode==='binocular'?'COMMANDER OPTICS · 4×':mode==='gunner'?'GUNNER OPTICS · 2.3×':'MAIN GUN');
  }
  function issue(command:LWArmoredRuntime.Command):void {const result=hooks.command(command);if(!result.ok)notice(result.message,true);}
  function orders():void {
   if(currentScreen!=='battle')return;const panel=el('[data-ap-orders]');pendingOrder=null;panel.hidden=!panel.hidden;
   if(panel.hidden)return;
   set('[data-ap-order-title]','Choose an order');set('[data-ap-order-help]','Choose the order, then its recipient. Hold and Follow use the current commander; Charge and Secure use the point ahead of your sight.');
   el('[data-ap-order-options]').replaceChildren(...['follow','hold','charge','secure'].map(order=>{const button=document.createElement('button');button.dataset.apOrder=order;button.textContent=order[0]!.toUpperCase()+order.slice(1);return button;}));
   el('[data-ap-order-options]').querySelector<HTMLElement>('button')?.focus();
  }
  function recipients(order:string):void {
   pendingOrder=order;set('[data-ap-order-title]',order+' · choose recipient');set('[data-ap-order-help]','Select one vehicle or the whole platoon to confirm. Escape cancels.');
   const friendly=lastSnapshot.vehicles.filter(v=>v.faction===lastSnapshot.playerFaction&&v.id!==lastSnapshot.controlled);
   el('[data-ap-order-options]').replaceChildren(...[{id:'all',name:'Whole platoon'},...friendly.map(v=>({id:v.id,name:v.id}))].map(item=>{const button=document.createElement('button');button.dataset.apRecipient=item.id;button.textContent=item.name;return button;}));
  }
  function confirmOrder(recipient:string):void {
   const vehicle=lastSnapshot.vehicles.find(v=>v.id===lastSnapshot.controlled);if(!vehicle||!pendingOrder)return;
   const position={x:vehicle.transform.position.x+Math.sin(camera.yaw)*65,y:vehicle.transform.position.y,z:vehicle.transform.position.z+Math.cos(camera.yaw)*65};
   const ids=recipient==='all'?lastSnapshot.vehicles.filter(v=>v.faction===lastSnapshot.playerFaction&&v.id!==vehicle.id).map(v=>v.id):[recipient];
   const result=hooks.command({kind:'order',entityIds:ids,order:pendingOrder,targetId:vehicle.id,position});notice(result.ok?`${pendingOrder.toUpperCase()} sent to ${recipient==='all'?'the platoon':recipient}.`:result.message,!result.ok);
   pendingOrder=null;el('[data-ap-orders]').hidden=true;parent.querySelector<HTMLCanvasElement>('#armored-canvas')?.focus();
  }
  function repair():void {const result=hooks.command({kind:'repair',entityId:lastSnapshot.controlled});notice(result.message,!result.ok);}
  function ammo():void {
   const vehicle=lastSnapshot.vehicles.find(v=>v.id===lastSnapshot.controlled);if(!vehicle)return;
   const definition=catalog.vehicles.find(v=>v.id===vehicle.definition)!;const next=definition.ammunition[(definition.ammunition.indexOf(vehicle.weapon.ammo)+1)%definition.ammunition.length]!;
   issue({kind:'ammo',entityId:vehicle.id,ammo:next});
  }
  wrapper.addEventListener('click',event=>{
   const target=event.target instanceof Element?event.target.closest<HTMLElement>('button'):null;if(!target)return;
   if(target.dataset.apCamera){setCamera(target.dataset.apCamera as LWArmoredPresentation.CameraMode);return;}
   if(target.dataset.apVehicle){issue({kind:'control',entityId:target.dataset.apVehicle});return;}
   if(target.dataset.apOrder){recipients(target.dataset.apOrder);return;}
   if(target.dataset.apRecipient){confirmOrder(target.dataset.apRecipient);return;}
   switch(target.dataset.apAction){
    case 'briefing':screen('briefing');break;case 'menu':screen('menu');break;
    case 'deploy':case 'resume':screen('battle');break;
    case 'pause':screen('pause');break;case 'save':hooks.save();break;case 'load':hooks.load();break;
    case 'restart':hooks.control('restart');lastSnapshot=hooks.query();screen('battle');break;
    case 'orders':orders();break;case 'ammo':ammo();break;case 'repair':repair();break;
   }
  },{signal:lifecycle.signal});
  options.addEventListener('change',()=>{hooks.mission(options.value);lastSnapshot=hooks.query();briefing();},{signal:lifecycle.signal});
  wrapper.addEventListener('input',event=>{const target=event.target as HTMLInputElement;if(target.dataset.apSetting==='sensitivity')camera.sensitivity=Number(target.value);if(target.dataset.apSetting==='fov')camera.fov=Number(target.value);if(target.dataset.apSetting==='shake')camera.shake=Number(target.value);},{signal:lifecycle.signal});
  document.addEventListener('keydown',event=>{
   if(event.code==='Escape'){event.preventDefault();if(!el('[data-ap-orders]').hidden){pendingOrder=null;el('[data-ap-orders]').hidden=true;return;}if(currentScreen==='battle')screen('pause');else if(currentScreen==='pause')screen('battle');}
   if(currentScreen!=='battle'||event.repeat)return;
   if(event.code==='Tab'){event.preventDefault();orders();}
   if(event.code==='KeyX')ammo();
   if(event.code==='KeyT')repair();
   if(event.code==='KeyV')setCamera(camera.mode==='chase'?'gunner':'chase');
   if(event.code==='KeyB')setCamera(camera.mode==='binocular'?'chase':'binocular');
  },{signal:lifecycle.signal});
  function paintMap(snapshot:LWArmoredRuntime.Snapshot):void {
   const mission=catalog.missions.find(m=>m.id===snapshot.missionId)!;const ctx=mapContext,w=map.width,h=map.height,size=Math.max(mission.terrain.width,mission.terrain.depth)*mission.terrain.cellSize;
   const xy=(p:LWArmoredData.Vec3)=>({x:p.x/size*w,y:h-p.z/size*h});
   ctx.fillStyle='#344334';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#c9d3ae20';ctx.lineWidth=1;
   for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(i*w/5,0);ctx.lineTo(i*w/5,h);ctx.moveTo(0,i*h/5);ctx.lineTo(w,i*h/5);ctx.stroke();}
   for(const obstacle of snapshot.obstacles){if(obstacle.destroyed)continue;const p=xy(obstacle.position);ctx.fillStyle='#849078';ctx.fillRect(p.x-obstacle.size.x/size*w/2,p.y-obstacle.size.z/size*h/2,obstacle.size.x/size*w,obstacle.size.z/size*h);}
   for(const objective of mission.objectives){if(objective.kind!=='reach')continue;const p=xy(objective.position);ctx.strokeStyle='#e7c775';ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.stroke();}
   for(const vehicle of snapshot.vehicles){const p=xy(vehicle.transform.position);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(vehicle.transform.yaw);ctx.fillStyle=vehicle.id===snapshot.controlled?'#f3db8d':vehicle.faction===snapshot.playerFaction?'#c4d4b5':'#e58d72';ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(5,5);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();ctx.restore();}
  }
  function render(snapshot:LWArmoredRuntime.Snapshot,_seconds:number):void {
   lastSnapshot=snapshot;
   if(snapshot.status!=='running'&&currentScreen==='battle'){
    set('[data-ap-result]',snapshot.status==='victory'?'Mission accomplished':'Platoon lost');
    set('[data-ap-summary]',`Battle concluded after ${Math.floor(snapshot.seconds/60)}m ${Math.floor(snapshot.seconds%60)}s. Review the objectives and choose your next deployment.`);
    const mission=catalog.missions.find(m=>m.id===snapshot.missionId)!;
    el('[data-ap-debrief-objectives]').replaceChildren(...mission.objectives.map(o=>{const li=document.createElement('li');li.textContent=`${(snapshot.objectives[o.id]??0)>=o.required?'Complete':'Incomplete'} — ${o.name}`;return li;}));screen('debrief');
   }
   if(performance.now()>noticeUntil&&feedback.textContent)feedback.textContent='';
   if(snapshot.tick===lastHud&&currentScreen==='battle')return;lastHud=snapshot.tick;
   const vehicle=snapshot.vehicles.find(v=>v.id===snapshot.controlled);if(!vehicle)return;
   const mission=catalog.missions.find(m=>m.id===snapshot.missionId)!,definition=catalog.vehicles.find(v=>v.id===vehicle.definition)!;
   set('[data-ap-title]',mission.name);set('[data-ap-vehicle-name]',vehicle.id+' / '+definition.name);
   set('[data-ap-speed]',Math.round(Math.hypot(vehicle.body.velocity.x,vehicle.body.velocity.z)*3.6).toString());
   set('[data-ap-heading]',((Math.round(camera.yaw*180/Math.PI)%360+360)%360).toString().padStart(3,'0')+'°');
   set('[data-ap-repair]',vehicle.damage.repair>0?'REPAIRING · '+vehicle.damage.repair.toFixed(1)+'s':'Repair · T · '+Number(vehicle.damage.repairKits??0)+' kits');
   el('[data-ap-repair]').title='Stop the vehicle, then begin repairs. Moving or taking damage interrupts repairs.';
   set('[data-ap-condition]',vehicle.damage.status);set('[data-ap-ammo]',vehicle.weapon.ammo.toUpperCase()+' · X');
   set('[data-ap-reserves]',String(vehicle.weapon.reserves[vehicle.weapon.ammo]??0));set('[data-ap-load-status]',vehicle.weapon.reload>0?vehicle.weapon.reload.toFixed(1)+'s':'READY');
   const progress=Math.round((1-Math.min(1,vehicle.weapon.reload/definition.reloadSeconds))*100);el('[data-ap-reload]').setAttribute('aria-valuenow',String(progress));el('[data-ap-reload] i').style.width=progress+'%';
   set('[data-ap-components]',Object.entries(vehicle.damage.components).map(([name,value])=>`${name.toUpperCase()} ${Math.round(value)}%`).join(' · '));
   set('[data-ap-active-order]',snapshot.vehicles.filter(v=>v.faction===snapshot.playerFaction&&v.id!==snapshot.controlled).map(v=>v.id+' / '+v.order.kind.toUpperCase()).join(' · '));
   const objectives=el('[data-ap-objectives]');
   if(!objectives.childElementCount||objectives.dataset.mission!==mission.id){objectives.dataset.mission=mission.id;objectives.replaceChildren(...mission.objectives.map(o=>{const line=document.createElement('div');line.className='ap-objective';line.dataset.objective=o.id;line.textContent=o.name;return line;}));}
   for(const objective of mission.objectives)objectives.querySelector<HTMLElement>(`[data-objective="${objective.id}"]`)?.classList.toggle('done',(snapshot.objectives[objective.id]??0)>=objective.required);
   const friends=snapshot.vehicles.filter(v=>v.faction===snapshot.playerFaction),platoon=el('[data-ap-platoon]');
   if(platoon.childElementCount!==friends.length)platoon.replaceChildren(...friends.map((friend,i)=>{const button=document.createElement('button');button.dataset.apVehicle=friend.id;button.textContent=(i+1)+' · '+friend.id;button.title='Take control of '+friend.id;return button;}));
   for(const friend of friends){const button=platoon.querySelector<HTMLElement>(`[data-ap-vehicle="${friend.id}"]`);button?.classList.toggle('active',friend.id===snapshot.controlled);button?.setAttribute('aria-pressed',String(friend.id===snapshot.controlled));}
   paintMap(snapshot);
  }
  const first=lastSnapshot.vehicles.find(v=>v.id===lastSnapshot.controlled);camera.yaw=first?.transform.yaw??0;
  render(lastSnapshot,0);screen('menu');setCamera('chase');
  return {render,screen,notice,order:()=>pendingOrder,camera:()=>camera,setCamera,activate(){},destroy(){lifecycle.abort();wrapper.remove();}};
 }
 root.LWArmoredUI={create};
})(typeof globalThis!=='undefined'?globalThis:this);
