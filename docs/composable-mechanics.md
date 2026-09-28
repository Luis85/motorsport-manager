# Composed race mechanics — 0.19.0

`StrategyRaceSim`, `WeatherRaceSim`, `RecoveryRaceSim` and `PracticeRaceSim`
preserve public construction/restore entry points and directly extend `RaceSim`.
They do not inherit runtime behavior from each other. That behavior lives in
`scripts/domain/mechanics/` as explicitly ordered `RaceMechanic` providers.

## Construction contract

A provider declares a stable `id`, positive `version`, earlier `requires`
dependencies and implemented hooks. `RaceMechanics.configure` validates the
entire proposal before publishing it. `RaceHookContract` checks that hooks really
are aggregate dispatch points and that parameter/return contracts agree.
Configuration and installation are one-time operations. Provider installation
receives detached options and track geometry, not caller-owned mutable input.

Current profiles assemble strategy → weather → recovery → practice.
The most specific installed provider handles an overridden hook;
`before(id, hook, arguments)` invokes the predecessor, then a base rule where
applicable. This preserves the old rule ordering without behavior inheritance.
It is ordered composition, not an ECS or runtime plugin loader.

Runtime car parameters are `RaceCar`, not dictionaries. Use typed fields in rules.
Use `to_record()` only at serialization/read boundaries. Small owned system
records remain versioned data; provider metadata alone does not migrate a save.

## Authoring workflow

```sh
python3 scripts/mechanics.py list
python3 scripts/mechanics.py hooks
python3 scripts/mechanics.py validate --dry-run
python3 scripts/mechanics.py scaffold resource_policy --hook forecast_parameters --dry-run
python3 scripts/mechanics.py scaffold resource_policy --hook forecast_parameters
python3 scripts/mechanics.py validate --godot /path/to/godot --mechanic resource_policy
```

The scaffold preserves predecessor behavior, creates a registered regression and
**does not enable a rule in the game**. Review it, add rule-specific tests, then
explicitly change the intended new-session profile. Never hot-swap an active
weekend, silently refill resources, or update baseline hashes to hide a changed
model. A deliberate gameplay change requires explicit expectations and versioning.

The generated test imports the real code in Godot, installs the provider, enters
an active session and compares fixed-step state with the unchanged profile.
`validate` uses the single existing suite registry and isolated verifier; it always
runs the production construction contracts plus selected registered inactive
extension tests. Missing registrations and malformed/duplicate catalog definitions
fail explicitly. A dry run selects tests but does not execute the engine.
Tool tests also cover malformed identities, overwrites, symlink escape, write
rollback and false-success engine logs. The development fixture exercises scalar,
no-argument and typed-car hooks; it is not proof of an arbitrary new rule. Focused evidence cannot satisfy the full CI aggregate gate.

See [Developing systems and mechanics](developing-mechanics.md) for extension,
save and testing recipes; [Architecture](architecture-refactor.md) for ownership.
