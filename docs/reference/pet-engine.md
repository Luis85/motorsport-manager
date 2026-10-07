# Wildlands Pocket Pet engine

This contract concerns the TypeScript Wildlands maker in
[`source/wildlands/`](../../source/wildlands/README.md). It is separate from
the native Godot race and campaign authorities. Pocket Pet is an original
virtual-pet scenario that illustrates reusable genre mechanics; it does not
reproduce a licensed product's content or rules. Follow the
[tutorial](../tutorials/pocket-pet-demo.md) for a bounded route.

## Content and authority

The catalog is plain JSON with `format: "wildlands-pet"`, `schemaVersion: 1`. The
shipped catalog is [`content/pet.json`](../concepts/pocket-pet/content/pet.json)
in the [Pocket Pet game folder](../concepts/pocket-pet/README.md).
[`pet-contracts.d.ts`](../../source/wildlands/source/pet-contracts.d.ts) declares
every record; [`pet-catalog.ts`](../../source/wildlands/source/pet-catalog.ts)
validates fields, ranges, ordering and references, then returns a frozen copy.

| Family | Editable values |
|---|---|
| `rules` | Game minutes per real second, start hour, weight bounds, mess and sleep rates, snack limit/window, sickness thresholds, health loss/gain, care-mistake delay, egg warming |
| `scene` | Room, bed, mess and sparkle asset IDs; pet and bed spots; mess spots (at least `maxMesses`) |
| `needs` | Exactly `hunger`, `joy`, `energy`, `hygiene`: display name, start value, hourly decay, sleep factor, warning threshold |
| `species` | ID, display name, description and pet asset ID |
| `stages` | Exactly `egg`, `baby`, `teen`, `adult` in order: duration, decay factor and forms with increasing `maxMistakes`; the last form must accept `999` |
| `actions` | Kind (`feed`, `treat`, `play`, `clean`, `cuddle`, `medicine`), prop asset, duration, coin reward, need/health effects, weight change, digestion delay and allowed stages |
| `economy` | Currency display name, starting coins, coins per stage change, coin ceiling |
| `skins` | Product ID, name, description, allowed species (empty = all), base material colours, price; the first skin is the free default with no colour changes |
| `items` | Product ID, name, description, socket slot (`hat`, `face`, `neck`, `back`), accessory asset, price |

When the pet asset bundle is present, every species must provide every stage
model and every scene/action prop must provide a `world` model. JSON chooses
values; it cannot add new kinds, systems or executable behavior.

## Systems and commands

[`pet-systems.ts`](../../source/wildlands/source/pet-systems.ts) registers ordered
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

[`pet-session.ts`](../../source/wildlands/source/pet-session.ts) owns commands,
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

## Personalization and monetization

A price is either `{"currency":"coins","amount":n}` or `{"currency":"premium","sku":"…"}`.
Skin and item IDs share one product namespace. Coins are earned only when an
action finishes (its `coins` value) and on every stage change (`growthCoins`).

The wardrobe is a separate `pet-owner` entity: coins, coin-bought products, the
selected skin, one equipped item per slot and store entitlements. Adopting a new
egg, **Start over** and catalog import keep it; a skin limited to other species
falls back to the default. Restoring an older checkpoint restores its coins and
coin purchases but never removes a store entitlement already granted.

| Command | Fields | Rules |
|---|---|---|
| `buy` | `product` | Coin offers only; not owned; enough coins. Debits once |
| `equip` | `product` | Owned skin allowed for the species, or owned item; replaces the slot |
| `unequip` | `slot` | Something must be worn there |
| `entitle` | `sku`, `source` | Store boundary only. Unknown or repeated SKUs are rejected; never charges coins |

Premium ownership is derived from entitlements, not from coin purchases. The
browser host's [`pet-store.ts`](../../source/wildlands/source/pet-store.ts) defines
the store port: an adapter with `id`, `name`, `simulated`, `notice` and
`purchase(sku)`. Only a successful result for the requested SKU becomes an
`entitle` command with the adapter ID as source. The bundled **Demo store** is
simulated, takes no payment and says so in its confirmation, which opens on
**Cancel**. `WildlandsPet.useStore(adapter)` installs another adapter. Real
payment, receipt verification and server-side restore are not implemented.

Skins replace base material roles (`skin`, `belly`, `foot`, `blush`, `leaf` and
similar); variant roles such as `skin-adult-bramble` follow their base role.
Items attach to the stage model's `hat`, `face`, `neck` or `back` socket; the egg
has no sockets, so accessories appear from the baby stage on.

## Application and presentation

[`pet-application.ts`](../../source/wildlands/source/pet-application.ts) owns the
only clock: pause, speeds 1×, 4× and 16×, at most 0.1 s of real time per frame and
64 ticks per frame. Restart, checkpoint import and catalog import stage a complete
replacement session before it becomes active; imports open paused.

[`pet-renderer.ts`](../../source/wildlands/source/pet-renderer.ts) draws the room
with WebGL 2 from the Scene Forge assets through the generic
[`LWAssetRenderer`](../../source/wildlands/ASSET-ARCHITECTURE.md). Pet `rig` roles
name the nodes it animates for breathing, blinking, eating, play, sleep, sickness
and egg wobble. Without WebGL 2 the room shows an explanation while needs, actions
and the diary keep working. The browser exposes `WildlandsPet` for automation.

## Assets

Pet and prop definitions live in the game folder's
`assets/pets/<id>/definition.json` (`docs/concepts/pocket-pet/`) with category
`pet`; a pet game's `assets` may hold only `pets` definitions. They are generated from the
[Scene Forge pocket-pet project](../../source/scene-forge/examples/pocket-pet/littlewild.export.json)
and bundled separately as `LWPetAssetDefinitions`, so colony scenarios and saves
never embed them. Follow [authoring Littlewild assets in Scene Forge](../how-to/scene-forge-littlewild-assets.md).

## Developer tools

[`pet-tools.ts`](../../source/wildlands/source/pet-tools.ts) and the JSON-only
`npm run pet` CLI support `discover`, `catalog`, `validate` and `simulate POLICY
MINUTES [SPECIES] [CHECKPOINT_OUTPUT] [CATALOG]`. Policies are `attentive`,
`casual` (no bedtime management), `snacker` and `neglect`; runs are limited to
20,160 game minutes. Results report milestones, accepted/rejected commands and
the final state. Tests live in `test-pet-catalog.cts`, `test-pet-runtime.cts`,
`test-pet-application.cts`, `test-pet-wardrobe.cts` and `verification/pet-browser.ts`.

## Limits

Pocket Pet has no native Godot export, background time while the page is closed,
multiple pets, audio, in-browser catalog editor or real payment provider. Balance values are a
demonstration default validated by bounded scripts, not human playtesting.
