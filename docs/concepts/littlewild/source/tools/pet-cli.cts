/// <reference path="../pet-contracts.d.ts" />
/** JSON-only Pocket Pet catalog and bounded care-experiment adapter. Outputs are explicit files. */
import {emit,helpRequested,readJsonFile,writeJsonFile} from './cli-io.cjs';
interface Tools {
 discover():unknown;catalog():LWPetData.Catalog;
 validate(input:unknown):{ok:boolean;errors:string[];catalog:LWPetData.Catalog|null};
 simulate(options:{policy:string;minutes:number;species?:string;catalog?:unknown}):{ok:boolean;checkpoint:unknown;[key:string]:unknown};
}
const usage='pet-cli discover | catalog [OUTPUT] | validate CATALOG | simulate POLICY MINUTES [SPECIES] [CHECKPOINT_OUTPUT] [CATALOG]';
const read=(file:string|undefined):unknown=>{if(!file)throw Error(usage);return JSON.parse(readJsonFile(file,4*1024*1024)) as unknown;};
try {
 const args=process.argv.slice(2),[action,...rest]=args;
 if(helpRequested(args)){emit({ok:true,usage,exitCodes:{accepted:0,rejected:1,usageOrIO:2}});process.exit(0);}
 const valid=action==='discover'?rest.length===0:action==='catalog'?rest.length<=1:action==='validate'?rest.length===1:action==='simulate'&&rest.length>=2&&rest.length<=5;
 if(!valid)throw Error(usage);
 require('../ecs.js');require('../pet-catalog.js');require('../pet-systems.js');require('../pet-session.js');
 const tools=require('../pet-tools.js') as Tools;
 if(action==='discover')emit({ok:true,...tools.discover() as object});
 else if(action==='catalog')emit(rest[0]?{ok:true,output:writeJsonFile(rest[0],tools.catalog())}:{ok:true,catalog:tools.catalog()});
 else if(action==='validate'){const result=tools.validate(read(rest[0]));emit(result);if(!result.ok)process.exitCode=1;}
 else {
  const [policy,minutes,species,output,catalog]=rest;
  const result=tools.simulate({policy:policy!,minutes:Number(minutes),...(species&&species!=='-'?{species}:{}),...(catalog?{catalog:read(catalog)}:{})});
  const {checkpoint,...summary}=result;
  emit(output?{...summary,output:writeJsonFile(output,checkpoint,catalog?[catalog]:[])}:summary);
 }
}catch(error){
 emit({ok:false,error:error instanceof Error?error.message:String(error),usage});
 process.exitCode=2;
}
