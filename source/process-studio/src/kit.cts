/**
 * The engine kit of a process play artifact and where this distribution gets it.
 *
 * `process build` writes the same HTML as `wildlands process build`: the Wildlands process template, every
 * insert the `process-play` profile selects (minified scripts, verbatim styles) and the Wildlands engine identity.
 * Process Studio embeds exactly that slice of the Wildlands engine kit (`ProcessKit`), not the engine:
 * `npm run build:cli` takes it from the kit embedded in the checked-in `bin/wildlands`, checks its payload digest and
 * recomputes the kit identity (see src/kit-source.cts). Any engine change changes that identity, so
 * `npm run check:cli` then reports bin/process-studio as stale until it is rebuilt.
 *
 * In a checkout (`npm run cli`, tests) the same slice is extracted from `bin/wildlands` on first use;
 * the bundle resolves `process-studio-embedded` to the precomputed, compressed slice instead.
 */
import {checkoutKit} from './kit-source.cjs';
import {inflatePayload, type Payload} from './payload.cjs';

export interface ProcessKit {
 readonly format: 'process-studio-kit';
 readonly schemaVersion: 1;
 /** Identity of the whole Wildlands engine kit: the `wildlands-engine` meta of every artifact. */
 readonly engine: string;
 /** Artifact profile the slice serves (`process-play`) and its template path. */
 readonly profile: string;
 readonly template: string;
 /** Include-expanded template text with its `{{NAME}}` tokens. */
 readonly templateText: string;
 /** Final inline content by insert marker: minified scripts, verbatim styles. */
 readonly inserts: Readonly<Record<string, string>>;
}
export interface Distribution {
 /** `bundle` for bin/process-studio, `checkout` when run from the TypeScript sources. */
 readonly kind: 'bundle' | 'checkout';
 /** SHA-256 over the bundled source closure (null in a checkout, where the sources are the identity). */
 readonly sourceIdentity: string | null;
 readonly kit: () => ProcessKit;
}
interface Embedded {readonly sourceIdentity: string; readonly kit: Payload;}

/** Structural check of a kit slice, embedded or extracted. */
export function checkKit(kit: ProcessKit): ProcessKit {
 const valid = kit.format === 'process-studio-kit' && kit.schemaVersion === 1 && /^[0-9a-f]{64}$/.test(kit.engine)
  && typeof kit.templateText === 'string' && Object.keys(kit.inserts).length > 0;
 if (!valid) throw Error('The process engine kit is malformed. Rebuild bin/process-studio.');
 return kit;
}

let cached: Distribution | null = null;
/** The bundle's embedded slice, else the checkout's slice extracted from bin/wildlands. */
export function distribution(): Distribution {
 if (cached) return cached;
 let embedded: Embedded | undefined;
 // Resolved only inside the bundle (scripts/bundle.cts); a checkout has no such module.
 try { embedded = require('process-studio-embedded') as Embedded; }
 catch (error) { if ((error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') throw error; }
 let kit: ProcessKit | null = null;
 if (embedded) {
  const payload = embedded.kit;
  const load = (): ProcessKit => checkKit(JSON.parse(inflatePayload(payload, 'engine kit')) as ProcessKit);
  return cached = {kind: 'bundle', sourceIdentity: embedded.sourceIdentity, kit: () => kit ??= load()};
 }
 return cached = {kind: 'checkout', sourceIdentity: null, kit: () => kit ??= checkKit(checkoutKit())};
}
