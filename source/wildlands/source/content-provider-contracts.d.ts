/**
 * Content-provider seam: the one way engine modules obtain game content.
 *
 * A game is a data-only content profile. The engine never loads game content files or reads
 * injected game data globals itself; an entry point installs exactly one profile per realm
 * (`LWContentProvider.install`) and modules request the sections they own. Sections are opaque
 * data here: each consuming module keeps its own validator, rejection texts and failure timing.
 * Schemas (scenario, world, growth, adventure, simulation) stay engine-owned and are not part of
 * a profile; the library schema is, because it carries the game's compiled identity vocabulary.
 */
declare namespace LWContentProvider {
 /** Profile contract version understood by this engine. A newer profile is rejected. */
 type Version=1;
 /** Ordered scenario catalog injected by the game (replaces built-in packs). */
 interface ScenarioCatalog {
  /** Scenario packs in presentation order; validated by scenario-runtime, never here. */
  readonly packs:readonly unknown[];
  /** Pack used when nothing is selected (`LWScenarios.defaultPack()`); must name one of `packs`. */
  readonly defaultId:string;
  /** Optional pack whose libraries, simulation, starting scenes and default world are refreshed from `balancing`. */
  readonly canonicalId?:string;
 }
 /** Creature catalog content: authored configuration, definitions and editor field descriptors. */
 interface CreatureContent {readonly configuration?:unknown;readonly definitions?:unknown;readonly editorFields?:unknown;}
 /** Pocket Pet content: the pet catalog and its optional presentation assets. */
 interface PetContent {readonly definitions?:unknown;readonly assets?:unknown;}
 /**
  * The canonical balancing defaults document (`littlewild-balancing` shape without its review
  * envelope): libraries {base, adventure, world, growth}, simulation, world, creatures,
  * interactions, interiors and startingScenes. Consumers validate the slices they own.
  */
 type Balancing=unknown;
 interface Profile {
  readonly format:'wildlands-content-profile';
  readonly version:Version;
  /** Stable game id (lowercase letters, digits and hyphens). */
  readonly id:string;
  /** Per-game save namespace, validated by LWStoryStorage; absent keeps the legacy Littlewild keys. */
  readonly storage?:{readonly namespace:string};
  readonly balancing?:Balancing;
  /** Library JSON Schema compiled with this game's identity vocabulary. */
  readonly librarySchema?:unknown;
  readonly creatures?:CreatureContent;
  /** 3D asset definitions for the colony asset catalog. */
  readonly assets?:unknown;
  readonly scenarios?:ScenarioCatalog;
  /** RTS catalog (`wildlands-rts` document). */
  readonly rts?:unknown;
  readonly pet?:PetContent;
  /** Business-process definition; owned by LWProcessCatalog. */
  readonly process?:unknown;
  /** Ordered business-process definitions of a multi-process game; `process` is the first entry. */
  readonly processes?:readonly unknown[];
 }
 type Section=Exclude<keyof Profile,'format'|'version'|'id'>;
 interface Api {
  /** Highest profile contract version this provider accepts. */
  readonly version:Version;
  /** Ordered list of optional profile sections. */
  readonly sections:readonly Section[];
  /** Install the realm's single profile. Re-installing the same object is a no-op; another profile is rejected. */
  install(profile:unknown):Profile;
  installed():boolean;
  /** The installed profile; throws "no game content installed" naming `what` when there is none. */
  get(what?:string):Profile;
  /**
   * Owners that admit content eagerly register here: the listener runs immediately when a game is
   * installed, otherwise synchronously inside `install`, in registration (module load) order. With
   * `section`, it runs only when the installed game declares that section; an undeclared section
   * then fails on first use with its owner's own rejection text.
   */
  whenInstalled(listener:()=>void,section?:Section):void;
  /** Browser transport: a profile from injected artifact data globals, or null when none are declared. */
  fromGlobals(root:object):Profile|null;
 }
}
