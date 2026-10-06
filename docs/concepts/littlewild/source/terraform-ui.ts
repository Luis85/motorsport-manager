/// <reference path="./terraform-contracts.d.ts" />
/* A detached draft previews local changes; only compiled commands can apply them. */
(function(inputRoot:unknown){
 'use strict';
 interface Engine extends LWTerraform.Engine {
  terraformSnapshot():LWTerraform.Snapshot;terrainAt(x:number,y:number):string;terrainHeight(x:number,y:number):number;
  dispatchCommand(input:unknown):LWTerraform.Preview|LWPhysicalPorts.ActionResult;
 }
 interface World {canvas:HTMLCanvasElement;hover:LWRuntime.Point|null;keyboardTile?:LWRuntime.Point|null;terraformMode?:boolean;terraformPreview?:LWTerraform.Edit|null;capabilities?:readonly string[];invalidate():void;focus(x:number,y:number):void;}
 interface Host {engine():Engine;world():World;esc(value:unknown):string;save():void;refresh():void;closeContexts():void;}
 const root=inputRoot as {LWTerraformUI?:{create:typeof create}};
 function create(h:Host){
  const host=document.createElement('aside');host.id='terraform-panel';host.className='world-panel terraform-panel';host.hidden=true;host.setAttribute('aria-labelledby','terraform-title');document.getElementById('app')!.append(host);
  const state={open:false,minimized:false,tool:'grass',kind:'wood',model:'world',feedback:'',tile:null as LWRuntime.Point|null,draft:{revision:0,tiles:[],plants:[]} as LWTerraform.Edit};
  let origin:HTMLElement|null=null;
  const e=h.esc,button=(label:string,id:string,classes='btn'):string=>`<button type="button" class="${classes}" data-terraform="${id}">${e(label)}</button>`;
  const count=():number=>state.draft.tiles.length+state.draft.plants.length;
  function preview():LWTerraform.Preview{
   const result=h.engine().dispatchCommand({id:'preview-terraform',args:[state.draft]});
   return result.ok&&'tiles'in result?result:{ok:false,reason:result.ok?'Choose a tile.':result.reason};
  }
  function sync():void{h.world().terraformPreview=count()?structuredClone(state.draft):null;h.world().invalidate();h.refresh();}
  function render():void{
   host.toggleAttribute('data-minimized',state.minimized);
   const snapshot=h.engine().terraformSnapshot(),choice=snapshot.choices.find(c=>c.kind===state.kind)||snapshot.choices[0];
   if(choice){state.kind=choice.kind;if(!choice.models.includes(state.model))state.model=choice.models[0]!;}
   const checked=count()?preview():null;
   host.innerHTML=`<header class="panel-header"><h2 id="terraform-title" tabindex="-1">Terraform this world</h2>${state.minimized?button('Tools & preview','tools','text-button terraform-mobile-tools'):''}${button('Back to map','back','text-button')}</header><div class="panel-body"><p>Choose a tool, then select tiles on the map. Review your changes before applying them.</p>${h.world().capabilities&&!h.world().capabilities!.includes('terrain-preview')?'<p class="panel-hint">This renderer shows changes after applying. Review the tile list below before applying, or choose a renderer that supports terrain previews.</p>':''}<label for="terraform-tool">Terrain tool<select id="terraform-tool">${[['grass','Paint grass'],['water','Paint water'],['raise','Raise one step'],['lower','Lower one step'],['plant','Plant a tree or plant']].map(([id,label])=>`<option value="${id}" ${id===state.tool?'selected':''}>${label}</option>`).join('')}</select></label>${state.tool==='plant'?`<label for="terraform-kind">Living source<select id="terraform-kind">${snapshot.choices.map(c=>`<option value="${e(c.kind)}" ${c.kind===state.kind?'selected':''}>${e(c.label)}</option>`).join('')}</select></label><label for="terraform-model">Appearance<select id="terraform-model">${(choice?.models||[]).map(model=>`<option value="${e(model)}" ${model===state.model?'selected':''}>${e(model.replace('world','Default').replaceAll('-',' '))}</option>`).join('')}</select></label>`:''}<p class="panel-hint">Water blocks walking. Companions can climb one height step. Buildings need level foundations, and bridges stay protected.</p><div class="terraform-selection">${state.tile?`Selected tile <strong>${state.tile.x}, ${state.tile.y}</strong> · ${e(h.engine().terrainAt(state.tile.x,state.tile.y))} · height ${h.engine().terrainHeight(state.tile.x,state.tile.y)}`:'Select a tile, or focus the map and use Shift + arrows and Enter.'}</div>${button('Focus map','map','btn full-width')}<h3>${count()} pending change${count()===1?'':'s'}</h3><ol class="terraform-changes">${state.draft.tiles.map(t=>`<li>Tile ${t.x}, ${t.y}: ${t.ground?e(t.ground):''}${t.height!==undefined?' · height '+t.height:''}</li>`).join('')}${state.draft.plants.map(p=>`<li>Tile ${p.x}, ${p.y}: plant ${e(snapshot.choices.find(c=>c.kind===p.kind)?.label||p.kind)}</li>`).join('')}</ol><p role="status" class="terraform-feedback">${e(state.feedback||checked?.ok&&'Paths and foundations are safe.'||checked&&!checked.ok&&checked.reason||'Your current world is unchanged until you apply.')}</p><div class="terraform-actions">${button('Clear preview','clear')}${button('Apply changes','apply','btn primary')}</div></div><footer class="panel-footer">Esc · return to map <span>F6 · map / tools</span></footer>`;
   host.querySelector<HTMLButtonElement>('[data-terraform=apply]')!.disabled=!checked?.ok;
   host.querySelector<HTMLButtonElement>('[data-terraform=clear]')!.disabled=!count();
  }
  function close(restore=true):void{
   if(!state.open)return;state.open=false;host.hidden=true;h.world().terraformMode=false;h.world().terraformPreview=null;h.world().invalidate();document.body.classList.remove('terraform-open');h.refresh();if(restore)(origin?.isConnected&&!origin.closest('[hidden]')?origin:h.world().canvas).focus({preventScroll:true});
  }
  function reset():void{close(false);state.draft={revision:h.engine().terraformSnapshot().revision,tiles:[],plants:[]};state.tile=null;state.feedback='';}
  function open():void{
   origin=document.activeElement instanceof HTMLElement?document.activeElement:null;h.closeContexts();state.open=true;h.world().terraformMode=true;state.minimized=false;state.draft={revision:h.engine().terraformSnapshot().revision,tiles:[],plants:[]};state.tile=null;state.feedback='';host.hidden=false;document.body.classList.add('terraform-open');render();host.querySelector<HTMLElement>('#terraform-title')!.focus({preventScroll:true});sync();
  }
  function inspect(tile:LWRuntime.Point):boolean{
   if(!state.open)return false;
   state.tile={x:tile.x,y:tile.y};state.feedback='';state.minimized=false;
   if(state.tool==='plant'){
    const found=state.draft.plants.find(p=>p.x===tile.x&&p.y===tile.y);if(found){found.kind=state.kind;found.model=state.model;}else state.draft.plants.push({...state.tile,kind:state.kind,model:state.model});
   }else{
    let change=state.draft.tiles.find(t=>t.x===tile.x&&t.y===tile.y);if(!change){change={...state.tile};state.draft.tiles.push(change);}
    if(state.tool==='raise'||state.tool==='lower')change.height=(change.height??h.engine().terrainHeight(tile.x,tile.y))+(state.tool==='raise'?1:-1);
    else change.ground=state.tool==='water'?'water':'grass';
   }
   render();sync();return true;
  }
  host.addEventListener('click',event=>{
   const target=event.target instanceof Element?event.target.closest<HTMLButtonElement>('[data-terraform]'):null;if(!target||target.disabled)return;
   if(target.dataset.terraform==='back')close();
   else if(target.dataset.terraform==='map'){state.minimized=innerWidth<=720;render();h.world().canvas.focus({preventScroll:true});}
   else if(target.dataset.terraform==='tools'){state.minimized=false;render();host.querySelector<HTMLElement>('#terraform-tool')!.focus();}
   else if(target.dataset.terraform==='clear'){state.draft={revision:h.engine().terraformSnapshot().revision,tiles:[],plants:[]};state.feedback='Preview cleared.';render();sync();}
   else if(target.dataset.terraform==='apply'){
    const result=h.engine().dispatchCommand({id:'apply-terraform',args:[state.draft]});
    if(result.ok){state.draft={revision:h.engine().terraformSnapshot().revision,tiles:[],plants:[]};state.feedback='Changes applied to this world.';h.save();}
    else state.feedback=result.reason;
    render();sync();
   }
  });
  host.addEventListener('change',event=>{
   const target=event.target;if(!(target instanceof HTMLSelectElement))return;
   if(target.id==='terraform-tool')state.tool=target.value;else if(target.id==='terraform-kind')state.kind=target.value;else if(target.id==='terraform-model')state.model=target.value;render();host.querySelector<HTMLElement>('#'+target.id)?.focus({preventScroll:true});
  });
  document.addEventListener('keydown',event=>{
   if(!state.open)return;
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}
   else if(event.key==='F6'){event.preventDefault();event.stopImmediatePropagation();if(host.contains(document.activeElement))h.world().canvas.focus({preventScroll:true});else host.querySelector<HTMLElement>('#terraform-tool')!.focus();}
   else if(event.key==='Enter'&&event.target===h.world().canvas){event.preventDefault();event.stopImmediatePropagation();inspect(h.world().keyboardTile||h.world().hover||{x:9,y:9});}
  },true);
  return {open,close,reset,inspect,state,host};
 }
 root.LWTerraformUI={create};if(typeof module!=='undefined'&&module.exports)module.exports=root.LWTerraformUI;
})(globalThis);
