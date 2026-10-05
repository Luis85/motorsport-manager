'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'../source'),assetRoot=path.join(source,'assets'),results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error(name,error.message);}}
function load(){return require('./tools/bundled-assets.cjs').assetDefinitions(source);}
global.LWAssetDefinitions=load();const A=require('./asset-catalog.js');
test('Asset catalog loads every isolated asset folder',()=>assert.equal(A.all().length,global.LWAssetDefinitions.length));
test('Asset identities are unique and folder aligned',()=>{const ids=new Set();for(const d of global.LWAssetDefinitions){const key=d.category+':'+d.id;assert(!ids.has(key),key);ids.add(key);const file=path.join(assetRoot,d.category==='actor'?'creatures':d.category+'s',d.id,'definition.json');assert(fs.existsSync(file),file);}});
test('Every gameplay building has a world model',()=>{const lib=JSON.parse(fs.readFileSync(path.join(__dirname,'content','default-library.json')));for(const b of lib.components.buildings){assert(A.building(b.id),b.id);assert(A.hasModel('building',b.id,'world'),b.id);}});
test('Every gameplay item has a carry or world model',()=>{const lib=JSON.parse(fs.readFileSync(path.join(__dirname,'content','default-library.json')));for(const i of lib.components.items){const a=A.item(i.id);assert(a,i.id);assert(a.models.carry||a.models.world,i.id);}});
test('Every equipment definition has an equipped model',()=>{const lib=JSON.parse(fs.readFileSync(path.join(__dirname,'content','adventure-library.json')));for(const i of lib.equipment)assert(A.hasModel('item',i.id,'equipped'),i.id);});
test('Sproutling actor exposes animation rig and equipment sockets',()=>{const a=A.actor('sproutling');assert(a?.rig);for(const key of ['body','torso','head','ears','tail','feet','arms','eyes','brows','mouth','carry','care'])assert(a.rig[key],key);for(const key of ['head','body','back','feet','tool','charm','carry'])assert(a.behaviors.sockets[key],key);});
test('Visual asset JSON contains no executable-shaped fields',()=>{const forbidden=new Set(['script','callback','execute','eval','sourceCode','modulePath','handler','command']);function visit(v,p){if(Array.isArray(v))v.forEach((x,i)=>visit(x,p+'/'+i));else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){assert(!forbidden.has(k),p+'/'+k);visit(x,p+'/'+k);}}for(const d of global.LWAssetDefinitions)visit(d,d.category+':'+d.id);});
test('Asset definitions are immutable after catalog activation',()=>{const a=A.building('cottage');assert(Object.isFrozen(a));assert(Object.isFrozen(a.models.world.nodes));});
test('Catalog enumeration cannot diverge from indexed assets or revision',()=>{const count=A.all().length,revision=A.revision,first=A.all()[0];assert(Object.isFrozen(A.all()));assert.throws(()=>A.all().pop(),TypeError);assert.throws(()=>A.all()[0]={},TypeError);assert.equal(A.all().length,count);assert.equal(A.get(first.category,first.id),first);assert.equal(A.revision,revision);});
function accepts(definition){
 // A separate realm exercises catalog startup without mutating the active catalog.
 const vm=require('node:vm'),sandbox={LWAssetDefinitions:definition};
 const json=JSON.stringify(definition);
 vm.runInNewContext('globalThis.LWAssetDefinitions=JSON.parse('+JSON.stringify(json)+');\n'+fs.readFileSync(__dirname+'/asset-catalog.js','utf8'),sandbox);
 return sandbox.LWAssets;
}
test('Catalog rejects malformed renderer data before model construction',()=>{const base=global.LWAssetDefinitions.find(d=>d.id==='cottage'),clone=()=>JSON.parse(JSON.stringify(base));assert.equal(accepts([base]).building('cottage').id,'cottage');for(const edit of[
 d=>d.models.world.nodes[0].callback='run',d=>d.models.world.nodes[0].visible='yes',
 d=>d.materials[Object.keys(d.materials)[0]]='url(https://example.com)',
 d=>d.materials[Object.keys(d.materials)[0]]={color:'#ffffff',opacity:2},
 d=>d.behaviors.door.openDelta='wide',d=>d.behaviors.rotors={},d=>d.behaviors.smoke=false,
 d=>d.metadata.radius=-1,d=>d.models.world.script='run',d=>d.typo=true
 ]){const d=clone();edit(d);assert.throws(()=>accepts([d]),/3D asset:/);}});
test('Every selected actor appearance has the rig shape required by animation',()=>{const base=global.LWAssetDefinitions.find(d=>d.category==='actor');for(const edit of[
 d=>d.rig.ears=d.rig.ears[0],d=>d.behaviors.sockets.feet=d.behaviors.sockets.feet[0],
 d=>{d.models.preview={nodes:[]};d.behaviors.appearances.curious.model='preview';}
 ]){const d=JSON.parse(JSON.stringify(base));edit(d);assert.throws(()=>accepts([d]),/rig|socket/);}});
