/// <reference path="../content-provider-contracts.d.ts" />
/**
 * Engine distributions carry no game. In the bundled CLI (`bin/wildlands`, tools/cli-bundle.cts)
 * and in the trusted Godot runtime bundle (tools/wildlands-bundle.cts) the transitional game
 * installers (`content-installers/littlewild-game` and `template-games`) resolve to this module
 * instead: it installs nothing, so engine modules load without content and fail on their first
 * content request unless the entry point installed a game first (a game folder for the CLI, the
 * project's embedded game for the Godot runtime). The profile constructors reject explicitly.
 * Its only require is the content provider, at the same relative depth as the installers it
 * replaces, so the substitution keeps every literal require of the runtime closure valid.
 */
type Profile=LWContentProvider.Profile;
export const NO_BUNDLED_GAME='This Wildlands engine distribution carries no game content. Install a game first: pass --game DIR (a game folder) or use a schemaVersion 2 project, which embeds its game.';

/** The realm's content provider (the same instance engine modules resolve). */
export function contentProvider():LWContentProvider.Api{
 return require('../content-provider.js') as LWContentProvider.Api;
}
/** The installed game, if the entry point installed one; never installs. */
function current():Profile|undefined{
 const provider=contentProvider();
 return provider.installed()?provider.get():undefined;
}
export function installLittlewild():Profile|undefined{return current();}
export function installTemplate(_kind:'rts'|'pet'):Profile|undefined{return current();}
export function littlewildProfile():Profile{throw Error(NO_BUNDLED_GAME);}
export function rtsProfile():Profile{throw Error(NO_BUNDLED_GAME);}
export function petProfile():Profile{throw Error(NO_BUNDLED_GAME);}
export function petAssets():unknown{return undefined;}
