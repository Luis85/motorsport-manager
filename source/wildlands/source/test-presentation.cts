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
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
test('Status queries read the replacement engine and never change either story',()=>{
 const old=L.createWorldDemo(),replacement=L.createWorldDemo();old.actor.name='Old friend';replacement.actor.name='<New friend>';replacement.s.allowance.limit=7;replacement.actor.creature.coins=23;old.workRate=()=>2;replacement.workRate=()=>5;
 let current=old;const context={get engine(){return current;},esc:escape,icon:()=>'',ui:{}};
 const status=require('./ui-status.js').create(context),before=[old.export(),replacement.export()];
 assert(status.allowanceMarkup().includes('Old friend'));assert.equal(status.taskETA({phase:'work',duration:10,elapsed:0}),'5 sim seconds');
 current=replacement;const rendered=status.allowanceMarkup();assert(rendered.includes('&lt;New friend&gt;'));assert(rendered.includes('>7</strong>'));assert(rendered.includes('>23</strong>'));assert(!rendered.includes('Old friend'));assert.equal(status.taskETA({phase:'work',duration:10,elapsed:0}),'2 sim seconds');
 assert.deepEqual([old.export(),replacement.export()],before);
});
test('Modal cancellation restores focus and invalidates a delayed open callback',()=>{
 const prior={document:global.document,requestAnimationFrame:global.requestAnimationFrame};const frames=[],calls={cancel:0,suspend:0,resume:0,title:0,invoker:0};
 const classes=()=>({add(){},remove(){}}),body={classList:classes()},content={scrollTop:21},invoker={isConnected:true,offsetParent:{},focus(){calls.invoker++;global.document.activeElement=this;}};
 const modal={querySelector:()=>content,querySelectorAll:()=>[],contains:()=>false},title={focus(){calls.title++;}},nodes={modal,'modal-title':title,toasts:{querySelectorAll:()=>[]},overlay:{classList:classes()},app:{inert:false},world:invoker};
 const ui={modal:null,modalId:null,history:[],panelScroll:new Map(),focusRequest:0},engine=L.createWorldDemo(),before=engine.export();
 const context={$:id=>nodes[id],ui,get engine(){return engine;},world:{placement:null,lastDrawAt:1},worldUI:{suspend(){calls.suspend++;},resume(){calls.resume++;}},contentUI:{view:{}},cancelPendingReads(){calls.cancel++;},renderModal(){},refreshPlacement(){},updateUI(){}};
 try{
  global.document={body,activeElement:invoker};global.requestAnimationFrame=callback=>frames.push(callback);
  const view=require('./ui-modal.js').create(context);view.openModal('settings');assert.equal(nodes.app.inert,true);assert.equal(calls.suspend,1);
  view.closeModal();assert.equal(nodes.app.inert,false);assert.equal(calls.invoker,1);assert.equal(calls.cancel,1);assert.equal(calls.resume,1);
  frames.forEach(callback=>callback());assert.equal(calls.title,0);assert.equal(ui.modal,null);assert.equal(ui.panelScroll.get('settings:').body,21);assert.deepEqual(engine.export(),before);
 }finally{Object.assign(global,prior);}
});
function listenerFixture(){
 const listeners=[],importFile={value:'chosen',addEventListener(type,listener){this.listener=listener;}},overlay={addEventListener(){}};
 return {listeners,importFile,document:{addEventListener(type,listener,options){listeners.push({type,listener,options});},querySelectorAll:()=>[]},window:{addEventListener(){}},$:id=>id==='import-file'?importFile:overlay};
}
async function asynchronousChecks(){
 async function check(name,work){try{await work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error(name,error.message);}}
 await check('Click intents install once and dispatch to the current engine after replacement',async()=>{
  const prior=global.document,fixture=listenerFixture(),calls=[];let current={interactionIssue:()=>null,care:id=>{calls.push('old:'+id);return{ok:true};}};
  const passive={action:()=>false},context={get engine(){return current;},ui:{modal:null},villageUI:passive,worldExplorer:passive,worldUI:passive,colonyUI:passive,contentUI:passive,progressionUI:passive,result(){}};
  try{global.document=fixture.document;require('./ui-actions.js').install(context);assert.deepEqual(fixture.listeners.map(entry=>entry.type),['click']);
   current={interactionIssue:()=>null,care:id=>{calls.push('new:'+id);return{ok:true};}};const button={disabled:false,dataset:{act:'care',id:'feed'}};
   await fixture.listeners[0].listener({target:{closest:()=>button}});assert.deepEqual(calls,['new:feed']);
  }finally{global.document=prior;}
 });
 await check('A cancelled asynchronous story read cannot replace the current import review',async()=>{
  const prior={document:global.document,window:global.window},fixture=listenerFixture(),ui={pendingImport:{marker:'retained review'}},opened=[];let sequence=0,release;
  const context={$:fixture.$,ui,get storyReadId(){return sequence;},set storyReadId(value){sequence=value;},openModal:panel=>opened.push(panel)};
  try{global.document=fixture.document;global.window=fixture.window;require('./story-codec.js');require('./ui-input.js').install(context);
   const pending=fixture.importFile.listener({target:{value:'chosen',files:[{size:1,text:()=>new Promise(resolve=>release=resolve)}]}});sequence++;release('{}');await pending;
   assert.deepEqual(ui.pendingImport,{marker:'retained review'});assert.deepEqual(opened,[]);
   const story=global.LWStory.encode(L.createWorldDemo()),input={value:'chosen',files:[{size:1,text:async()=>JSON.stringify(story)}]};await fixture.importFile.listener({target:input});
   assert.deepEqual(opened,['import-preview']);assert.equal(ui.pendingImport.engine.s.name,story.state.colony.creatures[0].name);assert.equal(input.value,'');
  }finally{Object.assign(global,prior);}
 });
 const report={passed:results.filter(r=>r.passed).length,total:results.length,results};fs.writeFileSync(__dirname+'/presentation-results.json',JSON.stringify(report,null,2));console.log(report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
}
asynchronousChecks().catch(error=>{console.error(error);process.exitCode=1;});
