/* Entity/component storage and deterministic, explicit system scheduling.
 * Domain-only: no DOM, clocks, storage, network, or game-specific content.
 * Structural buffering is atomic; component-value rollback remains domain-transaction owned.
 */
(function (root: any) {
    'use strict';

    type EntityId = string;
    type ComponentType = string;
    type ComponentData = Record<string, unknown>;
    type StructuralOperation = 'create' | 'destroy' | 'set' | 'remove';

    interface StructuralCommand {
        operation: StructuralOperation;
        id: EntityId;
        type?: ComponentType;
        data?: ComponentData;
    }
    interface StepContext {
        entityId?: EntityId;
        [key: string]: unknown;
    }
    interface SystemSpec {
        id: string;
        phase: 'pre' | 'simulate' | 'post';
        order: number;
        query: readonly ComponentType[];
        update: (world: World, id: EntityId, dt: number, context: StepContext) => void;
    }
    interface SystemRecord extends SystemSpec {
        readonly query: readonly ComponentType[];
    }

    const VALID = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;
    const plain = (value: unknown): value is ComponentData =>
        value !== null && typeof value === 'object' && !Array.isArray(value) &&
        (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
    const dataOnly = (value: unknown, ancestors = new Set<object>(), depth = 0): boolean => {
        if (depth > 64) return false;
        if (value === null) return true;
        if (value === undefined) return false;
        if (typeof value === 'string' || typeof value === 'boolean') return true;
        if (typeof value === 'number') return Number.isFinite(value);
        if (typeof value !== 'object') return false;
        const object = value as object;
        if (ancestors.has(object) || Object.getOwnPropertySymbols(object).length) return false;
        ancestors.add(object);
        let ok = true;
        if (Array.isArray(value)) {
            const names = Object.getOwnPropertyNames(value);
            if (names.length !== value.length + 1 || !names.includes('length')) ok = false;
            else {
                for (let index = 0; index < value.length; index += 1) {
                    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
                    if (!descriptor || descriptor.get || descriptor.set ||
                        !dataOnly(descriptor.value, ancestors, depth + 1)) {
                        ok = false;
                        break;
                    }
                }
            }
        } else if (plain(value)) {
            for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
                if (descriptor.get || descriptor.set || !dataOnly(descriptor.value, ancestors, depth + 1)) {
                    ok = false;
                    break;
                }
            }
        } else ok = false;
        ancestors.delete(object);
        return ok;
    };
    const name = (value: unknown, label: string): string => {
        if (typeof value !== 'string' || !VALID.test(value)) throw Error('Invalid ' + label + '.');
        return value;
    };

    class World {
        readonly #entitySet = new Set<EntityId>();
        readonly #componentStores = new Map<ComponentType, Map<EntityId, ComponentData>>();
        readonly #structuralBuffer: StructuralCommand[] = [];
        running = false;

        get entities(): ReadonlySet<EntityId> { return new Set(this.#entitySet); }
        get stores(): ReadonlyMap<ComponentType, ReadonlyMap<EntityId, ComponentData>> {
            return new Map([...this.#componentStores].map(([type, store]) => [type, new Map(store)] as const));
        }
        get structural(): readonly Readonly<Pick<StructuralCommand,'operation'|'id'|'type'>>[] {
            return Object.freeze(this.#structuralBuffer.map(action =>
                Object.freeze({operation:action.operation,id:action.id,type:action.type})));
        }
        get pendingStructural(): number { return this.#structuralBuffer.length; }

        private editable(): void {
            if (this.running) throw Error('Structural ECS changes must be deferred.');
        }
        create(id: EntityId): EntityId {
            this.editable(); name(id, 'entity ID');
            if (this.#entitySet.has(id)) throw Error('Duplicate entity: ' + id);
            this.#entitySet.add(id);
            return id;
        }
        destroy(id: EntityId): boolean {
            this.editable();
            if (!this.#entitySet.delete(id)) return false;
            for (const store of this.#componentStores.values()) store.delete(id);
            return true;
        }
        set<T extends ComponentData>(id: EntityId, type: ComponentType, data: T): T {
            this.editable(); name(type, 'component type');
            if (!this.#entitySet.has(id)) throw Error('Unknown entity: ' + id);
            if (!plain(data) || !dataOnly(data)) throw Error('Component data must be behavior-free plain data.');
            let store = this.#componentStores.get(type);
            if (!store) {
                store = new Map<EntityId, ComponentData>();
                this.#componentStores.set(type, store);
            }
            store.set(id, data);
            return data;
        }
        remove(id: EntityId, type: ComponentType): boolean {
            this.editable();
            return this.#componentStores.get(type)?.delete(id) || false;
        }
        get<T extends ComponentData = ComponentData>(id: EntityId, type: ComponentType): T | undefined {
            return this.#componentStores.get(type)?.get(id) as T | undefined;
        }
        has(id: EntityId, ...types: ComponentType[]): boolean {
            return this.#entitySet.has(id) && types.every(type => this.#componentStores.get(type)?.has(id));
        }
        query(types: readonly ComponentType[], except: readonly ComponentType[] = []): EntityId[] {
            if (!Array.isArray(types) || !Array.isArray(except)) throw Error('Expected component lists.');
            for (const type of [...types, ...except]) name(type, 'component type');
            return [...this.#entitySet].filter(id => this.has(id, ...types) &&
                except.every(type => !this.#componentStores.get(type)?.has(id))).sort();
        }
        defer(operation: StructuralOperation, id: EntityId, type?: ComponentType, data?: ComponentData): void {
            if (!['create', 'destroy', 'set', 'remove'].includes(operation)) throw Error('Invalid structural operation.');
            name(id, 'entity ID');
            if (operation === 'set' || operation === 'remove') name(type, 'component type');
            if (operation === 'set' && (!plain(data) || !dataOnly(data))) throw Error('Component data must be behavior-free plain data.');
            this.#structuralBuffer.push({ operation, id, type, data });
        }
        discardDeferred(): void {
            this.editable();
            this.#structuralBuffer.length = 0;
        }
        flush(): void {
            this.editable();
            const actions = this.#structuralBuffer.splice(0);
            const entities = new Set(this.#entitySet);
            const memberships = new Map([...this.#componentStores].map(([type, store]) =>
                [type, new Set(store.keys())] as const));

            for (const action of actions) {
                if (!['create','destroy','set','remove'].includes(action.operation))
                    throw Error('Invalid structural operation.');
                name(action.id, 'entity ID');
                if (action.operation === 'set' || action.operation === 'remove') name(action.type, 'component type');
                if (action.operation === 'create') {
                    if (entities.has(action.id)) throw Error('Duplicate deferred entity: ' + action.id);
                    entities.add(action.id);
                } else if (action.operation === 'destroy') {
                    entities.delete(action.id);
                    for (const ids of memberships.values()) ids.delete(action.id);
                } else if (action.operation === 'set') {
                    if (!entities.has(action.id)) throw Error('Unknown deferred entity: ' + action.id);
                    const type = name(action.type, 'component type');
                    if (!plain(action.data) || !dataOnly(action.data))
                        throw Error('Component data must be behavior-free plain data.');
                    if (!memberships.has(type)) memberships.set(type, new Set());
                    memberships.get(type)!.add(action.id);
                } else if (action.operation === 'remove') {
                    memberships.get(name(action.type, 'component type'))?.delete(action.id);
                }
            }

            for (const action of actions) {
                if (action.operation === 'create') this.create(action.id);
                else if (action.operation === 'destroy') this.destroy(action.id);
                else if (action.operation === 'set') this.set(action.id, name(action.type, 'component type'), action.data!);
                else this.remove(action.id, name(action.type, 'component type'));
            }
        }
    }

    const PHASES = Object.freeze(['pre', 'simulate', 'post'] as const);
    class Scheduler {
        readonly #records: SystemRecord[] = [];

        get systems(): readonly SystemRecord[] { return Object.freeze([...this.#records]); }

        register(spec: SystemSpec): this {
            if (!spec || typeof spec.update !== 'function' || !Array.isArray(spec.query))
                throw Error('A system needs a query and an update function.');
            name(spec.id, 'system ID');
            for (const type of spec.query) name(type, 'component type');
            if (new Set(spec.query).size !== spec.query.length ||
                !PHASES.includes(spec.phase) || !Number.isSafeInteger(spec.order) ||
                this.#records.some(system => system.id === spec.id)) throw Error('Invalid or duplicate system.');
            const record: SystemRecord = Object.freeze({
                id: spec.id,
                phase: spec.phase,
                order: spec.order,
                query: Object.freeze([...spec.query]),
                update: spec.update
            });
            this.#records.push(record);
            this.#records.sort((a, b) => PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase) ||
                a.order - b.order || a.id.localeCompare(b.id));
            return this;
        }

        step(world: World, dt: number, context: StepContext = {}): void {
            if (!(world instanceof World) || !Number.isFinite(dt) || dt <= 0 || dt > .25 ||
                world.running || world.pendingStructural) throw Error('Invalid ECS step.');
            if (context.entityId && !world.entities.has(context.entityId)) throw Error('Unknown ECS step entity.');
            world.running = true;
            try {
                for (const system of this.#records) {
                    const ids = context.entityId
                        ? (world.has(context.entityId, ...system.query) ? [context.entityId] : [])
                        : world.query(system.query);
                    for (const id of ids) system.update(world, id, dt, context);
                }
            } catch (error) {
                world.running = false;
                world.discardDeferred();
                throw error;
            } finally {
                world.running = false;
            }
            world.flush();
        }
    }

    const api = Object.freeze({ World, Scheduler, PHASES });
    root.LWECS = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
