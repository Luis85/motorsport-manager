/* Entity/component storage and deterministic, explicit system scheduling.
 * Domain-only: no DOM, clocks, storage, network, or game-specific content.
 * A structural command buffer prevents systems from invalidating an active query.
 */
(function (root) {
    'use strict';
    const VALID = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const plain = o => o !== null && typeof o === 'object' && !Array.isArray(o) &&
        (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null);
    const name = (s, label) => {
        if (typeof s !== 'string' || !VALID.test(s)) throw Error('Invalid ' + label + '.');
        return s;
    };

    class World {
        constructor() {
            this.entities = new Set();
            this.stores = new Map();
            this.running = false;
            this.structural = [];
        }
        _editable() { if (this.running) throw Error('Structural ECS changes must be deferred.'); }
        create(id) {
            this._editable(); name(id, 'entity ID');
            if (this.entities.has(id)) throw Error('Duplicate entity: ' + id);
            this.entities.add(id); return id;
        }
        destroy(id) {
            this._editable(); if (!this.entities.delete(id)) return false;
            for (const store of this.stores.values()) store.delete(id);
            return true;
        }
        set(id, type, data) {
            this._editable(); name(type, 'component type');
            if (!this.entities.has(id)) throw Error('Unknown entity: ' + id);
            if (!plain(data)) throw Error('Component data must be a plain object.');
            // Component payloads are mutable data, owned by their caller; no behavior is stored.
            let store = this.stores.get(type);
            if (!store) { store = new Map(); this.stores.set(type, store); }
            store.set(id, data); return data;
        }
        remove(id, type) {
            this._editable(); return this.stores.get(type)?.delete(id) || false;
        }
        get(id, type) { return this.stores.get(type)?.get(id); }
        has(id, ...types) {
            return this.entities.has(id) && types.every(t => this.stores.get(t)?.has(id));
        }
        query(types, except = []) {
            if (!Array.isArray(types) || !Array.isArray(except)) throw Error('Expected component lists.');
            return [...this.entities].filter(id => this.has(id, ...types) &&
                except.every(type => !this.stores.get(type)?.has(id))).sort();
        }
        defer(operation, id, type, data) {
            if (!['create', 'destroy', 'set', 'remove'].includes(operation)) throw Error('Invalid structural operation.');
            name(id, 'entity ID');
            if (operation === 'set' || operation === 'remove') name(type, 'component type');
            if (operation === 'set' && !plain(data)) throw Error('Component data must be a plain object.');
            this.structural.push({operation, id, type, data});
        }
        flush() {
            this._editable();
            // A rejected command batch is consumed just like a failed transaction.
            // Keeping invalid commands queued would permanently wedge the world because
            // Scheduler.step intentionally refuses to run while structural work is pending.
            const actions = this.structural.splice(0);
            // Check the whole buffer against shadow entity/component memberships first.
            // An invalid late operation must not leave a half-created game entity.
            const entities = new Set(this.entities);
            const memberships = new Map([...this.stores].map(([type,store]) =>
                [type,new Set(store.keys())]));
            for (const a of actions) {
                if (a.operation === 'create') {
                    if (entities.has(a.id)) throw Error('Duplicate deferred entity: ' + a.id);
                    entities.add(a.id);
                } else if (a.operation === 'destroy') {
                    entities.delete(a.id);
                    for (const ids of memberships.values()) ids.delete(a.id);
                } else if (a.operation === 'set') {
                    if (!entities.has(a.id)) throw Error('Unknown deferred entity: ' + a.id);
                    if (!memberships.has(a.type)) memberships.set(a.type,new Set());
                    memberships.get(a.type).add(a.id);
                } else if (a.operation === 'remove') {
                    memberships.get(a.type)?.delete(a.id);
                }
            }
            for (const a of actions) {
                if (a.operation === 'create') this.create(a.id);
                else if (a.operation === 'destroy') this.destroy(a.id);
                else if (a.operation === 'set') this.set(a.id, a.type, a.data);
                else this.remove(a.id, a.type);
            }
        }
    }

    const PHASES = Object.freeze(['pre', 'simulate', 'post']);
    class Scheduler {
        constructor() { this.systems = []; }
        register(spec) {
            if (!spec || typeof spec.update !== 'function' || !Array.isArray(spec.query))
                throw Error('A system needs a query and an update function.');
            name(spec.id, 'system ID');
            if (!PHASES.includes(spec.phase) || !Number.isSafeInteger(spec.order) ||
                this.systems.some(s => s.id === spec.id)) throw Error('Invalid or duplicate system.');
            const record = Object.freeze({id:spec.id,phase:spec.phase,order:spec.order,
                query:Object.freeze([...spec.query]),update:spec.update});
            this.systems.push(record);
            this.systems.sort((a, b) => PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase) ||
                a.order - b.order || a.id.localeCompare(b.id));
            return this;
        }
        step(world, dt, context = {}) {
            if (!(world instanceof World) || !Number.isFinite(dt) || dt <= 0 || dt > .25 ||
                world.running || world.structural.length) throw Error('Invalid ECS step.');
            if (context.entityId && !world.entities.has(context.entityId)) throw Error('Unknown ECS step entity.');
            world.running = true;
            try {
                for (const system of this.systems) {
                    const ids = context.entityId ?
                        (world.has(context.entityId,...system.query) ? [context.entityId] : []) :
                        world.query(system.query);
                    for (const id of ids) system.update(world, id, dt, context);
                }
            } catch (error) {
                // Never apply deferred structure produced by a failed system.
                world.structural.length = 0;
                throw error;
            } finally {
                world.running = false;
            }
            world.flush();
        }
    }
    const api = Object.freeze({World, Scheduler, PHASES});
    root.LWECS = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);