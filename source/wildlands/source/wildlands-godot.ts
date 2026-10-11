/// <reference path="./developer-contracts.d.ts" />
/// <reference path="./asset-surface.ts" />
/** Portable compiler output. Runtime code comes only from the trusted build bundle. */
(function(inputRoot:unknown){
 'use strict';
 interface File {path:string;encoding:'utf8'|'base64';content:string;}
 interface Manifest {format:'wildlands-godot-project';schemaVersion:1;projectId:string;scenarioId:string;sceneId:string;runtime:'typescript-node-bridge';prerequisites:string[];capabilities:string[];limitations:string[];files:{path:string;bytes:number;sha256:string}[];}
 interface Compiled {files:File[];manifest:Manifest;}
 interface RuntimeBundle {format:'wildlands-runtime-bundle';schemaVersion:1;sharedEngineSources?:boolean;files:File[];}
 /** Trusted build resources; engineSources is the exact engine-source bundle text, read only when requested. */
 interface Resources {bundle:RuntimeBundle;templates:Record<string,string>;engineSources?:string;}
 /** Engine sources are an opt-in payload: a default project is runnable without them. */
 interface Options {withEngineSources?:boolean;}
 /** Godot projects carry their game: only schemaVersion 2 documents (with the embedded profile) compile. */
 interface Project {format:'wildlands-project';schemaVersion:1|2;id:string;name:string;target:'godot';scenarioId:string;sceneId:string;pack:LWContentPorts.ScenarioPack;game?:unknown;}
 interface Loader {encoding:'gzip-base64';decodedBytes:number;sha256?:string;data:string;}
 const root=inputRoot as {LWAssetSurface?:LWAssetSurfaceContract.Api;WildlandsGodotTemplates?:Record<string,string>;WildlandsGodotRuntimeBundle?:RuntimeBundle;WildlandsGodotRuntimeLoader?:Loader;LWEngineSourceLoader?:Loader;LWEngineExportData?:LWEngineExport.Decoder;WildlandsProject?:{validate(input:unknown):{ok:boolean;project?:Project;errors:readonly string[]}};LWDeveloper?:LittlewildDeveloper.Toolbox;WildlandsGodot?:unknown};
 const encoder=new TextEncoder();
 let cachedBundle:RuntimeBundle|undefined;
 const pathPattern=/^[a-zA-Z0-9_./ -]+$/;
 function safePath(value:string):string{
  if(!pathPattern.test(value)||value.startsWith('/')||value.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Unsafe generated Godot path: '+value);
  return value;
 }
 function bytes(file:File):Uint8Array{return file.encoding==='base64'?Uint8Array.from(atob(file.content),character=>character.charCodeAt(0)):encoder.encode(file.content);}
 async function hash(value:Uint8Array):Promise<string>{const result=await globalThis.crypto.subtle.digest('SHA-256',new Uint8Array(value).buffer);return Array.from(new Uint8Array(result),item=>item.toString(16).padStart(2,'0')).join('');}
 async function inflate(loader:Loader):Promise<string>{
  if(loader.encoding!=='gzip-base64'||!Number.isSafeInteger(loader.decodedBytes)||loader.decodedBytes<0||loader.decodedBytes>64*1024*1024)throw Error('Invalid trusted Godot runtime loader.');
  const compressed=Uint8Array.from(atob(loader.data),character=>character.charCodeAt(0));
  const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const value=await reader.read();if(value.done)break;size+=value.value.length;if(size>loader.decodedBytes)throw Error('Trusted Godot runtime inflation exceeds its bounds.');chunks.push(value.value);}}finally{await reader.cancel();}
  if(size!==loader.decodedBytes)throw Error('Trusted Godot runtime inflation is truncated.');const raw=new Uint8Array(size);let position=0;for(const chunk of chunks){raw.set(chunk,position);position+=chunk.length;}
  if(loader.sha256!==undefined&&await hash(raw)!==loader.sha256)throw Error('Trusted Godot runtime loader integrity failed.');
  return new TextDecoder('utf-8',{fatal:true}).decode(raw);
 }
 // Declared payload capabilities: an artifact may omit the Godot runtime or engine-source payloads.
 const ENGINE_SOURCES_UNAVAILABLE='Shared trusted engine sources are unavailable. Godot export needs the engine-source payload, which is not included in this build; rebuild with the engine-source payload enabled.';
 const RUNTIME_UNAVAILABLE='Godot export is unavailable in this build: the trusted Godot runtime payload is not included. Rebuild with the Godot export payload enabled.';
 const TEMPLATES_UNAVAILABLE='Godot export is unavailable in this build: the Godot scene templates are not included. Rebuild with the Godot export payload enabled.';
 const LEGACY_PROJECT='Godot compilation needs a schemaVersion 2 project, which embeds its game; this schemaVersion 1 project does not. Upgrade it first (wildlands compile or upgrade with --game DIR, or WildlandsProject.upgrade).';
 const VALIDATOR_UNAVAILABLE='Godot export is unavailable in this build: the Wildlands project validator is not included.';
 /** Report, without inflating any payload, whether this artifact can compile Godot projects. */
 function capability():{available:boolean;reason?:string}{
  if(!root.WildlandsProject)return {available:false,reason:VALIDATOR_UNAVAILABLE};
  if(!root.WildlandsGodotRuntimeBundle&&!root.WildlandsGodotRuntimeLoader)return {available:false,reason:RUNTIME_UNAVAILABLE};
  if(!root.WildlandsGodotTemplates)return {available:false,reason:TEMPLATES_UNAVAILABLE};
  return {available:true};
 }
 async function runtimeBundle():Promise<RuntimeBundle|undefined>{
  if(root.WildlandsGodotRuntimeBundle)return root.WildlandsGodotRuntimeBundle;
  if(cachedBundle)return cachedBundle;
  const loader=root.WildlandsGodotRuntimeLoader;if(!loader)return undefined;
  const bundle=JSON.parse(await inflate(loader)) as RuntimeBundle;
  if(bundle.sharedEngineSources){bundle.files.push({path:'runtime/engine-source-bundle.json',encoding:'utf8',content:await engineSources()});delete bundle.sharedEngineSources;}
  cachedBundle=bundle;return bundle;
 }
 /** Exact engine-source bundle text for an explicit opt-in; never inflated otherwise. */
 async function engineSources(resources?:Resources):Promise<string>{
  // A browser artifact restores its loader through the engine-export decoder (inline vendor scripts included).
  const decoder=root.LWEngineExportData,loader=root.LWEngineSourceLoader;
  const scripts=():string[]=>typeof document==='undefined'?[]:Array.from(document.scripts,script=>script.text);
  const text=resources?.engineSources??(loader&&decoder?JSON.stringify(await decoder.sources(loader,scripts())):undefined);
  if(text===undefined)throw Error(ENGINE_SOURCES_UNAVAILABLE);
  const bundle=JSON.parse(text) as {format?:unknown;identity?:unknown};
  if(bundle.format!=='littlewild-engine-sources'||typeof bundle.identity!=='string')throw Error('Trusted engine-source bundle is invalid. Rebuild Wildlands.');
  return text;
 }
 async function compile(input:unknown,resources?:Resources,options:Options={}):Promise<Compiled>{
  const checked=root.WildlandsProject?.validate(input);
  if(!checked?.ok||!checked.project)throw Error(checked?.errors.join('\n')??'Wildlands project validator is unavailable.');
  if(!resources?.bundle&&!root.WildlandsGodotRuntimeBundle&&!root.WildlandsGodotRuntimeLoader)throw Error(RUNTIME_UNAVAILABLE);
  if(!resources?.templates&&!root.WildlandsGodotTemplates)throw Error(TEMPLATES_UNAVAILABLE);
  const project=checked.project,bundle=resources?.bundle??await runtimeBundle(),templates=resources?.templates??root.WildlandsGodotTemplates;
  if(!bundle||bundle.format!=='wildlands-runtime-bundle'||bundle.schemaVersion!==1||!Array.isArray(bundle.files)||!templates)throw Error('Trusted Godot runtime bundle is unavailable. Rebuild Wildlands.');
  // The trusted runtime bundle carries no game: the compiled project installs the one it embeds.
  if(project.schemaVersion!==2)throw Error(LEGACY_PROJECT);
  const renderers=project.pack.scenes.map(scene=>scene.graph?.rendering?.rendererId??'basic');
  if(renderers.some(id=>!['basic','pixi-2d','excalibur-2d'].includes(id)))throw Error('Custom renderer extensions require an explicit native adapter before Godot compilation.');
  if((project.pack.storytelling?.cutscenes??[]).some(clip=>(clip.animations??[]).some(animation=>!['sparkles','orbit','ripple'].includes(animation.presetId))))throw Error('Custom animation extensions require an explicit native adapter before Godot compilation.');
  const files:File[]=[],seen=new Set<string>();
  function add(path:string,content:string,encoding:File['encoding']='utf8'):void{safePath(path);if(seen.has(path))throw Error('Duplicate generated Godot path: '+path);seen.add(path);files.push({path,encoding,content});}
  for(const file of bundle.files){if(!file.path.startsWith('runtime/')||!['utf8','base64'].includes(file.encoding)||typeof file.content!=='string')throw Error('Invalid trusted runtime file.');add(file.path,file.content,file.encoding);}
  if(!seen.has('runtime/tools/wildlands-runtime.cjs')||!seen.has('runtime/developer-sdk.cjs'))throw Error('Trusted runtime bundle lacks the gameplay entry points.');
  const sourcesPath='runtime/engine-source-bundle.json';
  if(options.withEngineSources===true&&!seen.has(sourcesPath))add(sourcesPath,await engineSources(resources));
  const withSources=seen.has(sourcesPath);
  for(const name of ['main.gd','bridge.gd','world.gd','assets.gd','creatures.gd','floors.gd','guide.gd']){const text=templates[name];if(typeof text!=='string'||!text.trim())throw Error('Missing Godot template: '+name);add('native/'+name,text);}
  add('project.godot','; Generated by Wildlands. Gameplay remains TypeScript authoritative.\nconfig_version=5\n\n[application]\nconfig/name='+JSON.stringify(project.name)+'\nrun/main_scene="res://main.tscn"\n\n[display]\nwindow/size/viewport_width=1440\nwindow/size/viewport_height=900\nwindow/stretch/mode="canvas_items"\n\n[rendering]\nrenderer/rendering_method="gl_compatibility"\nrenderer/rendering_method.mobile="gl_compatibility"\n');
  add('main.tscn','[gd_scene load_steps=2 format=3]\n\n[ext_resource type="Script" path="res://native/main.gd" id="1"]\n\n[node name="Wildlands" type="Control"]\nlayout_mode = 3\nanchors_preset = 15\nanchor_right = 1.0\nanchor_bottom = 1.0\ngrow_horizontal = 2\ngrow_vertical = 2\nscript = ExtResource("1")\n');
  // Bake the shared portable pixels once; native viewing does not need a JS texture generator.
  const surfaceIndex:{surface:LWAssetSurfaceContract.Surface;color:string;normal:string;algorithm:string}[]=[],surfaceKeys=new Set<string>();
  function surface(value:unknown):void{
   if(!value||typeof value!=='object'||!('surface' in value))return;
   const descriptor=(value as {surface:LWAssetSurfaceContract.Surface}).surface,S=root.LWAssetSurface;
   if(!S)throw Error('Portable surface generator is unavailable for Godot export');
   const key=S.key(descriptor);if(surfaceKeys.has(key))return;
   if(surfaceKeys.size>=256)throw Error('Godot export exceeds 256 unique portable surfaces');
   surfaceKeys.add(key);const pixels=S.generate(descriptor),index=surfaceIndex.length,color='surfaces/'+index+'-color.png',normal='surfaces/'+index+'-normal.png';
   const encoded=(bytes:Uint8Array)=>{let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);};
   add(color,encoded(S.png(pixels.color,pixels.width,pixels.height)),'base64');add(normal,encoded(S.png(pixels.normal,pixels.width,pixels.height)),'base64');surfaceIndex.push({surface:descriptor,color,normal,algorithm:S.algorithm(descriptor)});
  }
  function nodeSurfaces(nodes:Record<string,unknown>[]):void{for(const node of nodes){surface(node.materialProps);if(Array.isArray(node.children))nodeSurfaces(node.children);}}
  // Pack resources replace the complete catalog, including imported/refined creature visuals.
  const assets=(project.pack.resources?.assets??(project.game as {profile:{assets:Record<string,unknown>[]}}).profile.assets) as readonly Record<string,unknown>[];
  for(const asset of assets??[]){for(const material of Object.values(asset.materials as Record<string,unknown>))surface(material);for(const model of Object.values(asset.models as Record<string,{nodes:Record<string,unknown>[]}>) )nodeSurfaces(model.nodes);}
  add('surfaces/index.json',JSON.stringify(surfaceIndex));
  add('wildlands.project.json',JSON.stringify(project,null,2)+'\n');
  add('README.md','# '+project.name+'\n\nOpen project.godot with Godot 4.4 or newer and run the main scene. Node.js 22 or newer must be available on PATH (or set WILDLANDS_NODE to its executable). The native Control and 3D scene consume detached snapshots from the bundled authoritative TypeScript simulation over a local subprocess. No npm install or source checkout is needed.\n\nUse the command console to access every discovered gameplay command. Start/Pause and speed controls explicitly advance fixed steps. Creature personality models, colors, equipment sockets and observed rig feedback use the canonical assets. Building floors provides a live inspector, companion floor visits and validated workstation production orders; observing floors never moves companions or advances gameplay. The authored guide provides advice without performing actions or changing saved progress. Scene connections preserve canonical owners. Save/Load stores the complete story, including dormant scenes and paid jobs. Authored cutscenes preview camera and entity tracks using the existing TypeScript storytelling authority; automatic entry, timed and completion story events are not dispatched.\n\nThis desktop prototype requires the Node runtime; it is not a standalone native, mobile, browser or console Godot binary. Portable short fur, cloth and leather detail uses deterministic baked color and normal textures; it does not add silhouette hair. Native materials map clearcoat, while cloth sheen uses bounded albedo-tinted approximate rim lighting (sheenColor and sheenRoughness remain authored metadata). Native visuals cover canonical primitive assets, terrain and actors; browser renderer effects and 2D/compositor presentation remain in the web showcase.\n');
  const manifest:Manifest={format:'wildlands-godot-project',schemaVersion:1,projectId:project.id,scenarioId:project.scenarioId,sceneId:project.sceneId,runtime:'typescript-node-bridge',prerequisites:['Godot 4.4 or newer (desktop)','Node.js 22 or newer'],capabilities:['authoritative TypeScript gameplay','complete authored scenario resources','fixed-step simulation','all discovered validated commands','scene connections and canonical owner continuation','full story save and restore','native primitive assets and 3D terrain','portable baked surface color and normal maps with authored UVs','creature personality appearances, equipment sockets and observed rig feedback','building floor inspection and validated visit/production intents','authored tutorial guidance','authored cutscene entity and camera track sampling','offline local runtime',...(withSources?['opt-in trusted engine-source inventory for code-generator engine export']:[])],limitations:['Physical clearcoat is mapped natively. Cloth sheen uses an approximate albedo-tinted rim bounded to 8% additive strength; sheenColor and sheenRoughness are retained in authored_surface metadata, not reproduced by StandardMaterial3D.','Node.js is a required external desktop runtime; this is not a standalone native/mobile/web Godot export.','Native presentation uses a common 3D adapter; browser 2D/renderer embeds and preset effects are retained as authored data but not reproduced by the native viewer. Native viewer previews timeline tracks; automatic entry/timed/completion story events are not dispatched.',...(withSources?[]:['Engine-source payload omitted (default): code-generator engine export is unavailable inside this project; compile with the explicit engine-sources option to include it.'])],files:[]};
  for(const file of files){const raw=bytes(file);manifest.files.push({path:file.path,bytes:raw.length,sha256:await hash(raw)});}
  add('wildlands.manifest.json',JSON.stringify(manifest,null,2)+'\n');return {files,manifest};
 }
 // Stored ZIP needs no compression package and preserves binary files exactly.
 const crcTable=Array.from({length:256},(_,value)=>{for(let bit=0;bit<8;bit++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
 function crc32(data:Uint8Array):number{let crc=0xffffffff;for(const byte of data)crc=crcTable[(crc^byte)&255]!^(crc>>>8);return (crc^0xffffffff)>>>0;}
 function zip(compiled:Compiled):Uint8Array{
  if(compiled.files.length>65535)throw Error('Godot archive exceeds ZIP entry limit.');
  const chunks:Uint8Array[]=[],central:Uint8Array[]=[],seen=new Set<string>();let offset=0,centralSize=0;
  for(const file of compiled.files){const name=encoder.encode(safePath(file.path));if(seen.has(file.path))throw Error('Duplicate Godot archive path.');seen.add(file.path);const data=bytes(file),crc=crc32(data),header=new Uint8Array(30+name.length),h=new DataView(header.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(12,33,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);header.set(name,30);chunks.push(header,data);
   const entry=new Uint8Array(46+name.length),e=new DataView(entry.buffer);e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x0800,true);e.setUint16(14,33,true);e.setUint32(16,crc,true);e.setUint32(20,data.length,true);e.setUint32(24,data.length,true);e.setUint16(28,name.length,true);e.setUint32(42,offset,true);entry.set(name,46);central.push(entry);centralSize+=entry.length;offset+=header.length+data.length;
  }
  const footer=new Uint8Array(22),view=new DataView(footer.buffer);view.setUint32(0,0x06054b50,true);view.setUint16(8,compiled.files.length,true);view.setUint16(10,compiled.files.length,true);view.setUint32(12,centralSize,true);view.setUint32(16,offset,true);chunks.push(...central,footer);
  if(offset+centralSize+22>0xffffffff)throw Error('Godot archive exceeds ZIP32 size limit.');const result=new Uint8Array(offset+centralSize+22);let cursor=0;for(const chunk of chunks){result.set(chunk,cursor);cursor+=chunk.length;}return result;
 }
 const api=Object.freeze({compile,zip,capability});root.WildlandsGodot=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
