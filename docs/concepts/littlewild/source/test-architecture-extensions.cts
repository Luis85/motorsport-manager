/// <reference path="./engine-core-contracts.d.ts" />
/// <reference path="./runtime-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import ts from 'typescript';
import {ownershipErrors,executableDataErrors,DataManifest} from './tools/architecture-data.cjs';
import {contractErrors} from './tools/architecture-contracts.cjs';
interface Spec {id:string;role:string;methods:string[];wraps:string[];staticMethods:string[];staticWraps:string[];}
interface Engine extends Function {prototype:Record<string,unknown>;import(input:unknown):unknown;}
interface Installed extends Spec {predecessors:Record<string,string>;}
interface Installer {manifest:Spec[];install(engine:Engine,ids?:string[]):Installed[];describe(engine:Engine):Installed[];}
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error instanceof Error?error.message:String(error)});}}
function fixture():{root:Record<string,unknown>;api:Installer;engine:Engine}{
 const root:Record<string,unknown>={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'application-adapters.js'),'utf8'),root);
 const api=root.LWApplicationAdapters as Installer;
 const engine=class {[key:string]:unknown;static import(value:unknown){return value;}} as Engine;
 const added=new Set(api.manifest.flatMap(spec=>spec.methods));
 for(const spec of api.manifest)for(const name of spec.wraps)if(!added.has(name))engine.prototype[name]=function(){return ['base'];};
 for(const spec of api.manifest)root[spec.role]={install(target:Engine){
  for(const name of spec.methods)target.prototype[name]=function(){return [spec.id];};
  for(const name of spec.wraps){const predecessor=target.prototype[name] as (this:unknown)=>string[];target.prototype[name]=function(this:unknown){return [...predecessor.call(this),spec.id];};}
  for(const name of spec.staticMethods)Object.defineProperty(target,name,{value:Object.freeze([]),configurable:true});
  for(const name of spec.staticWraps){const predecessor=Reflect.get(target,name) as (input:unknown)=>unknown;Reflect.set(target,name,function(this:Engine,value:unknown){return predecessor.call(this,value);});}
 }};
 return {root,api,engine};
}
test('Closed adapter plan retains predecessor ownership and synchronous wrapper order',()=>{
 const {api,engine}=fixture(),prototype=engine.prototype,records=api.install(engine);
 assert.strictEqual(engine.prototype,prototype);assert.equal(records.length,8);
 const start=engine.prototype.startTask as ()=>string[];assert.deepEqual(start(),['base','interactions','scenario-workflow','interiors']);
 assert.equal(records.at(-1)?.predecessors.startTask,'scenario-workflow');assert.equal(records.at(-1)?.predecessors.finishTask,'construction');
 assert(Object.isFrozen(api.manifest)&&Object.isFrozen(records)&&Object.isFrozen(records.at(-1)?.predecessors));
 assert.strictEqual(api.describe(engine),records);assert.throws(()=>api.install(engine),/already installed/);
});
test('Adapter duplicates missing roles wrong order and missing predecessors reject before mutation',()=>{
 for(const action of ['duplicate','missing-role','wrong-order','missing-predecessor']){
  const {api,root,engine}=fixture(),ids=api.manifest.map(entry=>entry.id),before=Object.getOwnPropertyDescriptors(engine.prototype);
  if(action==='duplicate')ids[1]=ids[0]!;
  if(action==='missing-role')delete root.LWBuildingInteriorIntegration;
  if(action==='wrong-order')[ids[5],ids[6]]=[ids[6]!,ids[5]!];
  if(action==='missing-predecessor')delete engine.prototype.stepActor;
  const unchanged=action==='missing-predecessor'?Object.getOwnPropertyDescriptors(engine.prototype):before;
  assert.throws(()=>api.install(engine,ids));assert.deepEqual(Object.getOwnPropertyDescriptors(engine.prototype),unchanged);assert.equal(api.describe(engine).length,0);
 }
});
test('Adapter undeclared changes fail closed and prevent unsafe retry',()=>{
 const {api,root,engine}=fixture();root.LWCommandRouter={install(target:Engine){target.prototype.dispatchCommand=()=>{};Object.defineProperty(target,'commandManifest',{value:[]});target.prototype.silentOverride=()=>{};}};
 assert.throws(()=>api.install(engine),/undeclared method/);assert.throws(()=>api.install(engine),/previously failed/);
});
const owner=new Set(['content']);
const manifest:DataManifest={format:'littlewild-data-ownership',schemaVersion:1,entries:[{id:'base',pattern:'content/*.json',owner:'content',kind:'definitions',validatorRole:'base'}],historicalFixtures:[]};
test('Data owners reject unowned duplicate and unknown compiled validators',()=>{
 assert.deepEqual(ownershipErrors(manifest,['content/base.json'],owner),[]);
 assert(ownershipErrors(manifest,['content/base.json','assets/new.json'],owner).some(error=>error.includes('0 data owners')));
 assert(ownershipErrors({...manifest,entries:[...manifest.entries,{...manifest.entries[0]!,id:'duplicate'}]},['content/base.json'],owner).some(error=>error.includes('2 data owners')));
 const invalid=JSON.parse(JSON.stringify(manifest)) as DataManifest;Reflect.set(invalid.entries[0]!,'validatorRole','uploaded-script');
 assert(ownershipErrors(invalid,['content/base.json'],owner).some(error=>error.includes('Unknown validator role')));
});
test('Executable payloads are rejected at every nested path',()=>{
 assert.deepEqual(executableDataErrors({definitions:[{cost:{wood:1},callback:'function(){}'}]},'content/base.json'),['content/base.json/definitions/0/callback']);
 assert.deepEqual(executableDataErrors({definition:{modulePath:'./uploaded.js'}},'assets/item.json'),['assets/item.json/definition/modulePath']);
 assert.deepEqual(executableDataErrors({name:'script',description:'Callback vocabulary is ordinary text.'},'content/base.json'),[]);
});
test('Type-only renderer edges DOM types and unowned declarations fail while neutral domain points compile',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'littlewild-contract-policy-'));
 const contexts=[{id:'domain',layer:'domain',files:['domain.ts']},{id:'presentation',layer:'presentation',files:[]}];
 const entries=[{path:'neutral.d.ts',owner:'domain'},{path:'renderer.d.ts',owner:'presentation'}];
 try{
  fs.writeFileSync(path.join(directory,'neutral.d.ts'),'declare namespace Neutral {interface Point{x:number;y:number;}}');
  fs.writeFileSync(path.join(directory,'renderer.d.ts'),'declare namespace Renderer {interface Canvas{ctx:CanvasRenderingContext2D;}}');
  fs.writeFileSync(path.join(directory,'domain.ts'),'/// <reference path="./neutral.d.ts" />\nconst point:Neutral.Point={x:1,y:2};');
  assert.deepEqual(contractErrors(directory,contexts,entries,['domain.ts','neutral.d.ts','renderer.d.ts']),[]);
  fs.appendFileSync(path.join(directory,'domain.ts'),'\nlet canvas:Renderer.Canvas;');
  assert(contractErrors(directory,contexts,entries,['domain.ts','neutral.d.ts','renderer.d.ts']).some(error=>error.includes('renderer.d.ts')));
  fs.writeFileSync(path.join(directory,'domain.ts'),'let canvas:CanvasRenderingContext2D;');
  assert(contractErrors(directory,contexts,entries,['domain.ts','neutral.d.ts','renderer.d.ts']).some(error=>error.includes('DOM type')));
  assert(contractErrors(directory,contexts,entries,['domain.ts','neutral.d.ts','renderer.d.ts','forgotten.d.ts']).some(error=>error.includes('Unowned project contract')));
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('Failure metadata preserves original values and discovers stable routing codes',()=>{
 const api=require('./runtime-results.js') as LWRuntime.ResultsApi;
 assert.deepEqual(api.failure('Original reason.','invalid-target'),{ok:false,reason:'Original reason.',code:'invalid-target'});
 const original={ok:false,reason:'Old authority.',order:['same-order']},out=api.annotate(original);
 assert.deepEqual(out,{...original,code:'rule-rejected'});assert.equal('code'in original,false);assert.strictEqual(out.order,original.order);
 const accepted={ok:true};assert.strictEqual(api.annotate(accepted),accepted);assert(api.codes.includes('invalid-command'));assert(Object.isFrozen(api.codes));
});
test('Shared result and event contracts compile valid callers and reject unknown codes and event names',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'littlewild-runtime-contracts-'));
 try{
  const declaration=path.join(directory,'runtime-contracts.d.ts'),caller=path.join(directory,'caller.ts');
  fs.copyFileSync(path.resolve(__dirname,'../source/runtime-contracts.d.ts'),declaration);
  const compile=(text:string):readonly ts.Diagnostic[]=>{fs.writeFileSync(caller,text);return ts.getPreEmitDiagnostics(ts.createProgram([declaration,caller],{strict:true,noEmit:true,skipLibCheck:false,types:[],target:ts.ScriptTarget.ES2022}));};
  assert.equal(compile("const result:LWRuntime.Failure={ok:false,reason:'same text',code:'invalid-target'}; const gameplayEvent:LWRuntime.Event={type:'temper',text:'same text',actorId:'c2'};").length,0);
  const invalid=compile("const result:LWRuntime.Failure={ok:false,reason:'same text',code:'uploaded-rule'}; const gameplayEvent:LWRuntime.Event={type:'frame-tick',text:'same text'};");
  assert.equal(invalid.filter(error=>error.code===2322).length,2);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('The shipped facade retains exact adapter order across fresh demo and native reconstruction',()=>{
 const L=require('./simulation.cjs') as {Engine:Engine&{new(state?:unknown):LWCorePorts.BaseEngine};createWorldDemo():LWCorePorts.BaseEngine};
 const root=globalThis as unknown as {LWApplicationAdapters:Installer};
 const records=root.LWApplicationAdapters.describe(L.Engine);
 assert.deepEqual(records.map(record=>record.id),['commands','interactions','settings','scenario-workflow','scenario-resources','construction','terraform','interiors']);
 const demo=L.createWorldDemo(),fresh=new L.Engine(demo.export().state),native=L.Engine.import(demo.export()) as LWCorePorts.BaseEngine;
 for(const engine of [demo,fresh,native]){
  assert.strictEqual(Object.getPrototypeOf(engine),L.Engine.prototype);
  for(const record of records)for(const name of [...record.methods,...record.wraps])assert.equal(typeof Reflect.get(engine,name),'function',name);
 }
 assert.equal(records.at(-1)?.predecessors.finishTask,'construction');
});
test('Temper emission grants gameplay care synchronously before observation and preserves event order',()=>{
 const L=require('./simulation.cjs') as {createWorldDemo():LWCorePorts.BaseEngine&{creatures:LWApplication.Actor[]}};
 const engine=L.createWorldDemo(),actor=engine.creatures[1]!;
 const before=actor.eventInteractions.length,time=engine.s.simTime;
 engine.emit('notice','Before temper.');engine.emit('temper','Original temper text.',{actorId:actor.id});
 const grant=actor.eventInteractions[before]!;
 assert.equal(grant.definition,'breathe');assert.equal(grant.trigger,'temper');assert.equal(grant.created,time);assert.equal(grant.expires,time+120);
 assert.deepEqual(engine.events.slice(-2),[{type:'notice',text:'Before temper.',actorId:'c1'},{type:'temper',text:'Original temper text.',actorId:actor.id}]);
 assert.equal(engine.s.simTime,time);
});
const report={passed:results.filter(result=>result.passed).length,total:results.length,results};
fs.writeFileSync(path.join(__dirname,'architecture-extensions-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(`${report.passed}/${report.total} architecture extension checks passed`);
for(const result of results)if(!result.passed)console.error(result.name+': '+result.error);
if(report.passed!==report.total)process.exitCode=1;
