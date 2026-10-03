/// <reference path="./construction-contracts.d.ts" />
/* Authored geometry reuses compiled building mechanics; validation never registers content. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LW:{BUILDINGS:Record<string,{cost:Record<string,number>;time:number}>;RES:Record<string,unknown>};LWInteriors:LWInterior.CatalogApi;LWContent:{parse(input:unknown,limit:number):unknown};LWConstructionDesigns?:LWConstruction.DesignsApi};
 const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
 const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 function bad(message:string):never{throw Error('Building design: '+message);}
 function validate(raw:unknown,id='draft'):LWConstruction.Design{
  const input=root.LWContent.parse(raw,2*1024*1024);
  if(!plain(input)||Object.keys(input).some(k=>!['name','kind','layout','mapUnit'].includes(k))||['name','kind','layout'].some(k=>!Object.hasOwn(input,k)))bad('expected name, kind and layout');
  if(typeof input.name!=='string'||!input.name.trim()||[...input.name].length>80||typeof input.kind!=='string'||!Object.hasOwn(root.LW.BUILDINGS,input.kind))bad('choose a known building type and a name');
  const candidate=input.layout;if(!plain(candidate)||typeof candidate.id!=='string')bad('missing layout');
  const checked=root.LWInteriors.validate({version:1,layouts:[candidate],bindings:{[input.kind]:candidate.id},fallback:candidate.id});
  const layout=checked.layouts[0]!;
  const ground=layout.floors[0]!;
  if(ground.door.y!==ground.height-1||ground.door.x>3)bad('the ground entrance must face south within the first four floor tiles');
  if(ground.edges&& !ground.edges.some(e=>e.x===ground.door.x&&e.y===ground.door.y&&e.side==='s'&&e.kind==='door'))bad('fit a south-facing door at the ground entrance');
  const groundCells=ground.cells||Array.from({length:ground.width*ground.height},(_,i)=>({x:i%ground.width,y:Math.floor(i/ground.width)}));
  const occupied=new Set(groundCells.map(p=>p.x+','+p.y));
  for(const f of layout.floors.slice(1))for(const p of f.cells||Array.from({length:f.width*f.height},(_,i)=>({x:i%f.width,y:Math.floor(i/f.width)})))if(!occupied.has(p.x+','+p.y))bad('upper floors need ground-floor support');
  const mapUnit=input.mapUnit===undefined?{width:4,height:4}:input.mapUnit;
  if(!plain(mapUnit)||Object.keys(mapUnit).length!==2||Object.keys(mapUnit).some(k=>!['width','height'].includes(k))||typeof mapUnit.width!=='number'||typeof mapUnit.height!=='number'||!Number.isInteger(mapUnit.width)||!Number.isInteger(mapUnit.height)||mapUnit.width<4||mapUnit.width>20||mapUnit.height<4||mapUnit.height>20)bad('invalid exterior mapping scale');
  const footprint:LWRuntime.Point[]=[];
  for(let y=0;y<Math.ceil(ground.height/mapUnit.height);y++)for(let x=0;x<Math.ceil(ground.width/mapUnit.width);x++)footprint.push({x,y:y===0?0:-y});
  if(footprint.length>25)bad('footprint exceeds twenty-five map tiles');
  return {id,name:input.name.trim(),kind:input.kind,layout,mapUnit:{width:mapUnit.width,height:mapUnit.height},footprint};
 }
 function preserve(old:LWInterior.Layout,next:LWInterior.Layout):string|null{
  for(const f of old.floors){const target=next.floors.find(v=>v.id===f.id);if(!target)return 'Keep every existing floor ID when improving a place.';
   if(target.width<f.width||target.height<f.height||target.door.x!==f.door.x||target.door.y!==f.door.y)return 'Keep existing floor support and entrances in place.';
   for(const s of f.stations)if(!target.stations.some(v=>v.id===s.id&&v.x===s.x&&v.y===s.y&&v.kind===s.kind&&v.production===s.production))return 'Keep existing workstation IDs and positions.';
   for(const s of f.stairs)if(!target.stairs.some(v=>JSON.stringify(v)===JSON.stringify(s)))return 'Keep existing staircase connections.';
   const cells=target.cells;if(cells){const original=f.cells||Array.from({length:f.width*f.height},(_,i)=>({x:i%f.width,y:Math.floor(i/f.width)}));if(original.some(p=>!cells.some(q=>q.x===p.x&&q.y===p.y)))return 'Keep existing floor tiles supported.';}
  }return null;
 }
 function cost(design:LWConstruction.Design):Record<string,number>{
  const out={...root.LW.BUILDINGS[design.kind]!.cost};
  const add=(id:string,n:number):void=>{if(n&&Object.hasOwn(root.LW.RES,id))out[id]=(out[id]||0)+n;};
  for(const floor of design.layout.floors){
   const cells=floor.cells?.length||floor.width*floor.height,edges=floor.edges||[];
   add('wood',Math.ceil(cells/8)+edges.filter(e=>e.kind==='wall').length);
   add('stone',Math.ceil(cells/16));add('glass',edges.filter(e=>e.kind==='window').length);
   add('planks',edges.filter(e=>e.kind==='door').length+floor.stairs.length*2);
   add('fiber',Math.ceil(floor.stations.length/2));
  }
  return out;
 }
 function improvementCost(previous:LWConstruction.Design,next:LWConstruction.Design):Record<string,number>{
  const old=cost(previous),out:Record<string,number>={};for(const [id,n]of Object.entries(cost(next)))if(n>(old[id]||0))out[id]=n-(old[id]||0);out.wood=(out.wood||0)+2;return out;
 }
 function phases(design:LWConstruction.Design):LWConstruction.Phase[]{
  const seconds=root.LW.BUILDINGS[design.kind]!.time+design.layout.floors.reduce((n,f)=>n+(f.cells?.length||f.width*f.height)*.25+(f.edges?.length||0)*.5,0);
  const rows:LWConstruction.Phase[]=['Lay the designed foundation','Raise floors and walls','Fit windows, doors and stations'].map((name,i)=>({name,cost:{},time:seconds*[.25,.45,.3][i]!}));
  for(const [id,n]of Object.entries(cost(design))){const stage=['stone','clay','bricks'].includes(id)?0:['wood','planks','beams','iron','rope'].includes(id)?1:2;rows[stage]!.cost[id]=n;}
  return rows;
 }
 root.LWConstructionDesigns=Object.freeze({validate,preserve,cost,improvementCost,phases,copy});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWConstructionDesigns;
})(globalThis);
