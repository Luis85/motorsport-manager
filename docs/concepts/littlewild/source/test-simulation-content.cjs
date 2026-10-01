'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const X=require('./scenario-runtime.js'),S=require('./scenario-story.js');
const R=global.LWSimulationContent,C=global.LWContent,G=global.LWGrowth,L=global.LW;
const results=[],builtins=X.builtins(),copy=C.copy;
function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error(name,error.message);}}
function stable(engine){return C.stable(engine.export().state);}
function reset(){return X.commitScene(X.prepareScene(builtins[0],builtins[0].scenes[0].id));}
function customPack(){
 const pack=copy(builtins[0]),profile=pack.simulation.ruleProfiles[0];
 profile.id='measured';profile.name='Measured';profile.description='A deterministic test profile with visible actor and economy tuning.';
 profile.actor.needs.foodIdle=.7;profile.economy.income.pocketShare=.5;
 for(const scene of pack.scenes)scene.ruleProfileId=profile.id;
 return pack;
}
function legacyPack(){const pack=copy(builtins[0]);pack.schemaVersion=1;delete pack.simulation;for(const scene of pack.scenes){delete scene.ruleProfileId;delete scene.actorArchetypeId;}return pack;}
function legacyStory(engine){const doc=S.encode(engine);doc.version=9;delete doc.experience.schemaVersion;delete doc.experience.simulation;doc.experienceFingerprint=X.hash(doc.experience);return doc;}

test('Default simulation content is versioned, validated, and deeply frozen',()=>{
 assert.equal(R.defaults.format,'littlewild-simulation-content');assert.equal(R.defaults.schemaVersion,1);
 assert(Object.isFrozen(R.defaults)&&Object.isFrozen(R.defaults.ruleProfiles[0].actor.needs));
 assert.equal(R.defaultSelection.ruleProfile.id,'standard');assert.equal(R.defaultSelection.actorArchetype.id,'creature-standard');
});

test('Exported defaults are detached data',()=>{const doc=R.exportDefaults();doc.ruleProfiles[0].name='Changed';assert.equal(R.defaults.ruleProfiles[0].name,'Standard');});

test('Compatibility profile exactly embeds the authoritative actor and economy defaults',()=>{
 assert.deepEqual(R.defaultSelection.ruleProfile.actor,require('./content/actor-rules.json'));
 assert.deepEqual(R.defaultSelection.ruleProfile.economy,require('./content/economy-rules.json'));
 for(const pack of builtins)assert.deepEqual(pack.simulation,R.exportDefaults());
});

test('Rule profiles reject executable and unknown fields',()=>{
 const profile=copy(R.defaultSelection.ruleProfile);profile.execute=()=>{};assert.throws(()=>R.validateRuleProfile(profile),/profile|data|forbidden/i);
 delete profile.execute;profile.actor.needs.unknown=1;assert.throws(()=>R.validateRuleProfile(profile),/schema|needs/i);
});

test('Rule profiles reject unsupported profile and nested rule versions',()=>{
 const profile=copy(R.defaultSelection.ruleProfile);profile.schemaVersion=2;assert.throws(()=>R.validateRuleProfile(profile));
 profile.schemaVersion=1;profile.economy.schemaVersion=2;assert.throws(()=>R.validateRuleProfile(profile));
});

test('Composition archetypes accept only the known dependency-complete component contract',()=>{
 const archetype=copy(R.defaultSelection.actorArchetype);archetype.transientComponents.pop();assert.throws(()=>R.validateArchetype(archetype),/archetype/i);
 archetype.transientComponents.push('Renderer');assert.throws(()=>R.validateArchetype(archetype),/archetype/i);
});

test('Simulation sets reject duplicate profile and archetype identities',()=>{
 const set=R.exportDefaults();set.ruleProfiles.push(copy(set.ruleProfiles[0]));assert.throws(()=>R.validateSet(set),/Duplicate rule profile/i);
 const other=R.exportDefaults();other.compositionArchetypes.push(copy(other.compositionArchetypes[0]));assert.throws(()=>R.validateSet(other),/Duplicate composition archetype/i);
});

test('Every bundled pack publishes resolvable profile and archetype references',()=>{
 for(const pack of builtins){assert.equal(pack.schemaVersion,2);const valid=X.validate(pack);assert(valid.ok,valid.errors.join('\n'));
  for(const scene of pack.scenes){const selected=R.resolve(pack.simulation,scene.ruleProfileId,scene.actorArchetypeId);assert.equal(selected.ruleProfile.id,'standard');assert.equal(selected.actorArchetype.id,'creature-standard');}}
});

