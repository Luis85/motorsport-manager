/// <reference path="./skill-tree-contracts.d.ts" />
/// <reference path="./application-records.d.ts" />
/// <reference path="./engine-core-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {toolbox} from './developer-sdk.cjs';
interface Native {
 s:LWApplication.State;actor:LWApplication.Actor;creatures:LWApplication.Actor[];
 export():LWApplication.EngineDocument;
 attachSkillTree(targetId:string,input:unknown):LWRuntime.Result;
 unlockSkillTreeNode(targetId:string,treeId:string,nodeId:string):LWRuntime.Result;
 grantSkillTreeXp(targetId:string,amount:number):LWRuntime.Result;
 skillTreeState(targetId:string):LWSkillTrees.View[];
 settleEconomy(spec:LWCorePorts.EconomySpec):LWCorePorts.EconomyResult;
 withActor<T>(id:string,work:()=>T):T;
 workRate(task:LWCorePorts.Task):number;learningRate(style?:string):number;
 purchaseCreature(personality:string):LWRuntime.Result;selectCreature(id:string):LWRuntime.Result;
}
const root=globalThis as unknown as {LWSkillTrees:LWSkillTrees.Api;LW:{Engine:{import(input:unknown):Native;new(state?:unknown):Native}};LWStory:{encode(e:Native):unknown;inspect(input:unknown):unknown;commit(input:unknown):Native}};
const rules=root.LWSkillTrees;
const demo=require('./content/skill-tree.json') as LWSkillTrees.Definition;
const copy=<T,>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
function engine(sceneId='charted-home'):Native{const g=toolbox.create({scenarioId:'littlewild',sceneId});try{return root.LW.Engine.import(g.save());}finally{g.dispose();}}
const snapshot=(e:Native):string=>JSON.stringify(e.export());

