# Runtime contracts and extension ownership

`source/runtime-contracts.d.ts` owns value-only points, action failures and gameplay
notification payloads. Engine, colony, world and interaction ports borrow these
contracts rather than declaring separate error or event protocols. Rejection text
and legacy return fields remain intact. `LWRuntimeResults.failure` adds a stable
`FailureCode`; command routing annotates older rejected results. Successful results
and Boolean authorities retain their existing values. The factory formats results;
it never decides whether a gameplay action is permitted.

The nineteen existing event names retain their text and append order. Events remain
synchronous method calls and observations on the stable engine facade. In particular,
`village-systems.emit('temper', ...)` grants the configured gameplay care opportunity
before it returns. Its authority does not depend on rendering, draining notifications,
or a delayed event bus. The regression emits a temper event on a headless real engine
and observes the grant immediately.

## Adding an application adapter

`source/application-adapters.ts` is a compiled, closed installation manifest, after
the six existing composition layers finalize. The `living-world-v1` archetype and
simulation phase identities are unchanged. Installation order is commands,
interactions, settings, scenario workflow, scenario resources, construction,
terraform, skill trees, interiors. Construction precedes interiors so completion retains its
physical construction authority before interior cleanup.

Each entry declares its required global role, new methods, wrapped predecessor
methods, static changes and ordering prerequisites. The installer checks the entire
proposal before invoking a role, rejects missing roles/predecessors, duplicate IDs,
wrong order and repeated installation, then checks actual prototype/static changes
against the declaration. `describe(Engine)` returns frozen installed descriptors
with predecessor owners. Existing adapters still capture actual predecessor functions;
the manifest does not replace their gameplay logic or create another engine.

A failed preflight leaves the facade untouched. A failure during installation marks
that facade unusable for retry: an adapter may already have installed a nonconfigurable
property. Discard that bootstrap and resolve the adapter defect before rebuilding.
Factories and native reconstruction continue to use the same composed facade.

## Adding data or contracts

The domain map references `architecture/data-ownership.json` and
`architecture/contract-ownership.json`; those companions extend its metadata and are
not runtime state owners. Every JSON file below `source/content` and `source/assets`
must match exactly one ownership entry. Entries declare a stable ID, bounded path
pattern, existing context owner, kind, compiled validator role and optional embedded
global. The validator-role table in `tools/architecture-data.cts` names existing
admission authorities. Uploaded JSON cannot supply a validator, module or callback.
Known gameplay handler IDs remain data accepted by their existing closed validators.
Historical regression JSON is excluded by individually named paths and reasons;
a newly added fixture must be explicitly inventoried.

Every project declaration file has an owner. The contract checker follows triple-slash
references, erased imports, import types and resolved semantic type references in
project-owned sources. It ignores dependency declarations and compiler libraries,
and rejects outward project edges. Explicit DOM types belong to presentation ports.
Physical ECS and interior layout records have their own inward declarations;
application engine state and aggregate save validation stay in application ports.
The pure `construction-footprints.ts` projection supplies occupied cells to both
physical grids and application construction policies, so the grid does not depend
on its topology validator. Construction and terraform use the neutral coordinate
contract instead of borrowing a renderer or interior coordinate authority.

`test-architecture-extensions.cts` covers rejected adapter proposals and undeclared
changes, frozen predecessor metadata, data ownership/validator adversaries, executable
payloads, inward type contracts, valid/invalid TypeScript callers, actual facade
reconstruction and synchronous temper grants. The design follows the concrete ownership and extension plan in
`RESEARCH-IMPROVEMENT-PLAN.md`. The normal architecture and strict
compiler gates also run against the complete authored tree.

The compiled skill-tree adapter wraps reward settlement, work/learning rates, arrival and import. It adds validated player/creature attachment and rank commands without introducing a clock or a second XP authority. See [skill trees](../../docs/reference/skill-trees.md).

## Optional runtime capabilities

A play-only artifact may omit template, editor, export or payload bundles. The
runtime declares what is present instead of assuming it:

