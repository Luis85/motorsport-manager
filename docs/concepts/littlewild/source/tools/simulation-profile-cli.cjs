#!/usr/bin/env node
/* Local simulation-profile authoring utility. It parses data only and never executes profile content. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
require('../simulation.cjs');
const P=global.LWSimulationProfile,C=global.LWContent;
const [command,input,output]=process.argv.slice(2);
function emit(value){process.stdout.write(JSON.stringify(value,null,2)+'\n');}
function write(file,value,source=null){
  if(!file)throw Error('Provide an output .json path.');
  if(source&&path.resolve(file)===path.resolve(source))throw Error('Output must not overwrite the input.');
  const temp=file+'.tmp';
  try{fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n');fs.renameSync(temp,file);}
  finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
try{
  if(command==='validate'||command==='fingerprint'){
    if(!input)throw Error('Usage: simulation-profile-cli.cjs '+command+' profile.json');
    const source=fs.readFileSync(input,'utf8'),profile=P.validate(source),fingerprint=P.fingerprint(profile);
    emit({ok:true,profile:profile.id,version:profile.version,archetype:profile.archetype.id,fingerprint});
  }else if(command==='export'){
    write(input,C.copy(P.defaults));
    emit({ok:true,profile:P.defaults.id,output:input,fingerprint:P.fingerprint(P.defaults)});
  }else if(command==='schema'){
    emit(require('../content/simulation.schema.json'));
  }else{
    emit({ok:false,error:'Usage: simulation-profile-cli.cjs validate profile.json | fingerprint profile.json | export output.json | schema'});
    process.exitCode=command?2:0;
  }
}catch(error){emit({ok:false,error:error.message});process.exitCode=1;}
