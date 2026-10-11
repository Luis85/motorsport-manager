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
const actions=(session:any)=>player(session).actions as LWArmoredRuntime.VehicleActions;
function altered(mutate:(components:any,save:any)=>void,data=catalog()):any{
 const save=root.LWArmored.create(data).checkpoint();mutate(actor(save),save);return root.LWArmored.restore(save);
}
test('Action queries are detached and never advance ticks, sequences or persisted state',()=>{
 const session=prepared(),before=session.checkpoint();
 for(let index=0;index<10;index++){const view=actions(session);view.drive.available=false;view.repair.reason='mutated';session.query('axis');session.query('');}
 assert.deepEqual(session.checkpoint(),before);assert(actions(session).drive.available);
 assert.equal(session.command({kind:'aim',yaw:.1,elevation:0,sequence:1}).sequence,1);
 session.query();assert.equal(session.command({kind:'fire',pressed:false,sequence:2}).sequence,2);
 assert.equal(session.query().tick,0);
});
test('Driver and gunner losses expose independent station capabilities matching actual execution',()=>{
 const gunner=altered(a=>{a['armored-damage'].crew.gunner=0;root.LWArmoredCombat.refresh(a['armored-damage']);});
 assert(actions(gunner).drive.available);assert(!actions(gunner).aim.available);assert(!actions(gunner).fire.available);
 assert.equal(gunner.command({kind:'aim',yaw:.1,elevation:0}).message,actions(gunner).aim.reason);
 assert.equal(gunner.command({kind:'fire',pressed:true}).ok,false);assert(gunner.command({kind:'drive',throttle:1,brake:0}).ok);
 gunner.step(60);assert(player(gunner).transform.position.z>100.5);
 const driver=altered(a=>{a['armored-damage'].crew.driver=0;root.LWArmoredCombat.refresh(a['armored-damage']);});
 assert(!actions(driver).drive.available);assert(actions(driver).aim.available);assert(actions(driver).fire.available);
 assert(driver.command({kind:'aim',yaw:0,elevation:0}).ok);const ammo=player(driver).weapon.reserves.ap;
 assert(driver.command({kind:'fire',pressed:true}).ok);assert(driver.command({kind:'drive',throttle:1,brake:0}).ok);driver.step();
 assert.equal(player(driver).weapon.reserves.ap,ammo-1);assert.equal(player(driver).transform.position.z,100);
});
test('Fire readiness tracks real ammunition expenditure and reload completion without advancing on query',()=>{
 const session=root.LWArmored.create(catalog());assert(actions(session).fire.available);
 const ammo=player(session).weapon.reserves.ap;session.command({kind:'fire',pressed:true});session.step();session.command({kind:'fire',pressed:false});
 assert.equal(player(session).weapon.reserves.ap,ammo-1);assert.deepEqual(actions(session).fire,{available:false,reason:'Reloading.'});
 const before=session.checkpoint();for(let i=0;i<20;i++)actions(session);assert.deepEqual(session.checkpoint(),before);
 session.step(300);assert(actions(session).fire.available);
 const empty=altered(a=>{a['armored-weapon'].reserves.ap=0;});assert.deepEqual(actions(empty).fire,{available:false,reason:'Selected ammunition exhausted.'});
 assert(empty.command({kind:'fire',pressed:true}).ok);empty.step();assert.equal(player(empty).weapon.reserves.ap,0);assert.equal(empty.query().projectiles.length,0);
});
test('Repair readiness reports authoritative rejection reasons and reserves a funded kit until completion',()=>{
 for(const mutate of [(a:any)=>{},(a:any)=>{a['armored-damage'].components.engine=50;a['armored-damage'].repairKits=0;},(a:any)=>{a['armored-damage'].components.engine=50;a['armored-motor'].steer=.2;},(a:any)=>{a['armored-damage'].components.engine=50;a['armored-body'].yawVelocity=.1;}]){
  const session=altered(mutate),before=session.checkpoint(),ready=actions(session).repair;assert(!ready.available);
  assert.deepEqual(session.command({kind:'repair'}),{ok:false,message:ready.reason});assert.deepEqual(session.checkpoint(),before);
 }
 const session=altered(a=>{a['armored-damage'].components.engine=40;a['armored-damage'].repairKits=1;});
 assert(actions(session).repair.available);assert(session.command({kind:'repair'}).ok);assert(!actions(session).repair.available);assert(!actions(session).aim.available);
 assert.equal(player(session).damage.repairKits,1);session.step(299);assert.equal(player(session).damage.repairKits,1);session.step();
 assert.equal(player(session).damage.repairKits,0);assert.equal(player(session).damage.components.engine,90);assert(!actions(session).repair.available);
});
test('Resupply readiness shares rejection reasons and keeps active cancellation available without stock mutation',()=>{
 for(const mutate of [(a:any)=>{},(a:any)=>{a['armored-weapon'].reserves.ap=0;a['armored-transform'].position.x=140;},(a:any)=>{a['armored-weapon'].reserves.ap=0;a['armored-motor'].throttle=.4;}]){
  const session=altered(mutate),ready=actions(session).resupply,before=session.checkpoint();assert(!ready.available);
  assert.deepEqual(session.command({kind:'resupply'}),{ok:false,message:ready.reason});assert.deepEqual(session.checkpoint(),before);
 }
 const session=prepared(),stocks=depot(session.checkpoint());assert(actions(session).resupply.available);assert(session.command({kind:'resupply'}).ok);
 assert(actions(session).resupply.available);assert.equal(actions(session).resupply.reason,'');assert(!actions(session).repair.available);
 session.step(20);assert(session.command({kind:'resupply'}).ok);assert.equal(player(session).supply.remaining,0);assert.deepEqual(depot(session.checkpoint()),stocks);
});
test('Legacy action projection retains original aiming and movement policy while reporting unsupported supplies',()=>{
 const save=root.LWArmored.create(fixture()).checkpoint();save.solver='tracked-force-v1';delete save.navigation;for(const entity of save.entities)delete entity.components['armored-supply'];
 actor(save)['armored-damage'].crew.gunner=0;root.LWArmoredCombat.refresh(actor(save)['armored-damage']);
 const session=root.LWArmored.restore(save),before=session.checkpoint();assert(!actions(session).drive.available);assert(actions(session).aim.available);assert(!actions(session).fire.available);
 assert.deepEqual(session.checkpoint(),before);assert(!actions(session).resupply.available);
 assert.deepEqual(session.command({kind:'resupply'}),{ok:false,message:actions(session).resupply.reason});
 assert(session.command({kind:'aim',yaw:.2,elevation:0}).ok);assert.equal(session.checkpoint().solver,'tracked-force-v1');
});
test('Faction projections expose availability only for owned vehicles including visible opponents',()=>{
 const data=catalog();data.missions[0]!.spawns[1]!.position={x:100,y:0,z:180};const session=root.LWArmored.create(data);session.step(6);
 const allied=session.query(),enemy=allied.vehicles.find((v:any)=>v.id==='enemy');assert(enemy,'Enemy must actually be visible for this test');assert.equal(enemy.actions,undefined);
 assert(allied.vehicles.find((v:any)=>v.id==='player').actions);const axis=session.query('axis');
 assert(axis.vehicles.find((v:any)=>v.id==='enemy').actions);assert.equal(axis.vehicles.find((v:any)=>v.id==='player').actions,undefined);
 assert(session.query('').vehicles.every((v:any)=>v.actions));
});
test('Ended missions expose no available actions and reject intentions without sequence mutation',()=>{
 for(const status of ['victory','defeat']){
  const session=altered((_a,save)=>{actor(save,'armored-state')['armored-state'].status=status;}),before=session.checkpoint();
  for(const action of Object.values(actions(session)))assert.deepEqual(action,{available:false,reason:'Mission has ended.'});
  for(const command of [{kind:'drive',throttle:1},{kind:'aim',yaw:0,elevation:0},{kind:'fire',pressed:true},{kind:'repair'},{kind:'resupply'}])assert.deepEqual(session.command(command),{ok:false,message:'Mission has ended.'});
  assert.deepEqual(session.checkpoint(),before);
 }
});
fs.writeFileSync(__dirname+'/armored-actions-results.json',JSON.stringify({passed:results.length,total:results.length,results},null,2)+'\n');
console.log(results.length+'/'+results.length+' armored action checks passed');