- Template hosts publish one descriptor each (`LWRTSHost`, `LWPetHost`,
  `embedded-app-contracts.d.ts`). The colony shell mounts only the descriptors
  present, in that explicit order, and runs at most one at a time. `standalone()`
  runs a host as the whole page with its own frame loop and a focusable re-entry
  launcher after the player exits; its exit control then reads "Close RTS demo"
  or "Close Pocket Pet". Each host alone installs its public global
  (`WildlandsRTS`, `WildlandsPet`). The colony shell reads the developer
  session, scenario library, workspace and template hosts as optional globals,
  and the RTS host keeps its Mission editor launcher focusable with a reason when
  the mission editor bundle is absent.
- The scenario library, Wildlands workspace and engine-export panel keep absent
  tools as full-label, focusable launchers with `aria-disabled` and a visible
  reason. `Wildlands.capabilities()`, `Littlewild.scenarioUI.capabilities()` and
  `LWDeveloper.capabilities()` report detached availability with reasons. Absent
  toolbox facets stay on the frozen toolbox and reject use with an explicit
  `operation-failed` reason.
- `WildlandsGodot.capability()` and `LWEngineExport.capability()` report absent
  Godot runtime, template or engine-source payloads without inflating anything;
  compilation and export fail with the same explicit message.
- Saves are scoped by `LWGameProfile.storage.namespace` (`LWStoryStorage.namespace`,
  `keys`, `scoped`). No profile, or the `littlewild` namespace, keeps exactly
  `littlewild.save.v5`, `littlewild.backup.v5` and their migrations. Any other
  namespace (for example `wildlands.office`) uses `<namespace>.save.v5` and
  `<namespace>.backup.v5`, never migrates another game's story and scopes device
  preferences the same way.
- Each host sets `window.__wildlandsReady = true`, sets
  `document.documentElement.dataset.wildlandsReady` to its host id (`colony`,
  `rts` or `pet`) and then dispatches one `wildlands:ready` window event whose
  `detail.host` names it, after its public APIs exist. Standalone play artifacts
  (`play-boot`) mount their host through the descriptor's `create`/`api`, publish
  `WildlandsPlay` and then the same signal with the app id; a failed boot never
  signals ready.
- `LWAssets` starts with an empty catalog when no `LWAssetDefinitions` list is
  declared (a standalone pet admits its own definitions through `validate()`);
  a declared list must still be a valid 1–256 catalog, and every artifact profile
  that runs the colony declares one.

`test-runtime-optionality.cts` and `verification/runtime-optionality-browser.ts`
(registered as `runtime-optionality` and `runtime-optionality-browser`) cover these
seams; `verification/artifact-play-browser.ts` covers the assembled play artifacts.

## Game content provider

The engine runs only with an installed game content profile. `source/content-provider.ts`
(`LWContentProvider`, contract `content-provider-contracts.d.ts`, version 1) is the single seam
between engine modules and game data; no runtime module requires a game content file
(`content/*.json` other than engine schemas, `assets/**`, or the generated asset/creature/
interaction projections) or reads an injected game data global. The TypeScript architecture
check "Runtime modules read game content only through the installed content provider" enforces
both rules with regression probes.

- A profile is `{format: 'wildlands-content-profile', version: 1, id, storage?, balancing?,
  librarySchema?, creatures?: {configuration?, definitions?, editorFields?}, assets?,
  scenarios?: {packs, defaultId, canonicalId?}, rts?, pet?: {definitions?, assets?}}`.
  Admission checks only the envelope (closed fields, own enumerable data properties, no accessor
  is invoked, a newer version is rejected, `defaultId`/`canonicalId` name listed packs). Section
  contents stay opaque: each owning module validates its section with its existing rejection
  texts. The profile is shallow-frozen; section data is never copied or mutated by the provider.
- One profile per realm: re-installing the same object is a no-op; installing another is
  rejected ("game content is already installed (<id>); a realm runs exactly one game").
