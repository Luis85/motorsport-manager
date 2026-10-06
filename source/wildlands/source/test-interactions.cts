/// <reference path="./developer-contracts.d.ts" />
/// <reference path="./interaction-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import Ajv from 'ajv';
import {toolbox,type Session,type Document} from './developer-sdk.cjs';
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
const root=globalThis as unknown as {
 LW:{Engine:{new():Native;import(input:unknown):Native};createWorldDemo():Native;EngineComposition:{constructThrough(id:string):Native}};
 LWInteractionState:{validate(input:unknown,state:unknown):unknown};
 LWInteractions:LWInteraction.Catalog;LWStory:{committed(engine:Native):boolean;encode(engine:Native):unknown};
};
interface Native extends LWInteraction.Engine {
 export():{state:Document};interactionState():LWInteraction.State;
 requestInteraction(id:string,source:string,target:LWInteraction.Target):LWInteraction.Result;
 respondInteraction(id:string,accept:boolean):LWInteraction.Result;
 selectCreature(id:string):unknown;dispatchCommand(command:LittlewildDeveloper.Command):LWInteraction.Result;
 stepInteractions():void;startTask(input:unknown):boolean;depart():boolean;step(dt:number):void;
}
const target=(id='c2'):LittlewildDeveloper.InteractionTarget=>({scope:'creature',id});
const active=(g:Session):LWInteraction.Record[]=>g.interactions().active as unknown as LWInteraction.Record[];
const history=(g:Session):LWInteraction.Record[]=>g.interactions().history as unknown as LWInteraction.Record[];
function library(g:Session,autonomous=false):Document{
 const lib=g.interactionDefinitions();for(const d of lib.definitions as Document[])d.autonomous=autonomous;return lib;
}
function game(work:(g:Session)=>void):void{
 const g=toolbox.create({scenarioId:'littlewild',sceneId:'charted-home'});
 try{assert(g.command({id:'set-interaction-library',args:[library(g)]}).ok);work(g);}finally{g.dispose();}
}
function request(g:Session,source='c1',recipient='c2'):LWInteraction.Record{
 const r=g.command({id:'request-interaction',args:['friendly-duel',source,target(recipient)]});assert(r.ok,r.reason);const record=active(g)[0];assert(record);return record;
}
function checked(g:Session):void{const save=g.save();root.LW.Engine.import(save);}

