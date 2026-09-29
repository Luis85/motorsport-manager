/* Shared world invariants. Pure checks: never move resources, consume RNG or edit a story.
 * Runtime guards and the importer use the same entity/production contracts. */
(function (root) {
    'use strict';
    const at = p => `${p.x},${p.y}`;
    function sameQuantities(a, b) {
        if (!a || !b || Array.isArray(a) || typeof a !== 'object') return false;
        const keys = Object.keys(a);
        return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && a[k] === b[k]);
    }
    function resourceAccessIssue(engine, candidate) {
        const L = root.LW, W = root.LWWorldContent, s = engine.s;
        const places = [...s.buildings, ...engine.allOrders().filter(o => o.type === 'build'), candidate];
        const covered = new Set(places.map(at));
        const blockers = [...s.nodes.filter(n => n.kind === 'wood' || n.kind === 'stone'), ...places];
        const grid = new root.LWNavigation.Grid(L.SIZE, L.terrain, blockers);
        for (const n of s.nodes) {
            const d = W.node(n.kind);
            if (d?.direct && engine.nodeAvailable(n) && !covered.has(at(n)) && !grid.approach(n))
                return `Keep an open approach to ${d.name.toLowerCase()} at ${n.x}, ${n.y}.`;
        }
        return null;
    }
    function substrateIssue(engine, building, recipe) {
        const W = root.LWWorldContent, required = W.building(building.kind)?.requiresNode;
        if (!required || building.storage?.job) return null;
        const node = engine.nodeAt(building.x, building.y);
        if (!node || node.kind !== required) return 'Missing required node';
        if (!engine.nodeAvailable(node)) return 'Node exhausted';
        if (recipe && engine.remaining(node) < recipe.depletion) return 'Insufficient deposit remaining';
        return null;
    }
    function validateIdentities(state) {
        const bad = message => { throw Error('World save: ' + message); };
        const used = new Set(), planTiles = new Set(state.buildings.map(at)), workIds = new Set();
        let maxEntity = 0, maxWork = 0;
        function use(id) {
            if (typeof id !== 'string' || used.has(id)) bad('duplicate or invalid entity ID');
            used.add(id);
            const numeric = /^[bo](\d+)$/.exec(id);
            if (numeric) maxEntity = Math.max(maxEntity, Number(numeric[1]));
        }
        for (const b of state.buildings) {
            use(b.id);
            const job = b.storage?.job;
            if (!job) continue;
            const numeric = /^work-(\d+)$/.exec(job.id);
            if (!numeric || workIds.has(job.id)) bad('duplicate or invalid paid-batch ID');
            workIds.add(job.id); maxWork = Math.max(maxWork, Number(numeric[1]));
            if (job.orderId != null && (typeof job.orderId !== 'string' || job.orderId.length > 64)) bad('invalid originating order');
        }
        for (const c of state.colony.creatures) for (const o of c.orders) {
            use(o.id);
            if (o.type === 'build') {
                if (planTiles.has(at(o))) bad('overlapping construction plans');
                planTiles.add(at(o));
                const node = state.nodes.find(n => at(n) === at(o));
                const required = root.LWWorldContent.building(o.kind)?.requiresNode;
                if (node && node.kind !== required || required && node?.kind !== required) bad('construction plan has an incompatible site');
            }
        }
        if (state.nextId <= maxEntity) bad('next entity ID would overwrite an existing identity');
        if (state.world.sequence <= maxWork) bad('next work ID would reuse a paid-batch identity');
    }
    root.LWWorldIntegrity = {sameQuantities, resourceAccessIssue, substrateIssue, validateIdentities};
    if (typeof module !== 'undefined' && module.exports) module.exports = root.LWWorldIntegrity;
})(typeof globalThis !== 'undefined' ? globalThis : this);
