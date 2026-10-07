/// <reference path="./balancing-contracts.d.ts" />
/* Littlewild content and progression layer.
 * The core engine still owns pathfinding, needs, time and movement. This module
 * adds paid learning queues, practical mastery, field evidence, production chains
 * and staged construction through explicit simulation hooks. No DOM or I/O.
 */
/// <reference path="./engine-core-contracts.d.ts" />
(function (inputRoot:unknown) {
 const B = (typeof module!=='undefined'&&module.exports?require('./balancing-rules.js'):(globalThis as unknown as {LWBalanceRules:LWBalanceRules.Api}).LWBalanceRules) as LWBalanceRules.Api;
'use strict';
const root=inputRoot as LWCorePorts.Root & {LW:LWCorePorts.Facade;LWWorldProfile:{current:{nodePolicy?:string}}};
const Work=(typeof module!=='undefined'&&module.exports?require('./systems-work-rates.js'):(globalThis as unknown as {LWSkillWorkRates:unknown}).LWSkillWorkRates) as {upgradeEffect(engine:LWCorePorts.SystemsEngine,building:LWApplication.Building,level:number):string;stationBonus(engine:LWCorePorts.SystemsEngine,kind:string):number;learningRate(engine:LWCorePorts.SystemsEngine,style?:string):number;workRate(engine:LWCorePorts.SystemsEngine,task:Task,baseRate:number):number};
const Completions=(typeof module!=='undefined'&&module.exports?require('./systems-completions.js'):(globalThis as unknown as {LWSkillCompletions:unknown}).LWSkillCompletions) as {finish(engine:LWCorePorts.SystemsEngine,t:Task,finishBase:(task:Task)=>void):void};
type Order=LWCorePorts.Order;
type OrderView=LWCorePorts.OrderView;
type Task=LWCorePorts.Task;
type Draft=LWCorePorts.Draft;
type Issue=LWCorePorts.Issue;
type Numbers=LWCorePorts.Numbers;
const L = root.LW, Composition = L.EngineComposition;
const {clamp, terrain, SIZE} = L;
const {SKILLS, BUILDINGS, RES, RECIPES, DISCIPLINES, DRILLS, STYLES, APPROACHES, SPECIALIZATIONS, STUDIES, PATHS} = root.LWContent.tables;
const own = (o:object,k:unknown):k is string => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o,k);
const clone = <T>(o:T):T => root.LWContent.copy(o);
const fail = (reason:string):{ok:false;reason:string} => ({ok:false,reason});
const CATEGORY_NAMES={all:'Everything',home:'Home & hearth',workshops:'Workshops',growing:'Food & growing',learning:'Learning',community:'Community'};
const RAW_SKILLS:Record<string,string>={wood:'woodcraft',stone:'stonework',meat:'tracking',clay:'claywork',ore:'metalwork',herbs:'herbalism',grain:'gardening'};
const RAW = ['wood','stone','fiber','berries','water','clay','ore','herbs','grain'];
const CROP_RES:Record<string,string>={garden:'berries',grainplot:'grain',greenhouse:'herbs',orchard:'berries'};
const PHASE_NAMES=['Lay the groundwork','Raise the structure','Make it a place'];
const COST_GROUPS=[['stone','clay','bricks'],['wood','planks','beams','iron','rope'],['fiber','cloth','glass','tools','pots','water']];
const finite=(v:unknown,min:number,max:number,label:string,integer=false):number=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))throw Error('Invalid '+label+'.');return v;};
function initializeSystems(self:LWCorePorts.SystemsEngine):void{
  const s=self.s;s.version=3;
  if(!s.colony){
   if(!s.archetype||!s.personality||!s.inventory||!s.stockTargets)throw Error('Fresh actor state is incomplete.');
   for(const id of Object.keys(RES)){s.inventory[id!]!??=0;s.stockTargets[id!]!??=0;}
   if(s.training){s.training!.style! ||= 'together';s.training.tuition ??= SKILLS[s.training.id]!.coins;}
  }
  for(const b of s.buildings){b.level??=1;b.quality??=60;}
  if(root.LWWorldProfile.current.nodePolicy!=='profile-only')self.addResourceNodes();
}
function defineLayer(BaseEngine:new()=>LWCorePorts.BaseEngine):new()=>LWCorePorts.SystemsEngine{return class SystemsLayer extends BaseEngine {
 addResourceNodes(){
  const s=this.s,candidates:[number,number][]=[[12,5],[12,6],[17,8],[14,10],[4,14],[6,12],[4,3],[10,4],[15,11],[9,15],[4,8],[11,12],[6,6],[3,9],[14,14],[5,13]];
  for(let y=2;y<17;y++)for(let x=2;x<17;x++)candidates.push([x,y]);
  for(const kind of ['clay','ore','herbs','grain'])for(let i=0;i<2;i++){
   const id='v3-'+kind+'-'+i;if(s.nodes.some(n=>n.id===id))continue;
   const p=candidates.find(([x,y])=>terrain(x,y)==='grass'&&!s.nodes.some(n=>n.x===x&&n.y===y)&&!s.buildings.some(b=>b.x===x&&b.y===y)&&!s.orders.some(o=>o.type==='build'&&o.x===x&&o.y===y));
   if(p)s.nodes.push({id,kind,x:p[0],y:p[1],stock:kind==='ore'?8:10,max:kind==='ore'?8:10,regen:0});
  }
 }
 buildingLevel(kind:string){const b=this.s.buildings.find(b=>b.kind===kind);return b?(b.level||1):0;}
 specialization(id:string){return Object.values(this.s.specializations).includes(id);}
 stationBonus(kind:string){return Work.stationBonus(this,kind);}
 learningRate(style?:string){return Work.learningRate(this,style);}
 override workRate(t:Task){return Work.workRate(this,t,super.workRate(t));}
 override taskSkill(t:Task):string|null|undefined{
  if(t.kind==='practice')return t.skillId;
  if(t.kind==='build'){const o=this.s.orders.find(o=>o.id===t.orderId);return o?this.constructionSkill(o):null;}
  if(t.kind==='gather')return RAW_SKILLS[t.resource!]||(t.nodeId?.startsWith('crop:')?'gardening':null);
  return super.taskSkill(t);
 }
 override practiceSkill(id:string|null|undefined,amount=1){if(!own(SKILLS,id)||!this.s.skills[id])return;for(let i=0;i<amount;i++)super.practiceSkill(id);}
 lessonIssue(id:string){
  const k=own(SKILLS,id)?SKILLS[id!]!:null,s=this.s;if(!k)return {text:'Unknown lesson.'};
  if(s.skills[id])return null;
  if(s.player.level<k.tier)return {text:'Reach guide level '+k.tier+'.'};
  const req=k.requires.find(r=>!s.skills[r]);if(req)return {text:'First teach '+SKILLS[req!]!.short+'.',skill:req};
  if(k.practical&&this.mastery(k.practical.skill).points<k.practical.points)return {text:'Practice '+SKILLS[k.practical.skill!]!.short+' to '+k.practical.points+' points.',practice:k.practical.skill};
  return null;
 }
 override research(id:string){const issue=this.lessonIssue(id);if(issue)return fail(issue.text);return super.research(id);}
 override teach(id:string){
  const s=this.s,k=own(SKILLS,id)?SKILLS[id!]!:null;if(!k)return fail('Unknown lesson.');
  if(s.skills[id]||s.training?.id===id||s.learning.queue.some(t=>t.id===id))return fail('This lesson is already learned or in the learning plan.');
  const issue=this.lessonIssue(id);if(issue)return fail(issue.text);
  if(!s.researched[id])return fail('Research this lesson first.');
  if(s.learning.queue.length+(s.training?1:0)>=4)return fail('Four lessons are enough to hold in mind. Finish or remove one first.');
  if(s.player.coins<k.coins)return fail('Need '+k.coins+' guide coins for this lesson.');
  const settlement=this.settleEconomy({id:this.economySettlementId('lesson-plan',id),guide:-k.coins},'Lesson: '+k.short);if(!settlement.ok)return fail('The lesson cost could not be settled.');
  const lesson={id,progress:0,style:s.learning.style,tuition:k.coins};
  if(!s.training)s.training=lesson;else s.learning.queue.push(lesson);
  this.log('A '+k.short+' lesson joins our plan: '+STYLES[lesson.style!]!.name.toLowerCase()+'.','book');return {ok:true};
 }
 cancelLesson(id:string){
  const s=this.s;let t=s.training?.id===id?s.training:s.learning.queue.find(t=>t.id===id);if(!t)return fail('That lesson is no longer queued.');
  const refund=t.progress===0?t.tuition:0;
  if(refund){const settlement=this.settleEconomy({id:this.economySettlementId('lesson-refund',id),guide:refund},'Unused lesson refunded');if(!settlement.ok)return fail('The tuition refund could not be settled.');}
  if(s.training===t){if(s.task?.kind==='train')s.task=null;s.training=s.learning.queue.shift()||null;}
  else s.learning.queue=s.learning.queue.filter(l=>l.id!==id);
  this.log('Set aside '+SKILLS[id!]!.short+'. '+(refund?'Unused tuition returned.':'Teaching already began; tuition is not refunded.'),'book');return {ok:true};
 }
 setLearningStyle(style:string){if(!own(STYLES,style))return fail('Unknown learning style.');this.s.learning.style=style;return {ok:true};}
 pauseLearning(){this.s.learning.paused=!this.s.learning.paused;if(this.s.learning.paused&&this.s.task?.kind==='train')this.s.task=null;return {ok:true};}
 learningPhase(t=this.s.training){if(!t)return null;const p=t.progress/SKILLS[t.id!]!.time;return {index:p<.3?0:p<.8?1:2,label:p<.3?'Watch & understand':p<.8?'Try with our own paws':'Reflect & remember',progress:p};}
 practice(id:string,count=1){
  if(!own(SKILLS,id)||!this.s.skills[id])return fail('Learn this skill before planning a practice session.');
  if(!Number.isInteger(count)||count<1||count>3)return fail('Choose one to three practice sessions.');
  if(this.s.orders.length>=12)return fail('The plan board is full.');
  if(this.s.orders.some(o=>o.type==='practice'&&o.skillId===id))return fail('This practice is already on our plan board.');
  const o={id:'o'+this.s.nextId++,type:'practice',skillId:id,amount:count,done:0,progress:0,paused:false,priority:0,created:this.s.simTime};this.s.orders.push(o);
  this.log('You suggested '+count+' '+SKILLS[id!]!.short.toLowerCase()+' practice '+(count===1?'session':'sessions')+'. Pip can take breaks.','book');return {ok:true,order:o};
 }
 disciplineProgress(id:string){const ids=Object.keys(SKILLS).filter(k=>SKILLS[k!]!.discipline===id);return {learned:ids.filter(k=>this.s.skills[k]).length,total:ids.length,practice:ids.reduce((a,k)=>a+this.mastery(k).points,0)};}
 chooseSpecialization(discipline:string,id:string){
  const list=SPECIALIZATIONS[discipline];if(!list?.some(x=>x.id===id))return fail('Unknown specialization.');
  const p=this.disciplineProgress(discipline),current=this.s.specializations[discipline];if(current===id)return fail('This is already Pip’s specialty.');
  if(p.learned<2||p.practice<12)return fail('Learn two skills in this discipline and earn 12 total practice points.');
  const rp=current?2:4,coins=current?0:18;if(this.s.rp<rp||this.s.player.coins<coins)return fail('Need '+rp+' shared research and '+coins+' guide coins.');
  const settlement=this.settleEconomy({id:this.economySettlementId('specialization',discipline+':'+id),guide:-coins,research:-rp},'Specialization: '+id);if(!settlement.ok)return fail('The specialization cost could not be settled.');this.s.specializations[discipline]=id;
  this.remember('specialty-'+id,'A talent taking shape',list.find(x=>x.id===id)!.name,'star');return {ok:true};
 }
 startStudy(id:string){const s=this.s,d=own(STUDIES,id)?STUDIES[id]:null;if(!d)return fail('Unknown field study.');if(s.fieldStudies.completed.includes(id))return fail('This discovery is already in our notebook.');if(s.fieldStudies.active)return fail('Finish the active field study or put it aside first.');if(d.requires&&!s.skills[d.requires])return fail('First learn '+SKILLS[d.requires!]!.short+'.');s.fieldStudies.active=id;s.fieldStudies.progress[id] ||= {};
  // A late-started field study must never be stranded behind a unique building
  // or the finite upgrade cap. Existing infrastructure is legitimate evidence.
  for(const goal of d.goals){let existing=0;if(goal.event==='stage')existing=s.buildings.reduce((a,b)=>a+3*(b.level||1),0);if(goal.event==='upgrade')existing=s.buildings.reduce((a,b)=>a+(b.level||1)-1,0);if(goal.event.startsWith('build:'))existing=this.has(goal.event.slice(6))?1:0;if(existing){s.fieldStudies.progress[id]![goal.event]=Math.max(s.fieldStudies.progress[id]![goal.event]||0,Math.min(goal.amount,existing));this.record(goal.event,0);}}
  this.log('A new shared question: '+d.name+'.','research');return {ok:true};}
 pauseStudy(){this.s.fieldStudies.active=null;return {ok:true};}
 record(event:string,amount=1){
  const s=this.s,id=s.fieldStudies.active;if(!id)return;const d=STUDIES[id]!;
  if(!d.goals.some(g=>g.event===event))return;
  const p=s.fieldStudies.progress[id]!;p[event]=Math.min(10000,(p[event]||0)+amount);
  if(d.goals.every(g=>(p[g.event]||0)>=g.amount)){
   const research=d.reward.rp!+(this.specialization('thinker')?1:0),settlement=this.settleEconomy({id:this.economySettlementId('field-study',id),guide:d.reward.coins!,research,playerXp:8,actorXp:8},'Field study: '+d.name);if(!settlement.ok)return;
   s.fieldStudies.completed.push(id);s.fieldStudies.active=null;
   this.remember('field-'+id,d.name,'A question answered through lived experience.','research');this.emit('celebrate','Field study complete: '+d.name);this.log('Our field study is complete. The evidence became shared knowledge.','research');
  }
 }
 constructionSkill(o:OrderView){if(o.type==='upgrade'&&o.targetLevel===3){const cat=BUILDINGS[o.kind!]!.category;return cat==='learning'?'mentorship':cat==='growing'?'stewardship':cat==='community'?'logistics':cat==='home'?'architecture':'engineering';}return BUILDINGS[o.kind!]!.skill;}
 override constructionCost(o:OrderView){
  return this.constructionPhases(o)[o.stage||0]!.cost;
 }
 totalCost(o:OrderView):Numbers{
  const b=BUILDINGS[o.kind!]!;if(o.type!=='upgrade')return b.cost;
  const cost:Numbers={};for(const[r,n]of Object.entries(b.cost))cost[r]=Math.max(1,Math.ceil(n*(o.targetLevel===2?B.forEngine(this).construction.upgradeLevelTwoFraction:B.forEngine(this).construction.upgradeLevelThreeFraction)));
  if(o.targetLevel===3){cost.tools=(cost.tools||0)+1;cost.beams=(cost.beams||0)+2;}
  return cost;
 }
 constructionPhases(o:OrderView):{name:string;cost:Numbers;time:number}[]{
  const time=BUILDINGS[o.kind!]!.time*(o.type==='upgrade'?B.forEngine(this).construction.upgradeTimeFraction:1)*APPROACHES[o.approach||'balanced'!]!.time;
  const phases=PHASE_NAMES.map((name,i)=>({name,cost:{} as Numbers,time:time*[B.forEngine(this).construction.foundationFraction,B.forEngine(this).construction.structureFraction,B.forEngine(this).construction.finishFraction][i]!}));
  for(const [r,n]of Object.entries(this.totalCost(o))){let group=COST_GROUPS.findIndex(g=>g.includes(r));if(group<0)group=2;phases[group]!.cost[r]=n;}
  return phases;
 }
 projectProgress(o:OrderView){if(!['build','upgrade'].includes(o.type))return (o.done||0)/o.amount!;const ps=this.constructionPhases(o),total=ps.reduce((a,p)=>a+p.time,0);return clamp((ps.slice(0,o.stage||0).reduce((a,p)=>a+p.time,0)+(o.progress||0))/total,0,1);}
 remainingCost(o:OrderView):Numbers{const out:Numbers={};this.constructionPhases(o).forEach((p,i)=>{if(i<(o.stage||0)||(i===(o.stage||0)&&o.paid))return;for(const[r,n]of Object.entries(p.cost))out[r]=(out[r]||0)+n;});return out;}
 refundPreview(o:OrderView):Numbers{if(!['build','upgrade'].includes(o.type))return {};const out:Numbers={};const ps=this.constructionPhases(o);ps.forEach((p,i)=>{const factor=i<(o.stage||0)?B.forEngine(this).construction.refundCompletedFraction:(i===(o.stage||0)&&o.paid)?1:0;for(const[r,n]of Object.entries(p.cost))out[r]=(out[r]||0)+n*factor;});return Object.fromEntries(Object.entries(out).map(([r,n]):[string,number]=>[r,Math.floor(n)]).filter(([,n])=>n>0));}
 placementIssue(kind:string,x:number,y:number){if(BUILDINGS[kind!]!?.placement==='water'){let near=false;for(let a=0;a<SIZE;a++)for(let b=0;b<SIZE;b++)if(terrain(a,b)==='water'&&Math.abs(a-x)+Math.abs(b-y)<=3)near=true;if(!near)return 'The waterwheel needs a grass tile within 3 steps of the spring.';}return null;}
 override place(kind:string,x:number,y:number){
  if(!own(BUILDINGS,kind))return fail('Unknown blueprint.');
  const issue=this.placementIssue(kind,x,y);if(issue)return fail(issue);
  const r=super.place(kind,x,y);if(r.ok){r.order.stage=0;r.order.approach=this.s.buildPolicy.approach;}
  return r;
 }
 upgrade(id:string){
  const b=this.s.buildings.find(b=>b.id===id);if(!b)return fail('This building is no longer here.');if(b.level>=3)return fail('This place is already fully improved.');
  if(this.s.orders.some(o=>o.type==='upgrade'&&o.kind===b.kind))return fail('An improvement is already planned.');if(this.s.orders.length>=12)return fail('The plan board is full.');
  const o={id:'o'+this.s.nextId++,type:'upgrade',kind:b.kind,targetLevel:b.level+1,x:b.x,y:b.y,progress:0,stage:0,paid:false,paused:false,priority:0,created:this.s.simTime,approach:this.s.buildPolicy.approach};
  this.s.orders.push(o);this.log('You planned level '+o.targetLevel+' for our '+BUILDINGS[b!.kind!]!.name.toLowerCase()+'. It stays usable during the work.','plan');return {ok:true,order:o};
 }
 upgradeEffect(b:LWApplication.Building,level=b.level+1){return Work.upgradeEffect(this,b,level);}
 buildQuality(o:OrderView){const m=this.mastery(this.constructionSkill(o));return clamp(Math.round(B.forEngine(this).construction.qualityBase+m.rank*B.forEngine(this).construction.qualityPerRank+APPROACHES[o.approach||'balanced'!]!.quality+(this.s.needs.comfort>=B.forEngine(this).work.comfortableGate?B.forEngine(this).construction.comfortableQuality:0)+(this.specialization('builder')?B.forEngine(this).construction.builderQuality:0)+(this.specialization('finisher')?B.forEngine(this).construction.finisherQuality:0)),B.forEngine(this).construction.minimumQuality,100);}
 qualityName(q:number){return q>=B.forEngine(this).construction.beautifulQuality?'Beautifully made':q>=B.forEngine(this).construction.wellMadeQuality?'Well made':q>=B.forEngine(this).construction.dependableQuality?'Dependable':'Simple & useful';}
 override orderName(o:Order){if(o.type==='practice')return 'Practice '+SKILLS[o.skillId!]!.short+' · '+o.amount+' '+(o.amount===1?'session':'sessions');if(o.type==='upgrade')return 'Improve '+BUILDINGS[o.kind!]!.name+' · level '+o.targetLevel;return super.orderName(o);}
 override missingSkill(r:string){const skill=RAW_SKILLS[r];if(skill&&!this.s.skills[skill])return skill;return super.missingSkill(r);}
 override assessResource(resource:string,amount:number,seen=new Set<string>()):Issue|null{
  if(this.s.inventory[resource!]!>=amount)return null;if(seen.has(resource))return {text:'A circular recipe needs attention.'};
  const skill=this.missingSkill(resource);if(skill)return {text:'Teach '+SKILLS[skill!]!.short,skill};
  const r=RECIPES[resource!]!;if(r){if(!this.has(r.station))return {text:'Build a '+BUILDINGS[r.station!]!.name.toLowerCase(),building:r.station};const next=new Set(seen);next.add(resource);for(const[k,n]of Object.entries(r.cost)){const issue=this.assessResource(k,n,new Set(next));if(issue)return issue;}}return null;
 }
 override orderIssue(o:OrderView):Issue|null{
  if(o.paused)return {text:'On hold — no rush',paused:true};
  if(['build','upgrade'].includes(o.type)){
   const skill=this.constructionSkill(o);if(!this.s.skills[skill])return {text:'Teach '+SKILLS[skill!]!.short,skill};
   if(o.type==='upgrade'){
    const b=this.s.buildings.find(b=>b.kind===o.kind&&b.x===o.x&&b.y===o.y);if(!b)return {text:'The original building is missing.'};
    if(this.mastery(BUILDINGS[o.kind!]!.skill).points<8)return {text:'Practice '+SKILLS[BUILDINGS[o.kind!]!.skill]!.short+' to 8 points before improving this place.',practice:BUILDINGS[o.kind!]!.skill};
   }
   if(!o.paid)for(const[r,n]of Object.entries(this.constructionCost(o))){const issue=this.assessResource(r,n);if(issue)return issue;}
   return null;
  }
  if(o.type==='practice'){
   if(!this.s.skills[o.skillId!])return {text:'Learn the skill first.',skill:o.skillId!};const d=DRILLS[o.skillId!]!;
   if(d.station&&!this.has(d.station))return {text:'Build a '+BUILDINGS[d.station!]!.name.toLowerCase()+' for this drill.',building:d.station};
   for(const[r,n]of Object.entries(d.cost)){const issue=this.assessResource(r,n);if(issue)return issue;}return null;
  }
  return super.orderIssue(o);
 }
 override request(type:string,resource:string|null=null,quantity:number|null=null):LWCorePorts.PlanResult{
  if(type==='gather'&&RAW.includes(resource!)&&!['wood','stone','fiber','berries','water'].includes(resource!)){
   if(this.s.orders.length>=12)return fail('The idea queue is full.');if(this.s.orders.some(o=>o.type==='gather'&&o.resource===resource))return fail('That gathering idea is already on the board.');
   const amount=quantity??6;if(!Number.isInteger(amount)||amount<1||amount>24)return fail('Choose an amount from 1 to 24.');
   const o={id:'o'+this.s.nextId++,type,resource,amount,done:0,paused:false,priority:0,created:this.s.simTime};this.s.orders.push(o);return {ok:true,order:o};
  }return super.request(type,resource,quantity);
 }
 override resourceTask(resource:string,orderId:string|null=null,force=false):Draft|null{
  if(RAW.includes(resource!)&&!this.missingSkill(resource)){
   const crops=this.s.buildings.filter(b=>CROP_RES[b.kind]===resource&&b.stock>0);const node=this.nearest([...this.s.nodes.filter(n=>n.kind===resource&&n.stock>0),...crops.map(b=>({...b,id:'crop:'+b.id}))]);
   if(node&&node.id.startsWith('crop:'))return {kind:'gather',resource,nodeId:node.id,orderId,target:node,duration:2.5,label:'Harvesting '+RES[resource]!.name.toLowerCase(),reason:'Our growing places have something ready. I’ll bring it home.',thought:'A little care comes back to us.'};
  }
  return super.resourceTask(resource,orderId,force);
 }
 override orderTask(o:Order):Draft|null{
  if(this.orderIssue(o))return null;
  if(['build','upgrade'].includes(o.type)){
   if(!o.paid)for(const[r,n]of Object.entries(this.constructionCost(o)))if(this.s.inventory[r!]!<n)return this.resourceTask(r,o.id);
   const p=this.constructionPhases(o)[o.stage||0]!;return {kind:'build',orderId:o.id,target:o as LWCorePorts.Point,duration:p.time,elapsed:o.progress!,label:(o.type==='upgrade'?'Improving ':'Building ')+BUILDINGS[o.kind!]!.name.toLowerCase()+' · '+(o.stage!+1)+'/'+this.constructionPhases(o).length,reason:p.name+'. I only need this stage’s supplies right now.',thought:PHASE_NAMES[o.stage!]||'We kept going together.'};
  }
  if(o.type==='practice'){
   if(this.s.learning.recovering)return null;
   const d=DRILLS[o.skillId!]!;for(const[r,n]of Object.entries(d.cost))if(this.s.inventory[r!]!<n)return this.resourceTask(r,o.id);
   const b=d.station?this.s.buildings.find(b=>b.kind===d.station):this.s.buildings.find(b=>b.kind==='circle');
   return {kind:'practice',skillId:o.skillId!,orderId:o.id,target:b||{x:8,y:10},duration:12,elapsed:o.progress||0,label:'Practicing '+SKILLS[o.skillId!]!.short.toLowerCase(),reason:'A small, useful exercise. Supplies become practice; care still comes first.',thought:'It does not have to be perfect to teach me something.'};
  }
  return super.orderTask(o);
 }
 override decide(){
  const s=this.s,l=s.learning;
  if(!s.training&&l.queue.length)s.training=l.queue.shift()!;
  if(l.recovering&&!Object.entries(s.needs).some(([k,v])=>v<(k==='energy'?27:35))){
   const t={kind:'reflect',target:s.buildings.find(b=>b.kind==='circle')||{x:8,y:10},duration:10,label:'Letting the lesson settle',reason:'My mind needs a breather. A little reflection helps me learn again.',thought:'I’m putting the pieces together.'};if(this.startTask(t))return;
  }
  const suspended=(l.paused||l.recovering)?s.training:null;if(suspended)s.training=null;
  super.decide();if(suspended)s.training=suspended;
  if(s.task?.kind==='train'){
   s.task.style=s.training!.style!;s.task.target=this.s.buildings.find(b=>b.kind==='circle')||s.task.target!;
   const path=this.findPath(s.task.target!,!!this.has('circle'));if(path){s.task.path=path;s.task.phase=path.length?'walk':'work';}
   s.task.reason=STYLES[s.training!.style!]!.name+'. '+this.learningPhase()!.label+'. Essential care can interrupt; progress is kept.';
  }
  // Extend reserve maintenance without replacing the base need/lesson/plan ordering.
  if(s.task?.kind==='idle')for(const r of Object.keys(RES).filter(id=>!['wood','stone','fiber','berries','water','planks','meat','meals'].includes(id)))if(s.inventory[r!]!<s.stockTargets[r!]!&&!this.assessResource(r,s.stockTargets[r!]!)){const t=this.resourceTask(r);if(t){t.stock=true;t.reason='Keeping '+s.stockTargets[r!]!+' '+RES[r]!.name.toLowerCase()+' in the pantry.';if(this.startTask(t))break;}}
 }
 override createNeedTask(which:string):Draft|null{
  const s=this.s;if(which==='food'&&s.inventory.bread!>0&&!s.inventory.meals)return {kind:'eatbread',target:{x:Math.round(s.creature.x),y:Math.round(s.creature.y)},duration:3,label:'Enjoying a piece of bread',reason:'We grew, milled and baked this. Now it can look after me.',thought:'It tastes like home.'};
  if(which==='comfort'&&s.inventory.balm!>0)return {kind:'usebalm',target:{x:Math.round(s.creature.x),y:Math.round(s.creature.y)},duration:3,label:'Taking a soothing moment',reason:'A little balm from our herbarium helps me feel comfortable.',thought:'That is better.'};
  return super.createNeedTask(which);
 }
 override cancel(id:string){const o=this.s.orders.find(o=>o.id===id);if(!o)return;
  if(['build','upgrade'].includes(o.type)){
   const refund=this.refundPreview(o);for(const[r,n]of Object.entries(refund))this.s.inventory[r!]!+=n;
   if(this.s.task?.orderId===id)this.s.task=null;this.s.orders=this.s.orders.filter(o=>o.id!==id);
   this.log('Set aside '+this.orderName(o)+'. Current-stage supplies returned; half of installed materials salvaged (rounded down).','plan');
  }else super.cancel(id);
 }
 override planStatus(o:Order){const p=super.planStatus(o);if(!p.issue&&['build','upgrade'].includes(o.type)){p.detail=this.constructionPhases(o)[o.stage||0]!.name+' · '+Math.round(this.projectProgress(o)*100)+'% overall';if(this.s.task?.orderId===o.id&&this.s.task.kind==='build')p.label=o.type==='upgrade'?'Improving':'Building';}return p;}
 materialForecast(only:OrderView|null=null):LWTaskPorts.Forecast{
  const available={...this.s.inventory},rows:Record<string,LWTaskPorts.ForecastRow>={},steps:LWTaskPorts.Forecast['steps']=[],issues:Issue[]=[];
  const add=(r:string,n:number,chain:string[]=[]):void=>{if(n<=0)return;const row=rows[r]||=( {resource:r,needed:0,onHand:this.s.inventory[r!]!,used:0,missing:0});row.needed+=n;const use=Math.min(available[r!]!,n);available[r!]!-=use;row.used+=use;const lack=n-use;row.missing+=lack;if(!lack)return;
   const sk=this.missingSkill(r);if(sk)issues.push({text:'Teach '+SKILLS[sk!]!.short,skill:sk});const rec=RECIPES[r!]!;
   if(rec&&!chain.includes(r)){if(!this.has(rec.station))issues.push({text:'Build a '+BUILDINGS[rec.station!]!.name.toLowerCase(),building:rec.station});const batches=Math.ceil(lack/rec.amount);for(const[k,v]of Object.entries(rec.cost))add(k,v*batches,[...chain,r]);available[r!]!+=rec.amount*batches-lack;steps.push({resource:r,amount:rec.amount*batches,kind:'craft',station:rec.station});}
   else steps.push({resource:r,amount:lack,kind:r==='meat'?'hunt':'gather'});
  };
  const orders=only?[only]:this.s.orders.filter(o=>!o.paused).slice().sort((a,b)=>b.priority-a.priority||a.created-b.created);
  for(const o of orders){const issue=this.orderIssue(o);if(issue&&!o.paused)issues.push(issue);
   if(['build','upgrade'].includes(o.type)){for(const[r,n]of Object.entries(this.remainingCost(o)))add(r,n);}
   else if(o.type==='practice'){for(const[r,n]of Object.entries(DRILLS[o.skillId!]!.cost))add(r,n*(o.amount!-o.done!));}
   else if(o.type==='craft'){const rec=RECIPES[o.resource!]!;for(const[r,n]of Object.entries(rec.cost))add(r,n*Math.ceil((o.amount!-o.done!)/rec.amount));}
   else if(o.type==='deliver')for(const[r,n]of Object.entries(L.CONTRACTS[o.contract!]!.cost))add(r,n);
  }
  return {rows:Object.values(rows),steps,issues:issues.filter((x,i,a)=>a.findIndex(y=>y.text===x.text)===i)};
 }
 recipeForecast(resource:string,quantity=1){
  const rec=RECIPES[resource!]!;if(!rec)return {rows:[],steps:[],issues:[]};return this.materialForecast({type:'craft',resource,amount:quantity,done:0,paused:false});
 }
 override finishTask(t:Task){Completions.finish(this,t,task=>super.finishTask(task));}
 override splitIncome(amount:number){return super.splitIncome(Math.round(amount*(1+(this.specialization('merchant')?B.forEngine(this).production.merchantBonus:0)+Math.max(0,this.buildingLevel('market')-1)*B.forEngine(this).production.marketPerLevel)));}
 override step(dt:number){
  const s=this.s;if(!s.started||s.paused)return;dt=clamp(dt,0,.25);const t=s.task;
  if(s.learning.practiceDay!==s.day){s.learning.practiceDay=s.day;s.learning.practicedToday={};}
  const studying=t&&['train','practice'].includes(t.kind)&&t.phase==='work';
  s.learning.fatigue=clamp(s.learning.fatigue+dt*(studying?(t.style==='playful'?B.forEngine(this).work.playfulFatigue:t.style==='independent'?B.forEngine(this).work.independentFatigue:B.forEngine(this).work.togetherFatigue):B.forEngine(this).work.idleFatigue),0,100);
  if(s.learning.fatigue>=B.forEngine(this).work.fatigueRecoverGate)s.learning.recovering=true;if(s.learning.fatigue<=B.forEngine(this).work.fatigueResumeGate)s.learning.recovering=false;
  if(studying&&s.learning.recovering){s.task=null;this.decide();return;}
  if(t?.kind==='practice'&&t.phase==='work'){const o=s.orders.find(o=>o.id===t.orderId);if(o)o.progress=Math.min(t.duration,t.elapsed+dt*this.workRate(t));}
  // The base engine grows the original garden; only the bonus time is added here.
  for(const b of s.buildings){b.level??=1;b.quality??=60;if(CROP_RES[b.kind]){
   const extra=(b.level-1)*B.forEngine(this).production.cropLevelRate+(['garden','grainplot'].includes(b.kind)&&this.has('greenhouse')?B.forEngine(this).production.greenhouseBonus:0);
   b.regen+=dt*((b.kind==='garden'?0:1)+extra);
   if(b.regen>=B.forEngine(this).production.cropSeconds){b.regen-=B.forEngine(this).production.cropSeconds;b.stock=Math.min(B.forEngine(this).production.cropStockCap,b.stock+(b.kind==='orchard'?B.forEngine(this).production.orchardYield:B.forEngine(this).production.cropYield)+(b.level-1));}
  }}
  super.step(dt);
  if(s.task?.kind==='train'&&s.training){const phase=this.learningPhase();s.task.label='Learning '+SKILLS[s.training.id!]!.short.toLowerCase()+' · '+phase!.label.toLowerCase();}
 }
 override export(){const d=super.export();d.version=3;d.state.version=3;return d;}

 };}
