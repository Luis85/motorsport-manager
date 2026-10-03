/* Pixel-art primitives, natural props and actor glyphs. Geometry only; no simulation mutation. */
(function (inputRoot: unknown) {
    'use strict';
    const root = inputRoot as LWCanvasPorts.Root;
    const TW = 44, TH = 22;
    function poly(c: CanvasRenderingContext2D, p: readonly LWCanvasPorts.Pair[], color: string) { c.fillStyle = color; c.beginPath(); p.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); }
    function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
    function diamond(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) { poly(c, [[x, y - h / 2], [x + w / 2, y], [x, y + h / 2], [x - w / 2, y]], color); }
    function shadow(c: CanvasRenderingContext2D, x: number, y: number, w = 15, h = 6) { c.save(); c.globalAlpha = .13; diamond(c, x + 4, y + 2, w * 2, h * 2, '#304e3d'); c.restore(); }
    function tree(c: CanvasRenderingContext2D, x: number, y: number, v = 0, empty = false) {
        shadow(c, x, y, 22, 9);
        rect(c, x - 3, y - 23, 7, 25, '#755b42');
        rect(c, x + 2, y - 21, 3, 21, '#92714c');
        rect(c, x - 7, y - 3, 6, 4, '#6d6546');
        rect(c, x + 4, y - 3, 5, 4, '#6d6546');
        if (v % 3 === 1) {
            const dark = empty ? '#638c65' : '#477d5d', mid = empty ? '#7c9d64' : '#60946a', hi = '#91b87a';
            poly(c, [[x, y - 66], [x + 6, y - 54], [x + 4, y - 54], [x + 14, y - 36], [x + 10, y - 36], [x + 23, y - 14], [x + 13, y - 14], [x + 13, y - 9], [x - 15, y - 9], [x - 15, y - 14], [x - 24, y - 14], [x - 11, y - 36], [x - 16, y - 36], [x - 5, y - 54], [x - 7, y - 54]], dark);
            poly(c, [[x - 2, y - 61], [x + 3, y - 52], [x, y - 52], [x + 10, y - 34], [x + 5, y - 34], [x + 16, y - 16], [x - 1, y - 12], [x - 19, y - 16], [x - 10, y - 29], [x - 6, y - 29], [x - 2, y - 40], [x - 7, y - 40]], mid);
            rect(c, x - 3, y - 48, 4, 5, hi);
            rect(c, x - 10, y - 29, 6, 4, hi);
            rect(c, x - 13, y - 20, 4, 3, hi);
            rect(c, x + 4, y - 20, 6, 3, '#759f6a');
        }
        else {
            const autumn = v % 4 === 2;
            const dark = autumn ? '#718550' : '#4e8362', mid = autumn ? '#95aa68' : '#74a773', hi = autumn ? '#bac17a' : '#9bc889';
            poly(c, [[x - 17, y - 20], [x - 24, y - 26], [x - 24, y - 42], [x - 18, y - 42], [x - 18, y - 52], [x - 9, y - 52], [x - 9, y - 59], [x + 7, y - 59], [x + 7, y - 54], [x + 19, y - 54], [x + 19, y - 45], [x + 26, y - 45], [x + 26, y - 30], [x + 20, y - 30], [x + 20, y - 21], [x + 10, y - 21], [x + 10, y - 16], [x - 7, y - 16], [x - 7, y - 20]], dark);
            poly(c, [[x - 21, y - 31], [x - 21, y - 40], [x - 15, y - 40], [x - 15, y - 49], [x - 6, y - 49], [x - 6, y - 55], [x + 5, y - 55], [x + 5, y - 49], [x + 16, y - 49], [x + 16, y - 41], [x + 21, y - 41], [x + 21, y - 31], [x + 12, y - 31], [x + 12, y - 25], [x - 3, y - 25], [x - 3, y - 29], [x - 13, y - 29], [x - 13, y - 31]], mid);
            rect(c, x - 12, y - 44, 9, 5, hi);
            rect(c, x - 6, y - 50, 7, 5, hi);
            rect(c, x + 7, y - 39, 7, 5, hi);
            rect(c, x - 16, y - 33, 6, 4, hi);
            rect(c, x + 2, y - 31, 5, 3, hi);
            rect(c, x + 11, y - 24, 5, 4, mid);
        }
    }
    function bush(c: CanvasRenderingContext2D, x: number, y: number, stock = 6) { shadow(c, x, y, 12, 5); poly(c, [[x - 14, y - 3], [x - 14, y - 10], [x - 9, y - 10], [x - 9, y - 16], [x - 2, y - 16], [x - 2, y - 19], [x + 7, y - 19], [x + 7, y - 13], [x + 13, y - 13], [x + 13, y - 3], [x + 7, y + 1], [x - 7, y + 1]], '#4e8562'); rect(c, x - 10, y - 11, 8, 7, '#7ca16a'); rect(c, x - 3, y - 17, 8, 9, '#87b877'); rect(c, x + 5, y - 9, 7, 6, '#719963'); if (stock > 0) {
        ([[-8, -8], [3, -13], [7, -5], [-3, -3]] as const).slice(0, Math.min(stock, 4)).forEach(([a, b]) => { rect(c, x + a, y + b, 4, 4, '#b45f69'); rect(c, x + a, y + b, 2, 2, '#f0adb0'); });
    } }
    function stone(c: CanvasRenderingContext2D, x: number, y: number) { shadow(c, x, y, 15, 6); poly(c, [[x - 16, y - 2], [x - 14, y - 12], [x - 4, y - 19], [x + 7, y - 17], [x + 15, y - 7], [x + 13, y + 1], [x + 2, y + 6]], '#7b9391'); poly(c, [[x - 14, y - 12], [x - 4, y - 19], [x + 7, y - 17], [x + 4, y - 7], [x - 5, y - 4]], '#b6c8bb'); poly(c, [[x + 4, y - 7], [x + 7, y - 17], [x + 15, y - 7], [x + 13, y + 1], [x + 2, y + 6]], '#93a9a0'); rect(c, x - 3, y - 15, 6, 3, '#d0d5bd'); rect(c, x - 18, y + 2, 5, 4, '#a6b8a6'); }
    function fiber(c: CanvasRenderingContext2D, x: number, y: number) { shadow(c, x, y, 9, 4); ([[0, 0], [-6, 1], [5, 2], [-2, -3]] as const).forEach(([a, b], i) => { rect(c, x + a, y + b - 11, 2, 13, '#7e9560'); rect(c, x + a - 3, y + b - 15, 3, 5, i % 2 ? '#c8c485' : '#dbd499'); rect(c, x + a + 2, y + b - 9, 4, 2, '#a9b679'); }); }
    function pip(c: CanvasRenderingContext2D, x: number, y: number, scale = 1, frame = 0, mood = 'Content', dir = 1, kind = 'idle', moving = false, actor: LWCanvasPorts.Actor | null = null) {
        const profile=actor&&root.LW.colony?root.LW.colony.profile(actor.personality):null;
        const coat=profile?.color||'#b8d4a1', accent=profile?.accent||'#5e9676';
        c.save();
        c.translate(Math.round(x), Math.round(y));
        c.scale(scale, scale);
        let walk = moving ? Math.sin(frame * 11) : 0, bob = moving ? Math.abs(walk) * 2 : Math.sin(frame * 2) * .4;
        shadow(c, 0, 0, 12, 4);
        c.translate(0, -bob);
        let sleepy = kind === 'rest';
        if (sleepy) {
            rect(c, -12, -13, 25, 12, '#437965');
            rect(c, -14, -12, 26, 10, '#b5d4a3');
            rect(c, -8, -17, 16, 10, '#d4e4b9');
            rect(c, 4, -10, 4, 2, '#385d50');
            rect(c, -1, -9, 3, 2, '#385d50');
            rect(c, 9, -17, 4, 5, '#83ab81');
            rect(c, -9, 0, 21, 2, '#456f57');
            c.restore();
            return;
        }
        // Tail, satchel, paws, body, distinct long sprout ears.
        rect(c, -15 * dir, -13, 7 * dir, 9, '#61947b');
        rect(c, -17 * dir, -12, 4 * dir, 5, '#8fbe96');
        rect(c, -10, -3 + Math.max(0, walk) * 2, 7, 5, '#467961');
        rect(c, 4, -3 + Math.max(0, -walk) * 2, 7, 5, '#467961');
        rect(c, -12, -20, 25, 17, '#4e856b');
        rect(c, -10, -22, 21, 21, coat);
        rect(c, -7, -16, 14, 14, '#d2dfab');
        rect(c, 10, -17, 5, 11, '#b28553');
        rect(c, 11, -16, 5, 6, '#d9b777');
        rect(c, -11, -18, 3, 9, '#72a780');
        rect(c, -9, -37, 6, 14, '#5f9475');
        rect(c, -8, -38, 4, 11, '#a5c78f');
        rect(c, -7, -34, 2, 6, '#d6d9a2');
        rect(c, 5, -36, 6, 12, '#5f9475');
        rect(c, 6, -37, 4, 10, '#b1d199');
        rect(c, 7, -33, 2, 5, '#e2dba8');
        rect(c, -14, -27, 28, 12, accent);
        rect(c, -11, -30, 22, 17, coat);
        rect(c, -14, -25, 27, 9, coat);
        rect(c, -8, -29, 14, 4, '#d2e1ad');
        let blink = Math.floor(frame * 1.2) % 7 === 0 && frame % 1 < .14;
        rect(c, -7 + (dir < 0 ? -1 : 0), -23, 3, blink ? 1 : 4, '#304f45');
        rect(c, 4 + (dir < 0 ? -1 : 0), -23, 3, blink ? 1 : 4, '#304f45');
        if (!blink) {
            rect(c, -6 + (dir < 0 ? -1 : 0), -23, 1, 1, '#faf5d2');
            rect(c, 5 + (dir < 0 ? -1 : 0), -23, 1, 1, '#faf5d2');
        }
        rect(c, -11, -19, 4, 2, '#d5ad91');
        rect(c, 8, -19, 4, 2, '#d5ad91');
        rect(c, -1, -18, 3, 2, '#62856a');
        rect(c, 0, -16, 2, 1, '#62856a');
        if (kind === 'gather' && Math.sin(frame * 8) > .1) {
            rect(c, 12, -16, 9, 3, '#8d6947');
            rect(c, 18, -23, 4, 9, '#c3c6aa');
        }
        if (['build', 'craft'].includes(kind)) {
            const swing = Math.sin(frame * 7) > 0 ? 4 : 0;
            rect(c, 10, -15 - swing, 9, 3, '#866447');
            rect(c, 17, -21 - swing, 5, 8, '#b8c4b1');
            rect(c, -14, -12, 7, 4, '#b6d1a0');
        }
        if (kind === 'eat') {
            rect(c, -7, -11, 14, 5, '#c5ac7c');
            rect(c, -2, -15, 5, 5, '#ba6e79');
            rect(c, -2, -15, 2, 2, '#ead0aa');
        }
        if (kind === 'drink') {
            rect(c, 8, -17, 7, 9, '#709c9c');
            rect(c, 8, -18, 8, 3, '#cad8c3');
        }
        if (kind === 'shop') {
            rect(c, 11, -10, 10, 10, '#c2a16b');
            rect(c, 13, -13, 6, 3, '#917648');
        }
        if (kind === 'train') {
            rect(c, -9, -9, 17, 9, '#866f51');
            rect(c, -7, -10, 6, 8, '#f0dfa4');
            rect(c, 0, -10, 6, 8, '#e4d19c');
            rect(c, -1, -10, 1, 10, '#b59b6c');
        }
        if(actor){
            const gear=(slot: string)=>root.LW.colony.definition(actor.equipment[slot]);
            const body=gear('body'),head=gear('head'),feet=gear('feet'),back=gear('back'),tool=gear('tool'),charm=gear('charm');
            if(back){rect(c,-16,-18,7,16,back.color);rect(c,-15,-16,5,8,'#dec493');rect(c,-12,-20,3,8,'#90744e');}
            if(body){rect(c,-10,-15,20,13,body.color);rect(c,-1,-15,2,13,'#dfc89a');rect(c,-7,-5,4,3,'#eee0b8');if(body.visual==='cape'){rect(c,-14,-18,5,17,body.color);rect(c,10,-18,5,17,body.color);}}
            if(feet){rect(c,-11,-2+Math.max(0,walk)*2,9,5,feet.color);rect(c,3,-2+Math.max(0,-walk)*2,9,5,feet.color);rect(c,-10,1+Math.max(0,walk)*2,7,2,'#6b5a43');rect(c,4,1+Math.max(0,-walk)*2,7,2,'#6b5a43');}
            if(head){rect(c,-13,-32,26,4,head.color);rect(c,-8,-37,17,6,head.color);rect(c,-10,-31,22,2,'#d9c494');if(head.visual==='wizard'){rect(c,-5,-43,11,8,head.color);rect(c,-1,-48,5,7,head.color);rect(c,1,-39,2,2,'#f2d37f');}}
            if(charm){rect(c,-4,-14,9,1,'#b99961');rect(c,0,-13,3,4,charm.color);rect(c,1,-12,1,1,'#fff0a9');}
            if(tool){const swing=['gather','craft','build','gearcraft'].includes(kind)?Math.round(Math.sin(frame*7)*3):0;
                if(tool.visual==='staff'){rect(c,15,-30+swing,3,34,tool.color);rect(c,13,-32+swing,5,4,'#cbb58c');}
                else if(tool.visual==='lantern'){rect(c,15,-22,7,2,'#7e6a42');rect(c,14,-19,9,11,tool.color);rect(c,16,-17,5,7,'#f4dc91');rect(c,14,-9,9,2,'#7f6a43');}
                else{rect(c,14,-19+swing,3,22,'#987548');rect(c,12,-23+swing,10,8,tool.color);rect(c,12,-24+swing,10,2,'#dbe1c8');}
            }
            if(mood==='Angry'||mood==='Frustrated'){rect(c,-8,-25,5,2,'#704e3d');rect(c,-6,-24,4,1,'#704e3d');rect(c,3,-25,5,2,'#704e3d');rect(c,2,-24,4,1,'#704e3d');rect(c,-2,-16,6,1,'#80583f');}
            if(mood==='Delighted'){rect(c,-6,-21,3,2,coat);rect(c,4,-21,3,2,coat);rect(c,-2,-16,6,2,'#92644c');}
            if(kind==='calmdown'){rect(c,-7,-23,3,4,coat);rect(c,4,-23,3,4,coat);rect(c,-8,-21,5,1,'#4b6044');rect(c,3,-21,5,1,'#4b6044');}
            if(['social','socialwait'].includes(kind)){rect(c,-17,-18-Math.round(Math.sin(frame*5)*2),6,4,coat);rect(c,12,-18,6,4,coat);}
            if(['withdraw','deposit','salvage'].includes(kind)){rect(c,-9,-11,19,13,'#a18051');rect(c,-9,-11,19,3,'#c5a56d');rect(c,-2,-10,3,12,'#725e41');}
        }
        c.restore();
    }
    function box(c: CanvasRenderingContext2D, x: number, y: number, w = 30, h = 16, d = 18, top = '#b9945c', front = '#a47a4c', side = '#84623f') { poly(c, [[x, y - d], [x + w / 2, y - d - h / 2], [x + w, y - d], [x + w / 2, y - d + h / 2]], top); poly(c, [[x, y - d], [x + w / 2, y - d + h / 2], [x + w / 2, y + h / 2], [x, y]], front); poly(c, [[x + w / 2, y - d + h / 2], [x + w, y - d], [x + w, y], [x + w / 2, y + h / 2]], side); }
    root.LWCanvasArt = { TW, TH, poly, rect, diamond, shadow, tree, bush, stone, fiber, pip, box };
})(window);
