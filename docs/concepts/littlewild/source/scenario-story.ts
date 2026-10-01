/* Portable format 10 adds a versioned simulation profile to experience context.
 * Legacy envelope-9 experiences migrate explicitly to the classic compatibility profile.
 * Native state remains v8 and ECS runtime objects remain transient. */
(function(root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const S = node ? require('./story-codec.js') : root.LWStory;
  const X = node ? require('./scenario-runtime.js') : root.LWScenarios;
  const P = root.LWWorldProfile, Profiles=root.LWSimulationProfile, C = root.LWContent;
  const native = {encode:S.encode, inspect:S.inspect, commit:S.commit};
  const legacyHash=value=>C.fingerprint({schemaVersion:1,components:value});
  const reviews=new WeakMap();
  const reviewOf=preview=>legacyHash({experience:preview.experience,
    experienceFingerprint:preview.experienceFingerprint,simulationFingerprint:preview.simulationFingerprint});
  S.encode = (engine, savedAt=null) => {
    const doc = native.encode(engine, savedAt);
    if (engine.scenarioContext) {
      const ctx=X.checkContext(engine.scenarioContext);
      doc.version = 10;
      doc.experience = C.copy(ctx);
      doc.experienceFingerprint = X.hash(doc.experience);
      doc.simulationFingerprint = Profiles.fingerprint(doc.experience.simulation);
    }
    return doc;
  };
  S.inspect = input => {
    const doc = C.parse(input, S.SAVE_LIMIT);
    let ctx=null,migration={migrationNotes:[]};
    if(doc.version===9||doc.version===10){
      if(doc.version===9&&legacyHash(doc.experience)!==doc.experienceFingerprint)throw Error('Experience fingerprint does not match');
      migration=X.migrateContext(doc.experience);ctx=X.checkContext(migration.context);
      if(doc.version===10&&X.hash(ctx)!==doc.experienceFingerprint)throw Error('Experience fingerprint does not match');
      if(doc.version===10&&doc.simulationFingerprint!==Profiles.fingerprint(ctx.simulation))throw Error('Simulation profile fingerprint does not match');
      X.checkWorld(ctx.world,doc.world.library);
    }
    const preview = Profiles.withProfile(ctx?.simulation||Profiles.defaults,()=>P.withProfile(ctx?.world || P.defaults,
      () => native.inspect({...doc,version:(doc.version===9||doc.version===10)?8:doc.version})));
    if (ctx) preview.engine.scenarioContext = ctx;
    preview.migrationNotes.push(...migration.migrationNotes);
    preview.sourceVersion = doc.version;
    preview.experience = ctx;
    preview.experienceFingerprint = ctx ? X.hash(ctx) : null;
    preview.simulationFingerprint=ctx?Profiles.fingerprint(ctx.simulation):Profiles.fingerprint(Profiles.defaults);
    preview.changesSimulation = Profiles.hash !== preview.simulationFingerprint;
    reviews.set(preview,reviewOf(preview));
    return preview;
  };
  S.commit = preview => {
    if(!preview||reviews.get(preview)!==reviewOf(preview))throw Error('Experience review is stale');
    if (preview.experience && X.hash(preview.experience) !== preview.experienceFingerprint) throw Error('Experience review is stale');
    const ctx = preview.experience ? X.checkContext(preview.experience) : null;
    if(ctx&&Profiles.fingerprint(ctx.simulation)!==preview.simulationFingerprint)throw Error('Simulation profile review is stale');
    const engine = Profiles.withProfile(ctx?.simulation||Profiles.defaults,()=>P.withProfile(ctx?.world || P.defaults, () => native.commit(preview)));
    if (ctx) engine.scenarioContext = ctx;
    X.activate(engine); return engine;
  };
  // Library edits keep scenario identity, world and simulation profile, including recreated engines.
  for (const name of ['applyContent','applyAdventure','applyWorld','applyGrowth']) {
    const operation = S[name];
    S[name] = (pack, engine, newStory=false) => {
      const profile=engine.scenarioContext?.simulation||Profiles.defaults;
      const next = Profiles.withProfile(profile,()=>operation(pack,engine,newStory));
      if (engine.scenarioContext) next.scenarioContext = C.copy(engine.scenarioContext);
      return next;
    };
  }
  if(node) module.exports=S;
})(typeof globalThis !== 'undefined' ? globalThis : this);
