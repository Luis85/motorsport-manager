'use strict';
// Tests run the composite showcase game: install its content profile before any engine module loads.
require('./test-support/install-games.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
// Engine-owned grammars stay in source/assets; Littlewild's definitions live in its game folder.
const source=path.resolve(__dirname,'../source'),schemaRoot=path.join(source,'assets'),assetRoot=path.join(require('./tools/game-folder.cjs').gameDirectory('littlewild'),'assets'),results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error(name,error.message);}}
function load(){return require('./tools/bundled-assets.cjs').assetDefinitions(require('./tools/definition-source.cjs').definitions(assetRoot));}
global.LWAssetDefinitions=load();const A=require('./asset-catalog.js');
/** A browser page loads the content provider (engine kernel) ahead of the asset catalog. */
const catalogScript=()=>fs.readFileSync(__dirname+'/content-provider.js','utf8')+'\n'+fs.readFileSync(__dirname+'/asset-catalog.js','utf8');
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
 vm.runInNewContext('globalThis.LWAssetDefinitions=JSON.parse('+JSON.stringify(json)+');\n'+catalogScript(),sandbox);
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
 const vm=require('node:vm'),base=global.LWAssetDefinitions.find(d=>d.id==='cottage'),code=catalogScript();
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
 const vm=require('node:vm'),base=global.LWAssetDefinitions.find(d=>d.id==='cottage'),code=catalogScript();
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
 const base=global.LWAssetDefinitions.find(d=>d.id==='cottage'),schema=JSON.parse(fs.readFileSync(path.join(schemaRoot,'asset.schema.json')));
 const Ajv=require('ajv/dist/2020').default,validate=new Ajv({strict:false}).compile(schema);
 for(const count of [120,121]){const d=JSON.parse(JSON.stringify(base));d.name='🌱'.repeat(count);assert.equal(validate(d),count===120);
  if(count===120)assert.equal(accepts([d]).building(d.id).name,d.name);else assert.throws(()=>accepts([d]),/invalid identity/);
 }
});

function bakedPet(){return {format:'littlewild-3d-asset',schemaVersion:1,category:'pet',id:'test-pet',name:'Test pet',materials:{skin:{color:'#f0c0b0',flatShading:false}},
 meshes:{tri:{positions:[0,0,0,1,0,0,0,1,0],normals:[0,0,1,0,0,1,0,0,1],indices:[0,1,2]}},
 models:{baby:{nodes:[{primitive:'group',id:'body',children:[{primitive:'mesh',id:'head',mesh:'tri',material:'skin'}]}]}},metadata:{radius:.5},rig:{baby:{body:'body',head:'head'}}};}
