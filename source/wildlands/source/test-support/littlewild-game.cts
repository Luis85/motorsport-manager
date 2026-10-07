/// <reference path="../content-provider-contracts.d.ts" />
/**
 * Transitional bundled-game support: the Littlewild colony content profile, assembled from the
 * compiled `.generated` content exactly as the browser build injects it (balancing defaults,
 * compiled library schema, creature catalog, asset catalog and the three colony scenario packs).
 *
 * Engine modules never load these files; Node entry points (SDKs, CLIs, the Godot runtime) and
 * tests install this profile until game folders provide profiles (Phase 3/4). JSON is read with
 * literal require() calls so the single-file CLI bundle embeds exactly these documents.
 */
type Profile=LWContentProvider.Profile;

/** Littlewild's three colony packs in their established presentation order; Littlewild is the default. */
export function littlewildProfile():Profile{
 return {
  format:'wildlands-content-profile',version:1,id:'littlewild',storage:{namespace:'littlewild'},
  balancing:require('../content/balancing.json') as unknown,
  librarySchema:require('../content/library.schema.json') as unknown,
  creatures:{
   configuration:require('../creature-config.json') as unknown,
   definitions:require('../creature-definitions.json') as unknown,
   editorFields:require('../creature-editor-fields.json') as unknown
  },
  assets:require('../asset-definitions.json') as unknown,
  scenarios:{
   packs:[require('../content/littlewild.pack.json'),require('../content/emberworks.pack.json'),require('../content/office.pack.json')] as unknown[],
   defaultId:'littlewild',canonicalId:'littlewild'
  }
 };
}

/** The realm's content provider (the same instance engine modules resolve). */
export function contentProvider():LWContentProvider.Api{
 return require('../content-provider.js') as LWContentProvider.Api;
}

/** Install Littlewild unless the process already installed a game (tests install the showcase). */
export function installLittlewild():Profile{
 const provider=contentProvider();
 return provider.installed()?provider.get():provider.install(littlewildProfile());
}
