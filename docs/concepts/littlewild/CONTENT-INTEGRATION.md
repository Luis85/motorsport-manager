> **Current integration note:** This retained reference describes the four content libraries and their introduction. For schema-2 worlds/scenes, complete scenario resource catalogs and envelope 10, read `CONFIGURATION.md`. Obsolete envelope-9 stories are rejected; native state and ordinary compatible stories remain version 8. Historical bundled-only asset statements below describe the earlier release, not current pack portability.

> V14 compatibility note: these mechanics, content formats and pause rules are retained unchanged. See README.md, CHANGELOG.md and VERIFICATION.md for the current presentation changes and release evidence.

# Littlewild v13 — Content integration compatibility

**No content-format change in v13.** Base, Adventure, World and Growth libraries and schemas are byte-identical to the supplied v12 defaults. Existing authoring exports, validators and examples remain applicable. Story format remains 8.

Equipment `visual` and `color` fields remain gameplay-content hints, but the concrete bundled equipment meshes now live in the 3D asset catalog. PR25 adds an internal `littlewild-3d-asset` manifest for build-time assets; this is **not** a new scenario/content import format. Creature geometry, carried-item meshes, equipment meshes, building models and their visual anchors are no longer embedded in the renderer.

The new pause preference is separate device configuration (`littlewild.interface.v1`) and is not a content patch or story field. Exchanging a library does not alter that preference.

## Retained format reference

The guide below describes the existing supported authoring contracts. Earlier version references identify the introduction of a format, not a newly changed schema.

# V12 content integration

V12 is a presentation/input release. Base, Adventure, World and Growth definitions and schemas are **byte-identical to v11**. Portable story format remains 8; Growth schema remains 2. No content authoring migration is required. The original content-authoring kit remains compatible.

The tile menu uses existing runtime definitions and validators; it is not a separate content file. External definitions cannot inject executable context-menu handlers. Visual quality is a local browser preference. A **bundled, immutable visual-asset registry** now serves engine-owned models from `source/assets/`; third-party runtime 3D ingestion, textures, shader graphs and scenario-supplied assets are still not introduced.

The following is the unchanged v11 content contract, retained for reference:

# External component authoring — Littlewild v11

The game remains self-contained. JSON exports let another tool maintain content without editing the browser UI. Definitions and a live story are separate. An exported content library contains no personal inventory, placed buildings or earned prestige; a story contains instances and its exact four libraries.

## Four families

| Family | Document | Owns |
|---|---|---|
| Base | `default-library.json` / `library.schema.json` | Existing items, recipes, skills, blueprints, disciplines, learning paths and related definitions. |
| Adventure | `adventure-library.json` / `adventure.schema.json` | Equipment, weights, quest templates, personality/traits, RPG mappings, chests and behavior tree. |
| World | `world-library.json` / `world.schema.json` | Resource-node modes/yields, initial authored sites, workplace capacities and logistics. |
| Growth | `growth-library.json` / `growth.schema.json` | Player requirements/research, creature slots, prestige, home places, land prices, shop packages, interaction definitions and event rules. |

Base, Adventure and World preserve their existing versioned formats. Growth is `format: littlewild-growth-content`, `schemaVersion: 2`. Application v11 writes portable story format 8. Do not change format versions to bypass validation.

## Tooling

The content kit includes a `runtime/` folder with the same pure validators and their dependencies. From its root:

```sh
node runtime/tools/content-cli.cjs validate runtime/content/default-library.json
node runtime/tools/adventure-cli.cjs validate runtime/content/adventure-library.json
node runtime/tools/world-cli.cjs validate runtime/content/world-library.json
node runtime/tools/growth-cli.cjs validate runtime/content/growth-library.json
node runtime/tools/growth-cli.cjs export > my-growth-library.json
node runtime/tools/growth-cli.cjs schema > growth.schema.json
node runtime/tools/growth-cli.cjs diff examples/new-island-interaction.json
```

The source package instead stores those files under `source/`. The Growth CLI reads an entire document of at most 1 MiB; it never edits inputs. Exit status: 0 accepted, 1 invalid content, 2 invocation/I/O failure. It emits structured JSON. `diff` is a bounded review summary with paths and before/after values, not executable JSON Patch or an automatic three-way merge.

Base supports its earlier library/collection/record exchange. Growth currently imports/exports complete libraries, not separate component patches. Keep stable IDs and use tool-owned `extensions` for metadata. Names and descriptions are not code.

## Player and feature requirements

`requirements` maps `items`, `skills`, `recipes`, `buildings` and `features` to records with `playerLevel`, `features` (feature→rank) and optional `research`. These guards are enforced by domain commands as well as operational UI filtering. Item requirements constrain explicit gathering, autonomous sourcing, recipe outputs, equipment preparation and prestige-shop acquisition. Existing possessions and quest findings are not confiscated, and routine consumption of food already carried retains the existing self-care rules. Missing optional requirements default to player level one and no extra rank.

A research record declares its cost, guide level, prerequisite feature ranks, optional rank grant and unlocked targets. Targets use `category:id`. Add the requirement link when authoring a new research gate; a description or an `unlocks` label alone does not change an engine feature. Existing feature actions and Base identifiers must remain supported by code. The validator checks references, duplicate IDs and modeled unreachable/self-dependent rank requirements; this is not a general-purpose workflow theorem prover.

Defaults explicitly mark the starter shelter, bench, storehouse, planks and rope as known. Keep a viable starter route when changing gates: survival, first shelter, resource processing and a way to earn research cannot all depend on one another.

## Slots, housing, prestige and land

