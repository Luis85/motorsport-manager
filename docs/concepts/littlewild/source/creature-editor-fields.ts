/// <reference path="./creature-editor-contracts.d.ts" />
/* Authored labels and sections select data; compiled field types never select executable controls. */
(function(inputRoot:unknown){
 'use strict';
 type Data=LWCreatureEditor.Data;
 interface Group {label:string;target:'definition'|'instance';path:string[];fields?:string[];min?:number;max?:number;step?:number;emptyJSON?:boolean;}
 interface Root {LWContent:LWContentPorts.ContentApi;LWCreatureEditorFieldDefinitions?:unknown;LWCreatureEditorFields?:{fields(value:LWCreatureEditor.Package):LWCreatureEditor.Field[]};}
 const root=inputRoot as Root,node=typeof module!=='undefined'&&module.exports;
 const source:unknown=root.LWCreatureEditorFieldDefinitions??(node?require('./creature-editor-fields.json'):undefined);
 const record=(value:unknown):Data=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Data:{};
 const title=(id:string):string=>id.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/^./,s=>s.toUpperCase());
 function catalog(value:unknown):Group[]{
  const data=record(root.LWContent.parse(value,64*1024));if(data.format!=='littlewild-creature-editor-fields'||data.schemaVersion!==1||!Array.isArray(data.groups)||data.groups.length>40||Object.keys(data).some(key=>!['format','schemaVersion','groups'].includes(key)))throw Error('Invalid creature editor field catalog.');
  return data.groups.map(row=>{const g=record(row);if(Object.keys(g).some(key=>!['label','target','path','fields','min','max','step','emptyJSON'].includes(key))||typeof g.label!=='string'||g.label.length>100||!['definition','instance'].includes(String(g.target))||!Array.isArray(g.path)||g.path.length>8||!g.path.every(key=>typeof key==='string'&&/^[A-Za-z][A-Za-z0-9_]*$/.test(key)&&!['constructor','prototype','__proto__'].includes(key)))throw Error('Invalid creature editor group.');if(g.fields!==undefined&&(!Array.isArray(g.fields)||!g.fields.every(key=>typeof key==='string'&&/^[A-Za-z][A-Za-z0-9_]*$/.test(key))))throw Error('Invalid creature editor fields.');for(const key of ['min','max','step'])if(g[key]!==undefined&&(typeof g[key]!=='number'||!Number.isFinite(g[key])))throw Error('Invalid creature editor numeric hint.');if(g.emptyJSON!==undefined&&typeof g.emptyJSON!=='boolean')throw Error('Invalid creature editor empty group.');return g as unknown as Group;});
 }
 const groups=catalog(source);
 function fields(value:LWCreatureEditor.Package):LWCreatureEditor.Field[]{
  const result:LWCreatureEditor.Field[]=[];
  for(const group of groups){let selected:unknown=group.target==='definition'?value.gameplayDefinition:value.selectedInstance;if(!selected)continue;for(const key of group.path)selected=record(selected)[key];const row=record(selected),keys=group.fields??Object.keys(row);
   if(!keys.length&&group.emptyJSON){result.push({id:group.target+':'+group.path.join('.'),label:group.label,group:group.label,target:group.target,path:group.path,type:'json'});continue;}
   for(const key of keys){if(!Object.hasOwn(row,key))continue;const data=row[key],type=typeof data==='number'?'number':typeof data==='boolean'?'boolean':typeof data==='string'?'text':'json';result.push({id:group.target+':'+[...group.path,key].join('.'),label:title(key),group:group.label,target:group.target,path:[...group.path,key],type,...(group.min!==undefined?{min:group.min}:{}),...(group.max!==undefined?{max:group.max}:{}),...(group.step!==undefined?{step:group.step}:{})});}
  }
  // Archetype-authored extra component values are discoverable without a species branch.
  if(value.selectedInstance)for(const binding of value.gameplayDefinition.ecs.components){if(['creature','needs','learning','feelings','inventory'].includes(binding.field))continue;result.push({id:'instance:'+binding.field,label:binding.type,group:'Current components',target:'instance',path:[binding.field],type:'json'});}
  return result;
 }
 const api={fields,validate:catalog};root.LWCreatureEditorFields=api;if(node)module.exports=api;
})(globalThis);
