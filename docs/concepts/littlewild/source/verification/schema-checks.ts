import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020";

interface Result {name:string;passed:boolean;error?:string;}
const ROOT=path.resolve(__dirname,"../.."),CONTENT=path.join(ROOT,"source","content"),GENERATED=path.join(ROOT,".generated");
const results:Result[]=[];
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
function check(name:string,action:()=>void):void{try{action();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error instanceof Error?error.message:String(error)});}}
function makeValidator(schema:any){const ajv=new Ajv2020({allErrors:true,strict:false});return {ajv,validate:ajv.compile(schema)};}
const scenarioSchema=JSON.parse(fs.readFileSync(path.join(CONTENT,"scenario.schema.json"),"utf8"));
const simulationSchema=JSON.parse(fs.readFileSync(path.join(CONTENT,"simulation.schema.json"),"utf8"));
const defaultProfile=JSON.parse(fs.readFileSync(path.join(CONTENT,"simulation-profile.json"),"utf8"));
function valid(schema:any,value:any):void{const {ajv,validate}=makeValidator(schema);assert.equal(validate(value),true,ajv.errorsText(validate.errors));}
function invalid(schema:any,value:any):void{const {validate}=makeValidator(schema);assert.equal(validate(value),false,"Expected invalid input");}
function runJson(args:string[]){const r=spawnSync(process.execPath,args,{cwd:ROOT,encoding:"utf8",timeout:45000});if(r.error)throw r.error;const payload=r.stdout.trim()?JSON.parse(r.stdout):{};return {r,payload};}

check("Scenario schema validates its own structure",()=>{makeValidator(scenarioSchema);});
check("Simulation profile schema validates its own structure",()=>{makeValidator(simulationSchema);});
check("Default simulation profile validates independently",()=>valid(simulationSchema,defaultProfile));
check("Default profile embeds exact standalone actor and economy rules",()=>{assert.deepEqual(defaultProfile.rules.actor,JSON.parse(fs.readFileSync(path.join(CONTENT,"actor-rules.json"),"utf8")));assert.deepEqual(defaultProfile.rules.economy,JSON.parse(fs.readFileSync(path.join(CONTENT,"economy-rules.json"),"utf8")));});
check("Scenario schema embeds the exact simulation profile definitions",()=>{const actual=Object.fromEntries(Object.keys(simulationSchema.$defs).map(key=>[key,scenarioSchema.$defs[key]]));assert.deepEqual(actual,simulationSchema.$defs);});

const unsupported=copy(defaultProfile);unsupported.archetype.actorDynamics.push("run-imported-code");
check("Independent profile schema rejects unknown compiled systems",()=>invalid(simulationSchema,unsupported));
const reordered=copy(defaultProfile);reordered.archetype.engineLayers.reverse();
check("Independent profile schema rejects reordered engine layers",()=>invalid(simulationSchema,reordered));
const unknown=copy(defaultProfile);unknown.execute="alert(1)";
check("Independent profile schema rejects unknown behavior-shaped fields",()=>invalid(simulationSchema,unknown));

for(const name of ["littlewild","emberworks"]){
 const file=path.join(CONTENT,name+".pack.json"),document=JSON.parse(fs.readFileSync(file,"utf8"));
 check(name+" publishes scenario schema 2",()=>assert.equal(document.schemaVersion,2));
 check(name+" embeds a valid simulation profile",()=>valid(simulationSchema,document.simulation));
 check(name+" validates with independent JSON Schema",()=>valid(scenarioSchema,document));
 for(const [field,value] of [["schemaVersion",99],["script","execute"],["worlds",[]],["scenes",[]],["tutorial",[]]] as const){
  const bad=copy(document);bad[field]=value;check(name+" rejects "+field,()=>invalid(scenarioSchema,bad));
 }
 {const bad=copy(document);bad.worlds[0].placementPolicy="invisible";check(name+" rejects unsupported site policy",()=>invalid(scenarioSchema,bad));}
 {const bad=copy(document);delete bad.simulation;check(name+" schema 2 rejects a missing simulation profile",()=>invalid(scenarioSchema,bad));}
 {const bad=copy(document);bad.simulation.archetype.worldTransactions.reverse();check(name+" rejects unsupported transaction ordering",()=>invalid(scenarioSchema,bad));}
 const before=fs.readFileSync(file);
 const {r,payload}=runJson([path.join(GENERATED,"tools","scenario-cli.cjs"),"validate",file]);
 check(name+" CLI validates",()=>{assert.equal(r.status,0);assert(payload.ok);assert.equal(payload.pack,document.id);assert.equal(payload.scenes,document.scenes.length);assert(payload.fingerprint);assert.equal(Object.hasOwn(payload,"sourceSchemaVersion"),false);});
 check(name+" CLI reports its simulation profile",()=>{assert.equal(payload.simulationProfile,document.simulation.id);assert.equal(payload.compositionArchetype,document.simulation.archetype.id);});
 check(name+" CLI leaves input unchanged",()=>assert.equal(Buffer.compare(fs.readFileSync(file),before),0));
}

