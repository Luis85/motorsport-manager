/**
 * Execution probe of the process-hostile-browser and process-hostile-editors-browser suites (ENG-16): detects any hostile definition
 * text that became markup, a handler or a script anywhere in a page, and serves the studio with a report-only Content Security
 * Policy so an inline handler or script that the page never had is reported even before it runs.
 *
 * `probeScript` runs in every page before its first script (`addInitScript`) and keeps, on `globalThis.__probe`:
 * - `hits`: every `__hit(n)` call (the payloads of process-hostile-models.ts call it, so a number names the payload that ran);
 * - `errors`: `error` events (what `window.onerror` sees) and unhandled rejections;
 * - `csp`: `securitypolicyviolation` events of the report-only policy (directive and sample);
 * - `nodes`: elements created after the document finished parsing that hostile text could produce: `script`, `img`, `iframe`,
 *   `object`, `embed`, `frame`, `base`, `meta`, `link`, SVG `image` or `foreignObject`, any element with an `on*` attribute,
 *   a `srcdoc`, or a URL attribute (`href`, `src`, `xlink:href`, `action`, `formaction`, `data`, `poster`) that starts with
 *   `javascript:` or `data:text/html`. The studio itself creates none of them; it builds its maps and charts from SVG shapes and
 *   text. A MutationObserver watches the document and every shadow root attached later (attachShadow is wrapped).
 * `scan()` also walks the live document, open shadow roots included, for the same nodes, so markup made before the observer
 * started or in a detached-then-inserted tree is found too. `read()` flushes pending mutation records first.
 */
import crypto from 'node:crypto';
import type {Page} from 'playwright';

export interface ProbeFacts {hits: number[]; errors: string[]; csp: string[]; nodes: string[]; scanned: string[]}

/** Installed with `addInitScript`; must be self-contained (it is serialised into the page). */
export function probeScript(): void {
 type Probe = {hits: number[]; errors: string[]; csp: string[]; nodes: string[]; observers: MutationObserver[]; scan(): string[]; flush(): void};
 const g = globalThis as unknown as {__probe?: Probe; __hit?: (n: number) => void};
 if (g.__probe) return;
 const probe: Probe = {hits: [], errors: [], csp: [], nodes: [], observers: [], scan: () => [], flush: () => undefined};
 g.__probe = probe;
 g.__hit = (n: number) => { probe.hits.push(n); };
 const TAGS = new Set(['script', 'img', 'iframe', 'object', 'embed', 'frame', 'base', 'meta', 'link', 'image', 'foreignobject']);
 const URLS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'data', 'poster']);
 const PARSED = new Set(['script', 'meta', 'link', 'base']);
 // eslint-disable-next-line no-control-regex
 const urlish = (value: string) => /^(javascript|data:text\/html)/i.test(value.replace(/[\u0000- ]/g, ''));
 /** Why `el` could come from hostile text, or '' when it could not. */
 function suspicious(el: Element): string {
  const tag = el.localName.toLowerCase();
  const parsing = document.readyState === 'loading';
  if (TAGS.has(tag) && !(parsing && PARSED.has(tag))) return '<' + tag + '>';
  for (const a of Array.from(el.attributes)) {
   const name = a.name.toLowerCase();
   if (name.startsWith('on')) return `<${tag} ${name}>`;
   if (name === 'srcdoc') return `<${tag} srcdoc>`;
   if (URLS.has(name) && urlish(a.value)) return `<${tag} ${name}=${a.value.slice(0, 40)}>`;
  }
  return '';
 }
 function record(node: Node): void {
  if (!(node instanceof Element)) return;
  const own = suspicious(node);
  if (own) probe.nodes.push(own);
  for (const el of Array.from(node.querySelectorAll('*'))) {
   const why = suspicious(el);
   if (why) probe.nodes.push(why);
  }
 }
 function watch(target: Node): void {
  const observer = new MutationObserver(list => {
   for (const m of list) {
    if (m.type === 'attributes' && m.target instanceof Element) {
     const why = suspicious(m.target);
     if (why) probe.nodes.push(why);
    }
    m.addedNodes.forEach(record);
   }
  });
  observer.observe(target, {childList: true, subtree: true, attributes: true});
  probe.observers.push(observer);
 }
 const attach = Element.prototype.attachShadow;
 Element.prototype.attachShadow = function(this: Element, init: ShadowRootInit): ShadowRoot {
  const shadow = attach.call(this, init);
  watch(shadow);
  return shadow;
 };
 watch(document);
 probe.flush = () => {
  for (const o of probe.observers) {
   for (const m of o.takeRecords()) {
    if (m.type === 'attributes' && m.target instanceof Element) {
     const why = suspicious(m.target);
     if (why) probe.nodes.push(why);
    }
    m.addedNodes.forEach(record);
   }
  }
 };
 probe.scan = () => {
  const found: string[] = [];
  const walk = (scope: Document | ShadowRoot) => {
   for (const el of Array.from(scope.querySelectorAll('*'))) {
    // The page's own parsed head and script elements are not data; the observer reports any added after parsing.
    const why = PARSED.has(el.localName) ? '' : suspicious(el);
    if (why) found.push(why);
    if (el.shadowRoot) walk(el.shadowRoot);
   }
  };
  walk(document);
  return found;
 };
 addEventListener('error', e => { probe.errors.push(String(e.message || e.type)); }, true);
 addEventListener('unhandledrejection', e => { probe.errors.push('unhandled: ' + String(e.reason)); });
 document.addEventListener('securitypolicyviolation', e => {
  probe.csp.push(`${e.violatedDirective} ${e.blockedURI} ${e.sample}`.trim());
 });
}

/**
 * The init script text: `probeScript` inside a scope that defines `__name`, the helper the TypeScript loader wraps named
 * functions with when it compiles this file (the page does not have it, and the probe must not add a global of its own).
 */
export const probeSource = (): string => `(() => { const __name = (f) => f; (${probeScript.toString()})(); })();`;

/** Everything the probe saw on `page` so far, plus a fresh scan of the live document. */
export async function readProbe(page: Page): Promise<ProbeFacts> {
 return page.evaluate(() => {
  const p = (globalThis as unknown as {__probe: {hits: number[]; errors: string[]; csp: string[]; nodes: string[]; flush(): void; scan(): string[]}}).__probe;
  p.flush();
  return {hits: [...p.hits], errors: [...p.errors], csp: [...p.csp], nodes: [...p.nodes], scanned: p.scan()};
 });
}

/** The facts of a page on which nothing hostile ran or was created. */
export const CLEAN: ProbeFacts = {hits: [], errors: [], csp: [], nodes: [], scanned: []};

/**
 * A report-only policy that allows exactly the inline scripts of `html` (by SHA-256) and nothing else: an injected script, inline
 * handler or `javascript:` URL is reported as a violation while the page keeps working (report-only never blocks).
 */
export function reportOnlyPolicy(html: string): string {
 const hashes = new Set<string>();
 for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  hashes.add(`'sha256-${crypto.createHash('sha256').update(m[1]!, 'utf8').digest('base64')}'`);
 }
 return `script-src ${[...hashes].join(' ')}; object-src 'none'; base-uri 'none'`;
}

/** Serves `html` at `url` for `page` only (page routes win over the fixture's context route) with the report-only policy. */
export async function serveWithPolicy(page: Page, url: string, html: string): Promise<void> {
 await page.unroute(url);
 await page.route(url, route => route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: html,
  headers: {'content-security-policy-report-only': reportOnlyPolicy(html)}}));
}
