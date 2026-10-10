// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {gameDirectory} from './tools/game-folder.cjs';
import {engineOnlySources} from './tools/engine-sources.cjs';
import {colonyGame,gamesFixtureRoot,templateGame} from './test-support/game-fixtures.cjs';
import {creatureChecks} from './test-support/creature-cli-checks.cjs';
const cli=path.join(__dirname,'tools/wildlands-cli.cjs'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'wildlands-cli-')),results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
function run(args:string[],entry=cli):{status:number|null;out:Record<string,unknown>}{const child=spawnSync(process.execPath,[entry,...args],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});if(child.error)throw child.error;assert.equal(child.stderr,'');return {status:child.status,out:JSON.parse(child.stdout) as Record<string,unknown>};}
const littlewildGame=gameDirectory('littlewild'),games=gamesFixtureRoot('wildlands-cli-games-');
const project=path.join(directory,'project.json'),output=path.join(directory,'played.json'),recipe=path.join(directory,'recipe.json');
fs.writeFileSync(recipe,JSON.stringify({format:'wildlands-recipe',schemaVersion:1,operations:[{operation:'start'},{operation:'advance',seconds:1}]}));
const read=(file:string):Wildlands.Project=>JSON.parse(fs.readFileSync(file,'utf8')) as Wildlands.Project;
/** A colony game folder with a second complete scenario pack, for scenario switching. */
let meadows='';
test('Cold help and discovery are structured, versioned and machine readable',()=>{
 const help=run(['--help']);assert.equal(help.status,0);assert.equal(help.out.protocolVersion,1);assert(help.out.usage);assert.equal(help.out.handbook,'docs/reference/wildlands-cli.md');
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8')) as {name:string;version:string},version=run(['--version']);assert.equal(version.status,0);assert.deepEqual(version.out,{ok:true,protocolVersion:1,name:manifest.name,version:manifest.version});assert.equal(run(['--version','extra']).status,2);
 // The engine CLI has no built-in game: discovery names none unless --game selects a folder (D1).
 const discovery=run(['discover']);assert.equal(discovery.status,0);assert.equal(discovery.out.protocolVersion,1);assert.equal(discovery.out.projectSchemaVersion,2);assert.equal(discovery.out.game,null);assert(Array.isArray(discovery.out.commands));assert(Array.isArray(discovery.out.operations));
 if(process.platform!=='win32'){const executable=spawnSync(cli,['discover'],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});assert.ifError(executable.error);assert.equal(executable.status,0,executable.stderr);assert.deepEqual(JSON.parse(executable.stdout),discovery.out);}
 const withGame=run(['discover','--game',littlewildGame]);assert.equal((withGame.out.game as {id:string}).id,'littlewild');assert.equal((withGame.out.game as {defaultScenario:string}).defaultScenario,'littlewild');
 const scenarios=run(['scenarios','--game',littlewildGame]);assert.equal(scenarios.status,0);assert.equal(scenarios.out.game,'littlewild');assert.deepEqual((scenarios.out.scenarios as {id:string}[]).map(value=>value.id),['littlewild']);
});
test('Create validates a complete default portable project and inspect never ticks',()=>{
 const created=run(['create','--game',littlewildGame,'--output',project]);assert.equal(created.status,0);assert.equal(created.out.scenarioId,'littlewild');assert.equal(created.out.sceneId,'first-morning');assert.equal(created.out.schemaVersion,2);assert.equal(created.out.gameId,'littlewild');assert.equal(run(['validate','--project',project]).status,0);
 const first=run(['inspect','--project',project]),second=run(['inspect','--project',project]);assert.equal(first.status,0);assert.deepEqual(first.out,second.out);assert.equal((first.out.snapshot as {simTime:number}).simTime,0);
});
test('Scenario switching and custom pack authoring stay portable',()=>{
 const doc=read(project),second={...doc.pack,id:'second-meadow',name:'Second meadow'};
 meadows=colonyGame(games,'meadows',manifest=>{(manifest.content as {packs:string[]}).packs.push('content/second-meadow.pack.json');});
 fs.writeFileSync(path.join(meadows,'content/second-meadow.pack.json'),JSON.stringify(second,null,1)+'\n');
 const base=path.join(directory,'meadows.json'),office=path.join(directory,'office.json');assert.equal(run(['create','--game',meadows,'--output',base]).status,0);
 assert.deepEqual((run(['scenarios','--game',meadows]).out.scenarios as {id:string}[]).map(value=>value.id),['littlewild','second-meadow']);
 assert.equal(run(['scenario','--project',base,'--scenario','second-meadow','--output',office]).status,0);assert.equal(run(['validate','--project',office]).out.scenarioId,'second-meadow');assert.equal(read(office).game.id,'meadows');
 const packFile=path.join(directory,'custom.pack.json'),custom=path.join(directory,'custom.json');doc.pack.id='custom-prototype';fs.writeFileSync(packFile,JSON.stringify(doc.pack));assert.equal(run(['create','--game',littlewildGame,'--pack',packFile,'--output',custom]).status,0);assert.equal(run(['validate','--project',custom]).out.scenarioId,'custom-prototype');
});
test('Explicit recipes advance the real simulation and publish a complete output',()=>{
 const before=fs.readFileSync(project),played=run(['run','--project',project,'--recipe',recipe,'--output',output]);assert.equal(played.status,0);assert.equal(played.out.requestedSteps,10);assert(Math.abs(Number(played.out.advancedSeconds)-1)<1e-9);assert.deepEqual(fs.readFileSync(project),before);assert.equal(run(['validate','--project',output]).status,0);
 const editorRecipe=path.join(directory,'editor.json'),edited=path.join(directory,'edited.json');fs.writeFileSync(editorRecipe,JSON.stringify({format:'wildlands-editor-recipe',schemaVersion:1,operations:[{operation:'updateScene',args:['first-morning',{name:'Terminal meadow'}]}]}));assert.equal(run(['edit','--project',project,'--recipe',editorRecipe,'--output',edited]).status,0);assert.equal(read(edited).pack.scenes[0]!.name,'Terminal meadow');
});
test('Project fingerprints identify complete content independent of key order and command',()=>{
 const fingerprint=(file:string):string=>{const checked=run(['validate','--project',file]);assert.equal(checked.status,0);assert.match(String(checked.out.fingerprint),/^[0-9a-f]{16}$/);return String(checked.out.fingerprint);};
 const base=fingerprint(project),inspected=run(['inspect','--project',project]);assert.equal(inspected.status,0);assert.equal(inspected.out.fingerprint,base);assert.equal(fingerprint(project),base);
 const recreated=path.join(directory,'recreated.json');assert.equal(run(['create','--game',littlewildGame,'--output',recreated]).status,0);assert.equal(fingerprint(recreated),base);
 const reorder=(value:unknown):unknown=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,entry])=>[key,reorder(entry)])):value;
 const reordered=path.join(directory,'reordered.json'),source=fs.readFileSync(project,'utf8');fs.writeFileSync(reordered,JSON.stringify(reorder(JSON.parse(source)),null,1));assert.notEqual(fs.readFileSync(reordered,'utf8'),source);assert.equal(fingerprint(reordered),base);
 const renamed=path.join(directory,'renamed.json'),scene=path.join(directory,'scene.json');assert.equal(run(['create','--game',littlewildGame,'--name','Renamed prototype','--output',renamed]).status,0);assert.equal(run(['create','--game',littlewildGame,'--scene','charted-home','--output',scene]).status,0);
 // The embedded game is part of the document: the same pack from another game folder differs.
 const variants=[renamed,scene,path.join(directory,'office.json'),path.join(directory,'meadows.json'),output,path.join(directory,'edited.json')].map(fingerprint);
 assert.equal(new Set([base,...variants]).size,variants.length+1);
});
test('Malformed arguments and bounded recipe failures retain prior published output',()=>{
 const before=fs.readFileSync(output),invalid=path.join(directory,'invalid-recipe.json');fs.writeFileSync(invalid,JSON.stringify({format:'wildlands-recipe',schemaVersion:1,operations:[{operation:'advance',seconds:.15}]}));
 for(const args of [['create','--game',littlewildGame,'--output',output,'--unknown','x'],['create','--game',littlewildGame,'--output',output,'--output',output],['run','--project',project,'--recipe',invalid,'--output',output],['scenario','--project',project,'--scenario','missing','--output',output]]){const result=run(args);assert.equal(result.status,2);assert.equal(result.out.ok,false);}
 assert.deepEqual(fs.readFileSync(output),before);assert(!fs.readdirSync(directory).some(value=>value.endsWith('.tmp')));
});
test('Invalid semantic project returns exit 1 without touching files',()=>{
 const bad=path.join(directory,'invalid.json'),doc=read(project);doc.scenarioId='office';fs.writeFileSync(bad,JSON.stringify(doc));const checked=run(['validate','--project',bad]);assert.equal(checked.status,1);assert.equal(checked.out.code,'invalid-project');assert(Array.isArray(checked.out.errors));
});
test('Input aliases and symlink aliases are rejected without overwriting authority',()=>{
 // A valid selection, so the alias protection is what rejects these writes.
 const before=fs.readFileSync(project),select=(target:string)=>run(['scenario','--project',project,'--scenario','littlewild','--scene','charted-home','--output',target]);
 assert.equal(select(path.join(directory,'selected.json')).status,0);assert.equal(select(project).status,2);
 for(const link of ['hardlink','symlink']){const alias=path.join(directory,link+'.json');if(link==='symlink')fs.symlinkSync(project,alias);else fs.linkSync(project,alias);assert.equal(select(alias).status,2);assert.deepEqual(fs.readFileSync(project),before);}
});
test('Bootstrap errors remain one structured diagnostic while help remains available',()=>{
 // Break an engine-owned document: the engine itself fails to load, not a bundled game.
 const runtime=path.join(directory,'broken-runtime');fs.cpSync(__dirname,runtime,{recursive:true});fs.writeFileSync(path.join(runtime,'content/scenario.schema.json'),'{');const broken=path.join(runtime,'tools/wildlands-cli.cjs');assert.equal(run(['--help'],broken).status,0);const failure=run(['discover'],broken);assert.equal(failure.status,2);assert.equal(failure.out.ok,false);assert.equal((failure.out.errors as string[]).length,1);fs.rmSync(runtime,{recursive:true,force:true});
});
/** Every file of a compiled directory by relative path and SHA-256. */
function tree(root:string):Record<string,string>{
 const out:Record<string,string>={},visit=(directory:string):void=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1)){const file=path.join(directory,entry.name);if(entry.isDirectory())visit(file);else out[path.relative(root,file).replaceAll(path.sep,'/')]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');}};
 visit(root);return out;
}
type Reply={id:number;ok:boolean;result?:Record<string,unknown>;error?:{code:string;message:string}};
/** Drive the compiled project's own runtime exactly as native/bridge.gd launches it. */
function bridge(root:string,requests:Record<string,unknown>[]):Reply[]{
 const input=[...requests,{method:'shutdown',params:{}}].map((request,index)=>JSON.stringify({id:index+1,...request})).join('\n')+'\n';
 const child=spawnSync(process.execPath,[path.join(root,'runtime/tools/wildlands-runtime.cjs'),'--project',path.join(root,'wildlands.project.json'),'--stdio'],{cwd:root,input,encoding:'utf8',timeout:120000,maxBuffer:256*1024*1024});
 assert.ifError(child.error);assert.equal(child.status,0,child.stderr);assert.equal(child.stderr,'');
 return child.stdout.trim().split('\n').map(line=>JSON.parse(line) as Reply);
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
 const doc=read(project);
 const replies=bridge(godot,[{method:'discover',params:{}},{method:'inspect',params:{}},{method:'start',params:{}},{method:'step',params:{count:10}},{method:'pause',params:{}},{method:'storytelling.inspect',params:{}},{method:'save',params:{}},{method:'tools.call',params:{facet:'renderers',method:'list',args:[]}},{method:'tools.call',params:{facet:'externalEditors',method:'formats',args:[]}},{method:'tools.call',params:{facet:'balancing',method:'defaults',args:[]}},{method:'tools.call',params:{facet:'engineExport',method:'export',args:[doc.pack,doc.sceneId]}}]);
 for(const reply of replies.slice(0,10))assert.equal(reply.ok,true,JSON.stringify(reply.error));
 assert.equal(replies[10]!.ok,false);assert.match(replies[10]!.error!.message,/engine-source payload is not included/);assert.equal(replies.at(-1)!.ok,true);
});
test('Opt-in --with-engine-sources adds the exact engine-source bundle and enables engine export in the compiled runtime',()=>{
 const compiled=run(['compile','--project',project,'--output',godotSources,'--with-engine-sources']);assert.equal(compiled.status,0,JSON.stringify(compiled.out));assert.equal(compiled.out.engineSources,true);
 // The exact engine sources of this distribution: the build's bundled game folders are not shipped.
 const engine=Buffer.from(engineOnlySources(fs.readFileSync(path.join(__dirname,'engine-source-bundle.json'),'utf8'))),files=tree(godotSources),plain=tree(godot);
 assert(fs.readFileSync(path.join(godotSources,'runtime/engine-source-bundle.json')).equals(engine));
 assert(!(JSON.parse(engine.toString()) as {files:{path:string}[]}).files.some(file=>file.path.startsWith('games/')),'engine sources carry no game folder');
 assert.deepEqual(Object.keys(files).filter(file=>!(file in plain)),['runtime/engine-source-bundle.json']);
 for(const [file,hash] of Object.entries(plain))if(file!=='wildlands.manifest.json')assert.equal(files[file],hash,file);
 const manifest=JSON.parse(fs.readFileSync(path.join(godotSources,'wildlands.manifest.json'),'utf8')) as {capabilities:string[];limitations:string[];files:{path:string;sha256:string}[]};
 assert(manifest.capabilities.some(value=>value.includes('engine-source')));assert(!manifest.limitations.some(value=>value.includes('Engine-source payload omitted')));
 assert.equal(manifest.files.find(file=>file.path==='runtime/engine-source-bundle.json')?.sha256,createHash('sha256').update(engine).digest('hex'));
 const doc=read(project),identity=(JSON.parse(engine.toString()) as {identity:string}).identity;
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
test('Create, scenarios and legacy projects without --game fail with a game-required diagnostic naming the handbook',()=>{
 const legacy=path.join(directory,'legacy.json'),{game:_game,...rest}=read(project);fs.writeFileSync(legacy,JSON.stringify({...rest,schemaVersion:1}));
 const target=path.join(directory,'never.json');
 for(const args of [['create','--output',target],['scenarios'],['validate','--project',legacy],['compile','--project',legacy,'--output',path.join(directory,'godot-never')],['upgrade','--project',legacy,'--output',target]]){
  const result=run(args);assert.equal(result.status,2,args.join(' '));assert.equal(result.out.code,'game-required',args.join(' '));assert.equal(result.out.handbook,'docs/reference/wildlands-cli.md');
  assert.match((result.out.errors as string[])[0]!,/--game DIR/);assert.match((result.out.errors as string[])[0]!,/docs\/reference\/wildlands-cli\.md/);
 }
 assert(!fs.existsSync(target)&&!fs.existsSync(path.join(directory,'godot-never')));
 // A version 2 project carries its game: --game is refused instead of silently ignored.
 const embedded=run(['validate','--project',project,'--game',littlewildGame]);assert.equal(embedded.status,2);assert.equal(embedded.out.code,'game-embedded');
});
test('Legacy schemaVersion 1 projects validate with --game and upgrade or compile to self-contained schemaVersion 2 projects',()=>{
 const legacy=path.join(directory,'legacy.json'),upgraded=path.join(directory,'upgraded.json'),legacyGodot=path.join(directory,'godot-legacy');
 const checked=run(['validate','--project',legacy,'--game',littlewildGame]);assert.equal(checked.status,0);assert.equal(checked.out.schemaVersion,1);assert.equal(checked.out.gameId,'littlewild');
 assert.notEqual(checked.out.fingerprint,run(['validate','--project',project]).out.fingerprint);
 const result=run(['upgrade','--project',legacy,'--game',littlewildGame,'--output',upgraded]);assert.equal(result.status,0);assert.equal(result.out.schemaVersion,2);
 assert.deepEqual(read(upgraded),read(project));assert.equal(result.out.fingerprint,run(['validate','--project',project]).out.fingerprint);
 assert.equal(run(['compile','--project',legacy,'--game',littlewildGame,'--output',legacyGodot]).status,0);
 assert.deepEqual(read(path.join(legacyGodot,'wildlands.project.json')),read(project));assert.deepEqual(tree(legacyGodot),tree(godot));
 // The embedded profile must still pass the provider's admission.
 const tampered=path.join(directory,'tampered.json'),doc=read(project) as unknown as {game:{profile:Record<string,unknown>}};doc.game.profile.version=7;fs.writeFileSync(tampered,JSON.stringify(doc));
 const rejected=run(['validate','--project',tampered]);assert.equal(rejected.status,1);assert.equal(rejected.out.code,'invalid-project');assert.match((rejected.out.errors as string[])[0]!,/newer than this engine supports/);
});
const fixtures=new Map<string,string>();
test('validate-game and inspect-game report a game folder\'s identity, inventory and profile section sizes',()=>{
 const checked=run(['validate-game','--game',littlewildGame]);assert.equal(checked.status,0,JSON.stringify(checked.out));assert.deepEqual(Object.keys(checked.out).sort(),['digest','errors','id','ok','protocolVersion','template']);
 assert.equal(checked.out.id,'littlewild');assert.equal(checked.out.template,'colony');assert.match(String(checked.out.digest),/^[0-9a-f]{64}$/);assert.deepEqual(checked.out.errors,[]);
 for(const kind of ['rts','pet'] as const){const folder=templateGame(kind,games);fixtures.set(kind,folder);const result=run(['validate-game','--game',folder]);assert.equal(result.status,0,JSON.stringify(result.out));assert.equal(result.out.template,kind);}
 const inspected=run(['inspect-game','--game',littlewildGame]);assert.equal(inspected.status,0);assert.equal(inspected.out.digest,checked.out.digest);
 const inventory=inspected.out.inventory as {files:number;bytes:number;entries:{path:string;bytes:number}[]};assert.equal(inventory.files,inventory.entries.length);assert(inventory.entries.some(entry=>entry.path==='game.json'));
 assert.equal(inventory.bytes,inventory.entries.reduce((total,entry)=>total+entry.bytes,0));
 const sections=(inspected.out.profile as {sections:Record<string,number>}).sections;for(const section of ['balancing','librarySchema','creatures','assets','scenarios'])assert(sections[section]!>0,section);
 assert.deepEqual(Object.keys(inspected.out.builds as object),['play','studio']);assert.equal((inspected.out.builds as {play:{profile:string}}).play.profile,'colony-play');
 assert.deepEqual(Object.keys(run(['inspect-game','--game',fixtures.get('pet')!]).out.builds as object),['play']);
 // Rejected folders are exit 1 with the folder's own diagnostic; nothing is installed or written.
 const broken=colonyGame(games,'broken');fs.writeFileSync(path.join(broken,'content','stray.json'),'{}');
 for(const command of ['validate-game','inspect-game']){const result=run([command,'--game',broken]);assert.equal(result.status,1,command);assert.equal(result.out.code,'invalid-game');assert.match((result.out.errors as string[])[0]!,/not referenced by game\.json: content\/stray\.json/);}
 const invalid=colonyGame(games,'invalid');const balancing=path.join(invalid,'content','balancing.json'),value=JSON.parse(fs.readFileSync(balancing,'utf8')) as {simulation:{rules:{gameplay:Record<string,Record<string,unknown>>}}};
 const group=Object.keys(value.simulation.rules.gameplay)[0]!;value.simulation.rules.gameplay[group]!.unconsumedTuner=1;fs.writeFileSync(balancing,JSON.stringify(value,null,2)+'\n');
 const audited=run(['validate-game','--game',invalid]);assert.equal(audited.status,1);assert.equal(audited.out.id,'invalid');assert.match((audited.out.errors as string[])[0]!,/gameplay rules/);
});
const sha=(file:string):string=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
test('build-game builds deterministic play artifacts for colony, RTS and Pocket Pet folders and --check detects staleness',()=>{
 for(const [name,folder,profile] of [['littlewild',littlewildGame,'colony-play'],['rts',fixtures.get('rts')!,'rts-play'],['pet',fixtures.get('pet')!,'pet-play']] as const){
  const first=path.join(directory,name+'.html'),second=path.join(directory,name+'-again.html');
  const built=run(['build-game','--game',folder,'--output',first]);assert.equal(built.status,0,JSON.stringify(built.out));assert.equal(built.out.profile,profile);assert.equal(built.out.kind,'play');
  assert.equal(run(['build-game','--game',folder,'--output',second]).status,0);assert(fs.readFileSync(first).equals(fs.readFileSync(second)),name+' is byte-deterministic');
  assert.equal(built.out.sha256,sha(first));assert.equal(built.out.bytes,fs.statSync(first).size);assert(Number(built.out.bytes)<=Number(built.out.budgetBytes));
  const html=fs.readFileSync(first,'utf8');
  assert(html.includes(`<meta name="wildlands-engine" content="${String(built.out.engine)}"><meta name="wildlands-game-digest" content="${String(built.out.digest)}">`));
  assert.equal(built.out.digest,run(['validate-game','--game',folder]).out.digest);assert.match(html,/window\.LWGameProfile = \{"storage":\{"namespace":"[a-z.-]+"\}\};/);
  for(const payload of ['LWEngineSourceLoader','WildlandsGodotRuntimeLoader','WildlandsGodotTemplates'])assert(!html.includes('window.'+payload+' = '),payload);
  const current=run(['build-game','--game',folder,'--check',first]);assert.equal(current.status,0);assert.equal(current.out.current,true);
  fs.appendFileSync(second,' ');const stale=run(['build-game','--game',folder,'--check',second]);assert.equal(stale.status,1);assert.equal(stale.out.code,'stale-artifact');assert.equal((stale.out.actual as {bytes:number}).bytes,Number(built.out.bytes)+1);
  const missing=run(['build-game','--game',folder,'--check',path.join(directory,name+'-missing.html')]);assert.equal(missing.status,1);assert.equal(missing.out.actual,null);
 }
 // README.md is documentation outside the folder digest: editing it keeps a demo current; a PROVENANCE edit makes it stale.
 const pet=fixtures.get('pet')!,petHtml=path.join(directory,'pet.html'),provenance=path.join(pet,'PROVENANCE.md'),credits=fs.readFileSync(provenance);
 fs.appendFileSync(path.join(pet,'README.md'),'\nEdited documentation.\n');assert.equal(run(['build-game','--game',pet,'--check',petHtml]).out.current,true);
 fs.appendFileSync(provenance,'\nAdditional credit.\n');const credited=run(['build-game','--game',pet,'--check',petHtml]);
 fs.writeFileSync(provenance,credits);assert.equal(credited.status,1);assert.equal(credited.out.code,'stale-artifact');
 assert.equal(run(['build-game','--game',pet,'--check',petHtml]).out.current,true);
 assert.match(fs.readFileSync(path.join(directory,'littlewild.html'),'utf8'),/<title>Littlewild<\/title>/);
 // The presentation text comes from game.json; the play engine is identical for every game.
 const engines=['littlewild','rts','pet'].map(name=>/name="wildlands-engine" content="([0-9a-f]{64})"/.exec(fs.readFileSync(path.join(directory,name+'.html'),'utf8'))![1]);assert.equal(new Set(engines).size,1);
});
test('build-game enforces the play budget and writes nothing over it',()=>{
 const tight=templateGame('rts',games,'tight-frontier',manifest=>{(manifest.targets as {html:{budgetBytes:number}}).html.budgetBytes=4096;});
 const target=path.join(directory,'tight.html'),result=run(['build-game','--game',tight,'--output',target]);
 assert.equal(result.status,1);assert.equal(result.out.code,'over-budget');assert.equal(result.out.budgetBytes,4096);assert(Number(result.out.bytes)>4096);assert.match((result.out.errors as string[])[0]!,/over its budget of 4096 bytes/);
 assert(!fs.existsSync(target));assert.equal(run(['build-game','--game',tight,'--check',path.join(directory,'rts.html')]).out.code,'over-budget');
});
test('build-game builds the studio on demand with editors and export payloads; Pocket Pet has no studio profile',()=>{
 const studio=path.join(directory,'studio.html'),built=run(['build-game','--game',littlewildGame,'--output',studio,'--profile','studio']);assert.equal(built.status,0,JSON.stringify(built.out));
 assert.equal(built.out.profile,'colony-studio');assert.equal(built.out.budgetBytes,null);const html=fs.readFileSync(studio,'utf8');
 for(const payload of ['LWEngineSourceLoader','WildlandsGodotRuntimeLoader','WildlandsGodotTemplates','LWGameProfile'])assert(html.includes('window.'+payload+' = '),payload);
 const loader=/window\.LWEngineSourceLoader = (\{.*?\});\n/.exec(html)![1]!,identity=(JSON.parse(loader) as {identity:string}).identity;
 assert.equal(identity,(JSON.parse(engineOnlySources(fs.readFileSync(path.join(__dirname,'engine-source-bundle.json'),'utf8'))) as {identity:string}).identity);
 assert.equal(run(['build-game','--game',fixtures.get('rts')!,'--output',path.join(directory,'rts-studio.html'),'--profile','studio']).out.profile,'rts-studio');
 const pet=run(['build-game','--game',fixtures.get('pet')!,'--output',path.join(directory,'pet-studio.html'),'--profile','studio']);assert.equal(pet.status,2);assert.match((pet.out.errors as string[])[0]!,/pet template has no studio profile/);
 assert(!fs.existsSync(path.join(directory,'pet-studio.html')));
});
creatureChecks(test,run,directory,project);
const report={suite:'wildlands-cli',passed:results.filter(value=>value.passed).length,total:results.length,results};fs.writeFileSync(path.join(__dirname,'wildlands-cli-results.json'),JSON.stringify(report,null,2));fs.rmSync(directory,{recursive:true,force:true});fs.rmSync(games,{recursive:true,force:true});console.log(JSON.stringify(report));if(results.some(value=>!value.passed))process.exitCode=1;
