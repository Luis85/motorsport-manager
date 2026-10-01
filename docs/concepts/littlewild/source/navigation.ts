/* Bounded, deterministic grid navigation. The cache is derived, never saved.
 * Every returned route is an independent array: consuming one cannot edit another.
 * See test-foundation-v9.cjs for parity against the original breadth-first search. */
(function (root) {
    'use strict';
    const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const cache = new WeakMap();
    class Grid {
        constructor(size, terrain, blockers = []) {
            this.size = size;
            this.cells = new Uint8Array(size * size);
            for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
                this.cells[y * size + x] = terrain(x, y) === 'grass' ? 1 : 0;
            for (const p of blockers) if (this.inside(p.x, p.y)) this.cells[p.y * size + p.x] = 0;
            this.routes = new Map();
        }
        inside(x, y) { return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.size && y < this.size; }
        pass(x, y) { return this.inside(x, y) && this.cells[y * this.size + x] === 1; }
        approach(target) { return DIRECTIONS.some(([dx, dy]) => this.pass(target.x + dx, target.y + dy)); }
        path(start, target, adjacent = false) {
            if (!target || !this.inside(target.x, target.y) || !this.inside(start.x, start.y)) return null;
            const key = `${start.x},${start.y}:${target.x},${target.y}:${adjacent ? 1 : 0}`;
            if (this.routes.has(key)) return this.clonePath(this.routes.get(key));
            const size = this.size, goals = new Set();
            if (!adjacent && this.pass(target.x, target.y)) goals.add(target.y * size + target.x);
            for (const [dx, dy] of DIRECTIONS) if (this.pass(target.x + dx, target.y + dy)) goals.add((target.y + dy) * size + target.x + dx);
            const prev = new Int16Array(size * size).fill(-2), queue = new Int16Array(size * size);
            const origin = start.y * size + start.x;
            let head = 0, tail = 1, end = -1;
            queue[0] = origin; prev[origin] = -1;
            while (head < tail) {
                const i = queue[head++];
                if (goals.has(i)) { end = i; break; }
                const x = i % size, y = Math.floor(i / size);
                for (const [dx, dy] of DIRECTIONS) {
                    const nx = x + dx, ny = y + dy, next = ny * size + nx;
                    if (this.pass(nx, ny) && prev[next] === -2) { prev[next] = i; queue[tail++] = next; }
                }
            }
            let path = null;
            if (end !== -1) {
                path = [];
                for (let i = end; prev[i] !== -1; i = prev[i]) path.push({x: i % size, y: Math.floor(i / size)});
                path.reverse();
            }
            if (this.routes.size >= 128) this.routes.delete(this.routes.keys().next().value);
            this.routes.set(key, path);
            return this.clonePath(path);
        }
        clonePath(path) { return path === null ? null : path.map(p => ({...p})); }
    }
    function grid(state) {
        if(state.estate && root.LWGeography) return root.LWGeography.grid(state);
        const blockers = [...state.nodes.filter(n => n.kind === 'wood' || n.kind === 'stone'), ...state.buildings];
        const signature = blockers.map(p => p.x + ',' + p.y).join(';');
        let entry = cache.get(state);
        if (!entry || entry.signature !== signature) {
            entry = {signature, grid: new Grid(root.LW.SIZE, root.LW.terrain, blockers)};
            cache.set(state, entry);
        }
        return entry.grid;
    }
    function path(state, target, adjacent = false) {
        const c = state.creature;
        return grid(state).path({x: Math.round(c.x), y: Math.round(c.y)}, target, adjacent);
    }
    root.LWNavigation = {Grid, grid, path};
    if (typeof module !== 'undefined' && module.exports) module.exports = root.LWNavigation;
})(typeof globalThis !== 'undefined' ? globalThis : this);
