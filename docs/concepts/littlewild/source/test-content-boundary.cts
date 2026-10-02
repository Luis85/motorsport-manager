'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('./content-runtime.js'),A=require('./actor-ecs.js'),E=require('./economy-ecs.js');
const results=[];function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.message);}}

test('Content parse rejects accessors without invoking them',()=>{
 let touched=0;const value={safe:1};Object.defineProperty(value,'hidden',{enumerable:true,get(){touched++;return 2;}});
 assert.throws(()=>C.parse(value),/Accessors|JSON content/);assert.equal(touched,0);
});
test('Content copy rejects symbols, sparse arrays, hidden properties and cycles',()=>{
 const symbol={a:1};symbol[Symbol('x')]=2;assert.throws(()=>C.copy(symbol),/Symbol-keyed/);
 const sparse=[];sparse.length=2;sparse[1]=1;assert.throws(()=>C.copy({sparse}),/dense JSON lists/);
 const hidden={a:1};Object.defineProperty(hidden,'x',{value:2});assert.throws(()=>C.copy(hidden),/hidden properties/);
 const cycle={};cycle.self=cycle;assert.throws(()=>C.copy(cycle),/Cyclic/);
});
test('Public fingerprints reject behavior-shaped objects without invoking accessors',()=>{
 let touched=0;const doc={schemaVersion:1,library:{id:'x',version:1},components:{}};
 Object.defineProperty(doc.components,'bad',{enumerable:true,get(){touched++;return 1;}});
 assert.throws(()=>C.fingerprint(doc),/Accessors|JSON content/);assert.equal(touched,0);
});
test('Actor rule validation fails closed on executable or undefined fields',()=>{
 const base=JSON.parse(fs.readFileSync(__dirname+'/content/actor-rules.json'));
 const executable=JSON.parse(JSON.stringify(base));executable.execute=()=>true;assert.throws(()=>A.validateRules(executable),/JSON data/);
 const missing=JSON.parse(JSON.stringify(base));missing.needs.foodIdle=undefined;assert.throws(()=>A.validateRules(missing),/JSON data/);
});
test('Economy rule validation fails closed on executable fields',()=>{
 const base=JSON.parse(fs.readFileSync(__dirname+'/content/economy-rules.json'));base.callback=()=>true;
 assert.throws(()=>E.validateRules(base),/JSON data/);
});
function state(){return {player:{level:1,xp:0,coins:20},creature:{level:1,xp:0,coins:5},bond:10,rp:3,stats:{earned:0,researchEarned:0},completedQuests:[],ledger:[],log:[],progression:{prestige:4,earnedPrestige:4}};}
function actor(s){return {id:'c1',creature:s.creature,bond:s.bond,stats:s.stats,rpg:{cp:0}};}
test('Economy boundary validates real stat, chapter and actor identities',()=>{
 const s=state(),a=actor(s),ecs=E.create();
 assert.throws(()=>ecs.settle(s,a,{id:'bad:stat',stats:{'':1}}),/settlement stats/);
 assert.throws(()=>ecs.settle(s,a,{id:'bad:chapter',chapterId:'',guide:1}),/chapter ID/);
 const invalid={...a,id:'bad id'};assert.throws(()=>ecs.settle(s,invalid,{id:'bad:actor',guide:1}),/actor identity/);
});

const passed=results.filter(r=>r.passed).length;fs.writeFileSync(__dirname+'/content-boundary-results.json',JSON.stringify({passed,total:results.length,failed:results.length-passed,results},null,2)+'\n');console.log(`${passed}/${results.length} content-boundary checks passed`);if(passed!==results.length)process.exitCode=1;
