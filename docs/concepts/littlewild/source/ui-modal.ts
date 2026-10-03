/* Modal lifecycle, workspace navigation and focus restoration. The shell supplies story replacement boundaries. */
(function(root){
 'use strict';
 function create(shell){
    const {$,SKILLS,cancelPendingReads,esc,icon,refreshPlacement,renderModal,toast,ui,updateUI}=shell;
    const PANEL_LABELS={'land-atlas':'World','world-library':'World JSON','world-import':'World import',community:'Creatures',adventures:'Quests',outfit:'Outfit',satchel:'Satchel',feelings:'Personality',character:'Character',behavior:'Decisions',warehouse:'Warehouse','adventure-library':'Adventure JSON',training:'Learning',construction:'Building',pantry:'Pantry',plans:'Plans',content:'Library',settings:'Settings','blueprint-detail':'Blueprint',recipe:'Recipe',building:'Building',order:'Project','lesson-cancel':'Learning plan'};
    function workspaceNav() {
 if (ui.modal?.startsWith('v10-')) return ''; // Shared village workspaces carry their own navigation and explicit assignees.
 if (!shell.engine.s.started || ['welcome','reset','import-preview','content-preview','confirm-cancel','lesson-cancel','colony-confirm','adventure-review','world-visuals','settings'].includes(ui.modal)) return '';
 const group = ['blueprint-detail','building','recipe'].includes(ui.modal) ? 'construction' : ['warehouse','market'].includes(ui.modal) ? 'pantry' : ['satchel','feelings','character','behavior'].includes(ui.modal) ? 'outfit' : ui.modal;
 const links = [['community','heart','Creatures'],['training','book','Learn'],['construction','home','Build'],['plans','plan','Plans'],['adventures','compass','Quests'],['outfit','bag','Outfit'],['pantry','market','Warehouse'],['content','research','Library']];
 const shared = ['land-atlas','world-library','world-import','community','pantry','warehouse','market','content','adventure-library','settings'].includes(ui.modal);
 const context = shell.engine.creatures.length > 1 ? `<label class="v6-actor-picker" for="cx-active-creature"><span>${shared?'Inspecting':'For'}</span><select id="cx-active-creature"><option value="" ${!shell.engine.selected?'selected':''} disabled>Choose a creature</option>${shell.engine.creatures.map(c=>`<option value="${c.id}" ${shell.engine.selected?.id===c.id?'selected':''}>${esc(c.name)}${c.activeQuest?' · away':''}</option>`).join('')}</select></label>` : `<span>${shared?'Shared home':'For '+esc(shell.engine.s.name)}</span>`;
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
        shell.tileMenu?.close(false);
        const buildType=['blueprint','blueprint-detail'].includes(type)||type==='construction';
        if(shell.buildPanel&&buildType){
            if(id&&!shell.engine.unlocked('buildings',id)){toast(shell.engine.gateIssue('buildings',id),true);type='v10-research';id=null;}
            else{if(ui.modal)closeModal();shell.worldUI.clear({restore:false});shell.worldExplorer.clear();if(shell.villageUI.state.open)shell.villageUI.toggle(false);shell.guidePanel.minimize();if(innerWidth<=720)shell.guidePanel.reset();shell.buildPanel.open(id);updateUI(true);return;}
        }
        if(shell.guidePanel&&['guide','v10-guide'].includes(type)){if(ui.modal)closeModal();shell.buildPanel.close(false);shell.worldUI.clear({restore:false});shell.worldExplorer.clear();if(shell.villageUI.state.open)shell.villageUI.toggle(false);shell.guidePanel.open();updateUI(true);return;}
        shell.buildPanel?.close(false);shell.guidePanel?.minimize();
        if(type==='plans'||type==='suggest'){if(ui.modal)closeModal();shell.worldUI.clear({restore:false});shell.worldExplorer.clear();shell.villageUI.toggle(true);if(type==='suggest')openModal('v10-task');return;}
        if(type==='blueprint'&&!shell.engine.unlocked('buildings',id)){type='v10-research';id=null;}
        if(['outfit','adventures','training'].includes(type)&&!shell.engine.selected){type='community';id=null;}
        $('toasts').querySelectorAll('.toast:not(.error)').forEach(el=>el.remove());
        const prior=ui.modal;
        if(!prior)shell.worldUI.suspend();
        if(!prior){ui.lastFocus=document.activeElement;ui.history=[];}
        else {rememberPanelScroll();if(!back&&prior!==type&&!['content-preview','import-preview','welcome'].includes(prior)){ui.history.push({type:prior,id:ui.modalId});if(ui.history.length>12)ui.history.shift();}}
        ui.modal=type;ui.modalId=id;
        if(type==='training'&&id&&SKILLS[id]){Object.assign(shell.progressionUI.view,{learn:'lessons',discipline:'all',status:'all',search:'',selectedSkill:id,lessonDetailOpen:true});}
        shell.world.placement=null;refreshPlacement();renderModal();$('overlay').classList.add('show');document.body.classList.add('modal-open');$('app').inert=true;updateUI();
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
    function closeModal(){
        cancelPendingReads();
        if(!shell.engine.s.started){if(ui.modal!=='welcome'){shell.contentUI.view.preview=null;ui.pendingImport=null;ui.history=[];openModal('welcome',null,true);}return;}
        ui.focusRequest++;rememberPanelScroll();if(ui.modal==='import-preview')ui.pendingImport=null;
        shell.contentUI.view.preview=null;
        ui.modal=null;ui.modalId=null;ui.history=[];$('overlay').classList.remove('show');document.body.classList.remove('modal-open');$('app').inert=false;shell.world.lastDrawAt=0;updateUI(true);
        (ui.lastFocus?.isConnected&&ui.lastFocus.offsetParent!==null&&ui.lastFocus!==document.body?ui.lastFocus:$('world')).focus({preventScroll:true});
        shell.worldUI.resume();
    }
    return {workspaceNav,modalHead,modalFooter,rememberPanelScroll,restorePanelScroll,openModal,closeModal};
 }
 const api={create};root.LWInterfaceModal=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
