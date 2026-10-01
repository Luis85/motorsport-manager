/* Sparse island topology. Geometry is deterministic and independent of simulation RNG.
 * Every purchase adds one lattice cell; no grid recentering or entity relocation is needed. */
(function(root){
 'use strict';
 if(typeof module!=='undefined'&&module.exports)require('./world-profile.js');
 const SIZE=19, STRIDE=23, DIRS=[[1,0],[0,1],[-1,0],[0,-1]], key=(x,y)=>x+','+y;
 const mod=(n,d)=>((n%d)+d)%d;
 function cell(x,y){return {ix:Math.floor(x/STRIDE),iy:Math.floor(y/STRIDE),x:mod(x,STRIDE),y:mod(y,STRIDE)};}
 function islandTerrain(x,y){
  const row=root.LWWorldProfile.current.terrain[y];
  return row?.[x]==='.'?'grass':'water';
 }
 function terrain(x,y){const c=cell(x,y);return c.x<SIZE&&c.y<SIZE?islandTerrain(c.x,c.y):((c.y===9&&c.x>=SIZE)||(c.x===9&&c.y>=SIZE))?'grass':'water';}
 function ownedSet(state){return new Set((state.estate?.islands||[{ix:0,iy:0}]).map(i=>key(i.ix,i.iy)));}
 function available(state,x,y){
  if(!Number.isInteger(x)||!Number.isInteger(y))return false;
  const c=cell(x,y),own=ownedSet(state);
  if(c.x<SIZE&&c.y<SIZE)return own.has(key(c.ix,c.iy))&&islandTerrain(c.x,c.y)==='grass';
  if(c.y===9&&c.x>=SIZE)return own.has(key(c.ix,c.iy))&&own.has(key(c.ix+1,c.iy));
  if(c.x===9&&c.y>=SIZE)return own.has(key(c.ix,c.iy))&&own.has(key(c.ix,c.iy+1));
  return false;
 }
 function bridges(state){const own=ownedSet(state),out=[];for(const i of state.estate?.islands||[{ix:0,iy:0}])for(const [dx,dy] of [[1,0],[0,1]])if(own.has(key(i.ix+dx,i.iy+dy)))out.push({id:key(i.ix,i.iy)+'>'+key(i.ix+dx,i.iy+dy),ix:i.ix,iy:i.iy,dx,dy,x:i.ix*STRIDE+(dx?20.5:9),y:i.iy*STRIDE+(dy?20.5:9)});return out;}
 function frontier(state){const own=ownedSet(state),out=new Map();for(const i of state.estate?.islands||[{ix:0,iy:0}])for(const [dx,dy]of DIRS){const ix=i.ix+dx,iy=i.iy+dy,k=key(ix,iy);if(!own.has(k))out.set(k,{ix,iy,id:k,...describe(ix,iy)});}return [...out.values()].sort((a,b)=>a.iy-b.iy||a.ix-b.ix);}
 function hash(x,y){let n=Math.imul(x+513,73856093)^Math.imul(y+917,19349663);n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;}
 function describe(ix,iy){const biomes=['Meadow','Pinewood','Amber grove','Stonegarden'];const biome=ix===0&&iy===0?'Meadow':biomes[hash(ix,iy)%biomes.length];return {name:ix===0&&iy===0?root.LWWorldProfile.current.name:(root.LWWorldProfile.current.biomeNames[biome]||biome)+' '+(Math.abs(ix)+Math.abs(iy))+' · '+key(ix,iy),biome};}
 function generatedNodes(ix,iy,W){
  const out=[],used=new Set(),reserved=new Set(root.LWWorldProfile.current.placementPolicy==='reserved-sites'?root.LWWorldProfile.current.fixedSites.map(s=>key(s.x,s.y)):[]);let sequence=0,seed=hash(ix,iy);const rand=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return (seed>>>0)/4294967296;};
  function add(kind,x,y){const p=W.node(kind);if(!p||used.has(key(x,y))||islandTerrain(x,y)!=='grass')return;used.add(key(x,y));out.push({id:'island:'+key(ix,iy)+':'+sequence++,kind,x:ix*STRIDE+x,y:iy*STRIDE+y,stock:p.quantity,max:p.quantity,regen:0});}
  for(const [kind,count] of Object.keys(root.LWWorldProfile.defaults.resourceCounts).map(kind=>[kind,root.LWWorldProfile.current.resourceCounts[kind]]))for(let n=0;n<count;n++){for(let t=0;t<100;t++){const x=2+Math.floor(rand()*15),y=2+Math.floor(rand()*15);if((x>=6&&x<=11&&y>=6&&y<=11)||x===9||y===9||used.has(key(x,y))||reserved.has(key(x,y)))continue;const before=out.length;add(kind,x,y);if(out.length>before)break;}}
  for(const site of root.LWWorldProfile.current.fixedSites)add(site.kind,site.x,site.y);
  // Remove only newly generated blockers that isolate a grass pocket. This is generation,
  // never a runtime resource deletion; results are deterministic for the island coordinate.
  for(let pass=0;pass<(reserved.size?100:30);pass++){
   const state={estate:{islands:[{ix,iy}]},nodes:out,buildings:[]},g=new Grid(state),seen=g.flood({x:ix*STRIDE+9,y:iy*STRIDE+9});
   if(seen.size===g.cells.size)break;
   const disconnected=[...g.cells].filter(k=>!seen.has(k));
   const remove=out.findIndex(n=>['wood','stone'].includes(n.kind)&&!reserved.has(key(n.x-ix*STRIDE,n.y-iy*STRIDE))&&disconnected.some(k=>{const[x,y]=k.split(',').map(Number);return Math.abs(x-n.x)+Math.abs(y-n.y)===1;}));
   if(remove<0)break;out.splice(remove,1);
  }
  return out;
 }
 class Grid{
  constructor(state,extra=[]){
   this.cells=new Set();this.routes=new Map();
   for(const i of state.estate?.islands||[{ix:0,iy:0}])for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(islandTerrain(x,y)==='grass')this.cells.add(key(x+i.ix*STRIDE,y+i.iy*STRIDE));
   for(const b of bridges(state))for(let n=SIZE;n<STRIDE;n++)this.cells.add(key(b.ix*STRIDE+(b.dx?n:9),b.iy*STRIDE+(b.dy?n:9)));
   for(const p of [...state.nodes.filter(n=>['wood','stone'].includes(n.kind)),...state.buildings,...extra])this.cells.delete(key(p.x,p.y));
  }
  pass(x,y){return this.cells.has(key(x,y));}
  inside(x,y){return Number.isInteger(x)&&Number.isInteger(y)&&Math.abs(x)<100000&&Math.abs(y)<100000;}
  approach(p){return DIRS.some(([dx,dy])=>this.pass(p.x+dx,p.y+dy));}
  flood(start){const seen=new Set(),q=[];if(this.pass(start.x,start.y)){seen.add(key(start.x,start.y));q.push(start);}else for(const[dx,dy]of DIRS)if(this.pass(start.x+dx,start.y+dy)){const p={x:start.x+dx,y:start.y+dy};seen.add(key(p.x,p.y));q.push(p);break;}
   for(let h=0;h<q.length;h++){const p=q[h];for(const[dx,dy]of DIRS){const x=p.x+dx,y=p.y+dy,k=key(x,y);if(this.pass(x,y)&&!seen.has(k)){seen.add(k);q.push({x,y});}}}return seen;}
  path(start,target,adjacent=false){
   if(!target||!this.inside(start.x,start.y)||!this.inside(target.x,target.y))return null;
   const id=key(start.x,start.y)+':'+key(target.x,target.y)+':'+adjacent;
   if(this.routes.has(id))return this.routes.get(id)?.map(p=>({...p}))??null;
   const goals=new Set();if(!adjacent&&this.pass(target.x,target.y))goals.add(key(target.x,target.y));
   if(adjacent||!goals.size)for(const[dx,dy]of DIRS)if(this.pass(target.x+dx,target.y+dy))goals.add(key(target.x+dx,target.y+dy));
   if(!goals.size)return null;
   const q=[start],prev=new Map([[key(start.x,start.y),null]]);let end=null;
   for(let h=0;h<q.length;h++){const p=q[h],k=key(p.x,p.y);if(goals.has(k)){end=k;break;}for(const[dx,dy]of DIRS){const x=p.x+dx,y=p.y+dy,n=key(x,y);if(this.pass(x,y)&&!prev.has(n)){prev.set(n,k);q.push({x,y});}}}
   let route=null;if(end!==null){route=[];for(let k=end;prev.get(k)!==null;k=prev.get(k)){const[x,y]=k.split(',').map(Number);route.push({x,y});}route.reverse();}
   if(this.routes.size>=192)this.routes.delete(this.routes.keys().next().value);this.routes.set(id,route);return route?.map(p=>({...p}))??null;
  }
 }
 const cache=new WeakMap();
 function grid(state){const sig=root.LWWorldProfile.hash+'|'+(state.estate?.islands||[]).map(i=>key(i.ix,i.iy)).join(';')+'|'+state.buildings.map(b=>key(b.x,b.y)).join(';')+'|'+state.nodes.filter(n=>['wood','stone'].includes(n.kind)).map(n=>key(n.x,n.y)).join(';');let v=cache.get(state);if(!v||v.sig!==sig){v={sig,value:new Grid(state)};cache.set(state,v);}return v.value;}
 root.LWGeography={SIZE,STRIDE,DIRS,key,cell,terrain,islandTerrain,available,bridges,frontier,describe,hash,generatedNodes,Grid,grid};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWGeography;
})(typeof globalThis!=='undefined'?globalThis:this);
