import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
for(const file of ['ecs','armored-physics-legacy','armored-collision','armored-physics'])require('./'+file+'.js');
const root=globalThis as any;
type Context=LWArmoredRuntime.Context&{solver?:'tracked-force-v1'|'tracked-force-v2'};
interface Fixture {ctx:Context;scheduler:LWArmoredRuntime.Scheduler;spec:LWArmoredData.Vehicle;}
const results:{name:string;passed:boolean}[]=[];
function test(name:string,run:()=>void):void{run();results.push({name,passed:true});console.log('PASS '+name);}
function fixture(solver?:'tracked-force-v1'|'tracked-force-v2'):Fixture{
 const spec:LWArmoredData.Vehicle={id:'tank',name:'Tank',asset:'tank',mass:30000,length:6,width:3,height:2.5,engineForce:110000,brakeForce:180000,maxSpeed:12,reverseSpeed:4,trackWidth:2.5,suspensionTravel:.4,groundClearance:.4,maxSlope:.5,rollingResistance:.015,turretSpeed:.7,elevationSpeed:.3,minElevation:-.2,maxElevation:.4,muzzleHeight:2,barrelLength:3,reloadSeconds:5,ammunition:['ap'],ammoCapacity:20,armor:{front:80,side:40,rear:30,roof:20},componentHealth:100,sightRange:250,aimSeconds:1,accuracy:0,repairKits:2,repairSeconds:5,repairRate:.5};
 const mission:LWArmoredData.Mission={id:'range',name:'Range',description:'Contact fixtures',playerFaction:'allies',seed:1,terrain:{width:101,depth:101,cellSize:2,heights:Array(10201).fill(0),surface:'ground'},obstacles:[],spawns:[],objectives:[],timeLimit:1000};
 const catalog:LWArmoredData.Catalog={format:'wildlands-armored-catalog',version:1,vehicles:[spec],ammunition:[],surfaces:[{id:'ground',friction:.8,rollingResistance:.02}],missions:[mission]};
 const ctx:Context={world:new root.LWECS.World(),catalog,mission,state:{tick:0,sequence:0,serial:0,rng:1,mission:'range',controlled:'tank',status:'running',terrainRevision:0,objectives:{}},emit(){},random(){return .5;}};
 if(solver)ctx.solver=solver;
 const scheduler=new root.LWECS.Scheduler();root.LWArmoredPhysics.register(scheduler,ctx);
 const result={ctx,scheduler,spec};addTank(result,'tank',50,50,0);return result;
}
function addTank(f:Fixture,id:string,x:number,z:number,yaw:number,y=.4):void{
 const w=f.ctx.world;w.create(id);
 const transform={position:{x,y,z},yaw,pitch:0,roll:0};
 w.set(id,'armored-transform',transform);w.set(id,'armored-previous',structuredClone(transform));
 w.set(id,'armored-identity',{definition:'tank',faction:'allies'});
 w.set(id,'armored-body',{velocity:{x:0,y:0,z:0},yawVelocity:0,leftForce:0,rightForce:0,contacts:6,slip:0,grounded:true});
 w.set(id,'armored-motor',{throttle:0,steer:0,brake:0,cruise:0});
 w.set(id,'armored-damage',{status:'operational',components:Object.fromEntries(['engine','transmission','leftTrack','rightTrack','gun'].map(key=>[key,100])),crew:{driver:1,gunner:1,commander:1,loader:1},fire:0,repair:0});
}
function transform(f:Fixture,id='tank'):LWArmoredRuntime.Transform{return f.ctx.world.get(id,'armored-transform') as LWArmoredRuntime.Transform;}
function body(f:Fixture):LWArmoredRuntime.Body{return f.ctx.world.get('tank','armored-body') as LWArmoredRuntime.Body;}
function motor(f:Fixture):LWArmoredRuntime.Motor{return f.ctx.world.get('tank','armored-motor') as LWArmoredRuntime.Motor;}
function obstacle(f:Fixture,x:number,z:number,width:number,length:number,y=0,height=5):void{
 f.ctx.mission.obstacles.push({id:'wall'+f.ctx.mission.obstacles.length,position:{x,y,z},size:{x:width,y:height,z:length},material:'stone',destructible:true,health:100});
}
function run(f:Fixture,ticks=1):void{for(let tick=0;tick<ticks;tick++)f.scheduler.step(f.ctx.world,1/60);}
function corners(f:Fixture):{x:number;z:number}[]{
 const t=transform(f),sin=Math.sin(t.yaw),cos=Math.cos(t.yaw);
 return [-1,1].flatMap(x=>[-1,1].map(z=>({x:t.position.x+x*f.spec.width/2*cos+z*f.spec.length/2*sin,z:t.position.z-x*f.spec.width/2*sin+z*f.spec.length/2*cos})));
}
function state(f:Fixture):unknown{return ['armored-transform','armored-previous','armored-body','armored-motor','armored-damage'].map(key=>structuredClone(f.ctx.world.get('tank',key)));}
test('Hull nose and rear stop at their full length before obstacle contact',()=>{
 for(const reverse of [false,true]){
  const f=fixture();obstacle(f,50,reverse?40:60,30,.1);motor(f).throttle=reverse?-1:1;run(f,600);
  assert(reverse?transform(f).position.z>=43.04999:transform(f).position.z<=56.95001);
  assert(Math.abs(body(f).velocity.z)<1e-8);
 }
});
test('Rotated hull corners and world boundaries use the oriented footprint',()=>{
 const f=fixture();transform(f).yaw=Math.PI/4;transform(f).position.x=192;transform(f).position.z=192;
 motor(f).throttle=1;run(f,600);for(const p of corners(f)){assert(p.x>=0&&p.x<=200+1e-7);assert(p.z>=0&&p.z<=200+1e-7);}
 const g=fixture();transform(g).yaw=Math.PI/4;obstacle(g,50,60,30,.1);motor(g).throttle=1;run(g,180);
 assert(Math.max(...corners(g).map(p=>p.z))<=59.95001);
});
test('Continuous hull sweeps prevent tunneling through thin obstacles at extreme speed',()=>{
 for(const yaw of [0,Math.PI/4,Math.PI/2]){
  const f=fixture();transform(f).yaw=yaw;obstacle(f,50,80,100,.001);body(f).velocity.z=12000;run(f);
  assert(Math.max(...corners(f).map(p=>p.z))<=79.999501);assert(body(f).velocity.z<=1e-8);
 }
});
test('Stable contact removes inward velocity while preserving slide and reverse escape',()=>{
 const f=fixture();obstacle(f,50,60,60,.1);body(f).velocity={x:4,y:0,z:15};run(f,60);
 assert(transform(f).position.x>50);assert(transform(f).position.z<=56.95001);
 motor(f).throttle=1;run(f,300);const stopped=transform(f).position.z;run(f,120);
 assert(Math.abs(transform(f).position.z-stopped)<1e-6);
 motor(f).throttle=-1;run(f,180);assert(transform(f).position.z<stopped-3);
 const overlapping=fixture();obstacle(overlapping,50,60,60,.1);transform(overlapping).position.z=58;
 motor(overlapping).throttle=-1;run(overlapping,120);assert(transform(overlapping).position.z<55);
});
test('Hull pairs collide along their long axes and ignore vertically separated obstacles',()=>{
 const f=fixture();addTank(f,'parked',50,60,Math.PI/2);motor(f).throttle=1;run(f,600);
 assert(transform(f).position.z<=55.50001);assert.equal(transform(f,'parked').position.z,60);
 const g=fixture();obstacle(g,50,60,30,.1,4,2);motor(g).throttle=1;run(g,300);assert(transform(g).position.z>60);
});
test('Destroyed obstacle topology immediately releases the collision footprint',()=>{
 const f=fixture();obstacle(f,50,60,30,.1);motor(f).throttle=1;run(f,300);assert(transform(f).position.z<57);
 f.ctx.world.create('obstacle:wall0');f.ctx.world.set('obstacle:wall0','armored-obstacle',{destroyed:true});run(f,300);assert(transform(f).position.z>65);
});
test('Gunner disability preserves propulsion while driver and drivetrain failures block it',()=>{
 const gunner=fixture(),damage=gunner.ctx.world.get<LWArmoredRuntime.Damage>('tank','armored-damage')!;damage.status='disabled';damage.crew.gunner=0;motor(gunner).throttle=1;run(gunner,60);assert(transform(gunner).position.z>50.5);
 for(const part of ['driver','engine','transmission','leftTrack','rightTrack']){
  const f=fixture(),d=f.ctx.world.get<LWArmoredRuntime.Damage>('tank','armored-damage')!;
  if(part==='driver')d.crew.driver=0;else d.components[part]=0;
  motor(f).throttle=1;run(f,60);assert.equal(body(f).leftForce,0);assert.equal(body(f).rightForce,0);assert.equal(transform(f).position.z,50);
 }
});
test('Bounded angular sweeps stop rotating corners before crossing thin geometry',()=>{
 const f=fixture();obstacle(f,52.1,50,.02,20);motor(f).steer=1;body(f).yawVelocity=1000;run(f);
 assert(Math.max(...corners(f).map(p=>p.x))<=52.090001);assert.equal(body(f).yawVelocity,0);
});
test('Detached v2 contact reconstruction continues identically and default selects v2',()=>{
 const a=fixture(),b=fixture('tracked-force-v2');for(const f of [a,b]){obstacle(f,50,60,30,.1);motor(f).throttle=1;motor(f).steer=.04;}run(a,140);run(b,140);assert.deepEqual(state(a),state(b));
 const restored=fixture('tracked-force-v2');restored.ctx.mission.obstacles=structuredClone(a.ctx.mission.obstacles);
 for(const key of ['armored-transform','armored-previous','armored-body','armored-motor','armored-damage'])restored.ctx.world.set('tank',key,structuredClone(a.ctx.world.get('tank',key)!));
 for(const f of [a,restored]){motor(f).steer=-.1;motor(f).throttle=-1;run(f,180);}assert.deepEqual(state(a),state(restored));
});
test('Explicit v1 retains the captured legacy force and circular-contact continuation',()=>{
 const legacy=fixture('tracked-force-v1');obstacle(legacy,50,60,30,.1);motor(legacy).throttle=1;run(legacy,300);
 assert.equal(transform(legacy).position.z,58.45);
 const restored=fixture('tracked-force-v1');restored.ctx.mission.obstacles=structuredClone(legacy.ctx.mission.obstacles);
 for(const key of ['armored-transform','armored-previous','armored-body','armored-motor','armored-damage'])restored.ctx.world.set('tank',key,structuredClone(legacy.ctx.world.get('tank',key)!));
 for(const f of [legacy,restored]){motor(f).throttle=-.5;motor(f).steer=.2;run(f,120);}assert.deepEqual(state(legacy),state(restored));
 // Captured independently from the original physics source at 0e7fede9, not v2.
 const digest=createHash('sha256').update(JSON.stringify(state(legacy))).digest('hex');
 assert.equal(digest,'79a55fcae2b8e19049cb6fba7bcfe9c999e4df719f1f62217008a964f78ac3b5');
});
fs.writeFileSync(__dirname+'/armored-physics-results.json',JSON.stringify({passed:results.length,total:results.length,results},null,2)+'\n');
console.log(results.length+'/'+results.length+' armored physics checks passed');
