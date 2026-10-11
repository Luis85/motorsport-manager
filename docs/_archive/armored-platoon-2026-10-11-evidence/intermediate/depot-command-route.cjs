const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),generated=path.join(root,'source/wildlands/.generated');
for(const file of ['ecs','armored-catalog','armored-physics-legacy','armored-collision','armored-physics','armored-combat','armored-logistics','armored-ai','armored-missions','armored-checkpoint','armored-session'])require(path.join(generated,file+'.js'));
const data=JSON.parse(fs.readFileSync(path.join(root,'docs/concepts/armored-platoon/content/catalog.json'))),results=[];
for(const mission of data.missions){
 const session=globalThis.LWArmored.create(data,mission.id),commands=[];
 const own=()=>{const q=session.query();return q.vehicles.find(v=>v.id===q.controlled);};
 const command=cmd=>{const result=session.command(cmd);commands.push({tick:session.query().tick,cmd,result});if(!result.ok)throw Error(result.message);};
 const depot=mission.supplies[0],ammo=own().weapon.ammo;
 command({kind:'fire',pressed:true});session.step();command({kind:'fire',pressed:false});
 command({kind:'drive',throttle:.7,steer:0,brake:0});
 let braking=false;
 for(let i=0;i<300;i++){
  const v=own(),distance=Math.hypot(v.transform.position.x-depot.position.x,v.transform.position.z-depot.position.z);
  if(distance<8&&!braking){command({kind:'drive',throttle:0,brake:1});braking=true;}
  if(braking&&Math.hypot(...Object.values(v.body.velocity))<.3)break;
  session.step(6);
 }
 const before=session.checkpoint(),stock=session.query().depots[0].ammunition[ammo],rounds=own().weapon.reserves[ammo];
 command({kind:'resupply'});session.step(Math.ceil(depot.transferSeconds*60)+1);
 const query=session.query(),event=query.events.find(e=>(e.kind==='resupply-completed'||e.kind==='resupply-cancelled')&&e.entityId===query.controlled);
 const transferred=event?.kind==='resupply-completed'?1:0;
 if(!event||own().weapon.reserves[ammo]!==rounds+transferred||query.depots[0].ammunition[ammo]!==stock-transferred)throw Error('Route stock conservation failed: '+mission.id);
 results.push({mission:mission.id,ticks:query.tick,seconds:query.seconds,position:own().transform.position,event,commands,checkpointSha256:crypto.createHash('sha256').update(JSON.stringify(session.checkpoint())).digest('hex')});
}
const report={method:'Fresh authored missions, accepted public commands and explicit Node fixed-step clock only. No checkpoint edits or private component mutations. Functional catalog reachability, completed/interrupted transfer observation and stock conservation evidence, not browser play/performance acceptance.',results};
fs.writeFileSync(path.join(__dirname,'depot-command-route.json'),JSON.stringify(report,null,2)+'\n');console.log(results.map(r=>({mission:r.mission,ticks:r.ticks,commands:r.commands.length,event:r.event.kind})));
