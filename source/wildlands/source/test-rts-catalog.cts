/// <reference path="./rts-contracts.d.ts" />
// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
interface Result {name:string;passed:boolean;error?:string;}
const results:Result[]=[];
function test(name:string,work:()=>void):void {
 try {work();results.push({name,passed:true});}
 catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}
}
const catalog=require('./rts-catalog.js') as LWRTSData.CatalogApi;
const fresh=():LWRTSData.Catalog=>catalog.clone();
test('The exported default RTS catalog and editable clone satisfy the shipped authoring JSON schema',()=>{
 const ajv=new Ajv2020({strict:false,allErrors:true});
 const validate=ajv.compile(JSON.parse(fs.readFileSync(__dirname+'/content/rts.schema.json','utf8')));
 assert(validate(catalog.data),JSON.stringify(validate.errors));assert(validate(fresh()),JSON.stringify(validate.errors));
 const invalid=fresh() as unknown as Record<string,unknown>;invalid.script='alert(1)';assert.equal(validate(invalid),false);
});
test('RTS catalog publishes recursively frozen behavior-free content and detached editable copies',()=>{
 assert.equal(catalog.data.format,'wildlands-rts');
 for(const kind of ['units','buildings','resources','items','abilities','technologies','factions','terrain','missions'] as const){
  assert(catalog.all(kind).length>0,kind+' has no demonstration definitions');
  assert(Object.isFrozen(catalog.all(kind)));assert(Object.isFrozen(catalog.all(kind)[0]));
  assert.equal(catalog.get(kind,catalog.all(kind)[0]!.id),catalog.all(kind)[0]);
  assert.equal(catalog.get(kind,'not-present'),null);
 }
 const copy=fresh(),before=JSON.stringify(catalog.data);
 copy.units[0]!.name='Edited worker';
 assert.equal(JSON.stringify(catalog.data),before);assert.equal(catalog.validate(copy).units[0]!.name,'Edited worker');
});
test('Imported RTS data rejects executable values, unexpected fields and invalid identities',()=>{
 for(const value of [()=>{},NaN,Infinity,undefined,new Date()]){
  const data=fresh() as unknown as Record<string,unknown>;data.extension=value;
  assert.throws(()=>catalog.validate(data));
 }
 const data=fresh();(data.units[0] as unknown as Record<string,unknown>).script='throw Error(1)';
 assert.throws(()=>catalog.validate(data));
 for(const id of ['','bad id','__proto__']){const next=fresh();next.units[0]!.id=id;assert.throws(()=>catalog.validate(next));}
});
test('Imported getters, cycles, symbols and sparse arrays reject without running behavior',()=>{
 let reads=0;const data=fresh();
 Object.defineProperty(data,'units',{enumerable:true,get(){reads++;return [];}});
 assert.throws(()=>catalog.validate(data));assert.equal(reads,0);
 const nested=fresh();Object.defineProperty(nested.units[0]!,'name',{enumerable:true,get(){reads++;return 'Attack';}});
 assert.throws(()=>catalog.validate(nested));assert.equal(reads,0);
 const cyclic=fresh() as unknown as Record<string,unknown>;cyclic.self=cyclic;assert.throws(()=>catalog.validate(cyclic));
 const symbol=fresh();(symbol as unknown as Record<symbol,unknown>)[Symbol('hidden')]=1;assert.throws(()=>catalog.validate(symbol));
 const sparse=fresh();delete (sparse.units as unknown[])[0];assert.throws(()=>catalog.validate(sparse));
});
test('Catalog validation rejects duplicate IDs, unknown costs and broken references before publication',()=>{
 const mutations:((data:LWRTSData.Catalog)=>void)[]=[
  data=>{(data.units as LWRTSData.Unit[]).push({...data.units[0]!});},
  data=>{data.units[0]!.cost={missing:1};},
  data=>{data.buildings[0]!.produces=['missing'];},
  data=>{data.factions[0]!.units=['missing'];},
  data=>{data.missions[0]!.playerFaction='missing';},
  data=>{data.missions[0]!.defaultTerrain='missing';},
  data=>{data.technologies[0]!.prerequisites=['missing'];},
  data=>{data.items[0]!.ability='missing';}
 ];
 const before=JSON.stringify(catalog.data);
 for(const mutation of mutations){const data=fresh();mutation(data);assert.throws(()=>catalog.validate(data));}
 assert.equal(JSON.stringify(catalog.data),before);
});
test('RTS numeric rules reject negative costs, invalid movement, non-finite stats and out-of-map spawns',()=>{
 const mutations:((data:LWRTSData.Catalog)=>void)[]=[
  data=>{data.units[0]!.hp=0;},data=>{data.units[0]!.speed=Infinity;},
  data=>{data.units[0]!.population=-1;},
  data=>{data.units[0]!.cost={[data.resources[0]!.id]:-1};},
  data=>{data.units[0]!.movement='teleport' as LWRTSData.Movement;},
  data=>{data.missions[0]!.spawns[0]!.x=data.missions[0]!.width+10;},
  data=>{data.missions[0]!.width=0;}
 ];
 for(const mutation of mutations){const data=fresh();mutation(data);assert.throws(()=>catalog.validate(data));}
});
test('Mission admission rejects out-of-map footprints, incompatible movement terrain and overlapping structures',()=>{
 const mutations:((data:LWRTSData.Catalog)=>void)[]=[
  data=>{data.missions[0]!.spawns[0]!.x=0;},
  data=>{data.missions[0]!.spawns[1]!.archetype='gunboat';},
  data=>{(data.missions[0]!.spawns as LWRTSData.Spawn[]).push({...data.missions[0]!.spawns[0]!});}
 ];
 for(const mutation of mutations){const data=fresh();mutation(data);assert.throws(()=>catalog.validate(data));}
});
const passed=results.filter(row=>row.passed).length;
fs.writeFileSync(__dirname+'/rts-catalog-results.json',JSON.stringify({passed,total:results.length,results},null,2)+'\n');
console.log(`${passed}/${results.length} RTS catalog checks passed`);if(passed!==results.length)process.exitCode=1;
