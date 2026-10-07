'use strict';
// Tests run the composite showcase game: install its content profile before any engine module loads.
require('./test-support/install-games.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs');
const X=require('./scenario-runtime.js'),S=require('./scenario-story.js');
const C=global.LWContent,P=global.LWSimulationProfile,W=global.LWWorldProfile,L=global.LW,results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error(name,error.message);}}
const copy=C.copy,all=X.builtins();
function custom(){const p=copy(all[0]);p.id='tuned-world';p.name='Tuned world';p.presentation.title='Tuned world';p.simulation.id='tuned-v1';p.simulation.name='Tuned simulation';return p;}
function launch(pack=all[0],scene=pack.scenes[0].id){return X.commitScene(X.prepareScene(pack,scene));}

test('Shipped packs explicitly publish schema 2 simulation profiles',()=>{for(const pack of all){assert.equal(pack.schemaVersion,2);assert.equal(pack.simulation.schemaVersion,1);assert.equal(pack.simulation.archetype.id,'living-world-v1');assert(X.validate(pack).ok);}});
test('Schema 1 packs are rejected instead of migrated',()=>{const p=copy(all[0]);p.schemaVersion=1;delete p.simulation;const before=JSON.stringify(p),r=X.validate(p);assert.equal(r.ok,false);assert.equal(JSON.stringify(p),before);assert.match(r.errors.join('\n'),/schema version 2/i);});
test('Schema 2 packs require an explicit simulation profile',()=>{const p=copy(all[0]);delete p.simulation;const r=X.validate(p);assert.equal(r.ok,false);assert.match(r.errors.join('\n'),/simulation/i);});
test('Scenario actor rules become the authoritative ECS tuning',()=>{const p=custom();p.simulation.rules.actor.needs.foodIdle=1;const e=launch(p);e.selectCreature('c1');e.actor.task=null;const before=e.actor.needs.food;e.ecs.step(e.actor,.1,{day:e.s.day,socialPreference:0,loadLevel:0,hasShelter:true});assert(Math.abs((before-e.actor.needs.food)-.1)<1e-9);assert.equal(e.simulationProfile.id,'tuned-v1');});
test('Scenario economy rules become the authoritative settlement tuning',()=>{const p=custom();p.simulation.rules.economy.income.pocketShare=.5;const e=launch(p);assert.deepEqual(e.economyRuntime().splitIncome(9),{guide:5,pocket:4});});
test('Existing engines retain their immutable profile after another profile activates',()=>{const p=custom();p.simulation.rules.economy.income.pocketShare=.5;const e=launch(p),original=e.simulationProfile;launch(all[1]);assert.strictEqual(e.simulationProfile,original);assert.equal(e.economyRuntime().rules.income.pocketShare,.5);});
test('Portable envelope 10 preserves the exact profile and deterministic continuation',()=>{const p=custom();p.simulation.rules.actor.needs.joyRate=.2;p.simulation.rules.economy.income.pocketShare=.4;const a=launch(p);a.advance(20);const doc=S.encode(a);assert.equal(doc.version,10);assert.equal(doc.experience.schemaVersion,2);assert.equal(doc.simulationFingerprint,P.fingerprint(p.simulation));const b=S.commit(S.inspect(doc));assert.deepEqual(b.scenarioContext,a.scenarioContext);assert.equal(b.simulationProfile.id,'tuned-v1');a.advance(10);b.advance(10);assert.deepEqual(a.export(),b.export());});
test('Non-current portable story versions are rejected',()=>{const e=launch(all[0]),doc=S.encode(e);doc.version=9;assert.throws(()=>S.inspect(doc),/current Littlewild story format/);});
test('Tampered simulation snapshots fail their independent fingerprint',()=>{const e=launch(all[0]),doc=S.encode(e);doc.experience.simulation.rules.actor.needs.foodIdle+=.01;doc.experienceFingerprint=X.hash(doc.experience);assert.throws(()=>S.inspect(doc),/Simulation profile fingerprint/);});
test('Scenario story review is object-bound and rejects preview context mutation',()=>{const e=launch(all[0]),preview=S.inspect(S.encode(e));preview.experience.sceneName+=' tampered';assert.throws(()=>S.commit(preview),/review is stale/i);});
test('Committed scenario context is isolated from later preview edits',()=>{const e=launch(all[0]),preview=S.inspect(S.encode(e)),back=S.commit(preview),before=JSON.stringify(back.scenarioContext);preview.experience.sceneName+=' later';assert.equal(JSON.stringify(back.scenarioContext),before);});
test('Captured scenarios publish schema 2 and the engine profile',()=>{const p=custom(),e=launch(p),captured=X.capture(e);assert.equal(captured.schemaVersion,2);assert.equal(captured.simulation.id,'tuned-v1');assert(X.validate(captured).ok);});
test('Unsupported archetypes are rejected without changing active registries',()=>{const before={profile:P.hash,world:W.hash},p=custom();p.simulation.archetype.engineLayers[0]='untrusted-layer';const r=X.validate(p);assert.equal(r.ok,false);assert.equal(P.hash,before.profile);assert.equal(W.hash,before.world);});
test('Unknown archetype identity cannot pass scenario validation with an otherwise supported schedule',()=>{
 const before={profile:P.hash,world:W.hash},p=custom();p.simulation.archetype.id='unregistered-world-v1';
 const document=JSON.stringify(p),result=X.validate(p);assert.equal(result.ok,false);assert.match(result.errors.join('\n'),/archetype/);
 assert.equal(P.hash,before.profile);assert.equal(W.hash,before.world);assert.equal(JSON.stringify(p),document);
});
test('Failed scene commit rolls every staged registry and profile back',()=>{launch(all[0]);const before={profile:P.hash,world:W.hash},p=custom();p.scenes[0].initialState.colony.creatures[0].creature.x=999;assert.throws(()=>X.prepareScene(p,p.scenes[0].id));assert.equal(P.hash,before.profile);assert.equal(W.hash,before.world);});
test('Custom rule profiles remain deterministic across save and resume',()=>{const p=custom();p.simulation.rules.actor.needs.energyIdle=.2;const a=launch(p);a.advance(35);const b=S.commit(S.inspect(S.encode(a)));a.advance(25);b.advance(25);assert.deepEqual(a.export(),b.export());});
test('Littlewild and Emberworks remain playable under the compiled archetype',()=>{for(const pack of all){const e=launch(pack,pack.scenes.at(-1).id);assert.equal(e.composition.layers.join(','),pack.simulation.archetype.engineLayers.join(','));e.s.started=true;e.s.paused=false;const before=e.s.simTime;e.advance(5);assert(e.s.simTime>before);}});
launch(all[0],'charted-home');
const report={passed:results.filter(r=>r.passed).length,total:results.length,results};fs.writeFileSync(__dirname+'/simulation-profile-integration-results.json',JSON.stringify(report,null,2));console.log(report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
