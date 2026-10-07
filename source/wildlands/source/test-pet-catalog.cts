// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// Catalog admission is exercised with the built pet asset bundle present, as in the browser.
require('./pet-catalog.js');
const root=globalThis as unknown as {LWPetCatalog:LWPetData.CatalogApi};
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});}}
type Mutable=Record<string,any>;
const base=():Mutable=>JSON.parse(JSON.stringify(root.LWPetCatalog.defaults)) as Mutable;
test('Default catalog is valid, frozen and detached from its source JSON',()=>{
 const catalog=root.LWPetCatalog.defaults;
 assert.equal(catalog.format,'wildlands-pet');assert(Object.isFrozen(catalog));assert(Object.isFrozen(catalog.actions[0]));
 assert.deepEqual(catalog.stages.map(s=>s.id),['egg','baby','teen','adult']);
 assert.deepEqual(catalog.species.map(s=>s.id),['mochi','pebble']);
});
test('Every species, stage model and scene prop resolves to a bundled Scene Forge pet asset',()=>{
 const assets=JSON.parse(fs.readFileSync(__dirname+'/pet-asset-definitions.json','utf8')) as {id:string;category:string;models:Record<string,unknown>;rig?:Record<string,unknown>;meshes?:unknown}[];
 const byId=new Map(assets.map(a=>[a.id,a]));
 for(const species of root.LWPetCatalog.defaults.species){
  const asset=byId.get(species.asset)!;assert(asset,species.asset);assert.equal(asset.category,'pet');assert(asset.meshes,'Scene Forge bakes organic meshes');
  for(const stage of root.LWPetCatalog.defaults.stages)for(const form of stage.models){assert(asset.models[form.model],species.id+'/'+form.model);assert(asset.rig?.[form.model],'rig for '+form.model);}
 }
 const scene=root.LWPetCatalog.defaults.scene;
 for(const id of [scene.room,scene.bed,scene.mess,scene.sparkle,...root.LWPetCatalog.defaults.actions.map(a=>a.prop)])assert(byId.get(id)?.models.world,id);
});
test('Validation rejects malformed, unknown and executable-shaped data before use',()=>{
 const edits:((c:Mutable)=>void)[]=[
  c=>{c.format='other';},c=>{c.rules.minutesPerSecond=0;},c=>{c.rules.maxMesses=1.5;},c=>{c.needs.pop();},c=>{c.needs[0].id='thirst';},
  c=>{c.species[0].asset='missing-asset';},c=>{c.stages.reverse();},c=>{c.stages[3].models[1].maxMistakes=10;},c=>{c.stages[1].models[0].model='no-such-model';},
  c=>{c.actions[0].kind='teleport';},c=>{c.actions[0].effects.mana=5;},c=>{c.actions[0].effects.hunger=500;},c=>{c.actions[0].stages=['larva'];},
  c=>{c.actions[1].id=c.actions[0].id;},c=>{c.actions[0].prop='pet-missing';},c=>{c.scene.messSpots=[];},c=>{c.scene.pet.x=9;},
  c=>{c.actions[0].script='run()';},c=>{c.species[0].name='';}
 ];
 for(const [index,edit] of edits.entries()){const c=base();edit(c);assert.throws(()=>root.LWPetCatalog.validate(c),/Pet catalog:/,'edit '+index);}
});
test('Validation returns an independent frozen copy',()=>{
 const input=base(),result=root.LWPetCatalog.validate(input);input.name='Changed';
 assert.equal(result.name,'Pocket Pet');assert.throws(()=>{(result as Mutable).name='x';},TypeError);
});
const passed=results.filter(r=>r.passed).length;fs.writeFileSync(__dirname+'/pet-catalog-results.json',JSON.stringify({passed,total:results.length,results},null,2));
for(const r of results)if(!r.passed)console.error(r.name,r.error);console.log(passed+'/'+results.length);if(passed!==results.length)process.exitCode=1;
