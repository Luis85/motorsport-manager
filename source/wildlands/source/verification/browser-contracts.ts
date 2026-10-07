import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { ACTION_TIMEOUT_MS, ARTIFACT_FIXTURE_URL, fixtureUrl, launchBrowser, monitorContext, openArtifact, READY_TIMEOUT_MS, settle, TRANSITION_TIMEOUT_MS, waitForReady } from "./browser-harness";
import { gameDirectory, gamesRoot } from "../tools/game-folder.cjs";

interface Result{name:string;passed:boolean;error?:string;}
const ROOT=path.resolve(__dirname,"../.."),OUT=path.join(ROOT,"verification","v15");
fs.mkdirSync(OUT,{recursive:true});const results:Result[]=[];
let diagnostics:ReturnType<typeof monitorContext>;
fs.rmSync(path.join(OUT,"browser-contract-results.json"),{force:true});
async function check(name:string,action:()=>unknown|Promise<unknown>):Promise<void>{try{assert.notEqual(await action(),false);results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error instanceof Error?error.message:String(error)});process.stderr.write("FAIL "+name+" "+String(error)+"\n");}}
const eq=(a:unknown,b:unknown)=>assert.deepEqual(a,b);
// The placement, HUD and expedition contracts need only the colony; its play artifact carries all of them.
const ARTIFACT=path.join(ROOT,".generated/artifacts/colony-play.html"),CUSTOM_URL=fixtureUrl("custom-emberworks");
/** The authored project inputs `npm run build` reads (sources, vendor files, manifests and compiler configuration). */
const PROJECT_INPUTS=["source","vendor","package.json","package-lock.json",...fs.readdirSync(ROOT).filter(name=>/^tsconfig[^/]*\.json$/.test(name))];

/** Hard-link a dependency tree (copying across devices) so the isolated project resolves its own real paths. */
function linkTree(from:string,to:string):void{
 fs.mkdirSync(to,{recursive:true});
 for(const entry of fs.readdirSync(from,{withFileTypes:true})){
  const source=path.join(from,entry.name),target=path.join(to,entry.name);
  if(entry.isDirectory())linkTree(source,target);
  else if(entry.isSymbolicLink())fs.symlinkSync(fs.readlinkSync(source),target);
  else try{fs.linkSync(source,target);}catch{fs.copyFileSync(source,target);}
 }
}

/**
 * Run the real `npm run build -- --pack ... --output ...` in an isolated copy of the authored project, so its
 * compile step never rewrites the shared .generated output that concurrent suites load. node_modules is linked
 * file by file rather than symlinked: the engine-source payload records the toolchain by real path, and the
 * isolated build is byte-identical to an in-place one only when those paths resolve inside the copy.
 */
function customBuild(pack:string,output:string,timeoutMs=180_000):{done:Promise<void>;cleanup:()=>void}{
 const project=fs.mkdtempSync(path.join(os.tmpdir(),"wildlands-custom-build-"));
 for(const name of PROJECT_INPUTS)fs.cpSync(path.join(ROOT,name),path.join(project,name),{recursive:true});
 linkTree(path.join(ROOT,"node_modules"),path.join(project,"node_modules"));
 const done=new Promise<void>((resolve,reject)=>{
  const child=spawn("npm",["run","build","--silent","--","--pack",pack,"--output",output],{cwd:project,env:{...process.env,WILDLANDS_GAMES_DIR:gamesRoot()},stdio:["ignore","pipe","pipe"]});
  let log="";child.stdout.on("data",chunk=>{log+=String(chunk);});child.stderr.on("data",chunk=>{log+=String(chunk);});
  const timer=setTimeout(()=>child.kill("SIGKILL"),timeoutMs);
  child.on("error",error=>{clearTimeout(timer);reject(error);});
  child.on("close",(status,signal)=>{clearTimeout(timer);if(status===0)resolve();else reject(new Error((log.trim()||"Custom build failed")+(signal?" ("+signal+")":"")));});
 });
 return {done,cleanup:()=>fs.rmSync(project,{recursive:true,force:true,maxRetries:5,retryDelay:200})};
}

