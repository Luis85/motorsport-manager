/* Current presentation behavior: interpolation, pacing and label layout. Historical story snapshots are intentionally outside the current-only contract. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {MotionSamples,FramePacer,placeLabels,visibleAnchor}=require('./world-presentation.js');
const L=require('./simulation.cjs');
const results=[];function test(name,fn){try{fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.stack});console.error(name,e.message);}}
const c=()=>({id:'c1',creature:{x:5,y:8},task:{kind:'gather',phase:'walk'}});
function motion(){const a=c(),m=new MotionSamples();m.begin([a]);a.creature.x=5.1;m.end([a],.1);return{a,m};}
for(const alpha of[0,.1,.25,.5,.75,.9,1])test('Observed sample interpolation at '+alpha,()=>{const {a,m}=motion();const p=m.sample(a,.1,alpha,true);assert(Math.abs(p.x-(5+.1*alpha))<1e-12);assert.equal(p.z,8);});
for(const alpha of[-10,8,NaN,Infinity])test('Interpolation is bounded for '+alpha,()=>{const{a,m}=motion();const p=m.sample(a,.1,alpha,true);assert(p.x>=5&&p.x<=5.1);});
test('Sampling never mutates a creature',()=>{const{a,m}=motion(),saved=JSON.stringify(a);for(let i=0;i<100;i++)m.sample(a,.1,i/100,true);assert.equal(JSON.stringify(a),saved);});
test('Unobserved creature uses current position',()=>{const a=c();assert.deepEqual(new MotionSamples().sample(a,0,.2,true),{x:5,z:8});});
test('Pause settles at the latest observed position, then stays still',()=>{const{a,m}=motion();assert.deepEqual(m.sample(a,.1,0,false),{x:5.1,z:8});});
test('External advance cannot reuse an earlier movement pair',()=>{const{a,m}=motion();assert.equal(m.sample(a,50,0,true).x,5.1);});
test('Import/restart clears every movement sample',()=>{const{a,m}=motion();m.reset();assert.equal(m.pairs.size,0);assert.equal(m.sample(a,.1,0,true).x,5.1);});
test('New assignment snaps instead of traversing old work',()=>{const{a,m}=motion();a.task={kind:'rest',phase:'work'};assert.equal(m.sample(a,.1,0,true).x,5.1);});
test('Teleport does not animate through unowned terrain',()=>{const a=c(),m=new MotionSamples();m.begin([a]);a.creature.x=40;m.end([a],.1);assert.equal(m.sample(a,.1,.1,true).x,40);});
test('Quest departure cannot show a departing creature as present',()=>{const a=c(),m=new MotionSamples();m.begin([a]);a.creature.x=5.1;a.activeQuest={status:'away'};m.end([a],.1);assert.equal(m.sample(a,.1,0,true).x,5.1);});
test('Multiple accelerated ticks keep the last two observed samples',()=>{const a=c(),m=new MotionSamples();for(let i=0;i<4;i++){m.begin([a]);a.creature.x+=.1;m.end([a],(i+1)*.1);}assert(Math.abs(m.sample(a,.4,.5,true).x-5.35)<1e-12);});
test('Removing a creature also removes its interpolation state',()=>{const{m}=motion();m.begin([]);m.end([],.2);assert.equal(m.pairs.size,0);});
for(const hz of[30,60,90,120,144])test('30 Hz pacing is independent of '+hz+' Hz requestAnimationFrame delivery',()=>{const p=new FramePacer(30);let count=0;for(let i=0;i<hz*3;i++)count+=+p.due(i*1000/hz);assert(count>=89&&count<=91,'count='+count);});
test('Pacer rejects invalid cadence',()=>{for(const n of[0,-1,NaN,Infinity,1000])assert.throws(()=>new FramePacer(n));});
test('Pacer ignores invalid timestamps',()=>{const p=new FramePacer();assert.equal(p.due(NaN),false);assert.equal(p.due(Infinity),false);});
test('Forced input paints immediately without an extra timer',()=>{const p=new FramePacer();assert(p.due(0));assert(!p.due(5));assert(p.due(5,true));assert(!p.due(7));});
test('A long suspension paints once, not a backlog of frames',()=>{const p=new FramePacer();p.due(0);assert(p.due(12000));assert(!p.due(12001));});
test('Pacer reset handles a new document/story lifecycle',()=>{const p=new FramePacer();p.due(50);p.reset();assert(p.due(0));});
const entry=(id,x=300,y=300)=>({id,anchor:{x,y},width:90,height:30,selected:false});
test('Selected label has first choice in a crowded location',()=>{const all=[entry('c1'),{...entry('c2'),selected:true},entry('c3')],out=placeLabels(all,900,700);assert.equal(out[0].id,'c2');assert.equal(out[0].lane,0);});
test('Six overlapping names use distinct non-overlapping lanes',()=>{const out=placeLabels(Array.from({length:6},(_,i)=>entry('c'+i,300,400)),900,700);assert(out.every(e=>!e.hidden));for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++)assert(Math.abs(out[i].y-out[j].y)>=37);});
test('Stable ids keep layout stable when simulation order changes',()=>{const a=[entry('c1'),entry('c2'),entry('c3')];assert.deepEqual(placeLabels(a,900,700),placeLabels(a.reverse(),900,700));});
test('Existing lanes are kept when no conflict exists',()=>{const out=placeLabels([{...entry('c1'),lane:2}],900,700);assert.equal(out[0].lane,2);});
test('Selected label remains available when nearby labels do not fit',()=>{const out=placeLabels([{...entry('c1',400,55),selected:true},entry('c2',400,55)],900,700);assert(!out.find(x=>x.id==='c1').hidden);});
test('Keyboard focus receives priority over ordinary labels',()=>{const out=placeLabels([entry('c1'),{...entry('c2'),focused:true}],900,700);assert.equal(out[0].id,'c2');assert(!out[0].hidden);});
test('Long labels remain horizontally within viewport',()=>{for(const x of[10,320-10]){const out=placeLabels([{...entry('c1',x),width:216}],320,600)[0];assert(out.x-out.width/2>=7.99&&out.x+out.width/2<=312.01);}});
for(const p of[null,{x:NaN,y:300},{x:-100,y:300},{x:2000,y:300},{x:300,y:5},{x:300,y:900}])test('Off-screen/invalid anchor cannot leave a misplaced floating name: '+JSON.stringify(p),()=>assert.equal(visibleAnchor(p,900,700),false));
test('Layout and sampling consume no simulation randomness or resources',()=>{const e=L.createWorldDemo(),before=JSON.stringify(e.export()),m=new MotionSamples();m.begin(e.creatures);m.end(e.creatures,e.s.simTime);for(let i=0;i<50;i++){for(const c of e.creatures)m.sample(c,e.s.simTime,.5,true);placeLabels([entry('c1'),entry('c2')],900,700);}assert.equal(JSON.stringify(e.export()),before);});
const report={passed:results.filter(r=>r.passed).length,total:results.length,results};fs.writeFileSync(__dirname+'/v15-presentation-results.json',JSON.stringify(report,null,2));console.log(report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
