'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const A=require('./actor-ecs.js');
const results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.message);}}
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function actor(task){return {id:'c1',personality:'curious',creature:{x:0,y:0,dir:1},inventory:{},needs:{food:100,water:100,energy:100,comfort:100,joy:100},learning:{practiceDay:1,practicedToday:{},fatigue:0,recovering:false},feelings:{social:100,anger:0},task};}
test('Movement advances the authoritative transform without completing work',()=>{
 const c=actor({kind:'gather',phase:'walk',path:[{x:1,y:0}],duration:5,elapsed:0}),ecs=A.create();
 const out=ecs.advanceActivity(c,.1,{walkable:()=>true,moveRate:2,workRate:3});
 near(c.creature.x,.2);near(c.task.elapsed,0);assert.equal(out.state,'walking');assert.equal(out.completed,false);
 assert.equal(ecs.world.get('c1','Task'),c.task);assert.equal(ecs.world.get('c1','Intent').kind,'gather');
});
test('Arrival changes phase but never spends work time in the arrival tick',()=>{
 const c=actor({kind:'gather',phase:'walk',path:[{x:.1,y:0}],duration:5,elapsed:0}),ecs=A.create();
 const out=ecs.advanceActivity(c,.1,{walkable:()=>true,moveRate:2,workRate:3});
 near(c.creature.x,.1);assert.equal(c.task.phase,'work');near(c.task.elapsed,0);assert.equal(out.state,'arrived');
});
test('Empty paths enter work without progress in the same tick',()=>{
 const c=actor({kind:'rest',phase:'walk',path:[],duration:5,elapsed:1}),ecs=A.create();
 const out=ecs.advanceActivity(c,.1,{walkable:()=>true,moveRate:2,workRate:3});
 assert.equal(c.task.phase,'work');near(c.task.elapsed,1);assert.equal(out.state,'arrived');
});
test('Blocked movement reports an outcome without deleting domain state',()=>{
 const c=actor({kind:'build',phase:'walk',path:[{x:1,y:0}],duration:5,elapsed:0}),ecs=A.create();
 const out=ecs.advanceActivity(c,.1,{walkable:()=>false,moveRate:2,workRate:1});
 assert.equal(out.state,'blocked');near(c.creature.x,0);assert.equal(c.task.path.length,1);assert.equal(ecs.world.get('c1','Intent').status,'blocked');
});
test('Work progression is rate based and reports exact completion',()=>{
 const c=actor({kind:'craft',phase:'work',path:[],duration:1,elapsed:.8}),ecs=A.create();
 let out=ecs.advanceActivity(c,.1,{walkable:()=>true,moveRate:2,workRate:1.5});
 near(c.task.elapsed,.95);near(out.progress,.15);assert.equal(out.completed,false);
 out=ecs.advanceActivity(c,.1,{walkable:()=>true,moveRate:2,workRate:1.5});
 near(c.task.elapsed,1.1);assert.equal(out.completed,true);assert.equal(ecs.world.get('c1','Intent').status,'completed');
});
test('Roster synchronization removes transient Task and Intent components',()=>{
 const c=actor({kind:'rest',phase:'work',path:[],duration:2,elapsed:0}),ecs=A.create();
 ecs.sync([c]);ecs.advanceActivity(c,.1,{walkable:()=>true,moveRate:1,workRate:1});assert(ecs.world.has('c1','Task','Intent'));
 c.task=null;ecs.sync([c]);assert(!ecs.world.has('c1','Task'));assert(!ecs.world.has('c1','Intent'));
});
test('Activity input rejects hidden or non-finite authority',()=>{
 const c=actor({kind:'rest',phase:'work',path:[],duration:2,elapsed:0}),ecs=A.create();
 assert.throws(()=>ecs.advanceActivity(c,.1,{walkable:true,moveRate:1,workRate:1}),/inputs/);
 assert.throws(()=>ecs.advanceActivity(c,.1,{walkable:()=>true,moveRate:Infinity,workRate:1}),/inputs/);
});
const passed=results.filter(r=>r.passed).length;fs.writeFileSync(__dirname+'/ecs-activity-results.json',JSON.stringify({passed,total:results.length,failed:results.length-passed,results},null,2)+'\n');console.log(`${passed}/${results.length} ECS activity checks passed`);if(passed!==results.length)process.exitCode=1;
