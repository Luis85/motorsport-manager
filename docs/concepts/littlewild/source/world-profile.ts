/* A world template is immutable authored data. This registry owns no simulation state.
 * The supported topology is a 19-cell square island with four edge bridges. */
(function (inputRoot: unknown) {
  'use strict';

  interface FixedSite { kind: string; x: number; y: number; }
  interface WorldProfile {
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
    LWDefaultProfile?: WorldProfile;
    LWWorldProfile?: WorldProfileApi;
  }
  const root = inputRoot as LittlewildRoot;

  const node = typeof module !== 'undefined' && module.exports;
  const content = (node ? require('./content-runtime.js') : root.LWContent) as ContentApi | undefined;
  const defaultProfile = (node ? require('./content/default-profile.json') : root.LWDefaultProfile) as WorldProfile | undefined;
  if (!content || !defaultProfile) throw Error('World profile dependencies are missing.');
  const C: ContentApi = content, defaults: WorldProfile = defaultProfile;

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

  let active = freeze(C.copy(defaults));
  let revision = hash(active);
  const api: WorldProfileApi = {
    defaults: freeze(C.copy(defaults)),
    hashOf: hash,
    get current() { return active; },
    get hash() { return revision; },
    apply(profile) { active = freeze(C.copy(profile)); revision = hash(active); },
    withProfile<T>(profile: WorldProfile, work: () => T): T {
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
  root.LWWorldProfile = api;
  if (node) module.exports = api;
})(globalThis);
