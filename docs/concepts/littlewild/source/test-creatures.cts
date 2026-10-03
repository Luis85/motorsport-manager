'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'../source'),creatureRoot=path.join(source,'assets','creatures'),assetRoot=path.join(source,'assets'),results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.message);}}
const Creatures=require('./creature-catalog.js');require('./content-runtime.js');require('./behavior-tree.js');const Adventure=require('./adventure-content.js'),Factory=require('./creature-factory.js'),ActorECS=require('./actor-ecs.js');
global.LWAssetDefinitions=[];for(const category of fs.readdirSync(assetRoot,{withFileTypes:true}).filter(x=>x.isDirectory()))for(const entry of fs.readdirSync(path.join(assetRoot,category.name),{withFileTypes:true}).filter(x=>x.isDirectory())){const file=path.join(assetRoot,category.name,entry.name,'asset.json');if(fs.existsSync(file))global.LWAssetDefinitions.push(JSON.parse(fs.readFileSync(file,'utf8')));}
const Assets=require('./asset-catalog.js');
test('Creature catalog loads every isolated definition folder',()=>{const folders=fs.readdirSync(creatureRoot,{withFileTypes:true}).filter(x=>x.isDirectory());assert.equal(Creatures.all().length,folders.length);for(const d of Creatures.all())assert(fs.existsSync(path.join(creatureRoot,d.id,'creature.json')),d.id);});
test('Creature definitions are immutable and executable-free',()=>{const forbidden=new Set(['script','callback','execute','eval','sourceCode','modulePath','handler','command']);const visit=(v,p)=>{if(Array.isArray(v))v.forEach((x,i)=>visit(x,p+'/'+i));else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){assert(!forbidden.has(k),p+'/'+k);visit(x,p+'/'+k);}};assert(Object.isFrozen(Creatures.all()));assert.throws(()=>Creatures.all().push({}),TypeError);for(const d of Creatures.all()){assert(Object.isFrozen(d));assert(Object.isFrozen(d.state.defaults));visit(d,d.id);}});
test('Adventure personality definitions cover the reusable creature profile set',()=>{for(const personality of Creatures.personalities)assert(Adventure.content.personalities.some(profile=>profile.id===personality),personality);});
test('Factory creates explicit deterministic archetype/personality identities',()=>{const founder=Factory.create({id:'c1',archetype:'sproutling',personality:'curious',mode:'founder',sequence:0,day:1,simTime:0}),arrival=Factory.create({id:'c2',archetype:'sproutling',personality:'maker',mode:'arrival',sequence:1,day:4,simTime:123});assert.equal(founder.archetype,'sproutling');assert.equal(founder.name,'Pip');assert.equal(founder.creature.x,8);assert.equal(founder.creature.coins,6);assert.equal(founder.rpg.rng,4631);assert.equal(arrival.archetype,'sproutling');assert.equal(arrival.name,'Fern');assert.equal(arrival.creature.x,17);assert.equal(arrival.creature.coins,0);assert.equal(arrival.rpg.rng,6544);assert.equal(arrival.learning.practiceDay,4);assert.equal(arrival.feelings.causes[0].time,123);assert.notEqual(founder.inventory,arrival.inventory);});
test('Creature ECS bindings are definition-driven authoritative references',()=>{const c=Factory.create({id:'c1',archetype:'sproutling',personality:'curious',mode:'founder',sequence:0,day:1,simTime:0}),runtime=ActorECS.create();runtime.sync([c]);for(const {type,field} of runtime.componentBindings(c))assert.equal(runtime.world.get(c.id,type),c[field]);assert.deepEqual(runtime.world.get(c.id,'Creature'),{archetype:'sproutling',personality:'curious'});});
test('Archetype identity and personality are independent validated contracts',()=>{assert(Creatures.supports('sproutling','curious'));assert(!Creatures.supports('sproutling','missing'));assert.throws(()=>Factory.create({id:'c9',archetype:'missing',personality:'curious',mode:'arrival',sequence:9,day:1,simTime:0}),/unsupported/);});
test('Every creature binding references an object-valued state component',()=>{for(const d of Creatures.all())for(const {type,field} of d.ecs.components){assert.equal(typeof d.state.defaults[field],'object',d.id+'/'+type);assert(d.state.defaults[field]&&!Array.isArray(d.state.defaults[field]),d.id+'/'+type);}});
test('Every persistent creature default has explicit actor ownership',()=>{for(const d of Creatures.all())assert.deepEqual([...d.state.personalFields].sort(),Object.keys(d.state.defaults).sort(),d.id);});
test('Current captured actors are fully covered by the creature-owned state contract',()=>{const fields=new Set(Creatures.personalFields);for(const file of ['littlewild.pack.json','emberworks.pack.json']){const pack=JSON.parse(fs.readFileSync(path.join(source,'content',file),'utf8'));for(const scene of pack.scenes)for(const c of scene.initialState.colony.creatures){assert.equal(c.archetype,'sproutling',file+'/'+c.id);for(const key of Object.keys(c))if(key!=='id')assert(fields.has(key),file+'/'+c.id+'/'+key);}}});
test('Every creature has complete data-authored visual profiles',()=>{for(const d of Creatures.all()){const actor=Assets.actor(d.visualAsset);assert(actor,d.id);for(const personality of d.personalities)assert(Object.hasOwn(actor.behaviors.appearances,personality),d.id+'/'+personality);for(const personality of d.personalities){const view=actor.behaviors.appearances[personality];assert(actor.models[view.model],personality+'/'+view.model);assert.equal(view.scale.length,3);assert(view.labelHeight>0&&view.contextHeight>0&&view.bubbleHeight>0);}}});
test('Actor animation and expression tuning are data and remain finite',()=>{for(const d of Creatures.all()){const actor=Assets.actor(d.visualAsset),animation=actor.behaviors.animation,expression=actor.behaviors.expression;for(const [key,value] of Object.entries(animation))assert(Number.isFinite(value),key);for(const [key,value] of Object.entries(expression)){assert(Number.isFinite(value),key);assert(value>=0&&value<=100,key);}}});
test('Presentation code uses explicit creature archetype identity',()=>{for(const file of ['ui.ts','colony-ui.ts','world-fidelity.ts','world-3d.ts']){const text=fs.readFileSync(path.join(source,file),'utf8');assert(!text.includes('forPersonality('),file);}const world=fs.readFileSync(path.join(source,'world-3d.ts'),'utf8');assert(world.includes('root.LWCreatures.defaultArchetype'));assert(world.includes('root.LWCreatures.defaultPersonality'));});
test('Recruitment and fidelity contain no hard-coded creature template or visual variant tables',()=>{const colony=fs.readFileSync(path.join(source,'colony.ts'),'utf8'),village=fs.readFileSync(path.join(source,'village-systems.ts'),'utf8'),fidelity=fs.readFileSync(path.join(source,'world-fidelity.ts'),'utf8'),renderer=fs.readFileSync(path.join(source,'asset-renderer.ts'),'utf8');assert(!colony.includes('decorateActor'));assert(!colony.includes("constructThrough('systems').s"));assert(!colony.includes("names = ['Pip'"));assert(!village.includes('eventInteractions||='));assert(!village.includes('interactionCooldowns||='));assert(!fidelity.includes('const swatches='));assert(!fidelity.includes("forPersonality("));assert(!fidelity.includes("'sproutling'"));assert(!fidelity.includes("'world-round'"));assert(!renderer.includes("id='sproutling'"));});
test('Creature catalog rejects nested schema drift, mismatched identity and invalid spawn modes',()=>{const raw=JSON.parse(fs.readFileSync(path.join(creatureRoot,'sproutling','creature.json'),'utf8')),bad=JSON.parse(JSON.stringify(raw));bad.movement.typo=1;assert.throws(()=>Creatures.validate(bad),/movement/);const identity=JSON.parse(JSON.stringify(raw));identity.state.defaults.archetype='other';assert.throws(()=>Creatures.validate(identity),/archetype/);const extra=JSON.parse(JSON.stringify(raw));extra.state.defaults.unowned={};assert.throws(()=>Creatures.validate(extra),/actor-scoped/);assert.throws(()=>Creatures.seed('sproutling','curious','sideways',0),/mode/);assert.throws(()=>Factory.create({id:'c9',archetype:'sproutling',personality:'curious',mode:'sideways',sequence:9,day:1,simTime:0}),/creation options/);});
test('Creature authoring schema is shipped beside the catalog',()=>{const schema=JSON.parse(fs.readFileSync(path.join(creatureRoot,'creature.schema.json'),'utf8'));assert.equal(schema.title,'Littlewild Creature Definition');assert.equal(schema.properties.format.const,'littlewild-creature');});
test('Creature data preflight rejects accessors, sparse lists and reserved keys without evaluating them',()=>{const raw=JSON.parse(fs.readFileSync(path.join(creatureRoot,'sproutling','creature.json'),'utf8'));let reads=0;const accessor={...raw};Object.defineProperty(accessor,'name',{enumerable:true,get(){reads++;return 'Accessor';}});assert.throws(()=>Creatures.validate(accessor),/non-JSON/);assert.equal(reads,0);const sparse=JSON.parse(JSON.stringify(raw));delete sparse.names[0];assert.throws(()=>Creatures.validate(sparse),/dense/);const unsafe=JSON.parse(JSON.stringify(raw));unsafe.state.defaults.memory=JSON.parse('{"__proto__":{"polluted":true}}');assert.throws(()=>Creatures.validate(unsafe),/reserved/);});
test('Spawn mode components satisfy their actual ECS system contracts',()=>{const raw=JSON.parse(fs.readFileSync(path.join(creatureRoot,'sproutling','creature.json'),'utf8'));for(const edit of[
 d=>d.state.modes.arrival.needs=null,d=>d.state.modes.founder.needs={food:'full'},
 d=>d.ecs.components.find(c=>c.type==='Needs').field='rpg',
 d=>d.ecs.components.push({type:'Creature',field:'rpg'})
 ]){const d=JSON.parse(JSON.stringify(raw));edit(d);assert.throws(()=>Creatures.validate(d),/component|Needs|transient/);}});
