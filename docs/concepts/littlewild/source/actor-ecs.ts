/* Incremental actor ECS: authoritative vitals, learning, task movement and work time.
 * Components bind by reference to existing serialized actor records, preserving v8/v9
 * saves and all four existing content-library contracts. Activity and Intent are transient.
 * Command validation, RNG, task selection and completion side effects remain in the
 * domain facade while the ECS owns deterministic progression between those boundaries.
 */
(function (inputRoot: unknown) {
    'use strict';

    type ComponentData = Record<string, unknown>;
    type Point = { x: number; y: number };
    type Transform = ComponentData & { x: number; y: number; dir?: number };
    type Needs = ComponentData & { food: number; water: number; energy: number; comfort: number; joy: number };
    type Learning = ComponentData & { practiceDay: number; practicedToday: Record<string, unknown>; fatigue: number; recovering: boolean };
    type Feelings = ComponentData & { social: number; anger: number };
    type Inventory = ComponentData;
    type Task = ComponentData & {
        kind: string; phase: string; orderId?: string | null; path?: Point[]; elapsed?: number;
        duration: number; style?: string;
    };
    type Intent = ComponentData & { kind: string; phase: string; orderId: string | null; status: 'active' | 'blocked' | 'completed' | 'arrived' };
    type Activity = ComponentData & {
        studying: boolean; working: boolean; walking: boolean; style: string;
        socialPreference: number; loadLevel: number; hasShelter: boolean;
    };
    interface ActorRecord {
        id: string;
        creature: Transform;
        needs: Needs;
        learning: Learning;
        feelings: Feelings;
        inventory: Inventory;
        task?: Task;
        [key: string]: unknown;
    }
    interface ActorRules {
        format: 'littlewild-actor-rules';
        schemaVersion: 1;
        learning: Readonly<{ playfulFatigue: number; standardFatigue: number; recoveryRate: number; recoverAt: number; limitAt: number }>;
        feelings: Readonly<{ socialRate: number; socialPreferenceRate: number; angerRate: number }>;
        needs: Readonly<{
            workingKinds: readonly string[]; foodWork: number; foodIdle: number; waterWork: number; waterIdle: number;
            energyWork: number; energyIdle: number; walkLoadFactor: number; comfortShelter: number;
            comfortWithoutShelter: number; joyRate: number;
        }>;
    }
    interface StepInputs { day: number; socialPreference: number; loadLevel: number; hasShelter: boolean; }
    interface ActivityInputs { walkable(x:number,y:number):boolean; moveRate:number; workRate:number; }
    interface ActivityOutcome {
        state: 'idle' | 'arrived' | 'blocked' | 'walking' | 'working';
        completed: boolean;
        progress: number;
        intent: Intent | null;
    }
    interface DynamicsContext { entityId:string; day:number; }
    interface ActivityContext {
        entityId:string;
        walkable(x:number,y:number):boolean;
        moveRate:number;
        workRate:number;
        outcome:ActivityOutcome;
    }
    interface SystemSpec<C> {
        id:string; phase:'pre'|'simulate'|'post'; order:number; query:readonly string[];
        update(world:WorldApi,id:string,dt:number,context:C):void;
    }
    interface WorldApi {
        readonly entities:ReadonlySet<string>;
        create(id:string):string;
        destroy(id:string):boolean;
        set<T extends ComponentData>(id:string,type:string,data:T):T;
        remove(id:string,type:string):boolean;
        get<T extends ComponentData=ComponentData>(id:string,type:string):T|undefined;
        has(id:string,...types:string[]):boolean;
    }
    interface SchedulerApi {
        readonly systems:readonly {id:string}[];
        register<C>(spec:SystemSpec<C>):SchedulerApi;
        step<C>(world:WorldApi,dt:number,context:C):void;
    }
    interface EcsApi { World:new()=>WorldApi; Scheduler:new()=>SchedulerApi; }
    interface ContentApi { parse(input:unknown,limit:number):unknown; }
    interface ActorEcsRuntime {
        readonly world:WorldApi; readonly scheduler:SchedulerApi; readonly dynamics:SchedulerApi; readonly activity:SchedulerApi; readonly rules:ActorRules;
        sync(actors:readonly ActorRecord[]):void;
        step(actor:ActorRecord,dt:number,inputs:StepInputs):{studying:boolean};
        advanceActivity(actor:ActorRecord,dt:number,inputs:ActivityInputs):ActivityOutcome;
        forget(id:string):boolean;
    }
    interface ActorEcsApi { create(rules?:unknown):ActorEcsRuntime; validateRules(input:unknown):ActorRules; readonly FIELDS:typeof FIELDS; }
    interface LittlewildRoot { LWECS?:EcsApi; LWContent?:ContentApi; LWActorRules?:unknown; LWActorECS?:ActorEcsApi; }
    const root=inputRoot as LittlewildRoot;
    const node = typeof module !== 'undefined' && module.exports;
    const ecs = (node ? require('./ecs.js') : root.LWECS) as EcsApi|undefined;
    const content = (node ? require('./content-runtime.js') : root.LWContent) as ContentApi|undefined;
    const DEFAULT = node ? require('./content/actor-rules.json') as unknown : root.LWActorRules;
    if(!ecs||!content||DEFAULT===undefined)throw Error('Actor ECS dependencies are missing.');
    const E:EcsApi=ecs,C:ContentApi=content;
    const FIELDS = Object.freeze({Transform:'creature', Needs:'needs', Learning:'learning', Feelings:'feelings', Inventory:'inventory'} as const);
    const clamp = (value:number):number => Math.max(0, Math.min(100, value));
    const plain=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
        [Object.prototype,null].includes(Object.getPrototypeOf(value));
    const exact=(value:unknown,expected:readonly string[],label:string):Record<string,unknown>=>{
        if(!plain(value)||Object.keys(value).length!==expected.length||expected.some(key=>!Object.hasOwn(value,key)))
            throw Error('Invalid '+label+' schema.');
        return value;
    };
    const bounded=(value:unknown,low:number,high:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=low&&value<=high;
    const number=(value:unknown,low:number,high:number,label:string):number=>{
        if(!bounded(value,low,high))throw Error('Invalid '+label+'.');return value;
    };
    const required=<T extends ComponentData>(world:WorldApi,id:string,type:string):T=>{
        const value=world.get<T>(id,type);if(!value)throw Error('Missing ECS component: '+type);return value;
    };

    function validateRules(input:unknown):ActorRules {
        const rootRules=exact(C.parse(input,64*1024),['format','schemaVersion','learning','feelings','needs'],'actor rules');
        if(rootRules.format!=='littlewild-actor-rules'||rootRules.schemaVersion!==1)throw Error('Invalid actor rules schema.');
        const learning=exact(rootRules.learning,['playfulFatigue','standardFatigue','recoveryRate','recoverAt','limitAt'],'actor learning rules');
        const feelings=exact(rootRules.feelings,['socialRate','socialPreferenceRate','angerRate'],'actor feelings rules');
        const needs=exact(rootRules.needs,['workingKinds','foodWork','foodIdle','waterWork','waterIdle','energyWork','energyIdle','walkLoadFactor','comfortShelter','comfortWithoutShelter','joyRate'],'actor needs rules');
        const workingKinds=needs.workingKinds;
        if(!Array.isArray(workingKinds)||!workingKinds.length||workingKinds.length>32||new Set(workingKinds).size!==workingKinds.length||
            workingKinds.some(kind=>typeof kind!=='string'||!(/^[a-z][a-z0-9_-]{0,50}$/.test(kind))))throw Error('Invalid needs rules.');
        const checkedLearning={
            playfulFatigue:number(learning.playfulFatigue,0,10,'learning rules'), standardFatigue:number(learning.standardFatigue,0,10,'learning rules'),
            recoveryRate:number(learning.recoveryRate,0,10,'learning rules'), recoverAt:number(learning.recoverAt,0,100,'learning rules'),
            limitAt:number(learning.limitAt,0,100,'learning rules')
        };
        if(checkedLearning.recoverAt>=checkedLearning.limitAt)throw Error('Invalid learning or social rules.');
        const checkedFeelings={socialRate:number(feelings.socialRate,0,10,'social rules'),socialPreferenceRate:number(feelings.socialPreferenceRate,0,10,'social rules'),angerRate:number(feelings.angerRate,0,10,'social rules')};
        const needsNumber=(key:string):number=>number(needs[key],0,10,'needs rules');
        return Object.freeze({
            format:'littlewild-actor-rules',schemaVersion:1,
            learning:Object.freeze(checkedLearning),feelings:Object.freeze(checkedFeelings),
            needs:Object.freeze({workingKinds:Object.freeze([...workingKinds] as string[]),foodWork:needsNumber('foodWork'),foodIdle:needsNumber('foodIdle'),
                waterWork:needsNumber('waterWork'),waterIdle:needsNumber('waterIdle'),energyWork:needsNumber('energyWork'),energyIdle:needsNumber('energyIdle'),
                walkLoadFactor:needsNumber('walkLoadFactor'),comfortShelter:needsNumber('comfortShelter'),comfortWithoutShelter:needsNumber('comfortWithoutShelter'),joyRate:needsNumber('joyRate')})
        });
    }
    function create(rules:unknown = DEFAULT):ActorEcsRuntime {
        const tuning = validateRules(rules), w = new E.World(), dynamics = new E.Scheduler(),
            activityScheduler = new E.Scheduler(), workingKinds = new Set(tuning.needs.workingKinds);
        dynamics.register<DynamicsContext>({id:'practice-day',phase:'pre',order:10,query:['Learning'],update(world,id,_dt,ctx) {
            const learning=required<Learning>(world,id,'Learning');
            if(learning.practiceDay!==ctx.day){learning.practiceDay=ctx.day;learning.practicedToday={};}
        }});
        dynamics.register<DynamicsContext>({id:'learning-fatigue',phase:'simulate',order:10,query:['Learning','Activity'],update(world,id,dt) {
            const learning=required<Learning>(world,id,'Learning'),actorActivity=required<Activity>(world,id,'Activity');
            learning.fatigue=clamp(learning.fatigue+dt*(actorActivity.studying?(actorActivity.style==='playful'?
                tuning.learning.playfulFatigue:tuning.learning.standardFatigue):-tuning.learning.recoveryRate));
            if(learning.fatigue>=tuning.learning.limitAt)learning.recovering=true;
            if(learning.fatigue<=tuning.learning.recoverAt)learning.recovering=false;
        }});
        dynamics.register<DynamicsContext>({id:'social-decay',phase:'simulate',order:20,query:['Feelings','Activity'],update(world,id,dt) {
            const feelings=required<Feelings>(world,id,'Feelings'),actorActivity=required<Activity>(world,id,'Activity');
            feelings.social=clamp(feelings.social-dt*(tuning.feelings.socialRate+tuning.feelings.socialPreferenceRate*actorActivity.socialPreference));
            feelings.anger=clamp(feelings.anger-dt*tuning.feelings.angerRate);
        }});
        dynamics.register<DynamicsContext>({id:'needs-decay',phase:'simulate',order:30,query:['Needs','Activity'],update(world,id,dt) {
            const needs=required<Needs>(world,id,'Needs'),actorActivity=required<Activity>(world,id,'Activity'),ruleset=tuning.needs;
            needs.food=clamp(needs.food-dt*(actorActivity.working?ruleset.foodWork:ruleset.foodIdle));
            needs.water=clamp(needs.water-dt*(actorActivity.working?ruleset.waterWork:ruleset.waterIdle));
            needs.energy=clamp(needs.energy-dt*(actorActivity.working?ruleset.energyWork:ruleset.energyIdle)*(actorActivity.walking?1+actorActivity.loadLevel*ruleset.walkLoadFactor:1));
            needs.comfort=clamp(needs.comfort-dt*(actorActivity.hasShelter?ruleset.comfortShelter:ruleset.comfortWithoutShelter));
            needs.joy=clamp(needs.joy-dt*ruleset.joyRate);
        }});
        activityScheduler.register<ActivityContext>({id:'task-intent',phase:'pre',order:10,query:['Task','Intent'],update(world,id,_dt,ctx) {
            const task=required<Task>(world,id,'Task'),intent=required<Intent>(world,id,'Intent');
            intent.kind=task.kind||'unknown';intent.phase=task.phase||'work';intent.orderId=task.orderId||null;intent.status='active';ctx.outcome.intent=intent;
        }});
        activityScheduler.register<ActivityContext>({id:'task-movement',phase:'simulate',order:10,query:['Transform','Task','Intent'],update(world,id,dt,ctx) {
            const transform=required<Transform>(world,id,'Transform'),task=required<Task>(world,id,'Task');
            if(task.phase!=='walk')return;
            const point=Array.isArray(task.path)?task.path[0]:undefined;
            if(!point){task.phase='work';ctx.outcome.state='arrived';return;}
            if(!ctx.walkable(point.x,point.y)){ctx.outcome.state='blocked';return;}
            const dx=point.x-transform.x,dy=point.y-transform.y,distance=Math.hypot(dx,dy),move=ctx.moveRate*dt;
            if(dx)transform.dir=dx>0?1:-1;
            if(distance<=move){transform.x=point.x;transform.y=point.y;task.path!.shift();if(!task.path!.length)task.phase='work';ctx.outcome.state=task.phase==='work'?'arrived':'walking';}
            else if(distance){transform.x+=dx/distance*move;transform.y+=dy/distance*move;ctx.outcome.state='walking';}
            else{task.path!.shift();if(!task.path!.length)task.phase='work';ctx.outcome.state=task.phase==='work'?'arrived':'walking';}
        }});
        activityScheduler.register<ActivityContext>({id:'task-work-progress',phase:'simulate',order:20,query:['Task','Intent'],update(world,id,dt,ctx) {
            const task=required<Task>(world,id,'Task');
            if(task.phase==='walk'||ctx.outcome.state==='blocked'||ctx.outcome.state==='arrived')return;
            const before=Number.isFinite(task.elapsed)?task.elapsed as number:0;task.elapsed=before+dt*ctx.workRate;
            ctx.outcome.state='working';ctx.outcome.progress=task.elapsed-before;ctx.outcome.completed=task.elapsed>=task.duration;
        }});
        activityScheduler.register<ActivityContext>({id:'task-intent-result',phase:'post',order:10,query:['Intent'],update(world,id,_dt,ctx) {
            const intent=required<Intent>(world,id,'Intent');
            if(ctx.outcome.state==='blocked')intent.status='blocked';else if(ctx.outcome.completed)intent.status='completed';
            else if(ctx.outcome.state==='arrived')intent.status='arrived';else intent.status='active';
        }});
        function bind(actor:ActorRecord):void {
            if(!actor || typeof actor.id !== 'string') throw Error('Invalid actor entity.');
            if(!w.entities.has(actor.id))w.create(actor.id);
            for (const [type,field] of Object.entries(FIELDS) as Array<[keyof typeof FIELDS,typeof FIELDS[keyof typeof FIELDS]]>) {
                const component=actor[field] as ComponentData|undefined;
                if (!component || typeof component !== 'object' || Array.isArray(component)) throw Error('Missing actor component: ' + type);
                if(w.get(actor.id,type)!==component)w.set(actor.id,type,component);
            }
        }
        return Object.freeze({
            world:w, scheduler:dynamics, dynamics, activity:activityScheduler, rules:tuning,
            sync(actors:readonly ActorRecord[]):void {
                if (!Array.isArray(actors)) throw Error('Actor sync expects an array.');
                const seen=new Set<string>();
                for(const actor of actors) {
                    if(!actor || seen.has(actor.id))throw Error('Invalid or duplicate actor.');
                    seen.add(actor.id);bind(actor);
                    if(actor.task){if(w.get(actor.id,'Task')!==actor.task)w.set(actor.id,'Task',actor.task);}
                    else{if(w.has(actor.id,'Task'))w.remove(actor.id,'Task');if(w.has(actor.id,'Intent'))w.remove(actor.id,'Intent');}
                }
                for(const id of w.entities)if(!seen.has(id))w.destroy(id);
            },
            step(actor:ActorRecord,dt:number,inputs:StepInputs):{studying:boolean} {
                if(!inputs || !Number.isSafeInteger(inputs.day) || !Number.isFinite(inputs.socialPreference) || inputs.socialPreference < 0 || inputs.socialPreference > 100 ||
                    !Number.isFinite(inputs.loadLevel) || inputs.loadLevel < 0 || inputs.loadLevel > 100 || typeof inputs.hasShelter!=='boolean' || !Number.isFinite(dt) || dt <= 0 || dt > .25)
                    throw Error('Invalid actor ECS inputs.');
                bind(actor);
                const task=actor.task;
                const actorActivity:Activity={studying:!!task&&['train','practice'].includes(task.kind)&&task.phase==='work',working:!!task&&workingKinds.has(task.kind),
                    walking:task?.phase==='walk',style:task?.style||'',socialPreference:inputs.socialPreference,loadLevel:inputs.loadLevel,hasShelter:inputs.hasShelter};
                w.set(actor.id,'Activity',actorActivity);dynamics.step(w,dt,{entityId:actor.id,day:inputs.day});return {studying:actorActivity.studying};
            },
            advanceActivity(actor:ActorRecord,dt:number,inputs:ActivityInputs):ActivityOutcome {
                if(!inputs || typeof inputs.walkable!=='function' || !Number.isFinite(inputs.moveRate) || inputs.moveRate<0 || !Number.isFinite(inputs.workRate) || inputs.workRate<0 || !Number.isFinite(dt) || dt<=0 || dt>.25)
                    throw Error('Invalid activity ECS inputs.');
                bind(actor);
                const task=actor.task,outcome:ActivityOutcome={state:'idle',completed:false,progress:0,intent:null},id=actor.id;
                if(!task){if(w.has(id,'Task'))w.remove(id,'Task');if(w.has(id,'Intent'))w.remove(id,'Intent');return outcome;}
                if(typeof task!=='object'||Array.isArray(task)||!Number.isFinite(task.duration)||task.duration<0)throw Error('Invalid actor task.');
                if(w.get(id,'Task')!==task)w.set(id,'Task',task);
                let intent=w.get<Intent>(id,'Intent');
                if(!intent){intent={kind:task.kind||'unknown',phase:task.phase||'work',orderId:task.orderId||null,status:'active'};w.set(id,'Intent',intent);}
                activityScheduler.step(w,dt,{entityId:id,walkable:inputs.walkable,moveRate:inputs.moveRate,workRate:inputs.workRate,outcome});return outcome;
            },
            forget(id:string):boolean {return w.destroy(id);}
        });
    }
    const api:ActorEcsApi=Object.freeze({create,validateRules,FIELDS});
    root.LWActorECS=api;
    if(node)module.exports=api;
})(globalThis);
