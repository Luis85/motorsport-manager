# File-authored circuits and scenarios

## Author outside the game

Copy the entire `content/examples/club-racing` folder to an external location,
edit its JSON files, and pass that folder to the unchanged exported game:

```sh
./motorsport-manager.x86_64 -- --content-pack="/path/to/My Club Pack"
```

The existing setup library includes the new circuit. The SCENARIO chooser appears
when a selected pack supplies scenario definitions. Choosing an item is
observational. **Read brief** displays inert author text; **Review scenario** stages
that scenario's circuit and weekend preset. **Start practice** is the explicit
commit. The separate custom setup controls do not override an authored scenario.
Back or a rejected stage preserves the previous draft/save.

This adds no new racing format, executable goal, reward system or campaign.

## Circuit definition

A `circuit` record has the common `kind`, `schema_version`, `id`, `name` and
`description` fields, plus `document` and an optional `style_id`.
`document` is the existing `motorsport-manager-track` authoring document accepted
by Circuit Atelier: the same nodes, handles, grid, pit route, features, scenery,
timing gates and provenance. Existing positional-node imports remain supported.
Validation and normalization stay in `TrackDocument`; editor transactions stay
in `TrackEditorSession`.
Circuit Atelier scenery choices and contextual guide copy come from the bounded
[`editor_profile`](editor-profiles.md). The profile is authoring-only: placed scenery
is immediately ordinary track data, and guide actions/targets remain code-owned.

The outer stable ID is used by content references. The inner `document.id` is the
saved circuit identity. Both must remain stable when merely renaming a circuit;
use a new document ID for a genuinely separate circuit. Two selected catalog
records cannot claim the same document identity. `content.py clone` assigns a
new document ID when cloning a circuit. The visible circuit name comes from
`document.name`; the outer name labels the authoring definition.

The core catalog wraps the existing files named by `config/circuits/catalog.json` as
`core.circuit.<document-id>`. Those original JSON files remain the single source
of truth. Only the trusted built-in adapter can read that resource directory;
external pack paths remain confined to their selected folder.

The example `local.club.circuit.training` is a fourteen-place variant with document
ID `local.club.training`. Its source is `circuits/training.json`.

## Supported illustration styles

A `circuit_style` record contains a `visual` object with `environment` (`meadow`,
`woodland`, `coastal`), `season` (`summer`, `autumn`), and integer `seed` from 0 to
1,000,000. The example uses woodland/autumn/1975. These are combinations supported
by the existing circuit renderer, not arbitrary scripts, scenes, textures or
physics changes. The fully resolved visual values are frozen into the circuit
snapshot before launch. Changing a style cannot recolor an existing saved race.

## Complete-weekend scenario definition

A `scenario` record references `circuit_id` and `weekend_id`, and contains a `brief`:

```json
{
  "version": 1,
  "title": "Your first club weekend",
  "briefing": "Prepare two drivers for a complete club weekend.",
  "approaches": ["Preserve a set and stay out longer", "Spend a set for a tyre offset"],
  "hint": "Compare stock and remaining distance before committing a pit call.",
  "goal": "finish_both"
}
```

Use two distinct approaches. Goals reuse `ScenarioBrief`: `observe`, `finish_both`,
`mer_top_six`, `mor_top_six`. Named-driver goals require the corresponding stable
core driver to belong to the selected player team; a renamed or unrelated driver
cannot acquire that goal through an abbreviation. Prefer `finish_both` or
`observe` for the example club roster.

Before activation, the catalog checks references, supported definitions, grid
capacity, pit-box spacing and named-goal applicability. Launch performs the full
existing circuit checks. A fourteen-car scenario cannot silently enlarge a
circuit's twelve-place grid. The loader retains the previous catalog if any
selected pack fails.

This pre-weekend definition is intentionally distinct from a shareable mid-race
`ReplayScenario`: the latter contains an exact independent sandbox starting
state. The six shipped developer diagnostic collections remain separate
verification resources, but all are now file-backed through the bounded
`ScenarioCatalog` adapter and own their gallery title and description. Practice
and rival recipes no longer live as GDScript literal tables. Collection loading
rejects unknown fields, missing/duplicate IDs, malformed family-specific recipes,
invalid nested dry-race plans, and out-of-range values **as one failed collection**;
it never silently drops a bad card while displaying the others. These trusted
bundled diagnostic fixtures are distinct from editable external content packs:
this does not introduce executable external-pack scenarios or campaign rewards.

## Authoring CLI

Every command below uses the production Godot compiler, not a separate Python
schema implementation. A missing engine is an error, not a successful dry run.

```sh
python3 scripts/content.py validate ./my-pack --godot /path/to/godot
python3 scripts/content.py list ./my-pack --kind circuit --format text --godot /path/to/godot
python3 scripts/content.py inspect ./my-pack --id local.club.circuit.training --godot /path/to/godot
python3 scripts/content.py clone core.circuit.hillside --as local.club.circuit.second --pack ./my-pack --godot /path/to/godot
python3 scripts/content.py export ./my-pack --output ./resolved.json --godot /path/to/godot
python3 scripts/content.py diff ./before-pack ./after-pack --godot /path/to/godot
python3 scripts/content.py test ./my-pack --scenario local.club.scenario.first-weekend --steps 1600 --godot /path/to/godot
```

`export` creates a sorted-key **resolved inspection snapshot**, including provenance.
It is not itself a loadable folder pack and never overwrites a file. `diff` validates
both selected catalogs before comparing values; array order is meaningful, and a
comparison exceeding 256 changes is explicitly marked truncated. Use the core pack
folder as either side to compare a pack against the bundled baseline.

`test` executes 1–20,000 fixed steps through the normal staged launch and verifies
an exact saved-state round trip in memory. It does not replace a user save or
advance through unapproved session gates. Output distinguishes requested from
executed steps and explicitly reports whether a whole weekend completed. A passing
80-second practice segment is not full-race, balance or visual acceptance. Scenario
seed and settings come from its file-defined weekend preset.

The Python wrapper and native application both support ordered multiple packs.
Repeat `--pack` in dependency order for validation/list/inspect/export/test; clone
uses repeated `--dependency` / `--include-pack`, and diff supports common plus
side-specific dependency selections. See [multi-pack authoring](multi-pack-authoring.md).
Future format migrations remain explicit versioned work rather than fabricated
converters for versions that do not yet exist.

## Persistence and verification

The compiled circuit and resolved style live in the ordinary track snapshot. The
scenario's complete definition and brief are pinned in record lineage. Opt-in
notebook facts retain that authored context, and original result receipts remain
idempotent. A snapshot-derived sandbox remains ineligible for original receipts. Loading
an existing session does not need the source folder. Contradictory brief, circuit
identity or weekend references fail validation even if an envelope digest has
been recomputed. Digest comparison is unchanged; saved numbers use the exact
[persistence decoder](persistence-numbers.md).

Registered checks: `content_catalog_tests`, `content_persistence_tests`,
`content_scenario_ui_tests`, plus retained editor, launch, replay, scenario-authoring
and content-pack suites. Native interaction checks cover 1440×900 and 1100×720
with enlarged text. `verify_content_export.py` additionally runs debug and release
executables from a read-only installation, edits the external circuit/style/brief,
rejects an undersized grid, removes the pack, and verifies unchanged continuation.
Those are automated Linux checks, not human usability studies or Windows execution.
