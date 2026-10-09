/** Standalone-tool handoff gate. Run after building both checked-in executables. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const workspace = mkdtempSync(path.join(tmpdir(), 'character-studio-handoff-'));
const studio = path.join(repository, 'bin/character-studio');
const forge = path.join(repository, 'bin/scene-forge');
const sha256 = value => createHash('sha256').update(value).digest('hex');
function cli(executable, args) {
  const stdout = execFileSync(process.execPath, [executable, ...args], {cwd:workspace, encoding:'utf8', timeout:120000, maxBuffer:8*1024*1024});
  const result = JSON.parse(stdout);
  assert.equal(result.ok, true, stdout);
  return result.data ?? result;
}
const reports = [];
try {
  for (const id of ['river-pip', 'a'.repeat(61)]) {
    const project = path.join(workspace,id);
    const created = cli(studio,['create','--project',project,'--id',id,'--name','River','--preset','fern']);
    const batch = path.join(workspace,id+'.edits.json');
    writeFileSync(batch,JSON.stringify({operations:[
      {op:'set',path:'/outfits/head',value:'trail_cap'},
      {op:'set',path:'/outfits/back',value:'field_satchel'},
      {op:'set',path:'/outfits/feet',value:'walking_boots'},
      {op:'set',path:'/outfits/tool',value:'walking_staff'},
      {op:'set',path:'/personality',value:'thoughtful'},
      {op:'add',path:'/skills/gardening',value:4},
    ]}));
    cli(studio,['apply','--project',project,'--id',id,'--file',batch,'--expected-revision',String(created.revision),'--expected-state',created.stateHash]);
    const inspected = cli(studio,['inspect','--project',project,'--id',id]);
    const sourceState = inspected.stateHash;
    const file = path.join(workspace,id+'.package.json');
    cli(studio,['export','--project',project,'--id',id,'--format','package','--out',file]);
    const bytes = readFileSync(file), packaged = JSON.parse(bytes);
    assert.equal(packaged.format,'littlewild-creature-package');
    assert.equal(packaged.gameplayDefinition.id,id);
    assert.equal(packaged.appearanceManifest.id,id);
    assert.deepEqual(packaged.appearanceManifest.metadata.characterStudio.recipe,inspected.character);
    const variants = Object.keys(packaged.appearanceManifest.models);
    const forgeProject = path.join(workspace,id+'.forge');
    cli(forge,['init',forgeProject]);
    const before = cli(forge,['-p',forgeProject,'inspect']);
    const importArgs = ['-p',forgeProject,'littlewild','import','--definition',file,'--expected-state',before.stateHash];
    const dry = cli(forge,[...importArgs,'--dry-run']);
    assert.equal(cli(forge,['-p',forgeProject,'inspect']).stateHash,before.stateHash);
    const imported = cli(forge,importArgs);
    assert.equal(imported.importedFacet,'visual');
    assert.equal(imported.sourceFormat,'littlewild-creature-package');
    assert.equal(imported.variants.length,variants.length);
    assert.equal(new Set(imported.variants).size,variants.length);
    assert.deepEqual(dry.variants,imported.variants);
    const exports = [];
    for (const model of imported.variants) {
      const output = path.join(workspace,model+'.glb');
      const exported = cli(forge,['-p',forgeProject,'export','--model',model,'--out',output,'--validate']);
      assert.equal(exported.validation.numErrors,0);
      assert.equal(exported.validation.numWarnings,0);
      assert.ok(exported.stats.meshes > 0);
      assert.ok(exported.stats.triangles > 0);
      exports.push({model,sha256:sha256(readFileSync(output)),triangles:exported.stats.triangles});
    }
    const importedRecipe = cli(studio,['import','--project',project+'.roundtrip','--file',file]);
    assert.deepEqual(importedRecipe.character,inspected.character);
    assert.equal(cli(studio,['inspect','--project',project,'--id',id]).stateHash,sourceState);
    assert.equal(sha256(readFileSync(file)),sha256(bytes));
    reports.push({id,characterState:sourceState,packageSha256:sha256(bytes),forgeState:imported.stateHash,variants,exports});
  }
  process.stdout.write(JSON.stringify({ok:true,executableHashes:{studio:sha256(readFileSync(studio)),sceneForge:sha256(readFileSync(forge))},reports},null,2)+'\n');
} finally {rmSync(workspace,{recursive:true,force:true});}
