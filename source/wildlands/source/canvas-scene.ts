/* Ordered canvas frame composition; reads domain projections and mutates presentation state only. */
(function (inputRoot: unknown) {
    'use strict';
    const root = inputRoot as LWCanvasPorts.Root & {LWSceneProps?:{exterior(engine:unknown):LWSceneGraph.Prop[]}};
    const { terrain, clamp } = root.LW;
    const LW = root.LW, LWWorldContent = root.LWWorldContent;
    const { poly, rect, diamond, shadow, tree, bush, stone, fiber, pip, box } = root.LWCanvasArt;
    const { building } = root.LWCanvasBuildings;
    function draw(this: LWCanvasPorts.View, time: number, dt: number) {
            this.time = time;
            if((this.terrainRevision??0)!==(this.engine.s.terraform?.revision??0))this.makeGround();
            const c = this.c, w = this.canvas.width, h = this.canvas.height, s = this.engine.s, reduced = s.settings.reducedMotion, t = reduced ? 1 : time;
            const environment=root.LWSceneEnvironment?.read(),present=(actor:LWCanvasPorts.Actor)=>!actor.activeQuest||!!root.LWSceneEnvironment?.onsite(s,actor);
            if(environment||this.environmentKey){const key=root.LWSceneEnvironment?.key()||'';if(key!==this.environmentKey){this.makeGround();this.environmentKey=key;}}
            if(environment)root.LWSceneEnvironment!.backdropCanvas(c,w,h,environment);else{
            c.fillStyle = '#e3eadd';
            c.fillRect(0, 0, w, h);
            const grd = c.createRadialGradient(w * .5, h * .4, 10, w * .5, h * .5, Math.max(w, h) * .68);
            grd.addColorStop(0, '#eff1df');
            grd.addColorStop(1, '#dbe5d6');
            c.fillStyle = grd;
            c.fillRect(0, 0, w, h);
            // Low-contrast pixel clouds drift behind a floating woodland diorama.
            for (let i = 0; i < 6; i++) {
                let x = ((i * 231 + t * (i % 2 ? 1.5 : -1.5)) % (w + 180) + w + 180) % (w + 180) - 90, y = (i * 93 + 55) % Math.max(100, h - 80);
                c.globalAlpha = .19;
                rect(c, x, y, 90, 10, '#ffffff');
                rect(c, x + 20, y - 8, 50, 10, '#ffffff');
                rect(c, x + 33, y - 13, 25, 8, '#ffffff');
            }
            c.globalAlpha = 1;
            }
            if (this.engine.selected&&!this.engine.selected.activeQuest&&s.settings.follow && !this.contextChoosing && s.task?.phase === 'walk') {
                const p = this.project(s.creature.x, s.creature.y);
                this.camera.x += (clamp(-p.x * this.camera.z, -w * .2, w * .2) - this.camera.x) * .035;
            }
            const tr = this.transform();
            c.save();
            c.translate(Math.round(tr.x), Math.round(tr.y));
            c.scale(tr.z, tr.z);
            c.drawImage(this.ground, -this.ground.width / 2, -85);
            if(this.terraformPreview){
                c.save();c.globalAlpha=.65;
                for(const tile of this.terraformPreview.tiles){const p=this.project(tile.x,tile.y);p.y-=((tile.height??this.engine.terrainHeight?.(tile.x,tile.y)??0)-(this.engine.terrainHeight?.(tile.x,tile.y)??0))*12;diamond(c,p.x,p.y,root.LWCanvasArt.TW-3,root.LWCanvasArt.TH-2,tile.ground==='water'?'#8fbbb0':'#d8c596');}
                for(const plant of this.terraformPreview.plants){const p=this.project(plant.x,plant.y);root.LWCanvasAssets?.draw(c,'item',plant.kind,p.x,p.y,root.LWCanvasArt.TW,root.LWCanvasArt.TH,{model:plant.model});}
                c.restore();
            }
            if(!environment){
            // Pond light and lilies.
            for (let i = 0; i < 7; i++) {
                const p = this.project(13.5 + (i % 3) * .65, 3.8 + Math.floor(i / 3) * 1.15);
                c.globalAlpha = .45;
                rect(c, p.x + Math.sin(t + i) * 2, p.y, 7 + (i % 3) * 3, 1, '#e4eacf');
            }
            c.globalAlpha = 1;
            for (const d of this.decor) {
                let p = this.project(d.x, d.y);
                diamond(c, p.x + 4, p.y, 11, 5, '#83a87b');
                rect(c, p.x + 5, p.y - 3, 3, 3, '#ead7b3');
            }
            }
            if (this.engine.selected&&!this.engine.selected.activeQuest&&this.showPath && s.task?.phase === 'walk') {
                c.globalAlpha = .5;
                for (const p of s.task.path) {
                    let sp = this.project(p.x, p.y);
                    diamond(c, sp.x, sp.y, 5, 3, '#f5efcf');
                }
                c.globalAlpha = 1;
            }
            for(const prop of root.LWSceneProps?.exterior(this.engine)??[]){
                const point=this.project(prop.x,prop.y);
                root.LWCanvasAssets?.draw(c,prop.category,prop.assetId,point.x,point.y,root.LWCanvasArt.TW,root.LWCanvasArt.TH,{model:prop.model});
            }
            // Resource lenses follow authoritative tiles; the renderer never changes stock.
            for(const n of s.nodes){
                const nd=LWWorldContent.node(n.kind),p=this.project(n.x,n.y),wanted=LWWorldContent.building(this.placement)?.requiresNode;
                if(!nd)continue;const active=this.resourceLens&&(!wanted||n.kind===wanted),selected=this.landSelected?.type==='node'&&this.landSelected.id===n.id;
                if(active||selected){c.save();c.globalAlpha=.72;diamond(c,p.x,p.y,46,24,nd.mode==='finite'&&n.stock===0?'#c0a48b':wanted?'#f1da92':nd.direct?'#dfe0ab':'#9bbcaf');c.globalAlpha=1;c.strokeStyle=selected?'#f8edb7':'#5a8168';c.lineWidth=selected?2:1;c.beginPath();c.moveTo(p.x-23,p.y);c.lineTo(p.x,p.y-12);c.lineTo(p.x+23,p.y);c.lineTo(p.x,p.y+12);c.closePath();c.stroke();c.restore();}
            }
            if(this.landSelected?.type==='building'){const p=this.project(this.landSelected.x,this.landSelected.y);diamond(c,p.x,p.y,54,27,'#f0dda5');}
            // Plan footprints are world objects, not immediate resource purchases.
            for (const o of this.engine.allOrders().filter(o => o.type === 'build')) {
                const p = this.project(o.x, o.y);
                c.save();
                c.globalAlpha = o.paused ? .3 : .7;
                diamond(c, p.x, p.y, 44, 22, this.engine.orderIssue(o) ? '#dfbc8c' : '#b4c8b8');
                c.strokeStyle = '#f7f2d7';
                c.lineWidth = 1.5;
                c.setLineDash([3, 3]);
                c.beginPath();
                c.moveTo(p.x, p.y - 10);
                c.lineTo(p.x + 21, p.y);
                c.lineTo(p.x, p.y + 10);
                c.lineTo(p.x - 21, p.y);
                c.closePath();
                c.stroke();
                c.setLineDash([]);
                for (const [a, b] of [[-18, 0], [0, -9], [18, 0], [0, 9]] as const) {
                    rect(c, p.x + a - 1, p.y + b - 6, 2, 7, '#9e8155');
                    rect(c, p.x + a, p.y + b - 6, 5, 3, '#e9d590');
                }
                if (o.paid || o.stage>0) {
                    c.globalAlpha = .25 + .65 * this.engine.projectProgress(o);
                    if(environment)root.LWCanvasAssets?.draw(c,'building',o.kind,p.x,p.y,root.LWCanvasArt.TW,root.LWCanvasArt.TH);else building(c, p.x, p.y, o.kind, t);
                }
                c.restore();
            }
            if (this.placement && this.hover) {
                const p = this.project(this.hover.x, this.hover.y), ok = this.engine.canBuild(this.hover.x, this.hover.y,this.placement) && !this.engine.placementIssue(this.placement,this.hover.x,this.hover.y);
                if (terrain(this.hover.x, this.hover.y) !== 'void') {
                    c.globalAlpha = .6;
                    diamond(c, p.x, p.y, 46, 24, ok ? '#f5edb7' : '#d88b77');
                    c.globalAlpha = 1;
                    if(environment){c.save();c.globalAlpha=.45;root.LWCanvasAssets?.draw(c,'building',this.placement,p.x,p.y,root.LWCanvasArt.TW,root.LWCanvasArt.TH);c.restore();}else building(c, p.x, p.y, this.placement, t, true);
                }
            }
            const objects: LWCanvasPorts.SceneObject[] = s.nodes.filter(n => (environment||n.kind !== 'water')&&!s.buildings.some(b=>b.x===n.x&&b.y===n.y)).map(n => ({ ...n, obj: 'node' as const }));
            for (const b of s.buildings)
                objects.push({ ...b, obj: 'building' });
            for(const actor of this.engine.creatures.filter(present))objects.push({x:actor.creature.x,y:actor.creature.y,obj:'pip',actor});
            if(!environment)objects.push({ x: 7, y: 10, obj: 'basket' });
            if (!environment&&this.engine.has('market')) {
                const m = s.buildings.find(b => b.kind === 'market')!;
                objects.push({ x: m.x + .4, y: m.y + .9, obj: 'visitor' });
            }
            objects.sort((a, b) => (a.x + a.y) - (b.x + b.y));
            for (const o of objects) {
                const p = this.project(o.x, o.y);
                if (o.obj === 'node') {
                    c.save();if(LWWorldContent.node(o.kind)?.mode==='finite'&&o.stock===0)c.globalAlpha=.32;
                    if(s.terraform?.plants[o.id])root.LWCanvasAssets?.draw(c,'item',o.kind,p.x,p.y,root.LWCanvasArt.TW,root.LWCanvasArt.TH,{model:s.terraform.plants[o.id]!.model});
                    else if(environment)root.LWCanvasAssets?.draw(c,'item',o.kind,p.x,p.y,root.LWCanvasArt.TW,root.LWCanvasArt.TH,{model:LWWorldContent.node(o.kind)?.mode==='finite'&&o.stock===0?'depleted':'world'});
                    else if (o.kind === 'wood')
                        tree(c, p.x, p.y, Number(o.id.slice(1)), o.stock < 1);
                    else if (o.kind === 'berries')
                        bush(c, p.x, p.y, o.stock);
                    else if (o.kind === 'stone')
                        stone(c, p.x, p.y);
                    else if (o.kind === 'fiber')
                        fiber(c, p.x, p.y);
                    else if(o.kind==='clay') { diamond(c,p.x,p.y,30,17,'#bfa08a');rect(c,p.x-9,p.y-5,12,6,'#d3b299');rect(c,p.x+2,p.y-3,10,6,'#c29477'); }
                    else if(o.kind==='ore') { stone(c,p.x,p.y);rect(c,p.x-6,p.y-12,5,4,'#c68e69');rect(c,p.x+5,p.y-7,4,5,'#a9765f'); }
                    else if(o.kind==='herbs') { fiber(c,p.x,p.y);rect(c,p.x-4,p.y-16,4,4,'#9a9bb6');rect(c,p.x+5,p.y-11,4,4,'#b7a8bd'); }
                    else if(o.kind==='grain') { fiber(c,p.x,p.y);rect(c,p.x-4,p.y-16,4,7,'#dcc389');rect(c,p.x+3,p.y-14,4,6,'#e4cb8b'); }
                    else if(o.kind==='soil'){diamond(c,p.x,p.y,32,17,'#b1936e');for(let i=0;i<3;i++){rect(c,p.x-10+i*7,p.y-5+i*2,7,2,'#836d4f');rect(c,p.x-9+i*6,p.y-8+i*2,2,5,'#789257');rect(c,p.x-10+i*6,p.y-9+i*2,4,2,'#b1c875');}}
                    else if(o.kind==='groundwater'){diamond(c,p.x,p.y,29,16,'#719e97');diamond(c,p.x,p.y-2,21,11,'#b8d4c0');rect(c,p.x-7,p.y-3,11,2,'#649398');rect(c,p.x-3,p.y+1,9,2,'#83a9a2');rect(c,p.x-13,p.y,5,4,'#b7b493');}
                    else if(o.kind==='stream'){diamond(c,p.x,p.y,40,21,'#7ea69c');for(let i=0;i<3;i++){rect(c,p.x-11+i*9,p.y-4+i*3,7,2,'#d6e8ca');rect(c,p.x-7+i*9,p.y-3+i*3,3,2,'#d6e8ca');}}
                    else if (o.kind === 'hunt') {
                        rect(c, p.x - 1, p.y - 19, 3, 21, '#967850');
                        rect(c, p.x - 12, p.y - 27, 24, 11, '#baa170');
                        rect(c, p.x - 9, p.y - 24, 15, 2, '#7d7755');
                        rect(c, p.x + 3, p.y - 25, 5, 5, '#7d7755');
                    }
                    c.restore();
                }
                else if (o.obj === 'building') {
                    if(environment){const d=o.door||{dx:0,dy:1};root.LWCanvasAssets?.draw(c,'building',o.kind,p.x,p.y,root.LWCanvasArt.TW,root.LWCanvasArt.TH,{rotation:d.dx===1?Math.PI/2:d.dx===-1?-Math.PI/2:d.dy===-1?Math.PI:0});}else building(c, p.x, p.y, o.kind, t);
                    if(o.storage){const si=LW.WorldSystem.sum(o.storage.input),so=LW.WorldSystem.sum(o.storage.output);if(si){box(c,p.x-23,p.y+2,9,6,6,'#bba574','#998053','#83734c');rect(c,p.x-20,p.y-3,2,8,'#ddd0a0');}if(so){box(c,p.x+16,p.y+7,10,7,7,'#cbb68c','#a48f63','#8b7855');rect(c,p.x+19,p.y-2,4,2,'#f2dfa7');if(so>6)box(c,p.x+19,p.y,8,6,5,'#d0bc90','#ae9664','#907d54');}}
                    if(o.level>1){for(let i=0;i<o.level;i++)rect(c,p.x-6+i*5,p.y+12,3,3,'#ead4a1');}
                    const improvement=this.engine.allOrders().find(a=>a.type==='upgrade'&&a.kind===o.kind);
                    if(improvement){rect(c,p.x+22,p.y-12,2,16,'#a48759');poly(c,[[p.x+24,p.y-12],[p.x+34,p.y-8],[p.x+24,p.y-4]],'#d7bf7f');}
                }
                else if (o.obj === 'basket') {
                    box(c, p.x - 9, p.y, 15, 9, 8, '#c5a270', '#a08256', '#8c714f');
                    rect(c, p.x - 4, p.y - 12, 8, 3, '#936f49');
                    rect(c, p.x - 2, p.y - 9, 4, 3, '#c58471');
                }
                else if (o.obj === 'visitor') {
                    shadow(c, p.x, p.y, 7, 4);
                    rect(c, p.x - 5, p.y - 16, 10, 15, '#978fa0');
                    rect(c, p.x - 7, p.y - 27, 13, 13, '#ddc7a0');
                    rect(c, p.x - 9, p.y - 30, 19, 6, '#aa9365');
                    rect(c, p.x - 5, p.y - 34, 10, 6, '#b69f6b');
                    rect(c, p.x + 2, p.y - 23, 2, 2, '#5e6154');
                    rect(c, p.x + 3, p.y - 10, 8, 9, '#ae9162');
                }
                else if (o.obj === 'pip') {
                    const a=o.actor, s=a;
                    if (this.engine.selected?.id===a.id) {
                        c.globalAlpha = .6;
                        diamond(c, p.x, p.y, 35, 16, '#f5e7a8');
                        c.globalAlpha = 1;
                    }
                    if(!environment||!root.LWCanvasAssets?.actor(c,a,p.x,p.y,root.LWCanvasArt.TW,root.LWCanvasArt.TH))pip(c, p.x, p.y, 1.15, t, this.engine.mood(a), s.creature.dir, s.task?.phase === 'work' ? (s.task!.kind==='practice'?'train':s.task!.kind==='reflect'?'rest':s.task!.kind) : 'idle', !reduced && s.task?.phase === 'walk', a);
                    if((s.task&&['stockbuilding','deposit','emptybuilding'].includes(s.task.kind)||a.worldSupply||a.needsDeposit)&&Object.values(a.inventory).some(q=>q>0)){box(c,p.x+8,p.y-5,9,6,7,'#d2b581','#ac895b','#906f45');rect(c,p.x+10,p.y-11,2,8,'#ead49e');}
                    if (s.task?.kind === 'rest' && s.task.phase === 'work') {
                        c.fillStyle = '#456e60';
                        c.font = 'bold 10px monospace';
                        c.fillText('z', p.x + 14, p.y - 16 - (t * 6) % 18);
                        c.font = 'bold 8px monospace';
                        c.fillText('z', p.x + 23, p.y - 28 - (t * 4) % 12);
                    }
                }
            }
            // Tiny wildlife: butterflies, pond fish and drifting fireflies after dusk.
            for (let i = 0; i < 5; i++) {
                const a = 4 + i * 2.5 + Math.sin(t * .22 + i) * .7, b = 12 - i * 1.6 + Math.cos(t * .19 + i) * .6, p = this.project(a, b);
                rect(c, p.x - 3, p.y - 16, Math.sin(t * 8 + i) > 0 ? 3 : 1, 2, i % 2 ? '#e6c989' : '#d2dbb0');
                rect(c, p.x + 1, p.y - 17, 3, 2, i % 2 ? '#f1de9c' : '#b1caca');
            }
            c.restore();
            if (!environment&&(s.hour > 18 || s.hour < 6)) {
                const darkness = s.hour > 18 ? Math.min(.3, (s.hour - 18) * .055) : .3;
                c.fillStyle = `rgba(38,61,87,${darkness})`;
                c.fillRect(0, 0, w, h);
                // Pixel-art places stay crisp; warm local light makes the evening legible.
                for (const b of s.buildings.filter(b => ['fire', 'shelter', 'cottage', 'market'].includes(b.kind))) {
                    const p = this.toScreen(b.x, b.y), r = (b.kind === 'fire' ? 65 : 44) * tr.z;
                    const glow = c.createRadialGradient(p.x, p.y - 12 * tr.z, 0, p.x, p.y - 12 * tr.z, r);
                    glow.addColorStop(0, 'rgba(251,206,123,0.24)');
                    glow.addColorStop(1, 'rgba(251,206,123,0)');
                    c.fillStyle = glow;
                    c.fillRect(p.x - r, p.y - r, r * 2, r * 2);
                }
                for (let i = 0; i < 12; i++) {
                    const p = this.toScreen(3 + (i * 7) % 13 + Math.sin(t * .3 + i) * .3, 4 + (i * 11) % 12);
                    c.globalAlpha = .3 + (Math.sin(t * 2 + i) + 1) * .25;
                    rect(c, p.x, p.y - 9 * tr.z, 2, 2, '#f0e4b1');
                }
                c.globalAlpha = 1;
            }
            if (this.hover && !this.placement && terrain(this.hover.x, this.hover.y) === 'grass') {
                const hp = this.toScreen(this.hover.x, this.hover.y);
                c.strokeStyle = '#49654c';
                c.lineWidth = 1;
                c.globalAlpha = .7;
                c.beginPath();
                c.ellipse(hp.x, hp.y + 3 * tr.z, 18 * tr.z, 7 * tr.z, 0, 0, Math.PI * 2);
                c.stroke();
                c.globalAlpha = 1;
            }
            this.landTargets=[];
            if(this.resourceLens||this.landSelected){
                const wanted=LWWorldContent.building(this.placement)?.requiresNode;
                for(const n of s.nodes){if(s.buildings.some(b=>b.x===n.x&&b.y===n.y))continue;const d=LWWorldContent.node(n.kind);if(!d||wanted&&wanted!==n.kind)continue;
                    if(!this.resourceLens&&this.landSelected?.id!==n.id)continue;
                    const p=this.toScreen(n.x,n.y),label=d.mode==='finite'?String(n.stock):'∞',height=['wood','hunt'].includes(n.kind)?57:22,xx=p.x,yy=p.y-height*tr.z;
                    c.font='bold 11px system-ui';const ww=Math.max(24,c.measureText(label).width+13);if(xx<15||xx>w-15||yy<80||yy>h-100)continue;
                    c.fillStyle=d.mode==='finite'?'#f4e7cd':'#eaf0db';c.strokeStyle=d.mode==='finite'&&n.stock===0?'#a56c4c':'#7d9a68';c.lineWidth=1;c.beginPath();c.roundRect(xx-ww/2,yy-9,ww,20,5);c.fill();c.stroke();c.fillStyle='#3e573e';c.fillText(label,xx-c.measureText(label).width/2,yy+5);this.landTargets.push({id:n.id,x:xx-ww/2,y:yy-9,w:ww,h:20});
                }
                for(const b of s.buildings.filter(b=>b.storage)){const st=this.engine.buildingStatus(b);if(st.kind==='quiet')continue;const p=this.toScreen(b.x,b.y),label=st.kind==='blocked'?'!':st.kind==='working'?'…':st.kind==='paused'?'Ⅱ':st.kind==='supply'?'IN':'OUT';c.font='bold 9px Arial';c.fillStyle=st.kind==='blocked'?'#eee0c1':'#ecedcf';c.strokeStyle='#94a475';c.beginPath();c.roundRect(p.x+18*tr.z,p.y-52*tr.z,29,18,4);c.fill();c.stroke();c.fillStyle='#526344';c.fillText(label,p.x+22*tr.z,p.y-52*tr.z+12);}
            }
            // A small activity badge keeps Pip visible among the trees, without a dashboard over the world.
            this.nameTargets=[];
            for(const a of this.engine.creatures.filter(present).sort((a,b)=>(b.id===this.engine.selected?.id?1:0)-(a.id===this.engine.selected?.id?1:0))){
                if(this.contextChoosing&&a.id!==this.engine.selected?.id)continue;
                if(this.bubble?.actorId===a.id&&this.bubble.time>time)continue;
                const p = this.toScreen(a.creature.x, a.creature.y), task = a.task, role=root.LWSceneEnvironment?.role(s,a.id), caption = a.name + (role?' · '+role:'') + (a.activeQuest?' · '+(a.activeQuest.name||a.activeQuest.status||'Onsite work'):task?.phase === 'walk' ? ' · on my way' : task?.kind === 'rest' ? ' · resting' : task?.kind === 'build' ? ' · building' : task?.kind === 'gather' ? ' · gathering' : task&&['craft','gearcraft'].includes(task.kind) ? ' · making' : task?.kind==='produce'?' · tending':task?.kind==='stockbuilding'?' · stocking':task?.kind==='collectbuilding'||task?.kind==='emptybuilding'?' · collecting' : task&&['train','practice'].includes(task.kind) ? ' · learning' : task?.kind === 'shop' ? ' · shopping' : task?.kind==='social'?' · together':task?.kind==='calmdown'?' · taking space':task?.kind==='withdraw'?' · collecting':task?.kind==='deposit'?' · unloading':'');
                c.font = '600 11px system-ui';
                if(p.x<-30||p.x>w+30||p.y<0||p.y>h+50)continue;
                const bw = Math.min(190, c.measureText(caption).width + 20), xx = clamp(p.x - bw / 2, 8, w - bw - 8);
                let yy=clamp(p.y-42*tr.z-26,85,h-45);
                for(let tries=0;tries<6&&this.nameTargets.some(r=>xx<r.x+r.w+3&&xx+bw+3>r.x&&yy<r.y+r.h+3&&yy+28+3>r.y);tries++)yy-=31;
                if(yy<16)continue;
                if(Math.abs(yy-(p.y-42*tr.z-26))>12){c.strokeStyle='#81986c';c.lineWidth=1;c.beginPath();c.moveTo(p.x,p.y-22*tr.z);c.lineTo(xx+bw/2,yy+24);c.stroke();}
                this.nameTargets.push({id:a.id,x:xx,y:yy,w:bw,h:28});
                c.fillStyle = this.engine.selected?.id===a.id?'#355e45':'#fbf9ec';
                c.strokeStyle = this.engine.selected?.id===a.id?'#dfc385':'#a9ba98';
                c.lineWidth = 1;
                c.beginPath();
                c.roundRect(xx, yy, bw, 24, 7);
                c.fill();
                c.stroke();
                c.fillStyle = this.engine.selected?.id===a.id?'#faf3d5':'#415c49';
                c.fillText(caption, xx + 10, yy + 16);
                if (task?.phase === 'work' && task.kind !== 'idle') {
                    rect(c, xx + 8, yy + 24, bw - 16, 3, '#dbe2cb');
                    rect(c, xx + 8, yy + 24, (bw - 16) * Math.min(1, task.elapsed / task.duration), 3, '#809c62');
                }
            }
            this.effects=(this.effects||[]).filter(f=>f.expires>time);
            for(const f of this.effects){const a=this.engine.creatures.find(a=>a.id===f.actorId);if(!a||a.activeQuest)continue;const p=this.toScreen(a.creature.x,a.creature.y),age=time-f.started;const fade=reduced?1:Math.min(1,(f.expires-time)*2);c.globalAlpha=fade;
                c.strokeStyle=f.type==='transfer'?'#8f9b62':'#d3a777';c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y,28*tr.z,11*tr.z,0,0,Math.PI*2);c.stroke();
                if(f.type==='interaction'){const xx=p.x-31*tr.z,yy=p.y-36*tr.z;rect(c,xx,yy,15*tr.z,7*tr.z,'#e0bd94');rect(c,xx-5*tr.z,yy+4*tr.z,12*tr.z,7*tr.z,'#718d76');if(f.kind==='feed'){rect(c,xx+10*tr.z,yy-5*tr.z,8*tr.z,7*tr.z,'#c47e79');rect(c,xx+12*tr.z,yy-8*tr.z,3*tr.z,4*tr.z,'#859b63');}else if(f.kind==='water'){rect(c,xx+10*tr.z,yy-8*tr.z,8*tr.z,10*tr.z,'#82aaad');rect(c,xx+10*tr.z,yy-9*tr.z,8*tr.z,2*tr.z,'#d5e5df');}else{c.fillStyle='#c7887b';c.font='bold '+Math.round(20*tr.z)+'px sans-serif';c.fillText(f.kind==='space'?'…':'♥',p.x+20*tr.z,p.y-48*tr.z-(reduced?0:Math.sin(age*3)*4));}}
                if(['building-transfer','harvest','production'].includes(f.type)){const point=this.toScreen(f.x,f.y),label=(f.type==='building-transfer'?(f.direction==='in'?'IN ':'OUT '):'+')+f.amount+' '+(LW.colony.item(f.resource)?.name||'items');c.font='600 11px Arial';const bw=c.measureText(label).width+16,xx=clamp(point.x-bw/2,10,w-bw-10),yy=point.y-35*tr.z-(reduced?0:age*6);c.fillStyle='#faf5df';c.strokeStyle='#94a174';c.beginPath();c.roundRect(xx,yy,bw,24,6);c.fill();c.stroke();c.fillStyle='#416141';c.fillText(label,xx+8,yy+16);}
                if(f.type==='social'){const other=this.engine.creatures.find(a=>a.id===f.otherId&&!a.activeQuest);if(other){const op=this.toScreen(other.creature.x,other.creature.y);c.setLineDash([4,5]);c.strokeStyle='#c68b7f';c.beginPath();c.moveTo(p.x,p.y-17*tr.z);c.lineTo(op.x,op.y-17*tr.z);c.stroke();c.setLineDash([]);c.fillStyle='#c17e73';c.font='18px serif';c.fillText('♥',(p.x+op.x)/2,(p.y+op.y)/2-25*tr.z);}}
            }c.globalAlpha=1;
            this.particles = reduced ? [] : this.particles.filter(p => p.t < 2.2);
            for (const p of this.particles) {
                p.t += dt;
                if (p.t < p.delay)
                    continue;
                const sp = this.toScreen(p.x, p.y);
                c.globalAlpha = Math.max(0, 1 - (p.t - p.delay) / 2);
                c.fillStyle = p.type === 'heart' ? '#c77972' : '#d2ac56';
                c.font = 'bold 14px sans-serif';
                c.fillText(p.type === 'heart' ? '♥' : '✦', sp.x + p.off, sp.y - 40 - (p.t - p.delay) * 25);
            }
            c.globalAlpha = 1;
            const bubble = this.bubble;
            if (bubble && bubble.time > time && this.engine.creatures.some(a=>a.id===bubble.actorId&&!a.activeQuest)) {
                const a=this.engine.creatures.find(a=>a.id===bubble.actorId)!;
                const p = this.toScreen(a.creature.x, a.creature.y);
                c.font = '600 11px system-ui, sans-serif';
                const text = bubble.text.length > 49 ? bubble.text.slice(0, 47) + '…' : bubble.text, ww = c.measureText(text).width + 24, xx = clamp(p.x - ww / 2, 12, w - ww - 12), yy = Math.max(76, p.y - 75);
                c.fillStyle = '#faf7e9';
                c.strokeStyle = '#d8dec9';
                c.lineWidth = 1;
                c.beginPath();
                c.roundRect(xx, yy, ww, 30, 8);
                c.fill();
                c.stroke();
                poly(c, [[p.x - 4, yy + 29], [p.x + 4, yy + 29], [p.x, yy + 35]], '#faf7e9');
                c.fillStyle = '#496453';
                c.fillText(text, xx + 12, yy + 19);
            }
        }
    root.LWCanvasScene = { draw };
})(window);
