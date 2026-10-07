/// <reference path="../rts-contracts.d.ts" />
/** JSON-only RTS content and bounded session adapter. Player files are explicit outputs. */
import {emit,helpRequested,readJsonFile,writeJsonFile} from './cli-io.cjs';
import {installTemplate} from '../content-installers/template-games.cjs';
// Transitional: the bundled template game is installed (inside the JSON error boundary) until game folders supply profiles.
interface Tools {
 discover():unknown;catalog():LWRTSData.Catalog;
 validate(input:unknown):{ok:boolean;errors:string[];catalog:LWRTSData.Catalog|null};
 inspect(mission?:string,catalog?:unknown):unknown;
 run(recipe:unknown,catalog?:unknown):Run;
 restore(checkpoint:unknown,recipe:unknown):Run;
}
interface Run {ok:boolean;checkpoint:unknown;[key:string]:unknown;}
const usage='rts-cli discover | catalog [OUTPUT] | validate CATALOG | inspect [MISSION] [CATALOG] | run RECIPE [OUTPUT] [CATALOG] | restore SAVE RECIPE [OUTPUT]';
const read=(file:string|undefined):string=>{if(!file)throw Error(usage);return readJsonFile(file,8*1024*1024);};
try {
 const args=process.argv.slice(2),[action,...files]=args;
 if(helpRequested(args)){emit({ok:true,usage,exitCodes:{accepted:0,rejected:1,usageOrIO:2}});process.exit(0);}
 const valid=action==='discover'?files.length===0:action==='catalog'?files.length<=1:action==='validate'?files.length===1:action==='inspect'?files.length<=2:action==='run'?files.length>=1&&files.length<=3:action==='restore'&&files.length>=2&&files.length<=3;
 if(!valid)throw Error(usage);
 installTemplate('rts');require('../ecs.js');require('../rts-catalog.js');require('../rts-stats.js');require('../rts-navigation.js');require('../rts-systems.js');require('../rts-production.js');require('../rts-economy.js');require('../rts-checkpoint.js');require('../rts-session.js');
 const tools=require('../rts-tools.js') as Tools;
 if(action==='discover')emit({ok:true,...tools.discover() as object});
 else if(action==='catalog')emit(files[0]?{ok:true,output:writeJsonFile(files[0],tools.catalog())}:{ok:true,catalog:tools.catalog()});
 else if(action==='validate'){const result=tools.validate(read(files[0]));emit(result);if(!result.ok)process.exitCode=1;}
 else if(action==='inspect')emit({ok:true,result:tools.inspect(files[0],files[1]?read(files[1]):undefined)});
 else {
  const result=action==='run'?tools.run(read(files[0]),files[2]?read(files[2]):undefined):tools.restore(read(files[0]),read(files[1]));
  const output=action==='run'?files[1]:files[2];
  const inputs=action==='run'?[files[0]!,...(files[2]?[files[2]]:[])]:[files[0]!,files[1]!];
  emit(output?{...result,output:writeJsonFile(output,result.checkpoint,inputs)}:result);
  if(!result.ok)process.exitCode=1;
 }
}catch(error){emit({ok:false,errors:[error instanceof Error?error.message:String(error)]});process.exitCode=2;}
