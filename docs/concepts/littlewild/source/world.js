/* Hand-drawn procedural pixel art and isometric presentation. Canvas never issues movement orders. */
(function (root) {
    'use strict';
    const { SIZE, terrain, seeded, BUILDINGS, clamp } = LW;
    const TW = 44, TH = 22;
    function poly(c, p, color) { c.fillStyle = color; c.beginPath(); p.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); }
    function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
    function diamond(c, x, y, w, h, color) { poly(c, [[x, y - h / 2], [x + w / 2, y], [x, y + h / 2], [x - w / 2, y]], color); }
    function shadow(c, x, y, w = 15, h = 6) { c.save(); c.globalAlpha = .13; diamond(c, x + 4, y + 2, w * 2, h * 2, '#304e3d'); c.restore(); }
    function tree(c, x, y, v = 0, empty = false) {
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
    function bush(c, x, y, stock = 6) { shadow(c, x, y, 12, 5); poly(c, [[x - 14, y - 3], [x - 14, y - 10], [x - 9, y - 10], [x - 9, y - 16], [x - 2, y - 16], [x - 2, y - 19], [x + 7, y - 19], [x + 7, y - 13], [x + 13, y - 13], [x + 13, y - 3], [x + 7, y + 1], [x - 7, y + 1]], '#4e8562'); rect(c, x - 10, y - 11, 8, 7, '#7ca16a'); rect(c, x - 3, y - 17, 8, 9, '#87b877'); rect(c, x + 5, y - 9, 7, 6, '#719963'); if (stock > 0) {
        [[-8, -8], [3, -13], [7, -5], [-3, -3]].slice(0, Math.min(stock, 4)).forEach(([a, b]) => { rect(c, x + a, y + b, 4, 4, '#b45f69'); rect(c, x + a, y + b, 2, 2, '#f0adb0'); });
    } }
    function stone(c, x, y) { shadow(c, x, y, 15, 6); poly(c, [[x - 16, y - 2], [x - 14, y - 12], [x - 4, y - 19], [x + 7, y - 17], [x + 15, y - 7], [x + 13, y + 1], [x + 2, y + 6]], '#7b9391'); poly(c, [[x - 14, y - 12], [x - 4, y - 19], [x + 7, y - 17], [x + 4, y - 7], [x - 5, y - 4]], '#b6c8bb'); poly(c, [[x + 4, y - 7], [x + 7, y - 17], [x + 15, y - 7], [x + 13, y + 1], [x + 2, y + 6]], '#93a9a0'); rect(c, x - 3, y - 15, 6, 3, '#d0d5bd'); rect(c, x - 18, y + 2, 5, 4, '#a6b8a6'); }
    function fiber(c, x, y) { shadow(c, x, y, 9, 4); [[0, 0], [-6, 1], [5, 2], [-2, -3]].forEach(([a, b], i) => { rect(c, x + a, y + b - 11, 2, 13, '#7e9560'); rect(c, x + a - 3, y + b - 15, 3, 5, i % 2 ? '#c8c485' : '#dbd499'); rect(c, x + a + 2, y + b - 9, 4, 2, '#a9b679'); }); }
    function pip(c, x, y, scale = 1, frame = 0, mood = 'Content', dir = 1, kind = 'idle', moving = false, actor = null) {
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
            const gear=slot=>root.LW.colony.definition(actor.equipment[slot]);
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
    function box(c, x, y, w = 30, h = 16, d = 18, top = '#b9945c', front = '#a47a4c', side = '#84623f') { poly(c, [[x, y - d], [x + w / 2, y - d - h / 2], [x + w, y - d], [x + w / 2, y - d + h / 2]], top); poly(c, [[x, y - d], [x + w / 2, y - d + h / 2], [x + w / 2, y + h / 2], [x, y]], front); poly(c, [[x + w / 2, y - d + h / 2], [x + w, y - d], [x + w, y], [x + w / 2, y + h / 2]], side); }
    function building(c, x, y, kind, time = 0, ghost = false) {
        c.save();
        c.translate(Math.round(x), Math.round(y));
        if (ghost)
            c.globalAlpha = .45;
        shadow(c, 0, 0, 26, 10);
        if (kind === 'shelter') {
            poly(c, [[-26, 1], [0, 15], [27, 1], [0, -12]], '#9b9165');
            poly(c, [[-24, -2], [0, 11], [0, -23], [-24, -36]], '#baae77');
            poly(c, [[0, 11], [24, -2], [24, -36], [0, -23]], '#8f9a66');
            poly(c, [[-29, -32], [-6, -54], [30, -33], [5, -12]], '#5e8660');
            poly(c, [[-29, -32], [5, -12], [1, -24], [-8, -48]], '#819e69');
            poly(c, [[-6, -54], [30, -33], [29, -26], [2, -41]], '#a6b87a');
            rect(c, 2, -16, 11, 18, '#58654b');
            poly(c, [[0, 10], [0, -13], [12, -19], [12, 4]], '#495640');
            rect(c, -21, -26, 3, 24, '#c3a979');
            rect(c, 22, -30, 3, 27, '#ae945f');
            rect(c, -16, -21, 8, 9, '#e8ca8b');
            rect(c, -15, -20, 6, 6, '#738e64');
            rect(c, -5, -43, 6, 3, '#bec68a');
            rect(c, 6, -34, 8, 3, '#bac187');
        }
        else if (kind === 'bench') {
            box(c, -22, -2, 43, 19, 15, '#d8b886', '#ad8555', '#896647');
            rect(c, -18, -4, 4, 13, '#7b6247');
            rect(c, 15, -3, 4, 13, '#775e45');
            rect(c, 1, -20, 16, 3, '#eee1b7');
            rect(c, 3, -25, 3, 8, '#7a826c');
            rect(c, 0, -26, 10, 3, '#b9c0a6');
            rect(c, -15, -20, 13, 4, '#9a7150');
            rect(c, -8, -23, 13, 3, '#c09b69');
        }
        else if (kind === 'fire') {
            diamond(c, 0, 0, 45, 21, '#9fa17c');
            [[0, -7], [13, -2], [10, 6], [-2, 9], [-14, 3], [-12, -6]].forEach(([a, b]) => { rect(c, a - 4, b - 3, 8, 5, '#7d8980'); rect(c, a - 3, b - 4, 6, 3, '#b5b69a'); });
            poly(c, [[-13, 1], [-9, -3], [13, 3], [9, 7]], '#78573c');
            poly(c, [[10, -4], [14, -1], [-8, 7], [-12, 4]], '#9a7048');
            let flick = Math.sin(time * 12) > 0 ? 3 : 0;
            poly(c, [[-8, 1], [-10, -7], [-4, -17 - flick], [0, -12], [4, -25 + flick], [7, -13], [11, -6], [7, 3]], '#ec9453');
            poly(c, [[-5, 1], [-4, -10], [1, -7], [4, -16], [6, -5], [4, 3]], '#f5c772');
            rect(c, -1, -3, 5, 7, '#f9e7a0');
            if (!ghost) {
                c.globalAlpha = .5;
                rect(c, 3 + Math.sin(time) * 3, -29 - (time * 7) % 16, 3, 3, '#e2b677');
                c.globalAlpha = 1;
            }
        }
        else if (kind === 'garden') {
            diamond(c, 0, 1, 56, 28, '#927e52');
            diamond(c, 0, -1, 49, 24, '#645e44');
            for (let i = 0; i < 3; i++) {
                let a = -12 + i * 10, b = -5 + i * 3;
                bush(c, a, b, .7);
                rect(c, a + 1, b - 12, 3, 3, '#d29892');
            }
            poly(c, [[-29, 0], [-29, 4], [0, 20], [29, 4], [29, 0], [0, 15]], '#b79a6b');
        }
        else if (kind === 'market') {
            box(c, -25, 2, 50, 24, 19, '#c5aa71', '#a28251', '#8d6f47');
            rect(c, -23, -44, 3, 47, '#8d6a48');
            rect(c, 21, -42, 3, 46, '#8d6a48');
            poly(c, [[-30, -41], [-6, -54], [32, -36], [5, -21]], '#e9d69a');
            poly(c, [[-30, -41], [5, -21], [5, -14], [-30, -33]], '#c77560');
            poly(c, [[5, -21], [32, -36], [32, -27], [5, -14]], '#ab6254');
            poly(c, [[-22, -45], [-15, -48], [22, -31], [15, -27]], '#bd7360');
            poly(c, [[-7, -53], [0, -51], [30, -36], [23, -32]], '#ca7d67');
            rect(c, -16, -18, 12, 7, '#637c51');
            rect(c, -13, -21, 4, 4, '#bf6b64');
            rect(c, -7, -19, 4, 4, '#dd9a7b');
            rect(c, 4, -15, 11, 5, '#ead298');
            rect(c, 9, -20, 7, 6, '#aa925b');
            rect(c, -7, -9, 16, 10, '#695f42');
            rect(c, -5, -7, 12, 6, '#ecd29a');
            rect(c, -1, -6, 3, 4, '#b48c4e');
        }
        else if (kind === 'well') {
            diamond(c, 0, 0, 45, 22, '#7e8f88');
            poly(c, [[-22, -10], [0, 2], [22, -10], [22, 0], [0, 12], [-22, 0]], '#a4afa0');
            diamond(c, 0, -11, 44, 22, '#c3c9b1');
            diamond(c, 0, -11, 28, 13, '#4f7876');
            rect(c, -18, -40, 4, 32, '#97764b');
            rect(c, 15, -38, 4, 29, '#97764b');
            rect(c, -18, -40, 36, 4, '#b7925f');
            rect(c, 0, -35, 2, 23, '#d0bb83');
            rect(c, -4, -16, 10, 9, '#8f744f');
            poly(c, [[-26, -40], [-6, -54], [26, -39], [6, -27]], '#73918d');
            poly(c, [[-26, -40], [6, -27], [6, -22], [-26, -35]], '#567c78');
        }
        else if (kind === 'cottage') {
            box(c, -31, 1, 60, 30, 38, '#e6d9a6', '#d2bb83', '#b49d6d');
            poly(c, [[-37, -39], [-10, -69], [36, -48], [9, -16]], '#568b82');
            poly(c, [[-37, -39], [9, -16], [9, -23], [-12, -62]], '#78a296');
            poly(c, [[-10, -69], [36, -48], [36, -42], [7, -54]], '#9db8a0');
            poly(c, [[8, 17], [8, -9], [21, -16], [21, 10]], '#796747');
            rect(c, -23, -27, 11, 13, '#926d45');
            rect(c, -21, -25, 7, 9, '#e9d597');
            rect(c, -18, -25, 2, 10, '#b29361');
            rect(c, -7, -19, 8, 10, '#e5cc8a');
            rect(c, 18, -67, 9, 18, '#89968b');
            rect(c, 16, -69, 13, 4, '#b8bb9f');
            rect(c, -31, -6, 4, 14, '#ad9564');
            bush(c, -28, 11, 3);
        }
        else if (kind === 'study') {
            box(c, -23, 1, 45, 21, 17, '#c8a77a', '#a47f50', '#846342');
            rect(c, -17, -34, 33, 4, '#8a7859');
            rect(c, -19, -33, 3, 20, '#9a825b');
            rect(c, 14, -32, 3, 24, '#9a825b');
            for (let i = 0; i < 5; i++)
                rect(c, -14 + i * 5, -46, 4, 12, ['#839584', '#c19873', '#8fa9a0', '#b18c7b', '#b4b47c'][i]);
            rect(c, -6, -20, 16, 8, '#f0dfae');
            rect(c, 1, -20, 1, 8, '#b7a177');
            rect(c, 13, -23, 5, 9, '#a1b1a2');
            rect(c, 14, -27, 3, 4, '#aecacc');
        }
        else if (kind === 'circle') {
            diamond(c,0,2,64,30,'#bbaa79');diamond(c,0,0,57,25,'#d4cb99');
            [[-20,-5],[18,-5],[0,10]].forEach(([a,b],i)=>{box(c,a-7,b,14,8,5,'#a9b488','#849568','#6f825c');rect(c,a-4,b-6,8,3,'#d8d4a1');});
            box(c,-9,-2,18,10,8,'#c9ad78','#a48753','#8b7049');rect(c,-5,-14,14,7,'#f1e7bd');rect(c,1,-14,1,7,'#b8aa80');
            rect(c,-25,-31,3,33,'#a58b5a');poly(c,[[-22,-31],[-7,-27],[-22,-22]],'#94a873');rect(c,-20,-13,4,3,'#f0d393');
        }
        else if (kind === 'grainplot') {
            diamond(c,0,2,59,29,'#947d50');diamond(c,0,-1,52,25,'#706143');
            for(let row=0;row<3;row++)for(let col=0;col<4;col++){const a=-17+col*9+row*3,b=-5+row*6;rect(c,a,b-14,2,16,'#a7ac64');rect(c,a-2,b-18,5,8,'#dec888');rect(c,a-3,b-14,2,2,'#f0dca2');rect(c,a+3,b-11,2,5,'#c4b474');}
            poly(c,[[-29,1],[-29,5],[0,20],[29,5],[29,1],[0,15]],'#bda375');
        }
        else if (kind === 'loom') {
            box(c,-25,0,48,23,8,'#c7a97b','#ad8959','#8c6b4a');
            rect(c,-21,-45,4,43,'#aa8156');rect(c,15,-38,4,43,'#947048');rect(c,-22,-46,43,5,'#c4a175');
            for(let i=0;i<9;i++)rect(c,-15+i*3,-39+i*.15,1,30,'#ece0b8');
            poly(c,[[-16,-25],[12,-23],[12,-6],[-16,-9]],'#819da0');rect(c,-16,-14,28,3,'#b8c5af');rect(c,-16,-9,28,3,'#d8cfa6');
            rect(c,-20,-6,41,4,'#bc9566');rect(c,-24,-26,9,4,'#d9b07c');rect(c,17,-15,7,6,'#d0bd87');
        }
        else if (kind === 'kiln' || kind === 'smelter') {
            box(c,-25,1,49,25,kind==='smelter'?32:22,'#c4a28a','#ac836a','#8d6d5a');
            const h=kind==='smelter'?32:22;
            poly(c,[[-27,-h],[-11,-h-16],[11,-h-17],[27,-h],[1,-h+13]],'#cba891');
            for(let i=0;i<3;i++){rect(c,-22,-h+8+i*7,17,1,'#97765d');rect(c,4,-h+13+i*5,15,1,'#7b6553');}
            rect(c,-17,-13,16,14,'#5b5549');rect(c,-14,-9,11,10,'#d89459');rect(c,-11,-6,6,7,'#f0ce80');
            box(c,7,-h-10,10,6,19,'#cbb195','#a4876e','#806a59');
            if(kind==='smelter'){rect(c,-22,-h+3,27,3,'#838d82');rect(c,-22,-3,27,3,'#89958c');box(c,20,9,12,7,6,'#a7b7a8','#879b92','#708b84');}
            else {rect(c,19,7,8,7,'#c18e6b');rect(c,20,5,6,3,'#e1b98a');}
        }
        else if (kind === 'herbarium') {
            box(c,-25,1,49,25,15,'#ccb58a','#b79765','#967747');
            rect(c,-23,-42,3,42,'#a38a5d');rect(c,21,-42,3,42,'#937448');rect(c,-23,-42,47,3,'#b7a172');
            poly(c,[[-29,-43],[-6,-54],[31,-35],[7,-23]],'#91aa8b');poly(c,[[-29,-43],[7,-23],[7,-18],[-29,-37]],'#6e9477');
            for(let i=0;i<4;i++){rect(c,-15+i*9,-33+i*3,1,10,'#cbb483');rect(c,-18+i*9,-25+i*2,7,9,['#759367','#8e9e65','#a29287','#719786'][i]);}
            rect(c,-14,-17,6,7,'#ddd4ab');rect(c,-5,-13,6,7,'#93aaa0');rect(c,7,-15,7,9,'#c1a879');
        }
        else if (kind === 'workshop' || kind === 'bakery' || kind === 'storehouse') {
            const roof=kind==='workshop'?'#779496':kind==='bakery'?'#c18b78':'#9aaa79';
            box(c,-29,1,58,29,31,'#d6c391','#bc9e68','#9f8359');
            rect(c,-28,-31,4,32,'#8e7350');rect(c,0,-16,4,33,'#89714f');rect(c,24,-31,4,32,'#8c714d');
            poly(c,[[-35,-29],[-8,-58],[36,-32],[8,-8]],roof);poly(c,[[-35,-29],[8,-8],[8,-3],[-35,-24]],kind==='bakery'?'#a77462':'#6f856e');
            poly(c,[[-8,-58],[36,-32],[36,-26],[-8,-51]],'#c0c1a0');
            rect(c,-19,-16,15,17,'#5f654a');rect(c,-15,-14,8,12,'#dfbd7c');
            if(kind==='workshop'){box(c,-28,12,32,14,10,'#d6b385','#a38559','#896b48');rect(c,-19,0,13,3,'#e9d5a5');rect(c,-10,-6,4,12,'#8d9d91');rect(c,-14,-7,12,4,'#a9b5a0');}
            if(kind==='bakery'){box(c,11,-35,10,6,14,'#ceb195','#ad8e6e','#8e795f');rect(c,7,-5,15,9,'#dfd0a0');for(let i=0;i<3;i++)rect(c,8+i*5,-8+i%2,4,5,'#cfac64');rect(c,4,-14,21,2,'#a48f66');}
            if(kind==='storehouse'){box(c,-34,8,16,9,12,'#c8ab74','#ae8e5d','#8e754d');box(c,16,13,21,10,12,'#d2b17b','#a88752','#967744');rect(c,24,1,2,13,'#7e784e');}
        }
        else if (kind === 'mill') {
            box(c,-17,1,36,18,46,'#d9c69e','#c6b183','#a68f65');
            poly(c,[[-23,-45],[-5,-64],[24,-46],[3,-32]],'#829a92');rect(c,-12,-11,10,14,'#797658');
            c.save();c.translate(-1,-37);c.rotate(time*.16);
            for(let i=0;i<4;i++){c.rotate(Math.PI/2);rect(c,-2,-38,4,39,'#9c875c');rect(c,2,-37,10,24,'#e6d9b0');rect(c,2,-34,10,2,'#bdb585');rect(c,2,-24,10,2,'#bdb585');rect(c,9,-37,2,24,'#bdb585');}
            c.restore();rect(c,-4,-41,8,8,'#bba171');rect(c,-2,-39,4,4,'#e5c798');
        }
        else if (kind === 'greenhouse') {
            box(c,-28,2,55,28,22,'#b9c5a1','#aac09a','#839e82');
            poly(c,[[-31,-21],[-8,-50],[33,-28],[9,-3]],'#bccbac');
            poly(c,[[-29,-20],[-8,-46],[10,-5]],'#d4d9b8');
            [[-25,-20,2,23],[-11,-12,2,23],[6,-5,2,21],[23,-16,2,24]].forEach(a=>rect(c,...a,'#8a9f73'));
            poly(c,[[-31,-21],[9,-3],[33,-28],[33,-24],[9,2],[-31,-17]],'#a6b58a');
            for(let i=0;i<3;i++){rect(c,-20+i*14,-4+i%2*4,6,5,'#739369');rect(c,-17+i*14,-9+i%2*4,2,8,'#7d985f');rect(c,-19+i*14,-11+i%2*4,6,4,'#9fb57e');}
        }
        else if (kind === 'waterwheel') {
            box(c,-10,2,37,20,27,'#c5b98a','#a99060','#8d7957');
            poly(c,[[-17,-25],[1,-41],[32,-26],[13,-10]],'#769993');
            c.save();c.translate(-16,-15);c.scale(.73,1);c.rotate(time*.28);
            for(let i=0;i<12;i++){c.rotate(Math.PI/6);rect(c,-2,-23,4,23,'#aa8e60');rect(c,-7,-26,14,5,'#c4aa78');rect(c,-7,-21,14,2,'#876e48');}
            c.restore();rect(c,-20,-19,8,8,'#d6bc86');rect(c,-17,-16,3,3,'#8e7854');
            rect(c,13,-11,10,9,'#d8d5b2');rect(c,15,-9,6,6,'#748e83');
        }
        else if (kind === 'orchard') {
            diamond(c,0,4,64,31,'#92a974');
            [[-17,0,.63],[12,5,.7],[2,-15,.63]].forEach(([x,y,z])=>{c.save();c.translate(x,y);c.scale(z,z);tree(c,0,0,1);[[-7,-34],[9,-29],[0,-47],[-12,-43]].forEach(([a,b])=>{rect(c,a,b,6,6,'#ce9481');rect(c,a+1,b,3,2,'#e6b096');});c.restore();});
            rect(c,-30,6,2,11,'#ac9565');rect(c,26,6,2,11,'#ac9565');
        }
        else if (kind === 'observatory') {
            box(c,-24,2,49,24,25,'#dad0aa','#bfb18a','#9d977d');
            poly(c,[[-29,-24],[-27,-35],[-17,-48],[0,-57],[15,-52],[28,-37],[30,-26],[5,-13]],'#94afb0');
            poly(c,[[0,-57],[15,-52],[28,-37],[30,-26],[5,-13],[4,-38]],'#739a9f');
            poly(c,[[-17,-48],[0,-57],[4,-38],[-10,-29],[-25,-35]],'#c2cebb');
            rect(c,-16,-15,12,18,'#7e8873');rect(c,-13,-11,6,9,'#e1d29d');
            poly(c,[[7,-46],[25,-59],[31,-52],[13,-37]],'#9c9b7e');poly(c,[[25,-59],[31,-52],[35,-54],[29,-62]],'#dfd2a4');
            rect(c,26,-59,5,4,'#77a2a7');rect(c,-25,4,13,3,'#c7bb90');
        }
        c.restore();
    }
    class World {
        constructor(canvas, engine, handlers = {}) { this.canvas = canvas; this.c = canvas.getContext('2d', { alpha: false }); this.engine = engine; this.handlers = handlers; this.camera = { z: 1, x: 0, y: 0 }; this.hover = null; this.selected = null; this.placement = null; this.drag = null; this.manual = false; this.showPath = true; this.time = 0; this.bubble = null; this.particles = []; this.makeGround(); this.bind(); this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); this.resize(); }
        makeGround() {
            const c = document.createElement('canvas');
            c.width = SIZE * TW + 130;
            c.height = SIZE * TH + 180;
            this.ground = c;
            let g = c.getContext('2d');
            g.imageSmoothingEnabled = false;
            g.translate(c.width / 2, 85);
            let rand = seeded(2718);
            this.decor = [];
            for (let d = 0; d < SIZE * 2; d++)
                for (let x = 0; x < SIZE; x++) {
                    const y = d - x, t = terrain(x, y);
                    if (t === 'void')
                        continue;
                    let px = (x - y) * TW / 2, py = (x + y) * TH / 2;
                    const depth = 25;
                    if (terrain(x + 1, y) === 'void') {
                        poly(g, [[px, py + TH / 2], [px + TW / 2, py], [px + TW / 2, py + depth], [px, py + TH / 2 + depth]], '#9aa07b');
                        rect(g, px + 7, py + 15, 3, 5, '#b3ac84');
                    }
                    if (terrain(x, y + 1) === 'void') {
                        poly(g, [[px - TW / 2, py], [px, py + TH / 2], [px, py + TH / 2 + depth], [px - TW / 2, py + depth]], '#818d68');
                        rect(g, px - 12, py + 14, 3, 3, '#a6a37a');
                    }
                    let path = ((x >= 7 && x <= 11 && y >= 8 && y <= 11) || x === 10 && y >= 5 && y <= 13);
                    let col = t === 'water' ? ['#86b9b0', '#8fbbb0', '#9bbfb0'][Math.floor(rand() * 3)] : path ? ['#c8cb98', '#c7c997', '#c3c694', '#ccd09f'][Math.floor(rand() * 4)] : ['#aebf85', '#b5c58d', '#b6c78f', '#b3c489', '#adc088', '#baca92'][Math.floor(rand() * 6)];
                    diamond(g, px, py, TW, TH, col);
                    if (t === 'water') {
                        diamond(g, px, py + 1, TW - 2, TH - 2, col);
                        rect(g, px - 7, py, 13, 1, '#b2d1be');
                        if (rand() > .75)
                            this.decor.push({ kind: 'lily', x, y, v: rand() });
                        continue;
                    }
                    if (!path && rand() > .27) {
                        for (let i = 0; i < 3; i++) {
                            let a = (rand() - .5) * 22, b = (rand() - .5) * 10;
                            rect(g, px + a, py + b, 2, 1, rand() > .5 ? '#93b07a' : '#cccf9c');
                        }
                    }
                    if (!path && rand() > .77) {
                        const fx = px + (rand() - .5) * 18, fy = py + (rand() - .5) * 7;
                        rect(g, fx, fy - 3, 1, 4, '#80a56f');
                        rect(g, fx - 1, fy - 4, 3, 2, rand() > .5 ? '#efe1a7' : '#e8eee1');
                        rect(g, fx, fy - 4, 1, 1, '#c9af6f');
                    }
                    if (!path && rand() > .965) {
                        rect(g, px, py - 4, 2, 4, '#e0d2a1');
                        rect(g, px - 2, py - 6, 6, 3, '#bf8570');
                        rect(g, px - 1, py - 6, 2, 1, '#f2dca5');
                    }
                    if (path && rand() > .78)
                        rect(g, px - 5, py + 2, 3, 1, '#b1b388');
                }
            // A picnic blanket and trail marker are decoration, not free functional buildings.
            let bx = (7 - 10) * 22, by = (7 + 10) * 11;
            diamond(g, bx, by, 30, 16, '#d9c39b');
            diamond(g, bx, by, 25, 12, '#c3917c');
            for (let i = -1; i < 2; i++)
                rect(g, bx + i * 5 - 3, by + i * 2, 5, 1, '#efd5b0');
        }
        resize() { const box = this.canvas.getBoundingClientRect(); if (!box.width || !box.height)
            return; this.canvas.width = Math.round(box.width); this.canvas.height = Math.round(box.height); this.c.imageSmoothingEnabled = false; if (!this.manual)
            this.home(); }
        home() { const w = this.canvas.width, h = this.canvas.height; this.camera.z = clamp(Math.min((w - 40) / (SIZE * TW + 20), (h - 92) / (SIZE * TH + 75)), .42, 1.8); this.camera.x = 0; this.camera.y = 18; this.manual = false; }
        zoom(factor) { this.zoomAt(factor, this.canvas.width / 2, this.canvas.height / 2); }
        zoomAt(factor, x, y) {
            const before = this.transform(), px = (x - before.x) / before.z, py = (y - before.y) / before.z;
            this.camera.z = clamp(this.camera.z * factor, .38, 2.6);
            const after = this.transform();
            this.camera.x += x - (px * after.z + after.x);
            this.camera.y += y - (py * after.z + after.y);
            this.manual = true;
            this.limitCamera();
        }
        limitCamera() { this.camera.x = clamp(this.camera.x, -this.canvas.width * .85, this.canvas.width * .85); this.camera.y = clamp(this.camera.y, -this.canvas.height * .75, this.canvas.height * .75); }
        hitTest(x, y) {
            // Nameplates are explicit selectable targets, not only painted decoration.
            for(const target of (this.nameTargets||[]).slice().reverse())if(this.engine.creatures.some(a=>a.id===target.id&&!a.activeQuest)&&x>=target.x&&x<=target.x+target.w&&y>=target.y&&y<=target.y+target.h){const a=this.engine.creatures.find(a=>a.id===target.id);return {x:Math.round(a.creature.x),y:Math.round(a.creature.y),objectType:'pip',actorId:a.id};}
            for(const t of (this.landTargets||[]).slice().reverse())if(x>=t.x&&x<=t.x+t.w&&y>=t.y&&y<=t.y+t.h){const n=this.engine.s.nodes.find(n=>n.id===t.id);if(n)return{x:n.x,y:n.y,objectType:n.kind,objectId:n.id};}
            const s = this.engine.s, objects = [...s.nodes.filter(n => !s.buildings.some(b=>b.x===n.x&&b.y===n.y)), ...s.buildings, ...this.engine.allOrders().filter(o => o.type === 'build'), ...this.engine.creatures.filter(a=>!a.activeQuest).map(a=>({...a.creature,kind:'pip',actorId:a.id}))];
            objects.sort((a, b) => (b.x + b.y) - (a.x + a.y));
            for (const o of objects) {
                const p = this.toScreen(o.x, o.y), width = o.kind === 'pip' ? Math.max(22,22*this.camera.z) : (o.kind === 'wood' ? 24 : BUILDINGS[o.kind] ? 29 : 14) * this.camera.z, height = (o.kind === 'pip' ? 42 : o.kind === 'wood' ? 64 : BUILDINGS[o.kind] ? 55 : 20) * this.camera.z;
                if (x >= p.x - width && x <= p.x + width && y >= p.y - height && y <= p.y + 7 * this.camera.z)
                    return { x: Math.round(o.x), y: Math.round(o.y), objectType: o.kind, objectId:o.id||null, actorId:o.actorId||null };
            }
            return this.toTile(x, y);
        }
        project(x, y) { return { x: (x - y) * TW / 2, y: (x + y) * TH / 2 }; }
        transform() { return { x: this.canvas.width / 2 + this.camera.x, y: this.canvas.height / 2 - (SIZE - 1) * TH / 2 * this.camera.z + this.camera.y, z: this.camera.z }; }
        toScreen(x, y) { const p = this.project(x, y), t = this.transform(); return { x: p.x * t.z + t.x, y: p.y * t.z + t.y }; }
        toTile(x, y) { const t = this.transform(), px = (x - t.x) / t.z, py = (y - t.y) / t.z; return { x: Math.round((py / (TH / 2) + px / (TW / 2)) / 2), y: Math.round((py / (TH / 2) - px / (TW / 2)) / 2) }; }
        bind() {
            const el = this.canvas, pointers = new Map();
            let pinched = false, lastPinch = null;
            const local = e => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
            el.addEventListener('pointerdown', e => {
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
                    const [a, b] = [...pointers.values()];
                    lastPinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                }
            });
            el.addEventListener('pointermove', e => {
                const p = local(e);
                this.hover = this.placement ? this.toTile(p.x, p.y) : this.hitTest(p.x, p.y);
                if (pointers.has(e.pointerId))
                    pointers.set(e.pointerId, p);
                if (pointers.size >= 2) {
                    this.handlers.pan?.();
                    const [a, b] = [...pointers.values()], next = { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
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
            const finish = e => {
                if (e.type === 'pointerup' && this.drag && !this.drag.moved && !pinched) {
                    const p = local(e), tile = this.placement ? this.toTile(p.x, p.y) : this.hitTest(p.x, p.y);
                    if (this.placement)
                        this.handlers.place?.(this.placement, tile);
                    else
                        this.handlers.inspect?.(tile);
                }
                pointers.delete(e.pointerId);
                this.drag = null;
                lastPinch = null;
                if (pointers.size === 1) {
                    const p = [...pointers.values()][0];
                    this.drag = { x: p.x, y: p.y, cx: this.camera.x, cy: this.camera.y, moved: true };
                }
                if (!pointers.size)
                    pinched = false;
            };
            el.addEventListener('pointerup', finish);
            el.addEventListener('pointercancel', finish);
            el.addEventListener('lostpointercapture', e => { if (pointers.has(e.pointerId))
                finish(e); });
            el.addEventListener('pointerleave', () => { if (!pointers.size)
                this.hover = null; });
            el.addEventListener('wheel', e => { e.preventDefault(); this.handlers.pan?.(); const p = local(e); this.zoomAt(Math.exp(clamp(-e.deltaY * .0018, -.4, .4)), p.x, p.y); }, { passive: false });
            el.addEventListener('keydown', e => {
                if (e.ctrlKey || e.metaKey || e.altKey)
                    return;
                const directions = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
                if (directions[e.key]) {
                    e.preventDefault();
                    e.stopPropagation();
                    const [dx, dy] = directions[e.key];
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
        say(text,type='heart',actorId=null){const a=this.engine.creatures.find(a=>a.id===actorId)||this.engine.selected;if(!a||a.activeQuest)return;this.bubble={text,time:this.time+6,type,actorId:a.id};if(!this.engine.s.settings.reducedMotion)for(let i=0;i<7;i++)this.particles.push({x:a.creature.x,y:a.creature.y,off:(i-3)*7,t:0,delay:i*.1,type});}
        feedbackEvent(event){const a=this.engine.creatures.find(a=>a.id===event.actorId);if(!a||a.activeQuest)return;this.effects??=[];this.effects.push({...event,x:event.x??a.creature.x,y:event.y??a.creature.y,expires:(this.time||0)+4.5,started:this.time||0});this.effects=this.effects.slice(-10);if(event.type==='social')this.say(event.success?'A little closer.':'Let’s give each other a moment.','heart',a.id);else if(event.type==='transfer')this.say(event.text,'star',a.id);}
        draw(time, dt) {
            this.time = time;
            const c = this.c, w = this.canvas.width, h = this.canvas.height, s = this.engine.s, reduced = s.settings.reducedMotion, t = reduced ? 1 : time;
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
            if (this.engine.selected&&!this.engine.selected.activeQuest&&s.settings.follow && !this.contextChoosing && s.task?.phase === 'walk') {
                const p = this.project(s.creature.x, s.creature.y);
                this.camera.x += (clamp(-p.x * this.camera.z, -w * .2, w * .2) - this.camera.x) * .035;
            }
            const tr = this.transform();
            c.save();
            c.translate(Math.round(tr.x), Math.round(tr.y));
            c.scale(tr.z, tr.z);
            c.drawImage(this.ground, -this.ground.width / 2, -85);
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
            if (this.engine.selected&&!this.engine.selected.activeQuest&&this.showPath && s.task?.phase === 'walk') {
                c.globalAlpha = .5;
                for (const p of s.task.path) {
                    let sp = this.project(p.x, p.y);
                    diamond(c, sp.x, sp.y, 5, 3, '#f5efcf');
                }
                c.globalAlpha = 1;
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
                for (const [a, b] of [[-18, 0], [0, -9], [18, 0], [0, 9]]) {
                    rect(c, p.x + a - 1, p.y + b - 6, 2, 7, '#9e8155');
                    rect(c, p.x + a, p.y + b - 6, 5, 3, '#e9d590');
                }
                if (o.paid || o.stage>0) {
                    c.globalAlpha = .25 + .65 * this.engine.projectProgress(o);
                    building(c, p.x, p.y, o.kind, t);
                }
                c.restore();
            }
            if (this.placement && this.hover) {
                const p = this.project(this.hover.x, this.hover.y), ok = this.engine.canBuild(this.hover.x, this.hover.y,this.placement) && !this.engine.placementIssue(this.placement,this.hover.x,this.hover.y);
                if (terrain(this.hover.x, this.hover.y) !== 'void') {
                    c.globalAlpha = .6;
                    diamond(c, p.x, p.y, 46, 24, ok ? '#f5edb7' : '#d88b77');
                    c.globalAlpha = 1;
                    building(c, p.x, p.y, this.placement, t, true);
                }
            }
            const objects = s.nodes.filter(n => n.kind !== 'water'&&!s.buildings.some(b=>b.x===n.x&&b.y===n.y)).map(n => ({ ...n, obj: 'node' }));
            for (const b of s.buildings)
                objects.push({ ...b, obj: 'building' });
            for(const actor of this.engine.creatures.filter(a=>!a.activeQuest))objects.push({x:actor.creature.x,y:actor.creature.y,obj:'pip',actor});
            objects.push({ x: 7, y: 10, obj: 'basket' });
            if (this.engine.has('market')) {
                const m = s.buildings.find(b => b.kind === 'market');
                objects.push({ x: m.x + .4, y: m.y + .9, obj: 'visitor' });
            }
            objects.sort((a, b) => (a.x + a.y) - (b.x + b.y));
            for (const o of objects) {
                const p = this.project(o.x, o.y);
                if (o.obj === 'node') {
                    c.save();if(LWWorldContent.node(o.kind)?.mode==='finite'&&o.stock===0)c.globalAlpha=.32;
                    if (o.kind === 'wood')
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
                    building(c, p.x, p.y, o.kind, t);
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
                    pip(c, p.x, p.y, 1.15, t, this.engine.mood(a), s.creature.dir, s.task?.phase === 'work' ? (s.task.kind==='practice'?'train':s.task.kind==='reflect'?'rest':s.task.kind) : 'idle', !reduced && s.task?.phase === 'walk', a);
                    if((['stockbuilding','deposit','emptybuilding'].includes(s.task?.kind)||a.worldSupply||a.needsDeposit)&&Object.values(a.inventory).some(q=>q>0)){box(c,p.x+8,p.y-5,9,6,7,'#d2b581','#ac895b','#906f45');rect(c,p.x+10,p.y-11,2,8,'#ead49e');}
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
            if (s.hour > 18 || s.hour < 6) {
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
            for(const a of this.engine.creatures.filter(a=>!a.activeQuest).sort((a,b)=>(b.id===this.engine.selected?.id?1:0)-(a.id===this.engine.selected?.id?1:0))){
                if(this.contextChoosing&&a.id!==this.engine.selected?.id)continue;
                if(this.bubble?.actorId===a.id&&this.bubble.time>time)continue;
                const p = this.toScreen(a.creature.x, a.creature.y), task = a.task, caption = a.name + (task?.phase === 'walk' ? ' · on my way' : task?.kind === 'rest' ? ' · resting' : task?.kind === 'build' ? ' · building' : task?.kind === 'gather' ? ' · gathering' : ['craft','gearcraft'].includes(task?.kind) ? ' · making' : task?.kind==='produce'?' · tending':task?.kind==='stockbuilding'?' · stocking':task?.kind==='collectbuilding'||task?.kind==='emptybuilding'?' · collecting' : ['train','practice'].includes(task?.kind) ? ' · learning' : task?.kind === 'shop' ? ' · shopping' : task?.kind==='social'?' · together':task?.kind==='calmdown'?' · taking space':task?.kind==='withdraw'?' · collecting':task?.kind==='deposit'?' · unloading':'');
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
            if (this.bubble && this.bubble.time > time && this.engine.creatures.some(a=>a.id===this.bubble.actorId&&!a.activeQuest)) {
                const a=this.engine.creatures.find(a=>a.id===this.bubble.actorId);
                const p = this.toScreen(a.creature.x, a.creature.y);
                c.font = '600 11px system-ui, sans-serif';
                const text = this.bubble.text.length > 49 ? this.bubble.text.slice(0, 47) + '…' : this.bubble.text, ww = c.measureText(text).width + 24, xx = clamp(p.x - ww / 2, 12, w - ww - 12), yy = Math.max(76, p.y - 75);
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
    }
    root.LWArt = { World, pip, building, tree, bush, stone, fiber, diamond, rect, poly };
})(window);
