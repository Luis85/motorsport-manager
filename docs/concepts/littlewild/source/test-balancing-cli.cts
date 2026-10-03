/// <reference path="./balancing-tools-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {toolbox} from './developer-sdk.cjs';
const root=globalThis as unknown as {LWScenarios:LWContentPorts.ScenarioApi};
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'littlewild-balancing-cli-')),pack=root.LWScenarios.builtins()[0]!,scene=pack.scenes[0]!.id,base=path.join(dir,'base.json'),balance=path.join(dir,'balancing.json'),options=path.join(dir,'options.json');
const document=toolbox.balancing.capture(pack,scene);document.simulation.rules.gameplay!.care={...document.simulation.rules.gameplay!.care,feedBerry:65};fs.writeFileSync(base,JSON.stringify(pack));fs.writeFileSync(balance,JSON.stringify(document));fs.writeFileSync(options,JSON.stringify({sceneId:scene,seed:111,steps:10}));
function cli(args:string[]):{status:number|null;data:Record<string,unknown>}{const result=spawnSync(process.execPath,[path.join(__dirname,'tools/balancing-cli.cjs'),...args],{encoding:'utf8',timeout:30000});assert.equal(result.error,undefined);assert.equal(result.stderr,'');return {status:result.status,data:JSON.parse(result.stdout) as Record<string,unknown>};}
try{
 test('Real CLI validates, diffs, reviews and atomically applies a complete tuned pack',()=>{assert.equal(cli(['validate',balance,base]).status,0);const review=cli(['review',base,balance]);assert.equal(review.status,0);const out=path.join(dir,'tuned.pack.json');assert.equal(cli(['apply',base,balance,out]).status,0);const admitted=JSON.parse(fs.readFileSync(out,'utf8')) as LWContentPorts.ScenarioPack;assert.equal(admitted.simulation.rules.gameplay!.care.feedBerry,65);assert(root.LWScenarios.validate(admitted).ok);});
 test('Real CLI runs deterministic probes and bounded sweeps with JSON metric tables',()=>{const first=cli(['probe',base,balance,options]),second=cli(['probe',base,balance,options]);assert.equal(first.status,0);assert.deepEqual(first.data,second.data);fs.writeFileSync(options,JSON.stringify({sceneId:scene,seed:111,steps:10,path:'/simulation/rules/gameplay/care/feedBerry',values:[20,65,101]}));const sweep=cli(['sweep',base,balance,options]);assert.equal(sweep.status,1);assert.equal((sweep.data.result as unknown[]).length,3);});
 test('CLI invalid input, syntax and output aliases leave original data untouched',()=>{const original=fs.readFileSync(base,'utf8');assert.equal(cli(['apply',base,balance,base]).status,1);assert.equal(fs.readFileSync(base,'utf8'),original);assert.equal(cli(['unknown']).status,1);const invalid=path.join(dir,'invalid.json');fs.writeFileSync(invalid,'{}');assert.equal(cli(['validate',invalid,base]).status,1);assert(!fs.readdirSync(dir).some(name=>name.endsWith('.tmp')));});
 test('Cold balancing CLI retains JSON diagnostics and help when bundled defaults fail to load',()=>{
  const runtime=path.join(dir,'runtime');fs.cpSync(__dirname,runtime,{recursive:true});fs.writeFileSync(path.join(runtime,'content/balancing.json'),'{');
  const output=path.join(dir,'retained.json');fs.writeFileSync(output,'retain output');
  for(const args of [['defaults'],['apply',base,balance,output]]){
   const child=spawnSync(process.execPath,[path.join(runtime,'tools/balancing-cli.cjs'),...args],{encoding:'utf8',timeout:30000});assert.equal(child.status,1);assert.equal(child.stderr,'');const diagnostic=JSON.parse(child.stdout) as {ok:boolean;errors:string[]};assert.equal(diagnostic.ok,false);assert.equal(diagnostic.errors.length,1);assert(diagnostic.errors[0]);
  }
  for(const args of [[],['--help'],['-h']]){const child=spawnSync(process.execPath,[path.join(runtime,'tools/balancing-cli.cjs'),...args],{encoding:'utf8',timeout:30000});assert.equal(child.status,0);assert.equal(child.stderr,'');assert.equal(JSON.parse(child.stdout).ok,true);}
  const usage=spawnSync(process.execPath,[path.join(runtime,'tools/balancing-cli.cjs'),'apply','missing'],{encoding:'utf8',timeout:30000});assert.equal(usage.status,1);assert.equal(usage.stderr,'');assert.match(JSON.parse(usage.stdout).errors[0],/balancing-cli defaults/);
  assert.equal(fs.readFileSync(output,'utf8'),'retain output');
 });
 test('Balancing writers reject symbolic and hard aliases of every input',()=>{
  for(const input of [base,balance])for(const kind of ['symlink','hardlink']){
   const before=fs.readFileSync(input),alias=path.join(dir,path.basename(input)+'.'+kind);if(kind==='symlink')fs.symlinkSync(input,alias);else fs.linkSync(input,alias);
   for(const args of [['apply',base,balance,alias],['new-pack',balance,alias,base]]){const result=cli(args);assert.equal(result.status,1);assert.equal(result.data.ok,false);assert.deepEqual(fs.readFileSync(input),before);assert.deepEqual(fs.readFileSync(alias),before);}
  }
  assert(!fs.readdirSync(dir).some(name=>name.endsWith('.tmp')));
 });
}finally{fs.rmSync(dir,{recursive:true,force:true});}
const report={suite:'balancing-cli',passed:results.filter(r=>r.passed).length,total:results.length,results};fs.writeFileSync(path.join(__dirname,'balancing-cli-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(results.some(r=>!r.passed))process.exitCode=1;
