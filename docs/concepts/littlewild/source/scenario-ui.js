/* Administrative pack exchange is separate from ordinary world-facing panels.
 * Import inspection never changes the live engine; launch always requires review. */
(function(root){
  'use strict';
  root.LWScenarioUI={create(ctx){
    const X=root.LWScenarios,e=ctx.esc;
    const state={packs:X.builtins(),selected:0,preview:null,errors:[],notes:[],readId:0};
    const input=document.createElement('input');input.id='scenario-import-file';input.type='file';input.accept='.json,application/json';input.hidden=true;document.body.appendChild(input);
    const btn=(label,action,id='',cls='')=>`<button type="button" class="btn ${cls}" data-scenario="${action}" data-id="${e(id)}">${label}</button>`;
    function render(type){
      if(type==='scenario-preview'){
        const p=state.preview;if(!p)return ctx.head('No scenario selected.')+ctx.footer();
        const s=p.pack.scenes.find(s=>s.id===p.sceneId),c=p.engine.creatures;
        return ctx.head('Start '+e(s.name)+'?','This replaces the active story. Definitions, terrain and scene setup come from the selected pack.','REVIEW SCENARIO')+
        `<div class="modal-body scenario-review"><div class="notice-box">Keep an unchanged JSON export before switching worlds. A local recovery copy is attempted, but may be unavailable in this browser.</div>
        <dl class="scenario-facts"><div><dt>Experience</dt><dd>${e(p.pack.name)}</dd></div><div><dt>World</dt><dd>${e(p.context.world.name)}</dd></div><div><dt>Simulation</dt><dd>${e(p.context.simulation.name)}</dd></div><div><dt>Archetype</dt><dd>${e(p.context.simulation.archetype.id)}</dd></div><div><dt>Companions</dt><dd>${e(c.map(c=>c.name).join(', '))}</dd></div><div><dt>Starting coins</dt><dd>${p.engine.s.player.coins}</dd></div><div><dt>Built places</dt><dd>${p.engine.s.buildings.length}</dd></div><div><dt>Islands</dt><dd>${p.engine.s.estate.islands.length}</dd></div></dl><p>${e(s.description)}</p>
        ${p.migrationNotes?.length?`<div class="notice-box">${p.migrationNotes.map(e).join(' ')}</div>`:''}<p class="panel-hint">Validated rule values tune the compiled actor and economy systems. The selected archetype must exactly match the known engine, pipeline and transaction schedules; no scripts or handlers are loaded from the pack.</p>
        ${btn('Export current story','backup','','small')}</div><footer class="modal-footer">${btn('Cancel','cancel')}${btn('Start this scene','launch','','primary')}</footer>`;
      }
      if(type!=='scenarios')return null;
      const p=state.packs[state.selected];
      return ctx.head('Worlds & scenarios','Littlewild is one showcase. Choose or import a data-authored setting for the same simulation.','EXPERIENCE LIBRARY')+
      `<div class="modal-body scenario-library"><div class="scenario-tools">${btn('Import pack JSON','import')}${btn('Export this pack','export')}${btn('Capture current scene','capture')}${btn('Schema','schema','','small')}</div>
      ${state.errors.length?`<div class="validation-issue" role="alert"><strong>The pack was not applied.</strong>${state.errors.slice(0,8).map(x=>`<p>${e(x)}</p>`).join('')}</div>`:''}${state.notes.length?`<div class="notice-box">${state.notes.map(x=>`<p>${e(x)}</p>`).join('')}</div>`:''}
      <div class="scenario-layout"><nav class="scenario-packs" aria-label="Experience packs">${state.packs.map((p,i)=>`<button data-scenario="select" data-id="${i}" aria-pressed="${i===state.selected}"><strong>${e(p.name)}</strong><small>${p.scenes.length} starting scenes</small></button>`).join('')}</nav>
      <section><h3>${e(p.name)}</h3><p>${e(p.description)}</p><p class="panel-hint">Simulation: ${e(p.simulation.name)} · ${e(p.simulation.archetype.id)}</p>${p.scenes.map(s=>`<article class="scenario-card"><h4>${e(s.name)}</h4><p>${e(s.description)}</p>${btn('Review & start','review',s.id,'primary')}</article>`).join('')}</section></div>
      <details class="scenario-boundaries"><summary>What can be configured?</summary><p>Four content libraries; a validated actor/economy rule profile; starting creatures, inventories, buildings, work and progression; island terrain and resource generation; palettes and branding; tutorial steps. Capturing a scene produces an editable template, not a new executable game engine.</p><p>Supported topology remains 19 × 19 tiles per island with four bridge edges. Core item/skill/building role IDs, behavioral handlers, system schedules and creature rigs are compiled capabilities. Unknown fields, unsupported topology and new executable scripts are rejected.</p></details></div>`+ctx.footer();
    }
    input.addEventListener('change',async ev=>{
      const f=ev.target.files?.[0];if(!f)return;const token=++state.readId;
      try {
        if(f.size>8*1024*1024)throw Error('Scenario packs must be smaller than 8 MiB.');
        const text=await f.text();if(token!==state.readId||ctx.modal()!=='scenarios')return;
        const checked=X.validate(text);state.errors=checked.errors;state.notes=checked.migrationNotes||[];
        if(checked.ok){const at=state.packs.findIndex(p=>p.id===checked.pack.id);if(at<0){state.selected=state.packs.length;state.packs.push(checked.pack);}else{state.packs[at]=checked.pack;state.selected=at;}ctx.toast('Pack validated. Review a scene before starting it.');}
        ctx.redraw();
      }catch(error){if(token===state.readId&&ctx.modal()==='scenarios'){state.errors=[error.message];state.notes=[];ctx.redraw();}}
      finally{input.value='';}
    });
    document.addEventListener('click',ev=>{
      const b=ev.target.closest('[data-scenario]');if(!b||b.disabled)return;
      const action=b.dataset.scenario,p=state.packs[state.selected];ev.preventDefault();
      try {
        if(action==='select'){state.selected=Number(b.dataset.id);state.errors=[];state.notes=[];ctx.redraw();}
        if(action==='import')input.click();
        if(action==='export')LWFiles.downloadJSON(p,p.id+'.pack.json');
        if(action==='schema')LWFiles.downloadJSON(X.schema,'scenario.schema.json');
        if(action==='capture')LWFiles.downloadJSON(X.capture(ctx.engine()),'captured-scene.pack.json');
        if(action==='backup')ctx.exportStory();
        if(action==='review'){state.preview=X.prepareScene(p,b.dataset.id);ctx.open('scenario-preview');}
        if(action==='cancel'){state.preview=null;ctx.open('scenarios');}
        if(action==='launch'){
          const checked=state.preview;if(!checked)throw Error('Review a scene first.');
          ctx.backup();const next=X.commitScene(checked);state.preview=null;
          ctx.setEngine(next);ctx.close();ctx.save();ctx.toast('Started '+next.scenarioContext.sceneName+'.');
        }
      }catch(error){ctx.toast(error.message,true);}
    });
    return {state,render,cancelRead(){state.readId++;},reset(){state.preview=null;state.errors=[];state.notes=[];state.readId++;}};
  }};
})(typeof globalThis!=='undefined'?globalThis:this);
