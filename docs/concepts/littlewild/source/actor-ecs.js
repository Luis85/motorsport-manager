/* First ECS migration slice: authoritative per-actor vital and learning updates.
 * Components bind by reference to existing serialized actor records, preserving v8/v9
 * saves and all four existing content-library contracts. Activity is transient data.
 * Command validation, RNG, social incidents and task decisions stay in the old
 * domain while migrated systems are proven against behavioral fixtures.
 */
(function (root) {
    'use strict';
    const node = typeof module !== 'undefined' && module.exports;
    const E = node ? require('./ecs.js') : root.LWECS;
    const DEFAULT = node ? require('./content/actor-rules.json') : root.LWActorRules;
    const clone = x => JSON.parse(JSON.stringify(x));
    const FIELDS = Object.freeze({Transform:'creature', Needs:'needs', Learning:'learning', Feelings:'feelings', Inventory:'inventory'});
    const clamp = n => Math.max(0, Math.min(100, n));
    function validateRules(input) {
        const r = clone(input), keys = (o, expected) => o && typeof o === 'object' &&
            !Array.isArray(o) && Object.keys(o).length === expected.length &&
            expected.every(k => Object.prototype.hasOwnProperty.call(o,k));
        if (!keys(r,['format','schemaVersion','learning','feelings','needs']) ||
            r.format !== 'littlewild-actor-rules' || r.schemaVersion !== 1 ||
            !keys(r.learning,['playfulFatigue','standardFatigue','recoveryRate','recoverAt','limitAt']) ||
            !keys(r.feelings,['socialRate','socialPreferenceRate','angerRate']) ||
            !keys(r.needs,['workingKinds','foodWork','foodIdle','waterWork','waterIdle',
                'energyWork','energyIdle','walkLoadFactor','comfortShelter','comfortWithoutShelter','joyRate']))
            throw Error('Invalid actor rules schema.');
        const bounded = (n,low,high) => typeof n === 'number' && Number.isFinite(n) && n >= low && n <= high;
        if (!Object.entries(r.learning).every(([k,v]) => bounded(v,0,k.endsWith('At')?100:10)) ||
            r.learning.recoverAt >= r.learning.limitAt ||
            !Object.values(r.feelings).every(v=>bounded(v,0,10)))
            throw Error('Invalid learning or social rules.');
        if (!Array.isArray(r.needs.workingKinds) || !r.needs.workingKinds.length ||
            r.needs.workingKinds.length > 32 || new Set(r.needs.workingKinds).size !== r.needs.workingKinds.length ||
            r.needs.workingKinds.some(k=>!(/^[a-z][a-z0-9_-]{0,50}$/.test(k))) ||
            Object.entries(r.needs).some(([k,v])=>k!=='workingKinds'&&!bounded(v,0,10)))
            throw Error('Invalid needs rules.');
        return Object.freeze({
            ...r, learning:Object.freeze(r.learning), feelings:Object.freeze(r.feelings),
            needs:Object.freeze({...r.needs,workingKinds:Object.freeze(r.needs.workingKinds)})
        });
    }
    function create(rules = DEFAULT) {
        const tuning = validateRules(rules), w = new E.World(), scheduler = new E.Scheduler(),
            workingKinds = new Set(tuning.needs.workingKinds);
        scheduler.register({id:'practice-day',phase:'pre',order:10,query:['Learning'],update(world,id,dt,ctx) {
            const l=world.get(id,'Learning');
            if(l.practiceDay!==ctx.day){l.practiceDay=ctx.day;l.practicedToday={};}
        }});
        scheduler.register({id:'learning-fatigue',phase:'simulate',order:10,query:['Learning','Activity'],update(world,id,dt) {
            const l=world.get(id,'Learning'),a=world.get(id,'Activity');
            l.fatigue=clamp(l.fatigue+dt*(a.studying?(a.style==='playful'?
                tuning.learning.playfulFatigue:tuning.learning.standardFatigue):-tuning.learning.recoveryRate));
            if(l.fatigue>=tuning.learning.limitAt)l.recovering=true;
            if(l.fatigue<=tuning.learning.recoverAt)l.recovering=false;
        }});
        scheduler.register({id:'social-decay',phase:'simulate',order:20,query:['Feelings','Activity'],update(world,id,dt) {
            const f=world.get(id,'Feelings'),a=world.get(id,'Activity');
            f.social=clamp(f.social-dt*(tuning.feelings.socialRate+
                tuning.feelings.socialPreferenceRate*a.socialPreference));
            f.anger=clamp(f.anger-dt*tuning.feelings.angerRate);
        }});
        scheduler.register({id:'needs-decay',phase:'simulate',order:30,query:['Needs','Activity'],update(world,id,dt) {
            const n=world.get(id,'Needs'),a=world.get(id,'Activity'),r=tuning.needs;
            n.food=clamp(n.food-dt*(a.working?r.foodWork:r.foodIdle));
            n.water=clamp(n.water-dt*(a.working?r.waterWork:r.waterIdle));
            n.energy=clamp(n.energy-dt*(a.working?r.energyWork:r.energyIdle)*
                (a.walking?1+a.loadLevel*r.walkLoadFactor:1));
            n.comfort=clamp(n.comfort-dt*(a.hasShelter?r.comfortShelter:r.comfortWithoutShelter));
            n.joy=clamp(n.joy-dt*r.joyRate);
        }});
        function bind(actor) {
            if(!actor || typeof actor.id !== 'string') throw Error('Invalid actor entity.');
            if(!w.entities.has(actor.id))w.create(actor.id);
            for (const [type,field] of Object.entries(FIELDS)) {
                const component=actor[field];
                if (!component || typeof component !== 'object' || Array.isArray(component))
                    throw Error('Missing actor component: ' + type);
                if(w.get(actor.id,type)!==component)w.set(actor.id,type,component);
            }
        }
        return Object.freeze({
            world:w, scheduler, rules:tuning,
            sync(actors) {
                if (!Array.isArray(actors)) throw Error('Actor sync expects an array.');
                const seen=new Set();
                for(const actor of actors) {
                    if(!actor || seen.has(actor.id))throw Error('Invalid or duplicate actor.');
                    seen.add(actor.id);bind(actor);
                }
                for(const id of [...w.entities])if(!seen.has(id))w.destroy(id);
            },
            step(actor,dt,inputs) {
                if(!inputs || !Number.isSafeInteger(inputs.day) ||
                    !Number.isFinite(inputs.socialPreference) || inputs.socialPreference < 0 || inputs.socialPreference > 100 ||
                    !Number.isFinite(inputs.loadLevel) || inputs.loadLevel < 0 || inputs.loadLevel > 100 ||
                    typeof inputs.hasShelter!=='boolean' || !Number.isFinite(dt) || dt <= 0 || dt > .25)
                    throw Error('Invalid actor ECS inputs.');
                // Bind native records, not parallel state. Import always receives a fresh ECS.
                bind(actor);
                const task=actor.task;
                const activity={studying:!!task&&['train','practice'].includes(task.kind)&&task.phase==='work',
                    working:!!task&&workingKinds.has(task.kind),walking:task?.phase==='walk',
                    style:task?.style||'',socialPreference:inputs.socialPreference,
                    loadLevel:inputs.loadLevel,hasShelter:inputs.hasShelter};
                w.set(actor.id,'Activity',activity);
                scheduler.step(w,dt,{entityId:actor.id,day:inputs.day});
                return {studying:activity.studying};
            },
            forget(id) {return w.destroy(id);}
        });
    }
    const api=Object.freeze({create,validateRules,FIELDS});
    root.LWActorECS=api;
    if(node)module.exports=api;
})(typeof globalThis !== 'undefined' ? globalThis : this);