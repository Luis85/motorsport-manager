/// <reference path="./content-provider-contracts.d.ts" />
/* Reusable experience boundary: definition libraries + world template + scene state.
 * Validation is synchronous and reversible. Only a confirmed launch changes registries.
 * Stable simulation roles remain compiled code; packs select validated data profiles only. */
(function (inputRoot:unknown) {
  'use strict';
  interface ProfileApi {readonly defaults:LWContentPorts.SimulationProfile;readonly current:LWContentPorts.SimulationProfile;validate(input:unknown):LWContentPorts.SimulationProfile;apply(input:unknown):string;fingerprint(input:unknown):string;withProfile<T>(profile:unknown,work:()=>T):T;}
  interface WorldProfileApi {readonly defaults:LWContentPorts.WorldProfile;readonly current:LWContentPorts.WorldProfile;apply(profile:LWContentPorts.WorldProfile):void;withProfile<T>(profile:LWContentPorts.WorldProfile,work:()=>T):T;}
  interface EngineFacade {Engine:{import(input:unknown):LWContentPorts.ScenarioEngine};}
  interface Root {LWSceneGraph:LWSceneGraph.Api;LWSceneNavigation:LWSceneNavigation.NavigationApi;LW?:EngineFacade;LWContent?:LWContentPorts.ContentApi;LWAdventure?:LWContentPorts.AdventureApi;LWWorldContent?:LWContentPorts.WorldApi;LWGrowth?:LWContentPorts.GrowthApi;LWWorldProfile?:WorldProfileApi;LWSimulationProfile?:ProfileApi;LWScenarioShape?:(input:unknown,schema:LWContentPorts.Schema)=>string[];LWScenarioSchema?:LWContentPorts.Schema;LWContentProvider?:LWContentProvider.Api;LWScenarios?:LWContentPorts.ScenarioApi;LWScenarioResources?:{snapshot():LWContentPorts.Resources;defaults():LWContentPorts.Resources;validate(input:unknown):LWContentPorts.Resources;withResources<T>(input:LWContentPorts.Resources|undefined,work:()=>T):T;apply(input:LWContentPorts.Resources|undefined):void;checkBindings(resources:LWContentPorts.Resources|undefined,libraries:LWContentPorts.Libraries):void;};LWGeography:{Grid:new(layout:{estate:{islands:{ix:number;iy:number}[]};nodes:{kind:string;x:number;y:number}[];buildings:never[]})=>{cells:Set<string>;flood(point:{x:number;y:number}):Set<string>;approach(point:{x:number;y:number}):boolean};};}
  const root=inputRoot as Root;
  const isRecord=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  function issueMessages(error:unknown):string[]|null{if(!isRecord(error)||!Array.isArray(error.issues))return null;return error.issues.map(issue=>{const row=isRecord(issue)?issue:{};return (row.path||'/')+': '+row.message;});}
  const message=(error:unknown):string=>error instanceof Error?error.message:String(error);
  // Only called after the bundled scene/context schema has accepted these values.
  const acceptedWorld=(value:unknown):LWContentPorts.WorldProfile=>value as LWContentPorts.WorldProfile;
  function packShape(value:unknown,errors:string[]):value is LWContentPorts.ScenarioPack{errors.push(...shape(value,schema));return errors.length===0;}
  const node = typeof module !== 'undefined' && module.exports;
  const graph=(node?require('./scene-graph.js'):root.LWSceneGraph) as LWSceneGraph.Api;
  const resources=(node?require('./scenario-resources.js'):root.LWScenarioResources) as NonNullable<Root['LWScenarioResources']>;
  const facade=(node ? require('./simulation.cjs') : root.LW) as EngineFacade|undefined;
  const navigation=(node?require('./scene-navigation.js'):root.LWSceneNavigation) as LWSceneNavigation.NavigationApi;
  const content=root.LWContent,adventure=root.LWAdventure,worldContent=root.LWWorldContent;
  const growth=root.LWGrowth,worldProfile=root.LWWorldProfile,profiles=root.LWSimulationProfile;
  const shapeValidator=(node ? require('./scenario-shape.js') : root.LWScenarioShape) as Root['LWScenarioShape'];
  const packSchema=(node ? require('./content/scenario.schema.json') : root.LWScenarioSchema) as LWContentPorts.Schema|undefined;
  const provider=(node ? require('./content-provider.js') : root.LWContentProvider) as LWContentProvider.Api|undefined;
  if(!facade||!content||!adventure||!worldContent||!growth||!worldProfile||!profiles||!shapeValidator||!packSchema||!provider)throw Error('Scenario runtime dependencies are missing.');
  const L=facade,C=content,A=adventure,W=worldContent,G=growth,P=worldProfile,Profiles=profiles,shape=shapeValidator,schema=packSchema,Content=provider;
  type Balance={startingScenes:LWContentPorts.Scene[];world:LWContentPorts.WorldProfile;libraries:LWContentPorts.Libraries;simulation:LWContentPorts.SimulationProfile;creatures:unknown;interactions:unknown;interiors:unknown};
  let installed:{packs:LWContentPorts.ScenarioPack[];defaultPack:LWContentPorts.ScenarioPack}|null=null;
  /**
   * The installed game's scenario catalog in its declared order. Its canonical pack (if declared)
   * is a detached copy refreshed from the game's balancing defaults; other packs stay as admitted
   * profile data and are only ever handed out as copies.
   */
  function catalog():{packs:LWContentPorts.ScenarioPack[];defaultPack:LWContentPorts.ScenarioPack} {
    if(installed)return installed;
    const profile=Content.get('the scenario catalog'),scenarios=profile.scenarios;
    if(!scenarios?.packs.length)throw Error('Scenario runtime dependencies are missing.');
    const canonicalId=scenarios.canonicalId;
    const packs=(scenarios.packs as LWContentPorts.ScenarioPack[]).map(pack=>canonicalId!==undefined&&pack.id===canonicalId?JSON.parse(JSON.stringify(pack)) as LWContentPorts.ScenarioPack:pack);
    const classic=canonicalId===undefined?undefined:packs.find(pack=>pack.id===canonicalId);
    if(classic){const balance=profile.balancing as Balance;refresh(classic,balance);}
    const defaultPack=packs.find(pack=>pack.id===scenarios.defaultId);
    if(!defaultPack)throw Error('Scenario runtime dependencies are missing.');
    return installed={packs,defaultPack};
  }
  function refresh(classic:LWContentPorts.ScenarioPack,balance:Balance):void{
    {classic.scenes=C.copy(balance.startingScenes);classic.libraries=C.copy(balance.libraries);classic.simulation=C.copy(balance.simulation);classic.worlds=classic.worlds.map(w=>w.id===balance.world.id?C.copy(balance.world):w);if(classic.resources)classic.resources.creatures=C.copy(resources.defaults().creatures);for(const scene of classic.scenes){const state=scene.initialState;if(state.creatureInteractions&&typeof state.creatureInteractions==='object') (state.creatureInteractions as {library?:unknown}).library=C.copy(balance.interactions);if(state.interiors&&typeof state.interiors==='object') (state.interiors as {catalog?:unknown}).catalog=C.copy(balance.interiors);}}
  }
  const copy = C.copy, hash = (value:unknown) => C.fingerprint({ schemaVersion: 2, components: value });
  const sceneReview = (packFingerprint:string, sceneId:string) => hash({packFingerprint, sceneId});
  const sceneReviews = new WeakMap<object,string>();
  const sceneAdmissions = new WeakMap<object,{state:Record<string,unknown>;events:LWSceneGraph.Event[]}>();
  function stage<T>(label:string, work:()=>T):T {
    try { return work(); }
    catch (error) {
      const issues = issueMessages(error);
      const detail = issues?.length ? issues.join('\n') : message(error);
      throw Error(label + ': ' + detail);
    }
  }
  function unique(entries:readonly {id:string}[], path:string) {
    if (new Set(entries.map(e => e.id)).size !== entries.length) throw Error(path + ': duplicate IDs');
  }
  function checkWorld(world:LWContentPorts.WorldProfile, library:LWContentPorts.World):void {
    const issues = shape(world, { ...schema.$defs!.world!, $defs: schema.$defs! });
    if (issues.length) throw Error(issues.join('\n'));
    // This engine's edge crossings are fixed; editing these would sever a bridge.
    for (let i = 0; i < 19; i++) if (world.terrain[9]![i] !== '.' || world.terrain[i]![9] !== '.') throw Error('/worlds/' + world.id + ': keep the central east/west and north/south paths open');
    const seen = new Set();
    for (const site of world.fixedSites) {
      const key = site.x + ',' + site.y;
      if (seen.has(key)) throw Error('/fixedSites: duplicate position ' + key);
      if (!Object.hasOwn(library.nodes, site.kind) && !library.nodes.some?.(n => n.id === site.kind)) throw Error('/fixedSites: unknown node ' + site.kind);
      if (world.terrain[site.y]![site.x] !== '.') throw Error('/fixedSites: site must be on land');
      seen.add(key);
    }
    const layout={estate:{islands:[{ix:0,iy:0}]},nodes:world.fixedSites,buildings:[]};
    P.withProfile(world,()=>{const grid=new root.LWGeography.Grid(layout);if(grid.flood({x:9,y:9}).size!==grid.cells.size||world.fixedSites.some(n=>!grid.approach(n)))throw Error('/fixedSites: blocking nodes disconnect this island or an authored site');});
    // Detect a completely isolated authored land pocket before playing.
    const q:[number,number][] = [[9, 9]], connected = new Set(['9,9']);
    for (let h = 0; h < q.length; h++) for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
      const x = q[h]![0] + dx, y = q[h]![1] + dy, key = x + ',' + y;
      if (world.terrain[y]?.[x] === '.' && !connected.has(key)) { connected.add(key); q.push([x,y]); }
    }
    if (connected.size !== world.terrain.join('').split('.').length - 1) throw Error('/terrain: disconnected land');
  }
  function withLibraries<T>(libraries:LWContentPorts.Libraries, work:()=>T):T {
    const previousA = copy(A.content);
    try {
      return C.registry.withLibrary(libraries.base, () => {
        stage('adventure library', () => A.replace(libraries.adventure));
        return W.withLibrary(libraries.world, () => G.withLibrary(libraries.growth, work));
      });
    } finally {
      // Restore prerequisites first: each catalog validates against its own base context.
      A.replace(previousA);
    }
  }
  function withRuntime<T>(libraries:LWContentPorts.Libraries, simulation:LWContentPorts.SimulationProfile, work:()=>T):T {
    return Profiles.withProfile(simulation, () => withLibraries(libraries, work));
  }
  // Profile activation and library installation form one synchronous transaction.
  // Restoring only the native story libraries would leave a failed launch partially active.
  function transaction<T>(work:()=>T):T {
    const previousResources=resources.snapshot();
    const previous = {base:C.registry.export(),adventure:copy(A.content),world:copy(W.content),growth:copy(G.content),simulation:copy(Profiles.current)}, priorWorld = P.current;
    try {
      const result = work();
      if (result && ['object','function'].includes(typeof result) && typeof (result as {then?:unknown}).then === 'function')
        throw Error('Scenario transaction callback must be synchronous.');
      return result;
    } catch (error) {
      C.registry.commit(C.registry.prepare(previous.base)); A.replace(previous.adventure);
      W.replace(previous.world); G.replace(previous.growth); Profiles.apply(previous.simulation); P.apply(priorWorld); resources.apply(previousResources); throw error;
    }
  }
  function context(pack:LWContentPorts.ScenarioPack, scene:LWContentPorts.Scene):LWContentPorts.ExperienceContext {
    return { ...(pack.resources?{resources:copy(pack.resources)}:{}),schemaVersion: 2, packId: pack.id, name: pack.name, version: pack.version, sceneId: scene.id,
      sceneName: scene.name, worldId: scene.worldId, presentation: copy(pack.presentation), simulation: copy(pack.simulation),
      world: copy(pack.worlds.find(w => w.id === scene.worldId)!), tutorial: copy(pack.tutorial) };
  }
  function checkContext(input:unknown):LWContentPorts.ExperienceContext {
    const ctx=copy(input);
    if(!isRecord(ctx)||ctx.schemaVersion!==2)throw Error('Unsupported experience context version; expected schemaVersion 2');
    const fields = ['schemaVersion','packId','name','version','sceneId','sceneName','worldId','presentation','simulation','world','tutorial','resources','journey'];
    if (!ctx || fields.filter(k=>!['resources','journey'].includes(k)).some(k => !Object.hasOwn(ctx,k)) || Object.keys(ctx).some(k => !fields.includes(k))) throw Error('Invalid experience context');
    const mini = { format: 'living-worlds-pack', schemaVersion: 2, id: ctx.packId, version: ctx.version,
      name: ctx.name,...(ctx.resources?{resources:ctx.resources}:{}), description: 'Saved experience', presentation: ctx.presentation, simulation: ctx.simulation,
      worlds: [ctx.world], scenes: [{ id: ctx.sceneId, name: ctx.sceneName, description: 'Saved scene', worldId: ctx.worldId, initialState: {} }], tutorial: ctx.tutorial, libraries: {base:{}, adventure:{}, world:{}, growth:{}} };
    const errors = shape(mini, schema);
    if (errors.length) throw Error(errors.join('\n'));
    Profiles.validate(ctx.simulation);
    if (!isRecord(ctx.world)||ctx.world.id !== ctx.worldId) throw Error('World identity mismatch');
    const checked:LWContentPorts.ExperienceContext={schemaVersion:2,packId:ctx.packId as string,name:ctx.name as string,version:ctx.version as string,sceneId:ctx.sceneId as string,sceneName:ctx.sceneName as string,worldId:ctx.worldId as string,presentation:ctx.presentation as LWContentPorts.Presentation,simulation:ctx.simulation as LWContentPorts.SimulationProfile,world:acceptedWorld(ctx.world),tutorial:ctx.tutorial as LWContentPorts.Tutorial[]};
    const contextResources=ctx.resources??(isRecord(ctx.journey)&&isRecord(ctx.journey.pack)?ctx.journey.pack.resources:undefined);
    if(contextResources)checked.resources=resources.validate(contextResources);
    unique(checked.tutorial, '/tutorial');
    if(ctx.journey!==undefined)checked.journey=navigation.check(ctx.journey,checked);
    return copy(checked);
  }
  // Native saves are extensible, but authored scenes should not silently accept
  // misspelled top-level or player fields. Other nested records retain their
  // established subsystem validators; this is not a replacement save schema.
  function checkSceneFields(state:Record<string,unknown>, path:string):void {
    const rootKeys = ['version','seed','simTime','day','hour','started','speed','paused',
      'player','rp','buildings','nodes','log','completedQuests','contractIndex','settings',
      'ledger','nextId','colony','world','estate','progression','market','planning','atlas','creatureInteractions','interiors','construction','terraform','scenarioWorkflow','scenarioResources'];
    for (const key of Object.keys(state)) if (!rootKeys.includes(key))
      throw Error(path + '/' + key + ': unknown scene-state field');
    if (isRecord(state.player)) {
      for (const key of Object.keys(state.player)) if (!['level','xp','coins'].includes(key))
        throw Error(path + '/player/' + key + ': unknown player field');
      const player = state.player;
      if (typeof player.level!=='number'||!Number.isSafeInteger(player.level) || player.level < 1 || player.level > 1000000)
        throw Error(path + '/player/level: expected a positive integer');
      if (typeof player.xp!=='number'||!Number.isSafeInteger(player.xp) || player.xp < 0 || player.xp > Number.MAX_SAFE_INTEGER)
        throw Error(path + '/player/xp: expected a non-negative integer');
      if (typeof player.coins!=='number'||!Number.isSafeInteger(player.coins) || player.coins < 0 || player.coins > Number.MAX_SAFE_INTEGER)
        throw Error(path + '/player/coins: expected a non-negative integer');
    } else throw Error(path + '/player: expected an object');
  }
  function validate(input:unknown):LWContentPorts.PackValidation {
    try {
      const parsed = stage('pack parse', () => C.parse(input, 8 * 1024 * 1024));
      if(!isRecord(parsed)||parsed.schemaVersion!==2)return {ok:false,errors:['/schemaVersion: only current scenario schema version 2 is supported']};
      const errors:string[]=[];
      if (!packShape(parsed,errors)) return {ok:false,errors};
      const pack=parsed;
      unique(pack.worlds, '/worlds'); unique(pack.scenes, '/scenes'); unique(pack.tutorial, '/tutorial');
      stage('scene graph',()=>{
        graph.validate(pack);
        if(pack.scenes.some(scene=>scene.graph)){
          const compact=copy(pack);for(const scene of compact.scenes)delete scene.initialState.scenarioResources;
          for(const scene of compact.scenes)C.parse({pack:compact,checkpoints:{[graph.owner(compact,scene.id).id]:graph.owner(compact,scene.id).initialState},visited:[scene.id]},8*1024*1024);
        }
      });
      stage('simulation profile', () => Profiles.validate(pack.simulation));
      const base = stage('base library', () => C.registry.prepare(pack.libraries.base));
      if (!base.ok) throw Error(base.errors.map(e => e.path + ': ' + e.message).join('\n'));
      stage('resources',()=>{if(pack.resources)resources.validate(pack.resources);resources.checkBindings(pack.resources,pack.libraries);});
      stage('runtime staging', () => resources.withResources(pack.resources,()=>withRuntime(pack.libraries,pack.simulation, () => {
        for (const world of pack.worlds) checkWorld(world, pack.libraries.world);
        for (const scene of pack.scenes) {
          const ctx = context(pack,scene);
          if (!ctx.world) throw Error('/scenes/' + scene.id + ': unknown world');
          if(scene.graph?.binding)continue;
          checkSceneFields(scene.initialState, '/scenes/'+scene.id+'/initialState');
          if(scene.initialState.scenarioResources&&C.stable(scene.initialState.scenarioResources)!==C.stable(pack.resources))throw Error('Scene resources must match the complete pack catalogs.');
          const imported=stage('scene '+scene.id+' import', () => P.withProfile(ctx.world, () => L.Engine.import({app:'littlewild',version:8,state:scene.initialState})));
          if(C.stable(imported.export().state)!==C.stable(scene.initialState))throw Error('/scenes/'+scene.id+'/initialState: unknown or noncanonical state values; capture a current scene as a template');
        }
      })));
      return { ok: true, errors: [], pack: stage('pack copy', () => copy(pack)), fingerprint: hash(pack), sceneCount: pack.scenes.length };
    } catch (error) {
      const issues = issueMessages(error);
      return { ok:false, errors: issues?.length ? issues : [message(error)] };
    }
  }
  function prepareScene(pack:unknown, id:string, entryState?:Record<string,unknown>,connectionEvents:LWSceneGraph.Event[]=[]):LWContentPorts.ScenePreview {
    const checked = validate(pack);
    if (!checked.ok) throw Error(checked.errors.join('\n'));
    const scene = checked.pack.scenes.find(s => s.id === id);
    if (!scene) throw Error('Choose a scene in this pack');
    const ctx = context(checked.pack, scene);
    const state=copy(graph.owner(checked.pack,id).initialState);
    const issue=graph.entryIssue(scene.graph?.requirements,entryState??state);if(issue)throw Error(issue);
    const messages:string[]=[];
    for(const event of [...connectionEvents,...(scene.graph?.events??[])]){if(event.type==='pause')state.paused=event.paused;else if(event.type==='message')messages.push(event.text);}
    if(checked.pack.scenes.some(row=>row.graph)&&checked.pack.resources)state.scenarioResources=copy(checked.pack.resources);
    const engine = resources.withResources(checked.pack.resources,()=>withRuntime(checked.pack.libraries,ctx.simulation, () => P.withProfile(ctx.world,
      () => L.Engine.import({app:'littlewild',version:8,state}))));
    engine.scenarioContext = ctx;
    navigation.start(engine,checked.pack,id);
    const preview = { ...checked,messages, sceneId: id, engine, context: ctx };
    sceneReviews.set(preview, sceneReview(checked.fingerprint,id));
    if(entryState)sceneAdmissions.set(preview,{state:copy(entryState),events:copy(connectionEvents)});
    return preview;
  }
  function commitScene(preview:LWContentPorts.ScenePreview):LWContentPorts.ScenarioEngine {
    if (!preview?.ok || hash(preview.pack) !== preview.fingerprint ||
      sceneReview(preview.fingerprint,preview.sceneId) !== sceneReviews.get(preview))
      throw Error('Scenario preview changed; review again');
    const fresh = prepareScene(preview.pack, preview.sceneId,sceneAdmissions.get(preview)?.state,sceneAdmissions.get(preview)?.events), libs = fresh.pack.libraries;
    // All contracts, the simulation profile and the complete scene were accepted above. Install together.
    return transaction(() => {
      resources.apply(fresh.pack.resources);
      C.registry.commit(C.registry.prepare(libs.base)); A.replace(libs.adventure);
      W.replace(libs.world); G.replace(libs.growth); Profiles.apply(fresh.context.simulation); P.apply(fresh.context.world);
      return fresh.engine;
    });
  }
  function activate(engine:LWContentPorts.ScenarioEngine):void {
    resources.apply(engine.scenarioContext?.resources||engine.s?.scenarioResources);
    Profiles.apply(engine.scenarioContext?.simulation || Profiles.defaults);
    P.apply(engine.scenarioContext?.world || P.defaults);
  }
  function capture(engine:LWContentPorts.ScenarioEngine):LWContentPorts.ScenarioPack {
    const journeyPack=navigation.capture(engine);if(journeyPack)return journeyPack;
    const fallback = catalog().defaultPack;
    const ctx = engine.scenarioContext ? copy(engine.scenarioContext) : context(fallback, fallback.scenes[0]!);
    if(!engine.scenarioContext){ctx.world=copy(P.defaults);ctx.simulation=copy(engine.simulationProfile||Profiles.current||Profiles.defaults);}
    if(engine.simulationProfile&&Profiles.fingerprint(engine.simulationProfile)!==Profiles.fingerprint(ctx.simulation))
      throw Error('Experience simulation does not match the engine profile; restore the original context before capturing.');
    return {format:'living-worlds-pack',schemaVersion:2,id:ctx.packId,version:ctx.version,name:ctx.name,
      resources:resources.snapshot(),description:'Editable scenario captured from this world. Launching creates a new story.',
      presentation:copy(ctx.presentation),simulation:copy(ctx.simulation),worlds:[copy(ctx.world)],tutorial:copy(ctx.tutorial),
      scenes:[{id:ctx.sceneId,name:ctx.sceneName,description:'Captured starting state',worldId:ctx.worldId,initialState:engine.export().state}],
      libraries:{base:C.registry.export(),adventure:copy(A.content),world:copy(W.content),growth:copy(G.content)}};
  }
  const api:LWContentPorts.ScenarioApi = {validate,prepareScene,commitScene,activate,capture,checkContext,checkWorld,hash,withLibraries,withRuntime,transaction,schema,
    builtins: () => copy(catalog().packs), defaultPack: () => copy(catalog().defaultPack), defaultId: () => catalog().defaultPack.id,
    defaultTutorial: () => copy(catalog().defaultPack.tutorial), defaultPresentation: () => copy(catalog().defaultPack.presentation),
    defaultSimulation:()=>copy(Profiles.defaults)};
  Content.whenInstalled(() => { catalog(); }, 'scenarios');
  root.LWScenarios = api; if (node) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
