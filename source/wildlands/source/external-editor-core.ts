/// <reference path="./external-editor-contracts.d.ts" />
/* Canonical identity, native field patches and bounded detached admission. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWContent:LWContentPorts.ContentApi;LWScenarios:LWContentPorts.ScenarioApi;LWSceneGraph:LWSceneGraph.Api;LWSceneEditor:LWSceneEditor.Api;LWExternalEditorCore?:LWExternalEditors.Core};
 const node=typeof module!=='undefined'&&module.exports;
 const X=(node?require('./scenario-runtime.js'):root.LWScenarios) as LWContentPorts.ScenarioApi;
 const G=(node?require('./scene-graph.js'):root.LWSceneGraph) as LWSceneGraph.Api;
 const C=root.LWContent,E=(node?require('./scene-editor.js'):root.LWSceneEditor) as LWSceneEditor.Api;
 const record=(input:unknown):Record<string,unknown>=>input!==null&&typeof input==='object'&&!Array.isArray(input)?input as Record<string,unknown>:{};
 function array(input:unknown,label:string):unknown[]{if(!Array.isArray(input))throw Error(label+' must be a JSON array.');return input;}
 function number(input:unknown,label:string):number{if(typeof input!=='number'||!Number.isFinite(input))throw Error(label+' must be finite.');return input;}
 const binaryLengths=new WeakMap<Record<string,unknown>,number>();
 const typedArrayPrototype=Object.getPrototypeOf(Uint8Array.prototype) as object;
 const byteLengthOf=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteLength')!.get as (this:Uint8Array)=>number;
 const byteOffsetOf=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteOffset')!.get as (this:Uint8Array)=>number;
 const bufferOf=Object.getOwnPropertyDescriptor(typedArrayPrototype,'buffer')!.get as (this:Uint8Array)=>ArrayBuffer;
 function parse(input:unknown):Record<string,unknown>{
  let binaryLength:number|undefined;
  if(ArrayBuffer.isView(input)){
   if(Object.getPrototypeOf(input)!==Uint8Array.prototype)throw Error('GLB requires an ordinary Uint8Array.');
   const bytes=input as Uint8Array;
   for(const key of ['buffer','byteOffset','byteLength','subarray'])if(Object.hasOwn(bytes,key))throw Error('GLB bytes cannot carry custom behavior.');
   const length=byteLengthOf.call(bytes);if(length<20||length>8*1024*1024)throw Error('Invalid or oversized GLB.');
   const v=new DataView(bufferOf.call(bytes),byteOffsetOf.call(bytes),length);
   if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==v.byteLength)throw Error('Invalid GLB header or length.');
   const size=v.getUint32(12,true);if(size%4||size+20>v.byteLength||v.getUint32(16,true)!==0x4e4f534a)throw Error('Invalid GLB JSON chunk.');
   const remaining=v.byteLength-size-20;
   if(remaining){const offset=size+20;if(remaining<8)throw Error('Truncated GLB binary chunk.');binaryLength=v.getUint32(offset,true);if(binaryLength%4||binaryLength+8!==remaining||v.getUint32(offset+4,true)!==0x004e4942)throw Error('Invalid GLB binary chunk or unsupported extra chunks.');}
   input=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.prototype.subarray.call(bytes,20,size+20));
  }
  const result=C.parse(input,8*1024*1024);if(!result||typeof result!=='object'||Array.isArray(result))throw Error('Choose an external JSON object.');const exchanged=record(result);if(binaryLength!==undefined)binaryLengths.set(exchanged,binaryLength);return exchanged;
 }
 function metadata(input:unknown):LWExternalEditors.Metadata|undefined{
  if(input===undefined)return undefined;const m=record(input);
  if(m.version!==1||typeof m.sceneId!=='string'||!m.pack)throw Error('Invalid Littlewild exchange metadata.');
  return m as unknown as LWExternalEditors.Metadata;
 }
 function encodeMetadata(input:LWExternalEditors.Metadata):Record<string,string>{const text=JSON.stringify(input),out:Record<string,string>={LittlewildParts:String(Math.ceil(text.length/8000))};for(let i=0;i<text.length;i+=8000)out['Littlewild'+String(i/8000).padStart(3,'0')]=text.slice(i,i+8000);return out;}
 function decodeMetadata(input:Record<string,unknown>):LWExternalEditors.Metadata|undefined{if(input.LittlewildParts===undefined)return undefined;const count=Number(input.LittlewildParts);if(!Number.isInteger(count)||count<1||count>1000)throw Error('Invalid exchange metadata count.');let text='';for(let i=0;i<count;i++){const part=input['Littlewild'+String(i).padStart(3,'0')];if(typeof part!=='string'||part.length>8000)throw Error('Missing or invalid exchange metadata part.');text+=part;}return metadata(parse(text));}
 function accepted(input:unknown):LWContentPorts.ScenarioPack{const v=X.validate(input);if(!v.ok)throw Error(v.errors.join('\n'));return C.copy(v.pack);}
 function terrain(pack:LWContentPorts.ScenarioPack,id:string):LWExternalEditors.Tile[]{
  const scene=pack.scenes.find(s=>s.id===id)!;if(scene.graph?.binding?.type==='interior')return [];
  const state=G.owner(pack,id).initialState,profile=pack.worlds.find(w=>w.id===scene.worldId)!;
  const tiles=record(record(state.terraform).tiles),out:LWExternalEditors.Tile[]=[];
  const islands=state.estate===undefined?[{ix:0,iy:0}]:array(record(state.estate).islands,'Native islands');
  for(const value of islands){const island=record(value);for(let y=0;y<19;y++)for(let x=0;x<19;x++){
   const gx=Number(island.ix)*23+x,gy=Number(island.iy)*23+y,b=scene.graph?.bounds;
   if(b&&(gx<b.x||gy<b.y||gx>=b.x+b.width||gy>=b.y+b.height))continue;
   if(scene.graph?.binding?.type==='island'&&(island.ix!==scene.graph.binding.ix||island.iy!==scene.graph.binding.iy))continue;
   const override=record(tiles[gx+','+gy]);out.push({x:gx,y:gy,ground:override.ground==='water'?'water':override.ground==='grass'?'grass':profile.terrain[y]?.[x]==='.'?'grass':'water',height:Number(override.height??0)});
  }}return out;
 }
 function prepare(input:unknown,sceneId:string):LWExternalEditors.Exchange{
  const pack=accepted(input);if(!pack.scenes.some(s=>s.id===sceneId))throw Error('Choose an existing scene.');
  const bounds=G.bounds(pack,sceneId);return {...(bounds?{bounds}:{}),metadata:{version:1,pack,sceneId},warnings:[],tiles:terrain(pack,sceneId),placements:G.entities(pack,sceneId).map(e=>{
   const p:LWExternalEditors.Placement={type:e.kind,id:e.id,category:e.category,x:e.x,y:e.y};
   if(e.category==='creatures')p.inventory=C.copy(record(e.data.inventory)) as Record<string,number>;
   if(e.category==='nodes')p.stock=Number(e.data.stock);return p;
  })};
 }
 function apply(exchange:LWExternalEditors.Exchange,options?:LWExternalEditors.Options):{pack:LWContentPorts.ScenarioPack;sceneId:string}{
  if(exchange.convertedPack){const pack=accepted(exchange.convertedPack),sceneId=exchange.convertedSceneId;if(!sceneId||!pack.scenes.some(s=>s.id===sceneId))throw Error('Converted graph must select an existing canonical scene.');return {pack,sceneId};}
  const types=new Set<string>();for(const mapping of options?.mappings??[]){
   if(!mapping||typeof mapping.externalType!=='string'||types.has(mapping.externalType)||!['creatures','buildings','nodes','props'].includes(mapping.category)||!!mapping.entityId===!!mapping.templateId)throw Error('Mappings require unique external types, a canonical category and exactly one entityId or templateId.');types.add(mapping.externalType);
  }
  const context=exchange.metadata??options;if(!context)throw Error('Generic imports require an explicit canonical pack, scene and entity mappings.');
  let pack=accepted(context.pack);const sceneId=context.sceneId;
  for(const p of exchange.placements){if(exchange.metadata)continue;const mapping=options?.mappings?.find(m=>m.externalType===p.type);if(mapping?.templateId){
   if(!p.id)throw Error('Template placements require stable instance IDs: Tiled object name, LDtk EntityId field or glTF node name.');
   const editor=E.create(pack);if(mapping.category==='props'){const template=G.entities(pack,sceneId).find(e=>e.category==='props'&&e.id===mapping.templateId);if(!template)throw Error('Choose an existing canonical prop template.');editor.addProp(sceneId,{...C.copy(template.data) as unknown as LWSceneGraph.Prop,id:p.id,x:p.x,y:p.y});}else editor.addEntity(sceneId,mapping.category,mapping.templateId,p.id,p.x,p.y);pack=editor.export();
  }}
  const scene=pack.scenes.find(s=>s.id===sceneId);
  if(!scene)throw Error('Exchange scene identity does not exist.');
  const state=G.owner(pack,sceneId).initialState,seen=new Set<string>();
  for(const p of exchange.placements){
   const mapping=exchange.metadata?undefined:options?.mappings?.find(m=>m.externalType===p.type);
   const category=exchange.metadata?p.category:mapping?.category,id=exchange.metadata?p.id:mapping?.entityId??p.id;
   if(!category||!id)throw Error('Unmapped external entity type: '+p.type+'. Provide an explicit canonical entityId or templateId mapping.');
   const key=category+':'+id;if(seen.has(key))throw Error('Repeated canonical entity reference: '+key);seen.add(key);
   const rows=category==='props'?scene.graph?.props:category==='creatures'?record(state.colony).creatures:state[category];
   const entity=array(rows,'Canonical '+category).map(record).find(e=>e.id===id);if(!entity)throw Error('Unknown canonical entity '+key+'. Add it in the native draft first, or import a generic document with an explicit templateId mapping.');
   const original=G.entities(pack,sceneId).find(e=>e.category===category&&e.id===id);
   if((!Number.isInteger(p.x)||!Number.isInteger(p.y))&&(!original||original.x!==p.x||original.y!==p.y))throw Error('Edited native placements require whole grid coordinates; unchanged physical positions are preserved.');
   const b=scene.graph?.bounds;if(b&&(p.x<b.x||p.y<b.y||p.x>=b.x+b.width||p.y>=b.y+b.height))throw Error('Placement lies outside scene bounds.');
   if(scene.graph?.binding?.type==='interior'&&category!=='props'){
    const location=record(record(record(state.interiors).locations)[id]);
    if(location.x!==p.x||location.y!==p.y)throw Error('Interior actor placement belongs to native visit/layout authority.');
   }else{const point=category==='creatures'?record(entity.creature):entity;point.x=p.x;point.y=p.y;}
   if(p.inventory!==undefined){if(category!=='creatures')throw Error('Only canonical creatures carry inventory.');entity.inventory=C.copy(p.inventory);}
   if(p.stock!==undefined){if(category!=='nodes')throw Error('Only canonical finite nodes own stock.');entity.stock=p.stock;}
  }
  if(exchange.metadata){for(const p of prepare(context.pack,sceneId).placements)if(!seen.has(p.category+':'+p.id))throw Error('Deleting canonical entities requires the native editor reference review.');}
  const baseline=new Map(terrain(pack,sceneId).map(t=>[t.x+','+t.y,t]));
  const tileKeys=new Set<string>();
  for(const tile of exchange.tiles){const key=tile.x+','+tile.y,old=baseline.get(key);if(tileKeys.has(key))throw Error('Duplicate external terrain cell.');tileKeys.add(key);if(!old)throw Error('Terrain edit lies outside owned scene geometry.');
   if(old.ground===tile.ground&&old.height===tile.height)continue;
   state.terraform??={version:1,revision:0,sequence:1,tiles:{},plants:{}};
   const terraform=record(state.terraform);record(terraform.tiles)[key]={ground:tile.ground,height:tile.height};
  }
  return {pack:accepted(pack),sceneId};
 }
 const api:LWExternalEditors.Core={record,array,number,parse,parseValue:input=>C.parse(input,8*1024*1024),metadata,binaryLength:exchanged=>binaryLengths.get(exchanged),encodeMetadata,decodeMetadata,prepare,apply};root.LWExternalEditorCore=api;if(node)module.exports=api;
})(globalThis);
