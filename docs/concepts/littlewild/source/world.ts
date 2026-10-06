/* Isometric canvas view lifecycle, camera and input intent. Frame composition lives in canvas-scene. */
(function (inputRoot: unknown) {
    'use strict';
    const root = inputRoot as LWCanvasPorts.Root;
    const { SIZE, BUILDINGS, clamp } = root.LW;
    const { TW, TH, pip, tree, bush, stone, fiber, diamond, rect, poly } = root.LWCanvasArt;
    const { building } = root.LWCanvasBuildings;
    interface Handlers { pan?(): void; place?(kind: string, tile: LWCanvasPorts.Hit): void; inspect?(tile: LWCanvasPorts.Hit): void; }
    class World implements LWCanvasPorts.View {
        canvas: HTMLCanvasElement;
        c: CanvasRenderingContext2D;
        engine: LWCanvasPorts.Engine;
        handlers: Handlers;
        camera: LWCanvasPorts.Camera;
        hover: LWCanvasPorts.Hit | null;
        selected: unknown;
        placement: string | null;
        drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null;
        manual: boolean;
        showPath: boolean;
        time: number;
        bubble: LWCanvasPorts.Bubble | null;
        particles: LWCanvasPorts.Particle[];
        ground!: HTMLCanvasElement;
        decor!: LWCanvasPorts.Decoration[];
        effects: LWCanvasPorts.Effect[] = [];
        nameTargets: LWCanvasPorts.Target[] = [];
        landTargets: LWCanvasPorts.Target[] = [];
        resourceLens?: boolean;
        contextChoosing?: boolean;
        landSelected?: LWCanvasPorts.View['landSelected'];
        observer: ResizeObserver;
        inputController = new AbortController();
        suspended = false;
        disposed = false;
        terrainRevision?:number;
        terraformMode?:boolean;
        constructor(canvas: HTMLCanvasElement, engine: LWCanvasPorts.Engine, handlers: Handlers = {}) { this.canvas = canvas; const context = canvas.getContext('2d', { alpha: false }); if (!context) throw Error('Canvas rendering context is unavailable.'); this.c = context; this.engine = engine; this.handlers = handlers; this.camera = { z: 1, x: 0, y: 0 }; this.hover = null; this.selected = null; this.placement = null; this.drag = null; this.manual = false; this.showPath = true; this.time = 0; this.bubble = null; this.particles = []; this.makeGround(); this.bind(); this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); this.resize(); }
        makeGround() { Object.assign(this, root.LWCanvasGround.create(() => document.createElement('canvas'),this.engine));this.terrainRevision=this.engine.s.terraform?.revision??0; }
        resize() { const box = this.canvas.getBoundingClientRect(); if (!box.width || !box.height)
            return; this.canvas.width = Math.round(box.width); this.canvas.height = Math.round(box.height); this.c.imageSmoothingEnabled = false; if (!this.manual)
            this.home(); }
        home() { const w = this.canvas.width, h = this.canvas.height; this.camera.z = clamp(Math.min((w - 40) / (SIZE * TW + 20), (h - 92) / (SIZE * TH + 75)), .42, 1.8); this.camera.x = 0; this.camera.y = 18; this.manual = false;const camera=root.LWSceneEnvironment?.read()?.camera;if(camera){this.camera.z=clamp(this.camera.z*camera.zoom,.3,3);const p=this.toScreen(camera.center[0],camera.center[1]);this.camera.x+=w/2-p.x;this.camera.y+=h*.5-p.y;} }
        zoom(factor: number) { this.zoomAt(factor, this.canvas.width / 2, this.canvas.height / 2); }
        zoomAt(factor: number, x: number, y: number) {
            const before = this.transform(), px = (x - before.x) / before.z, py = (y - before.y) / before.z;
            this.camera.z = clamp(this.camera.z * factor, .38, 2.6);
            const after = this.transform();
            this.camera.x += x - (px * after.z + after.x);
            this.camera.y += y - (py * after.z + after.y);
            this.manual = true;
            this.limitCamera();
        }
        limitCamera() { this.camera.x = clamp(this.camera.x, -this.canvas.width * .85, this.canvas.width * .85); this.camera.y = clamp(this.camera.y, -this.canvas.height * .75, this.canvas.height * .75); }
        hitTest(x: number, y: number) {
            // Nameplates are explicit selectable targets, not only painted decoration.
            const present=(a:LWCanvasPorts.Actor)=>!a.activeQuest||!!root.LWSceneEnvironment?.onsite(this.engine.s,a);
            for(const target of (this.nameTargets||[]).slice().reverse())if(this.engine.creatures.some(a=>a.id===target.id&&present(a))&&x>=target.x&&x<=target.x+target.w&&y>=target.y&&y<=target.y+target.h){const a=this.engine.creatures.find(a=>a.id===target.id)!;return {x:Math.round(a.creature.x),y:Math.round(a.creature.y),objectType:'pip',actorId:a.id};}
            for(const t of (this.landTargets||[]).slice().reverse())if(x>=t.x&&x<=t.x+t.w&&y>=t.y&&y<=t.y+t.h){const n=this.engine.s.nodes.find(n=>n.id===t.id);if(n)return{x:n.x,y:n.y,objectType:n.kind,objectId:n.id};}
            const s = this.engine.s, objects: (LWCanvasPorts.Point & { kind: string; id?: string; actorId?: string })[] = [...s.nodes.filter(n => !s.buildings.some(b=>b.x===n.x&&b.y===n.y)), ...s.buildings, ...this.engine.allOrders().filter(o => o.type === 'build'), ...this.engine.creatures.filter(present).map(a=>({...a.creature,kind:'pip',actorId:a.id}))];
            objects.sort((a, b) => (b.x + b.y) - (a.x + a.y));
            for (const o of objects) {
                const p = this.toScreen(o.x, o.y), width = o.kind === 'pip' ? Math.max(22,22*this.camera.z) : (o.kind === 'wood' ? 24 : BUILDINGS[o.kind] ? 29 : 14) * this.camera.z, height = (o.kind === 'pip' ? 42 : o.kind === 'wood' ? 64 : BUILDINGS[o.kind] ? 55 : 20) * this.camera.z;
                if (x >= p.x - width && x <= p.x + width && y >= p.y - height && y <= p.y + 7 * this.camera.z)
                    return { x: Math.round(o.x), y: Math.round(o.y), objectType: o.kind, objectId:o.id||null, actorId:o.actorId||null };
            }
            return this.toTile(x, y);
        }
        project(x: number, y: number) { return { x: (x - y) * TW / 2, y: (x + y) * TH / 2-(this.engine.terrainHeight?.(x,y)??0)*12 }; }
        transform() { return { x: this.canvas.width / 2 + this.camera.x, y: this.canvas.height / 2 - (SIZE - 1) * TH / 2 * this.camera.z + this.camera.y, z: this.camera.z }; }
        toScreen(x: number, y: number) { const p = this.project(x, y), t = this.transform(); return { x: p.x * t.z + t.x, y: p.y * t.z + t.y }; }
        toTile(x: number, y: number) {
            const t = this.transform(), px = (x - t.x) / t.z, py = (y - t.y) / t.z;
            // Search the rendered ground diamonds using the same elevation projection as drawing.
            // The untouched map retains its original inverse and boundary rounding.
            if (this.engine.s.terraform) {
                let best: LWCanvasPorts.Point | null = null, distance = Infinity;
                for (let a = 0; a < SIZE; a++) for (let b = 0; b < SIZE; b++) {
                    const p = this.project(a, b), score = Math.abs(px - p.x) / (TW / 2) + Math.abs(py - p.y) / (TH / 2);
                    if (score <= 1 && score < distance) { best = { x: a, y: b }; distance = score; }
                }
                if (best) return best;
            }
            return { x: Math.round((py / (TH / 2) + px / (TW / 2)) / 2), y: Math.round((py / (TH / 2) - px / (TW / 2)) / 2) };
        }
        bind() {
            this.inputController = new AbortController();
            const el = this.canvas, pointers = new Map<number, LWCanvasPorts.Point>();
            let pinched = false, lastPinch: { distance: number; x: number; y: number } | null = null;
            const on = <K extends keyof HTMLElementEventMap>(name: K, handler: (event: HTMLElementEventMap[K]) => void, options: AddEventListenerOptions = {}) => el.addEventListener(name, handler, {...options, signal: this.inputController.signal});
            const local = (e: MouseEvent) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
            on('pointerdown', e => {
                if (e.button > 0)
                    return;
                el.focus({ preventScroll: true });
                el.setPointerCapture(e.pointerId);
                pointers.set(e.pointerId, local(e));
                if (pointers.size === 1) {
                    const p = local(e);
                    this.drag = { x: p.x, y: p.y, cx: this.camera.x, cy: this.camera.y, moved: false };
                    pinched = false;
                }
                else {
                    pinched = true;
                    this.drag = null;
                    const [a, b] = [...pointers.values()] as [LWCanvasPorts.Point, LWCanvasPorts.Point];
                    lastPinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                }
            });
            on('pointermove', e => {
                const p = local(e);
                this.hover = (this.placement||this.terraformMode) ? this.toTile(p.x, p.y) : this.hitTest(p.x, p.y);
                if (pointers.has(e.pointerId))
                    pointers.set(e.pointerId, p);
                if (pointers.size >= 2) {
                    this.handlers.pan?.();
                    const [a, b] = [...pointers.values()] as [LWCanvasPorts.Point, LWCanvasPorts.Point], next = { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                    if (lastPinch && lastPinch.distance > 0) {
                        this.zoomAt(next.distance / lastPinch.distance, lastPinch.x, lastPinch.y);
                        this.camera.x += next.x - lastPinch.x;
                        this.camera.y += next.y - lastPinch.y;
                        this.limitCamera();
                    }
                    lastPinch = next;
                    this.engine.s.settings.follow = false;
                    return;
                }
                if (this.drag) {
                    const dx = p.x - this.drag.x, dy = p.y - this.drag.y;
                    if (Math.hypot(dx, dy) > 5)
                        this.drag.moved = true;
                    if (this.drag.moved) {
                        this.camera.x = this.drag.cx + dx;
                        this.camera.y = this.drag.cy + dy;
                        this.manual = true;
                        this.handlers.pan?.();
                        this.engine.s.settings.follow = false;
                        this.limitCamera();
                    }
                }
            });
            const finish = (e: PointerEvent) => {
                if (e.type === 'pointerup' && this.drag && !this.drag.moved && !pinched) {
                    const p = local(e), tile = (this.placement||this.terraformMode) ? this.toTile(p.x, p.y) : this.hitTest(p.x, p.y);
                    if (this.placement)
                        this.handlers.place?.(this.placement, tile);
                    else
                        this.handlers.inspect?.(tile);
                }
                pointers.delete(e.pointerId);
                this.drag = null;
                lastPinch = null;
                if (pointers.size === 1) {
                    const p = [...pointers.values()][0]!;
                    this.drag = { x: p.x, y: p.y, cx: this.camera.x, cy: this.camera.y, moved: true };
                }
                if (!pointers.size)
                    pinched = false;
            };
            on('pointerup', finish);
            on('pointercancel', finish);
            on('lostpointercapture', e => { if (pointers.has(e.pointerId))
                finish(e); });
            on('pointerleave', () => { if (!pointers.size)
                this.hover = null; });
            on('wheel', e => { e.preventDefault(); this.handlers.pan?.(); const p = local(e); this.zoomAt(Math.exp(clamp(-e.deltaY * .0018, -.4, .4)), p.x, p.y); }, { passive: false });
            on('keydown', e => {
                if (e.ctrlKey || e.metaKey || e.altKey)
                    return;
                const directions: Record<string, LWCanvasPorts.Pair> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
                if (directions[e.key]) {
                    e.preventDefault();
                    e.stopPropagation();
                    const [dx, dy] = directions[e.key]!;
                    if (this.placement) {
                        const h = this.hover || { x: 8, y: 8 };
                        this.hover = { x: h.x + dx, y: h.y + dy };
                    }
                    else {
                        this.camera.x -= dx * 35;
                        this.camera.y -= dy * 35;
                        this.manual = true;
                        this.handlers.pan?.();
                        this.engine.s.settings.follow = false;
                        this.limitCamera();
                    }
                }
                else if (e.key === 'Enter' && this.placement) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handlers.place?.(this.placement, this.hover || { x: 8, y: 8 });
                }
                else if (e.key === '+' || e.key === '=') {
                    e.preventDefault();
                    this.zoom(1.15);
                }
                else if (e.key === '-') {
                    e.preventDefault();
                    this.zoom(1 / 1.15);
                }
                else if (e.key.toLowerCase() === 'h') {
                    e.preventDefault();
                    this.home();
                }
            });
        }
        suspend() { if (this.suspended) return; this.suspended = true; this.inputController.abort(); this.observer.disconnect(); this.drag = null; }
        resume() { if (!this.suspended) return; this.suspended = false; this.bind(); this.observer.observe(this.canvas); this.resize(); }
        dispose() { if (this.disposed) return; this.disposed = true; this.suspend(); this.particles = []; this.effects = []; }
        say(text: string,type='heart',actorId: string | null=null){const a=this.engine.creatures.find(a=>a.id===actorId)||this.engine.selected;if(!a||a.activeQuest)return;this.bubble={text,time:this.time+6,type,actorId:a.id};if(!this.engine.s.settings.reducedMotion)for(let i=0;i<7;i++)this.particles.push({x:a.creature.x,y:a.creature.y,off:(i-3)*7,t:0,delay:i*.1,type});}
        feedbackEvent(event: LWCanvasPorts.Feedback){const a=this.engine.creatures.find(a=>a.id===event.actorId);if(!a||a.activeQuest)return;this.effects??=[];this.effects.push({...event,x:event.x??a.creature.x,y:event.y??a.creature.y,expires:(this.time||0)+4.5,started:this.time||0});this.effects=this.effects.slice(-10);if(event.type==='social')this.say(event.success?'A little closer.':'Let’s give each other a moment.','heart',a.id);else if(event.type==='transfer')this.say(event.text!,'star',a.id);}
        draw(time: number, dt: number) { root.LWCanvasScene.draw.call(this, time, dt); }
    }
    root.LWArt = { World, pip, building, tree, bush, stone, fiber, diamond, rect, poly };
})(window);
