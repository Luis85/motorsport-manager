#!/usr/bin/env node
/// <reference path="../wildlands-project-contracts.d.ts" />
/** Stable JSON-only, noninteractive CLI. No output is written until admission succeeds. */
import {readJsonFile,writeJsonFile,emit} from './cli-io.cjs';
const usage='wildlands discover | scenarios | create --output project.json [--scenario littlewild|emberworks|office] [--scene ID] [--pack pack.json] [--id ID] [--name NAME] | validate|inspect --project project.json | scenario --project project.json --scenario ID [--scene ID] --output project.json | run|edit --project project.json --recipe recipe.json --output project.json | compile|export --project project.json --output godot-directory';
const allowed:Record<string,readonly string[]>={discover:[],scenarios:[],create:['--output','--scenario','--scene','--pack','--id','--name'],validate:['--project'],inspect:['--project'],scenario:['--project','--scenario','--scene','--output'],run:['--project','--recipe','--output'],edit:['--project','--recipe','--output'],compile:['--project','--output'],export:['--project','--output']};
function options(args:readonly string[],fields:readonly string[]):Map<string,string>{
 const values=new Map<string,string>();
 for(let index=0;index<args.length;index++){
  const flag=args[index];if(!flag||!fields.includes(flag))throw Error('Unknown option: '+flag);
  if(values.has(flag))throw Error('Duplicate option: '+flag);
  const value=args[++index];if(!value||value.startsWith('--'))throw Error('Missing value for '+flag);values.set(flag,value);
 }
 return values;
}
export async function run(args:readonly string[]):Promise<void>{
 const command=args[0];
 try{
  if(args.length===0||(args.length===1&&['--help','-h'].includes(command!))){emit({ok:true,protocolVersion:1,usage});return;}
  if(!command||!Object.hasOwn(allowed,command))throw Error('Unknown operation. '+usage);
  const values=options(args.slice(1),allowed[command]!);
  const required=(flag:string):string=>{const value=values.get(flag);if(!value)throw Error('Missing required option: '+flag);return value;};
  // Load composition inside the boundary so bootstrap failures retain the JSON protocol.
  const SDK=require('../wildlands-project-sdk.cjs') as typeof import('../wildlands-project-sdk.cjs');
  if(command==='discover'){emit({ok:true,...SDK.discover()});return;}
  if(command==='scenarios'){emit({ok:true,protocolVersion:1,scenarios:SDK.projects.scenarios()});return;}
  if(command==='create'){
   const config:Wildlands.CreateOptions={};
   for(const [flag,key] of [['--id','id'],['--name','name'],['--scenario','scenarioId'],['--scene','sceneId']] as const){const value=values.get(flag);if(value!==undefined)config[key]=value;}
   const packFile=values.get('--pack');if(packFile){
    const checkedPack=(require('../scenario-runtime.js') as LWContentPorts.ScenarioApi).validate(readJsonFile(packFile,8*1024*1024));
    if(!checkedPack.ok)throw Error(checkedPack.errors.join('\n'));config.pack=checkedPack.pack;
   }
   const project=SDK.projects.create(config),output=writeJsonFile(required('--output'),project,packFile?[packFile]:[]);
   emit({ok:true,protocolVersion:1,output,projectId:project.id,scenarioId:project.scenarioId,sceneId:project.sceneId});return;
  }
  const input=required('--project'),checked=SDK.projects.validate(readJsonFile(input,SDK.projects.maxBytes));
  if(!checked.ok){emit({ok:false,protocolVersion:1,code:'invalid-project',errors:checked.errors});process.exitCode=1;return;}
  const project=checked.project;
  if(command==='validate'){emit({ok:true,protocolVersion:1,fingerprint:checked.fingerprint,projectId:project.id,scenarioId:project.scenarioId,sceneId:project.sceneId});return;}
  if(command==='inspect'){const inspected=SDK.inspectProject(project);emit({ok:true,protocolVersion:1,projectId:project.id,scenarioId:project.scenarioId,sceneId:project.sceneId,fingerprint:inspected.fingerprint,snapshot:inspected.snapshot,connections:inspected.connections});return;}
  if(command==='scenario'){
   const next=SDK.projects.select(project,required('--scenario'),values.get('--scene')),output=writeJsonFile(required('--output'),next,[input]);
   emit({ok:true,protocolVersion:1,output,scenarioId:next.scenarioId,sceneId:next.sceneId});return;
  }
  if(command==='run'||command==='edit'){
   const recipeFile=required('--recipe'),recipe=readJsonFile(recipeFile,1024*1024);
   const result=command==='run'?SDK.runProject(project,recipe):SDK.editProject(project,recipe);
   const output=writeJsonFile(required('--output'),result.project,[input,recipeFile]);
   const {project:_,...details}=result;emit({ok:true,protocolVersion:1,output,scenarioId:result.project.scenarioId,sceneId:result.project.sceneId,...details});return;
  }
  const writer=require('./wildlands-godot-writer.cjs') as {writeGodotProject(project:Wildlands.Project,output:string):Promise<unknown>};
  const result=await writer.writeGodotProject(project,required('--output'));emit({ok:true,protocolVersion:1,...result as Record<string,unknown>});
 }catch(error){emit({ok:false,protocolVersion:1,code:'operation-failed',errors:[error instanceof Error?error.message:String(error)]});process.exitCode=2;}
}
if(require.main===module)void run(process.argv.slice(2));
