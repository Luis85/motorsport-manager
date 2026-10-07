import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const cli=path.join(__dirname,'tools/wildlands-cli.cjs'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'wildlands-cli-')),results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
function run(args:string[],entry=cli):{status:number|null;out:Record<string,unknown>}{const child=spawnSync(process.execPath,[entry,...args],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});if(child.error)throw child.error;assert.equal(child.stderr,'');return {status:child.status,out:JSON.parse(child.stdout) as Record<string,unknown>};}
const project=path.join(directory,'project.json'),output=path.join(directory,'played.json'),recipe=path.join(directory,'recipe.json');
fs.writeFileSync(recipe,JSON.stringify({format:'wildlands-recipe',schemaVersion:1,operations:[{operation:'start'},{operation:'advance',seconds:1}]}));
test('Cold help and discovery are structured, versioned and machine readable',()=>{
 const help=run(['--help']);assert.equal(help.status,0);assert.equal(help.out.protocolVersion,1);assert(help.out.usage);assert.equal(help.out.handbook,'docs/reference/wildlands-cli.md');
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8')) as {name:string;version:string},version=run(['--version']);assert.equal(version.status,0);assert.deepEqual(version.out,{ok:true,protocolVersion:1,name:manifest.name,version:manifest.version});assert.equal(run(['--version','extra']).status,2);
 const discovery=run(['discover']);assert.equal(discovery.status,0);assert.equal(discovery.out.protocolVersion,1);assert.equal(discovery.out.defaultScenario,'littlewild');assert(Array.isArray(discovery.out.commands));assert(Array.isArray(discovery.out.operations));
 if(process.platform!=='win32'){const executable=spawnSync(cli,['discover'],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});assert.ifError(executable.error);assert.equal(executable.status,0,executable.stderr);assert.deepEqual(JSON.parse(executable.stdout),discovery.out);}
 const scenarios=run(['scenarios']);assert.equal(scenarios.status,0);assert.deepEqual((scenarios.out.scenarios as {id:string}[]).map(value=>value.id),['littlewild','emberworks','office']);
});
test('Create validates a complete default portable project and inspect never ticks',()=>{
 const created=run(['create','--output',project]);assert.equal(created.status,0);assert.equal(created.out.scenarioId,'littlewild');assert.equal(created.out.sceneId,'first-morning');assert.equal(run(['validate','--project',project]).status,0);
 const first=run(['inspect','--project',project]),second=run(['inspect','--project',project]);assert.equal(first.status,0);assert.deepEqual(first.out,second.out);assert.equal((first.out.snapshot as {simTime:number}).simTime,0);
});
test('Scenario switching and custom pack authoring stay portable',()=>{
 const office=path.join(directory,'office.json');assert.equal(run(['scenario','--project',project,'--scenario','office','--output',office]).status,0);assert.equal(run(['validate','--project',office]).out.scenarioId,'office');
 const doc=JSON.parse(fs.readFileSync(project,'utf8')) as Wildlands.Project,packFile=path.join(directory,'custom.pack.json'),custom=path.join(directory,'custom.json');doc.pack.id='custom-prototype';fs.writeFileSync(packFile,JSON.stringify(doc.pack));assert.equal(run(['create','--pack',packFile,'--output',custom]).status,0);assert.equal(run(['validate','--project',custom]).out.scenarioId,'custom-prototype');
});
test('Explicit recipes advance the real simulation and publish a complete output',()=>{
 const before=fs.readFileSync(project),played=run(['run','--project',project,'--recipe',recipe,'--output',output]);assert.equal(played.status,0);assert.equal(played.out.requestedSteps,10);assert(Math.abs(Number(played.out.advancedSeconds)-1)<1e-9);assert.deepEqual(fs.readFileSync(project),before);assert.equal(run(['validate','--project',output]).status,0);
 const editorRecipe=path.join(directory,'editor.json'),edited=path.join(directory,'edited.json');fs.writeFileSync(editorRecipe,JSON.stringify({format:'wildlands-editor-recipe',schemaVersion:1,operations:[{operation:'updateScene',args:['first-morning',{name:'Terminal meadow'}]}]}));assert.equal(run(['edit','--project',project,'--recipe',editorRecipe,'--output',edited]).status,0);assert.equal((JSON.parse(fs.readFileSync(edited,'utf8')) as Wildlands.Project).pack.scenes[0]!.name,'Terminal meadow');
});
test('Project fingerprints identify complete content independent of key order and command',()=>{
 const fingerprint=(file:string):string=>{const checked=run(['validate','--project',file]);assert.equal(checked.status,0);assert.match(String(checked.out.fingerprint),/^[0-9a-f]{16}$/);return String(checked.out.fingerprint);};
 const base=fingerprint(project),inspected=run(['inspect','--project',project]);assert.equal(inspected.status,0);assert.equal(inspected.out.fingerprint,base);assert.equal(fingerprint(project),base);
 const recreated=path.join(directory,'recreated.json');assert.equal(run(['create','--output',recreated]).status,0);assert.equal(fingerprint(recreated),base);
 const reorder=(value:unknown):unknown=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,entry])=>[key,reorder(entry)])):value;
 const reordered=path.join(directory,'reordered.json'),source=fs.readFileSync(project,'utf8');fs.writeFileSync(reordered,JSON.stringify(reorder(JSON.parse(source)),null,1));assert.notEqual(fs.readFileSync(reordered,'utf8'),source);assert.equal(fingerprint(reordered),base);
 const renamed=path.join(directory,'renamed.json'),scene=path.join(directory,'scene.json');assert.equal(run(['create','--name','Renamed prototype','--output',renamed]).status,0);assert.equal(run(['create','--scene','charted-home','--output',scene]).status,0);
 const variants=[renamed,scene,path.join(directory,'office.json'),output,path.join(directory,'edited.json')].map(fingerprint);
 assert.equal(new Set([base,...variants]).size,variants.length+1);
});
test('Malformed arguments and bounded recipe failures retain prior published output',()=>{
 const before=fs.readFileSync(output),invalid=path.join(directory,'invalid-recipe.json');fs.writeFileSync(invalid,JSON.stringify({format:'wildlands-recipe',schemaVersion:1,operations:[{operation:'advance',seconds:.15}]}));
 for(const args of [['create','--output',output,'--unknown','x'],['create','--output',output,'--output',output],['run','--project',project,'--recipe',invalid,'--output',output],['scenario','--project',project,'--scenario','missing','--output',output]]){const result=run(args);assert.equal(result.status,2);assert.equal(result.out.ok,false);}
 assert.deepEqual(fs.readFileSync(output),before);assert(!fs.readdirSync(directory).some(value=>value.endsWith('.tmp')));
});
test('Invalid semantic project returns exit 1 without touching files',()=>{
 const bad=path.join(directory,'invalid.json'),doc=JSON.parse(fs.readFileSync(project,'utf8')) as Wildlands.Project;doc.scenarioId='office';fs.writeFileSync(bad,JSON.stringify(doc));const checked=run(['validate','--project',bad]);assert.equal(checked.status,1);assert.equal(checked.out.code,'invalid-project');assert(Array.isArray(checked.out.errors));
});
test('Input aliases and symlink aliases are rejected without overwriting authority',()=>{
 const before=fs.readFileSync(project);assert.equal(run(['scenario','--project',project,'--scenario','office','--output',project]).status,2);
 for(const link of ['hardlink','symlink']){const alias=path.join(directory,link+'.json');if(link==='symlink')fs.symlinkSync(project,alias);else fs.linkSync(project,alias);assert.equal(run(['scenario','--project',project,'--scenario','office','--output',alias]).status,2);assert.deepEqual(fs.readFileSync(project),before);}
});
test('Bootstrap errors remain one structured diagnostic while help remains available',()=>{
 const runtime=path.join(directory,'broken-runtime');fs.cpSync(__dirname,runtime,{recursive:true});fs.writeFileSync(path.join(runtime,'content/balancing.json'),'{');const broken=path.join(runtime,'tools/wildlands-cli.cjs');assert.equal(run(['--help'],broken).status,0);const failure=run(['discover'],broken);assert.equal(failure.status,2);assert.equal(failure.out.ok,false);assert.equal((failure.out.errors as string[]).length,1);fs.rmSync(runtime,{recursive:true,force:true});
});
/** Every file of a compiled directory by relative path and SHA-256. */
function tree(root:string):Record<string,string>{
 const out:Record<string,string>={},visit=(directory:string):void=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1)){const file=path.join(directory,entry.name);if(entry.isDirectory())visit(file);else out[path.relative(root,file).replaceAll(path.sep,'/')]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');}};
 visit(root);return out;
}
/** Drive the compiled project's own runtime exactly as native/bridge.gd launches it. */
function bridge(root:string,requests:Record<string,unknown>[]):{id:number;ok:boolean;result?:Record<string,unknown>;error?:{code:string;message:string}}[]{
 const input=[...requests,{method:'shutdown',params:{}}].map((request,index)=>JSON.stringify({id:index+1,...request})).join('\n')+'\n';
 const child=spawnSync(process.execPath,[path.join(root,'runtime/tools/wildlands-runtime.cjs'),'--project',path.join(root,'wildlands.project.json'),'--stdio'],{cwd:root,input,encoding:'utf8',timeout:120000,maxBuffer:256*1024*1024});
 assert.ifError(child.error);assert.equal(child.status,0,child.stderr);assert.equal(child.stderr,'');
 return child.stdout.trim().split('\n').map(line=>JSON.parse(line) as {id:number;ok:boolean;result?:Record<string,unknown>;error?:{code:string;message:string}});
}
const godot=path.join(directory,'godot'),godotSources=path.join(directory,'godot-sources');
const runtimeBundle=JSON.parse(fs.readFileSync(path.join(__dirname,'wildlands-runtime-bundle.json'),'utf8')) as {files:{path:string}[]};
test('Default compile writes a runnable Godot project without the engine-source payload',()=>{
 const compiled=run(['compile','--project',project,'--output',godot]);assert.equal(compiled.status,0,JSON.stringify(compiled.out));assert.equal(compiled.out.engineSources,false);
 const files=Object.keys(tree(godot)),runtime=files.filter(file=>file.startsWith('runtime/')).sort();
 assert.deepEqual(runtime,runtimeBundle.files.map(file=>file.path).sort());assert.equal(compiled.out.files,files.length);
 for(const absent of ['runtime/engine-source-bundle.json','runtime/scenario-v3-grown.json','runtime/ui.js','runtime/world-3d.js','runtime/wildlands-godot.js'])assert(!files.includes(absent),absent);
 for(const present of ['project.godot','main.tscn','native/bridge.gd','wildlands.project.json','wildlands.manifest.json','runtime/tools/wildlands-runtime.cjs','runtime/developer-sdk.cjs'])assert(files.includes(present),present);
 const manifest=JSON.parse(fs.readFileSync(path.join(godot,'wildlands.manifest.json'),'utf8')) as {capabilities:string[];limitations:string[];files:{path:string}[]};
 assert(manifest.limitations.some(value=>value.includes('Engine-source payload omitted')));assert(!manifest.capabilities.some(value=>value.includes('engine-source')));assert.equal(manifest.files.length,files.length-1);
 const doc=JSON.parse(fs.readFileSync(project,'utf8')) as Wildlands.Project;
 const replies=bridge(godot,[{method:'discover',params:{}},{method:'inspect',params:{}},{method:'start',params:{}},{method:'step',params:{count:10}},{method:'pause',params:{}},{method:'storytelling.inspect',params:{}},{method:'save',params:{}},{method:'tools.call',params:{facet:'renderers',method:'list',args:[]}},{method:'tools.call',params:{facet:'externalEditors',method:'formats',args:[]}},{method:'tools.call',params:{facet:'balancing',method:'defaults',args:[]}},{method:'tools.call',params:{facet:'engineExport',method:'export',args:[doc.pack,doc.sceneId]}}]);
 for(const reply of replies.slice(0,10))assert.equal(reply.ok,true,JSON.stringify(reply.error));
 assert.equal(replies[10]!.ok,false);assert.match(replies[10]!.error!.message,/engine-source payload is not included/);assert.equal(replies.at(-1)!.ok,true);
});
test('Opt-in --with-engine-sources adds the exact engine-source bundle and enables engine export in the compiled runtime',()=>{
 const compiled=run(['compile','--project',project,'--output',godotSources,'--with-engine-sources']);assert.equal(compiled.status,0,JSON.stringify(compiled.out));assert.equal(compiled.out.engineSources,true);
 const engine=fs.readFileSync(path.join(__dirname,'engine-source-bundle.json')),files=tree(godotSources),plain=tree(godot);
 assert(fs.readFileSync(path.join(godotSources,'runtime/engine-source-bundle.json')).equals(engine));
 assert.deepEqual(Object.keys(files).filter(file=>!(file in plain)),['runtime/engine-source-bundle.json']);
 for(const [file,hash] of Object.entries(plain))if(file!=='wildlands.manifest.json')assert.equal(files[file],hash,file);
 const manifest=JSON.parse(fs.readFileSync(path.join(godotSources,'wildlands.manifest.json'),'utf8')) as {capabilities:string[];limitations:string[];files:{path:string;sha256:string}[]};
 assert(manifest.capabilities.some(value=>value.includes('engine-source')));assert(!manifest.limitations.some(value=>value.includes('Engine-source payload omitted')));
 assert.equal(manifest.files.find(file=>file.path==='runtime/engine-source-bundle.json')?.sha256,createHash('sha256').update(engine).digest('hex'));
 const doc=JSON.parse(fs.readFileSync(project,'utf8')) as Wildlands.Project,identity=(JSON.parse(engine.toString()) as {identity:string}).identity;
 const [exported]=bridge(godotSources,[{method:'tools.call',params:{facet:'engineExport',method:'export',args:[doc.pack,doc.sceneId]}}]);
 assert.equal(exported!.ok,true,JSON.stringify(exported!.error));assert.equal(exported!.result!.sourceIdentity,identity);
});
test('Godot compilation is deterministic and the engine-source switch is a strict value-less flag',()=>{
 const again=path.join(directory,'godot-again'),againSources=path.join(directory,'godot-sources-again');
 assert.equal(run(['compile','--project',project,'--output',again]).status,0);assert.deepEqual(tree(again),tree(godot));
 assert.equal(run(['export','--project',project,'--output',againSources,'--with-engine-sources']).status,0);assert.deepEqual(tree(againSources),tree(godotSources));
 for(const args of [['compile','--project',project,'--output',path.join(directory,'godot-bad-1'),'--with-engine-sources','true'],['compile','--with-engine-sources','--project',project,'--output',path.join(directory,'godot-bad-2'),'--with-engine-sources'],['validate','--project',project,'--with-engine-sources']]){
  const result=run(args);assert.equal(result.status,2,JSON.stringify(result.out));assert.equal(result.out.ok,false);
 }
 assert(!fs.existsSync(path.join(directory,'godot-bad-1')));assert(!fs.existsSync(path.join(directory,'godot-bad-2')));
});
const report={suite:'wildlands-cli',passed:results.filter(value=>value.passed).length,total:results.length,results};fs.writeFileSync(path.join(__dirname,'wildlands-cli-results.json'),JSON.stringify(report,null,2));fs.rmSync(directory,{recursive:true,force:true});console.log(JSON.stringify(report));if(results.some(value=>!value.passed))process.exitCode=1;
