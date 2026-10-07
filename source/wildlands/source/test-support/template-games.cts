/// <reference path="../content-provider-contracts.d.ts" />
/**
 * Transitional bundled-game support for the RTS and Pocket Pet templates, kept apart from the
 * Littlewild profile so the colony CLI bundle never embeds their catalogs or pet meshes.
 */
import {contentProvider} from './littlewild-game.cjs';
type Profile=LWContentProvider.Profile;

export function rtsProfile():Profile{
 return {format:'wildlands-content-profile',version:1,id:'rts-frontier',rts:require('../content/rts-demo.json') as unknown};
}
/** Pet presentation assets are optional: the Godot runtime bundle does not carry them. */
export function petAssets():unknown{
 try{return require('../pet-asset-definitions.json') as unknown;}catch{return undefined;}
}
export function petProfile():Profile{
 const assets=petAssets();
 return {format:'wildlands-content-profile',version:1,id:'pocket-pet',
  pet:{definitions:require('../content/pet-demo.json') as unknown,...assets===undefined?{}:{assets}}};
}
/** Install a template game unless the process already installed one (tests install the showcase). */
export function installTemplate(kind:'rts'|'pet'):Profile{
 const provider=contentProvider();
 return provider.installed()?provider.get():provider.install(kind==='rts'?rtsProfile():petProfile());
}
