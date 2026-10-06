#!/usr/bin/env node
/* Local simulation-profile authoring utility. It parses data only and never executes profile content. */
'use strict';
const {readJsonFile,writeJsonFile,helpRequested,emit}=require('./cli-io.cjs');
const args=process.argv.slice(2),[command,input]=args;
const usage='simulation-profile-cli.cjs validate profile.json | fingerprint profile.json | export output.json | schema';
try{
  if(helpRequested(args)){emit({ok:true,usage});process.exit(0);}
  if(!['validate','fingerprint','export','schema'].includes(command)||args.length!==(command==='schema'?1:2))throw Error('Usage: '+usage);
  require('../simulation.cjs');const P=global.LWSimulationProfile,C=global.LWContent;
  if(command==='validate'||command==='fingerprint'){
    const source=readJsonFile(input,256*1024);
    try{const profile=P.validate(source);emit({ok:true,profile:profile.id,version:profile.version,archetype:profile.archetype.id,fingerprint:P.fingerprint(profile)});}
    catch(error){emit({ok:false,error:error.message});process.exitCode=1;}
  }else if(command==='export'){
    writeJsonFile(input,C.copy(P.defaults));emit({ok:true,profile:P.defaults.id,output:input,fingerprint:P.fingerprint(P.defaults)});
  }else if(command==='schema'){
    emit(require('../content/simulation.schema.json'));
  }else throw Error('Usage: '+usage);
}catch(error){emit({ok:false,error:error.message});process.exitCode=2;}
