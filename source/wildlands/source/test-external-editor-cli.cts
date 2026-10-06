/// <reference path="./external-editor-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const X=require('./scenario-runtime.js') as LWContentPorts.ScenarioApi;
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,fn:()=>void):void{try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,String(error));}}
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'littlewild-external-cli-')),pack=X.builtins().find(p=>p.id==='office')!,source=path.join(directory,'source.pack.json');fs.writeFileSync(source,JSON.stringify(pack));
function cli(args:string[]):{status:number|null;payload:Record<string,unknown>}{const result=spawnSync(process.execPath,[path.join(__dirname,'tools/scenario-cli.cjs'),...args],{encoding:'utf8',timeout:30000});assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.stderr,'');return {status:result.status,payload:JSON.parse(result.stdout) as Record<string,unknown>};}
try{
 for(const format of ['tiled','ldtk','gltf'])test(format+' real CLI export/import writes atomic validated canonical output and structured warnings',()=>{
  const external=path.join(directory,format+'.json'),output=path.join(directory,format+'.pack.json');const exported=cli(['external-export',source,pack.scenes[0]!.id,format,external]);assert.equal(exported.status,0);assert.equal(exported.payload.ok,true);assert(Array.isArray(exported.payload.warnings));const imported=cli(['external-import',external,output]);assert.equal(imported.status,0);assert.deepEqual(JSON.parse(fs.readFileSync(output,'utf8')),pack);
 });
 test('CLI accepts standard GLB JSON and BIN file bytes with a real changed native coordinate',()=>{
  const E=require('./external-editors.js') as LWExternalEditors.Api,doc=E.export(pack,pack.scenes[0]!.id,'gltf').document;
  const buffers=doc.buffers as Record<string,unknown>[],binary=Buffer.from(String(buffers[0]!.uri).split(',')[1]!,'base64');delete buffers[0]!.uri;
  const nodes=doc.nodes as Record<string,unknown>[];const node=nodes.find(n=>(n.extras as Record<string,unknown>)?.entityId==='c1')!;node.translation=[9,0,10];
  const json=Buffer.from(JSON.stringify(doc)),jsonSize=Math.ceil(json.length/4)*4,binSize=Math.ceil(binary.length/4)*4,bytes=Buffer.alloc(28+jsonSize+binSize);bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(jsonSize,12);bytes.writeUInt32LE(0x4e4f534a,16);bytes.fill(32,20,20+jsonSize);json.copy(bytes,20);bytes.writeUInt32LE(binSize,20+jsonSize);bytes.writeUInt32LE(0x004e4942,24+jsonSize);binary.copy(bytes,28+jsonSize);
  const file=path.join(directory,'edited.glb'),output=path.join(directory,'glb.pack.json');fs.writeFileSync(file,bytes);const result=cli(['external-import',file,output]);assert.equal(result.status,0);const actual=JSON.parse(fs.readFileSync(output,'utf8')) as LWContentPorts.ScenarioPack;const colony=actual.scenes[0]!.initialState.colony as {creatures:{id:string;creature:{x:number;y:number}}[]};assert.equal(colony.creatures[0]!.creature.x,9);assert.equal(colony.creatures[0]!.creature.y,10);assert.deepEqual(actual.resources,pack.resources);
 });
 test('CLI conversion rejection exits one and retains existing output and inputs',()=>{
  const bad=path.join(directory,'bad.tmj'),output=path.join(directory,'preserved.json');fs.writeFileSync(bad,'{}');fs.writeFileSync(output,'keep original');const rejected=cli(['external-import',bad,output]);assert.equal(rejected.status,1);assert.equal(rejected.payload.ok,false);assert.equal(fs.readFileSync(output,'utf8'),'keep original');assert.equal(fs.readFileSync(bad,'utf8'),'{}');const badExport=cli(['external-export',bad,'absent','tiled',output]);assert.equal(badExport.status,1);assert.equal(fs.readFileSync(output,'utf8'),'keep original');
 });
 test('CLI syntax and missing files exit two; output aliases cannot overwrite inputs',()=>{
  for(const args of [['external-export',source],['external-export',source,pack.scenes[0]!.id,'invalid',source],['external-import',path.join(directory,'absent.glb'),source],['external-export',source,pack.scenes[0]!.id,'gltf',source]]){const result=cli(args);assert.equal(result.status,2);assert.equal(result.payload.ok,false);}assert.deepEqual(JSON.parse(fs.readFileSync(source,'utf8')),pack);assert(!fs.readdirSync(directory).some(file=>file.endsWith('.tmp')));
 });
 test('CLI generic mapping options create actual native instances without modifying the template input',()=>{
  const external=path.join(directory,'generic.tmj'),options=path.join(directory,'mapping.json'),output=path.join(directory,'generic.pack.json');fs.writeFileSync(external,JSON.stringify({type:'map',orientation:'orthogonal',tilewidth:32,tileheight:32,layers:[{type:'objectgroup',objects:[{name:'c4',class:'Worker',type:'',x:288,y:320}]}]}));fs.writeFileSync(options,JSON.stringify({pack,sceneId:pack.scenes[0]!.id,mappings:[{externalType:'Worker',category:'creatures',templateId:'c1'}]}));const result=cli(['external-import',external,output,options]);assert.equal(result.status,0);const admitted=JSON.parse(fs.readFileSync(output,'utf8')) as LWContentPorts.ScenarioPack;const colony=admitted.scenes[0]!.initialState.colony as {creatures:{id:string}[]};assert(colony.creatures.some(c=>c.id==='c4'));assert.deepEqual(JSON.parse(fs.readFileSync(source,'utf8')),pack);
 });
 test('External import and export reject symlink and hardlink input aliases',()=>{
  const external=path.join(directory,'tiled.json'),options=path.join(directory,'mapping.json');
  for(const input of [source,external,options])for(const kind of ['symlink','hardlink']){
   const before=fs.readFileSync(input),alias=path.join(directory,path.basename(input)+'.'+kind);if(kind==='symlink')fs.symlinkSync(input,alias);else fs.linkSync(input,alias);
   const args=input===source?['external-export',source,pack.scenes[0]!.id,'tiled',alias]:['external-import',external,alias,options];const result=cli(args);assert.equal(result.status,2);assert.equal(result.payload.ok,false);assert.deepEqual(fs.readFileSync(input),before);assert.deepEqual(fs.readFileSync(alias),before);
  }
  assert(!fs.readdirSync(directory).some(file=>file.endsWith('.tmp')));
 });
 test('External CLI flushes complete warning JSON to a consumer applying pipe backpressure',()=>{
  const E=require('./external-editors.js') as LWExternalEditors.Api,doc=E.export(pack,pack.scenes[0]!.id,'tiled').document;
  const layers=doc.layers as {type:string;objects?:{name:string;properties:{name:string;type:string;value:string}[]}[]}[];
  const actor=layers.flatMap(layer=>layer.objects??[]).find(object=>object.name==='c1')!;
  actor.properties.push(...Array.from({length:7000},(_,index)=>({name:'unsupported_'+index,type:'string',value:'inert'})));
  const input=path.join(directory,'many-warnings.tmj'),output=path.join(directory,'many-warnings.pack.json');fs.writeFileSync(input,JSON.stringify(doc));
  // Delay draining after the first bytes arrive: process.exit() discards a queued stdout tail.
  const consumer="const {spawn}=require('node:child_process');const child=spawn(process.execPath,process.argv.slice(1));let output='';child.stdout.pause();child.stdout.once('readable',()=>setTimeout(()=>child.stdout.resume(),100));child.stdout.on('data',chunk=>output+=chunk);child.stderr.pipe(process.stderr);child.on('error',error=>{throw error;});child.on('close',code=>{process.stdout.write(output);process.exitCode=code??1;});";
  const child=spawnSync(process.execPath,['-e',consumer,path.join(__dirname,'tools/scenario-cli.cjs'),'external-import',input,output],{encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024});assert.equal(child.error,undefined);assert.equal(child.status,0);assert.equal(child.stderr,'');
  const result=JSON.parse(child.stdout) as {ok:boolean;warnings:string[]};assert.equal(result.ok,true);assert(result.warnings.length>=7000);assert.deepEqual(JSON.parse(fs.readFileSync(output,'utf8')),pack);
 });
}finally{fs.rmSync(directory,{recursive:true,force:true});}
const report={suite:'external-editor-cli',passed:results.filter(r=>r.passed).length,total:results.length,results};fs.writeFileSync(path.join(__dirname,'external-editor-cli-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(results.some(r=>!r.passed))process.exitCode=1;
