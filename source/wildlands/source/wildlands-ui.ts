/// <reference path="./wildlands-project-contracts.d.ts" />
/// <reference path="./scene-editor-ui-contracts.d.ts" />
/** Builder chrome emits authoring intent; validated scene review owns live replacement. */
declare namespace WildlandsUI {
 interface ScenarioSurface {
  state:{packs:LWContentPorts.ScenarioPack[];preview:LWContentPorts.ScenePreview|null};
  /** Null when the editors bundle is absent from this artifact. */
  editor:LWSceneEditorSurface.Editor|null;
  reviewPack(pack:LWContentPorts.ScenarioPack,sceneId:string):void;
  openTool(tool:'creatures'|'balance'):void;
  capability(tool:'editor'|'creature-editor'|'balancing-editor'|'storytelling'):Capability;
 }
 interface Capability {available:boolean;reason?:string;}
 interface Host {
  engine():LWContentPorts.ScenarioEngine;revision():number;scenarios:ScenarioSurface;
  open(panel:string):void;modal():string|null;toast(message:string,error?:boolean):void;
 }
 interface Surface {refresh():void;cancelRead():void;project():Wildlands.Project;}
 interface Api {create(host:Host):Surface;}
}
(function(inputRoot:unknown){
 'use strict';
 interface Compilation {
  manifest:{limitations?:string[]};
  files:{path:string;encoding:'utf8'|'base64';content:string}[];
 }
 const root=inputRoot as {
  WildlandsProject:Wildlands.ProjectApi;WildlandsUI?:WildlandsUI.Api;
  LWContent:LWContentPorts.ContentApi;
  LWScenarios:LWContentPorts.ScenarioApi;LWFiles:{downloadJSON(value:unknown,name:string):void};
  WildlandsGodot?:{compile(project:Wildlands.Project):Promise<Compilation>;zip(compiled:Compilation):Uint8Array;capability?():WildlandsUI.Capability};
 };
 const GODOT_UNAVAILABLE='Godot export is unavailable in this build: the Godot export bundle is not included.';
 function create(host:WildlandsUI.Host):WildlandsUI.Surface {
  const workspace=document.createElement('section');workspace.id='wildlands-workspace';workspace.setAttribute('aria-label','Wildlands prototype workspace');
  workspace.innerHTML=`<div class="wildlands-main"><div class="wildlands-project"><label for="wildlands-project-name">Project</label><input id="wildlands-project-name" type="text" maxlength="120" spellcheck="false"></div><div class="wildlands-scenarios"><label for="wildlands-scenario">Scenario</label><select id="wildlands-scenario"></select><button type="button" class="btn" data-wildlands="switch">Review scenario</button></div><div class="wildlands-files"><button type="button" class="btn" data-wildlands="load">Open project</button><button type="button" class="btn" data-wildlands="save">Save project</button></div></div><div class="wildlands-tools"><nav aria-label="Prototype authoring tools"><button type="button" data-wildlands="scenes">Scenes &amp; worlds</button><button type="button" data-wildlands="creatures">Creatures</button><button type="button" data-wildlands="balance">Balance</button><button type="button" data-wildlands="content">Content library</button><button type="button" data-wildlands="library">Scenario library</button></nav><details data-wildlands-export-panel><summary>Export Godot project</summary><div class="wildlands-export"><p>Download a runnable Godot project with the TypeScript simulation included. Requires Godot 4.4+ and Node.js 22+. The included runtime companion preserves Littlewild’s gameplay rules; native presentation covers a prototype view.</p><p>Save and export use the scene editor draft for your active scenario, or capture the active game when there is no matching draft.</p><button type="button" class="btn primary" data-wildlands="export">Download Godot ZIP</button></div></details></div><p id="wildlands-feedback" role="status" aria-live="polite">Littlewild is loaded. Build a scene, play it, then export your project.</p>`;
  document.getElementById('app')!.before(workspace);
  const name=workspace.querySelector<HTMLInputElement>('#wildlands-project-name')!,choices=workspace.querySelector<HTMLSelectElement>('#wildlands-scenario')!,feedback=workspace.querySelector<HTMLElement>('#wildlands-feedback')!;
  // Optional capabilities: absent editor/export bundles keep full, focusable launchers with explicit reasons.
  const gates=new Map<string,string>();
  for(const [action,checked] of [['scenes',host.scenarios.capability('editor')],['creatures',host.scenarios.capability('creature-editor')],['balance',host.scenarios.capability('balancing-editor')],
   ['export',root.WildlandsGodot?.capability?.()??(root.WildlandsGodot?{available:true}:{available:false,reason:GODOT_UNAVAILABLE})]] as const){
   if(checked.available)continue;
   const button=workspace.querySelector<HTMLButtonElement>(`[data-wildlands="${action}"]`)!,reason=document.createElement('p');
   const message=checked.reason??'This capability is unavailable in this build.';
   reason.id='wildlands-unavailable-'+action;reason.className='wildlands-unavailable';reason.textContent=message;gates.set(action,message);
   button.setAttribute('aria-disabled','true');button.setAttribute('aria-describedby',reason.id);
   (action==='export'?button:workspace.querySelector('.wildlands-tools nav')!).after(reason);
  }
  const file=document.createElement('input');file.id='wildlands-project-file';file.type='file';file.accept='.json,application/json';file.hidden=true;workspace.append(file);
  function captureProject(engine:LWContentPorts.ScenarioEngine,original?:Wildlands.Project):Wildlands.Project {
   const captured=root.LWScenarios.capture(engine);
   const sceneId=engine.scenarioContext?.sceneId||captured.scenes[0]!.id;
   const belongs=(pack:LWContentPorts.ScenarioPack)=>pack.id===captured.id&&captured.scenes.every(scene=>pack.scenes.some(value=>value.id===scene.id))&&captured.worlds.every(world=>pack.worlds.some(value=>value.id===world.id));
   const sameProject=original?.pack.id===captured.id;
   // A programmatic host replacement may reuse the pack ID with a new authored
   // graph. Its admitted engine closure is authoritative over the former draft.
   const graphClosure=captured.scenes.some(scene=>scene.graph);
   const pack=graphClosure?captured:sameProject&&belongs(original.pack)?original.pack:host.scenarios.state.packs.find(belongs)||captured;
   const source=root.WildlandsProject.create({pack,sceneId,...(sameProject?{id:original.id,name:original.name}:{})});
   // Project admission preserves every authored beginning and asset while the
   // current graph-less game checkpoint contains only one observed scene.
   return root.WildlandsProject.capture(source,captured,sceneId);
  }
  function authoredClosure(pack:LWContentPorts.ScenarioPack|undefined):string|null {
   if(!pack)return null;
   // Journey checkpoints advance separately from its admitted authored pack.
   // Normalize the resource envelope exactly as navigation.start does.
   return root.LWContent.stable({...pack,scenes:pack.scenes.map(scene=>{
    const initialState={...scene.initialState};delete initialState.scenarioResources;
    return {...scene,initialState};
   })});
  }
  let activeRevision=host.revision(),project=captureProject(host.engine()),ownership=authoredClosure(host.engine().scenarioContext?.journey?.pack);
  let pending:Wildlands.Project|null=null,readId=0,busy=false,choiceSignature='';
  let pendingAdmission:{context:string;state:string}|null=null;
  name.value=project.name;
  name.addEventListener('change',()=>{project={...project,name:name.value.trim()||project.name};});
  function status(message:string,error=false):void {
   feedback.textContent=message;feedback.classList.toggle('is-error',error);feedback.setAttribute('role',error?'alert':'status');
   if(error)host.toast(message,true);
  }
  function packs():LWContentPorts.ScenarioPack[]{return host.scenarios.state.packs;}
  function pendingOwns(engine:LWContentPorts.ScenarioEngine,incoming:string|null):boolean {
   if(!pending||pending.pack.id!==engine.scenarioContext?.packId||pending.sceneId!==engine.scenarioContext?.sceneId)return false;
   if(incoming!==null)return incoming===authoredClosure(pending.pack);
   if(pending.pack.scenes.some(scene=>scene.graph)||!pendingAdmission)return false;
   // Graph-less starts expose their admitted native context/state, rather than
   // a journey closure. Compare that reviewed admission before adopting identity.
   return pendingAdmission.context===root.LWContent.stable(engine.scenarioContext)&&
    pendingAdmission.state===root.LWContent.stable(engine.export().state);
  }
  function refresh():void {
   const engine=host.engine();
   if(host.revision()!==activeRevision){
    const incoming=authoredClosure(engine.scenarioContext?.journey?.pack),draft=host.scenarios.editor?.session?.snapshot();
    const retainsDraft=incoming!==null&&(incoming===ownership||incoming===authoredClosure(draft));
    if(pending&&pendingOwns(engine,incoming)){host.scenarios.editor?.reset();project=pending;}
    else project=captureProject(engine,project);
    pending=null;pendingAdmission=null;
    const at=packs().findIndex(pack=>pack.id===project.pack.id);
    if(at<0)packs().push(project.pack);
    else packs()[at]=project.pack;
    if(draft?.id===project.pack.id&&!retainsDraft)host.scenarios.editor?.reset();
    ownership=incoming;activeRevision=host.revision();
    name.value=project.name;
    choices.value=project.pack.id+'/'+project.sceneId;
    status(project.pack.name+' · '+(engine.scenarioContext?.sceneName||project.sceneId)+' is active.');
   }
   if(pending&&host.modal()!=='scenario-preview'){pending=null;pendingAdmission=null;}
   const signature=packs().map(pack=>pack.id+':'+pack.scenes.map(scene=>scene.id+':'+scene.name).join('|')).join(';');
   if(signature!==choiceSignature){
    choiceSignature=signature;const previous=choices.value;choices.replaceChildren();
    for(const pack of packs()){
     const group=document.createElement('optgroup');group.label=pack.name;
     for(const scene of pack.scenes){const option=document.createElement('option');option.value=pack.id+'/'+scene.id;option.textContent=scene.name;group.append(option);}
     choices.append(group);
    }
    choices.value=[...choices.options].some(option=>option.value===previous)?previous:project.pack.id+'/'+project.sceneId;
   }
   resize();
  }
  function current():Wildlands.Project {
   if(host.revision()!==activeRevision)refresh();
   const editor=host.scenarios.editor,draft=editor?.session?.export();
   const usesDraft=!!draft&&draft.id===host.engine().scenarioContext?.packId;
   const pack=usesDraft?draft!:captureProject(host.engine(),project).pack;
   const selected=usesDraft&&editor?.state.selection.type==='scene'?editor.state.selection.id:host.engine().scenarioContext?.sceneId;
   const sceneId=selected&&pack.scenes.some(scene=>scene.id===selected)?selected:pack.scenes[0]!.id;
   return root.WildlandsProject.create({id:project.id,name:name.value.trim()||project.name,scenarioId:pack.id,sceneId,pack});
  }
  function selected():{pack:LWContentPorts.ScenarioPack;sceneId:string} {
   for(const pack of packs())for(const scene of pack.scenes)if(choices.value===pack.id+'/'+scene.id)return {pack,sceneId:scene.id};
   throw Error('Select a valid scenario before reviewing it.');
  }
  async function exportGodot():Promise<void>{
   if(busy)return;const button=workspace.querySelector<HTMLButtonElement>('[data-wildlands="export"]')!;
   const snapshot=current();busy=true;button.disabled=true;button.textContent='Compiling Godot project…';status('Compiling '+snapshot.name+' for Godot…');
   try{
    const godot=root.WildlandsGodot;if(!godot)throw Error(GODOT_UNAVAILABLE);
    const compiled=await godot.compile(snapshot),bytes=godot.zip(compiled);
    const blob=new Blob([new Uint8Array(bytes)],{type:'application/zip'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=snapshot.id+'.godot.zip';workspace.append(link);
    try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);}
    status('Exported '+snapshot.name+' with '+compiled.files.length+' files. Unzip the archive, install Node.js 22+, and open project.godot in Godot 4.4+.');
   }catch(error){status(error instanceof Error?error.message:String(error),true);}
   finally{busy=false;button.disabled=false;button.textContent='Download Godot ZIP';}
  }
  workspace.addEventListener('click',event=>{
   if(!(event.target instanceof Element))return;const button=event.target.closest<HTMLButtonElement>('[data-wildlands]');if(!button||button.disabled)return;
   const unavailable=button.getAttribute('aria-disabled')==='true'?gates.get(button.dataset.wildlands??''):undefined;
   if(unavailable){status(unavailable,true);return;}
   try{
    const action=button.dataset.wildlands;
    if(action==='switch'){pending=null;pendingAdmission=null;const value=selected();host.scenarios.reviewPack(value.pack,value.sceneId);}
    if(action==='scenes'){const editor=host.scenarios.editor;if(!editor)throw Error(host.scenarios.capability('editor').reason);editor.open(current().pack);}
    if(action==='creatures'||action==='balance')host.scenarios.openTool(action);
    if(action==='content')host.open('content');
    if(action==='library')host.open('scenarios');
    if(action==='load')file.click();
    if(action==='save'){const saved=current();root.LWFiles.downloadJSON(saved,saved.id+'.wildlands.json');status('Saved '+saved.name+' with '+saved.pack.scenes.length+' scenes.');}
    if(action==='export')void exportGodot().catch(error=>status(error instanceof Error?error.message:String(error),true));
   }catch(error){status(error instanceof Error?error.message:String(error),true);}
  });
  file.addEventListener('change',async()=>{
   const uploaded=file.files?.[0];if(!uploaded)return;const token=++readId;
   try{
    if(uploaded.size>root.WildlandsProject.maxBytes)throw Error('Project is too large. Choose a JSON project smaller than '+Math.floor(root.WildlandsProject.maxBytes/1024/1024)+' MiB.');
    const input=await uploaded.text();if(token!==readId)return;
    const checked=root.WildlandsProject.validate(input);if(!checked.ok)throw Error('Project was not opened: '+checked.errors.slice(0,3).join(' '));
    // A legacy schemaVersion 1 project opens as its upgrade, embedding this artifact's game.
    const opened=root.WildlandsProject.upgrade(checked.project);pending=opened;host.scenarios.reviewPack(opened.pack,opened.sceneId);
    const preview=host.scenarios.state.preview;if(!preview)throw Error('The project has no reviewed scene admission.');
    pendingAdmission={context:root.LWContent.stable(preview.context),state:root.LWContent.stable(preview.engine.export().state)};refresh();
    status('Project validated. Review the scene and choose Start this scene to open it.');
   }catch(error){if(token===readId)status(error instanceof Error?error.message:String(error),true);}
   finally{file.value='';}
  });
  let workspaceHeight=0;
  function resize():void{const height=workspace.offsetHeight;if(height===workspaceHeight)return;workspaceHeight=height;document.documentElement.style.setProperty('--wildlands-workspace-height',height+'px');}
  window.addEventListener('resize',resize);
  new ResizeObserver(resize).observe(workspace);status(project.pack.name+' is loaded. Build a scene, play it, then export your project.');refresh();resize();
  return {refresh,cancelRead(){readId++;},project:current};
 }
 root.WildlandsUI={create};
})(globalThis);
