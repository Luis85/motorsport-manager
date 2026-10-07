/// <reference path="./engine-export-contracts.d.ts" />
// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const X=require('./scenario-runtime.js') as LWContentPorts.ScenarioApi;
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'littlewild-engine-cli-')),cli=path.join(__dirname,'tools/scenario-cli.cjs'),results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,fn:()=>void):void{try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,String(error));}}
function run(args:string[]):{status:number|null;out:Record<string,unknown>}{const result=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',maxBuffer:2*1024*1024});if(result.error)throw result.error;assert.equal(result.stderr,'');return {status:result.status,out:JSON.parse(result.stdout) as Record<string,unknown>};}
const pack=X.builtins().find(value=>value.id==='office')!,input=path.join(directory,'pack.json'),output=path.join(directory,'engine.json');fs.writeFileSync(input,JSON.stringify(pack));
test('Actual CLI atomically exports complete inert engine JSON and validates its exact inventory',()=>{const result=run(['engine-export',input,pack.scenes[0]!.id,output]);assert.equal(result.status,0,JSON.stringify(result.out));assert.equal(result.out.ok,true);const data=JSON.parse(fs.readFileSync(output,'utf8')) as LWEngineExport.Document;assert.deepEqual(data.pack,pack);assert(data.sources.files.length>300);const checked=run(['engine-export-validate',output]);assert.equal(checked.status,0);assert.equal(checked.out.ok,true);assert.equal(checked.out.sourceIdentity,data.sourceIdentity);});
test('Tampered source validation returns1 with structured errors and unchanged source',()=>{const data=JSON.parse(fs.readFileSync(output,'utf8')) as LWEngineExport.Document;data.sources.files[0]!.text+='changed';const invalid=path.join(directory,'invalid.engine.json');fs.writeFileSync(invalid,JSON.stringify(data));const before=fs.readFileSync(invalid,'utf8'),checked=run(['engine-export-validate',invalid]);assert.equal(checked.status,1);assert.equal(checked.out.ok,false);assert(Array.isArray(checked.out.errors));assert.equal(fs.readFileSync(invalid,'utf8'),before);});
test('Input alias, malformed input and bad usage return2 while retaining prior output',()=>{const before=fs.readFileSync(output,'utf8');assert.equal(run(['engine-export',input,pack.scenes[0]!.id,input]).status,2);assert.deepEqual(JSON.parse(fs.readFileSync(input,'utf8')),pack);const bad=path.join(directory,'bad.json');fs.writeFileSync(bad,'{');assert.equal(run(['engine-export-validate',bad]).status,1);assert.equal(run(['engine-export',bad,'missing',output]).status,2);assert.equal(run(['engine-export',input]).status,2);assert.equal(fs.readFileSync(output,'utf8'),before);assert.deepEqual(fs.readdirSync(directory).filter(name=>name.endsWith('.tmp')),[]);});
test('Cold engine CLI reports runtime bootstrap failures as one JSON diagnostic',()=>{
 const runtime=path.join(directory,'runtime');fs.cpSync(__dirname,runtime,{recursive:true});fs.writeFileSync(path.join(runtime,'content/balancing.json'),'{');
 const destination=path.join(directory,'retained.json');fs.writeFileSync(destination,'retain output');
 for(const args of [['engine-export',input,pack.scenes[0]!.id,destination],['engine-export-validate',output]]){
  const child=spawnSync(process.execPath,[path.join(runtime,'tools/scenario-cli.cjs'),...args],{encoding:'utf8',timeout:30000});assert.equal(child.status,2);assert.equal(child.stderr,'');const diagnostic=JSON.parse(child.stdout) as {ok:boolean;errors:string[]};assert.equal(diagnostic.ok,false);assert.equal(diagnostic.errors.length,1);assert(diagnostic.errors[0]);
 }
 assert.equal(fs.readFileSync(destination,'utf8'),'retain output');
 const help=spawnSync(process.execPath,[path.join(runtime,'tools/scenario-cli.cjs'),'--help'],{encoding:'utf8',timeout:30000});assert.equal(help.status,0);assert.equal(help.stderr,'');assert.equal(JSON.parse(help.stdout).ok,true);
 fs.rmSync(runtime,{recursive:true,force:true});
});
test('Engine export rejects input symlink and hardlink destinations without publishing',()=>{
 const before=fs.readFileSync(input);for(const kind of ['symlink','hardlink']){const alias=path.join(directory,kind+'.json');if(kind==='symlink')fs.symlinkSync(input,alias);else fs.linkSync(input,alias);const result=run(['engine-export',input,pack.scenes[0]!.id,alias]);assert.equal(result.status,2);assert.equal(result.out.ok,false);assert.deepEqual(fs.readFileSync(input),before);assert.deepEqual(fs.readFileSync(alias),before);}
 assert(!fs.readdirSync(directory).some(name=>name.endsWith('.tmp')));
});
const report={suite:'engine-export-cli',passed:results.filter(result=>result.passed).length,total:results.length,results};fs.writeFileSync(path.join(__dirname,'engine-export-cli-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(results.some(result=>!result.passed))process.exitCode=1;