Object.assign(L,{DISCIPLINES,DRILLS,STYLES,APPROACHES,SPECIALIZATIONS,STUDIES,PATHS,CATEGORY_NAMES,RAW,CROP_RES});
// A clearly labeled, authored mid-game scenario. Normal play never calls this.
function createWorkshopDemo():LWCorePorts.SystemsEngine{
 const e=Composition.constructThrough('systems'),s=e.s;s.started=true;s.player={level:5,xp:18,coins:296};s.creature={level:5,xp:24,coins:28,x:8,y:9,dir:1};s.bond=72;s.rp=52;s.needs={food:83,water:79,energy:76,comfort:84,joy:82};
 const ids=['woodcraft','stonework','shelter','firekeeping','woodwork','gardening','commerce','tracking','cooking','masonry','architecture','invention','fiberwork','claywork','weaving','pottery','joinery','herbalism'];
 for(const id of ids){s.skills[id]=true;s.researched[id]=true;s.practice[id]=['woodwork','shelter','pottery'].includes(id)?20:10;}
 Object.assign(s.inventory,{wood:12,stone:12,fiber:9,berries:7,water:7,planks:4,meat:2,meals:2,clay:6,ore:2,rope:3,cloth:2,charcoal:2,bricks:2,pots:1});
 s.allowance={limit:8,given:8,auto:true,reserve:6,sourcing:'balanced'};
 const layouts:[string,number,number][]=[['shelter',7,8],['bench',10,8],['fire',9,11],['garden',6,10],['market',12,9],['circle',7,12],['loom',10,11],['kiln',11,7],['study',8,13],['well',11,12],['grainplot',8,6],['cottage',6,8]];
 for(const[k,x,y]of layouts){if(!e.canBuild(x,y))throw Error('Workshop demo plot blocked: '+k);s.buildings.push({id:'b'+s.nextId++,kind:k,x,y,level:k==='bench'||k==='circle'?2:1,quality:k==='circle'?84:72,stock:CROP_RES[k]?6:0,regen:0});}
 s.completedQuests=L.QUESTS.map(q=>q.id);s.stats={...s.stats,trained:ids.length,built:s.buildings.length,gathered:156,planksMade:30,deliveries:3,fed:10,watered:9,bonded:12};s.metrics.stages=42;s.metrics.upgrades=2;s.metrics.lessons=ids.length;s.learning.path='earth';
 e.startStudy('earth');e.research('metalwork');e.teach('metalwork');s.buildPolicy.approach='careful';
 const plan=e.place('workshop',10,6);if(!plan.ok)throw Error('Workshop demonstration: '+plan.reason);
 s.memories=[{key:'demo-home',title:'A clearing became a home',description:'Each useful place began as a possibility we imagined together.',icon:'home',day:1,hour:8},{key:'demo-craft',title:'Earth, fire, and patience',description:'The first pot came out a little crooked. It still held water.',icon:'fire',day:1,hour:8}];e.newWish();
 e.log('A growing-workshop example: metalworking is in our learning plan, a careful workshop is on the board, and a field study is active.','book');
 return e;
}
Composition.register({id:'systems',order:10,define:defineLayer,initialize:initializeSystems,
 installFactories({L}){L.createWorkshopDemo=createWorkshopDemo;}});

if(typeof module!=='undefined'&&module.exports)module.exports=L;
})(typeof globalThis!=='undefined'?globalThis:this);
