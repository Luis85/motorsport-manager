// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// The application owns the only clock; navigation, queries and admission failures leave sessions unchanged.
for(const file of ['ecs','pet-catalog','pet-systems','pet-session','pet-application'])require('./'+file+'.js');
const root=globalThis as unknown as {LWPetApplication:LWPetApplication.Api};
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});}}
test('Navigation and detached queries never tick the session',()=>{
 const app=root.LWPetApplication.create(),saved=JSON.stringify(app.view.checkpoint());
 app.enter();for(let i=0;i<20;i++)app.view.query();app.exit();app.advance(2);
 assert.equal(JSON.stringify(app.view.checkpoint()),saved);
});
test('Frames advance fixed ticks with speed, bounded catch-up and pause',()=>{
 const app=root.LWPetApplication.create();app.enter();
 for(let i=0;i<10;i++)app.advance(.05);assert.equal(app.view.query().tick,5);
 app.view.control('speed',16);app.advance(.1);assert.equal(app.view.query().tick,21);
 app.advance(30);assert.equal(app.view.query().tick,21+16,'one frame contributes at most 0.1 s of real time');
 app.view.control('pause');app.advance(1);assert.equal(app.view.query().tick,37);
 assert.throws(()=>app.view.control('speed',3));assert.throws(()=>app.advance(-1));
});
test('Restart chooses a species and resets the clock',()=>{
 const app=root.LWPetApplication.create();app.enter();app.advance(.1);
 app.view.control('restart',{species:'pebble',name:'Pip'});
 const q=app.view.query();assert.equal(q.tick,0);assert.equal(q.pet.species,'pebble');assert.equal(q.pet.name,'Pip');assert.equal(app.view.status().paused,false);
});
test('Replacement admission is atomic for checkpoints and catalogs',()=>{
 const app=root.LWPetApplication.create();app.enter();app.view.command({kind:'care',action:'cuddle'});app.advance(.1);
 const saved=app.view.checkpoint(),before=JSON.stringify(saved);
 assert.throws(()=>app.view.replace({format:'wildlands-pet-checkpoint',schemaVersion:1,catalog:saved.catalog,entities:[]},'checkpoint'));
 assert.throws(()=>app.view.replace({format:'wildlands-pet'},'catalog'));
 assert.equal(JSON.stringify(app.view.checkpoint()),before);
 app.view.replace(JSON.parse(before),'checkpoint');assert.equal(JSON.stringify(app.view.checkpoint()),before);assert.equal(app.view.status().paused,true);
 const catalog=app.view.catalog();catalog.name='Tuned pet';catalog.rules.minutesPerSecond=4;app.view.replace(catalog,'catalog');
 assert.equal(app.view.catalog().name,'Tuned pet');assert.equal(app.view.query().tick,0);
});
const passed=results.filter(r=>r.passed).length;fs.writeFileSync(__dirname+'/pet-application-results.json',JSON.stringify({passed,total:results.length,results},null,2));
for(const r of results)if(!r.passed)console.error(r.name,r.error);console.log(passed+'/'+results.length);if(passed!==results.length)process.exitCode=1;
