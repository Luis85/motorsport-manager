import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { type Page } from "playwright";
import { launchBrowser, monitorContext } from "./browser-harness";

interface Result { name:string; passed:boolean; error?:string; }

const ROOT=path.resolve(__dirname,"../..");
const OUTPUT=path.join(ROOT,"verification","v15");
const SHOTS=path.join(ROOT,"screenshots","browser");
const CAPTURE_SCREENSHOTS=process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==="1";
fs.mkdirSync(OUTPUT,{recursive:true});if(CAPTURE_SCREENSHOTS)fs.mkdirSync(SHOTS,{recursive:true});
const results:Result[]=[];
fs.rmSync(path.join(OUTPUT,"browser-results.json"),{force:true});
fs.rmSync(path.join(OUTPUT,"browser-fatal-results.json"),{force:true});
let diagnostics: ReturnType<typeof monitorContext>;

async function check(name:string,fn:()=>unknown|Promise<unknown>):Promise<void>{
 try{const value=await fn();assert.notEqual(value,false,"Check returned false");results.push({name,passed:true});}
 catch(error){results.push({name,passed:false,error:error instanceof Error?error.message:String(error)});process.stderr.write("FAIL "+name+" "+String(error).slice(0,240)+"\n");}
 fs.writeFileSync(path.join(OUTPUT,"browser-progress.json"),JSON.stringify(results,null,2)+"\n");
}
const equal=(a:unknown,b:unknown):void=>assert.deepEqual(a,b);
const expect=(value:unknown):void=>assert.ok(value);
const screenshot=(page:Page,name:string)=>CAPTURE_SCREENSHOTS?page.screenshot({path:path.join(SHOTS,name),animations:"disabled"}):Promise.resolve();

