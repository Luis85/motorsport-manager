/* Read-only content browser and safe import workflow. Authoring happens in an external tool.
 * All validation and simulation compatibility decisions belong to the content/story modules.
 */
(function(root){
'use strict';
root.LWContentUI={create(ctx){
 const C=LWContent,R=C.registry,{icon:ic,esc:e,head,footer,open,redraw,toast}=ctx;
 const view={category:'items',selected:'wood',search:'',detail:false,preview:null,filename:'',newStory:false,readId:0,inspector:'overview'};
 const icons={items:'bag',recipes:'bench',skills:'book',buildings:'home',drills:'paw',disciplines:'leaf',teachingStyles:'heart',buildingApproaches:'plan',talents:'star',studies:'research',paths:'route',deliveries:'market',chapters:'book'};
 const name=(category,d)=>d.name||d.title||(category==='drills'?LW.SKILLS[d.id]?.short:category==='recipes'?LW.RES[d.id]?.name:null)||d.id;
 const btn=(label,act,id='',cls='',disabled=false)=>`<button class="btn ${cls}" data-act="${act}" data-id="${e(id)}" ${disabled?'disabled':''}>${label}</button>`;
 const smallValue=v=>v===null?'None':typeof v==='object'?Array.isArray(v)?v.map(x=>typeof x==='object'?JSON.stringify(x):x).join(', '):Object.entries(v).map(([k,n])=>k+': '+(n!==null&&typeof n==='object'?JSON.stringify(n):String(n))).join(' · '):String(v);
 const doc=()=>R.current;
 function references(category,id){
  const links=[],push=(c,d)=>{if(!links.some(x=>x.category===c&&x.id===d.id))links.push({category:c,id:d.id,name:name(c,d)});};
  for(const [cat,entries]of Object.entries(doc().components))for(const d of entries){
   if(category==='items'&&(d.cost&&Object.hasOwn(d.cost,id)||cat==='recipes'&&d.output===id))push(cat,d);
   if(category==='skills'&&(d.skill===id||d.requires===id||Array.isArray(d.requires)&&d.requires.includes(id)||d.practical?.skill===id||d.skills?.includes(id)||cat==='drills'&&d.id===id))push(cat,d);
   if(category==='buildings'&&(d.station===id||d.buildings?.includes(id)))push(cat,d);
   if(category==='disciplines'&&d.discipline===id)push(cat,d);
  }
  return links;
 }
 function inspector(){
  const entry=doc().components[view.category].find(x=>x.id===view.selected);
  if(!entry)return `<div class="inspector-empty">${ic('search')}<h3>No matching definitions</h3><p>Clear the search to explore this collection.</p></div>`;
  const links=references(view.category,entry.id),fields=Object.entries(entry).filter(([k])=>!['id','extensions'].includes(k));
  return `<div class="definition-head"><button class="text-btn mobile-back" data-act="lib-list">${ic('arrow')} Back to definitions</button><span class="eyebrow">${e(C.CATEGORIES[view.category])} / READ ONLY</span><h3 id="definition-title" tabindex="-1">${e(name(view.category,entry))}</h3><code class="definition-id">${e(entry.id)}</code><p>Edit a JSON export in your authoring tool, then import it here.</p><div class="button-row">${btn(ic('download')+'Export definition','lib-export-one')}${btn(ic('plan')+'Copy JSON','lib-copy','','small')}</div></div><nav class="inspector-tabs" aria-label="Definition view"><button data-act="lib-view" data-id="overview" aria-pressed="${view.inspector==='overview'}" class="${view.inspector==='overview'?'active':''}">Overview</button><button data-act="lib-view" data-id="json" aria-pressed="${view.inspector==='json'}" class="${view.inspector==='json'?'active':''}">JSON</button></nav>${view.inspector==='json'?`<pre class="json-view" tabindex="0" aria-label="Component JSON"><code>${e(JSON.stringify(entry,null,2))}</code></pre>`:`<dl class="definition-fields">${fields.map(([key,value])=>`<div><dt>${e(key)}</dt><dd>${e(smallValue(value))}</dd></div>`).join('')}</dl>${links.length?`<section class="definition-references"><h4>Referenced by <span>${links.length}</span></h4><div>${links.map(link=>`<button class="reference-link" data-act="lib-reference" data-id="${link.id}" data-category="${link.category}">${ic(icons[link.category])}<span>${e(link.name)}<small>${e(C.CATEGORIES[link.category])}</small></span>${ic('arrow')}</button>`).join('')}</div></section>`:'<p class="inspector-note">No direct references indexed for this definition type. The exported IDs remain the integration contract.</p>'}${entry.extensions?'<p class="inspector-note">Tool-specific metadata is preserved under extensions. Inspect the JSON to see it.</p>':''}`}`;
 }
 function filtered(){const q=view.search.toLowerCase().trim();return doc().components[view.category].filter(d=>(name(view.category,d)+' '+d.id+' '+(d.desc||d.description||'')).toLowerCase().includes(q));}
 function list(){const entries=filtered();if(!entries.some(d=>d.id===view.selected))view.selected=entries[0]?.id||null;return `<div class="catalog-result" role="status">${entries.length} of ${doc().components[view.category].length} definitions <button class="text-btn" data-act="lib-export-category">${ic('download')} Export collection</button></div><div class="definition-list" data-scroll-key="content-list">${entries.map(d=>`<button class="definition-row ${view.selected===d.id?'selected':''}" data-act="lib-select" data-id="${d.id}" aria-pressed="${view.selected===d.id}"><span class="row-icon">${ic(icons[view.category])}</span><span><strong>${e(name(view.category,d))}</strong><code>${e(d.id)}</code></span>${ic('arrow')}</button>`).join('')||'<div class="list-empty">No matches. Try a different name or ID.</div>'}</div>`;}
 function renderLibrary(){
  const renderedList=list(),meta=doc().library;
  return head('Content library','Inspect game definitions. Exchange JSON with your own authoring tool.','THE MAKER’S SHELF')+`<div class="modal-body library-body"><section class="library-summary"><div><span class="library-mark">${ic('book')}</span><div><strong>${e(meta.name)}</strong><span><code>${e(meta.id)}</code> · v${e(meta.version)} · <code title="Deterministic content fingerprint; not a signature">${R.hash}</code></span></div></div><span class="definition-count">${Object.values(doc().components).reduce((n,arr)=>n+arr.length,0)} <small>definitions</small></span></section><div class="library-actions"><div>${btn(ic('download')+'Export full library','lib-export','','primary')}${btn(ic('upload')+'Import JSON','lib-import')}</div><div>${btn('JSON Schema','lib-schema','','small')}${btn('Restore built-in…','lib-default','','small')}</div></div><div class="library-layout ${view.detail?'show-detail':''}"><nav class="collection-nav" aria-label="Content collections">${Object.entries(C.CATEGORIES).map(([category,label])=>`<button data-act="lib-category" data-id="${category}" class="${view.category===category?'active':''}" aria-current="${view.category===category?'page':'false'}">${ic(icons[category])}<span>${label}</span><b>${doc().components[category].length}</b></button>`).join('')}<p>Definitions, not inventory.<br>No save progress is included in a content export.</p></nav><section class="library-browser"><label class="catalog-search">${ic('search')}<input id="library-search" type="search" placeholder="Search names or IDs…" value="${e(view.search)}" aria-label="Search component definitions"><button class="icon-btn" data-act="lib-clear" aria-label="Clear component search">${ic('close')}</button></label><div id="library-results">${renderedList}</div></section><section class="definition-inspector" id="definition-inspector" data-scroll-key="content-inspector">${inspector()}</section></div></div>`+footer(`<span class="library-footnote">Data-only · no scripts · validated before use</span>${btn('Back to the glade','close-modal','','small')}`);
 }
 function diagnostics(issues){return `<div class="validation-issues">${issues.map(d=>`<article class="validation-issue ${d.severity}"><strong>${e(d.code)}</strong><code>${e(d.path)}</code><p>${e(d.message)}</p>${d.hint?`<small>${e(d.hint)}</small>`:''}</article>`).join('')}</div>`;}
 function preview(){
  const p=view.preview;if(!p)return head('Nothing to review.','','CONTENT IMPORT')+footer();
  const policy=p.ok?LWStory.currentStoryPolicy(p,ctx.engine()):null;
  const noChanges=p.ok&&!p.diff.fields.length;
  const filename=view.filename||'Content JSON';
  let body=`<div class="import-file-label">${ic('book')}<strong>${e(filename)}</strong><span>${p.ok?'Validation passed':'Not applied'}</span></div>`;
  if(!p.ok)body+=`<section class="validation-banner error">${ic('close')}<div><h3>This file needs attention.</h3><p>Your library and story have not changed. Fix the reported fields in the authoring tool and import again.</p></div></section>${diagnostics(p.errors)}<div class="button-row">${btn('Choose another file','lib-import','','primary')}${btn('Export error report','lib-report')}</div>`;
  else{
   body+=`<section class="validation-banner success">${ic('check')}<div><h3>${noChanges?'Already in sync.':p.diff.components.length+' definition'+(p.diff.components.length===1?'':'s')+' changed.'}</h3><p>${p.kind==='patch'?'Merge selected definitions into the active library. Omitted definitions are kept.':'Replace the complete definition library. Stable runtime IDs are preserved.'}</p><span>${e(p.candidate.library.name)} · v${e(p.candidate.library.version)} · ${p.fingerprint}</span></div></section><div class="change-totals"><span><b>${p.diff.presentation}</b> text / metadata</span><span><b>${p.diff.economy}</b> item prices</span><span><b>${p.diff.mechanics}</b> gameplay values</span></div>`;
   if(p.warnings.length)body+=diagnostics(p.warnings);
   body+=`<section class="change-list"><h3>What will change</h3>${p.diff.metadata.length?`<article><h4>Library metadata</h4>${p.diff.metadata.map(field).join('')}</article>`:''}${p.diff.components.map(d=>`<article><h4>${e(d.name)} <code>${e(d.category+'/'+d.id)}</code></h4>${d.fields.map(field).join('')}</article>`).join('')||(!p.diff.metadata.length?'<p>No definition or metadata changes.</p>':'')}</section>`;
   if(!noChanges)body+=`<fieldset class="apply-target"><legend>Where should these definitions be used?</legend><label><input type="radio" name="library-target" value="current" ${view.newStory?'':'checked'}><span><strong>Keep this story</strong><small>${e(policy.reason)}</small></span></label><label><input type="radio" name="library-target" value="new" ${view.newStory?'checked':''}><span><strong>Start a new story</strong><small>Replace the current story with a fresh beginning using this library. Export your current story first to keep a portable copy.</small></span></label></fieldset><div class="notice-box">${ic('download')} A single recovery copy is kept when local storage is available. ${btn('Export current story','export','','small')}</div>`;
  }
  const enabled=p.ok&&!noChanges&&(view.newStory||policy.ok);
  return head('Review before applying.','Validation never changes the active library or your story.','CONTENT IMPORT')+`<div class="modal-body content-preview-body">${body}</div>`+footer(`<div class="preview-footer-actions">${btn(noChanges?'Back to library':'Cancel import','lib-cancel')}${noChanges?'':btn(view.newStory?'Start new story with this library':'Apply to this story','lib-apply','','primary',!enabled)}</div>`);
 }
 function field(f){const tail=f.path.split('/').slice(-2).join('/');return `<div class="change-field"><code>${e(tail)}</code><div><span class="before">${e(smallValue(f.before))}</span>${ic('arrow')}<span class="after">${e(smallValue(f.after))}</span></div></div>`;}
 function prepare(data,filename){view.preview=R.prepare(data);view.filename=filename;view.newStory=false;open('content-preview');}
 const fileInput=document.getElementById('content-import-file');
 fileInput.addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;const read=++view.readId;
  try{if(file.size>C.MAX_BYTES)throw Error('Content libraries must be smaller than 1 MiB.');const text=await file.text();if(read!==view.readId)return;prepare(text,file.name);}
  catch(error){if(read!==view.readId)return;view.preview={ok:false,errors:[C.diagnostic('FILE_READ','/',error.message)],warnings:[]};view.filename=file.name;open('content-preview');}
  finally{event.target.value='';}
 });
 function action(act,id,element){
  if(!act.startsWith('lib-')&&act!=='content')return false;
  try{
   if(act==='content')open('content');
   else if(act==='lib-category'){if(!C.CATEGORIES[id])return true;view.category=id;view.selected=doc().components[id][0].id;view.search='';view.detail=false;redraw();}
   else if(act==='lib-select'){view.listScroll=document.querySelector('#modal .modal-body')?.scrollTop||0;view.selected=id;view.detail=true;redraw();document.getElementById('definition-inspector').scrollTop=0;if(innerWidth<=720)document.querySelector('#modal .modal-body').scrollTop=0;document.getElementById('definition-title')?.focus({preventScroll:true});}
   else if(act==='lib-reference'){view.category=element.dataset.category;view.selected=id;view.search='';view.detail=true;redraw();}
   else if(act==='lib-list'){view.detail=false;redraw();document.querySelector('#modal .modal-body').scrollTop=view.listScroll||0;document.querySelector('.definition-row.selected')?.focus({preventScroll:true});}
   else if(act==='lib-view'){view.inspector=id;redraw();}
   else if(act==='lib-clear'){view.search='';redraw();document.getElementById('library-search')?.focus();}
   else if(act==='lib-import')fileInput.click();
   else if(act==='lib-export'){LWFiles.downloadJSON(R.export(),'littlewild-library.json');toast('Full definition library exported. No story progress is included.');}
   else if(act==='lib-export-category'){LWFiles.downloadJSON(R.export(view.category),'littlewild-'+view.category+'-patch.json');toast('Collection exported as a merge patch against '+R.hash+'.');}
   else if(act==='lib-export-one'){LWFiles.downloadJSON(R.export(view.category,view.selected),'littlewild-'+view.selected+'-patch.json');toast('Definition exported with its library revision.');}
   else if(act==='lib-schema')LWFiles.downloadJSON(C.SCHEMA,'littlewild-content.schema.json');
   else if(act==='lib-copy'){LWFiles.copyText(JSON.stringify(R.export(view.category,view.selected),null,2)).then(ok=>toast(ok?'Definition patch copied.':'Clipboard unavailable. Export the definition instead.',!ok));}
   else if(act==='lib-default')prepare(R.defaults,'Built-in Littlewild library');
   else if(act==='lib-report')LWFiles.downloadJSON({format:'littlewild-content-validation',file:view.filename,errors:view.preview?.errors,warnings:view.preview?.warnings},'littlewild-validation-report.json');
   else if(act==='lib-cancel'){view.readId++;view.preview=null;open('content');}
   else if(act==='lib-apply'){
    const p=view.preview;if(!p?.ok)return true;
    if(!view.newStory){const policy=LWStory.currentStoryPolicy(p,ctx.engine());if(!policy.ok)throw Error(policy.reason);}
    if(p.baseFingerprint!==R.hash)throw Error('This preview is stale. Import the file again.');
    ctx.backup();const next=LWStory.applyContent(p,ctx.engine(),view.newStory);ctx.setEngine(next);ctx.save(true);
    const fresh=view.newStory;view.preview=null;open(fresh?'welcome':'content');toast(fresh?'A fresh story is ready with your content library.':'Content library applied. Export your story to keep its exact definitions.');
   }
   else return false;
  }catch(error){toast(error.message,true);}
  return true;
 }
 function input(el){if(el.id!=='library-search')return false;view.search=el.value;view.detail=false;document.querySelector('.library-layout')?.classList.remove('show-detail');document.getElementById('library-results').innerHTML=list();document.getElementById('definition-inspector').innerHTML=inspector();return true;}
 function change(el){if(el.name!=='library-target')return false;view.newStory=el.value==='new';redraw();return true;}
 function render(type){if(!['content','content-preview'].includes(type))return null;document.getElementById('modal').classList.add(type==='content'?'content-modal':'content-preview-modal');return type==='content'?renderLibrary():preview();}
 return{render,action,input,change,prepare,view};
}};
})(window);