test('Pet assets accept bounded baked meshes and per-model rigs',()=>{
 const catalog=accepts([bakedPet()]);assert.equal(catalog.pet('test-pet').meshes.tri.indices.length,3);assert.equal(catalog.get('pet','test-pet').rig.baby.head,'head');
 for(const edit of[
  d=>d.models.baby.nodes[0].children[0].mesh='missing',d=>delete d.models.baby.nodes[0].children[0].mesh,
  d=>d.models.baby.nodes[0].mesh='tri',d=>d.meshes.tri.indices=[0,1,3],d=>d.meshes.tri.positions.push(1),
  d=>d.meshes.tri.normals=[0,0,1],d=>d.meshes.tri.positions[0]=Number.NaN,d=>d.meshes.tri.positions=Array(3*8193).fill(0),
  d=>d.rig.baby.head='missing',d=>d.rig.adult={head:'head'},d=>d.rig.baby.wings='body',d=>d.meshes['Bad id']=d.meshes.tri,
  d=>d.materials.skin.flatShading='yes',d=>{d.category='item';}
 ]){const d=bakedPet();edit(d);assert.throws(()=>accepts([d]),/3D asset:/);}
});
test('Generic asset renderer builds baked meshes once per immutable definition',()=>{
 const sandbox={};
 const vm=require('node:vm'),json=JSON.stringify([bakedPet()]);
 vm.runInNewContext('globalThis.LWAssetDefinitions=JSON.parse('+JSON.stringify(json)+');\n'+catalogScript()+'\n'+fs.readFileSync(__dirname+'/asset-renderer.js','utf8'),sandbox);
 let geometries=0;class Obj{constructor(){this.position={set(){}};this.rotation={set(){}};this.scale={set(){}};this.children=[];this.userData={};}add(c){this.children.push(c);}}
 class Mesh extends Obj{constructor(g,m){super();this.geometry=g;this.material=m;}}
 class BufferGeometry{constructor(){geometries++;this.attributes={};}setAttribute(k,v){this.attributes[k]=v;}setIndex(i){this.index=i;}computeVertexNormals(){}computeBoundingSphere(){}}
 const T={Mesh,BufferGeometry,Float32BufferAttribute:class{constructor(a,n){this.array=a;this.itemSize=n;}}};
 const kit={T,mat:(color,extra)=>({color,...extra}),group(parent){const g=new Obj();parent.add(g);return g;},piece(){throw Error('unexpected primitive');}};
 const definition=sandbox.LWAssets.pet('test-pet'),parent=new Obj();
 const first=sandbox.LWAssetRenderer.create(kit,parent,'pet','test-pet','baby'),second=sandbox.LWAssetRenderer.create(kit,parent,'pet','test-pet','baby');
 assert.equal(geometries,1);assert.equal(first.handles.get('head').geometry,second.handles.get('head').geometry);assert.equal(first.handles.get('head').material.flatShading,false);
 assert.equal(first.handles.get('head').geometry.attributes.normal.array.length,9);assert(definition);
 assert.throws(()=>sandbox.LWAssetRenderer.create({...kit,T:undefined},parent,'pet','test-pet','baby'),/cannot draw baked mesh/);
});

