# Tyres, finite allocations and setup profiles

This increment externalizes the existing four-wheel and five-control models;
it does not add executable formulas, refueling, new wheel topology or new controls.
Model coefficients are game parameters, not claimed real-world measurements.

## Authorable definitions

`tyre` defines a stable ID, display name/short/color, grip, wear, optimum temperature,
family (`slick`, `intermediate`, `wet`), surface-response coefficients and a
`thermal_profile_id`. `tyre_thermal` owns the `four-wheel-v1` parameter table,
including load, slide, heat transfer, pressure, graining, blistering, cooling,
heat-cycle and damage coefficients. The named keys and bounds are generated in
`content/schemas/v1`. Units retain the current game: temperature is Celsius;
pressure and load are normalized multipliers, not bar/psi or newtons. `wear` keeps
the original per-lap game-model scale. Fuel remains lap-equivalent units.

A `tyre_allocation` declares an ordered `sets` array with `compound_id` and `count`.
Counts are positive integers; a supported allocation has at most 24 distinct
compounds and 64 sets per driver. Order determines deterministic creation/ties.
The `selection` object defines initial dry/wet sets, qualifying choice, weather
thresholds, preferred compounds and named strategy/practice selections. Every
selection must refer to allocated stock of the required family. Merely naming
a preference cannot create a replacement set after finite stock runs out.

The immutable `RaceTyreRules` closure is shared by runtime and forecasts. It
contains only the selected allocation, its compounds and thermal profiles.
Stock belongs to individual `RaceCar` instances: fitting, cooling, wearing,
puncturing and remounting modify those instances, never the shared definitions.
IDs are explicit and independent of labels. `CE1` is a display label, not a key
parsed to infer its compound or owner. No access to teammate stock is granted.

## Setup definitions

`setup` uses `five-control-v1`. It supplies the supported wing, balance,
suspension, cooling and bias controls; defaults and labels; narrower legal
ranges; named balanced/low-drag/stable-wet baselines; the original effect
coefficients; and initial engine/brake temperatures. Defaults and baselines
must fit the declared ranges. The compiler rejects nonpositive/unsupported
effect endpoints. Hard engine safety limits and the five implemented control
semantics cannot be expanded by a data record.

Both compact and full diagnostic setup controls consume the same profile.
Unapplied drafts remain unapplied. Setup edits target the selected entry, honor
garage/preparation restrictions and update the legacy wing alias consistently.
The shipping minimal pitwall retains its established actions; extra diagnostic
controls do not reappear in normal navigation.

## Example expansion

The club pack includes `local.club.tyre.endurance` (short `CE`) and
`local.club.tyre_allocation.endurance`: one soft, one medium, one hard, three
endurance, two intermediate and two wet sets. Each driver receives ten sets;
a fourteen-car entry therefore owns 140 distinct set instances. The starting
dry compound is CE, not a hardcoded `M`. The setup `local.club.setup.club`
starts at wing 3, permits wing 2–7 and demonstrates a modified drag coefficient.
These are illustrative values, not a balance claim.

Copy the example pack outside the source folder, then edit JSON and validate:

```sh
python3 scripts/content.py clone core.tyre.medium --as local.club.tyre.new --pack ./my-pack --godot /path/to/godot
python3 scripts/content.py validate ./my-pack --godot /path/to/godot --format json
python3 scripts/content.py inspect ./my-pack --id local.club.tyre.new --godot /path/to/godot
```

The destination pack must already exist and use namespace `local.club`. A cloned
compound becomes usable when its ID is included in an allocation and that
allocation is chosen at weekend setup. The FIELD, ALLOCATION and SETUP PROFILE
selectors refer to independent definitions. Bad references do not replace a
previously staged weekend or activate part of a catalog.

## Saved-state contract

New checkpoints carry `tyre_definition` (kind
`motorsport-manager-tyre-snapshot`, version 1) and `setup_definition` (schema v1).
Replay/result manifests pin the same records. Restore validates the complete
closure and every car's owned set IDs, wheel condition, aggregate aliases and
setup values before exposing the session. No current file is consulted to
reinterpret that state. The 91-field car codec remains unchanged; nonserialized
typed dependency references are rebound by the owning restore path.

Old files without these headers use `LegacyTyreContent`,
`TyreThermalDefaults` and `LegacySetupContent` as immutable compatibility inputs.
They retain old S/M/H/I/W IDs, twelve-set allocation, original defaults and
arithmetic. Editing the modern core pack does not rewrite that compatibility
bundle. This is not a promise that new saves run on older executables.

## Verification and limits

`content_tyre_tests` uses real launch, commands, formation and two physical pit
stops, including a worn-set remount and restore during service. It checks
ownership, invalid references/ranges, preview isolation, result stock, notebook
and a replay to the exact endpoint. `content_tyre_ui_tests` operates native
minimal and diagnostic views with long IDs, custom limits, real staged edits,
display labels/colors and compact enlarged text. It explicitly resumes practice
to close it rather than relying on a paused loop to advance time.

`verify_content_export.py` executes Linux debug/release exports from an isolated
working directory, with a genuinely non-writable installation under a non-root
runtime identity and a space/non-ASCII pack path. It changes external vehicle/tyre/setup values without
rebuilding, rejects malformed content, removes the pack and restores the same
session. It sizes an acceptance-only hillside grid for the authored roster;
normal user tracks are still rejected when their grid is too small. This proves
Linux headless execution, not Windows, human usability or a performance budget.

## Four-wheel operating limits

A `tyre_thermal` may additionally specify the complete `operating` object. The
core four-wheel profile now exposes these original values in JSON:

| Field | Original value | Runtime consumer |
|---|---:|---|
| moving_threshold_mps | 1.0 | Moving versus stopped heat model |
| reference_brake_bias | 0.56 | Front/rear load response |
| corner_saturation | 1.5 | Corner-load input saturation |
| slide_saturation | 1.5 | Sliding input saturation |
| minimum_load / maximum_load | 0.55 / 1.7 | Operating wheel-load clamps |
| minimum_pressure / maximum_pressure | 0.8 / 1.32 | Running and spare-set pressure |
| surface_limit_c / core_limit_c | 160 / 155 | Operating temperature ceilings |
| lockup_front_bias | 0.56 | Front/rear lockup selection |

These are game-model coefficients, not measured tyre physics. The block compiles
once into the immutable tyre closure shared by actual operation and forecasts;
there is no file parsing inside the wheel update. All eleven fields have a
consumer-effect test. The original defaults are checked against the legacy API
with exact wheel-state equality, not a loosened tolerance or new race baseline.

The remaining literals in `WheelTyres` have different responsibilities: four
named wheel positions are topology; 0–100 life/damage values are percentage-state
invariants; 0–200 Celsius, normalized pressure 0.5–2 and load 0–4 are checkpoint
safety bounds; the 0.00001 aggregate comparison is serialization consistency
rather than a tunable handling coefficient. Arithmetic identities, exponentials
and interpolation order remain algorithm code. Authorable operating limits must
stay inside the unchanged checkpoint bounds, with ordered load limits and a core
temperature ceiling no higher than the surface ceiling.

Omitting `operating` in a legacy frozen profile uses the original values and does
not inject a new field into the saved record. This is important for historical
replay identity. The block is all-or-nothing when present; partial or foreign keys
are rejected rather than guessed.