async function main():Promise<void>{
 // The custom build compiles for tens of seconds; it runs in its isolated project while the colony contracts run.
 const artifact=path.join(OUT,"emberworks.html");fs.rmSync(artifact,{force:true});
 const build=customBuild(path.join(gameDirectory("emberworks"),"content/emberworks.pack.json"),artifact);
 build.done.catch(()=>undefined);
 const browser=await launchBrowser();
 try {
 const context=await browser.newContext({viewport:{width:1440,height:900}});diagnostics=monitorContext(context,{fixtureUrls:[ARTIFACT_FIXTURE_URL,CUSTOM_URL]});
 let page=await context.newPage();page.setDefaultTimeout(ACTION_TIMEOUT_MS);
 await openArtifact(page,ARTIFACT);await waitForReady(page,{host:"colony",timeout:READY_TIMEOUT_MS});
 // The land-demo handler installs its scene synchronously before the click resolves.
 await page.locator("[data-act=land-demo]").click({timeout:TRANSITION_TIMEOUT_MS});
 await page.evaluate("Littlewild.engine.s.paused=true;Littlewild.refresh()");
 const before=await page.evaluate("Littlewild.engine.creatures.map(c=>({id:c.id,n:c.orders.length,approach:c.buildPolicy.approach}))") as any[];
 await page.evaluate("Littlewild.open('construction')");await page.locator("[data-build=select][data-id=shelter]").click();
 await page.locator("#build-actor").selectOption("c2");await page.locator("#build-approach").selectOption("careful");
 await check("Alternate builder selection does not mutate either creature policy",async()=>eq(await page.evaluate("Littlewild.engine.creatures.map(c=>({id:c.id,n:c.orders.length,approach:c.buildPolicy.approach}))"),before));
 await page.locator("[data-build=place]").click();
 const tile=await page.evaluate(()=>{const e=(window as any).Littlewild.engine;for(let y=1;y<18;y++)for(let x=1;x<18;x++)if(e.canBuild(x,y)&&!e.placementIssue("shelter",x,y))return{x,y};throw Error("No free plot");});
 await page.evaluate(target=>{const app=(window as any).Littlewild;app.world.hover=target;app.world.keyboardTile=target;},tile);
 await page.locator("#world").focus();await page.keyboard.press("Enter");
 await settle(page,expected=>(window as any).Littlewild.engine.creatures.find((c:any)=>c.id==="c2").orders.length>expected,before[1]!.n);
 const order=await page.evaluate("Littlewild.engine.creatures.find(c=>c.id==='c2').orders.at(-1)") as any;
 await check("Keyboard placement creates an actual construction task",()=>eq(order.type,"build"));
 await check("Placement targets the explicitly assigned companion",async()=>eq(await page.evaluate("Littlewild.engine.creatures.find(c=>c.id==='c2').orders.length"),before[1]!.n+1));
 await check("Placement does not add an order to the first creature",async()=>eq(await page.evaluate("Littlewild.engine.creatures[0].orders.length"),before[0]!.n));
 await check("Placed task retains the draft construction approach",()=>eq(order.approach,"careful"));
 await check("Placement keeps existing per-creature default policy",async()=>eq(await page.evaluate("Littlewild.engine.creatures[1].buildPolicy.approach"),before[1]!.approach));
 await check("Placing a plan does not pay remote supplies",()=>eq(order.paid,false));
 const saved=await page.evaluate("Littlewild.snapshot()");
 await check("Placed plan round-trips through scenario-aware save",async()=>await page.evaluate(doc=>{const w=window as any;const e=w.LWStory.commit(w.LWStory.inspect(doc));return e.creatures.find((c:any)=>c.id==="c2").orders.at(-1).approach==="careful";},saved));
 await check("No browser errors during placement/save workflow",()=>eq(diagnostics.errors,[]));
 const rosterUpdate=await page.evaluate(()=>{
  const app=(window as any).Littlewild;app.engine.selectCreature("c1");app.refresh();
  const button=document.querySelector<HTMLButtonElement>('#creature-roster [data-id="c1"]')!;button.focus();
  const before=JSON.stringify(app.engine.export());app.refresh();app.refresh();
  return{sameButton:document.querySelector('#creature-roster [data-id="c1"]')===button,focused:document.activeElement===button,unchanged:JSON.stringify(app.engine.export())===before};
 });
 await check("Companion HUD updates preserve keyed roster button identity",()=>eq(rosterUpdate.sameButton,true));
 await check("Companion HUD updates retain keyboard focus",()=>eq(rosterUpdate.focused,true));
 await check("Companion HUD rendering does not advance or mutate the colony",()=>eq(rosterUpdate.unchanged,true));
 const selectionStates=await page.evaluate(()=>{
  const app=(window as any).Littlewild,en=app.engine,c=en.selected,selectedId=en.s.colony.selectedId,quest=c.activeQuest;
  try{
   // This temporary view fixture checks HUD gating, not a physical expedition.
   c.activeQuest={status:"away",name:"HUD transition fixture",elapsed:5,duration:20,returnRemaining:0};app.refresh();
   const away=document.body.classList.contains("cx-away")&&!(document.getElementById("cx-interaction-gate") as HTMLElement).hidden&&(document.getElementById("focus-select") as HTMLSelectElement).disabled&&document.getElementById("task-label")!.textContent==="Beyond the glade";
   c.activeQuest=quest;en.s.colony.selectedId=null;app.refresh();
   const unselected=document.body.classList.contains("cx-unselected")&&!(document.getElementById("cx-interaction-gate") as HTMLElement).hidden&&document.getElementById("header-pocket")!.textContent==="—";
   en.selectCreature(selectedId);app.refresh();
   const restored=!document.body.classList.contains("cx-away")&&!document.body.classList.contains("cx-unselected")&&(document.getElementById("cx-interaction-gate") as HTMLElement).hidden&&!(document.getElementById("focus-select") as HTMLSelectElement).disabled;
   return{away,unselected,restored};
  }finally{c.activeQuest=quest;en.selectCreature(selectedId);app.refresh();}
 });
 await check("Companion HUD gates interactions while away or unselected",()=>{eq(selectionStates.away,true);eq(selectionStates.unselected,true);});
 await check("Companion HUD restores available interactions after selection",()=>eq(selectionStates.restored,true));
 await page.evaluate("Littlewild.open('adventures')");
 const questFilter=await page.evaluate(()=>{
  const filter=document.getElementById("v11-quest-island") as HTMLSelectElement;filter.focus();filter.value=filter.options[1]!.value;
  const modal=document.getElementById("modal")!,observer=new MutationObserver(()=>{});observer.observe(modal,{childList:true});
  filter.dispatchEvent(new Event("change",{bubbles:true}));const redraws=observer.takeRecords().length;observer.disconnect();
  return{redraws,focused:document.activeElement?.id==="v11-quest-island",value:(document.getElementById("v11-quest-island") as HTMLSelectElement).value,expected:filter.value};
 });
 await check("Changing expedition origin redraws its workspace exactly once",()=>eq(questFilter.redraws,1));
 await check("Expedition origin change preserves selection and keyboard focus",()=>{eq(questFilter.focused,true);eq(questFilter.value,questFilter.expected);});
 await build.done;
 page=await context.newPage();page.setDefaultTimeout(ACTION_TIMEOUT_MS);await page.setViewportSize({width:1280,height:800});await openArtifact(page,artifact,{url:CUSTOM_URL});await waitForReady(page,{host:"colony",timeout:READY_TIMEOUT_MS});
 await check("Custom-build welcome is branded from its input pack",async()=>eq(await page.title(),"Wildlands · Emberworks"));
 await check("Custom artifact contains one selectable pack",async()=>eq(await page.evaluate("LWScenarios.builtins().length"),1));
 // Begin installs the pack's first scene synchronously before the click resolves.
 await page.locator("[data-act=begin]").click({timeout:TRANSITION_TIMEOUT_MS});
 await check("Custom-build start uses the pack-defined first scene",async()=>eq(await page.evaluate("Littlewild.engine.scenarioContext.sceneId"),"workshop-first-morning"));
 await check("Custom-build start uses the authored companion name",async()=>eq(await page.evaluate("Littlewild.engine.creatures[0].name"),"Rivet"));
 await check("Custom-build start uses an authored world profile",async()=>eq(await page.evaluate("LWWorldProfile.current.name"),"Copper Shore"));
 await check("No uncaught errors across both pack workflows",()=>eq(diagnostics.errors,[]));
 await check("No console warnings or errors across both pack workflows",()=>eq(diagnostics.consoleProblems,[]));
 await check("No HTTP/HTTPS requests across both pack workflows",()=>eq(diagnostics.requests,[]));
 } finally { await browser.close(); await build.done.catch(()=>undefined); build.cleanup(); }
 const report={passed:results.filter(r=>r.passed).length,total:results.length,failed:results.filter(r=>!r.passed).length,results,...diagnostics};
 fs.writeFileSync(path.join(OUT,"browser-contract-results.json"),JSON.stringify(report,null,2)+"\n");process.stdout.write(`${report.passed}/${report.total}\n`);if(report.failed)process.exitCode=1;
}
main().catch(error=>{process.stderr.write(String(error)+"\n");process.exitCode=1;});
