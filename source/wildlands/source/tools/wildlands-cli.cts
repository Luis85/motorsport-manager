#!/usr/bin/env node
/// <reference path="../wildlands-project-contracts.d.ts" />
/// <reference path="../content-provider-contracts.d.ts" />
/**
 * Stable JSON-only, noninteractive engine CLI. No output is written until admission succeeds.
 *
 * The engine carries no game: games are folders (`--game DIR`, docs/concepts/<id>/). Before any
 * engine module loads, this entry installs exactly one game in the process: the folder's compiled
 * profile, or the game a schemaVersion 2 project embeds. Exit codes: 0 success, 1 rejected input
 * (invalid project or game, over budget, stale artifact), 2 usage or operation failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readBytesFile,readJsonFile,writeJsonFile,writeTextFile,emit} from './cli-io.cjs';
import * as creatureCLI from './creature-cli.cjs';
import * as storyboardCLI from './storyboard-cli.cjs';
const usage='wildlands process [discover|--help] | process schema [--kind definition|recipe] | process create --id ID --output FILE [--name NAME] | process validate|inspect --input FILE [--draft] | process edit --input FILE --recipe FILE (--output FILE | --dry-run) [--draft] | process attach --input FILE --asset FILE --step ID --expected-revision N --expected-fingerprint HEX (--output FILE | --dry-run) | process run --input FILE --minutes N --output FILE [--seed S] | process slides --input FILE [--format json|md] [--minutes N [--seed S]] [--output FILE] | process diff --input FILE --against FILE | process build --input FILE --output FILE.html | process forge --input FILE --output NEWDIR | wildlands --help | --version | discover [--game DIR] | scenarios --game DIR | create --game DIR --output project.json [--scenario ID] [--scene ID] [--pack pack.json] [--id ID] [--name NAME] | validate|inspect --project project.json [--game DIR] | scenario --project project.json --scenario ID [--scene ID] --output project.json [--game DIR] | run|edit --project project.json --recipe recipe.json --output project.json [--game DIR] | upgrade --project legacy.json --game DIR --output project.json | compile|export --project project.json --output godot-directory [--with-engine-sources] [--game DIR] | validate-game|inspect-game --game DIR | build-game --game DIR (--output FILE.html | --check FILE.html) [--profile play|studio]';
/** Repository handbook for humans and agents; reported by --help and every game-required diagnostic. */
const handbook='docs/reference/wildlands-cli.md';
const project=['--project','--game'];
const allowed:Record<string,readonly string[]>={...creatureCLI.options,discover:['--game'],scenarios:['--game'],create:['--game','--output','--scenario','--scene','--pack','--id','--name'],
 validate:project,inspect:project,scenario:[...project,'--scenario','--scene','--output'],run:[...project,'--recipe','--output'],edit:[...project,'--recipe','--output'],
 upgrade:[...project,'--output'],compile:[...project,'--output','--with-engine-sources'],export:[...project,'--output','--with-engine-sources'],
 'validate-game':['--game'],'inspect-game':['--game'],'build-game':['--game','--output','--check','--profile']};
/** Value-less opt-in flags; every other option takes exactly one value. */
const switches=new Set(['--with-engine-sources','--dry-run','--replace']);
/** wildlands-project maxBytes, needed before the engine (and its project module) may load. */
const PROJECT_MAX_BYTES=10*1024*1024;
/** Largest HTML artifact `build-game --check` reads (game.json budgets are at most 64 MiB). */
const ARTIFACT_MAX_BYTES=64*1024*1024;

