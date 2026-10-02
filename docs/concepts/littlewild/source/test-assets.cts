'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'../source'),assetRoot=path.join(source,'assets'),results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error(name,error.message);}}
function load(){
 const defs=[];for(const category of fs.readdirSync(assetRoot,{withFileTypes:true}).filter(x=>x.isDirectory())){
  for(const entry of fs.readdirSync(path.join(assetRoot,category.name),{withFileTypes:true}).filter(x=>x.isDirectory())){
   const file=path.join(assetRoot,category.name,entry.name,'asset.json');if(fs.existsSync(file))defs.push(JSON.parse(fs.readFileSync(file,'utf8')));
  }
 }return defs;
}
global.LWAssetDefinitions=load();const A=require('./asset-catalog.js');
test('Asset catalog loads every isolated asset folder',()=>assert.equal(A.all().length,global.LWAssetDefinitions.length));
test('Asset identities are unique and folder aligned',()=>{const ids=new Set();for(const d of global.LWAssetDefinitions){const key=d.category+':'+d.id;assert(!ids.has(key),key);ids.add(key);const file=path.join(assetRoot,d.category+'s',d.id,'asset.json');assert(fs.existsSync(file),file);}});
test('Every gameplay building has a world model',()=>{const lib=JSON.parse(fs.readFileSync(path.join(source,'content','default-library.json')));for(const b of lib.components.buildings){assert(A.building(b.id),b.id);assert(A.hasModel('building',b.id,'world'),b.id);}});
test('Every gameplay item has a carry or world model',()=>{const lib=JSON.parse(fs.readFileSync(path.join(source,'content','default-library.json')));for(const i of lib.components.items){const a=A.item(i.id);assert(a,i.id);assert(a.models.carry||a.models.world,i.id);}});
test('Every equipment definition has an equipped model',()=>{const lib=JSON.parse(fs.readFileSync(path.join(source,'content','adventure-library.json')));for(const i of lib.equipment)assert(A.hasModel('item',i.id,'equipped'),i.id);});
test('Sproutling actor exposes animation rig and equipment sockets',()=>{const a=A.actor('sproutling');assert(a?.rig);for(const key of ['body','torso','head','ears','tail','feet','arms','eyes','brows','mouth','carry','care'])assert(a.rig[key],key);for(const key of ['head','body','back','feet','tool','charm','carry'])assert(a.behaviors.sockets[key],key);});
test('Visual asset JSON contains no executable-shaped fields',()=>{const forbidden=new Set(['script','callback','execute','eval','sourceCode','modulePath','handler','command']);function visit(v,p){if(Array.isArray(v))v.forEach((x,i)=>visit(x,p+'/'+i));else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){assert(!forbidden.has(k),p+'/'+k);visit(x,p+'/'+k);}}for(const d of global.LWAssetDefinitions)visit(d,d.category+':'+d.id);});
test('Asset definitions are immutable after catalog activation',()=>{const a=A.building('cottage');assert(Object.isFrozen(a));assert(Object.isFrozen(a.models.world.nodes));});
const passed=results.filter(r=>r.passed).length,report={passed,total:results.length,assets:A.all().length,results};fs.writeFileSync(__dirname+'/asset-catalog-results.json',JSON.stringify(report,null,2));console.log(passed+'/'+results.length);if(passed!==results.length)process.exitCode=1;
