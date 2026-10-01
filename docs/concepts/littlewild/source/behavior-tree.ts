/* Data-authored decision tree. Leaves are registered compiled functions, never code from JSON.
 * Node documents are exact, behavior-free data; tick order and cooldown memory are deterministic.
 */
(function (root: any) {
    'use strict';

    type Status = 'success' | 'running' | 'failure';
    type ActionResult = Status | false | null | undefined;
    type ActionHandler = (context: BehaviorContext) => ActionResult;

    interface BaseNode {
        id: string;
        name: string;
    }
    interface ActionNode extends BaseNode {
        type: 'action';
        action: string;
    }
    interface SelectorNode extends BaseNode {
        type: 'selector';
        children: BehaviorNode[];
    }
    interface SequenceNode extends BaseNode {
        type: 'sequence';
        children: BehaviorNode[];
    }
    interface CooldownNode extends BaseNode {
        type: 'cooldown';
        seconds: number;
        children: [BehaviorNode];
    }
    type BehaviorNode = ActionNode | SelectorNode | SequenceNode | CooldownNode;

    interface BehaviorContext {
        time: number;
        behaviorMemory?: Record<string, number>;
        [key: string]: unknown;
    }
    interface TraceRow {
        id: string;
        name: string;
        type: BehaviorNode['type'];
        status: Status;
    }

    const ID = /^[a-z][a-z0-9_-]{0,60}$/;
    const ACTION = /^[a-z][a-z0-9_-]{0,60}$/;
    const own = (object: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(object, key);
    const plain = (value: unknown): value is Record<string, unknown> =>
        value !== null && typeof value === 'object' && !Array.isArray(value) &&
        (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

    function record(value: unknown, label: string): Record<string, unknown> {
        if (!plain(value) || Object.getOwnPropertySymbols(value).length) throw Error('Invalid ' + label + '.');
        const descriptors = Object.getOwnPropertyDescriptors(value);
        const out: Record<string, unknown> = Object.create(null);
        for (const [key, descriptor] of Object.entries(descriptors)) {
            if (!descriptor.enumerable || descriptor.get || descriptor.set) throw Error('Invalid ' + label + '.');
            out[key] = descriptor.value;
        }
        return out;
    }
    function exact(value: Record<string, unknown>, fields: readonly string[], label: string): void {
        const keys = Object.keys(value);
        if (keys.length !== fields.length || fields.some(field => !own(value, field)))
            throw Error('Invalid ' + label + ' fields.');
    }

    class BehaviorTree {
        private readonly actions: Record<string, ActionHandler> = Object.create(null);

        constructor(actions: Record<string, ActionHandler>) {
            if (!plain(actions)) throw Error('Behavior actions must be a plain registry.');
            for (const [id, handler] of Object.entries(actions)) this.register(id, handler);
        }

        register(id: string, handler: ActionHandler): void {
            if (!ACTION.test(id) || typeof handler !== 'function' || own(this.actions, id))
                throw Error('Use a unique named behavior handler.');
            this.actions[id] = handler;
        }

        validate(tree: unknown): tree is BehaviorNode {
            const ids = new Set<string>();
            let count = 0;
            const walk = (input: unknown, depth: number): BehaviorNode => {
                if (++count > 100 || depth > 10) throw Error('Behavior tree must have at most 100 nodes and 10 levels.');
                const node = record(input, 'behavior node');
                if (typeof node.id !== 'string' || !ID.test(node.id) || ids.has(node.id))
                    throw Error('Behavior node IDs must be unique.');
                ids.add(node.id);
                if (typeof node.name !== 'string' || !node.name.trim() || node.name.length > 100)
                    throw Error('A behavior node needs a short name.');

                if (node.type === 'action') {
                    exact(node, ['id','name','type','action'], 'behavior action');
                    if (typeof node.action !== 'string' || !ACTION.test(node.action) ||
                        !own(this.actions, node.action) || typeof this.actions[node.action] !== 'function')
                        throw Error('Unknown behavior action: ' + String(node.action));
                    return node as unknown as ActionNode;
                }

                if (node.type !== 'selector' && node.type !== 'sequence' && node.type !== 'cooldown')
                    throw Error('Invalid behavior composite.');
                const expected = node.type === 'cooldown'
                    ? ['id','name','type','seconds','children']
                    : ['id','name','type','children'];
                exact(node, expected, 'behavior composite');
                if (!Array.isArray(node.children) || !node.children.length)
                    throw Error('Invalid behavior composite.');
                if (node.type === 'cooldown' &&
                    (node.children.length !== 1 || !Number.isFinite(node.seconds) ||
                     !Number.isInteger(node.seconds) || (node.seconds as number) < 1 || (node.seconds as number) > 600))
                    throw Error('Invalid behavior cooldown.');
                const children = node.children.map(child => walk(child, depth + 1));
                if (node.type === 'cooldown')
                    return {...node, children: children as [BehaviorNode]} as unknown as CooldownNode;
                return {...node, children} as unknown as SelectorNode | SequenceNode;
            };
            walk(tree, 0);
            return true;
        }

        tick(tree: BehaviorNode, context: BehaviorContext): { status: Status; trace: TraceRow[] } {
            if (!context || typeof context !== 'object' || !Number.isFinite(context.time) || context.time < 0)
                throw Error('Behavior tick needs finite simulation time.');
            if (context.behaviorMemory === undefined) context.behaviorMemory = {};
            const memory = context.behaviorMemory;
            if (!plain(memory) || Object.getOwnPropertySymbols(memory).length)
                throw Error('Behavior memory must be plain data.');

            const trace: TraceRow[] = [];
            const now = context.time;
            const visit = (node: BehaviorNode): Status => {
                let status: Status = 'failure';
                if (node.type === 'action') {
                    status = this.actions[node.action]!(context) || 'failure';
                    if (!['success', 'running', 'failure'].includes(status))
                        throw Error('Invalid behavior status: ' + node.id);
                } else if (node.type === 'cooldown') {
                    const stored = own(memory, node.id) ? memory[node.id] : 0;
                    if (typeof stored !== 'number' || !Number.isFinite(stored) || stored < 0)
                        throw Error('Invalid behavior cooldown memory: ' + node.id);
                    if (stored <= now) {
                        status = visit(node.children[0]);
                        if (status !== 'failure') memory[node.id] = now + node.seconds;
                    }
                } else {
                    status = node.type === 'sequence' ? 'success' : 'failure';
                    for (const child of node.children) {
                        const result = visit(child);
                        if (node.type === 'selector' && result !== 'failure') {
                            status = result;
                            break;
                        }
                        if (node.type === 'sequence' && result !== 'success') {
                            status = result;
                            break;
                        }
                    }
                }
                trace.push({ id: node.id, name: node.name, type: node.type, status });
                return status;
            };
            return { status: visit(tree), trace };
        }
    }

    root.LWBehaviorTree = BehaviorTree;
    if (typeof module !== 'undefined' && module.exports) module.exports = BehaviorTree;
})(typeof globalThis !== 'undefined' ? globalThis : this);
