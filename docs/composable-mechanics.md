# Composed race mechanics

The runtime profiles (`StrategyRaceSim`, `WeatherRaceSim`, `RecoveryRaceSim`, and `PracticeRaceSim`) now directly extend `RaceSim`. They preserve their public construction and validated restore entry points, but no longer inherit behavior from each other. Runtime behavior lives in `scripts/domain/mechanics/`.

## Construction contract

A provider declares a stable `id`, positive `version`, earlier `requires` dependencies, and the hooks it implements. `RaceMechanics.configure` validates the complete proposed set before installing it. Configuration and installation are each one-time operations. Changes affect newly created sessions, not an already running weekend. `describe()` returns detached metadata. No reflection-based file loading, global mutable registry or UI dependency is introduced.

Existing profiles explicitly assemble strategy → weather → recovery → practice. For an overridden hook, the most specific installed provider runs; `before(id, hook, arguments)` invokes its declared predecessor and then the base rule when appropriate. This preserves the old arithmetic and RNG order while making the composition explicit. It is ordered hook composition, not a generic ECS.

## Adding or editing a rule

1. Put an authoritative operation in a focused domain module. Use caller-supplied state and simulated time; never a screen, singleton lookup, rendering callback or wall clock.
2. Implement `definition()`, `install(sim, geometry, options)`, and the declared hook functions. Do not retain the aggregate in a signal closure or provider field.
3. Add the provider to the intended construction profile after its dependencies. Add a stable aggregate entry point only for a genuinely new operation. Use `has_mechanic(id)` instead of assuming subclass ancestry.
4. Test registration, rejected configurations, isolated effects, disposal and validated restore. Schema changes require their own explicit migration; a provider version does not silently migrate a save.
5. Run baseline characterization when refactoring without intended behavior changes. For a deliberate model change, document and version the new model rather than rewriting expected hashes to conceal the change.

The existing versioned car and system records remain the authoritative serialized values; this increment does not rename their units, reset stock, calibrate psychology or introduce a new physics model. Typed entity migration remains separate pending work. Legacy presentation controllers now use detached queries, explicit commands and injected persistence services; their UI can no longer resolve the live aggregate or filesystem.

## Executed increment checks

The composition matched all 24 pinned sporting-state hashes from unchanged 0.17.2 across three circuit/weather workloads. The 40 existing architectural boundary checks and 22 new mechanic contract checks passed. These are headless checks, not a claim that the complete native UI regression or hosted CI has passed on this increment.