test('Asset data preflight rejects getters, cycles, sparse lists and reserved keys',()=>{
 const vm=require('node:vm'),base=global.LWAssetDefinitions.find(d=>d.id==='cottage'),code=fs.readFileSync(__dirname+'/asset-catalog.js','utf8');
 for(const setup of [
  'Object.defineProperty(d,"name",{enumerable:true,get(){globalThis.reads++;return "Changed";}});',
  'd.models.world.nodes.push(d.models.world.nodes);',
  'delete d.models.world.nodes[0];',
  'd.metadata=JSON.parse(\'{"__proto__":{}}\');'
 ]){
  const sandbox={reads:0},script='const d=JSON.parse('+JSON.stringify(JSON.stringify(base))+');'+setup+'globalThis.LWAssetDefinitions=[d];'+code;
  assert.throws(()=>vm.runInNewContext(script,sandbox),/3D asset:/);assert.equal(sandbox.reads,0);
 }
});
test('Public validation returns detached immutable data without registering assets or executing input',()=>{
 const base=JSON.parse(JSON.stringify(global.LWAssetDefinitions.find(d=>d.id==='cottage'))),before=JSON.stringify(A.all()),revision=A.revision;
 base.id='toolbox-cottage';const expected=JSON.stringify(base),validated=A.validate(base);
 assert.equal(JSON.stringify(validated),expected);assert(Object.isFrozen(validated));assert(Object.isFrozen(validated.models.world.nodes));
 base.name='Later edit';base.models.world.nodes.pop();assert.equal(JSON.stringify(validated),expected);assert.equal(A.building('toolbox-cottage'),null);
 for(const edit of [
  d=>d.models.world.nodes[0].position=[0,NaN,0],
  d=>{const position=Array(3);position.a=0;position.b=0;position.c=0;d.models.world.nodes[0].position=position;},
  d=>d.callback=()=>true
 ]){const invalid=JSON.parse(expected);edit(invalid);assert.throws(()=>A.validate(invalid),/3D asset:/);}
 let reads=0;const accessor=JSON.parse(expected);Object.defineProperty(accessor,'name',{enumerable:true,get(){reads++;return 'Injected';}});
 assert.throws(()=>A.validate(accessor),/3D asset:/);assert.equal(reads,0);assert.equal(A.revision,revision);assert.equal(JSON.stringify(A.all()),before);
});
test('Catalog rejects substituted array indexes and malformed own properties without publishing',()=>{
 const vm=require('node:vm'),base=global.LWAssetDefinitions.find(d=>d.id==='cottage'),code=fs.readFileSync(__dirname+'/asset-catalog.js','utf8');
 const setups=[
  'd.models.world.nodes[0].position=Array(3);d.models.world.nodes[0].position.a=0;d.models.world.nodes[0].position.b=0;d.models.world.nodes[0].position.c=0;',
  'const nodes=d.models.world.nodes;delete nodes[0];nodes.substitute={primitive:"group"};',
  'd.models.world.nodes.extra={primitive:"group"};',
  'Object.defineProperty(d.models.world.nodes,"0",{enumerable:true,get(){globalThis.reads++;return {};}});',
  'Object.defineProperty(d.models.world.nodes,"0",{value:d.models.world.nodes[0],enumerable:false});',
  'const defs=globalThis.LWAssetDefinitions;delete defs[0];defs.substitute=d;',
  'globalThis.LWAssetDefinitions.extra=d;',
  'Object.defineProperty(globalThis.LWAssetDefinitions,"0",{enumerable:true,get(){globalThis.reads++;return d;}});',
  'Object.defineProperty(globalThis.LWAssetDefinitions,"0",{value:d,enumerable:false});',
  'globalThis.LWAssetDefinitions[Symbol("asset")]=d;'
 ];
 for(const setup of setups){
  const sandbox={reads:0},script='const d=JSON.parse('+JSON.stringify(JSON.stringify(base))+');globalThis.LWAssetDefinitions=[d];'+setup+code;
  assert.throws(()=>vm.runInNewContext(script,sandbox),/3D asset:/);assert.equal(sandbox.reads,0);assert.equal(sandbox.LWAssets,undefined);
 }
 assert.equal(A.get(base.category,base.id).id,base.id);
});
test('Asset identity text accepts Unicode at the schema limit and rejects beyond it',()=>{
 const base=global.LWAssetDefinitions.find(d=>d.id==='cottage'),schema=JSON.parse(fs.readFileSync(path.join(assetRoot,'asset.schema.json')));
 const Ajv=require('ajv/dist/2020').default,validate=new Ajv({strict:false}).compile(schema);
 for(const count of [120,121]){const d=JSON.parse(JSON.stringify(base));d.name='🌱'.repeat(count);assert.equal(validate(d),count===120);
  if(count===120)assert.equal(accepts([d]).building(d.id).name,d.name);else assert.throws(()=>accepts([d]),/invalid identity/);
 }
});

const passed=results.filter(r=>r.passed).length,report={passed,total:results.length,assets:A.all().length,results};fs.writeFileSync(__dirname+'/asset-catalog-results.json',JSON.stringify(report,null,2));console.log(passed+'/'+results.length);if(passed!==results.length)process.exitCode=1;
