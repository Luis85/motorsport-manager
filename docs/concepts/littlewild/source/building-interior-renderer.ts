/// <reference path="./building-interior-contracts.d.ts" />
/// <reference path="./canvas-ports.d.ts" />
/* Interior canvas consumes detached presentation data; drawing never advances the world. */
(function (inputRoot: unknown) {
    'use strict';
    type Point = { x: number; y: number };
    type Pair = readonly [number, number];
    interface Root {
        LWCanvasArt: LWCanvasPorts.Art;
        LWCanvasAssets?: {
            draw(c:CanvasRenderingContext2D,category:'building',id:string,x:number,y:number,tw:number,th:number,options:{model:string}):boolean;
            actor(c: CanvasRenderingContext2D, actor: { archetype?: string }, x: number, y: number, tw: number, th: number): boolean;
        };
        LWBuildingInteriorRenderer?: { create(canvas: HTMLCanvasElement): LWInterior.Renderer };
    }
    const root = inputRoot as Root;
    const poly:LWCanvasPorts.Art['poly']=(...args)=>root.LWCanvasArt.poly(...args);
    const rect:LWCanvasPorts.Art['rect']=(...args)=>root.LWCanvasArt.rect(...args);
    const diamond:LWCanvasPorts.Art['diamond']=(...args)=>root.LWCanvasArt.diamond(...args);
    const box:LWCanvasPorts.Art['box']=(...args)=>root.LWCanvasArt.box(...args);
    const pip:LWCanvasPorts.Art['pip']=(...args)=>root.LWCanvasArt.pip(...args);
    const tileWidth = 54, tileHeight = 27;
    const ink = '#31463d', paper = '#f6f5ee', muted = '#607353';
    function project(x: number, y: number): Point {
        return { x: (x - y) * tileWidth / 2, y: (x + y) * tileHeight / 2 };
    }
    function polygon(c: CanvasRenderingContext2D, points: readonly Point[], color: string) {
        poly(c, points.map(p => [p.x, p.y] as Pair), color);
    }
    function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, color = ink) {
        c.font = '12px ui-sans-serif, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = color;
        c.fillText(text, x, y);
    }
    function badge(c: CanvasRenderingContext2D, text: string, x: number, y: number) {
        c.font = '12px ui-sans-serif, sans-serif';
        const width = c.measureText(text).width + 18;
        rect(c, x - width / 2, y - 10, width, 20, '#fffef8');
        label(c, text, x, y);
    }
    function edgePoints(edge: LWInterior.Edge): [Point, Point] {
        const { x, y, side } = edge;
        if (side === 'n') return [project(x - .5, y - .5), project(x + .5, y - .5)];
        if (side === 's') return [project(x - .5, y + .5), project(x + .5, y + .5)];
        if (side === 'w') return [project(x - .5, y - .5), project(x - .5, y + .5)];
        return [project(x + .5, y - .5), project(x + .5, y + .5)];
    }
    function wall(c: CanvasRenderingContext2D, edge: LWInterior.Edge) {
        const [a, b] = edgePoints(edge), front = edge.side === 's' || edge.side === 'e';
        const height = front ? 16 : 64;
        const point = (fraction: number, rise: number): Point => ({ x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction - rise });
        const face = (from: number, to: number, bottom: number, top: number, color: string) => polygon(c, [point(from, bottom), point(to, bottom), point(to, top), point(from, top)], color);
        face(0, 1, -12, 0, '#896647');
        if (edge.kind === 'door') {
            face(0, .14, 0, height, '#8b9e82');
            face(.86, 1, 0, height, '#8b9e82');
            if (!front) face(0, 1, height - 7, height, '#8b9e82');
            face(.14, .86, 0, 3, '#d8b886');
        } else {
            face(0, 1, 0, height, edge.side === 'w' || edge.side === 'e' ? '#b6c8bb' : '#d4dfc7');
            face(0, 1, height - 4, height, '#91a589');
            if (edge.kind === 'window') {
                const bottom = front ? 3 : 20, top = front ? 13 : 49;
                face(.13, .87, bottom, top, '#789c90');
                face(.2, .8, bottom + 3, top - 3, '#e9d597');
                face(.47, .53, bottom, top, '#ac945f');
            }
        }
    }
    function room(c: CanvasRenderingContext2D, floor: LWInterior.Floor) {
        const cells = floor.cells || Array.from({ length: floor.width * floor.height }, (_, index) => ({ x: index % floor.width, y: Math.floor(index / floor.width) }));
        const present = new Set(cells.map(cell => `${cell.x},${cell.y}`));
        for (const cell of cells) {
            const p = project(cell.x, cell.y);
            diamond(c, p.x, p.y, tileWidth - 1, tileHeight - 1, (cell.x + cell.y) % 2 ? '#ddd1ad' : '#e6d9b6');
            rect(c, p.x - 5, p.y, 12, 1, '#c5b78f');
        }
        const sides: readonly { side: LWInterior.Edge['side']; dx: number; dy: number }[] = [{ side: 'n', dx: 0, dy: -1 }, { side: 'e', dx: 1, dy: 0 }, { side: 's', dx: 0, dy: 1 }, { side: 'w', dx: -1, dy: 0 }];
        const edges = floor.edges || cells.flatMap(cell => sides.filter(side => !present.has(`${cell.x + side.dx},${cell.y + side.dy}`)).map(side => ({ ...cell, side: side.side, kind: side.side === 'n' && cell.x % 3 === 1 ? 'window' as const : 'wall' as const })));
        for (const edge of [...edges].sort((a, b) => a.x + a.y - b.x - b.y)) wall(c, edge);
    }
    function fixture(c: CanvasRenderingContext2D, x: number, y: number, kind: string, time: number) {
        if (/bed|rest|sleep/.test(kind)) {
            box(c, x - 25, y, 50, 25, 8, '#b8d4a1', '#8a9f78', '#687e61');
            rect(c, x - 17, y - 18, 16, 9, '#fff0c7');
            rect(c, x - 22, y - 14, 4, 19, '#8c6b4a');
        } else if (/storage|shelf|warehouse|stock|input|output|crate/.test(kind)) {
            box(c, x - 25, y, 50, 23, 33, '#c5aa71', '#a28251', '#8d6f47');
            for (let row = 0; row < 2; row++) {
                rect(c, x - 21, y - 24 + row * 13, 40, 3, '#d4b985');
                for (let column = 0; column < 3; column++) rect(c, x - 18 + column * 12, y - 31 + row * 13, 9, 7, ['#819da0', '#b18c7b', '#b4b47c'][column]!);
            }
        } else if (/oven|kiln|smelt|furnace|bake|cook|hearth/.test(kind)) {
            box(c, x - 20, y, 40, 20, 30, '#b6c8bb', '#8b9a8f', '#647e73');
            rect(c, x - 10, y - 15, 20, 13, '#695f42');
            rect(c, x - 7, y - 11, 14, 7, '#c77560');
            rect(c, x - 3, y - 10, 5, 6, Math.sin(time * 5) > 0 ? '#f5c772' : '#ec9453');
        } else if (kind === 'planter') {
            box(c, x - 22, y, 44, 24, 9, '#a48753', '#ad8555', '#896647');
            diamond(c, x, y - 9, 38, 18, '#645e44');
            for (let i = 0; i < 3; i++) {
                rect(c, x - 13 + i * 12, y - 28 + i * 3, 3, 19, '#719963');
                rect(c, x - 16 + i * 12, y - 30 + i * 3, 9, 8, '#a5c78f');
            }
        } else if (/loom|weav/.test(kind)) {
            box(c, x - 23, y, 46, 23, 8);
            rect(c, x - 20, y - 42, 4, 41, '#aa8156');
            rect(c, x + 15, y - 35, 4, 40, '#947048');
            rect(c, x - 20, y - 43, 41, 4, '#c4a175');
            for (let i = 0; i < 9; i++) rect(c, x - 14 + i * 3, y - 38, 1, 26, '#ece0b8');
            rect(c, x - 14, y - 22, 28, 15, '#819da0');
        } else {
            box(c, x - 23, y, 46, 23, 16, '#d8b886', '#ad8555', '#896647');
            rect(c, x - 19, y - 5, 4, 15, '#7b6247');
            rect(c, x + 14, y - 4, 4, 15, '#775e45');
            if (/desk|study|read|train|research|deal|office/.test(kind)) {
                rect(c, x - 8, y - 23, 19, 9, '#f0dfae');
                rect(c, x + 1, y - 23, 1, 9, '#b7a177');
                rect(c, x + 13, y - 25, 4, 10, '#8fa9a0');
            } else {
                rect(c, x - 15, y - 22, 13, 4, '#9a7150');
                rect(c, x + 3, y - 29, 3, 10, '#7a826c');
                rect(c, x, y - 30, 10, 4, '#b9c0a6');
            }
        }
    }
    function entry(c: CanvasRenderingContext2D, point: Point, text: string) {
        const p = project(point.x, point.y);
        diamond(c, p.x, p.y, 44, 22, '#819e69');
        diamond(c, p.x, p.y, 34, 16, '#b8d4a1');
        if (text) label(c, text, p.x, p.y + 25, muted);
    }
    function staircase(c: CanvasRenderingContext2D, point: Point) {
        const p = project(point.x, point.y);
        for (let step = 0; step < 5; step++) box(c, p.x - 20 + step * 4, p.y - step * 7, 32, 13, 4 + step * 3, '#e6d9a6', '#b49d6d', '#8d6f47');
        label(c, 'Stairs', p.x, p.y + 25, muted);
    }
    class InteriorRenderer implements LWInterior.Renderer {
        private readonly c: CanvasRenderingContext2D;
        private readonly observer: ResizeObserver;
        private width = 0;
        private height = 0;
        private ratio = 1;
        private disposed = false;
        constructor(private readonly canvas: HTMLCanvasElement) {
            const context = canvas.getContext('2d', { alpha: false });
            if (!context) throw Error('Interior canvas rendering context is unavailable.');
            this.c = context;
            this.observer = new ResizeObserver(() => this.resize());
            this.observer.observe(canvas);
            this.resize();
        }
        resize() {
            if (this.disposed) return;
            const bounds = this.canvas.getBoundingClientRect();
            if (!bounds.width || !bounds.height) return;
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            if (this.width === bounds.width && this.height === bounds.height && this.ratio === ratio) return;
            this.width = bounds.width;
            this.height = bounds.height;
            this.ratio = ratio;
            this.canvas.width = Math.round(this.width * this.ratio);
            this.canvas.height = Math.round(this.height * this.ratio);
            this.c.imageSmoothingEnabled = false;
        }
        draw(snapshot: LWInterior.Snapshot, floorId: string, presentationTime: number) {
            if (this.disposed || !this.width || !this.height) return;
            const c = this.c, floor = snapshot.floors.find(f => f.id === floorId) || snapshot.floors[0];
            c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
            rect(c, 0, 0, this.width, this.height, paper);
            if (!floor) {
                label(c, 'This building has no accessible floor.', this.width / 2, this.height / 2, muted);
                return;
            }
            const roomWidth = (floor.width + floor.height) * tileWidth / 2;
            const roomHeight = (floor.width + floor.height) * tileHeight / 2 + 120;
            const scale = Math.min(1.8, (this.width - 36) / roomWidth, (this.height - 44) / roomHeight);
            const origin = { x: this.width / 2 - (floor.width - floor.height) * tileWidth / 4 * scale, y: this.height / 2 - (floor.width + floor.height - 2) * tileHeight / 4 * scale + 23 };
            const actors = snapshot.actors.filter(actor => actor.floorId === floor.id);
            c.save();
            c.translate(origin.x, origin.y);
            c.scale(scale, scale);
            room(c, floor);
            const entryStation = floor.stations.some(station => station.x === floor.door.x && station.y === floor.door.y);
            entry(c, floor.door, entryStation ? '' : floor.id === snapshot.floors[0]?.id ? 'Door to outside' : 'Landing');
            for (const stairs of floor.stairs) staircase(c, stairs);
            const objects: ({ depth: number; station: LWInterior.Station } | { depth: number; actor: LWInterior.ActorView })[] = [
                ...floor.stations.map(station => ({ depth: station.x + station.y, station })),
                ...actors.map(actor => ({ depth: actor.x + actor.y + .01, actor }))
            ];
            objects.sort((a, b) => a.depth - b.depth);
            for (const object of objects) {
                if ('station' in object) {
                    const p = project(object.station.x, object.station.y);
                    const authored=object.station.id===floor.stations[0]?.id&&snapshot.fixtureAsset&&root.LWCanvasAssets?.draw(c,'building',snapshot.fixtureAsset,p.x,p.y,tileWidth,tileHeight,{model:snapshot.fixtureModel});
                    if(!authored)fixture(c, p.x, p.y, object.station.kind, presentationTime);
                } else this.actor(object.actor, floor.stations.find(station => station.id === object.actor.stationId)?.kind, presentationTime);
            }
            c.restore();
            for (const station of floor.stations) {
                const p = project(station.x, station.y);
                const caption = station.label + (station.x === floor.door.x && station.y === floor.door.y ? ' · Entry' : '');
                label(c, caption, origin.x + p.x * scale, origin.y + (p.y + 25) * scale, muted);
            }
            for (const actor of actors) {
                const p = project(actor.x, actor.y), x = origin.x + p.x * scale, y = origin.y + p.y * scale;
                badge(c, actor.name, x, y - 55 * scale);
                if (actor.progress !== null) {
                    const width = 62, progress = Math.max(0, Math.min(1, actor.progress));
                    rect(c, x - width / 2, y - 44 * scale, width, 4, '#d4dfc7');
                    rect(c, x - width / 2, y - 44 * scale, width * progress, 4, '#426a54');
                }
                const seconds = actor.remainingSeconds === null ? '' : ` · ${Math.ceil(actor.remainingSeconds)}s`;
                label(c, actor.action + seconds, x, y + 41 * scale, muted);
            }
            if (!actors.length) label(c, 'No creatures on this floor right now.', this.width / 2, this.height - 18, muted);
        }
        private actor(actor: LWInterior.ActorView, stationKind: LWInterior.Station['kind'] | undefined, time: number) {
            const c = this.c, p = project(actor.x, actor.y);
            if (actor.transfer) {
                diamond(c, p.x, p.y, 44, 22, '#b78f4e');
                diamond(c, p.x, p.y, 38, 18, '#f0dfae');
            }
            const artwork = root.LWCanvasAssets?.actor(c, actor, p.x, p.y, 40, 20);
            const poses = { bed: 'rest', desk: 'train', planter: 'gather', workbench: 'craft', hearth: 'craft', storage: 'deposit' };
            const pose = actor.moving || !stationKind ? 'idle' : poses[stationKind];
            if (!artwork) pip(c, p.x, p.y, .92, time, actor.mood, actor.direction, pose, actor.moving, null);
            if (actor.cargo) {
                box(c, p.x + 10, p.y - 1, 15, 8, 12, '#c5aa71', '#a28251', '#8d6f47');
                rect(c, p.x + 15, p.y - 10, 3, 10, '#e9d69a');
            }
        }
        destroy() {
            this.disposed = true;
            this.observer.disconnect();
        }
    }
    root.LWBuildingInteriorRenderer = { create: canvas => new InteriorRenderer(canvas) };
})(window);
