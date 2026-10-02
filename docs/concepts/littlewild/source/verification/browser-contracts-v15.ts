import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

interface Result{name:string;passed:boolean;error?:string;}
const ROOT=path.resolve(__dirname,"../.."),OUT=path.join(ROOT,"verification","v15");
fs.mkdirSync(OUT,{recursive:true});const results:Result[]=[];
async function check(name:string,action:()=>unknown|Promise<unknown>):Promise<void>{try{assert.notEqual(await action(),false);results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error instanceof Error?error.message:String(error)});process.stderr.write("FAIL "+name+" "+String(error)+"\n");}}
const eq=(a:unknown,b:unknown)=>assert.deepEqual(a,b);

async function main():Promise<void>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
 let page=await browser.newPage({viewport:{width:1440,height:900}});const errors:string[]=[];
 page.on("pageerror",error=>errors.push(String(error)));
 await page.setContent(fs.readFileSync(path.join(ROOT,"littlewild.html"),"utf8"),{waitUntil:"load"});await page.waitForFunction("window.Littlewild");
 await page.locator("[data-act=land-demo]").click();await page.waitForTimeout(200);
 await page.evaluate("Littlewild.engine.s.paused=true;Littlewild.refresh()");
 const before=await page.evaluate("Littlewild.engine.creatures.map(c=>({id:c.id,n:c.orders.length,approach:c.buildPolicy.approach}))") as any[];
 await page.evaluate("Littlewild.open('construction')");await page.locator("[data-build=select][data-id=shelter]").click();
 await page.locator("#build-actor").selectOption("c2");await page.locator("#build-approach").selectOption("careful");
 await check("Alternate builder selection does not mutate either creature policy",async()=>eq(await page.evaluate("Littlewild.engine.creatures.map(c=>({id:c.id,n:c.orders.length,approach:c.buildPolicy.approach}))"),before));
 await page.locator("[data-build=place]").click();
 const tile=await page.evaluate(()=>{const e=(window as any).Littlewild.engine;for(let y=1;y<18;y++)for(let x=1;x<18;x++)if(e.canBuild(x,y)&&!e.placementIssue("shelter",x,y))return{x,y};throw Error("No free plot");});
 await page.evaluate(target=>{const app=(window as any).Littlewild;app.world.hover=target;app.world.keyboardTile=target;},tile);
 await page.locator("#world").focus();await page.keyboard.press("Enter");await page.waitForTimeout(100);
 const order=await page.evaluate("Littlewild.engine.creatures.find(c=>c.id==='c2').orders.at(-1)") as any;
 await check("Keyboard placement creates an actual construction task",()=>eq(order.type,"build"));
 await check("Placement targets the explicitly assigned companion",async()=>eq(await page.evaluate("Littlewild.engine.creatures.find(c=>c.id==='c2').orders.length"),before[1]!.n+1));
 await check("Placement does not add an order to the first creature",async()=>eq(await page.evaluate("Littlewild.engine.creatures[0].orders.length"),before[0]!.n));
 await check("Placed task retains the draft construction approach",()=>eq(order.approach,"careful"));
 await check("Placement keeps existing per-creature default policy",async()=>eq(await page.evaluate("Littlewild.engine.creatures[1].buildPolicy.approach"),before[1]!.approach));
 await check("Placing a plan does not pay remote supplies",()=>eq(order.paid,false));
 const saved=await page.evaluate("Littlewild.snapshot()");
 await check("Placed plan round-trips through scenario-aware save",async()=>await page.evaluate(doc=>{const w=window as any;const e=w.LWStory.commit(w.LWStory.inspect(doc));return e.creatures.find((c:any)=>c.id==="c2").orders.at(-1).approach==="careful";},saved));
 const fixture=path.join(ROOT,"source","fixtures","actual-v14-story.json");
 if(fs.existsSync(fixture)){
  const doc=JSON.parse(fs.readFileSync(fixture,"utf8"));await page.evaluate(doc=>{const w=window as any;w.Littlewild.setEngine(w.LWStory.commit(w.LWStory.inspect(doc)));},doc);
  await check("Authentic v14 browser story stays format 8",async()=>eq(await page.evaluate("Littlewild.snapshot().version"),8));
  await check("Authentic v14 story keeps its creature skills",async()=>eq(await page.evaluate("Littlewild.snapshot().state.colony.creatures.map(c=>c.skills)"),doc.state.colony.creatures.map((c:any)=>c.skills)));
 }
 await check("No browser errors during placement/save workflow",()=>eq(errors,[]));
 const artifact=path.join(OUT,"emberworks.html");
 const build=spawnSync("npm",["run","build","--silent","--","--pack","source/content/emberworks.pack.json","--output",artifact],{cwd:ROOT,encoding:"utf8",timeout:120000});
 if(build.status!==0)throw new Error(build.stderr||build.stdout||"Custom build failed");
 page=await browser.newPage({viewport:{width:1280,height:800}});await page.setContent(fs.readFileSync(artifact,"utf8"),{waitUntil:"load"});await page.waitForFunction("window.Littlewild");
 await check("Custom-build welcome is branded from its input pack",async()=>(await page.title()).startsWith("Emberworks"));
 await check("Custom artifact contains one selectable pack",async()=>eq(await page.evaluate("LWScenarios.builtins().length"),1));
 await page.locator("[data-act=begin]").click();await page.waitForTimeout(100);
 await check("Custom-build start uses the pack-defined first scene",async()=>eq(await page.evaluate("Littlewild.engine.scenarioContext.sceneId"),"workshop-first-morning"));
 await check("Custom-build start uses the authored companion name",async()=>eq(await page.evaluate("Littlewild.engine.creatures[0].name"),"Rivet"));
 await check("Custom-build start uses an authored world profile",async()=>eq(await page.evaluate("LWWorldProfile.current.name"),"Copper Shore"));
 await browser.close();
 const report={passed:results.filter(r=>r.passed).length,total:results.length,failed:results.filter(r=>!r.passed).length,results};
 fs.writeFileSync(path.join(OUT,"browser-contract-results.json"),JSON.stringify(report,null,2)+"\n");process.stdout.write(`${report.passed}/${report.total}\n`);if(report.failed)process.exitCode=1;
}
main().catch(error=>{process.stderr.write(String(error)+"\n");process.exitCode=1;});
