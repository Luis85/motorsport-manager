/** Exercise maintenance through public executables: no SDK calls or project-file edits. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';

export function verifyLifecycle({cli,repository,workspace,id,project,packageFile,forgeProject,models}) {
  const studio=path.join(repository,'bin/character-studio'),forge=path.join(repository,'bin/scene-forge'),engine=path.join(repository,'bin/wildlands');
  for (const [bin,args] of [[studio,['discover']],[forge,['describe','model','import']],[engine,['creature','discover']]]) cli(bin,args);
  const initial=cli(studio,['inspect','--project',project,'--id',id]);
  const guards=value=>['--expected-revision',String(value.revision),'--expected-state',value.stateHash];
  cli(studio,['history','--project',project,'--id',id]);
  const undo=cli(studio,['undo','--project',project,'--id',id,...guards(initial)]);
  const redo=cli(studio,['redo','--project',project,'--id',id,...guards(undo)]);
  assert.deepEqual(redo.character,initial.character);
  const base=path.join(workspace,'base.project.json'),installed=path.join(workspace,'installed.project.json');
  cli(engine,['create','--game',path.join(repository,'docs/concepts/littlewild'),'--output',base]);
  const catalog=cli(engine,['creature','list','--project',base]);
  const install=['creature','import','--project',base,'--file',packageFile,'--expected-fingerprint',catalog.fingerprint];
  const dry=cli(engine,[...install,'--dry-run']);
  assert.equal(cli(engine,['creature','list','--project',base]).fingerprint,catalog.fingerprint);
  const committed=cli(engine,[...install,'--output',installed]);
  assert.equal(committed.proposedFingerprint,dry.proposedFingerprint);
  const before=cli(engine,['creature','inspect','--project',installed,'--archetype',id]);
  const sourcePackage=JSON.parse(readFileSync(packageFile,'utf8'));
  assert.deepEqual(before.package.gameplayDefinition,sourcePackage.gameplayDefinition);
  assert.deepEqual(before.package.appearanceManifest,sourcePackage.appearanceManifest);
  for (const asset of sourcePackage.assetReferences) assert.deepEqual(before.package.assetReferences.find(value=>value.id===asset.id&&value.category===asset.category),asset);

  // Export the full definition before refining a single variant, keeping behaviors and rig bindings.
  const definition=path.join(workspace,'assets/creatures',id,'definition.json');
  mkdirSync(path.dirname(definition),{recursive:true});
  cli(studio,['export','--project',project,'--id',id,'--format','definition','--out',definition]);
  const bundleFile=path.join(workspace,'refinement.model-bundle.json'),model=models[0];
  cli(forge,['-p',forgeProject,'model','export',model,'--out',bundleFile]);
  const bundle=JSON.parse(readFileSync(bundleFile,'utf8')),material=Object.keys(bundle.models[model].materials).find(key=>key==='fur')??Object.keys(bundle.models[model].materials)[0];
  bundle.models[model].materials[material]={...bundle.models[model].materials[material],roughness:0.84};
  writeFileSync(bundleFile,JSON.stringify(bundle));
  const state=cli(forge,['-p',forgeProject,'inspect']);
  const refinement=['-p',forgeProject,'model','import','--file',bundleFile,'--replace',...guards(state)];
  cli(forge,[...refinement,'--dry-run']);
  assert.equal(cli(forge,['-p',forgeProject,'inspect']).stateHash,state.stateHash);
  cli(forge,refinement);
  const sourceDefinition=JSON.parse(readFileSync(definition,'utf8'));
  const variant=Object.keys(sourceDefinition.visual.models)[0];
  cli(forge,['-p',forgeProject,'littlewild','export','--model',model,'--family','creatures','--variant',variant,'--out',definition,'--dry-run']);
  assert.deepEqual(JSON.parse(readFileSync(definition,'utf8')),sourceDefinition);
  cli(forge,['-p',forgeProject,'littlewild','export','--model',model,'--family','creatures','--variant',variant,'--out',definition]);
  const revisedDefinition=JSON.parse(readFileSync(definition,'utf8'));
  assert.deepEqual(revisedDefinition.visual.rig,sourceDefinition.visual.rig);
  assert.ok(sourceDefinition.creature,'The source definition must contain native creature gameplay.');
  assert.deepEqual(revisedDefinition.creature,sourceDefinition.creature);
  const revised=path.join(workspace,'refined.project.json');
  const attach=['creature','attach-visual','--project',installed,'--archetype',id,'--file',definition,'--expected-fingerprint',before.fingerprint];
  cli(engine,[...attach,'--dry-run']);
  cli(engine,[...attach,'--output',revised]);
  const after=cli(engine,['creature','inspect','--project',revised,'--archetype',id]);
  assert.deepEqual(after.package.gameplayDefinition,before.package.gameplayDefinition);
  assert.deepEqual(after.package.assetReferences,before.package.assetReferences);
  assert.deepEqual(after.package.appearanceManifest,revisedDefinition.visual);
  cli(engine,['validate','--project',revised]);
  const archived=path.join(workspace,'maintained.package.json');
  cli(engine,['creature','export','--project',revised,'--archetype',id,'--output',archived]);
  assert.deepEqual(JSON.parse(readFileSync(archived,'utf8')),after.package);
  assert.equal(cli(engine,['creature','inspect','--project',installed,'--archetype',id]).fingerprint,before.fingerprint);
  return {sourceFingerprint:catalog.fingerprint,installedFingerprint:before.fingerprint,refinedFingerprint:after.fingerprint,model,variant,preserved:['gameplay','assetReferences','rig','sourceProjects','studioRecipe'],visualChanged:before.fingerprint!==after.fingerprint};
}
