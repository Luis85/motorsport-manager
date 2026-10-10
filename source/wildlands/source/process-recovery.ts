/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-draft.ts" />
/// <reference path="./process-guard.ts" />
/**
 * Draft recovery for Process Studio (ENG-9): the studio's only use of browser storage, and its storage policy.
 *
 * What is stored: at most one recovery copy of the unapplied draft per process and running definition, in `localStorage`, under
 *   `<namespace>.process-draft.v1:<digest>:<process id>:<fingerprint>`
 * where `<namespace>` is the game's `storage.namespace` (`wildlands-process` when the page has none), `<digest>` is the built page's
 * `<meta name="wildlands-game-digest">` (`local` when absent, for example in a downloaded HTML) and `<fingerprint>` is
 * `LWProcessCatalog.fingerprint` of the running (applied) definition. The value is JSON `{text, savedAt, processName}`: the draft text
 * exactly as written, the wall-clock time in milliseconds (presentation only: it names the copy, it never reaches the engine) and the
 * process name. Nothing else (runs, seeds, selections, the undo history) is stored.
 *
 * When: about one second after the last draft change (a UI debounce), and at once before switching process or leaving the page.
 * Only a draft that differs from the running definition is kept; a draft written back to the running definition removes the copy,
 * as do applying it, replacing the process (import) and Discard saved draft. Writing a copy removes older copies of the same process
 * for other fingerprints. A copy over 1 MiB is not stored, and the status line says so once.
 *
 * Offer: on load and after switching to a process, a copy for this digest, process and running fingerprint that differs from the
 * running definition and from the current draft is offered in the shared Cancel-first question ("Recover draft from 14:05?", with the
 * date when it is not today): Not now (the default; keeps the copy), Discard saved draft (removes it) and Recover draft (writes it into
 * the draft store; nothing is applied). A copy for another fingerprint (the running definition changed since) is never offered.
 *
 * Every storage access is wrapped: when storage is blocked or throws (private mode, quota), nothing is stored or offered and the
 * studio works as before. Nothing here ticks, applies or touches a session.
 */
