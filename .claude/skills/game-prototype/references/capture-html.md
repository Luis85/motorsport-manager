# Headless HTML capture script

There is no CLI capture for colony, pet or RTS HTML, so a prototype run writes this small Playwright
script into `$W/tools/` (never into the repository). It loads the page from `file://`, waits for
fonts and animation frames (never fixed sleeps), captures desktop and phone, optionally clicks the
scene button and a speed button, and records console errors in `captures.json`. SKILL.md A7 runs it.

Write it once per run (set up `$W/env.sh` as in SKILL.md section 0 first):

```sh
W=<abs>; . "$W/env.sh"
cat > "$W/tools/capture-html.mjs" <<'EOF'
// node capture-html.mjs PAGE.html OUT_DIR [--click "Scene button"] [--speed "Four times speed"] [--frames 240]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PW_ENTRY);
const [html, outDir, ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
mkdirSync(outDir, { recursive: true });
// Wait for `count` rendered frames, bounded by `ms` (software WebGL can render only a few frames per second).
const frames = (page, count, ms = 20000) => page.evaluate(([n, limit]) => new Promise((done) => {
  const end = performance.now() + limit; let i = 0;
  const tick = () => (++i >= n || performance.now() > end ? done(i) : requestAnimationFrame(tick)); requestAnimationFrame(tick);
}), [count, ms]);
const report = { html: resolve(html), browser: null, captures: [], consoleErrors: [], warnings: [], framesBeforePlay: {} };
const browser = await chromium.launch({ executablePath: process.env.FORGE_CHROMIUM_PATH || undefined, args: ['--enable-unsafe-swiftshader'] });
report.browser = browser.version();
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', (e) => report.consoleErrors.push(`${name}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(`${name}: ${m.text()}`); });
    await page.goto(pathToFileURL(resolve(html)).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await frames(page, 30);
    const shot = async (label) => {
      const file = `${name}-${label}.png`;
      await page.screenshot({ path: `${outDir}/${file}` });
      report.captures.push({ file, viewport, title: await page.title() });
    };
    await shot('start');
    if (opt.click) {
      await page.getByRole('button', { name: opt.click }).first().click({ timeout: 15000 });
      if (opt.speed) {
        try { await page.getByRole('button', { name: opt.speed, exact: true }).first().click({ timeout: 5000 }); }
        catch (e) { report.warnings.push(`${name}: speed button not clicked: ${e.message.split('\n')[0]}`); }
      }
      report.framesBeforePlay[name] = await frames(page, Number(opt.frames ?? 240));
      await shot('play');
    }
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${outDir}/captures.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
EOF
```

Arguments: `node capture-html.mjs PAGE.html OUT_DIR [--click "Scene button"] [--speed "Four times
speed"] [--frames 240]`. It needs `PW_ENTRY`, the Playwright module path that `model-forge doctor`
resolved (A7 exports it), and uses `FORGE_CHROMIUM_PATH` when set. Without `--click` it captures
only the start screen of each viewport.