const oldSchema=JSON.parse(fs.readFileSync(path.join(CONTENT,"littlewild.pack.json"),"utf8"));oldSchema.schemaVersion=1;delete oldSchema.simulation;
check("Independent schema rejects obsolete schema 1 packs",()=>invalid(scenarioSchema,oldSchema));

const temp=fs.mkdtempSync(path.join(os.tmpdir(),"littlewild-schema-"));
try{
 const obsoletePath=path.join(temp,"obsolete.pack.json");fs.writeFileSync(obsoletePath,JSON.stringify(oldSchema));
 let result=runJson([path.join(GENERATED,"tools","scenario-cli.cjs"),"validate",obsoletePath]);
 check("Scenario CLI rejects obsolete schema 1 without migration",()=>{assert.equal(result.r.status,1);assert.equal(result.payload.ok,false);});
 const output=path.join(temp,"export.pack.json");
 let r=spawnSync(process.execPath,[path.join(GENERATED,"tools","scenario-cli.cjs"),"export","littlewild",output],{cwd:ROOT,encoding:"utf8",timeout:45000});
 const exported=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,"utf8")):{};
 check("Export CLI creates a complete schema 2 pack",()=>{assert.equal(r.status,0);assert.equal(exported.schemaVersion,2);valid(scenarioSchema,exported);valid(simulationSchema,exported.simulation);});
 const currentStory=path.join(temp,"current-story.json");
 const storyRuntime=path.join(GENERATED,"simulation.cjs"),storyCodec=path.join(GENERATED,"story-codec.js");
 const storyScript=`const L=require(${JSON.stringify(storyRuntime)}),S=require(${JSON.stringify(storyCodec)});process.stdout.write(JSON.stringify(S.encode(L.createWorldDemo())));`;
 const story=spawnSync(process.execPath,["-e",storyScript],{cwd:ROOT,encoding:"utf8",timeout:45000});
 check("Current story fixture can be generated for capture",()=>{assert.equal(story.status,0,story.stderr);assert(story.stdout.trim());});
 fs.writeFileSync(currentStory,story.stdout);
 const captured=path.join(temp,"captured.pack.json");
 r=spawnSync(process.execPath,[path.join(GENERATED,"tools","scenario-cli.cjs"),"capture",currentStory,captured],{cwd:ROOT,encoding:"utf8",timeout:45000});
 const capture=fs.existsSync(captured)?JSON.parse(fs.readFileSync(captured,"utf8")):{};
 check("Capture CLI creates a schema 2 template from a current story",()=>{assert.equal(r.status,0,r.stderr);assert.equal(capture.schemaVersion,2);valid(scenarioSchema,capture);valid(simulationSchema,capture.simulation);});
 const profileExport=path.join(temp,"profile.json");
 result=runJson([path.join(GENERATED,"tools","simulation-profile-cli.cjs"),"export",profileExport]);
 const emitted=fs.existsSync(profileExport)?JSON.parse(fs.readFileSync(profileExport,"utf8")):{};
 check("Simulation profile CLI exports the validated current profile",()=>{assert.equal(result.r.status,0);assert(result.payload.ok);valid(simulationSchema,emitted);assert.equal(emitted.id,"classic-v1");});
}finally{fs.rmSync(temp,{recursive:true,force:true});}

for(const command of ["validate","fingerprint"]){
 const source=path.join(CONTENT,"simulation-profile.json"),before=fs.readFileSync(source);
 const {r,payload}=runJson([path.join(GENERATED,"tools","simulation-profile-cli.cjs"),command,source]);
 check("Simulation profile CLI "+command+" succeeds",()=>{assert.equal(r.status,0);assert(payload.ok);assert.equal(payload.profile,"classic-v1");assert.equal(payload.archetype,"living-world-v1");assert(payload.fingerprint);});
 check("Simulation profile CLI "+command+" leaves input unchanged",()=>assert.equal(Buffer.compare(fs.readFileSync(source),before),0));
}
const exposed=runJson([path.join(GENERATED,"tools","simulation-profile-cli.cjs"),"schema"]);
check("Simulation profile CLI exposes the canonical schema",()=>{assert.equal(exposed.r.status,0);assert.equal(exposed.payload.$id,simulationSchema.$id);assert.deepEqual(exposed.payload.$defs,simulationSchema.$defs);});

const report={passed:results.filter(r=>r.passed).length,total:results.length,failed:results.filter(r=>!r.passed).length,results};
fs.mkdirSync(GENERATED,{recursive:true});fs.writeFileSync(path.join(GENERATED,"scenario-schema-results.json"),JSON.stringify(report,null,2)+"\n");
process.stdout.write(`${report.passed}/${report.total}\n`);if(report.failed)process.exitCode=1;
