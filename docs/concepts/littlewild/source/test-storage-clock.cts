'use strict';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const Storage=require('./story-storage.js');
const Clock=require('./simulation-clock.js');
const results:Array<{name:string;passed:boolean;error?:string}>=[];
function test(name:string,action:()=>void):void{try{action();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
function fixture(){
 const data=new Map<string,string>(),writes:Array<[string,string]>=[];
 let denied=false;
 const provider=()=>{if(denied)throw 'storage denied';return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{writes.push([key,value]);data.set(key,value);}};};
 const validate=(input:unknown)=>{const value=typeof input==='string'?JSON.parse(input):input;assert(value&&typeof value==='object');assert.equal(value.version,10);assert(value.savedAt===null||typeof value.savedAt==='string');return value;};
 const storage=new Storage(provider,validate,{primary:'story',backup:'backup',legacy:['legacy'],oldBackups:['old-backup']});
 return {storage,data,writes,deny:(value:boolean)=>{denied=value;}};
}
test('Timestamp-only saves validate before deduplication',()=>{const f=fixture();assert(f.storage.write({version:10,savedAt:null}));assert.throws(()=>f.storage.write({version:10,savedAt:42}));assert.equal(f.writes.length,1);assert.equal(f.data.get('story'),'{"version":10,"savedAt":null}');});
test('Valid timestamp-only changes do not create redundant writes',()=>{const f=fixture();f.storage.write({version:10,savedAt:null});assert.equal(f.storage.write({version:10,savedAt:'later'}),false);assert.equal(f.writes.length,1);assert(f.storage.write({version:10,savedAt:'later'},true));});
test('Quota failure preserves the last successful payload and retries',()=>{const f=fixture();f.storage.write({version:10,savedAt:null,state:1});f.deny(true);assert.throws(()=>f.storage.write({version:10,savedAt:null,state:2}));assert.equal(f.storage.available,false);f.deny(false);assert(f.storage.write({version:10,savedAt:null,state:2}));assert.equal(f.writes.length,2);assert.equal(f.storage.available,true);});
test('Corruption blocks replacement until recovery is reviewed',()=>{const f=fixture();f.data.set('story','broken');assert.equal(f.storage.load().error,'corrupt');assert.throws(()=>f.storage.write({version:10,savedAt:null}));assert.equal(f.writes.length,0);f.storage.allowReplacement();assert(f.storage.write({version:10,savedAt:null}));});
test('A corrupt current save does not silently fall back to another story',()=>{const f=fixture();f.data.set('story','broken');f.data.set('legacy','{"version":10,"savedAt":null}');assert.equal(f.storage.load().error,'corrupt');});
test('Provider failures carry diagnostics even when thrown as strings',()=>{const f=fixture();f.deny(true);assert.deepEqual(f.storage.load(),{error:'unavailable',detail:'storage denied'});f.deny(false);assert.deepEqual(f.storage.load(),{value:null});assert.equal(f.storage.available,true);});
test('Invalid backups never overwrite a recovery copy',()=>{const f=fixture();assert(f.storage.backup({version:10,savedAt:null,state:3}));const before=f.data.get('backup');assert.equal(f.storage.backup({version:9,savedAt:null}),false);assert.equal(f.data.get('backup'),before);assert.equal(f.storage.recovery().state,3);});
test('A corrupt recovery copy does not misreport available storage',()=>{const f=fixture();f.data.set('backup','broken');assert.throws(()=>f.storage.recovery());assert.equal(f.storage.available,true);});
test('Missing recovery and denied recovery return actionable errors',()=>{const f=fixture();assert.throws(()=>f.storage.recovery(),/no recovery copy/);f.deny(true);assert.throws(()=>f.storage.recovery());assert.equal(f.storage.available,false);});
test('Fine clock steps cannot advance without supplied elapsed time',()=>{const c=new Clock(1e-12);let count=0;assert.equal(c.advance(0,1,()=>{count++;}),0);assert.equal(count,0);assert.equal(c.pending,0);});
test('Invalid clock arguments preserve pending time',()=>{const c=new Clock(.1);c.advance(.05,1,()=>{});for(const [elapsed,speed] of [[NaN,1],[-1,1],[.1,Infinity],[.1,-1]]){assert.throws(()=>c.advance(elapsed,speed,()=>{}));assert.equal(c.pending,.05);}});
test('Thirty and sixty Hz delivery retain the same fixed-step progression',()=>{for(const hz of [30,60]){const c=new Clock(.1);let count=0;for(let i=0;i<hz*3;i++)c.advance(1/hz,1,()=>count++);assert.equal(count,30);assert(c.pending<1e-10);}});
test('Tick failure clears debt and permits a clean next frame',()=>{const c=new Clock(.1);let count=0;assert.throws(()=>c.advance(.1,16,()=>{count++;throw Error('failed tick');}),/failed tick/);assert.equal(count,1);assert.equal(c.pending,0);assert.equal(c.advance(.1,1,()=>count++),1);assert.equal(count,2);});
test('A suspension discards offline time rather than catching up',()=>{const c=new Clock(.1);let elapsed=0;assert.equal(c.advance(86400,1,(dt:number)=>elapsed+=dt),1);assert.equal(elapsed,.1);});
test('Clock reset discards a fractional frame',()=>{const c=new Clock(.1);c.advance(.09,1,()=>{});c.reset();assert.equal(c.advance(.01,1,()=>{throw Error('unexpected tick');}),0);});
const report={passed:results.filter(r=>r.passed).length,total:results.length,results};
fs.writeFileSync(path.join(__dirname,'storage-clock-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
