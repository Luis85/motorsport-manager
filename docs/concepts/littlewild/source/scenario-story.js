/* Portable format 9 adds the active experience to the existing four-library codec.
 * Legacy saves retain their exact mechanics and the default geographic profile. */
(function(root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const S = node ? require('./story-codec.js') : root.LWStory;
  const X = node ? require('./scenario-runtime.js') : root.LWScenarios;
  const P = root.LWWorldProfile, C = root.LWContent;
  const native = {encode:S.encode, inspect:S.inspect, commit:S.commit};
  S.encode = engine => {
    const doc = native.encode(engine);
    if (engine.scenarioContext) {
      doc.version = 9;
      doc.experience = C.copy(engine.scenarioContext);
      doc.experienceFingerprint = X.hash(doc.experience);
    }
    return doc;
  };
  S.inspect = input => {
    const doc = C.parse(input, S.SAVE_LIMIT), ctx = doc.version === 9 ? X.checkContext(doc.experience) : null;
    if (ctx && X.hash(ctx) !== doc.experienceFingerprint) throw Error('Experience fingerprint does not match');
    if (ctx) X.checkWorld(ctx.world,doc.world.library);
    const preview = P.withProfile(ctx?.world || P.defaults, () => native.inspect({...doc,version:doc.version===9?8:doc.version}));
    if (ctx) preview.engine.scenarioContext = ctx;
    preview.sourceVersion = doc.version;
    preview.experience = ctx;
    preview.experienceFingerprint = ctx ? X.hash(ctx) : null;
    return preview;
  };
  S.commit = preview => {
    if (preview.experience && X.hash(preview.experience) !== preview.experienceFingerprint) throw Error('Experience review is stale');
    const ctx = preview.experience ? X.checkContext(preview.experience) : null;
    const engine = P.withProfile(ctx?.world || P.defaults, () => native.commit(preview));
    if (ctx) engine.scenarioContext = ctx;
    X.activate(engine); return engine;
  };
  // Library edits keep scenario identity and its world, including a recreated engine.
  for (const name of ['applyContent','applyAdventure','applyWorld','applyGrowth']) {
    const operation = S[name];
    S[name] = (pack, engine, newStory=false) => {
      const next = operation(pack,engine,newStory);
      if (engine.scenarioContext) next.scenarioContext = C.copy(engine.scenarioContext);
      return next;
    };
  }
  if(node) module.exports=S;
})(typeof globalThis !== 'undefined' ? globalThis : this);
