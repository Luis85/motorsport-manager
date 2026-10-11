import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as store from '../src/infra/store.js';
import { createCharacter } from '../src/domain/character.js';
import { serve } from '../src/infra/server.js';
const project = () => mkdtemp(join(tmpdir(), 'character-studio-test-'));
test('guarded storage rejects stale writers, keeps dry-run bytes and durable history', async () => {
  const dir = await project();
  try {
    const first = await store.write(dir,createCharacter('pip','Pip'),{expectedRevision:0,expectedState:null});
    const file = join(dir,'.character-studio/characters/pip.json');
    const before = await readFile(file,'utf8');
    const edited = structuredClone(first.character);
    edited.identity.name = 'Clover';
    const guard = {expectedRevision:first.revision,expectedState:first.stateHash};
    const proposal = await store.write(dir,edited,{...guard,dryRun:true});
    assert.equal(proposal.revision,1);
    assert.ok('proposedRevision' in proposal);
    assert.equal(proposal.proposedRevision,2);
    assert.equal(await readFile(file,'utf8'),before);
    const second = await store.write(dir,edited,guard);
    await assert.rejects(store.write(dir,first.character,guard),{code:'CONFLICT'});
    const undone = await store.undo(dir,'pip',{expectedRevision:second.revision,expectedState:second.stateHash});
    assert.equal(undone.character.identity.name,'Pip');
    assert.equal(undone.revision,3);
    const redone = await store.redo(dir,'pip',{expectedRevision:undone.revision,expectedState:undone.stateHash});
    assert.equal(redone.character.identity.name,'Clover');
    redone.character.identity.name='External mutation';
    assert.equal((await store.read(dir,'pip')).character.identity.name,'Clover');
    assert.deepEqual((await store.list(dir)).map(row=>row.id),['pip']);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('invalid input, missing guards and traversal never create documents', async () => {
  const dir = await project();
  try {
    await assert.rejects(store.read(dir,'../escape'),{code:'INVALID_ID'});
    await assert.rejects(store.write(dir,createCharacter('pip','Pip'),{} as any),{code:'GUARDS_REQUIRED'});
    await assert.rejects(store.write(dir,{...createCharacter('pip','Pip'),schemaVersion:2} as any,{expectedRevision:0,expectedState:null}));
    assert.deepEqual(await store.list(dir),[]);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('HTTP API enforces origin, token, revisions and engine export', async () => {
  const dir = await project();
  const service = await serve(dir,{port:0});
  try {
    const payload = {character:createCharacter('pip','Pip'),expectedRevision:0,expectedState:null};
    const endpoint = service.url+'/api/characters/pip';
    const headers = {'content-type':'application/json','x-studio-token':service.token};
    assert.equal((await fetch(endpoint,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})).status,403);
    assert.equal((await fetch(endpoint,{method:'PUT',headers:{...headers,origin:'https://elsewhere.example'},body:JSON.stringify(payload)})).status,403);
    const created = await fetch(endpoint,{method:'PUT',headers,body:JSON.stringify(payload)});
    assert.equal(created.status,200);
    assert.equal((await created.json()).revision,1);
    assert.equal((await fetch(endpoint,{method:'PUT',headers,body:JSON.stringify(payload)})).status,409);
    const exported = await (await fetch(endpoint+'/export?kind=package')).json();
    assert.equal(exported.data.format,'littlewild-creature-package');
    assert.equal((await (await fetch(service.url+'/api/characters')).json()).characters.length,1);
    assert.equal((await fetch(service.url+'/api/schema?kind=invalid')).status,400);
    assert.equal((await (await fetch(endpoint+'/export?kind=look')).json()).data.format,'littlewild-look');
    const contract = await (await fetch(service.url+'/api/discover')).json();
    assert.ok(contract.http.endpoints.find((row:any)=>row.path==='/api/characters/:id/apply').request.required.includes('expectedState'));
    const current = await (await fetch(endpoint)).json();
    const guard = {expectedRevision:current.revision,expectedState:current.stateHash};
    for (const extra of [{dryRun:'false'},{misspelled:true}]) {
      assert.equal((await fetch(endpoint,{method:'PUT',headers,body:JSON.stringify({...guard,...extra,character:payload.character})})).status,400);
    }
    const invalid = await (await fetch(endpoint+'/apply',{method:'POST',headers,body:JSON.stringify({...guard,operations:[{op:'set',path:'/identity/name',value:'Moss'},{op:'set',path:'/missing',value:1}]})})).json();
    assert.match(invalid.error.details[0].path,/operations\/1/);
    assert.equal((await (await fetch(endpoint)).json()).revision,1);
    const proposal = await (await fetch(endpoint+'/apply',{method:'POST',headers,body:JSON.stringify({...guard,dryRun:true,operations:[{op:'set',path:'/identity/name',value:'Moss'}]})})).json();
    assert.equal(proposal.character.identity.name,'Moss');
    assert.equal((await (await fetch(endpoint)).json()).character.identity.name,'Pip');
  } finally { await service.close(); await rm(dir,{recursive:true,force:true}); }
});

test('writer diagnostics expose ownership and strict guard types', async () => {
  const dir = await project();
  try {
    assert.equal((await store.lockStatus(dir)).state,'unlocked');
    await assert.rejects(store.write(dir,createCharacter('pip','Pip'),{expectedRevision:0,expectedState:null,dryRun:'false'} as any),{code:'INVALID_REQUEST'});
    assert.deepEqual(await store.list(dir),[]);
    assert.equal((await store.lockStatus(dir)).locked,false);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
