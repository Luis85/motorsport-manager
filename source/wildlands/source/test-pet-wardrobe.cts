// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// Personalization and monetization boundaries: earned coins, owned products, sockets and store entitlements.
for(const file of ['ecs','pet-catalog','pet-systems','pet-session','pet-application'])require('./'+file+'.js');
const root=globalThis as unknown as {LWPet:LWPetRuntime.Api;LWPetCatalog:LWPetData.CatalogApi;LWPetApplication:LWPetApplication.Api};
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});}}
type Mutable=Record<string,any>;
const STEP_MINUTES=root.LWPetCatalog.defaults.rules.minutesPerSecond*root.LWPet.STEP;
const ticks=(minutes:number):number=>Math.round(minutes/STEP_MINUTES);
const coins=(s:LWPetRuntime.Session):number=>s.query().wardrobe.coins;
const offer=(s:LWPetRuntime.Session,id:string):LWPetRuntime.ProductView=>s.query().shop.find(p=>p.id===id)!;
function hatched(species='mochi'):LWPetRuntime.Session{const s=root.LWPet.create(undefined,species);s.step(ticks(21));return s;}
test('Care and growth earn catalog coins only when actions finish',()=>{
 const s=root.LWPet.create();assert.equal(coins(s),25);
 s.command({kind:'care',action:'cuddle'});assert.equal(coins(s),25,'accepted intent pays nothing yet');
 s.step(ticks(3)+1);assert.equal(coins(s),26);
 s.step(ticks(20));assert.equal(s.query().pet.stage,'baby');assert.equal(coins(s),41,'hatching awards growth coins');
 s.command({kind:'care',action:'play'});s.step(ticks(15)+1);assert.equal(coins(s),45);
});
test('Coin purchases debit exactly once and explain unaffordable offers',()=>{
 const s=hatched();assert.equal(coins(s),40);
 const scarf=offer(s,'knit-scarf');assert.equal(scarf.command,'buy');assert.equal(scarf.enabled,false);assert.equal(scarf.reason,'Needs 5 more coins');
 assert.equal(s.command({kind:'buy',product:'knit-scarf'}).ok,false);assert.equal(coins(s),40);
 assert.equal(s.command({kind:'buy',product:'party-hat'}).ok,true);assert.equal(coins(s),10);
 assert.equal(s.command({kind:'buy',product:'party-hat'}).message,'Already owned.');assert.equal(coins(s),10);
 assert.equal(offer(s,'party-hat').command,'equip');assert.equal(s.query().events.at(-1)!.kind,'bought');
});
test('Owned items equip into their socket slot and one item per slot is worn',()=>{
 const s=hatched();
 assert.equal(s.command({kind:'equip',product:'party-hat'}).message,'Buy Party hat first.');
 s.command({kind:'buy',product:'ribbon-bow'});assert.equal(s.command({kind:'equip',product:'ribbon-bow'}).ok,true);
 assert.deepEqual(s.query().wardrobe.accessories,[{slot:'hat',item:'ribbon-bow',asset:'acc-bow'}]);
 assert.equal(offer(s,'ribbon-bow').command,'unequip');
 assert.equal(s.command({kind:'unequip',slot:'hat'}).ok,true);assert.deepEqual(s.query().wardrobe.accessories,[]);
 assert.equal(s.command({kind:'unequip',slot:'hat'}).ok,false);assert.equal(s.command({kind:'unequip',slot:'tail'}).ok,false);
});
test('Skins change only material colours, respect species limits and start from the free default',()=>{
 const s=hatched('pebble');assert.equal(s.query().wardrobe.skin,'classic');assert.deepEqual(s.query().wardrobe.materials,{});
 s.step(ticks(60));s.command({kind:'care',action:'play'});s.step(ticks(16));
 const before=coins(s);assert(before>=40,'enough coins for mint');
 assert.equal(s.command({kind:'buy',product:'mint'}).ok,true);assert.equal(s.command({kind:'equip',product:'mint'}).ok,true);
 assert.equal(s.query().wardrobe.materials.skin,'#a8e6cf');
 const golden=offer(s,'golden');assert.equal(golden.enabled,false);assert.equal(golden.reason,'Not available for Pebble');
});
test('Premium offers unlock only through store entitlements, never coins',()=>{
 const s=hatched(),crown=offer(s,'golden-crown');assert.equal(crown.command,'store');
 assert.equal(s.command({kind:'buy',product:'golden-crown'}).message,'Golden crown is unlocked through the store.');
 assert.equal(s.command({kind:'equip',product:'golden-crown'}).ok,false);
 for(const bad of [{kind:'entitle',sku:'pocketpet.item.unknown',source:'demo-store'},{kind:'entitle',sku:'pocketpet.item.crown'},{kind:'entitle',sku:'pocketpet.item.crown',source:'Bad Source!'}])
  assert.equal(s.command(bad).ok,false,JSON.stringify(bad));
 const before=coins(s);
 assert.equal(s.command({kind:'entitle',sku:'pocketpet.item.crown',source:'demo-store'}).ok,true);assert.equal(coins(s),before);
 assert.equal(s.command({kind:'entitle',sku:'pocketpet.item.crown',source:'demo-store'}).message,'Already unlocked.');
 assert.equal(s.command({kind:'equip',product:'golden-crown'}).ok,true);assert.equal(s.query().wardrobe.equipped.hat,'golden-crown');
 assert.deepEqual(s.wardrobe().entitlements.map(e=>[e.sku,e.source]),[['pocketpet.item.crown','demo-store']]);
});
test('The wardrobe belongs to the owner: adoption, restart and checkpoints keep it',()=>{
 const s=hatched();s.command({kind:'buy',product:'party-hat'});s.command({kind:'equip',product:'party-hat'});s.command({kind:'entitle',sku:'pocketpet.skin.golden',source:'demo-store'});s.command({kind:'equip',product:'golden'});
 s.step(ticks(60*14));assert.equal(s.query().status,'departed');
 assert.equal(s.command({kind:'adopt',species:'pebble'}).ok,true);
 const w=s.query().wardrobe;assert.equal(w.equipped.hat,'party-hat');assert.equal(w.skin,'classic','a Mochi-only skin falls back for Pebble');
 assert(s.wardrobe().entitlements.some(e=>e.sku==='pocketpet.skin.golden'));
 const restored=root.LWPet.restore(JSON.parse(JSON.stringify(s.checkpoint())));assert.deepEqual(restored.wardrobe(),s.wardrobe());
 const app=root.LWPetApplication.create();app.enter();app.view.command({kind:'entitle',sku:'pocketpet.item.wings',source:'demo-store'});
 const saved=app.view.checkpoint();app.view.control('restart',{species:'mochi'});
 assert(app.view.query().shop.find(p=>p.id==='fairy-wings')!.owned,'restart keeps entitlements');
 app.view.replace(JSON.parse(JSON.stringify({...saved,entities:(saved.entities as Mutable[]).map(e=>e.id==='pet-owner'?{...e,components:{'pet-wardrobe':{...e.components['pet-wardrobe'],entitlements:[]}}}:e)})),'checkpoint');
 assert(app.view.query().shop.find(p=>p.id==='fairy-wings')!.owned,'restoring an older save never removes store entitlements');
});
test('Forged wardrobes and malformed shop catalogs are rejected before installation',()=>{
 const saved=hatched().checkpoint() as unknown as Mutable,owner=()=>saved.entities.find((e:Mutable)=>e.id==='pet-owner').components['pet-wardrobe'];
 for(const edit of [(w:Mutable)=>{w.coins=-1;},(w:Mutable)=>{w.owned=['dragon-hat'];},(w:Mutable)=>{w.equipped={hat:'golden-crown'};},(w:Mutable)=>{w.skin='midnight';},(w:Mutable)=>{w.entitlements=[{sku:'x',source:'s',minute:0}];}]){
  const copy=JSON.parse(JSON.stringify(saved)) as Mutable;const target=copy.entities.find((e:Mutable)=>e.id==='pet-owner').components['pet-wardrobe'];edit(target);
  assert.throws(()=>root.LWPet.restore(copy));
 }
 assert.equal(owner().coins,40);
 const base=():Mutable=>JSON.parse(JSON.stringify(root.LWPetCatalog.defaults)) as Mutable;
 for(const edit of [(c:Mutable)=>{c.skins[0].price={currency:'coins',amount:5};},(c:Mutable)=>{c.skins[1].materials={skin:'red'};},(c:Mutable)=>{c.items[0].slot='tail';},
  (c:Mutable)=>{c.items[0].asset='acc-missing';},(c:Mutable)=>{c.items[0].price={currency:'gems',amount:1};},(c:Mutable)=>{c.items[0].id=c.skins[1].id;},
  (c:Mutable)=>{c.skins[1].species=['dragon'];},(c:Mutable)=>{c.economy.startCoins=1.5;},(c:Mutable)=>{c.actions[0].coins=-1;},(c:Mutable)=>{c.items[4].price.sku='Bad SKU';}])
 {const c=base();edit(c);assert.throws(()=>root.LWPetCatalog.validate(c),/Pet catalog:/);}
});
const passed=results.filter(r=>r.passed).length;fs.writeFileSync(__dirname+'/pet-wardrobe-results.json',JSON.stringify({passed,total:results.length,results},null,2));
for(const r of results)if(!r.passed)console.error(r.name,r.error);console.log(passed+'/'+results.length);if(passed!==results.length)process.exitCode=1;
