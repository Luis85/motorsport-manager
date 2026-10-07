import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

export async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  // Exercise full desktop Chromium, including its WebGL preview lifecycle.
  // Without a channel Playwright selects the separate headless-shell binary.
  const args = ["--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader"];
  const browser = await chromium.launch({headless:true,...(executablePath ? {executablePath} : {channel:"chromium"}),args});
  try {
    const installed = createRequire(__filename);
    const version = (name: string) => (installed(`${name}/package.json`) as {version: string}).version.slice(0,96);
    console.log(JSON.stringify({kind:"littlewild-browser-provenance",node:process.version,
      playwright:version("playwright"),playwrightCore:version("playwright-core"),
      browser:browser.version().slice(0,96),selection:executablePath ? "explicit-override" : "bundled-desktop-chromium",args}));
  } catch {
    // Observation must preserve a successfully launched browser even if stdout is unavailable.
  }
  return browser;
}

/**
 * Observe every page, including replacement/custom-pack pages, before its first navigation.
 * `fixtureUrls` (opt-in, for suites that load through `openArtifact`) records those exact routed
 * document URLs in `fixtureRequests` instead of `requests`; every other http(s) request is still raw.
 */
export function monitorContext(context: BrowserContext, options: { fixtureUrls?: readonly string[] } = {}) {
  const errors: string[] = [], consoleProblems: string[] = [], requests: string[] = [], fixtureRequests: string[] = [];
  const fixtures = new Set(options.fixtureUrls ?? []);
  context.on("page", page => {
    page.on("pageerror", error => errors.push(String(error)));
    page.on("console", message => {
      if (["error", "warning"].includes(message.type())) consoleProblems.push(`${message.type()}: ${message.text()}`);
    });
    page.on("request", request => {
      if (!/^https?:/.test(request.url())) return;
      if (fixtures.has(request.url()) && request.resourceType() === "document") fixtureRequests.push(request.url());
      else requests.push(request.url());
    });
  });
  return options.fixtureUrls ? { errors, consoleProblems, requests, fixtureRequests } : { errors, consoleProblems, requests };
}

/** Fixed fixture origin for artifacts served from memory. It is routed, never resolved on a network. */
export const ARTIFACT_FIXTURE_URL = "https://localhost/wildlands-artifact.html";
/** Navigation budget for loading a multi-megabyte single-file artifact; separate from action timeouts. */
export const DEFAULT_NAVIGATION_TIMEOUT_MS = 60_000;

export interface OpenArtifactOptions {
  /** Fixture URL to route; distinct URLs let one context serve several artifacts. */
  url?: string;
  /** Explicit navigation timeout (default 60 s). Never inherited from the page's action timeout. */
  navigationTimeout?: number;
  /** When given, also sets the page's default action timeout. */
  actionTimeout?: number;
  waitUntil?: "load" | "domcontentloaded";
  /** Serve this HTML instead of reading `artifactPath` (for derived or rebuilt artifacts). */
  html?: string;
}

const artifactCache = new Map<string, string>();
const routedDocuments = new WeakMap<BrowserContext, Map<string, string>>();

/** Read once per process; artifacts are immutable for the lifetime of a gate run. */
export function readArtifact(artifactPath: string): string {
  let html = artifactCache.get(artifactPath);
  if (html === undefined) { html = readFileSync(artifactPath, "utf8"); artifactCache.set(artifactPath, html); }
  return html;
}

/**
 * Open a single-file artifact from memory through `context.route` on a fixed fixture URL.
 * Unlike `page.setContent`, navigation has its own explicit timeout instead of the (often 5 s)
 * action timeout, and the page gets a stable secure origin. The routed document request is
 * observable as the fixture URL in `monitorContext(...).requests` unless `fixtureUrls` names it.
 */
export async function openArtifact(page: Page, artifactPath: string, options: OpenArtifactOptions = {}): Promise<{ url: string; navigationMs: number }> {
  const url = options.url ?? ARTIFACT_FIXTURE_URL;
  const html = options.html ?? readArtifact(artifactPath);
  const context = page.context();
  let documents = routedDocuments.get(context);
  if (!documents) { documents = new Map(); routedDocuments.set(context, documents); }
  const served = documents;
  if (!served.has(url)) await context.route(url, route => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: served.get(url) ?? "" }));
  served.set(url, html);
  if (options.actionTimeout !== undefined) page.setDefaultTimeout(options.actionTimeout);
  const started = Date.now();
  await page.goto(url, { waitUntil: options.waitUntil ?? "load", timeout: options.navigationTimeout ?? DEFAULT_NAVIGATION_TIMEOUT_MS });
  return { url, navigationMs: Date.now() - started };
}

