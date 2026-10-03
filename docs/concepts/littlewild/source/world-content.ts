/* Data-only world definition registry. Validation has no simulation side effects. */
(function(inputRoot:unknown){
 'use strict';
 interface Root {LWContent?:LWContentPorts.ContentApi;LWDefaultWorld?:LWContentPorts.World;LWWorldSchema?:LWContentPorts.Schema;LWAdventure?:LWContentPorts.AdventureApi;LWWorldContent?:LWContentPorts.WorldApi;LW?:{WorldSystem?:{siteIssues(world:LWContentPorts.World):string[]}};}
 const root=inputRoot as Root;
 const node=typeof module!=='undefined'&&module.exports;
 const contentApi=(node?require('./content-runtime.js'):root.LWContent) as LWContentPorts.ContentApi|undefined;
 if(!contentApi)throw Error('Content runtime is missing.');
 const C=contentApi;
 const defaultWorld=(node?require('./content/world-library.json'):root.LWDefaultWorld) as LWContentPorts.World|undefined;
 if(!defaultWorld)throw Error('Default world content is missing.');
 const defaults=defaultWorld;
 const worldSchema=(node?require('./content/world.schema.json'):root.LWWorldSchema) as LWContentPorts.Schema|undefined;
 if(!worldSchema)throw Error('World content schema is missing.');
 const schema=worldSchema;
 const clone=<T>(x:T):T=>C.copy(x);
 const own=(o:object,k:PropertyKey)=>Object.prototype.hasOwnProperty.call(o,k);
 // Wrap the whole world document: the base fingerprint intentionally hashes only its own schema fields.
 const hash=(x:LWContentPorts.World)=>C.fingerprint({schemaVersion:1,library:{id:x?.id,version:x?.version},components:x});
 let content=clone(defaults);
 function validate(input:unknown):LWContentPorts.Validation<LWContentPorts.World>{
  const errors:string[]=[];let parsed:unknown;
  try{parsed=C.parse(input,300000);if(JSON.stringify(parsed).length>300000)throw Error('World definitions exceed 300 KB.');}catch(e){return {ok:false,errors:['/: '+(e instanceof Error?e.message:String(e))]};}
  function walk(v:unknown,s:LWContentPorts.Schema|undefined,p:string):void{
   if(!s)throw Error('Missing bundled world schema.');
   if(s.anyOf){if(v===null&&s.anyOf.some(x=>x.type==='null'))return;return walk(v,s.anyOf.find(x=>x.type!=='null'),p);}
   if(s.const!==undefined&&v!==s.const)errors.push(p+': unsupported value');
   if(s.enum&&!s.enum.includes(v))errors.push(p+': unsupported value');
   if(Array.isArray(s.type)&&v===null&&s.type.includes('null'))return;
   const t=Array.isArray(s.type)?s.type[0]:s.type;
   if(t==='object'){
    if(!v||typeof v!=='object'||Array.isArray(v)){errors.push(p+': expected an object');return;}
    for(const k of s.required||[])if(!own(v,k))errors.push(p+'/'+k+': required');
    if(s.maxProperties&&Object.keys(v).length>s.maxProperties)errors.push(p+': too many fields');
    for(const [k,x]of Object.entries(v)){
     if(['__proto__','constructor','prototype'].includes(k)){errors.push(p+'/'+k+': unsafe key');continue;}
     if(s.properties&&own(s.properties,k))walk(x,s.properties[k],p+'/'+k);else if(s.additionalProperties===false)errors.push(p+'/'+k+': unknown field');else if(typeof s.additionalProperties==='object')walk(x,s.additionalProperties,p+'/'+k);
    }
   }else if(t==='array'){
    if(!Array.isArray(v)){errors.push(p+': expected an array');return;}
    if(v.length<(s.minItems||0)||v.length>(s.maxItems||Infinity))errors.push(p+': unsupported count');v.forEach((x,i)=>walk(x,s.items,p+'/'+i));
   }else if(t==='string'){
    if(typeof v!=='string'||[...v].length<(s.minLength||0)||[...v].length>(s.maxLength||Infinity)||s.pattern&&!new RegExp(s.pattern).test(v))errors.push(p+': invalid text');
   }else if(t==='boolean'){if(typeof v!=='boolean')errors.push(p+': expected a boolean');}
   else if(t==='integer'||t==='number'){if(typeof v!=='number'||!Number.isFinite(v)||t==='integer'&&!Number.isInteger(v)||v<(s.minimum??-Infinity)||v>(s.maximum??Infinity))errors.push(p+': invalid number');}
  }
  walk(parsed,schema,'');if(errors.length)return {ok:false,errors:errors.slice(0,60)};
  // The bundled schema establishes the complete world shape before semantic checks.
  const d=parsed as LWContentPorts.World;
  const tables=C.tables;
  for(const k of ['nodes','buildings','sites'] as const)if(new Set(d[k].map(v=>v.id)).size!==d[k].length)errors.push('/'+k+': duplicate IDs');
  // Existing kinds remain stable: new visual/gameplay kinds need an engine implementation.
  for(const n of defaults.nodes)if(!d.nodes.some(x=>x.id===n.id))errors.push('/nodes: missing '+n.id);
  for(const n of d.nodes){if(!defaults.nodes.some(x=>x.id===n.id))errors.push('/nodes/'+n.id+': unsupported node kind');if(n.resource&&!own(tables.RES,n.resource))errors.push('/nodes/'+n.id+': unknown item');if(n.skill&&!own(tables.SKILLS,n.skill))errors.push('/nodes/'+n.id+': unknown skill');if(n.direct&&!n.resource)errors.push('/nodes/'+n.id+': direct gathering needs an item');}
  for(const b of d.buildings){if(!own(tables.BUILDINGS,b.id))errors.push('/buildings/'+b.id+': unknown building');if(b.requiresNode&&!d.nodes.some(x=>x.id===b.requiresNode))errors.push('/buildings/'+b.id+': unknown required node');const p=b.production;if(p){if(!own(tables.RES,p.output)||!own(tables.SKILLS,p.skill))errors.push('/buildings/'+b.id+': unknown production reference');for(const id of Object.keys(p.cost))if(!own(tables.RES,id))errors.push('/buildings/'+b.id+': unknown ingredient');if(Object.values(p.cost).reduce((a,b)=>a+b,0)>b.inputCapacity||p.amount>b.outputCapacity)errors.push('/buildings/'+b.id+': a batch does not fit the inventory');}}
  for(const r of Object.values(tables.RECIPES)){const p=d.buildings.find(b=>b.id===r.station);if(!p||p.outputCapacity<r.amount+1||p.inputCapacity<Object.values(r.cost).reduce((a,b)=>a+b,0))errors.push('/buildings/'+r.station+': recipe batch requires larger buffers');}
  // Reject unsatisfiable recipe loops before they can enter the autonomous planner.
  const graph=new Map<string,Set<string>>();const edge=(id:string,cost:LWContentPorts.QuantityMap)=>{if(!graph.has(id))graph.set(id,new Set());for(const k of Object.keys(cost))graph.get(id)!.add(k);};
  for(const [id,r]of Object.entries(tables.RECIPES))edge(id,r.cost);
  for(const b of d.buildings)if(b.production)edge(b.production.output,b.production.cost);
  const visiting=new Set<string>(),done=new Set<string>();function visit(id:string){if(visiting.has(id)){errors.push('/buildings: production dependency cycle at '+id);return;}if(done.has(id))return;visiting.add(id);for(const k of graph.get(id)||[])visit(k);visiting.delete(id);done.add(id);}for(const id of graph.keys())visit(id);
  for(const g of root.LWAdventure?.content.equipment||[]){const p=d.buildings.find(b=>b.id===g.recipe.station);if(!p||p.outputCapacity<1||p.inputCapacity<Object.values(g.recipe.cost).reduce((a,b)=>a+b,0))errors.push('/buildings/'+g.recipe.station+': equipment recipe does not fit');}
  const occupied=new Set();for(const s of d.sites){if(!d.nodes.some(n=>n.id===s.kind))errors.push('/sites/'+s.id+': unknown node');const pos=s.x+','+s.y;if(occupied.has(pos))errors.push('/sites/'+s.id+': duplicate tile');occupied.add(pos);}
  if(root.LW?.WorldSystem?.siteIssues)errors.push(...root.LW.WorldSystem.siteIssues(d));
  return {ok:!errors.length,errors,content:d};
 }
 const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const identified=(v:unknown):v is {id:unknown}=>record(v)&&!!v.id;
 function diff(a:unknown,b:unknown,p=''):LWContentPorts.Change[]{const out:LWContentPorts.Change[]=[];if(JSON.stringify(a)===JSON.stringify(b))return out;if(record(a)&&record(b)){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))out.push(...diff(a[k],b[k],p+'/'+k));}else if(Array.isArray(a)&&Array.isArray(b)&&a.every(identified)&&b.every(identified)){for(const id of new Set([...a.map(x=>x.id),...b.map(x=>x.id)]))out.push(...diff(a.find(x=>x.id===id),b.find(x=>x.id===id),p+'/'+id));if(a.map(x=>x.id).join()!==b.map(x=>x.id).join())out.push({path:p+'/$order',before:a.map(x=>x.id),after:b.map(x=>x.id)});}else out.push({path:p||'/',before:a===undefined?null:a,after:b===undefined?null:b});return out;}
 function replace(input:unknown){const r=validate(input);if(!r.ok)throw Error(r.errors.join('\n'));content=clone(r.content);return content;}
 function withLibrary<T>(input:unknown,fn:()=>T):T{const prior=content;try{replace(input);const result=fn();if(result&&['object','function'].includes(typeof result)&&typeof (result as {then?:unknown}).then==='function')throw Error('World library sandbox callback must be synchronous.');return result;}finally{content=prior;}}
 const api:LWContentPorts.WorldApi={defaults:clone(defaults),schema,clone,validate,replace,withLibrary,diff,hashOf:hash,get content(){return content;},get hash(){return hash(content);},node:id=>content.nodes.find(n=>n.id===id),building:id=>content.buildings.find(b=>b.id===id)};
 if(node)module.exports=api;root.LWWorldContent=api;
})(typeof globalThis!=='undefined'?globalThis:this);
