#!/usr/bin/env node
'use strict';
/** Offline companion for an external content editor. JSON stdout; deterministic exit codes.
 * node tools/content-cli.cjs validate library.json [--base active-library.json]
 * node tools/content-cli.cjs normalize patch.json --base active-library.json --out merged.json
 * node tools/content-cli.cjs export [--out library.json]
 * node tools/content-cli.cjs schema [--out schema.json]
 */
const {readJsonFile,writeJsonFile,helpRequested,emit}=require('./cli-io.cjs');
// Transitional: the bundled Littlewild game is installed (inside the JSON error boundary, after
// help) until game folders supply profiles.
const {installLittlewild}=require('../content-installers/littlewild-game.cjs');
function main(args){
 if(helpRequested(args)){emit({ok:true,usage:'content-cli.cjs validate <file> [--base <file>] | normalize <file> --out <file> [--base <file>] | export [--out <file>] | schema [--out <file>]'});return;}
 const command=args.shift(),options={};let filename=null;
 while(args.length){const value=args.shift();if(['--base','--out'].includes(value)){if(!args.length||args[0].startsWith('--'))throw Error('A path is required after '+value);if(options[value.slice(2)])throw Error('Duplicate option: '+value);options[value.slice(2)]=args.shift();}else if(value.startsWith('--')||filename)throw Error('Unexpected argument: '+value);else filename=value;}
 installLittlewild();const C=require('../content-runtime.js');const registry=new C.Registry();
 const read=file=>readJsonFile(file,C.MAX_BYTES);
 const write=value=>{if(options.out){const destination=writeJsonFile(options.out,value,[filename,options.base].filter(Boolean));emit({ok:true,output:destination});}else emit(value);};
 if(['export','schema'].includes(command)&&(filename||options.base))throw Error(command+' accepts only --out <file>.');
 if(command==='validate'&&options.out)throw Error('Validate does not write files; use normalize --out <file>.');
 if(command==='export'){write(registry.export());return;}
 if(command==='schema'){write(C.SCHEMA);return;}
 if(!['validate','normalize'].includes(command)||!filename)throw Error('Use validate <file>, normalize <file> --out <file>, export, or schema. Optional: --base <active-library.json>.');
 if(options.base){const base=registry.prepare(read(options.base));if(!base.ok||base.kind!=='library'){emit({ok:false,errors:base.errors.length?base.errors:[C.diagnostic('FULL_BASE_REQUIRED','/','The base must be a complete library.')]});process.exitCode=1;return;}registry.commit(base);}
 const result=registry.prepare(read(filename));
 if(!result.ok){emit({ok:false,errors:result.errors,warnings:result.warnings});process.exitCode=1;return;}
 if(command==='normalize'){if(!options.out)throw Error('Normalize requires --out, so your input is never overwritten implicitly.');write(result.candidate);return;}
 write({ok:true,kind:result.kind,baseFingerprint:result.baseFingerprint,fingerprint:result.fingerprint,counts:result.counts,diff:result.diff,warnings:result.warnings,errors:[]});
}
try{main(process.argv.slice(2));}catch(error){process.stdout.write(JSON.stringify({ok:false,errors:error.issues||[{severity:'error',code:'CLI_USAGE_OR_IO',path:'/',message:error.message,hint:''}]},null,2)+'\n');process.exitCode=2;}
