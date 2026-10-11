import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
for(const file of ['ecs','armored-catalog','armored-physics-legacy','armored-collision','armored-physics','armored-combat','armored-logistics','armored-navigation','armored-ai','armored-missions','armored-checkpoint','armored-session'])require('./'+file+'.js');
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
 ctx.solver=solver||'tracked-force-v2';if(ctx.solver==='tracked-force-v2')ctx.navigation='hull-route-v1';
 const scheduler=new root.LWECS.Scheduler();root.LWArmoredPhysics.register(scheduler,ctx);
 const result={ctx,scheduler,spec};addTank(result,'tank',50,50,0);return result;
}
function addTank(f:Fixture,id:string,x:number,z:number,yaw:number,y=.4):void{
 const w=f.ctx.world;w.create(id);
 const transform={position:{x,y,z},yaw,pitch:0,roll:0};
 w.set(id,'armored-transform',transform);w.set(id,'armored-previous',structuredClone(transform));
 w.set(id,'armored-identity',{definition:'tank',faction:'allies'});
 w.set(id,'armored-body',{velocity:{x:0,y:0,z:0},yawVelocity:0,leftForce:0,rightForce:0,contacts:6,slip:0,grounded:true});
 w.set(id,'armored-order',{kind:'charge',targetId:'',position:{x:50,y:0,z:130}});
 w.set(id,'armored-perception',{targetId:'',acquired:0,contacts:[],visible:[]});
 w.set(id,'armored-weapon',{turretYaw:yaw,elevation:0,aimYaw:yaw,aimElevation:0,reload:0,ammo:'ap',reserves:{ap:20},trigger:false,recoil:0});
 w.set(id,'armored-motor',{throttle:0,steer:0,brake:0,cruise:0});
 w.set(id,'armored-damage',{status:'operational',components:Object.fromEntries(['engine','transmission','leftTrack','rightTrack','gun'].map(key=>[key,100])),crew:{driver:1,gunner:1,commander:1,loader:1},fire:0,repair:0});
}
function transform(f:Fixture,id='tank'):LWArmoredRuntime.Transform{return f.ctx.world.get(id,'armored-transform') as LWArmoredRuntime.Transform;}
function body(f:Fixture):LWArmoredRuntime.Body{return f.ctx.world.get('tank','armored-body') as LWArmoredRuntime.Body;}
function motor(f:Fixture):LWArmoredRuntime.Motor{return f.ctx.world.get('tank','armored-motor') as LWArmoredRuntime.Motor;}
function obstacle(f:Fixture,x:number,z:number,width:number,length:number,y=0,height=5):void{
 f.ctx.mission.obstacles.push({id:'wall'+f.ctx.mission.obstacles.length,position:{x,y,z},size:{x:width,y:height,z:length},material:'stone',destructible:true,health:100});
}
function order(f:Fixture):LWArmoredRuntime.Order{return f.ctx.world.get('tank','armored-order') as LWArmoredRuntime.Order;}
function drive(f:Fixture,goal:LWArmoredRuntime.Vec3,ticks:number):void{
 for(let i=0;i<ticks;i++){root.LWArmoredNavigation.move(f.ctx,'tank',goal,.7,2,1/60);f.scheduler.step(f.ctx.world,1/60);f.ctx.state.tick++;}
}
const goal={x:50,y:0,z:130};
function path(f:Fixture,to=goal):LWArmoredRuntime.Vec3[]{return root.LWArmoredNavigation.path(f.ctx,'tank',to);}
function state(f:Fixture):unknown{return ['armored-transform','armored-previous','armored-body','armored-motor','armored-damage','armored-order'].map(key=>structuredClone(f.ctx.world.get('tank',key)));}
test('Swept routes reject thin barriers between lattice nodes and impossible chokes',()=>{
 const f=fixture();obstacle(f,100,71.5,200,.02);assert.deepEqual(path(f),[]);
 const g=fixture();obstacle(g,23.8,80,50,5);obstacle(g,126.2,80,150,5);assert.deepEqual(path(g),[]);
});
test('Straight narrow passages admit full hull width while blocked destinations fail closed',()=>{
 const f=fixture();obstacle(f,35,90,26,100);obstacle(f,65,90,26,100);
 assert.deepEqual(path(f),[goal]);
 assert.deepEqual(path(f,{x:35,y:0,z:90}),[]);
});
test('Detours reserve hull length at turns and stay outside obstacle geometry',()=>{
 const f=fixture();obstacle(f,50,80,30,10);const route=path(f);assert(route.length>=2);
 assert(route.some(p=>Math.abs(p.x-50)>18));
 drive(f,goal,4200);assert(Math.hypot(transform(f).position.x-goal.x,transform(f).position.z-goal.z)<2.1,JSON.stringify({transform:transform(f),order:order(f)}));
});
test('Known wrecks and stationary allies obstruct routes without hidden enemy pose leakage',()=>{
 const f=fixture();const initial=path(f);addTank(f,'hidden',50,80,0);
 f.ctx.world.get<LWArmoredRuntime.Identity>('hidden','armored-identity')!.faction='axis';
 f.ctx.world.get<LWArmoredRuntime.Damage>('hidden','armored-damage')!.status='destroyed';
 assert.deepEqual(path(f),initial);
 const p=f.ctx.world.get<LWArmoredRuntime.Perception>('tank','armored-perception')!;p.visible=['hidden'];p.contacts=[{id:'hidden',position:{x:50,y:.4,z:80},tick:0}];
 const observed=path(f);assert(observed.length>1);transform(f,'hidden').position={x:120,y:.4,z:130};assert.deepEqual(path(f),observed);
 p.visible=[];p.contacts=[{id:'hidden',position:{x:50,y:.4,z:80},tick:0}];const remembered=path(f);
 transform(f,'hidden').position={x:120,y:.4,z:130};assert.deepEqual(path(f),remembered);
 p.contacts=[];f.ctx.world.get<LWArmoredRuntime.Identity>('hidden','armored-identity')!.faction='allies';
 transform(f,'hidden').position={x:50,y:.4,z:80};assert(path(f).length>1);
});
test('Destroyed cover and vertically separated structures release their route footprint',()=>{
 const f=fixture();obstacle(f,100,80,200,5,4,2);assert.deepEqual(path(f),[goal]);
 f.ctx.mission.obstacles[0]!.position.y=0;assert.deepEqual(path(f),[]);
 f.ctx.world.create('obstacle:wall0');f.ctx.world.set('obstacle:wall0','armored-obstacle',{destroyed:true});f.ctx.state.terrainRevision++;
 assert.deepEqual(path(f),[goal]);
});
test('Reverse escape remains latched while moving and stops after its bounded duration',()=>{
 const f=fixture();Object.assign(order(f),{reason:'Reverse escape',stuck:2});
 drive(f,goal,60);assert.equal(order(f).reason,'Reverse escape');assert(transform(f).position.z<49.5);assert(motor(f).throttle<0);
 drive(f,goal,31);assert.equal(order(f).reason,'Replanning');assert.equal(motor(f).throttle,0);assert.equal(order(f).pathRevision,-1);
});
test('A blocked pivot automatically reverses clear before resuming its commanded route',()=>{
 const f=fixture();obstacle(f,52.2,55,.1,10);const behind={x:50,y:0,z:20};let reversing=0;
 for(let tick=0;tick<1800;tick++){drive(f,behind,1);if(order(f).reason==='Reverse escape')reversing++;}
 assert(reversing>30,JSON.stringify({reversing,transform:transform(f),order:order(f)}));
 assert(Math.hypot(transform(f).position.x-behind.x,transform(f).position.z-behind.z)<2.1,JSON.stringify({transform:transform(f),order:order(f)}));
});
test('Reverse escape refuses a rear wall or known allied hull and never drives through either',()=>{
 for(const allied of [false,true]){
  const f=fixture();if(allied)addTank(f,'ally',50,42,0);else obstacle(f,50,45,30,.1);
  Object.assign(order(f),{reason:'Reverse escape',stuck:2});drive(f,goal,1);
  assert.equal(order(f).reason,'Replanning');assert.equal(motor(f).throttle,0);assert.equal(transform(f).position.z,50);
 }
});
test('Blocked goals stay bounded without phantom movement or accumulating recovery state',()=>{
 const f=fixture();obstacle(f,100,71.5,200,.02);drive(f,goal,600);
 assert.equal(order(f).reason,'No safe route');assert.equal(order(f).stuck,0);assert.equal(transform(f).position.z,50);assert.equal(motor(f).brake,1);
});
test('Detached mid-recovery continuation preserves every motor and navigation field',()=>{
 const a=fixture();Object.assign(order(a),{reason:'Reverse escape',stuck:2});drive(a,goal,35);const b=fixture();
 for(const key of ['armored-transform','armored-previous','armored-body','armored-motor','armored-damage','armored-order'])b.ctx.world.set('tank',key,structuredClone(a.ctx.world.get('tank',key)!));
 b.ctx.state.tick=a.ctx.state.tick;drive(a,goal,250);drive(b,goal,250);assert.deepEqual(state(a),state(b));
});
test('Explicit v1 retains the independently captured legacy route choice',()=>{
 const f=fixture('tracked-force-v1');obstacle(f,50,80,30,10);
 const route=root.LWArmoredAI.path(f.ctx,'tank',goal);
 const digest=createHash('sha256').update(JSON.stringify(route)).digest('hex');
 // Captured from the unchanged implementation at 491bc54c, not the v2 helper.
 assert.equal(digest,'b5b8220c8aa327835f2845928de3e568d03fc01a353a092ebab681a097e3db65');
});
test('Old v2 saves retain original path and motor arithmetic when navigation is absent or explicitly legacy',()=>{
 for(const navigation of [undefined,'legacy-grid-v1'] as const){
  const f=fixture();if(navigation)f.ctx.navigation=navigation;else delete f.ctx.navigation;
  f.ctx.state.controlled='observer';obstacle(f,50,80,30,10);
  assert.equal(createHash('sha256').update(JSON.stringify(root.LWArmoredAI.path(f.ctx,'tank',goal))).digest('hex'),'b5b8220c8aa327835f2845928de3e568d03fc01a353a092ebab681a097e3db65');
  root.LWArmoredAI.register(f.scheduler,f.ctx);for(let tick=0;tick<180;tick++){f.ctx.state.tick++;f.scheduler.step(f.ctx.world,1/60);}
  // Independently captured with the original AI at 491bc54c and v2 hull physics.
  assert.equal(createHash('sha256').update(JSON.stringify(state(f))).digest('hex'),'c71a7b6537a30e823e1fd0016a188b18bd6e4e4d598f173eb9c97eb9e7ab93fb');
 }
 const modern=fixture();obstacle(modern,50,80,30,10);assert.notDeepEqual(root.LWArmoredAI.path(modern.ctx,'tank',goal),[]);
 assert.deepEqual(root.LWArmoredAI.path(modern.ctx,'tank',goal),path(modern));
 assert.notEqual(createHash('sha256').update(JSON.stringify(path(modern))).digest('hex'),'b5b8220c8aa327835f2845928de3e568d03fc01a353a092ebab681a097e3db65');
});
function sessionCatalog():LWArmoredData.Catalog{
 const data=fixture().ctx.catalog,mission=data.missions[0]!;
 data.ammunition=[{id:'ap',name:'AP',kind:'AP',velocity:600,mass:7,penetration:100,damage:80,drag:0,ricochetAngle:1.3,blastRadius:0,smokeSeconds:0}];
 mission.spawns=[{id:'player',vehicle:'tank',faction:'allies',position:{x:100,y:0,z:40},yaw:0,player:true},{id:'wing',vehicle:'tank',faction:'allies',position:{x:50,y:0,z:50},yaw:0,player:false}];
 mission.objectives=[{id:'survive',name:'Survive',kind:'survive',target:'allies',position:{x:0,y:0,z:0},radius:0,required:1000}];
 mission.obstacles=[{id:'wall',position:{x:52.2,y:0,z:55},size:{x:.1,y:5,z:10},material:'stone',destructible:true,health:100}];
 return data;
}
test('Navigation policy persists exactly through new and legacy checkpoint restoration and recovery',()=>{
 const a=root.LWArmored.create(sessionCatalog());assert.equal(a.checkpoint().navigation,'hull-route-v1');
 assert(a.command({kind:'order',entityId:'wing',order:'charge',position:{x:50,y:0,z:20}}).ok);
 let reversing=false;
 for(let tick=0;tick<1200;tick++){a.step();if(a.query().vehicles.find((v:any)=>v.id==='wing').order.reason==='Reverse escape'){reversing=true;break;}}
 assert(reversing,'Real application must enter reverse before checkpoint');const save=a.checkpoint(),b=root.LWArmored.restore(save);
 assert.deepEqual(b.checkpoint(),save);a.step(300);b.step(300);assert.deepEqual(a.checkpoint(),b.checkpoint());
 for(const navigation of [undefined,'legacy-grid-v1'] as const){
  const old=root.LWArmored.create(sessionCatalog()).checkpoint();if(navigation)old.navigation=navigation;else delete old.navigation;
  const restored=root.LWArmored.restore(old);assert.deepEqual(restored.checkpoint(),old);assert.equal(Object.hasOwn(restored.checkpoint(),'navigation'),navigation!==undefined);
  assert(restored.command({kind:'order',entityId:'wing',order:'charge',position:{x:50,y:0,z:20}}).ok);restored.step();
  assert(restored.query().vehicles.find((v:any)=>v.id==='wing').order.path.length>1,'Restored legacy application must retain its grid route');
  assert.equal(Object.hasOwn(restored.checkpoint(),'navigation'),navigation!==undefined);
 }
});
test('Checkpoint admission rejects unknown navigation policies and incompatible legacy solver selection',()=>{
 const session=root.LWArmored.create(sessionCatalog()),before=session.checkpoint();
 for(const navigation of ['future-route-v9','',null,7]){const save=structuredClone(before);save.navigation=navigation;assert.throws(()=>root.LWArmored.restore(save));assert.deepEqual(session.checkpoint(),before);}
 const legacy=structuredClone(before);legacy.solver='tracked-force-v1';for(const entity of legacy.entities)delete entity.components['armored-supply'];
 assert.throws(()=>root.LWArmored.restore(legacy));delete legacy.navigation;assert.deepEqual(root.LWArmored.restore(legacy).checkpoint(),legacy);
});
fs.writeFileSync(__dirname+'/armored-navigation-results.json',JSON.stringify({passed:results.length,total:results.length,results},null,2)+'\n');
console.log(results.length+'/'+results.length+' armored navigation checks passed');
