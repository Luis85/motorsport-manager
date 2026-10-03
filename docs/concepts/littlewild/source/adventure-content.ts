/* Versioned, bounded adventure definitions. Imported JSON never contains executable code. */
(function (inputRoot:unknown) {
    'use strict';
    interface Root {LWContent?:LWContentPorts.ContentApi;LWDefaultAdventure?:LWContentPorts.Adventure;LWAdventure?:LWContentPorts.AdventureApi;LWCreatures?:{personalities?:string[]};LWBehaviorTree:new(actions:Record<string,()=>false>)=>{validate(input:unknown):boolean};}
    const root=inputRoot as Root;
    const node = typeof module !== 'undefined' && module.exports;
    const contentApi = (node ? require('./content-runtime.js') : root.LWContent) as LWContentPorts.ContentApi|undefined;
    if(!contentApi)throw Error('Content runtime is missing.');
    const C=contentApi;
    const copy = C.copy;
    const defaults = (node ? require('./content/balancing.json').libraries.adventure : root.LWDefaultAdventure) as LWContentPorts.Adventure|undefined;
    if(!defaults)throw Error('Default adventure content is missing.');
    const defaultContent=defaults;
    const base = C.tables;
    const ACTIONS = ['essential', 'homecoming', 'overburdened', 'feelings', 'comfort', 'outfit', 'quest', 'learning', 'plans', 'companionship', 'supplies', 'deposit', 'curiosity', 'restful', 'workplaces'];
    const slots = ['head', 'body', 'tool', 'feet', 'back', 'charm'], visuals = ['cap', 'cape', 'boots', 'axe', 'hammer', 'staff', 'pack', 'charm', 'wizard', 'vest', 'lantern'];
    const ID = /^[a-z][a-z0-9_-]{0,60}$/;
    const isRecord=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
    function record(v:unknown,label:string):Record<string,unknown>{if(!isRecord(v))throw Error(label+' must be an object.');return v;}
    const optionalRecord=(v:unknown):Record<string,unknown>=>isRecord(v)?v:{};
    function list(v:unknown,label:string):unknown[]{if(!Array.isArray(v))throw Error(label+' must be a list.');return v;}
    const identified=(v:unknown):v is {id:string}=>isRecord(v)&&typeof v.id==='string';
    function parse(input:unknown) { return C.parse(input, 1500000); }
    function validate(input:unknown):LWContentPorts.Validation<LWContentPorts.Adventure> & {summary?:Record<string,number>} {
        const errors:string[] = [];
        try {
            const parsed=parse(input);
            const p=record(parsed,'Adventure document');
            const check = (condition:unknown, msg:string):void => {
                if (!condition)
                    throw Error(msg);
            };
            const num = (v:unknown, a:number, b:number):v is number => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
            const integer = (v:unknown, a:number, b:number):v is number => num(v, a, b) && Number.isInteger(v);
            const text = (v:unknown, n:number):v is string => typeof v === 'string' && [...v].length > 0 && [...v].length <= n;
            const object = (o:unknown):o is Record<string,unknown> => o!==null && typeof o === 'object' && !Array.isArray(o);
            check(p.format === 'littlewild-adventure-content' && p.schemaVersion === 1, 'Unsupported adventure content format.');
            check(text(p.revision, 50), 'A revision is required.');
            const sets={} as Record<'equipment'|'traits'|'personalities'|'quests',Set<string>>;
            const definitions={} as Record<'equipment'|'traits'|'personalities'|'quests',Record<string,unknown>[]>;
            for (const k of ['equipment', 'traits', 'personalities', 'quests'] as const) {
                const entries=p[k];
                if(!Array.isArray(entries)||entries.length===0||entries.length>100)throw Error(k+' must contain 1–100 definitions.');
                definitions[k]=entries.map(d=>record(d,k+' definition'));
                const ids=definitions[k].map(d=>d.id);
                check(ids.every(id => typeof id === 'string' && ID.test(id)) && new Set(ids).size === ids.length, 'Invalid or duplicate ' + k + ' identifier.');
                sets[k] = new Set(ids.filter((id):id is string=>typeof id==='string'));
            }
            const items = new Set([...Object.keys(base.RES), ...sets.equipment, 'wooden_chest']);
            const skills = new Set([...Object.keys(base.SKILLS), 'ST', 'DX', 'IQ', 'HT', 'Per', 'Will', 'social', 'craft']);
            const amounts = (o:unknown, label:string) => {
                check(object(o), label + ' must be a quantity map.');
                for (const [k, n] of Object.entries(record(o,label)))
                    check(items.has(k) && integer(n, 1, 100), label + ' has an unknown item or invalid quantity: ' + k);
            };
            const bonuses = (o:unknown, label:string) => {
                check(object(o), label + ' needs a bonus map.');
                for (const [k, n] of Object.entries(record(o,label)))
                    check(skills.has(k) && integer(n, -3, 3), label + ' has an unknown skill or bonus outside −3…3.');
            };
            check(object(p.weights), 'Weights are required.');
            const weights=record(p.weights,'Weights');
            for (const id of Object.keys(base.RES))
                check(integer(weights[id], 1, 50000), 'Missing/invalid gram weight: ' + id);
            check(Object.keys(weights).every(id => Object.hasOwn(base.RES, id)), 'Weights contains unknown resource IDs.');
            for (const d of definitions.equipment) {
                check(!Object.hasOwn(base.RES, String(d.id)) && d.id !== 'wooden_chest', 'Equipment ID collides with an item.');
                check(text(d.name, 80) && text(d.description, 500), 'Equipment needs a name and description.');
                check(typeof d.slot==='string'&&slots.includes(d.slot) && typeof d.visual==='string'&&visuals.includes(d.visual), 'Unknown equipment slot or visual.');
                check(typeof d.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(d.color), 'Use a six-digit hex equipment color.');
                check(integer(d.weight, 1, 20000) && integer(d.price, 1, 10000) && num(d.travel, 0, .3), 'Invalid equipment weight, value or travel bonus.');
                bonuses(d.bonuses, String(d.id));
                const recipe=record(d.recipe,'Invalid equipment recipe');
                check(typeof recipe.skill==='string'&&Object.hasOwn(base.SKILLS,recipe.skill) && typeof recipe.station==='string'&&Object.hasOwn(base.BUILDINGS,recipe.station) && num(recipe.time, 1, 180), 'Invalid equipment recipe.');
                amounts(recipe.cost, d.id + ' ingredients');
                check(Object.keys(record(recipe.cost,'Equipment recipe cost')).every(id => Object.hasOwn(base.RES, id)), 'Equipment recipes can use base materials only.');
            }
            for (const d of definitions.traits) {
                check(text(d.name, 80) && text(d.description, 500), 'Trait needs a name and description.');
                bonuses(d.bonuses, String(d.id));
                check(num(d.angerRate, .25, 2) && num(d.soothing, .5, 2) && integer(d.social, -30, 30) && num(d.travel, 0, .2), 'Invalid trait effects.');
            }
            const creatureProfiles = root.LWCreatures?.personalities;
            if (Array.isArray(creatureProfiles))
                check(creatureProfiles.length === sets.personalities.size && creatureProfiles.every(id => sets.personalities.has(id)), 'Personality identifiers must match bundled creature definitions.');
            for (const d of definitions.personalities) {
                check(text(d.name, 80) && text(d.description, 500), 'Personality needs a name and description.');
                check(Array.isArray(d.traits) && d.traits.length <= 4 && d.traits.every(t => typeof t==='string'&&sets.traits.has(t)) && new Set(d.traits).size === d.traits.length, 'Invalid personality trait references.');
                check(typeof d.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(d.color) && typeof d.accent==='string'&&/^#[0-9a-fA-F]{6}$/.test(d.accent), 'Invalid creature palette.');
                const attributes=record(d.attributes,'Starting attributes');
                for (const [id,value] of Object.entries(attributes))
                    check(['ST','DX','IQ','HT'].includes(id)&&integer(value,8,14),'Starting attributes must use supported numeric ST, DX, IQ and HT values.');
                for (const id of ['ST', 'DX', 'IQ', 'HT'])
                    check(integer(attributes[id], 8, 14), 'Starting attributes must be 8–14.');
                check(integer(d.selfControl, 6, 18), 'Invalid self-control target.');
                const preferences=record(d.preferences,'Personality preferences');
                for (const [id,value] of Object.entries(preferences))
                    check(['explore','train','build','social'].includes(id)&&num(value,.25,2),'Invalid personality preference.');
                for (const id of ['explore', 'train', 'build', 'social'])
                    check(num(preferences[id], .25, 2), 'Invalid personality preference.');
            }
            check(object(p.skillRules), 'Skill rules are required.');
            const skillRules=record(p.skillRules,'Skill rules');
            for (const id of Object.keys(base.SKILLS))
                check(typeof optionalRecord(skillRules[id]).attribute==='string'&&['ST', 'DX', 'IQ', 'HT'].includes(optionalRecord(skillRules[id]).attribute as string) && typeof optionalRecord(skillRules[id]).difficulty==='string'&&['E', 'A', 'H', 'VH'].includes(optionalRecord(skillRules[id]).difficulty as string), 'Invalid rule for skill ' + id);
            check(Object.keys(skillRules).every(id => Object.hasOwn(base.SKILLS, id)), 'Unknown skill rule.');
            for (const d of definitions.quests) {
                check(text(d.name, 100) && text(d.biome, 80) && text(d.description, 700), 'Quest needs name, biome and description.');
                check(integer(d.tier, 1, 4) && num(d.duration, 20, 900) && num(d.energy, 5, 55) && integer(d.coins, 0, 1000) && integer(d.research, 0, 50), 'Invalid quest costs or duration.');
                amounts(d.cost, d.id + ' provisions');
                check(Array.isArray(d.steps) && d.steps.length >= 1 && d.steps.length <= 8, 'Quests require 1–8 checkpoints.');
                for (const inputStep of list(d.steps,'Quest steps')) {
                    const step=record(inputStep,'Quest step');
                    check(text(step.name, 100) && typeof step.skill==='string'&&skills.has(step.skill) && integer(step.modifier, -6, 6), 'Invalid quest check.');
                }
                check(Array.isArray(d.loot) && d.loot.length <= 15, 'Too many loot entries.');
                for (const inputRow of list(d.loot,'Quest loot')) {
                    const row=record(inputRow,'Quest loot');
                    check(typeof row.item==='string'&&items.has(row.item) && integer(row.min, 1, 20) && integer(row.max,row.min,20) && num(row.chance, 0, 1), 'Invalid quest loot.');
                }
            }
            check(object(p.chest), 'A chest definition is required.');
            if (p.chest) {
                const chest=record(p.chest,'Chest');
                check(chest.id === 'wooden_chest' && text(chest.name, 80) && text(chest.description, 500) && integer(chest.weight, 1, 20000) && integer(chest.price, 1, 10000), 'Invalid chest definition.');
                check(Array.isArray(chest.equipmentPool) && chest.equipmentPool.length >= 1 && chest.equipmentPool.length <= 100 && chest.equipmentPool.every(id => typeof id==='string'&&sets.equipment.has(id)), 'Unknown chest equipment reference.');
                amounts(chest.supplies, 'Chest supplies');
                check(Object.keys(record(chest.supplies,'Chest supplies')).every(id => Object.hasOwn(base.RES, id)), 'Chest supplies must reference base resources.');
            }
            const ranges:Record<string,[number,number]> = { purchaseBase: [20, 1000], purchaseGrowth: [1.1, 3], maxCreatures: [2, 8], questCooldown: [30, 900], eventChance: [.1, 1], questOfferLife: [90, 3600], abortEnergy: [1, 15], abortReturnSeconds: [1, 40], returnSeconds: [1, 40], cpPerLevel: [1, 5], practicePerPoint: [4, 40] };
            for (const [k, [a, b]] of Object.entries(ranges))
                check(num(optionalRecord(p.rules)[k], a, b), 'Invalid rule: ' + k);
            for (const k of ['maxCreatures', 'cpPerLevel', 'practicePerPoint', 'purchaseBase'])
                check(Number.isInteger(optionalRecord(p.rules)[k]), k + ' must be an integer.');
            const tree = new root.LWBehaviorTree(Object.fromEntries(ACTIONS.map(a => [a, () => false])));
            tree.validate(p.behaviorTree);
            check(optionalRecord(p.behaviorTree).type === 'selector' && optionalRecord(list(optionalRecord(p.behaviorTree).children,'Behavior children')[0]).action === 'essential', 'The root must be a selector whose first action is essential care.');
            check(p.extensions===undefined || object(p.extensions), 'Extensions must be a JSON object.');
            for(const entries of Object.values(definitions))for(const entry of entries)
                check(entry.extensions===undefined||object(entry.extensions),'Definition extensions must be a JSON object.');
            return { ok: true, content: parsed as LWContentPorts.Adventure, errors: [], summary: { equipment: definitions.equipment.length, quests: definitions.quests.length, personalities: definitions.personalities.length, traits: definitions.traits.length } };
        }
        catch (e) {
            errors.push(e instanceof Error?e.message:String(e));
            return { ok: false, errors };
        }
    }
    function hash(p:unknown):string {
        p = parse(p);
        const stable = (v:unknown):unknown => v && typeof v === 'object' ? Array.isArray(v) ? v.map(stable) : Object.fromEntries(Object.keys(v).sort().map(k => [k, stable((v as Record<string,unknown>)[k])])) : v;
        const text = JSON.stringify(stable(p));
        let h = 2166136261;
        for (let i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0).toString(16).padStart(8, '0');
    }
    function diff(before:unknown, after:unknown, limit = 120) {
        const changes:(LWContentPorts.Change & {kind:string})[] = [];
        let total = 0;
        const record = (path:string, a:unknown, b:unknown, kind = 'value') => { total++; if (changes.length < limit)
            changes.push({ path, kind, before: a === undefined ? null : copy(a), after: b === undefined ? null : copy(b) }); };
        const pointer = (key:string) => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
        const walk = (a:unknown, b:unknown, path:string):void => {
            if (JSON.stringify(a) === JSON.stringify(b))
                return;
            if (isRecord(a)&&isRecord(b)) {
                for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort())
                    walk(a[key], b[key], path + '/' + pointer(key));
            }
            else if (Array.isArray(a) && Array.isArray(b) && a.every(identified)&&b.every(identified)) {
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
    const api:LWContentPorts.AdventureApi = { get content() { return content; }, get hash() { return hash(content); }, replace(input:unknown) {
            const v = validate(input);
            if (!v.ok)
                throw Error(v.errors.join('\n'));
            content = v.content;
        }, validate, parse, diff, hashOf: hash, copy, defaultContent: copy(defaultContent), ACTIONS, slots, visuals };
    root.LWAdventure = api;
    if (node)
        module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
