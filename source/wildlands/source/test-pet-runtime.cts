// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// Runtime rules are exercised through the same command and fixed-step boundaries as the browser.
for(const file of ['ecs','pet-catalog','pet-systems','pet-session','pet-tools'])require('./'+file+'.js');
const root=globalThis as unknown as {LWPet:LWPetRuntime.Api;LWPetCatalog:LWPetData.CatalogApi;LWPetTools:LWPetTools.Api};
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});}}
type Mutable=Record<string,any>;
const STEP_MINUTES=root.LWPetCatalog.defaults.rules.minutesPerSecond*root.LWPet.STEP;
const ticks=(minutes:number):number=>Math.round(minutes/STEP_MINUTES);
function hatched(species='mochi'):LWPetRuntime.Session{const s=root.LWPet.create(undefined,species);s.step(ticks(21));assert.equal(s.query().pet.stage,'baby');return s;}
const need=(s:LWPetRuntime.Session,id:string):number=>s.query().needs.find(n=>n.id===id)!.value;
test('An egg hatches on schedule and cuddles warm it sooner',()=>{
 const slow=root.LWPet.create(),warm=root.LWPet.create();
 assert.equal(warm.command({kind:'care',action:'cuddle'}).ok,true);
 slow.step(ticks(17));warm.step(ticks(17));
 assert.equal(slow.query().pet.stage,'egg');assert.equal(warm.query().pet.stage,'baby');
 assert.equal(warm.query().events.some(e=>e.kind==='hatched'),true);
});
test('Eggs only accept stage-allowed care and never decay',()=>{
 const s=root.LWPet.create(),before=JSON.stringify(s.query().needs);
 const meal=s.command({kind:'care',action:'meal'});assert.equal(meal.ok,false);assert.match(meal.message,/egg can only be cuddled/);
 assert.equal(s.command({kind:'sleep'}).ok,false);s.step(ticks(10));assert.equal(JSON.stringify(s.query().needs),before);
});
test('Needs decay with the stage factor and feeding applies catalog effects when the action finishes',()=>{
 const s=hatched(),start=need(s,'hunger');s.step(ticks(60));const hungry=need(s,'hunger');
 assert(Math.abs(start-hungry-30*1.25)<1,'baby fullness drops 37.5/hour');
 assert.equal(s.command({kind:'care',action:'meal'}).ok,true);
 const busy=s.command({kind:'care',action:'play'});assert.equal(busy.ok,false);assert.match(busy.message,/busy: meal/);
 s.step(ticks(10));assert(need(s,'hunger')>hungry+30);assert.equal(s.query().pet.weight,6);assert.equal(s.query().activity,null);
});
test('Digestion leaves a mess that lowers cleanliness until cleaned',()=>{
 const s=hatched();s.command({kind:'care',action:'meal'});s.step(ticks(10+50+1));
 const q=s.query();assert.equal(q.messes.length,1);assert(q.alerts.some(a=>/mess/.test(a)));
 const before=need(s,'hygiene');s.step(ticks(30));assert(before-need(s,'hygiene')>8*1.25*.5+14*.5-1);
 assert.equal(s.command({kind:'care',action:'clean'}).ok,true);s.step(ticks(6));
 assert.equal(s.query().messes.length,0);assert(need(s,'hygiene')>=99);
});
test('Too many treats in an hour cause sickness that only medicine cures',()=>{
 const s=hatched();
 assert.equal(s.command({kind:'care',action:'medicine'}).ok,false);
 for(let i=0;i<4;i++){s.command({kind:'care',action:'snack'});s.step(ticks(5));s.step(1);}
 const q=s.query();assert.equal(q.sick,true);assert.equal(q.mood,'sick');
 assert.equal(s.command({kind:'care',action:'medicine'}).ok,true);s.step(ticks(5));assert.equal(s.query().sick,false);
});
test('Lights off puts the pet to sleep; it wakes rested and a lit room costs happiness',()=>{
 const s=hatched();assert.equal(s.command({kind:'sleep'}).ok,true);
 const q=s.query();assert.equal(q.sleeping,true);assert.equal(q.lights,false);assert.equal(q.actions.every(a=>!a.enabled),true);
 assert.equal(s.command({kind:'sleep'}).ok,false);
 s.step(ticks(60));const rested=s.query();assert.equal(rested.sleeping,false);assert.equal(rested.lights,true);assert(rested.events.some(e=>e.kind==='woke'));
 // A pet that collapsed keeps the lights on; that state is restored from a checkpoint here.
 const dark=hatched();dark.command({kind:'sleep'});
 const saved=dark.checkpoint() as unknown as Mutable;saved.entities.find((e:Mutable)=>e.id==='pet').components['pet-care'].lights=true;
 const lit=root.LWPet.restore(saved);assert(lit.query().alerts.some(a=>/lights are on/.test(a)));
 dark.step(ticks(10));lit.step(ticks(10));assert(need(dark,'joy')-need(lit,'joy')>1.2);
 assert.equal(lit.command({kind:'sleep'}).ok,true);assert.equal(lit.query().lights,false);
});
test('Neglect becomes care mistakes, health loss and finally departure; adopting starts a new egg',()=>{
 const s=hatched('pebble');s.step(ticks(60*14));
 const q=s.query();assert.equal(q.status,'departed');assert(q.pet.mistakes>=2);assert.equal(q.health,0);
 assert.equal(s.command({kind:'care',action:'cuddle'}).ok,false);
 assert.equal(s.command({kind:'adopt',species:'missing'}).ok,false);
 assert.equal(s.command({kind:'adopt',species:'mochi',name:'Bun'}).ok,true);
 const next=s.query();assert.equal(next.status,'alive');assert.equal(next.pet.stage,'egg');assert.equal(next.pet.name,'Bun');assert.equal(next.pet.mistakes,0);
});
test('Care quality selects the adult form: attentive grows Bloom, a casual caretaker who skips bedtime grows Bramble',()=>{
 const attentive=root.LWPetTools.simulate({policy:'attentive',minutes:900}),casual=root.LWPetTools.simulate({policy:'casual',minutes:900});
 assert.equal(attentive.stage,'adult');assert.equal(attentive.form,'bloom');assert(attentive.mistakes<=1);
 assert.equal(casual.status,'alive');assert.equal(casual.stage,'adult');assert.equal(casual.form,'bramble');assert(casual.mistakes>1);
 assert(attentive.milestones.some(m=>m.kind==='evolved'));
});
test('Commands are validated atomically and queries never advance time',()=>{
 const s=hatched(),before=JSON.stringify(s.checkpoint());
 for(const input of [null,[],{kind:'care'},{kind:'care',action:'meal',extra:1},{kind:'teleport'},{kind:'name',name:''},{kind:'name',name:'<script>'},{kind:'adopt',species:'mochi'}])
  assert.equal(s.command(input).ok,false,JSON.stringify(input));
 for(let i=0;i<20;i++)s.query();
 assert.equal(JSON.stringify(s.checkpoint()),before);
 assert.throws(()=>s.step(0));assert.throws(()=>s.step(1.5));
});
test('Checkpoints restore exactly and continue deterministically',()=>{
 const s=hatched();s.command({kind:'care',action:'meal'});s.step(ticks(80));
 const restored=root.LWPet.restore(JSON.parse(JSON.stringify(s.checkpoint())));
 s.step(ticks(120));restored.step(ticks(120));assert.equal(JSON.stringify(restored.checkpoint()),JSON.stringify(s.checkpoint()));
 const bad=JSON.parse(JSON.stringify(s.checkpoint())) as Mutable;
 for(const edit of [(c:Mutable)=>{c.format='x';},(c:Mutable)=>{c.entities.find((e:Mutable)=>e.id==='pet').components['pet-needs'].hunger=900;},(c:Mutable)=>{c.entities.push({id:'intruder',components:{}});},(c:Mutable)=>{c.entities.find((e:Mutable)=>e.id==='pet').components['pet-life'].model='dragon';},(c:Mutable)=>{c.catalog.actions=[];}]){
  const copy=JSON.parse(JSON.stringify(bad)) as Mutable;edit(copy);assert.throws(()=>root.LWPet.restore(copy));
 }
});
test('Tools discover bounded operations and reject unbounded experiments',()=>{
 const discover=root.LWPetTools.discover();assert.deepEqual(discover.operations,['discover','catalog','validate','simulate']);
 assert.throws(()=>root.LWPetTools.simulate({policy:'attentive',minutes:999999}));
 assert.throws(()=>root.LWPetTools.simulate({policy:'chaos' as LWPetTools.Policy,minutes:10}));
 assert.equal(root.LWPetTools.validate({format:'nope'}).ok,false);
});
const passed=results.filter(r=>r.passed).length;fs.writeFileSync(__dirname+'/pet-runtime-results.json',JSON.stringify({passed,total:results.length,results},null,2));
for(const r of results)if(!r.passed)console.error(r.name,r.error);console.log(passed+'/'+results.length);if(passed!==results.length)process.exitCode=1;
