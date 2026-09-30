/* Legacy actor bridge and first authoritative ECS systems.
 * v8 creature records own component data during migration. ECS stores those SAME
 * objects, never a shadow copy. Activity is a read-only task-pointer snapshot.
 */
(function(root) {
  'use strict';
  const NODE = typeof module !== 'undefined' && module.exports;
  const Core = NODE ? require('./ecs.js') : root.LWECS;
  const DEFAULT = NODE ? require('./content/actor-model.json') : root.LWActorModel;
  const clamp = (value, low = 0, high = 100) => Math.max(low, Math.min(high, value));
  const fields = Object.freeze({Transform:'creature', Needs:'needs', Learning:'learning', Social:'feelings', Inventory:'inventory'});
  function validateModel(model) {
    if (!model || model.schemaVersion !== 1 || !Array.isArray(model.workingKinds) ||
        new Set(model.workingKinds).size !== model.workingKinds.length ||
        model.workingKinds.some(x => typeof x !== 'string' || !/^[a-z-]{1,32}$/.test(x)))
      throw Error('Unsupported actor-model definition.');
    for (const [section, names] of Object.entries({
      learning:['playfulRate','regularRate','recoveryRate','recoveryStartsAt','recoveryEndsAt'],
      social:['socialBaseRate','socialPreferenceRate','angerRecoveryRate'],
      needs:['foodWorking','foodIdle','waterWorking','waterIdle','energyWorking','energyIdle',
        'walkingLoadMultiplier','comfortShelter','comfortOutside','joyRate']
    })) for (const key of names) {
      const v = model[section]?.[key];
      if (!Number.isFinite(v) || v < 0 || v > 100) throw Error('Invalid actor-model '+section+'.'+key+'.');
    }
    if(model.learning.recoveryEndsAt > model.learning.recoveryStartsAt)
      throw Error('Learning recovery needs hysteresis.');
    return JSON.parse(JSON.stringify(model));
  }
  class ActorBridge {
    constructor(model = DEFAULT) {
      this.model = validateModel(model);
      this.workingKinds = new Set(this.model.workingKinds);
      this.world = new Core.World();
      this.refs = new Map();
      this.registerSystems();
    }
    sync(actors) {
      if (!Array.isArray(actors)) throw Error('ECS actor sync requires an array.');
      const seen = new Set();
      for (const actor of actors) {
        if (!actor || typeof actor.id !== 'string' || seen.has(actor.id)) throw Error('Invalid ECS actor identity.');
        seen.add(actor.id);
        if (!this.world.entities.has(actor.id)) this.world.create(actor.id);
        this.refs.set(actor.id, actor);
        this.syncActor(actor);
      }
      for (const id of [...this.refs.keys()]) if (!seen.has(id)) {
        this.world.remove(id);
        this.refs.delete(id);
      }
    }
    syncActor(actor) {
      if (!this.world.entities.has(actor.id)) this.world.create(actor.id);
      this.refs.set(actor.id, actor);
      for (const [type, field] of Object.entries(fields)) {
        const source = actor[field];
        if (!source || typeof source !== 'object' || Array.isArray(source)) throw Error('Missing actor component '+type+'.');
        if (this.world.get(actor.id,type) !== source) this.world.set(actor.id, type, source);
      }
      this.world.set(actor.id, 'Activity', {task:actor.task});
    }
    registerSystems() {
      const w = this.world, model = this.model, workingKinds = this.workingKinds;
      w.register({id:'learning-fatigue',phase:'actor-update',order:10,
        reads:['Activity'], writes:['Learning'], update:({components:{Learning,Activity},dt,context}) => {
          if (Learning.practiceDay !== context.day) {
            Learning.practiceDay = context.day;
            Learning.practicedToday = {};
          }
          const t=Activity.task;
          const studying=!!t && ['train','practice'].includes(t.kind) && t.phase === 'work';
          Learning.fatigue = clamp(Learning.fatigue + dt * (studying ? (t.style === 'playful' ? model.learning.playfulRate : model.learning.regularRate) : -model.learning.recoveryRate));
          if (Learning.fatigue >= model.learning.recoveryStartsAt) Learning.recovering=true;
          if (Learning.fatigue <= model.learning.recoveryEndsAt) Learning.recovering=false;
        }});
      w.register({id:'social-recovery',phase:'actor-update',order:20,
        writes:['Social'], update:({components:{Social},dt,context}) => {
          Social.social=clamp(Social.social-dt*(model.social.socialBaseRate+model.social.socialPreferenceRate*context.socialPreference));
          Social.anger=clamp(Social.anger-dt*model.social.angerRecoveryRate);
        }});
      w.register({id:'needs-decay',phase:'actor-update',order:30,
        reads:['Activity'],writes:['Needs'],update:({components:{Needs,Activity},dt,context}) => {
          const t=Activity.task, working=!!t&&workingKinds.has(t.kind);
          Needs.food=clamp(Needs.food-dt*(working?model.needs.foodWorking:model.needs.foodIdle));
          Needs.water=clamp(Needs.water-dt*(working?model.needs.waterWorking:model.needs.waterIdle));
          Needs.energy=clamp(Needs.energy-dt*(working?model.needs.energyWorking:model.needs.energyIdle)*(t?.phase==='walk'?1+context.loadLevel*model.needs.walkingLoadMultiplier:1));
          Needs.comfort=clamp(Needs.comfort-dt*(context.hasShelter?model.needs.comfortShelter:model.needs.comfortOutside));
          Needs.joy=clamp(Needs.joy-dt*model.needs.joyRate);
        }});
    }
    tick(actor,dt,{day,socialPreference,loadLevel,hasShelter}) {
      this.syncActor(actor);
      for(const n of [day,socialPreference,loadLevel]) if(!Number.isFinite(n)) throw Error('Invalid ECS actor context.');
      this.world.phase('actor-update',dt,{day,socialPreference,loadLevel,hasShelter:!!hasShelter},actor.id);
    }
  }
  const api=Object.freeze({ActorBridge, fields, clamp, validateModel});
  root.LWActorSystems=api;
  if(typeof module !== 'undefined'&&module.exports) module.exports=api;
})(typeof globalThis !== 'undefined'?globalThis:this);
