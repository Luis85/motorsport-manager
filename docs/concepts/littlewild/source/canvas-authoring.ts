/// <reference path="./canvas-authoring-contracts.d.ts" />
/* Inert graph layout admission: never interprets scripts, paths or world coordinates. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWCanvasAuthoring?:LWCanvasAuthoring.Api};
 type Data=Record<string,unknown>;
 const record=(v:unknown):Data=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Canvas authoring requires JSON objects.');return v as Data;};
 const finite=(v:unknown,min:number,max:number):boolean=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 function keys(pack:LWContentPorts.ScenarioPack):{nodes:Set<string>;edges:Set<string>}{
  const nodes=new Set(['exchange']),edges=new Set<string>();if(pack.storytelling)nodes.add('storytelling');
  for(const world of pack.worlds){nodes.add('world:'+world.id);nodes.add('world-config:'+world.id);}
  for(const scene of pack.scenes){
   nodes.add('scene:'+scene.id);nodes.add('scene-config:'+scene.id);
   for(const connection of scene.graph?.connections??[]){const key=scene.id+':'+connection.id;nodes.add('connection-config:'+key);edges.add('connection:'+key);}
  }
  return {nodes,edges};
 }
 function reconcile(previous:LWContentPorts.ScenarioPack,next:LWContentPorts.ScenarioPack):void{
  if(!previous.canvasAuthoring||!next.canvasAuthoring)return;
  const before=keys(previous),after=keys(next),authoring=next.canvasAuthoring;
  for(const key of Object.keys(authoring.nodes))if(before.nodes.has(key)&&!after.nodes.has(key))delete authoring.nodes[key];
  for(const key of Object.keys(authoring.edges))if(before.edges.has(key)&&!after.edges.has(key))delete authoring.edges[key];
  const start=authoring.metadata?.startNode;if(typeof start==='string'&&before.nodes.has(start)&&!after.nodes.has(start))delete authoring.metadata!.startNode;
 }
 function validate(pack:LWContentPorts.ScenarioPack):void{
  if(pack.canvasAuthoring===undefined)return;
  const authoring=record(pack.canvasAuthoring);
  if(authoring.version!==1||Object.keys(authoring).some(k=>!['version','nodes','edges','metadata'].includes(k)))throw Error('Invalid Canvas authoring envelope.');
  const nodes=record(authoring.nodes),edges=record(authoring.edges),knownNodes=new Set(['exchange']),knownEdges=new Set<string>();
  const known=keys(pack);for(const key of known.nodes)knownNodes.add(key);for(const key of known.edges)knownEdges.add(key);
  if(Object.keys(nodes).length>256||Object.keys(edges).length>512)throw Error('Canvas authoring exceeds supported counts.');
  function fields(value:unknown,edge:boolean):void{
   const data=record(value),allowed=edge?['fromSide','toSide','fromEnd','toEnd','fromFloating','toFloating','color','styleAttributes']:['x','y','width','height','color','dynamicHeight','ratio','zIndex','styleAttributes','collapsed'];
   if(Object.keys(data).some(k=>!allowed.includes(k)))throw Error('Unknown Canvas authoring visual field.');
   if(!edge)for(const key of ['x','y','width','height'])if(!finite(data[key],key==='width'||key==='height'?1:-1000000,1000000)||!Number.isInteger(data[key]))throw Error('Invalid Canvas authoring integer pixels.');
   if(data.color!==undefined&&(typeof data.color!=='string'||!/^([1-6]|#[0-9a-fA-F]{6})$/.test(data.color)))throw Error('Invalid Canvas authoring color.');
   for(const key of ['fromSide','toSide'])if(data[key]!==undefined&&!['top','right','bottom','left'].includes(String(data[key])))throw Error('Invalid Canvas authoring side.');
   for(const key of ['fromEnd','toEnd'])if(data[key]!==undefined&&!['none','arrow'].includes(String(data[key])))throw Error('Invalid Canvas authoring end.');
   for(const key of ['dynamicHeight','collapsed','fromFloating','toFloating'])if(data[key]!==undefined&&typeof data[key]!=='boolean')throw Error('Invalid Canvas authoring boolean.');
   for(const key of ['ratio','zIndex'])if(data[key]!==undefined&&!finite(data[key],key==='ratio'?Number.MIN_VALUE:-1000000,1000000))throw Error('Invalid Canvas authoring number.');
   if(data.styleAttributes!==undefined){const styles=record(data.styleAttributes);if(Object.keys(styles).length>32)throw Error('Too many Canvas authoring styles.');for(const [key,value] of Object.entries(styles))if(!/^[a-zA-Z][a-zA-Z0-9-]{0,63}$/.test(key)||value!==null&&(typeof value!=='string'||value.length>128))throw Error('Invalid Canvas authoring style.');}
  }
  for(const [key,value] of Object.entries(nodes)){if(!knownNodes.has(key))throw Error('Canvas authoring references an unknown node.');fields(value,false);}
  for(const [key,value] of Object.entries(edges)){if(!knownEdges.has(key))throw Error('Canvas authoring references an unknown connection.');fields(value,true);}
  if(authoring.metadata!==undefined){
   const metadata=record(authoring.metadata);if(metadata.version!=='1.0-1.0'||Object.keys(metadata).some(k=>!['version','frontmatter','startNode'].includes(k)))throw Error('Invalid Advanced Canvas authoring metadata.');
   if(metadata.startNode!==undefined&&(typeof metadata.startNode!=='string'||!knownNodes.has(metadata.startNode)))throw Error('Advanced Canvas startNode is dangling.');
   const matter=record(metadata.frontmatter);if(Object.keys(matter).length>32)throw Error('Too many Advanced Canvas frontmatter fields.');
   for(const [key,value] of Object.entries(matter))if(key.length>64||!(value===null||typeof value==='boolean'||finite(value,-1000000,1000000)||typeof value==='string'&&value.length<=512))throw Error('Advanced Canvas frontmatter supports bounded scalar data.');
  }
 }
 const api:LWCanvasAuthoring.Api={validate,reconcile};root.LWCanvasAuthoring=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
