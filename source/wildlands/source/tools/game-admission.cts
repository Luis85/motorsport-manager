/// <reference path="../content-provider-contracts.d.ts" />
/// <reference path="../developer-contracts.d.ts" />
/// <reference path="../rts-contracts.d.ts" />
/// <reference path="../pet-contracts.d.ts" />
/**
 * The engine's runtime admission of one compiled game folder, shared by the build
 * (tools/build-validation.cts) and engine distributions (tools/game-build.cts, `bin/wildlands
 * validate-game` / `build-game`). The realm must already have the game's profile installed (one
 * game per realm); engine modules are required lazily so they resolve that profile.
 *
 * The balancing consumption audit is the caller's: a checkout scans the authored engine sources
 * (balancing-audit.cts `auditBalancing`), a bundled distribution compares the declared tuners with
 * the consumers its engine kit recorded (`declaredTunerErrors`). Both reject the same drift between
 * a game's declared gameplay tuners and the engine's consumers.
 */
import fs from 'node:fs';
import path from 'node:path';
import type {CompiledGame} from './game-folder.cjs';
import type {ColonyContent} from './game-manifest.cjs';
type Profile = LWContentProvider.Profile;
/** Balancing consumption audit of a game's compiled balancing defaults; returns the problems. */
export type BalancingAudit = (balancing: unknown) => readonly string[];

/**
 * The scenario pack a game's balancing defaults define, assembled as `defaultScenario` assembles a
 * canonical pack: the template fields of the game's default pack (identity, presentation, tutorial)
 * with the balancing libraries, simulation, starting scenes and default world.
 */
export function defaultsPack(profile: Profile): unknown {
 const scenarios = profile.scenarios!, template = (scenarios.packs as Record<string, unknown>[]).find(pack => pack.id === scenarios.defaultId)!;
 const balance = profile.balancing as {libraries: unknown; simulation: unknown; startingScenes: unknown; world: unknown};
 const shell = Object.fromEntries(['format', 'schemaVersion', 'id', 'version', 'name', 'description', 'presentation', 'tutorial']
  .filter(key => Object.hasOwn(template, key)).map(key => [key, template[key]]));
 return {...shell, libraries: balance.libraries, simulation: balance.simulation, scenes: balance.startingScenes, worlds: [balance.world]};
}

/** Runtime validators of a colony game whose (or whose composite) profile is installed. */
export function admitColony(game: CompiledGame, profile: Profile, audit: BalancingAudit): void {
 const content = game.manifest.content as ColonyContent;
 const read = (file: string): unknown => JSON.parse(fs.readFileSync(path.join(game.root, file), 'utf8')) as unknown;
 const api = require('../developer-sdk.cjs') as {toolbox: LittlewildDeveloper.Toolbox};
 const scenarios = require('../scenario-runtime.js') as LWContentPorts.ScenarioApi;
 if (content.skillTree) (require('../skill-trees.js') as LWSkillTrees.Api).validate(read(content.skillTree));
 // Adventure examples are reference documents written against the item set of their time: an added
 // item makes a complete example library stale without making the game invalid, so they are parsed
 // (game-folder.cts) but not admitted here, exactly as the build never admitted them before.
 const interactions = api.toolbox.validateInteractionLibrary(read(content.interactions));
 if (!interactions.ok) throw Error('Interaction catalog: ' + interactions.errors.join('; '));
 // A canonical pack inherits the balancing defaults and is their baseline. Without one (every pack is
 // complete), the defaults are checked as the pack they define: libraries, simulation, starting scenes
 // and default world in an otherwise empty shell, the same values a canonical pack would inherit.
 const balance = api.toolbox.balancing.validate(profile.balancing, ...profile.scenarios?.canonicalId === undefined ? [defaultsPack(profile)] : []);
 if (!balance.ok) throw Error('Canonical balancing defaults: ' + balance.errors.map(error => error.path + ': ' + error.message).join('; '));
 for (const pack of scenarios.builtins()) {
  const result = api.toolbox.validateScenario(pack);
  if (!result.ok) throw Error('Shipped scenario ' + pack.id + ': ' + result.errors.join('; '));
 }
 const problems = audit(profile.balancing);
 if (problems.length) throw Error('Canonical balancing consumption: ' + problems.join('; '));
}

/** Runtime catalog validator of an RTS or Pocket Pet profile. */
export function admitTemplate(template: 'rts' | 'pet' | 'armored', profile: Profile): void {
 if (template === 'armored') {
  const catalog = (require('../armored-catalog.js') as LWArmoredData.CatalogApi).validate(profile.armored);
  const visuals = (require('../armored-visuals.js') as {validate(input: unknown): {assets: Record<string, unknown>}}).validate(profile.armoredVisuals);
  for (const vehicle of catalog.vehicles) if (!Object.hasOwn(visuals.assets, vehicle.asset)) throw Error('Armored vehicle has no admitted visual: ' + vehicle.asset);
 }
 else if (template === 'rts') (require('../rts-catalog.js') as LWRTSData.CatalogApi).validate(profile.rts);
 else (require('../pet-catalog.js') as LWPetData.CatalogApi).validate(profile.pet?.definitions);
}

/** Install the folder's own profile in this realm and run the engine's validators for its template. */
export function admitGameProfile(game: CompiledGame, audit: BalancingAudit): Profile {
 const profile = (require('../content-provider.js') as LWContentProvider.Api).install(game.profile);
 if (game.manifest.template === 'process') {
  const catalog = (require('../process-sdk.cjs') as typeof import('../process-sdk.cjs')).catalog;
  if (!profile.processes) catalog.admit(profile.process);
  // Every listed process is admitted on its own; a failure names its index so the author can find the file.
  (profile.processes ?? []).forEach((entry, index) => {
   try { catalog.admit(entry); } catch (error) { throw Error(`Process definition ${index} of ${profile.processes!.length}: ${error instanceof Error ? error.message : String(error)}`); }
  });
  return profile;
 }

 if (game.manifest.template === 'colony') admitColony(game, profile, audit);
 else admitTemplate(game.manifest.template, profile);
 return profile;
}
