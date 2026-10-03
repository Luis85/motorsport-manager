/* Application shell. Only explicit user actions write state; the simulation owns every movement decision. */
(function () {
    'use strict';
    const { Engine, SKILLS, BUILDINGS, RES, RECIPES, CONTRACTS, threshold, terrain, clamp } = LW;
    const $ = id => document.getElementById(id), esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${esc(name)}"/></svg>`;
    const text = (id, value) => { const e = $(id); if (e && e.textContent !== String(value))
        e.textContent = value; };
    const html = (id, value) => { const e = $(id); if (e && e.innerHTML !== value)
        e.innerHTML = value; };
    const width = (id, n) => { const e = $(id); if (e)
        e.style.width = clamp(n, 0, 100) + '%'; };
    const STORE = 'littlewild.save.v5', LEGACY_STORE = 'littlewild.save.v1', BACKUP_STORE = 'littlewild.backup.v5';
    const storage = new LWStoryStorage(()=>localStorage,LWStory.inspect,{primary:STORE,backup:BACKUP_STORE,
        legacy:['littlewild.save.v4','littlewild.save.v3','littlewild.save.v2',LEGACY_STORE],oldBackups:['littlewild.backup.v3']});
    let renderedLibraryHash = '';
    let storyReadId = 0;
    let engine = new Engine(), saveAvailable = true, loadWarning = '';
    engine.s.settings.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const loaded=storage.load();
    if(loaded.value)engine=LWStory.commit(loaded.value);
    else {const pack=LWScenarios.builtins()[0];engine=LWScenarios.commitScene(LWScenarios.prepareScene(pack,pack.scenes[0].id));engine.s.started=false;}
    if(loaded.error==='unavailable')saveAvailable=false;
    if(loaded.error==='corrupt')loadWarning='The previous save could not be read and has not been overwritten. Review a recovery copy or import a backup. Starting a new story explicitly replaces it.';
    const ui = { tab: 'care', modal: null, modalId: null, tradeQty: 5, inspectUntil: 0, animationTime: 0, lastFocus: null, fullscreen: false, lastPaint: 0, lastSave: 0, toastTimes: new Map(), lastStory: '', dockSignature: '', requestQty: 6, lessonFilter: 'all', lessonSearch: '', journalTab: 'memories', pendingImport: null, confirmOrder: null, backupStatus: '', tourStep: 0, history: [], focusRequest: 0, panelScroll: new Map() };
    const progressionUI = LWProgressionUI.create({engine:()=>engine,icon,esc,head:modalHead,footer:modalFooter,open:openModal,redraw:()=>renderModal(true),save,close:closeModal,result});
    const contentUI = LWContentUI.create({engine:()=>engine,icon,esc,head:modalHead,footer:modalFooter,open:openModal,redraw:()=>renderModal(true),toast,backup:backupStory,setEngine,save});
    const colonyUI = LWColonyUI.create({engine:()=>engine,icon,esc,head:modalHead,footer:modalFooter,open:openModal,redraw:()=>{if(ui.modal)renderModal(true);},toast,backup:backupStory,setEngine,save,close:closeModal,result});
    const preferences=LWInterfacePause.create(()=>localStorage);
    let tileMenu=null, buildPanel=null, guidePanel=null, scenarioUI=null, placementActor=null, placementApproach=null;
    function pauseStatus(){return preferences.status(engine.s,{hidden:document.hidden,modal:ui.modal,safety:LWInterfacePause.safetyView(ui.modal),placement:!!world.placement,creature:!!worldUI.state.actorId,more:!!worldUI.state.menu,world:!!worldExplorer.pauseReason()||!!buildPanel?.state.open||!!(guidePanel?.state.open&&!guidePanel.state.minimized),tile:!!tileMenu?.isOpen(),planner:!!villageUI.state.open});}
    function pauseToggleMarkup(){return `<section class="v13-time-setting"><h3>Time & attention</h3><label><input type="checkbox" data-pause-on-open ${preferences.pauseOnOpen?'checked':''}><span><strong>Pause when opening panels</strong><small>Include creature cards, tile menus, the planner, world map, and blueprint placement. Turn off to keep the world running while you browse.</small></span></label><p>Manual pause is always respected. Save/content replacement previews and hidden tabs still pause safely. This preference stays on this device, separately from your story.</p><small data-preference-status>${esc(preferences.error||'Preference saved on this device.')}</small></section>`;}
    function syncTimeLabels(){const p=pauseStatus();document.body.classList.toggle('world-live-panel',!!ui.modal&&p.running);document.querySelectorAll('[data-pause-on-open]').forEach(el=>{if(el.checked!==preferences.pauseOnOpen)el.checked=preferences.pauseOnOpen;});document.querySelectorAll('[data-time-label]').forEach(el=>{el.textContent=p.running?'World running · '+timeLabel(engine.s.hour):p.kind==='manual'?'Paused by you':p.reason+' · paused';});text('world-status-label',p.running?'Life in the glade':p.reason+' · paused');text('v10-planner-clock',p.running?'World running':p.kind==='manual'?'Paused by you':'Planner · paused');document.querySelectorAll('[data-manual-time]').forEach(el=>{el.textContent=engine.s.paused?(preferences.pauseOnOpen?'Release manual pause':'Resume time'):'Pause time';el.setAttribute('aria-pressed',String(engine.s.paused));});$('pause-badge').classList.toggle('show',!p.running&&engine.s.started&&!ui.modal);text('pause-text',p.reason);$('pause-button').innerHTML=icon(p.running?'pause':'play');$('pause-button').setAttribute('aria-label',p.running?'Pause':p.kind==='manual'?'Resume':'Continue world');const tip=document.querySelector('#tile-context footer');if(tip)tip.innerHTML=(p.running?'World running':p.kind==='manual'?'Paused by you':'Paused while choosing')+' · <kbd>Esc</kbd> to close';const paused=$('modal').querySelector('.workspace-pause');if(paused)paused.textContent=p.running?'World running':'World paused';}

    // Capture time intent before an outside-pointer handler dismisses an overlay.
    document.addEventListener('pointerdown',event=>{if(event.target.closest('[data-act="pause"],[data-act="speed"]'))ui.timeIntent=pauseStatus().running?'pause':'resume';},true);
    function timeAction(action,id,intent=null){const resume=action==='speed'||intent==='resume'||(!intent&&!pauseStatus().running);ui.timeIntent=null;
        if(resume&&preferences.pauseOnOpen){buildPanel?.close(false);guidePanel?.minimize();tileMenu?.close(false);worldUI.clear({restore:false});worldExplorer.clear();if(villageUI.state.open)villageUI.toggle(false);world.placement=null;refreshPlacement();}
        engine.s.paused=!resume;if(action==='speed')engine.s.speed=Number(id);updateUI(true);save();
    }
    let world = new LWArt.World($('world'), engine, { place: (kind, tile) => place(kind, tile), inspect: inspect, context:(tile,p,source)=>tileMenu?.open(tile,p,source), cursor:tile=>text('world-announcement','Tile '+tile.x+', '+tile.y+'. Press Shift F10 for actions.'), blocked:()=>!!ui.modal, pan:()=>{tileMenu?.close(false);worldUI.cameraGesture();worldExplorer.clear();} });
    const worldUI = LWWorldUI.create({pauseStatus,engine:()=>engine,world:()=>world,esc,icon,open:openModal,modal:()=>ui.modal,refresh:()=>updateUI(true),save,result,toast,colonyAction:(a,id,b)=>colonyUI.action(a,id,b),cancelPlacement:()=>{world.placement=null;refreshPlacement()}});
    const worldExplorer = LWWorldExplorer.create({pauseStatus,engine:()=>engine,world:()=>world,esc,icon,head:modalHead,footer:modalFooter,open:openModal,close:closeModal,modal:()=>ui.modal,redraw:()=>renderModal(true),toast,save,backup:backupStory,setEngine,blueprint:selectBlueprint,clearCreature:()=>worldUI.clear({restore:false})});
    const villageUI=LWVillageUI.create({pauseStatus,engine:()=>engine,world:()=>world,esc,icon,head:modalHead,footer:modalFooter,open:openModal,close:closeModal,modal:()=>ui.modal,redraw:()=>renderModal(true),toast,save,backup:backupStory,setEngine,blueprint:selectBlueprint,result,clearContext:()=>{worldUI.clear({restore:false});worldExplorer.clear();},selectCreature:id=>worldUI.openFor(id,null,{focus:true})});
    tileMenu=LWTileContext.create({engine:()=>engine,world:()=>world,village:()=>villageUI,esc,modal:()=>ui.modal,open:openModal,inspect,show:(type,id)=>worldExplorer.show(type,id),refresh:()=>updateUI(true),clearOther:()=>{worldUI.clear({restore:false});worldExplorer.clear();if(villageUI.state.open)villageUI.toggle(false);},command:r=>{result(r,r.ok?'Request saved. Creatures handle the work.':null);},cancelPlacement:()=>{world.placement=null;refreshPlacement();}});
    const panelContext={engine:()=>engine,world:()=>world,esc,icon,pauseStatus,open:openModal,save,toast,blueprint:selectBlueprint};
    buildPanel=LWBuildPanel.create(panelContext);
    guidePanel=LWGuidePanel.create({...panelContext,show:showGuideTarget});
    scenarioUI=LWScenarioUI.create({...panelContext,head:modalHead,footer:modalFooter,modal:()=>ui.modal,redraw:()=>renderModal(true),close:closeModal,backup:backupStory,setEngine,exportStory:exportSave});
    const scenarioButton=document.createElement('button');scenarioButton.dataset.act='scenarios';scenarioButton.textContent='Worlds & scenarios';$('world-more').prepend(scenarioButton);
    function applyPresentation(){
        const p=engine.scenarioContext?.presentation||LWScenarios.defaultPresentation();
        document.body.dataset.experience=engine.scenarioContext?.packId||'littlewild';
        document.documentElement.style.setProperty('--experience-accent',p.accent);
        document.documentElement.style.setProperty('--experience-paper',p.paper);
        document.documentElement.style.setProperty('--experience-ink',p.ink);
        document.querySelector('.brand-word').textContent=p.title;
        document.querySelector('.brand-sub').textContent=p.tagline;
        document.title=p.title+' · Living Worlds v15';
        const sub=document.querySelector('.location-sub');if(sub)sub.textContent=p.worldSubtitle;
    }
    function showGuideTarget(action){
        const routes={learn:'training',home:'construction',planner:'plans',research:'v10-research',quests:'adventures',growth:'v10-homes',market:'v10-market',save:'settings',map:'v10-land'};
        if(action==='select'||action==='care')worldUI.openFor(engine.selected?.id||engine.creatures[0].id,null,{focus:true});
        else if(routes[action])openModal(routes[action]);
    }
    document.addEventListener('keydown',event=>{
        if(ui.modal)return;
        if(event.key==='F6'&&(buildPanel.state.open||guidePanel.state.open)){
            event.preventDefault();event.stopImmediatePropagation();
            const panel=buildPanel.state.open?buildPanel:guidePanel;
            if(panel.host.contains(document.activeElement))world.canvas.focus({preventScroll:true});else panel.focus();
        }
        if(event.key==='Escape'&&!world.placement&&(buildPanel.state.open||guidePanel.state.open)){
            event.preventDefault();event.stopImmediatePropagation();
            if(buildPanel.state.open)buildPanel.close();else guidePanel.close();
        }
    },true);
    LWScenarios.activate(engine);applyPresentation();
    const visualButton=document.createElement('button');visualButton.dataset.act='v12-visuals';visualButton.textContent='Graphics & world controls';$('world-more').insertBefore(visualButton,$('world-more').querySelector('.w7-fine'));
    const contextButton=document.createElement('button');contextButton.className='icon-btn';contextButton.id='tile-menu-button';contextButton.innerHTML=icon('more');contextButton.title='Tile actions · right-click, hold, or Shift+F10';contextButton.setAttribute('aria-label','Open actions for focused tile');contextButton.addEventListener('click',()=>{const t=world.keyboardTile||world.hover||world.toTile(world.canvas.width/2,world.canvas.height/2);tileMenu.open(t,world.toScreen(t.x,t.y),'button');});document.querySelector('.world-tools').prepend(contextButton);
    $('world').setAttribute('aria-description','Drag to pan. Right-click or hold a tile for actions. Shift plus arrow keys selects a tile. Shift F10 or Enter opens its actions.');
    let soundContext = null;
    function sound(type) { if (!engine.s.settings.sound)
        return; try {
        if (!soundContext)
            soundContext = new (window.AudioContext || window.webkitAudioContext)();
        if (soundContext.state === 'suspended')
            soundContext.resume();
        const base = soundContext.currentTime, freq = type === 'celebrate' ? [392, 494, 587, 784] : [523, 659];
        freq.forEach((f, i) => { const o = soundContext.createOscillator(), g = soundContext.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, base + i * .08); g.gain.linearRampToValueAtTime(.035, base + i * .08 + .02); g.gain.exponentialRampToValueAtTime(.001, base + i * .08 + .36); o.connect(g); g.connect(soundContext.destination); o.start(base + i * .08); o.stop(base + i * .08 + .4); });
    }
    catch (_) { /* Audio is optional and never blocks play. */ } }
    function toast(message, error = false) { const now = performance.now(), last = ui.toastTimes.get(message) || 0; if (now - last < 700)
        return; ui.toastTimes.set(message, now); while(ui.toastTimes.size>128)ui.toastTimes.delete(ui.toastTimes.keys().next().value); if (ui.toastTimes.size > 120) for (const [key,time] of ui.toastTimes) if (now-time>6000) ui.toastTimes.delete(key); let el = document.createElement('div'); el.className = 'toast' + (error ? ' error' : ''); el.innerHTML = icon(error ? 'leaf' : 'check') + '<span>' + esc(message) + '</span>'; $('toasts').appendChild(el); while ($('toasts').children.length > 3)
        $('toasts').firstElementChild.remove(); setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 350); }, error ? 5000 : 3600); }
    function result(r, success) { if (!r)
        return; if (!r.ok)
        toast(r.reason, true);
    else if (success)
        toast(success); updateUI(true); processEvents(); save(); return r.ok; }
    function timeLabel(hour) { return String(Math.floor(hour)).padStart(2, '0') + ':' + String(Math.floor((hour % 1) * 60)).padStart(2, '0'); }
    function timestampedStory() { return LWStory.encode(engine, new Date().toISOString()); }
    function save(explicit = false) { if (!engine.s.started && !explicit)
        return; try {
        const payload = timestampedStory();
        storage.write(payload,explicit);
        saveAvailable = true;
        text('save-label', 'Saved on this device');
    }
    catch (_) {
        saveAvailable = false;
        text('save-label', 'Export to keep your story');
        if (explicit)
            toast('Local saving is unavailable here. Export a portable save instead.', true);
    } }
    function exportSave() {
        LWFiles.downloadJSON(timestampedStory(),'littlewild-'+engine.s.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-day-'+engine.s.day+'-story.json');
        toast('Story exported, including its exact content library.');
    }
    function backupStory() {
        if(!engine.s.started)return true;
        const kept=storage.backup(timestampedStory());
        if(!kept){ui.backupStatus='No recovery copy could be written. Keep an exported JSON copy before replacing this story.';toast(ui.backupStatus,true);}
        else ui.backupStatus='';
        return kept;
    }
    function setEngine(newEngine) { buildPanel?.reset();guidePanel?.reset();scenarioUI?.reset();placementActor=null;placementApproach=null;LWScenarios.activate(newEngine);tileMenu?.close(false); if(newEngine===engine){ui.dockSignature='';updateUI(true);return;} storage.allowReplacement();loadWarning='';cancelPendingReads();clock.reset();last=performance.now();worldUI.reset(); worldExplorer.reset(); engine = newEngine; applyPresentation(); world.engine = engine; world.resetPresentation?.(); world.placement = null; world.selected = null; world.hover = null; world.bubble = null; world.particles = []; world.home(); ui.inspectUntil = 0; $('tile-tip').classList.remove('show'); $('toasts').innerHTML = ''; ui.tab = 'care'; updateUI(true); renderDock(); }
    function start(demo = false) { storage.allowReplacement();loadWarning=''; if (demo)
        backupStory(); if (demo) {
        const e = new Engine(), s = e.s;
        s.started = true;
        s.player = { level: 3, xp: 12, coins: 160 };
        s.creature = { level: 3, xp: 18, coins: 16, x: 9, y: 10, dir: 1 };
        s.bond = 56;
        s.rp = 18;
        s.needs = { food: 48, water: 32, energy: 68, comfort: 72, joy: 73 };
        s.inventory = { ...s.inventory, wood: 16, stone: 10, fiber: 8, berries: 0, water: 0, planks: 5, meat: 2, meals: 0 };
        s.allowance = { limit: 12, given: 12, auto: true, reserve: 4, sourcing: 'balanced' };
        for (const id of ['woodcraft', 'shelter', 'stonework', 'firekeeping', 'gardening', 'woodwork', 'commerce']) {
            s.skills[id] = true;
            s.researched[id] = true;
        }
        s.buildings = [{ id: 'b1', kind: 'shelter', x: 7, y: 8, stock: 0, regen: 0 }, { id: 'b2', kind: 'bench', x: 10, y: 8, stock: 0, regen: 0 }, { id: 'b3', kind: 'fire', x: 9, y: 11, stock: 0, regen: 0 }, { id: 'b4', kind: 'garden', x: 6, y: 10, stock: 4, regen: 0 }, { id: 'b5', kind: 'market', x: 12, y: 9, stock: 0, regen: 0 }];
        s.completedQuests = ['hello', 'learn', 'home', 'spark', 'market'];
        s.stats = { ...s.stats, fed: 5, watered: 5, bonded: 4, gathered: 62, built: 5, trained: 7, planksMade: 10 };
        s.nextId = 6;
        e.newWish();
        for (const id of Object.keys(s.skills))
            s.practice[id] = id === 'woodcraft' ? 12 : id === 'woodwork' ? 9 : 3;
        s.memories = [{ key: 'demo-home', title: 'Our first little home', description: 'You made a plan. I brought the branches. We made a home.', icon: 'home', day: 1, hour: 8 }];
        e.log('A mid-game example: your first home, a working market, and a friendship taking root.', 'home');
        e.log('The pantry needs water. Watch Pip decide to shop with their own pocket coins.', 'market');
        for(const b of s.buildings){b.level??=1;b.quality??=65;}
        e.ensureWarehouse();
        for(const id of Object.keys(s.skills))e.actor.rpg.points[id]=Math.max(1,Math.min(12,1+Math.floor((s.practice[id]||0)/8)));
        for(const [id,n]of Object.entries(e.surplus())){s.inventory[id]-=n;s.colony.warehouse.inventory[id]=(s.colony.warehouse.inventory[id]||0)+n;}
        e.seedExistingSites();e.syncBuildings({preserveLegacyStock:true});setEngine(e);
    }
    else {
        engine.s.started = true;
        const creatureName = LWCreatures.get(engine.actor.archetype)?.name?.toLowerCase() || 'companion';
        engine.log('A little ' + creatureName + ' found a place in the glade. And a friend in you.', 'leaf');
    } closeModal(); save(); world.say(demo ? 'I’ll pick up a little water.' : 'Hi. I think we’ll be good friends.', 'heart'); updateUI(true); }
    function storyMarkup() { const s = engine.s, q = engine.quest(); if (!q) {
        const path=LW.PATHS[s.learning.path], next=path.skills.find(id=>!s.skills[id]),place=path.buildings.find(id=>!engine.has(id)), count=path.skills.filter(id=>s.skills[id]).length;
        return `<section class="card story-card"><div class="eyebrow">OUR NEXT LITTLE POSSIBILITY</div><h2 class="story-title">${esc(path.name)}</h2><p class="story-desc">${esc(path.desc)}</p><div class="reward-row">${icon('book')}<strong>${count} / ${path.skills.length} lessons learned</strong></div><p class="muted micro">${next?esc(engine.lessonIssue(next)?.text||'Ready to explore '+SKILLS[next].short+'.'):place?'Our learning can become a '+BUILDINGS[place].name.toLowerCase()+'.':'This path has taken root. Choose a new direction, or make these places your own.'}</p><button class="btn primary" data-act="${next?'v3-skill':place?'v3-blueprint':'v3-paths'}" ${next||place?'data-id="'+(next||place)+'"':''}>${next?'Explore '+SKILLS[next].short:place?'Imagine '+BUILDINGS[place].name:'Explore learning paths'} ${icon('arrow')}</button>${s.fieldStudies.active?'<p class="muted micro" style="margin-top:12px">'+icon('research')+' Observing: '+LW.STUDIES[s.fieldStudies.active].name+'</p>':''}<button class="text-btn" data-act="v3-paths" style="margin-top:12px">Choose another direction ↗</button></section>`;
    } const done = q.checks.every(c => c[1](s)); return `<section class="card story-card"><div class="eyebrow">${esc(q.chapter)}</div><h2 class="story-title">${esc(q.title)}</h2><p class="story-desc">${esc(q.desc)}</p><div class="checklist">${q.checks.map(([label, fn, action]) => `<button class="quest-row ${fn(s) ? 'done' : ''}" data-act="quest-go" data-id="${action}" ${fn(s) ? 'disabled' : ''}><span class="check">${fn(s) ? '✓' : ''}</span><span>${esc(label)}</span>${!fn(s) ? '<span class="arrow">↗</span>' : ''}</button>`).join('')}</div><div class="reward-row"><span class="label">A little thank you</span><strong>${icon('coin')} ${q.reward.coins}</strong><strong>${icon('research')} ${q.reward.rp}</strong></div>${done ? `<button class="btn primary claim-btn" data-act="claim">${icon('star')}Celebrate this chapter</button>` : ''}</section>`; }
    function allowanceMarkup() { const s = engine.s; return `<section class="allowance"><div class="section-heading"><h2>A little independence</h2>${icon('coin')}</div><div class="allowance-readout"><span>Daily allowance</span><span><strong data-allowance-number>${s.allowance.limit}</strong> coins</span></div><label class="sr-only" for="allowance-modal">Daily allowance</label><input id="allowance-modal" class="range" type="range" min="0" max="30" step="1" value="${s.allowance.limit}" data-allowance><div class="range-labels"><span>0</span><span>Your limit. Pip’s choices.</span><span>30</span></div><p class="allowance-note">${esc(s.name)} has <strong data-pocket>${s.creature.coins}</strong> pocket coins. <span data-issued>${s.allowance.given} of ${s.allowance.limit} issued today.</span></p><button class="btn allowance-button" data-act="allowance">${icon('coin')}<span data-topup-label>Top up today’s allowance</span></button><label class="checkbox-line"><input type="checkbox" ${s.allowance.auto ? 'checked' : ''} data-auto-allowance> Automatically share each new day</label><p class="allowance-note">The limit controls coins you give, not coins Pip earns. Lowering it never takes pocket money back. Shops require a built market.</p></section>`; }
    function wishMarkup() {
        const s = engine.s, w = s.wish;
        if (!w)
            return '';
        const progress = Math.min(w.amount, Math.max(0, s.stats[w.stat] - w.start));
        return `<div class="eyebrow">${icon(w.complete ? 'check' : 'heart')} ${w.complete ? 'A WISH WE SHARED' : esc(s.name.toUpperCase())+'’S SMALL WISH'}</div><h3>${esc(w.title)}</h3><p>“${esc(w.thought)}”</p><div class="wish-bottom"><span>${w.complete ? 'A memory to keep.' : progress + ' / ' + w.amount + ' · no pressure'}</span>${w.complete ? '<span class="tiny-tag">+2 bond · +1 research</span>' : '<button class="text-btn" data-act="wish">Make a little room ↗</button>'}</div>`;
    }
    function forecastMarkup(o = null) {
        const f = engine.materialForecast(o);
        return `<div class="forecast"><div class="section-heading"><h3>${o ? 'How this plan comes together' : 'Materials across active plans'}</h3><span class="tiny-tag">${o ? 'Live plan' : 'Live material forecast'}</span></div>${f.rows.length ? `<div class="supply-head"><span>Supply</span><span>Available</span><span>Needed</span><span>To source</span></div>${f.rows.map(r => `<div class="supply-row"><span>${icon(RES[r.resource].icon)}${esc(RES[r.resource].name)}</span><span>${r.onHand}</span><span>${r.needed}</span><strong class="${r.missing ? 'shortfall' : ''}">${r.missing || 'Ready'}</strong></div>`).join('')}` : '<p class="muted">No materials waiting on active plans. Reserved construction supplies are already paid for.</p>'}${f.steps.length ? `<div class="chain-flow">${f.steps.map(r => `<span>${icon(RES[r.resource].icon)}${r.kind === 'craft' ? 'Make' : r.kind === 'hunt' ? 'Find' : 'Gather'} ${r.amount} ${esc(RES[r.resource].name.toLowerCase())}${r.station ? ' at ' + BUILDINGS[r.station].name.toLowerCase() : ''}</span>`).join('<b aria-hidden="true">→</b>')}</div>` : ''}${f.issues.length ? `<div class="dependency-list">${f.issues.map(i => `<button class="btn small" data-act="${i.skill ? 'training' : i.practice ? 'v3-practice-focus' : 'blueprint'}" data-id="${i.skill || i.practice || i.building}">${icon(i.skill ? 'book' : 'home')}${esc(i.text)} ↗</button>`).join('')}</div>` : ''}<p class="muted micro">A making-first forecast, including intermediate ingredients. Pantry targets are separate. Pip may shop instead when your sourcing preference and their pocket money allow it.</p></div>`;
    }
    function taskETA(t) { if (!t)
        return ''; const walking = t.phase === 'walk' ? t.path.length / 1.65 : 0; return Math.ceil(walking + Math.max(0, t.duration - t.elapsed) / engine.workRate(t)) + ' sim seconds'; }
    function extraModalMarkup() {
        const experienceMarkup=scenarioUI?.render(ui.modal);if(experienceMarkup!=null)return experienceMarkup;
        if(ui.modal==='world-visuals')return modalHead('A world that feels at home.','Presentation preferences never change work, dice, rewards or saved content definitions.','GRAPHICS & INPUT')+`<div class="modal-body v12-visuals">${pauseToggleMarkup()}<h3>Rendering quality</h3><div class="v12-quality-options">${[['eco','Gentle','Lower rendering resolution; no WebGL shadows.'],['balanced','Balanced','Moderate resolution and a single shadow-casting light.'],['high','Detailed','Higher resolution and sharper WebGL shadows.']].map(([id,name,desc])=>`<button class="btn ${world.quality===id?'primary':''}" data-act="v12-quality" data-id="${id}" aria-pressed="${world.quality===id}"><strong>${name}</strong><small>${desc}</small></button>`).join('')}</div><p>Active renderer: <strong>${esc(world.mode)}</strong>. Software 3D uses simplified lighting and a bounded scenery cache. Hardware WebGL performance depends on your device.</p><button class="btn" data-act="v12-motion" aria-pressed="${engine.s.settings.reducedMotion}">${engine.s.settings.reducedMotion?'Enable':'Reduce'} motion</button><h3>Selection & companion labels</h3><p class="v14-selection-help">Names and ground rings follow the same rendered creature position. While the world runs, interaction controls stay where you opened them; use Locate to bring your companion back into view. Overlapping names separate into stable rows, and the roster remains available for off-screen companions.</p><h3>Hands on the world</h3><dl><dt>Inspect</dt><dd>Click a creature, building or resource.</dd><dt>Tile actions</dt><dd>Right-click, hold for a moment, or use the ⋯ camera button.</dd><dt>Keyboard</dt><dd>Focus the world. Shift + arrows selects a tile; Shift + F10 or Enter opens its actions. Arrows pan. + / − zoom. H recenters.</dd><dt>While a menu is open</dt><dd>Arrows move between actions, Enter activates, Escape closes. Time follows your pause-on-open preference. Use Pause time inside a panel whenever you need it.</dd></dl><p>Pausing freezes work and walking animations. Lower quality and reduced motion never reduce rewards.</p></div>`+modalFooter();
        const s = engine.s, m = $('modal');
        const villageMarkup=villageUI.render(ui.modal);if(villageMarkup!==null)return villageMarkup;
        const landMarkup=worldExplorer.render(ui.modal);if(landMarkup!==null)return landMarkup;
        const colonyMarkup=colonyUI.render(ui.modal,ui.modalId);
        if(colonyMarkup!==null)return colonyMarkup;
        const contentMarkup=contentUI.render(ui.modal,ui.modalId);
        if(contentMarkup!==null)return contentMarkup;
        const featureMarkup=progressionUI.render(ui.modal,ui.modalId);
        if(featureMarkup!==null) return featureMarkup;
        if (ui.modal === 'pantry')
            return modalHead('A little ready for tomorrow.', 'Set comfortable reserves, not chores. Pip replenishes them after needs, lessons and shared plans.', 'OUR PANTRY') + `<div class="modal-body"><div class="notice-box">${icon('leaf')}Targets are minimums, not limits. Small harvests and recipe batches can leave a little extra. A target of zero turns automatic stocking off.</div><div class="pantry-head"><span>Shared supplies</span><span>In store</span><span>Keep at least</span></div>${Object.entries(RES).map(([id, r]) => { const issue = engine.assessResource(id, Math.max(1, s.stockTargets[id])); return `<div class="pantry-row"><div>${icon(r.icon)}<span><strong>${esc(r.name)}</strong><small>${issue ? esc(issue.text||issue) : RECIPES[id] ? 'Made in whole recipe batches' : id === 'meat' ? 'Tracking expeditions' : LWWorldContent.content.nodes.some(n=>n.resource===id&&n.mode==='finite')?'Finite deposits in the glade':'Infinite default source'}</small></span></div><strong>${s.inventory[id]}</strong><label><span class="sr-only">Keep ${esc(r.name)}</span><input type="number" min="0" max="24" step="1" value="${s.stockTargets[id]}" data-stock-target="${id}" aria-label="${esc(r.name)} stock target"></label></div>`; }).join('')}<div class="modal-actions"><button class="btn" data-act="stock-preset" data-id="essentials">Essentials only</button><button class="btn" data-act="stock-preset" data-id="builder">Prepared builder</button></div>${forecastMarkup()}</div>` + modalFooter();
        if (ui.modal === 'ledger')
            return modalHead('Two wallets. A little trust.', 'Follow the actual coins and research. Your allowance is a gift limit, never a leash.', 'OUR MONEY & CHOICES') + `<div class="modal-body"><div class="balance-cards"><div>${icon('coin')}<strong>${s.player.coins}</strong><span>Your guide coins</span></div><div>${icon('bag')}<strong>${s.creature.coins}</strong><span>${esc(s.name)}’s pocket coins</span></div><div>${icon('research')}<strong>${s.rp}</strong><span>Shared research</span></div></div><div class="economy-settings">${allowanceMarkup()}<section class="shopping-settings"><h3>Room to make choices</h3><label for="sourcing-select">For our plans, encourage…</label><select id="sourcing-select"><option value="balanced" ${s.allowance.sourcing === 'balanced' ? 'selected' : ''}>Make & gather; shop if a source is empty</option><option value="gather" ${s.allowance.sourcing === 'gather' ? 'selected' : ''}>Gather & make our own supplies</option><option value="shop" ${s.allowance.sourcing === 'shop' ? 'selected' : ''}>Use the market when affordable</option></select><label for="pocket-reserve">Keep some pocket savings</label><div class="reserve-control"><input id="pocket-reserve" type="number" min="0" max="30" step="1" value="${s.allowance.reserve}"><span>coins</span></div><p class="muted micro">Pip keeps this reserve when buying building supplies. Food and water can use it in an emergency. No preference forces a purchase or spends your guide coins. An empty wallet always has a free gathering fallback.</p></section></div><div class="section-heading"><h3>Our recent transactions</h3><span class="tiny-tag">Last 80 entries</span></div><div class="ledger-head"><span>Moment</span><span>You</span><span>${esc(s.name)}</span><span>Research</span></div>${s.ledger.length ? s.ledger.map(e => `<div class="ledger-row"><span>${esc(e.label)}<small>Day ${e.day} · ${timeLabel(e.hour)}</small></span>${[e.guide, e.pocket, e.research].map(n => `<strong class="${n > 0 ? 'income' : n < 0 ? 'expense' : 'muted'}">${n > 0 ? '+' : ''}${n || '—'}</strong>`).join('')}</div>`).join('') : '<p class="muted empty-state">New transactions will appear here. Earlier balances are carried forward; the ledger does not invent past transactions.</p>'}</div>` + modalFooter();
        if (ui.modal === 'decision') {
            const d = engine.decisionSummary(), t = s.task;
            return modalHead('A mind of my own.', 'Suggestions matter. Pip’s needs and decisions still come first.', 'UNDERSTANDING ' + esc(s.name).toUpperCase()) + `<div class="modal-body"><div class="decision-hero"><span class="status-tag active">${d.source}</span><h3>${esc(t?.label || 'Thinking about my next step')}</h3><blockquote>“${esc(t?.thought || 'There’s a whole little world to notice.')}”</blockquote><p>${esc(t?.reason || 'I’m choosing what comes next.')}</p>${t ? `<div class="decision-timing">${icon('clock')} About ${taskETA(t)} left · ${t.phase === 'walk' ? 'walking there' : 'making progress'}</div>` : ''}</div><div class="decision-priorities">${[['1', 'Care comes first', 'Food, water, energy, warmth and joy. I can pause work without losing construction or lesson progress.'], ['2', 'A lesson, when I’m ready', s.training ? 'Learning ' + SKILLS[s.training.id].short + ' next.' : 'There is no lesson waiting right now.'], ['3', 'One shared plan at a time', s.orders.length ? s.orders.length + ' idea(s) to consider. Runnable ideas can pass a blocked plan.' : 'You haven’t suggested any work. There’s no need to invent chores.'], ['4', 'A life beyond our plans', 'Keep a few pantry reserves, follow curiosity, research or enjoy the glade.']].map(([n, h, p]) => `<div><span>${n}</span><section><h4>${h}</h4><p>${esc(p)}</p></section></div>`).join('')}</div><div class="modal-actions"><button class="btn" data-act="plans">${icon('plan')}Our plan board</button><button class="btn" data-act="pantry">${icon('bag')}Pantry reserves</button></div></div>` + modalFooter();
        }
        if (ui.modal === 'journal')
            return modalHead('The little moments add up.', 'Important memories stay separate from the day-to-day activity log.', 'OUR SHARED STORY') + `<div class="modal-body"><div class="filter-chips journal-filters" role="group" aria-label="Journal section">${[['memories', 'Memories to keep'], ['activity', 'Recent activity']].map(([id, label]) => `<button class="chip ${ui.journalTab === id ? 'active' : ''}" aria-pressed="${ui.journalTab === id}" data-act="journal-filter" data-id="${id}">${label}</button>`).join('')}</div>${ui.journalTab === 'memories' ? `<div class="memory-grid">${s.memories.length ? s.memories.map(e => `<article class="memory-card">${icon(e.icon)}<time>Day ${e.day} · ${timeLabel(e.hour)}</time><h3>${esc(e.title)}</h3><p>${esc(e.description)}</p></article>`).join('') : '<p class="muted">Our first wish, learned skill or finished home will become a memory here.</p>'}</div>` : `<div class="journal-full">${s.log.map(e => journalEntry(e)).join('') || '<p class="muted">A fresh page. A whole world ahead.</p>'}</div>`}</div>` + modalFooter();
        if (ui.modal === 'confirm-cancel') {
            m.classList.add('small-modal');
            const o = s.orders.find(o => o.id === ui.confirmOrder);
            if (!o)
                return modalHead('That idea is already complete.') + modalFooter();
            return modalHead('Set this idea aside?', 'Nothing needs to be rushed.', 'A CHANGE OF PLANS') + `<div class="modal-body"><h3>${esc(engine.orderName(o))}</h3><p class="muted">${['build','upgrade'].includes(o.type) ? 'Current-stage supplies and half the earlier installed materials become salvage at the site, rounded down per material. The creature must collect and deposit that salvage before it is available in the warehouse.' : 'Materials already gathered or crafted stay in their current satchel or warehouse location.'}</p><div class="modal-actions"><button class="btn danger" data-act="confirm-cancel" data-id="${o.id}">Set aside</button><button class="btn" data-act="order" data-id="${o.id}">Keep our plan</button></div></div>` + modalFooter();
        }
        if (ui.modal === 'import-preview') {
            m.classList.add('small-modal');
            const incoming = ui.pendingImport?.engine.s;
            if (!incoming)
                return modalHead('No story selected.') + modalFooter();
            const profile=ui.pendingImport.experience?.simulation||ui.pendingImport.engine.simulationProfile;
            return modalHead('Bring this story home?', 'Review it before replacing the current glade.', 'IMPORT PREVIEW') + `<div class="modal-body"><div class="import-summary"><h3>${esc(incoming.name)} · Day ${incoming.day}</h3><p>${incoming.colony.creatures.length} companions · ${incoming.buildings.length} places · Guide level ${incoming.player.level}</p><p>${incoming.player.coins} guide coins · ${Object.values(incoming.colony.warehouse.inventory).reduce((a,b)=>a+b,0)} deposited items</p>${ui.pendingImport.migrationNotes?.length?'<div class="quality-notice"><strong>Compatibility changes</strong>'+ui.pendingImport.migrationNotes.map(n=>'<p>'+esc(n)+'</p>').join('')+'</div>':''}${incoming.colony.creatures.map(c=>`<p><strong>${esc(c.name)}</strong> · Level ${c.creature.level} · ${Object.values(c.skills).filter(Boolean).length} skills · ${c.activeQuest?'away on '+esc(c.activeQuest.name):c.questPlan?'preparing a quest':'in the glade'}</p>`).join('')}</div><div class="notice-box"><strong>Content library: ${esc(ui.pendingImport.library.library.name)} · v${esc(ui.pendingImport.library.library.version)}</strong><p>${ui.pendingImport.changesLibrary?'This story restores its own content definitions. The current library will change too.':'This story uses the same content definitions as your current library.'} Source save: v${ui.pendingImport.sourceVersion}.</p></div>${profile?`<div class="notice-box"><strong>Simulation profile: ${esc(profile.name)} · ${esc(profile.archetype.id)}</strong><p>${ui.pendingImport.changesSimulation?'This story restores its own validated actor/economy tuning.':'This story uses the same simulation profile as the current runtime.'} Imported JSON cannot add or reorder systems.</p></div>`:''}<div class="notice-box">${icon('book')}Your current story is still untouched. ${saveAvailable ? 'A local recovery copy will be attempted when you confirm. Export first for a portable backup.' : 'Local saving is unavailable. Export your current story before replacing it.'}</div><div class="modal-actions"><button class="btn" data-act="export">${icon('download')}Export current story</button><button class="btn primary" data-act="confirm-import">Bring this story home</button></div></div>` + modalFooter();
        }
        if (ui.modal === 'tour') {
            const cards = [['You are a friend, not a cursor.', 'Clicking the ground never moves Pip. The thought card tells you the current activity. “Why this?” explains the decision.', 'paw'], ['First, check the little essentials.', 'Offer a snack, water or company from Care. A full tummy needs no extra food. Recent effort is a good time for praise.', 'heart'], ['Research opens a possibility.', 'Explore 28 lessons in four tiers. Research with shared points, then buy and queue up to four ready lessons. Practice uses real supplies; talents shape Pip’s strengths. Return to the glade to learn.', 'book'], ['Place the plan. Pip handles the how.', 'The atlas has 22 places. Each project has three stages and reserves only the current stage’s supplies. Choose a construction approach. Improve completed places through three levels; the old building stays usable.', 'home'], ['Plan tomorrow, without dictating today.', 'Pantry reserves let Pip keep essentials in stock. The plan board explains ready, active and blocked ideas. Give a quantity, not a movement command.', 'plan'], ['Let a little independence grow.', 'A market lets Pip spend pocket coins. Set daily allowance, savings and sourcing preferences in the ledger. Save export is your portable backup.', 'coin']];
            const card = cards[ui.tourStep];
            m.classList.add('small-modal');
            return modalHead('A little look around.', 'The world waits while you read.', 'FIELD NOTES · ' + (ui.tourStep + 1) + ' / ' + cards.length) + `<div class="modal-body tour-page"><div class="tour-icon">${icon(card[2])}</div><h3>${card[0]}</h3><p>${card[1]}</p><div class="tour-dots">${cards.map((_, i) => `<button data-act="tour-step" data-id="${i}" class="${i === ui.tourStep ? 'active' : ''}" aria-label="Tour step ${i + 1}" aria-current="${i === ui.tourStep ? 'step' : 'false'}">${i + 1}</button>`).join('')}</div><div class="modal-actions"><button class="btn" data-act="tour-step" data-id="${Math.max(0, ui.tourStep - 1)}" ${ui.tourStep === 0 ? 'disabled' : ''}>Back</button><button class="btn primary" data-act="${ui.tourStep === 5 ? 'close-modal' : 'tour-step'}" data-id="${ui.tourStep + 1}">${ui.tourStep === 5 ? 'Back to our glade' : 'Next little step'} ${icon('arrow')}</button></div></div>` + modalFooter();
        }
        return '';
    }
    function costString(cost) { return Object.entries(cost).map(([r, n]) => n + ' ' + RES[r].name.toLowerCase()).join(' · '); }
    function renderDock() {
        const s = engine.s;
        ui.dockSignature = JSON.stringify([Object.keys(s.skills), s.buildings.map(b => b.kind), s.orders.map(o => o.kind)]);
        document.querySelectorAll('[data-act="tab"]').forEach(b => { const on = b.dataset.id === ui.tab; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
        const hints = { care: 'Good company makes a good day.', build: 'You choose what. Pip figures out how.', train: 'Small lessons. Bigger possibilities.', trade: 'Independence starts with a little trust.' };
        text('dock-hint', hints[ui.tab]);
        if (ui.tab === 'care')
            html('dock-body', `<div class="care-grid"><button class="action-card" data-act="care" data-id="feed"><span class="action-icon">${icon('berries')}</span><strong>Share a snack</strong><small id="care-feed-caption">1 berry · a full tummy</small><span class="kbd">1</span></button><button class="action-card" data-act="care" data-id="water"><span class="action-icon">${icon('water')}</span><strong>Offer water</strong><small>1 water · a fresh start</small><span class="kbd">2</span></button><button class="action-card" data-act="care" data-id="bond"><span class="action-icon">${icon('heart')}</span><strong>Time together</strong><small>Clouds, stories & trust</small><span class="kbd">3</span></button><button class="action-card" data-act="care" data-id="praise"><span class="action-icon">${icon('star')}</span><strong>Praise effort</strong><small>Celebrate a little win</small><span class="kbd">4</span></button></div>`);
        else if (ui.tab === 'build')
            html('dock-body', `<div class="build-dock-toolbar"><span>${Object.keys(BUILDINGS).length} places · 3 stages · 3 levels</span><button class="btn small primary" data-act="v3-construction">Construction atlas ↗</button><button class="btn small" data-act="v3-recipes">Production book</button></div><div class="plan-strip">${Object.entries(BUILDINGS).map(([id, b]) => { const exists = engine.has(id) || s.orders.some(o => o.kind === id), known = !!s.skills[b.skill]; return `<button class="blueprint ${world.placement === id ? 'chosen' : ''}" data-act="blueprint" data-id="${id}" ${exists ? 'disabled' : ''} title="${esc(b.desc + ' ' + costString(b.cost))}"><div class="blueprint-top">${icon(b.icon)}<strong>${esc(b.name)}</strong></div><div class="cost">${esc(costString(b.cost))}</div><span class="${known ? 'ready-note' : 'locked-note'}">${exists ? 'Already in our story' : known ? 'Place a plan ↗' : 'Needs ' + SKILLS[b.skill].short}</span></button>`; }).join('')}</div>`);
        else if (ui.tab === 'train')
            html('dock-body', `<div class="dock-invite"><div class="invite-art">${icon('book')}</div><div><h3>A little more capable, every day.</h3><p>28 lessons across four tiers. Practice a craft, follow a learning path, and discover a talent of our own.</p></div><button class="btn primary" data-act="training">${icon('research')}Explore lessons</button></div>`);
        else
            html('dock-body', `<div class="dock-invite"><div class="invite-art">${icon('market')}</div><div><h3>${engine.has('market') ? 'A little give. A little grow.' : 'Good things bring us together.'}</h3><p>${engine.has('market') ? 'Sell deposited warehouse goods. Creatures carry, use and deliver their own supplies.' : 'Build a market stall to trade, meet neighbors, and let Pip choose what to buy.'}</p></div><button class="btn primary" data-act="market">${icon('market')}${engine.has('market') ? 'Visit the market' : 'See the market'}</button></div>`);
    }
    const NEEDS = { food: ['Food', 'berries'], water: ['Water', 'water'], energy: ['Energy', 'energy'], comfort: ['Comfort', 'comfort'], joy: ['Joy', 'joy'] };
    function refreshContentLabels() {
        if(renderedLibraryHash===LWContent.registry.hash)return;
        renderedLibraryHash=LWContent.registry.hash;ui.dockSignature='';
        html('resource-list', Object.entries(RES).filter(([id])=>['wood','stone','fiber','berries','water','planks','meat','meals'].includes(id)).map(([id, r]) => `<button class="resource" data-act="pantry" title="Warehouse: ${esc(r.name)}">${icon(r.icon)}<span>${r.name === 'Hearty meals' ? 'Meals' : r.name === 'Wild meat' ? 'Provisions' : esc(r.name)}</span><strong id="res-${id}">0</strong></button>`).join(''));
    }
    $('needs-list').innerHTML = Object.entries(NEEDS).map(([id, [name, ic]]) => `<div class="need ${id}" id="need-${id}"><div class="need-label"><span>${icon(ic)}${name}</span><strong id="need-${id}-value">0%</strong></div><div class="meter" role="meter" aria-label="${name}" aria-valuemin="0" aria-valuemax="100" id="need-${id}-meter"><i id="need-${id}-fill"></i></div></div>`).join('');
    function updateUI(force = false) {
        refreshContentLabels();
        const s = engine.s;
        document.body.classList.toggle('no-motion', s.settings.reducedMotion);
        text('player-coins', s.player.coins);
        text('header-pocket', s.creature.coins);
        document.body.classList.toggle('high-contrast', !!s.settings.highContrast);
        text('research-points', s.rp);
        text('player-level', 'Lv. ' + s.player.level);
        width('player-xp-fill', s.player.xp / threshold(s.player.level) * 100);
        $('guide-xp').title = s.player.xp + ' / ' + threshold(s.player.level) + ' guide XP';
        text('buddy-level', 'Level ' + s.creature.level);
        text('buddy-xp', s.creature.xp + ' / ' + threshold(s.creature.level) + ' XP');
        width('buddy-xp-fill', s.creature.xp / threshold(s.creature.level) * 100);
        text('buddy-mood', engine.mood());
        text('mini-mood', s.name + ' · ' + engine.mood());
        html('mini-needs', icon('berries') + Math.round(s.needs.food) + '% ' + icon('water') + Math.round(s.needs.water) + '% ' + icon('energy') + Math.round(s.needs.energy) + '%');
        text('request-button-label', 'Give ' + s.name + ' an idea');
        text('world-footer-text', world.placement ? 'Planning time · world paused' : s.task?.phase === 'walk' ? s.name + ' is finding their way.' : s.name + ' has a mind of their own.');
        const ds = engine.decisionSummary();
        text('decision-source', ds.source);
        if (world.placement && world.hover) {
            const h = world.hover, valid = engine.canBuild(h.x, h.y,world.placement) && !engine.placementIssue(world.placement,h.x,h.y);
            text('world-context', (valid ? 'Ready to plan' : engine.placementIssue(world.placement,h.x,h.y)||'Choose reachable ground') + ' · tile ' + h.x + ', ' + h.y);
            $('world-context').classList.add('show');
        }
        else {
            $('world-context').classList.remove('show');
        }
        html('wish-panel', wishMarkup());
        for (const k of Object.keys(RES)) {
            text('res-' + k, s.colony.warehouse.inventory[k]||0);
            const resource = $('res-' + k)?.closest('.resource');
            if (resource) {
                resource.classList.toggle('below-target', (s.colony.warehouse.inventory[k]||0) < s.stockTargets[k]);
                resource.title = RES[k].name + ': ' + (s.colony.warehouse.inventory[k]||0) + ' deposited. Carried items are not available to sell.';
            }
        }
        document.querySelectorAll('[data-buddy-name]').forEach(e => { if (e.textContent !== s.name)
            e.textContent = s.name; });
        document.querySelectorAll('[data-pocket]').forEach(e => e.textContent = s.creature.coins);
        text('bond-value', Math.round(s.bond));
        text('bond-title', engine.friendship());
        width('bond-fill', s.bond);
        text('bond-description', s.bond >= 65 ? 'Familiar paws and growing trust. Shared moments and noticed effort deepen this friendship.' : 'Care, shared moments and noticed effort grow trust. Repeat company stays kind, with smaller daily rewards.');
        for (const k of Object.keys(NEEDS)) {
            const v = Math.round(s.needs[k]);
            text('need-' + k + '-value', v + '%');
            width('need-' + k + '-fill', s.needs[k]);
            $('need-' + k).classList.toggle('low', v < 30);
            $('need-' + k + '-meter').setAttribute('aria-valuenow', v);
        }
        const t = s.task;
        let taskText = t ? t.label : s.started ? 'Wondering what comes next…' : 'A new friend. A new beginning.';
        text('task-label', taskText);
        text('task-reason', t ? t.reason : 'I’m taking it all in. What a lovely place to begin.');
        width('task-progress', t ? t.phase === 'walk' ? 0 : t.elapsed / t.duration * 100 : 0);
        text('task-phase', t ? t.phase === 'walk' ? 'On my way · ' + t.path.length + ' steps' : t.kind === 'train' ? 'Making time to learn' : t.kind === 'build' ? 'Turning a plan into a place' : 'My own little decision' : 'Thinking for myself');
        text('task-percent', t && t.phase === 'work' ? Math.round(t.elapsed / t.duration * 100) + '%' : 'Autonomous');
        text('day-label', 'Day ' + s.day);
        text('clock-time', timeLabel(s.hour));
        text('day-phase', s.hour < 6 ? 'Night' : s.hour < 12 ? 'Morning' : s.hour < 17 ? 'Afternoon' : s.hour < 21 ? 'Evening' : 'Night');
        html('clock-icon', `<use href="#i-${s.hour < 6 || s.hour >= 20 ? 'moon' : 'sun'}"/>`);
        html('pause-button', icon(s.paused ? 'play' : 'pause'));
        $('pause-button').title = s.paused ? 'Resume (Space)' : 'Pause (Space)';
        $('pause-button').setAttribute('aria-label', s.paused ? 'Resume' : 'Pause');
        $('pause-button').classList.toggle('active', s.paused);
        document.querySelectorAll('[data-act="speed"]').forEach(b => b.classList.toggle('active', Number(b.dataset.id) === s.speed && !s.paused));
        $('pause-badge').classList.toggle('show', (s.paused || !!ui.modal || !!world.placement) && s.started);
        text('pause-text', ui.modal || world.placement ? 'Planning time · the world is paused' : 'A little pause');
        $('follow-button').classList.toggle('active', s.settings.follow);
        $('focus-select').value = s.focus;
        document.querySelectorAll('[data-allowance]').forEach(e => { if (e !== document.activeElement)
            e.value = s.allowance.limit; });
        document.querySelectorAll('[data-allowance-number]').forEach(e => e.textContent = s.allowance.limit);
        document.querySelectorAll('[data-issued]').forEach(e => e.textContent = s.allowance.given + ' issued today · ' + Math.max(0, s.allowance.limit - s.allowance.given) + ' left within limit.');
        document.querySelectorAll('[data-auto-allowance]').forEach(e => e.checked = s.allowance.auto);
        document.querySelectorAll('[data-topup-label]').forEach(e => { const amt = Math.max(0, Math.min(s.allowance.limit - s.allowance.given, s.player.coins)); e.textContent = amt ? 'Share ' + amt + ' more coins today' : s.allowance.given >= s.allowance.limit ? 'Today’s limit is reached' : 'Your wallet needs coins'; });
        document.querySelectorAll('[data-act="allowance"]').forEach(e => e.disabled = s.allowance.given >= s.allowance.limit || s.player.coins === 0);
        html('story-content', storyMarkup());
        text('order-count', s.orders.length);
        html('orders-list', s.orders.length ? s.orders.map(o => { const issue = engine.orderIssue(o), active = s.task?.orderId === o.id; let sub = issue ? issue.text : active ? (s.task.phase === 'walk' ? 'Heading out: ' : '') + s.task.label : ['build','upgrade'].includes(o.type) && o.paid ? 'Stage '+(o.stage+1)+' · ' + Math.floor(engine.projectProgress(o)*100) + '% overall' : 'Pip will work out the next step'; return `<div class="order-item"><span class="order-icon">${icon(['build','upgrade'].includes(o.type) ? BUILDINGS[o.kind].icon : o.type === 'practice' ? 'book' : o.type === 'explore' ? 'compass' : o.type === 'deliver' ? 'market' : o.type === 'hunt' ? 'paw' : RES[o.resource]?.icon || 'plan')}</span><div class="order-info"><button data-act="order" data-id="${o.id}">${o.priority ? '↑ ' : ''}${esc(engine.orderName(o))}</button><small class="${issue ? 'blocked' : ''}">${esc(sub)}</small></div><button class="order-more" data-act="order" data-id="${o.id}" title="Plan details" aria-label="Details for ${esc(engine.orderName(o))}">${icon('more')}</button></div>`; }).join('') : `<div class="empty-plans">${icon('plan')}<span>No rush. Just possibilities.<br>Place a plan or share a little idea.</span></div>`);
        html('skill-chips', `<span class="skill-chip">${icon('leaf')}Foraging</span><span class="skill-chip">${icon('water')}Water gathering</span>` + Object.keys(s.skills).filter(id => s.skills[id]).slice(0,5).map(id => `<button class="skill-chip" data-act="training" data-id="${id}">${icon(SKILLS[id].icon)}${esc(SKILLS[id].short)}</button>`).join('')+(Object.keys(s.skills).length>5?`<button class="skill-chip" data-act="training">+${Object.keys(s.skills).length-5} more</button>`:''));
        html('journal-preview', s.log.slice(0, 3).map(entry => journalEntry(entry)).join('') || `<p class="empty-plans">Our story is waiting to be written.</p>`);
        if (ui.tab === 'care') {
            text('care-feed-caption', s.inventory.meals > 0 ? '1 warm meal · a full tummy' : '1 berry · a full tummy');
            document.querySelectorAll('[data-act="care"]').forEach(b => { const k = b.dataset.id, wait = Math.max(0, Math.ceil((s.cooldowns[k] || 0) - s.simTime)); const issue = engine.careIssue(k); b.disabled = !!issue; let state = b.querySelector('.action-feedback'); if (!state) {
                state = document.createElement('span');
                state.className = 'action-feedback';
                b.appendChild(state);
            } state.textContent = wait ? 'Ready in ' + wait + 's' : issue ? k === 'feed' && s.needs.food >= 94 ? 'Tummy is full' : k === 'water' && s.needs.water >= 94 ? 'Not thirsty' : k === 'praise' ? 'After recent effort' : k === 'bond' ? 'Care comes first' : 'Satchel needs supplies' : k === 'praise' ? 'A moment to notice' : 'Ready to offer'; b.title = issue || (wait ? 'Enjoying the moment · ' + wait + ' seconds' : k === 'praise' ? 'Notice a recent achievement. Praise works after learning, gathering, crafting or building.' : k === 'feed' ? 'Offer food already carried in this creature’s satchel.' : k === 'water' ? 'Offer water already carried in this creature’s satchel.' : 'Spend time watching the clouds together.'); });
        }
        if (ui.tab !== 'care' && (force || ui.dockSignature !== JSON.stringify([Object.keys(s.skills), s.buildings.map(b => b.kind), s.orders.map(o => o.kind)]))) {
            const scroll = $('dock-body').scrollLeft;
            renderDock();
            $('dock-body').scrollLeft = scroll;
        }
        const pc = $('portrait').getContext('2d');
        pc.clearRect(0, 0, 134, 138);
        pc.imageSmoothingEnabled = false;
        LWArt.pip(pc, 66, 118, 2.6, s.settings.reducedMotion ? 1 : ui.animationTime, engine.mood(), 1, s.task?.kind === 'rest' ? 'rest' : 'idle', false, engine.selected);
        if(!engine.selected)pc.clearRect(0,0,134,138);
        colonyUI.update();
        worldUI.update();buildPanel?.update();
        worldExplorer.update();
        if(tileMenu?.isOpen()){text('world-status-label','Choosing tile action · paused');text('pause-text','Choosing a tile action');$('pause-badge').classList.add('show');}
        villageUI.update();
        syncTimeLabels();
    }
    function journalEntry(e) { return `<article class="journal-entry">${icon(RES[e.icon]?.icon || e.icon)}<div><p>${esc(e.text)}</p><time>Day ${e.day} · ${timeLabel(e.hour)}</time></div></article>`; }
    function processEvents() { const events = engine.drain(); let celebration = false; for (const e of events) {
        if (e.type === 'heart') {
            world.say(e.text, 'heart', e.actorId);
            sound('heart');
        }
        else if (e.type === 'celebrate') {
            world.say(e.text, 'star', e.actorId);
            toast(e.text);
            celebration = true;
        }
        else if (['interaction','roll','transfer','social','return','arrival','building-transfer','production','harvest'].includes(e.type)){
            if(e.type==='interaction'&&['feed','water','bond','praise','soothe','space'].includes(e.kind))worldUI.afterInteraction();
            world.feedbackEvent(e);
            if(['return','arrival'].includes(e.type))toast(e.text);
        }
        else if (e.type === 'notice')
            toast(e.text, true);
    } if (celebration)
        sound('celebrate'); }
    function selectTab(tab) { ui.tab = tab; world.placement = null; refreshPlacement(); renderDock(); updateUI(); if(tab!=='care')openModal(tab==='build'?'construction':tab==='train'?'training':'warehouse'); }
    function selectBlueprint(kind,origin=null,actorId=null,approach=null) { if(!engine.unlocked('buildings',kind)){toast(engine.gateIssue('buildings',kind),true);openModal('v10-research');return;} if(engine.interactionIssue()){toast(engine.interactionIssue(),true);return;} const b = BUILDINGS[kind]; if (!b)
        return; if(ui.modal)closeModal(); placementActor=actorId||engine.selected?.id;placementApproach=approach;buildPanel?.close(false);guidePanel?.minimize();worldUI.clear({restore:false}); worldExplorer.clear(); ui.tab = 'build'; world.placement = kind; world.selected = null; world.hover = engine.s.nodes.find(n=>LWWorldContent.building(kind)?.requiresNode===n.kind&&!engine.placementIssue(kind,n.x,n.y))||{ x: 8, y: 8 }; if(origin&&Number.isInteger(origin.x)&&Number.isInteger(origin.y)){world.hover={x:origin.x,y:origin.y};world.keyboardTile={...world.hover};world.focus(origin.x,origin.y);} $('world').focus({ preventScroll: true }); renderDock(); refreshPlacement(); $('tile-tip').classList.remove('show'); toast(LWWorldContent.building(kind)?.requiresNode?'Choose a highlighted '+LWWorldContent.node(LWWorldContent.building(kind).requiresNode).name.toLowerCase()+' tile.':'Choose clear, reachable ground for the '+b.name.toLowerCase()+'.'); if (window.innerWidth < 721)
        $('world-frame').scrollIntoView({ behavior: engine.s.settings.reducedMotion ? 'instant' : 'smooth', block: 'start' }); }
    function refreshPlacement() { worldExplorer.syncLens(); $('world').classList.toggle('placing', !!world.placement); $('placement-banner').classList.toggle('show', !!world.placement); if (world.placement)
        text('placement-name', 'Imagine a ' + BUILDINGS[world.placement].name.toLowerCase()); }
    function place(kind, tile) { const target=placementActor||engine.selected?.id;const r = engine.commandActor(target,()=>{
        const previous=engine.s.buildPolicy.approach;
        if(placementApproach)engine.s.buildPolicy.approach=placementApproach;
        try{return engine.place(kind,tile.x,tile.y);}finally{engine.s.buildPolicy.approach=previous;}
      }); if (result(r)) {
        world.placement = null;
        refreshPlacement();
        renderDock();
        const issue = engine.orderIssue(r.order);
        toast(issue ? 'Plan placed. Next, ' + issue.text.toLowerCase() + '.' : 'Plan placed. '+engine.s.name+' will gather, then build.');
        updateUI(true);
    } }
    function inspect(tile) { if(tile.actorId){buildPanel?.close(false);guidePanel?.minimize();}tileMenu?.close(false); if(tile.actorId){worldExplorer.clear();if(worldUI.inspect(tile))return;}else{worldUI.clear({restore:false});if(worldExplorer.inspect(tile))return;} if(tile.actorId){engine.selectCreature(tile.actorId);updateUI(true);save();} const s = engine.s, c = s.creature; let title, desc; if (tile.objectType === 'pip' || (!tile.objectType && engine.selected && !engine.selected.activeQuest && Math.hypot(c.x - tile.x, c.y - tile.y) < 1.1)) {
        world.selected = 'pip';
        world.say(s.task?.thought || 'You’re my favorite part of this place.', 'note');
        return;
    } world.selected = null; let b = s.buildings.find(b => b.x === tile.x && b.y === tile.y); if (b) {
        openModal('building', b.id);
        return;
    } let o = s.orders.find(o => o.type === 'build' && o.x === tile.x && o.y === tile.y); if (o) {
        openModal('order', o.id);
        return;
    } let n = s.nodes.find(n => n.x === tile.x && n.y === tile.y); if (n) {
        title = n.kind === 'hunt' ? 'The woodland trail' : RES[n.kind].name;
        desc = n.kind === 'water' ? 'Fresh spring water. Pip already knows how to collect it.' : n.kind === 'hunt' ? 'A place for trained trackers to find provisions. Suggest an expedition in “Give Pip an idea”.' : (LWWorldContent.node(n.kind)?.mode==='infinite'?'Infinite supply.':n.stock+' remaining; does not regrow.')+' Creatures decide when to gather it.';
    }
    else if (terrain(tile.x, tile.y) === 'water') {
        title = 'The quiet spring';
        desc = 'A renewable source of fresh water. And a lovely place to think.';
    }
    else if (terrain(tile.x, tile.y) === 'grass') {
        title = 'A little room for tomorrow';
        desc = 'Choose a blueprint in Build to place a plan. Clicking the ground never moves Pip.';
    }
    else {
        $('tile-tip').classList.remove('show');
        return;
    } html('tile-tip', `<strong>${esc(title)}</strong><span>${esc(desc)}</span>`); $('tile-tip').classList.add('show'); ui.inspectUntil = performance.now() + 6500; }

    const PANEL_LABELS={'land-atlas':'World','world-library':'World JSON','world-import':'World import',community:'Creatures',adventures:'Quests',outfit:'Outfit',satchel:'Satchel',feelings:'Personality',character:'Character',behavior:'Decisions',warehouse:'Warehouse','adventure-library':'Adventure JSON',training:'Learning',construction:'Building',pantry:'Pantry',plans:'Plans',content:'Library',settings:'Settings','blueprint-detail':'Blueprint',recipe:'Recipe',building:'Building',order:'Project','lesson-cancel':'Learning plan'};
    function workspaceNav() {
 if (ui.modal?.startsWith('v10-')) return ''; // Shared village workspaces carry their own navigation and explicit assignees.
 if (!engine.s.started || ['welcome','reset','import-preview','content-preview','confirm-cancel','lesson-cancel','colony-confirm','adventure-review','world-visuals','settings'].includes(ui.modal)) return '';
 const group = ['blueprint-detail','building','recipe'].includes(ui.modal) ? 'construction' : ['warehouse','market'].includes(ui.modal) ? 'pantry' : ['satchel','feelings','character','behavior'].includes(ui.modal) ? 'outfit' : ui.modal;
 const links = [['community','heart','Creatures'],['training','book','Learn'],['construction','home','Build'],['plans','plan','Plans'],['adventures','compass','Quests'],['outfit','bag','Outfit'],['pantry','market','Warehouse'],['content','research','Library']];
 const shared = ['land-atlas','world-library','world-import','community','pantry','warehouse','market','content','adventure-library','settings'].includes(ui.modal);
 const context = engine.creatures.length > 1 ? `<label class="v6-actor-picker" for="cx-active-creature"><span>${shared?'Inspecting':'For'}</span><select id="cx-active-creature"><option value="" ${!engine.selected?'selected':''} disabled>Choose a creature</option>${engine.creatures.map(c=>`<option value="${c.id}" ${engine.selected?.id===c.id?'selected':''}>${esc(c.name)}${c.activeQuest?' · away':''}</option>`).join('')}</select></label>` : `<span>${shared?'Shared home':'For '+esc(engine.s.name)}</span>`;
 return `<nav class="workspace-nav" aria-label="Game workspaces">${links.map(([id,ic,label])=>`<button data-act="workspace-go" data-id="${id}" ${group===id?'aria-current="page"':''}>${icon(ic)}<span>${label}</span></button>`).join('')}</nav><div class="v6-workspace-context">${context}<span>${shared?'Shared information':'Personal skills, plans and carried supplies'}</span><span class="workspace-pause">${icon('pause')} World paused</span></div>`;
}
    function modalHead(title, desc='', eyebrow='OUR LITTLE WORLD') {
        const previous=ui.history.at(-1);
        return `<header class="modal-head"><div>${previous?`<button class="panel-back text-btn" data-act="panel-back">← ${PANEL_LABELS[previous.type]||'Back'}</button>`:''}${eyebrow?`<div class="eyebrow">${eyebrow}</div>`:''}<h2 id="modal-title" tabindex="-1">${title}</h2>${desc?`<p>${desc}</p>`:''}</div><button class="icon-btn" data-act="close-modal" aria-label="Close panel" title="Back to the glade">${icon('close')}</button></header><div class="v13-live-strip"><span data-time-label></span><button type="button" data-act="v13-manual-pause" data-manual-time>Pause time</button>${['world-visuals','settings'].includes(ui.modal)?'':'<button type="button" data-act="v13-refresh">Refresh details</button>'}</div>${workspaceNav()}`;
    }
    function modalFooter(extra='') {return `<footer class="modal-footer"><span>${icon('pause')} <span data-time-label>Time pauses while you plan.</span></span>${extra||'<button class="btn small" data-act="close-modal">Back to the glade '+icon('arrow')+'</button>'}</footer>`;}
    function rememberPanelScroll(){
        if(!ui.modal)return;
        if(ui.panelScroll.size>=80)ui.panelScroll.delete(ui.panelScroll.keys().next().value);
        ui.panelScroll.set(ui.modal+':'+(ui.modalId||''),{body:$('modal').querySelector('.modal-body')?.scrollTop||0,regions:Object.fromEntries([...$('modal').querySelectorAll('[data-scroll-key]')].map(el=>[el.dataset.scrollKey,el.scrollTop]))});
    }
    function restorePanelScroll(){
        const saved=ui.panelScroll.get(ui.modal+':'+(ui.modalId||''));if(!saved)return;
        const body=$('modal').querySelector('.modal-body');if(body)body.scrollTop=saved.body;
        for(const el of $('modal').querySelectorAll('[data-scroll-key]'))el.scrollTop=saved.regions[el.dataset.scrollKey]||0;
    }
    function openModal(type,id=null,back=false){
        tileMenu?.close(false);
        const buildType=['blueprint','blueprint-detail'].includes(type)||type==='construction';
        if(buildPanel&&buildType){
            if(id&&!engine.unlocked('buildings',id)){toast(engine.gateIssue('buildings',id),true);type='v10-research';id=null;}
            else{if(ui.modal)closeModal();worldUI.clear({restore:false});worldExplorer.clear();if(villageUI.state.open)villageUI.toggle(false);guidePanel.minimize();if(innerWidth<=720)guidePanel.reset();buildPanel.open(id);updateUI(true);return;}
        }
        if(guidePanel&&['guide','v10-guide'].includes(type)){if(ui.modal)closeModal();buildPanel.close(false);worldUI.clear({restore:false});worldExplorer.clear();if(villageUI.state.open)villageUI.toggle(false);guidePanel.open();updateUI(true);return;}
        buildPanel?.close(false);guidePanel?.minimize();
        if(type==='plans'||type==='suggest'){if(ui.modal)closeModal();worldUI.clear({restore:false});worldExplorer.clear();villageUI.toggle(true);if(type==='suggest')openModal('v10-task');return;}
        if(type==='blueprint'&&!engine.unlocked('buildings',id)){type='v10-research';id=null;}
        if(['outfit','adventures','training'].includes(type)&&!engine.selected){type='community';id=null;}
        $('toasts').querySelectorAll('.toast:not(.error)').forEach(el=>el.remove());
        const prior=ui.modal;
        if(!prior)worldUI.suspend();
        if(!prior){ui.lastFocus=document.activeElement;ui.history=[];}
        else {rememberPanelScroll();if(!back&&prior!==type&&!['content-preview','import-preview','welcome'].includes(prior)){ui.history.push({type:prior,id:ui.modalId});if(ui.history.length>12)ui.history.shift();}}
        ui.modal=type;ui.modalId=id;
        if(type==='training'&&id&&SKILLS[id]){Object.assign(progressionUI.view,{learn:'lessons',discipline:'all',status:'all',search:'',selectedSkill:id,lessonDetailOpen:true});}
        world.placement=null;refreshPlacement();renderModal();$('overlay').classList.add('show');document.body.classList.add('modal-open');$('app').inert=true;updateUI();
        const focusRequest=++ui.focusRequest;
        requestAnimationFrame(()=>{
            if(ui.focusRequest!==focusRequest||ui.modal!==type)return;
            restorePanelScroll();
            // A delayed open must not steal focus from typing or another panel.
            if(!$('modal').contains(document.activeElement)){
                ((type==='rename'?$('buddy-name-input'):null) || $('modal-title') || $('modal')).focus({preventScroll:true});
            }
        });
    }
    function cancelPendingReads(){scenarioUI?.cancelRead();storyReadId++;contentUI.view.readId++;colonyUI.cancelRead();worldExplorer.cancelRead();villageUI.cancelRead();}
    function closeModal(){
        cancelPendingReads();
        if(!engine.s.started){if(ui.modal!=='welcome'){contentUI.view.preview=null;ui.pendingImport=null;ui.history=[];openModal('welcome',null,true);}return;}
        ui.focusRequest++;rememberPanelScroll();if(ui.modal==='import-preview')ui.pendingImport=null;
        contentUI.view.preview=null;
        ui.modal=null;ui.modalId=null;ui.history=[];$('overlay').classList.remove('show');document.body.classList.remove('modal-open');$('app').inert=false;world.lastDrawAt=0;updateUI(true);
        (ui.lastFocus?.isConnected&&ui.lastFocus.offsetParent!==null&&ui.lastFocus!==document.body?ui.lastFocus:$('world')).focus({preventScroll:true});
        worldUI.resume();
    }
    function renderModal(keepScroll = false) {
        const s = engine.s, m = $('modal');
        const regions = keepScroll ? Object.fromEntries([...m.querySelectorAll('[data-scroll-key]')].map(el=>[el.dataset.scrollKey,el.scrollTop])) : {};
        const scroll = keepScroll ? m.querySelector('.modal-body')?.scrollTop || 0 : 0;
        const focusedId = keepScroll ? document.activeElement?.id : null;
        const focusedRange = keepScroll && document.activeElement instanceof HTMLInputElement && ['text','search'].includes(document.activeElement.type) ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
        const focusedCard = keepScroll ? document.activeElement?.closest('.training-card,.studio-lesson,.practice-card')?.id : null;
        const focusedAction = keepScroll ? document.activeElement?.dataset?.act : null;
        const focusedDataId = keepScroll ? document.activeElement?.dataset?.id : null;
        m.className = 'modal';
        let markup = extraModalMarkup();
        if (markup) { }
        else if (ui.modal === 'welcome') {
            m.classList.add('welcome');
            const experience=LWScenarios.builtins()[0];
            markup = `<div class="welcome-art"><canvas id="welcome-canvas" width="700" height="173" aria-hidden="true"></canvas><span class="eyebrow">LIVING WORLDS · ${esc(experience.name.toUpperCase())}</span></div><div class="modal-body"><div class="welcome-pill">${icon('leaf')}Autonomous lives. Shared possibilities.</div><h1 id="modal-title" tabindex="-1">Choose a beginning.</h1>${loadWarning?'<div class="quality-notice">'+esc(loadWarning)+'<button class="btn" data-act="recover">Review recovery</button></div>':''}<p class="intro">${esc(experience.description)}</p><div class="scenario-starts"><button class="btn primary" data-act="begin">${esc(experience.scenes[0].name)} ${icon('arrow')}</button><p>${esc(experience.scenes[0].description)}</p>${experience.scenes.length>1?'<button class="btn" data-act="land-demo">'+esc(experience.scenes[1].name)+' ↗</button><p>'+esc(experience.scenes[1].description)+'</p>':''}</div><div class="welcome-library-link"><button class="text-btn" data-act="scenarios">Worlds & scenarios · import your own ↗</button><button class="text-btn" data-act="import">Continue from a story JSON ↗</button></div><p class="footnote">This is a setting built on a reusable simulation. All play is local and offline. Export a JSON backup before replacing a story.</p></div>`;
        }
        else if (ui.modal === 'suggest') {
            const choices = [['explore', null, 'Follow a little curiosity', 'Discover ideas and help travelers. +8 coins and +2 research.', 'compass'], ['gather', 'wood', 'Collect some wood', 'Gather 6. Woodland hands needed.', 'wood'], ['gather', 'stone', 'Find useful stones', 'Gather 6. Stone sense needed.', 'stone'], ['gather', 'fiber', 'Find weaving fiber', 'Gather 6 from the meadow.', 'fiber'], ['gather', 'berries', 'Forage for berries', 'Gather 6 for the shared pantry.', 'berries'], ['gather', 'water', 'Bring fresh water', 'Collect 6 from spring or well.', 'water'], ...['clay','ore','herbs','grain'].map(r=>['gather',r,'Find '+RES[r].name.toLowerCase(),'Renewable supplies from the glade.',RES[r].icon]), ['craft', 'planks', 'Make a few planks', 'Craft 3. Lesson + workbench needed.', 'planks'], ['craft', 'meals', 'Cook something good', 'Make at least 3. Cooking + campfire needed.', 'meal'], ['hunt', null, 'Follow a woodland trail', 'Find provisions. Tracking needed.', 'paw'], ['deliver', null, 'Help a neighbor', 'Fulfill the current market request.', 'market']];
            markup = modalHead('An idea, not an instruction.', 'Pip will consider your suggestion alongside their needs. Find every recipe in the production book; building ideas go in the atlas.', 'GIVE A LITTLE ENCOURAGEMENT') + `<div class="modal-body"><div class="notice-box">${icon('paw')} A queued idea is a goal, not remote control. Pip finds the resources, picks a route, and takes breaks. You can prioritize or set ideas aside.</div><div class="modal-actions"><button class="btn" data-act="v3-recipes">${icon('book')}Production book · 14 recipes</button><button class="btn" data-act="v3-construction">${icon('home')}Construction atlas</button></div><div class="quantity-toolbar"><label for="request-quantity">Gather / craft amount</label><select id="request-quantity">${[1, 3, 6, 12, 24].map(q => `<option value="${q}" ${ui.requestQty === q ? 'selected' : ''}>${q} units</option>`).join('')}</select><small>Recipes round up to whole batches. Exploration, hunting and deliveries are one trip.</small></div><div class="suggest-grid">${choices.map(([type, r, name, desc, ic]) => `<button class="suggest-card" data-act="request" data-id="${type}" ${r ? `data-resource="${r}"` : ''}><span>${icon(ic)}</span><strong>${name}</strong><small>${type === 'gather' ? 'Gather ' + ui.requestQty + ' for our pantry. ' + (engine.missingSkill(r) ? 'Needs ' + SKILLS[engine.missingSkill(r)].short + '.' : '') : type === 'craft' ? 'Make ' + Math.ceil(ui.requestQty / RECIPES[r].amount) * RECIPES[r].amount + ' ' + RES[r].name.toLowerCase() + '. ' + (engine.missingSkill(r) ? 'Lesson needed.' : 'Uses our ' + BUILDINGS[RECIPES[r].station].name.toLowerCase() + '.') : desc}</small></button>`).join('')}</div></div>` + modalFooter();
        }
        else if (ui.modal === 'market') {
            markup = modalHead('The little glade market.', 'Shared supplies. Independent choices. A few friendly faces.', 'HELLO, NEIGHBOR');
            if (!engine.has('market'))
                markup += `<div class="modal-body"><div class="empty-state">${icon('market')}<h3>A meeting place, not yet made.</h3><p>Research <strong>Grain & patience</strong> and <strong>Hello, neighbor</strong> in tier II.<br>Build a workbench, teach the lessons, then place your market plan.<br>Pip will make its planks and gather everything else.</p><div class="button-row" style="justify-content:center"><button class="btn" data-act="training" data-id="commerce">${icon('book')}Find the lesson</button><button class="btn primary" data-act="blueprint" data-id="market">${icon('home')}Imagine our market</button></div></div></div>` + modalFooter();
            else {
                const contract = CONTRACTS[s.contractIndex % CONTRACTS.length], pending = s.orders.some(o => o.type === 'deliver');
                markup += `<div class="modal-body"><div class="contract-card">${icon('flag')}<div><div class="eyebrow" style="font-size:8px;margin-bottom:6px">NEIGHBORHOOD REQUEST</div><h3>${esc(contract.name)}</h3><p>${esc(contract.desc)}<br><strong>${esc(costString(contract.cost))}</strong> → ${contract.coins} shared coins + ${contract.rp} research</p></div><button class="btn primary" data-act="request" data-id="deliver" ${pending ? 'disabled' : ''}>${pending ? 'On Pip’s idea list' : 'Suggest helping'}</button></div><div class="notice-box">${icon('coin')} <strong>${esc(s.name)} has ${s.creature.coins} pocket coins.</strong> Pip can buy food and water here when needed, without asking. Your trades below use <strong>your</strong> wallet; sales and deliveries share earnings 70/30, with Pip’s share rounded down. ${!s.skills.commerce ? 'Teach Trading before Pip can shop independently.' : ''}</div><div class="section-heading"><h3 style="font-size:12px">Our pantry & the market</h3><button class="text-btn" data-act="ledger">Pocket money & ledger ↗</button><label style="font-size:10px;color:#8da476">Quantity <select id="trade-quantity" style="border:1px solid #d8e3c8;background:#f3f7e8;padding:5px;border-radius:5px;color:#7c9565">${[1, 5, 10].map(q => `<option value="${q}" ${q === ui.tradeQty ? 'selected' : ''}>${q}</option>`).join('')}</select></label></div>${Object.entries(RES).map(([id, r]) => { const sell = Math.max(1, Math.floor(r.price * .65)) * ui.tradeQty, buy = r.price * ui.tradeQty; return `<div class="trade-row"><span class="resource-name">${icon(r.icon)}${esc(r.name)}</span><span class="stock">${s.inventory[id]} in pantry</span><button class="btn small" data-act="trade" data-id="${id}" data-mode="sell" ${s.inventory[id] < ui.tradeQty ? 'disabled' : ''}>Sell · ${sell} ${icon('coin')}</button><button class="btn small" data-act="trade" data-id="${id}" data-mode="buy" ${s.player.coins < buy ? 'disabled' : ''}>Buy · ${buy} ${icon('coin')}</button></div>`; }).join('')}</div>` + modalFooter();
            }
        }
        else if (ui.modal === 'order') {
            const o = s.orders.find(o => o.id === ui.modalId);
            if (!o) {
                closeModal();
                return;
            }
            const issue = engine.orderIssue(o), isBuild = o.type === 'build', b = isBuild ? BUILDINGS[o.kind] : null;
            m.classList.add('small-modal');
            markup = modalHead(esc(engine.orderName(o)), 'A shared intention, with room for Pip to be Pip.', 'OUR LITTLE PLAN') + `<div class="modal-body">${b ? `<span class="plan-detail-icon">${icon(b.icon)}</span><p class="muted">${esc(b.desc)}<br>${esc(b.effect)}</p><div class="cost-grid">${Object.entries(b.cost).map(([r, n]) => `<span class="cost-chip ${s.inventory[r] < n && !o.paid ? 'missing' : ''}">${icon(RES[r].icon)}${o.paid ? 'Reserved ' : ''}${o.paid ? n : s.inventory[r] + ' / ' + n} ${esc(RES[r].name)}</span>`).join('')}</div>` : ''}<div class="notice-box">${icon(issue ? 'book' : 'paw')} ${issue ? esc(issue.text||issue) : s.task?.orderId === o.id ? esc(s.task.reason) : 'Ready for Pip to consider. Needs and training may come first.'}</div>${forecastMarkup(o)}<div class="plan-progress"><strong>${isBuild ? Math.round(o.progress / BUILDINGS[o.kind].time * 100) + '% built' : o.done + ' / ' + o.amount + ' completed'}</strong><span>${o.paid ? 'Materials reserved' : 'Supplies must be carried to the work before use'}</span></div><div class="flow-steps"><div class="flow-step"><span class="flow-dot">1</span>Check in with food, water, energy and joy</div><div class="flow-step"><span class="flow-dot">2</span>${b ? 'Know ' + SKILLS[b.skill].short : 'Know the skills this idea needs'}</div><div class="flow-step"><span class="flow-dot">3</span>Gather ingredients and craft any missing materials</div><div class="flow-step"><span class="flow-dot">4</span>${b ? 'Bring our ' + b.name.toLowerCase() + ' to life' : 'Make a little progress, then check in again'}</div></div>${issue?.skill ? `<button class="btn primary" data-act="training" data-id="${issue.skill}">${icon('book')}Explore ${esc(SKILLS[issue.skill].short)}</button>` : issue?.building ? `<button class="btn primary" data-act="blueprint" data-id="${issue.building}">${icon('home')}Plan a ${esc(BUILDINGS[issue.building].name.toLowerCase())}</button>` : ''}<div class="modal-actions"><button class="btn small" data-act="prioritize" data-id="${o.id}">${icon('flag')}${o.priority ? 'Already prioritized' : 'Make this our next idea'}</button><button class="btn small" data-act="hold" data-id="${o.id}">${icon(o.paused ? 'play' : 'pause')}${o.paused ? 'Resume idea' : 'Put on hold'}</button><button class="btn small danger" data-act="cancel-order" data-id="${o.id}">${icon('trash')}Set aside</button></div><p class="muted" style="font-size:9px;margin-top:13px">${o.paid ? 'Reserved supplies are recovered physically when this plan is set aside.' : 'Placing a plan is free. Materials are reserved only when construction begins.'} Priorities never override critical needs.</p></div>` + modalFooter();
        }
        else if (ui.modal === 'building') {
            const b = s.buildings.find(b => b.id === ui.modalId);
            if (!b) {
                closeModal();
                return;
            }
            const def = BUILDINGS[b.kind];
            m.classList.add('small-modal');
            markup = modalHead(def.name, 'A little idea became part of our world.', 'LOOK WHAT WE MADE') + `<div class="modal-body"><span class="plan-detail-icon">${icon(def.icon)}</span><p class="muted">${def.desc}<br><br><strong>${def.effect}</strong></p>${b.kind === 'garden' ? `<p class="muted" style="margin-top:12px">${b.stock} ripe berries. Next growth in ${Math.ceil(80 - b.regen)} simulation seconds.</p>` : ''}<div class="modal-actions">${b.kind === 'market' ? `<button class="btn primary" data-act="market">${icon('market')}Visit the market</button>` : b.kind === 'bench' ? `<button class="btn primary" data-act="request" data-id="craft" data-resource="planks">${icon('planks')}Suggest making planks</button>` : b.kind === 'fire' ? `<button class="btn" data-act="request" data-id="craft" data-resource="meals">${icon('meal')}Suggest cooking</button>` : ''}</div><p class="muted" style="font-size:10px;margin-top:18px">Pip chooses when to use this place. There is no “go here” command.</p></div>` + modalFooter();
        }
        else if (ui.modal === 'journal') {
            markup = modalHead('The little moments add up.', 'The most recent 70 moments of your shared story.', 'OUR JOURNAL') + `<div class="modal-body journal-full">${s.log.map(e => journalEntry(e)).join('') || '<p class="muted">A fresh page. A whole world ahead.</p>'}</div>` + modalFooter();
        }
        else if (ui.modal === 'story') {
            m.classList.add('small-modal', 'story-modal');
            markup = modalHead('Our story, together.', 'A little direction and a little independence.', 'CHAPTERS & POCKET MONEY') + `<div class="modal-body">${storyMarkup()}<div class="notice-box" style="margin-top:19px">${icon('heart')} <strong>${Math.round(s.bond)} friendship · ${engine.friendship()}.</strong><br>${icon('star')} Guide level ${s.player.level} · ${s.player.xp}/${threshold(s.player.level)} XP</div>${wishMarkup()}${allowanceMarkup()}<div class="modal-actions"><button class="btn" data-act="ledger">Our ledger ↗</button><button class="btn" data-act="journal">Our memories ↗</button></div></div>` + modalFooter();
        }
        else if (ui.modal === 'guide') {
            markup = modalHead('A field guide to being a buddy.', 'A gentle explanation of the world, and your place in it.', 'LITTLEWILD / HOW TO PLAY') + `<div class="modal-body"><div class="notice-box"><strong>Your first morning:</strong> offer a snack and water, spend time together, then celebrate the chapter. Research and teach <strong>Woodland hands</strong> and <strong>A place of our own</strong>. Place a leaf shelter in Build. Watch Pip work out the rest.</div><div class="button-row" style="margin-bottom:20px"><button class="btn primary" data-act="tour">${icon('compass')}Show me around · 6 little steps</button><button class="btn" data-act="pantry">Pantry reserves</button></div><div class="guide-grid"><section class="guide-block"><h3>${icon('paw')}You influence. Each creature decides.</h3><p>Select a companion first when there is more than one. Creatures have no movement commands. Their own food, water, rest and joy come before your ideas. “On my little mind” explains the choice, and the dotted trail shows the route. Encourage self-care, building, curiosity, or a balance.</p></section><section class="guide-block"><h3>${icon('home')}Plans, not instant buildings.</h3><p>Choose Build, then clear reachable ground. Gardens, grain patches, greenhouses and orchards need a fertile-soil node on their tile; wells need groundwater; waterwheels need a stream site. Highlighted tiles show valid sites. Each construction stage reserves only its own supplies. Installed materials can be partly salvaged. Pip gathers missing wood, stone and fiber, and crafts planks at a workbench. Plans can wait for training. The construction atlas includes upgrades, quality approaches and a production book that explains every ingredient.</p></section><section class="guide-block"><h3>${icon('book')}Research → buy → learn.</h3><p>Shared research unlocks lessons. Your coins purchase training. Queue up to four paid lessons. Pip studies one at a time with breaks for care and mental effort. Guide levels 1–4 open four tiers. Advanced lessons can require practical mastery. Prerequisites are shown on every lesson.</p></section><section class="guide-block"><h3>${icon('heart')}A relationship, not a leash.</h3><p>Food, fresh water, time together, praise for effort and shared accomplishments build trust. Pip may decline play when an urgent need calls. Each creature has a separate bond with you. Praise requires a recent achievement; spending time together has diminishing daily rewards.</p></section><section class="guide-block"><h3>${icon('coin')}Personal satchels. A shared warehouse.</h3><p>Creatures consume and use only their own carried items. They fetch, craft or gather missing supplies, and visit the warehouse to share them. You can list only deposited stock for sale after researching trade and building a market stall. A creature must carry the goods to the stall and sell them before your wallet is credited. Each companion has pocket money and a daily allowance. Quest rewards and deliveries split 70/30, with the creature’s share rounded down.</p></section><section class="guide-block"><h3>${icon('research')}Everyone has something to give.</h3><p>You gain XP from care, research and shared work. Pip gains XP by doing. Exploration, gathering practice, completed buildings, deliveries, guide levels and chapters earn shared research. A study nook adds autonomous research later. Suggest curiosity when you need new ideas or coins.</p></section><section class="guide-block"><h3>${icon('compass')}Prepare, depart, return.</h3><p>Review quests for the selected creature. They gather provisions, finish requested equipment and rest before leaving. While away, only recall is available. You review its energy cost before confirming. Finds can be listed for market delivery after a physical warehouse visit. Each owned island has its own invitation pool, guide-level requirement and game-time cooldown. Successful returns earn prestige; preparing or recalling an expedition does not.</p></section><section class="guide-block"><h3>${icon('bag')}Outfit and carrying weight.</h3><p>Carried gear can be worn; stored gear must be fetched; missing gear needs its skill, station and ingredients. A blocked outfit request also blocks departure until resolved or canceled. Worn items count toward load once. Encumbrance reduces walking speed and affects relevant checks.</p></section><section class="guide-block"><h3>${icon('heart')}Different little lives.</h3><p>Personality and traits influence preferences and reactions. Temper and company show recent causes. Rest, reassurance and space help a frustrated companion. Creatures also meet each other and form separate bonds. Essential care is never postponed for friendship.</p></section><section class="guide-block"><h3>${icon('leaf')}A forgiving little world.</h3><p>Default food, water, fiber and fallen-wood nodes are infinite. Stone, clay and ore are finite: once exhausted they stay exhausted. These modes are configurable in World JSON. Gardens need delivered water and tending. Inspect a node to see its supply and skill requirements. No death or absence penalties; time stops when the tab is hidden. Pause-on-open is configurable in Settings and Graphics & world controls.</p></section><section class="guide-block"><h3>${icon('bag')}Nothing moves by magic.</h3><p>Production uses a building’s local input tray, a paid work-in-progress batch, and a separate output tray. Creatures fetch and carry supplies, work at the station, then haul finished goods. You set batch orders, colony stock targets and priorities—not remote transfers. Pausing preserves a paid batch; full outputs stop further production. Only warehouse stock can be listed for sale; creatures transport it to a built market stall before it earns coins.</p></section><section class="guide-block"><h3>${icon('route')}A map for a wider home.</h3><p>Research Shared cartography in Discoveries, then assign a creature to build a map table. A completed, reachable table opens the World map. Select a neighboring island to compare its requirements, resource nodes and quest pool. Buying still needs land research, its guide level, coins and prestige. A permanent purchase creates bridges across shared owned edges; creatures can then walk there.</p></section><section class="guide-block"><h3>${icon('plan')}A few useful gestures.</h3><p>Drag the world to look around. Scroll or use +/− to zoom. Click a creature, resource or building to inspect it. R toggles resource labels; H recenters the camera. World opens the searchable atlas. Select a creature to open its nearby care menu. B opens the Construction Atlas; L opens learning; C opens the selected creature’s menu; Q opens quests; I opens the warehouse. Brackets [ and ] cycle companions; 1–4 offer care. Space pauses, or closes an interaction menu and resumes. Escape closes a menu, closes a panel, or cancels placement. Menus follow Pause when opening panels in Settings. Manual pause is never changed by opening or closing a view. Settings holds portable save export and import.</p></section></div></div>` + modalFooter();
        }

        else if (ui.modal === 'settings' || ui.modal === 'rename') {
            m.classList.add('settings-modal');
            markup=modalHead('Settings & your story','Your story and your content library are separate things. A story backup includes both.','MAKE YOURSELF AT HOME')+`<div class="modal-body settings-grid">
            <section class="settings-section"><h3>Make it yours</h3><div class="settings-row"><div><h4>Your buddy’s name</h4><p>Up to 20 characters.</p></div><input id="buddy-name-input" type="text" maxlength="20" value="${esc(s.name)}" aria-label="Buddy name"></div>
            ${[['sound-setting','Gentle sounds','Soft chimes for kindness and milestones.',s.settings.sound],['motion-setting','Less motion','Still scenery and quieter transitions.',s.settings.reducedMotion],['contrast-setting','Stronger contrast','Darker labels and more distinct borders.',s.settings.highContrast]].map(([id,h,p,on])=>`<label class="settings-row" for="${id}"><div><h4>${h}</h4><p>${p}</p></div><input id="${id}" type="checkbox" ${on?'checked':''}></label>`).join('')}</section>
            <section class="settings-section"><h3>Story & progress</h3>${loadWarning?'<div class="quality-notice" role="status">'+esc(loadWarning)+'</div>':''}${ui.backupStatus?'<div class="quality-notice">'+esc(ui.backupStatus)+'</div>':''}<p>${saveAvailable?'Your story auto-saves in this browser.':'Local storage is unavailable here.'} Export a JSON copy before switching devices or replacing a story. The world rests while you are away.</p><div class="button-row"><button class="btn primary" data-act="export">${icon('download')}Export story</button><button class="btn" data-act="import">${icon('upload')}Import story</button><button class="btn small" data-act="recover">Review recovery copy</button></div><small>Imports the current portable story format 10. Exports include every creature, explicit archetype/personality identity, owned islands, invitation clocks, building inventory, simulation profile and the exact bundled definition libraries.</small></section>
            ${pauseToggleMarkup()}<section class="settings-section content-settings"><span class="eyebrow">FOR EXTERNAL AUTHORING</span><h3>Game content definitions</h3><p>Items, recipes, skills, buildings and progression data—not Pip’s inventory or progress. Inspect, export, edit in your tool, then validate and preview changes here.</p><div class="button-row"><button class="btn" data-act="content">${icon('book')}Open content library</button><button class="btn small" data-act="lib-schema">Export JSON Schema</button></div></section>
            <section class="settings-section"><h3>Help & a fresh start</h3><div class="button-row"><button class="btn" data-act="guide">${icon('help')}Field guide</button><button class="btn" data-act="tour">Walkthrough</button><button class="btn danger" data-act="reset-confirm">New story…</button></div></section>
            <p class="settings-version">Littlewild v15.0 · Data-driven worlds and creatures. Independent companions; a shared home. Offline · no accounts · no external assets.</p></div>`+modalFooter();
        }
        else if (ui.modal === 'reset') {
            m.classList.add('small-modal');
            markup = modalHead('A new page in the story.', 'This replaces the current local story. Export it first to keep a copy.', 'A FRESH BEGINNING') + `<div class="modal-body"><p class="muted">Start with a new friendship, or explore a mid-game camp with a shelter, workbench, fire, garden and working marketplace.</p><div class="modal-actions"><button class="btn" data-act="export">${icon('download')}Export current story</button><button class="btn primary" data-act="reset-new">A new friendship</button><button class="btn" data-act="demo">An established camp</button><button class="btn" data-act="demo-workshop">A growing workshop</button></div></div>` + modalFooter();
        }
        if(engine.selected&&['training','construction','blueprint-detail','recipe','building','plans','order','ledger','suggest','guide'].includes(ui.modal))markup=markup.replace(/\bPip\b/g,esc(engine.selected.name));
        m.innerHTML = markup;
        colonyUI.paint();
        progressionUI.afterRender();
        if (keepScroll) {
            for(const el of m.querySelectorAll('[data-scroll-key]'))el.scrollTop=regions[el.dataset.scrollKey]||0;
            const body = m.querySelector('.modal-body');
            if (body)
                body.scrollTop = scroll;
            if (focusedId && $(focusedId)) {
                $(focusedId).focus({ preventScroll: true });
                if(focusedRange && $(focusedId) instanceof HTMLInputElement) $(focusedId).setSelectionRange(...focusedRange);
            }
            else if (focusedCard)
                $(focusedCard)?.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
            else if (focusedAction)
                ([...m.querySelectorAll('[data-act]')].find(el=>el.dataset.act===focusedAction && (focusedDataId==null||el.dataset.id===focusedDataId) && !el.disabled)||m.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
        }
        if (ui.modal === 'welcome')
            requestAnimationFrame(drawWelcome);
    }
    function drawWelcome() { const c = $('welcome-canvas'); if (!c)
        return; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; LWArt.diamond(g, 350, 127, 275, 78, '#b6c58a'); LWArt.diamond(g, 350, 129, 220, 55, '#bfcc92'); LWArt.tree(g, 269, 111, 1); LWArt.tree(g, 436, 111, 2); LWArt.bush(g, 402, 151, 4); LWArt.fiber(g, 301, 150); LWArt.pip(g, 350, 133, 1.6, 1, 'Content'); g.font = '18px Georgia'; g.fillStyle = '#be9980'; g.fillText('♥', 367, 80); for (const [x, y] of [[315, 117], [410, 120], [302, 127], [377, 151]]) {
        LWArt.rect(g, x, y, 2, 4, '#8caa73');
        LWArt.rect(g, x - 1, y - 1, 4, 2, '#f2e8bd');
    } }
    function questGo(id) { if (['feed', 'water', 'bond'].includes(id)) {
        if (ui.modal)
            closeModal();
        selectTab('care');
        result(engine.care(id));
    }
    else if (id.startsWith('train:'))
        openModal('training', id.slice(6));
    else if (id.startsWith('build:'))
        selectBlueprint(id.slice(6));
    else if (id === 'request:planks') {
        if (result(engine.request('craft', 'planks'), 'A little plank-making idea added.'))
            closeModal();
    }
    else if (id === 'trade')
        openModal('market'); }
    document.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-act]');
        if (!b || b.disabled)
            return;
        const a = b.dataset.act, id = b.dataset.id;
        if(a==='pause'||a==='speed'){timeAction(a,id,e.detail>0?ui.timeIntent:null);return;}
        if(a==='v13-manual-pause'){engine.s.paused=!engine.s.paused;updateUI(true);save();return;}
        if(a==='v13-refresh'){if(ui.modal==='v10-task'||ui.modal?.includes('preview')||ui.modal?.includes('import')||['rename','world-visuals','settings'].includes(ui.modal)){toast('This form keeps your current draft. Live values are rechecked when you confirm.');syncTimeLabels();return;}renderModal(true);syncTimeLabels();return;}
        if(a==='v12-visuals'){openModal('world-visuals');return;}
        if(a==='v12-quality'){world.setQuality(id);renderModal(true);return;}
        if(a==='v12-motion'){engine.s.settings.reducedMotion=!engine.s.settings.reducedMotion;world.invalidate();save();renderModal(true);return;}
        if(a==='scenarios'){openModal('scenarios');return;}
        if(a==='blueprint'){openModal('blueprint-detail',id);return;}
        if(a==='begin'||a==='land-demo'){const pack=LWScenarios.builtins()[0];const ready=LWScenarios.prepareScene(pack,pack.scenes[a==='begin'?0:Math.min(1,pack.scenes.length-1)].id);backupStory();setEngine(LWScenarios.commitScene(ready));closeModal();save();if(a==='begin')openModal('v10-guide');return;}
        if(a==='cx-select'){buildPanel?.close(false);guidePanel?.minimize();}
        if(villageUI.action(a,id,b))return;
        if(worldExplorer.action(a,id,b))return;
        if(worldUI.action(a,id,b,e))return;
        if(colonyUI.action(a,id,b))return;
        const gated=['care','request','blueprint','rename','allowance','stock-preset','set-focus','confirm-rename','v3-path','v3-approach','v3-study-pause'];
        if(engine.interactionIssue()&&gated.includes(a)){toast(engine.interactionIssue(),true);return;}
        if(contentUI.action(a,id,b))return;
        if(a==='workspace-go'){ui.history=[];openModal(id,null,true);return;}
        if(a==='panel-back'){const previous=ui.history.pop();if(previous)openModal(previous.type,previous.id,true);return;}
        if(progressionUI.action(a,id,b)) return;
        if (['pantry', 'ledger', 'plans', 'decision', 'tour'].includes(a)) {
            if (a === 'tour')
                ui.tourStep = 0;
            openModal(a);
        }
        else if (a === 'tour-step') {
            ui.tourStep = clamp(Number(id), 0, 5);
            renderModal();
            $('modal').focus();
        }
        else if (a === 'lesson-filter') {
            ui.lessonFilter = id;
            renderModal(true);
        }
        else if (a === 'journal-filter') {
            ui.journalTab = id;
            renderModal(true);
        }
        else if (a === 'stock-preset') {
            engine.s.stockTargets = id === 'builder' ? { ...Object.fromEntries(Object.keys(RES).map(r=>[r,0])), wood: 8, stone: 6, fiber: 4, berries: 6, water: 6, planks: 4 } : { ...Object.fromEntries(Object.keys(RES).map(r=>[r,0])), berries:4, water:3 };
            renderModal(true);
            updateUI();
            save();
            toast('Pantry targets updated. Pip will stock up when ready.');
        }
        else if (a === 'build-from-board') {
            closeModal();
            selectTab('build');
        }
        else if (a === 'wish') {
            const w = engine.s.wish;
            if (w.action === 'feed' || w.action === 'bond') {
                selectTab('care');
                result(engine.care(w.action));
            }
            else if (w.action === 'explore')
                result(engine.request('explore'), 'A little exploration idea shared.');
            else
                openModal('suggest');
        }
        else if (a === 'confirm-cancel') {
            engine.cancel(id);
            openModal('plans');
            updateUI(true);
            save();
            toast('Idea set aside. Unused reserves returned; completed construction stages partially salvaged.');
        }
        else if (a === 'confirm-import') {
            if (ui.pendingImport) {
                backupStory();
                const imported = ui.pendingImport;
                ui.pendingImport = null;
                setEngine(LWStory.commit(imported));
                closeModal();
                if (!engine.s.started)
                    openModal('welcome');
                save();
                toast('Your story is home. Welcome back, ' + engine.s.name + '.');
            }
        }
        else if (a === 'recover') {
            try {
                ui.pendingImport = storage.recovery();
                openModal('import-preview');
            }
            catch (err) {
                toast(err.message, true);
            }
        }
        else if (a === 'begin'){start();openModal('v10-guide');}
        else if (a === 'demo')
            start(true);
        else if (a === 'demo-workshop') {backupStory();setEngine(LW.createWorkshopDemo());closeModal();save();world.say('I have an idea. And so much left to learn.','book');updateUI(true);}
        else if (a === 'close-modal')
            closeModal();
        else if (a === 'pause') {
            engine.s.paused = !engine.s.paused;
            updateUI();
            save();
        }
        else if (a === 'speed') {
            engine.s.speed = Number(id);
            engine.s.paused = false;
            updateUI();
        }
        else if (a === 'tab')
            selectTab(id);
        else if (a === 'care')
            result(engine.care(id));
        else if (a === 'claim') {
            result(engine.claimQuest(), 'A shared milestone. A new chapter awaits.');
            if (ui.modal === 'story')
                renderModal(true);
        }
        else if (a === 'quest-go')
            questGo(id);
        else if (a === 'blueprint')
            selectBlueprint(id);
        else if (a === 'cancel-placement') {
            world.placement = null;
            refreshPlacement();
            renderDock();
        }
        else if (a === 'training')
            openModal('training', id || null);
        else if (a === 'research') {
            result(engine.research(id));
            renderModal(true);
        }
        else if (a === 'teach') {
            if (result(engine.teach(id), 'Lesson purchased. Pip will make time for it.'))
                closeModal();
        }
        else if (a === 'buddy-status')
            document.querySelector('.buddy-card').scrollIntoView({ behavior: engine.s.settings.reducedMotion ? 'instant' : 'smooth', block: 'start' });
        else if (a === 'suggest')
            openModal('suggest');
        else if (a === 'request') {
            if (result(engine.request(id, b.dataset.resource || null, ui.modal === 'suggest' && ['gather', 'craft'].includes(id) ? ui.requestQty : null), 'An idea shared. Pip will choose the next step.'))
                closeModal();
        }
        else if (a === 'market')
            openModal('market');
        else if (a === 'trade') {
            result(engine.trade(id, b.dataset.mode, ui.tradeQty));
            renderModal(true);
        }
        else if (a === 'order')
            openModal('order', id);
        else if (a === 'prioritize') {
            engine.prioritize(id);
            toast('Idea prioritized. Pip’s needs still come first.');
            renderModal(true);
            updateUI(true);
            save();
        }
        else if (a === 'hold') {
            engine.pauseOrder(id);
            renderModal(true);
            updateUI(true);
            save();
        }
        else if (a === 'cancel-order') {
            ui.confirmOrder = id;
            openModal('confirm-cancel');
        }
        else if (a === 'allowance') {
            result(engine.topUp());
            if (['story', 'ledger'].includes(ui.modal))
                renderModal(true);
        }
        else if (a === 'journal')
            openModal('journal');
        else if (a === 'guide')
            openModal('guide');
        else if (a === 'story')
            openModal('story');
        else if (a === 'settings')
            openModal('settings');
        else if (a === 'rename')
            openModal('rename');
        else if (a === 'zoom-in')
            world.zoom(1.15);
        else if (a === 'zoom-out')
            world.zoom(1 / 1.15);
        else if (a === 'home-view') {
            world.home();
            engine.s.settings.follow = false;
            updateUI();
        }
        else if (a === 'path') {
            world.showPath = !world.showPath;
            $('path-button').classList.toggle('active', world.showPath);
        }
        else if (a === 'follow') {
            engine.s.settings.follow = !engine.s.settings.follow;
            updateUI();
        }
        else if (a === 'fullscreen') {
            try {
                if (document.fullscreenElement)
                    await document.exitFullscreen();
                else if ($('world-frame').requestFullscreen)
                    await $('world-frame').requestFullscreen();
                else
                    toast('Fullscreen is not supported here. Pinch or use the zoom controls.', true);
            }
            catch (_) {
                toast('This browser does not allow fullscreen here.', true);
            }
        }
        else if (a === 'export')
            exportSave();
        else if (a === 'import')
            $('import-file').click();
        else if (a === 'reset-confirm')
            openModal('reset');
        else if (a === 'reset-new') {
            backupStory();
            setEngine(new Engine());
            save(true);
            ui.modal = 'welcome';
            renderModal();
            updateUI(true);
        }
    });
    document.addEventListener('input', e => { const el = e.target; if(contentUI.input(el)||progressionUI.input(el))return; if (el.hasAttribute('data-allowance')) {
        engine.setAllowance(Number(el.value));
        updateUI();
        save();
    }
    else if (el.id === 'buddy-name-input') { if(engine.interactionIssue()){el.value=engine.s.name;return;}
        const value = el.value.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 20);
        if (value) {
            engine.s.name = value;
            updateUI(true);
            save();
        }
    } });
    document.addEventListener('change', e => { const el = e.target; if(contentUI.change(el)||progressionUI.change(el))return; if (el.hasAttribute('data-stock-target')) {
        const r = engine.setStockTarget(el.dataset.stockTarget, Number(el.value));
        if (!r.ok) {
            toast(r.reason, true);
            el.value = engine.s.stockTargets[el.dataset.stockTarget];
        }
        updateUI();
        save();
    }
    else if (el.id === 'request-quantity') {
        ui.requestQty = Number(el.value);
        renderModal(true);
    }
    else if (el.id === 'sourcing-select') {
        engine.s.allowance.sourcing = el.value;
        save();
    }
    else if (el.id === 'pocket-reserve') {
        const n = Number(el.value);
        if (Number.isInteger(n) && n >= 0 && n <= 30) {
            engine.s.allowance.reserve = n;
            save();
        }
        else {
            el.value = engine.s.allowance.reserve;
            toast('Choose a reserve from 0 to 30 coins.', true);
        }
    }
    else if (el.id === 'contrast-setting') {
        engine.s.settings.highContrast = el.checked;
        updateUI();
        save();
    }
    else if (el.id === 'focus-select') {
        engine.s.focus = el.value;
        toast('A little encouragement toward ' + ({ balanced: 'balance', cozy: 'self-care', builder: 'building', curious: 'curiosity' }[el.value]) + '.');
        save();
    }
    else if (el.hasAttribute('data-auto-allowance')) {
        engine.s.allowance.auto = el.checked;
        updateUI();
        save();
    }
    else if (el.id === 'trade-quantity') {
        ui.tradeQty = Number(el.value);
        renderModal(true);
    }
    else if (el.id === 'sound-setting') {
        engine.s.settings.sound = el.checked;
        sound('heart');
        save();
    }
    else if (el.id === 'motion-setting') {
        engine.s.settings.reducedMotion = el.checked;
        updateUI();
        save();
    } });
    document.addEventListener('change',event=>{if(!event.target.matches('[data-pause-on-open]'))return;preferences.set(event.target.checked);document.querySelectorAll('[data-preference-status]').forEach(el=>el.textContent=preferences.error||'Preference saved on this device.');world.invalidate();updateUI(true);text('world-announcement',preferences.pauseOnOpen?'Panels pause time; manual pauses remain unchanged.':'Panels no longer pause time; manual pauses remain unchanged.');});
    $('import-file').addEventListener('change', async (e) => { const file = e.target.files?.[0]; if (!file)
        return; const read=++storyReadId;try {
        if (file.size > LWStory.SAVE_LIMIT) throw Error('Story files must be smaller than '+(LWStory.SAVE_LIMIT/1024/1024)+' MiB.');
        const source=await file.text();if(read!==storyReadId)return;
        const imported = LWStory.inspect(source);
        ui.pendingImport = imported;
        openModal('import-preview');
    }
    catch (err) {
        if(read===storyReadId)toast('Save not imported: ' + err.message, true);
    }
    finally {
        e.target.value = '';
    } });
    $('overlay').addEventListener('click', e => { if (e.target === $('overlay'))
        closeModal(); });
    document.addEventListener('keydown', e => {if(e.target.closest('#tile-context'))return; const editable = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable; if (e.key === 'Escape') {
        e.preventDefault();
        if (ui.modal)
            closeModal();
        else {
            world.placement = null;
            refreshPlacement();
            renderDock();
            $('tile-tip').classList.remove('show');
        }
        return;
    } if (ui.modal && e.key === 'Tab') {
        const focusable = [...$('modal').querySelectorAll('button:not(:disabled),input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
        if (!focusable.length)
            return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (!focusable.includes(document.activeElement)) {
            e.preventDefault();
            (e.shiftKey ? last : first).focus();
        }
        else if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        }
        else if (!e.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) {
            e.preventDefault();
            first.focus();
        }
        return;
    } if (editable || ui.modal || e.ctrlKey || e.metaKey || e.altKey)
        return; if (e.target.closest('[role=tablist]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const tabs = [...document.querySelectorAll('[role=tab]')], at = tabs.indexOf(e.target);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (at + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next].click();
        tabs[next].focus();
        return;
    } if (e.code === 'Space' && e.target.closest('button,a,[role=button]'))
        return; if (e.repeat)
        return; if (e.code === 'Space') {
        e.preventDefault();timeAction('pause');return;
    } if (e.key.toLowerCase() === 'p')
        openModal('pantry');
    else if (e.key.toLowerCase() === 'j')
        openModal('journal');
    else if (e.key.toLowerCase() === 'b')
        selectTab('build');
    else if (e.key.toLowerCase() === 'c')
        selectTab('care');
    else if (e.key.toLowerCase() === 'l')
        openModal('training');
    else if (e.key === '?')
        openModal('guide');
    else if (['1', '2', '3', '4'].includes(e.key))
        result(engine.care(['feed', 'water', 'bond', 'praise'][Number(e.key) - 1])); });
    window.addEventListener('pagehide',()=>{save();clock.reset();});
    window.addEventListener('beforeunload', () => save());
    document.addEventListener('visibilitychange', () => { if (document.hidden)
        save(); last = performance.now(); clock.reset(); });

    document.addEventListener('change',ev=>{if(!engine.interactionIssue())return;if(ev.target.matches('#focus-select,[data-allowance],[data-auto-allowance],[data-stock-target],#sourcing-select,#pocket-reserve')){ev.stopImmediatePropagation();toast(engine.interactionIssue(),true);updateUI(true);}},true);
    document.addEventListener('input',ev=>{if(!engine.interactionIssue())return;if(ev.target.matches('[data-allowance],[data-stock-target],#pocket-reserve')){ev.stopImmediatePropagation();updateUI(true);}},true);
    renderDock();
    updateUI(true);
    if (!engine.s.started)
        openModal('welcome');
    else if (engine.s.paused)
        toast('Your story is paused. Press Play whenever you’re ready.');
    if (loadWarning)
        toast(loadWarning, true);
    const clock = new LWFixedStepClock(.1);
    const pacer = new LWPresentation.FramePacer(30);
    let last = performance.now(), paintTimer = 0, saveTimer = 0;
    function frame(now) {
        const dt = Math.max(0, Math.min((now - last) / 1000, .1));
        last = now;
        if (!document.hidden) {
            const running = pauseStatus().running;
            if (running) {
                clock.advance(dt, engine.s.speed, step => { world.motion.begin(engine.creatures); engine.step(step); world.motion.end(engine.creatures, engine.s.simTime); });
            } else clock.reset();
            world.running=running;
            world.presentationAlpha=running?clock.pending/clock.step:1;
            ui.animationTime += dt;
            if (((!ui.modal || running) && pacer.due(now, !world.lastDrawAt)) || !world.lastDrawAt) {
                world.draw(ui.animationTime, Math.min(.1, (now - (world.lastDrawAt || now)) / 1000));
                world.lastDrawAt = now;
                worldUI.paint();
                worldExplorer.paint();
                tileMenu.position();
            }
            paintTimer += dt;
            saveTimer += dt;
            if (paintTimer >= .25) {
                paintTimer = 0;
                updateUI();
                processEvents();
                // Read-only detail views refresh while live. Editable forms and quotes
                // retain their drafts; the explicit Refresh details button updates them.
                if(running&&ui.modal&&['character','behavior','satchel','feelings'].includes(ui.modal)&&!$('modal').contains(document.activeElement))renderModal(true);
            }
            if (saveTimer >= 5) {
                saveTimer = 0;
                save();
            }
            if (ui.inspectUntil && now > ui.inspectUntil) {
                $('tile-tip').classList.remove('show');
                ui.inspectUntil = 0;
            }
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    // A small, explicit read/test surface for this prototype. The UI never uses direct movement commands.
    window.Littlewild = { version: '15.0.0', scenarios:LWScenarios, scenarioUI, buildPanel, guidePanel, preferences, pauseStatus, tileMenu, village:villageUI, planner:LWPlanner, land: worldExplorer, get engine() { return engine; }, get world() { return world; }, get ui() { return { tab: ui.tab, modal: ui.modal, context:worldUI.state }; }, setEngine, snapshot: () => LWStory.encode(engine), content: {export:(category,id)=>LWContent.registry.export(category,id),validate:input=>LWContent.registry.prepare(input),schema:()=>LWContent.copy(LWContent.SCHEMA),get fingerprint(){return LWContent.registry.hash;}}, advance: seconds => { engine.advance(clamp(seconds, 0, 3600)); updateUI(true); processEvents(); }, refresh: () => updateUI(true), open: (panel, id) => openModal(panel, id), save, diagnostics: () => ({ offline: true, simulationStep: clock.step, nodes: engine.s.nodes.length, buildings: engine.s.buildings.length, orders: engine.s.orders.length, localSaving: saveAvailable }) };
})();
