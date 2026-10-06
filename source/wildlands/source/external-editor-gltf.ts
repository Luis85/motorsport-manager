/// <reference path="./external-editor-contracts.d.ts" />
/* glTF 2 static proxy geometry: editable X/Z grid placement, data-only extras. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWExternalEditorCore:LWExternalEditors.Core;LWExternalGltf?:LWExternalEditors.Codec};
 const node=typeof module!=='undefined'&&module.exports,C=(node?require('./external-editor-core.js'):root.LWExternalEditorCore) as LWExternalEditors.Core;
 const r=C.record,a=C.array,n=C.number;
 function reference(value:unknown,length:number,label:string):number{const i=n(value,label);if(!Number.isInteger(i)||i<0||i>=length)throw Error('Dangling '+label+'.');return i;}
 function identity(value:unknown,expected:number[],label:string):void{if(value!==undefined){const v=a(value,label);if(v.length!==expected.length||v.some((item,i)=>item!==expected[i]))throw Error('Unsupported '+label+'; apply transforms to native grid positions before exchange.');}}
 function read(doc:Record<string,unknown>):LWExternalEditors.Exchange{
  if(r(doc.asset).version!=='2.0')throw Error('Only glTF 2.0 is supported.');
  if(a(doc.extensionsRequired??[],'required extensions').length)throw Error('Required glTF extensions are unsupported.');
  if(a(doc.animations??[],'animations').length||a(doc.skins??[],'skins').length)throw Error('Animated or skinned glTF data is unsupported.');
  const buffers=a(doc.buffers??[],'buffers'),views=a(doc.bufferViews??[],'bufferViews'),accessors=a(doc.accessors??[],'accessors');
  for(const [index,value] of buffers.entries()){const buffer=r(value),uri=buffer.uri,size=n(buffer.byteLength,'buffer byteLength');
   if(uri===undefined&&index===0&&C.binaryLength(doc)!==undefined){const length=C.binaryLength(doc)!;if(!Number.isInteger(size)||size<0||size>length||length-size>3)throw Error('GLB binary buffer length mismatch.');continue;}
   if(typeof uri!=='string'||!/^data:application\/(octet-stream|gltf-buffer);base64,[A-Za-z0-9+/]*={0,2}$/.test(uri))throw Error('Only inline glTF base64 buffers are supported; external and binary buffers are not loaded.');
   const encoded=uri.slice(uri.indexOf(',')+1);if(encoded.length%4||size<0||!Number.isInteger(size)||encoded.length/4*3-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0)!==size)throw Error('Invalid glTF buffer length.');
  }
  for(const value of views){const view=r(value),buffer=r(buffers[reference(view.buffer,buffers.length,'buffer reference')]),offset=Number(view.byteOffset??0),length=n(view.byteLength,'view length');if(!Number.isInteger(offset)||!Number.isInteger(length)||offset<0||length<0||offset+length>Number(buffer.byteLength))throw Error('glTF buffer view exceeds its buffer.');}
  for(const value of accessors){const accessor=r(value);if(accessor.sparse)throw Error('Sparse glTF accessors are unsupported.');const view=r(views[reference(accessor.bufferView,views.length,'accessor view')]);const components:{[key:string]:number}={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},bytes:{[key:string]:number}={'5120':1,'5121':1,'5122':2,'5123':2,'5125':4,'5126':4};
   const size=components[String(accessor.type)],width=bytes[String(accessor.componentType)],count=n(accessor.count,'accessor count'),offset=Number(accessor.byteOffset??0);
   if(!size||!width||!Number.isInteger(count)||count<0||!Number.isInteger(offset)||offset<0||offset+count*size*width>Number(view.byteLength))throw Error('Invalid glTF accessor bounds.');
  }
  const images=a(doc.images??[],'images');for(const image of images){const i=r(image);if(i.uri!==undefined)throw Error('glTF image URIs are unsupported; native assets are retained in canonical metadata.');if(i.bufferView!==undefined)reference(i.bufferView,views.length,'image buffer view');}
  const meshes=a(doc.meshes??[],'meshes');for(const mesh of meshes)for(const p of a(r(mesh).primitives,'mesh primitives')){const primitive=r(p);if(primitive.indices!==undefined)reference(primitive.indices,accessors.length,'mesh index accessor');for(const attr of Object.values(r(primitive.attributes)))reference(attr,accessors.length,'mesh attribute accessor');}
  const nodes=a(doc.nodes,'nodes'),scenes=a(doc.scenes,'scenes'),selected=r(scenes[reference(doc.scene??0,scenes.length,'scene reference')]);
  const copies:LWExternalEditors.Metadata[]=[];const legacy=C.metadata(r(doc.extras).littlewild);if(legacy)copies.push(legacy);
  for(const extra of [r(selected.extras),...nodes.map(value=>r(r(value).extras))]){const copy=C.decodeMetadata(extra);if(copy)copies.push(copy);}
  if(copies.some(copy=>JSON.stringify(copy)!==JSON.stringify(copies[0])))throw Error('Conflicting glTF canonical metadata copies.');
  const out:LWExternalEditors.Exchange={placements:[],tiles:[],warnings:[]};if(copies[0])out.metadata=copies[0];
  if(a(doc.extensionsUsed??[],'used extensions').length)out.warnings.push('Optional glTF extensions are visual exchange data and are not installed as native handlers.');
  const seen=new Set<number>(),ancestors=new Set<number>();
  function visit(index:number,parentX:number,parentY:number,parentZ:number):void{
   if(ancestors.has(index)||seen.has(index))throw Error('Cyclic or multiply parented glTF node.');seen.add(index);ancestors.add(index);
   const value=r(nodes[index]);identity(value.rotation,[0,0,0,1],'node rotation');identity(value.scale,[1,1,1],'node scale');if(value.matrix!==undefined)throw Error('glTF node matrices are unsupported; use translation.');
   const t=value.translation===undefined?[0,0,0]:a(value.translation,'translation');if(t.length!==3)throw Error('Invalid node translation.');
   const x=parentX+n(t[0],'node x'),vertical=parentY+n(t[1],'node height'),y=parentZ+n(t[2],'node z'),extra=r(value.extras);
   for(const key of Object.keys(extra))if(!['entityId','category','externalType','inventory','stock','terrain','proxy','LittlewildParts'].includes(key)&&!/^Littlewild[0-9]{3}$/.test(key))out.warnings.push('Ignored glTF node extra '+key+'. Native asset geometry and gameplay fields remain canonical.');
   if(value.mesh!==undefined)reference(value.mesh,meshes.length,'node mesh');
   if(extra.terrain){const tile=r(extra.terrain);if(tile.ground!=='grass'&&tile.ground!=='water')throw Error('Unsupported terrain material.');out.tiles.push({x,y,ground:tile.ground,height:vertical});}
   else if(extra.entityId!==undefined||extra.externalType!==undefined||extra.LittlewildParts===undefined&&a(value.children??[],'children').length===0){
    if(vertical!==0)throw Error('Native entity placements require zero vertical translation.');
    const p:LWExternalEditors.Placement={id:String(value.name??''),type:String(extra.externalType??value.name??''),x,y};if(extra.entityId!==undefined)p.id=String(extra.entityId);if(extra.category!==undefined)p.category=extra.category as LWSceneEditor.Category;
    if(extra.inventory!==undefined)p.inventory=C.parse(extra.inventory) as Record<string,number>;if(extra.stock!==undefined)p.stock=n(extra.stock,'stock');out.placements.push(p);
   }
   for(const child of a(value.children??[],'children'))visit(reference(child,nodes.length,'child node'),x,vertical,y);ancestors.delete(index);
  }
  for(const i of a(selected.nodes,'scene nodes'))visit(reference(i,nodes.length,'scene node'),0,0,0);
  if(seen.size!==nodes.length)out.warnings.push('Unselected glTF nodes were ignored.');
  if(C.binaryLength(doc)!==undefined)out.warnings.push('GLB binary geometry is bounded and referenced, but retained only as visual exchange: native assets remain canonical.');
  if(images.length||a(doc.textures??[],'textures').length)out.warnings.push('glTF textures are visual only and are not imported as native assets.');
  out.warnings.push('glTF exports static box proxies, not native animated asset meshes. Translation edits on X/Z, native inventory/stock extras and terrain height/material extras are admitted; rotations, scaling, matrices and geometry changes are unsupported.');return out;
 }
 function write(exchange:LWExternalEditors.Exchange):Record<string,unknown>{
  // One real indexed unit box. Proxy dimensions are baked into separate meshes, keeping editable entity transforms identity-scaled.
  const positions=[-.35,0,-.35,.35,0,-.35,.35,.7,-.35,-.35,.7,-.35,-.35,0,.35,.35,0,.35,.35,.7,.35,-.35,.7,.35];
  const indices=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5];
  const bytes=new Uint8Array(positions.length*4+indices.length*2),view=new DataView(bytes.buffer);positions.forEach((v,i)=>view.setFloat32(i*4,v,true));indices.forEach((v,i)=>view.setUint16(positions.length*4+i*2,v,true));
  let text='';for(const byte of bytes)text+=String.fromCharCode(byte);const base64=typeof btoa==='function'?btoa(text):Buffer.from(bytes).toString('base64');
  const materials=[{name:'Creature proxy',pbrMetallicRoughness:{baseColorFactor:[.56,.76,.4,1],metallicFactor:0,roughnessFactor:1}},{name:'Building proxy',pbrMetallicRoughness:{baseColorFactor:[.7,.52,.32,1],metallicFactor:0,roughnessFactor:1}},{name:'Resource / prop proxy',pbrMetallicRoughness:{baseColorFactor:[.9,.68,.3,1],metallicFactor:0,roughnessFactor:1}},{name:'Grass cell proxy',pbrMetallicRoughness:{baseColorFactor:[.38,.65,.32,1],metallicFactor:0,roughnessFactor:1}},{name:'Water cell proxy',pbrMetallicRoughness:{baseColorFactor:[.25,.53,.75,1],metallicFactor:0,roughnessFactor:1}}];
  const nodes:Record<string,unknown>[]=exchange.placements.map(p=>({name:p.id,mesh:p.category==='creatures'?0:p.category==='buildings'?1:2,translation:[p.x,0,p.y],extras:{entityId:p.id,category:p.category,externalType:p.type,...(p.inventory?{inventory:p.inventory}:{}),...(p.stock!==undefined?{stock:p.stock}:{})}}));
  for(const t of exchange.tiles)nodes.push({name:'Terrain '+t.x+','+t.y,mesh:t.ground==='grass'?3:4,translation:[t.x,t.height,t.y],extras:{terrain:{ground:t.ground},proxy:true}});
  const rootIndex=nodes.length;nodes.push({name:'Littlewild canonical metadata',children:nodes.map((_,i)=>i),extras:C.encodeMetadata(exchange.metadata!)});
  return {asset:{version:'2.0',generator:'Littlewild static proxy exchange'},scene:0,scenes:[{name:exchange.metadata?.sceneId,nodes:[rootIndex]}],nodes,materials,meshes:materials.map((_,i)=>({name:i>=3?'Terrain cell proxy':'Entity proxy',primitives:[{attributes:{POSITION:0},indices:1,material:i}]})),buffers:[{uri:'data:application/octet-stream;base64,'+base64,byteLength:bytes.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:positions.length*4,target:34962},{buffer:0,byteOffset:positions.length*4,byteLength:indices.length*2,target:34963}],accessors:[{bufferView:0,componentType:5126,count:8,type:'VEC3',min:[-.35,0,-.35],max:[.35,.7,.35]},{bufferView:1,componentType:5123,count:indices.length,type:'SCALAR'}]};
 }
 const api:LWExternalEditors.Codec={read,write};root.LWExternalGltf=api;if(node)module.exports=api;
})(globalThis);
