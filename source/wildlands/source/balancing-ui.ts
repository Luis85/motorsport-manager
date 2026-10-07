/// <reference path="./balancing-tools-contracts.d.ts" />
/// <reference path="./scene-editor-ui-contracts.d.ts" />
/* A protected balancing draft uses the same reviewed scenario launch as existing editors. */
(function(inputRoot:unknown){
 'use strict';
 interface Host extends LWSceneEditorSurface.Host {capture():{pack:LWContentPorts.ScenarioPack;sceneId:string};}
 interface Surface {open():void;render(type:string):string|null;cancelRead():void;reset():void;}
 const root=inputRoot as {LWContent:LWContentPorts.ContentApi;LWBalancing:LWBalancing.Api;LWFiles:{downloadJSON(value:unknown,name:string):void};LWBalancingUI?:{create(ctx:Host):Surface};};
 const B=root.LWBalancing,C=root.LWContent;
 function create(ctx:Host):Surface{
  let base:LWContentPorts.ScenarioPack|null=null,draft:LWBalancing.Document|null=null,sceneId='',group='task',section='gameplay',review:LWBalancing.Review|null=null,probe:LWBalancing.Probe|null=null,notice='',error='',readId=0;
  const file=document.createElement('input');file.id='balancing-import-file';file.type='file';file.accept='.json,application/json';file.hidden=true;document.body.append(file);
  const title=(key:string):string=>key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,v=>v.toUpperCase());
  const button=(label:string,action:string,disabled=false):string=>`<button type="button" class="btn" data-balancing="${action}" ${disabled?'disabled':''}>${label}</button>`;
  const invalidateRead=():void=>{readId++;file.value='';};
  const changed=():void=>{invalidateRead();review=null;probe=null;error='';notice='Saved in your draft. Review the changes before applying.';ctx.redraw();};
  function open():void{invalidateRead();if(!base||!draft){const captured=ctx.capture();base=captured.pack;sceneId=captured.sceneId;draft=B.capture(base,sceneId);}ctx.open('balancing-editor');}
  function render(type:string):string|null{
   if(type!=='balancing-editor')return null;
   if(!base||!draft)return ctx.head('Open balancing from a captured scene.')+ctx.footer();
   const e=ctx.esc,groups=Object.keys(draft.simulation.rules.gameplay??{}),rules=draft.simulation.rules.gameplay;
   if(!groups.includes(group))group=groups[0]??'';
   const numeric=rules?rules[group as keyof LWBalanceRules.Rules]:null;
   const sections=['gameplay','libraries','simulation','world','creatures','interactions','interiors','startingScenes'];
   const data=section==='gameplay'?numeric:draft[section as keyof LWBalancing.Document];
   const form=section==='gameplay'&&numeric?`<form data-balancing-form="numbers"><div class="balancing-fields">${Object.entries(numeric).map(([key,value])=>`<label>${e(title(key))}<input type="number" name="${e(key)}" value="${value}" step="any" required></label>`).join('')}</div><button class="btn primary" type="submit">Save values to draft</button></form>`:`<form data-balancing-form="json"><label for="balancing-json">${e(title(section))} JSON</label><textarea id="balancing-json" name="json" rows="18" spellcheck="false">${e(JSON.stringify(data,null,2))}</textarea><button class="btn primary" type="submit">Save section to draft</button></form>`;
   const changes=review?`<section aria-label="Balance review"><h3>${review.total} changed value${review.total===1?'':'s'}</h3>${review.blocked?`<p role="alert">${e(review.blocked)}</p>`:''}<div class="balancing-table"><table><thead><tr><th>Setting</th><th>Before</th><th>Draft</th></tr></thead><tbody>${review.changes.map(change=>`<tr><th scope="row">${e(change.path)}</th><td>${e(JSON.stringify(change.before))}</td><td>${e(JSON.stringify(change.after))}</td></tr>`).join('')}</tbody></table></div>${review.truncated?'<p>Showing the first 256 changes. Export the complete draft to inspect every value.</p>':''}</section>`:'';
   const result=probe?`<section aria-label="Balance probe results"><h3>20 second comparison · seed ${probe.seed}</h3><p>Autonomous simulation from this captured scene. Values show the end of each run.</p><div class="balancing-table"><table><thead><tr><th>Metric</th><th>Baseline</th><th>Draft</th><th>Change</th></tr></thead><tbody>${(Object.keys(probe.baseline) as (keyof LWBalancing.Metrics)[]).map(key=>`<tr><th scope="row">${e(title(key))}</th><td>${probe!.baseline[key].toFixed(2)}</td><td>${probe!.candidate[key].toFixed(2)}</td><td>${probe!.delta[key].toFixed(2)}</td></tr>`).join('')}</tbody></table></div></section>`:'';
   return ctx.head('Balancing workshop','Tune a captured world, compare the results, then review the complete scene.','')+`<div class="modal-body balancing-editor"><p class="notice-box" role="status">${e(error||notice||'This is a detached draft. The active story keeps its current rules.')}</p><div class="scenario-tools">${button('Import balancing JSON','import')}${button('Export balancing JSON','export')}${button('Export complete pack','export-pack')}${button('Review changes','review')}${button('Compare 20 seconds','probe')}</div><div class="balancing-select"><label>Section<select data-balancing-section>${sections.map(s=>`<option value="${s}" ${s===section?'selected':''}>${e(title(s))}</option>`).join('')}</select></label>${section==='gameplay'?`<label>Rule group<select data-balancing-group>${groups.map(g=>`<option value="${g}" ${g===group?'selected':''}>${e(title(g))}</option>`).join('')}</select></label>`:''}</div>${form}${changes}${result}<p class="panel-hint">Compare longer runs, typed command scripts and bounded parameter sweeps with the developer toolbox. This short comparison is a reproducible observation, not a balance guarantee.</p></div><footer class="modal-footer">${button('Close draft','close')}${button('Review complete scene','apply',!review||!!review.blocked||review.total===0)}</footer>`;
  }
  document.addEventListener('submit',event=>{
   const form=(event.target as Element).closest<HTMLFormElement>('[data-balancing-form]');if(!form||ctx.modal()!=='balancing-editor'||!draft)return;event.preventDefault();invalidateRead();
   try{const next=C.copy(draft),values=new FormData(form);
    if(form.dataset.balancingForm==='numbers'){const rules=next.simulation.rules.gameplay;if(!rules)throw Error('This profile has no optional gameplay section. Import a complete balancing document to add it.');const numeric=rules[group as keyof LWBalanceRules.Rules] as unknown as Record<string,number>;for(const key of Object.keys(numeric))numeric[key]=Number(values.get(key));}
    else {const parsed=C.parse(String(values.get('json')),12*1024*1024);(next as unknown as Record<string,unknown>)[section]=parsed;}
    const checked=B.validate(next,base);if(!checked.ok)throw Error(checked.errors.map(d=>d.message).join('\n'));draft=checked.data!;changed();
   }catch(failure){error=failure instanceof Error?failure.message:String(failure);ctx.redraw();}
  });
  document.addEventListener('input',event=>{if(ctx.modal()==='balancing-editor'&&(event.target as Element).closest('[data-balancing-form]'))invalidateRead();});
  document.addEventListener('change',event=>{const control=(event.target as Element).closest<HTMLSelectElement>('[data-balancing-section],[data-balancing-group]');if(!control||ctx.modal()!=='balancing-editor')return;invalidateRead();if(control.hasAttribute('data-balancing-section'))section=control.value;else group=control.value;ctx.redraw();});
  document.addEventListener('click',event=>{
   const control=(event.target as Element).closest<HTMLButtonElement>('[data-balancing]');if(!control||control.disabled||ctx.modal()!=='balancing-editor'||!base||!draft)return;event.preventDefault();invalidateRead();
   try{const action=control.dataset.balancing;
    if(action==='close')ctx.open('scenarios');
    if(action==='import')file.click();
    if(action==='export')root.LWFiles.downloadJSON(draft,'balancing.json');
    if(action==='export-pack'){const token=B.review(base,draft);root.LWFiles.downloadJSON(B.apply(base,token),'balanced.pack.json');}
    if(action==='review'){review=B.review(base,draft);notice=review.total?'Review each changed value below.':'The draft matches the captured scene.';error='';ctx.redraw();}
    if(action==='probe'){probe=B.probe(base,draft,{sceneId,seed:4631,steps:200});error='';ctx.redraw();}
    if(action==='apply'&&review){const next=B.apply(base,review);review=null;ctx.review(next,sceneId);}
   }catch(failure){error=failure instanceof Error?failure.message:String(failure);ctx.redraw();}
  });
  file.addEventListener('change',async()=>{
   const selected=file.files?.[0];if(!selected||!base||!draft)return;const token=++readId,capturedBase=base,capturedDraft=draft;
   const current=():boolean=>token===readId&&base===capturedBase&&draft===capturedDraft&&ctx.modal()==='balancing-editor';
   try{if(selected.size>12*1024*1024)throw Error('Choose a balancing JSON file smaller than 12 MiB.');const text=await selected.text();if(!current())return;const checked=B.validate(text,capturedBase);if(!checked.ok)throw Error(checked.errors.map(d=>d.message).join('\n'));draft=checked.data!;changed();}
   catch(failure){if(current()){error=failure instanceof Error?failure.message:String(failure);ctx.redraw();}}
   finally{if(token===readId)file.value='';}
  });
  return {open,render,cancelRead(){invalidateRead();},reset(){invalidateRead();base=null;draft=null;review=null;probe=null;error='';notice='';}};
 }
 root.LWBalancingUI={create};
})(globalThis);
