#!/usr/bin/env node
/* Local scenario validation and capture. Does not contact a server or run pack code. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const X=require('../scenario-runtime.js'),S=require('../scenario-story.js');
const [command,input,output]=process.argv.slice(2);
function write(file,value){
  if(!file)throw Error('Provide an output .json path.');
  if(input&&path.resolve(file)===path.resolve(input))throw Error('Output must not overwrite the input.');
  const temp=file+'.tmp';try{fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n');fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
try{
  if(command==='validate'){
    if(!input)throw Error('Usage: scenario-cli.cjs validate pack.json');
    const result=X.validate(fs.readFileSync(input,'utf8'));
    console.log(JSON.stringify({ok:result.ok,errors:result.errors,pack:result.pack?.id,scenes:result.sceneCount,fingerprint:result.fingerprint,sourceSchemaVersion:result.sourceSchemaVersion,migrationNotes:result.migrationNotes||[]},null,2));
    if(!result.ok)process.exitCode=1;
  }else if(command==='capture'){
    if(!input)throw Error('Usage: scenario-cli.cjs capture story.json output.pack.json');
    const engine=S.commit(S.inspect(fs.readFileSync(input,'utf8'))),pack=X.capture(engine);
    const result=X.validate(pack);if(!result.ok)throw Error(result.errors.join('\n'));
    write(output,pack);console.log('Captured '+pack.scenes[0].name+' to '+output);
  }else if(command==='export'){
    const pack=X.builtins().find(p=>p.id===input);if(!pack)throw Error('Unknown built-in pack.');
    write(output,pack);console.log('Exported '+pack.name);
  }else{
    console.log('Usage:\n  node source/tools/scenario-cli.cjs validate pack.json\n  node source/tools/scenario-cli.cjs capture story.json output.pack.json\n  node source/tools/scenario-cli.cjs export littlewild output.pack.json');
    process.exitCode=command?2:0;
  }
}catch(error){console.error(error.message);process.exitCode=1;}
