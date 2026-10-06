/* Current pause-policy behavior and preference isolation. Historical story migrations are intentionally outside the current-only contract. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const P=require('./interface-pause.js'),L=require('./simulation.cjs');
const out=[];function test(name,fn){try{fn();out.push({name,passed:true});}catch(e){out.push({name,passed:false,error:e.stack});console.error(name,e.message);}}
const state={started:true,paused:false};
for(const kind of['modal','tile','creature','more','world','planner','placement']){
 test(kind+' auto-pause on suspends without changing the explicit pause',()=>{const s={...state};assert.equal(P.evaluate(s,{[kind]:true},true).running,false);assert.equal(P.evaluate(s,{[kind]:true},true).automatic,true);assert.deepEqual(s,state);});
 test(kind+' auto-pause off leaves time running',()=>assert.equal(P.evaluate(state,{[kind]:true},false).running,true));
 test(kind+' manual pause wins with setting off',()=>assert.equal(P.evaluate({...state,paused:true},{[kind]:true},false).kind,'manual'));
}
for(const on of[true,false]){
 test('Hidden tab stops time regardless of '+on,()=>assert.equal(P.evaluate(state,{hidden:true},on).running,false));
 test('Save safety review stops time regardless of '+on,()=>assert.equal(P.evaluate(state,{safety:true},on).kind,'safety'));
 test('No open view restores time on '+on,()=>assert.equal(P.evaluate(state,{},on).running,true));
 test('Closing views preserves explicit pause on '+on,()=>assert.equal(P.evaluate({...state,paused:true},{},on).running,false));
}
test('Cinematic hold suspends native time with inspection off and preserves manual pause',()=>{const s={...state};assert.equal(P.evaluate(s,{cinematic:true},false).kind,'cinematic');assert.deepEqual(s,state);assert.equal(P.evaluate({...s,paused:true},{cinematic:true},false).kind,'manual');assert.equal(P.evaluate(s,{},false).running,true);assert(P.safetyView('storytelling-transition'));});
test('Nested views do not release another view hold',()=>{assert(!P.evaluate(state,{modal:false,planner:true},true).running);assert(P.evaluate(state,{},true).running);});
test('Not-started story never advances',()=>assert.equal(P.evaluate({...state,started:false},{},false).running,false));
for(const modal of['import-preview','content-preview','adventure-review','world-import','v10-growth-preview','reset','recover'])test('Safety policy recognizes '+modal,()=>assert(P.safetyView(modal)));
for(const modal of['settings','world-visuals','v10-land','training','warehouse','v10-confirm','v10-research'])test('Ordinary view obeys preference: '+modal,()=>assert.equal(P.safetyView(modal),false));
test('Preference defaults on without existing record',()=>assert.equal(P.create(()=>({getItem:()=>null})).pauseOnOpen,true));
test('Preference persists independently of story',()=>{let value;const store={getItem:()=>value,setItem:(k,v)=>{assert.equal(k,P.KEY);value=v;}};const p=P.create(()=>store);assert(p.set(false).persisted);assert.equal(P.create(()=>store).pauseOnOpen,false);assert.equal(JSON.parse(value).version,1);});
test('Unsupported preference versions and nonbooleans use safe default',()=>{for(const raw of[{version:2,pauseOnOpen:false},{version:1,pauseOnOpen:'false'}])assert(P.create(()=>({getItem:()=>JSON.stringify(raw)})).pauseOnOpen);});
test('Unavailable storage does not disable a session preference',()=>{const p=P.create(()=>{throw Error('blocked');});assert(p.pauseOnOpen);assert.equal(p.set(false).persisted,false);assert.equal(p.pauseOnOpen,false);assert(p.error);});
test('Corrupted preferences are nonfatal',()=>assert.equal(P.create(()=>({getItem:()=>'{bad'})).pauseOnOpen,true));
test('Invalid setter does not partially mutate the setting',()=>{const p=P.create(()=>({getItem:()=>null,setItem:()=>{}}));assert.throws(()=>p.set('false'));assert(p.pauseOnOpen);});
test('Pause preference is not authored content or portable game state',()=>{const e=L.createWorldDemo(),before=JSON.stringify(e.export());const prefs=P.create(()=>({getItem:()=>null,setItem:()=>{}}));prefs.set(false);prefs.status(e.s,{modal:true});assert.equal(JSON.stringify(e.export()),before);assert.equal(e.export().version,8);});
const report={passed:out.filter(x=>x.passed).length,total:out.length,results:out};fs.writeFileSync(__dirname+'/pause-policy-results.json',JSON.stringify(report,null,2));console.log(report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