test('Unknown scene profile and archetype references fail before registry mutation',()=>{
 reset();const before=C.stable({base:C.registry.export(),growth:G.content}),profile=copy(builtins[0]);profile.scenes[0].ruleProfileId='missing';assert.equal(X.validate(profile).ok,false);assert.equal(C.stable({base:C.registry.export(),growth:G.content}),before);
 const archetype=copy(builtins[0]);archetype.scenes[0].actorArchetypeId='missing';assert.equal(X.validate(archetype).ok,false);
});

test('Scenario-selected actor and economy tuning is installed on the real engine',()=>{
 const pack=customPack(),engine=X.commitScene(X.prepareScene(pack,pack.scenes[0].id));
 assert.equal(engine.ecs.rules.needs.foodIdle,.7);assert.equal(engine.economyRuntime().rules.income.pocketShare,.5);assert.deepEqual(engine.economyRuntime().splitIncome(9),{guide:5,pocket:4});
 const actor=engine.creatures[0],before=actor.needs.food;actor.task=null;engine.ecs.step(actor,.1,{day:engine.s.day,socialPreference:0,loadLevel:0,hasShelter:false});assert(Math.abs(actor.needs.food-(before-.07))<1e-9);
});

test('Simulation content remains transient and native state stays version 8',()=>{
 const pack=customPack(),engine=X.commitScene(X.prepareScene(pack,pack.scenes[0].id)),doc=engine.export(),json=JSON.stringify(doc);
 assert.equal(doc.version,8);assert.equal(doc.state.version,8);for(const token of ['simulationSelection','ruleProfile','actorArchetype'])assert(!json.includes(token));
});

test('Schema-1 packs migrate deliberately to current defaults without mutating input',()=>{
 const source=legacyPack(),before=JSON.stringify(source),result=X.validate(source);assert(result.ok,result.errors.join('\n'));assert.equal(JSON.stringify(source),before);
 assert.equal(result.sourceSchemaVersion,1);assert.equal(result.pack.schemaVersion,2);assert(result.migrationNotes.length);
 assert.equal(result.pack.scenes[0].ruleProfileId,'standard');assert.equal(result.pack.scenes[0].actorArchetypeId,'creature-standard');
});

test('Migrated schema-1 packs launch and continue under the standard profile',()=>{
 const source=legacyPack(),engine=X.commitScene(X.prepareScene(source,source.scenes[0].id));assert.equal(engine.simulationSelection.ruleProfile.id,'standard');
 const saved=stable(engine);engine.advance(1);assert.notEqual(stable(engine),saved);
});

test('Current scenario stories use envelope 10 with an exact simulation snapshot',()=>{
 const pack=customPack(),engine=X.commitScene(X.prepareScene(pack,pack.scenes[0].id)),doc=S.encode(engine);
 assert.equal(doc.version,10);assert.equal(doc.experience.schemaVersion,2);assert.equal(doc.experience.simulation.ruleProfile.id,'measured');
 assert.equal(doc.experienceFingerprint,X.hash(doc.experience));
});

test("Portable stories snapshot the engine's active selection instead of stale context metadata",()=>{
 const pack=customPack(),engine=X.commitScene(X.prepareScene(pack,pack.scenes[0].id));R.apply(engine,R.defaultSelection);
 const doc=S.encode(engine);assert.equal(engine.scenarioContext.simulation.ruleProfile.id,'measured');assert.equal(doc.experience.simulation.ruleProfile.id,'standard');
});

test('Envelope-10 profile tampering is rejected before any active registry changes',()=>{
 reset();const engine=X.commitScene(X.prepareScene(customPack(),customPack().scenes[0].id)),doc=S.encode(engine),before=C.registry.hash;
 doc.experience.simulation.ruleProfile.actor.needs.foodIdle=.2;assert.throws(()=>S.inspect(doc),/fingerprint/i);assert.equal(C.registry.hash,before);
});

test('Envelope-10 executable or unsupported simulation data is rejected even with a refreshed fingerprint',()=>{
 const pack=customPack(),engine=X.commitScene(X.prepareScene(pack,pack.scenes[0].id)),doc=S.encode(engine);
 doc.experience.simulation.ruleProfile.system='eval';doc.experienceFingerprint=X.hash(doc.experience);assert.throws(()=>S.inspect(doc),/profile|context|field|unknown/i);
});

