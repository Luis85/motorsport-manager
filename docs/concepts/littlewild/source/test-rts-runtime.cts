import assert from 'node:assert/strict';
import fs from 'node:fs';
for(const file of ['developer-data','ecs','rts-catalog','rts-stats','rts-navigation','rts-systems','rts-production','rts-economy','rts-checkpoint','rts-session','rts-application'])require('./'+file+'.js');
const root=globalThis as any,api=root.LWRTS,catalog=root.LWRTSCatalog;
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void {try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
const canonical=(session:any)=>JSON.stringify(session.checkpoint());
function fixture(options:{fog?:boolean;combat?:boolean}={}){
 const data=catalog.clone(),mission=data.missions[0];
 for(const faction of data.factions)faction.ai.enabled=false;
 mission.width=24;mission.height=20;mission.fog=options.fog??false;mission.terrain=[];
 mission.objectives=[{id:'survival',name:'Survival',description:'Keep a finite fixture running.',type:'survive',target:'alliance',amount:10000}];
 mission.spawns=[{archetype:'hq',faction:'alliance',x:3,y:3,count:1},{archetype:'worker',faction:'alliance',x:7,y:4,count:1},{archetype:'rifleman',faction:'alliance',x:7,y:8,count:1},{archetype:'rifleman',faction:'raiders',x:options.combat?9:20,y:options.combat?8:16,count:1}];
 mission.deposits=[{resource:'wood',x:11,y:4,amount:100}];mission.items=[{item:'medkit',x:7,y:5},{item:'beacon',x:8,y:5}];
 const session=api.create(data,mission.id),view=session.query('');
 return {session,data,mission,worker:view.entities.find((v:any)=>v.definition==='worker'),soldier:view.entities.find((v:any)=>v.definition==='rifleman'&&v.faction==='alliance'),enemy:view.entities.find((v:any)=>v.faction==='raiders'),hq:view.entities.find((v:any)=>v.definition==='hq'),deposit:view.entities.find((v:any)=>v.category==='resource')};
}
test('RTS state lives in ECS components and queries/checkpoints are detached without advancing time',()=>{
 const f=fixture(),before=canonical(f.session),view=f.session.query(''),checkpoint=f.session.checkpoint();
 assert(checkpoint.entities.find((e:any)=>e.id===f.worker.id).components['rts-worker']);
 assert(checkpoint.entities.find((e:any)=>e.id==='rts-state').components['rts-state']);
 view.entities[0].x=-999;view.catalog.units[0].hp=1;view.factions[0].resources.wood=-999;
 checkpoint.entities[0].id='mutated';
 for(let i=0;i<10;i++)f.session.query();assert.equal(canonical(f.session),before);
});
test('Commands reject hostile inputs without invoking accessors or mutating the ECS checkpoint',()=>{
 const f=fixture(),before=canonical(f.session);let reads=0;
 const getter={faction:'alliance',entities:[f.worker.id],x:9,y:4};Object.defineProperty(getter,'kind',{enumerable:true,get(){reads++;return 'move';}});
 assert.equal(f.session.command(getter).ok,false);assert.equal(reads,0);
 const nested={kind:'move',faction:'alliance',entities:[f.worker.id],x:9,y:4};Object.defineProperty(nested,'x',{enumerable:true,get(){reads++;return 9;}});
 assert.equal(f.session.command(nested).ok,false);assert.equal(reads,0);
 const cycle:any={kind:'move',faction:'alliance',entities:[f.worker.id],x:9,y:4};cycle.self=cycle;
 const sparse:any[]=[];sparse.length=1;
 for(const input of [cycle,{kind:'move',faction:'alliance',entities:sparse,x:9,y:4},{kind:'move',faction:'alliance',entities:[f.worker.id],x:NaN,y:4},{kind:'stop',faction:'alliance',entities:[f.worker.id],execute:'alert(1)'},{kind:'move',faction:'alliance',entities:[f.worker.id,f.enemy.id],x:9,y:4}])assert.equal(f.session.command(input).ok,false);
 assert.equal(canonical(f.session),before);
});
test('Fixed-step movement and checkpoint restoration produce identical deterministic continuation',()=>{
 const first=fixture(),second=fixture();
 const command={kind:'move',faction:'alliance',entities:[first.worker.id],x:15.5,y:5.5};
 assert.equal(first.session.command(command).ok,true);assert.equal(second.session.command(command).ok,true);
 first.session.step(30);for(let i=0;i<30;i++)second.session.step();assert.equal(canonical(first.session),canonical(second.session));
 const moved=first.session.query('').entities.find((v:any)=>v.id===first.worker.id);assert(moved.x>first.worker.x);
 const saved=first.session.checkpoint(),restored=api.restore(saved);assert.equal(canonical(restored),canonical(first.session));
 first.session.step(30);restored.step(30);assert.equal(canonical(restored),canonical(first.session));
 saved.catalog.units[0].speed=999;assert.notEqual(restored.query('').catalog.units[0].speed,999);
});
test('The actual showcase catalog restores its initial and evolving ECS checkpoint without losing state',()=>{
 const original=api.create(),restored=api.restore(original.checkpoint());
 assert.equal(canonical(restored),canonical(original));original.step(30);restored.step(30);assert.equal(canonical(restored),canonical(original));
 const resumed=api.restore(original.checkpoint());original.step(20);resumed.step(20);assert.equal(canonical(resumed),canonical(original));
});
test('Finite gathering conserves deposit plus cargo plus bank, and cargo arrives through real storage routes',()=>{
 const f=fixture(),before=f.session.query(''),starting=before.factions.find((v:any)=>v.id==='alliance').resources.wood;
 assert.equal(f.session.command({kind:'gather',faction:'alliance',entities:[f.worker.id],targetId:f.deposit.id}).ok,true);
 f.session.step(1200);
 const view=f.session.query(''),bank=view.factions.find((v:any)=>v.id==='alliance').resources.wood;
 const remaining=view.entities.find((v:any)=>v.id===f.deposit.id).remaining;
 const carried=view.entities.filter((v:any)=>v.faction==='alliance').reduce((sum:number,v:any)=>sum+(v.carried||0),0);
 assert(bank>starting,'Gathered resources must reach the bank');assert(Math.abs(bank-starting+remaining+carried-100)<1e-7);
 assert(bank-starting<=100+1e-7);assert(remaining>=0);
});
test('Construction starts from a worker order, blocks terrain, completes and increases population capacity',()=>{
 const f=fixture(),before=f.session.query(''),cap=before.factions.find((v:any)=>v.id==='alliance').populationCap;
 const result=f.session.command({kind:'build',faction:'alliance',entities:[f.worker.id],definition:'house',x:14,y:8});assert.equal(result.ok,true,result.message);
 assert.equal(f.session.query('').entities.find((v:any)=>v.id===result.entityId).complete,false);
 f.session.step(1200);const view=f.session.query('');assert.equal(view.entities.find((v:any)=>v.id===result.entityId).complete,true);
 assert(view.factions.find((v:any)=>v.id==='alliance').populationCap>cap);assert(view.map.blocked.length>before.map.blocked.length);
});
test('Combat consumes cooldown, applies bounded damage and removes destroyed entities through ECS',()=>{
 const f=fixture({combat:true});assert.equal(f.session.command({kind:'attack',faction:'alliance',entities:[f.soldier.id],targetId:f.enemy.id}).ok,true);
 f.session.step();assert(f.session.checkpoint().entities.some((value:any)=>value.components['rts-projectile']));
 const weapon=f.data.units.find((value:any)=>value.id==='rifleman').attack;f.session.step(Math.ceil(2/weapon.projectileSpeed/.1));const hit=f.session.query('').entities.find((v:any)=>v.id===f.enemy.id);assert(hit.hp<f.enemy.hp);
 f.session.step();assert.equal(f.session.query('').entities.find((v:any)=>v.id===f.enemy.id).hp,hit.hp);
 f.session.step(600);assert.equal(f.session.query('').entities.some((v:any)=>v.id===f.enemy.id),false);
});
test('Fog keeps distant enemies hidden, rejects their targeting and retains explored tiles after movement',()=>{
 const f=fixture({fog:true}),before=canonical(f.session),initial=f.session.query('alliance');
 assert.equal(initial.entities.some((v:any)=>v.id===f.enemy.id),false);
 assert.equal(f.session.command({kind:'attack',faction:'alliance',entities:[f.soldier.id],targetId:f.enemy.id}).ok,false);assert.equal(canonical(f.session),before);
 assert.equal(f.session.command({kind:'move',faction:'alliance',entities:[f.worker.id],x:15.5,y:4.5}).ok,true);f.session.step(100);
 const moved=f.session.query('alliance');assert(moved.fog.explored.alliance.length>initial.fog.explored.alliance.length);
 for(const tile of initial.fog.explored.alliance)assert(moved.fog.explored.alliance.includes(tile));
});
test('Consumable item pickup grants an ability, charges and cooldowns spend exactly once',()=>{
 const f=fixture(),item=f.session.query('').entities.find((value:any)=>value.definition==='medkit');assert(item);
 assert.equal(f.session.command({kind:'interact',faction:'alliance',entities:[f.worker.id],targetId:item.id}).ok,true);
 assert.equal(f.session.query('').entities.some((value:any)=>value.id===item.id),false);
 const before=f.session.query('').entities.find((value:any)=>value.id===f.worker.id).inventory.medkit;
 const command={kind:'ability',faction:'alliance',entities:[f.worker.id],ability:'heal',x:f.worker.x,y:f.worker.y};
 assert.equal(f.session.command(command).ok,true);
 assert.equal(f.session.query('').entities.find((value:any)=>value.id===f.worker.id).inventory.medkit,before-1);
 const checkpoint=canonical(f.session);assert.equal(f.session.command(command).ok,false);assert.equal(canonical(f.session),checkpoint);
 assert.equal(canonical(api.restore(f.session.checkpoint())),checkpoint);
});
test('Terrain movement categories route land around water, water through water and air across blocked terrain',()=>{
 const f=fixture(),map={width:5,height:5,tiles:Array(25).fill('grass'),blocked:['2,1','2,2','2,3']};
 for(let y=0;y<5;y++)map.tiles[y*5+2]='water';
 const context={catalog,data:f.data,map};
 assert.equal(root.LWRTSNavigation.path(context,{x:.5,y:2.5},{x:4.5,y:2.5},'land').length,0);
 assert(root.LWRTSNavigation.path(context,{x:2.5,y:.5},{x:2.5,y:4.5},'water').length===0,'Buildings block naval passage too');
 assert(root.LWRTSNavigation.path(context,{x:.5,y:2.5},{x:4.5,y:2.5},'air').length>0);
 map.blocked=[];assert(root.LWRTSNavigation.path(context,{x:2.5,y:.5},{x:2.5,y:4.5},'water').length>0);
});
test('Completion-tick production checkpoints contain no transient publication state and restore exactly',()=>{
 for(const kind of ['train','research']) {
  const f=fixture(),definition=kind==='train'?f.data.units.find((entry:any)=>entry.id==='worker'):f.data.technologies.find((entry:any)=>f.data.buildings.find((building:any)=>building.id==='hq').researches.includes(entry.id)&&!entry.prerequisites.length);
  assert(definition,'Fixture requires an available production definition');
  assert.equal(f.session.command({kind,faction:'alliance',entities:[f.hq.id],definition:definition.id}).ok,true);
  f.session.step(Math.ceil((definition.buildTime??definition.researchTime)/.1));
  const saved=f.session.checkpoint(),building=saved.entities.find((entry:any)=>entry.id===f.hq.id);
  assert.deepEqual(building.components['rts-production'].queue,[]);
  const view=f.session.query(''),bank=view.factions.find((entry:any)=>entry.id==='alliance');
  if(kind==='train')assert.equal(bank.population,view.entities.filter((entry:any)=>entry.faction==='alliance'&&entry.category==='unit').reduce((sum:number,entry:any)=>sum+f.data.units.find((unit:any)=>unit.id===entry.definition).population,0));
  else assert(bank.technologies.includes(definition.id));
  const resumed=api.restore(saved);assert.equal(canonical(resumed),canonical(f.session));
  resumed.step();f.session.step();assert.equal(canonical(resumed),canonical(f.session));
 }
});
test('Off-map reveal ability targets reject atomically and leave a restorable checkpoint',()=>{
 const data=catalog.clone();for(const faction of data.factions)faction.ai.enabled=false;
 const session=api.create(data),ship=session.query('').entities.find((entry:any)=>entry.definition==='airship'),before=canonical(session);
 for(const [x,y]of [[-.1,ship.y],[ship.x,-.1],[session.query('').map.width,ship.y],[ship.x,session.query('').map.height]]) {
  assert.equal(session.command({kind:'ability',faction:'alliance',entities:[ship.id],ability:'recon',x,y}).ok,false);
  assert.equal(canonical(session),before);
 }
 assert.equal(canonical(api.restore(session.checkpoint())),before);
});
test('Reveal state stays bounded, expired areas retire, and capacity rejection is atomic',()=>{
 const data=catalog.clone();for(const faction of data.factions){faction.ai.enabled=false;faction.startingResources.credits=10000;}
 const recon=data.abilities.find((entry:any)=>entry.id==='recon');recon.cooldown=.1;recon.duration=30;
 const session=api.create(data),ship=session.query('').entities.find((entry:any)=>entry.definition==='airship');
 const command={kind:'ability',faction:'alliance',entities:[ship.id],ability:'recon',x:ship.x,y:ship.y};
 for(let i=0;i<256;i++){assert.equal(session.command(command).ok,true);session.step();}
 const before=canonical(session);assert.equal(session.command(command).ok,false);assert.equal(canonical(session),before);
 assert.equal(canonical(api.restore(session.checkpoint())),before);
 session.step(300);const saved=session.checkpoint();
 assert.deepEqual(saved.entities.find((entry:any)=>entry.id==='rts-state').components['rts-reveal'].areas,[]);
 assert.equal(canonical(api.restore(saved)),canonical(session));assert.equal(session.command(command).ok,true);
});
test('Step bounds reject invalid elapsed commands before any authoritative tick or RNG changes',()=>{
 const f=fixture(),before=canonical(f.session);
 for(const ticks of [-1,1.5,NaN,Infinity,20001])assert.throws(()=>f.session.step(ticks));
 f.session.step(0);assert.equal(canonical(f.session),before);
});
test('Hostile checkpoints and semantic component corruption reject before replacing application state',()=>{
 const f=fixture(),app=root.LWRTSApplication.create();app.enter();const before=JSON.stringify(app.view.checkpoint());
 for(const mutate of [
  (saved:any)=>{saved.entities.push(saved.entities[0]);},
  (saved:any)=>{saved.entities.find((e:any)=>e.id==='rts-state').components['rts-state'].tick=-1;},
  (saved:any)=>{saved.entities.find((e:any)=>e.id===f.worker.id).components['rts-position'].x=-1;},
  (saved:any)=>{saved.entities.find((e:any)=>e.id===f.worker.id).components['rts-owner'].faction='missing';},
  (saved:any)=>{saved.entities.find((e:any)=>e.id===f.worker.id).components['executable-system']={script:'alert(1)'};}
 ]){const saved=f.session.checkpoint();mutate(saved);assert.throws(()=>api.restore(saved));assert.throws(()=>app.view.replace(saved,'checkpoint'));assert.equal(JSON.stringify(app.view.checkpoint()),before);}
 let reads=0;const accessor=f.session.checkpoint();Object.defineProperty(accessor,'entities',{enumerable:true,get(){reads++;return [];}});assert.throws(()=>api.restore(accessor));assert.equal(reads,0);
});
test('Application navigation, pause and view queries never tick; only active unpaused application frames do',()=>{
 const app=root.LWRTSApplication.create(),initial=app.view.query().tick;app.advance(.1);assert.equal(app.view.query().tick,initial);
 assert.equal('step' in app.view,false);assert.equal('world' in app.view,false);
 app.enter();app.advance(.1);assert.equal(app.view.query().tick,initial+1);
 app.view.control('pause');app.advance(.1);assert.equal(app.view.query().tick,initial+1);
 app.view.control('resume');app.exit();app.advance(.1);assert.equal(app.view.query().tick,initial+1);
 assert.throws(()=>app.advance(NaN));assert.equal(app.view.query().tick,initial+1);
});
const passed=results.filter(result=>result.passed).length;
fs.writeFileSync(__dirname+'/rts-runtime-results.json',JSON.stringify({passed,total:results.length,results},null,2)+'\n');
console.log(`${passed}/${results.length} RTS runtime checks passed`);if(passed!==results.length)process.exitCode=1;