async function main():Promise<void>{
 const browser=await launchBrowser();
 let activePage:Page|null=null;
 try {
 const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
 diagnostics=monitorContext(context);
 const p=await context.newPage();activePage=p;p.setDefaultTimeout(5000);
 await p.setContent(fs.readFileSync(path.join(ROOT,"littlewild.html"),"utf8"),{waitUntil:"load"});
 await p.waitForFunction(() => !!(window as any).Littlewild);await p.waitForTimeout(250);
 await check("Application identifies the new implementation",async()=>equal(await p.evaluate("Littlewild.version"),"15.0.0"));
 await p.locator("[data-act=begin]").click();await p.waitForTimeout(250);
 await check("Fresh start launches an authored scene",async()=>equal(await p.evaluate("Littlewild.engine.scenarioContext.sceneId"),"first-morning"));
 await check("Fresh onboarding is non-modal",async()=>expect(await p.locator("#guide-panel").isVisible()&&await p.evaluate("Littlewild.ui.modal===null&&!document.getElementById('app').inert")));
 await p.evaluate("JSON.stringify(Littlewild.engine.export())");
 await p.locator("[data-guide=next]").click();
 await check("Tutorial next advances only the saved guide index",async()=>equal(await p.evaluate("Littlewild.engine.s.progression.tutorial.step"),1));
 await p.locator("[data-guide=minimize]").click();
 await check("Guide collapses without losing its step",async()=>expect(await p.locator("#guide-panel").evaluate(el=>el.classList.contains("minimized"))));
 await p.locator("[data-guide=expand]").click();await p.locator("#guide-step").selectOption("3");
 await p.locator("[data-guide=show]").click();await p.waitForTimeout(250);
 await check("Show me opens real construction without a task",async()=>expect(await p.locator("#build-panel").isVisible()));
 await check("Fresh build catalog hides unresearched blueprints",async()=>expect(await p.locator(".build-row").count()<23));
 await check("World is not inert while planning",async()=>equal(await p.evaluate("document.getElementById('app').inert"),false));
 await p.evaluate("Littlewild.open('scenarios')");
 await p.locator("[data-scenario=review][data-id=charted-home]").click();
 await check("Scene review is a safety pause",async()=>equal(await p.evaluate("Littlewild.pauseStatus().kind"),"safety"));
 await p.locator("[data-scenario=launch]").click();await p.waitForTimeout(400);
 await check("Established scene has three companions",async()=>equal(await p.evaluate("Littlewild.engine.creatures.length"),3));
 await p.evaluate("Littlewild.open('construction')");await p.waitForTimeout(100);
 await check("Build panel is a complementary region not a modal",async()=>equal(await p.locator("#build-panel").evaluate(el=>el.tagName+":"+el.getAttribute("aria-modal")),"ASIDE:null"));
 await check("Automatic pause setting covers the build panel",async()=>equal(await p.evaluate("Littlewild.pauseStatus().running"),false));
 await check("Build panel leaves over 70% of desktop world uncovered",async()=>expect(await p.locator("#build-panel").evaluate(el=>{const r=el.getBoundingClientRect();return r.width*r.height<innerWidth*innerHeight*.3;})));
 await check("Build panel has a visible close label",async()=>equal(await p.locator("#build-panel [data-build=close]").getAttribute("aria-label"),"Close build panel"));
 await p.locator("#build-search").fill("map");
 await check("Build search narrows the catalog",async()=>equal(await p.locator(".build-row").count(),1));
 await p.locator("#build-search").fill("zzzzzz");
 await check("Empty search has recovery guidance",async()=>expect((await p.locator("#build-results").innerText()).includes("No matching")));
 await p.locator("#build-search").fill("");
 await p.locator("#build-category").selectOption({index:1});
 await check("Category filter reduces displayed blueprints",async()=>expect(await p.locator(".build-row").count()<23));
 await p.locator("#build-category").selectOption("all");
 await p.locator("#build-search").focus();await p.keyboard.press("F6");
 await check("F6 returns focus to the world",async()=>equal(await p.evaluate("document.activeElement.id"),"world"));
 await p.keyboard.press("F6");
 await check("F6 returns focus to the panel",async()=>expect(await p.evaluate("document.getElementById('build-panel').contains(document.activeElement)")));
 const camera=await p.evaluate("JSON.stringify(Littlewild.world.camera)");
 await p.mouse.move(660,540);await p.mouse.down();await p.mouse.move(710,560,{steps:5});await p.mouse.up();await p.waitForTimeout(100);
 await check("Dragging the exposed world moves the camera",async()=>expect(camera!==await p.evaluate("JSON.stringify(Littlewild.world.camera)")));
 await check("Panning does not dismiss the construction catalog",async()=>expect(await p.locator("#build-panel").isVisible()));
 await p.evaluate("Littlewild.preferences.set(false);Littlewild.refresh()");
 let start=await p.evaluate("Littlewild.engine.s.simTime") as number;
 await p.waitForFunction(startTime=>(window as any).Littlewild.engine.s.simTime>startTime,start,{timeout:2500});
 await check("World runs behind a panel with automatic pause disabled",async()=>expect((await p.evaluate("Littlewild.engine.s.simTime") as number)>start));
 await p.evaluate("Littlewild.engine.s.paused=true;Littlewild.refresh()");
 start=await p.evaluate("Littlewild.engine.s.simTime") as number;await p.waitForTimeout(300);
 await check("Manual pause still wins behind live panels",async()=>equal(await p.evaluate("Littlewild.engine.s.simTime"),start));
 await p.evaluate("Littlewild.engine.s.paused=false;Littlewild.preferences.set(true);Littlewild.refresh()");
 await p.locator("[data-build=select][data-id=shelter]").click();
 await check("Blueprint detail explains physical supplies",async()=>expect((await p.locator("#build-panel").innerText()).includes("not used remotely")));
 await p.locator("#build-actor").selectOption("c1");
 const priorPolicy=await p.evaluate("Littlewild.engine.s.buildPolicy.approach");
 await p.locator("#build-approach").selectOption("careful");
 await check("Explicit construction approach stays in the draft",async()=>equal(await p.evaluate("Littlewild.buildPanel.state.approach"),"careful"));
 await check("Changing the approach does not mutate the creature policy",async()=>equal(await p.evaluate("Littlewild.engine.s.buildPolicy.approach"),priorPolicy));
 await p.locator("[data-build=place]").click();
 await check("Choosing a location dismisses the panel and starts placement",async()=>expect(!await p.locator("#build-panel").isVisible()&&await p.evaluate("Littlewild.world.placement==='shelter'")));
 await check("Placement retains the requested actor",async()=>equal(await p.evaluate("Littlewild.engine.selected.id"),"c1"));
 await p.keyboard.press("Escape");
 await check("Escape cancels placement without creating a plan",async()=>equal(await p.evaluate("Littlewild.world.placement"),null));
 await p.evaluate("Littlewild.open('construction')");await p.locator("[data-build=select][data-id=map_table]").click();
 await check("Map table remains discoverable in researched build detail",async()=>expect((await p.locator("#build-panel").innerText()).includes("Map table")));
 await p.locator("[data-build=list]").click();await p.locator("#build-search").fill("work");
 await p.locator("[data-build=close]").click();await p.evaluate("Littlewild.open('construction')");
 await check("Catalog draft survives dismissal",async()=>equal(await p.locator("#build-search").inputValue(),"work"));
 await p.locator("#build-search").fill("");
 await screenshot(p,"01-build.png");
 await p.locator("[data-build=select][data-id=shelter]").click();await screenshot(p,"02-blueprint.png");
 await p.evaluate("Littlewild.open('v10-guide')");await p.locator("#guide-step").selectOption("2");
 await screenshot(p,"03-tutorial.png");
 await check("Guide preserves access to the canvas",async()=>equal(await p.evaluate("document.getElementById('app').inert"),false));
 await p.locator("[data-guide=show]").click();
 await check("Tutorial links to actual learning workspace",async()=>equal(await p.evaluate("Littlewild.ui.modal"),"training"));
 await check("Guide is minimized behind its linked workspace",async()=>expect(await p.evaluate("Littlewild.guidePanel.state.minimized")));
 await p.locator("#modal [data-act=close-modal]").first().click();await p.evaluate("Littlewild.open('scenarios')");
 await screenshot(p,"04-scenarios.png");
 const current=await p.evaluate("Littlewild.engine.scenarioContext.packId");
 await p.locator("[data-scenario=select][data-id='1']").click();
 await p.locator("[data-scenario=review]").last().click();await p.locator("[data-scenario=cancel]").click();
 await check("Canceling a scene review preserves active experience",async()=>equal(await p.evaluate("Littlewild.engine.scenarioContext.packId"),current));
 const [download]=await Promise.all([p.waitForEvent("download"),p.locator("[data-scenario=export]").click()]);
 const downloadPath=await download.path();assert.ok(downloadPath);
 const exported=JSON.parse(fs.readFileSync(downloadPath,"utf8"));
 await check("Actual pack download contains schema 2, simulation profile, scenes and four libraries",()=>expect(exported.format==="living-worlds-pack"&&exported.schemaVersion===2&&exported.simulation.id==="classic-v1"&&Object.keys(exported.libraries).length===4));
 const malformed=JSON.stringify({format:"living-worlds-pack",schemaVersion:99});
 await p.locator("#scenario-import-file").setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from(malformed)});await p.waitForTimeout(150);
 await check("Rejected imports leave the world intact and explain errors",async()=>expect((await p.locator(".validation-issue").innerText()).includes("not applied")&&await p.evaluate("Littlewild.engine.scenarioContext.packId")===current));
 const custom=JSON.parse(fs.readFileSync(path.join(ROOT,"source","content","emberworks.pack.json"),"utf8"));custom.name="Tidewatch";custom.id="tidewatch";custom.presentation.title="Tidewatch";
 await p.locator("#scenario-import-file").setInputFiles({name:"tidewatch.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(custom))});await p.waitForTimeout(200);
 await check("Valid imported pack enters catalog without replacing world",async()=>expect((await p.locator(".scenario-packs").innerText()).includes("Tidewatch")&&await p.evaluate("Littlewild.engine.scenarioContext.packId")===current));
 await p.locator("[data-scenario=review]").last().click();await p.locator("[data-scenario=launch]").click();await p.waitForTimeout(300);
 await check("Confirmed pack launch uses imported presentation",async()=>expect((await p.title())==="Wildlands · Tidewatch"&&(await p.locator(".brand-word").innerText())==="Wildlands"));
 await check("Confirmed pack launch uses imported companion setup",async()=>equal(await p.evaluate("Littlewild.engine.creatures[0].name"),"Rivet"));
 await check("Confirmed pack changes real definition names",async()=>equal(await p.evaluate("LW.BUILDINGS.bench.name"),"Assembly bench"));
 await check("World terrain reads the selected authored profile",async()=>equal(await p.evaluate("LWGeography.islandTerrain(14,1)"),"water"));
 await check("Scenario save envelope 10 includes the exact world and simulation profiles",async()=>expect(await p.evaluate(()=>{const d=(window as any).Littlewild.snapshot();return d.version===10&&d.experience.schemaVersion===2&&d.experience.simulation.id==="classic-v1"&&typeof d.simulationFingerprint==="string";})));
 await screenshot(p,"05-emberworks.png");
 await p.evaluate("Littlewild.open('scenarios')");
 const [captured]=await Promise.all([p.waitForEvent("download"),p.locator("[data-scenario=capture]").click()]);
 const capturedPath=await captured.path();assert.ok(capturedPath);const saved=fs.readFileSync(capturedPath,"utf8");
 await check("Captured current scene downloads as a valid schema 2 pack with its simulation profile",async()=>expect(await p.evaluate(text=>{const pack=JSON.parse(text as string);return pack.schemaVersion===2&&pack.simulation&&(window as any).LWScenarios.validate(pack).ok;},saved)));
 await p.evaluate(()=>{const w=window as any;w._originalText=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>setTimeout(()=>w._originalText.call(this).then(resolve),400));};});
 await p.locator("#scenario-import-file").setInputFiles({name:"later.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(custom))});
 await p.locator("#modal [data-act=close-modal]").first().click();await p.waitForTimeout(550);
 await check("Delayed import cannot reopen a dismissed library",async()=>equal(await p.evaluate("Littlewild.ui.modal"),null));
 await p.evaluate(()=>{File.prototype.text=(window as any)._originalText;});

 for(const [width,height] of [[1440,900],[1024,768],[768,1024],[390,844],[320,568],[844,390]] as const){
  await p.setViewportSize({width,height});await p.evaluate("Littlewild.open('construction')");await p.waitForTimeout(100);
  if(await p.locator(".build-row").count()===0&&await p.locator("[data-build=list]").count()>0){
   await p.locator("[data-build=list]").click();await p.waitForTimeout(20);
  }
  const tag=`${width}x${height}`;
  await check(tag+": build panel fits viewport",async()=>{
   expect(await p.locator("#build-panel").evaluate(el=>{const r=el.getBoundingClientRect(),toolbar=document.getElementById("wildlands-workspace")!.getBoundingClientRect();return r.x>=0&&r.top>=toolbar.bottom&&r.right<=innerWidth&&r.bottom<=innerHeight;}));
   await p.locator("#build-panel [data-build=close]").click();
   expect(await p.locator("#build-panel").isHidden());
   await p.evaluate("Littlewild.open('construction')");await p.waitForTimeout(100);
   expect(await p.locator("#build-panel").isVisible());
  });
  await check(tag+": world remains visible beside/above Build",async()=>expect(await p.locator("#build-panel").evaluate(el=>{const r=el.getBoundingClientRect();return r.width*r.height<innerWidth*innerHeight*.65;})));
  await check(tag+": build footer remains reachable",async()=>expect(await p.locator("#build-panel .panel-footer").evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight)));
  await check(tag+": no horizontal page overflow",async()=>expect(await p.evaluate("document.documentElement.scrollWidth<=innerWidth")));
  await p.locator(".build-row").first().click();await p.locator("#build-actor").selectOption("c1");
  await p.locator("[data-build=place]").scrollIntoViewIfNeeded();
  await check(tag+": primary placement action scrolls into view",async()=>expect(await p.locator("[data-build=place]").isVisible()));
  await p.evaluate("Littlewild.open('v10-guide')");await p.waitForTimeout(80);
  await check(tag+": guide fits without covering entire world",async()=>expect(await p.locator("#guide-panel").evaluate(el=>{const r=el.getBoundingClientRect(),toolbar=document.getElementById("wildlands-workspace")!.getBoundingClientRect();return r.x>=0&&r.top>=toolbar.bottom&&r.bottom<=innerHeight&&r.width*r.height<innerWidth*innerHeight*.58;})));
  await check(tag+": guide footer remains reachable",async()=>expect(await p.locator("#guide-panel .panel-footer").evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight)));
  await p.locator("[data-guide=close]").click();
 }
 await check("No uncaught browser errors in tested flows",()=>equal(diagnostics.errors,[]));
 await check("No console warnings or errors in tested flows",()=>equal(diagnostics.consoleProblems,[]));
 await check("Game makes no HTTP/HTTPS requests",()=>equal(diagnostics.requests,[]));
 } catch(error) {
  const failure={status:"failed",viewport:activePage?.viewportSize()??null,
   error:error instanceof Error?error.stack??error.message:String(error),
   completedResults:results,diagnosticsAvailable:!!diagnostics,...diagnostics};
  try{fs.writeFileSync(path.join(OUTPUT,"browser-fatal-results.json"),JSON.stringify(failure,null,2)+"\n");}
  catch(reportError){process.stderr.write("Could not retain fatal browser evidence: "+String(reportError)+"\n");}
  throw error;
 } finally { await browser.close(); }

 const report={passed:results.filter(x=>x.passed).length,total:results.length,failed:results.filter(x=>!x.passed).length,results,...diagnostics};
 fs.writeFileSync(path.join(OUTPUT,"browser-results.json"),JSON.stringify(report,null,2)+"\n");
 process.stdout.write(`${report.passed}/${report.total}\n`);
 if(report.failed)process.exitCode=1;
}

main().catch(error=>{process.stderr.write(String(error)+"\n");process.exitCode=1;});
