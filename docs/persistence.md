# Persistence and local data

**0.11 update:** [Contextual rivals](race-weekend-rivals.md), [workspace specification](design/pitwall-workspace.md) and [verification evidence](rivals-verification.md) supersede older UI/checkpoint statements where noted. The current native checkpoint is v10; old saves retain classic rivals. No new simulation/view inheritance layer or pressure mechanic is added.

All player writes use Godot's `user://` directory, displayed in **Settings → Local data**. The application never saves back into packaged `res://data`.

| Path | Contents |
|---|---|
| `user://settings.json` | Fullscreen, VSync, default labels/line/speed, scenery detail, dot size and reduced motion |
| `user://tracks/*.json` | Individually saved custom authoring documents |
| `user://weekend.json` | Current native weekend checkpoint |
| `*.bak` | Previous successful value retained by atomic replacement |

`Storage.read_json` bounds files to 16 MB and returns structured success/error results. It does not evaluate scripts or instantiate Godot resources from user input. Imported track identifiers are constrained before becoming filenames. Invalid library documents are skipped with an explanatory warning rather than crashing the menu.

Writes create a temporary file, flush it, move the old destination to `.bak`, and rename the temporary file into place. A failed replacement attempts to restore the previous destination. This protects against many interrupted writes, but is not a transactional database or a guarantee against disk/device failure. An invalid main file is reported; backup restoration is a manual recovery action, not a silent automatic fallback.

## Checkpoints

Native checkpoints use a versioned schema and contain a copied track document, vehicle/configuration, session clock/phase, fixed-step accumulator, PRNG, drivers, tyres/fuel/condition, pit queues, surface state, flags, events and commands. Restoration validates the version, shape, enum values, roster and bounded finite values before replacing the current weekend. Numeric integer fields are explicitly converted after JSON decoding.

The checkpoint is written by **Save**, on phase transitions, and when leaving a weekend for the menu. Closing the app with a live weekend also saves. An active session loaded from disk is paused until resumed. The in-memory **Continue Weekend** action retains the already-loaded model. Editing the library cannot alter a checkpoint's embedded geometry.

New checkpoints use native **version 4**, including finite set inventories, fitted/planned/frozen-service set identities, one scheduled stop and stint history. Native versions 1, 2 and 3 are accepted. Version 1 first receives the earlier split/courtesy/service defaults; versions 1/2 initialize missing stock while retaining fitted aggregate tread and temperature. All pre-v4 saves initialize individual wheels, five-field setup and lateral surface cells from the data actually recorded; missing wheel asymmetry and widthwise history receive explicit defaults. Historical discarded-set usage was not stored and cannot be reconstructed. This is a data migration, not a promise to reproduce the previous engine’s future lap times. Authoring documents remain version 1 with optional visual metadata.

Nested validation covers telemetry shape, sector records, roster identity/ownership, selected driver indices, unique grid positions, command structure, statistics and pit-box owners. Invalid input is rejected before replacing the active session. A snapshot also deep-copies the circuit so modifying exported data cannot mutate a live weekend.

JSON encodes floating-point numbers as decimal text. Continuation regressions require exact discrete/RNG state and bounded numerical drift (the occupied-pit scenario uses an absolute `1e-7` tolerance); they do not claim byte-identical floating-point restoration or cross-architecture replay.

The old HTML/browser localStorage and campaign checkpoints are incompatible and are not imported. Native race-log export is for analysis, not continuation. There is one active weekend checkpoint in this iteration; multiple save slots and a persistent draft-recovery system are not implemented.

## Tests and user data

The Python verification harness copies the project without import caches into a temporary directory and gives that copy a unique application name. It also assigns temporary XDG/APPDATA directories. This prevents normal player saves from being reused even when a platform ignores those environment variables. Generated reports are copied back into the real project's `reports/` directory. Tests verify JSON round trips, corrupt/missing files, atomic backup behavior, and bounded-numerical-drift native continuation. The UI test writes a custom circuit and checkpoint only in its isolated application profile.

## Version 4 additions

Snapshots include individual wheel dictionaries, heat-cycle state, fitted setup, racecraft mode, engine/brake temperatures, tyre incident scheduling and all 96×7 surface channels plus their evolution accumulator. Validation rejects malformed shape, bounds, identities and inconsistent derived water/rubber or tyre averages before restoring a live model. Same-build continuation includes RNG and occupied pit-box state; numeric comparison uses the existing declared tolerance.

Guide progress is validated local settings data. Setup drafts, UI selection/locks and unapplied trace strokes are not race checkpoints. A saved authoring document persists committed scenery group strings but not the full transient editor workspace.
