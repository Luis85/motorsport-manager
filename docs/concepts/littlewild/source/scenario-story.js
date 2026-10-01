/* Portable format 10 adds the exact simulation selection to experience-aware
 * stories. Format 9 contexts migrate explicitly to the canonical M6 defaults;
 * the underlying native simulation state remains version 8. */
(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 const S=node?require('./story-codec.js'):root.LWStory;
 const X=node?require('./scenario-runtime.js'):root.LWScenarios;
 const R=node?require('./simulation-content.js'):root.LWSimulationContent;
 const P=root.LWWorldProfile,C=root.LWContent;
 const native={encode:S.encode,inspect:S.inspect,commit:S.commit};
 S.encode=engine=>{
  const doc=native.encode(engine);
  if(engine.scenarioContext){const raw=C.copy(engine.scenarioContext);if(engine.simulationSelection)raw.simulation=R.copySelection(engine.simulationSelection);const ctx=X.checkContext(raw);doc.version=10;doc.experience=C.copy(ctx);doc.experienceFingerprint=X.hash(doc.experience);}
  return doc;
 };
 S.inspect=input=>{
  const doc=C.parse(input,S.SAVE_LIMIT);let ctx=null,migrationNotes=[];
  if(doc.version===10){ctx=X.checkContext(doc.experience);if(X.hash(doc.experience)!==doc.experienceFingerprint)throw Error('Experience fingerprint does not match');}
  else if(doc.version===9){if(X.hash(doc.experience)!==doc.experienceFingerprint)throw Error('Experience fingerprint does not match');const migrated=X.migrateContext(doc.experience);ctx=migrated.context;migrationNotes=migrated.migrationNotes;}
  if(ctx)X.checkWorld(ctx.world,doc.world?.library);
  const preview=P.withProfile(ctx?.world||P.defaults,()=>native.inspect({...doc,version:doc.version>=9?8:doc.version}));
  if(ctx){R.apply(preview.engine,ctx.simulation);preview.engine.scenarioContext=ctx;}
  preview.sourceVersion=doc.version;preview.experience=ctx;preview.experienceFingerprint=ctx?X.hash(ctx):null;
  preview.migrationNotes=[...(preview.migrationNotes||[]),...migrationNotes];return preview;
 };
 S.commit=preview=>{
  if(preview.experience&&X.hash(preview.experience)!==preview.experienceFingerprint)throw Error('Experience review is stale');
  const ctx=preview.experience?X.checkContext(preview.experience):null;
  const engine=P.withProfile(ctx?.world||P.defaults,()=>native.commit(preview));
  if(ctx){R.apply(engine,ctx.simulation);engine.scenarioContext=ctx;}
  return X.activate(engine);
 };
 for(const name of['applyContent','applyAdventure','applyWorld','applyGrowth']){const operation=S[name];S[name]=(pack,engine,newStory=false)=>{
  const next=operation(pack,engine,newStory);if(engine.scenarioContext){const ctx=X.checkContext(engine.scenarioContext);R.apply(next,ctx.simulation);next.scenarioContext=C.copy(ctx);}return next;};}
 if(node)module.exports=S;
})(typeof globalThis!=='undefined'?globalThis:this);
