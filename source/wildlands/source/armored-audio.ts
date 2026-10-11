/// <reference path="./armored-presentation-contracts.d.ts" />
/** Original synthesized placeholder soundscape, activated only by an explicit user gesture. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWArmoredAudio?:unknown};
 function create():LWArmoredPresentation.Audio {
  let context:AudioContext|null=null,engine:OscillatorNode|null=null,gain:GainNode|null=null,filter:BiquadFilterNode|null=null,lastTick=-1;
  const heard=new Set<string>();
  function activate():void {
   if(!context){
    context=new AudioContext();engine=context.createOscillator();gain=context.createGain();filter=context.createBiquadFilter();
    engine.type='sawtooth';engine.frequency.value=38;filter.type='lowpass';filter.frequency.value=180;gain.gain.value=0;
    engine.connect(filter);filter.connect(gain);gain.connect(context.destination);engine.start();
   }
   void context.resume().catch(()=>{});
  }
  function shot():void {
   if(!context)return;const audio=context,now=audio.currentTime,buffer=audio.createBuffer(1,audio.sampleRate*.6,audio.sampleRate),data=buffer.getChannelData(0);
   let seed=3927;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=((seed>>>0)/2147483648-1)*Math.exp(-i/data.length*7);}
   const source=audio.createBufferSource(),low=audio.createBiquadFilter(),volume=audio.createGain();source.buffer=buffer;low.type='lowpass';low.frequency.value=750;volume.gain.setValueAtTime(.35,now);volume.gain.exponentialRampToValueAtTime(.001,now+.6);
   source.connect(low);low.connect(volume);volume.connect(audio.destination);source.start();source.onended=()=>{source.disconnect();low.disconnect();volume.disconnect();};
  }
  return {activate,render(snapshot,paused){
   if(!context||!engine||!gain||!filter)return;
   const vehicle=snapshot.vehicles.find(v=>v.id===snapshot.controlled),speed=vehicle?Math.hypot(vehicle.body.velocity.x,vehicle.body.velocity.z):0;
   const now=context.currentTime;engine.frequency.setTargetAtTime(34+speed*4,now,.12);filter.frequency.setTargetAtTime(100+speed*25,now,.2);gain.gain.setTargetAtTime(paused?0:.025+Math.min(speed/500,.045),now,.12);
   if(snapshot.tick<lastTick)heard.clear();lastTick=snapshot.tick;
   for(const event of snapshot.events){const id=`${event.tick}:${event.sequence}:${event.kind}:${event.entityId??event.source??''}`;if(heard.has(id))continue;heard.add(id);if(event.kind==='shot'||event.kind==='fire')shot();}
   if(heard.size>1024)heard.clear();
  },destroy(){engine?.stop();void context?.close();context=null;engine=null;gain=null;filter=null;}};
 }
 root.LWArmoredAudio={create};
})(typeof globalThis!=='undefined'?globalThis:this);
