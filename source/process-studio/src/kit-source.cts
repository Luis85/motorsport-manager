/**
 * Checkout and build-time only: extract the process play slice of the Wildlands engine kit from a Wildlands CLI
 * bundle. The bundle (scripts/bundle.cts) replaces this module with a stub, so bin/process-studio never reads
 * bin/wildlands.
 *
 * `bin/wildlands` embeds its engine kit (source/wildlands/source/tools/engine-kit.cts) as one raw-deflate payload
 * line `const KIT = {"bytes":…,"sha256":…,"data":…};` written by tools/cli-bundle.cts, which parses the same line in
 * its own no-game-content check. The extractor verifies the payload size and SHA-256, the kit format and the kit
 * identity (recomputed exactly as engine-kit.cts computes it), then keeps the template and the inserts the
 * `process-play` profile selects, in the form `process build` places them.
 */
import fs from 'node:fs';
import path from 'node:path';
import {INSERTS, gameProfile, profileBundles, type ArtifactProfile} from './kernel.cjs';
import {inflatePayload, sha256, type Payload} from './payload.cjs';
import type {ProcessKit} from './kit.cjs';

interface EngineKit {
 readonly format: string;
 readonly schemaVersion: number;
 readonly identity: string;
 readonly templates: Readonly<Record<string, string>>;
 readonly inserts: Readonly<Record<string, {readonly min?: string; readonly raw?: string; readonly vendor?: string}>>;
 readonly tuners: readonly string[];
 readonly payloads: unknown;
}
/** The repository's checked-in Wildlands CLI, the kit source of a checkout and of `npm run build:cli`. */
export const WILDLANDS_BIN = path.resolve(__dirname, '../../../bin/wildlands');
const KIT_LINE = /^[ \t]*(?:const|var|let) KIT = (\{.*\});$/m;

/** The artifact profile of every `process build`: the process template's play profile. */
export function processPlayProfile(title = 'Process', namespace = 'wildlands.process'): ArtifactProfile {
 const game = {id: 'process', template: 'process', presentation: {title}, storage: {namespace}} as const;
 return gameProfile(game, 'play', new Set(['LWProcessDefinition', 'LWGameProfile']));
}

/** Parse and verify the engine kit embedded in a Wildlands CLI bundle. */
export function engineKitOf(bundle: string): EngineKit {
 const match = KIT_LINE.exec(bundle);
 if (!match) throw Error('The Wildlands CLI bundle carries no engine kit payload (const KIT = …). Rebuild bin/wildlands.');
 const kit = JSON.parse(inflatePayload(JSON.parse(match[1]!) as Payload, 'Wildlands engine kit')) as EngineKit;
 if (kit.format !== 'wildlands-engine-kit' || kit.schemaVersion !== 1) {
  throw Error('Unsupported Wildlands engine kit format: ' + String(kit.format) + ' ' + String(kit.schemaVersion));
 }
 const body = {templates: kit.templates, inserts: kit.inserts, tuners: kit.tuners, payloads: kit.payloads};
 if (sha256(JSON.stringify({format: kit.format, schemaVersion: kit.schemaVersion, ...body})) !== kit.identity) {
  throw Error('The Wildlands engine kit identity does not match its content.');
 }
 return kit;
}

/** The process play slice of a verified engine kit. */
export function processKitOf(kit: EngineKit): ProcessKit {
 const candidate = processPlayProfile(), bundles = profileBundles(candidate);
 const templateText = kit.templates[candidate.template];
 if (templateText === undefined) throw Error(`The Wildlands engine kit lacks template ${candidate.template}.`);
 const inserts: Record<string, string> = {};
 for (const insert of INSERTS.filter(entry => bundles.includes(entry[3]))) {
  const entry = kit.inserts[insert[0]], minified = insert[2] === 'script' && candidate.minify, text = minified ? entry?.min : entry?.raw;
  if (text === undefined) throw Error(`The Wildlands engine kit lacks ${minified ? 'minified ' : 'verbatim '}${insert[0]} for ${candidate.id}.`);
  inserts[insert[0]] = text;
 }
 return {format: 'process-studio-kit', schemaVersion: 1, engine: kit.identity, profile: candidate.id, template: candidate.template, templateText, inserts};
}

/** The slice from a Wildlands CLI bundle file (default: the checked-in bin/wildlands). */
export function checkoutKit(file = WILDLANDS_BIN): ProcessKit {
 if (!fs.existsSync(file)) throw Error('The engine kit source is missing: ' + file + '. Process Studio is built from the checked-in bin/wildlands.');
 return processKitOf(engineKitOf(fs.readFileSync(file, 'utf8')));
}
