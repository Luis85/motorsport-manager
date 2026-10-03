/* Cached procedural ground. Terrain identity and seeded decoration come from explicit ports. */
(function (inputRoot: unknown) {
    'use strict';
    const root = inputRoot as LWCanvasPorts.Root;
    const { SIZE, terrain, seeded } = root.LW;
    const { TW, TH, poly, rect, diamond } = root.LWCanvasArt;
    function create(createCanvas: () => HTMLCanvasElement) {
            const c = createCanvas();
            c.width = SIZE * TW + 130;
            c.height = SIZE * TH + 180;
            const g = c.getContext('2d');
            if (!g) throw Error('Canvas ground rendering context is unavailable.');
            g.imageSmoothingEnabled = false;
            g.translate(c.width / 2, 85);
            let rand = seeded(2718);
            const decor: LWCanvasPorts.Decoration[] = [];
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
                    let col = t === 'water' ? ['#86b9b0', '#8fbbb0', '#9bbfb0'][Math.floor(rand() * 3)]! : path ? ['#c8cb98', '#c7c997', '#c3c694', '#ccd09f'][Math.floor(rand() * 4)]! : ['#aebf85', '#b5c58d', '#b6c78f', '#b3c489', '#adc088', '#baca92'][Math.floor(rand() * 6)]!;
                    diamond(g, px, py, TW, TH, col);
                    if (t === 'water') {
                        diamond(g, px, py + 1, TW - 2, TH - 2, col);
                        rect(g, px - 7, py, 13, 1, '#b2d1be');
                        if (rand() > .75)
                            decor.push({ kind: 'lily', x, y, v: rand() });
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
            return { ground: c, decor };
    }
    root.LWCanvasGround = { create };
})(window);
