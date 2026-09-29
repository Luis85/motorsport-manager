/* Data-authored decision tree. Leaves are registered functions, never code from JSON.
 * A leaf returns success/running/failure. Selector/sequence/cooldown are reusable. */
(function (root) {
    'use strict';
    class BehaviorTree {
        constructor(actions) { this.actions = Object.assign(Object.create(null), actions); }
        register(id, handler) { if (!/^[a-z][a-z0-9_-]*$/.test(id) || typeof handler !== 'function' || Object.hasOwn(this.actions, id))
            throw Error('Use a unique named behavior handler.'); this.actions[id] = handler; }
        validate(tree) { const ids = new Set(); let count = 0; const walk = (n, depth) => { if (!n || typeof n !== 'object' || Array.isArray(n) || ++count > 100 || depth > 10)
            throw Error('Behavior tree must have at most 100 nodes and 10 levels.'); if (!/^[a-z][a-z0-9_-]{0,60}$/.test(n.id) || ids.has(n.id))
            throw Error('Behavior node IDs must be unique.'); ids.add(n.id); if (typeof n.name !== 'string' || n.name.length > 100)
            throw Error('A behavior node needs a short name.'); if (n.type === 'action') {
            if (!Object.hasOwn(this.actions, n.action) || typeof this.actions[n.action] !== 'function')
                throw Error('Unknown behavior action: ' + n.action);
            return;
        } if (!['selector', 'sequence', 'cooldown'].includes(n.type) || !Array.isArray(n.children) || !n.children.length)
            throw Error('Invalid behavior composite.'); if (n.type === 'cooldown' && (n.children.length !== 1 || !Number.isFinite(n.seconds) || n.seconds < 1 || n.seconds > 600))
            throw Error('Invalid behavior cooldown.'); n.children.forEach(x => walk(x, depth + 1)); }; walk(tree, 0); return true; }
        tick(tree, context) { const trace = [], memory = (context.behaviorMemory ||= {}), now = context.time || 0; const visit = n => { let status = 'failure'; if (n.type === 'action') {
            status = this.actions[n.action](context) || 'failure';
            if (!['success', 'running', 'failure'].includes(status))
                throw Error('Invalid behavior status: ' + n.id);
        }
        else if (n.type === 'cooldown') {
            if ((memory[n.id] || 0) <= now) {
                status = visit(n.children[0]);
                if (status !== 'failure')
                    memory[n.id] = now + n.seconds;
            }
        }
        else {
            status = n.type === 'sequence' ? 'success' : 'failure';
            for (const child of n.children) {
                const r = visit(child);
                if (n.type === 'selector' && r !== 'failure') {
                    status = r;
                    break;
                }
                if (n.type === 'sequence' && r !== 'success') {
                    status = r;
                    break;
                }
            }
        } trace.push({ id: n.id, name: n.name, type: n.type, status }); return status; }; const status = visit(tree); return { status, trace }; }
    }
    root.LWBehaviorTree = BehaviorTree;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = BehaviorTree;
})(typeof globalThis !== 'undefined' ? globalThis : this);
