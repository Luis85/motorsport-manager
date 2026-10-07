#!/usr/bin/env node
'use strict';
/** Offline Growth-library tooling. Export/schema write JSON to stdout. Validation
 * checks bounded shape and semantic references. Diff is review data, not JSON Patch.
 * Exit 0 accepted, 1 rejected content, 2 invalid usage or I/O; never edits files. */
const {readJsonFile,helpRequested,emit}=require('./cli-io.cjs');
// Transitional: the bundled Littlewild game is installed (inside the JSON error boundary, after
// help) until game folders supply profiles.
const {installLittlewild}=require('../test-support/littlewild-game.cjs');
function diff(a,b,path=''){if(JSON.stringify(a)===JSON.stringify(b))return[];if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return[{path:path||'/',before:a??null,after:b??null}];return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>diff(a[k],b[k],path+'/'+k.replace(/~/g,'~0').replace(/\//g,'~1')));}
try{const args=process.argv.slice(2);if(helpRequested(args)){emit({ok:true,usage:'growth-cli.cjs export | schema | validate <file> | diff <file>'});process.exit(0);}const[action,file,...extra]=args;if(extra.length)throw Error('Unexpected extra arguments.');if(!['export','schema','validate','diff'].includes(action)||(['export','schema'].includes(action)?!!file:!file))throw Error('Use export, schema, validate <file>, or diff <file>.');installLittlewild();require('../simulation.cjs');const G=require('../growth-content.js');let out;
 if(action==='export'&&!file)out=G.clone(G.content);else if(action==='schema'&&!file)out=G.clone(G.schema);else if(['validate','diff'].includes(action)&&file){const v=G.validate(readJsonFile(file,1024*1024));if(!v.ok){out={ok:false,errors:v.errors};process.exitCode=1;}else{out={ok:true,fingerprint:G.hashOf(v.content),research:v.content.research.length,interactions:v.content.interactions.length};if(action==='diff'){const changes=diff(G.content,v.content);out={...out,baseFingerprint:G.hash,changeCount:changes.length,truncated:changes.length>200,changes:changes.slice(0,200)};}}}else throw Error('Usage: growth-cli.cjs export | schema | validate <file> | diff <file>');
 console.log(JSON.stringify(out,null,2));
}catch(error){console.log(JSON.stringify({ok:false,errors:[error.message]},null,2));process.exitCode=2;}
