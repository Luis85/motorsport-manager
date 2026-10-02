/* Immutable catalog for bundled visual assets. Scenario/import JSON cannot register assets. */
(function(root){'use strict';
 const categories=new Set(['building','item','actor']);
 const primitives=new Set(['group','box','ball','soft','tiny','cone','cylinder','ring','roof','ground']);
 const safeId=/^[a-z0-9][a-z0-9_-]{0,79}$/;
 const safeRole=/^[A-Za-z][A-Za-z0-9_-]{0,79}$/;
 const vec=(v,n=3)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
 const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 const copy=v=>JSON.parse(JSON.stringify(v));
 function deepFreeze(v){if(!v||typeof v!=='object'||Object.isFrozen(v))return v;Object.freeze(v);for(const x of Object.values(v))deepFreeze(x);return v;}
 function fail(message){throw Error('3D asset: '+message);}
 function nodeIds(nodes,materials,seen,path){
  if(!Array.isArray(nodes))fail(path+' nodes must be an array');
  for(const n of nodes){if(!plain(n)||!primitives.has(n.primitive))fail(path+' invalid node');
   if(n.id!==undefined){if(typeof n.id!=='string'||!safeId.test(n.id)||seen.has(n.id))fail(path+' invalid/duplicate node id');seen.add(n.id);}
   if(n.position!==undefined&&!vec(n.position))fail(path+' invalid position');
   if(n.rotation!==undefined&&!vec(n.rotation))fail(path+' invalid rotation');
   if(n.scale!==undefined&&!vec(n.scale))fail(path+' invalid scale');
   if(n.primitive!=='group'&&(typeof n.material!=='string'||(!Object.hasOwn(materials,n.material)&&!/^#[0-9a-f]{6}$/i.test(n.material))))fail(path+' invalid material');
   if(n.children!==undefined)nodeIds(n.children,materials,seen,path+'/'+(n.id||n.primitive));
  }
 }
 function validate(raw){
  if(!plain(raw)||raw.format!=='littlewild-3d-asset'||raw.schemaVersion!==1||!categories.has(raw.category)||typeof raw.id!=='string'||!safeId.test(raw.id)||typeof raw.name!=='string'||raw.name.length<1||raw.name.length>120)fail('invalid identity');
  if(!plain(raw.materials)||!plain(raw.models)||!Object.keys(raw.models).length)fail(raw.id+' missing materials/models');
  for(const [key,value] of Object.entries(raw.materials)){if(!safeRole.test(key)||!(typeof value==='string'||plain(value)))fail(raw.id+' invalid material '+key);if(plain(value)&&(typeof value.color!=='string'||!/^#[0-9a-f]{6}$/i.test(value.color)))fail(raw.id+' invalid material color '+key);}
  const modelNodes=new Map();
  for(const [name,model] of Object.entries(raw.models)){if(!safeId.test(name)||!plain(model)||!Array.isArray(model.nodes))fail(raw.id+' invalid model '+name);const ids=new Set();nodeIds(model.nodes,raw.materials,ids,raw.id+'/'+name);modelNodes.set(name,ids);}
  const ids=modelNodes.get('world')||new Set();
  const behavior=raw.behaviors||{};
  if(!plain(behavior))fail(raw.id+' invalid behaviors');
  if(behavior.door&&(!plain(behavior.door)||!ids.has(behavior.door.node)))fail(raw.id+' invalid door node');
  for(const rotor of behavior.rotors||[])if(!plain(rotor)||!ids.has(rotor.node)||!['x','y','z'].includes(rotor.axis)||!Number.isFinite(rotor.speed))fail(raw.id+' invalid rotor');
  if(raw.category==='building'&&!raw.models.world)fail(raw.id+' building needs world model');
  if(behavior.smoke&&(!plain(behavior.smoke)||!vec(behavior.smoke.position)||typeof behavior.smoke.always!=='boolean') )fail(raw.id+' invalid smoke behavior');
  if(raw.category==='actor'){
   if(!raw.models.world||!plain(raw.rig)||!plain(behavior.sockets)||!plain(behavior.animation)||!plain(behavior.appearances)||!Object.keys(behavior.appearances).length)fail(raw.id+' actor needs world model, rig, sockets, animation and appearances');
   const references=[];
   for(const value of [...Object.values(raw.rig),...Object.values(behavior.sockets)])Array.isArray(value)?references.push(...value):references.push(value);
   for(const [modelName,modelIds] of modelNodes)if(modelName==='world'||modelName.startsWith('world-')){
    for(const id of references)if(typeof id!=='string'||!modelIds.has(id))fail(raw.id+' invalid rig/socket node '+id+' in '+modelName);
   }
   const animationKeys=['bodyBob','breath','earSway','tailSway','footLift','footStride','walkArmSwing','workArmBase','workArmSwing','blinkThreshold','idleHeadYaw','idleHeadRoll'];
   if(Object.keys(behavior.animation).length!==animationKeys.length||animationKeys.some(key=>!Object.hasOwn(behavior.animation,key)||!Number.isFinite(behavior.animation[key])))fail(raw.id+' invalid animation tuning');
   if(behavior.animation.blinkThreshold<.8||behavior.animation.blinkThreshold>=1||Math.abs(behavior.animation.workArmBase)>2)fail(raw.id+' animation tuning outside bounds');
   for(const [profile,appearance] of Object.entries(behavior.appearances)){
    const appearanceKeys=['model','scale','labelHeight','contextHeight','bubbleHeight','materials'];
    if(!safeId.test(profile)||!plain(appearance)||Object.keys(appearance).length!==appearanceKeys.length||appearanceKeys.some(key=>!Object.hasOwn(appearance,key))||typeof appearance.model!=='string'||!modelNodes.has(appearance.model)||!vec(appearance.scale)||!Number.isFinite(appearance.labelHeight)||appearance.labelHeight<.5||appearance.labelHeight>3||!Number.isFinite(appearance.contextHeight)||appearance.contextHeight<.2||appearance.contextHeight>2||!Number.isFinite(appearance.bubbleHeight)||appearance.bubbleHeight<.5||appearance.bubbleHeight>3||!plain(appearance.materials))fail(raw.id+' invalid appearance '+profile);
    for(const [role,value] of Object.entries(appearance.materials))if(!Object.hasOwn(raw.materials,role)||typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))fail(raw.id+' invalid appearance material '+profile+'/'+role);
   }
  }
  return deepFreeze(copy(raw));
 }
 const raw=root.LWAssetDefinitions;
 if(!Array.isArray(raw))fail('bundled definition list is missing');
 const defs=raw.map(validate),index=new Map();
 for(const a of defs){const key=a.category+':'+a.id;if(index.has(key))fail('duplicate '+key);index.set(key,a);}
 const revision=defs.reduce((h,a)=>{for(const ch of JSON.stringify(a))h=(h*33+ch.charCodeAt(0))>>>0;return h;},5381);
 const api=Object.freeze({
  revision,
  all:()=>defs,
  get:(category,id)=>index.get(category+':'+id)||null,
  building:id=>index.get('building:'+id)||null,
  item:id=>index.get('item:'+id)||null,
  actor:id=>index.get('actor:'+id)||null,
  hasModel:(category,id,name)=>!!index.get(category+':'+id)?.models?.[name]
 });
 root.LWAssets=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
