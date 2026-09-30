/* Littlewild ECS foundation.
 * Pure deterministic entity/component scheduling. No game content, DOM, timers or RNG.
 * Existing save records remain authoritative while legacy adapters are migrated.
 */
(function (root) {
  'use strict';
  const validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
  const validName = value => typeof value === 'string' && /^[A-Z][A-Za-z0-9]{0,63}$/.test(value);
  class World {
    constructor() {
      this.entities = new Map();
      this.stores = new Map();
      this.systems = new Map();
      this._executing = false;
    }
    assertMutable() {
      if (this._executing) throw Error('Structural ECS changes are forbidden during a system phase.');
    }
    create(id) {
      this.assertMutable();
      if (!validId(id) || this.entities.has(id)) throw Error('Invalid or duplicate entity ID.');
      this.entities.set(id, true);
      return id;
    }
    remove(id) {
      this.assertMutable();
      if (!this.entities.delete(id)) return false;
      for (const store of this.stores.values()) store.delete(id);
      return true;
    }
    set(id, type, component) {
      this.assertMutable();
      if (!this.entities.has(id) || !validName(type) || !component || typeof component !== 'object' || Array.isArray(component))
        throw Error('Components require an existing entity, a valid type and an object.');
      if (!this.stores.has(type)) this.stores.set(type, new Map());
      this.stores.get(type).set(id, component);
      return component;
    }
    get(id, type) { return this.stores.get(type)?.get(id) || null; }
    has(id, ...types) { return this.entities.has(id) && types.every(type => this.stores.get(type)?.has(id)); }
    detach(id, type) { this.assertMutable(); return this.stores.get(type)?.delete(id) || false; }
    query(...types) { return [...this.entities.keys()].filter(id => this.has(id, ...types)); }
    register({id, phase, order = 0, reads = [], writes = [], update}) {
      this.assertMutable();
      if (!validId(id) || !validId(phase) || this.systems.has(id) || !Number.isInteger(order) ||
          !Array.isArray(reads) || !Array.isArray(writes) || [...reads, ...writes].some(t => !validName(t)) ||
          typeof update !== 'function') throw Error('Invalid ECS system registration.');
      const system = Object.freeze({id, phase, order, reads: Object.freeze([...new Set(reads)]),
        writes: Object.freeze([...new Set(writes)]), update});
      this.systems.set(id, system);
      return system;
    }
    phase(phase, dt, context = {}, entityId = null) {
      if (this._executing) throw Error('Nested ECS phases are forbidden.');
      if (!Number.isFinite(dt) || dt < 0 || dt > .25) throw Error('Invalid ECS fixed step.');
      if (entityId !== null && !this.entities.has(entityId)) throw Error('Unknown ECS entity.');
      const systems = [...this.systems.values()].filter(s => s.phase === phase)
        .sort((a,b) => a.order - b.order || a.id.localeCompare(b.id));
      this._executing = true;
      try {
        const ids = entityId === null ? [...this.entities.keys()] : [entityId];
        // Actor-major ordering preserves the existing per-creature simulation ordering.
        for (const id of ids) for (const system of systems) {
          const required = [...new Set([...system.reads, ...system.writes])];
          if (!this.has(id, ...required)) continue;
          const components = Object.fromEntries(required.map(type => [type, this.get(id, type)]));
          system.update(Object.freeze({id, dt, components: Object.freeze(components), context}));
        }
      } finally { this._executing = false; }
    }
  }
  const api = Object.freeze({World});
  root.LWECS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
