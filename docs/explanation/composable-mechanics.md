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
Definitions and options pass the shared finite serialized-value policy before
recursive copying. IDs cannot contain whitespace. Rejected configuration/options
publish nothing or run no providers and are retryable; successful configuration
and installation are one-time operations. Provider installation
receives detached options and track geometry, not caller-owned mutable input.

Current profiles assemble strategy → weather → recovery → practice.
The most specific installed provider handles an overridden hook;
`before(id, hook, arguments)` invokes the predecessor, then a base rule where
applicable. This preserves the old rule ordering without behavior inheritance.
Unknown IDs and undeclared predecessor hooks return `null` with a named
`RaceMechanics.last_error`, rather than running unrelated fallback code. Literal
predecessor mistakes are also caught by the authoring tool. Dynamic misuse and
semantic rule correctness remain runtime-test responsibilities.
It is ordered composition, not an ECS or runtime plugin loader.

Runtime car parameters are `RaceCar`, not dictionaries. Use typed fields in rules.
Use `to_record()` only at serialization/read boundaries. Small owned system
records remain versioned data; provider metadata alone does not migrate a save.

## Extend the composition

Use [the mechanics development guide](../how-to/developing-mechanics.md) for
scaffolding, explicit registration and focused validation. Scaffolding creates an
inactive provider: enabling it is a deliberate new-session profile decision.
Never hot-swap a running weekend or adjust baseline hashes to conceal a new rule.
Provider metadata does not migrate saves; state compatibility stays explicit.

See [Developing systems and mechanics](../how-to/developing-mechanics.md) for extension,
save and testing recipes; [Architecture](architecture.md) for ownership.