- `get(what)` throws `Wildlands: no game content installed (<what> requested)` when nothing is
  installed. Modules request content lazily, so every engine module loads without a game and
  fails on its first content request instead. Owners that admitted content at load before
  register with `whenInstalled(listener, section?)`: with a game already installed the listener
  runs at once (unchanged failure timing for invalid bundled data); otherwise it runs inside
  `install`, in module load order, only when the game declares that section.
- `LWContent.tables` keeps one stable identity and is filled by the default registry when the
  game's library is admitted; `registry`, `SCHEMA` and the other content-derived exports
  (`LWCreatures.defaults`, `LWSimulationProfile.current`, `LWRTSCatalog.data`, …) are getters.
- Scenario packs are an injected catalog: `builtins()` lists `scenarios.packs` in declared order,
  `defaultPack()`/`defaultId()` replace the former first built-in, and only the declared
  `canonicalId` pack (Littlewild today) is refreshed from the game's balancing defaults on a
  detached copy. `LWStoryStorage` namespaces come from the installed profile's `storage`.
- Browser transport: artifacts still declare their data globals ahead of every module; the
  engine-kernel bundle loads the provider first (`CONTENT_PROVIDER`), and it installs the
  profile adopted from those globals (`fromGlobals`; `LWGameProfile` carries `storage`).
- Node: entry points install before using content. `developer-sdk` (and through it the project
  SDK, `wildlands-runtime`, the Godot runtime and `bin/wildlands`) and the colony CLIs install the
  bundled Littlewild profile from `source/content-installers/littlewild-game.cts` when nothing
  is installed; `rts-cli`/`pet-cli` install their template game from
  `source/content-installers/template-games.cts`. These runtime installers are part of the
  Godot runtime closure and the CLI bundle, so they live outside `source/test-support/`, which
  holds only test code: every Node suite first requires `source/test-support/install-games.cts`,
  the composite showcase profile. `simulation.cjs` loads the provider but installs nothing. The
  bundled installers are transitional until game folders supply profiles.

### Game folders

A game's data lives in its own folder, `docs/concepts/<id>/` (or under `WILDLANDS_GAMES_DIR`),
described by `game.json` (`source/schemas/game.schema.json`: format `wildlands-game`,
schemaVersion 1, `template` colony/rts/pet, `engine.api` 1, closed and bounded objects).
Folders are data only and are never executed. `source/tools/game-folder.cts` (build-only):

- `loadGame(dir)` checks the closed inventory (every file is named by `game.json`, is an asset
  `definition.json` under `content.assets`, or is README.md/PROVENANCE.md/LICENSE*; code,
  markup, executable modes, symbolic links, hidden names, more than 2,048 files, 8 MiB per file,
  32 MiB in total or 8 levels are rejected), the manifest grammar and its value rules (id equals
  the folder name; storage namespace `wildlands.<id>`, or the legacy `littlewild` namespace for
  the Littlewild game only; html output `demos/<id>.html`), and returns the inventory and digest
  (SHA-256 over `path NUL sha256 LF` lines in path byte order; byte-based, so whitespace or key
  order changes it).
- `compileGame(dir)` / `profile(dir)` / `dataGlobals(dir)` project the folder into this
  content profile and the artifact data globals (with `LWGameProfile` and the engine-owned
  schemas) using the bundled build's projections. The canonical pack (`content.canonicalId`)
  inherits balancing defaults; the interaction catalog must equal the balancing `interactions`.
- `validateGame(dir)` adds the engine's runtime validators in a fresh process (one game per
  realm: balancing, every scenario pack, skill tree, interaction library, RTS/pet catalog, the
  creature/asset/interior owners on install and the balancing audit) and returns
  `{ok, id, digest, errors}`. Adventure examples are parsed reference documents, not admitted.

The transitional Littlewild installer reads the `.generated` documents the build compiles from
the Littlewild folder, plus the pending Emberworks/Office packs.

`test-content-provider.cts` (registered as `content-provider`) covers load-without-content,
later installation, envelope admission, the browser adoption of data globals, the injected
scenario catalog and the provider's position in every built artifact.
