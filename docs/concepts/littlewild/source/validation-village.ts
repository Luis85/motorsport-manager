/* Additional v10 integrity checks: bounded data, claims and physical navigation.
 * Validation never repairs a save or changes an active story. */
(function(inputRoot: unknown){
 'use strict';

 interface Point { x:number; y:number; }
 interface PlannerHistory { time:number; key:string; name:string; action:string; actorId?:string; }
 interface InteractionEvent { id:string; created:number; expires:number; trigger:string; }
 interface Creature {
  id:string;
  activeQuest?:unknown;
  creature:Point;
  inventory:Record<string,number>;
  interactionCooldowns:Record<string,number>;
  eventInteractions:InteractionEvent[];
 }
 interface Building extends Point {
  kind:string;
  door?:{dx:number;dy:number};
  marketInventory?:Record<string,number>;
 }
 interface MarketOrder {
  transit:Record<string,number>;
  staged:Record<string,number>;
  created:number;
  status:string;
  sold:number;
  amount:number;
  remaining:number;
  item:string;
 }
 interface MarketReceipt { id:string; item:string; amount:number; coins:number; time:number; actorId:string; }
 interface VillageState {
  progression:{interactionSequence:number};
  planning:{controls:Record<string,Record<string,unknown>>;history:PlannerHistory[]};
  colony:{creatures:Creature[]};
  simTime:number;
  buildings:Building[];
  market:{orders:MarketOrder[];history:MarketReceipt[]};
  [key:string]:unknown;
 }
 interface GridLike { readonly cells:{size:number}; pass(x:number,y:number):boolean; flood(start:Point):Set<string>; }
 interface GeographyApi { grid(state:VillageState):GridLike; }
 interface GrowthApi { content:{interactions:Array<{id:string}>;rules:{marketCapacity:number}}; }
 interface LittlewildFacade {
  Village:{indoor:Set<string>};
  colony:{item(id:string):unknown};
 }
 interface VillageValidationApi { validate(input:unknown):void; }
 interface LittlewildRoot { LWGeography?:GeographyApi; LWGrowth?:GrowthApi; LW?:LittlewildFacade; LWVillageValidation?:VillageValidationApi; }
 const root=inputRoot as LittlewildRoot;

 const dict=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const whole=(value:unknown,low:number,high:number):value is number=>Number.isSafeInteger(value)&&typeof value==='number'&&value>=low&&value<=high;
 const safeText=(value:unknown):value is string=>typeof value==='string'&&value.length<=240&&!/[<>\x00-\x1f]/.test(value);
 function validate(input:unknown):void{
  function fail(message:string):never{throw Error('Village save: '+message);}
  if(!dict(input))fail('invalid root state');
  const s=input as unknown as VillageState;
  const G=root.LWGeography,C=root.LWGrowth,L=root.LW;
  if(!G||!C||!L)throw Error('Village validation dependencies are missing.');
  const p=s.progression,creatures=s.colony?.creatures,events=new Set<string>();
  if(!p||!Array.isArray(creatures)||!Array.isArray(s.buildings)||!s.market)fail('invalid root state');
  let largest=0;
  if(!dict(s.planning)||!dict(s.planning.controls)||Object.keys(s.planning.controls).length>4000||!Array.isArray(s.planning.history)||s.planning.history.length>60)fail('invalid planner state');
  for(const [key,value] of Object.entries(s.planning.controls)){
   if(!/^(order|lesson|outfit|quest|social|unpack|activity):[\w:.-]{1,160}$/.test(key)||!dict(value))fail('invalid planner control');
   for(const [field,n] of Object.entries(value)){
    if(field==='priority'?!whole(n,0,2):!['paused','stopped'].includes(field)||typeof n!=='boolean')fail('invalid planner policy');
   }
  }
  for(const history of s.planning.history){
   if(!dict(history)||!Number.isFinite(history.time)||!safeText(history.key)||!safeText(history.name)||!safeText(history.action)||
      (history.actorId!==undefined&&!creatures.some(creature=>creature.id===history.actorId)))fail('invalid planner history');
  }
  for(const creature of creatures){
   if(!dict(creature.interactionCooldowns)||Object.keys(creature.interactionCooldowns).length>100)fail('invalid interaction cooldowns');
   for(const [id,until] of Object.entries(creature.interactionCooldowns)){
    if(!C.content.interactions.some(definition=>definition.id===id)||!Number.isFinite(until)||until<0||until>s.simTime+86400)fail('invalid interaction cooldown');
   }
   if(!Array.isArray(creature.eventInteractions))fail('invalid temporary interaction');
   for(const event of creature.eventInteractions){
    if(!dict(event)||typeof event.id!=='string'||!/^event-[1-9]\d*$/.test(event.id)||events.has(event.id)||
       !Number.isFinite(event.created)||event.created<0||event.created>s.simTime+.001||!Number.isFinite(event.expires)||
       event.expires<event.created||event.expires-event.created>86400||!safeText(event.trigger))fail('invalid temporary interaction');
    events.add(event.id);largest=Math.max(largest,Number(event.id.slice(6)));
   }
  }
  if(p.interactionSequence<=largest)fail('event sequence collision');
  const grid=G.grid(s);
  for(const building of s.buildings){
   if(L.Village.indoor.has(building.kind)&&(!building.door||!grid.pass(building.x+building.door.dx,building.y+building.door.dy)))fail('blocked building doorway');
  }
  const first=creatures.find(creature=>!creature.activeQuest)?.creature||{x:9,y:9};
  if(grid.flood({x:Math.round(first.x),y:Math.round(first.y)}).size!==grid.cells.size)fail('disconnected walking paths');
  const claimed=new Map<string,number>();
  for(const order of s.market.orders){
   if(!dict(order.transit)||!dict(order.staged)||!Number.isFinite(order.created)||order.created<0||order.created>s.simTime+.001)fail('invalid sale claims');
   if(order.status==='done'&&(order.sold!==order.amount||order.remaining||Object.values(order.transit).some(Boolean)||Object.values(order.staged).some(Boolean)))fail('settled sale still has goods');
   if(['cancelling','cancelled'].includes(order.status)&&(order.remaining||Object.values(order.transit).some(Boolean)))fail('cancelled sale still reserves cargo');
   if(order.status==='cancelled'&&Object.values(order.staged).some(Boolean))fail('cancelled sale still has stall goods');
   for(const [id,amount] of Object.entries(order.transit)){
    const key=id+':'+order.item;claimed.set(key,(claimed.get(key)||0)+amount);
   }
  }
  for(const creature of creatures)for(const [key,amount] of claimed){
   if(key.startsWith(creature.id+':')&&amount>(creature.inventory[key.slice(creature.id.length+1)]||0))fail('market orders claim the same carried goods');
  }
  for(const building of s.buildings){
   if(Object.values(building.marketInventory||{}).reduce((sum,value)=>sum+value,0)>C.content.rules.marketCapacity)fail('market stall over capacity');
  }
  const receiptIds=new Set<string>();
  for(const receipt of s.market.history){
   if(!dict(receipt)||!safeText(receipt.id)||receiptIds.has(receipt.id)||!L.colony.item(receipt.item)||!whole(receipt.amount,1,99)||
      !whole(receipt.coins,0,990000)||!Number.isFinite(receipt.time)||receipt.time>s.simTime+.001||!creatures.some(creature=>creature.id===receipt.actorId))fail('invalid market receipt');
   receiptIds.add(receipt.id);
  }
 }
 const api:VillageValidationApi=Object.freeze({validate});
 root.LWVillageValidation=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
