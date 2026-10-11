import assert from 'node:assert/strict';
import fs from 'node:fs';
for(const name of ['ecs','armored-physics-legacy','armored-collision','armored-physics','armored-combat','armored-logistics','armored-ai'])require('./'+name+'.js');
const root=globalThis as any;
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void){try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
function fixture(options:{ai?:boolean;obstacle?:boolean;legacy?:boolean}={}){
 const vehicle={id:'test-tank',name:'Test fixture',asset:'fixture',mass:30000,length:6,width:3,height:2.6,engineForce:150000,brakeForce:200000,maxSpeed:12,reverseSpeed:5,trackWidth:2.7,suspensionTravel:.3,groundClearance:.4,maxSlope:.5,rollingResistance:.03,turretSpeed:1,elevationSpeed:.6,minElevation:-.15,maxElevation:.6,muzzleHeight:1.8,barrelLength:3,reloadSeconds:3,ammunition:['ap','he','smoke'],ammoCapacity:30,armor:{front:80,side:40,rear:30,roof:20},componentHealth:100,sightRange:250,aimSeconds:1.2,accuracy:0,repairKits:2,repairSeconds:2,repairRate:.75};
 const ammunition=[{id:'ap',name:'AP',kind:'AP',velocity:900,mass:7,penetration:150,damage:160,drag:0,ricochetAngle:1.2,blastRadius:0,smokeSeconds:0},{id:'he',name:'HE',kind:'HE',velocity:500,mass:8,penetration:10,damage:100,drag:0,ricochetAngle:1.5,blastRadius:5,smokeSeconds:0},{id:'smoke',name:'Smoke',kind:'SMOKE',velocity:100,mass:7,penetration:0,damage:0,drag:0,ricochetAngle:1.5,blastRadius:12,smokeSeconds:15}];
 const mission={id:'test',name:'Test',description:'Deterministic test',playerFaction:'blue',seed:1,terrain:{width:33,depth:33,cellSize:10,heights:Array(1089).fill(0),surface:'grass'},obstacles:options.obstacle?[{id:'wall',position:{x:20,y:0,z:40},size:{x:10,y:6,z:1},material:'brick',destructible:true,health:100}]:[],spawns:[],objectives:[{id:'survive',name:'Survive',kind:'survive',target:'',position:{x:0,y:0,z:0},radius:0,required:1000}],timeLimit:0};
 const catalog={format:'wildlands-armored-catalog',version:1,vehicles:[vehicle],ammunition,surfaces:[{id:'grass',friction:.8,rollingResistance:.03}],missions:[mission]};
 const world=new root.LWECS.World(),scheduler=new root.LWECS.Scheduler(),events:any[]=[];
 world.create('armored-state');const state=world.set('armored-state','armored-state',{tick:0,sequence:0,serial:0,rng:1,mission:'test',controlled:'blue',status:'running',terrainRevision:0,objectives:{survive:0}});
 const ctx:any={solver:options.legacy?'tracked-force-v1':'tracked-force-v2',world,catalog,mission,state,emit:(e:any)=>events.push({...e,tick:state.tick}),random:()=>.5};
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
 root.LWArmoredCombat.register(scheduler,ctx);
 function step(ticks=1){for(let i=0;i<ticks;i++){state.tick++;scheduler.step(world,1/60);}}
 function shell(id:string,position:any,velocity:any,ammo='ap'){world.create(id);world.set(id,'armored-projectile',{source:'blue',faction:'blue',ammo,position:{...position},previous:{...position},velocity:{...velocity},age:0,ricochets:0});}
 return {world,ctx,state,catalog,vehicle,mission,events,scheduler,step,add,shell};
}
test('Armored v2 gunner loss stops aim and fire while healthy driver retains motor authority',()=>{
 const f=fixture({ai:true}),d=f.world.get('red','armored-damage'),w=f.world.get('red','armored-weapon');
 root.LWArmoredPhysics.register(f.scheduler,f.ctx);
 d.crew.gunner=0;root.LWArmoredCombat.refresh(d);assert.equal(d.status,'disabled');
 const before=JSON.stringify(w);
 assert.equal(root.LWArmoredCombat.command(f.ctx,{kind:'aim',entityId:'red',yaw:0,elevation:.2}).ok,false);
 assert.equal(root.LWArmoredCombat.command(f.ctx,{kind:'fire',entityId:'red',pressed:true}).ok,false);
 assert.equal(JSON.stringify(w),before);assert.equal(root.LWArmoredCombat.canMove(d),true);
 w.aimYaw=0;w.aimElevation=.2;w.trigger=true;
 root.LWArmoredAI.command(f.ctx,{kind:'order',entityIds:['red'],order:'charge',position:{x:20,y:0,z:30}});f.step(60);
 assert.equal(w.turretYaw,Math.PI);assert.equal(w.elevation,0);assert.equal(w.trigger,false);
 assert(f.world.get('red','armored-motor').throttle>0);assert.equal(f.events.some(e=>e.kind==='shot'),false);
 assert(f.world.get('red','armored-transform').position.z<79,'The disabled gunner must not veto healthy-driver propulsion.');
 assert(f.world.get('red','armored-body').leftForce>0);
 for(const part of ['engine','transmission','leftTrack','rightTrack']){d.components[part]=0;assert.equal(root.LWArmoredCombat.canMove(d),false);d.components[part]=100;}
 d.crew.driver=0;assert.equal(root.LWArmoredCombat.canMove(d),false);
});
test('Armored v1 retains crew aiming and legacy AI ammunition behavior',()=>{
 const f=fixture({legacy:true}),d=f.world.get('blue','armored-damage'),w=f.world.get('blue','armored-weapon');
 d.crew.gunner=0;root.LWArmoredCombat.refresh(d);
 assert(root.LWArmoredCombat.command(f.ctx,{kind:'aim',yaw:1,elevation:.2}).ok);f.step();assert(w.turretYaw>0);
 const old=fixture({legacy:true,ai:true});old.catalog.ammunition[0]!.penetration=1;old.step(150);
 assert(old.events.some(e=>e.kind==='shot'&&e.entityId==='red'&&e.ammo==='ap'));
});
test('Armored v2 driver loss preserves gunnery while gun damage independently rejects firing',()=>{
 const f=fixture(),d=f.world.get('blue','armored-damage'),w=f.world.get('blue','armored-weapon');d.crew.driver=0;root.LWArmoredCombat.refresh(d);
 assert.equal(d.status,'immobilized');assert.equal(root.LWArmoredCombat.canMove(d),false);
 assert(root.LWArmoredCombat.command(f.ctx,{kind:'aim',yaw:.2,elevation:0}).ok);assert(root.LWArmoredCombat.command(f.ctx,{kind:'fire',pressed:true}).ok);f.step();
 assert(w.turretYaw>0);assert.equal(w.reserves.ap,9);
 d.components.gun=0;root.LWArmoredCombat.refresh(d);assert.equal(root.LWArmoredCombat.command(f.ctx,{kind:'fire',pressed:true}).ok,false);
 assert(root.LWArmoredCombat.command(f.ctx,{kind:'fire',pressed:false}).ok);assert.equal(root.LWArmoredCombat.canAim(d),true);
});
test('Armored v2 repair eligibility rejects drive intent and yaw motion without mutation',()=>{
 const f=fixture(),d=f.world.get('blue','armored-damage'),body=f.world.get('blue','armored-body'),motor=f.world.get('blue','armored-motor');d.components.engine=20;
 const cases:[any,string,number][]=[[motor,'throttle',.2],[motor,'steer',1],[motor,'cruise',.5],[body,'yawVelocity',.1],[body.velocity,'x',1]];
 for(const [object,key,value] of cases){object[key]=value;const before=JSON.stringify(d);assert.equal(root.LWArmoredCombat.command(f.ctx,{kind:'repair'}).ok,false);assert.equal(JSON.stringify(d),before);object[key]=0;}
 Object.keys(d.crew).forEach(key=>d.crew[key]=0);assert.equal(root.LWArmoredCombat.command(f.ctx,{kind:'repair'}).ok,false);
 d.crew.driver=1;f.world.set('blue','armored-supply',{remaining:2});const beforeSupply=JSON.stringify(d);
 assert.equal(root.LWArmoredCombat.command(f.ctx,{kind:'repair'}).ok,false);assert.equal(JSON.stringify(d),beforeSupply);
 f.world.get('blue','armored-supply').remaining=0;assert(root.LWArmoredCombat.command(f.ctx,{kind:'repair'}).ok);assert.equal(d.repairKits,2);
 assert.equal(root.LWArmoredCombat.command(f.ctx,{kind:'aim',yaw:1,elevation:0}).ok,false);
 assert.equal(root.LWArmoredCombat.command(f.ctx,{kind:'fire',pressed:true}).ok,false);
 assert(root.LWArmoredCombat.command(f.ctx,{kind:'fire',pressed:false}).ok);
});
test('Armored v2 pivot and cruise interrupt repair without spending or delayed completion',()=>{
 for(const change of [(f:any)=>f.world.get('blue','armored-motor').steer=1,(f:any)=>f.world.get('blue','armored-motor').cruise=.5,(f:any)=>f.world.get('blue','armored-body').yawVelocity=.1]){
  const f=fixture(),d=f.world.get('blue','armored-damage');d.components.leftTrack=0;
  assert(root.LWArmoredCombat.command(f.ctx,{kind:'repair'}).ok);f.step(60);change(f);f.step(150);
  assert.equal(d.repair,0);assert.equal(d.repairKits,2);assert.equal(d.components.leftTrack,0);
  assert.equal(f.events.filter(e=>e.kind==='repair-cancelled').length,1);assert.equal(f.events.filter(e=>e.kind==='repair-completed').length,0);
 }
});
test('Armored v2 completed repair restores components and extinguishes fire without reviving crew',()=>{
 const f=fixture(),d=f.world.get('blue','armored-damage');d.components.engine=0;d.fire=1;d.crew.gunner=0;root.LWArmoredCombat.refresh(d);
 assert(root.LWArmoredCombat.command(f.ctx,{kind:'repair'}).ok);f.step(120);
 assert.equal(d.repairKits,1);assert(d.components.engine>70);assert.equal(d.fire,0);assert.equal(d.crew.gunner,0);assert.equal(d.status,'disabled');assert(root.LWArmoredCombat.canMove(d));
 f.step(180);assert.equal(f.events.filter(e=>e.kind==='repair-completed').length,1);
 const burning=fixture(),lost=burning.world.get('blue','armored-damage');lost.fire=1;lost.components.ammunition=.01;
 assert(root.LWArmoredCombat.command(burning.ctx,{kind:'repair'}).ok);burning.step();assert.equal(lost.status,'destroyed');assert.equal(lost.repair,0);assert.equal(lost.repairKits,2);
});
test('Armored v2 AI conserves AP against thick armor and stops HE after immobilization',()=>{
 const f=fixture({ai:true});f.catalog.ammunition[0]!.penetration=10;
 f.step(1100);const w=f.world.get('red','armored-weapon'),d=f.world.get('blue','armored-damage');
 assert.equal(w.reserves.ap,10);assert(w.reserves.he<10&&w.reserves.he>0);assert.equal(w.reserves.smoke,10);
 assert.equal(d.status,'immobilized');assert.equal(w.trigger,false);
 const shots=f.events.filter(e=>e.kind==='shot'&&e.entityId==='red').length;f.step(300);
 assert.equal(f.events.filter(e=>e.kind==='shot'&&e.entityId==='red').length,shots);
});
test('Armored v2 AI holds unviable AP then reacquires a penetrable visible flank',()=>{
 const f=fixture({ai:true}),w=f.world.get('red','armored-weapon');f.catalog.ammunition[0]!.penetration=50;w.reserves.he=0;
 f.step(300);assert.equal(w.reserves.ap,10);assert.equal(w.trigger,false);assert.equal(f.events.some(e=>e.kind==='shot'),false);
 f.world.get('blue','armored-transform').yaw=Math.PI/2;f.step(30);assert.equal(w.reserves.ap,10);f.step(120);
 assert(w.reserves.ap<10);assert(f.events.some(e=>e.kind==='armor-impact'&&e.outcome==='penetration'));
});
test('Armored v2 AI changes an empty selection but preserves ammunition during reload',()=>{
 const f=fixture({ai:true}),w=f.world.get('red','armored-weapon');w.ammo='he';w.reserves.he=0;w.reload=.5;
 f.step(20);assert.equal(w.ammo,'he');assert.equal(w.reserves.ap,10);f.step(140);
 assert.equal(w.ammo,'ap');assert(w.reserves.ap<10);
});
function burst(f:ReturnType<typeof fixture>):void{
 f.catalog.ammunition[1]!.blastRadius=10;f.shell('burst',{x:80,y:.02,z:80},{x:0,y:-10,z:0},'he');f.step();
}
test('Armored v2 HE blast applies bounded distance falloff once and includes friendly vehicles',()=>{
 const f=fixture();Object.assign(f.world.get('red','armored-transform').position,{x:84,z:80});f.add('far','blue',80,89);f.add('outside','red',80,93);
 burst(f);const near=f.world.get('red','armored-damage'),far=f.world.get('far','armored-damage'),outside=f.world.get('outside','armored-damage');
 const nearLoss=100-Math.min(near.components.leftTrack,near.components.rightTrack),farLoss=100-Math.min(far.components.leftTrack,far.components.rightTrack);
 assert(nearLoss>farLoss&&farLoss>0&&nearLoss<=25);assert.equal(outside.components.leftTrack,100);assert.equal(outside.components.rightTrack,100);
 assert.equal(f.events.filter(e=>e.kind==='impact').length,1);assert.equal(f.events.filter(e=>e.kind==='blast-damage').length,2);assert.equal(f.world.has('burst','armored-projectile'),false);
 f.step(10);assert.equal(f.events.filter(e=>e.kind==='blast-damage').length,2);
});
test('Armored v2 HE blast respects cover before the same impact destroys that cover',()=>{
 const f=fixture({obstacle:true}),wall=f.mission.obstacles[0]!;wall.position={x:81,y:0,z:80};wall.size={x:.2,y:5,z:10};
 Object.assign(f.world.get('red','armored-transform').position,{x:84,z:80});f.catalog.ammunition[1]!.blastRadius=10;
 f.shell('burst',{x:79,y:1,z:80},{x:900,y:0,z:0},'he');f.step();
 assert.equal(f.world.get('obstacle:wall','armored-obstacle').destroyed,true);assert.equal(f.state.terrainRevision,1);
 assert.equal(f.events.some(e=>e.kind==='blast-damage'&&e.target==='red'),false);assert.equal(f.world.get('red','armored-damage').components.leftTrack,100);
 assert.equal(f.events.filter(e=>e.kind==='impact').length,1);
});
test('Armored v2 HE direct hit excludes duplicate blast and nearby blast interrupts repair once',()=>{
 const direct=fixture();direct.catalog.ammunition[1]!.blastRadius=10;direct.shell('burst',{x:20,y:.5,z:70},{x:0,y:0,z:900},'he');direct.step();
 assert.equal(direct.events.filter(e=>e.kind==='armor-impact'&&e.target==='red').length,1);assert.equal(direct.events.filter(e=>e.kind==='blast-damage'&&e.target==='red').length,0);
 assert.equal(Math.min(...Object.values(direct.world.get('red','armored-damage').components) as number[]),75);
 const f=fixture(),d=f.world.get('red','armored-damage');Object.assign(f.world.get('red','armored-transform').position,{x:84,z:80});d.components.engine=50;
 assert(root.LWArmoredCombat.command(f.ctx,{kind:'repair',entityId:'red'}).ok);burst(f);f.step(150);
 assert.equal(d.repair,0);assert.equal(d.repairKits,2);assert.equal(f.events.filter(e=>e.kind==='repair-cancelled').length,1);assert.equal(f.events.some(e=>e.kind==='repair-completed'),false);
 const legacy=fixture({legacy:true});Object.assign(legacy.world.get('red','armored-transform').position,{x:84,z:80});burst(legacy);assert.equal(legacy.events.some(e=>e.kind==='blast-damage'),false);
 // A damaging penetration can hit an already destroyed component: no health-signature delta.
 const saturated=fixture(),damage=saturated.world.get('red','armored-damage'),weapon=saturated.world.get('red','armored-weapon');
 damage.components.rightTrack=0;root.LWArmoredCombat.refresh(damage);weapon.reserves.ap=0;
 saturated.ctx.mission.supplies=[{id:'field',name:'Field depot',faction:'red',position:{x:20,y:0,z:80},radius:12,ammunition:{ap:10},repairKits:0,transferSeconds:1}];
 saturated.world.create('depot:field');const stock=saturated.world.set('depot:field','armored-depot',{ammunition:{ap:10},repairKits:0});
 const supply=saturated.world.set('red','armored-supply',{depotId:'',remaining:0,condition:''});root.LWArmoredLogistics.register(saturated.scheduler,saturated.ctx);
 assert(root.LWArmoredLogistics.command(saturated.ctx,{kind:'resupply',entityId:'red'}).ok);const before=JSON.stringify(damage);
 saturated.shell('saturated-hit',{x:18.6,y:.3,z:70},{x:0,y:0,z:900});saturated.step();
 const hit=saturated.events.find(e=>e.kind==='armor-impact');assert.equal(hit.component,'rightTrack');assert(hit.damage>0);assert.equal(JSON.stringify(damage),before);
 assert.deepEqual(supply,{depotId:'',remaining:0,condition:''});saturated.step(120);
 assert.equal(saturated.events.filter(e=>e.kind==='resupply-cancelled').length,1);assert.equal(saturated.events.some(e=>e.kind==='resupply-completed'),false);
 assert.equal(stock.ammunition.ap,10);assert.equal(weapon.reserves.ap,0);
 const oldSupply=legacy.world.set('red','armored-supply',{depotId:'field',remaining:1,condition:'legacy marker'});
 legacy.shell('legacy-direct',{x:84,y:.3,z:70},{x:0,y:0,z:900});legacy.step();assert.equal(oldSupply.remaining,1);assert.equal(legacy.events.some(e=>e.kind==='resupply-cancelled'),false);
});
const report={suite:'armored-combat-v2',passed:results.filter(r=>r.passed).length,total:results.length,failed:results.filter(r=>!r.passed).length,results};
fs.writeFileSync(__dirname+'/armored-combat-v2-results.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(results.some(result=>!result.passed))process.exitCode=1;