/** A diagnostic with its protocol code and exit status. */
class CliError extends Error {
 constructor(readonly code:string,readonly exit:1|2,message:string,readonly details:Record<string,unknown>={}){super(message);}
}
const gameRequired=(what:string):CliError=>new CliError('game-required',2,`${what} needs --game DIR: the Wildlands engine CLI has no built-in games. Pass a game folder such as docs/concepts/littlewild (see ${handbook}).`,{handbook});
function options(args:readonly string[],fields:readonly string[]):Map<string,string>{
 const values=new Map<string,string>();
 for(let index=0;index<args.length;index++){
  const flag=args[index];if(!flag||!fields.includes(flag))throw Error('Unknown option: '+flag);
  if(values.has(flag))throw Error('Duplicate option: '+flag);
  if(switches.has(flag)){values.set(flag,'true');continue;}
  const value=args[++index];if(!value||value.startsWith('--'))throw Error('Missing value for '+flag);values.set(flag,value);
 }
 return values;
}
const provider=():LWContentProvider.Api=>require('../content-provider.js') as LWContentProvider.Api;
/** Compile a game folder and install its profile; nothing else may be installed in this process. */
function installFolder(directory:string):{id:string;digest:string}{
 const folders=require('./game-folder.cjs') as typeof import('./game-folder.cjs');
 let game:ReturnType<typeof folders.compileGame>;
 try{game=folders.compileGame(directory);}
 catch(error){throw new CliError('invalid-game',1,error instanceof Error?error.message:String(error));}
 if(game.manifest.template!=='colony')throw new CliError('invalid-game',1,`Game ${game.manifest.id} uses the ${game.manifest.template} template; portable projects need a colony game.`);
 provider().install(game.profile);
 return {id:game.manifest.id,digest:game.digest};
}
/** The parsed document when it is a JSON object; the project validator reports everything else. */
function peek(text:string):{schemaVersion?:unknown;game?:{id?:unknown;profile?:unknown}}|null{
 try{const value=JSON.parse(text.replace(/^\uFEFF/,'')) as unknown;return value&&typeof value==='object'&&!Array.isArray(value)?value as {schemaVersion?:unknown}:null;}
 catch{return null;}
}
/**
 * Read a project and install its game before the engine loads: the embedded game of a
 * schemaVersion 2 document, or `--game` for a legacy schemaVersion 1 document.
 */
