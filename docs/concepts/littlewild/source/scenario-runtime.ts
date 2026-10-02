/* Reusable experience boundary: definition libraries + world template + scene state.
 * Validation is synchronous and reversible. Only a confirmed launch changes registries.
 * Stable simulation roles remain compiled code; packs select validated data profiles only. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const L = node ? require('./simulation.cjs') : root.LW;
  const C = root.LWContent, A = root.LWAdventure, W = root.LWWorldContent;
  const G = root.LWGrowth, P = root.LWWorldProfile, Profiles = root.LWSimulationProfile;
  const shape = node ? require('./scenario-shape.js') : root.LWScenarioShape;
  const schema = node ? require('./content/scenario.schema.json') : root.LWScenarioSchema;
  const builtin = node ? [require('./content/littlewild.pack.json'), require('./content/emberworks.pack.json')] : root.LWScenarioPacks;
  const copy = C.copy, hash = value => C.fingerprint({ schemaVersion: 2, components: value });
  const sceneReview = (packFingerprint, sceneId) => hash({packFingerprint, sceneId});
  const sceneReviews = new WeakMap();
  function stage(label, work) {
    try { return work(); }
    catch (error) {
      const issues = Array.isArray(error?.issues) ? error.issues.map(issue => (issue.path || '/') + ': ' + issue.message) : null;
      const detail = issues?.length ? issues.join('\n') : (error?.message || String(error));
      throw Error(label + ': ' + detail);
    }
  }
  function unique(entries, path) {
    if (new Set(entries.map(e => e.id)).size !== entries.length) throw Error(path + ': duplicate IDs');
  }
  function checkWorld(world, library) {
    const issues = shape(world, { ...schema.$defs.world, $defs: schema.$defs });
    if (issues.length) throw Error(issues.join('\n'));
    // This engine's edge crossings are fixed; editing these would sever a bridge.
    for (let i = 0; i < 19; i++) if (world.terrain[9][i] !== '.' || world.terrain[i][9] !== '.') throw Error('/worlds/' + world.id + ': keep the central east/west and north/south paths open');
    const seen = new Set();
    for (const site of world.fixedSites) {
      const key = site.x + ',' + site.y;
      if (seen.has(key)) throw Error('/fixedSites: duplicate position ' + key);
      if (!Object.hasOwn(library.nodes, site.kind) && !library.nodes.some?.(n => n.id === site.kind)) throw Error('/fixedSites: unknown node ' + site.kind);
      if (world.terrain[site.y][site.x] !== '.') throw Error('/fixedSites: site must be on land');
      seen.add(key);
    }
    const layout={estate:{islands:[{ix:0,iy:0}]},nodes:world.fixedSites,buildings:[]};
    P.withProfile(world,()=>{const grid=new root.LWGeography.Grid(layout);if(grid.flood({x:9,y:9}).size!==grid.cells.size||world.fixedSites.some(n=>!grid.approach(n)))throw Error('/fixedSites: blocking nodes disconnect this island or an authored site');});
    // Detect a completely isolated authored land pocket before playing.
    const q = [[9, 9]], connected = new Set(['9,9']);
    for (let h = 0; h < q.length; h++) for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const x = q[h][0] + dx, y = q[h][1] + dy, key = x + ',' + y;
      if (world.terrain[y]?.[x] === '.' && !connected.has(key)) { connected.add(key); q.push([x,y]); }
    }
    if (connected.size !== world.terrain.join('').split('.').length - 1) throw Error('/terrain: disconnected land');
  }
  function withLibraries(libraries, work) {
    const previousA = copy(A.content);
    return C.registry.withLibrary(libraries.base, () => {
      try {
        A.replace(libraries.adventure);
        return W.withLibrary(libraries.world, () => G.withLibrary(libraries.growth, work));
      } finally { A.replace(previousA); }
    });
  }
  function withRuntime(libraries, simulation, work) {
    return Profiles.withProfile(simulation, () => withLibraries(libraries, work));
  }
  function context(pack, scene) {
    return { schemaVersion: 2, packId: pack.id, name: pack.name, version: pack.version, sceneId: scene.id,
      sceneName: scene.name, worldId: scene.worldId, presentation: copy(pack.presentation), simulation: copy(pack.simulation),
      world: copy(pack.worlds.find(w => w.id === scene.worldId)), tutorial: copy(pack.tutorial) };
  }
  function checkContext(input) {
    const ctx=copy(input);
    if(!ctx||typeof ctx!=='object'||Array.isArray(ctx)||ctx.schemaVersion!==2)throw Error('Unsupported experience context version; expected schemaVersion 2');
    const fields = ['schemaVersion','packId','name','version','sceneId','sceneName','worldId','presentation','simulation','world','tutorial'];
    if (!ctx || fields.some(k => !Object.hasOwn(ctx,k)) || Object.keys(ctx).some(k => !fields.includes(k))) throw Error('Invalid experience context');
    const mini = { format: 'living-worlds-pack', schemaVersion: 2, id: ctx.packId, version: ctx.version,
      name: ctx.name, description: 'Saved experience', presentation: ctx.presentation, simulation: ctx.simulation,
      worlds: [ctx.world], scenes: [{ id: ctx.sceneId, name: ctx.sceneName, description: 'Saved scene', worldId: ctx.worldId, initialState: {} }], tutorial: ctx.tutorial, libraries: {base:{}, adventure:{}, world:{}, growth:{}} };
    const errors = shape(mini, schema);
    if (errors.length) throw Error(errors.join('\n'));
    Profiles.validate(ctx.simulation);
    if (ctx.world.id !== ctx.worldId) throw Error('World identity mismatch');
    unique(ctx.tutorial, '/tutorial');
    return copy(ctx);
  }
  // Native saves are extensible, but authored scenes should not silently accept
  // misspelled top-level or player fields. Other nested records retain their
  // established subsystem validators; this is not a replacement save schema.
  function checkSceneFields(state, path) {
    const rootKeys = ['version','seed','simTime','day','hour','started','speed','paused',
      'player','rp','buildings','nodes','log','completedQuests','contractIndex','settings',
      'ledger','nextId','colony','world','estate','progression','market','planning','atlas'];
    for (const key of Object.keys(state)) if (!rootKeys.includes(key))
      throw Error(path + '/' + key + ': unknown scene-state field');
    if (state.player && typeof state.player === 'object')
      for (const key of Object.keys(state.player)) if (!['level','xp','coins'].includes(key))
        throw Error(path + '/player/' + key + ': unknown player field');
  }
  function validate(input) {
    try {
      const pack = stage('pack parse', () => C.parse(input, 8 * 1024 * 1024));
      if(pack?.schemaVersion!==2)return {ok:false,errors:['/schemaVersion: only current scenario schema version 2 is supported']};
      const errors=shape(pack,schema);
      if (errors.length) return {ok:false,errors};
      unique(pack.worlds, '/worlds'); unique(pack.scenes, '/scenes'); unique(pack.tutorial, '/tutorial');
      stage('simulation profile', () => Profiles.validate(pack.simulation));
      const base = stage('base library', () => C.registry.prepare(pack.libraries.base));
      if (!base.ok) throw Error(base.errors.map(e => e.path + ': ' + e.message).join('\n'));
      const ad = stage('adventure library', () => A.validate(pack.libraries.adventure));
      if (!ad.ok) throw Error(ad.errors.join('\n'));
      stage('runtime staging', () => withRuntime(pack.libraries,pack.simulation, () => {
        for (const world of pack.worlds) checkWorld(world, pack.libraries.world);
        for (const scene of pack.scenes) {
          const ctx = context(pack,scene);
          if (!ctx.world) throw Error('/scenes/' + scene.id + ': unknown world');
          checkSceneFields(scene.initialState, '/scenes/'+scene.id+'/initialState');
          const imported=stage('scene '+scene.id+' import', () => P.withProfile(ctx.world, () => L.Engine.import({app:'littlewild',version:8,state:scene.initialState})));
          if(C.stable(imported.export().state)!==C.stable(scene.initialState))throw Error('/scenes/'+scene.id+'/initialState: unknown or noncanonical state values; capture a current scene as a template');
        }
      }));
      return { ok: true, errors: [], pack: stage('pack copy', () => copy(pack)), fingerprint: hash(pack), sceneCount: pack.scenes.length };
    } catch (error) {
      const issues = Array.isArray(error?.issues) ? error.issues.map(issue => (issue.path || '/') + ': ' + issue.message) : null;
      return { ok:false, errors: issues?.length ? issues : [error?.message || String(error)] };
    }
  }
  function prepareScene(pack, id) {
    const checked = validate(pack);
    if (!checked.ok) throw Error(checked.errors.join('\n'));
    const scene = checked.pack.scenes.find(s => s.id === id);
    if (!scene) throw Error('Choose a scene in this pack');
    const ctx = context(checked.pack, scene);
    const engine = withRuntime(checked.pack.libraries,ctx.simulation, () => P.withProfile(ctx.world,
      () => L.Engine.import({app:'littlewild',version:8,state:scene.initialState})));
    engine.scenarioContext = ctx;
    const preview = { ...checked, sceneId: id, engine, context: ctx };
    sceneReviews.set(preview, sceneReview(checked.fingerprint,id));
    return preview;
  }
  function commitScene(preview) {
    if (!preview?.ok || hash(preview.pack) !== preview.fingerprint ||
      sceneReview(preview.fingerprint,preview.sceneId) !== sceneReviews.get(preview))
      throw Error('Scenario preview changed; review again');
    const fresh = prepareScene(preview.pack, preview.sceneId), libs = fresh.pack.libraries;
    // All contracts, the simulation profile and the complete scene were accepted above. Install together.
    const previous = {base:C.registry.export(),adventure:copy(A.content),world:copy(W.content),growth:copy(G.content),simulation:copy(Profiles.current)}, priorWorld = P.current;
    try {
      C.registry.commit(C.registry.prepare(libs.base)); A.replace(libs.adventure);
      W.replace(libs.world); G.replace(libs.growth); Profiles.apply(fresh.context.simulation); P.apply(fresh.context.world);
    } catch (error) {
      C.registry.commit(C.registry.prepare(previous.base)); A.replace(previous.adventure);
      W.replace(previous.world); G.replace(previous.growth); Profiles.apply(previous.simulation); P.apply(priorWorld); throw error;
    }
    return fresh.engine;
  }
  function activate(engine) {
    Profiles.apply(engine.scenarioContext?.simulation || Profiles.defaults);
    P.apply(engine.scenarioContext?.world || P.defaults);
  }
  function capture(engine) {
    const ctx = engine.scenarioContext ? copy(engine.scenarioContext) : context(builtin[0], builtin[0].scenes[0]);
    if(!engine.scenarioContext){ctx.world=copy(P.defaults);ctx.simulation=copy(engine.simulationProfile||Profiles.current||Profiles.defaults);}
    return {format:'living-worlds-pack',schemaVersion:2,id:ctx.packId,version:ctx.version,name:ctx.name,
      description:'Editable scenario captured from this world. Launching creates a new story.',
      presentation:copy(ctx.presentation),simulation:copy(ctx.simulation),worlds:[copy(ctx.world)],tutorial:copy(ctx.tutorial),
      scenes:[{id:ctx.sceneId,name:ctx.sceneName,description:'Captured starting state',worldId:ctx.worldId,initialState:engine.export().state}],
      libraries:{base:C.registry.export(),adventure:copy(A.content),world:copy(W.content),growth:copy(G.content)}};
  }
  const api = {validate,prepareScene,commitScene,activate,capture,checkContext,checkWorld,hash,withLibraries,withRuntime,schema,
    builtins: () => copy(builtin), defaultTutorial: () => copy(builtin[0].tutorial), defaultPresentation: () => copy(builtin[0].presentation),
    defaultSimulation:()=>copy(Profiles.defaults)};
  root.LWScenarios = api; if (node) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
