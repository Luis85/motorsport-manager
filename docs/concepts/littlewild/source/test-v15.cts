'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process');
const X=require('./scenario-runtime.js'),S=require('./scenario-story.js');
const C=global.LWContent,A=global.LWAdventure,W=global.LWWorldContent,G=global.LWGrowth,P=global.LWWorldProfile,R=global.LWSimulationProfile,L=global.LW;
const all=X.builtins(),results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error(name,error.message);}}
const copy=C.copy;
function active(){return C.stable({base:C.registry.export(),ad:A.content,world:W.content,growth:G.content,profile:P.current,simulation:R.current});}
function defaults(){X.commitScene(X.prepareScene(all[0],'charted-home'));}
function rejects(name,edit){test(name,()=>{const p=copy(all[0]);edit(p);const before=active(),v=X.validate(p);assert.equal(v.ok,false);assert(v.errors.length);assert.equal(active(),before);});}
for(const p of all){
 test(p.id+': validates without mutating active registries',()=>{const before=active();assert(X.validate(p).ok);assert.equal(active(),before);});
 for(const scene of p.scenes){
  test(p.id+'/'+scene.id+': launches real scene and restores exact v10 state',()=>{
   const engine=X.commitScene(X.prepareScene(p,scene.id));assert.equal(engine.scenarioContext.packId,p.id);
   const saved=S.encode(engine);assert.equal(saved.version,10);const back=S.commit(S.inspect(saved));
   assert.deepEqual(back.export(),engine.export());assert.deepEqual(back.scenarioContext,engine.scenarioContext);
  });
  test(p.id+'/'+scene.id+': normal simulation continues deterministically',()=>{
   const a=X.commitScene(X.prepareScene(p,scene.id));a.advance(30);const b=S.commit(S.inspect(S.encode(a)));
   a.advance(20);b.advance(20);assert.deepEqual(a.export(),b.export());
  });
  test(p.id+'/'+scene.id+': captured template is validated and playable',()=>{
   const a=X.commitScene(X.prepareScene(p,scene.id));a.advance(5);const pack=X.capture(a);assert(X.validate(pack).ok);
   const b=X.commitScene(X.prepareScene(pack,pack.scenes[0].id));assert.deepEqual(b.export(),a.export());
  });
 }
}
defaults();
rejects('Reject unknown executable pack field',p=>p.script='alert(1)');
rejects('Reject unsupported schema version',p=>p.schemaVersion=99);
rejects('Reject duplicate scene IDs',p=>p.scenes[1].id=p.scenes[0].id);
rejects('Reject duplicate world IDs',p=>p.worlds.push(copy(p.worlds[0])));
rejects('Reject absent referenced world',p=>p.scenes[0].worldId='missing');
rejects('Reject unknown tutorial operation',p=>p.tutorial[0].action='run-code');
rejects('Reject duplicate tutorial IDs',p=>p.tutorial[1].id=p.tutorial[0].id);
rejects('Reject markup in experience labels',p=>p.presentation.title='<img onerror=1>');
rejects('Reject CSS URL injection',p=>p.presentation.accent='url(https://example.com)');
rejects('Reject invalid scene starting coin type',p=>p.scenes[0].initialState.player.coins='free');
rejects('Reject unknown scene-state fields',p=>p.scenes[0].initialState.playre={coins:42});
rejects('Reject unknown nested scene-state fields',p=>p.scenes[0].initialState.player.nickname='ignored');
rejects('Reject unsupported topology',p=>p.worlds[0].terrain.pop());
rejects('Reject disconnected land/bridge approaches',p=>{p.worlds[0].terrain[9]=p.worlds[0].terrain[9].replace('.','~');});
rejects('Reject blocked site placement',p=>{const site=p.worlds[0].fixedSites[0];let r=p.worlds[0].terrain[site.y];p.worlds[0].terrain[site.y]=r.slice(0,site.x)+'~'+r.slice(site.x+1);});
rejects('Reject unknown node references',p=>p.worlds[0].fixedSites[0].kind='uranium');
rejects('Reject duplicate fixed-site coordinates',p=>p.worlds[0].fixedSites.push(copy(p.worlds[0].fixedSites[0])));
rejects('Reject excessive resource density',p=>p.worlds[0].resourceCounts.wood=10000);
rejects('Reject invalid palette',p=>p.worlds[0].groundColors.Meadow[0]='not-a-color');
rejects('Reject unsupported visual property',p=>p.worlds[0].shader='evil');
rejects('Reject orphaned building role',p=>p.libraries.base.components.buildings[0].id='unknown-building');
rejects('Reject invalid library references',p=>p.libraries.base.components.recipes[0].station='missing');
rejects('Reject impossible learning dependency',p=>p.libraries.base.components.skills[0].requires.push('unknown'));
rejects('Reject incompatible progression rules',p=>p.libraries.growth.rules.maxSlots=10000);
rejects('Reject unowned active scene island',p=>p.scenes[1].initialState.estate.islands=[{ix:99,iy:99}] );
rejects('Reject terrain with a disconnected corner',p=>{p.worlds[0].terrain[0]='.~~'+p.worlds[0].terrain[0].slice(3);});
test('Reject duplicate JSON object keys before parsing',()=>{const v=X.validate(JSON.stringify(all[0]).replace('"schemaVersion":2','"schemaVersion":2,"schemaVersion":2'));assert(!v.ok);});
test('Reject prototype-bearing raw JSON',()=>{assert(!X.validate('{"__proto__":{}}').ok);});
test('Reject corrupt JSON',()=>assert(!X.validate('{oops').ok));
test('Reject oversized untrusted input',()=>assert(!X.validate(' '.repeat(8*1024*1024+1)).ok));
test('Previews are detached from source pack edits',()=>{const p=copy(all[0]),r=X.prepareScene(p,p.scenes[0].id);p.presentation.title='Changed';assert.notEqual(r.pack.presentation.title,p.presentation.title);});
test('Mutated preview cannot be committed',()=>{for(const edit of[
 p=>p.pack.name='Changed',p=>p.sceneId='charted-home',
 p=>{p.sceneId='charted-home';p.fingerprint=X.hash(p.pack);p.reviewFingerprint=X.hash({packFingerprint:p.fingerprint,sceneId:p.sceneId});}
]){const p=X.prepareScene(all[0],'first-morning'),before=active();edit(p);assert.throws(()=>X.commitScene(p),/preview changed/);assert.equal(active(),before);}});
test('Exported experience integrity is checked',()=>{const a=X.commitScene(X.prepareScene(all[1],all[1].scenes[0].id));const d=S.encode(a),before=active();d.experience.world.name='Changed';assert.throws(()=>S.inspect(d));assert.equal(active(),before);});
test('Mutated story review cannot be committed',()=>{const a=X.commitScene(X.prepareScene(all[0],'first-morning'));for(const edit of[
 p=>p.experience.name='Changed',p=>{p.library=copy(p.library);p.library.library.name='Changed';},p=>p.adventure.revision='5.0.1',
 p=>p.world.name='Changed',p=>p.growth.features[0].name='Changed',p=>p.engine.s.player.coins++,
 p=>{p.experience.name='Changed';p.experienceFingerprint=X.hash(p.experience);p.simulationFingerprint=global.LWSimulationProfile.fingerprint(p.experience.simulation);p.reviewFingerprint='forged';}
]){const p=S.inspect(S.encode(a)),before=active();edit(p);assert.throws(()=>S.commit(p),/stale|review changed/i);assert.equal(active(),before);}});
test('Pack list returns detached copies',()=>{const p=X.builtins();p[0].name='Changed';assert.notEqual(X.builtins()[0].name,'Changed');});
test('Active world is deeply frozen',()=>assert(Object.isFrozen(P.current)&&Object.isFrozen(P.current.terrain)));
test('Temporary world registry always rolls back on errors',()=>{const before=P.current;assert.throws(()=>P.withProfile(all[1].worlds[0],()=>{throw Error('test');}));assert.strictEqual(P.current,before);for(const scope of[
 work=>P.withProfile(all[1].worlds[0],work),work=>C.registry.withLibrary(C.registry.export(),work),
 work=>W.withLibrary(W.content,work),work=>G.withLibrary(G.content,work)
])assert.throws(()=>scope(()=>Promise.resolve()),/synchronous/);assert.strictEqual(P.current,before);});
test('Scene validation failure rolls back every staged library',()=>{const before=active(),p=copy(all[1]);p.scenes[1].initialState.colony.creatures[0].creature.x=999;assert(!X.validate(p).ok);assert.equal(active(),before);});
test('Source setup can select a different player level and budget',()=>{const p=copy(all[0]);p.scenes[0].initialState.player.coins=321;p.scenes[0].initialState.player.level=4;const a=X.commitScene(X.prepareScene(p,p.scenes[0].id));assert.equal(a.s.player.coins,321);assert.equal(a.s.player.level,4);});
test('Second setting changes actual building definitions',()=>{X.commitScene(X.prepareScene(all[1],all[1].scenes[1].id));assert.equal(L.BUILDINGS.bench.name,'Assembly bench');assert.equal(global.LWGeography.describe(0,0).name,'Copper Shore');});
test('Second setting changes actual unowned-island node generation',()=>{defaults();let a=global.LWGeography.generatedNodes(1,0,W);X.commitScene(X.prepareScene(all[1],all[1].scenes[1].id));let b=global.LWGeography.generatedNodes(1,0,W);assert.notDeepEqual(a,b);assert(b.filter(n=>n.kind==='ore').length>a.filter(n=>n.kind==='ore').length);});
test('Resource-map property order does not alter generation',()=>{defaults();const p=copy(P.current),a=global.LWGeography.generatedNodes(2,0,W);p.resourceCounts=Object.fromEntries(Object.entries(p.resourceCounts).reverse());P.withProfile(p,()=>assert.deepEqual(global.LWGeography.generatedNodes(2,0,W),a));});
test('Ordinary v8 imports restore the default world, not the previously selected setting',()=>{defaults();const a=L.createWorldDemo(),d=S.encode(a);assert.equal(d.version,8);X.commitScene(X.prepareScene(all[1],all[1].scenes[1].id));const b=S.commit(S.inspect(d));assert(!b.scenarioContext);assert.equal(P.current.id,'mossmeadow');assert.deepEqual(b.export(),a.export());});
for(const file of ['actual-v13-story.json','actual-v12-story.json'])test('Authentic '+file+' remains importable',()=>{defaults();const data=JSON.parse(fs.readFileSync(__dirname+'/fixtures/'+file));const a=S.commit(S.inspect(data));assert(a.creatures.length>0);});
// Compare the authored default topology with the actual v14 implementation in Git.
const old=fs.readFileSync(__dirname+'/fixtures/v14-island-geometry.cjs','utf8'),sandbox={module:{exports:{}}};vm.runInNewContext(old,sandbox);const OG=sandbox.module.exports;
defaults();P.apply(P.defaults);
let tileComparisons=0;
test('Legacy profile terrain equals v14 at every tile across nine lattice cells',()=>{for(let y=-23;y<46;y++)for(let x=-23;x<46;x++){assert.equal(global.LWGeography.terrain(x,y),OG.terrain(x,y));tileComparisons++;}});
for(const[x,y]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[3,-2]])test('Legacy profile generated island nodes equal v14 at '+x+','+y,()=>assert.equal(JSON.stringify(global.LWGeography.generatedNodes(x,y,W)),JSON.stringify(OG.generatedNodes(x,y,W))));
for(const p of all)for(const[ix,iy]of[[1,0],[-1,0],[0,1],[0,-1],[2,1]])test(p.id+': authored sites survive random resources at '+ix+','+iy,()=>{X.commitScene(X.prepareScene(p,p.scenes[0].id));const nodes=global.LWGeography.generatedNodes(ix,iy,W);for(const site of P.current.fixedSites)assert(nodes.some(n=>n.kind===site.kind&&n.x===site.x+23*ix&&n.y===site.y+23*iy));});
test('Changing world layout invalidates an existing grid cache',()=>{defaults();const a=L.createWorldDemo(),first=global.LWGeography.grid(a.s);P.apply(all[1].worlds[0]);assert.notStrictEqual(first,global.LWGeography.grid(a.s));});
defaults();
const report={passed:results.filter(r=>r.passed).length,total:results.length,tileComparisons,results};fs.writeFileSync(__dirname+'/v15-domain-results.json',JSON.stringify(report,null,2));console.log(report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
