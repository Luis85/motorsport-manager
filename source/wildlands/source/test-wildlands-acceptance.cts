/// <reference path="./wildlands-project-contracts.d.ts" />
// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'wildlands-acceptance-'));
const cli=path.join(__dirname,'tools/wildlands-cli.cjs');
const results:{name:string;passed:boolean;error?:string}[]=[];
function check(name:string,work:()=>void):void{
 try{work();results.push({name,passed:true});}
 catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}
}
function run(args:readonly string[],expected=0):Record<string,unknown>{
 const result=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
 assert.equal(result.error,undefined);assert.equal(result.stderr,'');
 assert.equal(result.status,expected,result.stdout);
 const output=JSON.parse(result.stdout) as Record<string,unknown>;
 assert.equal(output.protocolVersion,1);assert.equal(output.ok,expected===0);
 return output;
}
function read(file:string):Wildlands.Project{return JSON.parse(fs.readFileSync(file,'utf8')) as Wildlands.Project;}
const original=path.join(temporary,'default.wildlands.json');
check('A new terminal project preloads Littlewild and discovery describes its actual commands',()=>{
 const discovery=run(['discover']);assert.equal(discovery.name,'wildlands');assert.equal(discovery.defaultScenario,'littlewild');
 const operations=discovery.operations as {operation:string}[];
 for(const operation of ['create','inspect','validate','scenario','run','edit','compile'])assert(operations.some(row=>row.operation===operation));
 run(['create','--output',original]);const project=read(original);
 assert.equal(project.scenarioId,'littlewild');assert.equal(project.target,'godot');
 assert.equal(project.sceneId,project.pack.scenes[0]!.id);
 const inspected=run(['inspect','--project',original]),validated=run(['validate','--project',original]);
 assert.equal(inspected.fingerprint,validated.fingerprint);
});
check('Every discovered built-in scenario compiles complete resources with verified manifest hashes',()=>{
 const scenarios=run(['scenarios']).scenarios as {id:string;scenes:{id:string}[]}[];
 assert.deepEqual(scenarios.map(row=>row.id).sort(),['emberworks','littlewild','office']);
 for(const scenario of scenarios){
  const selected=path.join(temporary,scenario.id+'.json'),directory=path.join(temporary,'godot-'+scenario.id);
  run(['scenario','--project',original,'--scenario',scenario.id,'--scene',scenario.scenes[0]!.id,'--output',selected]);
  const result=run(['compile','--project',selected,'--output',directory]);assert.equal(result.output,directory);
  assert.deepEqual(read(path.join(directory,'wildlands.project.json')),read(selected));
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,'wildlands.manifest.json'),'utf8')) as {scenarioId:string;files:{path:string;bytes:number;sha256:string}[];runtime:string;limitations:string[]};
  assert.equal(manifest.scenarioId,scenario.id);assert.equal(manifest.runtime,'typescript-node-bridge');assert(manifest.limitations.length>0);
  for(const file of manifest.files){
   const content=fs.readFileSync(path.join(directory,file.path));assert.equal(content.length,file.bytes,file.path);
   assert.equal(crypto.createHash('sha256').update(content).digest('hex'),file.sha256,file.path);
  }
  assert(manifest.files.some(file=>file.path==='project.godot'));
  assert(manifest.files.some(file=>file.path==='runtime/tools/wildlands-runtime.cjs'));
  assert(fs.readFileSync(path.join(directory,'project.godot'),'utf8').includes('run/main_scene="res://main.tscn"'));
 }
});
check('Repeated bounded recipes produce the same game state without changing the source project',()=>{
 const source=fs.readFileSync(original),recipe=path.join(temporary,'one-second.json');
 fs.writeFileSync(recipe,JSON.stringify({format:'wildlands-recipe',schemaVersion:1,operations:[{operation:'start'},{operation:'advance',seconds:1},{operation:'inspect'}]}));
 const left=path.join(temporary,'run-left.json'),right=path.join(temporary,'run-right.json');
 const a=run(['run','--project',original,'--recipe',recipe,'--output',left]);
 const b=run(['run','--project',original,'--recipe',recipe,'--output',right]);
 assert.equal(a.requestedSteps,10);assert.equal(b.requestedSteps,10);
 assert(Math.abs(Number(a.advancedSeconds)-1)<1e-9);assert(Math.abs(Number(b.advancedSeconds)-1)<1e-9);
 assert.deepEqual(a.snapshot,b.snapshot);
 assert.deepEqual(read(left),read(right));assert.deepEqual(fs.readFileSync(original),source);
 run(['validate','--project',left]);
});
check('Scene editor recipes change authored data through the same portable validation boundary',()=>{
 const project=read(original),recipe=path.join(temporary,'scene-edit.json'),output=path.join(temporary,'edited.json');
 fs.writeFileSync(recipe,JSON.stringify({format:'wildlands-editor-recipe',schemaVersion:1,operations:[{operation:'updateScene',args:[project.sceneId,{name:'Agent authored meadow'}]}]}));
 run(['edit','--project',original,'--recipe',recipe,'--output',output]);
 assert.equal(read(output).pack.scenes.find(scene=>scene.id===project.sceneId)!.name,'Agent authored meadow');
 assert.notEqual(project.pack.scenes.find(scene=>scene.id===project.sceneId)!.name,'Agent authored meadow');
 run(['validate','--project',output]);
});
check('Invalid projects and malformed flags produce one JSON diagnostic and preserve prior output',()=>{
 const bad=path.join(temporary,'invalid.json'),retained=path.join(temporary,'retained.json');fs.writeFileSync(retained,'retain');
 const project=read(original);fs.writeFileSync(bad,JSON.stringify({...project,target:'unimplemented'}));
 assert(Array.isArray(run(['validate','--project',bad],1).errors));
 run(['create','--scenario','missing','--output',retained],2);
 run(['create','--output',retained,'--output',retained],2);
 run(['create','--output',retained,'--unexpected','true'],2);
 assert.equal(fs.readFileSync(retained,'utf8'),'retain');
});
check('Rejected editor and clock recipes cannot publish partial edits',()=>{
 const recipe=path.join(temporary,'rejected.json'),output=path.join(temporary,'rejected-output.json');fs.writeFileSync(output,'retain');
 fs.writeFileSync(recipe,JSON.stringify({format:'wildlands-editor-recipe',schemaVersion:1,operations:[{operation:'updateScene',args:[read(original).sceneId,{name:'Must not publish'}]},{operation:'constructor',args:[]}]}));
 run(['edit','--project',original,'--recipe',recipe,'--output',output],2);
 fs.writeFileSync(recipe,JSON.stringify({format:'wildlands-recipe',schemaVersion:1,operations:[{operation:'start'},{operation:'step',count:36001}]}));
 run(['run','--project',original,'--recipe',recipe,'--output',output],2);
 assert.equal(fs.readFileSync(output,'utf8'),'retain');
});
check('CLI refuses input aliases and compiled directory replacement',()=>{
 const project=fs.readFileSync(original);run(['scenario','--project',original,'--scenario','office','--output',original],2);
 assert.deepEqual(fs.readFileSync(original),project);
 const directory=path.join(temporary,'godot-office'),before=fs.readFileSync(path.join(directory,'wildlands.project.json'));
 run(['compile','--project',original,'--output',directory],2);
 assert.deepEqual(fs.readFileSync(path.join(directory,'wildlands.project.json')),before);
 assert(!fs.readdirSync(temporary).some(file=>file.includes('.wildlands-')));
});
fs.rmSync(temporary,{recursive:true,force:true});
const report={suite:'wildlands-acceptance',passed:results.filter(row=>row.passed).length,total:results.length,results};
fs.writeFileSync(path.join(__dirname,'wildlands-acceptance-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));if(results.some(row=>!row.passed))process.exitCode=1;
