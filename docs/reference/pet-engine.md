# Wildlands Pocket Pet engine

This contract concerns the TypeScript Wildlands maker in
[`docs/concepts/littlewild/`](../concepts/littlewild/README.md). It is separate from
the native Godot race and campaign authorities. Pocket Pet is an original
virtual-pet scenario that illustrates reusable genre mechanics; it does not
reproduce a licensed product's content or rules. Follow the
[tutorial](../tutorials/pocket-pet-demo.md) for a bounded route.

## Content and authority

The catalog is plain JSON with `format: "wildlands-pet"`, `schemaVersion: 1`. The
shipped fixture is
[`pet-demo.json`](../concepts/littlewild/source/content/pet-demo.json).
[`pet-contracts.d.ts`](../concepts/littlewild/source/pet-contracts.d.ts) declares
every record; [`pet-catalog.ts`](../concepts/littlewild/source/pet-catalog.ts)
validates fields, ranges, ordering and references, then returns a frozen copy.

| Family | Editable values |
|---|---|
| `rules` | Game minutes per real second, start hour, weight bounds, mess and sleep rates, snack limit/window, sickness thresholds, health loss/gain, care-mistake delay, egg warming |
| `scene` | Room, bed, mess and sparkle asset IDs; pet and bed spots; mess spots (at least `maxMesses`) |
| `needs` | Exactly `hunger`, `joy`, `energy`, `hygiene`: display name, start value, hourly decay, sleep factor, warning threshold |
| `species` | ID, display name, description and pet asset ID |
| `stages` | Exactly `egg`, `baby`, `teen`, `adult` in order: duration, decay factor and forms with increasing `maxMistakes`; the last form must accept `999` |
| `actions` | Kind (`feed`, `treat`, `play`, `clean`, `cuddle`, `medicine`), prop asset, duration, need/health effects, weight change, digestion delay and allowed stages |

When the pet asset bundle is present, every species must provide every stage
model and every scene/action prop must provide a `world` model. JSON chooses
values; it cannot add new kinds, systems or executable behavior.

## Systems and commands

[`pet-systems.ts`](../concepts/littlewild/source/pet-systems.ts) registers ordered
systems on the shared `LWECS` scheduler: clock, activity completion, metabolism,
digestion, sleep, health and growth. One fixed tick is 0.1 seconds; the catalog's
`minutesPerSecond` converts ticks to game minutes. Effects apply when an action
finishes, not when it is accepted. Form selection uses the first adult form whose
`maxMistakes` is not below the accumulated care mistakes.

Care mistakes are counted once per episode when a need stays at zero for
`mistakeAfterMinutes`, when sickness is untreated for that long, or when the pet
collapses from exhaustion. Sickness follows low cleanliness for
`sickAfterMinutes` or more than `snackLimit` treats within the snack window.
Health falls for each empty need and while sick; it recovers only when every need
is at least 50 and the pet is well. At zero health the pet departs.

[`pet-session.ts`](../concepts/littlewild/source/pet-session.ts) owns commands,
queries and checkpoints:

| Command | Fields | Preconditions |
|---|---|---|
| `care` | `action` | Alive, stage allowed, not busy or asleep; meals need fullness below 95; play needs energy; medicine needs sickness; cleaning needs dirt |
| `sleep` / `wake` | — | Lights must be on/off respectively; not an egg; not busy |
| `name` | `name` | 1–24 letters, digits, spaces, apostrophes or hyphens |
| `adopt` | `species`, optional `name` | Only after the pet has departed |

The detached snapshot includes the clock, needs, health, mood, activity, messes,
alerts, each action's enabled state and reason, and a bounded 64-entry diary.
Queries, rendering and navigation never advance time. Checkpoints use
`format: "wildlands-pet-checkpoint"` and embed the catalog; restoration validates
the catalog and every component before installation.

## Application and presentation

[`pet-application.ts`](../concepts/littlewild/source/pet-application.ts) owns the
only clock: pause, speeds 1×, 4× and 16×, at most 0.1 s of real time per frame and
64 ticks per frame. Restart, checkpoint import and catalog import stage a complete
replacement session before it becomes active; imports open paused.

[`pet-renderer.ts`](../concepts/littlewild/source/pet-renderer.ts) draws the room
with WebGL 2 from the Scene Forge assets through the generic
[`LWAssetRenderer`](../concepts/littlewild/ASSET-ARCHITECTURE.md). Pet `rig` roles
name the nodes it animates for breathing, blinking, eating, play, sleep, sickness
and egg wobble. Without WebGL 2 the room shows an explanation while needs, actions
and the diary keep working. The browser exposes `WildlandsPet` for automation.

## Assets

Pet and prop definitions live in `source/assets/pets/<id>/definition.json` with
category `pet`. They are generated from the
[Scene Forge pocket-pet project](../concepts/scene-forge/examples/pocket-pet/littlewild.export.json)
and bundled separately as `LWPetAssetDefinitions`, so colony scenarios and saves
never embed them. Follow [authoring Littlewild assets in Scene Forge](../how-to/scene-forge-littlewild-assets.md).

## Developer tools

[`pet-tools.ts`](../concepts/littlewild/source/pet-tools.ts) and the JSON-only
`npm run pet` CLI support `discover`, `catalog`, `validate` and `simulate POLICY
MINUTES [SPECIES] [CHECKPOINT_OUTPUT] [CATALOG]`. Policies are `attentive`,
`casual` (no bedtime management), `snacker` and `neglect`; runs are limited to
20,160 game minutes. Results report milestones, accepted/rejected commands and
the final state. Tests live in `test-pet-catalog.cts`, `test-pet-runtime.cts`,
`test-pet-application.cts` and `verification/pet-browser.ts`.

## Limits

Pocket Pet has no native Godot export, background time while the page is closed,
multiple pets, audio, or in-browser catalog editor. Balance values are a
demonstration default validated by bounded scripts, not human playtesting.
