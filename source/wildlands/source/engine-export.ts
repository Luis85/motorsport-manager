/// <reference path="./engine-export-contracts.d.ts" />
/* A complete detached code-generator document with integrity checks, never a runtime importer. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWEngineSourceLoader?:LWEngineExport.SourceLoader;LWEngineExportData:LWEngineExport.Decoder;LWEngineExportManifest:LWEngineExport.ManifestApi;LWEngineExport?:LWEngineExport.Api;LWScenarios:LWContentPorts.ScenarioApi};
 const node=typeof module!=='undefined'&&module.exports;
 const X=(node?require('./scenario-runtime.js'):root.LWScenarios) as LWContentPorts.ScenarioApi;
 const D=(node?require('./engine-export-data.js'):root.LWEngineExportData) as LWEngineExport.Decoder;
 const M=(node?require('./engine-export-manifest.js'):root.LWEngineExportManifest) as LWEngineExport.ManifestApi;
 let sourceCache:Promise<LWEngineExport.SourceBundle>|undefined;
 // The engine-source payload is an opt-in capability of an artifact; its absence is reported, never guessed.
 const SOURCES_UNAVAILABLE='Engine export is unavailable in this build: the trusted engine-source payload is not included. Rebuild with the engine-source payload enabled.';
 /** Report, without inflating the payload, whether trusted engine sources are present. */
 function capability():LWEngineExport.Capability{
  if(node){try{require('./engine-source-bundle.json');return {available:true};}catch{return {available:false,reason:SOURCES_UNAVAILABLE};}}
  return root.LWEngineSourceLoader===undefined?{available:false,reason:SOURCES_UNAVAILABLE}:{available:true};
 }
 async function trusted():Promise<LWEngineExport.SourceBundle>{
  if(!capability().available)throw Error(SOURCES_UNAVAILABLE);
  if(!sourceCache)sourceCache=(async()=>{
   if(node)return D.parse(require('./engine-source-bundle.json')) as LWEngineExport.SourceBundle;
   const loader=D.record(D.parse(root.LWEngineSourceLoader));
   if(loader.format!=='littlewild-engine-source-loader'||loader.schemaVersion!==1||loader.encoding!=='gzip-base64'||typeof loader.data!=='string'||typeof loader.decodedBytes!=='number'||loader.decodedBytes>D.maxBytes||typeof loader.compressedBytes!=='number'||loader.compressedBytes>D.maxBytes)throw Error('Invalid compressed engine source loader.');
   const binary=atob(loader.data);if(binary.length!==loader.compressedBytes)throw Error('Invalid compressed engine source length.');
   const bytes=Uint8Array.from(binary,value=>value.charCodeAt(0)),reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),chunks:Uint8Array[]=[];let length=0;
   try{while(true){const next=await reader.read();if(next.done)break;length+=next.value.byteLength;if(length>D.maxBytes||length>loader.decodedBytes)throw Error('Inflated engine source bundle exceeds its bounds.');chunks.push(next.value);}}finally{await reader.cancel();}
   if(length!==loader.decodedBytes)throw Error('Truncated compressed engine source bundle.');
   const joined=new Uint8Array(length);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
   const bundle=D.parse(new TextDecoder('utf-8',{fatal:true}).decode(joined)) as LWEngineExport.SourceBundle;if(bundle.identity!==loader.identity)throw Error('Engine source identity mismatch.');return bundle;
  })();
  try{return await sourceCache;}catch(error){sourceCache=undefined;throw error;}
 }
 function equal(a:unknown,b:unknown):boolean{if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const left=a as Record<string,unknown>,right=b as Record<string,unknown>,keys=Object.keys(left);return keys.length===Object.keys(right).length&&keys.every(key=>Object.hasOwn(right,key)&&equal(left[key],right[key]));}
 function checkPack(input:unknown,sceneId:unknown,captured?:unknown):{pack:LWContentPorts.ScenarioPack;extensions:LWEngineExport.Extensions}{
  const original=D.parse(input) as LWContentPorts.ScenarioPack,extensions=M.extensions(original,captured),projection=D.parse(original) as LWContentPorts.ScenarioPack;
  // Codegen admission checks the full canonical schema/state using only two inert ID substitutions.
  // Captured IDs/dimensions/provenance are checked independently; no host registry is changed.
  for(const scene of projection.scenes)if(scene.graph?.rendering)scene.graph.rendering.rendererId='basic';
  for(const clip of projection.storytelling?.cutscenes??[])for(const animation of clip.animations??[])animation.presetId='sparkles';
  const checked=X.validate(projection);if(!checked.ok)throw Error(checked.errors.join('\n'));if(typeof sceneId!=='string'||!checked.pack.scenes.some(scene=>scene.id===sceneId))throw Error('Engine export requires an existing selected scene.');
  for(const scene of checked.pack.scenes)if(scene.graph?.rendering)scene.graph.rendering.rendererId=original.scenes.find(value=>value.id===scene.id)!.graph!.rendering!.rendererId;
  for(const clip of checked.pack.storytelling?.cutscenes??[])for(const animation of clip.animations??[])animation.presetId=original.storytelling!.cutscenes.find(value=>value.id===clip.id)!.animations!.find(value=>value.id===animation.id)!.presetId;
  return {pack:checked.pack,extensions};
 }
 async function exportEngine(input:unknown,sceneId:string):Promise<LWEngineExport.Document>{
  const {pack,extensions}=checkPack(input,sceneId),sources=await trusted();
  const exchanged=D.parse({format:'littlewild-engine-export',schemaVersion:1,sourceIdentity:sources.identity,sources,extensions,pack,sceneId,...M.create(pack,sceneId,sources,extensions)}) as LWEngineExport.Document;
  if(new TextEncoder().encode(JSON.stringify(exchanged,null,2)+'\n').byteLength>D.maxBytes)throw Error('Complete engine export exceeds64MiB.');return exchanged;
 }
 async function validate(input:unknown):Promise<LWEngineExport.Validation>{try{
  const exchanged=D.record(D.parse(input)),keys=['format','schemaVersion','sourceIdentity','sources','extensions','pack','sceneId','checkpoint','catalogs','runtime','godot','limitations'];
  if(exchanged.format!=='littlewild-engine-export'||exchanged.schemaVersion!==1||Object.keys(exchanged).length!==keys.length||keys.some(key=>!Object.hasOwn(exchanged,key)))throw Error('Invalid engine export format or fields.');
  const expected=await trusted(),bundle=D.record(exchanged.sources);
  if(bundle.format!==expected.format||bundle.schemaVersion!==1||bundle.identity!==exchanged.sourceIdentity||!Array.isArray(bundle.files))throw Error('Invalid engine source bundle.');
  const paths=new Set<string>(),files:LWEngineExport.SourceFile[]=[];
  for(const value of bundle.files){const file=D.record(value),filePath=D.path(file.path);if(paths.has(filePath))throw Error('Duplicate source path: '+filePath);paths.add(filePath);
   if(typeof file.text!=='string'||typeof file.sha256!=='string'||! /^[a-f0-9]{64}$/.test(file.sha256)||!['utf8','base64'].includes(String(file.encoding)))throw Error('Invalid source encoding/hash: '+filePath);
   const raw=file.encoding==='base64'?Uint8Array.from(atob(file.text),value=>value.charCodeAt(0)):new TextEncoder().encode(file.text),hash=Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',raw)),byte=>byte.toString(16).padStart(2,'0')).join('');
   if(file.bytes!==raw.byteLength||hash!==file.sha256)throw Error('Source integrity failure: '+filePath);
   const original=expected.files.find(item=>item.path===filePath);if(!original||!equal(file,original))throw Error('Source does not match the complete trusted build inventory: '+filePath);files.push(file as unknown as LWEngineExport.SourceFile);
  }
  if(files.length!==expected.files.length||await D.sha256(files.map(file=>file.path+'\0'+file.sha256+'\n').join(''))!==bundle.identity||bundle.identity!==expected.identity)throw Error('Incomplete or reordered source inventory.');
  if(!equal(bundle,expected))throw Error('Source inventory or architecture metadata differs from the trusted build.');
  const {pack,extensions}=checkPack(exchanged.pack,exchanged.sceneId,exchanged.extensions),manifest=M.create(pack,exchanged.sceneId as string,expected,extensions);
  for(const key of ['checkpoint','catalogs','runtime','godot','limitations'] as const)if(!equal(exchanged[key],manifest[key]))throw Error('Derived engine manifest differs from canonical sources/data: '+key);
  return {ok:true,document:exchanged as unknown as LWEngineExport.Document,errors:[]};
 }catch(error){return {ok:false,errors:[error instanceof Error?error.message:String(error)]};}}
 const api:LWEngineExport.Api={export:exportEngine,validate,maxBytes:D.maxBytes,capability};root.LWEngineExport=api;if(node)module.exports=api;
})(globalThis);
