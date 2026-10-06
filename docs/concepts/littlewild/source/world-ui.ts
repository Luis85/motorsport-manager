/* World-first interaction presentation. Authoritative commands remain in the colony engine.
 * Selecting, positioning, and inspecting must not consume RNG or alter personal inventories.
 * Choosing a context action temporarily suspends the simulation clock, not the stored pause setting.
 */
(function(root){
 'use strict';
 function create(h){
  const $=id=>document.getElementById(id),en=()=>h.engine(),art=()=>h.world(),esc=h.esc,ic=h.icon;
  const state={pinnedPosition:null,actorId:null,origin:null,tab:'care',returnContext:null,menu:'',geometryDirty:true,bounds:null,menuWidth:300,menuHeight:400,portraitKey:'',hintSeen:false};
  const panel=$('creature-context'),content=$('creature-context-content'),line=$('context-link'),more=$('world-more'),tools=$('world-toolbar');
  const cssEscape=v=>CSS.escape(String(v));
  function txt(id,v){const e=$(id);if(e&&e.textContent!==String(v))e.textContent=String(v);}
  function careReason(issue,c){return String(issue||'').replace('No snack in the pantry.',c.name+' has no meal or berries in their satchel.').replace('No stored water.',c.name+' carries no water.').replaceAll('Pip',c.name);}
  function selected(){return en().creatures.find(c=>c.id===state.actorId)||null;}
  function pauseReason(){return state.actorId&&!h.modal()?'Choosing an interaction':state.menu&&!h.modal()?'Browsing world tools':null;}
  function button(label,action,id='',icon='',cls=''){return `<button class="w7-button ${cls}" data-act="w7-${action}" data-id="${esc(id)}"${state.actorId?' data-actor="'+esc(state.actorId)+'"':''}>${icon?ic(icon):''}<span>${label}</span></button>`;}
  function measure(){
   const top=document.querySelector('.topbar').getBoundingClientRect(),dock=tools.getBoundingClientRect();
   const mobile=innerWidth<=700;const roster=document.querySelector('.cx-roster-strip').getBoundingClientRect();
   const planner=document.getElementById('v10-planner'),edge=planner&&!planner.hidden&&!mobile?planner.getBoundingClientRect().left-12:innerWidth-16;
   state.bounds={left:mobile?12:Math.min(210,innerWidth*.20),right:Math.max(mobile?260:550,edge),top:Math.max(top.bottom+12,mobile?roster.bottom+12:105),bottom:dock.top-16};
   if(state.bounds.bottom-state.bounds.top<180)state.bounds.top=top.bottom+8;
   if(!panel.hidden){const r=panel.getBoundingClientRect();state.menuWidth=r.width;state.menuHeight=r.height;}
   state.geometryDirty=false;
  }
  function ensureVisible(c){
   if(c.activeQuest)return;
   measure();const w=art(),p=w.toScreen(c.creature.x,c.creature.y),s=state.bounds;
   let desired=null;
   if(innerWidth<=700){if(w.camera.z<1.05)w.camera.z=1.05;const next=w.toScreen(c.creature.x,c.creature.y);p.x=next.x;p.y=next.y;desired={x:innerWidth/2,y:s.top+Math.max(66,1.30*42*Math.sqrt(2/3)*w.camera.z+42)};}
   else if(s.right-p.x<state.menuWidth+75&&p.x-s.left<state.menuWidth+75)desired={x:s.left+65,y:(s.top+s.bottom)/2};
   else if(!LWWorldLayout.isPointVisible({x:p.x,y:p.y-30*w.camera.z},s,55))desired={x:Math.max(s.left+100,(s.left+s.right)/2-130),y:(s.top+s.bottom)/2};
   if(desired){w.camera.x+=desired.x-p.x;w.camera.y+=desired.y-p.y;w.manual=true;w.limitCamera();w.lastDrawAt=0;}
  }
  function clear({restore=true,keepReturn=false}={}){
   const origin=state.origin;state.pinnedPosition=null;state.actorId=null;state.menu='';panel.hidden=true;more.hidden=true;line.toggleAttribute('hidden',true);state.portraitKey='';state.positionSignature='';
   $('world-more-button').setAttribute('aria-expanded','false');document.body.classList.remove('context-open','tools-open');
   document.querySelectorAll('#creature-roster button').forEach(b=>b.setAttribute('aria-expanded','false'));
   if(!keepReturn)state.returnContext=null;
   if(restore&&!h.modal()){const target=origin?.isConnected&&origin.offsetParent!==null?origin:$('world');target.focus({preventScroll:true});}
  }
  function openFor(id,origin=null,{focus=false,reframe=true,tab='care'}={}){
   const c=en().creatures.find(c=>c.id===id);if(!c||h.modal())return false;if(art().placement)h.cancelPlacement();
   if(innerWidth<=700&&document.body.classList.contains('planner-open'))root.Littlewild?.village.toggle(false);
   const r=en().selectCreature(id);if(!r.ok)return false;
   clear({restore:false});state.actorId=id;state.origin=origin||document.querySelector('#creature-roster [data-id="'+cssEscape(id)+'"]')||$('world');state.tab=tab;
   panel.hidden=false;document.body.classList.add('context-open');state.geometryDirty=true;
   renderContext();if(reframe)ensureVisible(c);paint();h.refresh();h.save();
   document.querySelector('#creature-roster [data-id="'+cssEscape(id)+'"]')?.scrollIntoView({block:'nearest',inline:'nearest'});
   txt('world-announcement',c.name+' selected. Interaction menu opened.'+(h.pauseStatus().running?' The world keeps running.':' Time is paused.'));
   if(focus&&state.actorId===id&&!h.modal())$('context-title')?.focus({preventScroll:true});
   return true;
  }
  function safeActor(b){
   const id=b?.dataset.actor||state.actorId;
   if(!id||en().selected?.id!==id||!en().creatures.some(c=>c.id===id)){h.toast('The selected companion changed. Select them again before acting.',true);clear({restore:false});return null;}
   return en().selected;
  }
  function renderContext(){
   const c=selected();if(!c){clear({restore:false});return;}
   const attention=LWPolicies.attention(en(),c),profile=LW.colony.profile(c.personality),load=en().load(c);
   const away=!!c.activeQuest;
   const header=`<header class="w7-context-head"><canvas id="context-portrait" width="100" height="110" aria-label="${esc(c.name)}’s outfit"></canvas><div><span class="w7-eyebrow">${away?'BEYOND THE GLADE':'YOUR COMPANION'}</span><h2 id="context-title" tabindex="-1">${esc(c.name)} <small>Lv. ${c.creature.level}</small></h2><p>${esc(profile.name)}</p></div><button class="w7-icon" data-act="w7-close" aria-label="Close creature menu">${ic('close')}</button></header>`;
   let body='';
   if(away){const q=c.activeQuest,remaining=q.status==='returning'?q.returnRemaining:Math.max(0,q.duration-q.elapsed);
    body=`<div class="w7-away">${ic('compass')}<strong>${esc(q.name)}</strong><p>${q.status==='returning'?'Returning home':'Exploring beyond the glade'} · ${Math.ceil(remaining)}s ${q.status==='returning'?'to return':'on the expedition, plus travel home'}.</p><p>No care, equipment changes or new orders until ${esc(c.name)} returns.</p>${button('Quest progress','panel','adventures','compass')}${q.status!=='returning'?button('Recall…','recall','','route','recall'):''}</div>`;
   }else{
    const labels=[['food','Food','berries'],['water','Water','water'],['energy','Energy','energy']];
    const needs=`<div class="w7-needs">${labels.map(([k,n,ico])=>`<div class="${c.needs[k]<30?'low':''}"><span>${ic(ico)}${n}<b>${Math.round(c.needs[k])}%</b></span><meter min="0" max="100" value="${Math.round(c.needs[k])}" aria-label="${esc(c.name)} ${n}"></meter></div>`).join('')}</div>`;
    const tabs=`<div class="w7-context-tabs" role="tablist" aria-label="Creature actions"><button role="tab" data-act="w7-context-tab" data-id="care" aria-selected="${state.tab==='care'}" tabindex="${state.tab==='care'?0:-1}">Care</button><button role="tab" data-act="w7-context-tab" data-id="plans" aria-selected="${state.tab==='plans'}" tabindex="${state.tab==='plans'?0:-1}">Plans & belongings</button></div>`;
    let actions='';
    if(state.tab==='care'){
     const interactions=en().interactions(c);
     actions=`<div class="w7-care-grid">${interactions.map(d=>{const reason=en().interactionReason(c,d.instance);return `<button class="${d.eventOnly?'v10-event-action':''}" data-act="w7-interact" data-id="${esc(d.instance)}" data-actor="${esc(c.id)}" aria-disabled="${!!reason}" title="${esc(reason||d.description)}">${ic(d.icon)}<span><strong>${esc(d.label)}</strong><small>${esc(reason||(d.eventOnly?'Recent event · '+Math.max(0,Math.ceil(d.expires-en().s.simTime))+'s remaining':d.handler==='care'&&['feed','water'].includes(d.action)?'From this satchel':'A shared moment'))}</small></span></button>`;}).join('')}</div><p id="context-feedback" class="w7-feedback" role="status" hidden></p><p class="w7-own-supplies">${ic('bag')} Gifts and provisions must be carried. ${button('Satchel ↗','panel','satchel')}</p><button class="w7-button" data-act="ci-creature" data-id="${esc(c.id)}">${ic('heart')}<span>Creature interactions</span></button>`;
    }else{
     actions=`<div class="w7-secondary-needs"><span>Comfort <b>${Math.round(c.needs.comfort)}%</b></span><span>Joy <b>${Math.round(c.needs.joy)}%</b></span></div><div class="w7-route-grid">${[['training','Learn & practice','book'],['construction','Build a place','home'],['outfit','Outfit','bag'],['adventures','Quests','compass'],['plans','Plan board','plan'],['suggest','Suggest a task','plus']].filter(([id])=>id!=='adventures'||en().unlocked('features','quests')).map(([id,label,ico])=>button(label,'panel',id,ico)).join('')}</div><div class="w7-context-links">${button('Character','panel','character','star')}${button('Personality','panel','feelings','joy')}${button('Allowance','panel','story','coin')}${button('Satchel','panel','satchel','bag')}${button('Rename','panel','rename','edit')}</div><label class="w7-focus" for="context-focus">Encourage a little…<select id="context-focus" data-actor="${esc(c.id)}">${Object.entries({balanced:'Balance',cozy:'Self-care',builder:'Building',curious:'Curiosity'}).map(([id,name])=>`<option value="${id}" ${c.focus===id?'selected':''}>${name}</option>`).join('')}</select></label>`;
    }
    body=`${needs}<div class="w7-intention"><span class="w7-mood">${ic(attention.kind==='mood'?'joy':'leaf')}${esc(attention.label)}</span><span>${load.kg.toFixed(1)} kg · ${esc(load.label)}</span></div><div class="w7-thought"><span>${esc(c.task?.label||'Taking in the glade')}</span>${button('Why?','panel','behavior')}</div>${tabs}<div role="tabpanel" aria-label="${state.tab==='care'?'Care':'Plans and belongings'}">${actions}</div>`;
   }
   const signature=JSON.stringify([c.id,state.tab,away,c.activeQuest?.status,header,body]);
   if(signature!==state.contextSignature){
    const active=panel.contains(document.activeElement)?document.activeElement:null;const act=active?.dataset.act,id=active?.dataset.id,activeId=active?.id;const scroll=content.scrollTop;
    root.LWPresentation.reconcile(content,header+body+`<div class="v14-context-location"><span id="context-location">Beside your companion</span><button data-act="w7-locate" aria-label="Locate selected companion" ${away?'disabled title="Your companion is away; use Quest progress instead."':''}>Locate</button></div><footer class="w7-context-footer">${ic('pause')} <span data-time-label>Paused while choosing</span> <button data-act="w7-close">Back to the glade</button></footer>`);
    state.contextSignature=signature;content.scrollTop=scroll;
    if(activeId&&!h.modal())content.querySelector('#'+cssEscape(activeId))?.focus({preventScroll:true});
    else if(act&&!h.modal()){const replacement=content.querySelector('[data-act="'+cssEscape(act)+'"]'+(id?'[data-id="'+cssEscape(id)+'"]':''));if(replacement!==active)replacement?.focus({preventScroll:true});}
   }
   const pc=$('context-portrait'),portraitKey=JSON.stringify([c.id,c.equipment,root.LWFidelity.revision(),root.LWFidelity.mood(c)]);if(pc&&state.portraitKey!==portraitKey){const ctx=pc.getContext('2d');ctx.clearRect(0,0,100,110);ctx.imageSmoothingEnabled=false;LWArt.pip(ctx,50,98,2.15,1,en().mood(c),1,'idle',false,c);state.portraitKey=portraitKey;}
   const rb=document.querySelector('#creature-roster [data-id="'+cssEscape(c.id)+'"]');rb?.setAttribute('aria-expanded','true');
  }
  function paint(){
   if(!state.actorId||panel.hidden||h.modal())return;
   if(state.geometryDirty){measure();state.pinnedPosition=null;}const c=selected();if(!c)return;
   const s=state.bounds;
   let anchor;
   if(c.activeQuest){const rb=document.querySelector('#creature-roster [data-id="'+cssEscape(c.id)+'"]')?.getBoundingClientRect();anchor=rb?{x:rb.right+4,y:rb.top+rb.height/2}:{x:s.left+20,y:s.top+30};}
   else{const rendered=art().creatureAnchor?.(c.id);const p=rendered?.context||art().toScreen(c.creature.x,c.creature.y,.67);anchor={x:p.x,y:p.y};}
   const mobile=innerWidth<=700;const gap=c.activeQuest?28:Math.max(30,25*art().camera.z+12);
   const menuSafe=mobile?{...s,top:Math.max(s.top,(state.pinnedPosition?.anchorY??anchor.y)+gap)}:s;
   const maxHeight=Math.max(120,menuSafe.bottom-menuSafe.top);
   if(panel.style.maxHeight!==maxHeight+'px'){panel.style.maxHeight=maxHeight+'px';state.geometryDirty=true;}
   const pos=state.pinnedPosition||LWWorldLayout.placePopover(anchor,{width:state.menuWidth,height:Math.min(state.menuHeight,maxHeight)},menuSafe,mobile?'bottom':'right',gap);
   state.pinnedPosition={...pos,anchorY:state.pinnedPosition?.anchorY??anchor.y};
   const inView=anchor.x>8&&anchor.x<innerWidth-8&&anchor.y>60&&anchor.y<innerHeight-70;
   txt('context-location',c.activeQuest?'Away on a quest':!inView?'Off-screen · use Locate':h.pauseStatus().running?'World running · actions stay here':art().creatureAnchor?.(c.id)?.inside?'Inside · location marked above the roof':'Beside your companion');
   const positionSignature=[pos.x,pos.y,pos.width,pos.height,pos.side,anchor.x,anchor.y,innerWidth,innerHeight].join('|');if(positionSignature===state.positionSignature)return;state.positionSignature=positionSignature;
   const transform=`translate3d(${Math.round(pos.x)}px,${Math.round(pos.y)}px,0)`;if(panel.style.transform!==transform)panel.style.transform=transform;panel.dataset.side=pos.side;
   const tipX=pos.side==='right'?pos.x:pos.side==='left'?pos.x+pos.width:pos.tip.x,tipY=pos.side==='bottom'?pos.y:pos.side==='top'?pos.y+pos.height:pos.tip.y;
   const distance=Math.hypot(anchor.x-tipX,anchor.y-tipY);line.toggleAttribute('hidden',!inView||distance>260);root.LWPresentation.setAttribute(line,'viewBox',`0 0 ${innerWidth} ${innerHeight}`);

   $('context-link-path').setAttribute('d',`M${anchor.x},${anchor.y} L${tipX},${tipY}`);$('context-link-dot').setAttribute('cx',anchor.x);$('context-link-dot').setAttribute('cy',anchor.y);
  }
  function update(){
   const e=en(),c=e.selected;
   for(const a of e.creatures){const b=document.querySelector('#creature-roster [data-id="'+cssEscape(a.id)+'"]');if(!b)continue;
    b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls','creature-context');b.setAttribute('aria-expanded',String(state.actorId===a.id&&!h.modal()));
    let canvas=b.querySelector('canvas');if(!canvas){canvas=document.createElement('canvas');canvas.width=80;canvas.height=90;canvas.className='w7-roster-portrait';canvas.setAttribute('aria-hidden','true');b.prepend(canvas);}
    const key=JSON.stringify([a.personality,a.equipment,!!a.activeQuest,root.LWFidelity.mood(a),root.LWFidelity.revision()]);if(canvas.dataset.key!==key){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,80,90);ctx.imageSmoothingEnabled=false;LWArt.pip(ctx,40,81,1.8,1,'Content',1,'idle',false,a);canvas.dataset.key=key;}
   }
   txt('roster-count',e.creatures.length);txt('world-selection-hint',c?c.name+' selected · click to spend time together':'Select a companion in the glade or the roster');
   const chance=e.s.colony.board.offers.length;txt('world-quest-count',chance);$('world-quest-count').hidden=chance===0;
   txt('world-objective-title',c?(e.quest()?.title||LW.PATHS[c.learning.path]?.name||'One little step at a time'):'A shared home');
   txt('world-objective-caption',c?'Our story & allowance ↗':'Get to know your creatures ↗');
   $('world-objective').dataset.id=c?'story':'community';
   txt('world-status-label',h.modal()?'Planning · paused':pauseReason()?'Choosing · paused':art().placement?'Placement · paused':e.s.paused?'Paused':'Life in the glade');
   const selecting=!!pauseReason()&&h.pauseStatus().automatic;if(selecting){$('pause-button').innerHTML=ic('play');$('pause-button').setAttribute('aria-label','Continue world');$('pause-button').title='Close this menu and continue';$('pause-badge').classList.remove('show');}
   if(state.actorId&&(!c||c.id!==state.actorId)){clear({restore:false});}
   art().contextChoosing=!!state.actorId;if(state.actorId)renderContext();
   document.body.classList.toggle('world-placing',!!art().placement);document.body.classList.toggle('world-started',!!e.s.started);
  }
  function suspend(){state.modalSelection=en().selected?.id||null;if(state.actorId)state.returnContext={id:state.actorId,tab:state.tab,origin:state.origin};clear({restore:false,keepReturn:true});}
  function resume(){const r=state.returnContext;state.returnContext=null;const c=en().selected;if(r&&c?.id===r.id)openFor(r.id,r.origin,{focus:true,reframe:false,tab:r.tab});else if(c&&state.modalSelection!==c.id)openFor(c.id,null,{focus:true});state.modalSelection=c?.id||null;}
  function inspect(tile){if(tile.actorId)return openFor(tile.actorId,$('world'),{focus:true});if(state.actorId||state.menu){clear({restore:false});h.refresh();return true;}return false;}
  function cameraGesture(){if(pauseReason()){clear({restore:false});h.refresh();}}
  function action(a,id,b,event){
   if(a==='w7-locate'){const c=selected();if(c&&!c.activeQuest){state.pinnedPosition=null;state.geometryDirty=true;ensureVisible(c);const w=art();w.focus(c.creature.x,c.creature.y);ensureVisible(c);w.invalidate();paint();}return true;}
   if(['zoom-in','zoom-out','home-view','follow'].includes(a)&&pauseReason())cameraGesture();
   if(a==='cx-select'&&!h.modal())return openFor(id,b,{focus:true});
   if((a==='pause'||a==='speed')&&pauseReason()&&h.pauseStatus().automatic){clear({restore:false});en().s.paused=false;if(a==='speed')en().s.speed=Number(id);h.refresh();h.save();return true;}
   if(a==='tab'){if(id==='care'){if(en().selected)openFor(en().selected.id,b,{focus:true});else h.open('community');}else h.open(id==='build'?'construction':id==='train'?'training':'warehouse');return true;}
   if(a==='buddy-status'){if(en().selected)openFor(en().selected.id,b,{focus:true});else h.open('community');return true;}
   if(!a.startsWith('w7-'))return false;
   if(a==='w7-close'){clear();h.refresh();return true;}
   if(a==='w7-context-tab'){state.tab=id;state.contextSignature='';renderContext();paint();content.querySelector('[data-act="w7-context-tab"][data-id="'+cssEscape(id)+'"]')?.focus();return true;}
   if(a==='w7-more'){
    const was=state.menu;clear({restore:false});if(!was){state.menu='more';more.hidden=false;state.origin=b;document.body.classList.add('tools-open');$('world-more-button').setAttribute('aria-expanded','true');more.querySelector('button')?.focus();}h.refresh();return true;
   }
   if(a==='w7-panel'){
    if(!b.dataset.actor&&state.actorId)clear({restore:false});
    if(b.dataset.actor&&!safeActor(b))return true;
    if(en().selected?.activeQuest&&b.dataset.actor&&id!=='adventures'){h.toast('Only quest inspection and recall are available while away.',true);return true;}
    h.open(id);return true;
   }
   if(a==='w7-recall'){if(!safeActor(b))return true;h.colonyAction('cx-recall','',b);return true;}
   if(a==='w7-interact'){if(!safeActor(b))return true;const r=en().interact(state.actorId,id);if(r.ok)clear({restore:false});else{txt('context-feedback',r.reason);$('context-feedback').hidden=false;}h.result(r);return true;}
   if(a==='w7-care'){
    if(!safeActor(b))return true;const issue=en().careIssue(id);if(issue){const reason=careReason(issue,en().selected);txt('context-feedback',reason);if($('context-feedback'))$('context-feedback').hidden=false;txt('world-announcement',reason);state.geometryDirty=true;return true;}
    const r=en().care(id);if(r.ok)clear({restore:false});h.result(r);if(r.ok){$('world').focus({preventScroll:true});txt('world-announcement',en().selected.name+' · '+({feed:'Snack offered',water:'Water offered',bond:'Time together',praise:'Effort noticed',soothe:'Reassurance offered',space:'Room to breathe'}[id]));}return true;
   }
   if(a==='w7-find'){if(en().selected)openFor(en().selected.id,b,{focus:true});else h.open('community');return true;}
   return false;
  }
  document.addEventListener('keydown',ev=>{if(ev.target.closest('#tile-context'))return;
   if(h.modal()||ev.ctrlKey||ev.metaKey||ev.altKey||/INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)||ev.target.isContentEditable)return;
   if(ev.key==='Escape'&&pauseReason()){ev.preventDefault();ev.stopImmediatePropagation();clear();h.refresh();return;}
   if(panel.contains(ev.target)&&ev.target.closest('[role=tablist]')&&['ArrowLeft','ArrowRight','Home','End'].includes(ev.key)){
    ev.preventDefault();ev.stopImmediatePropagation();state.tab=ev.key==='Home'?'care':ev.key==='End'?'plans':state.tab==='care'?'plans':'care';state.contextSignature='';renderContext();paint();content.querySelector('[data-act="w7-context-tab"][data-id="'+state.tab+'"]')?.focus();return;
   }
   if(ev.code==='Space'&&!ev.target.closest('button,a')&&pauseReason()&&h.pauseStatus().automatic){ev.preventDefault();ev.stopImmediatePropagation();clear({restore:false});en().s.paused=false;h.refresh();h.save();return;}
   if(ev.repeat)return;
   if(ev.key.toLowerCase()==='b'){ev.preventDefault();ev.stopImmediatePropagation();h.open('construction');}
   else if(ev.key.toLowerCase()==='c'){ev.preventDefault();ev.stopImmediatePropagation();if(en().selected)openFor(en().selected.id,$('world'),{focus:true});else h.open('community');}
   else if(ev.key==='['||ev.key===']'){ev.preventDefault();ev.stopImmediatePropagation();const list=en().creatures,at=list.indexOf(en().selected),i=(at+(ev.key===']'?1:-1)+list.length)%list.length;openFor(list[i].id,null,{focus:true});}
   else if(ev.key.toLowerCase()==='l'){ev.preventDefault();ev.stopImmediatePropagation();h.open('training');}
   else if(ev.key.toLowerCase()==='q'){ev.preventDefault();ev.stopImmediatePropagation();h.open('adventures');}
   else if(ev.key.toLowerCase()==='i'){ev.preventDefault();ev.stopImmediatePropagation();h.open('warehouse');}
   else if(['1','2','3','4'].includes(ev.key)&&state.actorId){ev.preventDefault();ev.stopImmediatePropagation();const d=en().interactions(en().selected)[+ev.key-1];if(d)action('w7-interact',d.instance,{dataset:{actor:state.actorId}});}
  },true);
  document.addEventListener('pointerdown',ev=>{if(!state.menu||more.contains(ev.target)||ev.target.closest('#world-more-button'))return;clear({restore:false});h.refresh();},true);
  document.addEventListener('change',ev=>{if(ev.target.id!=='context-focus')return;const c=safeActor(ev.target);if(!c)return;const value=ev.target.value;if(!['balanced','cozy','builder','curious'].includes(value)||c.activeQuest)return;c.focus=value;h.save();h.refresh();txt('world-announcement',c.name+' is encouraged toward '+ev.target.selectedOptions[0].textContent.toLowerCase()+'.');});
  const observer=new ResizeObserver(()=>{state.geometryDirty=true;});observer.observe(panel);observer.observe(tools);observer.observe(document.querySelector('.topbar'));observer.observe(document.querySelector('.cx-roster-strip'));
  window.addEventListener('resize',()=>{state.geometryDirty=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(state.actorId){art().resize();ensureVisible(selected());paint();}}));});
  window.visualViewport?.addEventListener('resize',()=>{state.geometryDirty=true;});
  function afterInteraction(){state.returnContext=null;state.modalSelection=en().selected?.id||null;if(state.actorId)clear({restore:false});}
  return {update,paint,action,inspect,openFor,afterInteraction,clear,suspend,resume,pauseReason,cameraGesture,reset:()=>{clear({restore:false});state.returnContext=null;state.contextSignature='';},get state(){return{actorId:state.actorId,tab:state.tab,menu:state.menu,temporaryPause:!!pauseReason()};}};
 }
 root.LWWorldUI={create};
})(typeof globalThis!=='undefined'?globalThis:this);
