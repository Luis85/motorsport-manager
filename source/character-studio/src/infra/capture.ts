import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {realpathSync} from 'node:fs';
import {mkdir, open, rm, lstat} from 'node:fs/promises';
import {assertCharacter, type Character} from '../domain/character.js';
import {stateHash} from './store.js';
import {StudioError} from './files.js';
import {renderHtml} from './html.js';

export interface CaptureOptions {
  mode?: 'studio' | 'world' | 'portrait';
  light?: 'studio' | 'daylight' | 'night';
  pose?: 'idle' | 'walk' | 'work' | 'celebrate';
  camera?: 'front' | 'side' | 'back';
  width?: number;
  height?: number;
}
export function captureOptions(input: CaptureOptions = {}): Required<CaptureOptions> {
  const options = {mode:'studio',light:'studio',pose:'idle',camera:'front',width:1024,height:1024,...input} as Required<CaptureOptions>;
  const choices = {mode:['studio','world','portrait'],light:['studio','daylight','night'],pose:['idle','walk','work','celebrate'],camera:['front','side','back']};
  for (const key of Object.keys(input)) if (!(key in options) || ![...Object.keys(choices),'width','height'].includes(key)) throw new StudioError('INVALID_ARGUMENT',`Unknown capture option: ${key}.`);
  for (const key of Object.keys(choices) as (keyof typeof choices)[]) {
    if (!choices[key].includes(options[key])) throw new StudioError('INVALID_ARGUMENT',`Invalid ${key}: choose ${choices[key].join(', ')}.`);
  }
  for (const key of ['width','height'] as const) {
    if (!Number.isInteger(options[key]) || options[key] < 256 || options[key] > 4096) throw new StudioError('INVALID_ARGUMENT',`Capture ${key} must be an integer from 256 through 4096.`);
  }
  if (options.width * options.height > 8_388_608) throw new StudioError('SIZE_LIMIT','Capture dimensions exceed 8,388,608 pixels.');
  return options;
}

/** Resolve optional Playwright without making it a dependency of ordinary commands. */
export async function playwright() {
  try { return await import('playwright'); }
  catch (error) {
    if (!['ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND'].includes((error as NodeJS.ErrnoException).code || '')) throw error;
  }
  let entry = process.argv[1] || process.cwd();
  try { entry = realpathSync(entry); } catch { /* A missing entry cannot add a checkout search root. */ }
  const prefix = dirname(process.execPath);
  const roots = [process.cwd(),resolve(dirname(entry),'../source/character-studio'),process.platform === 'win32' ? prefix : resolve(prefix,'../lib')];
  for (const root of roots) {
    const load = createRequire(resolve(root,'character-studio-resolver.cjs'));
    try { return load('playwright') as typeof import('playwright'); }
    catch (error) { if (!['ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND'].includes((error as NodeJS.ErrnoException).code || '')) throw error; }
  }
  throw new StudioError('PLAYWRIGHT_UNAVAILABLE', 'Capture needs optional Playwright. Run npm ci in source/character-studio, install Playwright globally, or set NODE_PATH to its node_modules directory. Then run npx playwright install chromium, or set CHARACTER_STUDIO_CHROMIUM_PATH.', {searched:roots});
}

/** Explicit optional preflight: doctor never installs packages or changes the project. */
export async function captureDoctor() {
  let browser: Awaited<ReturnType<Awaited<ReturnType<typeof playwright>>['chromium']['launch']>> | undefined;
  try {
    const {chromium} = await playwright();
    browser = await chromium.launch({headless:true,executablePath:process.env.CHARACTER_STUDIO_CHROMIUM_PATH || undefined,
      args:['--enable-unsafe-swiftshader'],timeout:30_000});
    const page = await browser.newPage();
    const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
    return {ready:webgl,browser:browser.version(),webgl2:webgl,...(!webgl ? {recovery:'Use a Chromium installation with WebGL2 support.'} : {})};
  } catch (error) {
    return {ready:false,error:{code:(error as StudioError).code || 'CHROMIUM_UNAVAILABLE',message:(error as Error).message},
      recovery:'Install optional Playwright and Chromium, or set CHARACTER_STUDIO_CHROMIUM_PATH. Run discover for dependency resolution.'};
  } finally { await browser?.close(); }
}