test('Physical material schema and runtime reject invalid surfaces without altering legacy data',()=>{
 const schema=JSON.parse(fs.readFileSync(path.join(schemaRoot,'asset.schema.json'))),Ajv=require('ajv/dist/2020').default,validate=new Ajv({strict:false}).compile(schema);
 const original=bakedPet(),surface={sheen:.8,sheenColor:'#eed5bb',sheenRoughness:.65,clearcoat:.2,clearcoatRoughness:.3};
 const authored=bakedPet();Object.assign(authored.materials.skin,surface);authored.models.baby.nodes[0].children[0].materialProps={clearcoat:1};
 assert(validate(authored),JSON.stringify(validate.errors));assert.equal(JSON.stringify(A.validate(authored)),JSON.stringify(authored));assert.equal(JSON.stringify(A.validate(original)),JSON.stringify(original));
 for(const [key,value] of [['sheen',1.01],['sheenRoughness',-.1],['clearcoat','1'],['clearcoatRoughness',2],['sheenColor','red']])for(const inline of [false,true]){
  const invalid=bakedPet();if(inline)invalid.models.baby.nodes[0].children[0].materialProps={[key]:value};else invalid.materials.skin[key]=value;
  assert.equal(validate(invalid),false,key);assert.throws(()=>A.validate(invalid),/3D asset:/,key);
 }
});
test('Physical surfaces survive appearance colors and instantiate actual Three materials',()=>{
 const vm=require('node:vm'),realm={};realm.window=realm;vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../vendor/three.js'),'utf8'),realm);
 const sandbox={};vm.runInNewContext('globalThis.LWAssetDefinitions=JSON.parse('+JSON.stringify(JSON.stringify([bakedPet()]))+');\n'+catalogScript()+'\n'+fs.readFileSync(__dirname+'/asset-renderer.js','utf8'),sandbox);
 const T=realm.THREE,R=sandbox.LWAssetRenderer,definition=sandbox.LWAssets.pet('test-pet'),input=JSON.parse(JSON.stringify(definition));
 input.materials.skin={color:'#998877',sheen:.8,sheenColor:'#ffeedd',sheenRoughness:.6,clearcoat:.5,clearcoatRoughness:.1};
 // Input must belong to the validator realm, which enforces plain JSON prototypes.
 sandbox.input=JSON.stringify(input);vm.runInNewContext('globalThis.authored=JSON.parse(input)',sandbox);
 const kit={T,mat:(color,extra)=>R.createMaterial(T,color,extra),group(parent){const g=new T.Group();parent.add(g);return g;}};
 const result=R.createFromDefinition(kit,new T.Group(),sandbox.authored,'baby',{materials:{skin:'#abcdef'}}),material=result.handles.get('head').material;
 assert.equal(material.isMeshPhysicalMaterial,true);assert.equal(material.sheen,.8);assert.equal(material.sheenRoughness,.6);assert.equal(material.clearcoat,.5);assert.equal(material.clearcoatRoughness,.1);assert.equal(material.color.getHexString(),'abcdef');assert.equal(material.sheenColor.getHexString(),'ffeedd');assert.equal(material.flatShading,false);
 const legacy=R.createMaterial(T,'#abcdef');assert.equal(legacy.isMeshStandardMaterial,true);assert.equal(legacy.isMeshPhysicalMaterial,undefined);assert.equal(legacy.roughness,.98);assert.equal(legacy.flatShading,true);
 assert.throws(()=>R.createMaterial({MeshStandardMaterial:T.MeshStandardMaterial},'#fff',{sheen:1}),/does not support authored physical/);
});
test('Baked geometry ownership isolates renderer lifetimes and releases once',()=>{
 const vm=require('node:vm'),sandbox={};vm.runInNewContext('globalThis.LWAssetDefinitions=JSON.parse('+JSON.stringify(JSON.stringify([bakedPet()]))+');\n'+catalogScript()+'\n'+fs.readFileSync(__dirname+'/asset-renderer.js','utf8'),sandbox);
 let disposed=0;class Obj{constructor(){this.position=this.rotation=this.scale={set(){}};this.userData={};}add(){}}
 class Mesh extends Obj{constructor(g){super();this.geometry=g;}}
 const T={Mesh,BufferGeometry:class{setAttribute(){}setIndex(){}computeBoundingSphere(){}dispose(){disposed++;}},Float32BufferAttribute:class{}};
 const kit=()=>({T,mat:()=>({}),group:()=>new Obj()}),a=kit(),b=kit(),R=sandbox.LWAssetRenderer,parent=new Obj();
 const first=R.create(a,parent,'pet','test-pet','baby'),second=R.create(b,parent,'pet','test-pet','baby');assert.notEqual(first.handles.get('head').geometry,second.handles.get('head').geometry);
 R.disposeKit(a);R.disposeKit(a);assert.equal(disposed,1);assert.equal(R.create(b,parent,'pet','test-pet','baby').handles.get('head').geometry,second.handles.get('head').geometry);
 R.disposeKit(b);assert.equal(disposed,2);assert.notEqual(R.create(a,parent,'pet','test-pet','baby').handles.get('head').geometry,first.handles.get('head').geometry);R.disposeKit(a);assert.equal(disposed,3);
 R.create(a,parent,'pet','test-pet','baby');const other=sandbox.LWAssets.validate(sandbox.LWAssets.pet('test-pet'));R.createFromDefinition(a,parent,other,'baby');let releases=0;assert.throws(()=>R.disposeKit(a,()=>{releases++;throw Error('release failed');}),/Baked geometry release failed/);assert.equal(releases,2);R.disposeKit(a);assert.equal(releases,2);
});

