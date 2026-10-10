import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
type Result = {status:number|null;out:Record<string,unknown>};
type Run = (args:string[]) => Result;
type Test = (name:string, work:()=>void) => void;
export function creatureChecks(test:Test, run:Run, directory:string, project:string):void {
 const file=(name:string)=>path.join(directory,'creature-'+name+'.json');
 const json=(name:string,value:unknown):string=>{const target=file(name);fs.writeFileSync(target,JSON.stringify(value));return target;};
 const source=fs.readFileSync(project);
 let imported='';
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