test('Authored JSON schema and semantic validator accept the bundled library',()=>{
 const source=path.resolve(__dirname,'../source/assets/interactions');
 const schema=JSON.parse(fs.readFileSync(path.join(source,'interaction.schema.json'),'utf8')) as object;
 const lib=JSON.parse(fs.readFileSync(path.join(source,'catalog.json'),'utf8')) as unknown;
 const validate=new Ajv({strict:true}).compile(schema);assert(validate(lib),JSON.stringify(validate.errors));assert(toolbox.validateInteractionLibrary(lib).ok);
});
test('Data definitions and SDK discovery are detached and reject executable shapes',()=>game(g=>{
 const before=g.save(),definitions=toolbox.interactions();assert(definitions.some(d=>d.id==='friendly-duel'));
 definitions[0]!.label='corrupted';assert.notEqual(toolbox.interactions()[0]!.label,'corrupted');
 const lib=library(g);(lib.definitions as Document[])[0]!.label='changed';assert.notEqual((g.interactionDefinitions().definitions as Document[])[0]!.label,'changed');
 assert.equal(toolbox.validateInteraction({...definitions[0],executor:'execute-script'}).ok,false);
 let reads=0;assert.equal(toolbox.validateInteraction({...definitions[0],get label(){reads++;return 'getter';}}).ok,false);assert.equal(reads,0);
 assert.deepEqual(g.save(),before);
}));
test('Invalid requests and queries preserve RNG, inventory and all sporting state',()=>game(g=>{
 const before=g.save();for(const args of [['missing','c1',target()],['friendly-duel','c999',target()],['friendly-duel','c1',target('c1')],['friendly-duel','player',target()]] as [string,string,LittlewildDeveloper.InteractionTarget][]){assert.equal(g.command({id:'request-interaction',args}).ok,false);assert.deepEqual(g.save(),before);}
 assert(g.interactionOptions('c1',target()).some(d=>d.id==='friendly-duel'&&d.available));g.interactions();assert.deepEqual(g.save(),before);
 assert.throws(()=>g.command({id:'request-interaction',args:['friendly-duel','c1',{scope:'creature',id:'c2',execute:true} as LittlewildDeveloper.InteractionTarget]}));assert.deepEqual(g.save(),before);
}));
test('Generic care uses the established feed authority and explicit target without changing selection',()=>game(g=>{
 const before=g.inspect(),r=g.command({id:'request-interaction',args:['care-feed','player',target('c1')]});assert(r.ok,r.reason);
 const after=g.inspect();assert(after.actors[0]!.needs.food!>before.actors[0]!.needs.food!);
 assert.equal(after.actors[0]!.inventory.meals,before.actors[0]!.inventory.meals!-1);assert.deepEqual(after.actors[1]!.inventory,before.actors[1]!.inventory);
 assert(g.command({id:'request-interaction',args:['care-bond','player',target()]}).ok);assert(g.inspect().actors[1]!.needs.joy!>before.actors[1]!.needs.joy!);checked(g);
}));
test('Existing growth event/care adapters share actor authorization and preserve eligibility',()=>game(g=>{
 const options=g.interactionOptions('player',target());const available=options.find(d=>d.id.startsWith('growth:')&&d.available);assert(available);
 const r=g.command({id:'request-interaction',args:[available.id,'player',target()]});assert(r.ok,r.reason);checked(g);
}));
test('A data-only definition extends creature and world interactions through effects without ID branches',()=>game(g=>{
 const lib=library(g),defs=lib.definitions as Document[],base=clone(defs.find(d=>d.id==='encourage')!);
 base.id='new-kindness';base.label='A new kindness';base.cooldown=12;(base.effects as Document).target={joy:7,energy:0,social:0,anger:0,bond:0};defs.push(base);
 assert(g.command({id:'set-interaction-library',args:[lib]}).ok);
 const before=g.inspect().actors[1]!.needs.joy!;assert(g.command({id:'request-interaction',args:['new-kindness','c1',target()]}).ok);
 assert.equal(g.inspect().actors[1]!.needs.joy,Math.min(100,before+7));assert.equal(history(g)[0]!.definitionId,'new-kindness');
 const native=g.save(),state=native.state as Document,colony=state.colony as Document,actors=colony.creatures as Document[];
 const node=(state.nodes as Document[])[0]!;actors[0]!.creature={x:node.x!,y:node.y!};
 const engine=root.LW.Engine.import(native),inventory=clone(engine.creatures[0]!.inventory);
 assert(engine.requestInteraction('notice-nature','c1',{scope:'node',id:String(node.id)}).ok);
 assert.equal(engine.interactionState().history[0]!.target.scope,'node');assert.deepEqual(engine.creatures[0]!.inventory,inventory);
 assert(root.LW.Engine.import(engine.export()));
}));
test('Interaction scheduling owns a continued seed without consuming world or actor roll streams',()=>game(g=>{
 const lib=library(g);(lib.definitions as Document[]).find(d=>d.id==='friendly-duel')!.autonomous=true;
 assert(g.command({id:'set-interaction-library',args:[lib]}).ok);const native=root.LW.Engine.import(g.save());
 native.s.started=true;native.s.paused=false;native.s.creatureInteractions!.triggerAt['friendly-neighbors']=native.s.simTime;
 const before=native.export(),worldSeed=(before.state.colony as Document).rng;
 const seeds=(doc:{state:Document})=>((doc.state.colony as Document).creatures as Document[]).map(c=>(c.rpg as Document).rng);
 assert.equal(native.interactionState().rng,undefined);native.stepInteractions();const first=native.export();
 assert.equal((first.state.colony as Document).rng,worldSeed);assert.deepEqual(seeds(first),seeds(before));
 assert(native.interactionState().active.length);assert(Number.isInteger(native.interactionState().rng));
 const restored=root.LW.Engine.import(first);assert.deepEqual(restored.export(),first);
 const forged=clone(first);((forged.state as Document).creatureInteractions as Document).rng=-1;assert.throws(()=>root.LW.Engine.import(forged),/decision RNG seed/);
 native.step(.1);restored.step(.1);assert.deepEqual(restored.export(),native.export());
}));
test('Pending invitations reserve both creatures, auto accept and finish without player round commands',()=>game(g=>{
 const r=request(g),before=g.save();assert.equal(g.command({id:'request-interaction',args:['friendly-duel','c3',target()]}).ok,false);assert.deepEqual(g.save(),before);
 assert.equal(g.command({id:'request-task',actorId:'c1',args:['gather','wood',1]}).ok,false);
 g.start();g.advance(1.1);assert.equal(active(g)[0]!.status,'active');checked(g);g.advance(11);
 assert.equal(active(g).length,0);const done=history(g)[0]!;assert.equal(done.status,'completed');assert(done.round>=1&&done.round<=5);assert(done.rounds.every(r=>r.sourceRoll.dice.length===3&&r.targetRoll.dice.length===3));checked(g);
}));
test('A creature can decline by its own needs/temper policy, with no request cost or roll',()=>game(g=>{
 const save=g.save(),world=save.state as Document,actors=(world.colony as Document).creatures as Document[];
 (actors[1]!.feelings as Document).anger=80;
 const native=root.LW.Engine.import(save);const before=clone(native.creatures[0]!.inventory),energy=native.creatures[0]!.needs.energy;
 assert(native.requestInteraction('friendly-duel','c1',target()).ok);native.s.started=true;native.s.paused=false;for(let n=0;n<12;n++)native.step(.1);
 const view=native.interactionState();assert.equal(view.active.length,0);assert.equal(view.history[0]!.status,'declined');assert.deepEqual(native.creatures[0]!.inventory,before);assert(native.creatures[0]!.needs.energy>energy-1);assert.equal(view.history[0]!.rounds.length,0);
}));
test('Paused and unstarted worlds hold consent, rounds, physiology and RNG',()=>game(g=>{
 g.pause();request(g);const pending=g.save();g.step(100);assert.deepEqual(g.save(),pending);
 const unstarted=clone(pending);(unstarted.state as Document).started=false;(unstarted.state as Document).paused=false;
 const native=root.LW.Engine.import(unstarted),held=native.export();for(let i=0;i<100;i++)native.step(.1);assert.deepEqual(native.export(),held);
 g.start();g.advance(1.1);g.pause();const frozen=g.save();g.step(200);assert.deepEqual(g.save(),frozen);
}));
test('Manual decline and cancellation release paired locks; cooling targets cannot be challenged by a third creature',()=>game(g=>{
 let r=request(g);assert(g.command({id:'respond-interaction',actorId:'c2',args:[r.id,false]}).ok);assert.equal(history(g)[0]!.status,'declined');
 r=request(g);assert(g.command({id:'respond-interaction',actorId:'c2',args:[r.id,true]}).ok);
 assert(g.command({id:'cancel-interaction',args:[r.id]}).ok);assert.equal(history(g)[0]!.status,'cancelled');
 const before=g.save();assert.equal(g.command({id:'request-interaction',args:['friendly-duel','c3',target()]}).ok,false);assert.deepEqual(g.save(),before);checked(g);
}));
test('Legacy demo and restored engines retain final locks for direct care/task/quest routes',()=>{
 const first=root.LW.createWorldDemo();first.selectCreature('c1');assert.equal(Object.getPrototypeOf(first),root.LW.Engine.prototype);
 assert(first.requestInteraction('friendly-duel','c1',target()).ok);const r=first.interactionState().active[0]!;
 assert(first.dispatchCommand({id:'respond-interaction',actorId:'c2',args:[r.id,true]}).ok);
 for(const native of [first,root.LW.Engine.import(first.export())]){
  const a=native.creatures[0]!,before=native.export();native.withActor(a,()=>{
   assert.equal(native.care('feed').ok,false);assert.equal(native.startTask({kind:'idle'}),false);assert.equal(native.depart(),false);assert.equal(native.suggestSocial('c3').ok,false);
  });assert.deepEqual(native.export(),before);assert(root.LWStory.committed(native));
 }
});
test('Pending and active story roundtrips preserve subsequent rolls and settled results',()=>{
 for(const seconds of [0,3.2]){
  let g=toolbox.create({scenarioId:'littlewild',sceneId:'charted-home'});assert(g.command({id:'set-interaction-library',args:[library(g)]}).ok);request(g);g.start();g.advance(seconds);
  const checkpoint=g.story();g.advance(12);const expected=g.save();g.dispose();
  g=toolbox.openStory(toolbox.reviewStory(checkpoint));try{g.advance(12);assert.deepEqual(g.save(),expected);}finally{g.dispose();}
 }
});
test('Ordinary autonomous fixed-step simulation requests, accepts and settles duels without decision stubs',()=>{
 let g=toolbox.create({scenarioId:'littlewild',sceneId:'charted-home'});try{
  g.start();g.advance(300);const view=g.interactions();assert((view.history as Document[]).some(r=>r.definitionId==='friendly-duel'&&r.status==='completed'));
  checked(g);const checkpoint=g.story();g.advance(60);const expected=g.save();g.dispose();g=toolbox.openStory(toolbox.reviewStory(checkpoint));g.advance(60);assert.deepEqual(g.save(),expected);
 }finally{g.dispose();}
});
test('Invalid imported lifecycle, fingerprint, lock, score and terminal winner records fail atomically',()=>game(g=>{
 request(g);g.start();g.advance(12);const save=g.save(),state=save.state as Document,view=state.creatureInteractions as Document;
 const original=clone(save),rejected:(copy:Document)=>void=(copy)=>{assert.throws(()=>root.LW.Engine.import(copy),/Creature interactions/);assert.deepEqual(g.save(),original);};
 for(const change of [(v:Document)=>{v.fingerprint='forged';},(v:Document)=>{v.sequence=1;},(v:Document)=>{(v.history as Document[])[0]!.winnerId='c999';},(v:Document)=>{(v.history as Document[])[0]!.round=0;},(v:Document)=>{(v.triggerAt as Document)['friendly-neighbors']=1e12;}]){
  const copy=clone(save);change((copy.state as Document).creatureInteractions as Document);rejected(copy);
 }
 const forged=clone(save),terminal=((forged.state as Document).creatureInteractions as Document).history as Document[];
 terminal[0]!.winnerId=terminal[0]!.winnerId==='c1'?'c2':'c1';rejected(forged);assert(view.history);
}));
test('Legacy stories with no interaction state remain loadable; captured interaction scenarios are playable',()=>game(g=>{
 const legacy=g.save();delete (legacy.state as Document).creatureInteractions;assert(root.LW.Engine.import(legacy));
 request(g);g.start();g.advance(1.1);const captured=g.captureScenario();const review=toolbox.validateScenario(captured);assert(review.ok,review.errors.join('\n'));g.dispose();const restored=toolbox.createScenario(captured,'charted-home');try{assert.equal(active(restored)[0]!.status,'active');restored.advance(11);assert.equal(history(restored)[0]!.status,'completed');}finally{restored.dispose();}
}));
test('Library replacement preflights all definitions and cannot change an active match',()=>game(g=>{
 const invalid=library(g);(invalid.definitions as Document[])[0]!.executor='javascript';const before=g.save();assert.equal(g.command({id:'set-interaction-library',args:[invalid]}).ok,false);assert.deepEqual(g.save(),before);
 request(g);const pending=g.save(),changed=library(g);changed.version=2;assert.equal(g.command({id:'set-interaction-library',args:[changed]}).ok,false);assert.deepEqual(g.save(),pending);
 assert(g.command({id:'set-interaction-library',args:[library(g)]}).ok);assert.deepEqual(g.save(),pending);
}));
test('Typed SDK compiles valid requests and rejects wrong scope, fields and argument tuples',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'littlewild-interaction-types-'));
 try{
  const sdk=path.join(__dirname,'developer-sdk.cjs').replaceAll('\\','/'),file=path.join(directory,'contract.cts');
  fs.writeFileSync(file,`import {toolbox,type Command} from '${sdk}';\nconst g=toolbox.create({scenarioId:'littlewild'});\nconst command:Command={id:'request-interaction',args:['friendly-duel','c1',{scope:'creature',id:'c2'}]};g.command(command);g.interactions();g.interactionDefinitions();g.interactionOptions('c1',{scope:'node',id:'n0'});toolbox.validateInteraction({});g.command({id:'seek-duel',args:['c1','friendly-duel','friendly-neighbors']});g.command({id:'stage-duel',args:['friendly-duel','c1','c2']});g.settings();g.command({id:'set-game-settings',args:[{duels:false}]});\n// @ts-expect-error response requires actor identity\ng.command({id:'respond-interaction',args:['interaction-1',true]});\n// @ts-expect-error invalid target scope\ng.command({id:'request-interaction',args:['friendly-duel','c1',{scope:'player',id:'guide'}]});\n// @ts-expect-error Boolean response required\ng.command({id:'respond-interaction',actorId:'c2',args:['interaction-1','yes']});\n// @ts-expect-error stage requires both creature identities\ng.command({id:'stage-duel',args:['friendly-duel','c1']});\n// @ts-expect-error setting flags must be boolean\ng.command({id:'set-game-settings',args:[{duels:'off'}]});\n// @ts-expect-error world request forbids actor identity\ng.command({id:'request-interaction',actorId:'c1',args:['friendly-duel','c1',{scope:'creature',id:'c2'}]});\n`);
  const program=ts.createProgram([file],{strict:true,noEmit:true,skipLibCheck:true,module:ts.ModuleKind.Node16,moduleResolution:ts.ModuleResolutionKind.Node16,target:ts.ScriptTarget.ES2022});
  const diagnostics=ts.getPreEmitDiagnostics(program);assert.equal(diagnostics.length,0,diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('Maximum bounded history and round profiles remain queryable and importable beyond 256KiB',()=>game(g=>{
 const save=g.save(),world=save.state as Document;world.simTime=20;
 const lib=library(g) as unknown as LWInteraction.Library,d=lib.definitions.find(d=>d.id==='friendly-duel')!;
 d.duel!.maxRounds=20;d.duel!.pointsToWin=10;
 const roll={target:10,dice:[2,3,3],total:8,margin:2,success:true,critical:false,outcome:'success'};
 const rounds=Array.from({length:20},(_,i)=>({number:i+1,time:i+1,sourceRoll:clone(roll),targetRoll:clone(roll),winnerId:null}));
 const records=Array.from({length:60},(_,i)=>({id:'interaction-'+(i+1),definitionId:d.id,sourceId:'c1',target:target(),status:'completed',created:0,respondAt:1,expires:70,nextRoundAt:22,round:20,scores:[0,0],winnerId:null,reason:'Draw',rounds:clone(rounds)}));
 world.creatureInteractions={version:1,library:lib as unknown as Document,fingerprint:root.LWInteractions.fingerprint(lib),sequence:61,active:[],history:records,cooldowns:{},triggerAt:{'friendly-neighbors':35},seeks:[]} as unknown as Document;
 assert(JSON.stringify(world.creatureInteractions).length>256*1024);const restored=root.LW.Engine.import(save);assert.equal(restored.interactionState().history.length,60);assert(root.LW.Engine.import(restored.export()));
}));
test('Persisted duel rounds stop exactly when their authored point threshold settles',()=>game(g=>{
 const save=g.save(),world=save.state as Document,lib=root.LWInteractions.validate(library(g));world.simTime=20;
 const d=lib.definitions.find(d=>d.id==='friendly-duel')!;d.duel!.pointsToWin=1;d.duel!.maxRounds=3;
 const a={target:10,dice:[2,3,3],total:8,margin:2,success:true,critical:false,outcome:'success'};
 const b={target:10,dice:[3,4,4],total:11,margin:-1,success:false,critical:false,outcome:'failure'};
 const first={number:1,time:1,sourceRoll:a,targetRoll:b,winnerId:'c1'};
 const record={id:'interaction-1',definitionId:d.id,sourceId:'c1',target:target(),status:'completed',created:0,respondAt:1,expires:20,nextRoundAt:3,round:1,scores:[1,0],winnerId:'c1',reason:'Won',rounds:[first]};
 world.creatureInteractions={version:1,library:lib as unknown as Document,fingerprint:root.LWInteractions.fingerprint(lib),sequence:2,active:[],history:[record],cooldowns:{},triggerAt:{'friendly-neighbors':35},seeks:[]} as unknown as Document;
 assert(root.LW.Engine.import(save));record.round=2;record.rounds.push({...first,number:2,time:2});record.scores=[2,0];
 assert.throws(()=>root.LW.Engine.import(save),/rounds continued after settlement/);
}));
test('Definition edits change the library fingerprint and tampered native/story libraries fail review',()=>game(g=>{
 const lib=library(g),first=clone(lib),second=clone(lib),third=clone(lib);
 (first.definitions as Document[])[0]!.label='New wording';(second.definitions as Document[]).pop();(third.definitions as Document[]).find(d=>d.id==='friendly-duel')!.range=3;
 const hash=root.LWInteractions.fingerprint(lib);for(const changed of [first,second,third])assert.notEqual(root.LWInteractions.fingerprint(changed),hash);
 const reordered=Object.fromEntries(Object.entries(lib).reverse());assert.equal(root.LWInteractions.fingerprint(reordered),hash);
 const added=clone(lib),extra=clone((added.definitions as Document[])[0]!);extra.id='another-care';(added.definitions as Document[]).push(extra);assert.notEqual(root.LWInteractions.fingerprint(added),hash);
 const native=g.save();(((native.state as Document).creatureInteractions as Document).library as Document).definitions=second.definitions!;
 assert.throws(()=>root.LW.Engine.import(native),/fingerprint mismatch/);
 const story=g.story();((story.state as Document).creatureInteractions as Document).fingerprint='forged';assert.throws(()=>toolbox.reviewStory(story),/fingerprint mismatch/);
}));
test('Reinstalling identical normalized definitions preserves settled history, cooldowns and schedule exactly',()=>game(g=>{
 const r=request(g);assert(g.command({id:'respond-interaction',actorId:'c2',args:[r.id,true]}).ok);assert(g.command({id:'cancel-interaction',args:[r.id]}).ok);
 const before=g.save();assert(g.command({id:'set-interaction-library',args:[g.interactionDefinitions()]}).ok);assert.deepEqual(g.save(),before);
}));
test('Declarative trigger conditions use owned traits, personality, needs and shared relationship affinity',()=>game(g=>{
 const lib=library(g),definitions=lib.definitions as Document[],profile=clone(definitions.find(d=>d.id==='friendly-duel')!);
 profile.id='bookish-duel';profile.label='A bookish contest';profile.autonomous=true;profile.range=100;
 const rules=profile.duel as Document;rules.skill='IQ';rules.sourceModifier=3;rules.targetModifier=-2;rules.scoring='margin';rules.maxRounds=1;rules.pointsToWin=1;
 definitions.push(profile);
 lib.triggers=[{id:'bookish-neighbors',definitionId:'bookish-duel',priority:99,intervalSeconds:.5,chancePercent:100,source:[{metric:'personality',operator:'eq',value:'curious'},{metric:'trait',operator:'contains',value:'observant'},{metric:'energy',operator:'gte',value:35}],target:[{metric:'trait',operator:'contains',value:'patient'}],maximumDistance:100,minimumAffinity:0}];
 assert(g.command({id:'set-interaction-library',args:[lib]}).ok);g.start();g.advance(300);
 const finished=history(g).filter(r=>r.definitionId==='bookish-duel');assert(finished.length,'The authored new rule must produce real autonomous invitations.');assert(finished.some(r=>r.status==='completed'));assert(finished.every(r=>r.sourceId==='c1'&&r.target.id==='c2'));checked(g);
}));
test('Player encouragement persists a real search intent and ordinary ticks find a duel; staging selects only the exact pair',()=>game(g=>{
 const lib=library(g);lib.triggers=[];assert(g.command({id:'set-interaction-library',args:[lib]}).ok);
 assert(g.command({id:'seek-duel',args:['c1','friendly-duel']}).ok);assert.equal(active(g).length,0);assert.equal((g.interactions().seeks as Document[])[0]!.actorId,'c1');
 const checkpoint=g.story();g.start();g.advance(300);assert(history(g).some(r=>r.definitionId==='friendly-duel'));g.dispose();
 const restored=toolbox.openStory(toolbox.reviewStory(checkpoint));try{
  assert.equal((restored.interactions().seeks as Document[])[0]!.actorId,'c1');assert(restored.command({id:'cancel-duel-seek',args:['c1']}).ok);
  assert(restored.command({id:'stage-duel',args:['friendly-duel','c1','c3']}).ok);const r=active(restored)[0]!;assert.equal(r.sourceId,'c1');assert.equal(r.target.id,'c3');assert.equal(r.status,'requested');
  restored.start();restored.advance(12);assert.equal(history(restored)[0]!.status,'completed');checked(restored);
 }finally{restored.dispose();}
}));
test('Trigger/profile/seek bad data and disabled duel settings reject without state or RNG changes',()=>game(g=>{
 const before=g.save(),lib=library(g);(lib.triggers as Document[])[0]!.source=[{metric:'execute',operator:'eq',value:'code'}];
 assert.equal(g.command({id:'set-interaction-library',args:[lib]}).ok,false);assert.deepEqual(g.save(),before);
 assert.equal(g.command({id:'seek-duel',args:['c1','missing','missing']}).ok,false);assert.deepEqual(g.save(),before);
 assert(g.command({id:'set-game-settings',args:[{duels:false}]}).ok);assert.equal(g.settings().duels,false);const disabled=g.save();
 assert.equal(g.command({id:'stage-duel',args:['friendly-duel','c1','c2']}).ok,false);assert.equal(g.command({id:'seek-duel',args:['c1']}).ok,false);assert.deepEqual(g.save(),disabled);
 assert(g.command({id:'set-game-settings',args:[{}]}).ok);assert.deepEqual(g.save(),disabled);
}));
test('Paired interactions honor real floor locations, travel and portable invitation continuation',()=>game(g=>{
 const source=g.save(),world=source.state as Document,buildings=world.buildings as Document[],home=buildings.find(b=>b.kind==='shelter');assert(home);
 const catalog=toolbox.interiors(),layouts=catalog.layouts as Document[],bindings=catalog.bindings as Document,layout=layouts.find(l=>l.id===(bindings.shelter??catalog.fallback));assert(layout);
 const floors=layout.floors as Document[],ground=floors.find(f=>f.id==='ground'),upper=floors.find(f=>f.id==='upper');assert(ground&&upper);
 const door=ground.door as Document,upperDoor=upper.door as Document;
 const actors=(world.colony as Document).creatures as Document[];
 for(const id of ['c1','c2']){const c=actors.find(c=>c.id===id)!;c.task=null;Object.assign(c.creature as Document,{x:home.x,y:Number(home.y)+1});}
 const locations:Document={c1:{buildingId:home.id!,floorId:'ground',stationId:null,x:door.x!,y:door.y!,route:[],purpose:'visit'},c2:{buildingId:home.id!,floorId:'upper',stationId:null,x:upperDoor.x!,y:upperDoor.y!,route:[],purpose:'visit'}};
 world.interiors={version:1,catalog,locations,visits:[],production:{},jobs:{}};
 let e=root.LW.Engine.import(source),before=e.export();
 assert.equal(e.requestInteraction('friendly-duel','c1',target()).ok,false);assert.deepEqual(e.export(),before);
 const outside=clone(source);delete (((outside.state as Document).interiors as Document).locations as Document).c2;
 e=root.LW.Engine.import(outside);before=e.export();assert.equal(e.requestInteraction('friendly-duel','c1',target()).ok,false);assert.deepEqual(e.export(),before);
 Object.assign(locations.c2 as Document,{floorId:'ground',x:door.x!,y:door.y!});
 const moving=clone(source),movingLocation=((((moving.state as Document).interiors as Document).locations as Document).c2 as Document);
 movingLocation.route=[{floorId:'ground',x:Number(door.x)+1,y:door.y!,seconds:.5}];e=root.LW.Engine.import(moving);before=e.export();assert.equal(e.requestInteraction('friendly-duel','c1',target()).ok,false);assert.deepEqual(e.export(),before);
 e=root.LW.Engine.import(source);const invitation=e.requestInteraction('friendly-duel','c1',target());assert(invitation.ok);const pending=e.export();
 for(const status of ['requested','active']){
  const bad=clone(pending);if(status==='active'){assert(e.dispatchCommand({id:'respond-interaction',actorId:'c2',args:[invitation.interactionId!,true]}).ok);Object.assign(bad,e.export());}
  const room=((((bad.state as Document).interiors as Document).locations as Document).c2 as Document);Object.assign(room,{floorId:'upper',x:upperDoor.x!,y:upperDoor.y!});
  assert.throws(()=>root.LW.Engine.import(bad),/incompatible spaces/);
 }
 g.dispose();e=root.LW.Engine.import(pending);const native=root.LW.Engine.import(pending),portable=toolbox.openStory(toolbox.reviewStory(root.LWStory.encode(e)));
 try{assert(portable.command({id:'respond-interaction',actorId:'c2',args:[invitation.interactionId!,true]}).ok);for(const restored of [e,native])assert(restored.dispatchCommand({id:'respond-interaction',actorId:'c2',args:[invitation.interactionId!,true]}).ok);assert.deepEqual(native.export(),e.export());assert.deepEqual(portable.save(),e.export());
  for(const restored of [e,native]){restored.s.started=true;restored.s.paused=false;}portable.start();
  for(let i=0;i<40;i++){e.step(.1);native.step(.1);portable.advance(.1);assert.deepEqual(native.export(),e.export());assert.deepEqual(portable.save(),e.export());}
 }finally{portable.dispose();}
}));
test('Runtime text and JSON Schema agree on astral code points at the label and description boundaries',()=>game(g=>{
 const source=path.resolve(__dirname,'../source/assets/interactions'),schema=JSON.parse(fs.readFileSync(path.join(source,'interaction.schema.json'),'utf8')) as object;
 const validate=new Ajv({strict:true}).compile(schema),lib=library(g),first=(lib.definitions as Document[])[0]!;
 first.label='🌱'.repeat(200);first.description='🌿'.repeat(1000);assert(validate(lib),JSON.stringify(validate.errors));assert(toolbox.validateInteractionLibrary(lib).ok);
 first.label+='🌱';assert.equal(validate(lib),false);assert.equal(toolbox.validateInteractionLibrary(lib).ok,false);
}));
fs.writeFileSync(path.join(__dirname,'interaction-results.json'),JSON.stringify({passed:results.filter(r=>r.passed).length,total:results.length,results},null,2)+'\n');
if(results.some(r=>!r.passed))process.exitCode=1;console.log(results.filter(r=>r.passed).length+'/'+results.length+' interaction checks passed');
