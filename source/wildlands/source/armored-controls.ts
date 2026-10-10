/// <reference path="./armored-presentation-contracts.d.ts" />
/** Keyboard, pointer and gamepad translate to intentions. Input never moves a vehicle. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWArmoredControls?:unknown};
 function create(canvas:HTMLCanvasElement,hooks:LWArmoredPresentation.Hooks,ui:LWArmoredPresentation.UI,catalog:LWArmoredData.Catalog):LWArmoredPresentation.Controls {
  const lifecycle=new AbortController(),keys=new Set<string>(),camera=ui.camera();
  let controlled='',lastDrive='',lastAim='',lastFire=false,mouseFire=false,rightDrag=false,cruise=0,gamepadFire=false,lastButtons:boolean[]=[];
  function submit(input:LWArmoredRuntime.Command):void {const result=hooks.command(input);if(!result.ok)ui.notice(result.message,true);}
  function reset():void {keys.clear();mouseFire=false;rightDrag=false;cruise=0;gamepadFire=false;lastDrive='';lastAim='';lastFire=false;}
  function release():void {
   reset();
   if(controlled){hooks.command({kind:'drive',entityId:controlled,throttle:0,steer:0,brake:1,cruise:0});hooks.command({kind:'fire',entityId:controlled,pressed:false});}
   lastDrive='';lastFire=false;
  }
  const active=()=>!hooks.paused()&&(document.activeElement===canvas||document.pointerLockElement===canvas);
  document.addEventListener('keydown',event=>{
   if(!active()||event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement)return;
   if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','Space','KeyR'].includes(event.code)){event.preventDefault();keys.add(event.code);}
   if(event.repeat)return;
   if(event.code==='KeyC'){cruise=cruise?0:1;ui.notice(cruise?'Cruise enabled. Brake or press C to cancel.':'Cruise cancelled.');}
   if(/^Digit[1-4]$/.test(event.code)){const index=Number(event.code.slice(-1))-1,snapshot=hooks.query(),friend=snapshot.vehicles.filter(v=>v.faction===snapshot.playerFaction)[index];if(friend){release();submit({kind:'control',entityId:friend.id});}}
  },{signal:lifecycle.signal});
  document.addEventListener('keyup',event=>{keys.delete(event.code);},{signal:lifecycle.signal});
  canvas.addEventListener('pointerdown',event=>{
   if(hooks.paused())return;canvas.focus();
   if(event.button===2){rightDrag=true;canvas.setPointerCapture(event.pointerId);return;}
   if(event.button!==0)return;
   if(document.pointerLockElement!==canvas){try{const requested=canvas.requestPointerLock();if(requested&&typeof (requested as Promise<void>).catch==='function')void (requested as Promise<void>).catch(()=>ui.notice('Mouse capture unavailable. Hold the right mouse button to aim.'));}catch{ui.notice('Mouse capture unavailable. Hold the right mouse button to aim.');}return;}
   mouseFire=true;
  },{signal:lifecycle.signal});
  document.addEventListener('pointerup',event=>{if(event.button===0)mouseFire=false;if(event.button===2)rightDrag=false;},{signal:lifecycle.signal});
  canvas.addEventListener('contextmenu',event=>event.preventDefault(),{signal:lifecycle.signal});
  document.addEventListener('pointermove',event=>{
   if(hooks.paused()||(!rightDrag&&document.pointerLockElement!==canvas))return;
   const multiplier=camera.mode==='chase'?1:camera.mode==='gunner'?.5:.3;
   camera.yaw-=event.movementX*.002*camera.sensitivity*multiplier;camera.pitch=Math.max(-.3,Math.min(.45,camera.pitch-event.movementY*.002*camera.sensitivity*multiplier));
  },{signal:lifecycle.signal});
  document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas){release();if(!hooks.paused())ui.screen('pause');}},{signal:lifecycle.signal});
  window.addEventListener('blur',()=>{release();if(!hooks.paused())ui.screen('pause');},{signal:lifecycle.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){release();if(!hooks.paused())ui.screen('pause');}},{signal:lifecycle.signal});
  const deadzone=(value:number)=>Math.abs(value)<.15?0:Math.sign(value)*Math.pow((Math.abs(value)-.15)/.85,1.5);
  function update(snapshot:LWArmoredRuntime.Snapshot,seconds:number):void {
   if(controlled!==snapshot.controlled){reset();controlled=snapshot.controlled;lastDrive='';lastAim='';const tank=snapshot.vehicles.find(v=>v.id===controlled);if(tank){camera.yaw=tank.weapon.turretYaw;camera.pitch=tank.weapon.elevation;}}
   if(hooks.paused()){if(keys.size||mouseFire||lastFire||cruise)release();return;}
   let throttle=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),steer=(keys.has('KeyA')?1:0)-(keys.has('KeyD')?1:0),brake=keys.has('Space')?1:0;
   camera.yaw+=((keys.has('KeyQ')?1:0)-(keys.has('KeyE')?1:0))*seconds*.65*camera.sensitivity;
   camera.pitch+=((keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0))*seconds*.2*camera.sensitivity;
   const pad=Array.from(navigator.getGamepads?.()??[]).find(Boolean);
   if(pad){
    throttle-=deadzone(pad.axes[1]??0);steer-=deadzone(pad.axes[0]??0);camera.yaw-=deadzone(pad.axes[2]??0)*seconds*1.4;camera.pitch-=deadzone(pad.axes[3]??0)*seconds*.5;
    brake=Math.max(brake,pad.buttons[6]?.value??0);gamepadFire=(pad.buttons[7]?.value??0)>.5;
    if(pad.buttons[9]?.pressed&&!lastButtons[9]){release();ui.screen('pause');return;}
    if(pad.buttons[3]?.pressed&&!lastButtons[3])ui.setCamera(camera.mode==='chase'?'gunner':'chase');
    lastButtons=pad.buttons.map(b=>b.pressed);
   }else gamepadFire=false;
   if(brake||throttle<0)cruise=0;
   camera.pitch=Math.max(-.3,Math.min(.45,camera.pitch));
   const drive={kind:'drive',entityId:controlled,throttle:Math.max(-1,Math.min(1,throttle)),steer:Math.max(-1,Math.min(1,steer)),brake,cruise};
   const driveKey=JSON.stringify(drive);if(lastDrive!==driveKey){submit(drive);lastDrive=driveKey;}
   const vehicle=snapshot.vehicles.find(v=>v.id===controlled),definition=catalog.vehicles.find(v=>v.id===vehicle?.definition);
   const aim={kind:'aim',entityId:controlled,yaw:Math.atan2(Math.sin(camera.yaw),Math.cos(camera.yaw)),elevation:Math.max(definition?.minElevation??-.1,Math.min(definition?.maxElevation??.3,camera.pitch))};
   const aimKey=JSON.stringify(aim);if(lastAim!==aimKey){submit(aim);lastAim=aimKey;}
   const fire=camera.mode!=='binocular'&&(mouseFire||keys.has('KeyR')||gamepadFire);
   if(lastFire!==fire){submit({kind:'fire',entityId:controlled,pressed:fire});lastFire=fire;}
  }
  return {update,release,reset,destroy(){release();lifecycle.abort();}};
 }
 root.LWArmoredControls={create};
})(typeof globalThis!=='undefined'?globalThis:this);
