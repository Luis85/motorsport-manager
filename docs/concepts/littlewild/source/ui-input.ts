/* Form, keyboard, import and page-lifecycle listeners. Live context preserves story replacement and read cancellation. */
(function(root){
 'use strict';
 function install(shell){
    const {$,closeModal,openModal,refreshPlacement,renderDock,renderModal,result,save,selectTab,sound,text,timeAction,toast,ui,updateUI}=shell;
    document.addEventListener('input', e => { const el = e.target; if(shell.contentUI.input(el)||shell.progressionUI.input(el))return; if (el.hasAttribute('data-allowance')) {
        shell.engine.setAllowance(Number(el.value));
        updateUI();
        save();
    }
    else if (el.id === 'buddy-name-input') { if(shell.engine.interactionIssue()){el.value=shell.engine.s.name;return;}
        const value = el.value.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 20);
        if (value) {
            shell.engine.s.name = value;
            updateUI(true);
            save();
        }
    } });
    document.addEventListener('change', e => { const el = e.target; if(shell.contentUI.change(el)||shell.progressionUI.change(el))return; if (el.hasAttribute('data-stock-target')) {
        const r = shell.engine.setStockTarget(el.dataset.stockTarget, Number(el.value));
        if (!r.ok) {
            toast(r.reason, true);
            el.value = shell.engine.s.stockTargets[el.dataset.stockTarget];
        }
        updateUI();
        save();
    }
    else if (el.id === 'request-quantity') {
        ui.requestQty = Number(el.value);
        renderModal(true);
    }
    else if (el.id === 'sourcing-select') {
        shell.engine.s.allowance.sourcing = el.value;
        save();
    }
    else if (el.id === 'pocket-reserve') {
        const n = Number(el.value);
        if (Number.isInteger(n) && n >= 0 && n <= 30) {
            shell.engine.s.allowance.reserve = n;
            save();
        }
        else {
            el.value = shell.engine.s.allowance.reserve;
            toast('Choose a reserve from 0 to 30 coins.', true);
        }
    }
    else if (el.id === 'contrast-setting') {
        shell.engine.s.settings.highContrast = el.checked;
        updateUI();
        save();
    }
    else if (el.id === 'duels-setting' || el.id === 'quests-setting') {
        const setting = el.id === 'duels-setting' ? 'duels' : 'quests';
        const r = shell.engine.setGameSettings({[setting]:el.checked});
        if (!r.ok) {
            el.checked = shell.engine.gameSettings()[setting];
            toast(r.reason, true);
            return;
        }
        updateUI(true);
        save();
    }
    else if (el.id === 'focus-select') {
        shell.engine.s.focus = el.value;
        toast('A little encouragement toward ' + ({ balanced: 'balance', cozy: 'self-care', builder: 'building', curious: 'curiosity' }[el.value]) + '.');
        save();
    }
    else if (el.hasAttribute('data-auto-allowance')) {
        shell.engine.s.allowance.auto = el.checked;
        updateUI();
        save();
    }
    else if (el.id === 'trade-quantity') {
        ui.tradeQty = Number(el.value);
        renderModal(true);
    }
    else if (el.id === 'sound-setting') {
        shell.engine.s.settings.sound = el.checked;
        sound('heart');
        save();
    }
    else if (el.id === 'motion-setting') {
        shell.engine.s.settings.reducedMotion = el.checked;
        updateUI();
        save();
    } });
    document.addEventListener('change',event=>{if(!event.target.matches('[data-pause-on-open]'))return;shell.preferences.set(event.target.checked);document.querySelectorAll('[data-preference-status]').forEach(el=>el.textContent=shell.preferences.error||'Preference saved on this device.');shell.world.invalidate();updateUI(true);text('world-announcement',shell.preferences.pauseOnOpen?'Panels pause time; manual pauses remain unchanged.':'Panels no longer pause time; manual pauses remain unchanged.');});
    $('import-file').addEventListener('change', async (e) => { const file = e.target.files?.[0]; if (!file)
        return; const read=++shell.storyReadId;try {
        if (file.size > LWStory.SAVE_LIMIT) throw Error('Story files must be smaller than '+(LWStory.SAVE_LIMIT/1024/1024)+' MiB.');
        const source=await file.text();if(read!==shell.storyReadId)return;
        const imported = LWStory.inspect(source);
        ui.pendingImport = imported;
        openModal('import-preview');
    }
    catch (err) {
        if(read===shell.storyReadId)toast('Save not imported: ' + err.message, true);
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
            shell.world.placement = null;
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
            (e.shiftKey ? shell.last : first).focus();
        }
        else if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            shell.last.focus();
        }
        else if (!e.shiftKey && (document.activeElement === shell.last || !focusable.includes(document.activeElement))) {
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
        result(shell.engine.care(['feed', 'water', 'bond', 'praise'][Number(e.key) - 1])); });
    window.addEventListener('pagehide',()=>{save();shell.clock.reset();});
    window.addEventListener('beforeunload', () => save());
    document.addEventListener('visibilitychange', () => { if (document.hidden)
        save(); shell.last = performance.now(); shell.clock.reset(); });
    document.addEventListener('change',ev=>{if(!shell.engine.interactionIssue())return;if(ev.target.matches('#focus-select,[data-allowance],[data-auto-allowance],[data-stock-target],#sourcing-select,#pocket-reserve')){ev.stopImmediatePropagation();toast(shell.engine.interactionIssue(),true);updateUI(true);}},true);
    document.addEventListener('input',ev=>{if(!shell.engine.interactionIssue())return;if(ev.target.matches('[data-allowance],[data-stock-target],#pocket-reserve')){ev.stopImmediatePropagation();updateUI(true);}},true);

 }
 const api={install};root.LWInterfaceInput=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
