/* The Living Land: physical deposits, building-local buffers and creature logistics.
 * Domain only: no DOM, timers, I/O or rendering randomness. Public actions express intent;
 * transfers settle only beside their source/destination and recheck quantity and capacity.
 */
(function(root){
 'use strict';
 const L=root.LW, Composition=L.EngineComposition, W=root.LWWorldContent, A=root.LWAdventure;
 const {RES,RECIPES,BUILDINGS,SKILLS,clamp,terrain,SIZE}=L;
 const copy=W.clone, sum=inv=>Object.values(inv||{}).reduce((a,n)=>a+n,0);
 const fail=reason=>({ok:false,reason}), ok=()=>({ok:true});
 const isInt=(n,a=0,b=1e7)=>Number.isInteger(n)&&n>=a&&n<=b;
 const item=L.colony.item, def=L.colony.definition;
 const CUSTOM=['stockbuilding','collectbuilding','emptybuilding','produce'];
 L.worldTaskKinds=CUSTOM;
 const PROFILE=id=>W.building(id), I=root.LWWorldIntegrity;
 const recordBlank=()=>({input:{},output:{},job:null,targets:{},requests:{},enabled:true,priority:1,emptyInputs:false,completed:0,lastOutput:0,lastMessage:'On demand'});
 function prepareWorld(state){
  const configuration=W.validate(W.content);if(!configuration.ok)throw Error(configuration.errors.join('\n'));
  if(state?.colony){const c=state.colony.creatures.find(c=>c.id===state.colony.selectedId)||state.colony.creatures[0];for(const k of L.colony.PERSONAL)state[k]=copy(c[k]);}
  return state;
 }
 function initializeWorld(self,_state,options={}){
  self.initWorld(options);
  self.worldEcs=root.LWWorldECS.create();self._worldTransactionIds=new WeakMap();self._worldTransactionSequence=0;
 }
 let WorldLayer;
 function defineLayer(Base){WorldLayer=class WorldSimulationLayer extends Base {
  initWorld({demo=false}={}){
   const s=this.s;
   if(!s.world){
    s.world={version:1,sequence:1,transfers:[]};
    for(const n of s.nodes){const d=W.node(n.kind);if(!d)continue;n.stock=n.max=d.quantity;n.regen=0;}
    for(const site of W.content.sites){
     if(s.nodes.some(n=>n.x===site.x&&n.y===site.y)||s.buildings.some(b=>b.x===site.x&&b.y===site.y)||this.allOrders().some(o=>o.type==='build'&&o.x===site.x&&o.y===site.y))continue;
     const d=W.node(site.kind);if(terrain(site.x,site.y)==='grass')s.nodes.push({...site,stock:d.quantity,max:d.quantity,regen:0});
    }
    // Current seeded/demo places receive their authored substrate; ordinary placement never fabricates deposits.
    this.seedExistingSites();
    for(const c of this.creatures){
     c.worldPickup=null;
    }
   }else if(demo)this.seedExistingSites();
   this.syncBuildings({preserveSeededStock:demo});
   this.s.version=6;
  }
  seedExistingSites(){
   for(const b of [...this.s.buildings,...this.allOrders().filter(o=>o.type==='build')]){
    const p=PROFILE(b.kind);if(!p?.requiresNode)continue;
    if(this.s.nodes.some(n=>n.x===b.x&&n.y===b.y&&n.kind===p.requiresNode))continue;
    if(this.s.nodes.some(n=>n.x===b.x&&n.y===b.y))continue;
    const d=W.node(p.requiresNode);this.s.nodes.push({id:'seeded-site-'+(b.id||b.kind),kind:d.id,x:b.x,y:b.y,stock:d.quantity,max:d.quantity,regen:0});
   }
  }
  syncBuildings({preserveSeededStock=false}={}){
   for(const b of this.s.buildings){const p=PROFILE(b.kind);if(!p||b.storage)continue;
    b.storage=recordBlank();
    if(p.production&&p.defaultTarget)b.storage.targets[p.production.output]=p.defaultTarget;
    if(preserveSeededStock&&L.CROP_RES[b.kind]&&(b.stock||0)>0)b.storage.output[L.CROP_RES[b.kind]]=Math.floor(b.stock);
    b.stock=0;b.regen=0;
   }
  }
  physicalToken(kind,record,subject='world'){
   let id=this._worldTransactionIds.get(record);if(!id){id=String(++this._worldTransactionSequence);this._worldTransactionIds.set(record,id);}
   return kind+':'+this.actor.id+':'+subject+':'+id;
  }
  releaseProduction(b,progress){const j=b?.storage?.job;if(!j)return null;return this.worldEcs.updateProduction({id:'release:'+j.id+':'+(++this._worldTransactionSequence),worksiteId:'worksite:'+b.id,storage:b.storage,jobId:j.id,action:'release',progress});}
  nodeAt(x,y){return this.s.nodes.find(n=>n.x===x&&n.y===y)||null;}
  nodeAvailable(n){return !!n&&!!W.node(n.kind)&&(W.node(n.kind).mode==='infinite'||n.stock>0);}
  remaining(n){return W.node(n.kind)?.mode==='infinite'?Infinity:n.stock;}
  placementIssue(kind,x,y){
   const p=PROFILE(kind),n=this.nodeAt(x,y);
   if(p?.requiresNode){
    const name=W.node(p.requiresNode)?.name||p.requiresNode;
    if(n?.kind!==p.requiresNode)return 'Requires '+name.toLowerCase()+' on this exact tile.';
    if(!this.nodeAvailable(n))return 'This '+name.toLowerCase()+' is exhausted. Choose a different site.';
   }else if(n)return 'This tile contains '+(W.node(n.kind)?.name||n.kind).toLowerCase()+'. Keep it accessible; choose clear ground.';
   const access=I.resourceAccessIssue(this,{x,y,kind});if(access)return access;
   if(!this.canBuild(x,y,kind))return 'Keep an open approach for every place and creature; choose a reachable tile.';
   return null;
  }
  canBuild(x,y,kind=null){
   if(!this.s.colony)return super.canBuild(x,y);
   if(!isInt(x,2,16)||!isInt(y,2,16)||terrain(x,y)!=='grass')return false;
   const n=this.nodeAt(x,y),k=kind||this._placementKind;
   if(n&&(!k||PROFILE(k)?.requiresNode!==n.kind||!this.nodeAvailable(n)))return false;
   // Reuse v7's complete connectivity/approach check, omitting only the claimed substrate.
   if(I.resourceAccessIssue(this,{x,y,kind:k}))return false;
   const nodes=this.s.nodes;
   try{if(n)this.s.nodes=nodes.filter(x=>x!==n);return super.canBuild(x,y);}
   finally{this.s.nodes=nodes;}
  }
  place(kind,x,y){
   const issue=this.interactionIssue();if(issue)return fail(issue);
   if(!BUILDINGS[kind])return fail('Unknown blueprint.');
   const reason=this.placementIssue(kind,x,y);if(reason)return fail(reason);
   this._placementKind=kind;
   try{return super.place(kind,x,y);}finally{this._placementKind=null;}
  }
  capacity(b,which){const p=PROFILE(b.kind);return (p?.[which+'Capacity']||0)+((b.level||1)-1)*(which==='input'?4:6);}
  buildingRecipes(b){
   const out=[];for(const [id,r]of Object.entries(RECIPES))if(r.station===b.kind)out.push({id,output:id,cost:r.cost,amount:r.amount,time:r.time,skill:r.skill,kind:'craft',depletion:0});
   for(const g of A.content.equipment)if(g.recipe?.station===b.kind)out.push({id:g.id,output:g.id,cost:g.recipe.cost,amount:1,time:g.recipe.time,skill:g.recipe.skill,kind:'gearcraft',depletion:0});
   const p=PROFILE(b.kind)?.production;if(p)out.push({id:p.output,output:p.output,cost:p.cost,amount:p.amount,time:p.seconds,skill:p.skill,kind:'produce',depletion:p.depletion});
   return out;
  }
  recipe(b,id){return this.buildingRecipes(b).find(r=>r.id===id)||null;}
  buildingFor(id){return this.s.buildings.filter(b=>b.storage&&b.storage.enabled&&this.recipe(b,id));}
  outputTotal(id){return this.s.buildings.reduce((n,b)=>n+(b.storage?.output[id]||0),0);}
  totalStock(id){return (this.s.colony.warehouse.inventory[id]||0)+this.outputTotal(id)+this.creatures.reduce((n,c)=>n+(c.inventory[id]||0),0);}
  committedOutput(id){return this.s.buildings.reduce((n,b)=>n+(b.storage?.job?.output===id?b.storage.job.amount:0),0);}
  demandStock(id){return this.totalStock(id)+this.committedOutput(id);}
  room(id,c=this.actor){return Math.max(0,Math.floor((this.load(c).maximumKg*1000-this.load(c).grams)/(item(id)?.weight||1)));}
  outputRoom(b){const reserve=b.storage?.job?.amount||0;return this.capacity(b,'output')-sum(b.storage?.output)-reserve;}
  reachable(target){return this.findPath(target,true)!==null;}
  sourceBuilding(id){return this.nearest(this.s.buildings.filter(b=>(b.storage?.output[id]||0)>0&&this.reachable(b)));}
  transferTask(kind,b,id,amount,orderId=null,extra={}){
   const verb=kind==='stockbuilding'?'Bringing ':kind==='emptybuilding'?'Reclaiming ':'Collecting ';
   return {kind,buildingId:b.id,resource:id,amount:Math.max(1,amount),orderId,target:{x:b.x,y:b.y},duration:1.5,label:verb+item(id).name.toLowerCase()+(kind==='stockbuilding'?' to ':' from ')+BUILDINGS[b.kind].name.toLowerCase(),reason:'Goods travel in a creature’s satchel. This transfer settles only at the building.',thought:kind==='stockbuilding'?'A few supplies, exactly where they belong.':'I’ll carry these to where they can help.',...extra};
  }
  collectTask(b,id,wanted=3,orderId=null,forDelivery=false){
   const n=Math.min(b.storage.output[id]||0,Math.max(1,wanted),this.room(id),W.content.logistics.batch);
   return n>0?this.transferTask('collectbuilding',b,id,n,orderId,{forDelivery}):this.depositTask('Making room to collect supplies');
  }
  resourceTask(id,orderId=null,force=false,quantity=0,visited=[]){
   if(visited.includes(id)||visited.length>20||!item(id))return null;
   const inv=this.s.inventory,o=this.s.orders.find(o=>o.id===orderId);
   const wanted=quantity||(o&&['build','upgrade'].includes(o.type)?this.constructionCost(o)[id]:0)||3;
   // A craft/gather order is a request to produce, not to count pre-existing stock as fresh work.
   const explicit=force&&o&&['craft','gather'].includes(o.type)&&o.resource===id;
   if(!explicit){
    const source=this.sourceBuilding(id);
    if(source)return this.collectTask(source,id,Math.max(1,wanted-(inv[id]||0)),orderId);
    const w=this.s.colony.warehouse.inventory[id]||0;
    if(w>0){const n=Math.min(w,Math.max(1,wanted-(inv[id]||0)),this.room(id),W.content.logistics.batch);if(n>0)return {kind:'withdraw',resource:id,amount:n,orderId,target:this.warehouse(),duration:2,label:'Collecting '+item(id).name.toLowerCase()+' from the warehouse',reason:'I need supplies in my satchel before using them.',thought:'I’ll carry what we need.'};return this.depositTask('Making room for supplies');}
   }
   const stations=this.buildingFor(id).filter(b=>this.s.skills[this.recipe(b,id).skill]&&this.reachable(b));
   if(stations.length){
    const sorted=stations.sort((a,b)=>Number(!!a.storage.job)-Number(!!b.storage.job)||Math.abs(a.x-this.s.creature.x)+Math.abs(a.y-this.s.creature.y)-Math.abs(b.x-this.s.creature.x)-Math.abs(b.y-this.s.creature.y));
    for(const b of sorted){const t=this.productionTask(b,id,orderId,[...visited,id]);if(t)return t;}
   }
   const r=def(id)?.recipe||RECIPES[id];if(r)return null;
   const defs=W.content.nodes.filter(n=>n.direct&&n.resource===id&&(!n.skill||this.s.skills[n.skill]));if(!defs.length)return !force?this.shoppingTask(id,orderId,false):null;
   const nodes=this.s.nodes.filter(n=>defs.some(d=>d.id===n.kind)&&this.nodeAvailable(n)&&this.reachable(n)&&!this.s.buildings.some(b=>b.x===n.x&&b.y===n.y)&&!this.allOrders().some(o=>o.type==='build'&&o.x===n.x&&o.y===n.y));
   const n=this.nearest(nodes);if(!n)return !force?this.shoppingTask(id,orderId,false):null;const d=W.node(n.kind);
   if(this.room(id)<=0)return this.depositTask('Lightening my satchel before gathering');
   return {kind:d.id==='hunt'?'hunt':'gather',resource:id,nodeId:n.id,orderId,target:{x:n.x,y:n.y},duration:d.seconds,label:'Gathering '+item(id).name.toLowerCase(),reason:d.mode==='finite'?'This deposit has '+n.stock+' units left. Gathering removes only what I carry away.':'A sustainable source. Each trip still takes time and carrying space.',thought:'A little from the land, a little closer to home.',worldGather:true};
  }
  originatingOrder(job){return this.creatures.find(c=>c.id===job.originId)?.orders.find(o=>o.id===job.orderId)||null;}
  productionTask(b,id,orderId=null,visited=[]){
   const st=b.storage,r=this.recipe(b,id);if(!st||!st.enabled||!r||!this.s.skills[r.skill]||!this.reachable(b))return null;
   const node=PROFILE(b.kind)?.requiresNode?this.nodeAt(b.x,b.y):null;
   if(I.substrateIssue(this,b,r))return null;
   if(st.job){
    const j=st.job;if(j.recipe!==id||this.originatingOrder(j)?.paused)return null;
    if(j.workerId&&j.workerId!==this.actor.id&&this.creatures.some(c=>c.id===j.workerId&&c.task?.jobId===j.id))return null;
    return this.workTask(b,r,j,orderId);
   }
   const amount=r.amount+(this.specialization('cook')&&['meals','bread'].includes(id)?1:0);
   if(this.capacity(b,'output')-sum(st.output)<amount){const first=Object.entries(st.output).sort((a,b)=>b[1]-a[1])[0];return first?this.collectTask(b,first[0],first[1],null,true):null;}
   for(const [k,n]of Object.entries(r.cost)){
    const missing=n-(st.input[k]||0);if(missing<=0)continue;
    if((this.s.inventory[k]||0)>0){const qty=Math.min(missing,this.s.inventory[k],this.capacity(b,'input')-sum(st.input),W.content.logistics.batch);if(qty>0)return this.transferTask('stockbuilding',b,k,qty,orderId,{recipeId:id});}
    if(this.capacity(b,'input')-sum(st.input)<=0){const spare=Object.entries(st.input).find(([key,q])=>q>(r.cost[key]||0));return spare?this.transferTask('emptybuilding',b,spare[0],Math.min(spare[1]-(r.cost[spare[0]]||0),W.content.logistics.batch),null,{forDelivery:true}):null;}
    const t=this.resourceTask(k,orderId,false,missing,visited);if(t){t.supplyFor=b.id;t.recipeId=id;return t;}return null;
   }
   return this.workTask(b,r,null,orderId);
  }
  workTask(b,r,j,orderId){return {kind:r.kind,resource:r.output,buildingId:b.id,buffered:true,jobId:j?.id||null,orderId,target:{x:b.x,y:b.y},duration:j?.duration||r.time,elapsed:j?.progress||0,label:(r.kind==='produce'?'Tending ':'Making ')+item(r.output).name.toLowerCase()+' · '+BUILDINGS[b.kind].name,reason:'The ingredients are at this building. Finished goods wait in its output tray for collection.',thought:'Supplies in. Patient work. Something useful out.'};}
  assessResource(id,amount,seen=new Set()){
   if((this.s.inventory[id]||0)+(this.s.colony.warehouse.inventory[id]||0)+this.outputTotal(id)>=amount)return null;
   const work=this.buildingFor(id).find(b=>this.s.skills[this.recipe(b,id).skill]&&this.reachable(b)&&!I.substrateIssue(this,b,this.recipe(b,id)));if(work){const r=this.recipe(work,id);if(seen.has(id))return {text:'A production dependency loops.'};const next=new Set(seen);next.add(id);for(const [k,n]of Object.entries(r.cost)){const missing=Math.max(0,n-(work.storage.input[k]||0));if(missing){const issue=this.assessResource(k,missing,next);if(issue)return issue;}}return null;}
   const d=W.content.nodes.find(n=>n.direct&&n.resource===id);if(d&&(!d.skill||this.s.skills[d.skill])){
    if(!this.s.nodes.some(n=>n.kind===d.id&&this.nodeAvailable(n)&&this.reachable(n)&&!this.s.buildings.some(b=>b.x===n.x&&b.y===n.y)))return {text:'No accessible '+d.name.toLowerCase()+' remains. Check the world or use a marketplace.'};
   }
   const stations=this.s.buildings.filter(b=>this.recipe(b,id));
   if(stations.length&&!stations.some(b=>b.storage?.enabled&&this.reachable(b)&&!I.substrateIssue(this,b,this.recipe(b,id))))return {text:'No ready, reachable workplace can produce '+item(id).name.toLowerCase()+'. Review its supply, pause and site status.',building:stations[0].kind};
   return super.assessResource(id,amount,seen);
  }
  createNeedTask(which){
   if(which==='food'&&!['meals','bread','berries','meat'].some(id=>(this.s.inventory[id]||0)>0)){
    const id=['meals','bread','berries','meat'].find(id=>this.outputTotal(id)>0);if(id)return this.resourceTask(id,null,false,2);
   }
   if(which==='water'&&!(this.s.inventory.water>0)&&this.outputTotal('water')>0)return this.resourceTask('water',null,false,2);
   return super.createNeedTask(which);
  }
  depositKeep(c=this.actor){
   const keep=super.depositKeep(c),t=c.task;
   if(t?.supplyFor||t?.kind==='stockbuilding')keep[t.resource]=Math.max(keep[t.resource]||0,t.amount||W.content.logistics.batch);
   if(c.worldSupply){const p=c.worldSupply;keep[p.resource]=Math.max(keep[p.resource]||0,p.amount||W.content.logistics.batch);}
   return keep;
  }
  orderTask(o){
   if(o.type==='gather'||o.type==='craft')return this.resourceTask(o.resource,o.id,true,o.amount-o.done);
   if(o.type==='hunt')return this.resourceTask('meat',o.id,true);
   return super.orderTask(o);
  }
  handlers(){
   const h=super.handlers(),start=t=>t&&this.startTask(t)?'running':'failure';
   const homecoming=h.homecoming;
   h.homecoming=()=>{
    const c=this.actor;
    if(c.worldSupply){const p=c.worldSupply,b=this.s.buildings.find(b=>b.id===p.buildingId),r=b&&this.recipe(b,p.recipeId);if(b?.storage.enabled&&r){const missing=(r.cost[p.resource]||0)-(b.storage.input[p.resource]||0);if(missing>0&&(c.inventory[p.resource]||0)>0){const n=Math.min(missing,c.inventory[p.resource],this.capacity(b,'input')-sum(b.storage.input));if(n>0)return start(this.transferTask('stockbuilding',b,p.resource,n,null,{recipeId:r.id}));}}c.worldSupply=null;}
    if(c.worldPickup){const p=c.worldPickup,b=this.s.buildings.find(b=>b.id===p.buildingId);if(b?.storage.output[p.resource]>0){const result=start(this.collectTask(b,p.resource,p.amount,null,true));if(result!=='failure')return result;}c.worldPickup=null;}
    return homecoming();
   };
   const plans=h.plans;h.plans=()=>{const result=plans();return result!=='failure'?result:start(this.workplaceTask());};
   // Exposed as an optional behavior-tree action, while existing imported trees keep working.
   h.workplaces=()=>start(this.workplaceTask());
   h.supplies=()=>{
    for(const id of Object.keys(RES)){const wanted=this.s.stockTargets[id]||0;if(this.totalStock(id)<wanted&&!this.assessResource(id,wanted)){const t=this.resourceTask(id,null,true);if(t){t.stock=true;return start(t);}}}return 'failure';
   };
   const deposit=h.deposit;h.deposit=()=>{const t=this.haulingTask();return t?start(t):deposit();};
   return h;
  }
  workplaceTask(){
   const buildings=this.s.buildings.filter(b=>b.storage?.enabled).sort((a,b)=>b.storage.priority-a.storage.priority||a.storage.lastOutput-b.storage.lastOutput||a.id.localeCompare(b.id));
   // Pending jobs survive interruptions; another qualified creature can finish the same paid batch.
   for(const b of buildings){if(b.storage.job){const t=this.productionTask(b,b.storage.job.recipe);if(t)return t;}}
   for(const b of buildings){for(const r of this.buildingRecipes(b)){if(!this.s.skills[r.skill])continue;const request=b.storage.requests[r.id]||0,target=b.storage.targets[r.id]||0;
    if(request>0||target>this.demandStock(r.output)){const t=this.productionTask(b,r.id);if(t)return t;}
   }}
   return null;
  }
  haulingTask(){
   const candidates=this.s.buildings.filter(b=>b.storage&&this.reachable(b)).sort((a,b)=>b.storage.priority-a.storage.priority||a.storage.lastOutput-b.storage.lastOutput);
   for(const b of candidates){const st=b.storage;
    if(st.emptyInputs){const pair=Object.entries(st.input).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1])[0];if(pair){const amount=Math.min(pair[1],W.content.logistics.batch,this.room(pair[0]));if(amount>0)return this.transferTask('emptybuilding',b,pair[0],amount,null,{forDelivery:true});}else st.emptyInputs=false;}
    const pair=Object.entries(st.output).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
    if(pair&&(sum(st.output)>=this.capacity(b,'output')*.65||this.s.simTime-st.lastOutput>=W.content.logistics.outputAge||st.flushOutput))return this.collectTask(b,pair[0],pair[1],null,true);
   }return null;
  }
  startTask(t){
   if(!t||this.actor.activeQuest)return false;
   if(!CUSTOM.includes(t.kind)&&!t.buffered){const result=super.startTask(t);if(result&&t.supplyFor)this.actor.worldSupply={buildingId:t.supplyFor,recipeId:t.recipeId,resource:t.resource,amount:t.amount||W.content.logistics.batch};return result;}
   const b=this.s.buildings.find(b=>b.id===t.buildingId);if(!b?.storage)return false;
   const path=this.findPath(b,true);if(path===null)return false;
   if(t.buffered){const st=b.storage,r=this.recipe(b,t.resource);if(!st.enabled||!r||!this.s.skills[r.skill])return false;
    if(t.jobId&&st.job?.id!==t.jobId)return false;
    if(I.substrateIssue(this,b,r))return false;
    if(!st.job){
     const amount=r.amount+(this.specialization('cook')&&['meals','bread'].includes(r.output)?1:0),n=PROFILE(b.kind)?.requiresNode?this.nodeAt(b.x,b.y):null,jobId='work-'+this.s.world.sequence;
     const job={id:jobId,recipe:r.id,output:r.output,amount,cost:copy(r.cost),duration:r.time,progress:0,workerId:this.actor.id,originId:this.actor.id,orderId:t.orderId||null,attempts:0};
     const reserved=this.worldEcs.reserveProduction({id:'reserve:'+jobId,worksiteId:'worksite:'+b.id,storage:st,recipe:r,outputCapacity:this.capacity(b,'output'),outputAmount:amount,depositId:n?'deposit:'+n.id:null,deposit:n,substrateResource:n?n.kind:'none',substrateFinite:n?W.node(n.kind).mode==='finite':false,substrateDepletion:r.depletion,job});
     if(!reserved.ok)return false;this.s.world.sequence++;
    }
    const j=st.job;
    if(this.originatingOrder(j)?.paused)return false;
    const occupied=j.workerId&&j.workerId!==this.actor.id&&this.creatures.some(c=>c.id===j.workerId&&c.task?.jobId===j.id);
    if(j.recipe!==r.id||occupied)return false;
    const claim=this.worldEcs.updateProduction({id:'claim:'+j.id+':'+this.actor.id,worksiteId:'worksite:'+b.id,storage:st,jobId:j.id,action:'claim',workerId:this.actor.id,allowTakeover:!occupied});if(!claim.ok)return false;
    t.jobId=j.id;t.elapsed=j.progress;t.duration=j.duration;
   }
   t.path=path;t.phase=path.length?'walk':'work';t.elapsed=t.elapsed||0;t.duration=Math.max(1,t.duration||2);this.s.task=t;return true;
  }
  stepWorld(){
   this.syncBuildings();
   // Deposits never replenish here. Infinite supply is a declared source rule, not regeneration.
   for(const b of this.s.buildings){const j=b.storage?.job;if(j&&j.workerId&&!this.creatures.some(c=>c.id===j.workerId&&!c.activeQuest&&c.task?.jobId===j.id))this.releaseProduction(b,j.progress);}
  }
  stepActor(dt){
   const t=this.actor.task;
   if(t?.buffered){const b=this.s.buildings.find(b=>b.id===t.buildingId);if(!b?.storage.enabled||b.storage.job?.id!==t.jobId){this.s.task=null;}else if(t.phase==='work')this.worldEcs.updateProduction({id:'progress:'+t.jobId+':'+this.actor.id,worksiteId:'worksite:'+b.id,storage:b.storage,jobId:t.jobId,action:'progress',progress:Math.min(t.duration,t.elapsed+dt*this.workRate(t))});}
   super.stepActor(dt);
   if(t?.buffered&&this.actor.task!==t){const b=this.s.buildings.find(b=>b.id===t.buildingId);if(b?.storage.job?.id===t.jobId)this.releaseProduction(b,Math.min(b.storage.job.progress,t.elapsed));}
  }
  recordBuildingTransfer(b,direction,id,n){
   this.s.world.transfers.unshift({time:this.s.simTime,actorId:this.actor.id,name:this.actor.name,buildingId:b.id,direction,resource:id,amount:n});this.s.world.transfers=this.s.world.transfers.slice(0,60);
   this.emit('building-transfer',this.actor.name+(direction==='in'?' stocked ':' collected from ')+BUILDINGS[b.kind].name,{buildingId:b.id,x:b.x,y:b.y,resource:id,amount:n,direction});
  }
  finishTask(t){
   // A completion is a capability of the active task, not a reusable instruction.
   if(!t||((CUSTOM.includes(t.kind)||t.buffered||t.worldGather||['gather','hunt'].includes(t.kind))&&this.actor.task!==t))return;
   const c=this.actor,inv=c.inventory,b=t.buildingId&&this.s.buildings.find(b=>b.id===t.buildingId),st=b?.storage;
   if(['stockbuilding','collectbuilding','emptybuilding'].includes(t.kind)){
    if(st&&this.at(b)){
     if(t.kind==='stockbuilding'){
      const r=this.recipe(b,t.recipeId),missing=r?Math.max(0,(r.cost[t.resource]||0)-(st.input[t.resource]||0)):0,limit=Math.min(missing,Math.max(0,this.capacity(b,'input')-sum(st.input)));
      const moved=st.enabled?this.worldEcs.transfer({id:this.physicalToken('transfer-in',t,b.id),sourceId:'inventory:actor:'+c.id,destinationId:'inventory:worksite:'+b.id+':input',source:inv,destination:st.input,resource:t.resource,requested:t.amount,destinationLimit:limit}):{amount:0};
      if(moved.amount>0)this.recordBuildingTransfer(b,'in',t.resource,moved.amount);c.worldSupply=null;
     }else{
      const src=t.kind==='emptybuilding'?st.input:st.output,moved=this.worldEcs.transfer({id:this.physicalToken('transfer-out',t,b.id),sourceId:'inventory:worksite:'+b.id+':'+(t.kind==='emptybuilding'?'input':'output'),destinationId:'inventory:actor:'+c.id,source:src,destination:inv,resource:t.resource,requested:t.amount,destinationLimit:this.room(t.resource)});
      if(moved.amount>0){this.recordBuildingTransfer(b,'out',t.resource,moved.amount);if(t.forDelivery)c.needsDeposit=true;}
      if(t.kind==='collectbuilding'){c.worldPickup=null;if(sum(st.output)===0)st.flushOutput=false;}
     }
    }c.task=null;return;
   }
   if(t.buffered){
    if(!st||!this.at(b)||!st.enabled||st.job?.id!==t.jobId||st.job.workerId!==c.id){c.task=null;return;}
    const j=st.job,r=this.recipe(b,j.recipe);if(!r){c.task=null;return;}
    if(sum(st.output)+j.amount>this.capacity(b,'output')){this.releaseProduction(b,j.duration);c.task=null;return;}
    const roll=this.check(r.skill,2,t.label),attempt='attempt:'+j.id+':'+(j.attempts+1);
    if(!roll.success){this.worldEcs.settleProduction({id:attempt,worksiteId:'worksite:'+b.id,storage:st,jobId:j.id,success:false,retryProgress:j.duration*.4,outputCapacity:this.capacity(b,'output'),time:this.s.simTime,message:'Setback · inputs stay reserved'});this.xp('creature',1);this.changeFeeling('A batch needs another careful attempt',-1,roll.critical?5:2);this.log(c.name+' will retry this batch. Its materials stay at '+BUILDINGS[b.kind].name+'.','leaf');c.task=null;return;}
    const settled=this.worldEcs.settleProduction({id:attempt,worksiteId:'worksite:'+b.id,storage:st,jobId:j.id,success:true,retryProgress:0,outputCapacity:this.capacity(b,'output'),time:this.s.simTime,message:'Finished '+j.amount+' '+item(j.output).name});if(!settled.ok){c.task=null;return;}
    if(st.requests[j.recipe]>0)st.requests[j.recipe]--;
    const owner=this.creatures.find(c=>c.id===j.originId),o=owner?.orders.find(o=>o.id===(j.orderId||t.orderId));
    if(o&&['craft','gather'].includes(o.type)&&o.resource===j.output){o.done=Math.min(o.amount,(o.done||0)+j.amount);if(o.done>=o.amount)owner.orders=owner.orders.filter(x=>x!==o);}
    const metric=r.kind==='produce'?'gathered':'crafts';c.metrics[metric][j.output]=(c.metrics[metric][j.output]||0)+j.amount;this.record((r.kind==='produce'?'gather:':'craft:')+j.output,j.amount);
    if(j.output==='planks')c.stats.planksMade+=j.amount;if(r.kind==='produce')c.stats.gathered+=j.amount;
    this.practiceSkill(r.skill);this.xp('creature',5);this.xp('player',2);c.memory.lastAchievement=this.s.simTime;
    c.worldPickup={buildingId:b.id,resource:j.output,amount:j.amount};
    this.log(c.name+' finished '+j.amount+' '+item(j.output).name.toLowerCase()+'. Waiting in '+BUILDINGS[b.kind].name+' for collection.','bench');
    this.emit('production',st.lastMessage,{x:b.x,y:b.y,buildingId:b.id,resource:j.output,amount:j.amount});c.task=null;return;
   }
   if(t.worldGather||t.kind==='gather'||t.kind==='hunt'){
    const n=this.s.nodes.find(n=>n.id===t.nodeId),d=n&&W.node(n.kind),o=c.orders.find(o=>o.id===t.orderId);
    if(!d||!this.nodeAvailable(n)||!this.at(n)){c.task=null;return;}
    let amount=Math.min(d.batch+(this.specialization('gatherer')?1:0),this.remaining(n),this.room(d.resource));
    if(o?.type==='gather'&&o.resource===d.resource)amount=Math.min(amount,o.amount-o.done);
    if(amount<=0){c.task=null;return;}
    const roll=this.check(d.skill||'Per',3,t.label);if(!roll.success){this.xp('creature',1);this.changeFeeling('A gathering attempt did not work out',-1,roll.critical?4:1);c.task=null;return;}
    const harvested=this.worldEcs.harvest({id:this.physicalToken('harvest',t,n.id),depositId:'deposit:'+n.id,deposit:n,finite:d.mode==='finite',destinationId:'inventory:actor:'+c.id,destination:inv,resource:d.resource,requested:amount,destinationLimit:amount});amount=harvested.amount;
    if(amount<=0){c.task=null;return;}c.stats.gathered+=amount;c.metrics.gathered[d.resource]=(c.metrics.gathered[d.resource]||0)+amount;this.record('gather:'+d.resource,amount);
    if(o&&((o.type==='gather'&&o.resource===d.resource)||o.type==='hunt')){o.done=Math.min(o.amount,(o.done||0)+amount);if(o.done>=o.amount)c.orders=c.orders.filter(x=>x!==o);}
    if(d.skill)this.practiceSkill(d.skill);this.xp('creature',3);this.xp('player',1);if(Math.floor((c.stats.gathered-amount)/15)!==Math.floor(c.stats.gathered/15))this.researchGain(1);
    c.memory.lastAchievement=this.s.simTime;this.log(c.name+' gathered '+amount+' '+item(d.resource).name.toLowerCase()+'.'+(d.mode==='finite'?' '+n.stock+' remain in this deposit.':''),d.resource);
    this.emit('harvest','+'+amount+' '+item(d.resource).name,{x:n.x,y:n.y,resource:d.resource,amount});
    if(n.stock===0&&d.mode==='finite')this.emit('notice',d.name+' is exhausted. Select another source.');c.task=null;return;
   }
   super.finishTask(t);if(t.kind==='build')this.syncBuildings();
  }
  releaseDetachedWork(){for(const b of this.s.buildings){const j=b.storage?.job;if(j&&j.workerId&&!this.creatures.some(c=>c.id===j.workerId&&!c.activeQuest&&c.task?.jobId===j.id))this.releaseProduction(b,j.progress);}}
  care(kind){const r=super.care(kind);if(r.ok)this.releaseDetachedWork();return r;}
  cancel(id){const r=super.cancel(id);if(r.ok){for(const b of this.s.buildings)if(b.storage?.job?.orderId===id)b.storage.job.orderId=null;this.releaseDetachedWork();}return r;}
  cancelEquipment(id){const r=super.cancelEquipment(id);if(r.ok)this.releaseDetachedWork();return r;}
  pauseOrder(id,value){
   const issue=this.interactionIssue();if(issue)return fail(issue);
   const order=this.s.orders.find(o=>o.id===id);if(!order)return fail('That plan is no longer available.');
   if(value!==undefined&&typeof value!=='boolean')return fail('Choose paused or running.');
   order.paused=value===undefined?!order.paused:value;
   const t=this.actor.task;
   if(order.paused&&t?.orderId===id){const b=this.s.buildings.find(b=>b.id===t.buildingId);if(t.buffered&&b?.storage.job?.id===t.jobId)this.releaseProduction(b,Math.min(t.duration,t.elapsed));this.actor.task=null;}
   this.releaseDetachedWork();return ok();
  }
  depart(){const r=super.depart();if(r)this.releaseDetachedWork();return r;}
  upgradeEffect(b,level=b.level+1){if(PROFILE(b.kind)?.production)return '+'+((level-1)*4)+' input slots and +'+((level-1)*6)+' output slots. Creature work and physical deliveries are still required.';return super.upgradeEffect(b,level);}
  configureBuilding(id,command,value){
   const b=this.s.buildings.find(b=>b.id===id),st=b?.storage;if(!st)return fail('This building has no production inventory.');
   if(command==='enabled'){
    if(typeof value!=='boolean')return fail('Choose running or paused.');st.enabled=value;
    if(!value)for(const c of this.creatures)if(c.task?.buildingId===id&&c.task.buffered){if(st.job)this.releaseProduction(b,Math.min(st.job.duration,c.task.elapsed));c.task=null;}
   }else if(command==='priority'){if(!isInt(value,0,2))return fail('Choose low, normal or high priority.');st.priority=value;}
   else if(command==='flush')st.flushOutput=true;
   else if(command==='reclaim'){st.emptyInputs=true;st.enabled=false;for(const c of this.creatures)if(c.task?.buildingId===id&&c.task.buffered){if(st.job)this.releaseProduction(b,Math.min(st.job.duration,c.task.elapsed));c.task=null;}}
   else if(command==='batch'||command==='target'){
    const {recipe:id,amount}=value||{};if(!this.recipe(b,id)||!isInt(amount,command==='batch'?1:0,command==='batch'?12:48))return fail('Choose a supported recipe and quantity.');
    if(command==='batch'){if((st.requests[id]||0)+amount>12)return fail('Finish the queued batches first.');st.requests[id]=(st.requests[id]||0)+amount;}else st.targets[id]=amount;
   }else if(command==='clear'){st.requests={};st.targets={};}
   else return fail('Unknown building instruction.');
   return ok();
  }
  buildingStatus(b){
   const st=b.storage,p=PROFILE(b.kind);if(!st)return {label:b.kind==='storehouse'?'Shared warehouse':'A place to belong',kind:'quiet',detail:b.kind==='storehouse'?'Only stock deposited here is sellable.':'No production inventory.'};
   if(!st.enabled)return {label:'Paused',kind:'paused',detail:st.job?'The paid batch keeps its progress and reserved inputs.':'No new work or ingredient deliveries. Outputs can still be collected.'};
   if(st.job&&this.originatingOrder(st.job)?.paused)return {label:'Plan paused',kind:'paused',detail:'The originating creature’s craft order is paused. Reserved supplies and progress stay here.'};
   if(st.job){const worker=this.creatures.find(c=>c.id===st.job.workerId);return {label:worker?'Working':'Waiting for a creature',kind:'working',detail:worker?worker.name+' · '+Math.round(100*st.job.progress/st.job.duration)+'% of this attempt.':'A qualified creature can resume this paid batch.'};}
   const n=p?.requiresNode?this.nodeAt(b.x,b.y):null;if(p?.requiresNode&&(!n||n.kind!==p.requiresNode||!this.nodeAvailable(n)))return {label:n?.stock===0?'Node exhausted':'Missing required node',kind:'blocked',detail:'This place cannot start another batch here. Stored output is still available.'};
   const demand=this.buildingRecipes(b).filter(r=>(st.requests[r.id]||0)>0||(st.targets[r.id]||0)>this.demandStock(r.output));
   if(!demand.length)return {label:sum(st.output)?'Ready for collection':'On demand',kind:sum(st.output)?'output':'quiet',detail:sum(st.output)?'Produced goods are here, not in the warehouse.':'Set a stock target or let a creature request a recipe.'};
   const r=demand[0],substrate=I.substrateIssue(this,b,r);if(substrate)return {label:substrate,kind:'blocked',detail:'This recipe requires '+r.depletion+' units from its site. '+(n?this.remaining(n):0)+' remain; stored output is still available.'};
   if(sum(st.output)+r.amount>this.capacity(b,'output'))return {label:'Output full',kind:'blocked',detail:'A creature must empty the output tray before production can continue.'};
   const worker=this.creatures.some(c=>!c.activeQuest&&c.skills[r.skill]);if(!worker)return {label:'Needs a skilled creature',kind:'blocked',detail:'Learn '+SKILLS[r.skill].short+' or wait for a trained companion to return.'};
   const missing=Object.entries(r.cost).filter(([id,q])=>(st.input[id]||0)<q);
   if(missing.length)return {label:'Waiting for supplies',kind:'supply',detail:missing.map(([id,q])=>(q-(st.input[id]||0))+' '+item(id).name.toLowerCase()).join(', ')+' must arrive at this building.'};
   return {label:'Ready to work',kind:'ready',detail:'Ingredients are in place. Creatures take care of urgent needs before working.'};
  }
  export(){const out=super.export();out.version=6;out.state.version=6;return out;}

 };return WorldLayer;}
 function validateWorldState(s){
  const bad=msg=>{throw Error('World save: '+msg);};
  const configuration=W.validate(W.content);if(!configuration.ok)bad(configuration.errors.join('; '));
  if(!s.world||s.world.version!==1||!isInt(s.world.sequence,1,1e9)||!Array.isArray(s.world.transfers)||s.world.transfers.length>60)bad('invalid world bookkeeping');
  const inv=(v,where)=>{if(!v||Array.isArray(v)||typeof v!=='object')bad(where+' must be an inventory');for(const [id,n]of Object.entries(v))if(!item(id)||!isInt(n,0,1e7))bad('invalid '+where+' item');};
  const ids=new Set(),tiles=new Set();for(const n of s.nodes){if(ids.has(n.id)||tiles.has(n.x+','+n.y)||!W.node(n.kind))bad('unknown or duplicate node');ids.add(n.id);tiles.add(n.x+','+n.y);if(!isInt(n.stock,0,1000)||!isInt(n.max,1,1000)||n.stock>n.max)bad('invalid node stock');}
  const bids=new Set(s.buildings.map(b=>b.id));if(bids.size!==s.buildings.length)bad('duplicate building IDs');
  const creatures=s.colony.creatures;I.validateIdentities(s);
  for(const b of s.buildings){const st=b.storage,p=PROFILE(b.kind);if(!p){if(st)bad('inventory on an unsupported building');continue;}if(!st)bad('missing building inventory');inv(st.input,'building input');inv(st.output,'building output');
   if(sum(st.input)>p.inputCapacity+((b.level||1)-1)*4||sum(st.output)+(st.job?.amount||0)>p.outputCapacity+((b.level||1)-1)*6)bad('building inventory exceeds its capacity');
   if(typeof st.enabled!=='boolean'||!isInt(st.priority,0,2)||!isInt(st.completed)||typeof st.lastOutput!=='number'||!Number.isFinite(st.lastOutput))bad('invalid production settings');
   const recs=WorldLayer.prototype.buildingRecipes.call({},b);
   for(const key of ['targets','requests']){if(!st[key]||typeof st[key]!=='object'||Array.isArray(st[key]))bad('invalid '+key);for(const [id,q]of Object.entries(st[key]))if(!recs.some(r=>r.id===id)||!isInt(q,0,key==='targets'?48:12))bad('invalid production '+key);}
   if(p.requiresNode&&!s.nodes.some(n=>n.x===b.x&&n.y===b.y&&n.kind===p.requiresNode))bad('missing substrate below '+BUILDINGS[b.kind].name);
   const j=st.job;if(j){const r=recs.find(r=>r.id===j.recipe);if(!r||j.output!==r.output||!isInt(j.amount,r.amount,r.amount+1)||j.duration!==r.time||!Number.isFinite(j.progress)||j.progress<0||j.progress>j.duration||!isInt(j.attempts,0,1e7)||!I.sameQuantities(j.cost,r.cost)||typeof j.id!=='string'||!creatures.some(c=>c.id===j.originId))bad('invalid paid batch');if(j.workerId!==null&&!creatures.some(c=>c.id===j.workerId&&c.task?.jobId===j.id))bad('invalid batch worker');}
  }
  for(const c of creatures){
   for(const key of ['worldSupply','worldPickup'])if(c[key]){const v=c[key];if(!bids.has(v.buildingId)||!item(v.resource)||!isInt(v.amount,1,128))bad('invalid carried logistics intent');}
   const t=c.task;if(t&&(CUSTOM.includes(t.kind)||t.buffered)){const b=s.buildings.find(b=>b.id===t.buildingId);if(!b?.storage||t.target?.x!==b.x||t.target?.y!==b.y)bad('invalid building task destination');if(t.buffered){if(b.storage.job?.id!==t.jobId||b.storage.job?.workerId!==c.id||b.storage.job.recipe!==t.resource)bad('orphaned building work');}else if(!isInt(t.amount,1,128))bad('invalid transfer amount');}
  }
  for(const t of s.world.transfers)if(!bids.has(t.buildingId)||!creatures.some(c=>c.id===t.actorId)||!item(t.resource)||!isInt(t.amount,1,128)||!['in','out'].includes(t.direction)||!Number.isFinite(t.time)||typeof t.name!=='string'||t.name.length>24)bad('invalid transfer record');
 }
 function installFactories(){
  const oldWorkshop=L.createWorkshopDemo,oldColony=L.createColonyDemo;
  L.createWorkshopDemo=()=>{const old=oldWorkshop();return Composition.constructThrough('world-simulation',old.export().state,{demo:true});};
  L.createColonyDemo=()=>{const old=oldColony();return Composition.constructThrough('world-simulation',old.export().state,{demo:true});};
  L.createWorldDemo=()=>{
   const e=L.createColonyDemo();e.s.player.coins=640;e.s.rp=42;
   for(const c of e.creatures){for(const k of ['woodcraft','stonework','woodwork','fiberwork','claywork','pottery','milling','baking','gardening','masonry','firekeeping']){c.skills[k]=true;c.researched[k]=true;c.rpg.points[k]=4;}c.orders=[];c.training=null;c.learning.queue=[];c.stockTargets=Object.fromEntries(Object.keys(RES).map(id=>[id,0]));c.needs={food:85,water:86,energy:94,comfort:80,joy:80};c.task=null;}
   e.syncBuildings({preserveSeededStock:true});
   const bench=e.s.buildings.find(b=>b.kind==='bench');bench.storage.input={wood:4};bench.storage.output={planks:2};bench.storage.requests={rope:2};
   const kiln=e.s.buildings.find(b=>b.kind==='kiln');if(kiln){kiln.storage.input={clay:3};kiln.storage.requests={bricks:2};}
   e.s.colony.warehouse.inventory.charcoal=4;e.s.colony.warehouse.inventory.fiber=12;
   e.s.world.transfers=[];e.s.colony.selectedId=null;e.s.started=true;e.s.paused=false;
   e.log('Look for resource nodes and inspect a workshop. Materials have to travel: source → satchel → input → output → warehouse.','leaf');return e;
  };
 }
 let baselineCache=null;
 function baseline(){
  if(!baselineCache){
   const state=Composition.constructThrough('colony').s;
   baselineCache={occupiedSites:new Set([...state.nodes,...state.buildings].map(o=>o.x+','+o.y)),reservedIds:new Set(state.nodes.map(n=>n.id))};
  }
  return baselineCache;
 }
 function siteIssues(d){const {occupiedSites,reservedIds}=baseline(),errors=[];for(const s of d.sites){if(terrain(s.x,s.y)!=='grass')errors.push('/sites/'+s.id+': choose a grass tile');if(occupiedSites.has(s.x+','+s.y))errors.push('/sites/'+s.id+': tile conflicts with a built-in resource or starter warehouse');if(reservedIds.has(s.id))errors.push('/sites/'+s.id+': ID is reserved by a built-in resource');}return errors;}
 L.WorldSystem={validateState:validateWorldState,siteIssues,sum,taskKinds:CUSTOM};
 Composition.register({id:'world-simulation',order:30,define:defineLayer,prepare:prepareWorld,initialize:initializeWorld,installFactories});
 if(typeof module!=='undefined'&&module.exports)module.exports=L;
})(typeof globalThis!=='undefined'?globalThis:this);