test('Portable surface metadata and authored UVs validate before rendering',()=>{
 const schema=JSON.parse(fs.readFileSync(path.join(schemaRoot,'asset.schema.json'))),Ajv=require('ajv/dist/2020').default,validate=new Ajv({strict:false}).compile(schema);
 const input=bakedPet();input.materials.skin.surface={kind:'fur',seed:17,scale:7,strength:.24};input.meshes.tri.uvs=[0,0,1,0,0,1];
 assert(validate(input));assert.deepEqual(A.validate(input).meshes.tri.uvs,input.meshes.tri.uvs);
 for(const edit of [d=>d.materials.skin.surface.version=0,d=>d.materials.skin.surface.version=3,d=>d.materials.skin.surface.version='2',d=>d.materials.skin.surface.kind='hair',d=>d.materials.skin.surface.kind=['fur'],d=>d.materials.skin.surface.seed=65536,d=>d.materials.skin.surface.seed=.1,d=>delete d.materials.skin.surface.scale,d=>d.materials.skin.surface.scale=0,d=>d.materials.skin.surface.strength=1.1,d=>d.materials.skin.surface.callback='code',d=>d.meshes.tri.uvs=[0,0,1,0,0],d=>d.meshes.tri.uvs[0]=Infinity]){
  const invalid=JSON.parse(JSON.stringify(input));edit(invalid);assert.throws(()=>A.validate(invalid),/3D asset:/);
 }
});
test('Portable surface pixels and PNGs replay exactly with bounded deterministic detail',()=>{
 const S=require('./asset-surface.js'),zlib=require('node:zlib'),crypto=require('node:crypto'),descriptor={kind:'fur',seed:17,scale:7,strength:.24};
 assert.equal(S.algorithmVersion,'littlewild-surface-v1');const first=S.generate(descriptor),second=S.generate(descriptor);assert.deepEqual(first,second);assert.equal(first.color.length,128*128*4);assert.equal(first.normal.length,first.color.length);
 const hashes=new Set();for(const kind of ['fur','cloth','leather']){const pixels=S.generate({...descriptor,kind});hashes.add(crypto.createHash('sha256').update(pixels.normal).digest('hex'));}assert.equal(hashes.size,3);
 assert.notDeepEqual(first.normal,S.generate({...descriptor,seed:18}).normal);assert.deepEqual(first.normal,S.generate({...descriptor,scale:8}).normal);
 const flat=S.generate({...descriptor,strength:0});assert(flat.color.every(v=>v===255));for(let i=0;i<flat.normal.length;i+=4)assert.deepEqual(Array.from(flat.normal.subarray(i,i+4)),[128,128,255,255]);
 const png=S.png(first.color,128,128);assert.deepEqual(png,S.png(first.color,128,128));const bytes=Buffer.from(png);assert.equal(bytes.subarray(1,4).toString(),'PNG');let cursor=8,idat;while(cursor<bytes.length){const size=bytes.readUInt32BE(cursor),name=bytes.subarray(cursor+4,cursor+8).toString();if(name==='IDAT')idat=bytes.subarray(cursor+8,cursor+8+size);cursor+=size+12;}const raw=zlib.inflateSync(idat);for(let y=0;y<128;y++){assert.equal(raw[y*513],0);assert.deepEqual(raw.subarray(y*513+1,(y+1)*513),Buffer.from(first.color.subarray(y*512,(y+1)*512)));}
 assert.throws(()=>S.generate({...descriptor,scale:17}),/bounded/);assert.throws(()=>S.png(new Uint8Array(4),129,1),/dimensions/);
 assert.deepEqual(S.sphereUVs([0,0,0]),[.5,.5]);assert(S.sphereUVs([1,0,0,0,1,0]).every(Number.isFinite));
});
test('Versioned fine surfaces retain legacy replay and deterministic directional detail',()=>{
 const S=require('./asset-surface.js'),hash=bytes=>require('node:crypto').createHash('sha256').update(bytes).digest('hex'),descriptor={kind:'fur',seed:17,scale:7,strength:.24};
 const legacy={fur:['b5c918c9d072c4ea01db5f318488a556c5eed0a0c2f6233d7315f76b82aba6ca','b3f742b99f620e4f3173804753fe7b36aaab9342b806f35e1f50c8b22bfbaa77'],cloth:['9ffab49e1637ce3afc481b06bb61f13e40abf1a28964ae0df1cc0cf8e6d2c33c','edf0a377811c26d6e817a2eeac060f3ee2ea1d605424c64acdf28a62ff066a2d'],leather:['a8b24f7455efb25802379d696bc6abf5e37fd201ce11153206c7cd9b12173e8c','9ad0c4b2490ac072cf49fcecb902b880e1b57839636e88cecf6ca95fc977b3ae']};
 const fineReplay={fur:['e91b82e28bc5864df98e0aa3ad2a4ecb0d4a7e41c8bd8d7e99ecbaabdb5eb4b3','5a4f1d18607642f6d290173bda1ecedf8f5505d0bcbe14b4cb8541e989b14061'],cloth:['400b9f2b9e3a80fb5a5e308cb09386eeb9135be0b0ea31f9b75158a5b1884108','f2551b69e90c99e600e99a9922004badf698086c1f48b6b3af5f2b691180706c'],leather:['055e1e8a6aa0523087ea7799c0294f4a1675c2dc09300ea9c2b15647e25bbb2a','b7d3851ead6eb4bd16d9884a32acd26f168b03e898377e3f301dcff7ea8b83c8']};
 for(const [kind,expected] of Object.entries(legacy)){
  const old={...descriptor,kind},v1=S.generate(old),next={...old,version:2},v2=S.generate(next);
  assert.deepEqual([hash(v1.normal),hash(v1.color)],expected);assert.deepEqual(S.generate({...old,version:1}),v1);
  assert.equal(S.key(old),S.key({...old,version:1}));assert.notEqual(S.key(old),S.key(next));assert.equal(S.algorithm(next),'littlewild-surface-v2');
  assert.deepEqual([hash(v2.normal),hash(v2.color)],fineReplay[kind]);assert.deepEqual(v2,S.generate(next));assert.notDeepEqual(v2.normal,v1.normal);assert.notDeepEqual(v2.normal,S.generate({...next,seed:18}).normal);
  const asset=bakedPet();asset.materials.skin.surface=next;assert.equal(A.validate(asset).materials.skin.surface.version,2);
 }
 const slopes=version=>{const p=S.generate({...descriptor,version,strength:.55}),n={x:0,y:0};for(let i=0;i<p.normal.length;i+=4){n.x+=(p.normal[i]-128)**2;n.y+=(p.normal[i+1]-128)**2;}return n;};
 const old=slopes(1),fine=slopes(2);assert(fine.x>fine.y*1.8,'Fur strands must retain directional relief');assert(fine.x+fine.y<(old.x+old.y)*.3,'Fine coat must reduce coarse normal relief');
 assert.throws(()=>S.generate({...descriptor,version:3}),/bounded/);
});
test('Portable surface textures share live ownership preserve UVs and release once',()=>{
 const vm=require('node:vm'),realm={};realm.window=realm;vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../vendor/three.js'),'utf8'),realm);
 const sandbox={};vm.runInNewContext('globalThis.LWAssetDefinitions=JSON.parse('+JSON.stringify(JSON.stringify([bakedPet()]))+');\n'+catalogScript()+'\n'+fs.readFileSync(__dirname+'/asset-surface.js','utf8')+'\n'+fs.readFileSync(__dirname+'/asset-renderer.js','utf8'),sandbox);
 const T=realm.THREE,R=sandbox.LWAssetRenderer,surface={kind:'fur',seed:17,scale:7,strength:.24};
 const fine=R.createMaterial(T,'#abcdef',{surface:{...surface,version:2}});assert.equal(fine.userData.surfaceAlgorithm,'littlewild-surface-v2');
 const first=R.createMaterial(T,'#abcdef',{surface});assert.notEqual(fine.map,first.map);fine.dispose();const second=R.createMaterial(T,'#123456',{surface});assert.equal(first.map,second.map);assert.equal(first.normalMap,second.normalMap);assert.equal(second.color.getHexString(),'123456');assert.equal(first.map.colorSpace,T.SRGBColorSpace);assert.equal(first.map.repeat.x,7);assert.equal(first.normalMap.image.data.length,128*128*4);
 let releases=0;first.map.addEventListener('dispose',()=>releases++);first.normalMap.addEventListener('dispose',()=>releases++);first.dispose();first.dispose();assert.equal(releases,0);second.dispose();assert.equal(releases,2);second.dispose();assert.equal(releases,2);const fresh=R.createMaterial(T,'#abcdef',{surface});assert.notEqual(fresh.map,first.map);fresh.dispose();
 const input=bakedPet();input.meshes.tri.uvs=[.1,.2,.3,.4,.5,.6];sandbox.serialized=JSON.stringify(input);vm.runInNewContext('globalThis.authored=JSON.parse(serialized)',sandbox);const kit={T,mat:(color,extra)=>R.createMaterial(T,color,extra),group(parent){const g=new T.Group();parent.add(g);return g;}};
 const made=R.createFromDefinition(kit,new T.Group(),sandbox.authored,'baby'),g=made.handles.get('head').geometry;assert.equal(g.getAttribute('uv').count,3);assert(Math.abs(g.getAttribute('uv').getX(0)-.1)<1e-6);R.disposeKit(kit);
});

