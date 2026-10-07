/// <reference path="./external-editor-contracts.d.ts" />
/* Tiled orthogonal finite JSON maps, inline terrain tiles and point objects. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWExternalEditorCore:LWExternalEditors.Core;LWExternalTiled?:LWExternalEditors.Codec};
 const node=typeof module!=='undefined'&&module.exports,C=(node?require('./external-editor-core.js'):root.LWExternalEditorCore) as LWExternalEditors.Core;
 const r=C.record,a=C.array,n=C.number;
 function properties(input:unknown):Record<string,unknown>{const out:Record<string,unknown>={};for(const value of a(input??[],'Tiled properties')){const p=r(value);if(typeof p.name!=='string'||['__proto__','prototype','constructor'].includes(p.name)||Object.hasOwn(out,p.name))throw Error('Invalid or duplicate Tiled property.');out[p.name]=p.value;}return out;}
 const props=(values:Record<string,unknown>)=>Object.entries(values).map(([name,value])=>({name,type:typeof value==='number'?'float':typeof value==='boolean'?'bool':'string',value:typeof value==='object'?JSON.stringify(value):value}));
 function read(doc:Record<string,unknown>,options?:LWExternalEditors.Options):LWExternalEditors.Exchange{
  if(doc.type!=='map'||doc.orientation!=='orthogonal'||doc.infinite===true)throw Error('Only finite orthogonal Tiled maps are supported.');
  const grid=n(doc.tilewidth,'tilewidth');if(grid<=0||grid!==n(doc.tileheight,'tileheight'))throw Error('Tiled requires positive square cells.');
  const metadata=C.decodeMetadata(properties(doc.properties)),out:LWExternalEditors.Exchange={placements:[],tiles:[],warnings:[]};if(metadata)out.metadata=metadata;
  const gids=new Map<number,'grass'|'water'>();
  for(const value of a(doc.tilesets??[],'tilesets')){const set=r(value);if(set.source!==undefined)throw Error('External Tiled tilesets are unsupported. Inline the tileset.');
   const first=n(set.firstgid,'firstgid');if(!Number.isInteger(first)||first<1)throw Error('Invalid tileset gid.');
   if(set.image!==undefined)out.warnings.push('Tiled raster images are visual references only; no image is fetched or imported as a native asset.');
   for(const value of a(set.tiles??[],'tiles')){const tile=r(value),id=n(tile.id,'tile id');if(!Number.isInteger(id)||id<0||id>65535||gids.has(first+id))throw Error('Invalid or overlapping Tiled tile reference.');const p=properties(tile.properties),ground=p.ground??options?.terrain?.[String(first+id)];
    if(ground==='grass'||ground==='water')gids.set(first+id,ground);
   }
  }
  for(const value of a(doc.layers,'layers')){const layer=r(value);if(layer.offsetx||layer.offsety||layer.rotation)throw Error('Tiled layer transforms are unsupported.');
   if(layer.type==='objectgroup')for(const value of a(layer.objects,'objects')){const obj=r(value),p=properties(obj.properties);
    for(const key of Object.keys(p))if(!['entityId','category','inventory','stock','canonicalTerrain','height'].includes(key))out.warnings.push('Ignored Tiled object property '+key+'. Canonical gameplay fields require the native editor.');
    if(obj.rotation||obj.gid||obj.polygon||obj.polyline||obj.template||obj.ellipse||obj.text)throw Error('Only unrotated Tiled point/rectangle entity placements are supported.');
    if(p.canonicalTerrain!==undefined){if(p.canonicalTerrain!=='grass'&&p.canonicalTerrain!=='water')throw Error('Terrain rectangles require grass or water.');out.tiles.push({x:n(obj.x,'terrain x')/grid,y:n(obj.y,'terrain y')/grid,ground:p.canonicalTerrain,height:n(p.height??0,'terrain height')});continue;}
    const placement:LWExternalEditors.Placement={id:String(obj.name??''),type:String(obj.class||obj.type||obj.name),x:n(obj.x,'object x')/grid,y:n(obj.y,'object y')/grid};
    if(p.category!==undefined)placement.category=p.category as LWSceneEditor.Category;if(p.entityId!==undefined)placement.id=String(p.entityId);
    if(p.inventory!==undefined){if(typeof p.inventory!=='string')throw Error('Inventory must be a JSON string property.');placement.inventory=r(C.parse(p.inventory)) as Record<string,number>;}
    if(p.stock!==undefined)placement.stock=n(p.stock,'node stock');out.placements.push(placement);
   }else if(layer.type==='tilelayer'){
    if(layer.encoding||layer.compression||layer.chunks)throw Error('Encoded, compressed and chunked tile layers are unsupported.');
    const width=n(layer.width,'layer width'),height=n(layer.height,'layer height'),data=a(layer.data,'tile data');
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height!==data.length)throw Error('Invalid tile layer dimensions.');
    const p=properties(layer.properties),heights=p.heights===undefined?[]:a(C.parseValue(p.heights),'terrain heights');if(heights.length&&heights.length!==data.length)throw Error('Tiled terrain heights must match layer dimensions.');
    data.forEach((value,index)=>{const gid=n(value,'gid');if(!Number.isInteger(gid)||gid<0||gid>=0x10000000)throw Error('Unsupported Tiled gid flags or reference.');if(gid===0)return;
     const ground=gids.get(gid)??options?.terrain?.[String(gid)];if(!ground)throw Error('Unmapped terrain gid '+gid);
     out.tiles.push({x:Number(layer.x??0)+index%width,y:Number(layer.y??0)+Math.floor(index/width),ground,height:heights.length?n(heights[index],'terrain height'):0});
    });
   }else throw Error('Unsupported Tiled layer type: '+String(layer.type));
  }
  if(metadata){const baseline=new Map(C.prepare(metadata.pack,metadata.sceneId).tiles.map(t=>[t.x+','+t.y,t])),observations=new Map<string,LWExternalEditors.Tile[]>();
   for(const tile of out.tiles){const key=tile.x+','+tile.y,values=observations.get(key)??[];values.push(tile);observations.set(key,values);}
   out.tiles=[];for(const [key,values] of observations){const original=baseline.get(key);if(!original)throw Error('Terrain lies outside canonical scene geometry.');const changed=values.filter(t=>t.ground!==original.ground||t.height!==original.height);
    if(changed.some(t=>t.ground!==changed[0]!.ground||t.height!==changed[0]!.height))throw Error('Conflicting Tiled tile and rectangle terrain edits.');out.tiles.push(changed[0]??values[0]!);}
  }
  out.warnings.push('Tiled terrain rectangles are colored editable guides; the inline tileset has no external raster image. Edit a rectangle’s canonicalTerrain property or the tile layer; conflicting edits are rejected.');
  out.warnings.push('Tiled exchange uses point placements and grass/water tiles. Entity deletion, rotation, tile flips, external tilesets and custom geometry require native authoring.');return out;
 }
 function write(exchange:LWExternalEditors.Exchange):Record<string,unknown>{
  const layers:Record<string,unknown>[]=[],groups=new Map<string,LWExternalEditors.Tile[]>();
  for(const tile of exchange.tiles){const key=Math.floor(tile.x/23)+','+Math.floor(tile.y/23);const list=groups.get(key)??[];list.push(tile);groups.set(key,list);}
  for(const tiles of groups.values()){
   const minX=Math.min(...tiles.map(t=>t.x)),minY=Math.min(...tiles.map(t=>t.y)),width=Math.max(...tiles.map(t=>t.x))-minX+1,height=Math.max(...tiles.map(t=>t.y))-minY+1;
   const data=new Array<number>(width*height).fill(0),heights=new Array<number>(width*height).fill(0);
   for(const t of tiles){const i=(t.y-minY)*width+t.x-minX;data[i]=t.ground==='grass'?1:2;heights[i]=t.height;}
   layers.push({id:layers.length+1,type:'tilelayer',name:'Terrain '+minX+','+minY,x:minX,y:minY,width,height,opacity:1,visible:true,data,properties:props({heights})});
  }
  for(const ground of ['grass','water'] as const){const objects=exchange.tiles.filter(t=>t.ground===ground).map((t,i)=>({id:10000+layers.length*20000+i,name:ground+' '+t.x+','+t.y,type:'Terrain',x:t.x*32,y:t.y*32,width:32,height:32,rotation:0,visible:true,properties:props({canonicalTerrain:ground,height:t.height})}));layers.push({id:layers.length+1,type:'objectgroup',name:ground+' terrain guides',color:ground==='grass'?'#83b86c':'#6fa4bc',x:0,y:0,opacity:0.6,visible:true,draworder:'topdown',objects});}
  const objects=exchange.placements.map((p,i)=>({id:i+1,name:p.id,type:p.type,point:true,x:p.x*32,y:p.y*32,width:0,height:0,rotation:0,visible:true,properties:props({entityId:p.id,category:p.category,...(p.inventory?{inventory:JSON.stringify(p.inventory)}:{}),...(p.stock!==undefined?{stock:p.stock}:{})})}));
  layers.push({id:layers.length+1,type:'objectgroup',name:'Canonical entities',x:0,y:0,opacity:1,visible:true,draworder:'topdown',objects});
  return {type:'map',version:'1.10',tiledversion:'1.11.2',orientation:'orthogonal',renderorder:'right-down',infinite:false,width:Math.max(exchange.bounds?exchange.bounds.x+exchange.bounds.width:19,...exchange.tiles.map(t=>t.x+1)),height:Math.max(exchange.bounds?exchange.bounds.y+exchange.bounds.height:19,...exchange.tiles.map(t=>t.y+1)),tilewidth:32,tileheight:32,nextlayerid:layers.length+1,nextobjectid:Math.max(0,...layers.flatMap(layer=>Array.isArray(layer.objects)?layer.objects.map(object=>Number(r(object).id)):[]))+1,layers,properties:props(C.encodeMetadata(exchange.metadata!)),tilesets:[{firstgid:1,name:'Littlewild terrain',tilewidth:32,tileheight:32,tilecount:2,columns:0,tiles:[{id:0,type:'grass',properties:props({ground:'grass'})},{id:1,type:'water',properties:props({ground:'water'})}]}]};
 }
 const api:LWExternalEditors.Codec={read,write};root.LWExternalTiled=api;if(node)module.exports=api;
})(globalThis);