Growth rules configure initial/max slots, prestige base/growth and level gates, successful-quest prestige, land base costs/growth, level requirement and island cap. `maxSlots` must fit Adventure's `rules.maxCreatures`; changing only one incompatible cap is rejected.

`homes.shelter` and `homes.cottage` define `places` and `perLevel`. This is capacity per completed building instance, not a population-wide entitlement. A live import cannot invalidate resident assignments or committed work. Use a new story for such a redesign.

Land uses an engine-owned four-neighbor topology and deterministic island generation. Growth configures acquisition economics and cap; World configures node and production rules. Arbitrary island shapes, new movement modes and new building behaviors require code.

## Interaction definitions

The registry supports two known handlers:

- **care:** choose an existing native care action. It inherits that command's eligibility, cost, effects and cooldown. Its `cost` and `effects` must be empty and `cooldown` zero; nonempty overrides are rejected rather than silently ignored. Labels, descriptions, icon and event availability are data-driven.
- **moment:** declarative carried-item costs plus bounded `bond`, `joy`, `anger`, `social` effects and a cooldown. There is no script/eval/function field. Use this handler for externally authored social moments.

`eventOnly: true` means the normal card does not show the definition unless an active event instance exists. Event rules contain `id`, `trigger`, `interaction`, `seconds`. Registered triggers are `home-assigned`, `quest-success`, `temper`, `arrival`, `island-purchased`. Adding a new trigger or handler needs a code hook; adding a new moment using those handlers does not.

The full `examples/new-island-interaction.json` adds:

```json
{
  "id": "shore-picnic",
  "label": "Share a shore picnic",
  "description": "Celebrate a newly connected island with a berry from this creature’s satchel.",
  "icon": "berries",
  "handler": "moment",
  "eventOnly": true,
  "cooldown": 120,
  "cost": {"berries": 1},
  "effects": {"bond": 3, "joy": 6, "anger": -3}
}
```

This record is illustrative; import the included full library rather than this fragment. Its event lasts 300 simulated seconds after island acquisition. Only the recipient's carried berry can pay the cost. The action disappears after use or expiry. A paused game does not expire simulated-time events.

## Safe apply workflow

Export → edit externally → validate with JSON Schema AND runtime CLI → import via More → Growth library → review the differences → apply or cancel.

The preview stores the active library fingerprint and refuses a stale review. An identical document has no enabled Apply action. Mechanical edits are blocked around committed tasks, production, quests and sales unless an explicit new story is requested. Presentation-only edits can be applied around existing work if the candidate story remains valid. Current-state compatibility is validated before committing the new registry. Canceled/asynchronous imports cannot reopen stale previews.

Growth fingerprints wrap the entire Growth document, not just the Base-library fields. This release includes regressions for edits to rules, requirements, event timing, labels and metadata; property-order changes do not change identity. Mechanical fingerprints exclude presentation labels/descriptions/icons/extensions. Embedded mismatched snapshots are rejected. These are consistency checks, not signed security assertions.

Root-property strictness differs in the inherited formats: for example, the Adventure schema is structurally permissive in places. Always use its runtime validator too. The kit does not claim arbitrary imported schemas or arbitrary scripts are safe to execute; the game executes neither.

## Authoring boundary

Do not use a content file to grant inventory, change a creature's identity, instant-complete an order, or bypass a locked shop. Export a story only for a deliberate scenario/save workflow. Keep the original story before migration and before applying new rules. Older application releases cannot load a format-8 save.

## V11 cartography contract and migration

Growth `schemaVersion: 2` requires `cartography`. It has `tableBuilding` (`map_table`), `distanceLevelStep`, `cooldown`, `eventChance`, `guaranteedAfterMisses`, and exactly four `biomes`. Each biome declares a stable supported ID, description, minimumLevel and nonempty unique questIds referencing Adventure templates. Repeated biome IDs, missing templates, duplicate pool entries, invalid probabilities and unrepresentable endgame island prices are rejected. Runtime validation now enforces minimum collection sizes and unique entries in addition to maximum bounds.

The new map table is an ordinary Base building definition and an explicit Growth requirement/research link, not a World resource-node type. Base contains 23 building definitions. The existing Adventure and World default files/schemas are unchanged. Base and Growth changed for this requested dependency; do not expect their hashes to match v10.

A live Adventure change cannot delete a quest still referenced by Growth's island pools, even when applying to a new story with the same active Growth library. Reconcile linked definitions before importing. Mechanical changes remain blocked around committed work. A library edit never grants research, builds the map table, buys an island, moves a creature or awards prestige.

Current stories preserve island-specific invitation clocks, origins and recent settlement receipts in `state.atlas`. These are story data, not content definitions. The clock uses simulated time. Quest origins are copied into accepted, away and history records so later UI selection cannot retarget them. Active snapshots freeze the requirements and targets used for that journey.

Previous portable stories are migrated explicitly by the story importer, with a preview. Importing a v10 story and exporting its Growth library yields a validated schema-2 pack while retaining authored old definitions. For a standalone old Growth pack without its story, merge the new `cartography`, map-table requirement and `blueprint-map-table` research record from the current default, set schemaVersion to 2, and run validation. Review defaults rather than deleting errors or changing version alone. Add the Base map-table definition when maintaining the Base pack too. Unknown IDs/behaviors still require engine support.

A new map-table research cost or level is reflected by the UI from the definitions. Added/removed import fields now show “Not present” instead of blank values or a preview exception. Tool metadata remains escaped text and is preserved via `extensions`. The source and content kit include the event-interaction example updated to the current contract.
