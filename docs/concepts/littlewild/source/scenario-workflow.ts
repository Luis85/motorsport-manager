/// <reference path="./workflow-venue-contracts.d.ts" />
/// <reference path="./application-records.d.ts" />
/* Authored roles connect completed quest facts to customer demand. Physical tasks own every transfer. */
(function(inputRoot:unknown){
 'use strict';
 interface Role {id:string;label:string;actorId:string;}
 interface Deal {id:string;questId:string;salesRole:string;fulfillmentRole:string;item:string;amount:number;cooldown:number;venueBuildingId:string|null;}
 interface Supply {roleId:string;item:string;target:number;orderType:'gather'|'craft';}
 interface CustomerOrder {id:string;dealId:string;fact:string;item:string;amount:number;actorId:string;created:number;saleId:string|null;status:'waiting-stock'|'fulfilling'|'shipped'|'cancelled';shippedAt:number|null;}
 interface Workflow {activities?:Record<string,{label:string;reason:string;thought:string}>;schemaVersion:1;roles:Role[];deals:Deal[];supply:Supply[];nextDealAt:Record<string,number>;seen:string[];orders:CustomerOrder[];sequence:number;}
 interface Actor extends LWApplication.Actor {questHistory:LWApplication.QuestReport[];}
 interface State {scenarioWorkflow?:Workflow;simTime:number;buildings:LWApplication.Building[];colony:{creatures:Actor[]};market:{orders:LWApplication.Sale[];history:{id:string;actorId:string}[]};}
 interface Engine {s:State;creatures:Actor[];actor:Actor;stepWorld(dt:number):void;totalStock(item:string):number;withActor<T>(actor:Actor,work:()=>T):T;request(type:string,id:string,amount:number):{ok:boolean};addOffer(questId:string,source:string):void;acceptQuest(id:string):{ok:boolean};sellItem(item:string,amount:number,actorId:string):{ok:boolean;order?:{id:string}};gameSettings():{quests:boolean};log(text:string,icon:string):void;handlers():Record<string,()=>string>;at(point:LWApplication.Point):boolean;startTask(task:Partial<LWApplication.Task>):boolean;returnQuest():boolean;}
 interface Constructor extends Function {prototype:Record<string,unknown>;import(input:unknown):unknown;}
 const root=inputRoot as {LWWorkflowVenues:LWWorkflowVenue.Api;LWContent:LWContentPorts.ContentApi;LWAdventure:LWContentPorts.AdventureApi;LWScenarioWorkflow?:typeof api;};
 const C=root.LWContent,A=root.LWAdventure;
 const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const fail=(message:string):never=>{throw Error('Scenario workflow: '+message);};
 const integer=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
 const time=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1e12;
 const text=(value:unknown,max=100):value is string=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[<>\x00-\x1f]/.test(value);
 function fields(input:unknown,keys:string[],label:string):Record<string,unknown>{if(!record(input)||Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k)))return fail(label+' has missing or unknown fields');return input;}
 function list(input:unknown,max:number,label:string):unknown[]{if(!Array.isArray(input)||input.length>max)return fail(label+' exceeds supported length');return input;}
 function validate(input:unknown,state:State):Workflow|undefined{
  if(input===undefined)return undefined;
  const value=fields(input,['schemaVersion','roles','deals','supply','nextDealAt','seen','orders','sequence',...(record(input)&&input.activities!==undefined?['activities']:[])],'state');
  if(value.schemaVersion!==1||!integer(value.sequence,1,1e9))return fail('unsupported version or sequence');
  if(value.activities!==undefined){if(!record(value.activities)||Object.keys(value.activities).length>32)return fail('invalid activity vocabulary');for(const [kind,entry]of Object.entries(value.activities)){if(!/^[a-z][a-z-]{0,50}$/.test(kind))return fail('invalid activity kind');const a=fields(entry,['label','reason','thought'],'activity');if(!text(a.label,180)||!text(a.reason,300)||!text(a.thought,180))return fail('invalid activity text');}}
  const roles=new Map<string,string>();
  for(const entry of list(value.roles,16,'roles')){
   const role=fields(entry,['id','label','actorId'],'role');
   if(!text(role.id,64)||!text(role.label)||!text(role.actorId)||roles.has(role.id)||!state.colony.creatures.some(c=>c.id===role.actorId))return fail('invalid or duplicate role');
   roles.set(role.id,role.actorId);
  }
  const deals=new Map<string,Record<string,unknown>>();
  for(const entry of list(value.deals,16,'deals')){
   const d=fields(entry,['id','questId','salesRole','fulfillmentRole','item','amount','cooldown','venueBuildingId'],'deal');
   if(!text(d.id,64)||deals.has(d.id)||!text(d.questId)||!A.content.quests.some(q=>q.id===d.questId)||!text(d.salesRole)||!roles.has(d.salesRole)||!text(d.fulfillmentRole)||!roles.has(d.fulfillmentRole)||!text(d.item)||!C.tables.RES[d.item]||!integer(d.amount,1,99)||!time(d.cooldown)||d.cooldown<1)return fail('invalid deal references or quantity');
   if(d.venueBuildingId!==null&&!state.buildings.some(b=>b.id===d.venueBuildingId))return fail('deal workstation missing');
   deals.set(d.id,d);
  }
  const supplies=new Set<string>();
  for(const entry of list(value.supply,32,'supply')){
   const s=fields(entry,['roleId','item','target','orderType'],'supply');
   if(!text(s.roleId)||!roles.has(s.roleId)||!text(s.item)||!C.tables.RES[s.item]||!integer(s.target,1,99)||!['gather','craft'].includes(String(s.orderType))||supplies.has(s.roleId+':'+s.item))return fail('invalid supply rule');
   if(s.orderType==='craft'&&!C.tables.RECIPES[s.item])return fail('craft supply needs a recipe');
   supplies.add(s.roleId+':'+s.item);
  }
  if(!record(value.nextDealAt)||Object.keys(value.nextDealAt).length!==deals.size||[...deals.keys()].some(id=>!time((value.nextDealAt as Record<string,unknown>)[id])))return fail('invalid deal scheduling');
  const seen=list(value.seen,256,'seen');if(seen.some(id=>!text(id,160))||new Set(seen).size!==seen.length)return fail('invalid completed quest markers');
  const ids=new Set<string>(),facts=new Set<string>();let maxId=0;
  for(const entry of list(value.orders,104,'orders')){
   const o=fields(entry,['id','dealId','fact','item','amount','actorId','created','saleId','status','shippedAt'],'customer order');
   const d=typeof o.dealId==='string'?deals.get(o.dealId):undefined;
   if(!text(o.id)||!/^customer-[1-9]\d*$/.test(o.id)||ids.has(o.id)||!text(o.fact,160)||facts.has(o.fact)||!seen.includes(o.fact)||!d||o.item!==d.item||o.amount!==d.amount||o.actorId!==roles.get(String(d.fulfillmentRole))||!time(o.created)||o.created>state.simTime||!['waiting-stock','fulfilling','shipped','cancelled'].includes(String(o.status)))return fail('invalid customer order');
   ids.add(o.id);facts.add(o.fact);maxId=Math.max(maxId,Number(o.id.slice(9)));
   if(o.saleId!==null){const sale=state.market.orders.find(s=>s.id===o.saleId);if(!sale||sale.item!==o.item||sale.amount!==o.amount||sale.assignedId!==o.actorId)return fail('customer order physical sale does not match');if(o.status==='shipped'&&sale.status!=='done')return fail('shipment needs a completed physical sale');}
   else if(o.status!=='waiting-stock')return fail('customer order needs its physical sale');
   if(o.status==='shipped'?!time(o.shippedAt)||o.shippedAt>state.simTime||o.shippedAt<o.created:o.shippedAt!==null)return fail('invalid shipment time');
  }
  if(value.sequence<=maxId)return fail('customer order sequence collision');
  return C.copy(input) as Workflow;
 }
 const actorFor=(e:Engine,w:Workflow,id:string):Actor|undefined=>e.creatures.find(c=>c.id===w.roles.find(r=>r.id===id)?.actorId);
 function step(e:Engine):void{
  const w=e.s.scenarioWorkflow;if(!w)return;
  for(const deal of w.deals){
   const sales=actorFor(e,w,deal.salesRole),fulfillment=actorFor(e,w,deal.fulfillmentRole);if(!sales||!fulfillment)continue;
   for(const q of [...sales.questHistory].reverse()){
    if(q.questId!==deal.questId||q.aborted||q.successes<q.required)continue;
    const fact=sales.id+':'+deal.id+':'+Math.round(q.started*1000);
    if(w.seen.includes(fact)||w.orders.filter(o=>!['shipped','cancelled'].includes(o.status)).length>=64)continue;
    w.seen.push(fact);w.orders.push({id:'customer-'+w.sequence++,dealId:deal.id,fact,item:deal.item,amount:deal.amount,actorId:fulfillment.id,created:e.s.simTime,saleId:null,status:'waiting-stock',shippedAt:null});
    e.log(sales.name+' won a deal: '+deal.amount+' '+C.tables.RES[deal.item]!.name+' for '+fulfillment.name+' to fulfill.','market');
   }
   if(e.gameSettings().quests&&e.s.simTime>=w.nextDealAt[deal.id]!&&!sales.activeQuest&&!sales.questPlan){
    e.withActor(sales,()=>{e.addOffer(deal.questId,'Customer opportunity');const board=(e.s.colony as State['colony']&{board:{offers:{id:string;questId:string}[]}}).board;const offer=board.offers.find(o=>o.questId===deal.questId);if(offer&&e.acceptQuest(offer.id).ok)w.nextDealAt[deal.id]=e.s.simTime+deal.cooldown;});
   }
  }
  for(const supply of w.supply){
   const actor=actorFor(e,w,supply.roleId);if(!actor||actor.activeQuest||actor.orders.some(o=>o.resource===supply.item)||e.totalStock(supply.item)>=supply.target)continue;
   e.withActor(actor,()=>e.request(supply.orderType,supply.item,Math.max(1,Math.min(12,supply.target-e.totalStock(supply.item)))));
  }
  for(const o of w.orders){
   if(o.status==='waiting-stock'){
    const result=e.sellItem(o.item,o.amount,o.actorId);if(result.ok&&result.order){o.saleId=result.order.id;o.status='fulfilling';}
   }else if(o.status==='fulfilling'){
    const sale=e.s.market.orders.find(s=>s.id===o.saleId);
    if(sale?.status==='done'){o.status='shipped';o.shippedAt=e.s.simTime;e.log('Customer order '+o.id+' shipped by '+e.creatures.find(c=>c.id===o.actorId)!.name+'.','market');}
    else if(sale?.status==='cancelled')o.status='cancelled';
   }
  }
  // Completed facts retain every live demand marker and each actor's bounded recent history.
  const pending=w.orders.filter(o=>!['shipped','cancelled'].includes(o.status)),history=w.orders.filter(o=>['shipped','cancelled'].includes(o.status)).slice(-40);
  w.orders=[...history,...pending];const required=new Set(w.orders.map(o=>o.fact));w.seen=[...w.seen.filter(f=>!required.has(f)).slice(-(256-required.size)),...required];
 }
 function install(Engine:Constructor):void{
  const p=Engine.prototype,world=p.stepWorld as Engine['stepWorld'],importer=Engine.import,handlers=p.handlers as Engine['handlers'],returnQuest=p.returnQuest as Engine['returnQuest'];
  const venue=(e:Engine,questId:string|undefined)=>e.s.buildings.find(b=>b.id===root.LWWorkflowVenues.buildingId(e.s,e.actor.id,questId));
  p.handlers=function(this:Engine):Record<string,()=>string>{const h=handlers.call(this),quest=h.quest!;h.quest=()=>{const station=venue(this,this.actor.questPlan?.questId);if(station&&!this.at(station))return this.startTask({kind:'idle',target:station,duration:1,label:'Preparing a customer call',reason:'This opportunity needs its assigned workstation.',thought:'I will meet the customer from my desk.'})?'running':'failure';return quest();};return h;};
  p.returnQuest=function(this:Engine):boolean{const station=venue(this,this.actor.activeQuest?.questId),position=station?{x:this.actor.creature.x,y:this.actor.creature.y}:null,result=returnQuest.call(this);if(result&&position)Object.assign(this.actor.creature,position);return result;};
  const startTask=p.startTask as Engine['startTask'];p.startTask=function(this:Engine,task:Partial<LWApplication.Task>):boolean{const vocabulary=this.s.scenarioWorkflow?.activities?.[task.kind||''];if(vocabulary)Object.assign(task,vocabulary);return startTask.call(this,task);};
  p.stepWorld=function(this:Engine,dt:number):void{
   const references=new Set(this.s.scenarioWorkflow?.orders.map(o=>o.saleId).filter(id=>id!==null)||[]);
   const retained=this.s.market.orders.filter(s=>references.has(s.id));world.call(this,dt);
   // The bounded workflow history keeps its original physical shipment authority.
   for(const sale of retained)if(!this.s.market.orders.some(s=>s.id===sale.id))this.s.market.orders.push(sale);
   step(this);
  };
  Engine.import=function(input:unknown):unknown{
   const doc=C.parse(input,12*1024*1024) as {state:State};
   if(doc?.state)validate(doc.state.scenarioWorkflow,doc.state);
   return Reflect.apply(importer,this,[doc]);
  };
 }
 const api=Object.freeze({validate,step,install});root.LWScenarioWorkflow=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
