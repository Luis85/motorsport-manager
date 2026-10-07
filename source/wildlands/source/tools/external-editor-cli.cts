/// <reference path="../external-editor-contracts.d.ts" />
/* CLI file adapter: bounded bytes, structured diagnostics and atomic reviewed output. */
import {readJsonFile,readBytesFile,writeJsonFile,emit} from './cli-io.cjs';
import {installLittlewild} from '../content-installers/littlewild-game.cjs';
// Transitional: the bundled Littlewild game is installed until game folders supply profiles.
installLittlewild();
const editors=require('../external-editors.js') as LWExternalEditors.Api;
const content=(globalThis as unknown as {LWContent:LWContentPorts.ContentApi}).LWContent;
export function run(args:readonly string[]):void{
 const command=args[0],input=args[1];
 if(!input)throw Error('Provide an external interchange input file.');
 if(command==='external-export'){
  if(args.length!==5)throw Error('Usage: external-export pack.json scene-id tiled|ldtk|gltf|canvas|advanced-canvas output-file');
  const format=args[3];if(!editors.formats().some(f=>f.id===format))throw Error('Choose a supported external editor format from discovery.');
  const source=readJsonFile(input,8*1024*1024);let result:LWExternalEditors.Export;
  try{result=editors.export(source,args[2]!,format as LWExternalEditors.Format);}catch(error){emit({ok:false,errors:[error instanceof Error?error.message:String(error)]});process.exitCode=1;return;}
  writeJsonFile(args[4]!,result.document,[input]);emit({ok:true,format:result.format,output:args[4],warnings:result.warnings});
 }else if(command==='external-import'){
  if(args.length!==3&&args.length!==4)throw Error('Usage: external-import external-file output.pack.json [mapping-options.json]');
  const options=args[3]?content.parse(readJsonFile(args[3],8*1024*1024),8*1024*1024) as unknown as LWExternalEditors.Options:undefined;
  const source=input.toLowerCase().endsWith('.glb')?readBytesFile(input,8*1024*1024):readJsonFile(input,8*1024*1024);
  const result=editors.import(source,options);
  if(!result.ok){emit(result);process.exitCode=1;return;}
  writeJsonFile(args[2]!,result.pack,[input,...(args[3]?[args[3]]:[])]);emit({ok:true,format:result.format,sceneId:result.sceneId,output:args[2],warnings:result.warnings});
 }else throw Error('Unsupported external interchange command.');
}
