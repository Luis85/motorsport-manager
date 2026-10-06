/* Contextual routes into existing commands. Opening a menu is observational;
 * every activation revalidates the source story and the tile's stable identity. */
(function(root){'use strict';
 function signature(e,t){const b=e.s.buildings.find(b=>b.x===t.x&&b.y===t.y),n=e.s.nodes.find(n=>n.x===t.x&&n.y===t.y),orders=e.allOrders().filter(o=>o.type==='build'&&o.x===t.x&&o.y===t.y);
  return JSON.stringify([root.LWGeography.available(e.s,t.x,t.y),b&&[b.id,b.kind,b.level],n&&[n.id,n.kind,n.stock===0],orders.map(o=>o.id),t.actorId||null]);
 }
 function create(h){const $=id=>document.getElementById(id),L=root.LW,G=root.LWGeography,W=root.LWWorldContent,esc=h.esc;
  const panel=document.createElement('section');panel.id='tile-context';panel.hidden=true;panel.setAttribute('aria-label','Tile actions');$('app').append(panel);
  const state={open:false,tile:null,engine:null,signature:'',anchor:null,origin:null,actions:[]};
  function close(restore=true){if(!state.open)return;state.open=false;panel.hidden=true;h.world().menuTile=null;h.world().invalidate?.();$('world').setAttribute('aria-expanded','false');if(restore)(state.origin?.isConnected&&!state.origin.closest('[hidden]')?state.origin:$('world')).focus({preventScroll:true});}
  function task(type,id,origin=null){const v=h.village(),e=h.engine();v.state.form={type,id,actorId:e.selected&&!e.selected.activeQuest?e.selected.id:e.creatures.find(c=>!c.activeQuest)?.id||'',quantity:3,recipe:'',origin};h.open('v10-task');}
  function actions(tile){const e=h.engine(),b=e.s.buildings.find(b=>b.x===tile.x&&b.y===tile.y),n=e.s.nodes.find(n=>n.x===tile.x&&n.y===tile.y),d=n&&W.node(n.kind),plans=e.allOrders().filter(o=>o.type==='build'&&o.x===tile.x&&o.y===tile.y),c=tile.actorId&&e.creatures.find(c=>c.id===tile.actorId),cell=G.cell(tile.x,tile.y),owned=e.s.estate.islands.some(i=>i.ix===cell.ix&&i.iy===cell.iy),out=[];
   const add=(id,label,detail,run,disabled='')=>out.push({id,label,detail,run,disabled});
   if(h.world().placement){add('cancel-placement','Cancel blueprint','No plan or supplies are committed.',h.cancelPlacement);return{title:'Placing '+L.BUILDINGS[h.world().placement].name,out};}
   if(c)add('creature','Interact with '+c.name,'Care, mood, satchel and plans.',()=>h.inspect({...tile,actorId:c.id,objectType:'pip'}),c.activeQuest?'This companion is away.':'');
   if(b){add('visit','Visit '+L.BUILDINGS[b.kind].name,'Enter the building and explore its floors.',()=>h.visit?.(b.id));add('inspect','Inspect '+L.BUILDINGS[b.kind].name,'Status, contents and building controls.',()=>h.show('building',b.id));
    if(b.kind==='map_table')add('map','Open world map…','Compare neighboring shores before purchasing.',()=>h.open('v10-land'),e.mapAccessIssue()||'');
    if(b.kind==='market')add('market','Market deliveries…','Goods must be physically carried here to sell.',()=>h.open('v10-market'));
    if(b.kind==='storehouse')add('warehouse','Warehouse…','Inspect stored items and physical deliveries.',()=>h.open('warehouse'));
    if(b.storage){const qty=Object.values(b.storage.output||{}).reduce((a,b)=>a+b,0);add('production','Plan production…','Choose a creature, recipe and quantity.',()=>task('workplace',b.id));add('collect','Request output collection',qty+' finished item(s). Creatures handle the trip.',()=>h.command(e.configureBuilding(b.id,'flush')),qty?'':'No finished goods to collect.');add('toggle',b.storage.enabled===false?'Resume workplace':'Pause workplace','Reserved supplies remain here.',()=>h.command(e.configureBuilding(b.id,'enabled',b.storage.enabled===false)));}
   }else if(n){add('inspect','Inspect '+d.name,'Availability, skill and site requirements.',()=>h.show('node',n.id));if(d.direct&&d.resource)add('gather','Plan '+L.colony.item(d.resource).name.toLowerCase()+' gathering…','Choose a creature; it selects a reachable source.',()=>task('gather',d.resource),!e.nodeAvailable(n)?'This source is exhausted.':!e.unlocked('items',d.resource)?'Discover this resource first.':'');}
   if(plans.length)add('plans','Review construction plan…','Assignment, priority, pause and cancellation.',()=>h.open('plans'));
   const builds=owned&&!b&&!plans.length&&Object.keys(L.BUILDINGS).filter(k=>e.unlocked('buildings',k)&&!e.placementIssue(k,tile.x,tile.y));
   if(builds?.length)add('build','Choose a blueprint…','Pick a creature and blueprint, then confirm its location.',()=>task('build',builds[0],tile));
   if(!owned)add('islands','Compare this island…','Map-table and progression requirements still apply.',()=>{h.village().state.island=G.key(cell.ix,cell.iy);h.open('v10-land');},G.frontier(e.s).some(i=>i.ix===cell.ix&&i.iy===cell.iy)?'':'Only neighboring islands are available.');
   add('focus','Center this tile','Camera only; no creature moves.',()=>h.world().focus(tile.x,tile.y));add('planner','Open planner…','Review commitments across the settlement.',()=>h.open('plans'));
   return{title:b?L.BUILDINGS[b.kind].name:d?d.name:owned?(G.available(e.s,tile.x,tile.y)?'Open ground':'Water & shore'):'Unowned shore',out};
  }
  function open(tile,p,source){if(!h.engine().s.started||h.modal())return;
   close(false);h.clearOther();state.tile={...tile};state.engine=h.engine();state.signature=signature(state.engine,tile);state.anchor=p;state.origin=$('world');state.open=true;
   const {title,out}=actions(tile);state.actions=out;h.world().menuTile={x:tile.x,y:tile.y};
   panel.innerHTML=`<header><div><small>TILE ${tile.x}, ${tile.y}</small><h2>${esc(title)}</h2></div><span aria-hidden="true">⋯</span></header><div role="menu" aria-label="Actions for ${esc(title)}">${out.map(a=>`<button type="button" role="menuitem" tabindex="-1" data-tile-action="${a.id}" aria-disabled="${!!a.disabled}"><strong>${esc(a.label)}</strong><small>${esc(a.disabled||a.detail)}</small></button>`).join('')}</div><p class="tile-menu-feedback" role="status" hidden></p><footer>Paused while choosing · <kbd>Esc</kbd> to close</footer>`;
   panel.hidden=false;$('world').setAttribute('aria-haspopup','menu');$('world').setAttribute('aria-controls','tile-context');$('world').setAttribute('aria-expanded','true');position();panel.querySelector('[role=menuitem]')?.focus({preventScroll:true});h.refresh();
  }
  function position(){if(!state.open)return;const rect=h.world().canvas.getBoundingClientRect(),s=h.world().toScreen(state.tile.x,state.tile.y),x=s.x+rect.x,y=s.y+rect.y,margin=10;
   panel.style.maxHeight=Math.max(160,innerHeight-20)+'px';panel.style.width=Math.min(318,innerWidth-20)+'px';const w=panel.offsetWidth,hh=panel.offsetHeight;
   panel.style.left=Math.max(margin,Math.min(innerWidth-w-margin,x+18+w>innerWidth?x-w-18:x+18))+'px';panel.style.top=Math.max(margin,Math.min(innerHeight-hh-margin,y-40))+'px';
  }
  function activate(id){const a=state.actions.find(a=>a.id===id);if(!a||!state.open)return;const feedback=panel.querySelector('.tile-menu-feedback');
   if(state.engine!==h.engine()||signature(h.engine(),state.tile)!==state.signature){feedback.hidden=false;feedback.textContent='This tile changed. Close and inspect it again.';return;}
   const current=actions(state.tile).out.find(x=>x.id===id);if(!current||current.disabled){feedback.hidden=false;feedback.textContent=current?.disabled||'This action is no longer available.';return;}
   close(false);current.run();h.refresh();if(!h.modal()&&!document.activeElement?.closest('#v10-planner,#land-inspector,#creature-context'))$('world').focus({preventScroll:true});
  }
  panel.addEventListener('pointerdown',e=>e.stopPropagation());panel.addEventListener('contextmenu',e=>e.preventDefault());panel.addEventListener('click',e=>{const b=e.target.closest('[data-tile-action]');if(b)activate(b.dataset.tileAction);});
  panel.addEventListener('keydown',e=>{const list=[...panel.querySelectorAll('[role=menuitem]')],at=list.indexOf(document.activeElement);let next;
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();h.refresh();return;}
   if(e.key==='Tab'){close();h.refresh();return;}
   if(e.key==='ArrowDown')next=(at+1)%list.length;else if(e.key==='ArrowUp')next=(at+list.length-1)%list.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=list.length-1;else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&e.key!==' '){const start=at+1;next=list.findIndex((_,i)=>list[(start+i)%list.length].querySelector('strong').textContent.toLowerCase().startsWith(e.key.toLowerCase()));if(next>=0)next=(start+next)%list.length;else next=undefined;}
   if(next!==undefined){e.preventDefault();e.stopPropagation();list[next]?.focus();}
  });
  document.addEventListener('pointerdown',e=>{if(state.open&&!panel.contains(e.target)){close(false);h.refresh();}},true);
  root.addEventListener('resize',position);root.addEventListener('blur',()=>close(false));document.addEventListener('visibilitychange',()=>{if(document.hidden)close(false);});
  return{open,close,position,actions,signature:()=>state.signature,get state(){return{open:state.open,tile:state.tile};},isOpen:()=>state.open};
 }
 root.LWTileContext={create,signature};
})(typeof globalThis!=='undefined'?globalThis:this);
