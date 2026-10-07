import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { validateBytes } from 'gltf-validator';
import {
  loadProject,
  createPreview,
  exportScene,
  screenshot,
  auditScene,
  reviewScene,
  authoringTarget,
  parse,
  ReviewPlanSchema,
} from '../dist/index.js';

// Regenerate the shipped artifacts after a successful build and test run.
const exports = [];
const qualityReports = [],
  reviews = [];
for (const [project, stem, htmlName, selected] of [
  ['examples/outpost', 'outpost', 'outpost', 'scout'],
  ['examples/composition', 'field-station', 'composer', 'alpha'],
  ['examples/procedural', 'logistics', 'composer', 'rackB'],
]) {
  const snapshot = await loadProject(project);
  const quality = auditScene(snapshot.scene, snapshot.models);
  qualityReports.push({ project, ...quality });
  if (!quality.passed) throw new Error(`Quality gate failed: ${JSON.stringify(quality.findings)}`);
  const directory = `${project}/exports`;
  await mkdir(directory, { recursive: true });
  const html = await createPreview(snapshot.scene, snapshot.models, {
    stateHash: snapshot.stateHash,
  });
  const htmlPath = `${directory}/${htmlName}.html`;
  await writeFile(htmlPath, html);
  for (const node of [undefined, ...(project.endsWith('outpost') ? ['scout'] : [])]) {
    const result = await exportScene(snapshot.scene, snapshot.models, 'glb', node);
    const file = `${directory}/${node ? 'rover' : stem}.glb`;
    await writeFile(file, result.data);
    const report = await validateBytes(result.data);
    if (report.issues.numErrors || report.issues.numWarnings)
      throw new Error(`glTF validation failed: ${JSON.stringify(report.issues)}`);
    exports.push({
      file,
      bytes: result.data.byteLength,
      sha256: createHash('sha256').update(result.data).digest('hex'),
      errors: report.issues.numErrors,
      warnings: report.issues.numWarnings,
      informationalMessages: report.issues.messages.filter((m) => m.severity >= 2).length,
      stats: result.stats,
    });
  }
  await screenshot(html, `${directory}/${stem}.png`, {
    width: 1600,
    height: 1000,
    view: 'iso',
    grid: false,
    ui: false,
  });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.FORGE_CHROMIUM_PATH,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
    const errors = [],
      network = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (/^https?:/.test(request.url())) network.push(request.url());
    });
    await page.goto(pathToFileURL(path.resolve(htmlPath)).href);
    await page.waitForFunction(() => window.forgeReady || window.forgeError);
    const error = await page.evaluate(() => window.forgeError);
    if (error) throw new Error(error);
    await page.evaluate((id) => window.forgeViewer.select(id), selected);
    await page.getByRole('button', { name: 'Move', exact: true }).click();
    await page.getByRole('tab', { name: /Models/ }).click();
    const prefix = project.endsWith('outpost') ? 'preview' : 'composer';
    await page.screenshot({ path: `${directory}/${prefix}-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Frame', exact: true }).click();
    await page.screenshot({ path: `${directory}/${prefix}-mobile.png` });
    if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)))
      throw new Error('Mobile overflow');
    if (errors.length || network.length) throw new Error(JSON.stringify({ errors, network }));
    console.log(
      JSON.stringify({
        project,
        browserErrors: errors,
        networkRequests: network,
        mobileOverflow: false,
      }),
    );
  } finally {
    await browser.close();
  }
  if (project.endsWith('procedural')) {
    const plan = parse(ReviewPlanSchema, {
      schemaVersion: 1,
      kind: 'review',
      frames: ['iso', 'front', 'right', 'back', 'left', 'top'].map((id) => ({
        id,
        camera: { view: id },
      })),
    });
    for (const model of [false, true]) {
      const parameters = { width: 3.6, height: 3.2, levels: 4, lanes: 3 };
      const target = model
        ? authoringTarget(snapshot.scene, snapshot.models, { model: 'rack', parameters })
        : snapshot.scene;
      const result = await reviewScene(
        target,
        snapshot.models,
        `${directory}/${model ? 'rack' : 'scene'}-review`,
        plan,
        {
          overwrite: true,
          sourceStateHash: snapshot.stateHash,
          target: model ? { model: 'rack', parameters } : { scene: snapshot.scene.id },
        },
      );
      reviews.push({
        target: model ? 'rack' : 'scene',
        frames: result.frames.length,
        durationMs: result.durationMs,
      });
    }
  }
}
await writeFile('docs/quality-reports.json', JSON.stringify(qualityReports, null, 2) + '\n');
const packageInfo = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile(
  'docs/verification.json',
  JSON.stringify(
    {
      version: packageInfo.version,
      checkedAt: new Date().toISOString(),
      platform: process.platform,
      node: process.version,
      releaseChecks: JSON.parse(await readFile('docs/checks.json', 'utf8')),
      browserChecks: {
        desktop: [1600, 1050],
        mobile: [390, 844],
        runtimeErrors: 0,
        httpRequests: 0,
        horizontalOverflow: false,
      },
      gltf: exports,
      quality: qualityReports.map((r) => ({
        project: r.project,
        passed: r.passed,
        summary: r.summary,
      })),
      reviews,
      limitations: [
        'Native Blender and Godot editor imports were not run.',
        'Screenshots use a local alternate Chromium executable; the managed environment browser download failed.',
        'macOS and Windows were not tested.',
        'Scene history does not freeze model definitions; multi-file registry updates are not crash-atomic.',
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log('Updated release examples and validation report.');
