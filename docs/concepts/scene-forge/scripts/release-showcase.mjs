import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  loadProjectScenes,
  createProjectPreview,
  exportScene,
  validateExport,
  auditScene,
  reviewScene,
  parse,
  ReviewPlanSchema,
} from '../dist/index.js';
const root = 'examples/showcase/exports';
await mkdir(root, { recursive: true });
const project = await loadProjectScenes('examples/showcase');
const documents = Object.values(project.scenes);
const html = await createProjectPreview(documents, project.models, 'assetStudio');
const htmlPath = `${root}/workshop.html`;
await writeFile(htmlPath, html);
const reports = [],
  frames = [];
const plan = parse(ReviewPlanSchema, {
  schemaVersion: 1,
  kind: 'review',
  width: 800,
  height: 600,
  frames: ['iso', 'front', 'right', 'back', 'left', 'top'].map((id) => ({
    id,
    camera: { view: id },
  })),
});
for (const scene of documents) {
  const quality = auditScene(scene, project.models);
  if (!quality.passed) throw new Error(JSON.stringify({ scene: scene.id, quality }));
  const result = await exportScene(scene, project.models, 'glb');
  const gltf = await validateExport(result.data, 'glb');
  if (gltf.numErrors || gltf.numWarnings)
    throw new Error(JSON.stringify({ scene: scene.id, gltf }));
  await writeFile(`${root}/${scene.id}.glb`, result.data);
  let review;
  if (['courtyard', 'pipePlant', 'robotCell', 'assetStudio', 'animationLab'].includes(scene.id)) {
    review = await reviewScene(scene, project.models, `${root}/${scene.id}-review`, plan, {
      overwrite: true,
      target: { scene: scene.id },
    });
    frames.push({ id: scene.id, name: scene.name, image: `${root}/${scene.id}-review/iso.png` });
  }
  reports.push({
    scene: scene.id,
    bytes: result.data.byteLength,
    stats: result.stats,
    gltf: { errors: gltf.numErrors, warnings: gltf.numWarnings, info: gltf.numInfos },
    quality: { passed: quality.passed, summary: quality.summary },
    reviewFrames: review?.frames.length ?? 0,
  });
  console.log(
    JSON.stringify({
      scene: scene.id,
      errors: gltf.numErrors,
      warnings: gltf.numWarnings,
      reviewFrames: review?.frames.length ?? 0,
    }),
  );
}
const browser = await chromium.launch({
  executablePath: process.env.FORGE_CHROMIUM_PATH,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
  const errors = [],
    requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  await page.goto(pathToFileURL(path.resolve(htmlPath)).href);
  await page.waitForFunction(() => window.forgeReady || window.forgeError);
  const error = await page.evaluate(() => window.forgeError);
  if (error) throw new Error(error);
  await page.getByRole('tab', { name: /Models/ }).click();
  await page.getByLabel('Category', { exact: true }).selectOption('Characters');
  await page.evaluate(() => window.forgeViewer.select('host'));
  await page.screenshot({ path: `${root}/workshop-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${root}/workshop-mobile.png` });
  if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)))
    throw new Error('Mobile horizontal overflow');
  await page.setViewportSize({ width: 1600, height: 1050 });
  await page.getByLabel('Example scene').selectOption('animationLab');
  await page.waitForFunction(
    () => window.forgeReady && window.forgeViewer.getSource().id === 'animationLab',
  );
  await page.evaluate(() => window.forgeViewer.select('wave'));
  await page.locator('[data-tool="rigging"] summary').click();
  await page.getByLabel('Show joints', { exact: true }).check();
  await page.getByLabel('Joint', { exact: true }).selectOption('rightArm');
  await page.screenshot({ path: `${root}/rigging-desktop.png` });
  if (errors.length || requests.length) throw new Error(JSON.stringify({ errors, requests }));
  // A sixth panel documents the editor as well as five rendered examples.
  frames.push({
    id: 'editor',
    name: 'Editor / Composable tools',
    image: `${root}/workshop-desktop.png`,
  });
  const cards = await Promise.all(
    frames.map(
      async (frame) =>
        `<article><img src="data:image/png;base64,${(await readFile(frame.image)).toString('base64')}"><p>${frame.name.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</p></article>`,
    ),
  );
  await page.setViewportSize({ width: 1600, height: 940 });
  await page.setContent(
    `<!doctype html><html><head><style>body{margin:0;background:#171d25;color:#edf2f7;font:16px system-ui;padding:24px}header{display:flex;justify-content:space-between;align-items:center;margin:0 0 18px}h1{font-size:22px;margin:0}header p{color:#ffbb73;margin:0}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}article{margin:0;background:#202832;border:1px solid #394654}img{display:block;width:100%;height:356px;object-fit:contain}article p{margin:0;padding:10px 14px;font-size:14px}</style></head><body><header><h1>Scene Forge 0.6 / Example Workshop</h1><p>Procedural · Editable · Portable</p></header><main>${cards.join('')}</main></body></html>`,
  );
  await page.screenshot({ path: `${root}/workshop-contact-sheet.png` });
  await writeFile(
    'docs/showcase-verification.json',
    JSON.stringify(
      {
        version: '0.6.0',
        checkedAt: new Date().toISOString(),
        platform: process.platform,
        node: process.version,
        scenes: reports,
        browser: {
          desktop: [1600, 1050],
          mobile: [390, 844],
          runtimeErrors: errors,
          httpRequests: requests,
          horizontalOverflow: false,
        },
        limitations: [
          'Native Blender and Godot imports were not tested.',
          'No inverse kinematics, arbitrary GLSL, manual vertex weight painting, or skeletal translation/scale tracks.',
        ],
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await browser.close();
}