test('Portable surface budgets reject atomically before any renderer allocation',()=>{
 const vm=require('node:vm'),realm={};realm.window=realm;vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../vendor/three.js'),'utf8'),realm);
 const sandbox={};vm.runInNewContext('globalThis.LWAssetDefinitions=JSON.parse('+JSON.stringify(JSON.stringify([bakedPet()]))+');\n'+catalogScript()+'\n'+fs.readFileSync(__dirname+'/asset-surface.js','utf8')+'\n'+fs.readFileSync(__dirname+'/asset-renderer.js','utf8'),sandbox);
 const T=realm.THREE,R=sandbox.LWAssetRenderer,parent=new T.Group(),owned=[];let allocations=0;
 const kit={T,mat:(color,extra)=>{allocations++;const m=R.createMaterial(T,color,extra);owned.push(m);return m;},group(parent){allocations++;const g=new T.Group();parent.add(g);return g;},piece(){allocations++;throw Error('Unexpected allocation');}};
 const surface=seed=>({kind:'fur',seed,scale:3,strength:.35}),input=bakedPet();input.materials.skin.surface=surface(0);
 for(let seed=1;seed<=256;seed++){input.materials['role'+seed]={color:'#abcdef',surface:surface(seed)};input.models.baby.nodes[0].children.push({primitive:'box',material:'role'+seed});}
 function authored(value){sandbox.serialized=JSON.stringify(value);vm.runInNewContext('globalThis.authored=JSON.parse(serialized)',sandbox);return sandbox.authored;}
 assert.throws(()=>R.createFromDefinition(kit,parent,authored(input),'baby'),/256 active/);assert.equal(parent.children.length,0);assert.equal(allocations,0);assert.equal(owned.length,0);
 // Existing live owners also count, while reusing their exact recipe remains allowed.
 const existing=Array.from({length:256},(_,seed)=>R.createMaterial(T,'#abcdef',{surface:surface(seed)}));let released=0;existing[0].map.addEventListener('dispose',()=>released++);
 const one=bakedPet();one.materials.skin.surface=surface(256);assert.throws(()=>R.createFromDefinition(kit,parent,authored(one),'baby'),/256 active/);assert.equal(parent.children.length,0);assert.equal(allocations,0);assert.equal(released,0);
 one.materials.skin.surface=surface(0);const made=R.createFromDefinition(kit,parent,authored(one),'baby');assert.equal(parent.children.length,1);assert.equal(made.handles.get('head').material.map,existing[0].map);
 for(const material of existing)material.dispose();assert.equal(released,0);for(const material of owned)material.dispose();assert.equal(released,1);R.disposeKit(kit);parent.remove(made.root);
});

const passed=results.filter(r=>r.passed).length,report={passed,total:results.length,assets:A.all().length,results};fs.writeFileSync(__dirname+'/asset-catalog-results.json',JSON.stringify(report,null,2));console.log(passed+'/'+results.length);if(passed!==results.length)process.exitCode=1;
