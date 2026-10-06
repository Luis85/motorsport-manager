/// <reference path="./storytelling-render-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
const X=require('./scenario-runtime.js') as LWContentPorts.ScenarioApi;
const T=require('./storytelling.js') as LWStorytelling.Api;
const F=require('./storytelling-projection.js') as LWStorytelling.RenderingApi;
const E=require('./scene-editor.js') as LWSceneEditor.Api;
const A=require('./storytelling-editor.js') as {create(editor:LWSceneEditor.Session):LWStorytelling.Authoring};
const D=require('./storytelling-director.js') as LWStorytelling.DirectorApi;
const P=require('./storytelling-preview.js') as {create(pack:LWContentPorts.ScenarioPack,id:string):LWStorytelling.PreviewSource};
const root=globalThis as unknown as {LWContent:LWContentPorts.ContentApi;LWStorytelling:typeof T;LWSceneNavigation:LWSceneNavigation.NavigationApi};
const C=root.LWContent;
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,String(error));}}
function fixture():LWContentPorts.ScenarioPack {
 const pack=C.copy(X.builtins().find(row=>row.id==='office')!),scene=pack.scenes[0]!;
 scene.graph={kind:'level',rendering:{dimension:'3d',rendererId:'basic'},connections:[]};
 const actor=(scene.initialState.colony as {creatures:{id:string}[]}).creatures[0]!;
 pack.storytelling={version:1,cutscenes:[{id:'arrival',name:'Arrival',sceneId:scene.id,duration:4,skipPolicy:'finish',tracks:[
  {id:'walk',target:{category:'creatures',id:actor.id},property:'x',keyframes:[{time:0,value:1},{time:4,value:9}]},
  {id:'turn',target:{category:'creatures',id:actor.id},property:'rotation',keyframes:[{time:0,value:0},{time:4,value:Math.PI}]},
  {id:'camera',target:{category:'camera'},property:'zoom',keyframes:[{time:0,value:1},{time:4,value:2}]}
 ],events:[{id:'greeting',time:1,event:{type:'message',text:'Welcome'}}],onFinish:[{type:'message',text:'Ready'}]}],storyboards:[{id:'journey',name:'Journey',shots:[{id:'open',name:'Arrival',sceneId:scene.id,cutsceneId:'arrival',narrative:'A new workplace awaits.'}]}]};
 return pack;
}
test('Authored full pack validates, imports and retains native format8 and schema2',()=>{
 const pack=fixture();assert(X.validate(pack).ok);const engine=X.commitScene(X.prepareScene(pack,pack.scenes[0]!.id));assert.equal(engine.export().state.version,8);assert.equal(X.capture(engine).schemaVersion,2);assert.deepEqual(X.capture(engine).storytelling,pack.storytelling);
});
test('Linear and step sampled channels are deterministic and never alter native checkpoints',()=>{
 const pack=fixture(),before=C.copy(pack),engine=X.commitScene(X.prepareScene(pack,pack.scenes[0]!.id)),native=C.copy(engine.export());
 assert.equal(T.sample(pack,'arrival',2).poses[0]!.values.x,5);assert.equal(T.sample(pack,'arrival',2).camera.zoom,1.5);
 assert.deepEqual(T.sample(pack,'arrival',2),T.sample(pack,'arrival',2));assert.deepEqual(pack,before);assert.deepEqual(engine.export(),native);
 pack.storytelling!.cutscenes[0]!.tracks[0]!.keyframes[0]!.easing='step';assert.equal(T.sample(pack,'arrival',2).poses[0]!.values.x,1);
});
test('Playback pause stop replay seek skip dispose use supplied elapsed and finish exactly once',()=>{
 const pb=T.create(fixture(),'arrival');pb.play();pb.advance(1);assert.deepEqual(pb.drainEvents(),[{type:'message',text:'Welcome'}]);pb.pause();pb.advance(2);assert.equal(pb.status().time,1);pb.resume();pb.advance(3);assert.equal(pb.status().state,'finished');assert.deepEqual(pb.drainEvents(),[{type:'message',text:'Ready'}]);pb.advance(1);pb.skip();assert.deepEqual(pb.drainEvents(),[]);pb.seek(2);pb.resume();pb.advance(2);assert.deepEqual(pb.drainEvents(),[]);
 pb.replay();pb.seek(3);assert.deepEqual(pb.drainEvents(),[]);pb.skip();assert.deepEqual(pb.drainEvents(),[{type:'message',text:'Ready'}]);pb.stop();assert.equal(pb.status().time,0);pb.play();pb.advance(4);assert.equal(pb.drainEvents().length,2);pb.dispose();assert.throws(()=>pb.advance(1),/disposed/);
});
test('Cancel skip clears all deferred gameplay and scene events',()=>{
 const pack=fixture();pack.storytelling!.cutscenes[0]!.skipPolicy='cancel';const pb=T.create(pack,'arrival');pb.play();pb.skip();assert.equal(pb.status().state,'stopped');assert.deepEqual(pb.drainEvents(),[]);
});
test('Invalid elapsed rejects atomically without consuming pending events',()=>{
 const pb=T.create(fixture(),'arrival');pb.play();pb.advance(1);const before=pb.status();for(const elapsed of [-1,Infinity,NaN,61])assert.throws(()=>pb.advance(elapsed));assert.deepEqual(pb.status(),before);assert.equal(pb.drainEvents().length,1);
});
test('Keyframes, stable references, unsafe channels and duplicate IDs reject before mutation',()=>{
 const mutators:((pack:LWContentPorts.ScenarioPack)=>void)[]=[
  p=>p.storytelling!.cutscenes[0]!.tracks[0]!.keyframes.push({time:1,value:0}),
  p=>Object.assign(p.storytelling!.cutscenes[0]!.tracks[0]!.target,{id:'missing'}),
  p=>Object.assign(p.storytelling!.cutscenes[0]!.tracks[0]!,{property:'inventory'}),
  p=>p.storytelling!.storyboards[0]!.shots[0]!.sceneId='missing',
  p=>p.storytelling!.cutscenes.push(C.copy(p.storytelling!.cutscenes[0]!)),
  p=>p.storytelling!.cutscenes[0]!.tracks.push(C.copy(p.storytelling!.cutscenes[0]!.tracks[0]!))
 ];for(const mutate of mutators){const pack=fixture();mutate(pack);assert.equal(X.validate(pack).ok,false);assert.throws(()=>T.create(pack,'arrival'));}
});
test('Timeline and storyboard authoring share bounded draft revision undo redo and stale rejection',()=>{
 const editor=E.create(fixture()),author=A.create(editor),clip=author.list().cutscenes[0]!;clip.name='Edited';author.setCutscene(clip,0);assert.equal(editor.revision,1);assert.equal(author.list().cutscenes[0]!.name,'Edited');assert.throws(()=>author.setCutscene(clip,0),/stale/);editor.undo();assert.equal(author.list().cutscenes[0]!.name,'Arrival');editor.redo();assert.equal(author.list().cutscenes[0]!.name,'Edited');
 const before=editor.snapshot(),revision=editor.revision;assert.throws(()=>author.removeCutscene('arrival'));assert.deepEqual(editor.snapshot(),before);assert.equal(editor.revision,revision);
});
test('Authoring rejects own getters and never evaluates imported behavior',()=>{
 const editor=E.create(fixture()),author=A.create(editor),before=editor.snapshot();let called=0;
 const hostile=Object.defineProperty({},'id',{enumerable:true,get(){called++;return 'arrival';}});assert.throws(()=>author.setCutscene(hostile as LWStorytelling.Cutscene));assert.equal(called,0);assert.deepEqual(editor.snapshot(),before);
});
test('Detached preview and sampled Frame preserve source, animate geometry channels and camera',()=>{
 const pack=fixture(),scene=pack.scenes[0]!,before=C.copy(pack),source=P.create(pack,scene.id),frame=source.frame({time:0,delta:0,camera:{x:0,y:0,z:1},viewport:{width:1440,height:900,pixelRatio:1}}),original=C.copy(frame);
 const sampled=F.frame(frame,T.sample(pack,'arrival',2));assert.equal(sampled.actors[0]!.x,5);assert.equal((sampled.actors[0] as unknown as {rotation:number}).rotation,Math.PI/2);assert.equal(sampled.camera.z,1.5);assert(Object.isFrozen(sampled.actors[0]));assert.deepEqual(frame,original);assert.deepEqual(pack,before);
});
function connected():LWContentPorts.ScenarioPack {
 const pack=fixture(),scene=pack.scenes[0]!,other=C.copy(scene);other.id='other';other.name='Second room';other.graph={kind:'level',requirements:[{type:'player-level',minimum:100}],connections:[{id:'back',targetSceneId:scene.id,label:'Back'}]};pack.scenes.push(other);scene.graph!.connections=[{id:'forward',targetSceneId:'other',label:'Next'}];return pack;
}
test('Scene event validation never executes and rejected entry gate leaves live engine unchanged',()=>{
 const pack=connected(),scene=pack.scenes[0]!;scene.graph!.events=[{type:'scene-switch',connectionId:'forward'}];assert(X.validate(pack).ok);
 const engine=X.commitScene(X.prepareScene(pack,scene.id)),before=C.copy(engine.export());const director=D.create({engine:()=>engine,transition:()=>{throw Error('Must not adopt');},presentation:()=>{},message:()=>{}});assert.throws(()=>director.enter(),/level 100/);assert.deepEqual(engine.export(),before);assert.equal(director.review(),null);
});
test('Reviewed event connection can cancel, reject stale review and preserve checkpoints across worlds',()=>{
 const pack=connected(),scene=pack.scenes[0]!,other=pack.scenes[1]!;other.graph!.requirements=[];const world=C.copy(pack.worlds[0]!);world.id='other-world';world.name='Another world';pack.worlds.push(world);other.worldId=world.id;
 scene.graph!.events=[{type:'scene-switch',connectionId:'forward'}];let engine=X.commitScene(X.prepareScene(pack,scene.id));const before=C.copy(engine.export());
 const director=D.create({engine:()=>engine,transition:preview=>{engine=root.LWSceneNavigation.commit(engine,preview);},presentation:()=>{},message:()=>{}});director.enter();const canceled=director.review()!;assert(canceled);director.cancel(canceled);assert.deepEqual(engine.export(),before);director.enter();const review=director.review()!;assert.throws(()=>director.accept(C.copy(review)),/stale/);assert.throws(()=>director.accept({...review,sceneId:'forged'}),/stale/);director.accept(review);assert.equal(engine.scenarioContext!.worldId,world.id);assert(engine.scenarioContext!.journey!.checkpoints[scene.id]);assert.throws(()=>director.accept(review),/stale/);
});
test('Self-replaying finish event is bounded while explicit replay starts a new chain',()=>{
 const pack=fixture(),clip=pack.storytelling!.cutscenes[0]!;clip.onFinish=[{type:'play-cutscene',cutsceneId:clip.id}];let messages:string[]=[];const engine=X.commitScene(X.prepareScene(pack,pack.scenes[0]!.id));const director=D.create({engine:()=>engine,transition:()=>{},presentation:()=>{},message:text=>messages.push(text)});
 director.play('arrival');director.advance(4);director.advance(4);assert(messages.some(text=>text.includes('repeated')));assert.equal(director.status()!.state,'finished');director.replay();assert.equal(director.status()!.state,'playing');
});
test('One-shot scene cutscenes survive portable version10 save restore and replay remains explicit',()=>{
 const pack=fixture(),scene=pack.scenes[0]!;scene.graph!.events=[{type:'play-cutscene',cutsceneId:'arrival',once:true}];let engine=X.commitScene(X.prepareScene(pack,scene.id));
 const director=D.create({engine:()=>engine,transition:()=>{},presentation:()=>{},message:()=>{}});director.enter();director.advance(4);assert.deepEqual(engine.scenarioContext!.journey!.storytelling!.once,[scene.id+'|arrival']);assert.equal(engine.scenarioContext!.journey!.storytelling!.completed.length,1);
 const S=require('./scenario-story.js') as {encode(engine:LWContentPorts.ScenarioEngine):Record<string,unknown>;inspect(input:unknown):{engine:LWContentPorts.ScenarioEngine};commit(preview:unknown):LWContentPorts.ScenarioEngine};const captured=X.capture(engine);assert.deepEqual(captured.storytelling!.progress,engine.scenarioContext!.journey!.storytelling);const relaunched=X.commitScene(X.prepareScene(captured,scene.id));assert.deepEqual(relaunched.scenarioContext!.journey!.storytelling,captured.storytelling!.progress);const saved=S.encode(engine);assert.equal(saved.version,10);engine=S.commit(S.inspect(saved));
 const restored=D.create({engine:()=>engine,transition:()=>{},presentation:()=>{},message:()=>{}});restored.enter();assert.equal(restored.status(),null);restored.play('arrival');assert.equal(restored.status()!.state,'playing');restored.advance(4);assert.equal(engine.scenarioContext!.journey!.storytelling!.completed.length,1);
 const forged=C.copy(engine.scenarioContext!);forged.journey!.storytelling!.once.push('missing|arrival');assert.throws(()=>root.LWSceneNavigation.check(forged.journey,forged),/progress/);
});
test('Requirement triggers observe only active unpaused scene and once progress survives director recreation',()=>{
 const pack=fixture(),scene=pack.scenes[0]!;scene.initialState.paused=false;scene.graph!.triggers=[{id:'level-one',requirements:[{type:'player-level',minimum:1}],events:[{type:'message',text:'Level reached'}],once:true}];const engine=X.commitScene(X.prepareScene(pack,scene.id));let messages:string[]=[];
 const create=()=>D.create({engine:()=>engine,transition:()=>{},presentation:()=>{},message:text=>messages.push(text)});const first=create();first.enter();first.advance(.1);first.advance(.1);assert.deepEqual(messages,['Level reached']);first.dispose();const next=create();next.enter();next.advance(.1);assert.deepEqual(messages,['Level reached']);assert.deepEqual(engine.scenarioContext!.journey!.storytelling!.triggers,[scene.id+'|level-one']);
});
test('Persistent trigger rejection preserves native state and narrative progress',()=>{
 const pack=connected(),scene=pack.scenes[0]!;scene.initialState.paused=false;scene.graph!.triggers=[{id:'blocked',requirements:[{type:'player-level',minimum:1}],events:[{type:'scene-switch',connectionId:'forward'}],once:true}];const engine=X.commitScene(X.prepareScene(pack,scene.id)),before=C.copy(engine.export());const director=D.create({engine:()=>engine,transition:()=>{},presentation:()=>{},message:()=>{}});director.enter();assert.throws(()=>director.advance(.1),/level 100/);assert.deepEqual(engine.export(),before);assert.equal(engine.scenarioContext!.journey!.storytelling,undefined);
});
test('Rig gesture and p5 preset sampling are bounded data-only presentation channels',()=>{
 const pack=fixture(),clip=pack.storytelling!.cutscenes[0]!,target=clip.tracks[0]!.target as LWStorytelling.Target;
 clip.tracks.push({id:'gesture',target,property:'pose',keyframes:[{time:0,value:0},{time:4,value:1}]});clip.animations=[{id:'glow',presetId:'sparkles',start:1,duration:2,x:9,y:9,radius:24,color:'#efb85c',count:24}];assert(X.validate(pack).ok);assert.equal(T.sample(pack,'arrival',2).poses[0]!.values.pose,.5);assert.equal(T.sample(pack,'arrival',.5).animations.length,0);assert.equal(T.sample(pack,'arrival',2).animations[0]!.id,'glow');assert.equal(T.sample(pack,'arrival',3).animations.length,0);
 const bad=C.copy(pack);bad.storytelling!.cutscenes[0]!.animations![0]!.duration=4;assert.equal(X.validate(bad).ok,false);const invalid=C.copy(pack);Object.assign(invalid.storytelling!.cutscenes[0]!.animations![0]!,{script:'run()'});assert.equal(X.validate(invalid).ok,false);
});
test('Intentional trigger deletion prunes captured past progress while unknown imported facts reject',()=>{
 const pack=fixture(),scene=pack.scenes[0]!;scene.graph!.triggers=[{id:'old',requirements:[{type:'player-level',minimum:1}],events:[{type:'message',text:'Old'}]}];pack.storytelling!.progress={version:1,once:[],completed:[],triggers:[scene.id+'|old']};const editor=E.create(pack);editor.updateScene(scene.id,{graph:{...scene.graph!,triggers:[]}});assert.deepEqual(editor.export().storytelling!.progress!.triggers,[]);editor.undo();assert.deepEqual(editor.export().storytelling!.progress!.triggers,[scene.id+'|old']);
 const bad=C.copy(pack);bad.storytelling!.progress!.triggers.push(scene.id+'|forged');assert.throws(()=>editor.replace(bad),/progress/);
});
test('Deferred gated trigger failure removes its pending narrative fact after cinematic completion',()=>{
 const pack=connected(),scene=pack.scenes[0]!;scene.initialState.paused=false;scene.graph!.triggers=[{id:'deferred',requirements:[{type:'player-level',minimum:1}],events:[{type:'play-cutscene',cutsceneId:'arrival'},{type:'scene-switch',connectionId:'forward'}],once:true}];const engine=X.commitScene(X.prepareScene(pack,scene.id));const director=D.create({engine:()=>engine,transition:()=>{},presentation:()=>{},message:()=>{}});director.enter();director.advance(.1);assert.equal(director.status()!.state,'playing');assert.throws(()=>director.advance(4),/level 100/);assert.deepEqual(engine.scenarioContext!.journey!.storytelling!.triggers,[]);assert.equal(director.review(),null);
});
test('Director emits time-zero and timed cues at exact boundaries even across a large step',()=>{
 const pack=fixture(),clip=pack.storytelling!.cutscenes[0]!;clip.events!.unshift({id:'start',time:0,event:{type:'message',text:'Start'}});
 const engine=X.commitScene(X.prepareScene(pack,pack.scenes[0]!.id)),native=C.copy(engine.export());let director:LWStorytelling.Director;
 const receipts:{text:string;time:number}[]=[];director=D.create({engine:()=>engine,transition:()=>{},presentation:()=>{},message:text=>receipts.push({text,time:director?.status()?.time??0})});
 director.play('arrival');assert.deepEqual(receipts,[{text:'Start',time:0}]);director.advance(.5);assert.equal(receipts.length,1);director.advance(3.5);
 assert.deepEqual(receipts,[{text:'Start',time:0},{text:'Welcome',time:1},{text:'Ready',time:4}]);director.advance(10);assert.equal(receipts.length,3);
 const after=C.copy(engine.export());assert.deepEqual(after.state,native.state);
});
test('Timed scene admission pauses at cue and cancelled review resumes without firing it again',()=>{
 const pack=connected(),scene=pack.scenes[0]!;pack.scenes[1]!.graph!.requirements=[];
 pack.storytelling!.cutscenes[0]!.events=[{id:'link',time:1,event:{type:'scene-switch',connectionId:'forward'}},{id:'later',time:2,event:{type:'message',text:'Later'}}];
 const engine=X.commitScene(X.prepareScene(pack,scene.id)),messages:string[]=[];const director=D.create({engine:()=>engine,transition:()=>{},presentation:()=>{},message:text=>messages.push(text)});
 director.play('arrival');director.advance(3);assert.equal(director.status()!.time,1);assert.equal(director.status()!.state,'paused');const before=C.copy(engine.export());
 const review=director.review()!;assert(review);assert.throws(()=>director.cancel(C.copy(review)),/stale/);director.advance(10);assert.equal(director.status()!.time,1);assert.deepEqual(engine.export(),before);
 director.cancel(review);assert.equal(director.status()!.state,'playing');director.advance(1);assert.deepEqual(messages,['Later']);assert.equal(director.review(),null);director.advance(2);assert.deepEqual(messages,['Later','Ready']);
});
test('Timed replacement consumes remaining elapsed on the new clip and never completes interrupted clip',()=>{
 const pack=fixture(),clip=pack.storytelling!.cutscenes[0]!,replacement=C.copy(clip);replacement.id='replacement';replacement.events=[];replacement.onFinish=[{type:'message',text:'Replacement ready'}];pack.storytelling!.cutscenes.push(replacement);
 clip.events=[{id:'replace',time:1,event:{type:'play-cutscene',cutsceneId:'replacement',once:true}},{id:'discarded',time:2,event:{type:'message',text:'Old cue'}}];
 const engine=X.commitScene(X.prepareScene(pack,pack.scenes[0]!.id)),messages:string[]=[];const director=D.create({engine:()=>engine,transition:()=>{},presentation:()=>{},message:text=>messages.push(text)});
 director.play('arrival');director.advance(3);assert.equal(director.status()!.cutsceneId,'replacement');assert.equal(director.status()!.time,2);assert.deepEqual(messages,[]);assert.deepEqual(engine.scenarioContext!.journey!.storytelling!.once,[clip.sceneId+'|replacement']);
 director.advance(2);assert.deepEqual(messages,['Replacement ready']);assert.deepEqual(engine.scenarioContext!.journey!.storytelling!.completed,[clip.sceneId+'|replacement']);
});
test('Rejected cue gate preserves native progress and consumes only the rejected cue at its boundary',()=>{
 const pack=connected(),scene=pack.scenes[0]!;pack.storytelling!.cutscenes[0]!.events=[{id:'blocked',time:1,event:{type:'scene-switch',connectionId:'forward'}},{id:'later',time:2,event:{type:'message',text:'Later'}}];
 const engine=X.commitScene(X.prepareScene(pack,scene.id)),before=C.copy(engine.export()),messages:string[]=[];const director=D.create({engine:()=>engine,transition:()=>{},presentation:()=>{},message:text=>messages.push(text)});
 director.play('arrival');assert.throws(()=>director.advance(3),/level 100/);assert.equal(director.status()!.time,1);assert.equal(director.status()!.state,'playing');assert.equal(director.review(),null);assert.deepEqual(engine.export(),before);
 director.advance(1);assert.deepEqual(messages,['Later']);director.stop();director.advance(10);assert.deepEqual(messages,['Later']);assert.equal(engine.scenarioContext!.journey!.storytelling,undefined);
});
test('Same-time cue tails survive cancelled and rejected scene admission',()=>{
 for(const blocked of [false,true]){
  const pack=connected(),scene=pack.scenes[0]!;if(!blocked)pack.scenes[1]!.graph!.requirements=[];
  pack.storytelling!.cutscenes[0]!.events=[{id:'link',time:1,event:{type:'scene-switch',connectionId:'forward'}},{id:'same-time',time:1,event:{type:'message',text:'Still at one'}}];
  const engine=X.commitScene(X.prepareScene(pack,scene.id)),receipts:{text:string;time:number}[]=[];let director:LWStorytelling.Director;
  director=D.create({engine:()=>engine,transition:()=>{},presentation:()=>{},message:text=>receipts.push({text,time:director.status()!.time})});director.play('arrival');
  if(blocked)assert.throws(()=>director.advance(3),/level 100/);else{director.advance(3);director.cancel(director.review()!);}
  assert.deepEqual(receipts,[]);director.advance(0);assert.deepEqual(receipts,[{text:'Still at one',time:1}]);director.advance(1);assert.equal(receipts.length,1);
 }
});
test('Finished runtime presentation releases while Replay, chained clips and pending review retain correct ownership',()=>{
 const pack=connected(),scene=pack.scenes[0]!;pack.scenes[1]!.graph!.requirements=[];const engine=X.commitScene(X.prepareScene(pack,scene.id)),native=C.copy(engine.export().state);
 let attached:LWStorytelling.Playback|null=null;const director=D.create({engine:()=>engine,transition:()=>{},presentation:value=>{attached=value;},message:()=>{}});
 director.play('arrival');assert(attached);director.advance(4);assert.equal(director.status()!.state,'finished');assert.equal(attached,null);assert.deepEqual(engine.export().state,native);
 director.replay();assert(attached);director.skip();assert.equal(attached,null);assert.equal(director.status()!.state,'finished');
 const linked=C.copy(pack);linked.storytelling!.cutscenes[0]!.onFinish=[{type:'scene-switch',connectionId:'forward'}];const otherEngine=X.commitScene(X.prepareScene(linked,scene.id));
 const reviewed=D.create({engine:()=>otherEngine,transition:()=>{},presentation:value=>{attached=value;},message:()=>{}});reviewed.play('arrival');reviewed.advance(4);assert(attached);assert(reviewed.review());reviewed.cancel(reviewed.review()!);assert.equal(attached,null);
 const chained=C.copy(pack),next=C.copy(chained.storytelling!.cutscenes[0]!);next.id='second';chained.storytelling!.cutscenes.push(next);chained.storytelling!.cutscenes[0]!.onFinish=[{type:'play-cutscene',cutsceneId:'second'}];const chainedEngine=X.commitScene(X.prepareScene(chained,scene.id));
 const continuous=D.create({engine:()=>chainedEngine,transition:()=>{},presentation:value=>{attached=value;},message:()=>{}});continuous.play('arrival');continuous.advance(4);assert(attached);assert.equal(continuous.status()!.cutsceneId,'second');assert.equal(continuous.status()!.state,'playing');
});
const report={suite:'storytelling',passed:results.filter(row=>row.passed).length,total:results.length,results};fs.writeFileSync(__dirname+'/storytelling-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.passed!==report.total)process.exitCode=1;
