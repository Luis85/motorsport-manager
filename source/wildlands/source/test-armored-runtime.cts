import assert from 'node:assert/strict';
import fs from 'node:fs';
for(const file of ['ecs','armored-catalog','armored-physics','armored-combat','armored-ai','armored-missions','armored-checkpoint','armored-session','armored-application'])require('./'+file+'.js');
const root=globalThis as any;
const results:{name:string;passed:boolean}[]=[];
function test(name:string,run:()=>void):void{run();results.push({name,passed:true});console.log('PASS '+name);}
function fixture():LWArmoredData.Catalog{
 const vehicle:LWArmoredData.Vehicle={id:'test-tank',name:'Test tank',asset:'test-tank',mass:30000,length:6,width:3,height:2.5,engineForce:110000,brakeForce:180000,maxSpeed:12,reverseSpeed:4,trackWidth:2.5,suspensionTravel:.4,groundClearance:.4,maxSlope:.5,rollingResistance:.015,turretSpeed:.7,elevationSpeed:.3,minElevation:-.2,maxElevation:.4,muzzleHeight:2,barrelLength:3,reloadSeconds:5,ammunition:['ap'],ammoCapacity:20,armor:{front:80,side:40,rear:30,roof:20},componentHealth:100,sightRange:250,aimSeconds:1,accuracy:0,repairKits:2,repairSeconds:5,repairRate:.5};
 return {format:'wildlands-armored-catalog',version:1,vehicles:[vehicle],ammunition:[{id:'ap',name:'AP',kind:'AP',velocity:600,mass:7,penetration:100,damage:80,drag:0,ricochetAngle:1.3,blastRadius:0,smokeSeconds:0}],surfaces:[{id:'ground',friction:.8,rollingResistance:.02}],missions:[{id:'test',name:'Test range',description:'Deterministic runtime test',playerFaction:'allies',seed:29,terrain:{width:65,depth:65,cellSize:8,heights:Array(65*65).fill(0),surface:'ground'},obstacles:[],spawns:[{id:'player',vehicle:'test-tank',faction:'allies',position:{x:100,y:0,z:100},yaw:0,player:true},{id:'enemy',vehicle:'test-tank',faction:'axis',position:{x:400,y:0,z:400},yaw:Math.PI,player:false}],objectives:[{id:'survive',name:'Survive',kind:'survive',target:'allies',position:{x:0,y:0,z:0},radius:0,required:10000}],timeLimit:10000}]};
}
function player(session:any):LWArmoredRuntime.VehicleView{return session.query('').vehicles.find((v:any)=>v.id==='player');}
test('Armored queries and detached edits do not tick or mutate authority',()=>{
 const session=root.LWArmored.create(fixture()),before=session.checkpoint(),view=session.query();
 view.vehicles[0].transform.position.x=-50;view.vehicles[0].weapon.reserves.ap=0;
 for(let i=0;i<10;i++)session.query();assert.deepEqual(session.checkpoint(),before);assert.equal(session.query().tick,0);
});
test('Fresh LOS hides stale contact transforms and enemy entity events without ticking',()=>{
 const data=fixture();data.missions[0]!.spawns[1]!.position={x:100,y:0,z:180};data.missions[0]!.obstacles=[{id:'wall',position:{x:200,y:0,z:200},size:{x:5,y:5,z:1},material:'stone',destructible:true,health:100}];const session=root.LWArmored.create(data);session.step(6);
 assert(session.query().vehicles.some((v:any)=>v.id==='enemy'));const saved=session.checkpoint();
 saved.entities.find((e:any)=>e.id==='enemy').components['armored-transform'].position={x:400,y:.4,z:400};
 saved.events.push({kind:'shot',tick:6,entityId:'enemy',position:{x:400,y:2,z:400}},{kind:'obstacle-destroyed',tick:6,source:'player',entityId:'obstacle:wall'},{kind:'impact',tick:6,source:'player',target:'terrain'});
 const restored=root.LWArmored.restore(saved),before=restored.checkpoint(),view=restored.query();
 assert(!view.vehicles.some((v:any)=>v.id==='enemy'));assert(!view.events.some((e:any)=>e.entityId==='enemy'));assert(view.events.some((e:any)=>e.kind==='obstacle-destroyed'));assert(view.events.some((e:any)=>e.target==='terrain'));assert.deepEqual(restored.checkpoint(),before);
});
test('Differential tracks produce force and yaw while equal forces translate forward',()=>{
 const straight=root.LWArmored.create(fixture());assert(straight.command({kind:'drive',throttle:1,steer:0}).ok);straight.step(120);
 const s=player(straight);assert(s.transform.position.z>103);assert(Math.abs(s.transform.yaw)<1e-10);assert.equal(s.body.leftForce,s.body.rightForce);
 const turn=root.LWArmored.create(fixture());turn.command({kind:'drive',throttle:0,steer:1});turn.step(30);
 const t=player(turn);assert(t.body.leftForce>0&&t.body.rightForce<0);assert(t.transform.yaw>0);assert(t.body.contacts===6);
});
test('Braking, reverse and obstacle collision obey the physical transform owner',()=>{
 const data=fixture();data.missions[0]!.obstacles=[{id:'wall',position:{x:100,y:0,z:120},size:{x:40,y:5,z:2},material:'stone',destructible:false,health:100}];
 const session=root.LWArmored.create(data);session.command({kind:'drive',throttle:1});session.step(600);
 assert(player(session).transform.position.z<=117.50001);session.command({kind:'drive',throttle:-1});session.step(180);assert(player(session).transform.position.z<117);
 session.command({kind:'drive',throttle:0,brake:1});session.step(120);assert(Math.hypot(player(session).body.velocity.x,player(session).body.velocity.z)<.01);
});
test('Malformed, stale and foreign commands leave checkpoints byte-identical',()=>{
 const session=root.LWArmored.create(fixture());const before=JSON.stringify(session.checkpoint());
 for(const command of [{kind:'drive',throttle:NaN},{kind:'drive',steer:2},{kind:'drive',sequence:2,throttle:1},{kind:'drive',entityId:'enemy',throttle:1},{kind:'order',entityIds:['player','enemy'],order:'charge',position:{x:150,y:0,z:150}},{kind:'drive',throttle:1,typo:true}])assert.equal(session.command(command).ok,false);
 assert.equal(JSON.stringify(session.checkpoint()),before);assert(session.command({kind:'drive',sequence:1,throttle:1}).ok);assert.equal(session.command({kind:'drive',sequence:1,throttle:0}).ok,false);
});
test('Restore retains RNG, sequence, motor velocity and in-flight shell reconstruction',()=>{
 const a=root.LWArmored.create(fixture());a.command({kind:'drive',throttle:.5,steer:.1});a.command({kind:'fire',pressed:true});a.step(1);a.command({kind:'fire',pressed:false});
 assert(a.query('').projectiles.length>0);const saved=a.checkpoint(),b=root.LWArmored.restore(saved);assert.deepEqual(b.checkpoint(),saved);
 a.step(90);b.step(90);assert.deepEqual(b.checkpoint(),a.checkpoint());
});
test('Checkpoint rejects corrupt velocities, missing components and excess ammunition',()=>{
 const session=root.LWArmored.create(fixture()),before=session.checkpoint();
 for(const mutate of [(s:any)=>s.entities.find((e:any)=>e.id==='player').components['armored-body'].velocity.x=NaN,(s:any)=>delete s.entities.find((e:any)=>e.id==='player').components['armored-weapon'],(s:any)=>s.entities.find((e:any)=>e.id==='player').components['armored-weapon'].reserves.ap=10000]){
  const save=structuredClone(before);mutate(save);assert.throws(()=>root.LWArmored.restore(save));assert.deepEqual(session.checkpoint(),before);
 }
});
test('Checkpoint rejects incomplete combat records, mixed components and invalid AI working state',()=>{
 const session=root.LWArmored.create(fixture());session.command({kind:'fire',pressed:true});session.step();const before=session.checkpoint();
 const actor=(s:any)=>s.entities.find((e:any)=>e.id==='player').components;
 const shell=(s:any)=>s.entities.find((e:any)=>e.id.startsWith('shell:'));
 for(const mutate of [(s:any)=>actor(s)['armored-damage'].components={},(s:any)=>actor(s)['armored-damage'].crew={},(s:any)=>actor(s)['armored-weapon'].reserves={},(s:any)=>actor(s)['armored-projectile']=shell(s).components['armored-projectile'],(s:any)=>actor(s)['armored-order'].path=[null],(s:any)=>actor(s)['armored-perception'].visible=['missing'],(s:any)=>Object.assign(actor(s)['armored-order'],{kind:'follow',targetId:'enemy'}),(s:any)=>s.entities.find((e:any)=>e.id==='armored-state').components['armored-state'].serial=0,(s:any)=>s.entities.find((e:any)=>e.id==='armored-state').components['armored-state'].objectives={},(s:any)=>shell(s).components['armored-projectile'].source='armored-state']){
  const save=structuredClone(before);mutate(save);assert.throws(()=>root.LWArmored.restore(save));
 }
 assert.deepEqual(session.checkpoint(),before);
});
test('Application clock alone advances fixed ticks and replacement failure is atomic',()=>{
 const app=root.LWArmoredApplication.create(fixture());app.advance(1);assert.equal(app.view.query().tick,0);app.enter();app.advance(1/120);assert.equal(app.view.query().tick,0);app.advance(1/120);assert.equal(app.view.query().tick,1);
 app.view.control('pause');app.advance(10);assert.equal(app.view.query().tick,1);const before=app.view.checkpoint();assert.throws(()=>app.view.replace({}));assert.deepEqual(app.view.checkpoint(),before);
 app.view.control('resume');app.advance(10);assert.equal(app.view.query().tick,7);app.exit();app.advance(1);assert.equal(app.view.query().tick,7);
});
test('Excessive slopes block uphill drive in both forward and reverse directions',()=>{
 for(const reverse of [false,true]){
  const data=fixture(),terrain=data.missions[0]!.terrain;terrain.heights=terrain.heights.map((_,index)=>Math.floor(index/terrain.width)*terrain.cellSize*.8);
  data.missions[0]!.spawns[0]!.yaw=reverse?Math.PI:0;const session=root.LWArmored.create(data);session.command({kind:'drive',throttle:reverse?-1:1});session.step();
  const v=player(session);assert.equal(v.body.leftForce,0);assert.equal(v.body.rightForce,0);assert(v.body.velocity.z<0);
 }
});
test('Traction caps forces without spurious reverse thrust at the speed limit',()=>{
 const data=fixture();data.surfaces[0]!.friction=.01;const session=root.LWArmored.create(data),save=session.checkpoint();
 save.entities.find((e:any)=>e.id==='player').components['armored-body'].velocity.z=data.vehicles[0]!.maxSpeed;
 const loaded=root.LWArmored.restore(save);loaded.command({kind:'drive',throttle:1});loaded.step();const v=player(loaded);assert(v.body.leftForce>=0&&v.body.rightForce>=0);
 assert(v.body.leftForce<=data.surfaces[0]!.friction*data.vehicles[0]!.mass*9.81/2);
});
fs.writeFileSync(__dirname+'/armored-runtime-results.json',JSON.stringify({passed:results.length,total:results.length,results},null,2)+'\n');
console.log(results.length+'/'+results.length+' armored runtime checks passed');
