/// <reference path="../engine-export-contracts.d.ts" />
/** Atomic local code-generator export and integrity checking; no code is executed. */
import {readJsonFile,writeJsonFile,emit} from './cli-io.cjs';
export async function run(args:readonly string[]):Promise<void>{
 const [command,input,sceneId,output]=args;
 try{
  if(!((command==='engine-export'&&args.length===4)||(command==='engine-export-validate'&&args.length===2)))throw Error('Usage: engine-export pack.json scene-id output.engine.json | engine-export-validate engine.json');
  const E=require('../engine-export.js') as LWEngineExport.Api;
  if(command==='engine-export'&&args.length===4){const exchanged=await E.export(readJsonFile(input!,8*1024*1024),sceneId!);writeJsonFile(output!,exchanged,[input!]);emit({ok:true,output,sourceIdentity:exchanged.sourceIdentity,files:exchanged.sources.files.length,limitations:exchanged.limitations});}
  else if(command==='engine-export-validate'&&args.length===2){const checked=await E.validate(readJsonFile(input!,E.maxBytes));emit(checked.ok?{ok:true,sourceIdentity:checked.document.sourceIdentity,files:checked.document.sources.files.length}:checked);if(!checked.ok)process.exitCode=1;}
  else throw Error('Usage: engine-export pack.json scene-id output.engine.json | engine-export-validate engine.json');
 }catch(error){emit({ok:false,errors:[error instanceof Error?error.message:String(error)]});process.exitCode=2;}
}
