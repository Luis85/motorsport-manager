import path from "node:path";
import type { BrowserContext, Locator, Page } from "playwright";
import { advanceClock, ARTIFACT_FIXTURE_URL, monitorContext, openArtifact, pauseClockAt, READY_TIMEOUT_MS, waitForReady } from "./browser-harness";

/**
 * Artifact selection and page setup shared by the editor, export and renderer browser suites.
 *
 * Suites load the smallest generated artifact that contains what they exercise: `studio` (the colony
 * with its editors, developer tools and export payloads) or, only where a check needs the
 * showcase-only renderer example bundle, `showcase`. `LITTLEWILD_BROWSER_ARTIFACT` still overrides
 * the choice for a whole run.
 */
export type ArtifactId = "studio" | "showcase" | "colony-play";

export function artifactPath(root: string, id: ArtifactId): string {
  return process.env.LITTLEWILD_BROWSER_ARTIFACT || path.join(root, ".generated/artifacts", id + ".html");
}

/** Fixture URLs a suite's monitor records separately from real network requests. */
export const FIXTURE_URLS: readonly string[] = [ARTIFACT_FIXTURE_URL];

export interface ArtifactObservations { errors: string[]; consoleProblems: string[]; requests: string[]; fixtureRequests: string[]; }

/**
 * Raw diagnostics for a context whose pages load artifacts through `openColony`: the routed fixture
 * documents are recorded in `fixtureRequests` (suites assert their exact count), every other
 * http(s) request stays in `requests`, which must remain empty.
 */
export function monitorArtifacts(context: BrowserContext): ArtifactObservations {
  return monitorContext(context, { fixtureUrls: FIXTURE_URLS }) as ArtifactObservations;
}

/**
 * Open a colony artifact on the routed fixture origin and wait for the colony's ready signal.
 * Every page starts with empty storage, as a freshly opened file does: pages in one context share
 * the fixture origin, so a save written by an earlier page must not resume in a later one.
 * Navigation and readiness have their own budgets; `actionTimeout` sets only user-action waits.
 */
export async function openColony(page: Page, artifact: string, options: { actionTimeout?: number } = {}): Promise<void> {
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* storage may be unavailable */ } });
  await openArtifact(page, artifact, options.actionTimeout === undefined ? {} : { actionTimeout: options.actionTimeout });
  await waitForReady(page, { timeout: READY_TIMEOUT_MS, host: "colony" });
}

/**
 * Wait until the page has completed `count` rendering frames. Layout, ResizeObserver delivery and
 * the application's own requestAnimationFrame work for a frame all finish before the next frame's
 * callbacks run, so this waits for an event rather than for an assumed duration.
 */
export async function renderingFrames(page: Page, count = 2): Promise<void> {
  await page.evaluate(frames => new Promise<void>(resolve => {
    let remaining = frames;
    const next = (): void => { if (--remaining <= 0) resolve(); else requestAnimationFrame(next); };
    requestAnimationFrame(next);
  }), count);
}

/**
 * Budget for one synchronous domain operation triggered by a click: beginning the story, opening an
 * editor over a captured pack, reviewing, launching or entering a scene, applying an import or
 * conversion, starting cinematic transport, ordering production or visiting a building floor. The
 * handler validates, imports or projects native state before the click completes, so its duration
 * is CPU work rather than user-interface responsiveness; it is separate from the suite's short action
 * timeout, which still bounds finding the control visible, enabled, stable and receiving events.
 */
export const ADMISSION_TIMEOUT_MS = 60_000;

/** Wait for an actionable control with the page's action timeout, then click it with the admission budget. */
export async function admit(control: Locator): Promise<void> {
  await control.click({ trial: true });
  await control.click({ timeout: ADMISSION_TIMEOUT_MS });
}

/**
 * Pause an installed Playwright clock that is currently flowing. The page's clock keeps running
 * while the pause request travels, so a target already in the past is retried with a fresh reading.
 */
export async function freezeClock(page: Page): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    const now = await page.evaluate(() => Date.now());
    try { await pauseClockAt(page, now + 100); return; }
    catch (error) { if (attempt >= 20 || !/past/i.test(String(error))) throw error; }
  }
}

/**
 * Advance a paused Playwright clock in fixed virtual steps until `predicate` holds in the page.
 * Virtual time is deterministic: CPU contention slows the run but never changes how much simulated
 * time or how many animation frames elapse before the condition is checked.
 */
export async function advanceUntil(page: Page, predicate: () => boolean, options: { stepMs?: number; limitMs?: number } = {}): Promise<void> {
  const step = options.stepMs ?? 50, limit = options.limitMs ?? 15_000;
  for (let elapsed = 0; ; elapsed += step) {
    if (await page.evaluate(predicate)) return;
    if (elapsed >= limit) throw new Error(`Condition did not hold within ${limit} ms of virtual time: ${predicate.toString().slice(0, 200)}`);
    await advanceClock(page, step);
  }
}

interface PresentationRoot { Littlewild: { world: { snapshot(): { time: number } } }; }

/**
 * Wait until the colony render host has drawn at least `seconds` of presentation time. This is the
 * clock cinematics and host animations sample, so "N seconds of playback" no longer depends on how
 * many wall-clock milliseconds a contended CPU needed to render them.
 */
export async function presentationElapsed(page: Page, seconds: number, timeout = 30_000): Promise<void> {
  const start = await page.evaluate(() => (window as unknown as PresentationRoot).Littlewild.world.snapshot().time);
  await page.waitForFunction(({ start, seconds }) => (window as unknown as PresentationRoot).Littlewild.world.snapshot().time >= start + seconds,
    { start, seconds }, { timeout });
}
