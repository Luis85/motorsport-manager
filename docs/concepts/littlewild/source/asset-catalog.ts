/* Immutable catalog for bundled visual assets. Scenario/import JSON cannot register assets. */
(function(root){'use strict';
 const categories=new Set(['building','item','actor']);
 const primitives=new Set(['group','box','ball','soft','tiny','cone','cylinder','ring','roof','ground']);
 const safeId=/^[a-z0-9][a-z0-9_-]{0,79}$/;
 const safeRole=/^[A-Za-z][A-Za-z0-9_-]{0,79}$/;
 const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
 const vec=(v,n=3)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
 const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 const copy=v=>JSON.parse(JSON.stringify(v));
 function deepFreeze(v){if(!v||typeof v!=='object'||Object.isFrozen(v))return v;Object.freeze(v);for(const x of Object.values(v))deepFreeze(x);return v;}
 function fail(message){throw Error('3D asset: '+message);}
 function dataOnly(value){
  const ancestors=new Set(),forbidden=new Set(['__proto__','constructor','prototype','script','callback','execute','eval','sourceCode','modulePath','handler','command']);let count=0;
  function visit(v,depth){
   if(++count>100000||depth>32)fail('definition exceeds supported complexity');
   if(v===null||typeof v==='boolean'||typeof v==='string'||Number.isFinite(v))return;
   if(!Array.isArray(v)&&!plain(v))fail('definition must contain only JSON data');
   if(ancestors.has(v)||Object.getOwnPropertySymbols(v).length)fail('definition must contain only JSON data');
   ancestors.add(v);
   const descriptors=Object.getOwnPropertyDescriptors(v);
   if(Array.isArray(v)&&Object.keys(descriptors).length!==v.length+1)fail('arrays must be dense JSON lists');
   for(const [key,descriptor] of Object.entries(descriptors)){
    if(Array.isArray(v)&&key==='length')continue;
    if(forbidden.has(key)||!descriptor.enumerable||descriptor.get||descriptor.set)fail('invalid data field '+key);
    visit(descriptor.value,depth+1);
   }
   ancestors.delete(v);
  }
  visit(value,0);
 }
 function fields(value,allowed,path){if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail(path+' has unknown fields');}
 function materialProps(value,path,requiredColor=false){
  fields(value,['color','emissive','emissiveIntensity','opacity','transparent','depthWrite','roughness','metalness'],path);
  if(requiredColor&&!color(value.color))fail(path+' invalid color');
  for(const key of ['color','emissive'])if(value[key]!==undefined&&!color(value[key]))fail(path+' invalid '+key);
  for(const key of ['transparent','depthWrite'])if(value[key]!==undefined&&typeof value[key]!=='boolean')fail(path+' invalid '+key);
  for(const key of ['opacity','roughness','metalness'])if(value[key]!==undefined&&(!Number.isFinite(value[key])||value[key]<0||value[key]>1))fail(path+' invalid '+key);
  if(value.emissiveIntensity!==undefined&&(!Number.isFinite(value.emissiveIntensity)||value.emissiveIntensity<0))fail(path+' invalid emissive intensity');
 }
 function nodeIds(nodes,materials,seen,path){
  if(!Array.isArray(nodes))fail(path+' nodes must be an array');
  for(const n of nodes){if(!plain(n)||!primitives.has(n.primitive))fail(path+' invalid node');
   fields(n,['primitive','id','position','rotation','scale','material','materialProps','visible','castShadow','receiveShadow','children'],path);
   if(n.id!==undefined){if(typeof n.id!=='string'||!safeId.test(n.id)||seen.has(n.id))fail(path+' invalid/duplicate node id');seen.add(n.id);}
   if(n.position!==undefined&&!vec(n.position))fail(path+' invalid position');
   if(n.rotation!==undefined&&!vec(n.rotation))fail(path+' invalid rotation');
   if(n.scale!==undefined&&!vec(n.scale))fail(path+' invalid scale');
   for(const key of ['visible','castShadow','receiveShadow'])if(n[key]!==undefined&&typeof n[key]!=='boolean')fail(path+' invalid '+key);
   if(n.materialProps!==undefined)materialProps(n.materialProps,path+' material properties');
   if(n.primitive!=='group'&&(typeof n.material!=='string'||(!Object.hasOwn(materials,n.material)&&!/^#[0-9a-f]{6}$/i.test(n.material))))fail(path+' invalid material');
   if(n.children!==undefined)nodeIds(n.children,materials,seen,path+'/'+(n.id||n.primitive));
  }
 }
 function validate(raw){
  dataOnly(raw);
  fields(raw,['format','schemaVersion','category','id','name','materials','models','metadata','behaviors','rig'],'asset');
  if(!plain(raw)||raw.format!=='littlewild-3d-asset'||raw.schemaVersion!==1||!categories.has(raw.category)||typeof raw.id!=='string'||!safeId.test(raw.id)||typeof raw.name!=='string'||raw.name.length<1||raw.name.length>120)fail('invalid identity');
  if(!plain(raw.materials)||!plain(raw.models)||!Object.keys(raw.models).length)fail(raw.id+' missing materials/models');
  for(const [key,value] of Object.entries(raw.materials)){if(!safeRole.test(key)||!(color(value)||plain(value)))fail(raw.id+' invalid material '+key);if(plain(value))materialProps(value,raw.id+' material '+key,true);}
  if(!plain(raw.metadata))fail(raw.id+' missing metadata');
  for(const key of ['radius','hitHeight','worldHitHeight'])if(raw.metadata[key]!==undefined&&(!Number.isFinite(raw.metadata[key])||raw.metadata[key]<=0))fail(raw.id+' invalid metadata '+key);
  const modelNodes=new Map();
  for(const [name,model] of Object.entries(raw.models)){if(!safeId.test(name)||!plain(model)||!Array.isArray(model.nodes))fail(raw.id+' invalid model '+name);fields(model,['nodes'],raw.id+'/'+name);const ids=new Set();nodeIds(model.nodes,raw.materials,ids,raw.id+'/'+name);modelNodes.set(name,ids);}
  const ids=modelNodes.get('world')||new Set();
  const behavior=raw.behaviors===undefined?{}:raw.behaviors;
  if(!plain(behavior))fail(raw.id+' invalid behaviors');
  if(raw.category!=='actor')fields(behavior,['door','rotors','smoke'],raw.id+' behaviors');
  if(behavior.door!==undefined&&(!plain(behavior.door)||!ids.has(behavior.door.node)||!Number.isFinite(behavior.door.openDelta)))fail(raw.id+' invalid door node/angle');
  if(behavior.rotors!==undefined&&!Array.isArray(behavior.rotors))fail(raw.id+' rotors must be a list');
  for(const rotor of behavior.rotors||[])if(!plain(rotor)||!ids.has(rotor.node)||!['x','y','z'].includes(rotor.axis)||!Number.isFinite(rotor.speed))fail(raw.id+' invalid rotor');
  if(raw.category==='building'&&!raw.models.world)fail(raw.id+' building needs world model');
  if(behavior.smoke!==undefined&&(!plain(behavior.smoke)||!vec(behavior.smoke.position)||typeof behavior.smoke.always!=='boolean') )fail(raw.id+' invalid smoke behavior');
  if(raw.category==='actor'){
   const actorBehaviorKeys=['sockets','animation','expression','appearances'],rigKeys=['body','torso','bib','head','ears','tail','feet','arms','eyes','brows','mouth','carry','care','snack','cup'],socketKeys=['head','body','back','feet','tool','charm','carry'];
   if(!raw.models.world||!plain(raw.rig)||!plain(behavior.sockets)||!plain(behavior.animation)||!plain(behavior.expression)||!plain(behavior.appearances)||!Object.keys(behavior.appearances).length)fail(raw.id+' actor needs world model, rig, sockets, animation, expression and appearances');
   if(Object.keys(behavior).length!==actorBehaviorKeys.length||actorBehaviorKeys.some(key=>!Object.hasOwn(behavior,key)))fail(raw.id+' invalid actor behavior contract');
   if(Object.keys(raw.rig).length!==rigKeys.length||rigKeys.some(key=>!Object.hasOwn(raw.rig,key)))fail(raw.id+' invalid actor rig contract');
   if(Object.keys(behavior.sockets).length!==socketKeys.length||socketKeys.some(key=>!Object.hasOwn(behavior.sockets,key)))fail(raw.id+' invalid actor socket contract');
   const references=[];
   const pairKeys=['ears','feet','arms','eyes','brows'];
   for(const [key,value] of Object.entries(raw.rig))if(pairKeys.includes(key)?!Array.isArray(value)||value.length!==2:typeof value!=='string')fail(raw.id+' invalid rig shape '+key);
   for(const [key,value] of Object.entries(behavior.sockets))if(key==='feet'?!Array.isArray(value)||value.length!==2:typeof value!=='string')fail(raw.id+' invalid socket shape '+key);
   for(const value of [...Object.values(raw.rig),...Object.values(behavior.sockets)])Array.isArray(value)?references.push(...value):references.push(value);
   for(const [modelName,modelIds] of modelNodes)if(modelName==='world'||modelName.startsWith('world-')){
    for(const id of references)if(typeof id!=='string'||!modelIds.has(id))fail(raw.id+' invalid rig/socket node '+id+' in '+modelName);
   }
   const animationKeys=['bodyBob','breath','earSway','tailSway','footLift','footStride','walkArmSwing','workArmBase','workArmSwing','blinkThreshold','idleHeadYaw','idleHeadRoll'];
   if(Object.keys(behavior.animation).length!==animationKeys.length||animationKeys.some(key=>!Object.hasOwn(behavior.animation,key)||!Number.isFinite(behavior.animation[key])))fail(raw.id+' invalid animation tuning');
   if(behavior.animation.blinkThreshold<.8||behavior.animation.blinkThreshold>=1||Math.abs(behavior.animation.workArmBase)>2)fail(raw.id+' animation tuning outside bounds');
   const expressionKeys=['angerAt','tiredEnergyBelow','concernFoodBelow','concernWaterBelow','happyJoyAbove'];
   if(Object.keys(behavior.expression).length!==expressionKeys.length||expressionKeys.some(key=>!Object.hasOwn(behavior.expression,key)||!Number.isFinite(behavior.expression[key])||behavior.expression[key]<0||behavior.expression[key]>100))fail(raw.id+' invalid expression tuning');
   for(const [profile,appearance] of Object.entries(behavior.appearances)){
    const appearanceKeys=['model','scale','labelHeight','contextHeight','bubbleHeight','materials'];
    if(!safeId.test(profile)||!plain(appearance)||Object.keys(appearance).length!==appearanceKeys.length||appearanceKeys.some(key=>!Object.hasOwn(appearance,key))||typeof appearance.model!=='string'||!modelNodes.has(appearance.model)||!vec(appearance.scale)||!Number.isFinite(appearance.labelHeight)||appearance.labelHeight<.5||appearance.labelHeight>3||!Number.isFinite(appearance.contextHeight)||appearance.contextHeight<.2||appearance.contextHeight>2||!Number.isFinite(appearance.bubbleHeight)||appearance.bubbleHeight<.5||appearance.bubbleHeight>3||!plain(appearance.materials))fail(raw.id+' invalid appearance '+profile);
    for(const id of references)if(!modelNodes.get(appearance.model).has(id))fail(raw.id+' invalid appearance rig/socket node '+id+' in '+appearance.model);
    for(const [role,value] of Object.entries(appearance.materials))if(!Object.hasOwn(raw.materials,role)||typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))fail(raw.id+' invalid appearance material '+profile+'/'+role);
   }
  }
  return deepFreeze(copy(raw));
 }
 const raw=root.LWAssetDefinitions;
 if(!Array.isArray(raw))fail('bundled definition list is missing');
 const defs=Object.freeze(raw.map(validate)),index=new Map();
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
