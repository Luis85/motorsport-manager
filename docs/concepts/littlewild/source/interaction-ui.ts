/// <reference path="./interaction-ui-contracts.d.ts" />
/* Creature interaction intent and detached status presentation. The world owns
 * eligibility, consent, movement, duel rounds, settlement and simulation time. */
(function(inputRoot:unknown){
 'use strict';
 interface Root {LWInteractions:{all():LWInteractionPresentation.Definition[]};LWWorldContent:{building(id:string):{name:string}|undefined;node(id:string):{name:string}|undefined};LWInteractionUI?:LWInteractionPresentation.Factory;}
 const root=inputRoot as Root;
 function create(h:LWInteractionPresentation.Host):LWInteractionPresentation.Api{
  const esc=h.esc,E=h.engine;
  const state:LWInteractionPresentation.State={sourceId:'player',scope:'creature',targetId:'',duelDefinitionId:'',feedback:'',error:false};
  const rendered=new WeakMap<HTMLElement,string>();
  const $=(id:string)=>document.getElementById(id);
  const button=(label:string,action:string,id='',disabled=false,reasonId='')=>`<button type="button" class="btn" data-act="ci-${action}" data-id="${esc(id)}" ${disabled?'disabled':''}${reasonId?' aria-describedby="'+esc(reasonId)+'"':''}>${esc(label)}</button>`;
  function reset(){Object.assign(state,{sourceId:'player',scope:'creature',targetId:'',duelDefinitionId:'',feedback:'',error:false});}
  function definitions(){return E().interactionDefinitions?.().definitions||root.LWInteractions.all();}
  function targets(){
   const e=E();
   if(state.scope==='creature')return e.creatures.map(c=>({id:c.id,label:c.name+(c.activeQuest?' · away':'')}));
   const list=state.scope==='building'?e.s.buildings:e.s.nodes;
   return list.map(x=>({id:x.id,label:(state.scope==='building'?root.LWWorldContent.building(x.kind)?.name:root.LWWorldContent.node(x.kind)?.name)||x.kind,x:x.x,y:x.y})).map(x=>({...x,label:x.label+' · '+x.x+', '+x.y}));
  }
  function normalize(){
   const e=E();
   if(state.sourceId!=='player'&&!e.creatures.some(c=>c.id===state.sourceId))state.sourceId='player';
   const list=targets();
   const selected=e.selected?.id;
   if(!list.some(t=>t.id===state.targetId))state.targetId=state.scope==='creature'&&selected&&list.some(t=>t.id===selected)?selected:list[0]?.id||'';
   const duels=definitions().filter(d=>d.executor==='duel');if(!duels.some(d=>d.id===state.duelDefinitionId))state.duelDefinitionId=duels[0]?.id||'';
  }
  function prepare(target:LWInteraction.Target|null=null){
   state.feedback='';state.error=false;
   if(target){state.scope=target.scope;state.targetId=target.id;}else{state.scope='creature';state.targetId=E().selected?.id||'';}
   normalize();
  }
  function target():LWInteraction.Target{return{scope:state.scope,id:state.targetId};}
  function sourceName(id:string){return id==='player'?'Guide':E().creatures.find(c=>c.id===id)?.name||id||'Companion';}
  function targetName(t:LWInteraction.Target){
   if(t?.scope==='creature')return sourceName(t.id);
   const e=E(),x=(t?.scope==='building'?e.s.buildings:e.s.nodes).find(x=>x.id===t?.id);
   return x?(t.scope==='building'?root.LWWorldContent.building(x.kind)?.name:root.LWWorldContent.node(x.kind)?.name)||x.kind:t?.id||'Unknown target';
  }
  function optionsMarkup(){
   if(!state.targetId)return '<p class="ci-empty">No '+esc(state.scope==='node'?'resource nodes':state.scope==='building'?'buildings':'creatures')+' to choose here yet.</p>';
   const options=E().interactionOptions(state.sourceId,target());
   return options.map((d,i)=>{const reasonId='ci-reason-'+i;return `<article class="ci-option"><div><h4>${esc(d.label)}</h4><p>${esc(d.description)}</p>${!d.available?`<p class="ci-reason" id="${reasonId}">${esc(d.reason||'This interaction is unavailable right now.')}</p>`:''}</div>${button(d.label,'request',d.id,!d.available,!d.available?reasonId:'')}</article>`;}).join('')||'<p class="ci-empty">No interactions for this pair yet. Try another initiator or target.</p>';
  }
  function label(record:{definitionId:string|null}){return definitions().find(d=>d.id===record.definitionId)?.label||record.definitionId||'Interaction';}
  function duelPlanningMarkup(){
   if(state.sourceId==='player'||state.scope!=='creature')return '<section class="ci-duel-planning"><h4>Friendly duels</h4><p>Choose a companion initiator and a creature target to encourage a duel search or stage the chosen pair.</p></section>';
   const duels=definitions().filter(d=>d.executor==='duel');if(!duels.length)return '<p class="ci-empty">This world has no friendly duel definitions.</p>';
   const view=E().interactionState(),source=E().creatures.find(c=>c.id===state.sourceId),name=sourceName(state.sourceId);
   const seekReason=E().gameSettings?.().duels===false?'Duels are disabled in Settings.':source?.activeQuest?name+' is away.':(view.active||[]).some(r=>r.sourceId===state.sourceId||r.target?.scope==='creature'&&r.target.id===state.sourceId)?name+' already has a pending or active interaction.':'';
   const option=state.targetId?E().interactionOptions(state.sourceId,target()).find(d=>d.id===state.duelDefinitionId):null;
   const stageReason=option?.available?'':option?.reason||'Choose a compatible creature pair.';
   return `<section class="ci-duel-planning" aria-labelledby="ci-duel-title"><h4 id="ci-duel-title">Make room for a friendly duel</h4><label class="ci-duel-definition" for="ci-duel-definition">Duel style<select id="ci-duel-definition">${duels.map(d=>`<option value="${esc(d.id)}" ${d.id===state.duelDefinitionId?'selected':''}>${esc(d.label)}</option>`).join('')}</select></label><p>Encouragement lets ${esc(name)} look for a willing partner as the world runs, waiting for an opportunity around their ordinary work.</p><div class="ci-duel-actions">${button('Encourage '+name+' to find a duel','seek-duel',state.duelDefinitionId,!!seekReason,seekReason?'ci-seek-reason':'')}${button('Stage this duel','stage-duel',state.duelDefinitionId,!!stageReason,stageReason?'ci-stage-reason':'')}</div>${seekReason?`<p id="ci-seek-reason" class="ci-reason">${esc(seekReason)}</p>`:''}${stageReason?`<p id="ci-stage-reason" class="ci-reason">${esc(stageReason)}</p>`:''}<p>Staging invites exactly ${esc(name)} and ${esc(targetName(target()))}. It does not force acceptance; the invited companion decides.</p></section>`;
  }
  function statusName(status:LWInteraction.Status):string{return {requested:'Awaiting response',active:'In progress',completed:'Completed',delegated:'Task started',declined:'Declined',cancelled:'Cancelled',expired:'Expired'}[status];}
  function rollSummary(name:string,roll:LWInteractionPresentation.Roll){return `${esc(name)} rolled ${esc(roll.total)} against ${esc(roll.target)} · ${roll.success?'success':'miss'} · margin ${roll.margin>0?'+':''}${esc(roll.margin)}`;}
  function statusRow(record:LWInteractionPresentation.Record,active:boolean){
   const phase=record.status;
   const detail=record.reason||'';
   const rounds=record.round||record.rounds?.length;
   const score=record.scores&&rounds?`<p class="ci-score">${esc(sourceName(record.sourceId))} ${esc(record.scores[0])} : ${esc(record.scores[1])} ${esc(targetName(record.target))}</p>`:'';
   const scoring=definitions().find(d=>d.id===record.definitionId)?.duel?.scoring;
   const rule=scoring==='margin'?'The larger margin wins, including when both creatures miss. Equal margins draw.':'Roll at or below your target to pass. If both pass, the larger margin wins. If both miss, the round draws.';
   const receipt=record.rounds?.length?`<details data-ci-rounds="${esc(record.id)}"><summary>Round results</summary><p>${rule}</p>${record.rounds.map(r=>`<div class="ci-round"><strong>Round ${esc(r.number)} · ${r.winnerId?esc(sourceName(r.winnerId))+' wins':'Draw'}</strong><p>${rollSummary(sourceName(record.sourceId),r.sourceRoll)}</p><p>${rollSummary(targetName(record.target),r.targetRoll)}</p></div>`).join('')}</details>`:'';
   const response=active&&record.status==='requested'&&record.target.scope==='creature'?`<div class="ci-response"><span>Answer as ${esc(targetName(record.target))}</span>${button('Accept','accept',record.id)}${button('Decline','decline',record.id)}</div>`:'';
   const timing=active&&record.status==='requested'?'<p>Companion response pending. Resume the world to let them decide.</p>':active&&record.status==='active'&&Number.isFinite(record.nextRoundAt)?`<p>Next round in ${Math.ceil(Math.max(0,record.nextRoundAt-E().s.simTime))}s of world time.</p>`:'';
   return `<article class="ci-status-row"><div><h4>${esc(label(record))}</h4><p>${esc(sourceName(record.sourceId))} → ${esc(targetName(record.target))}</p><strong>${esc(statusName(phase))}${rounds?' · Round '+esc(rounds):''}</strong>${score}${timing}${detail?`<p>${esc(detail)}</p>`:''}${record.winnerId?`<p>Winner: ${esc(sourceName(record.winnerId))}</p>`:''}${receipt}${response}</div>${active?button(record.status==='active'?'End duel':'Cancel request','cancel',record.id):''}</article>`;
  }
  function statusMarkup(){
   const view=E().interactionState(),active=view.active||[],history=view.history||[],seeks=view.seeks||[];
   const looking=seeks.length?`<section aria-labelledby="ci-seeks-title"><h3 id="ci-seeks-title">Looking for a duel</h3>${seeks.map(s=>`<article class="ci-status-row"><div><h4>${esc(sourceName(s.actorId))} is looking for a partner</h4><p>${esc(s.definitionId?label(s):'Any friendly duel')} · Waiting for a suitable opportunity</p><p>Search ends in ${Math.ceil(Math.max(0,s.expires-E().s.simTime))}s of world time. Work and consent still take priority.</p></div>${button('Stop looking','cancel-duel-seek',s.actorId)}</article>`).join('')}</section>`:'';
   return looking+`<section aria-labelledby="ci-active-title"><h3 id="ci-active-title">Happening now <span class="ci-count">${active.length}</span></h3>${active.map(r=>statusRow(r,true)).join('')||'<p class="ci-empty">No interactions underway. Companions may also invite each other as the world runs.</p>'}</section><section aria-labelledby="ci-history-title"><h3 id="ci-history-title">Recent moments</h3>${history.slice(0,8).map(r=>statusRow(r,false)).join('')||'<p class="ci-empty">Finished interactions will appear here.</p>'}</section>`;
  }
  function render(){
   normalize();
   const e=E(),list=targets();
   return `<div class="ci-workspace"><section aria-labelledby="ci-choose-title"><h3 id="ci-choose-title">Choose a shared moment</h3><div class="ci-selectors"><label for="ci-source">Initiator<select id="ci-source"><option value="player" ${state.sourceId==='player'?'selected':''}>Guide · you</option>${e.creatures.map(c=>`<option value="${esc(c.id)}" ${state.sourceId===c.id?'selected':''}>${esc(c.name)}${c.activeQuest?' · away':''}</option>`).join('')}</select></label><label for="ci-scope">Target type<select id="ci-scope">${([['creature','Creature'],['building','Building'],['node','Resource node']] as const).map(([id,name])=>`<option value="${id}" ${state.scope===id?'selected':''}>${name}</option>`).join('')}</select></label><label for="ci-target">Target<select id="ci-target" ${list.length?'':'disabled'}>${list.map(t=>`<option value="${esc(t.id)}" ${state.targetId===t.id?'selected':''}>${esc(t.label)}</option>`).join('')||'<option value="">None available</option>'}</select></label></div><p class="ci-help">Choose who starts and who receives the invitation. Companions decide whether to accept; duel rounds continue while the world runs.</p><div id="ci-duel-planning">${duelPlanningMarkup()}</div><div id="ci-options">${optionsMarkup()}</div><p id="ci-feedback" class="ci-feedback${state.error?' ci-reason':''}" role="status" aria-live="polite" tabindex="-1" ${state.feedback?'':'hidden'}>${esc(state.feedback)}</p></section><div id="ci-status">${statusMarkup()}</div></div>`;
  }
  function report(r:LWInteraction.Result,message:string){
   state.error=!r?.ok;state.feedback=r?.ok?message:r?.reason||'The request could not be completed. Choose again.';
   h.result(r,r?.ok?message:undefined);
   update();
   if(r?.ok)$('ci-feedback')?.focus({preventScroll:true});
  }
  function action(a:string,id:string){
   if(a==='ci-open'){prepare();h.open('v10-interactions');return true;}
   if(a==='ci-creature'){prepare({scope:'creature',id});h.open('v10-interactions');return true;}
   if(a==='ci-seek-duel'){normalize();report(E().dispatchCommand({id:'seek-duel',args:[state.sourceId,id||state.duelDefinitionId]}),sourceName(state.sourceId)+' will look for a willing partner while the world runs.');return true;}
   if(a==='ci-cancel-duel-seek'){report(E().dispatchCommand({id:'cancel-duel-seek',args:[id]}),sourceName(id)+' has stopped looking for a duel.');return true;}
   if(a==='ci-stage-duel'){normalize();report(E().dispatchCommand({id:'stage-duel',args:[id||state.duelDefinitionId,state.sourceId,state.targetId]}),'Invitation staged. The invited companion will decide whether to join.');return true;}
   if(a==='ci-request'){
    normalize();const r=E().dispatchCommand({id:'request-interaction',args:[id,state.sourceId,target()]});
    const pending=r?.ok&&E().interactionState().active.some(record=>record.id===r.interactionId);
    report(r,r?.taskStarted?'The creature will begin this task.':pending?'Invitation sent. Resume the world to follow what happens.':'Interaction completed.');return true;
   }
   if(a==='ci-cancel'){report(E().dispatchCommand({id:'cancel-interaction',args:[id]}),'Interaction cancelled.');return true;}
   if(a==='ci-accept'||a==='ci-decline'){
    const record=E().interactionState().active.find(r=>r.id===id);
    const r=record?.target.scope==='creature'?E().dispatchCommand({id:'respond-interaction',actorId:record.target.id,args:[id,a==='ci-accept']}):{ok:false,reason:'That invitation is no longer waiting for a response.'};
    report(r,a==='ci-accept'?'Invitation accepted.':'Invitation declined.');return true;
   }
   return false;
  }
  function change(el:{id:string;value:string}){
   if(!['ci-source','ci-scope','ci-target','ci-duel-definition'].includes(el.id))return false;
   if(el.id==='ci-source')state.sourceId=el.value;
   else if(el.id==='ci-scope'){if(el.value!=='creature'&&el.value!=='building'&&el.value!=='node')return false;state.scope=el.value;state.targetId='';}
   else if(el.id==='ci-duel-definition')state.duelDefinitionId=el.value;
   else state.targetId=el.value;
   state.feedback='';state.error=false;h.redraw();return true;
  }
  function replace(id:string,markup:string){
   const el=$(id);if(!el||rendered.get(el)===markup)return;
   if(!rendered.has(el)){const fragment=document.createElement('template');fragment.innerHTML=markup;if(el.innerHTML===fragment.innerHTML){rendered.set(el,markup);return;}}
   const active=document.activeElement instanceof HTMLElement?document.activeElement:null,inside=el.contains(active),focusId=active?.id,action=active?.dataset.act,dataId=active?.dataset.id;
   const opened=[...el.querySelectorAll<HTMLDetailsElement>('details[open]')].map(d=>d.dataset.ciRounds);
   el.innerHTML=markup;rendered.set(el,markup);
   for(const d of el.querySelectorAll<HTMLDetailsElement>('details'))d.open=opened.includes(d.dataset.ciRounds);
   if(inside){const next=focusId?$(focusId):[...el.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].find(b=>b.dataset.act===action&&b.dataset.id===dataId);(next||$('ci-target'))?.focus({preventScroll:true});}
  }
  function update(){
   if(h.modal()!=='v10-interactions'||!$('ci-options'))return;
   normalize();replace('ci-duel-planning',duelPlanningMarkup());replace('ci-options',optionsMarkup());replace('ci-status',statusMarkup());
   const feedback=$('ci-feedback');if(feedback){feedback.hidden=!state.feedback;feedback.textContent=state.feedback;feedback.classList.toggle('ci-reason',state.error);feedback.tabIndex=-1;}
  }
  return{render,action,change,update,prepare,reset,state};
 }
 root.LWInteractionUI={create};
})(globalThis);
