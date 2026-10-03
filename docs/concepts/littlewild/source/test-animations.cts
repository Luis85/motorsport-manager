/// <reference path="./animation-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void){try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
for(const name of ['developer-data','animation-catalog','renderer-animations'])require('./'+name+'.js');
const root=globalThis as unknown as {LWAnimations:LWAnimations.Api;LWAnimationCatalog:typeof LWAnimationCatalog};
const animations=root.LWAnimations,descriptor:LWAnimations.Descriptor={id:'demo',presetId:'orbit',start:0,duration:4,x:9,y:9,radius:40,color:'#77aaff',count:8,seed:5};
test('Pure preset discovery and lazy Node registration initialize no browser library',()=>{
 assert.deepEqual(animations.list().map(row=>row.id),['sparkles','orbit','ripple']);assert(Object.isFrozen(animations.list()));assert(Object.isFrozen(root.LWAnimationCatalog.list()[0]!.parameters));
 assert.deepEqual(animations.validate([descriptor]),[descriptor]);assert(Object.isFrozen(animations.validate([descriptor])[0]));assert.equal('p5' in globalThis,false);
});
test('Animation descriptors are detached and reject executable properties and unsafe bounds',()=>{
 const copied=animations.validate([descriptor]);assert.notEqual(copied[0],descriptor);
 for(const patch of [{count:129},{count:1.5},{radius:0},{x:Infinity},{color:'red'},{seed:-1},{presetId:'missing'},{callback:()=>{}}])assert.throws(()=>animations.validate([{...descriptor,...patch}]));
 let invoked=false;const hostile={...descriptor};Object.defineProperty(hostile,'radius',{enumerable:true,get(){invoked=true;return 40;}});assert.throws(()=>animations.validate([hostile]));assert.equal(invoked,false);
});
test('Compiled custom presets publish data-only provenance and withdraw cleanly',()=>{
 let draws=0;const unregister=animations.register({id:'custom-pulse',name:'Custom pulse',description:'Compiled developer module.',source:'extensions/custom-pulse.ts'},()=>{draws++;});
 assert.equal(root.LWAnimationCatalog.list().find(row=>row.id==='custom-pulse')!.source,'extensions/custom-pulse.ts');assert.equal(animations.validate([{...descriptor,presetId:'custom-pulse'}])[0]!.presetId,'custom-pulse');assert.equal(draws,0);
 assert.throws(()=>animations.register({id:'custom-pulse',name:'Duplicate',description:''},()=>{}));unregister();assert.equal(root.LWAnimationCatalog.list().some(row=>row.id==='custom-pulse'),false);assert.throws(()=>animations.validate([{...descriptor,presetId:'custom-pulse'}]));
});
fs.mkdirSync('verification/v15',{recursive:true});fs.writeFileSync('verification/v15/animations-results.json',JSON.stringify({passed:results.filter(row=>row.passed).length,total:results.length,results},null,2)+'\n');
console.log(results.filter(row=>row.passed).length+'/'+results.length+' animation registry checks passed');if(results.some(row=>!row.passed))process.exitCode=1;
