import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {visualSummary} from '../tools/creature-visual-summary.cjs';
type Result = {status:number|null;out:Record<string,unknown>};
type Run = (args:string[]) => Result;
type Test = (name:string, work:()=>void) => void;
export function creatureChecks(test:Test, run:Run, directory:string, project:string):void {
 const file=(name:string)=>path.join(directory,'creature-'+name+'.json');
 const json=(name:string,value:unknown):string=>{const target=file(name);fs.writeFileSync(target,JSON.stringify(value));return target;};
 const source=fs.readFileSync(project);
 let imported='';
 test('Creature visual summaries expose deterministic material and UV facts without mesh payloads or mutation',()=>{
  const args=['creature','inspect','--project',project,'--archetype','sproutling','--summary'];
  const summary=run(args);assert.equal(summary.status,0,JSON.stringify(summary));
  assert.equal(summary.out.package,undefined);assert.equal(summary.out.fields,undefined);
  assert.deepEqual(run(args).out,summary.out);assert.deepEqual(fs.readFileSync(project),source);
  const full=run(args.slice(0,-1));assert.equal(full.out.fingerprint,summary.out.fingerprint);
  const fixture={id:'plush',category:'actor',materials:{coat:{color:'#bb9966',surface:{kind:'fur',seed:1,scale:4,strength:0.4}}},
   meshes:{face:{positions:[0,0,0,1,0,0,0,1,0],normals:[0,0,1,0,0,1,0,0,1],indices:[0,1,2],uvs:[0,0,1,0,0,1]}},
   models:{world:{nodes:[{id:'root',primitive:'group',children:[{id:'cheek',primitive:'mesh',mesh:'face',material:'coat',materialProps:{surface:{kind:'cloth',seed:2,scale:3,strength:0.2}}}]}]}}};
  const report=visualSummary(fixture);
  assert.deepEqual(report.totals,{uniqueMeshes:1,storedVertices:3,storedTriangles:1});
  assert.equal((report.meshes as {uv:string}[])[0]!.uv,'authored');
  const model=(report.models as {nodes:number;bakedTriangles:number;surfaces:{surface:{kind:string}}[]}[])[0]!;
  assert.equal(model.nodes,2);assert.equal(model.bakedTriangles,1);assert.equal(model.surfaces[0]!.surface.kind,'cloth');
  assert.equal(JSON.stringify(report).includes('positions'),false);
  const unindexed=structuredClone(fixture) as typeof fixture & {meshes:{face:{indices?:number[]}}};
  Reflect.deleteProperty(unindexed.meshes.face,'indices');
  assert.deepEqual(visualSummary(unindexed).totals,report.totals);
  assert.equal((visualSummary(unindexed).models as {bakedTriangles:number}[])[0]!.bakedTriangles,1);
  assert.equal(visualSummary({...fixture,materials:{coat:{surface:fixture.materials.coat.surface,color:'#bb9966'}}}).sha256,report.sha256);
  assert.equal(run([...args,'true']).status,2);
  assert.equal(run(['creature','list','--project',project,'--summary']).status,2);
 });
 test('Creature CLI lifecycle discovers, authors, imports and refines visuals without ticking or losing gameplay',()=>{
  const discovery=run(['creature','discover']);assert.equal(discovery.status,0);assert.equal((discovery.out.commands as unknown[]).length,6);
  const list=run(['creature','list','--project',project]);assert.equal(list.status,0,JSON.stringify(list));
  assert((list.out.archetypes as {id:string}[]).some(value=>value.id==='sproutling'));
  const original=run(['creature','inspect','--project',project,'--archetype','sproutling']);assert.equal(original.status,0);
  assert((original.out.fields as unknown[]).length>0);
  const recipe=json('duplicate',{format:'wildlands-creature-recipe',schemaVersion:1,operations:[{op:'duplicateArchetype',id:'agent-moss',name:'Agent Moss'},{op:'updateDefinition',value:{name:'Moss'}}]});
  const edit=['creature','edit','--project',project,'--archetype','sproutling','--recipe',recipe,'--expected-fingerprint',String(original.out.fingerprint)];
  const dry=run([...edit,'--dry-run']);assert.equal(dry.status,0,JSON.stringify(dry));assert.equal(dry.out.output,null);assert.deepEqual(fs.readFileSync(project),source);
  const version=file('version1'),written=run([...edit,'--output',version]);assert.equal(written.status,0,JSON.stringify(written));assert.equal(written.out.proposedFingerprint,dry.out.proposedFingerprint);
  const packageFile=file('package');assert.equal(run(['creature','export','--project',version,'--archetype','agent-moss','--output',packageFile]).status,0);
  imported=file('imported');const importResult=run(['creature','import','--project',project,'--file',packageFile,'--expected-fingerprint',String(list.out.fingerprint),'--output',imported]);assert.equal(importResult.status,0,JSON.stringify(importResult));
  const before=run(['creature','inspect','--project',imported,'--archetype','agent-moss']);
  const packaged=before.out.package as {gameplayDefinition:unknown;appearanceManifest:{materials:Record<string,unknown>};assetReferences:unknown[]};
  const visual=structuredClone(packaged.appearanceManifest);visual.materials.fur={color:'#a8bca1',roughness:0.8};
  const visualFile=json('visual',{format:'littlewild-definition',schemaVersion:1,visual});
  const refined=file('refined'),attach=run(['creature','attach-visual','--project',imported,'--archetype','agent-moss','--file',visualFile,'--expected-fingerprint',String(before.out.fingerprint),'--output',refined]);assert.equal(attach.status,0,JSON.stringify(attach));
  const after=run(['creature','inspect','--project',refined,'--archetype','agent-moss']).out.package as typeof packaged;
  assert.deepEqual(after.gameplayDefinition,packaged.gameplayDefinition);assert.deepEqual(after.assetReferences,packaged.assetReferences);assert.deepEqual(after.appearanceManifest,visual);
  const initial=JSON.parse(source.toString()) as Wildlands.Project, authored=JSON.parse(fs.readFileSync(refined,'utf8')) as Wildlands.Project;
  assert.deepEqual(authored.pack.scenes,initial.pack.scenes);assert.equal(run(['validate','--project',refined]).status,0);
  assert.deepEqual(fs.readFileSync(project),source);
 });
 test('Creature CLI admits bounded large mesh packages and visuals without widening recipe or generic JSON limits',()=>{
  const info=run(['creature','discover']);assert.equal(info.out.maxPackageBytes,8*1024*1024);assert.equal(info.out.maxVisualBytes,8*1024*1024);
  const inspect=run(['creature','inspect','--project',project,'--archetype','sproutling']);
  const packaged=inspect.out.package as {appearanceManifest:{meshes?:Record<string,unknown>;materials:Record<string,unknown>;models:Record<string,{nodes:unknown[]}>}};
  const visual=packaged.appearanceManifest;visual.meshes={};
  for(let mesh=0;mesh<4;mesh++)visual.meshes['fidelity'+mesh]={positions:Array.from({length:8190*3},(_,i)=>Math.sin(i/7)*.12345678901234567),normals:Array.from({length:8190*3},(_,i)=>i%3===2?1:0),uvs:Array.from({length:8190*2},(_,i)=>i%2===0?.12345678901234567:.9876543210987654)};
  Object.values(visual.models)[0]!.nodes.push({id:'fidelity-mesh',primitive:'mesh',mesh:'fidelity0',material:Object.keys(visual.materials)[0]});
  const large=file('large-mesh-package');fs.writeFileSync(large,JSON.stringify(packaged,null,2));assert(fs.statSync(large).size>4*1024*1024);assert(fs.statSync(large).size<8*1024*1024);
  const imported=file('large-mesh-project'),args=['creature','import','--project',project,'--file',large,'--replace','--expected-fingerprint',String(inspect.out.fingerprint)];
  assert.equal(run([...args,'--output',imported]).status,0);assert.equal(run(['validate','--project',imported]).status,0);
  const summary=run(['creature','inspect','--project',imported,'--archetype','sproutling','--summary']);assert.equal(summary.status,0);
  const raw=file('large-mesh-visual');fs.writeFileSync(raw,JSON.stringify(visual,null,2));assert(fs.statSync(raw).size>2*1024*1024);
  assert.equal(run(['creature','attach-visual','--project',imported,'--archetype','sproutling','--file',raw,'--expected-fingerprint',String(summary.out.fingerprint),'--dry-run']).status,0);
  const over=file('oversize-package');fs.writeFileSync(over,' '.repeat(8*1024*1024+1));const destination=file('oversize-output');const rejected=run(args.map(value=>value===large?over:value).concat(['--output',destination]));assert.equal(rejected.status,2);assert.match(String(rejected.out.errors),/8388608/);assert(!fs.existsSync(destination));
  const recipe=file('oversize-recipe');fs.writeFileSync(recipe,' '.repeat(1024*1024+1));assert.equal(run(['creature','edit','--project',project,'--archetype','sproutling','--recipe',recipe,'--expected-fingerprint',String(inspect.out.fingerprint),'--dry-run']).status,2);
  const content=require('../content-runtime.js') as {parse(input:unknown,limit:number):unknown};assert.throws(()=>content.parse(fs.readFileSync(large,'utf8'),2*1024*1024),/file size limit/);
  assert.deepEqual(fs.readFileSync(project),source);
 });
 test('Creature CLI rejects stale guards, implicit replacement, invalid batches and occupied outputs atomically',()=>{
  const inspected=run(['creature','inspect','--project',project,'--archetype','sproutling']);
  const fingerprint=String(inspected.out.fingerprint),value=inspected.out.package as {gameplayDefinition:{name:string}};
  value.gameplayDefinition.name='Changed';const changed=json('replacement',value),destination=file('rejected');
  const args=['creature','import','--project',project,'--file',changed,'--expected-fingerprint',fingerprint];
  const refused=run([...args,'--output',destination]);assert.equal(refused.status,2);assert.match(String(refused.out.errors),/--replace/);assert(!fs.existsSync(destination));
  assert.equal(run([...args,'--replace','--dry-run']).status,0);
  const stale=run(['creature','import','--project',project,'--file',changed,'--replace','--expected-fingerprint','0000000000000000','--output',destination]);assert.equal(stale.status,2);assert.match(String(stale.out.errors),/fingerprint conflict/);
  const invalid=json('invalid',{format:'wildlands-creature-recipe',schemaVersion:1,operations:[{op:'updateDefinition',value:{name:'Temporary'}},{op:'unknown'}]});
  const rejected=run(['creature','edit','--project',project,'--archetype','sproutling','--recipe',invalid,'--expected-fingerprint',fingerprint,'--output',destination]);assert.equal(rejected.status,2);assert.match(String(rejected.out.errors),/operation 1/);assert(!fs.existsSync(destination));
  for(const target of [project,imported]) {const bytes=fs.readFileSync(target);assert.equal(run([...args,'--replace','--output',target]).status,2);assert.deepEqual(fs.readFileSync(target),bytes);}
  assert.equal(run([...args,'--replace','--dry-run','--output',destination]).status,2);
  assert.equal(run(['creature','import','--project',project,'--file',changed,'--replace','--dry-run']).status,2);
  assert.deepEqual(fs.readFileSync(project),source);assert(!fs.readdirSync(directory).some(name=>name.endsWith('.pending')));
 });
}
