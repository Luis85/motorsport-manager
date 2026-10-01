/* A small, resumable companion. Guidance links to real controls; it performs no tasks. */
(function(root) {
  'use strict';
  root.LWGuidePanel={create(ctx){
    const host=document.createElement('aside'), e=ctx.esc;
    host.id='guide-panel';host.className='world-panel guide-panel';host.hidden=true;
    host.setAttribute('aria-labelledby','guide-panel-title');document.getElementById('app').appendChild(host);
    const state={open:false,minimized:false};let invoker=null;
    const steps=()=>ctx.engine().scenarioContext?.tutorial||root.LWScenarios.defaultTutorial();
    const progress=()=>ctx.engine().s.progression.tutorial;
    const btn=(text,act,extra='')=>`<button type="button" data-guide="${act}" ${extra}>${text}</button>`;
    function render(){
      const all=steps(),p=progress(),i=Math.min(p.step,all.length-1),s=all[i];
      host.classList.toggle('minimized',state.minimized);
      if(state.minimized){host.innerHTML=`${btn('Continue guide · '+(i+1)+' / '+all.length,'expand','class="guide-resume"')}${btn('×','close','class="icon-btn" aria-label="Close guide"')}`;return;}
      host.innerHTML=`<header class="panel-header"><div><span class="eyebrow">A GUIDE, NOT A CHECKLIST</span><h2 id="guide-panel-title" tabindex="-1">${e(s.title)}</h2></div><div>${btn('−','minimize','class="icon-btn" aria-label="Minimize guide"')}${btn('×','close','class="icon-btn" aria-label="Close guide"')}</div></header>
        <div class="panel-body"><label class="guide-step-picker">Step<select id="guide-step" aria-label="Tutorial step">${all.map((s,n)=>`<option value="${n}" ${n===i?'selected':''}>${n+1}. ${e(s.title)}</option>`).join('')}</select></label><p>${e(s.body)}</p><div class="guide-direction">${btn('Show me →','show','class="btn primary"')}<small>Use the world normally. Nothing is completed for you.</small></div></div>
        <footer class="panel-footer">${btn('← Previous','previous',`class="btn small" ${i===0?'disabled':''}`)}<span>${i+1} / ${all.length}</span>${btn(i===all.length-1?'Finish guide':'Next →',i===all.length-1?'finish':'next','class="btn small"')}</footer>`;
    }
    function open(){invoker=document.activeElement;state.open=true;state.minimized=false;host.hidden=false;progress().dismissed=false;render();host.querySelector('h2').focus({preventScroll:true});ctx.save();}
    function close(restore=true){state.open=false;host.hidden=true;progress().dismissed=true;ctx.save();if(restore)(invoker?.isConnected?invoker:ctx.world().canvas).focus({preventScroll:true});}
    function minimize(){if(!state.open)return;state.minimized=true;render();}
    host.addEventListener('change',ev=>{if(ev.target.id==='guide-step'){progress().step=Number(ev.target.value);render();host.querySelector('select').focus();ctx.save();}});
    host.addEventListener('click',ev=>{
      const b=ev.target.closest('[data-guide]');if(!b||b.disabled)return;ev.stopPropagation();const a=b.dataset.guide;
      if(a==='close')close();
      if(a==='minimize')minimize();
      if(a==='expand'){state.minimized=false;render();host.querySelector('h2').focus();}
      if(a==='previous'||a==='next'){progress().step=Math.max(0,Math.min(steps().length-1,progress().step+(a==='next'?1:-1)));render();host.querySelector('[data-guide='+a+']')?.focus();ctx.save();}
      if(a==='finish'){progress().complete=true;close();}
      if(a==='show'){const step=steps()[Math.min(progress().step,steps().length-1)];minimize();ctx.show(step.action);}
    });
    host.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();minimize();ctx.world().canvas.focus();}});
    return {state,host,open,close,minimize,reset(){state.open=false;host.hidden=true;},focus(){host.querySelector('button').focus({preventScroll:true});}};
  }};
})(typeof globalThis!=='undefined'?globalThis:this);
