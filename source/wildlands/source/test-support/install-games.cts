/// <reference path="../content-provider-contracts.d.ts" />
/**
 * Test support: install the composite showcase profile before any engine module is used.
 *
 * Every Node suite requires this module first, the way the showcase fixture artifact declares all
 * of its data globals: Littlewild defaults with its three colony packs (Littlewild is the default
 * and canonical pack), plus the RTS and Pocket Pet catalogs. It has no storage namespace, so the
 * legacy Littlewild save keys apply, exactly as in `.generated/artifacts/showcase.html`.
 */
import {contentProvider,littlewildProfile} from './littlewild-game.cjs';
import {petProfile,rtsProfile} from './template-games.cjs';

export function showcaseProfile():LWContentProvider.Profile{
 const {storage:_storage,...colony}=littlewildProfile();
 return {...colony,id:'showcase',rts:rtsProfile().rts,pet:petProfile().pet!};
}
export const profile:LWContentProvider.Profile=contentProvider().installed()?contentProvider().get():contentProvider().install(showcaseProfile());
