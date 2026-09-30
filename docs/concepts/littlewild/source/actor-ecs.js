/* Incremental actor ECS: authoritative vitals, learning, task movement and work time.
 * Components bind by reference to existing serialized actor records, preserving v8/v9
 * saves and all four existing content-library contracts. Activity and Intent are transient.
 * Command validation, RNG, task selection and completion side effects remain in the
 * domain facade while the ECS owns deterministic progression between those boundaries.
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
        const tuning = validateRules(rules), w = new E.World(), dynamics = new E.Scheduler(),
            activity = new E.Scheduler(), workingKinds = new Set(tuning.needs.workingKinds);
        dynamics.register({id:'practice-day',phase:'pre',order:10,query:['Learning'],update(world,id,dt,ctx) {
            const l=world.get(id,'Learning');
            if(l.practiceDay!==ctx.day){l.practiceDay=ctx.day;l.practicedToday={};}
        }});
        dynamics.register({id:'learning-fatigue',phase:'simulate',order:10,query:['Learning','Activity'],update(world,id,dt) {
            const l=world.get(id,'Learning'),a=world.get(id,'Activity');
            l.fatigue=clamp(l.fatigue+dt*(a.studying?(a.style==='playful'?
                tuning.learning.playfulFatigue:tuning.learning.standardFatigue):-tuning.learning.recoveryRate));
            if(l.fatigue>=tuning.learning.limitAt)l.recovering=true;
            if(l.fatigue<=tuning.learning.recoverAt)l.recovering=false;
        }});
        dynamics.register({id:'social-decay',phase:'simulate',order:20,query:['Feelings','Activity'],update(world,id,dt) {
            const f=world.get(id,'Feelings'),a=world.get(id,'Activity');
            f.social=clamp(f.social-dt*(tuning.feelings.socialRate+
                tuning.feelings.socialPreferenceRate*a.socialPreference));
            f.anger=clamp(f.anger-dt*tuning.feelings.angerRate);
        }});
        dynamics.register({id:'needs-decay',phase:'simulate',order:30,query:['Needs','Activity'],update(world,id,dt) {
            const n=world.get(id,'Needs'),a=world.get(id,'Activity'),r=tuning.needs;
            n.food=clamp(n.food-dt*(a.working?r.foodWork:r.foodIdle));
            n.water=clamp(n.water-dt*(a.working?r.waterWork:r.waterIdle));
            n.energy=clamp(n.energy-dt*(a.working?r.energyWork:r.energyIdle)*
                (a.walking?1+a.loadLevel*r.walkLoadFactor:1));
            n.comfort=clamp(n.comfort-dt*(a.hasShelter?r.comfortShelter:r.comfortWithoutShelter));
            n.joy=clamp(n.joy-dt*r.joyRate);
        }});
        activity.register({id:'task-intent',phase:'pre',order:10,query:['Task','Intent'],update(world,id,dt,ctx) {
            const task=world.get(id,'Task'),intent=world.get(id,'Intent');
            intent.kind=task.kind||'unknown';intent.phase=task.phase||'work';
            intent.orderId=task.orderId||null;intent.status='active';
            ctx.outcome.intent=intent;
        }});
        activity.register({id:'task-movement',phase:'simulate',order:10,query:['Transform','Task','Intent'],update(world,id,dt,ctx) {
            const transform=world.get(id,'Transform'),task=world.get(id,'Task');
            if(task.phase!=='walk')return;
            const point=Array.isArray(task.path)?task.path[0]:null;
            if(!point){task.phase='work';ctx.outcome.state='arrived';return;}
            if(!ctx.walkable(point.x,point.y)){ctx.outcome.state='blocked';return;}
            const dx=point.x-transform.x,dy=point.y-transform.y,distance=Math.hypot(dx,dy),move=ctx.moveRate*dt;
            if(dx)transform.dir=dx>0?1:-1;
            if(distance<=move){transform.x=point.x;transform.y=point.y;task.path.shift();
                if(!task.path.length)task.phase='work';ctx.outcome.state=task.phase==='work'?'arrived':'walking';
            }else if(distance){transform.x+=dx/distance*move;transform.y+=dy/distance*move;ctx.outcome.state='walking';}
            else{task.path.shift();if(!task.path.length)task.phase='work';ctx.outcome.state=task.phase==='work'?'arrived':'walking';}
        }});
        activity.register({id:'task-work-progress',phase:'simulate',order:20,query:['Task','Intent'],update(world,id,dt,ctx) {
            const task=world.get(id,'Task');
            if(task.phase==='walk'||ctx.outcome.state==='blocked'||ctx.outcome.state==='arrived')return;
            const before=Number.isFinite(task.elapsed)?task.elapsed:0;
            task.elapsed=before+dt*ctx.workRate;
            ctx.outcome.state='working';ctx.outcome.progress=task.elapsed-before;
            ctx.outcome.completed=task.elapsed>=task.duration;
        }});
        activity.register({id:'task-intent-result',phase:'post',order:10,query:['Intent'],update(world,id,dt,ctx) {
            const intent=world.get(id,'Intent');
            if(ctx.outcome.state==='blocked')intent.status='blocked';
            else if(ctx.outcome.completed)intent.status='completed';
            else if(ctx.outcome.state==='arrived')intent.status='arrived';
            else intent.status='active';
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
            world:w, scheduler:dynamics, dynamics, activity, rules:tuning,
            sync(actors) {
                if (!Array.isArray(actors)) throw Error('Actor sync expects an array.');
                const seen=new Set();
                for(const actor of actors) {
                    if(!actor || seen.has(actor.id))throw Error('Invalid or duplicate actor.');
                    seen.add(actor.id);bind(actor);
                    if(actor.task){if(w.get(actor.id,'Task')!==actor.task)w.set(actor.id,'Task',actor.task);}
                    else{if(w.has(actor.id,'Task'))w.remove(actor.id,'Task');if(w.has(actor.id,'Intent'))w.remove(actor.id,'Intent');}
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
                dynamics.step(w,dt,{entityId:actor.id,day:inputs.day});
                return {studying:activity.studying};
            },
            advanceActivity(actor,dt,inputs) {
                if(!inputs || typeof inputs.walkable!=='function' || !Number.isFinite(inputs.moveRate) || inputs.moveRate<0 ||
                    !Number.isFinite(inputs.workRate) || inputs.workRate<0 || !Number.isFinite(dt) || dt<=0 || dt>.25)
                    throw Error('Invalid activity ECS inputs.');
                bind(actor);
                const task=actor.task,outcome={state:'idle',completed:false,progress:0,intent:null};
                const id=actor.id;
                if(!task){if(w.has(id,'Task'))w.remove(id,'Task');if(w.has(id,'Intent'))w.remove(id,'Intent');return outcome;}
                if(!task || typeof task!=='object' || Array.isArray(task) || !Number.isFinite(task.duration) || task.duration<0)
                    throw Error('Invalid actor task.');
                if(w.get(id,'Task')!==task)w.set(id,'Task',task);
                let intent=w.get(id,'Intent');
                if(!intent){intent={kind:task.kind||'unknown',phase:task.phase||'work',orderId:task.orderId||null,status:'active'};w.set(id,'Intent',intent);}
                activity.step(w,dt,{entityId:id,walkable:inputs.walkable,moveRate:inputs.moveRate,workRate:inputs.workRate,outcome});
                return outcome;
            },
            forget(id) {return w.destroy(id);}
        });
    }
    const api=Object.freeze({create,validateRules,FIELDS});
    root.LWActorECS=api;
    if(node)module.exports=api;
})(typeof globalThis !== 'undefined' ? globalThis : this);