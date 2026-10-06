# Littlewild rules boundary

Littlewild uses a deterministic, GURPS-inspired arithmetic core. It is a cozy
simulation with its own progression, needs, logistics, and rewards. Its data and
tests describe the supported rules; it does not implement the complete GURPS
character, combat, damage, or equipment rules.

## Checks and probabilities

`source/rpg.ts` resolves three six-sided dice against a finite target, rounded
down. Each die must be an owned ordinary integer value from 1 through 6. The
result includes the dice, total, target, margin (`target - total`), success,
critical flag, and outcome. A target below 3 is impossible.

- A total of 3 or 4 is a critical success. A total of 5 is critical at target 15
  or more, and 6 is critical at target 16 or more.
- A total of 18 is a critical failure. A total of 17 is critical at target 15
  or less; otherwise it still fails. Missing the target by 10 or more is critical.
- Other rolls succeed when their total is at or below the target.

`odds(target)` enumerates all 216 equally likely dice combinations. Its
`critical` probability counts critical successes. Returned cached probabilities
are immutable. Nonfinite targets are rejected by both arithmetic entry points.

## Skills, load, and random streams

Easy, Average, Hard, and Very Hard skills apply trained offsets 0, -1, -2, and -3
to their attribute. Untrained defaults are -4, -5, -6, and -6. Nonnegative finite
points determine rank: less than 1 gives -1; 1, 2, 4, and 8 points give ranks
0, 1, 2, and 3, followed by one rank per additional four points. `nextCost`
calculates the points required to reach the next rank. Prototype point caps and
attribute purchase costs belong to the colony application, not this arithmetic.

Basic lift is `ST² / 5` pounds, converted with `0.45359237` kilograms per pound.
Carried load is expressed in grams. Ratios at or below 1, 2, 3, and 6 times basic
lift give encumbrance levels 0 through 3; larger loads give level 4. Movement
multipliers are 1, 0.8, 0.6, 0.4, and 0.2. Loads above ten times basic lift are
overloaded. Inputs and derived quantities must remain finite, with positive ST.

`next(seed)` consumes an unsigned 32-bit seed and returns the next seed and a
value in `[0, 1)`. Authoritative actors own their persisted streams. Domain
checks consume those streams; reading a forecast, rendering, and inspecting a
save do not roll dice or advance time.

## Creature interactions

[Creature interactions](CREATURE-INTERACTIONS.md) defines the authored interaction
catalog, player commands, autonomous sessions, persistence, and friendly duels.
Duels use opposed roll-under checks and nonlethal points. They do not apply HP,
injury, damage, or a full combat system. The session definition owns its round
limit and winning score; the shared RPG core owns individual check outcomes.

Friendly duels and quests can be independently turned off in Settings. Both
default to enabled. Disabling duels cancels paired sessions and releases their
participants. Disabling quests recalls away creatures using the normal timed
return and recall energy cost, preserving finds and spent provisions; recalled
trips award no completion reward. Prepared quests wait until enabled again.
Changing a preference works while paused and never advances a round or journey.
See [Activity settings](CONFIGURATION.md#activity-settings) for persistence and
the developer command.
