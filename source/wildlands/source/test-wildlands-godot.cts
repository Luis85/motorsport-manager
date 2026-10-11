/** Real archive, path ownership and exported native-runtime verification. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {writeGodotProject} from './tools/wildlands-godot-writer.cjs';
require('./developer-sdk.cjs');
const Surface=require('./asset-surface.js') as LWAssetSurfaceContract.Api;
const Finish=require('./asset-finish.js') as LWAssetFinishContract.Api;
const P=require('./wildlands-project.js') as {create():unknown};
interface File {path:string;encoding:'utf8'|'base64';content:string;}
interface Compiled {files:File[];manifest:{files:{path:string;bytes:number;sha256:string}[];runtime:string;limitations:string[]};}
const G=require('./wildlands-godot.js') as {compile(project:unknown,resources:unknown,options?:{withEngineSources?:boolean}):Promise<Compiled>;zip(compiled:Compiled):Uint8Array};
const projectRoot=path.resolve(__dirname,'..'),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'wildlands-godot-test-'));
const read=(name:string):unknown=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8')) as unknown;
const resources={bundle:read('wildlands-runtime-bundle.json'),templates:read('wildlands-godot-templates.json')};
async function main():Promise<void>{
 try{
  const project=P.create() as {pack:{resources?:{assets:{materials:Record<string,unknown>}[];creatures:unknown};scenes:{initialState:{scenarioResources?:unknown}}[]};game:{profile:{assets:{materials:Record<string,unknown>}[];creatures:unknown}}};
  const descriptor:LWAssetSurfaceContract.Surface={version:2,kind:'fur',seed:17,scale:7,strength:.24};
  project.pack.resources??=require('./scenario-resources.js').snapshot();
  const material=project.pack.resources!.assets[0]!.materials,role=Object.keys(material)[0]!,old=material[role];
  material[role]={...(typeof old==='string'?{color:old}:old as Record<string,unknown>),surface:descriptor};
  material.legacySurface={color:'#ffffff',surface:{kind:'fur',seed:17,scale:7,strength:.24}};
  const finish:LWAssetFinishContract.Finish={version:1,kind:'painted-metal',seed:173,scale:4,wear:.35,palette:['#40563a','#a9a076']};
  const alternateFinish:LWAssetFinishContract.Finish={...finish,palette:['#704436','#c9b088']};
  material.nativeFinish={color:'#abcdef',roughness:.7,metalness:.8,finish};
  material.alternateNativeFinish={color:'#ffffff',finish:alternateFinish};
  const defaultFinish:LWAssetFinishContract.Finish={version:1,kind:'painted-metal',seed:271,scale:2,wear:.2};
  material.defaultNativeFinish={color:'#ffffff',finish:defaultFinish};
  material.whiteNativeFinish={color:'#eeeeee',finish:{...defaultFinish,palette:['#ffffff']}};
  for(const scene of project.pack.scenes)if(scene.initialState.scenarioResources)scene.initialState.scenarioResources=JSON.parse(JSON.stringify(project.pack.resources));
  const compiled=await G.compile(project,resources);
  assert.equal(compiled.manifest.runtime,'typescript-node-bridge');
  assert(compiled.manifest.limitations.some(value=>value.includes('Node.js')));
  assert(compiled.manifest.limitations.some(value=>value.includes('sheenColor')&&value.includes('approximate')));
  const files=new Map(compiled.files.map(file=>[file.path,file]));
  for(const identity of compiled.manifest.files){const file=files.get(identity.path)!;assert(file);const bytes=Buffer.from(file.content,file.encoding==='base64'?'base64':'utf8');assert.equal(bytes.length,identity.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),identity.sha256);}
  const surfaces=JSON.parse(files.get('surfaces/index.json')!.content) as {surface:LWAssetSurfaceContract.Surface;color:string;normal:string;algorithm:string}[];
  assert.equal(surfaces.length,2);assert.equal(surfaces[0]!.algorithm,'littlewild-surface-v2');assert.equal(surfaces[1]!.algorithm,'littlewild-surface-v1');assert.deepEqual(surfaces[0]!.surface,descriptor);
  const pixels=Surface.generate(descriptor);assert.deepEqual(Buffer.from(files.get(surfaces[0]!.normal)!.content,'base64'),Buffer.from(Surface.png(pixels.normal,128,128)));
  const finishes=JSON.parse(files.get('finishes/index.json')!.content) as {finish:LWAssetFinishContract.Finish;color:string;normal:string;orm:string;algorithm:string}[];
  assert.equal(finishes.length,3);assert.deepEqual(finishes.map(entry=>entry.finish),[finish,alternateFinish,defaultFinish]);
  for(const entry of finishes){
   assert.equal(entry.algorithm,'forge-finish-v1');const baked=Finish.generate(entry.finish);
   for(const role of ['color','normal','orm'] as const)assert.deepEqual(Buffer.from(files.get(entry[role])!.content,'base64'),Buffer.from(Surface.png(baked[role],128,128)));
  }
  // Reversing first-seen spelling must retain one shared native texture entry.
  const reversedProject=structuredClone(project),reversedMaterials=reversedProject.pack.resources!.assets[0]!.materials;
  delete reversedMaterials.defaultNativeFinish;
  reversedMaterials.defaultNativeFinish={color:'#ffffff',finish:defaultFinish};
  for(const scene of reversedProject.pack.scenes)if(scene.initialState.scenarioResources)scene.initialState.scenarioResources=JSON.parse(JSON.stringify(reversedProject.pack.resources));
  const reversed=await G.compile(reversedProject,resources);
  const reversedIndex=JSON.parse(reversed.files.find(file=>file.path==='finishes/index.json')!.content) as typeof finishes;
  assert.equal(reversedIndex.length,3);
  assert.deepEqual(reversedIndex[2]!.finish,{...defaultFinish,palette:['#ffffff']});
  for(const role of ['color','normal','orm'] as const)assert.equal(reversedIndex[2]![role],finishes[2]![role]);
  const finishPixels=Finish.generate(finish),sampleOffset=(29*128+17)*4;
  const pixelFixture=Object.fromEntries((['color','normal','orm'] as const).map(role=>[role,Array.from(finishPixels[role].subarray(sampleOffset,sampleOffset+4))]));
  // Default payload policy: the runnable project carries the runtime closure only, never the inert engine sources.
  assert(!files.has('runtime/engine-source-bundle.json'));assert(files.has('runtime/tools/wildlands-runtime.cjs'));assert.deepEqual(JSON.parse(files.get('wildlands.project.json')!.content),project);
  const runtimeFiles=(resources.bundle as {files:{path:string}[]}).files.map(file=>file.path).sort();assert.deepEqual(compiled.files.map(file=>file.path).filter(file=>file.startsWith('runtime/')).sort(),runtimeFiles);
  assert(!compiled.files.some(file=>/^runtime\/(ui|world-3d|wildlands-godot)\.js$|scenario-v3-grown/.test(file.path)));
  const engineText=fs.readFileSync(path.join(__dirname,'engine-source-bundle.json'),'utf8'),opted=await G.compile(project,{...resources,engineSources:engineText},{withEngineSources:true});
  assert.equal(opted.files.find(file=>file.path==='runtime/engine-source-bundle.json')?.content,engineText);assert.equal(opted.files.length,compiled.files.length+1);
  assert(!compiled.files.some(file=>file.path.includes('test-')||file.path.endsWith('.uid')));
  const binary={path:'binary.bin',encoding:'base64' as const,content:Buffer.from([0,128,255,13,10]).toString('base64')};
  const archive=path.join(scratch,'prototype.zip');fs.writeFileSync(archive,G.zip({...compiled,files:[...compiled.files,binary]}));
  const unzip=spawnSync('python3',['-c',"import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.read('binary.bin')==bytes([0,128,255,13,10]); assert 'project.godot' in z.namelist(); print(len(z.namelist()))",archive],{encoding:'utf8'});assert.equal(unzip.status,0,unzip.stderr);
  assert.throws(()=>G.zip({...compiled,files:[binary,{...binary,path:'../escape'}]}),/Unsafe/);
  assert.throws(()=>G.zip({...compiled,files:[binary,binary]}),/Duplicate/);
  const destination=path.join(scratch,'native');await writeGodotProject(project,destination);
  const identity=fs.readFileSync(path.join(destination,'wildlands.project.json'),'utf8');await assert.rejects(writeGodotProject(project,destination),/new directory/);assert.equal(fs.readFileSync(path.join(destination,'wildlands.project.json'),'utf8'),identity);
  const link=path.join(scratch,'link');fs.symlinkSync(scratch,link,'dir');await assert.rejects(writeGodotProject(project,path.join(link,'escaped')),/symlink/);assert(!fs.existsSync(path.join(scratch,'escaped')));
  fs.writeFileSync(path.join(destination,'native-finish-pixels.json'),JSON.stringify(pixelFixture));
  fs.writeFileSync(path.join(destination,'native-finish-reversed-index.json'),JSON.stringify(reversedIndex));
  fs.copyFileSync(path.join(projectRoot,'source/wildlands-godot/test-native.gd'),path.join(destination,'native-test.gd'));
  fs.copyFileSync(path.join(projectRoot,'source/wildlands-godot/test-native-appearance.gd'),path.join(destination,'test-native-appearance.gd'));
  const godot=process.env.WILDLANDS_GODOT??'godot',run=spawnSync(godot,[...(process.env.WILDLANDS_CAPTURE_NATIVE?[]:['--headless']),'--audio-driver','Dummy','--path',destination,'--script',path.join(destination,'native-test.gd')],{encoding:'utf8',timeout:50000,env:{...process.env,XDG_DATA_HOME:path.join(scratch,'data'),XDG_CONFIG_HOME:path.join(scratch,'config'),XDG_CACHE_HOME:path.join(scratch,'cache')}});
  assert.equal(run.status,0,run.stdout+'\n'+run.stderr);assert.match(run.stdout,/WILDLANDS_NATIVE_PASS/);assert(!/SCRIPT ERROR|ERROR:/.test(run.stdout+run.stderr),run.stdout+'\n'+run.stderr);
  const evidence={ok:true,exportedFiles:compiled.files.length,archiveBytes:fs.statSync(archive).size,native:run.stdout.trim(),checks:['manifest hashes','canonical authored project','default runtime closure without engine sources','explicit engine-source opt-in exact bytes','binary ZIP CRC and traversal','existing output retained','symlink ancestors rejected','actual Godot shell actors/terrain','180KiB+ threaded transport','explicit fixed-step clock','validated gameplay command','lossless full story restore','timeline restore and stale response rejection','three canonical personality variants','seven equipped socket attachments','physical clearcoat and explicit sheen approximation','exact portable surface PNG bytes and native texture assignment','read-only floor and guide observation','validated floor visit and production queue','correlated floor replies and rejection retry','real departed quest actor suppression','exact portable finish PNG bytes and native PBR channels']};
  fs.writeFileSync(path.join(__dirname,'wildlands-godot-results.json'),JSON.stringify(evidence,null,2)+'\n');process.stdout.write(JSON.stringify(evidence)+'\n');
 }finally{fs.rmSync(scratch,{recursive:true,force:true});}
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
