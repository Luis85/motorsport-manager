#!/usr/bin/env node
'use strict';
/** Offline companion for an external content editor. JSON stdout; deterministic exit codes.
 * node tools/content-cli.cjs validate library.json [--base active-library.json]
 * node tools/content-cli.cjs normalize patch.json --base active-library.json --out merged.json
 * node tools/content-cli.cjs export [--out library.json]
 * node tools/content-cli.cjs schema [--out schema.json]
 */
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const C=require('../content-runtime.js');
function main(args){
 const command=args.shift(),options={};let filename=null;
 while(args.length){const value=args.shift();if(['--base','--out'].includes(value)){if(!args.length||args[0].startsWith('--'))throw Error('A path is required after '+value);options[value.slice(2)]=args.shift();}else if(value.startsWith('--')||filename)throw Error('Unexpected argument: '+value);else filename=value;}
 const registry=new C.Registry();
 const read=file=>{const stat=fs.statSync(file);if(!stat.isFile()||stat.size>C.MAX_BYTES)throw Error('Choose a JSON file no larger than 1 MiB.');return fs.readFileSync(file,'utf8');};
 const write=value=>{const json=JSON.stringify(value,null,2)+'\n';if(options.out){const destination=path.resolve(options.out),temporary=destination+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temporary,json,{encoding:'utf8',flag:'wx'});fs.renameSync(temporary,destination);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}process.stdout.write(JSON.stringify({ok:true,output:destination})+'\n');}else process.stdout.write(json);};
 if(command==='export'){write(registry.export());return;}
 if(command==='schema'){write(C.SCHEMA);return;}
 if(!['validate','normalize'].includes(command)||!filename)throw Error('Use validate <file>, normalize <file> --out <file>, export, or schema. Optional: --base <active-library.json>.');
 if(options.base){const base=registry.prepare(read(options.base));if(!base.ok||base.kind!=='library'){write({ok:false,errors:base.errors.length?base.errors:[C.diagnostic('FULL_BASE_REQUIRED','/','The base must be a complete library.')]});process.exitCode=1;return;}registry.commit(base);}
 const result=registry.prepare(read(filename));
 if(!result.ok){write({ok:false,errors:result.errors,warnings:result.warnings});process.exitCode=1;return;}
 if(command==='normalize'){if(!options.out)throw Error('Normalize requires --out, so your input is never overwritten implicitly.');write(result.candidate);return;}
 write({ok:true,kind:result.kind,baseFingerprint:result.baseFingerprint,fingerprint:result.fingerprint,counts:result.counts,diff:result.diff,warnings:result.warnings,errors:[]});
}
try{main(process.argv.slice(2));}catch(error){process.stdout.write(JSON.stringify({ok:false,errors:error.issues||[{severity:'error',code:'CLI_USAGE_OR_IO',path:'/',message:error.message,hint:''}]},null,2)+'\n');process.exitCode=2;}
