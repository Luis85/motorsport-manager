/* Portable stories bind the colony and four definition libraries to one exact snapshot.
 * Inspection is reversible; only a confirmed commit changes active definitions. */
/// <reference path="./content-contracts.d.ts" />
/// <reference path="./application-records.d.ts" />
(function (inputRoot: unknown) {
    'use strict';
    type Engine = LWApplication.StoryEngine;
    interface Preview {
        engine: Engine; library: LWContentPorts.Library; adventure: LWContentPorts.Adventure;
        world: LWContentPorts.World; growth: LWContentPorts.Growth;
        fingerprint: string; changesLibrary: boolean;
    }
    interface InputDocument {
        format?: unknown; app?: unknown; version?: unknown; state?: unknown;
        content?: {fingerprint?:unknown;library?:{kind?:unknown}};
        adventure?: {fingerprint?:unknown;library?:unknown};
        world?: {fingerprint?:unknown;library?:unknown};
        growth?: {fingerprint?:unknown;library?:unknown};
    }
    const root = inputRoot as {
        LWContent: LWContentPorts.ContentApi; LWAdventure: LWContentPorts.AdventureApi;
        LWWorldContent: LWContentPorts.WorldApi; LWGrowth: LWContentPorts.GrowthApi;
        LW: {Engine:{new():Engine;import(input:unknown):Engine}}; LWStory?: typeof api;
    };
    const node = typeof module !== 'undefined' && module.exports;
    const C = (node ? require('./content-runtime.js') : root.LWContent) as LWContentPorts.ContentApi;
    const L = (node ? require('./simulation.cjs') : root.LW) as typeof root.LW;
    const A = (node ? require('./adventure-content.js') : root.LWAdventure) as LWContentPorts.AdventureApi;
    const W = (node ? require('./world-content.js') : root.LWWorldContent) as LWContentPorts.WorldApi;
    const G = (node ? require('./growth-content.js') : root.LWGrowth) as LWContentPorts.GrowthApi;
    const registry = C.registry, SAVE_LIMIT = 12 * 1024 * 1024, STORY_VERSION = 10, ENGINE_STATE_VERSION = 8;
    // Review evidence is intentionally process-local and object-bound. A caller may
    // edit the public preview fields for display, but cannot replace the review token
    // and thereby commit a different story without inspecting it again.
    const reviews = new WeakMap<Preview,string>();
    const reviewHash = (value: unknown) => C.fingerprint({schemaVersion: 1, components: value});
    const reviewedSnapshot = (preview: Preview) => ({
        library: preview.library,
        adventure: preview.adventure,
        world: preview.world || W.defaults,
        growth: preview.growth || G.defaults,
        state: preview.engine?.export().state
    });
    const reviewFingerprint = (preview: Preview) => reviewHash(reviewedSnapshot(preview));
    function encode(engine: Engine, savedAt: string | null = null) {
        if (savedAt !== null && (typeof savedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(savedAt)))
            throw Error('Story timestamp must be an ISO UTC timestamp or null.');
        return { app: 'littlewild', version: STORY_VERSION, savedAt, content: { fingerprint: registry.hash, library: registry.export() }, adventure: { fingerprint: A.hash, library: A.copy(A.content) }, world: {fingerprint:W.hash,library:W.clone(W.content)}, growth:{fingerprint:G.hash,library:G.clone(G.content)}, state: engine.export().state };
    }
    function withAdventure<T>(pack: LWContentPorts.Adventure, fn: () => T): T { const previous = A.copy(A.content); try {
        A.replace(pack);
        return fn();
    }
    finally {
        A.replace(previous);
    } }
    function inspect(input: unknown) {
        const parsed = C.parse(input, SAVE_LIMIT);
        const doc = parsed as InputDocument | null;
        if (doc?.format)
            throw Error('This is a definition library. Use Content Library or Adventure Library, not Import story.');
        if (doc?.app !== 'littlewild' || doc.version !== STORY_VERSION || !doc.state)
            throw Error('Only the current Littlewild story format is supported.');
        if (doc.content?.library?.kind !== 'library' || !doc.adventure?.library || !doc.world?.library || !doc.growth?.library)
            throw Error('This story is missing its complete current definition snapshot.');
        if (doc.content.fingerprint !== C.fingerprint(doc.content.library))
            throw Error('The story’s definition fingerprint does not match.');
        const library = C.copy(doc.content.library);
        const content = registry.prepare(library);
        if (!content.ok) throw new C.ContentError(content.errors);
        if (doc.content.fingerprint !== content.fingerprint)
            throw Error('The story’s definition fingerprint does not match. Edit definitions through the library importer instead.');
        const expansion = A.validate(doc.adventure.library);
        if (!expansion.ok) throw Error(expansion.errors.join('\n'));
        if (doc.adventure.fingerprint !== A.hashOf(expansion.content))
            throw Error('The story’s adventure fingerprint does not match its definitions.');
        const land = registry.withLibrary(content.candidate,()=>withAdventure(expansion.content,()=>W.validate(doc.world!.library)));
        if (!land.ok) throw Error(land.errors.join('\n'));
        if (doc.world.fingerprint !== W.hashOf(land.content)) throw Error('The world definition fingerprint does not match.');
        const growthLibrary = G.clone(doc.growth.library);
        if (doc.growth.fingerprint !== G.hashOf(growthLibrary)) throw Error('The progression definition fingerprint does not match.');
        const growth=registry.withLibrary(content.candidate,()=>withAdventure(expansion.content,()=>G.validate(growthLibrary)));
        if(!growth.ok)throw Error(growth.errors.join('\n'));
        const stateDoc = { app: 'littlewild', version: ENGINE_STATE_VERSION, state: doc.state };
        const engine = registry.withLibrary(content.candidate, () => withAdventure(expansion.content, () => W.withLibrary(land.content, () => G.withLibrary(growth.content,()=>L.Engine.import(stateDoc)))));
        const preview = { engine, library: content.candidate, adventure: expansion.content, world: land.content, growth:growth.content, fingerprint: content.fingerprint,
            changesLibrary: registry.hash !== content.fingerprint || A.hash !== A.hashOf(expansion.content) || W.hash !== W.hashOf(land.content)||G.hash!==G.hashOf(growth.content) };
        reviews.set(preview, reviewFingerprint(preview));
        return preview;
    }
    function commit(preview: Preview) {
        const reviewed = preview && reviews.get(preview);
        if (!preview?.engine || !preview.library || !preview.adventure || !reviewed)
            throw Error('Review a valid story first.');
        if (reviewFingerprint(preview) !== reviewed)
            throw Error('Story review changed; review again.');
        const content = registry.prepare(preview.library);
        if (!content.ok)
            throw new C.ContentError(content.errors);
        const expansion = A.validate(preview.adventure);
        if (!expansion.ok) throw Error(expansion.errors.join('\n'));
        const land = registry.withLibrary(content.candidate, () => withAdventure(expansion.content,
            () => W.validate(preview.world || W.defaults)));
        if (!land.ok) throw Error(land.errors.join('\n'));
        const growth = registry.withLibrary(content.candidate, () => withAdventure(expansion.content,
            () => G.validate(preview.growth || G.defaults)));
        if (!growth.ok) throw Error(growth.errors.join('\n'));
        const story = preview.engine.export();
        const next = registry.withLibrary(content.candidate, () => withAdventure(expansion.content,
            () => W.withLibrary(land.content, () => G.withLibrary(growth.content,()=>L.Engine.import(story)))));
        const previous = {base:registry.export(),adventure:A.copy(A.content),world:W.clone(W.content),growth:G.clone(G.content)};
        try {
            registry.commit(content); A.replace(expansion.content);
            W.replace(land.content); G.replace(growth.content);
        } catch (error) {
            registry.commit(registry.prepare(previous.base)); A.replace(previous.adventure);
            W.replace(previous.world); G.replace(previous.growth); throw error;
        }
        return next;
    }
    function committed(engine: Engine) { return !!(engine.s as Engine['s']&{scenarioWorkflow?:{orders:{status:string}[]}}).scenarioWorkflow?.orders.some(o=>!['shipped','cancelled'].includes(o.status)) || !!engine.s.creatureInteractions?.active.length || engine.s.market?.orders.some(o=>!['done','cancelled'].includes(o.status)) || engine.s.buildings.some(b=>b.storage?.job || Object.values(b.storage?.requests||{}).some(n=>n>0)) || engine.creatures.some(c => c.training || c.learning.queue.length || c.orders.length || c.questPlan || c.activeQuest || c.equipQueue.length || !['idle', 'rest', 'reflect'].includes(c.task?.kind || 'idle')); }
    function trustedStoryPolicy(preview: LWContentPorts.Preview, engine: Engine) {
        if (!preview?.ok)
            return { ok: false, reason: 'Resolve validation errors before applying.' };
        if (preview.baseFingerprint !== registry.hash)
            return { ok: false, reason: 'The active library changed. Validate the file again.' };
        if (preview.diff.mechanics && committed(engine))
            return { ok: false, reason: 'A creature has committed work, equipment preparation or a quest. Finish or cancel it first, or apply the definitions to a new story.' };
        try {
            registry.withLibrary(preview.candidate, () => L.Engine.import(engine.export()));
        }
        catch (error) {
            return { ok: false, reason: 'The colony is not compatible: ' + (error instanceof Error ? error.message : String(error)) };
        }
        return { ok: true, reason: 'Every creature’s saved state is compatible with these definitions.' };
    }
    function currentStoryPolicy(preview: unknown, engine: Engine) {
        try { return trustedStoryPolicy(registry.reviewed(preview), engine); }
        catch (error) { return {ok:false, reason:error instanceof Error ? error.message : String(error)}; }
    }
    function applyContent(preview: unknown, engine: Engine, newStory = false) {
        const reviewed = registry.reviewed(preview);
        if (!newStory) {
            const policy = trustedStoryPolicy(reviewed, engine);
            if (!policy.ok)
                throw Error(policy.reason);
        }
        const next = registry.withLibrary(reviewed.candidate, () => newStory ? new L.Engine() : reviewed.diff.mechanics ? L.Engine.import(engine.export()) : engine);
        registry.commit(preview);
        return next;
    }
    function applyAdventure(pack: unknown, engine: Engine, newStory = false) {
        const candidate = A.validate(pack);
        if (!candidate.ok)
            throw Error(candidate.errors.join('\n'));
        if (!newStory && committed(engine))
            throw Error('Finish or cancel all creatures’ work, outfit plans and quests, or apply this library to a new story.');
        const next = withAdventure(candidate.content, () => {
            const linked = G.validate(G.content);
            if (!linked.ok) throw Error('Adventure change breaks progression/island references: '+linked.errors.join('\n'));
            return newStory ? new L.Engine() : L.Engine.import(engine.export());
        });
        A.replace(candidate.content);
        return next;
    }
    function applyWorld(pack: unknown, engine: Engine, newStory=false) {
        const candidate=W.validate(pack);if(!candidate.ok)throw Error(candidate.errors.join('\n'));
        const changes=W.diff(W.content,candidate.content),mechanical=changes.some(c=>!/^\/(name|description|extensions)(\/|$)/.test(c.path)&&!/^\/nodes\/[^/]+\/name$/.test(c.path));
        if(!newStory&&mechanical&&committed(engine))throw Error('Finish committed work or start a new story with these world definitions.');
        if(!newStory&&JSON.stringify(W.content.sites)!==JSON.stringify(candidate.content.sites))throw Error('Site layout changes require a new story.');
        const next=W.withLibrary(candidate.content,()=>newStory?new L.Engine():mechanical?L.Engine.import(engine.export()):engine);
        W.replace(candidate.content);return next;
    }
    function applyGrowth(pack: unknown,engine: Engine,newStory=false){
        const candidate=G.validate(pack);if(!candidate.ok)throw Error(candidate.errors.join('\n'));
        if(!newStory&&committed(engine)&&G.mechanicalHash(candidate.content)!==G.mechanicalHash(G.content))throw Error('Finish or cancel committed work and sales before changing growth mechanics, or explicitly start a new story.');
        const next=G.withLibrary(candidate.content,()=>newStory?new L.Engine():L.Engine.import(engine.export()));
        G.replace(candidate.content);return next;
    }
    const api = { applyGrowth, encode, inspect, commit, currentStoryPolicy, applyContent, applyAdventure, applyWorld, committed, SAVE_LIMIT };
    if (node)
        module.exports = api;
    root.LWStory = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
