/* Sparse island topology. Geometry is deterministic and independent of simulation RNG.
 * Every purchase adds one lattice cell; no grid recentering or entity relocation is needed. */
(function(inputRoot: unknown) {
  'use strict';

  interface Point { x: number; y: number; }
  interface Island { ix: number; iy: number; }
  interface Node extends Point { kind: string; }
  interface GeneratedNode extends Node { id: string; stock: number; max: number; regen: number; }
  interface TopologyState {
    estate?: { islands: Island[] };
    nodes: Node[];
    buildings: Point[];
    terraform?: { revision:number;tiles:Record<string,{ground:'grass'|'water';height:number}> };
  }
  interface Profile {
    name: string;
    terrain: string[];
    biomeNames: Record<string, string>;
    resourceCounts: Record<string, number>;
    placementPolicy: string;
    fixedSites: Node[];
  }
  interface ProfilePort { current: Profile; defaults: Profile; hash: string; }
  interface NodeDefinitions { node(kind: string): { quantity: number } | null | undefined; }
  interface Bridge extends Island, Point { id: string; dx: number; dy: number; }
  interface IslandDescription { name: string; biome: string; }
  interface FrontierIsland extends Island, IslandDescription { id: string; }
  interface Root { LWWorldProfile: ProfilePort; LWGeography?: typeof api; LWConstructionFootprints?:{blockers(state:TopologyState):Point[]}; }
  const root = inputRoot as Root;
  if (typeof module !== 'undefined' && module.exports) require('./world-profile.js');

  const SIZE = 19, STRIDE = 23;
  const DIRS: ReadonlyArray<readonly [number, number]> = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const BRIDGE_DIRS: ReadonlyArray<readonly [number, number]> = [[1, 0], [0, 1]];
  const key = (x: number, y: number): string => x + ',' + y;
  const mod = (n: number, d: number): number => ((n % d) + d) % d;
  const islands = (state: TopologyState): Island[] => state.estate?.islands || [{ ix: 0, iy: 0 }];

  function cell(x: number, y: number): Island & Point {
    return { ix: Math.floor(x / STRIDE), iy: Math.floor(y / STRIDE), x: mod(x, STRIDE), y: mod(y, STRIDE) };
  }
  function islandTerrain(x: number, y: number): 'grass' | 'water' {
    return root.LWWorldProfile.current.terrain[y]?.[x] === '.' ? 'grass' : 'water';
  }
  function terrain(x: number, y: number): 'grass' | 'water' {
    const c = cell(x, y);
    return c.x < SIZE && c.y < SIZE ? islandTerrain(c.x, c.y) :
      ((c.y === 9 && c.x >= SIZE) || (c.x === 9 && c.y >= SIZE)) ? 'grass' : 'water';
  }
  function terrainAt(state:TopologyState,x:number,y:number):'grass'|'water' {
    return state.terraform?.tiles[key(x,y)]?.ground ?? terrain(x,y);
  }
  function heightAt(state:TopologyState,x:number,y:number):number {
    return state.terraform?.tiles[key(Math.round(x),Math.round(y))]?.height ?? 0;
  }
  function ownedTile(state:TopologyState,x:number,y:number):boolean {
    if(!Number.isInteger(x)||!Number.isInteger(y))return false;
    const c=cell(x,y);
    return c.x<SIZE&&c.y<SIZE&&islands(state).some(i=>i.ix===c.ix&&i.iy===c.iy);
  }
  function ownedSet(state: TopologyState): Set<string> {
    return new Set(islands(state).map(i => key(i.ix, i.iy)));
  }
  function available(state: TopologyState, x: number, y: number): boolean {
    if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
    const c = cell(x, y), own = ownedSet(state);
    if (c.x < SIZE && c.y < SIZE) return own.has(key(c.ix, c.iy)) && terrainAt(state,x,y) === 'grass';
    if (c.y === 9 && c.x >= SIZE) return own.has(key(c.ix, c.iy)) && own.has(key(c.ix + 1, c.iy));
    if (c.x === 9 && c.y >= SIZE) return own.has(key(c.ix, c.iy)) && own.has(key(c.ix, c.iy + 1));
    return false;
  }
  function bridges(state: TopologyState): Bridge[] {
    const own = ownedSet(state), out: Bridge[] = [];
    for (const i of islands(state)) for (const [dx, dy] of BRIDGE_DIRS) {
      if (!own.has(key(i.ix + dx, i.iy + dy))) continue;
      out.push({ id: key(i.ix, i.iy) + '>' + key(i.ix + dx, i.iy + dy), ix: i.ix, iy: i.iy, dx, dy,
        x: i.ix * STRIDE + (dx ? 20.5 : 9), y: i.iy * STRIDE + (dy ? 20.5 : 9) });
    }
    return out;
  }
  function frontier(state: TopologyState): FrontierIsland[] {
    const own = ownedSet(state), out = new Map<string, FrontierIsland>();
    for (const i of islands(state)) for (const [dx, dy] of DIRS) {
      const ix = i.ix + dx, iy = i.iy + dy, id = key(ix, iy);
      if (!own.has(id)) out.set(id, { ix, iy, id, ...describe(ix, iy) });
    }
    return [...out.values()].sort((a, b) => a.iy - b.iy || a.ix - b.ix);
  }
  function hash(x: number, y: number): number {
    let n = Math.imul(x + 513, 73856093) ^ Math.imul(y + 917, 19349663);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    return (n ^ (n >>> 16)) >>> 0;
  }
  function describe(ix: number, iy: number): IslandDescription {
    const biomes = ['Meadow', 'Pinewood', 'Amber grove', 'Stonegarden'] as const;
    const biome = ix === 0 && iy === 0 ? 'Meadow' : biomes[hash(ix, iy) % biomes.length]!;
    return { name: ix === 0 && iy === 0 ? root.LWWorldProfile.current.name :
      (root.LWWorldProfile.current.biomeNames[biome] || biome) + ' ' + (Math.abs(ix) + Math.abs(iy)) + ' · ' + key(ix, iy), biome };
  }
  function generatedNodes(ix: number, iy: number, W: NodeDefinitions): GeneratedNode[] {
    const out: GeneratedNode[] = [], used = new Set<string>();
    const reserved = new Set(root.LWWorldProfile.current.placementPolicy === 'reserved-sites' ?
      root.LWWorldProfile.current.fixedSites.map(s => key(s.x, s.y)) : []);
    let sequence = 0, seed = hash(ix, iy);
    const rand = (): number => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
    function add(kind: string, x: number, y: number): void {
      const p = W.node(kind);
      if (!p || used.has(key(x, y)) || islandTerrain(x, y) !== 'grass') return;
      used.add(key(x, y));
      out.push({ id: 'island:' + key(ix, iy) + ':' + sequence++, kind, x: ix * STRIDE + x,
        y: iy * STRIDE + y, stock: p.quantity, max: p.quantity, regen: 0 });
    }
    // Default definition order is authoritative, independent of imported object key order.
    for (const kind of Object.keys(root.LWWorldProfile.defaults.resourceCounts)) {
      const count = root.LWWorldProfile.current.resourceCounts[kind] ?? 0;
      for (let n = 0; n < count; n++) for (let t = 0; t < 100; t++) {
        const x = 2 + Math.floor(rand() * 15), y = 2 + Math.floor(rand() * 15);
        if ((x >= 6 && x <= 11 && y >= 6 && y <= 11) || x === 9 || y === 9 || used.has(key(x, y)) || reserved.has(key(x, y))) continue;
        const before = out.length;
        add(kind, x, y);
        if (out.length > before) break;
      }
    }
    for (const site of root.LWWorldProfile.current.fixedSites) add(site.kind, site.x, site.y);
    // Remove only newly generated blockers that isolate a grass pocket. This is generation,
    // never a runtime resource deletion; results are deterministic for the island coordinate.
    for (let pass = 0; pass < (reserved.size ? 100 : 30); pass++) {
      const state: TopologyState = { estate: { islands: [{ ix, iy }] }, nodes: out, buildings: [] };
      const g = new Grid(state), seen = g.flood({ x: ix * STRIDE + 9, y: iy * STRIDE + 9 });
      if (seen.size === g.cells.size) break;
      const disconnected = [...g.cells].filter(k => !seen.has(k));
      const remove = out.findIndex(n => ['wood', 'stone'].includes(n.kind) &&
        !reserved.has(key(n.x - ix * STRIDE, n.y - iy * STRIDE)) && disconnected.some(k => {
          const [x, y] = coordinates(k);
          return Math.abs(x - n.x) + Math.abs(y - n.y) === 1;
        }));
      if (remove < 0) break;
      out.splice(remove, 1);
    }
    return out;
  }
  function coordinates(value: string): readonly [number, number] {
    const [x, y] = value.split(',').map(Number);
    return [x!, y!]; // Only keys produced by key() enter path/flood records.
  }
  class Grid {
    readonly cells = new Set<string>();
    readonly routes = new Map<string, Point[] | null>();
    readonly heights = new Map<string,number>();
    constructor(state: TopologyState, extra: Point[] = []) {
      for (const i of islands(state)) for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const wx=x+i.ix*STRIDE,wy=y+i.iy*STRIDE;
        if (terrainAt(state,wx,wy) === 'grass') this.cells.add(key(wx,wy));
        this.heights.set(key(wx,wy),heightAt(state,wx,wy));
      }
      for (const b of bridges(state)) for (let n = SIZE; n < STRIDE; n++) {
        this.cells.add(key(b.ix * STRIDE + (b.dx ? n : 9), b.iy * STRIDE + (b.dy ? n : 9)));
      }
      const places=root.LWConstructionFootprints?.blockers(state)??state.buildings;
      for (const p of [...state.nodes.filter(n => ['wood', 'stone'].includes(n.kind)), ...places, ...extra]) {
        this.cells.delete(key(p.x, p.y));
      }
    }
    pass(x: number, y: number): boolean { return this.cells.has(key(x, y)); }
    canStep(from:Point,to:Point):boolean {
      return this.pass(to.x,to.y)&&Math.abs(from.x-to.x)+Math.abs(from.y-to.y)===1&&
        Math.abs((this.heights.get(key(from.x,from.y))??0)-(this.heights.get(key(to.x,to.y))??0))<=1;
    }
    inside(x: number, y: number): boolean {
      return Number.isInteger(x) && Number.isInteger(y) && Math.abs(x) < 100000 && Math.abs(y) < 100000;
    }
    approach(p: Point): boolean { return DIRS.some(([dx, dy]) => this.pass(p.x + dx, p.y + dy)); }
    flood(start: Point): Set<string> {
      const seen = new Set<string>(), q: Point[] = [];
      if (this.pass(start.x, start.y)) { seen.add(key(start.x, start.y)); q.push(start); }
      else for (const [dx, dy] of DIRS) if (this.pass(start.x + dx, start.y + dy)) {
        const p = { x: start.x + dx, y: start.y + dy };
        seen.add(key(p.x, p.y)); q.push(p); break;
      }
      for (let h = 0; h < q.length; h++) {
        const p = q[h]!;
        for (const [dx, dy] of DIRS) {
          const x = p.x + dx, y = p.y + dy, k = key(x, y);
          if (this.canStep(p,{x,y}) && !seen.has(k)) { seen.add(k); q.push({ x, y }); }
        }
      }
      return seen;
    }
    path(start: Point, target: Point | null | undefined, adjacent = false): Point[] | null {
      if (!target || !this.inside(start.x, start.y) || !this.inside(target.x, target.y)) return null;
      const id = key(start.x, start.y) + ':' + key(target.x, target.y) + ':' + adjacent;
      if (this.routes.has(id)) return this.routes.get(id)?.map(p => ({ ...p })) ?? null;
      const goals = new Set<string>();
      if (!adjacent && this.pass(target.x, target.y)) goals.add(key(target.x, target.y));
      if (adjacent || !goals.size) for (const [dx, dy] of DIRS) {
        if (this.pass(target.x + dx, target.y + dy)) goals.add(key(target.x + dx, target.y + dy));
      }
      if (!goals.size) return null;
      const q: Point[] = [start], prev = new Map<string, string | null>([[key(start.x, start.y), null]]);
      let end: string | null = null;
      for (let h = 0; h < q.length; h++) {
        const p = q[h]!, k = key(p.x, p.y);
        if (goals.has(k)) { end = k; break; }
        for (const [dx, dy] of DIRS) {
          const x = p.x + dx, y = p.y + dy, n = key(x, y);
          if (this.canStep(p,{x,y}) && !prev.has(n)) { prev.set(n, k); q.push({ x, y }); }
        }
      }
      let route: Point[] | null = null;
      if (end !== null) {
        route = [];
        for (let k = end; prev.get(k) !== null; k = prev.get(k)!) {
          const [x, y] = coordinates(k);
          route.push({ x, y });
        }
        route.reverse();
      }
      if (this.routes.size >= 192) this.routes.delete(this.routes.keys().next().value!);
      this.routes.set(id, route);
      return route?.map(p => ({ ...p })) ?? null;
    }
  }
  const cache = new WeakMap<TopologyState, { sig: string; value: Grid }>();
  function grid(state: TopologyState): Grid {
    const sig = root.LWWorldProfile.hash + '|' + (state.estate?.islands || []).map(i => key(i.ix, i.iy)).join(';') +
      '|' + (root.LWConstructionFootprints?.blockers(state)??state.buildings).map(b => key(b.x, b.y)).join(';') + '|' + (state.terraform?.revision??0) + '|' +
      state.nodes.filter(n => ['wood', 'stone'].includes(n.kind)).map(n => key(n.x, n.y)).join(';');
    let v = cache.get(state);
    if (!v || v.sig !== sig) { v = { sig, value: new Grid(state) }; cache.set(state, v); }
    return v.value;
  }
  const api = { SIZE, STRIDE, DIRS, key, cell, terrain, terrainAt, heightAt, ownedTile, islandTerrain, available, bridges,
    frontier, describe, hash, generatedNodes, Grid, grid };
  root.LWGeography = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
