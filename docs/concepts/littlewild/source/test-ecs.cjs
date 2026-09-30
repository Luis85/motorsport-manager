'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {World}=require('./ecs.js'),{ActorBridge,validateModel}=require('./actor-systems.js');
const defaults=require('./content/actor-model.json');
const results=[],copy=x=>JSON.parse(JSON.stringify(x));
function test(name,fn){try{fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.stack});console.error('FAIL',name,e.stack);}}
function actor(task=null,id='c1'){return{id,creature:{x:2,y:3},needs:{food:83,water:52,energy:78,comfort:90,joy:67},
 learning:{practiceDay:1,practicedToday:{a:1},fatigue:69.9,recovering:false},
 feelings:{social:71,anger:46},inventory:{water:3},task};}
function old(c,dt,k){const t=c.task,n=c.needs,f=c.feelings,l=c.learning,clamp=x=>Math.max(0,Math.min(100,x));
 if(l.practiceDay!==k.day){l.practiceDay=k.day;l.practicedToday={};}
 const studying=t&&['train','practice'].includes(t.kind)&&t.phase==='work';
 l.fatigue=clamp(l.fatigue+dt*(studying?(t.style==='playful'?.45:.7):-.16));
 if(l.fatigue>=70)l.recovering=true;if(l.fatigue<=30)l.recovering=false;
 f.social=clamp(f.social-dt*(.035+.01*k.socialPreference));f.anger=clamp(f.anger-dt*.09);
 const working=t&&defaults.workingKinds.includes(t.kind);
 n.food=clamp(n.food-dt*(working?.1:.07));n.water=clamp(n.water-dt*(working?.13:.09));
 n.energy=clamp(n.energy-dt*(working?.12:.05)*(t?.phase==='walk'?1+k.loadLevel*.2:1));
 n.comfort=clamp(n.comfort-dt*(k.hasShelter?.02:.045));n.joy=clamp(n.joy-dt*.035);
}
test('Stable entity queries and one authoritative component reference',()=>{const w=new World();w.create('c2');w.create('c1');const n={food:40};w.set('c2','Needs',n);w.set('c1','Needs',{});assert.deepEqual(w.query('Needs'),['c2','c1']);assert.strictEqual(w.get('c2','Needs'),n);assert.throws(()=>w.create('c2'));w.remove('c2');assert.deepEqual(w.query('Needs'),['c1']);});
test('Stable actor-major scheduler; no structural mutation mid-phase',()=>{const w=new World(),seen=[];for(const id of ['c2','c1']){w.create(id);w.set(id,'Needs',{});}w.register({id:'last',phase:'tick',order:2,writes:['Needs'],update:({id})=>seen.push('last:'+id)});w.register({id:'first',phase:'tick',order:1,reads:['Needs'],update:({id})=>{seen.push('first:'+id);assert.throws(()=>w.create('new'));}});w.phase('tick',.1);assert.deepEqual(seen,['first:c2','last:c2','first:c1','last:c1']);assert.throws(()=>w.phase('tick',.5));});
test('Bridge handles new/removed entities, replacement components and replaced tasks',()=>{const a=actor(),b=actor(null,'c2'),bridge=new ActorBridge();bridge.sync([b,a]);assert.strictEqual(bridge.world.get('c1','Needs'),a.needs);a.needs={...a.needs};a.task={kind:'train',phase:'work',style:'playful'};bridge.sync([a]);assert.strictEqual(bridge.world.get('c1','Needs'),a.needs);assert.strictEqual(bridge.world.get('c1','Activity').task,a.task);assert.deepEqual(bridge.world.query('Needs'),['c1']);});
test('Invalid model definitions rejected and model parameters detached',()=>{const input=copy(defaults),bridge=new ActorBridge(input);input.needs.foodIdle=99;assert.equal(bridge.model.needs.foodIdle,defaults.needs.foodIdle);const invalid=copy(defaults);invalid.learning.recoveryEndsAt=99;assert.throws(()=>validateModel(invalid),/hysteresis/);});
const tasks=[null,{kind:'gather',phase:'walk'},{kind:'craft',phase:'work'},{kind:'train',phase:'work',style:'playful'},{kind:'practice',phase:'work',style:'together'},{kind:'rest',phase:'walk'},{kind:'produce',phase:'work'},{kind:'social',phase:'work'}];
for(const dt of [.05,.1,.25])for(const shelter of [false,true])for(const task of tasks)test('Legacy decay parity '+dt+':'+shelter+':'+(task?.kind||'idle')+':'+(task?.phase||''),()=>{const expected=actor(task),actual=copy(expected),ctx={day:2,socialPreference:2,loadLevel:3,hasShelter:shelter};old(expected,dt,ctx);const ecs=new ActorBridge();ecs.sync([actual]);ecs.tick(actual,dt,ctx);for(const k of ['needs','learning','feelings'])assert.deepEqual(actual[k],expected[k]);});
test('Real simulation uses ECS and save/load continuation remains deterministic',()=>{const L=require('./simulation.cjs'),S=require('./story-codec.js');const e=L.createWorldDemo();e.s.started=true;e.s.paused=false;assert(e.actorEcs instanceof ActorBridge);assert.strictEqual(e.actorEcs.world.get(e.creatures[0].id,'Needs'),e.creatures[0].needs);for(let i=0;i<40;i++)e.step(.1);const b=S.commit(S.inspect(S.encode(e)));assert(b.actorEcs instanceof ActorBridge);for(let i=0;i<40;i++){e.step(.1);b.step(.1);}assert.deepEqual(e.export(),b.export());});
const passed=results.filter(x=>x.passed).length;fs.writeFileSync(__dirname+'/ecs-results.json',JSON.stringify({passed,total:results.length,failed:results.length-passed,results},null,2)+'\n');console.log(passed+'/'+results.length+' ECS checks');if(passed!==results.length)process.exitCode=1;
