/* Explicit click intents. Listener installation remains owned by the application shell. */
(function(root){
 'use strict';
 function install(shell){
    const {$,Engine,RES,backupStory,clamp,closeModal,exportSave,openModal,refreshPlacement,renderDock,renderModal,result,save,selectBlueprint,selectTab,setEngine,start,storage,syncTimeLabels,timeAction,toast,ui,updateUI}=shell;
    function questGo(id) { if (['feed', 'water', 'bond'].includes(id)) {
        if (ui.modal)
            closeModal();
        selectTab('care');
        result(shell.engine.care(id));
    }
    else if (id.startsWith('train:'))
        openModal('training', id.slice(6));
    else if (id.startsWith('build:'))
        selectBlueprint(id.slice(6));
    else if (id === 'request:planks') {
        if (result(shell.engine.request('craft', 'planks'), 'A little plank-making idea added.'))
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
        if(a==='v13-manual-pause'){shell.engine.s.paused=!shell.engine.s.paused;updateUI(true);save();return;}
        if(a==='v13-refresh'){if(ui.modal==='v10-task'||ui.modal?.includes('preview')||ui.modal?.includes('import')||['rename','world-visuals','settings'].includes(ui.modal)){toast('This form keeps your current draft. Live values are rechecked when you confirm.');syncTimeLabels();return;}renderModal(true);syncTimeLabels();return;}
        if(a==='v12-visuals'){openModal('world-visuals');return;}
        if(a==='v12-quality'){shell.world.setQuality(id);renderModal(true);return;}
        if(a==='v12-motion'){shell.engine.s.settings.reducedMotion=!shell.engine.s.settings.reducedMotion;shell.world.invalidate();save();renderModal(true);return;}
        if(a==='scenarios'){openModal('scenarios');return;}
        if(a==='blueprint'){openModal('blueprint-detail',id);return;}
        if(a==='begin'||a==='land-demo'){const pack=LWScenarios.builtins()[0];const ready=LWScenarios.prepareScene(pack,pack.scenes[a==='begin'?0:Math.min(1,pack.scenes.length-1)].id);backupStory();setEngine(LWScenarios.commitScene(ready));closeModal();save();if(a==='begin')openModal('v10-guide');return;}
        if(a==='cx-select'){shell.buildPanel?.close(false);shell.guidePanel?.minimize();}
        if(shell.villageUI.action(a,id,b))return;
        if(shell.worldExplorer.action(a,id,b))return;
        if(shell.worldUI.action(a,id,b,e))return;
        if(shell.colonyUI.action(a,id,b))return;
        const gated=['care','request','blueprint','rename','allowance','stock-preset','set-focus','confirm-rename','v3-path','v3-approach','v3-study-pause'];
        if(shell.engine.interactionIssue()&&gated.includes(a)){toast(shell.engine.interactionIssue(),true);return;}
        if(shell.contentUI.action(a,id,b))return;
        if(a==='workspace-go'){ui.history=[];openModal(id,null,true);return;}
        if(a==='panel-back'){const previous=ui.history.pop();if(previous)openModal(previous.type,previous.id,true);return;}
        if(shell.progressionUI.action(a,id,b)) return;
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
            shell.engine.s.stockTargets = id === 'builder' ? { ...Object.fromEntries(Object.keys(RES).map(r=>[r,0])), wood: 8, stone: 6, fiber: 4, berries: 6, water: 6, planks: 4 } : { ...Object.fromEntries(Object.keys(RES).map(r=>[r,0])), berries:4, water:3 };
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
            const w = shell.engine.s.wish;
            if (w.action === 'feed' || w.action === 'bond') {
                selectTab('care');
                result(shell.engine.care(w.action));
            }
            else if (w.action === 'explore')
                result(shell.engine.request('explore'), 'A little exploration idea shared.');
            else
                openModal('suggest');
        }
        else if (a === 'confirm-cancel') {
            shell.engine.cancel(id);
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
                if (!shell.engine.s.started)
                    openModal('welcome');
                save();
                toast('Your story is home. Welcome back, ' + shell.engine.s.name + '.');
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
        else if (a === 'demo-workshop') {backupStory();setEngine(LW.createWorkshopDemo());closeModal();save();shell.world.say('I have an idea. And so much left to learn.','book');updateUI(true);}
        else if (a === 'close-modal')
            closeModal();
        else if (a === 'pause') {
            shell.engine.s.paused = !shell.engine.s.paused;
            updateUI();
            save();
        }
        else if (a === 'speed') {
            shell.engine.s.speed = Number(id);
            shell.engine.s.paused = false;
            updateUI();
        }
        else if (a === 'tab')
            selectTab(id);
        else if (a === 'care')
            result(shell.engine.care(id));
        else if (a === 'claim') {
            result(shell.engine.claimQuest(), 'A shared milestone. A new chapter awaits.');
            if (ui.modal === 'story')
                renderModal(true);
        }
        else if (a === 'quest-go')
            questGo(id);
        else if (a === 'blueprint')
            selectBlueprint(id);
        else if (a === 'cancel-placement') {
            shell.world.placement = null;
            refreshPlacement();
            renderDock();
        }
        else if (a === 'training')
            openModal('training', id || null);
        else if (a === 'research') {
            result(shell.engine.research(id));
            renderModal(true);
        }
        else if (a === 'teach') {
            if (result(shell.engine.teach(id), 'Lesson purchased. Pip will make time for it.'))
                closeModal();
        }
        else if (a === 'buddy-status')
            document.querySelector('.buddy-card').scrollIntoView({ behavior: shell.engine.s.settings.reducedMotion ? 'instant' : 'smooth', block: 'start' });
        else if (a === 'suggest')
            openModal('suggest');
        else if (a === 'request') {
            if (result(shell.engine.request(id, b.dataset.resource || null, ui.modal === 'suggest' && ['gather', 'craft'].includes(id) ? ui.requestQty : null), 'An idea shared. Pip will choose the next step.'))
                closeModal();
        }
        else if (a === 'market')
            openModal('market');
        else if (a === 'trade') {
            result(shell.engine.trade(id, b.dataset.mode, ui.tradeQty));
            renderModal(true);
        }
        else if (a === 'order')
            openModal('order', id);
        else if (a === 'prioritize') {
            shell.engine.prioritize(id);
            toast('Idea prioritized. Pip’s needs still come first.');
            renderModal(true);
            updateUI(true);
            save();
        }
        else if (a === 'hold') {
            shell.engine.pauseOrder(id);
            renderModal(true);
            updateUI(true);
            save();
        }
        else if (a === 'cancel-order') {
            ui.confirmOrder = id;
            openModal('confirm-cancel');
        }
        else if (a === 'allowance') {
            result(shell.engine.topUp());
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
            shell.world.zoom(1.15);
        else if (a === 'zoom-out')
            shell.world.zoom(1 / 1.15);
        else if (a === 'home-view') {
            shell.world.home();
            shell.engine.s.settings.follow = false;
            updateUI();
        }
        else if (a === 'path') {
            shell.world.showPath = !shell.world.showPath;
            $('path-button').classList.toggle('active', shell.world.showPath);
        }
        else if (a === 'follow') {
            shell.engine.s.settings.follow = !shell.engine.s.settings.follow;
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

 }
 const api={install};root.LWInterfaceActions=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