declare namespace LWProcessRecovery {
 /** The stored value. */
 interface Copy {text: string; savedAt: number; processName: string}
 /** The running definition a copy belongs to. */
 interface Target {id: string; name: string; fingerprint: string}
 interface Env {
  /** The game's storage namespace, or '' for none. */
  namespace: string;
  /** The built page's game digest, or '' for none. */
  digest: string;
  draft: LWProcessDraft.Store;
  /** The active process and the fingerprint of its running definition. */
  target(): Target;
  choose(options: LWProcessGuard.ChooseOptions): Promise<string>;
  status(message: string): void;
  /** Wall-clock milliseconds for `savedAt`; defaults to Date.now (presentation only). */
  now?(): number;
  /** The storage area; defaults to window.localStorage. May throw. */
  storage?(): Storage;
 }
 interface Surface {
  /** Writes (or removes) the pending copy now; call before switching process and when the page goes away. */
  flush(): void;
  /** Removes the copy of a running definition (it was applied, replaced or discarded) and drops a pending save for it. */
  forget(target: Target): void;
  /** Offers the active process's copy when one applies; resolves after the answer (or at once). Focus returns to `invoker`. */
  offer(invoker: HTMLElement | null, fallback: () => HTMLElement | null): Promise<void>;
  /** The stored copy for a target, if any (read-only). */
  read(target: Target): Copy | null;
  dispose(): void;
 }
 interface Api {
  create(env: Env): Surface;
  key(namespace: string, digest: string, target: Target): string;
  /** 'HH:MM' for today, 'YYYY-MM-DD HH:MM' otherwise, in local time. */
  when(savedAt: number, now: number): string;
  readonly MAX_BYTES: number;
  readonly DELAY_MS: number;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessRecovery?: LWProcessRecovery.Api};
 const MAX_BYTES = 1024 * 1024, DELAY_MS = 1000, VERSION = 'process-draft.v1';
 const prefix = (namespace: string, digest: string, id: string) => `${namespace || 'wildlands-process'}.${VERSION}:${digest || 'local'}:${id}:`;
 const key = (namespace: string, digest: string, t: LWProcessRecovery.Target) => prefix(namespace, digest, t.id) + t.fingerprint;
 const pad = (n: number) => String(n).padStart(2, '0');
 function when(savedAt: number, now: number): string {
  const at = new Date(savedAt), today = new Date(now), time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  return day === `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}` ? time : `${day} ${time}`;
 }
 function parse(raw: string | null): LWProcessRecovery.Copy | null {
  if (raw === null) return null;
  try {
   const v = JSON.parse(raw) as Partial<LWProcessRecovery.Copy>;
   const ok = v && typeof v.text === 'string' && typeof v.processName === 'string' && Number.isFinite(v.savedAt);
   return ok ? {text: v.text!, savedAt: v.savedAt!, processName: v.processName!} : null;
  } catch { return null; }
 }
 function create(env: LWProcessRecovery.Env): LWProcessRecovery.Surface {
  const now = env.now ?? (() => Date.now());
  /** Runs a storage action; any throw (blocked storage, quota) reads as "no storage" and changes nothing. */
  const use = <T,>(action: (s: Storage) => T): T | undefined => {
   try { return action(env.storage ? env.storage() : window.localStorage); } catch { return undefined; }
  };
  const keyOf = (t: LWProcessRecovery.Target) => key(env.namespace, env.digest, t);
  let pending: {target: LWProcessRecovery.Target; text: string} | null = null, timer = 0, disposed = false;
  /** Keys whose draft was too large; the status line says so once per key until a smaller draft fits again. */
  const oversize = new Set<string>();
  function write(t: LWProcessRecovery.Target, text: string): void {
   const k = keyOf(t), value = JSON.stringify({text, savedAt: now(), processName: t.name});
   if (new TextEncoder().encode(value).length > MAX_BYTES) {
    use(s => s.removeItem(k));
    if (!oversize.has(k)) env.status('This draft is larger than 1 MiB, so no recovery copy is kept in this browser. Export the draft to keep it.');
    oversize.add(k); return;
   }
   oversize.delete(k);
   use(s => {
    const stale: string[] = [], start = prefix(env.namespace, env.digest, t.id);
    for (let i = 0; i < s.length; i++) { const other = s.key(i); if (other && other !== k && other.startsWith(start)) stale.push(other); }
    for (const other of stale) s.removeItem(other);
    s.setItem(k, value);
   });
  }
  function flush(): void {
   window.clearTimeout(timer); timer = 0;
   const p = pending; pending = null; if (!p) return;
   // Read at write time, not per keystroke: a draft holding the running definition (even reformatted) needs no copy.
   if (env.draft.same(p.text)) use(s => s.removeItem(keyOf(p.target))); else write(p.target, p.text);
  }
  const unsubscribe = env.draft.subscribe(event => {
   if (disposed) return;
   // 'enter' resets the draft after an apply, import or switch: a pending save belongs to the definition that was just left.
   if (event.source === 'enter') { window.clearTimeout(timer); timer = 0; pending = null; return; }
   pending = {target: env.target(), text: event.text};
   window.clearTimeout(timer); timer = window.setTimeout(flush, DELAY_MS);
  });
  const read = (t: LWProcessRecovery.Target) => parse(use(s => s.getItem(keyOf(t))) ?? null);
  function forget(t: LWProcessRecovery.Target): void {
   if (pending && keyOf(pending.target) === keyOf(t)) { window.clearTimeout(timer); timer = 0; pending = null; }
   use(s => s.removeItem(keyOf(t)));
  }
  async function offer(invoker: HTMLElement | null, fallback: () => HTMLElement | null): Promise<void> {
   const t = env.target(), copy = read(t);
   if (!copy || copy.text === env.draft.read()) return;
   if (env.draft.same(copy.text)) { forget(t); return; }
   const at = when(copy.savedAt, now());
   const choice = await env.choose({
    title: `Recover draft from ${at}?`, invoker, focusFallback: fallback,
    message: `This browser kept an unapplied draft of ${copy.processName} from ${at}. Recover draft puts it back into the draft without`
     + ' applying it; Discard saved draft deletes the copy; Not now keeps it for later.',
    choices: [{id: 'cancel', label: 'Not now'}, {id: 'discard', label: 'Discard saved draft'}, {id: 'recover', label: 'Recover draft'}],
   });
   if (disposed || keyOf(env.target()) !== keyOf(t)) return;
   if (choice === 'recover') {
    env.draft.write(copy.text, 'recovery');
    env.status(`Draft recovered from ${at}. Nothing is applied; review it in the Definition editor.`);
   } else if (choice === 'discard') {
    forget(t); env.status('Saved draft discarded. The running definition is unchanged.');
   } else env.status('Saved draft kept. It is offered again when this process opens.');
  }
  return {
   flush, forget, offer, read,
   dispose() { if (disposed) return; flush(); disposed = true; unsubscribe(); },
  };
 }
 root.LWProcessRecovery = {create, key, when, MAX_BYTES, DELAY_MS};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessRecovery;
})(globalThis);
