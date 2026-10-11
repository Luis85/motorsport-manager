import assert from 'node:assert/strict';
import fs from 'node:fs';
for(const file of ['ecs','armored-catalog','armored-physics-legacy','armored-collision','armored-physics','armored-combat','armored-logistics','armored-navigation','armored-ai','armored-missions','armored-checkpoint','armored-session'])require('./'+file+'.js');
const root=globalThis as any;
const results:{name:string;passed:boolean}[]=[];
function test(name:string,run:()=>void):void{run();results.push({name,passed:true});console.log('PASS '+name);}
function fixture():LWArmoredData.Catalog{
 const vehicle:LWArmoredData.Vehicle={id:'test-tank',name:'Test tank',asset:'test-tank',mass:30000,length:6,width:3,height:2.5,engineForce:110000,brakeForce:180000,maxSpeed:12,reverseSpeed:4,trackWidth:2.5,suspensionTravel:.4,groundClearance:.4,maxSlope:.5,rollingResistance:.015,turretSpeed:.7,elevationSpeed:.3,minElevation:-.2,maxElevation:.4,muzzleHeight:2,barrelLength:3,reloadSeconds:5,ammunition:['ap'],ammoCapacity:20,armor:{front:80,side:40,rear:30,roof:20},componentHealth:100,sightRange:250,aimSeconds:1,accuracy:0,repairKits:2,repairSeconds:5,repairRate:.5};
 return {format:'wildlands-armored-catalog',version:1,vehicles:[vehicle],ammunition:[{id:'ap',name:'AP',kind:'AP',velocity:600,mass:7,penetration:100,damage:80,drag:0,ricochetAngle:1.3,blastRadius:0,smokeSeconds:0}],surfaces:[{id:'ground',friction:.8,rollingResistance:.02}],missions:[{id:'test',name:'Test range',description:'Deterministic runtime test',playerFaction:'allies',seed:29,terrain:{width:65,depth:65,cellSize:8,heights:Array(65*65).fill(0),surface:'ground'},obstacles:[],spawns:[{id:'player',vehicle:'test-tank',faction:'allies',position:{x:100,y:0,z:100},yaw:0,player:true},{id:'enemy',vehicle:'test-tank',faction:'axis',position:{x:400,y:0,z:400},yaw:Math.PI,player:false}],objectives:[{id:'survive',name:'Survive',kind:'survive',target:'allies',position:{x:0,y:0,z:0},radius:0,required:10000}],timeLimit:10000}]};
}
function catalog():LWArmoredData.Catalog{
 const data=fixture();data.vehicles[0]!.ammunition.push('he');data.ammunition.push({...data.ammunition[0]!,id:'he',name:'HE',kind:'HE'});
 data.missions[0]!.supplies=[{id:'service',name:'Field supply',faction:'allies',position:{x:100,y:0,z:100},radius:12,ammunition:{ap:20,he:10},repairKits:4,transferSeconds:1}];
 return data;
}
const actor=(save:any,id='player')=>save.entities.find((e:any)=>e.id===id).components;
const depot=(save:any)=>actor(save,'depot:service')['armored-depot'];
function prepared(data=catalog()):any{
 const save=root.LWArmored.create(data).checkpoint();
 const a=actor(save);a['armored-weapon'].reserves={ap:0,he:5};a['armored-damage'].repairKits=0;
 return root.LWArmored.restore(save);
}
const player=(session:any)=>session.query('').vehicles.find((v:any)=>v.id==='player');
test('Supply catalog rejects unknown ammunition, fractional stock and reserved depot spawn identities',()=>{
 for(const mutate of [(d:any)=>d.missions[0].supplies[0].ammunition.missing=1,(d:any)=>d.missions[0].supplies[0].ammunition.ap=.5,(d:any)=>d.missions[0].supplies[0].repairKits=-1,(d:any)=>d.missions[0].supplies[0].transferSeconds=0,(d:any)=>d.missions[0].spawns[0].id='depot:service']){
  const data=catalog();mutate(data);assert.throws(()=>root.LWArmored.create(data));
 }
});
test('Depot projections are detached and reveal stocks only to their faction',()=>{
 const session=prepared(),before=session.checkpoint(),view=session.query();view.depots[0].ammunition.ap=999;view.vehicles[0].supply.remaining=99;
 assert.deepEqual(session.checkpoint(),before);assert.equal(session.query('axis').depots.length,0);
 assert(session.query('axis').vehicles.every((v:any)=>v.supply===undefined||v.faction==='axis'));
});
test('Out-of-range, foreign, moving and full resupply requests reject without mutation',()=>{
 const session=prepared(),initial=session.checkpoint();
 for(const mutate of [(s:any)=>actor(s)['armored-transform'].position.x=130,(s:any)=>actor(s)['armored-body'].velocity.z=1,(s:any)=>actor(s)['armored-motor'].steer=.1,(s:any)=>actor(s)['armored-weapon'].trigger=true,(s:any)=>actor(s)['armored-damage'].fire=1,(s:any)=>{actor(s)['armored-weapon'].reserves={ap:15,he:5};actor(s)['armored-damage'].repairKits=2;}]){
  const save=structuredClone(initial);mutate(save);const loaded=root.LWArmored.restore(save),before=loaded.checkpoint();
  assert.equal(loaded.command({kind:'resupply'}).ok,false);assert.deepEqual(loaded.checkpoint(),before);
 }
 assert.equal(session.command({kind:'resupply',entityId:'enemy'}).ok,false);assert.deepEqual(session.checkpoint(),initial);
});
test('Transfer waits for its duration and conserves finite ammunition and repair kits',()=>{
 const session=prepared();assert(session.command({kind:'ammo',ammo:'he'}).ok);assert(session.command({kind:'resupply'}).ok);
 session.step(59);assert.deepEqual(player(session).weapon.reserves,{ap:0,he:5});assert.equal(depot(session.checkpoint()).ammunition.he,10);
 session.step();assert.deepEqual(player(session).weapon.reserves,{ap:5,he:15});assert.equal(player(session).damage.repairKits,2);
 assert.deepEqual(depot(session.checkpoint()),{ammunition:{ap:15,he:0},repairKits:2});
 assert.equal(player(session).supply.remaining,0);assert.equal(session.query().events.filter((e:any)=>e.kind==='resupply-completed').length,1);
 session.step(120);assert.deepEqual(depot(session.checkpoint()),{ammunition:{ap:15,he:0},repairKits:2});
});
test('Explicit cancellation is accepted once and transfers no partial supplies',()=>{
 const session=prepared(),stocks=depot(session.checkpoint());session.command({kind:'resupply'});session.step(30);
 assert(session.command({kind:'resupply'}).ok);assert.equal(player(session).supply.remaining,0);session.step(90);
 assert.deepEqual(depot(session.checkpoint()),stocks);assert.deepEqual(player(session).weapon.reserves,{ap:0,he:5});
 assert.equal(session.query().events.filter((e:any)=>e.kind==='resupply-cancelled').length,1);
});
test('Movement and fire interrupt service without consuming depot stocks',()=>{
 for(const command of [{kind:'drive',throttle:1},{kind:'fire',pressed:true}]){
  const session=prepared(),stocks=depot(session.checkpoint());session.command({kind:'resupply'});session.step(10);
  session.command(command);session.step();assert.equal(player(session).supply.remaining,0);assert.deepEqual(depot(session.checkpoint()),stocks);
 }
});
test('Damage interrupts an active persisted service and repair cannot overlap it',()=>{
 const session=prepared();const damaged=session.checkpoint();actor(damaged)['armored-damage'].components.engine=80;actor(damaged)['armored-damage'].repairKits=1;
 const active=root.LWArmored.restore(damaged);active.command({kind:'resupply'});assert.equal(active.command({kind:'repair'}).ok,false);
 const save=active.checkpoint();actor(save)['armored-damage'].components.engine=70;const loaded=root.LWArmored.restore(save),stocks=depot(save);
 loaded.step();assert.equal(player(loaded).supply.remaining,0);assert.deepEqual(depot(loaded.checkpoint()),stocks);
 assert(loaded.query().events.some((e:any)=>e.kind==='resupply-cancelled'&&e.message.includes('Damage')));
});
test('Simultaneous depot service cannot duplicate stock across friendly vehicles',()=>{
 const data=catalog();data.missions[0]!.spawns.push({...data.missions[0]!.spawns[0]!,id:'wing',player:false,position:{x:108,y:0,z:100}});
 data.missions[0]!.supplies![0]!.ammunition={ap:3,he:0};data.missions[0]!.supplies![0]!.repairKits=1;
 const session=prepared(data),save=session.checkpoint();actor(save,'wing')['armored-weapon'].reserves={ap:0,he:5};actor(save,'wing')['armored-damage'].repairKits=0;
 const active=root.LWArmored.restore(save);assert(active.command({kind:'resupply'}).ok);assert(active.command({kind:'resupply',entityId:'wing'}).ok);active.step(60);
 const own=active.query().vehicles.filter((v:any)=>v.faction==='allies');assert.equal(own.reduce((n:number,v:any)=>n+v.weapon.reserves.ap,0),3);
 assert.equal(own.reduce((n:number,v:any)=>n+v.damage.repairKits,0),1);assert.deepEqual(depot(active.checkpoint()),{ammunition:{ap:0,he:0},repairKits:0});
 assert.equal(active.command({kind:'resupply'}).ok,false);
});
test('Active transfer checkpoint continuation is byte-identical and saves retain solver identity',()=>{
 const a=prepared();a.command({kind:'resupply'});a.step(23);const before=a.checkpoint(),b=root.LWArmored.restore(before);
 assert.equal(before.solver,'tracked-force-v2');assert.deepEqual(b.checkpoint(),before);a.step(60);b.step(60);assert.deepEqual(b.checkpoint(),a.checkpoint());
});
test('Checkpoint admission rejects missing, excess and corrupted depot stocks atomically',()=>{
 const session=prepared(),before=session.checkpoint();
 for(const mutate of [(s:any)=>s.entities=s.entities.filter((e:any)=>e.id!=='depot:service'),(s:any)=>depot(s).ammunition.ap=21,(s:any)=>depot(s).ammunition.ap=.5,(s:any)=>depot(s).ammunition.bad=0,(s:any)=>depot(s).repairKits=-1,(s:any)=>depot(s).extra=1]){
  const save=structuredClone(before);mutate(save);assert.throws(()=>root.LWArmored.restore(save));assert.deepEqual(session.checkpoint(),before);
 }
});
test('Checkpoint admission rejects orphaned and malformed in-progress service state',()=>{
 const session=prepared();session.command({kind:'resupply'});const before=session.checkpoint();
 for(const mutate of [(s:any)=>delete actor(s)['armored-supply'],(s:any)=>actor(s)['armored-supply'].remaining=2,(s:any)=>actor(s)['armored-supply'].remaining=0,(s:any)=>actor(s)['armored-supply'].depotId='missing',(s:any)=>actor(s)['armored-supply'].condition='[]',(s:any)=>actor(s)['armored-supply'].condition='null',(s:any)=>actor(s)['armored-supply'].condition='{"bad":true}']){
  const save=structuredClone(before);mutate(save);assert.throws(()=>root.LWArmored.restore(save));
 }
 assert.deepEqual(session.checkpoint(),before);
});
test('V2 checkpoint rejects unfunded repair commitments and overlapping depot service',()=>{
 const session=prepared(),before=session.checkpoint();
 for(const mutate of [(s:any)=>actor(s)['armored-damage'].repair=1/60,(s:any)=>{actor(s)['armored-damage'].repairKits=1;actor(s)['armored-damage'].repair=6;}]){
  const save=structuredClone(before);mutate(save);assert.throws(()=>root.LWArmored.restore(save));
 }
 session.command({kind:'resupply'});const active=session.checkpoint();actor(active)['armored-damage'].repairKits=1;actor(active)['armored-damage'].repair=.5;
 assert.throws(()=>root.LWArmored.restore(active));
});
test('Legacy checkpoints remain on their original solver without logistics topology migration',()=>{
 const save=root.LWArmored.create(fixture()).checkpoint();save.solver='tracked-force-v1';delete save.navigation;for(const e of save.entities)delete e.components['armored-supply'];
 const a=root.LWArmored.restore(save),b=root.LWArmored.restore(save);assert.deepEqual(a.checkpoint(),save);
 assert.equal(a.command({kind:'resupply'}).ok,false);assert.equal(a.query().depots,undefined);
 a.command({kind:'drive',throttle:.5});b.command({kind:'drive',throttle:.5});a.step(100);b.step(100);assert.deepEqual(a.checkpoint(),b.checkpoint());assert.equal(a.checkpoint().solver,'tracked-force-v1');
 // depot: was an admitted vehicle prefix before supplies existed; retain that legacy identity.
 save.catalog.missions[0].spawns[0].id='depot:legacy-player';actor(save,'armored-state')['armored-state'].controlled='depot:legacy-player';
 save.entities.find((e:any)=>e.id==='player').id='depot:legacy-player';save.entities.sort((a:any,b:any)=>a.id.localeCompare(b.id));
 assert.deepEqual(root.LWArmored.restore(save).checkpoint(),save);
});
fs.writeFileSync(__dirname+'/armored-logistics-results.json',JSON.stringify({passed:results.length,total:results.length,results},null,2)+'\n');
console.log(results.length+'/'+results.length+' armored logistics checks passed');
