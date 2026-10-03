/* Application shell. Only explicit user actions write state; the simulation owns every movement decision. */
(function () {
    'use strict';
    // The player host owns the process-global context for this document's lifetime.
    LWDeveloperSession.claimHost();
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

    let storyReadId = 0;
    let engine = new Engine(), saveAvailable = true, loadWarning = '';
    engine.s.settings.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const loaded=storage.load();
    if(loaded.value)engine=LWStory.commit(loaded.value);
    else {const pack=LWScenarios.builtins()[0];engine=LWScenarios.commitScene(LWScenarios.prepareScene(pack,pack.scenes[0].id));engine.s.started=false;}
    if(loaded.error==='unavailable')saveAvailable=false;
    if(loaded.error==='corrupt')loadWarning='The previous save could not be read and has not been overwritten. Review a recovery copy or import a backup. Starting a new story explicitly replaces it.';
    const ui = { tab: 'care', modal: null, modalId: null, tradeQty: 5, inspectUntil: 0, animationTime: 0, lastFocus: null, fullscreen: false, lastPaint: 0, lastSave: 0, toastTimes: new Map(), lastStory: '', dockSignature: '', requestQty: 6, lessonFilter: 'all', lessonSearch: '', journalTab: 'memories', pendingImport: null, confirmOrder: null, backupStatus: '', tourStep: 0, history: [], focusRequest: 0, panelScroll: new Map() };
    // Helpers share UI drafts and read the current collaborators through live getters.
    const interfaceContext={
        $,esc,icon,text,html,width,ui,
        BUILDINGS,CONTRACTS,Engine,RECIPES,RES,SKILLS,clamp,threshold,
        storage,save,exportSave,backupStory,setEngine,start,cancelPendingReads,
        modalHead,modalFooter,openModal,closeModal,renderModal,extraModalMarkup,
        allowanceMarkup,forecastMarkup,storyMarkup,wishMarkup,journalEntry,costString,taskETA,
        selectBlueprint,selectTab,place,refreshPlacement,renderDock,updateUI,
        sound,toast,result,timeAction,timeLabel,pauseToggleMarkup,syncTimeLabels,
        get buildPanel(){return buildPanel;},
        get clock(){return clock;},
        get colonyUI(){return colonyUI;},
        get contentUI(){return contentUI;},
        get engine(){return engine;},
        get guidePanel(){return guidePanel;},
        get last(){return last;},set last(value){last=value;},
        get loadWarning(){return loadWarning;},
        get preferences(){return preferences;},
        get progressionUI(){return progressionUI;},
        get saveAvailable(){return saveAvailable;},
        get scenarioUI(){return scenarioUI;},
        get storyReadId(){return storyReadId;},set storyReadId(value){storyReadId=value;},
        get tileMenu(){return tileMenu;},
        get villageUI(){return villageUI;},
        get world(){return world;},
        get worldExplorer(){return worldExplorer;},
        get worldUI(){return worldUI;}
    };
    const interfaceStatus=LWInterfaceStatus.create(interfaceContext);
    const interfaceModalContent=LWInterfaceModalContent.create(interfaceContext);
    const interfaceStoryPanels=LWInterfaceStoryPanels.create(interfaceContext);
    const interfaceModal=LWInterfaceModal.create(interfaceContext);
    const progressionUI = LWProgressionUI.create({engine:()=>engine,icon,esc,head:modalHead,footer:modalFooter,open:openModal,redraw:()=>renderModal(true),save,close:closeModal,result});
    const contentUI = LWContentUI.create({engine:()=>engine,icon,esc,head:modalHead,footer:modalFooter,open:openModal,redraw:()=>renderModal(true),toast,backup:backupStory,setEngine,save});
    const colonyUI = LWColonyUI.create({engine:()=>engine,icon,esc,head:modalHead,footer:modalFooter,open:openModal,redraw:()=>{if(ui.modal)renderModal(true);},toast,backup:backupStory,setEngine,save,close:closeModal,result});
    const preferences=LWInterfacePause.create(()=>localStorage);
    let terraform=null, buildingInterior=null, tileMenu=null, buildPanel=null, guidePanel=null, scenarioUI=null, placementActor=null, placementApproach=null;
    function pauseStatus(){return preferences.status(engine.s,{hidden:document.hidden,cinematic:!!scenarioUI?.storytelling?.isPresenting(),modal:ui.modal,safety:LWInterfacePause.safetyView(ui.modal),placement:!!world.placement,creature:!!worldUI.state.actorId,more:!!worldUI.state.menu,world:!!buildPanel?.designer?.isOpen()||!!terraform?.state.open||!!worldExplorer.pauseReason()||!!buildPanel?.state.open||!!(guidePanel?.state.open&&!guidePanel.state.minimized),tile:!!tileMenu?.isOpen(),planner:!!villageUI.state.open});}
    function pauseToggleMarkup(){return `<section class="v13-time-setting"><h3>Time & attention</h3><label><input type="checkbox" data-pause-on-open ${preferences.pauseOnOpen?'checked':''}><span><strong>Pause when opening panels</strong><small>Include creature cards, tile menus, the planner, world map, and blueprint placement. Turn off to keep the world running while you browse.</small></span></label><p>Manual pause is always respected. Save/content replacement previews and hidden tabs still pause safely. This preference stays on this device, separately from your story.</p><small data-preference-status>${esc(preferences.error||'Preference saved on this device.')}</small></section>`;}
    function syncTimeLabels(){const p=pauseStatus();document.body.classList.toggle('world-live-panel',!!ui.modal&&p.running);document.querySelectorAll('[data-pause-on-open]').forEach(el=>{if(el.checked!==preferences.pauseOnOpen)el.checked=preferences.pauseOnOpen;});document.querySelectorAll('[data-time-label]').forEach(el=>{el.textContent=p.running?'World running · '+timeLabel(engine.s.hour):p.kind==='manual'?'Paused by you':p.reason+' · paused';});text('world-status-label',p.running?'Life in the glade':p.reason+' · paused');text('v10-planner-clock',p.running?'World running':p.kind==='manual'?'Paused by you':'Planner · paused');document.querySelectorAll('[data-manual-time]').forEach(el=>{el.textContent=engine.s.paused?(preferences.pauseOnOpen?'Release manual pause':'Resume time'):'Pause time';el.setAttribute('aria-pressed',String(engine.s.paused));});$('pause-badge').classList.toggle('show',!p.running&&engine.s.started&&!ui.modal);text('pause-text',p.reason);$('pause-button').innerHTML=icon(p.running?'pause':'play');$('pause-button').setAttribute('aria-label',p.running?'Pause':p.kind==='manual'?'Resume':'Continue world');const tip=document.querySelector('#tile-context footer');if(tip)tip.innerHTML=(p.running?'World running':p.kind==='manual'?'Paused by you':'Paused while choosing')+' · <kbd>Esc</kbd> to close';const paused=$('modal').querySelector('.workspace-pause');if(paused)paused.textContent=p.running?'World running':'World paused';}

    // Capture time intent before an outside-pointer handler dismisses an overlay.
    document.addEventListener('pointerdown',event=>{if(event.target.closest('[data-act="pause"],[data-act="speed"]'))ui.timeIntent=pauseStatus().running?'pause':'resume';},true);
    function timeAction(action,id,intent=null){const resume=action==='speed'||intent==='resume'||(!intent&&!pauseStatus().running);ui.timeIntent=null;
        if(resume&&preferences.pauseOnOpen){buildPanel?.close(false);buildPanel?.designer?.close(false);guidePanel?.minimize();tileMenu?.close(false);worldUI.clear({restore:false});worldExplorer.clear();if(villageUI.state.open)villageUI.toggle(false);world.placement=null;refreshPlacement();}
        engine.s.paused=!resume;if(action==='speed')engine.s.speed=Number(id);updateUI(true);save();
    }
    let world = LWRendererHost.create({canvas:$('world'), engine, command:command=>{const returned=engine.dispatchCommand(command);result(returned);updateUI(true);save();return returned;}, handlers: { place: (kind, tile) => place(kind, tile), inspect: inspect, context:(tile,p,source)=>tileMenu?.open(tile,p,source), cursor:tile=>text('world-announcement','Tile '+tile.x+', '+tile.y+'. Press Shift F10 for actions.'), blocked:()=>!!ui.modal, pan:()=>{tileMenu?.close(false);worldUI.cameraGesture();worldExplorer.clear();} }});
    const worldUI = LWWorldUI.create({pauseStatus,engine:()=>engine,world:()=>world,esc,icon,open:openModal,modal:()=>ui.modal,refresh:()=>updateUI(true),save,result,toast,colonyAction:(a,id,b)=>colonyUI.action(a,id,b),cancelPlacement:()=>{world.placement=null;refreshPlacement()}});
    const worldExplorer = LWWorldExplorer.create({pauseStatus,engine:()=>engine,world:()=>world,esc,icon,head:modalHead,footer:modalFooter,open:openModal,close:closeModal,modal:()=>ui.modal,redraw:()=>renderModal(true),toast,save,backup:backupStory,setEngine,blueprint:selectBlueprint,visit:(id,origin)=>buildingInterior?.open(id,origin),clearCreature:()=>worldUI.clear({restore:false})});
    const villageUI=LWVillageUI.create({pauseStatus,engine:()=>engine,world:()=>world,esc,icon,head:modalHead,footer:modalFooter,open:openModal,close:closeModal,modal:()=>ui.modal,redraw:()=>renderModal(true),toast,save,backup:backupStory,setEngine,blueprint:selectBlueprint,result,clearContext:()=>{worldUI.clear({restore:false});worldExplorer.clear();},selectCreature:id=>worldUI.openFor(id,null,{focus:true})});
    tileMenu=LWTileContext.create({engine:()=>engine,world:()=>world,village:()=>villageUI,esc,modal:()=>ui.modal,open:openModal,inspect,visit:(id,origin)=>buildingInterior?.open(id,origin),show:(type,id)=>worldExplorer.show(type,id),refresh:()=>updateUI(true),clearOther:()=>{worldUI.clear({restore:false});worldExplorer.clear();if(villageUI.state.open)villageUI.toggle(false);},command:r=>{result(r,r.ok?'Request saved. Creatures handle the work.':null);},cancelPlacement:()=>{world.placement=null;refreshPlacement();}});
    terraform=window.LWTerraformUI?.create({engine:()=>engine,world:()=>world,esc,save,refresh:()=>updateUI(true),closeContexts:()=>{buildingInterior?.close(false);closeModal();tileMenu?.close(false);worldUI.clear({restore:false});worldExplorer.clear();buildPanel?.close(false);buildPanel?.designer?.close(false);guidePanel?.minimize();if(villageUI.state.open)villageUI.toggle(false);world.placement=null;refreshPlacement();}});
    const terraformButton=document.createElement('button');terraformButton.textContent='Terraform this world';terraformButton.addEventListener('click',()=>terraform.open());$('world-more').prepend(terraformButton);
    const panelContext={engine:()=>engine,world:()=>world,esc,icon,pauseStatus,open:openModal,save,toast,blueprint:selectBlueprint};
    buildingInterior=LWBuildingInteriorUI.create({engine:()=>engine,world:()=>world,esc,save,refresh:()=>updateUI(true),closeContexts:()=>{terraform?.close(false);closeModal();tileMenu?.close(false);worldUI.clear({restore:false});worldExplorer.clear();buildPanel?.close(false);buildPanel?.designer?.close(false);guidePanel?.minimize();if(villageUI.state.open)villageUI.toggle(false);}});
    buildPanel=LWBuildPanel.create(panelContext);
    guidePanel=LWGuidePanel.create({...panelContext,show:showGuideTarget});
    scenarioUI=LWScenarioUI.create({...panelContext,head:modalHead,footer:modalFooter,modal:()=>ui.modal,redraw:()=>renderModal(true),close:closeModal,backup:backupStory,setEngine,exportStory:exportSave,camera:()=>({...world.camera}),presentScene});
    applySceneRendering();
    const scenarioButton=document.createElement('button');scenarioButton.dataset.act='scenarios';scenarioButton.textContent='Worlds & scenarios';$('world-more').prepend(scenarioButton);
    function presentScene(target,camera){
        if(camera){Object.assign(world.camera,camera);world.manual=true;world.invalidate();}
        if(target?.type==='island')world.focus(target.ix*23+9,target.iy*23+9);
        if(target?.type==='interior'&&buildingInterior.open(target.buildingId))document.querySelector('[data-interior="floor"][data-floor="'+target.floorId+'"]')?.click();
    }
    function applySceneRendering(){
        if(!world.selectSceneRendering)return;
        const source=engine,context=source.scenarioContext,scene=context?.journey?.pack.scenes.find(scene=>scene.id===context.sceneId);
        const rendering=scene?.graph?.rendering||{dimension:'3d',rendererId:'basic'};
        world.selectSceneRendering(rendering).then(result=>{if(source===engine&&!result.ok)toast(result.reason||'The selected renderer could not open.',true);}).catch(error=>{if(source===engine)toast(error.message,true);});
    }
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
        const location=engine.s.estate?.islands?.[0]?.name||engine.scenarioContext?.world?.name||'Mossmeadow';
        document.querySelector('.location-title').textContent=location;
        document.querySelector('.center').setAttribute('aria-label',location+' and interaction controls');
        $('world').setAttribute('aria-label',location+'. Select a creature to interact. Drag or use arrow keys to pan. Plus and minus zoom. B opens building plans. Creatures move independently.');
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
        if(event.key==='Escape'&&buildPanel.designer?.isOpen()){
            event.preventDefault();event.stopImmediatePropagation();buildPanel.designer.close();updateUI(true);return;
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
    function setEngine(newEngine,options={}) { terraform?.reset(); buildingInterior?.reset(); buildPanel?.reset();guidePanel?.reset();scenarioUI?.reset({preserveCameras:options.sceneTransition===true});placementActor=null;placementApproach=null;LWScenarios.activate(newEngine);tileMenu?.close(false); if(newEngine===engine){ui.dockSignature='';updateUI(true);return;} storage.allowReplacement();loadWarning='';cancelPendingReads();clock.reset();last=performance.now();worldUI.reset(); worldExplorer.reset(); engine = newEngine; applyPresentation(); world.setEngine(engine); world.resetPresentation?.(); world.placement = null; world.selected = null; world.hover = null; world.bubble = null; world.particles = []; world.home(); ui.inspectUntil = 0; $('tile-tip').classList.remove('show'); $('toasts').innerHTML = ''; ui.tab = 'care'; updateUI(true); renderDock();if(!options.sceneTransition)presentScene(LWSceneNavigation.target(engine));applySceneRendering(); }
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
    function storyMarkup(...args){return interfaceStatus.storyMarkup(...args);}
    function allowanceMarkup(...args){return interfaceStatus.allowanceMarkup(...args);}
    function wishMarkup(...args){return interfaceStatus.wishMarkup(...args);}
    function forecastMarkup(...args){return interfaceStatus.forecastMarkup(...args);}
    function taskETA(...args){return interfaceStatus.taskETA(...args);}
    function extraModalMarkup(...args){return interfaceStoryPanels.extraModalMarkup(...args);}
    function costString(...args){return interfaceStatus.costString(...args);}
    function renderDock(...args){return interfaceStatus.renderDock(...args);}

    function refreshContentLabels(...args){return interfaceStatus.refreshContentLabels(...args);}
    interfaceStatus.initializeNeeds();
    function updateUI(...args){const result=interfaceStatus.updateUI(...args);buildingInterior?.update();return result;}
    function journalEntry(...args){return interfaceStatus.journalEntry(...args);}
    function processEvents(...args){return interfaceStatus.processEvents(...args);}
    function selectTab(tab) { ui.tab = tab; world.placement = null; refreshPlacement(); renderDock(); updateUI(); if(tab!=='care')openModal(tab==='build'?'construction':tab==='train'?'training':'warehouse'); }
    function selectBlueprint(kind,origin=null,actorId=null,approach=null) { if(!engine.unlocked('buildings',kind)){toast(engine.gateIssue('buildings',kind),true);openModal('v10-research');return;} if(engine.interactionIssue()){toast(engine.interactionIssue(),true);return;} const b = BUILDINGS[kind]; if (!b)
        return; if(ui.modal)closeModal(); placementActor=actorId||engine.selected?.id;placementApproach=approach;buildPanel?.close(false);buildPanel?.designer?.close(false);guidePanel?.minimize();worldUI.clear({restore:false}); worldExplorer.clear(); ui.tab = 'build'; world.placement = kind; world.selected = null; world.hover = engine.s.nodes.find(n=>LWWorldContent.building(kind)?.requiresNode===n.kind&&!engine.placementIssue(kind,n.x,n.y))||{ x: 8, y: 8 }; if(origin&&Number.isInteger(origin.x)&&Number.isInteger(origin.y)){world.hover={x:origin.x,y:origin.y};world.keyboardTile={...world.hover};world.focus(origin.x,origin.y);} $('world').focus({ preventScroll: true }); renderDock(); refreshPlacement(); $('tile-tip').classList.remove('show'); toast(LWWorldContent.building(kind)?.requiresNode?'Choose a highlighted '+LWWorldContent.node(LWWorldContent.building(kind).requiresNode).name.toLowerCase()+' tile.':'Choose clear, reachable ground for the '+b.name.toLowerCase()+'.'); if (window.innerWidth < 721)
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
    function inspect(tile) { if(terraform?.inspect(tile))return; if(tile.actorId){buildPanel?.close(false);buildPanel?.designer?.close(false);guidePanel?.minimize();}tileMenu?.close(false); if(tile.actorId){worldExplorer.clear();if(worldUI.inspect(tile))return;}else{worldUI.clear({restore:false});if(worldExplorer.inspect(tile))return;} if(tile.actorId){engine.selectCreature(tile.actorId);updateUI(true);save();} const s = engine.s, c = s.creature; let title, desc; if (tile.objectType === 'pip' || (!tile.objectType && engine.selected && !engine.selected.activeQuest && Math.hypot(c.x - tile.x, c.y - tile.y) < 1.1)) {
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


    function workspaceNav(...args){return interfaceModal.workspaceNav(...args);}
    function modalHead(...args){return interfaceModal.modalHead(...args);}
    function modalFooter(...args){return interfaceModal.modalFooter(...args);}
    function rememberPanelScroll(...args){return interfaceModal.rememberPanelScroll(...args);}
    function restorePanelScroll(...args){return interfaceModal.restorePanelScroll(...args);}
    function openModal(...args){return interfaceModal.openModal(...args);}
    function cancelPendingReads(){scenarioUI?.cancelRead();storyReadId++;contentUI.view.readId++;colonyUI.cancelRead();worldExplorer.cancelRead();villageUI.cancelRead();}
    function closeModal(...args){return interfaceModal.closeModal(...args);}
    function renderModal(...args){return interfaceModalContent.renderModal(...args);}
    function drawWelcome(...args){return interfaceModalContent.drawWelcome(...args);}

    LWInterfaceActions.install(interfaceContext);
    LWInterfaceInput.install(interfaceContext);











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
            scenarioUI?.storytelling.draw(dt);
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
                buildingInterior?.paint();
                tileMenu.position();
            }
            scenarioUI?.creatureEditor.draw();
            scenarioUI?.editor.storytelling?.draw(dt);
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
    if(engine.s.started)presentScene(LWSceneNavigation.target(engine));
    // A small, explicit read/test surface for this prototype. The UI never uses direct movement commands.
    window.Littlewild = { version: '15.0.0', scenarios:LWScenarios, terraform, interiors:buildingInterior, scenarioUI, buildPanel, guidePanel, preferences, pauseStatus, tileMenu, village:villageUI, planner:LWPlanner, land: worldExplorer, get engine() { return engine; }, get world() { return world; }, get ui() { return { tab: ui.tab, modal: ui.modal, context:worldUI.state }; }, setEngine, snapshot: () => LWStory.encode(engine), content: {export:(category,id)=>LWContent.registry.export(category,id),validate:input=>LWContent.registry.prepare(input),schema:()=>LWContent.copy(LWContent.SCHEMA),get fingerprint(){return LWContent.registry.hash;}}, advance: seconds => { engine.advance(clamp(seconds, 0, 3600)); updateUI(true); processEvents(); }, refresh: () => updateUI(true), open: (panel, id) => openModal(panel, id), save, diagnostics: () => ({ offline: true, simulationStep: clock.step, nodes: engine.s.nodes.length, buildings: engine.s.buildings.length, orders: engine.s.orders.length, localSaving: saveAvailable }) };
})();
