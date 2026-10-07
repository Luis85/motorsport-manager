/// <reference path="../content-provider-contracts.d.ts" />
/**
 * Transitional runtime game installers (not test code) for the RTS and Pocket Pet templates, kept apart from the
 * Littlewild profile so the colony CLI bundle never embeds their catalogs or pet meshes. Each profile is its
 * compiled game folder (docs/concepts/rts-frontier, docs/concepts/pocket-pet), which build.ts writes with
 * `compileGame` to `.generated/games/<id>.profile.json`; literal require() calls read it.
 */
import {contentProvider} from './littlewild-game.cjs';
type Profile=LWContentProvider.Profile;

/** A fresh top-level object per call; sections are the shared parsed document (install freezes only the top level). */
export function rtsProfile():Profile{
 return {...require('../games/rts-frontier.profile.json') as Profile};
}
export function petProfile():Profile{
 return {...require('../games/pocket-pet.profile.json') as Profile};
}
/** Install a template game unless the process already installed one (tests install the showcase). */
export function installTemplate(kind:'rts'|'pet'):Profile{
 const provider=contentProvider();
 return provider.installed()?provider.get():provider.install(kind==='rts'?rtsProfile():petProfile());
}
