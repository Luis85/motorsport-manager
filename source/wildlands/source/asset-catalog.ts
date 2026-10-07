/// <reference path="./content-provider-contracts.d.ts" />
/* Validated visual data catalog. Scenario scopes install JSON definitions atomically. */
(function(inputRoot:unknown){
 'use strict';
 type Plain=Record<string,unknown>;
 type Category='building'|'item'|'actor'|'pet';
 interface Definition {
  readonly format:'littlewild-3d-asset';readonly schemaVersion:1;
  readonly category:Category;readonly id:string;readonly name:string;
  readonly materials:Readonly<Plain>;
  readonly models:Readonly<Record<string,Readonly<{nodes:readonly unknown[]}>>>;
  readonly metadata:Readonly<Plain>;readonly behaviors?:Readonly<Plain>;readonly rig?:unknown;
  readonly meshes?:Readonly<Record<string,Readonly<MeshData>>>;
 }
 /** Baked indexed triangles, e.g. compiled from a Scene Forge recipe. Coordinates are model-local meters. */
 interface MeshData {readonly positions:readonly number[];readonly normals?:readonly number[];readonly indices?:readonly number[];}
 interface Api {
  readonly revision:number;
  readonly defaults:readonly Definition[];
  replace(input:unknown):void;
  withDefinitions<T>(input:unknown,work:()=>T):T;
  all():readonly Definition[];
  get(category:Category,id:string):Definition|null;
  building(id:string):Definition|null;item(id:string):Definition|null;actor(id:string):Definition|null;pet(id:string):Definition|null;
  hasModel(category:Category,id:string,name:string):boolean;
  validate(input:unknown):Definition;
 }
 interface Root {LWContentProvider?:LWContentProvider.Api;LWAssets?:Api;}
 const root=inputRoot as Root;
 const categories=new Set<string>(['building','item','actor','pet']);
 const primitives=new Set<string>(['group','box','ball','soft','tiny','cone','cylinder','ring','roof','ground','mesh']);
 /** Fixed presentation roles a pet renderer may animate; data names nodes, code owns motion. */
 const petRigRoles=new Set<string>(['body','head','eyes','ears','tail','arms','feet','mouth','cheeks','sprout','shell','hat','face','neck','back']);
 const MESH_VERTICES=8192,MESH_TRIANGLES=16384,DEFINITION_VERTICES=40000;
 const safeId=/^[a-z0-9][a-z0-9_-]{0,79}$/;
 const safeRole=/^[A-Za-z][A-Za-z0-9_-]{0,79}$/;
 const color=(value:unknown):value is string=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
 const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
 const vec=(value:unknown,n=3):boolean=>Array.isArray(value)&&value.length===n&&value.every(finite);
 const plain=(value:unknown):value is Plain=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
 const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
 function deepFreeze<T>(value:T):T{
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);return value;
 }
 function fail(message:string):never{throw Error('3D asset: '+message);}
 const record=(value:unknown,path:string):Plain=>plain(value)?value:fail(path+' must be an object');
 const list=(value:unknown,path:string):unknown[]=>Array.isArray(value)?value:fail(path+' must be a list');
 function dataOnly(value:unknown):void{
  const ancestors=new Set<object>(),forbidden=new Set(['__proto__','constructor','prototype','script','callback','execute','eval','sourceCode','modulePath','handler','command']);let count=0;
  function visit(entry:unknown,depth:number):void{
   if(++count>400000||depth>32)fail('definition exceeds supported complexity');
   if(entry===null||typeof entry==='boolean'||typeof entry==='string'||finite(entry))return;
   if(!Array.isArray(entry)&&!plain(entry))fail('definition must contain only JSON data');
   const object=entry as object,array=Array.isArray(entry);
   if(ancestors.has(object)||Object.getOwnPropertySymbols(object).length)fail('definition must contain only JSON data');
   ancestors.add(object);
   // Own string keys in property order (symbols were rejected above); each descriptor is read
   // without invoking accessors, exactly as a full descriptor snapshot would be.
   const keys=Object.getOwnPropertyNames(object);
   if(array){
    if(keys.length!==entry.length+1)fail('arrays must be dense JSON lists');
    for(let i=0;i<entry.length;i++)if(!Object.hasOwn(object,String(i)))fail('arrays must contain every own numeric index');
   }
   for(const key of keys){
    if(array&&key==='length')continue;
    const descriptor=Object.getOwnPropertyDescriptor(object,key);
    if(!descriptor||forbidden.has(key)||!descriptor.enumerable||descriptor.get||descriptor.set)fail('invalid data field '+key);
    visit(descriptor.value,depth+1);
   }
   ancestors.delete(object);
  }
  visit(value,0);
 }
 function fields(value:unknown,allowed:readonly string[],path:string):Plain{
  const out=record(value,path);
  if(Object.keys(out).some(key=>!allowed.includes(key)))fail(path+' has unknown fields');
  return out;
 }
 function materialProps(input:unknown,path:string,requiredColor=false):void{
  const value=fields(input,['color','emissive','emissiveIntensity','opacity','transparent','depthWrite','roughness','metalness','flatShading','doubleSided'],path);
  if(requiredColor&&!color(value.color))fail(path+' invalid color');
  for(const key of ['color','emissive'])if(value[key]!==undefined&&!color(value[key]))fail(path+' invalid '+key);
  for(const key of ['transparent','depthWrite','flatShading','doubleSided'])if(value[key]!==undefined&&typeof value[key]!=='boolean')fail(path+' invalid '+key);
  for(const key of ['opacity','roughness','metalness']){const amount=value[key];if(amount!==undefined&&(!finite(amount)||amount<0||amount>1))fail(path+' invalid '+key);}
  const emissive=value.emissiveIntensity;
  if(emissive!==undefined&&(!finite(emissive)||emissive<0))fail(path+' invalid emissive intensity');
 }
 function meshData(input:unknown,path:string):number{
  const mesh=fields(input,['positions','normals','indices'],path),positions=list(mesh.positions,path+' positions');
  const vertices=positions.length/3;
  if(!Number.isInteger(vertices)||vertices<3||vertices>MESH_VERTICES||!positions.every(value=>finite(value)&&Math.abs(value)<=1e4))fail(path+' invalid positions');
  if(mesh.normals!==undefined){const normals=list(mesh.normals,path+' normals');if(normals.length!==positions.length||!normals.every(value=>finite(value)&&Math.abs(value)<=1.001))fail(path+' invalid normals');}
  const triangles=(mesh.indices===undefined?vertices:list(mesh.indices,path+' indices').length)/3;
  if(!Number.isInteger(triangles)||triangles<1||triangles>MESH_TRIANGLES)fail(path+' invalid triangle count');
  if(mesh.indices!==undefined&&!(mesh.indices as unknown[]).every(value=>Number.isInteger(value)&&(value as number)>=0&&(value as number)<vertices))fail(path+' invalid indices');
  return vertices;
 }
 function nodeIds(input:unknown,materials:Plain,seen:Set<string>,path:string,meshes:Plain={}):void{
  for(const entry of list(input,path+' nodes')){
   const node=fields(entry,['primitive','id','position','rotation','scale','material','materialProps','visible','castShadow','receiveShadow','children','mesh'],path);
   if(typeof node.primitive!=='string'||!primitives.has(node.primitive))fail(path+' invalid node');
   if(node.primitive==='mesh'?typeof node.mesh!=='string'||!Object.hasOwn(meshes,node.mesh):node.mesh!==undefined)fail(path+' invalid mesh reference');
   if(node.id!==undefined){if(typeof node.id!=='string'||!safeId.test(node.id)||seen.has(node.id))fail(path+' invalid/duplicate node id');seen.add(node.id);}
   for(const key of ['position','rotation','scale'])if(node[key]!==undefined&&!vec(node[key]))fail(path+' invalid '+key);
   for(const key of ['visible','castShadow','receiveShadow'])if(node[key]!==undefined&&typeof node[key]!=='boolean')fail(path+' invalid '+key);
   if(node.materialProps!==undefined)materialProps(node.materialProps,path+' material properties');
   if(node.primitive!=='group'&&(typeof node.material!=='string'||(!Object.hasOwn(materials,node.material)&&!/^#[0-9a-f]{6}$/i.test(node.material))))fail(path+' invalid material');
   if(node.children!==undefined)nodeIds(node.children,materials,seen,path+'/'+(node.id||node.primitive),meshes);
  }
 }
 function reference(value:unknown,ids:ReadonlySet<string>):boolean{return typeof value==='string'&&ids.has(value);}
 function validateShape(input:unknown):asserts input is Definition{
  const raw=fields(input,['format','schemaVersion','category','id','name','materials','models','metadata','behaviors','rig','meshes'],'asset');
  if(raw.format!=='littlewild-3d-asset'||raw.schemaVersion!==1||typeof raw.category!=='string'||!categories.has(raw.category)||typeof raw.id!=='string'||!safeId.test(raw.id)||typeof raw.name!=='string'||[...raw.name].length<1||[...raw.name].length>120)fail('invalid identity');
  const id=raw.id,materials=record(raw.materials,id+' materials'),models=record(raw.models,id+' models');
  if(!Object.keys(models).length)fail(id+' missing materials/models');
  for(const [key,value] of Object.entries(materials)){
   if(!safeRole.test(key)||!(color(value)||plain(value)))fail(id+' invalid material '+key);
   if(plain(value))materialProps(value,id+' material '+key,true);
  }
  const meshes=raw.meshes===undefined?{}:record(raw.meshes,id+' meshes');let vertices=0;
  for(const [key,mesh] of Object.entries(meshes)){if(!safeId.test(key))fail(id+' invalid mesh '+key);vertices+=meshData(mesh,id+' mesh '+key);}
  if(vertices>DEFINITION_VERTICES)fail(id+' meshes exceed '+DEFINITION_VERTICES+' vertices');
  const metadata=record(raw.metadata,id+' metadata');
  for(const key of ['radius','hitHeight','worldHitHeight']){const value=metadata[key];if(value!==undefined&&(!finite(value)||value<=0))fail(id+' invalid metadata '+key);}
  const modelNodes=new Map<string,Set<string>>();
  for(const [name,inputModel] of Object.entries(models)){
   if(!safeId.test(name))fail(id+' invalid model '+name);
   const model=fields(inputModel,['nodes'],id+'/'+name),ids=new Set<string>();
   const nodes=list(model.nodes,id+'/'+name+' nodes');
   nodeIds(nodes,materials,ids,id+'/'+name,meshes);modelNodes.set(name,ids);
  }
  const ids=modelNodes.get('world')||new Set<string>(),behavior=raw.behaviors===undefined?{}:record(raw.behaviors,id+' behaviors');
  if(raw.category==='pet')validatePetRig(raw.rig,modelNodes,id);
  else if(raw.category!=='actor'&&raw.rig!==undefined)fail(id+' rig is only supported for actors and pets');
  if(raw.category!=='actor')fields(behavior,['door','rotors','smoke'],id+' behaviors');
  if(behavior.door!==undefined){const door=record(behavior.door,id+' door');if(!reference(door.node,ids)||!finite(door.openDelta))fail(id+' invalid door node/angle');}
  if(behavior.rotors!==undefined)for(const inputRotor of list(behavior.rotors,id+' rotors')){
   const rotor=record(inputRotor,id+' rotor');
   if(!reference(rotor.node,ids)||typeof rotor.axis!=='string'||!['x','y','z'].includes(rotor.axis)||!finite(rotor.speed))fail(id+' invalid rotor');
  }
  if(raw.category==='building'&&!models.world)fail(id+' building needs world model');
  if(behavior.smoke!==undefined){const smoke=record(behavior.smoke,id+' smoke');if(!vec(smoke.position)||typeof smoke.always!=='boolean')fail(id+' invalid smoke behavior');}
  if(raw.category==='actor')validateActor(raw,behavior,models,materials,modelNodes,id);
 }
 /** Detached immutable validation; this never registers or replaces an active asset. */
 function validate(input:unknown):Definition{
  dataOnly(input);return checkedDefinition(input);
 }
 /** The complete input tree has already passed descriptor and complexity checks. */
 function checkedDefinition(input:unknown):Definition{
  validateShape(input);
  return deepFreeze(copy(input));
 }
 /** Pet rigs name animated nodes per model variant, so a stage may omit roles it does not have. */
 function validatePetRig(input:unknown,modelNodes:ReadonlyMap<string,ReadonlySet<string>>,id:string):void{
  if(input===undefined)return;
  for(const [model,inputRoles] of Object.entries(record(input,id+' rig'))){
   const nodes=modelNodes.get(model);if(!nodes)fail(id+' rig references unknown model '+model);
   for(const [role,value] of Object.entries(record(inputRoles,id+' rig '+model))){
    const references=Array.isArray(value)?value:[value];
    if(!petRigRoles.has(role)||!references.length||references.length>8||references.some(node=>!reference(node,nodes)))fail(id+' invalid pet rig '+model+'/'+role);
   }
  }
 }
 function validateActor(raw:Plain,behavior:Plain,models:Plain,materials:Plain,modelNodes:ReadonlyMap<string,ReadonlySet<string>>,id:string):void{
  const actorBehaviorKeys=['sockets','animation','expression','appearances'],rigKeys=['body','torso','bib','head','ears','tail','feet','arms','eyes','brows','mouth','carry','care','snack','cup'],socketKeys=['head','body','back','feet','tool','charm','carry'];
  if(!models.world||!plain(raw.rig)||!plain(behavior.sockets)||!plain(behavior.animation)||!plain(behavior.expression)||!plain(behavior.appearances)||!Object.keys(behavior.appearances).length)fail(id+' actor needs world model, rig, sockets, animation, expression and appearances');
  const rig=raw.rig,sockets=behavior.sockets,animation=behavior.animation,expression=behavior.expression,appearances=behavior.appearances;
  if(Object.keys(behavior).length!==actorBehaviorKeys.length||actorBehaviorKeys.some(key=>!Object.hasOwn(behavior,key)))fail(id+' invalid actor behavior contract');
  if(Object.keys(rig).length!==rigKeys.length||rigKeys.some(key=>!Object.hasOwn(rig,key)))fail(id+' invalid actor rig contract');
  if(Object.keys(sockets).length!==socketKeys.length||socketKeys.some(key=>!Object.hasOwn(sockets,key)))fail(id+' invalid actor socket contract');
  const references:unknown[]=[],pairKeys=['ears','feet','arms','eyes','brows'];
  for(const [key,value] of Object.entries(rig))if(pairKeys.includes(key)?!Array.isArray(value)||value.length!==2:typeof value!=='string')fail(id+' invalid rig shape '+key);
  for(const [key,value] of Object.entries(sockets))if(key==='feet'?!Array.isArray(value)||value.length!==2:typeof value!=='string')fail(id+' invalid socket shape '+key);
  for(const value of [...Object.values(rig),...Object.values(sockets)])Array.isArray(value)?references.push(...value):references.push(value);
  for(const [modelName,modelIds] of modelNodes)if(modelName==='world'||modelName.startsWith('world-')){
   for(const node of references)if(!reference(node,modelIds))fail(id+' invalid rig/socket node '+String(node)+' in '+modelName);
  }
  const animationKeys=['bodyBob','breath','earSway','tailSway','footLift','footStride','walkArmSwing','workArmBase','workArmSwing','blinkThreshold','idleHeadYaw','idleHeadRoll'];
  if(Object.keys(animation).length!==animationKeys.length||animationKeys.some(key=>!Object.hasOwn(animation,key)||!finite(animation[key])))fail(id+' invalid animation tuning');
  const blink=animation.blinkThreshold,work=animation.workArmBase;
  if(!finite(blink)||!finite(work)||blink<.8||blink>=1||Math.abs(work)>2)fail(id+' animation tuning outside bounds');
  const expressionKeys=['angerAt','tiredEnergyBelow','concernFoodBelow','concernWaterBelow','happyJoyAbove'];
  if(Object.keys(expression).length!==expressionKeys.length||expressionKeys.some(key=>{const value=expression[key];return !Object.hasOwn(expression,key)||!finite(value)||value<0||value>100;}))fail(id+' invalid expression tuning');
  for(const [profile,inputAppearance] of Object.entries(appearances)){
   const appearance=record(inputAppearance,id+' appearance '+profile),appearanceKeys=['model','scale','labelHeight','contextHeight','bubbleHeight','materials'];
   const label=appearance.labelHeight,context=appearance.contextHeight,bubble=appearance.bubbleHeight,model=appearance.model;
   if(!safeId.test(profile)||Object.keys(appearance).length!==appearanceKeys.length||appearanceKeys.some(key=>!Object.hasOwn(appearance,key))||typeof model!=='string'||!modelNodes.has(model)||!vec(appearance.scale)||!finite(label)||label<.5||label>3||!finite(context)||context<.2||context>2||!finite(bubble)||bubble<.5||bubble>3||!plain(appearance.materials))fail(id+' invalid appearance '+profile);
   const appearanceIds=modelNodes.get(model);
   if(!appearanceIds)fail(id+' invalid appearance '+profile);
   for(const node of references)if(!reference(node,appearanceIds))fail(id+' invalid appearance rig/socket node '+String(node)+' in '+model);
   for(const [role,value] of Object.entries(appearance.materials))if(!Object.hasOwn(materials,role)||!color(value))fail(id+' invalid appearance material '+profile+'/'+role);
  }
 }
 /**
  * Prepared catalogs by exact JSON text. A prepared catalog is immutable (frozen definitions, a
  * private index and a content revision), and its validation reads nothing but its input, so an
  * input whose JSON-only check passed and whose serialized text equals an earlier accepted input
  * reuses that result. Rejected inputs are never remembered.
  */
 const PREPARED_ENTRIES=8,prepared=new Map<string,Active>();
 function prepare(input:unknown):Active{
  dataOnly(input);
  const text=JSON.stringify(input),known=prepared.get(text);
  if(known){prepared.delete(text);prepared.set(text,known);return known;}
  const result=prepareChecked(input);
  prepared.set(text,result);
  for(const key of prepared.keys()){if(prepared.size<=PREPARED_ENTRIES)break;prepared.delete(key);}
  return result;
 }
 function prepareChecked(input:unknown):{defs:readonly Definition[];index:Map<string,Definition>;revision:number}{
  const entries=list(input,'asset definitions');if(!entries.length||entries.length>256)fail('expected 1–256 definitions');
  const defs=Object.freeze(entries.map(checkedDefinition)),index=new Map<string,Definition>();
  for(const asset of defs){const key=asset.category+':'+asset.id;if(index.has(key))fail('duplicate '+key);index.set(key,asset);}
  const revision=defs.reduce((hash,asset)=>{for(const ch of JSON.stringify(asset))hash=(hash*33+ch.charCodeAt(0))>>>0;return hash;},5381);
  return {defs,index,revision};
 }
 type Active=ReturnType<typeof prepareChecked>;
 let installed:Active|null=null,active:Active|null=null;
 /**
  * The installed game's asset definitions. A game without a bundled catalog (a standalone pet
  * admits its own definitions through validate()) starts empty; a declared list must be a valid
  * 1–256 catalog. Colony profiles always declare LWAssetDefinitions (tools/artifact-profiles.cts
  * enforces it). The provider is read as a global: this catalog depends on no executable module.
  */
 function load():Active{
  if(installed)return installed;
  const provider=root.LWContentProvider;if(!provider)return fail('content provider is not loaded');
  const raw=provider.get('asset definitions').assets;
  if(raw!==undefined&&!Array.isArray(raw))fail('bundled definition list is missing');
  const first=raw===undefined?{defs:Object.freeze([]) as readonly Definition[],index:new Map<string,Definition>(),revision:5381}:prepare(raw);
  if(active===null)active=first;
  return installed=first;
 }
 const current=():Active=>{load();return active!;};
 function replace(input:unknown):void{active=prepare(input);}
 function withDefinitions<T>(input:unknown,work:()=>T):T{
  const previous=current();try{replace(input);const result=work();if(result&&typeof (result as {then?:unknown}).then==='function')throw Error('Asset scope must be synchronous.');return result;}finally{active=previous;}
 }
 const api:Api=Object.freeze({
  get revision(){return current().revision;},get defaults(){return load().defs;},validate,replace,withDefinitions,all:()=>current().defs,
  get:(category:Category,id:string)=>current().index.get(category+':'+id)||null,
  building:(id:string)=>current().index.get('building:'+id)||null,
  item:(id:string)=>current().index.get('item:'+id)||null,
  actor:(id:string)=>current().index.get('actor:'+id)||null,
  pet:(id:string)=>current().index.get('pet:'+id)||null,
  hasModel:(category:Category,id:string,name:string)=>!!current().index.get(category+':'+id)?.models[name]
 });
 root.LWContentProvider?.whenInstalled(()=>{load();});
 root.LWAssets=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
