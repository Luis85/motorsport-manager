'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const BehaviorTree=require('./behavior-tree.js');
const results=[];function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.message);}}

const actions={ok:()=> 'success',fail:()=> 'failure',running:()=> 'running'};
test('Behavior nodes use exact data-only schemas',()=>{
 const tree=new BehaviorTree(actions);
 assert.throws(()=>tree.validate({id:'a',name:'A',type:'action',action:'ok',execute:'code'}),/fields/);
 assert.throws(()=>tree.validate({id:'a',name:'A',type:'selector',children:[],extra:true}),/fields|composite/);
});
test('Behavior validation rejects accessors without invoking them',()=>{
 const tree=new BehaviorTree(actions);let touched=0;
 const node={id:'a',name:'A',type:'action'};Object.defineProperty(node,'action',{enumerable:true,get(){touched++;return 'ok';}});
 assert.throws(()=>tree.validate(node),/Invalid behavior node/);assert.equal(touched,0);
});
test('Cooldown memory is safe for inherited-key node IDs',()=>{
 const tree=new BehaviorTree(actions),doc={id:'constructor',name:'Cooldown',type:'cooldown',seconds:5,children:[{id:'child',name:'Child',type:'action',action:'ok'}]};
 assert(tree.validate(doc));const memory={};
 let out=tree.tick(doc,{time:10,behaviorMemory:memory});assert.equal(out.status,'success');assert.equal(Object.hasOwn(memory,'constructor'),true);assert.equal(memory.constructor,15);
 out=tree.tick(doc,{time:11,behaviorMemory:memory});assert.equal(out.status,'failure');
});
test('Selectors and sequences preserve deterministic child order',()=>{
 const calls=[],tree=new BehaviorTree({a:()=>{calls.push('a');return 'failure';},b:()=>{calls.push('b');return 'success';},c:()=>{calls.push('c');return 'success';}});
 const doc={id:'root',name:'Root',type:'selector',children:[{id:'a-node',name:'A',type:'action',action:'a'},{id:'seq',name:'Sequence',type:'sequence',children:[{id:'b-node',name:'B',type:'action',action:'b'},{id:'c-node',name:'C',type:'action',action:'c'}]}]};
 assert(tree.validate(doc));assert.equal(tree.tick(doc,{time:1,behaviorMemory:{}}).status,'success');assert.deepEqual(calls,['a','b','c']);
});
test('Behavior ticks reject invalid time and corrupted cooldown memory',()=>{
 const tree=new BehaviorTree(actions),doc={id:'cool',name:'Cooldown',type:'cooldown',seconds:2,children:[{id:'child',name:'Child',type:'action',action:'ok'}]};
 assert(tree.validate(doc));assert.throws(()=>tree.tick(doc,{time:NaN,behaviorMemory:{}}),/finite simulation time/);
 assert.throws(()=>tree.tick(doc,{time:1,behaviorMemory:{cool:Infinity}}),/cooldown memory/);
});
test('Action registration rejects duplicate and malformed capabilities',()=>{
 const tree=new BehaviorTree(actions);assert.throws(()=>tree.register('ok',()=> 'success'),/unique/);assert.throws(()=>tree.register('Bad Action',()=> 'success'),/unique/);
});
test('Compiled action registry is not externally reachable',()=>{
 const tree=new BehaviorTree(actions);assert.equal(Object.hasOwn(tree,'actions'),false);assert.equal(Object.hasOwn(tree,'#actions'),false);
 assert.equal(tree.tick({id:'a',name:'A',type:'action',action:'ok'},{time:0,behaviorMemory:{}}).status,'success');
});

const passed=results.filter(r=>r.passed).length;fs.writeFileSync(__dirname+'/behavior-tree-results.json',JSON.stringify({passed,total:results.length,failed:results.length-passed,results},null,2)+'\n');console.log(`${passed}/${results.length} behavior-tree checks passed`);if(passed!==results.length)process.exitCode=1;
