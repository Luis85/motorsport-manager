/* V12 preservation checks. Baseline hashes are from the delivered v11 archive. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const L=require('./simulation.cjs'),S=require('./story-codec.js'),results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.stack});}}
const baseline=JSON.parse(fs.readFileSync(__dirname+'/fixtures/v11-protected-hashes.json'));
for(const [group,files]of Object.entries(baseline))test('V11 preserved byte-identical: '+group,()=>{for(const [file,hash]of Object.entries(files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(__dirname+'/'+file)).digest('hex'),hash,file);});
const doc=JSON.parse(fs.readFileSync(__dirname+'/fixtures/actual-v11-workplace.json'));
test('Authentic v11 story loads without inventing resources or knowledge',()=>{const e=S.commit(S.inspect(doc));assert.deepEqual(S.encode(e).state,doc.state);assert.equal(e.export().version,8);});
test('V11 paid work and identities survive exact save continuation',()=>{const e=S.commit(S.inspect(doc));e.s.paused=false;e.advance(120);const restored=S.commit(S.inspect(S.encode(e)));e.advance(60);restored.advance(60);assert.deepEqual(e.export(),restored.export());});
test('Inspecting authentic v11 save is read-only',()=>{const before=JSON.stringify(doc);S.inspect(doc);assert.equal(JSON.stringify(doc),before);});
const report={passed:results.filter(r=>r.passed).length,total:results.length,results};fs.writeFileSync(__dirname+'/v12-preservation-results.json',JSON.stringify(report,null,2));console.log(report.passed+'/'+report.total);if(report.passed!==report.total){console.error(results.filter(r=>!r.passed));process.exitCode=1;}
