import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import Ajv2020 from "ajv/dist/2020";

interface Result { name:string; passed:boolean; error?:string; }
const ROOT=path.resolve(__dirname,"../..");
const CONTENT=path.join(ROOT,"source","content");
const GENERATED=path.join(ROOT,".generated");
const results:Result[]=[];
function check(name:string,fn:()=>void):void{try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error instanceof Error?error.message:String(error)});}}
function json(file:string):unknown{return JSON.parse(fs.readFileSync(path.join(CONTENT,file),"utf8"));}
function validator(schema:unknown){const ajv=new Ajv2020({allErrors:true,strict:false});return {ajv,validate:ajv.compile(schema)};}
function valid(schema:unknown,doc:unknown):void{const {ajv,validate}=validator(schema);assert.equal(validate(doc),true,ajv.errorsText(validate.errors));}
function invalid(schema:unknown,doc:unknown):void{const {validate}=validator(schema);assert.equal(validate(doc),false,"Invalid definition was accepted.");}
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value));}

for(const [name,file,schemaFile] of [["Base","default-library.json","library.schema.json"],["Adventure","adventure-library.json","adventure.schema.json"],["World","world-library.json","world.schema.json"],["Growth","growth-library.json","growth.schema.json"]] as const){
 const doc=json(file) as Record<string,unknown>,schema=json(schemaFile);
 check(name+" schema is well formed",()=>{validator(schema);});
 check(name+" default library validates independently",()=>valid(schema,doc));
 const bad=clone(doc);
 if(name==="Adventure"){bad.format="not-an-adventure-library";check(name+" rejects an unsupported format",()=>invalid(schema,bad));}
 else{bad.unsupported_engine_field=true;check(name+" rejects unknown root properties",()=>invalid(schema,bad));}
}
const growthSchema=json("growth.schema.json"),growth=json("growth-library.json") as any;
for(const [key,value] of [["maxSlots",0],["maxSlots",9],["maxIslands",0],["maxIslands",50],["landGrowth",1],["marketSeconds",0]] as const){
 const bad=clone(growth);bad.rules[key]=value;check(`Growth rejects ${key}=${value}`,()=>invalid(growthSchema,bad));
}
check("Extra event/interaction example passes independent schema",()=>valid(growthSchema,JSON.parse(fs.readFileSync(path.join(ROOT,"examples","new-island-interaction.json"),"utf8"))));
const report={passed:results.filter(r=>r.passed).length,total:results.length,failed:results.filter(r=>!r.passed).length,results};
fs.mkdirSync(GENERATED,{recursive:true});fs.writeFileSync(path.join(GENERATED,"v10-schema-results.json"),JSON.stringify(report,null,2)+"\n");
process.stdout.write(`${report.passed}/${report.total} independent schema checks passed\n`);if(report.failed)process.exitCode=1;
