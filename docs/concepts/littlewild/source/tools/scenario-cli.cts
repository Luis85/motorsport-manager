#!/usr/bin/env node
/* Local scenario validation and capture. Does not contact a server or run pack code. */
'use strict';
const {readJsonFile,writeJsonFile,helpRequested,emit}=require('./cli-io.cjs');
const args=process.argv.slice(2),[command,input,output]=args;
const usage='scenario-cli.cjs validate pack.json | capture story.json output.pack.json | export littlewild output.pack.json';
try{
  if(helpRequested(args)){emit({ok:true,usage});process.exit(0);}
  if(!['validate','capture','export'].includes(command)||args.length!==(command==='validate'?2:3))throw Error('Usage: '+usage);
  const X=require('../scenario-runtime.js'),S=require('../scenario-story.js');
  if(command==='validate'){
    const result=X.validate(readJsonFile(input,8*1024*1024));
    emit({ok:result.ok,errors:result.errors,pack:result.pack?.id,scenes:result.sceneCount,fingerprint:result.fingerprint,simulationProfile:result.pack?.simulation?.id,compositionArchetype:result.pack?.simulation?.archetype?.id});
    if(!result.ok)process.exitCode=1;
  }else if(command==='capture'){
    const source=readJsonFile(input,S.SAVE_LIMIT);
    let pack;
    try{pack=X.capture(S.commit(S.inspect(source)));const result=X.validate(pack);if(!result.ok)throw Error(result.errors.join('\n'));}
    catch(error){pack=null;emit({ok:false,errors:[error.message]});process.exitCode=1;}
    if(pack){writeJsonFile(output,pack,[input]);emit({ok:true,scene:pack.scenes[0].name,output});}
  }else if(command==='export'){
    const pack=X.builtins().find(p=>p.id===input);if(!pack)throw Error('Unknown built-in pack: '+input+'. Choose '+X.builtins().map(p=>p.id).join(', ')+'.');
    writeJsonFile(output,pack);emit({ok:true,pack:pack.id,output});
  }else throw Error('Usage: '+usage);
}catch(error){emit({ok:false,errors:[error.message]});process.exitCode=2;}
