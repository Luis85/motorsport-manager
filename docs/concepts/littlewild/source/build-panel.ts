/* Non-modal construction workbench. Draft ownership is explicit; the engine owns work. */
(function(root) {
  'use strict';
  root.LWBuildPanel = { create(ctx) {
    const e = ctx.esc, host = document.createElement('aside');
    host.id = 'build-panel'; host.className = 'world-panel build-panel'; host.hidden = true;
    host.setAttribute('aria-labelledby','build-panel-title'); document.getElementById('app').appendChild(host);
    const state = {open:false, detail:false, selected:null, search:'', category:'all', actorId:null, approach:'balanced', origin:null, placing:false};
    let invoker = null, lastKey = '';
    const button = (label,act,id='',cls='') => `<button type="button" class="${cls}" data-build="${act}" data-id="${e(id)}">${label}</button>`;
    function candidates() {
      return Object.entries(LW.BUILDINGS).filter(([id,b]) => ctx.engine().unlocked('buildings',id) &&
        (state.category==='all'||b.category===state.category) &&
        (b.name+' '+b.desc).toLowerCase().includes(state.search.toLowerCase().trim()));
    }
    function list() {
      const items = candidates();
      return `<p class="panel-hint">${items.length} researched blueprints · placing a plan costs no materials yet.</p>`+
        (items.map(([id,b]) => `<button class="build-row" data-build="select" data-id="${e(id)}" aria-pressed="${state.selected===id}"><span class="build-glyph">${ctx.icon(b.icon||'home')}</span><span><strong>${e(b.name)}</strong><small>${e(LW.CATEGORY_NAMES[b.category]||b.category||'Construction')}</small></span><span aria-hidden="true">›</span></button>`).join('') ||
        '<div class="panel-empty">No matching blueprints. Change the filter, or research another possibility.</div>');
    }
    function detail() {
      const b = LW.BUILDINGS[state.selected], engine=ctx.engine();
      if (!b) return '<p class="panel-hint">Choose a blueprint to compare its requirements.</p>';
      const actor=engine.creatures.find(c=>c.id===state.actorId), site=LWWorldContent.building(state.selected)?.requiresNode;
      const blocked=!actor?'Choose a companion.':actor.activeQuest?'This companion is away on a quest.':'';
      return `<div class="build-detail-head">${button('← All blueprints','list','','text-button')}<span class="panel-badge">PLAN, THEN BUILD</span></div>
        <div class="build-title-art">${ctx.icon(b.icon||'home')}<h3>${e(b.name)}</h3></div><p>${e(b.desc)}</p>
        <section class="panel-section"><h4>Materials for level 1</h4><div class="build-materials">${Object.entries(b.cost).map(([id,n])=>`<div><span>${ctx.icon(LW.RES[id]?.icon||'bag')}${e(LW.RES[id]?.name||id)}</span><strong>${n}</strong></div>`).join('')}</div><p class="panel-hint">Your companion sources and carries these supplies. Warehouse stock is not used remotely.</p></section>
        <section class="panel-section"><h4>Choose the builder</h4><label for="build-actor" class="sr-only">Assigned companion</label><select id="build-actor">${!state.actorId?'<option value="">Choose a companion…</option>':''}${engine.creatures.map(c=>`<option value="${e(c.id)}" ${c.id===state.actorId?'selected':''}>${e(c.name)}${c.activeQuest?' · away':''}</option>`).join('')}</select>
        <p class="panel-hint">${e(LW.SKILLS[b.skill]?.short||b.skill)}${actor?.skills[b.skill]?' · learned':' · needed before work can start'}.</p></section>
        <section class="panel-section"><label for="build-approach">Construction approach</label><select id="build-approach">${Object.entries(LW.APPROACHES).map(([id,a])=>`<option value="${e(id)}" ${state.approach===id?'selected':''}>${e(a.name)}</option>`).join('')}</select></section>
        <div class="panel-site">${ctx.icon('compass')}<span>${site?'Requires '+e(LWWorldContent.node(site).name.toLowerCase())+' on its own tile.':'Place on open, reachable ground. Keep entrances and resource approaches clear.'}</span></div>
        <p class="panel-hint" id="build-blocker">${e(blocked||'The world stays interactive. Drag to find a suitable place.')}</p>
        ${button('Choose a location →','place',state.selected,'btn primary full-width'+(blocked?' is-blocked':''))}`;
    }
    function render() {
      const bodyScroll=host.querySelector('.panel-body')?.scrollTop||0;
      host.innerHTML=`<header class="panel-header"><div><span class="eyebrow">SHAPE YOUR WORLD</span><h2 id="build-panel-title" tabindex="-1">Build a little possibility</h2></div>${button(ctx.icon('close'),'close','','icon-btn')}</header>
        <div class="panel-time"><span data-time-label></span>${button('Focus world','world','','text-button')}</div>
        <div class="panel-body">${state.detail?detail():`<label class="panel-search">${ctx.icon('search')}<input id="build-search" type="search" placeholder="Find a blueprint…" value="${e(state.search)}" aria-label="Find a blueprint"></label>
        <label class="panel-filter">Category<select id="build-category"><option value="all">All categories</option>${[...new Set(Object.values(LW.BUILDINGS).map(b=>b.category))].map(id=>`<option value="${e(id)}" ${state.category===id?'selected':''}>${e(LW.CATEGORY_NAMES[id]||id)}</option>`).join('')}</select></label><div id="build-results">${list()}</div>`}</div>
        <footer class="panel-footer">${button('Research','research','','btn small')}${button('Planner','planner','','btn small')}<span>F6 · world / panel</span></footer>`;
      host.querySelector('[data-build=close]').setAttribute('aria-label','Close build panel');
      host.querySelector('.panel-body').scrollTop=bodyScroll;
      const place=host.querySelector('[data-build=place]');if(place)place.disabled=place.classList.contains('is-blocked');
      syncTime();
    }
    function syncTime(){const label=host.querySelector('[data-time-label]');if(label)label.textContent=ctx.pauseStatus().reason;}
    function open(id=null,origin=null) {
      invoker=document.activeElement;state.open=true;state.placing=false;state.origin=origin;
      state.actorId=ctx.engine().selected?.id||state.actorId|| (ctx.engine().creatures.length===1?ctx.engine().creatures[0].id:null);
      if(id){state.selected=id;state.detail=true;}else state.detail=false;
      host.hidden=false;render();host.querySelector('#build-panel-title').focus({preventScroll:true});
    }
    function close(restore=true){state.open=false;state.placing=false;host.hidden=true;if(restore)(invoker?.isConnected?invoker:ctx.world().canvas).focus({preventScroll:true});}
    host.addEventListener('input',ev=>{if(ev.target.id==='build-search'){state.search=ev.target.value;host.querySelector('#build-results').innerHTML=list();}});
    host.addEventListener('change',ev=>{
      if(ev.target.id==='build-category'){state.category=ev.target.value;host.querySelector('#build-results').innerHTML=list();}
      if(ev.target.id==='build-actor'){state.actorId=ev.target.value;render();host.querySelector('#build-actor')?.focus();}
      if(ev.target.id==='build-approach')state.approach=ev.target.value;
    });
    host.addEventListener('click',ev=>{
      const b=ev.target.closest('[data-build]');if(!b||b.disabled)return;ev.stopPropagation();
      const act=b.dataset.build;
      if(act==='close')close();
      if(act==='select'){state.selected=b.dataset.id;state.detail=true;render();host.querySelector('h3')?.scrollIntoView({block:'nearest'});host.querySelector('[data-build=list]')?.focus();}
      if(act==='list'){state.detail=false;render();host.querySelector('[data-id="'+state.selected+'"]')?.focus();}
      if(act==='world')ctx.world().canvas.focus({preventScroll:true});
      if(act==='research'||act==='planner'){close(false);ctx.open(act==='research'?'v10-research':'plans');}
      if(act==='place'){
        const r=ctx.engine().commandActor(state.actorId,()=>({ok:true}));
        if(!r.ok){ctx.toast(r.reason,true);return;}
        ctx.engine().selectCreature(state.actorId);
        ctx.blueprint(state.selected,state.origin,state.actorId,state.approach);
        if(ctx.world().placement){state.placing=true;state.open=false;host.hidden=true;}
      }
    });
    host.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.stopPropagation();ev.preventDefault();close();}});
    return {state,host,open,close,render,syncTime,
      update(){if(!state.open)return;syncTime();const k=root.LWContent.registry.hash+'|'+ctx.engine().creatures.map(c=>c.id+!!c.activeQuest).join(',');if(lastKey&&lastKey!==k&&!host.contains(document.activeElement))render();lastKey=k;},
      focus(){(host.querySelector('input,button')||host).focus({preventScroll:true});},
      reset(){close(false);state.actorId=null;state.selected=null;state.search='';state.category='all';lastKey='';}
    };
  }};
})(typeof globalThis !== 'undefined' ? globalThis : this);
