import assert from 'node:assert/strict';
for(const name of ['ecs','armored-catalog','armored-physics','armored-combat','armored-ai','armored-missions','armored-checkpoint','armored-session'])require('./'+name+'.js');
const root=globalThis as any;
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void){try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
function fixture(options:{ai?:boolean;mission?:boolean;obstacle?:boolean}={}){
 const vehicle={id:'test-tank',name:'Test fixture',asset:'fixture',mass:30000,length:6,width:3,height:2.6,engineForce:150000,brakeForce:200000,maxSpeed:12,reverseSpeed:5,trackWidth:2.7,suspensionTravel:.3,groundClearance:.4,maxSlope:.5,rollingResistance:.03,turretSpeed:1,elevationSpeed:.6,minElevation:-.15,maxElevation:.6,muzzleHeight:1.8,barrelLength:3,reloadSeconds:3,ammunition:['ap','he','smoke'],ammoCapacity:30,armor:{front:80,side:40,rear:30,roof:20},componentHealth:100,sightRange:250,aimSeconds:1.2,accuracy:0,repairKits:2,repairSeconds:2,repairRate:.75};
 const ammunition=[{id:'ap',name:'AP',kind:'AP',velocity:900,mass:7,penetration:150,damage:160,drag:0,ricochetAngle:1.2,blastRadius:0,smokeSeconds:0},{id:'he',name:'HE',kind:'HE',velocity:500,mass:8,penetration:10,damage:100,drag:0,ricochetAngle:1.5,blastRadius:5,smokeSeconds:0},{id:'smoke',name:'Smoke',kind:'SMOKE',velocity:100,mass:7,penetration:0,damage:0,drag:0,ricochetAngle:1.5,blastRadius:12,smokeSeconds:15}];
 const mission={id:'test',name:'Test',description:'Deterministic test',playerFaction:'blue',seed:1,terrain:{width:33,depth:33,cellSize:10,heights:Array(1089).fill(0),surface:'grass'},obstacles:options.obstacle?[{id:'wall',position:{x:20,y:0,z:40},size:{x:10,y:6,z:1},material:'brick',destructible:true,health:100}]:[],spawns:[],objectives:[{id:'survive',name:'Survive',kind:'survive',target:'',position:{x:0,y:0,z:0},radius:0,required:1000}],timeLimit:0};
 const catalog={format:'wildlands-armored-catalog',version:1,vehicles:[vehicle],ammunition,surfaces:[{id:'grass',friction:.8,rollingResistance:.03}],missions:[mission]};
 const world=new root.LWECS.World(),scheduler=new root.LWECS.Scheduler(),events:any[]=[];
 world.create('armored-state');const state=world.set('armored-state','armored-state',{tick:0,sequence:0,serial:0,rng:1,mission:'test',controlled:'blue',status:'running',terrainRevision:0,objectives:{survive:0}});
 const ctx:any={world,catalog,mission,state,emit:(e:any)=>events.push({...e,tick:state.tick}),random:()=>.5};
 function add(id:string,faction:string,x:number,z:number,yaw=0){
  world.create(id);world.set(id,'armored-identity',{definition:vehicle.id,faction});
  world.set(id,'armored-transform',{position:{x,y:.4,z},yaw,pitch:0,roll:0});
  world.set(id,'armored-previous',{position:{x,y:.4,z},yaw,pitch:0,roll:0});
  world.set(id,'armored-body',{velocity:{x:0,y:0,z:0},yawVelocity:0,leftForce:0,rightForce:0,contacts:6,slip:0,grounded:true});
  world.set(id,'armored-motor',{throttle:0,steer:0,brake:0,cruise:0});
  world.set(id,'armored-weapon',{...root.LWArmoredCombat.initialWeapon(vehicle,catalog),turretYaw:yaw,aimYaw:yaw});
  world.set(id,'armored-damage',root.LWArmoredCombat.initialDamage(vehicle));
  world.set(id,'armored-order',{kind:'hold',targetId:'',position:{x,y:.4,z}});
  world.set(id,'armored-perception',{targetId:'',acquired:0,contacts:[]});
 }
 add('blue','blue',20,20);add('red','red',20,80,Math.PI);
 for(const o of mission.obstacles){world.create('obstacle:'+o.id);world.set('obstacle:'+o.id,'armored-obstacle',{definition:o.id,health:o.health,destroyed:false});}
 if(options.ai)root.LWArmoredAI.register(scheduler,ctx);
 root.LWArmoredCombat.register(scheduler,ctx);if(options.mission)root.LWArmoredMission.register(scheduler,ctx);
 function step(ticks=1){for(let i=0;i<ticks;i++){state.tick++;scheduler.step(world,1/60);}}
 function shell(id:string,position:any,velocity:any,ammo='ap'){world.create(id);world.set(id,'armored-projectile',{source:'blue',faction:'blue',ammo,position:{...position},previous:{...position},velocity:{...velocity},age:0,ricochets:0});}
 return {world,ctx,state,catalog,vehicle,mission,events,step,add,shell};
}
test('Armored main gun consumes one round and one reload for each authoritative shot',()=>{
 const f=fixture(),weapon=f.world.get('blue','armored-weapon');
 assert.equal(root.LWArmoredCombat.command(f.ctx,{kind:'fire',entityId:'blue',pressed:true}).ok,true);
 f.step();assert.equal(weapon.reserves.ap,9);assert.equal(weapon.reload,3);
 assert.equal(f.events.find(e=>e.kind==='shot').position.y,f.vehicle.muzzleHeight,'Muzzle socket uses the authored ground frame.');
 f.step(120);assert.equal(weapon.reserves.ap,9);assert.equal(f.events.filter(e=>e.kind==='shot').length,1);
 f.step(60);assert.equal(weapon.reserves.ap,8);assert.equal(f.events.filter(e=>e.kind==='shot').length,2);
});
test('Armored shells retain fixed initial velocity while a moving target escapes',()=>{
 const f=fixture(),weapon=f.world.get('blue','armored-weapon');weapon.trigger=true;f.step();weapon.trigger=false;
 const id=f.world.query(['armored-projectile'])[0],shot=f.world.get(id,'armored-projectile'),original={...shot.velocity};
 f.world.get('red','armored-transform').position.x=70;f.step(4);
 assert.equal(shot.velocity.x,original.x);assert.equal(shot.velocity.z,original.z);assert(shot.velocity.y<original.y);
 assert.equal(f.events.some(e=>e.kind==='armor-impact'),false);assert.equal(shot.position.x,20);
});
test('Armored swept collision catches a thin obstacle at high projectile speed',()=>{
 const f=fixture({obstacle:true});f.shell('test-shell',{x:20,y:2,z:25},{x:0,y:0,z:1800});f.step();
 assert.equal(f.world.has('test-shell','armored-projectile'),false);assert.equal(f.world.get('obstacle:wall','armored-obstacle').destroyed,true);
 assert.equal(f.state.terrainRevision,1);assert.equal(f.events.filter(e=>e.kind==='obstacle-destroyed').length,1);
});
test('Armored muzzle obstruction resolves before a shell can skip the wall',()=>{
 const f=fixture({obstacle:true});f.mission.obstacles[0]!.position.z=22;
 f.world.get('blue','armored-weapon').trigger=true;f.step();
 assert.equal(f.world.query(['armored-projectile']).length,0);assert.equal(f.world.get('obstacle:wall','armored-obstacle').destroyed,true);
 assert.equal(f.world.get('blue','armored-weapon').reserves.ap,9);
});
test('Armored side penetration and frontal mantlet hit cause different component outcomes',()=>{
 const alignment=fixture();assert.equal(root.LWArmoredCombat.trace(alignment.ctx,{x:20,y:2.8,z:70},{x:20,y:2.8,z:85},'blue'),null,'Armor bounds must match the ground-authored roof.');
 const side=fixture();side.shell('test-shell',{x:10,y:1.4,z:80},{x:900,y:0,z:0});side.step();
 const sideEvent=side.events.find(e=>e.kind==='armor-impact');assert.equal(sideEvent.region,'side');assert.equal(sideEvent.component,'ammunition');assert.equal(sideEvent.outcome,'penetration');assert.equal(side.world.get('red','armored-damage').status,'destroyed');
 const front=fixture();front.shell('test-shell',{x:20,y:2.3,z:70},{x:0,y:0,z:900});front.step();
 const frontEvent=front.events.find(e=>e.kind==='armor-impact');assert.equal(frontEvent.region,'front');assert.equal(frontEvent.component,'mantlet');
 const d=front.world.get('red','armored-damage');assert.equal(d.components.mantlet,0);assert.equal(d.components.gun,100);assert.notEqual(d.status,'disabled');
 const w=front.world.get('red','armored-weapon');w.trigger=true;front.step();assert(front.events.some(e=>e.kind==='shot'&&e.entityId==='red'));
});
test('Armored low penetration bounces and oblique incidence can ricochet once',()=>{
 const low=fixture();low.catalog.ammunition[0]!.penetration=20;low.shell('test-shell',{x:20,y:2,z:70},{x:0,y:0,z:900});low.step();assert.equal(low.events.find(e=>e.kind==='armor-impact').outcome,'non-penetration');
 const glancing=fixture();glancing.world.get('red','armored-transform').yaw=0;
 glancing.shell('test-shell',{x:18.3,y:1.4,z:77.5},{x:100,y:0,z:850});glancing.step();
 const event=glancing.events.find(e=>e.kind==='armor-impact');assert.equal(event.outcome,'ricochet');assert.equal(glancing.world.get('test-shell','armored-projectile').ricochets,1);assert(glancing.world.get('test-shell','armored-projectile').velocity.x<0);
});
test('Armored smoke is finite ECS state and blocks acquisition',()=>{
 const f=fixture({ai:true});f.shell('test-shell',{x:20,y:.02,z:45},{x:0,y:-10,z:0},'smoke');f.step(6);
 assert.equal(f.world.query(['armored-smoke']).length,1);assert.equal(root.LWArmoredAI.visible(f.ctx,'blue','red'),false);
 assert.equal(f.world.get('blue','armored-perception').targetId,'');
 f.step(900);assert.equal(f.world.query(['armored-smoke']).length,0);
});
test('Armored buildings and terrain occlude perception without changing graphics',()=>{
 const f=fixture({ai:true,obstacle:true});f.step(60);assert.equal(f.world.get('red','armored-perception').targetId,'');assert.equal(f.events.some(e=>e.kind==='shot'),false);
 f.world.get('obstacle:wall','armored-obstacle').destroyed=true;assert.equal(root.LWArmoredAI.visible(f.ctx,'blue','red'),true);
 for(let x=0;x<33;x++)f.mission.terrain.heights[5*33+x]=8;
 assert.equal(root.LWArmoredAI.visible(f.ctx,'blue','red'),false);
});
test('Armored AI waits for acquisition and discards hidden target firing',()=>{
 const f=fixture({ai:true});f.step(30);assert(f.world.get('red','armored-perception').targetId);assert.equal(f.events.some(e=>e.kind==='shot'),false);
 f.step(60);assert(f.events.some(e=>e.kind==='shot'&&e.entityId==='red'));
 const previousAim=f.world.get('red','armored-weapon').aimYaw;
 f.world.create('screen');f.world.set('screen','armored-smoke',{position:{x:20,y:2,z:50},radius:15,remaining:15});f.world.get('blue','armored-transform').position.x=25;f.step();
 assert.equal(f.world.get('red','armored-weapon').trigger,false);assert.equal(f.world.get('red','armored-weapon').aimYaw,previousAim);
 f.step(5);
 assert.equal(f.world.get('red','armored-weapon').trigger,false);assert.equal(f.world.get('red','armored-perception').targetId,'');assert(f.world.get('red','armored-perception').contacts.length);
});
test('Armored Hold, Charge, Secure and Follow feed distinct shared motor intentions',()=>{
 const f=fixture({ai:true});f.add('wing','blue',46.8,19.5);
 const command=(order:string,extra:any={})=>root.LWArmoredAI.command(f.ctx,{kind:'order',entityIds:['wing'],order,position:{x:46.8,y:0,z:120},...extra});
 assert(command('charge').ok);f.step(1);const charge=f.world.get('wing','armored-motor').throttle;assert(charge>.7);
 assert(command('secure').ok);f.step(1);assert(f.world.get('wing','armored-motor').throttle<charge);
 assert(command('hold').ok);f.step(1);assert.equal(f.world.get('wing','armored-motor').throttle,0);
 assert(command('follow',{targetId:'blue'}).ok);f.step(1);assert(f.world.get('wing','armored-order').path.length>0);
 const before=JSON.stringify(f.world.get('wing','armored-order'));assert.equal(command('follow',{targetId:'red'}).ok,false);assert.equal(JSON.stringify(f.world.get('wing','armored-order')),before);
});
test('Armored navigation routes around cover and invalidates after destruction',()=>{
 const f=fixture({obstacle:true,ai:true});f.add('wing','blue',20,15);
 const route=root.LWArmoredAI.path(f.ctx,'wing',{x:20,y:0,z:70});assert(route.length>0);assert(route.some((p:any)=>Math.abs(p.x-20)>6));
 assert(root.LWArmoredAI.command(f.ctx,{kind:'order',entityIds:['wing'],order:'charge',position:{x:20,y:0,z:70}}).ok);f.step();
 f.world.get('obstacle:wall','armored-obstacle').destroyed=true;f.state.terrainRevision=1;f.step();assert.equal(f.world.get('wing','armored-order').pathRevision,1);
});
test('Armored repair commits a kit only on completion and motion cancels without payment',()=>{
 const f=fixture(),d=f.world.get('blue','armored-damage');d.components.leftTrack=0;root.LWArmoredCombat.refresh(d);
 assert(root.LWArmoredCombat.command(f.ctx,{kind:'repair',entityId:'blue'}).ok);f.step(60);assert.equal(d.repairKits,2);assert.equal(d.components.leftTrack,0);
 f.world.get('blue','armored-motor').throttle=1;f.step();assert.equal(d.repair,0);assert.equal(d.repairKits,2);
 f.world.get('blue','armored-motor').throttle=0;assert(root.LWArmoredCombat.command(f.ctx,{kind:'repair',entityId:'blue'}).ok);f.step(120);assert.equal(d.repairKits,1);assert.equal(d.components.leftTrack,75);assert.equal(f.events.filter(e=>e.kind==='repair-completed').length,1);
});
test('Armored repair is interrupted by component damage and never duplicates its completion',()=>{
 const f=fixture(),d=f.world.get('red','armored-damage');d.components.engine=50;root.LWArmoredCombat.refresh(d);
 assert(root.LWArmoredCombat.command(f.ctx,{kind:'repair',entityId:'red'}).ok);f.shell('test-shell',{x:20,y:2.3,z:70},{x:0,y:0,z:900});f.step();
 assert.equal(d.repair,0);assert.equal(d.repairKits,2);f.step(150);assert.equal(f.events.some(e=>e.kind==='repair-completed'),false);
});
test('Armored mission goals latch in alternate order and terminal events are idempotent',()=>{
 const f=fixture({mission:true});f.mission.objectives=[{id:'reach',name:'Reach',kind:'reach',target:'',position:{x:20,y:0,z:20},radius:5,required:1},{id:'kill',name:'Eliminate',kind:'eliminate',target:'red',position:{x:0,y:0,z:0},radius:0,required:1}];
 f.step();assert.equal(f.state.objectives.reach,1);assert.equal(f.state.status,'running');f.world.get('blue','armored-transform').position.x=200;
 f.world.get('red','armored-damage').status='destroyed';f.step();assert.equal(f.state.status,'victory');f.step(30);assert.equal(f.events.filter(e=>e.kind==='mission-ended').length,1);assert.equal(f.events.filter(e=>e.kind==='objective-completed').length,2);
});
test('Armored loss of the whole platoon and time expiry independently fail a mission',()=>{
 const f=fixture({mission:true});f.world.get('blue','armored-damage').status='destroyed';f.step();assert.equal(f.state.status,'defeat');
 const timed=fixture({mission:true});timed.mission.timeLimit=.1;timed.step(6);assert.equal(timed.state.status,'defeat');
});
test('Armored destruction restores collision topology and deterministic continuation together',()=>{
 const f=fixture({obstacle:true}),catalog:any=f.catalog;
 catalog.missions[0].spawns=[{id:'blue',vehicle:'test-tank',faction:'blue',position:{x:20,y:0,z:20},yaw:0,player:true},{id:'red',vehicle:'test-tank',faction:'red',position:{x:250,y:0,z:250},yaw:0,player:false}];
 const original=root.LWArmored.create(catalog);assert(original.command({kind:'fire',pressed:true}).ok);original.step(3);assert(original.command({kind:'fire',pressed:false}).ok);
 const saved=original.checkpoint(),restored=root.LWArmored.restore(saved);
 assert.equal(restored.query().terrainRevision,1);assert.equal(restored.query().obstacles[0].destroyed,true);assert.deepEqual(restored.checkpoint(),saved);
 for(const session of [original,restored]){assert(session.command({kind:'drive',throttle:1,steer:0,brake:0}).ok);session.step(240);}
 assert.deepEqual(restored.checkpoint(),original.checkpoint());
 assert(restored.query().vehicles.find((v:any)=>v.id==='blue').transform.position.z>42,'Destroyed cover must no longer block the restored motor.');
 assert.equal(restored.checkpoint().events.filter((e:any)=>e.kind==='obstacle-destroyed').length,1);
});
test('Armored cumulative turret damage neutralizes combat capability while immobilization does not',()=>{
 const f=fixture({mission:true});f.catalog.ammunition[0]!.damage=55;
 f.mission.objectives=[{id:'neutralize',name:'Neutralize',kind:'eliminate',target:'red',position:{x:0,y:0,z:0},radius:0,required:1}];
 f.shell('hit-one',{x:10,y:2,z:80},{x:900,y:0,z:0});f.step();
 const d=f.world.get('red','armored-damage');assert(d.components.turretDrive>30);assert.equal(d.crew.gunner,1);assert.equal(f.state.status,'running');
 f.shell('hit-two',{x:10,y:2,z:80},{x:900,y:0,z:0});f.step();
 assert.equal(d.crew.gunner,0);assert.equal(d.status,'disabled');assert.equal(f.state.status,'victory');
 const mobile=fixture({mission:true});mobile.mission.objectives=f.mission.objectives;
 const stationary=mobile.world.get('red','armored-damage');stationary.components.leftTrack=0;root.LWArmoredCombat.refresh(stationary);mobile.step();
 assert.equal(stationary.status,'immobilized');assert.equal(mobile.state.status,'running');assert.equal(mobile.state.objectives.neutralize,0);
});
console.log(JSON.stringify({suite:'armored-combat',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results},null,2));
if(results.some(result=>!result.passed))process.exitCode=1;