/** Readiness budget after load: booting the multi-megabyte artifact is not a 5 s user action. */
export const READY_TIMEOUT_MS = 60_000;

/**
 * Wait for the shared ready signal (RUNTIME-CONTRACTS.md): every host (colony shell, standalone
 * RTS/Pet host, play-boot) sets `window.__wildlandsReady = true` and
 * `document.documentElement.dataset.wildlandsReady` to its host id only after its public APIs
 * exist, then dispatches `wildlands:ready`. A boot that throws never signals ready, so the wait
 * fails instead of treating a half-booted page as interactive. `host` additionally requires the
 * named host id (for example `colony`, `rts` or `pet`).
 */
export async function waitForReady(page: Page, options: { timeout?: number; host?: string } = {}): Promise<void> {
  await page.waitForFunction(host => {
    if ((window as unknown as { __wildlandsReady?: unknown }).__wildlandsReady !== true) return false;
    return host === null || document.documentElement.dataset.wildlandsReady === host;
  }, options.host ?? null, options.timeout === undefined ? {} : { timeout: options.timeout });
}

/**
 * Install Playwright's controllable clock. Call it before `openArtifact` so timers, Date and
 * requestAnimationFrame are virtual from the first script; the page then advances only through
 * `advanceClock`, replacing fixed sleeps with exact simulated durations.
 */
export async function installClock(page: Page, time: number | string | Date = 0): Promise<void> {
  await page.clock.install({ time });
}

/** Advance the installed virtual clock, firing every due timer and animation frame in order. */
export async function advanceClock(page: Page, milliseconds: number): Promise<void> {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error("Clock advance requires a finite non-negative duration");
  await page.clock.runFor(milliseconds);
}

/** Freeze virtual time at an instant (timers stop firing) for stable captures and inspections. */
export async function pauseClockAt(page: Page, time: number | string | Date): Promise<void> {
  await page.clock.pauseAt(time);
}

/**
 * Action budget for ordinary controls (click, fill, select, focus). The former 5–7 s budgets were
 * exceeded under concurrent suites on a 4-core host; a control that is not actionable within this
 * budget is a real failure, not load.
 */
export const ACTION_TIMEOUT_MS = 15_000;
/**
 * Budget for a control whose handler synchronously builds or replaces a whole world (Begin, a scene
 * launch, entering an interior or an embedded application). Playwright's click resolves only after
 * that handler returns, measured at 2–8 s per click on a contended 4-core host, so it is a scene
 * transition rather than an ordinary user action. Use it only for such clicks.
 */
export const TRANSITION_TIMEOUT_MS = 60_000;
/** Fixed virtual start instant for suites that install the clock, so Date values are deterministic. */
export const CLOCK_START = "2026-01-01T00:00:00.000Z";

/** Freeze virtual time at the page's current virtual instant; timers and frames stop until resumed or advanced. */
export async function pauseClock(page: Page): Promise<void> {
  await page.clock.pauseAt(await page.evaluate(() => Date.now()));
}

/** Let virtual time flow with real time again after `pauseClock`/`pauseClockAt`. */
export async function resumeClock(page: Page): Promise<void> {
  await page.clock.resume();
}

/**
 * Resolve after the page has rendered `count` further animation frames (style, layout, resize
 * observers and paint run between them): an explicit rendering condition, not a duration. With an
 * installed clock the frames come from virtual time, so the clock must not be paused.
 */
export async function nextFrames(page: Page, count = 2): Promise<void> {
  await page.evaluate(total => new Promise<void>(resolve => {
    let remaining = total;
    const step = (): void => { remaining -= 1; if (remaining <= 0) resolve(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), count);
}

/**
 * Wait until `predicate` holds before a check asserts that same state. A timeout is deliberately not
 * thrown here: the check's own assertion then reports the failure under its name instead of
 * aborting the suite. The predicate must be a function (the artifacts' CSP rejects string predicates).
 */
export async function settle<Arg>(page: Page, predicate: (arg: Arg) => unknown, arg: Arg, timeout = ACTION_TIMEOUT_MS): Promise<boolean> {
  try { await page.waitForFunction(predicate, arg, { timeout }); return true; }
  catch { return false; }
}

/**
 * Per-page fixture URL on its own origin. Artifacts served from one origin share localStorage (and
 * the colony saves on pagehide), so pages that must each start fresh use distinct origins.
 */
export const fixtureUrl = (label: string): string => {
  if (!/^[a-z0-9-]{1,40}$/.test(label)) throw new Error("Fixture labels are short lowercase host labels");
  return `https://${label}.localhost/wildlands-artifact.html`;
};
