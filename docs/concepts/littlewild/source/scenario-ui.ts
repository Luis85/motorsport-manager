/* Administrative pack exchange is separate from ordinary world-facing panels.
 * Import inspection never changes the live engine; launch always requires review. */
(function(root){
  'use strict';
  root.LWScenarioUI={create(ctx){
    const X=root.LWScenarios,e=ctx.esc;
    const state={returnTo:'scenarios',transition:null,cameras:new Map(),packs:X.builtins(),selected:0,preview:null,errors:[],readId:0};
    const input=document.createElement('input');input.id='scenario-import-file';input.type='file';input.accept='.json,application/json';input.hidden=true;document.body.appendChild(input);
    const editor=root.LWSceneEditorUI.create({...ctx,review(pack,id){state.preview=X.prepareScene(pack,id);state.returnTo='scene-editor';ctx.open('scenario-preview');}});
    const creatureEditor=root.LWCreatureEditorUI.create({...ctx,capture(){const pack=X.capture(ctx.engine()),sceneId=ctx.engine().scenarioContext?.sceneId||pack.scenes[0].id,instanceId=ctx.engine().s.colony?.selectedId;return {pack,sceneId,...(instanceId?{instanceId}:{})};},review(pack,id){state.preview=X.prepareScene(pack,id);state.returnTo='creature-editor';ctx.open('scenario-preview');document.querySelector('[data-scenario="cancel"]')?.focus({preventScroll:true});}});
    const balancingEditor=root.LWBalancingUI.create({...ctx,capture(){const pack=X.capture(ctx.engine());return {pack,sceneId:ctx.engine().scenarioContext?.sceneId||pack.scenes[0].id};},review(pack,id){state.preview=X.prepareScene(pack,id);state.returnTo='balancing-editor';ctx.open('scenario-preview');document.querySelector('[data-scenario="cancel"]')?.focus({preventScroll:true});}});
    const storytelling=root.LWStorytellingPlayer.create({...ctx,presentation:playback=>root.LWRendererHost.player().setPlayback(playback),admitScene:(pack,id)=>root.LWSceneRendererAdmission.assertAvailable(pack,id),pause:paused=>{ctx.engine().s.paused=paused;ctx.save();ctx.redraw();}});
    const btn=(label,action,id='',cls='')=>`<button type="button" class="btn ${cls}" data-scenario="${action}" data-id="${e(id)}">${label}</button>`;
    function render(type){
      const storytellingMarkup=storytelling.render(type);if(storytellingMarkup!==null)return storytellingMarkup;
      const balancingMarkup=balancingEditor.render(type);if(balancingMarkup!==null)return balancingMarkup;
      const creatureMarkup=creatureEditor.render(type);if(creatureMarkup!==null)return creatureMarkup;
      const editorMarkup=editor.render(type);if(editorMarkup!==null)return editorMarkup;
      if(type==='scene-transition'){const p=state.transition;if(!p)return ctx.head('Review a connected scene first.')+ctx.footer();return ctx.head('Enter '+e(p.sceneName)+'?','Current work is checkpointed. Returning restores its saved state.','REVIEW CONNECTION')+`<div class="modal-body"><p>${e(p.target?.type==='interior'?'Visits the existing building floor without moving companions.':p.target?.type==='island'?'Focuses existing owned land without moving companions.':'Starts or restores the connected level.')}</p>${p.messages.map(text=>`<p>${e(text)}</p>`).join('')}${btn('Export current story','backup')}</div><footer class="modal-footer">${btn('Cancel','cancel-transition')}${btn('Enter scene','enter','','primary')}</footer>`;}
      if(type==='scenario-preview'){
        const p=state.preview;if(!p)return ctx.head('No scenario selected.')+ctx.footer();
        const s=p.pack.scenes.find(s=>s.id===p.sceneId),c=p.engine.creatures;
        return ctx.head('Start '+e(s.name)+'?','This replaces the active story. Definitions, terrain and scene setup come from the selected pack.','REVIEW SCENARIO')+
        `<div class="modal-body scenario-review"><div class="notice-box">Keep an unchanged JSON export before switching worlds. A local recovery copy is attempted, but may be unavailable in this browser.</div>
        <dl class="scenario-facts"><div><dt>Experience</dt><dd>${e(p.pack.name)}</dd></div><div><dt>World</dt><dd>${e(p.context.world.name)}</dd></div><div><dt>Simulation</dt><dd>${e(p.context.simulation.name)}</dd></div><div><dt>Archetype</dt><dd>${e(p.context.simulation.archetype.id)}</dd></div><div><dt>Companions</dt><dd>${e(c.map(c=>c.name).join(', '))}</dd></div><div><dt>Starting coins</dt><dd>${p.engine.s.player.coins}</dd></div><div><dt>Built places</dt><dd>${p.engine.s.buildings.length}</dd></div><div><dt>Islands</dt><dd>${p.engine.s.estate.islands.length}</dd></div></dl><p>${e(s.description)}</p>${(p.messages||[]).map(text=>`<p class="notice-box">${e(text)}</p>`).join('')}
        <p class="panel-hint">Validated rule values tune the compiled actor and economy systems. The selected archetype must exactly match the known engine, pipeline and transaction schedules; no scripts or handlers are loaded from the pack.</p>
        ${btn('Export current story','backup','','small')}</div><footer class="modal-footer">${btn('Cancel','cancel')}${btn('Start this scene','launch','','primary')}</footer>`;
      }
      if(type!=='scenarios')return null;
      const p=state.packs[state.selected];
      return ctx.head('Worlds & scenarios','Littlewild is one showcase. Choose or import a data-authored setting for the same simulation.','EXPERIENCE LIBRARY')+
      `<div class="modal-body scenario-library"><div class="scenario-tools">${btn('Open World & Scene Editor','editor','','primary')}${btn('Open 3D Creature Editor','creature-editor')}${btn('Open balancing workshop','balancing-editor')}${btn('Import pack JSON','import')}${btn('Export this pack','export')}${btn('Capture current scene','capture')}${btn('Schema','schema','','small')}</div>
      ${state.errors.length?`<div class="validation-issue" role="alert"><strong>The pack was not applied.</strong>${state.errors.slice(0,8).map(x=>`<p>${e(x)}</p>`).join('')}</div>`:''}
      ${storytelling.controls()}${connections()}<div class="scenario-layout"><nav class="scenario-packs" aria-label="Experience packs">${state.packs.map((p,i)=>`<button data-scenario="select" data-id="${i}" aria-pressed="${i===state.selected}"><strong>${e(p.name)}</strong><small>${p.scenes.length} starting scenes</small></button>`).join('')}</nav>
      <section><h3>${e(p.name)}</h3><p>${e(p.description)}</p><p class="panel-hint">Simulation: ${e(p.simulation.name)} · ${e(p.simulation.archetype.id)}</p>${p.scenes.map(s=>`<article class="scenario-card"><h4>${e(s.name)}</h4><p>${e(s.description)}</p>${btn('Review & start','review',s.id,'primary')}</article>`).join('')}</section></div>
      <details class="scenario-boundaries"><summary>What can be configured?</summary><p>Four content libraries; a validated actor/economy rule profile; starting creatures, inventories, buildings, work and progression; island terrain and resource generation; palettes and branding; tutorial steps; embedded furniture and creature catalogs; named roles and physical customer-order workflows. Capturing a scene produces an editable template, not a new executable game engine.</p><p>Supported topology remains 19 × 19 tiles per island with four bridge edges. Core item/skill/building role IDs, behavioral handlers, system schedules and creature rigs are compiled capabilities. Unknown fields, unsupported topology and new executable scripts are rejected.</p></details></div>`+ctx.footer();
    }
    function connections(){const engine=ctx.engine(),journey=engine.scenarioContext?.journey;if(!journey)return '';const scene=journey.pack.scenes.find(s=>s.id===engine.scenarioContext.sceneId);return `<section class="scenario-connections"><h3>Connected scenes from ${e(scene.name)}</h3>${(scene.graph?.connections||[]).map(link=>{const issue=root.LWSceneNavigation.connectionIssue(engine,link.id);return `<article><h4>${e(link.label)}</h4>${issue?`<p>${e(issue)}</p>`:''}<button type="button" class="btn" data-scenario="transition" data-id="${e(link.id)}" ${issue?'disabled':''}>Review connection</button></article>`;}).join('')}</section>`;}
    input.addEventListener('change',async ev=>{
      const f=ev.target.files?.[0];if(!f)return;const token=++state.readId;
      try {
        if(f.size>8*1024*1024)throw Error('Scenario packs must be smaller than 8 MiB.');
        const text=await f.text();if(token!==state.readId||ctx.modal()!=='scenarios')return;
        const checked=X.validate(text);state.errors=checked.errors;
        if(checked.ok){const at=state.packs.findIndex(p=>p.id===checked.pack.id);if(at<0){state.selected=state.packs.length;state.packs.push(checked.pack);}else{state.packs[at]=checked.pack;state.selected=at;}ctx.toast('Pack validated. Review a scene before starting it.');}
        ctx.redraw();
      }catch(error){if(token===state.readId&&ctx.modal()==='scenarios'){state.errors=[error.message];ctx.redraw();}}
      finally{input.value='';}
    });
    document.addEventListener('click',ev=>{
      const b=ev.target.closest('[data-scenario]');if(!b||b.disabled)return;
      const action=b.dataset.scenario,p=state.packs[state.selected];ev.preventDefault();
      try {
        if(action==='editor')editor.open(p);
        if(action==='creature-editor')creatureEditor.open();
        if(action==='balancing-editor')balancingEditor.open();
        if(action==='transition'){state.transition=root.LWSceneNavigation.prepare(ctx.engine(),b.dataset.id);ctx.open('scene-transition');}
        if(action==='cancel-transition'){state.transition=null;ctx.open('scenarios');}
        if(action==='enter'){const current=ctx.engine(),preview=state.transition;if(!preview)throw Error('Review a connection first.');root.LWSceneRendererAdmission.assertAvailable(preview.scene.pack,preview.sceneId);const source=current.scenarioContext.packId+'/'+current.scenarioContext.sceneId,camera=ctx.camera?.();ctx.backup();const next=root.LWSceneNavigation.commit(current,preview);if(camera)state.cameras.set(source,camera);ctx.setEngine(next,{sceneTransition:true});ctx.close();ctx.presentScene?.(root.LWSceneNavigation.target(next),state.cameras.get(next.scenarioContext.packId+'/'+next.scenarioContext.sceneId));ctx.save();storytelling.entered(preview.scene.pack.scenes.find(scene=>scene.id===preview.sourceSceneId)?.graph?.connections?.find(link=>link.id===preview.connectionId)?.events?.filter(event=>event.type==='play-cutscene'||event.type==='scene-switch')??[]);ctx.toast('Entered '+next.scenarioContext.sceneName+'.');for(const message of preview.messages)ctx.toast(message);}
        if(action==='select'){state.selected=Number(b.dataset.id);state.errors=[];ctx.redraw();}
        if(action==='import')input.click();
        if(action==='export')LWFiles.downloadJSON(p,p.id+'.pack.json');
        if(action==='schema')LWFiles.downloadJSON(X.schema,'scenario.schema.json');
        if(action==='capture')LWFiles.downloadJSON(X.capture(ctx.engine()),'captured-scene.pack.json');
        if(action==='backup')ctx.exportStory();
        if(action==='review'){state.returnTo='scenarios';state.preview=X.prepareScene(p,b.dataset.id);ctx.open('scenario-preview');}
        if(action==='cancel'){state.preview=null;ctx.open(state.returnTo);if(state.returnTo==='balancing-editor')document.querySelector('[data-balancing="review"]')?.focus({preventScroll:true});if(state.returnTo==='creature-editor')document.querySelector('[data-creature-editor="review"]')?.focus({preventScroll:true});}
        if(action==='launch'){
          const checked=state.preview;if(!checked)throw Error('Review a scene first.');root.LWSceneRendererAdmission.assertAvailable(checked.pack,checked.sceneId);
          ctx.backup();const next=X.commitScene(checked);state.preview=null;
          ctx.setEngine(next);ctx.close();ctx.save();ctx.toast('Started '+next.scenarioContext.sceneName+'.');for(const message of checked.messages||[])ctx.toast(message);
        }
      }catch(error){ctx.toast(error.message,true);}
    });
    return {state,editor,creatureEditor,storytelling,render,cancelRead(){state.readId++;editor.cancelRead();creatureEditor.cancelRead();balancingEditor.cancelRead();},reset(options={}){if(!options.preserveCameras)storytelling.reset();creatureEditor.reset();balancingEditor.reset();if(!options.preserveCameras)state.cameras.clear();state.transition=null;state.preview=null;state.errors=[];state.readId++;}};
  }};
})(typeof globalThis!=='undefined'?globalThis:this);