test('Definitions are detached and admit arbitrary DAGs and bounded rank effects',()=>{
 const input=copy(demo),valid=rules.validate(input);input.nodes[0]!.name='changed';assert.equal(valid.nodes[0]!.name,'Finding your feet');
 assert.equal(valid.nodes.length,5);assert.deepEqual(rules.attach(undefined,demo)[0]?.ranks,{});
});
test('Malformed definitions reject duplicate nodes, cycles, invalid references and executable fields',()=>{
 const changes:((d:LWSkillTrees.Definition)=>void)[]=[
  d=>d.nodes.push(copy(d.nodes[0]!)),d=>d.nodes[0]!.requires=[{nodeId:'craftsman',rank:1}],
  d=>d.nodes[1]!.requires=[{nodeId:'missing',rank:1}],d=>d.nodes[1]!.requires[0]!.rank=5,
  d=>d.xpPerPoint=0,d=>d.nodes[0]!.cost=-1,d=>d.nodes[0]!.effects.workSpeed=Infinity,
  d=>d.nodes[0]!.id='__proto__',d=>Object.assign(d,{onTick:'code'}),d=>d.version=2 as 1
 ];
 for(const change of changes){const d=copy(demo);change(d);assert.throws(()=>rules.validate(d));}
 const getter=copy(demo);Object.defineProperty(getter,'nodes',{get(){throw Error('executed getter');},enumerable:true});assert.throws(()=>rules.validate(getter),/non-data/);
 const sparse=copy(demo);delete sparse.nodes[0];assert.throws(()=>rules.validate(sparse));
});
test('Earned points, rank costs, level gates and exclusive paths are enforced atomically',()=>{
 const fresh=rules.attach(undefined,demo);assert.throws(()=>rules.unlock(fresh,demo.id,'roots',1),/Earn/);
 const earned=rules.award(fresh,200),one=rules.unlock(earned,demo.id,'roots',1);
 assert.deepEqual(fresh[0]!.ranks,{});assert.equal(fresh[0]!.xp,0);
 assert.throws(()=>rules.unlock(one,demo.id,'maker',1),/level 2/);
 const maker=rules.unlock(one,demo.id,'maker',2);
 assert.throws(()=>rules.unlock(maker,demo.id,'learner',2),/already chosen/);
 assert.throws(()=>rules.unlock(maker,demo.id,'craftsman',3),/rank 2/);
 const ranked=rules.unlock(maker,demo.id,'maker',2),cap=rules.unlock(ranked,demo.id,'craftsman',3);
 assert.equal(rules.inspect(cap,3)[0]!.spent,5);assert.equal(rules.inspect(cap,3)[0]!.points,5);
 assert.equal(rules.bonus(cap,'workSpeed'),.35);
 assert.throws(()=>rules.unlock(ranked,demo.id,'maker',2),/Fully/);
});
test('Checkpoint validation rejects forged progress, duplicate trees and overspending',()=>{
 const valid=rules.unlock(rules.award(rules.attach([],demo),200),demo.id,'roots',1);
 const mutations:((p:LWSkillTrees.Progress)=>void)[]=[p=>p.xp=-1,p=>p.xp=.5,p=>p.ranks.roots=3,p=>p.ranks.missing=1,p=>p.ranks={maker:1},p=>p.ranks={roots:1,maker:1,learner:1},p=>p.xp=0];
 for(const change of mutations){
  const bad=copy(valid);change(bad[0]!);assert.throws(()=>rules.validateProgress(bad));
 }
 assert.throws(()=>rules.validateProgress(null));assert.throws(()=>rules.validateProgress([...valid,...valid]));
 assert.throws(()=>rules.attach(valid,demo));assert.throws(()=>rules.award(valid,NaN));
 const max=copy(valid);max[0]!.xp=1_000_000_000;assert.equal(rules.award(max,1)[0]!.xp,1_000_000_000);
});
test('Littlewild starts every authored creature with an independent unspent tree',()=>{
 const e=engine();assert.equal(e.creatures.length,3);
 for(const actor of e.creatures){const [tree]=e.skillTreeState(actor.id);assert.equal(tree?.id,demo.id);assert.equal(tree?.xp,0);assert.equal(tree?.points,0);}
 assert.notStrictEqual(e.creatures[0]!.skillTrees,e.creatures[1]!.skillTrees);
 const before=snapshot(e);e.skillTreeState('c1')[0]!.nodes[0]!.name='changed';assert.equal(snapshot(e),before);
});
test('Optional progression belongs to the scoped actor without introducing defaults',()=>{
 const e=engine(),catalog=(globalThis as unknown as {LWCreatures:{personalFields:readonly string[];optionalPersonalFields:readonly string[];all():{state:{defaults:Record<string,unknown>}}[]}}).LWCreatures;
 assert(catalog.personalFields.includes('skillTrees'));assert(catalog.optionalPersonalFields.includes('skillTrees'));
 assert(!Object.hasOwn(catalog.all()[0]!.state.defaults,'skillTrees'));
 assert.strictEqual((e.s as unknown as {skillTrees?:LWSkillTrees.Progress[]}).skillTrees,e.actor.skillTrees);
 e.withActor('c2',()=>assert.strictEqual((e.s as unknown as {skillTrees?:LWSkillTrees.Progress[]}).skillTrees,e.creatures[1]!.skillTrees));
});
test('Player and creature attachments award independently and never retroactively grant level XP',()=>{
 const e=engine(),tree={...copy(demo),id:'guide-tree'};assert(e.attachSkillTree('player',tree).ok);
 assert.equal(e.skillTreeState('player')[0]?.xp,0);assert(e.grantSkillTreeXp('c1',20).ok);
 assert.equal(e.skillTreeState('player')[0]?.xp,0);assert.equal(e.skillTreeState('c2')[0]?.xp,0);
 assert(e.unlockSkillTreeNode('c1',demo.id,'roots').ok);
 const before=snapshot(e);assert(!e.attachSkillTree('player',tree).ok);assert(!e.attachSkillTree('c99',tree).ok);assert(!e.unlockSkillTreeNode('c2',demo.id,'roots').ok);assert.equal(snapshot(e),before);
});
test('Accepted reward settlement credits its scoped creature and player exactly once',()=>{
 const e=engine();assert(e.attachSkillTree('player',{...copy(demo),id:'guide-tree'}).ok);
 e.withActor('c2',()=>{assert(e.settleEconomy({id:'tree-reward',actorXp:20,playerXp:10}).ok);});
 assert.equal(e.skillTreeState('c2')[0]?.xp,20);assert.equal(e.skillTreeState('c1')[0]?.xp,0);assert.equal(e.skillTreeState('player')[0]?.xp,10);
 e.withActor('c2',()=>{const before=snapshot(e);assert(!e.settleEconomy({id:'tree-reward',actorXp:20,playerXp:10}).ok);assert.equal(snapshot(e),before);assert(!e.settleEconomy({id:'tree-refused',guide:-1_000_000,actorXp:20}).ok);assert.equal(snapshot(e),before);});
});
test('Unlocked rank effects apply to the working actor and survive engine restoration',()=>{
 const e=engine();e.selectCreature('c1');const base=e.learningRate();
 assert(e.grantSkillTreeXp('c1',100).ok);e.actor.creature.level=2;
 assert(e.unlockSkillTreeNode('c1',demo.id,'roots').ok);assert(e.unlockSkillTreeNode('c1',demo.id,'learner').ok);
 assert(Math.abs(e.learningRate()/base-1.15)<1e-9);
 e.withActor('c2',()=>assert(Math.abs(e.learningRate()/base-1)<1e-9));
 const saved=e.export(),restored=root.LW.Engine.import(saved);assert.deepEqual(restored.skillTreeState('c1'),e.skillTreeState('c1'));assert.equal(snapshot(restored),JSON.stringify(saved));
});
test('Guide bonuses apply to companions without spending their personal points',()=>{
 const e=engine();e.selectCreature('c1');const base=e.learningRate();
 const guide={...copy(demo),id:'guide-tree'};guide.nodes[0]!.effects={learningSpeed:.1};
 assert(e.attachSkillTree('player',guide).ok);assert(e.grantSkillTreeXp('player',20).ok);assert(e.unlockSkillTreeNode('player',guide.id,'roots').ok);
 assert(Math.abs(e.learningRate()/base-1.1)<1e-9);e.withActor('c2',()=>assert(Math.abs(e.learningRate()/base-1.1)<1e-9));
 assert.equal(e.skillTreeState('c1')[0]?.xp,0);
});
test('Portable story round-trip preserves custom definitions and progress',()=>{
 const e=engine();e.attachSkillTree('player',{...copy(demo),id:'guide-tree'});e.grantSkillTreeXp('player',40);e.unlockSkillTreeNode('player','guide-tree','roots');
 const document=root.LWStory.encode(e),restored=root.LWStory.commit(root.LWStory.inspect(document));
 assert.deepEqual(restored.skillTreeState('player'),e.skillTreeState('player'));
 assert.deepEqual(restored.skillTreeState('c1'),e.skillTreeState('c1'));
});
test('Invalid imported trees reject before reconstruction and old saves remain tree-free',()=>{
 const e=engine(),before=snapshot(e),saved=e.export();saved.state.colony.creatures[0]!.skillTrees![0]!.ranks={maker:1};assert.throws(()=>root.LW.Engine.import(saved));assert.equal(snapshot(e),before);
 const legacy=e.export();for(const actor of legacy.state.colony.creatures)delete actor.skillTrees;
 const restored=root.LW.Engine.import(legacy);assert.deepEqual(restored.skillTreeState('c1'),[]);assert.equal(snapshot(restored),JSON.stringify(legacy));
 assert.throws(()=>new root.LW.Engine(saved.state));
});
test('New arrivals inherit the retained demo definition with independent zero progress',()=>{
 const e=engine();e.s.player.coins=10000;e.s.progression.slots=4;e.grantSkillTreeXp('c1',40);const founder=e.creatures[0]!;
 assert(e.purchaseCreature(founder.personality).ok);const arrival=e.creatures.at(-1)!;assert.equal(e.skillTreeState(arrival.id)[0]?.xp,0);assert.deepEqual(arrival.skillTrees?.[0]?.definition,founder.skillTrees?.[0]?.definition);
});
test('SDK discovers attachment and unlock commands, reads detached trees without ticking',()=>{
 const g=toolbox.create({scenarioId:'littlewild',sceneId:'first-morning'});
 try{
  assert(toolbox.commands().some(c=>c.id==='attach-skill-tree'));assert(toolbox.commands().some(c=>c.id==='unlock-skill-tree-node'));
  const before=JSON.stringify(g.save());assert.equal(g.skillTrees('c1')[0]?.points,0);assert.equal(JSON.stringify(g.save()),before);
  assert(g.command({id:'attach-skill-tree',args:['player',{...copy(demo),id:'guide-tree'} as unknown as LittlewildDeveloper.Document]}).ok);
  assert(!g.command({id:'unlock-skill-tree-node',args:['c1',demo.id,'roots']}).ok);
  g.start();g.step(2400);assert((g.skillTrees('c1')[0]?.xp??0)>0,'Actual autonomous work must earn tree XP.');
 }finally{g.dispose();}
});
const passed=results.filter(r=>r.passed).length;
fs.writeFileSync(__dirname+'/skill-tree-results.json',JSON.stringify({passed,total:results.length,results},null,2)+'\n');console.log(`${passed}/${results.length} skill-tree checks passed`);if(passed!==results.length)process.exitCode=1;
