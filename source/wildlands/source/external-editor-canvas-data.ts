/// <reference path="./external-editor-canvas-contracts.d.ts" />
/* JSON Canvas admission and presentation records, shared by both offline codecs. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWExternalEditorCore:LWExternalEditors.Core;LWCanvasEditorData?:LWCanvasEditors.DataApi};
 const node=typeof module!=='undefined'&&module.exports;
 const C=(node?require('./external-editor-core.js'):root.LWExternalEditorCore) as LWExternalEditors.Core;
 type Data=LWCanvasEditors.Data;
 const sides=['top','right','bottom','left'],ends=['none','arrow'];
 const basicNode=['x','y','width','height','color'],basicEdge=['fromSide','toSide','fromEnd','toEnd','color'];
 const advancedNode=['dynamicHeight','ratio','zIndex','styleAttributes','collapsed'];
 const advancedEdge=['fromFloating','toFloating','styleAttributes'];
 const builtinStyles:Record<string,string[]>={shape:['pill','diamond','parallelogram','circle','predefined-process','document','database'],border:['dashed','dotted','invisible'],textAlign:['center','right'],path:['dotted','short-dashed','long-dashed'],arrow:['triangle-outline','thin-triangle','halved-triangle','diamond','diamond-outline','circle','circle-outline','blunt'],pathfindingMethod:['direct','square','a-star']};
 function text(value:unknown,label:string,max=192):string{if(typeof value!=='string'||!value.length||value.length>max)throw Error(label+' requires bounded text.');return value;}
 function geometry(value:Data):Data{
  const result:Data={};
  for(const key of ['x','y','width','height']){
   const n=C.number(value[key],'Canvas '+key);
   if(!Number.isInteger(n)||Math.abs(n)>1000000||(key==='width'||key==='height')&&n<1)throw Error('Canvas geometry requires integer pixels within supported bounds.');
   result[key]=n;
  }
  return result;
 }
 function visual(value:Data,edge:boolean,advanced:boolean,warnings:string[]):Data{
  const result:Data=edge?{}:geometry(value);
  if(value.color!==undefined){if(typeof value.color!=='string'||!/^([1-6]|#[0-9a-fA-F]{6})$/.test(value.color))throw Error('Invalid Canvas color.');result.color=value.color;}
  for(const key of edge?['fromSide','toSide']:[])if(value[key]!==undefined){if(!sides.includes(String(value[key])))throw Error('Invalid Canvas edge side.');result[key]=value[key];}
  for(const key of edge?['fromEnd','toEnd']:[])if(value[key]!==undefined){if(!ends.includes(String(value[key])))throw Error('Invalid Canvas edge direction.');result[key]=value[key];}
  for(const key of edge?advancedEdge:advancedNode){
   if(value[key]===undefined)continue;
   if(!advanced){warnings.push('Advanced Canvas '+key+' retained as inert authoring data.');}
   if(key==='styleAttributes'){
    const attrs=C.record(value[key]);if(value[key]===null||Array.isArray(value[key])||typeof value[key]!=='object'||Object.keys(attrs).length>32)throw Error('Canvas styleAttributes must be a bounded object.');
    const styles:Data={};for(const [name,entry] of Object.entries(attrs)){
     if(!/^[a-zA-Z][a-zA-Z0-9-]{0,63}$/.test(name)||entry!==null&&(typeof entry!=='string'||entry.length>128))throw Error('Canvas styles require bounded string or null attributes.');
     styles[name]=entry;
     if(!Object.hasOwn(builtinStyles,name)||entry!==null&&!builtinStyles[name]!.includes(String(entry)))warnings.push('Custom Canvas style '+name+' retained; Littlewild does not render plugin CSS.');
    }result[key]=styles;
   }else if(key==='ratio'||key==='zIndex'){
    const n=C.number(value[key],'Canvas '+key);if(Math.abs(n)>1000000||key==='ratio'&&n<=0)throw Error('Invalid Canvas '+key+'.');result[key]=n;
   }else{if(typeof value[key]!=='boolean')throw Error('Canvas '+key+' must be boolean.');result[key]=value[key];}
  }
  return result;
 }
 function inside(a:Data,b:Data):boolean{return Number(a.x)>=Number(b.x)&&Number(a.y)>=Number(b.y)&&Number(a.x)+Number(a.width)<=Number(b.x)+Number(b.width)&&Number(a.y)+Number(a.height)<=Number(b.y)+Number(b.height);}
 function parent(value:Data,groups:Data[]):Data|undefined{
  const containing=groups.filter(g=>g.id!==value.id&&inside(value,g));
  const direct=containing.filter(g=>!containing.some(other=>other!==g&&inside(other,g)));
  if(direct.length>1||containing.some(g=>Number(g.x)===Number(value.x)&&Number(g.y)===Number(value.y)&&Number(g.width)===Number(value.width)&&Number(g.height)===Number(value.height)))throw Error('Ambiguous Canvas group containment; place each scene inside one unambiguous parent.');
  return direct[0];
 }
 function inspect(exchanged:Data,advanced:boolean):LWCanvasEditors.Graph{
  const warnings=['Canvas positions are graph layout pixels; native scene bounds and physical entity positions remain canonical data.'];
  if(advanced&&C.record(exchanged.metadata).version!=='1.0-1.0')throw Error('Advanced Canvas requires metadata.version 1.0-1.0.');
  const nodes=C.array(exchanged.nodes??[],'Canvas nodes').map(C.record),edges=C.array(exchanged.edges??[],'Canvas edges').map(C.record);
  if(nodes.length>256||edges.length>512)throw Error('Canvas exceeds supported node or edge count.');
  const ids=new Set<string>();
  for(const value of nodes){
   const id=text(value.id,'Canvas node ID');if(ids.has(id))throw Error('Duplicate Canvas node ID.');ids.add(id);
   if(value.type!=='group'&&value.type!=='text')throw Error('Canvas file, URL, portal and unsupported nodes require conversion to local text; no external content is loaded.');
   visual(value,false,advanced,warnings);
   if(value.type==='text'&&typeof value.text!=='string')throw Error('Canvas text nodes require text.');
   if(value.label!==undefined&&typeof value.label!=='string')throw Error('Canvas group labels require text.');
   const allowed=new Set(['id','type','text','label',...basicNode,...advancedNode]);
   for(const key of Object.keys(value))if(!allowed.has(key))warnings.push('Unsupported Canvas node field '+key+' omitted; no file or plugin behavior is executed.');
  }
  const edgeIds=new Set<string>();
  for(const edge of edges){
   const id=text(edge.id,'Canvas edge ID');if(edgeIds.has(id))throw Error('Duplicate Canvas edge ID.');edgeIds.add(id);
   if(!ids.has(text(edge.fromNode,'Canvas edge source'))||!ids.has(text(edge.toNode,'Canvas edge target')))throw Error('Dangling Canvas edge reference.');
   visual(edge,true,advanced,warnings);
   if(edge.label!==undefined&&typeof edge.label!=='string')throw Error('Canvas edge labels require text.');
   const allowed=new Set(['id','fromNode','toNode','label',...basicEdge,...advancedEdge]);
   for(const key of Object.keys(edge))if(!allowed.has(key))warnings.push('Unsupported Canvas edge field '+key+' omitted.');
  }
  for(const key of Object.keys(exchanged))if(!['nodes','edges','metadata'].includes(key))warnings.push('Unsupported Canvas exchanged field '+key+' omitted.');
  const groups=nodes.filter(n=>n.type==='group');for(const group of groups)parent(group,groups);
  return {nodes,edges,warnings};
 }
 const api:LWCanvasEditors.DataApi={inspect,visual,parent,geometry,text,key:(kind,id)=>kind+':'+id};root.LWCanvasEditorData=api;if(node)module.exports=api;
})(globalThis);
