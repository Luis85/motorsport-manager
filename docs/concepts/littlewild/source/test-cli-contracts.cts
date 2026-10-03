import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readJsonFile, writeJsonFile } from "./tools/cli-io.cjs";
const ROOT=path.resolve(__dirname,".."), authored=path.basename(__dirname)==="source";
const results:Array<{name:string;passed:boolean;error?:string}>=[];
function test(name:string, action:()=>void):void { try{action();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});} }
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"littlewild-cli-"));
const cli=(tool:string,args:string[])=>{
  const file=path.join(__dirname,"tools",tool+(authored?".cts":".cjs"));
  const result=spawnSync(process.execPath,[...(authored?["--import","tsx"]:[]),file,...args],{cwd:ROOT,encoding:"utf8",timeout:15000});
  assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.stderr,"");
  return {status:result.status,payload:JSON.parse(result.stdout)};
};
try {
  for(const tool of ["content-cli","adventure-cli","world-cli","growth-cli","scenario-cli","simulation-profile-cli"]){
    test(tool+" provides JSON help and rejects unknown/extra arguments",()=>{
      for(const args of [[],["--help"],["-h"]]){const r=cli(tool,args);assert.equal(r.status,0);assert.equal(r.payload.ok,true);assert.equal(typeof r.payload.usage,"string");}
      for(const args of [["--unknown"],["schema","unexpected","extra"]]){const r=cli(tool,args);assert.equal(r.status,2);assert.equal(r.payload.ok,false);}
    });
    test(tool+" distinguishes missing input from rejected content",()=>{
      const missing=cli(tool,["validate",path.join(temp,"missing.json")]);assert.equal(missing.status,2);assert.equal(missing.payload.ok,false);
      const invalid=path.join(temp,"invalid.json");fs.writeFileSync(invalid,"{}");const rejected=cli(tool,["validate",invalid]);assert.equal(rejected.status,1);assert.equal(rejected.payload.ok,false);
    });
  }
  test("Scenario and simulation CLI reject extra arguments before accessing input",()=>{
    for(const tool of ["scenario-cli","simulation-profile-cli"]){const result=cli(tool,["validate","missing.json","extra"]);assert.equal(result.status,2);assert(JSON.stringify(result.payload).includes("Usage"));}
  });
  test("Content normalize never overwrites input, including file aliases",()=>{
    const input=path.join(temp,"library.json"),alias=path.join(temp,"alias.json");
    fs.copyFileSync(path.join(ROOT,"source/content/default-library.json"),input);fs.linkSync(input,alias);const before=fs.readFileSync(input);
    for(const output of [input,alias]){const result=cli("content-cli",["normalize",input,"--out",output]);assert.equal(result.status,2);assert.equal(result.payload.ok,false);assert.deepEqual(fs.readFileSync(input),before);}
  });
  test("Rejected content preserves the requested output file",()=>{
    const input=path.join(temp,"invalid.json"),output=path.join(temp,"output.json");fs.writeFileSync(input,"{}");fs.writeFileSync(output,"keep");
    const result=cli("content-cli",["normalize",input,"--out",output]);assert.equal(result.status,1);assert.equal(result.payload.ok,false);assert.equal(fs.readFileSync(output,"utf8"),"keep");
  });
  test("Content CLI rejects ignored flags and duplicate paths",()=>{
    for(const args of [["schema","ignored"],["export","--base","missing"],["schema","--out","a","--out","b"],["validate","missing","--out","a"]]) assert.equal(cli("content-cli",args).status,2);
  });
  test("Atomic writes preserve unrelated fixed temporary and clean owned failure files",()=>{
    const destination=path.join(temp,"safe.json"),fixed=destination+".tmp";fs.writeFileSync(fixed,"other writer");writeJsonFile(destination,{ok:true});assert.equal(fs.readFileSync(fixed,"utf8"),"other writer");
    const directory=path.join(temp,"directory.json");fs.mkdirSync(directory);assert.throws(()=>writeJsonFile(directory,{ok:true}));assert.deepEqual(fs.readdirSync(temp).filter(name=>name.startsWith("directory.json.")),[]);
  });
  test("Bounded reads reject oversized and non-file input",()=>{
    const file=path.join(temp,"bounded.json");fs.writeFileSync(file,"12345");assert.equal(readJsonFile(file,5),"12345");assert.throws(()=>readJsonFile(file,4));assert.throws(()=>readJsonFile(temp,1024));
  });
  test("Scenario CLI retains the full runtime pack and story input budgets",()=>{
    const pack=path.join(temp,"large.pack.json");fs.writeFileSync(pack,fs.readFileSync(path.join(ROOT,"source/content/littlewild.pack.json"),"utf8")+" ".repeat(4*1024*1024));assert.equal(cli("scenario-cli",["validate",pack]).status,0);
    const fixture=spawnSync(process.execPath,["-e",`const L=require(${JSON.stringify(path.join(__dirname,"simulation.cjs"))}),S=require(${JSON.stringify(path.join(__dirname,"story-codec.js"))});process.stdout.write(JSON.stringify(S.encode(L.createWorldDemo())));`],{cwd:ROOT,encoding:"utf8",timeout:15000});assert.equal(fixture.status,0,fixture.stderr);
    const story=path.join(temp,"large-story.json"),output=path.join(temp,"captured.pack.json");fs.writeFileSync(story,fixture.stdout+" ".repeat(4*1024*1024));const captured=cli("scenario-cli",["capture",story,output]);assert.equal(captured.status,0);assert.equal(captured.payload.ok,true);assert.equal(JSON.parse(fs.readFileSync(output,"utf8")).schemaVersion,2);
  });
  test("Build help and usage failure do not compile or rewrite output",()=>{
    const artifact=path.join(ROOT,"littlewild.html"),before=fs.existsSync(artifact)?fs.readFileSync(artifact):null;
    const run=(args:string[])=>spawnSync(process.execPath,["--import","tsx",path.join(ROOT,"source/build.ts"),...args],{cwd:ROOT,encoding:"utf8",timeout:15000});
    assert.equal(run(["--help"]).status,0);
    for(const args of [["--unknown"],["--output","--pack"],["--output","one","--output","two"],["--output","source/style.css"],["--pack","source/content/littlewild.pack.json","--output","source/content/littlewild.pack.json"]]){const r=run(args);assert.equal(r.status,1);assert.match(r.stderr,/Build failed:/);assert.doesNotMatch(r.stderr,/at parseArgs/);}
    if(before)assert.deepEqual(fs.readFileSync(artifact),before);
  });
  test("Gate help and rejected flags preserve existing verification evidence",()=>{
    const evidence=path.join(ROOT,"verification","v15","gate-results.json"),before=fs.existsSync(evidence)?fs.readFileSync(evidence):null;
    const file=path.join(__dirname,"verification","verify.js");
    if(authored)throw new Error("CLI contract tests require generated executables; run npm run verify");
    for(const [args,status] of [[["--help"],0],[["--unknown"],2],[["--no-browser","--unknown"],2]] as const){
      const r=spawnSync(process.execPath,[file,...args],{cwd:ROOT,encoding:"utf8",timeout:15000});assert.equal(r.status,status,r.stderr);
      if(before)assert.deepEqual(fs.readFileSync(evidence),before);else assert.equal(fs.existsSync(evidence),false);
    }
  });
}finally{fs.rmSync(temp,{recursive:true,force:true});}
const report={passed:results.filter(r=>r.passed).length,total:results.length,failed:results.filter(r=>!r.passed).length,results};
if(!authored)fs.writeFileSync(path.join(__dirname,"cli-contract-results.json"),JSON.stringify(report,null,2)+"\n");
console.log(`${report.passed}/${report.total} CLI contract checks`);if(report.failed){console.error(results.filter(r=>!r.passed));process.exitCode=1;}
