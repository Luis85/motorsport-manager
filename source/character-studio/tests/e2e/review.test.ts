import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const bin=resolve(import.meta.dirname,'../../../../bin/character-studio');
async function command(args:string[],cwd:string) {
  const env={...process.env};
  if(!env.CHARACTER_STUDIO_CHROMIUM_PATH) {
    try{await access('/usr/bin/chromium');env.CHARACTER_STUDIO_CHROMIUM_PATH='/usr/bin/chromium';}catch{ /* Use Playwright's installed browser. */ }
  }
  return new Promise<any>((accept,reject)=>{
    const child=spawn(process.execPath,[bin,...args],{cwd,env,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    const timer=setTimeout(()=>{child.kill();reject(new Error('Review command exceeded its bounded runtime.'));},120_000);
    child.stdout.on('data',value=>stdout+=value);child.stderr.on('data',value=>stderr+=value);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('close',code=>{
      clearTimeout(timer);
      try{assert.equal(stderr,'');accept({exitCode:code,...JSON.parse(stdout)});}catch(error){reject(error);}
    });
  });
}
const sha=(value:Buffer)=>createHash('sha256').update(value).digest('hex');

test('CLI review produces replayable bound images and keeps existing outputs unchanged',{timeout:240_000},async()=>{
  const project=await mkdtemp(join(tmpdir(),'character-review-'));
  try{
    const identity=['--project',project,'--id','moss'];
    const character=await command(['create',...identity,'--name','Moss'],project);
    assert.equal(character.exitCode,0);
    const plan=join(project,'plan.json');
    await writeFile(plan,JSON.stringify({format:'character-studio-review-plan',schemaVersion:1,views:[
      {id:'contact-sheet',mode:'portrait',width:256,height:256},
      {id:'rear',camera:'back',width:256,height:256},
    ]}));
    const first=join(project,'first'),second=join(project,'second');
    const result=await command(['review',...identity,'--plan',plan,'--out',first],project);
    assert.equal(result.exitCode,0,JSON.stringify(result));
    const manifest=JSON.parse(await readFile(join(first,'manifest.json'),'utf8'));
    assert.equal(manifest.recipeHash,character.stateHash);
    assert.equal(manifest.frames.length,2);
    assert.equal(manifest.compilerRevision,3);
    assert.match(manifest.visualHash,/^[a-f0-9]{64}$/);
    for(const frame of manifest.frames){
      const png=await readFile(join(first,frame.file));
      assert.equal(png.readUInt32BE(16),256);assert.equal(png.readUInt32BE(20),256);
      assert.equal(sha(png),frame.sha256);
    }
    assert.equal(sha(await readFile(join(first,manifest.contactSheet.file))),manifest.contactSheet.sha256);
    const replay=await command(['review',...identity,'--plan',join(first,'replay-plan.json'),'--out',second],project);
    assert.equal(replay.exitCode,0,JSON.stringify(replay));
    assert.deepEqual(JSON.parse(await readFile(join(second,'manifest.json'),'utf8')),manifest);
    assert.equal((await command(['review',...identity,'--out',first],project)).exitCode,3);
    assert.equal((await command(['inspect',...identity],project)).stateHash,character.stateHash);
  }finally{await rm(project,{recursive:true,force:true});}
});
