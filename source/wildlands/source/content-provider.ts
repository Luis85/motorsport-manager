/// <reference path="./content-provider-contracts.d.ts" />
/* Content-provider seam. The engine runs only with an installed game content profile; no engine
 * module loads game content itself. One profile per realm: browser artifacts adopt their injected
 * data globals when this module loads, Node entry points install explicitly before using content.
 * Sections stay opaque, detached-by-owner data: the consuming module validates what it owns. */
(function(inputRoot:unknown){
 'use strict';
 type Profile=LWContentProvider.Profile;
 type Plain=Record<string,unknown>;
 interface Root {
  LWContentProvider?:LWContentProvider.Api;LWProcessDefinition?:unknown;
  LWGameProfile?:unknown;LWDefaultBalancing?:unknown;LWContentSchema?:unknown;
  LWCreatureConfig?:unknown;LWCreatureDefinitions?:unknown;LWCreatureEditorFieldDefinitions?:unknown;
  LWAssetDefinitions?:unknown;LWScenarioPacks?:unknown;LWRTSDefinitions?:unknown;LWPetDefinitions?:unknown;LWPetAssetDefinitions?:unknown;
 }
 const self=inputRoot as Root;
 const node=typeof module!=='undefined'&&module.exports;
 const VERSION=1 as const,FORMAT='wildlands-content-profile' as const,ID=/^[a-z][a-z0-9-]{0,63}$/,MAX_PACKS=256;
 const SECTIONS:readonly LWContentProvider.Section[]=Object.freeze(['storage','balancing','librarySchema','creatures','assets','scenarios','rts','pet','process'] as const);
 const NESTED:Readonly<Record<string,readonly string[]>>={creatures:['configuration','definitions','editorFields'],pet:['definitions','assets'],scenarios:['packs','defaultId','canonicalId']};
 const fail=(message:string):never=>{throw Error('Content profile: '+message);};
 const plain=(value:unknown):value is Plain=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
 /** Own enumerable data fields only: an accessor is never invoked while admitting a profile. */
 function fields(value:unknown,allowed:readonly string[],where:string):Plain{
  if(!plain(value))return fail(where+' must be a plain object.');
  const result:Plain={};
  for(const key of Reflect.ownKeys(value)){
   const descriptor=Object.getOwnPropertyDescriptor(value,key)!;
   if(typeof key!=='string'||!allowed.includes(key))fail(where+' has unknown field '+String(key)+'.');
   if(!('value' in descriptor)||!descriptor.enumerable)fail(where+'.'+String(key)+' must be an enumerable data field.');
   if(descriptor.value!==undefined)result[key as string]=descriptor.value;
  }
  return result;
 }
 function catalog(value:unknown):LWContentProvider.ScenarioCatalog{
  const input=fields(value,NESTED.scenarios!,'scenarios'),packs=input.packs,defaultId=input.defaultId,canonicalId=input.canonicalId;
  if(!Array.isArray(packs)||packs.length<1||packs.length>MAX_PACKS)fail('scenarios.packs must list 1–'+MAX_PACKS+' packs.');
  const ids=(packs as unknown[]).map(pack=>{const descriptor=plain(pack)?Object.getOwnPropertyDescriptor(pack,'id'):undefined;return descriptor&&'value' in descriptor?descriptor.value as unknown:undefined;});
  if(typeof defaultId!=='string'||!ids.includes(defaultId))fail('scenarios.defaultId must name one of the listed packs.');
  if(canonicalId!==undefined&&(typeof canonicalId!=='string'||!ids.includes(canonicalId)))fail('scenarios.canonicalId must name one of the listed packs.');
  return Object.freeze({packs:Object.freeze([...packs as unknown[]]),defaultId:defaultId as string,...canonicalId===undefined?{}:{canonicalId:canonicalId as string}});
 }
 /** Structural admission of the envelope; section contents are validated by their owning modules. */
 function admit(input:unknown):Profile{
  const top=fields(input,['format','version','id',...SECTIONS],'profile');
  if(top.format!==FORMAT)fail('format must be '+FORMAT+'.');
  if(typeof top.version!=='number'||!Number.isInteger(top.version)||top.version<1)fail('version must be a positive integer.');
  if((top.version as number)>VERSION)fail('version '+String(top.version)+' is newer than this engine supports ('+VERSION+').');
  if(typeof top.id!=='string'||!ID.test(top.id))fail('id must be 1-64 lowercase letters, digits and hyphens, starting with a letter.');
  const profile:Plain={format:FORMAT,version:VERSION,id:top.id};
  for(const section of SECTIONS){
   if(!Object.hasOwn(top,section))continue;
   const value=top[section];
   profile[section]=section==='scenarios'?catalog(value):Object.hasOwn(NESTED,section)?Object.freeze(fields(value,NESTED[section]!,section)):value;
  }
  return Object.freeze(profile) as unknown as Profile;
 }
 let current:Profile|null=null,source:unknown=null;
 const listeners:{listener:()=>void;section:LWContentProvider.Section|undefined}[]=[];
 function install(input:unknown):Profile{
  if(current){
   if(input===source||input===current)return current;
   return fail('game content is already installed ('+current.id+'); a realm runs exactly one game.');
  }
  const admitted=admit(input);current=admitted;source=input;
  // Owners admit their sections now, in module load order, exactly as an at-load install would.
  for(const entry of listeners.splice(0))if(entry.section===undefined||Object.hasOwn(admitted,entry.section))entry.listener();
  return admitted;
 }
 function get(what?:string):Profile{
  if(current)return current;
  throw Error('Wildlands: no game content installed'+(what?' ('+what+' requested)':'')+'. Install a game content profile with LWContentProvider.install(profile) before using engine content.');
 }
 /** Browser transport: artifacts declare profile sections as data globals ahead of every module. */
 function fromGlobals(root:Root):Profile|null{
  const game=root.LWGameProfile,balancing=root.LWDefaultBalancing,librarySchema=root.LWContentSchema;
  const configuration=root.LWCreatureConfig,definitions=root.LWCreatureDefinitions,editorFields=root.LWCreatureEditorFieldDefinitions;
  const process=root.LWProcessDefinition,assets=root.LWAssetDefinitions,packs=root.LWScenarioPacks,rts=root.LWRTSDefinitions,pet=root.LWPetDefinitions,petAssets=root.LWPetAssetDefinitions;
  if([process,game,balancing,librarySchema,configuration,definitions,editorFields,assets,packs,rts,pet,petAssets].every(value=>value===undefined))return null;
  const storage=plain(game)&&Object.hasOwn(game,'storage')?game.storage as {namespace:string}:undefined;
  const namespace=plain(storage)&&typeof storage.namespace==='string'?storage.namespace.split('.').pop()??'':'';
  const defined=<T extends Plain>(record:T):Partial<T>=>Object.fromEntries(Object.entries(record).filter(([,value])=>value!==undefined)) as Partial<T>;
  const first=Array.isArray(packs)&&plain(packs[0])?packs[0].id:undefined;
  const scenarios=typeof first==='string'?{packs:packs as unknown[],defaultId:first,...(packs as unknown[]).some(pack=>plain(pack)&&pack.id==='littlewild')?{canonicalId:'littlewild'}:{}}:undefined;
  const creatures=defined({configuration,definitions,editorFields}),petContent=defined({definitions:pet,assets:petAssets});
  return admit({format:FORMAT,version:VERSION,id:ID.test(namespace)?namespace:'embedded',
   ...defined({storage,balancing,librarySchema,assets,scenarios,rts,process}),
   ...Object.keys(creatures).length?{creatures}:{},...Object.keys(petContent).length?{pet:petContent}:{}});
 }
 /** Run `listener` now when a game is installed, otherwise synchronously when one is installed; with `section`, only when the game declares it. */
 function whenInstalled(listener:()=>void,section?:LWContentProvider.Section):void{
  if(typeof listener!=='function')fail('listener must be a function.');
  if(section!==undefined&&!SECTIONS.includes(section))fail('unknown section '+String(section)+'.');
  if(!current)listeners.push({listener,section});
  else if(section===undefined||Object.hasOwn(current,section))listener();
 }
 const api:LWContentProvider.Api=Object.freeze({version:VERSION,sections:SECTIONS,install,installed:()=>current!==null,get,whenInstalled,fromGlobals});
 self.LWContentProvider=api;
 if(node)module.exports=api;
 const embedded=fromGlobals(self);
 if(embedded)install(embedded);
})(globalThis);
