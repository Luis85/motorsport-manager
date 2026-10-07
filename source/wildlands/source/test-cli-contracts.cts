// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readJsonFile, writeJsonFile } from "./tools/cli-io.cjs";
import { compileGame, gameDirectory } from "./tools/game-folder.cjs";
import { assembleGame, engineKit } from "./tools/game-build.cjs";
import { assembleArtifact } from "./tools/artifact-assembler.cjs";
import { gameProfile } from "./tools/artifact-profiles.cjs";
import { engineOnlySources } from "./tools/engine-sources.cjs";
import { declaredTunerErrors } from "./tools/balancing-audit.cjs";
import { gamesFixtureRoot, templateGame } from "./test-support/game-fixtures.cjs";
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
    fs.copyFileSync(path.join(ROOT,".generated/content/default-library.json"),input);fs.linkSync(input,alias);const before=fs.readFileSync(input);
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
    const pack=path.join(temp,"large.pack.json");fs.writeFileSync(pack,fs.readFileSync(path.join(ROOT,".generated/content/littlewild.pack.json"),"utf8")+" ".repeat(4*1024*1024));assert.equal(cli("scenario-cli",["validate",pack]).status,0);
    const fixture=spawnSync(process.execPath,["-e",`require(${JSON.stringify(path.join(__dirname,"test-support","install-games.cjs"))});const L=require(${JSON.stringify(path.join(__dirname,"simulation.cjs"))}),S=require(${JSON.stringify(path.join(__dirname,"story-codec.js"))});process.stdout.write(JSON.stringify(S.encode(L.createWorldDemo())));`],{cwd:ROOT,encoding:"utf8",timeout:15000});assert.equal(fixture.status,0,fixture.stderr);
    const story=path.join(temp,"large-story.json"),output=path.join(temp,"captured.pack.json");fs.writeFileSync(story,fixture.stdout+" ".repeat(4*1024*1024));const captured=cli("scenario-cli",["capture",story,output]);assert.equal(captured.status,0);assert.equal(captured.payload.ok,true);assert.equal(JSON.parse(fs.readFileSync(output,"utf8")).schemaVersion,2);
  });
  test("Content CLI text bounds match Unicode code-point limits",()=>{
    const fixtures:Array<[string,string,number,(d:any)=>any]>=[
      ["content-cli","default-library.json",90,d=>d.library],
      ["adventure-cli","adventure-library.json",80,d=>d.equipment[0]],
      ["world-cli","world-library.json",100,d=>d],
      ["growth-cli","growth-library.json",500,d=>d],
      ["scenario-cli","littlewild.pack.json",80,d=>d],
      ["simulation-profile-cli","simulation-profile.json",100,d=>d]
    ];
    for(const [tool,fixture,limit,target] of fixtures)for(const count of [limit,limit+1]){
      const doc=JSON.parse(fs.readFileSync(path.join(ROOT,".generated/content",fixture),"utf8"));target(doc).name="🌱".repeat(count);
      const input=path.join(temp,tool+"-unicode.json");fs.writeFileSync(input,JSON.stringify(doc));
      const result=cli(tool,["validate",input]);assert.equal(result.status,count===limit?0:1,tool+" at "+count);assert.equal(result.payload.ok,count===limit);
    }
  });
  test("Build help and usage failure do not compile or rewrite output",()=>{
    const artifact=path.join(ROOT,".generated/artifacts/showcase.html"),before=fs.existsSync(artifact)?fs.readFileSync(artifact):null;
    const run=(args:string[])=>spawnSync(process.execPath,["--import","tsx",path.join(ROOT,"source/build.ts"),...args],{cwd:ROOT,encoding:"utf8",timeout:15000});
    assert.equal(run(["--help"]).status,0);
    for(const args of [["--unknown"],["--output","--pack"],["--output","one","--output","two"],["--output","source/style.css"],["--pack",".generated/content/littlewild.pack.json","--output",".generated/content/littlewild.pack.json"],["--pack",".generated/content/littlewild.pack.json"]]){const r=run(args);assert.equal(r.status,1);assert.match(r.stderr,/Build failed:/);assert.doesNotMatch(r.stderr,/at parseArgs/);}
    if(before)assert.deepEqual(fs.readFileSync(artifact),before);
  });
  test("Build rejects symlinked protected parents before compiling or writing",()=>{
    const run=(args:string[])=>spawnSync(process.execPath,["--import","tsx",path.join(ROOT,"source/build.ts"),...args],{cwd:ROOT,encoding:"utf8",timeout:15000});
    const buildProject=path.dirname(fs.realpathSync(path.join(ROOT,"source")));
    const generated=path.join(buildProject,".generated","engine.js"),before=fs.readFileSync(generated);
    for(const [name,target] of [["authored","source"],["vendor","vendor"],["generated",".generated"]]){
      const alias=path.join(temp,name!);fs.symlinkSync(path.join(buildProject,target!),alias,"dir");
      const output=path.join(alias,"uncreated","rejected-output.html");const result=run(["--output",output]);
      assert.equal(result.status,1);assert.match(result.stderr,/outside authored and generated/);assert.equal(fs.existsSync(path.dirname(output)),false);
    }
    const nested=path.join(temp,"nested");fs.symlinkSync(path.join(temp,"authored"),nested,"dir");
    assert.equal(run(["--output",path.join(nested,"content","rejected-output.html")]).status,1);
    const alias=path.join(temp,"style-alias.css");const original=fs.readFileSync(path.join(ROOT,"source/style.css"));fs.symlinkSync(path.join(ROOT,"source/style.css"),alias);
    assert.equal(run(["--output",alias]).status,1);assert.deepEqual(fs.readFileSync(path.join(ROOT,"source/style.css")),original);
    const pack=path.join(temp,"input.json"),packAlias=path.join(temp,"input-link.json"),hardAlias=path.join(temp,"input-hard.json");fs.writeFileSync(pack,"retain input");fs.symlinkSync(pack,packAlias);fs.linkSync(pack,hardAlias);
    for(const output of [packAlias,hardAlias]){const result=run(["--pack",pack,"--output",output]);assert.equal(result.status,1);assert.match(result.stderr,/overwrite the input pack/);assert.equal(fs.readFileSync(pack,"utf8"),"retain input");}
    assert.deepEqual(fs.readFileSync(generated),before);
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
  test("Wildlands game commands keep the JSON protocol: usage errors exit 2 and rejected games exit 1",()=>{
    const game=gameDirectory("littlewild"),html=path.join(temp,"game.html");
    const usage:[string[],string|null][]=[[["validate-game"],"game-required"],[["inspect-game","--game"],null],[["build-game","--game",game],null],
      [["build-game","--game",game,"--output",html,"--check",html],null],[["build-game","--game",game,"--output",html,"--profile","editor"],null],
      [["build-game","--game",game,"--output",path.join(temp,"game.txt")],null],[["build-game","--game",game,"--output",path.join(game,"inside.html")],null],
      [["validate-game","--game",game,"--unknown","x"],null],[["build-game","--game",game,"--output",html,"--output",html],null]];
    for(const [args,code] of usage){const r=cli("wildlands-cli",args);assert.equal(r.status,2,args.join(" "));assert.equal(r.payload.ok,false);assert.equal(r.payload.protocolVersion,1);assert.equal(r.payload.code,code??"operation-failed",args.join(" "));assert.equal(r.payload.errors.length,1);}
    for(const command of ["validate-game","inspect-game","build-game"]){const r=cli("wildlands-cli",[command,"--game",path.join(temp,"no-such-game"),...command==="build-game"?["--output",html]:[]]);assert.equal(r.status,1,command);assert.equal(r.payload.code,"invalid-game");}
    assert(!fs.existsSync(html)&&!fs.existsSync(path.join(game,"inside.html")));
  });
  test("Game builds place exactly what the build assembler places for the same profile",()=>{
    const games=gamesFixtureRoot("wildlands-placement-");
    try{
      for(const folder of [gameDirectory("littlewild"),templateGame("rts",games),templateGame("pet",games)]){
        const game=compileGame(folder),built=assembleGame(game,"play"),candidate=gameProfile(game.manifest,"play",new Set(game.data.keys()));
        const reference=assembleArtifact(candidate,{source:path.join(ROOT,"source"),generated:path.join(ROOT,".generated"),data:game.data});
        const meta=`<meta name="wildlands-engine" content="${engineKit().identity}"><meta name="wildlands-game-digest" content="${game.digest}">\n`;
        assert.equal(built.html.split(meta).length,2,game.manifest.id);assert.equal(built.html.replace(meta,""),reference.html,game.manifest.id);
        assert.deepEqual(built.manifest.segments,reference.manifest.segments);
      }
    }finally{fs.rmSync(games,{recursive:true,force:true});}
  });
  test("Engine distributions carry no game: engine-only sources, runtime closure and kit hold engine data only",()=>{
    const generated=path.join(ROOT,".generated"),text=fs.readFileSync(path.join(generated,"engine-source-bundle.json"),"utf8"),engine=engineOnlySources(text);
    const files=(JSON.parse(engine) as {files:{path:string;sha256:string}[]}).files,pending=(JSON.parse(fs.readFileSync(path.join(ROOT,"source/architecture/engine-data.json"),"utf8")) as {pending:{pattern:string}[]}).pending;
    assert(!files.some(file=>file.path.startsWith("games/")));assert.equal(engineOnlySources(engine),engine,"idempotent");
    for(const entry of pending){const pattern=new RegExp("^source/"+entry.pattern.replace(/[.]/g,"\\.").replace(/\*/g,"[^/]+")+"$");assert(!files.some(file=>pattern.test(file.path)),entry.pattern);}
    assert.equal((JSON.parse(engine) as {identity:string}).identity,createHash("sha256").update(files.map(file=>file.path+"\0"+file.sha256+"\n").join("")).digest("hex"));
    const runtime=JSON.parse(fs.readFileSync(path.join(generated,"wildlands-runtime-bundle.json"),"utf8")) as {files:{path:string}[]};
    assert.deepEqual(runtime.files.filter(file=>file.path.endsWith(".json")&&!/^runtime\/content\/[a-z0-9-]+\.schema\.json$/.test(file.path)),[]);
    const kit=JSON.stringify(engineKit()),pack=JSON.parse(fs.readFileSync(path.join(gameDirectory("littlewild"),"content/littlewild.pack.json"),"utf8")) as {description:string};
    assert(pack.description.length>40&&!kit.includes(pack.description),"the engine kit carries no scenario content");
    assert.deepEqual(declaredTunerErrors(["/simulation/rules/gameplay/a/b"],{simulation:{rules:{gameplay:{a:{b:1}}}}}),[]);
    assert.deepEqual(declaredTunerErrors(["/simulation/rules/gameplay/a/b","/simulation/rules/gameplay/a/c"],{simulation:{rules:{gameplay:{a:{b:1,d:2}}}}}),
      ["undeclared gameplay consumer /simulation/rules/gameplay/a/c","Declared tuner has no runtime consumer: /simulation/rules/gameplay/a/d"]);
  });
}finally{fs.rmSync(temp,{recursive:true,force:true});}
const report={passed:results.filter(r=>r.passed).length,total:results.length,failed:results.filter(r=>!r.passed).length,results};
if(!authored)fs.writeFileSync(path.join(__dirname,"cli-contract-results.json"),JSON.stringify(report,null,2)+"\n");
console.log(`${report.passed}/${report.total} CLI contract checks`);if(report.failed){console.error(results.filter(r=>!r.passed));process.exitCode=1;}
