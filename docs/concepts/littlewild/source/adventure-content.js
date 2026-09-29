/* Versioned, bounded adventure definitions. Imported JSON never contains executable code. */
(function (root) {
    'use strict';
    const node = typeof module !== 'undefined' && module.exports;
    const copy = x => JSON.parse(JSON.stringify(x));
    const defaultContent = node ? require('./content/adventure-library.json') : root.LWDefaultAdventure;
    const base = root.LWContent.tables;
    const ACTIONS = ['essential', 'homecoming', 'overburdened', 'feelings', 'comfort', 'outfit', 'quest', 'learning', 'plans', 'companionship', 'supplies', 'deposit', 'curiosity', 'restful', 'workplaces'];
    const slots = ['head', 'body', 'tool', 'feet', 'back', 'charm'], visuals = ['cap', 'cape', 'boots', 'axe', 'hammer', 'staff', 'pack', 'charm', 'wizard', 'vest', 'lantern'];
    const ID = /^[a-z][a-z0-9_-]{0,60}$/;
    function parse(input) {
        const d = typeof input === 'string' ? (input.length > 1500000 ? (() => { throw Error('JSON exceeds 1.5 MB.'); })() : JSON.parse(input)) : copy(input);
        let nodes = 0;
        const scan = (x, depth = 0) => {
            if (++nodes > 70000 || depth > 25)
                throw Error('JSON is too deeply nested or too large.');
            if (typeof x === 'number' && !Number.isFinite(x))
                throw Error('Non-finite number.');
            if (x && typeof x === 'object')
                for (const [k, v] of Object.entries(x)) {
                    if (['__proto__', 'constructor', 'prototype'].includes(k))
                        throw Error('Unsafe property name.');
                    scan(v, depth + 1);
                }
        };
        scan(d);
        return d;
    }
    function validate(input) {
        let p;
        const errors = [];
        try {
            p = parse(input);
            const check = (condition, msg) => {
                if (!condition)
                    throw Error(msg);
            };
            const num = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
            const integer = (v, a, b) => num(v, a, b) && Number.isInteger(v);
            const text = (v, n) => typeof v === 'string' && v.length > 0 && v.length <= n;
            const object = o => o && typeof o === 'object' && !Array.isArray(o);
            check(p.format === 'littlewild-adventure-content' && p.schemaVersion === 1, 'Unsupported adventure content format.');
            check(text(p.revision, 50), 'A revision is required.');
            const sets = {};
            for (const k of ['equipment', 'traits', 'personalities', 'quests']) {
                check(Array.isArray(p[k]) && p[k].length > 0 && p[k].length <= 100, k + ' must contain 1–100 definitions.');
                const ids = p[k].map(d => d.id);
                check(ids.every(id => typeof id === 'string' && ID.test(id)) && new Set(ids).size === ids.length, 'Invalid or duplicate ' + k + ' identifier.');
                sets[k] = new Set(ids);
            }
            const items = new Set([...Object.keys(base.RES), ...sets.equipment, 'wooden_chest']);
            const skills = new Set([...Object.keys(base.SKILLS), 'ST', 'DX', 'IQ', 'HT', 'Per', 'Will', 'social', 'craft']);
            const amounts = (o, label) => {
                check(object(o), label + ' must be a quantity map.');
                for (const [k, n] of Object.entries(o))
                    check(items.has(k) && integer(n, 1, 100), label + ' has an unknown item or invalid quantity: ' + k);
            };
            const bonuses = (o, label) => {
                check(object(o), label + ' needs a bonus map.');
                for (const [k, n] of Object.entries(o))
                    check(skills.has(k) && integer(n, -3, 3), label + ' has an unknown skill or bonus outside −3…3.');
            };
            check(object(p.weights), 'Weights are required.');
            for (const id of Object.keys(base.RES))
                check(integer(p.weights[id], 1, 50000), 'Missing/invalid gram weight: ' + id);
            check(Object.keys(p.weights).every(id => Object.hasOwn(base.RES, id)), 'Weights contains unknown resource IDs.');
            for (const d of p.equipment) {
                check(!Object.hasOwn(base.RES, d.id) && d.id !== 'wooden_chest', 'Equipment ID collides with an item.');
                check(text(d.name, 80) && text(d.description, 500), 'Equipment needs a name and description.');
                check(slots.includes(d.slot) && visuals.includes(d.visual), 'Unknown equipment slot or visual.');
                check(/^#[0-9a-fA-F]{6}$/.test(d.color), 'Use a six-digit hex equipment color.');
                check(integer(d.weight, 1, 20000) && integer(d.price, 1, 10000) && num(d.travel, 0, .3), 'Invalid equipment weight, value or travel bonus.');
                bonuses(d.bonuses, d.id);
                check(object(d.recipe) && Object.hasOwn(base.SKILLS, d.recipe.skill) && Object.hasOwn(base.BUILDINGS, d.recipe.station) && num(d.recipe.time, 1, 180), 'Invalid equipment recipe.');
                amounts(d.recipe.cost, d.id + ' ingredients');
                check(Object.keys(d.recipe.cost).every(id => Object.hasOwn(base.RES, id)), 'Equipment recipes can use base materials only.');
            }
            for (const d of p.traits) {
                check(text(d.name, 80) && text(d.description, 500), 'Trait needs a name and description.');
                bonuses(d.bonuses, d.id);
                check(num(d.angerRate, .25, 2) && num(d.soothing, .5, 2) && integer(d.social, -30, 30) && num(d.travel, 0, .2), 'Invalid trait effects.');
            }
            for (const d of p.personalities) {
                check(text(d.name, 80) && text(d.description, 500), 'Personality needs a name and description.');
                check(Array.isArray(d.traits) && d.traits.length <= 4 && d.traits.every(t => sets.traits.has(t)) && new Set(d.traits).size === d.traits.length, 'Invalid personality trait references.');
                check(/^#[0-9a-fA-F]{6}$/.test(d.color) && /^#[0-9a-fA-F]{6}$/.test(d.accent), 'Invalid creature palette.');
                for (const id of ['ST', 'DX', 'IQ', 'HT'])
                    check(integer(d.attributes?.[id], 8, 14), 'Starting attributes must be 8–14.');
                check(integer(d.selfControl, 6, 18), 'Invalid self-control target.');
                for (const id of ['explore', 'train', 'build', 'social'])
                    check(num(d.preferences?.[id], .25, 2), 'Invalid personality preference.');
            }
            check(object(p.skillRules), 'Skill rules are required.');
            for (const id of Object.keys(base.SKILLS))
                check(['ST', 'DX', 'IQ', 'HT'].includes(p.skillRules[id]?.attribute) && ['E', 'A', 'H', 'VH'].includes(p.skillRules[id]?.difficulty), 'Invalid rule for skill ' + id);
            check(Object.keys(p.skillRules).every(id => Object.hasOwn(base.SKILLS, id)), 'Unknown skill rule.');
            for (const d of p.quests) {
                check(text(d.name, 100) && text(d.biome, 80) && text(d.description, 700), 'Quest needs name, biome and description.');
                check(integer(d.tier, 1, 4) && num(d.duration, 20, 900) && num(d.energy, 5, 55) && integer(d.coins, 0, 1000) && integer(d.research, 0, 50), 'Invalid quest costs or duration.');
                amounts(d.cost, d.id + ' provisions');
                check(Array.isArray(d.steps) && d.steps.length >= 1 && d.steps.length <= 8, 'Quests require 1–8 checkpoints.');
                for (const step of d.steps)
                    check(text(step.name, 100) && skills.has(step.skill) && integer(step.modifier, -6, 6), 'Invalid quest check.');
                check(Array.isArray(d.loot) && d.loot.length <= 15, 'Too many loot entries.');
                for (const row of d.loot)
                    check(items.has(row.item) && integer(row.min, 1, 20) && integer(row.max, row.min, 20) && num(row.chance, 0, 1), 'Invalid quest loot.');
            }
            check(object(p.chest), 'A chest definition is required.');
            if (p.chest) {
                check(p.chest.id === 'wooden_chest' && text(p.chest.name, 80) && text(p.chest.description, 500) && integer(p.chest.weight, 1, 20000) && integer(p.chest.price, 1, 10000), 'Invalid chest definition.');
                check(Array.isArray(p.chest.equipmentPool) && p.chest.equipmentPool.length >= 1 && p.chest.equipmentPool.length <= 100 && p.chest.equipmentPool.every(id => sets.equipment.has(id)), 'Unknown chest equipment reference.');
                amounts(p.chest.supplies, 'Chest supplies');
                check(Object.keys(p.chest.supplies).every(id => Object.hasOwn(base.RES, id)), 'Chest supplies must reference base resources.');
            }
            const ranges = { purchaseBase: [20, 1000], purchaseGrowth: [1.1, 3], maxCreatures: [2, 8], questCooldown: [30, 900], eventChance: [.1, 1], questOfferLife: [90, 3600], abortEnergy: [1, 15], abortReturnSeconds: [1, 40], returnSeconds: [1, 40], cpPerLevel: [1, 5], practicePerPoint: [4, 40] };
            for (const [k, [a, b]] of Object.entries(ranges))
                check(num(p.rules?.[k], a, b), 'Invalid rule: ' + k);
            for (const k of ['maxCreatures', 'cpPerLevel', 'practicePerPoint', 'purchaseBase'])
                check(Number.isInteger(p.rules[k]), k + ' must be an integer.');
            const tree = new root.LWBehaviorTree(Object.fromEntries(ACTIONS.map(a => [a, () => false])));
            tree.validate(p.behaviorTree);
            check(p.behaviorTree.type === 'selector' && p.behaviorTree.children[0]?.action === 'essential', 'The root must be a selector whose first action is essential care.');
            check(!p.extensions || object(p.extensions), 'Extensions must be a JSON object.');
            return { ok: true, content: p, errors: [], summary: { equipment: p.equipment.length, quests: p.quests.length, personalities: p.personalities.length, traits: p.traits.length } };
        }
        catch (e) {
            errors.push(e.message);
            return { ok: false, errors };
        }
    }
    function hash(p) {
        const stable = v => v && typeof v === 'object' ? Array.isArray(v) ? v.map(stable) : Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
        const text = JSON.stringify(stable(p));
        let h = 2166136261;
        for (let i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0).toString(16).padStart(8, '0');
    }
    function diff(before, after, limit = 120) {
        const changes = [];
        let total = 0;
        const record = (path, a, b, kind = 'value') => { total++; if (changes.length < limit)
            changes.push({ path, kind, before: a === undefined ? null : copy(a), after: b === undefined ? null : copy(b) }); };
        const pointer = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
        const walk = (a, b, path) => {
            if (JSON.stringify(a) === JSON.stringify(b))
                return;
            if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
                for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort())
                    walk(a[key], b[key], path + '/' + pointer(key));
            }
            else if (Array.isArray(a) && Array.isArray(b) && [...a, ...b].every(x => x && typeof x === 'object' && typeof x.id === 'string')) {
                const ai = a.map(x => x.id), bi = b.map(x => x.id);
                if (JSON.stringify(ai) !== JSON.stringify(bi))
                    record(path, ai, bi, 'order');
                const am = Object.fromEntries(a.map(x => [x.id, x])), bm = Object.fromEntries(b.map(x => [x.id, x]));
                walk(am, bm, path);
            }
            else {
                record(path, a, b);
            }
        };
        walk(before, after, '');
        return { changes, total, truncated: total > changes.length };
    }
    let content = copy(defaultContent);
    const result = validate(content);
    if (!result.ok)
        throw Error(result.errors.join('\n'));
    const api = { get content() { return content; }, get hash() { return hash(content); }, replace(input) {
            const v = validate(input);
            if (!v.ok)
                throw Error(v.errors.join('\n'));
            content = v.content;
        }, validate, parse, diff, hashOf: hash, copy, defaultContent: copy(defaultContent), ACTIONS, slots, visuals };
    root.LWAdventure = api;
    if (node)
        module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
