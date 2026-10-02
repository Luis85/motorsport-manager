/* V10 content contract. JSON describes rules and permitted handlers; it never executes code. */
(function(root){'use strict';
 const node=typeof module!=='undefined'&&module.exports,C=root.LWContent;
 const defaults=node?require('./content/growth-library.json'):root.LWDefaultGrowth;
 const schema=node?require('./content/growth.schema.json'):root.LWGrowthSchema;
 const clone=C.copy;let active=clone(defaults);
 function shape(v,s,path,errors){
  if(s.anyOf){if(!s.anyOf.some(t=>{const e=[];shape(v,t,path,e);return !e.length;}))errors.push(path+': wrong value type');return;}
  if(s.const!==undefined&&v!==s.const)errors.push(path+': unexpected constant');
  if(s.enum&&!s.enum.includes(v))errors.push(path+': choose a supported value');
  if(s.type==='object'){if(!v||typeof v!=='object'||Array.isArray(v)){errors.push(path+': expected object');return;}if(Object.keys(v).length<(s.minProperties??0)||Object.keys(v).length>(s.maxProperties??10000))errors.push(path+': invalid property count');for(const k of s.required||[])if(!Object.hasOwn(v,k))errors.push(path+'/'+k+': required');for(const[k,x]of Object.entries(v)){const sub=s.properties?.[k]||(s.additionalProperties??true);if(sub===false||sub===undefined)errors.push(path+'/'+k+': unknown field');else if(typeof sub==='object')shape(x,sub,path+'/'+k,errors);}}
  if(s.type==='array'){if(!Array.isArray(v)){errors.push(path+': expected list');return;}if(v.length<(s.minItems??0))errors.push(path+': too few entries');if(s.uniqueItems&&new Set(v.map(x=>C.stable(x))).size!==v.length)errors.push(path+': duplicate entries');if(v.length>(s.maxItems??10000))errors.push(path+': too many entries');v.forEach((x,i)=>shape(x,s.items,path+'/'+i,errors));}
  if(s.type==='string'&&(typeof v!=='string'||v.length>(s.maxLength??10000)||typeof v==='string'&&v.length<(s.minLength??0)||s.pattern&&!new RegExp(s.pattern).test(v)))errors.push(path+': invalid text');
  if(['integer','number'].includes(s.type)&&(typeof v!=='number'||!Number.isFinite(v)||s.type==='integer'&&!Number.isInteger(v)||v<s.minimum||v>s.maximum))errors.push(path+': outside permitted bounds');
  if(s.type==='boolean'&&typeof v!=='boolean'||s.type==='null'&&v!==null)errors.push(path+': invalid type');
 }
 function validate(input){let p;const errors=[];try{p=root.LWAdventure.parse(input);shape(p,schema,'',errors);if(errors.length)return{ok:false,errors};
  const lastLand=p.rules.maxIslands-2;
  if(!Number.isSafeInteger(Math.ceil(p.rules.landCoinsBase*Math.pow(p.rules.landGrowth,lastLand)))||!Number.isSafeInteger(Math.ceil(p.rules.landPrestigeBase*Math.pow(p.rules.landGrowth,lastLand))))errors.push('/rules: configured island prices exceed safe integer precision');
  const regions=p.cartography.biomes;
  if(new Set(regions.map(b=>b.id)).size!==4)errors.push('/cartography/biomes: each supported biome must appear exactly once');
  for(const b of regions)for(const id of b.questIds)if(!root.LWAdventure.content.quests.some(q=>q.id===id))errors.push('/cartography/biomes/'+b.id+'/questIds: unknown quest '+id);
  if(!p.requirements.buildings.map_table||!p.research.some(r=>r.id===p.requirements.buildings.map_table.research&&r.unlocks.includes('buildings:map_table')))errors.push('/requirements/buildings/map_table: map table must have its own research definition');
  const sets={};for(const key of ['features','research','interactions','events','shop']){const ids=p[key].map(d=>d.id);sets[key]=new Set(ids);if(ids.length!==sets[key].size)errors.push('/'+key+': duplicate IDs');}
  if(p.rules.initialSlots>p.rules.maxSlots||p.rules.maxSlots>root.LWAdventure.content.rules.maxCreatures)errors.push('/rules/maxSlots: must fit adventure maxCreatures and initialSlots');
  const tables={buildings:C.tables.BUILDINGS,recipes:C.tables.RECIPES,skills:C.tables.SKILLS,items:Object.fromEntries([...Object.keys(C.tables.RES),...root.LWAdventure.content.equipment.map(g=>g.id),'wooden_chest'].map(k=>[k,true])),features:{land:1,quests:1,trade:1,recruitment:1,'prestige-shop':1}};
  const feats=(m,path)=>{for(const[k,n]of Object.entries(m))if(!sets.features.has(k)||n>(p.features.find(f=>f.id===k)?.maxRank||0))errors.push(path+': unknown feature rank '+k);};
  for(const[category,map]of Object.entries(p.requirements))for(const[id,r]of Object.entries(map)){if(!Object.hasOwn(tables[category],id))errors.push('/requirements/'+category+': unknown '+id);feats(r.features,id);if(r.research&&!sets.research.has(r.research))errors.push(id+': unknown research');}
  for(const[id,h]of Object.entries(p.homes))if(!['shelter','cottage'].includes(id))errors.push('/homes: unsupported home '+id);
  for(const r of p.research){feats(r.requires,r.id);if(r.grants){feats({[r.grants.feature]:r.grants.rank},r.id);if((r.requires[r.grants.feature]||0)>=r.grants.rank)errors.push(r.id+': self-dependent feature rank');}for(const u of r.unlocks){const [cat,id]=u.split(':');if(!Object.hasOwn(tables[cat]||{},id))errors.push(r.id+': unknown unlock '+u);}}
  const reachable={},pending=p.research.filter(r=>r.grants);let changed=true;while(changed){changed=false;for(const r of pending)if(Object.entries(r.requires).every(([k,n])=>(reachable[k]||0)>=n)&&(reachable[r.grants.feature]||0)<r.grants.rank){reachable[r.grants.feature]=r.grants.rank;changed=true;}}
  for(const r of p.research)if(!Object.entries(r.requires).every(([k,n])=>(reachable[k]||0)>=n))errors.push(r.id+': unreachable research dependencies');
  for(const e of p.events)if(!sets.interactions.has(e.interaction)||!p.interactions.find(i=>i.id===e.interaction)?.eventOnly)errors.push(e.id+': event must reference an event-only interaction');
  for(const i of p.interactions){if(i.handler==='care'){if(!i.action)errors.push(i.id+': missing care action');if(Object.keys(i.cost).length||Object.keys(i.effects).length||i.cooldown!==0)errors.push(i.id+': care delegates native costs, effects and cooldown; use the moment handler for configurable effects');}for(const id of Object.keys(i.cost))if(!Object.hasOwn(tables.items,id))errors.push(i.id+': unknown cost item '+id);}
  for(const s of p.shop)for(const id of Object.keys(s.items))if(!Object.hasOwn(tables.items,id))errors.push(s.id+': unknown shop item '+id);
 }catch(e){errors.push(e.message);}return{ok:errors.length===0,errors,content:p};}
 // Base fingerprint hashes a library envelope, so wrap the entire Growth document.
 // Do not pass Growth directly: its fields are outside Base's components projection.
 const hash=p=>C.fingerprint({schemaVersion:1,library:{id:'littlewild-growth',version:1},components:p});
 function mechanicalHash(p){p=clone(p);const strip=v=>Array.isArray(v)?v.map(strip):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['name','label','description','icon','extensions'].includes(k)).map(([k,x])=>[k,strip(x)])):v;return hash(strip(p));}
 function replace(p){const v=validate(p);if(!v.ok)throw Error(v.errors.join('\n'));active=clone(v.content);return active;}
 function withLibrary(p,fn){const old=active;try{replace(p);const result=fn();if(result&&['object','function'].includes(typeof result)&&typeof result.then==='function')throw Error('Growth library sandbox callback must be synchronous.');return result;}finally{active=old;}}
 const api={defaults,schema,clone,validate,replace,withLibrary,mechanicalHash,hashOf:hash,get content(){return active;},get hash(){return hash(active);}};
 root.LWGrowth=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
