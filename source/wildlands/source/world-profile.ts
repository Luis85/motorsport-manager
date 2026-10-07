/// <reference path="./content-provider-contracts.d.ts" />
/* A world template is immutable authored data. This registry owns no simulation state.
 * The supported topology is a 19-cell square island with four edge bridges. */
(function (inputRoot: unknown) {
  'use strict';

  interface FixedSite { kind: string; x: number; y: number; }
  interface WorldProfile {
    nodePolicy?:'profile-only';
    environment?:LWContentPorts.Environment;
    id: string;
    name: string;
    description: string;
    terrain: string[];
    biomeNames: Record<string, string>;
    resourceCounts: Record<string, number>;
    fixedSites: FixedSite[];
    groundColors: Record<string, string[]>;
    materialColors: Record<string, string>;
    placementPolicy: string;
  }
  interface ContentApi {
    copy<T>(value: T): T;
    stable(value: unknown): string;
  }
  interface WorldProfileApi {
    readonly defaults: WorldProfile;
    readonly current: WorldProfile;
    readonly hash: string;
    hashOf(profile: WorldProfile): string;
    apply(profile: WorldProfile): void;
    withProfile<T>(profile: WorldProfile, work: () => T): T;
  }
  interface LittlewildRoot {
    LWContent?: ContentApi;
    LWContentProvider?: LWContentProvider.Api;
    LWWorldProfile?: WorldProfileApi;
  }
  const root = inputRoot as LittlewildRoot;

  const node = typeof module !== 'undefined' && module.exports;
  const content = (node ? require('./content-runtime.js') : root.LWContent) as ContentApi | undefined;
  const provider = (node ? require('./content-provider.js') : root.LWContentProvider) as LWContentProvider.Api | undefined;
  if (!content || !provider) throw Error('World profile dependencies are missing.');
  const C: ContentApi = content, Content: LWContentProvider.Api = provider;

  function freeze<T>(value: T): T {
    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  function hash(profile: WorldProfile): string {
    const text = C.stable(C.copy(profile));
    let n = 2166136261;
    for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
    return (n >>> 0).toString(16).padStart(8, '0');
  }
  function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return value !== null && (typeof value === 'object' || typeof value === 'function') &&
      typeof (value as { then?: unknown }).then === 'function';
  }

  // The installed game's default world profile; admitted on first use or as soon as a game is installed.
  let defaults: WorldProfile | null = null, active: WorldProfile | null = null, revision = '';
  function load(): WorldProfile {
    if (defaults) return defaults;
    const balance = Content.get('the default world profile').balancing;
    const profile = (balance !== null && typeof balance === 'object' ? (balance as { world?: unknown }).world : undefined) as WorldProfile | undefined;
    if (!profile) throw Error('World profile dependencies are missing.');
    if (active === null) { active = freeze(C.copy(profile)); revision = hash(active); }
    return defaults = freeze(C.copy(profile));
  }
  const api: WorldProfileApi = {
    get defaults() { return load(); },
    hashOf: hash,
    get current() { load(); return active!; },
    get hash() { load(); return revision; },
    apply(profile) { active = freeze(C.copy(profile)); revision = hash(active); },
    withProfile<T>(profile: WorldProfile, work: () => T): T {
      load();
      const prior = active, priorHash = revision;
      try {
        this.apply(profile);
        const result = work();
        if (isPromiseLike(result)) throw Error('World profile callback must be synchronous.');
        return result;
      } finally {
        active = prior;
        revision = priorHash;
      }
    }
  };
  Content.whenInstalled(() => { load(); },'balancing');
  root.LWWorldProfile = api;
  if (node) module.exports = api;
})(globalThis);