test('Factory rejects a coerced identity before reading or mutating actor state',()=>{let reads=0;const options={id:{toString(){reads++;return 'c9';}},archetype:'sproutling',personality:'curious',mode:'arrival',sequence:9,day:1,simTime:0};assert.throws(()=>Factory.create(options),/creation options/);assert.equal(reads,0);});
// Load untouched compiled modules in a fresh CommonJS realm with discovered manifests.
function realm(definitions,configuration,assets){
 const vm=require('node:vm'),context=vm.createContext({console,TextEncoder,TextDecoder}),cache=new Map();
 context.LWCreatureDefinitions=vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(definitions))+')',context);
 context.LWCreatureConfig=vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(configuration))+')',context);
 context.LWAssetDefinitions=vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(assets))+')',context);
 function load(file){
  const filename=path.resolve(__dirname,file);if(cache.has(filename))return cache.get(filename).exports;
  const module={exports:{}};cache.set(filename,module);
  if(filename.endsWith('.json'))module.exports=vm.runInContext('JSON.parse('+JSON.stringify(fs.readFileSync(filename,'utf8'))+')',context);
  else{const wrapper=vm.runInContext('(function(require,module,exports){'+fs.readFileSync(filename,'utf8')+'\n})',context);wrapper(id=>id.startsWith('.')?load(path.relative(__dirname,path.resolve(path.dirname(filename),id))):require(id),module,module.exports);}
  return module.exports;
 }
 return {context,load};
}
function authoredFixture(fn){
 const directory=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'littlewild-creature-'));
 try{
  fs.cpSync(assetRoot,path.join(directory,'assets'),{recursive:true});
  const d=JSON.parse(fs.readFileSync(path.join(creatureRoot,'sproutling','creature.json'),'utf8'));
  d.id='brookling';d.name='Brookling';d.names=['Ripple','Pebble'];d.defaultPersonality='maker';d.personalities=['maker'];d.state.defaults.archetype=d.id;d.state.defaults.personality='maker';
  d.rng={base:9123,stride:73};d.movement.baseSpeed=2;d.physiology.food=2;d.physiology.fatigue=.5;
  d.state.personalFields.push('habitat');d.state.defaults.habitat={waterAffinity:3};d.ecs.components.push({type:'Habitat',field:'habitat'});
  d.state.modes.arrival.creature.x=11;d.visualAsset='brookling';
  const folder=path.join(directory,'assets','creatures',d.id);fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder,'creature.json'),JSON.stringify(d));
  const a=JSON.parse(fs.readFileSync(path.join(creatureRoot,'sproutling','asset.json'),'utf8'));a.id=d.id;a.name='Brookling';a.materials.fur='#347f97';
  fs.writeFileSync(path.join(folder,'asset.json'),JSON.stringify(a));
  const discovery=require('./tools/bundled-assets.cjs');
  fn({directory,d,discovery,definitions:discovery.creatureDefinitions(directory),configuration:discovery.creatureConfig(directory),assets:discovery.assetDefinitions(directory)});
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
test('A second folder discovers, creates, simulates, renders, recruits and reloads without source branches',()=>authoredFixture(({definitions,configuration,assets,d})=>{
 const r=realm(definitions,configuration,assets),L=r.load('simulation.cjs'),catalog=r.context.LWCreatures,factory=r.context.LWCreatureFactory;
 assert.deepEqual(Array.from(catalog.all(),x=>x.id),['brookling','sproutling']);assert.equal(catalog.defaultArchetype,'sproutling');assert(Object.isFrozen(catalog.configuration));
 const c=factory.create({id:'c9',archetype:d.id,personality:'maker',mode:'arrival',sequence:1,day:3,simTime:40}),runtime=r.context.LWActorECS.create();
 assert.equal(c.name,'Pebble');assert.equal(c.creature.x,11);assert.equal(c.rpg.rng,9196);assert.equal(c.habitat.waterAffinity,3);
 runtime.sync([c]);assert.equal(runtime.world.get(c.id,'Habitat'),c.habitat);assert.equal(runtime.world.get(c.id,'Creature').archetype,d.id);
 const before=c.needs.food;runtime.step(c,.1,{day:3,socialPreference:0,loadLevel:0,hasShelter:false});assert(Math.abs(c.needs.food-(before-.1*runtime.rules.needs.foodIdle*2))<1e-12);
 r.load('asset-catalog.js');r.load('asset-renderer.js');r.load('world-fidelity.js');
 const vector=()=>({x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}}),node=parent=>{const n={children:[],position:vector(),rotation:vector(),scale:vector(),userData:{},visible:true,remove(child){this.children=this.children.filter(x=>x!==child);}};if(parent)parent.children.push(n);return n;};
 const kit={group:node,piece:parent=>node(parent)},rig=r.context.LWFidelity.create(kit,node(null),c);
 assert.equal(rig.instance.asset.id,d.id);assert.equal(rig.root.userData.fidelity,'creature:'+d.id);assert.equal(rig.instance.asset.materials.fur,'#347f97');
 const e=L.createWorldDemo();e.s.player.coins=10000;e.s.player.level=20;e.s.progression.slots=6;
 for(const b of e.s.buildings)if(r.context.LWGrowth.content.homes[b.kind])b.level=3;
 for(const research of r.context.LWGrowth.content.research){e.s.progression.research[research.id]=true;if(research.grants)e.s.progression.features[research.grants.feature]=Math.max(e.s.progression.features[research.grants.feature]||0,research.grants.rank);}
 const arrived=e.purchaseCreature('maker',d.id);assert(arrived.ok,arrived.reason);assert.equal(arrived.creature.archetype,d.id);
 const Story=r.load('story-codec.js'),reloaded=Story.commit(Story.inspect(Story.encode(e))),saved=reloaded.creatures.find(x=>x.id===arrived.creature.id);
 assert.equal(saved.archetype,d.id);assert.equal(saved.habitat.waterAffinity,3);assert.equal(reloaded.ecs.world.get(saved.id,'Habitat'),saved.habitat);
 assert(!Object.hasOwn(reloaded.creatures[0],'habitat'));assert(!Object.hasOwn(reloaded.export().state,'habitat'));
 e.s.started=reloaded.s.started=true;for(let i=0;i<30;i++){e.step(.1);reloaded.step(.1);}assert.equal(JSON.stringify(reloaded.export()),JSON.stringify(e.export()));
 const founder=realm(definitions,{...configuration,defaultArchetype:d.id},assets),New=founder.load('simulation.cjs');assert.equal(new New.Engine().actor.archetype,d.id);assert.equal(new New.Engine().actor.personality,'maker');
}));
test('Visual swaps select a reusable bundled asset while retaining gameplay identity',()=>authoredFixture(({directory,definitions,configuration,discovery})=>{
 definitions[0].visualAsset='sproutling';fs.writeFileSync(path.join(directory,'assets','creatures','brookling','creature.json'),JSON.stringify(definitions[0]));
 const r=realm(definitions,configuration,discovery.assetDefinitions(directory));r.load('simulation.cjs');r.load('asset-catalog.js');r.load('world-fidelity.js');
 assert.equal(r.context.LWCreatures.get('brookling').visualAsset,'sproutling');assert.equal(r.context.LWFidelity.mood({archetype:'brookling',personality:'maker',needs:{joy:100}}),'happy');
 definitions[0].visualAsset='missing';fs.writeFileSync(path.join(directory,'assets','creatures','brookling','creature.json'),JSON.stringify(definitions[0]));assert.throws(()=>discovery.assetDefinitions(directory),/visual asset/);
}));
test('Catalog configuration and top-level compensated sparse arrays fail closed',()=>{
 const defs=JSON.parse(fs.readFileSync(path.join(__dirname,'creature-definitions.json'),'utf8')),config=JSON.parse(fs.readFileSync(path.join(creatureRoot,'catalog.json'),'utf8'));
 for(const bad of [{...config,defaultArchetype:'missing'},{...config,typo:1}])assert.throws(()=>realm(defs,bad,[]).load('creature-catalog.js'),/catalog|default|configuration/);
 const vm=require('node:vm'),missing=vm.createContext({});vm.runInContext('LWCreatureDefinitions=JSON.parse('+JSON.stringify(JSON.stringify(defs))+')',missing);assert.throws(()=>vm.runInContext(fs.readFileSync(path.join(__dirname,'creature-catalog.js'),'utf8'),missing),/configuration/);
 const context=vm.createContext({});vm.runInContext('LWCreatureDefinitions=JSON.parse('+JSON.stringify(JSON.stringify(defs))+');LWCreatureConfig=JSON.parse('+JSON.stringify(JSON.stringify(config))+');delete LWCreatureDefinitions[0];LWCreatureDefinitions.extra={};',context);
 assert.throws(()=>vm.runInContext(fs.readFileSync(path.join(__dirname,'creature-catalog.js'),'utf8'),context),/dense/);
});
test('Creature tuning rejects unbound baseline components and invalid physiology or Unicode',()=>{
 const raw=JSON.parse(fs.readFileSync(path.join(creatureRoot,'sproutling','creature.json'),'utf8'));
 for(const edit of [d=>{d.state.personalFields.push('player');d.state.defaults.player={coins:0};},d=>d.physiology.food=-1,d=>d.physiology.extra=1,d=>d.description='\ud800',d=>{delete d.names[0];d.names.extra='Pip';},d=>{d.state.personalFields.push('otherNeeds');d.state.defaults.otherNeeds={...d.state.defaults.needs};d.ecs.components.find(x=>x.type==='Needs').field='otherNeeds';}]){const bad=JSON.parse(JSON.stringify(raw));edit(bad);assert.throws(()=>Creatures.validate(bad),/physiology|Unicode|dense|Needs|shared world/);}
});
test('Creature display strings count Unicode code points at schema limits',()=>{
 const raw=JSON.parse(fs.readFileSync(path.join(creatureRoot,'sproutling','creature.json'),'utf8'));
 raw.name='🐾'.repeat(80);raw.description='🍃'.repeat(500);raw.names=['🌱'.repeat(24)];assert.doesNotThrow(()=>Creatures.validate(raw));
 for(const key of ['name','description']){const bad=JSON.parse(JSON.stringify(raw));bad[key]+='🐾';assert.throws(()=>Creatures.validate(bad),/name|description/);}
 raw.names[0]+='🌱';assert.throws(()=>Creatures.validate(raw),/names/);
});
const passed=results.filter(r=>r.passed).length,report={passed,total:results.length,creatures:Creatures.all().length,results};fs.writeFileSync(__dirname+'/creature-catalog-results.json',JSON.stringify(report,null,2));console.log(passed+'/'+results.length);if(passed!==results.length)process.exitCode=1;
