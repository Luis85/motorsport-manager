/* Portable stories bind the colony and four definition libraries to one exact snapshot.
 * Inspection is reversible; only a confirmed commit changes active definitions. */
(function (root) {
    'use strict';
    const node = typeof module !== 'undefined' && module.exports;
    const C = node ? require('./content-runtime.js') : root.LWContent;
    const L = node ? require('./simulation.cjs') : root.LW;
    const A = node ? require('./adventure-content.js') : root.LWAdventure;
    const W = node ? require('./world-content.js') : root.LWWorldContent;
    const G = node ? require('./growth-content.js') : root.LWGrowth;
    const registry = C.registry, SAVE_LIMIT = 12 * 1024 * 1024;
    function encode(engine) { return { app: 'littlewild', version: 8, savedAt: new Date().toISOString(), content: { fingerprint: registry.hash, library: registry.export() }, adventure: { fingerprint: A.hash, library: A.copy(A.content) }, world: {fingerprint:W.hash,library:W.clone(W.content)}, growth:{fingerprint:G.hash,library:G.clone(G.content)}, state: engine.export().state }; }
    function withAdventure(pack, fn) { const previous = A.copy(A.content); try {
        A.replace(pack);
        return fn();
    }
    finally {
        A.replace(previous);
    } }
    function inspect(input) {
        const doc = C.parse(input, SAVE_LIMIT);
        if (doc?.format)
            throw Error('This is a definition library. Use Content Library or Adventure Library, not Import story.');
        if (doc?.app !== 'littlewild' || ![1, 2, 3, 4, 5, 6, 7, 8].includes(doc.version) || !doc.state)
            throw Error('Choose a Littlewild v1–v11 portable story file.');
        if (doc.version >= 4 && doc.content?.library?.kind !== 'library')
            throw Error('This story is missing its complete content library.');
        // Check consistency of the original snapshot before an additive, explicit format migration.
        if (doc.version >= 4 && doc.content.fingerprint !== C.fingerprint(doc.content.library))
            throw Error('The story’s definition fingerprint does not match.');
        const library = C.copy(doc.version >= 4 ? doc.content.library : registry.defaults);
        const migrationNotes = [];
        if (doc.version < 8 && !library.components.buildings.some(b => b.id === 'map_table')) {
            library.components.buildings.push(C.copy(registry.defaults.components.buildings.find(b => b.id === 'map_table')));
            migrationNotes.push('Added the map-table blueprint definition. Existing buildings, balances and owned islands stay unchanged. Build the table before purchasing further islands.');
        }
        const content = registry.prepare(library);
        if (!content.ok)
            throw new C.ContentError(content.errors);
        if (doc.version >= 8 && doc.content.fingerprint !== content.fingerprint)
            throw Error('The story’s definition fingerprint does not match. Edit definitions through the library importer instead.');
        const expansion = A.validate(doc.version >= 5 ? doc.adventure?.library : A.defaultContent);
        if (!expansion.ok)
            throw Error(expansion.errors.join('\n'));
        if (doc.version >= 5 && doc.adventure?.fingerprint !== A.hashOf(expansion.content))
            throw Error('The story’s adventure fingerprint does not match its definitions.');
        const land = registry.withLibrary(content.candidate,()=>withAdventure(expansion.content,()=>W.validate(doc.version >= 6 ? doc.world?.library : W.defaults)));
        if (!land.ok) throw Error(land.errors.join('\n'));
        if (doc.version >= 6 && doc.world?.fingerprint !== W.hashOf(land.content)) throw Error('The world definition fingerprint does not match.');
        const growthLibrary = G.clone(doc.version >= 7 ? doc.growth?.library : G.defaults);
        if (doc.version >= 7 && doc.growth?.fingerprint !== G.hashOf(growthLibrary)) throw Error('The progression definition fingerprint does not match.');
        if (doc.version < 8) {
            growthLibrary.schemaVersion = 2;
            if (!growthLibrary.cartography) growthLibrary.cartography = G.clone(G.defaults.cartography);
            if (!growthLibrary.requirements.buildings.map_table) growthLibrary.requirements.buildings.map_table = G.clone(G.defaults.requirements.buildings.map_table);
            if (!growthLibrary.research.some(r=>r.id==='blueprint-map-table')) growthLibrary.research.push(G.clone(G.defaults.research.find(r=>r.id==='blueprint-map-table')));
            migrationNotes.push('Existing expeditions retain their work, supplies and outcomes and receive a Mossmeadow origin. Each owned island receives its own future invitation clock.');
        }
        const growth=registry.withLibrary(content.candidate,()=>withAdventure(expansion.content,()=>G.validate(growthLibrary)));
        if(!growth.ok)throw Error(growth.errors.join('\n'));
        const stateDoc = { app: 'littlewild', version: doc.version === 4 ? 3 : doc.version, state: doc.state };
        const engine = registry.withLibrary(content.candidate, () => withAdventure(expansion.content, () => W.withLibrary(land.content, () => G.withLibrary(growth.content,()=>L.Engine.import(stateDoc)))));
        return { engine, library: content.candidate, adventure: expansion.content, world: land.content, growth:growth.content, sourceVersion: doc.version, migrationNotes, fingerprint: content.fingerprint, changesLibrary: registry.hash !== content.fingerprint || A.hash !== A.hashOf(expansion.content) || W.hash !== W.hashOf(land.content)||G.hash!==G.hashOf(growth.content) };
    }
    function commit(preview) {
        if (!preview?.engine || !preview.library || !preview.adventure)
            throw Error('Review a valid story first.');
        const content = registry.prepare(preview.library);
        if (!content.ok)
            throw new C.ContentError(content.errors);
        const next = registry.withLibrary(content.candidate, () => withAdventure(preview.adventure, () => W.withLibrary(preview.world||W.defaults, () => G.withLibrary(preview.growth||G.defaults,()=>L.Engine.import(preview.engine.export())))));
        registry.commit(content);
        A.replace(preview.adventure);
        W.replace(preview.world||W.defaults);
        G.replace(preview.growth||G.defaults);
        return next;
    }
    function committed(engine) { return engine.s.market?.orders.some(o=>!['done','cancelled'].includes(o.status)) || engine.s.buildings.some(b=>b.storage?.job || Object.values(b.storage?.requests||{}).some(n=>n>0)) || engine.creatures.some(c => c.training || c.learning.queue.length || c.orders.length || c.questPlan || c.activeQuest || c.equipQueue.length || !['idle', 'rest', 'reflect'].includes(c.task?.kind || 'idle')); }
    function currentStoryPolicy(preview, engine) {
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
            return { ok: false, reason: 'The colony is not compatible: ' + error.message };
        }
        return { ok: true, reason: 'Every creature’s saved state is compatible with these definitions.' };
    }
    function applyContent(preview, engine, newStory = false) {
        if (!preview?.ok || preview.baseFingerprint !== registry.hash)
            throw Error('This content preview is stale. Validate again.');
        if (!newStory) {
            const policy = currentStoryPolicy(preview, engine);
            if (!policy.ok)
                throw Error(policy.reason);
        }
        const next = registry.withLibrary(preview.candidate, () => newStory ? new L.Engine() : preview.diff.mechanics ? L.Engine.import(engine.export()) : engine);
        registry.commit(preview);
        return next;
    }
    function applyAdventure(pack, engine, newStory = false) {
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
    function applyWorld(pack, engine, newStory=false) {
        const candidate=W.validate(pack);if(!candidate.ok)throw Error(candidate.errors.join('\n'));
        const changes=W.diff(W.content,candidate.content),mechanical=changes.some(c=>!/^\/(name|description|extensions)(\/|$)/.test(c.path)&&!/^\/nodes\/[^/]+\/name$/.test(c.path));
        if(!newStory&&mechanical&&committed(engine))throw Error('Finish committed work or start a new story with these world definitions.');
        if(!newStory&&JSON.stringify(W.content.sites)!==JSON.stringify(candidate.content.sites))throw Error('Site layout changes require a new story.');
        const next=W.withLibrary(candidate.content,()=>newStory?new L.Engine():mechanical?L.Engine.import(engine.export()):engine);
        W.replace(candidate.content);return next;
    }
    function applyGrowth(pack,engine,newStory=false){
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