/** A reusable browser session keeps multiview review bounded to one Chromium process. */
export async function captureSession(input: Character) {
  const character = assertCharacter(input);
  const html = renderHtml({initial:character});
  if (!html) throw new StudioError('ARTIFACT_REQUIRED','Capture needs the built executable. Run npm run build:cli.');
  const {chromium} = await playwright();
  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  try {
    browser = await chromium.launch({headless:true,executablePath:process.env.CHARACTER_STUDIO_CHROMIUM_PATH || undefined,
      args:['--enable-unsafe-swiftshader'],timeout:30_000});
  } catch (error) {
    throw new StudioError('CHROMIUM_UNAVAILABLE','Capture could not start Chromium. Run npx playwright install chromium or set CHARACTER_STUDIO_CHROMIUM_PATH.',{reason:(error as Error).message});
  }
  const errors: string[] = [];
  try {
    const page = await browser.newPage({viewport:{width:1024,height:1024},deviceScaleFactor:1,reducedMotion:'reduce'});
    page.on('pageerror',error => errors.push(error.message));
    await page.setContent(html,{waitUntil:'domcontentloaded',timeout:60_000});
    await page.waitForFunction(() => typeof (window as any).characterStudio?.preview?.capture === 'function',null,{timeout:60_000});
    if (errors.length) throw new StudioError('RENDER_FAILED','The editor failed to initialize.',{errors});
    return {page, close: () => browser.close(), async capture(inputOptions: CaptureOptions) {
    const options = captureOptions(inputOptions);
    await page.setViewportSize({width:options.width,height:options.height});
    const data = await page.evaluate(config => {
      const api = (window as any).characterStudio.preview;
      const canvas = document.querySelector<HTMLCanvasElement>('#viewport')!;
      if (canvas.dataset.renderer !== 'three-engine') throw new Error('WebGL character rendering is unavailable.');
      canvas.style.cssText = `position:fixed!important;inset:0!important;width:${config.width}px!important;height:${config.height}px!important;max-width:none!important;max-height:none!important;`;
      api.configure({mode:config.mode,light:config.light,pose:config.pose,camera:config.camera,paused:true,reset:true});
      return api.capture();
    },options);
    if (typeof data !== 'string' || !data.startsWith('data:image/png;base64,')) throw new StudioError('RENDER_FAILED','The preview did not return a PNG.');
    const bytes = Buffer.from(data.slice('data:image/png;base64,'.length),'base64');
    if (bytes.length < 24 || bytes.readUInt32BE(16) !== options.width || bytes.readUInt32BE(20) !== options.height) throw new StudioError('RENDER_FAILED','Captured dimensions do not match the requested dimensions.');
    return bytes;
    }};
  } catch (error) {
    await browser.close();
    if (error instanceof StudioError) throw error;
    throw new StudioError('RENDER_FAILED','The character renderer could not initialize. Check doctor --capture and the reported browser error.',{reason:(error as Error).message,errors});
  }
}

/** Capture the exported model at a fixed pose time, never advancing game state. */
export async function captureCharacter(input: Character, destination: string, inputOptions: CaptureOptions = {}) {
  const character = assertCharacter(input), options = captureOptions(inputOptions), output = resolve(destination);
  if (!output.toLowerCase().endsWith('.png')) throw new StudioError('INVALID_ARGUMENT','Capture output must use the .png extension.');
  try { await lstat(output); throw new StudioError('OUTPUT_EXISTS', `Output already exists: ${output}. Choose a new path.`); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const session = await captureSession(character);
  let bytes: Buffer;
  try { bytes = await session.capture(options); } finally { await session.close(); }
  await mkdir(dirname(output),{recursive:true});
  const handle = await open(output,'wx',0o600);
  try { await handle.writeFile(bytes); await handle.sync(); }
  catch (error) { await handle.close(); await rm(output,{force:true}); throw error; }
  finally { await handle.close().catch(() => {}); }
  return {output,bytes:bytes.length,recipeHash:stateHash(character),preview:{...options,paused:true,time:0},renderer:'wildlands-three',format:'png'};
}
