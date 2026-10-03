/// <reference path="./balancing-contracts.d.ts" />
/// <reference path="./engine-core-contracts.d.ts" />
/* Read-only skill and workplace rates, evaluated from each engine's captured balancing profile. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWContent:LWContentPorts.ContentApi;LWSkillWorkRates?:{upgradeEffect(engine:LWCorePorts.SystemsEngine,building:LWApplication.Building,level:number):string;stationBonus(engine:LWCorePorts.SystemsEngine,kind:string):number;learningRate(engine:LWCorePorts.SystemsEngine,style?:string):number;workRate(engine:LWCorePorts.SystemsEngine,task:LWCorePorts.Task,baseRate:number):number}};
 const B=(typeof module!=='undefined'&&module.exports?require('./balancing-rules.js'):(globalThis as unknown as {LWBalanceRules:LWBalanceRules.Api}).LWBalanceRules) as LWBalanceRules.Api;
 const C=(typeof module!=='undefined'&&module.exports?require('./content-runtime.js'):root.LWContent) as LWContentPorts.ContentApi;
 const {SKILLS,RECIPES,STYLES,BUILDINGS}=C.tables;
 function stationBonus(engine:LWCorePorts.SystemsEngine,kind:string){const b=engine.s.buildings.find(b=>b.kind===kind);if(!b)return 0;let bonus=((b.level||1)-1)*B.forEngine(engine).work.stationPerLevel+Math.max(0,(b.quality??B.forEngine(engine).work.qualityBaseline)-B.forEngine(engine).work.qualityBaseline)/B.forEngine(engine).work.qualityDivisor;
  if(engine.s.buildings.some(x=>x.kind==='storehouse'&&Math.abs(x.x-b.x)+Math.abs(x.y-b.y)<=B.forEngine(engine).work.supportRadius))bonus+=B.forEngine(engine).work.storehouseBonus;
  if(engine.s.buildings.some(x=>x.kind==='waterwheel'&&Math.abs(x.x-b.x)+Math.abs(x.y-b.y)<=B.forEngine(engine).work.supportRadius))bonus+=B.forEngine(engine).work.waterwheelBonus;
  return Math.min(B.forEngine(engine).work.stationCap,bonus);
 }
 function learningRate(engine:LWCorePorts.SystemsEngine,style=engine.s.training?.style||engine.s.learning.style){
  const s=engine.s;return STYLES[style!]!.rate*(1+(engine.has('circle')?B.forEngine(engine).work.circleBonus+B.forEngine(engine).work.circlePerLevel*(engine.buildingLevel('circle')-1):0)+(engine.has('observatory')?B.forEngine(engine).work.observatoryLearningBonus:0)+(engine.specialization('mentor')?B.forEngine(engine).work.mentorLearningBonus:0)+(s.needs.comfort>=B.forEngine(engine).work.comfortableGate?B.forEngine(engine).work.comfortLearningBonus:0));
 }
 function workRate(engine:LWCorePorts.SystemsEngine,t:LWCorePorts.Task,baseRate:number){
  if(t.kind==='train')return engine.learningRate(t.style);
  let rate=baseRate;
  const sk=engine.taskSkill(t),discipline=SKILLS[sk!]!?.discipline;
  if(t.kind==='craft'){
   rate+=engine.stationBonus(RECIPES[t.resource!]!.station);
   if(discipline==='making'&&engine.specialization('maker'))rate+=B.forEngine(engine).work.makerBonus;
   if(discipline==='craft'&&engine.specialization('efficient'))rate+=B.forEngine(engine).work.efficientBonus;
  }
  if(t.kind==='build'&&engine.s.buildings.some(b=>b.kind==='workshop'&&Math.abs(b.x-t.target!.x)+Math.abs(b.y-t.target!.y)<=B.forEngine(engine).work.workshopRadius))rate+=B.forEngine(engine).work.workshopBonus;
  if(t.kind==='practice')rate+=(engine.has('circle')?B.forEngine(engine).work.practiceCircleBonus:0);
  if(t.kind==='explore'&&engine.specialization('explorer'))rate+=B.forEngine(engine).work.explorerBonus;
  if(t.stock&&engine.specialization('steward'))rate+=B.forEngine(engine).work.stewardBonus;
  return Math.min(B.forEngine(engine).work.maximumRate,Math.min(B.forEngine(engine).work.baseRateCap,rate)+(t.kind==='craft'?Math.max(0,engine.buildingLevel('waterwheel')-1)*B.forEngine(engine).work.globalPerLevel:0)+(t.stock?Math.max(0,engine.buildingLevel('storehouse')-1)*B.forEngine(engine).work.globalPerLevel:0));
 }
 function upgradeEffect(engine:LWCorePorts.SystemsEngine,b:LWApplication.Building,level=b.level+1){
  const extra=level-1,cat=BUILDINGS[b!.kind!]!.category;
  if(b.kind==='circle')return 'Lessons: +'+Math.round((B.forEngine(engine).work.circleBonus+extra*B.forEngine(engine).work.circlePerLevel)*100)+'% speed. Practice: +'+level+' points.';
  if(['garden','grainplot','greenhouse','orchard'].includes(b.kind))return '+'+extra+' harvest yield; '+(extra*B.forEngine(engine).production.cropLevelRate*100)+'% faster regrowth.';
  if(['shelter','cottage'].includes(b.kind))return '+'+(extra*B.forEngine(engine).recovery.homePerLevel)+' energy and comfort per rest.';
  if(b.kind==='study'||b.kind==='observatory')return '+'+extra+' research per experiment.';
  if(b.kind==='well')return '+'+extra+' water per collection.';
  if(b.kind==='market')return '+'+(extra*B.forEngine(engine).production.marketPerLevel*100)+'% shared trade income.';
  if(b.kind==='fire')return '+'+(extra*B.forEngine(engine).recovery.homePerLevel)+' comfort when warming; '+(extra*B.forEngine(engine).work.stationPerLevel*100)+'% station work speed.';
  if(b.kind==='workshop')return (extra*B.forEngine(engine).work.stationPerLevel*100)+'% station work speed, in addition to quality and nearby support.';
  if(b.kind==='storehouse')return '+'+(extra*B.forEngine(engine).work.globalPerLevel*100)+'% extra global reserve-work speed; the '+Math.round(B.forEngine(engine).work.storehouseBonus*100)+'% nearby station bonus remains.';
  if(b.kind==='waterwheel')return '+'+(extra*B.forEngine(engine).work.globalPerLevel*100)+'% extra global crafting speed; the '+Math.round(B.forEngine(engine).work.waterwheelBonus*100)+'% nearby station bonus remains.';
  return (extra*B.forEngine(engine).work.stationPerLevel*100)+'% station work speed, in addition to quality and nearby support.';
 }
 const api=Object.freeze({upgradeEffect,stationBonus,learningRate,workRate});root.LWSkillWorkRates=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
