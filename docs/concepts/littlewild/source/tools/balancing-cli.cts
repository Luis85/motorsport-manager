/** Complete JSON balancing exchange and finite native experiments. No scripts/callbacks are accepted. */
import {emit,readJsonFile,writeJsonFile,helpRequested} from './cli-io.cjs';
const usage='balancing-cli defaults | new-pack BALANCE OUTPUT [TEMPLATE] | capture PACK [SCENE] | validate BALANCE [PACK] | diff BEFORE AFTER | review PACK BALANCE | apply PACK BALANCE OUTPUT | probe PACK BALANCE OPTIONS | sweep PACK BALANCE OPTIONS';
const read=(file:string|undefined):string=>{if(!file)throw Error(usage);return readJsonFile(file,12*1024*1024);};
try{
 const args=process.argv.slice(2),action=args[0],files=args.slice(1);
 if(helpRequested(args)){emit({ok:true,usage,budgets:{maxBytes:12*1024*1024,changes:256,commands:64,steps:36000,sweepCandidates:16,totalSweepSteps:72000}});process.exit(0);}
 const validUsage=action==='defaults'?files.length===0:action==='new-pack'?files.length===2||files.length===3:action==='capture'||action==='validate'?files.length===1||files.length===2:action==='diff'||action==='review'?files.length===2:['apply','probe','sweep'].includes(action!)&&files.length===3;
 if(!validUsage)throw Error(usage);
 const {toolbox}=require('../developer-sdk.cjs') as {toolbox:LittlewildDeveloper.Toolbox},B=toolbox.balancing;
 if(action==='defaults'&&files.length===0)emit({ok:true,data:B.defaults()});
 else if(action==='new-pack'&&(files.length===2||files.length===3))emit({ok:true,output:writeJsonFile(files[1]!,B.startingPack(read(files[0]),files[2]?read(files[2]):undefined),[files[0]!,...(files[2]?[files[2]]:[])])});
 else if(action==='capture'&&(files.length===1||files.length===2))emit({ok:true,data:B.capture(read(files[0]),files[1])});
 else if(action==='validate'&&(files.length===1||files.length===2)){const result=B.validate(read(files[0]),files[1]?read(files[1]):undefined);emit(result);if(!result.ok)process.exitCode=1;}
 else if(action==='diff'&&files.length===2)emit({ok:true,...B.diff(read(files[0]),read(files[1]))});
 else if(action==='review'&&files.length===2)emit({ok:true,review:B.review(read(files[0]),read(files[1]))});
 else if(action==='apply'&&files.length===3){const pack=read(files[0]),review=B.review(pack,read(files[1])),output=B.apply(pack,review);emit({ok:true,review,output:writeJsonFile(files[2]!,output,files.slice(0,2))});}
 else if((action==='probe'||action==='sweep')&&files.length===3){
  const options=JSON.parse(read(files[2])) as LWBalancing.SweepOptions;
  const result=action==='probe'?B.probe(read(files[0]),read(files[1]),options):B.sweep(read(files[0]),read(files[1]),options);emit({ok:true,result});
  if(Array.isArray(result)&&result.some(row=>row.errors.length))process.exitCode=1;
 }else throw Error(usage);
}catch(error){emit({ok:false,errors:[error instanceof Error?error.message:String(error)]});process.exitCode=1;}