function openProject(input:string,folder:string|undefined):{text:string;version:unknown;gameId:string|null}{
 const text=readJsonFile(input,PROJECT_MAX_BYTES),doc=peek(text),version=doc?.schemaVersion;
 if(doc&&version===2){
  const embedded=doc.game&&typeof doc.game==='object'?doc.game:null;
  if(folder!==undefined)throw new CliError('game-embedded',2,`This schemaVersion 2 project embeds its game${embedded&&typeof embedded.id==='string'?' ('+embedded.id+')':''}; omit --game.`);
  if(embedded&&embedded.profile!==undefined){
   try{provider().install(embedded.profile);}
   catch(error){throw new CliError('invalid-project',1,error instanceof Error?error.message:String(error));}
  }
  return {text,version,gameId:embedded&&typeof embedded.id==='string'?embedded.id:null};
 }
 if(version===1){
  if(folder===undefined)throw new CliError('game-required',2,`This schemaVersion 1 project does not embed its game. Pass --game DIR with the game folder it was made with, or upgrade it once: wildlands upgrade --project ${input} --game DIR --output project.json (see ${handbook}).`,{handbook});
  return {text,version,gameId:installFolder(folder).id};
 }
 return {text,version,gameId:null};
}
function gameCommand(command:string,values:Map<string,string>):void{
 const directory=values.get('--game');if(!directory)throw gameRequired(command);
 const games=require('./game-build.cjs') as typeof import('./game-build.cjs');
 if(command==='validate-game'){
  const result=games.validateGameFolder(directory);
  emit({ok:result.ok,protocolVersion:1,...result.ok?{}:{code:'invalid-game'},id:result.id,template:result.template,digest:result.digest,errors:result.errors});
  if(!result.ok)process.exitCode=1;return;
 }
 if(command==='inspect-game'){
  let summary:Record<string,unknown>;
  try{summary=games.inspectGame(directory);}catch(error){throw new CliError('invalid-game',1,error instanceof Error?error.message:String(error));}
  emit({ok:true,protocolVersion:1,...summary});return;
 }
 const output=values.get('--output'),check=values.get('--check'),kind=values.get('--profile')??'play';
 if((output===undefined)===(check===undefined))throw Error('build-game needs exactly one of --output FILE.html or --check FILE.html.');
 if(kind!=='play'&&kind!=='studio')throw Error('--profile must be play or studio.');
 const target=path.resolve((output??check)!),root=path.resolve(directory);
 if(!target.endsWith('.html'))throw Error('build-game writes and checks .html files.');
 if(target===root||target.startsWith(root+path.sep))throw Error('Build output must be outside the game folder, which holds data only.');
 let artifact:ReturnType<typeof games.buildGame>;
 try{artifact=games.buildGame(directory,kind);}
 catch(error){if(error instanceof games.GameBuildError)throw new CliError(error.code,1,error.message,{...error.details});throw error;}
 const summary={id:artifact.id,profile:artifact.profile,kind:artifact.kind,bytes:artifact.bytes,sha256:artifact.sha256,budgetBytes:artifact.budgetBytes,digest:artifact.digest,engine:artifact.engine};
 if(output!==undefined){
  fs.mkdirSync(path.dirname(target),{recursive:true});
  emit({ok:true,protocolVersion:1,output:writeTextFile(target,artifact.html),...summary});return;
 }
 const current=fs.existsSync(target)?Buffer.from(readBytesFile(target,ARTIFACT_MAX_BYTES)):null;
 if(current&&current.equals(Buffer.from(artifact.html,'utf8'))){emit({ok:true,protocolVersion:1,check:target,current:true,...summary});return;}
 const actual=current?{bytes:current.length,sha256:createHash('sha256').update(current).digest('hex')}:null;
 emit({ok:false,protocolVersion:1,code:'stale-artifact',check:target,current:false,actual,...summary,
  errors:[`${target} is ${current?'stale':'missing'}; rebuild it with wildlands build-game --game ${directory} --output ${check}${kind==='studio'?' --profile studio':''}.`]});
 process.exitCode=1;
}
export async function run(args:readonly string[]):Promise<void>{
 if(args[0]==='storyboard'){storyboardCLI.run(args.slice(1));return;}
 if(args[0]==='process'){(require('./process-cli.cjs') as typeof import('./process-cli.cjs')).run(args.slice(1));return;}
 if(args[0]==='creature'&&(args.length===1||(args.length===2&&['discover','--help','-h'].includes(args[1]!)))){emit({ok:true,protocolVersion:1,...creatureCLI.discover()});return;}
 if(args[0]==='creature')args=['creature-'+args[1],...args.slice(2)];
 const command=args[0];
 try{
  if(args.length===0||(args.length===1&&['--help','-h'].includes(command!))){emit({ok:true,protocolVersion:1,usage:usage+' | creature discover|list|inspect|export|import|edit|attach-visual (see creature discover) | storyboard discover|schema|build (see storyboard discover)',handbook});return;}
  // Lazy: a broken package manifest cannot affect help, and the single-file bundle inlines this version.
  if(args.length===1&&command==='--version'){const manifest=require('../../package.json') as {name:string;version:string};emit({ok:true,protocolVersion:1,name:manifest.name,version:manifest.version});return;}
  if(!command||!Object.hasOwn(allowed,command))throw Error('Unknown operation. '+usage);
  const values=options(args.slice(1),allowed[command]!);
  const required=(flag:string):string=>{const value=values.get(flag);if(!value)throw Error('Missing required option: '+flag);return value;};
  if(command==='validate-game'||command==='inspect-game'||command==='build-game'){gameCommand(command,values);return;}
  const folder=values.get('--game');
  // Install the one game of this process before the engine loads, so bootstrap failures keep the JSON protocol.
  if(['scenarios','create'].includes(command)&&folder===undefined)throw gameRequired(command);
  if(command==='upgrade'&&folder===undefined)throw gameRequired('upgrade');
  const opened=['discover','scenarios','create'].includes(command)?null:openProject(required('--project'),folder);
  const installed=opened?null:folder!==undefined?installFolder(folder):null;
  const SDK=require('../wildlands-project-sdk.cjs') as typeof import('../wildlands-project-sdk.cjs');
  if(command==='discover'){const found=SDK.discover();emit({ok:true,...found,game:installed?found.game:null,creature:creatureCLI.discover(),storyboard:storyboardCLI.discover()});return;}
  if(command==='scenarios'){emit({ok:true,protocolVersion:1,game:installed!.id,digest:installed!.digest,defaultScenario:SDK.projects.discover().game?.defaultScenario,scenarios:SDK.projects.scenarios()});return;}
  if(command==='create'){
   const config:Wildlands.CreateOptions={};
   for(const [flag,key] of [['--id','id'],['--name','name'],['--scenario','scenarioId'],['--scene','sceneId']] as const){const value=values.get(flag);if(value!==undefined)config[key]=value;}
   const packFile=values.get('--pack');if(packFile){
    const checkedPack=(require('../scenario-runtime.js') as LWContentPorts.ScenarioApi).validate(readJsonFile(packFile,8*1024*1024));
    if(!checkedPack.ok)throw Error(checkedPack.errors.join('\n'));config.pack=checkedPack.pack;
   }
   const created=SDK.projects.create(config),output=writeJsonFile(required('--output'),created,packFile?[packFile]:[]);
   emit({ok:true,protocolVersion:1,output,projectId:created.id,schemaVersion:created.schemaVersion,gameId:created.game.id,gameDigest:installed!.digest,scenarioId:created.scenarioId,sceneId:created.sceneId});return;
  }
  const input=required('--project'),checked=SDK.projects.validate(opened!.text);
  if(!checked.ok){emit({ok:false,protocolVersion:1,code:'invalid-project',errors:checked.errors});process.exitCode=1;return;}
  const loaded=checked.project,gameId=opened!.gameId;
  if(Object.hasOwn(creatureCLI.options,command)){creatureCLI.run(command,values,loaded,checked.fingerprint);return;}
  if(command==='validate'){emit({ok:true,protocolVersion:1,fingerprint:checked.fingerprint,projectId:loaded.id,schemaVersion:loaded.schemaVersion,gameId,scenarioId:loaded.scenarioId,sceneId:loaded.sceneId});return;}
  if(command==='inspect'){const inspected=SDK.inspectProject(loaded);emit({ok:true,protocolVersion:1,projectId:loaded.id,schemaVersion:loaded.schemaVersion,gameId,scenarioId:loaded.scenarioId,sceneId:loaded.sceneId,fingerprint:inspected.fingerprint,snapshot:inspected.snapshot,connections:inspected.connections});return;}
  if(command==='upgrade'){
   const next=SDK.projects.upgrade(loaded),output=writeJsonFile(required('--output'),next,[input]);
   emit({ok:true,protocolVersion:1,output,projectId:next.id,schemaVersion:next.schemaVersion,gameId:next.game.id,fingerprint:(SDK.projects.validate(next) as Extract<Wildlands.Validation,{ok:true}>).fingerprint,scenarioId:next.scenarioId,sceneId:next.sceneId});return;
  }
  if(command==='scenario'){
   const next=SDK.projects.select(loaded,required('--scenario'),values.get('--scene')),output=writeJsonFile(required('--output'),next,[input]);
   emit({ok:true,protocolVersion:1,output,schemaVersion:next.schemaVersion,scenarioId:next.scenarioId,sceneId:next.sceneId});return;
  }
  if(command==='run'||command==='edit'){
   const recipeFile=required('--recipe'),recipe=readJsonFile(recipeFile,1024*1024);
   const result=command==='run'?SDK.runProject(loaded,recipe):SDK.editProject(loaded,recipe);
   const output=writeJsonFile(required('--output'),result.project,[input,recipeFile]);
   const {project:_,...details}=result;emit({ok:true,protocolVersion:1,output,schemaVersion:result.project.schemaVersion,scenarioId:result.project.scenarioId,sceneId:result.project.sceneId,...details});return;
  }
  const writer=require('./wildlands-godot-writer.cjs') as typeof import('./wildlands-godot-writer.cjs');
  // A legacy project compiles as its upgrade: the Godot runtime runs the game the document embeds.
  const compiled=SDK.projects.upgrade(loaded);
  // The inert engine-source bundle (~30 MB code-generator input) is opt-in; the default project runs without it.
  const result=await writer.writeGodotProject(compiled,required('--output'),{withEngineSources:values.has('--with-engine-sources')});emit({ok:true,protocolVersion:1,...result as Record<string,unknown>});
 }catch(error){
  const known=error instanceof CliError?error:null;
  emit({ok:false,protocolVersion:1,code:known?.code??'operation-failed',errors:[error instanceof Error?error.message:String(error)],...known?.details});process.exitCode=known?.exit??2;
 }
}
if(require.main===module)void run(process.argv.slice(2));