test('Envelope-9 experience snapshots migrate explicitly to standard simulation content',()=>{
 const engine=reset(),doc=legacyStory(engine),preview=S.inspect(doc);assert.equal(preview.sourceVersion,9);assert(preview.migrationNotes.some(note=>note.includes('standard ECS rule profile')));
 assert.equal(preview.engine.simulationSelection.ruleProfile.id,'standard');const restored=S.commit(preview);assert.equal(stable(restored),stable(engine));
});

test('Custom-profile save and restore preserves deterministic continuation',()=>{
 const pack=customPack(),left=X.commitScene(X.prepareScene(pack,pack.scenes[0].id));left.s.paused=false;left.advance(8);
 const right=S.commit(S.inspect(S.encode(left)));assert.equal(right.simulationSelection.ruleProfile.id,'measured');left.advance(12);right.advance(12);assert.equal(stable(left),stable(right));
});

test('Captured packs preserve the selected profile and archetype as self-contained data',()=>{
 const pack=customPack(),engine=X.commitScene(X.prepareScene(pack,pack.scenes[0].id)),captured=X.capture(engine),scene=captured.scenes[0];
 assert.equal(captured.schemaVersion,2);assert.equal(captured.simulation.ruleProfiles[0].id,'measured');assert.equal(scene.ruleProfileId,'measured');assert.equal(scene.actorArchetypeId,'creature-standard');assert(X.validate(captured).ok);
});

test('Definition-library edits retain the engine-specific simulation selection',()=>{
 const pack=customPack(),engine=X.commitScene(X.prepareScene(pack,pack.scenes[0].id)),original=G.clone(G.content),candidate=G.clone(G.content);candidate.interactions[0].label+=' profile-test';
 try{const next=S.applyGrowth(candidate,engine);assert.equal(next.simulationSelection.ruleProfile.id,'measured');assert.equal(next.ecs.rules.needs.foodIdle,.7);assert.equal(next.scenarioContext.simulation.ruleProfile.id,'measured');}
 finally{G.replace(original);}
});

test('Applying a profile validates actor composition before replacing runtimes',()=>{
 const engine=reset(),selection=R.copySelection(R.defaultSelection),actor=engine.creatures[0],inventory=actor.inventory;delete actor.inventory;
 try{assert.throws(()=>R.apply(engine,selection),/Inventory/);}finally{actor.inventory=inventory;R.apply(engine,selection);}
});

test('Selection objects are detached, immutable, and absent from authoritative state',()=>{
 const engine=reset(),selected=engine.simulationSelection;assert(Object.isFrozen(selected)&&Object.isFrozen(selected.ruleProfile));assert(!Object.hasOwn(engine.state,'simulationSelection'));
 const copySelection=R.copySelection(selected);copySelection.ruleProfile.name='Changed';assert.equal(selected.ruleProfile.name,'Standard');
});

test('M6 source manifest matches the exact simulation-content authority files',()=>{
 const files=['browser-v15.py','schema-checks-v15.py','source/build.py','source/content/actor-rules.json','source/content/default-simulation.json','source/content/economy-rules.json','source/content/emberworks.pack.json','source/content/littlewild.pack.json','source/content/scenario-v1.schema.json','source/content/scenario.schema.json','source/index.html','source/scenario-runtime.js','source/scenario-story.js','source/scenario-ui.js','source/simulation-content.js','source/simulation.cjs','source/test-simulation-content.cjs','source/test-v15.cjs','source/tools/scenario-cli.cjs','source/ui.js','verify-v15.py'].sort();
 const root=path.resolve(__dirname,'..'),digest=crypto.createHash('sha256');for(const file of files){digest.update(file);digest.update('\0');digest.update(fs.readFileSync(path.join(root,file)));digest.update('\0');}
 const state=JSON.parse(fs.readFileSync(path.join(__dirname,'ecs-milestone-state.json')));assert.equal(state.milestone,'M6');assert.equal(state.scope,'simulation-content-source-manifest-v1');assert.equal(state.files,files.length);assert.equal(state.sha256,digest.digest('hex'));
});

const passed=results.filter(result=>result.passed).length;
fs.writeFileSync(__dirname+'/simulation-content-results.json',JSON.stringify({passed,total:results.length,failed:results.length-passed,results},null,2)+'\n');
console.log(`${passed}/${results.length} simulation-content checks passed`);if(passed!==results.length)process.exitCode=1;
