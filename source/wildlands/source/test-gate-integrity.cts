// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCommand } from "./verification/process-runner";
import { assertAuthoredTypescript, executableFiles } from "./verification/release-integrity";
import { acceptedCounts, parseGateArgs, sourceIdentity } from "./verification/gate-integrity";
import { gateRunnerChecks } from "./verification/gate-runner-checks";
const results: Array<{name:string;passed:boolean;error?:string}> = [];
function test(name: string, action: () => void): void {
  try { action(); results.push({name,passed:true}); }
  catch (error) { results.push({name,passed:false,error:String(error)}); }
}
const good = () => ({passed:2,total:2,results:[{name:"first",passed:true},{name:"second",passed:true}]});
test("Explicit distinct passing evidence is accepted", () => assert.deepEqual(acceptedCounts(good()),{passed:2,total:2}));
for (const [name, payload] of [
  ["missing evidence", {passed:2,total:2}], ["null", null], ["array", []],
  ["false row", {...good(),results:[{name:"first",passed:false},{name:"second",passed:true}]}],
  ["truthy row", {...good(),results:[{name:"first",passed:"true"},{name:"second",passed:true}]}],
  ["missing pass", {...good(),results:[{name:"first"},{name:"second",passed:true}]}],
  ["duplicate name", {...good(),results:[{name:"first",passed:true},{name:"first",passed:true}]}],
  ["blank name", {...good(),results:[{name:"",passed:true},{name:"second",passed:true}]}],
  ["summary disagreement", {...good(),total:3}], ["missing total", {passed:2,results:good().results}],
  ["string counts", {...good(),passed:"2"}], ["negative failure", {...good(),failed:-1}],
  ["hidden error", {...good(),results:[{name:"first",passed:true,error:"failed"},{name:"second",passed:true}]}],
  ["null row", {...good(),results:[null,{name:"second",passed:true}]}]
] as const) test("Rejects " + name, () => assert.throws(() => acceptedCounts(payload)));
test("Gate accepts only documented flags", () => {
  assert.deepEqual(parseGateArgs([]),{noBrowser:false,help:false});
  assert.equal(parseGateArgs(["--no-browser"]).noBrowser,true);
  assert.equal(parseGateArgs(["--help"]).help,true);
  for (const args of [["--typo"],["--no-browser","--typo"],["--no-browser","--no-browser"]]) assert.throws(()=>parseGateArgs(args));
});
test("Source identity detects content, rename and deletion but ignores generated evidence", () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"littlewild-gate-"));
  try {
    fs.mkdirSync(path.join(temp,"source")); fs.mkdirSync(path.join(temp,"vendor")); fs.mkdirSync(path.join(temp,"examples"));
    for(const file of ["package.json","package-lock.json","tsconfig.json","tsconfig.strict.json"]) fs.writeFileSync(path.join(temp,file),"{}");
    const file=path.join(temp,"source","input.ts");fs.writeFileSync(file,"a");const before=sourceIdentity(temp);
    fs.mkdirSync(path.join(temp,".generated"));fs.writeFileSync(path.join(temp,".generated","results.json"),"{}");assert.equal(sourceIdentity(temp),before);
    fs.writeFileSync(path.join(temp,"source","focus-results.json"),"{}");assert.equal(sourceIdentity(temp),before);
    fs.writeFileSync(path.join(temp,"examples","example.json"),"{}");assert.notEqual(sourceIdentity(temp),before);fs.rmSync(path.join(temp,"examples","example.json"));
    fs.writeFileSync(file,"b");assert.notEqual(sourceIdentity(temp),before);fs.writeFileSync(file,"a");
    fs.renameSync(file,path.join(temp,"source","renamed.ts"));assert.notEqual(sourceIdentity(temp),before);
    fs.rmSync(path.join(temp,"source","renamed.ts"));assert.notEqual(sourceIdentity(temp),before);
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
});
test("Compiler configuration additions, edits and deletion invalidate source evidence", () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"littlewild-compiler-identity-"));
  try {
    for(const directory of ["source","vendor","examples"])fs.mkdirSync(path.join(temp,directory));
    for(const file of ["package.json","package-lock.json","tsconfig.json","tsconfig.strict.json"])fs.writeFileSync(path.join(temp,file),"{}");
    const baseline=sourceIdentity(temp),sdk=path.join(temp,"tsconfig.sdk.json");
    fs.writeFileSync(sdk,'{"compilerOptions":{"declaration":true}}');const added=sourceIdentity(temp);assert.notEqual(added,baseline);
    fs.writeFileSync(sdk,'{"compilerOptions":{"declaration":false}}');const edited=sourceIdentity(temp);assert.notEqual(edited,added);
    fs.rmSync(sdk);assert.equal(sourceIdentity(temp),baseline);
    fs.rmSync(path.join(temp,"tsconfig.strict.json"));assert.throws(()=>sourceIdentity(temp),/Required compiler configuration/);
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
test("Release rejects literal legacy executable extensions in nested authored folders", () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"littlewild-release-"));
  try {
    fs.mkdirSync(path.join(temp,"tools"));fs.writeFileSync(path.join(temp,"tools","adapter.cts"),"export {};");assertAuthoredTypescript(temp);
    for(const extension of ["js","cjs","mjs","jsx","py","JS"]){const file=path.join(temp,"tools","legacy."+extension);fs.writeFileSync(file,"");assert.throws(()=>assertAuthoredTypescript(temp),/legacy/);assert.deepEqual(executableFiles(temp),[file]);fs.rmSync(file);}
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
});
test("Process failures retain stdout, stderr and timeout diagnostics", () => {
  const failure=runCommand(["node","-e","console.log('progress');console.error('reason');process.exit(7)"],process.cwd(),5);
  assert.equal(failure.status,7);assert.match(String(failure.stdout),/progress/);assert.match(String(failure.stderr),/reason/);
  const timeout=runCommand(["node","-e","console.log('started');setInterval(()=>{},1000)"],process.cwd(),0.5);
  assert.equal((timeout.error as NodeJS.ErrnoException).code,"ETIMEDOUT");assert.equal(timeout.signal,"SIGKILL");assert.match(String(timeout.stdout),/started/);
});
if(process.platform==="linux")test("Timeout cleanup terminates child processes as well as their parent", () => {
  const run=runCommand(["node","-e","const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(child.pid);setInterval(()=>{},1000)"],process.cwd(),0.5);
  const pid=Number(String(run.stdout).trim());assert(Number.isInteger(pid)&&pid>0);
  try {
    const start=Date.now();let running=true;
    while(running&&Date.now()-start<1000){
      try{const stat=fs.readFileSync(`/proc/${pid}/stat`,"utf8");running=!/\) [ZX] /.test(stat);}
      catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;running=false;}
      if(running)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);
    }
    assert.equal(running,false,"Timed-out descendant survived process-group cleanup");
  } finally {try{process.kill(pid,"SIGKILL");}catch(error){if((error as NodeJS.ErrnoException).code!=="ESRCH")throw error;}}
});
// Registry, expectations, parallel runner and sleep-policy checks (reviewed additions) run after the
// original synchronous checks so the historical names keep their order.
async function finish(): Promise<void> {
  for(const [name,action] of gateRunnerChecks(path.resolve(__dirname,".."),path.basename(__dirname)===".generated")){
    try { await action(); results.push({name,passed:true}); }
    catch (error) { results.push({name,passed:false,error:String(error)}); }
  }
  const report={passed:results.filter(r=>r.passed).length,total:results.length,failed:results.filter(r=>!r.passed).length,results};
  if(path.basename(__dirname)===".generated")fs.writeFileSync(path.join(__dirname,"gate-integrity-results.json"),JSON.stringify(report,null,2)+"\n");
  console.log(`${report.passed}/${report.total} gate integrity checks`);if(report.failed){console.error(results.filter(r=>!r.passed));process.exitCode=1;}
}
void finish();
