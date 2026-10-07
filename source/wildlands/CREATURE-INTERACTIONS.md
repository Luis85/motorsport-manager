# Creature interactions

Creatures, the guide and world objects share one interaction request boundary.
Open **Interact** from the world toolbar or a selected creature. Choose an
initiator, target type and target; unavailable actions explain what is missing.
The guide's care actions retain the established carried-food, water, growth
events and cooldown rules. Creature social invitations retain the existing
paired walking/social tasks. Gathering submits an exact-node physical task:
the creature walks over, works and carries the result. Requesting it never
grants goods from a distance. A `delegated` history entry means the task was
handed to that existing task authority, rather than that the physical work ended.

## Friendly duels and encouragement

A creature can invite another creature to a duel. A pending invitation reserves
both participants. Their ordinary physiology continues, while unrelated tasks
and quest departures wait. Only idle or exploratory leisure can yield to a
duel; committed production, social work, cargo and quests keep their authority.
The target independently accepts or declines according to energy, essential
needs, temper, availability, distance and cooldown. The guide can also answer
or cancel an invitation. No request consumes dice or costs before acceptance.

**Stage this duel** invites the exact selected pair through that same boundary;
it preserves consent and all eligibility checks. **Encourage … to find a duel**
saves a search intent for up to 300 simulation seconds. The creature waits
around ordinary work and looks for a suitable partner on normal simulation
steps. It does not create an immediate match or move creatures instantaneously.
**Stop looking** cancels that intent.

Once accepted, a duel advances without player round choices. Each round calls
the existing actor-scoped `check()` and seeded 3d6 resolver, including current
skill points, attributes, trait/equipment/need/load modifiers and the authored
profile's additional modifiers. The default is a nonlethal dexterity contest:
success beats failure, two successes compare margins, equal margins draw, and
two failures draw. Critical classification is recorded and does not override
margin ranking. The alternate authored `margin` scorer ranks both margins,
including failed rolls, and also draws equal margins. These are Littlewild
sparring formats using the [implemented GURPS-inspired subset](RULES.md), not
an implementation of full GURPS combat or a claimed official Quick Contest.

The default stops at three points or five rounds. The profile bounds all
duels to at most 20 rounds. Authored per-round energy costs retain a 15-energy
safety floor; essential needs, lost availability or excessive distance end a
match safely. No HP, injury or lethal damage is applied. Configured settlement
effects apply once on completion. Both participants receive the profile
cooldown after acceptance, including a subsequently cancelled duel.

## Data authoring

Bundled definitions and triggers are in
[`docs/concepts/littlewild/assets/interactions/catalog.json`](../../docs/concepts/littlewild/assets/interactions/catalog.json).
The JSON schema is
[`interaction.schema.json`](source/assets/interactions/interaction.schema.json).
Runtime validation additionally checks cross references, supported skills,
executor capabilities, effect ownership and mutually compatible fields.

Definitions select one compiled capability: `effects`, `care`, `social`,
`world-task` or `duel`. Data supplies source/target scopes, target kinds,
proximity, energy/temper eligibility, item/energy costs, cooldown and recipient
effects. Care and physical task adapters retain their existing cost/effect
authorities and cannot add a second charge. `world-task` currently supports
exact-node gathering. Buildings also support authored quiet visits; production
and delivery continue through the established plan and logistics commands.

A duel profile supplies skill, source/target modifiers, scorer, per-round
energy costs, round interval, response delay, winning score and maximum rounds.
Adding a new supported profile or effects definition requires JSON data only;
there are no branches selecting gameplay behavior by its ID.

The `triggers` array describes autonomous challenge rules. Each rule references
a duel definition and supplies its own simulation interval, priority and chance.
The source and target condition arrays are conjunctions. Safe metrics are
`food`, `water`, `energy`, `joy`, `social`, `anger`, `bond`, `personality`, `trait`
and `idle`; supported operators are numeric `gte`/`lte`/`eq`, personality/idle
`eq`, and trait `contains`. Pair filters cover maximum distance and minimum
affinity from the established shared relationship records. Higher priorities
run first; equal priorities use stable ASCII rule IDs. No expressions, scripts,
callbacks, dynamic property paths or `eval` are supported.

For example, a new data rule can target a curious creature meeting a patient
friend. Put this record in `triggers` alongside a compatible duel definition:

```json
{
  "id": "patient-practice",
  "definitionId": "friendly-duel",
  "priority": 20,
  "intervalSeconds": 30,
  "chancePercent": 50,
  "source": [{"metric": "personality", "operator": "eq", "value": "curious"}],
  "target": [{"metric": "trait", "operator": "contains", "value": "patient"}],
  "maximumDistance": 4,
  "minimumAffinity": 0
}
```

Rules also respect the referenced profile's `autonomous` permission. Explicit
player encouragement and staging remain available for profiles without
autonomous permission. A seek may optionally reference a rule to constrain its
search; the rule and selected profile must agree. Rules without eligible pairs
consume no RNG. A valid candidate selection and any probabilistic chance use
the existing persisted world RNG; round dice use each creature's persisted RNG.

## Developer toolbox

`toolbox.interactions()` discovers detached bundled definitions.
`validateInteraction()` and `validateInteractionLibrary()` review data without
changing registries or a live session. `session.interactionDefinitions()`
returns its embedded complete library, `interactionOptions(sourceId,target)`
returns detached availability/reasons, and `interactions()` returns detached
requests, rounds, history, cooldowns, trigger clocks and search intents.

```ts
const game = toolbox.create({scenarioId: 'littlewild', sceneId: 'charted-home'});
const library = game.interactionDefinitions();
const review = toolbox.validateInteractionLibrary(library);
if (!review.ok) throw new Error(review.errors.join('\n'));
game.command({id: 'set-interaction-library', args: [library]});
game.command({id: 'seek-duel', args: ['c1', 'friendly-duel']});
game.command({id: 'stage-duel', args: ['friendly-duel', 'c2', 'c3']});
game.command({id: 'request-interaction', args: [
  'gather-at-node', 'c1', {scope: 'node', id: 'n0'}
]});
game.start();
game.advance(20);
console.log(game.interactions());
game.dispose();
```

The SDK command union also includes `respond-interaction`,
`cancel-interaction`, `cancel-duel-seek` and `set-game-settings`. Discover actor
and object IDs from `inspect()` and read command results; example requests can
be unavailable when another interaction reserves the creature.

## State, settings and compatibility

Duels and quests can be independently disabled in **Settings**. Disabling
duels cancels pending/active duels and search intents, preserving paid costs and
cooldowns. It prevents requests, staging, encouragement and automatic triggers.
Care, social tasks and physical world interactions remain available. Missing
flags in older saves default to enabled.

The engine owns optional root `creatureInteractions` state, with a complete
per-engine library and fingerprint, unique sequence, bounded active/history
records, cooldowns, per-rule schedules, search intents and an independent decision RNG stream. Trigger chance and partner selection use the existing seeded `LWRPG.next` algorithm without advancing quest/world RNG or actor skill-roll RNG. Legacy checkpoints initialize this stream only when an eligible scheduling decision needs a draw; inactive catalogs do not gain state from queries. Native saves,
portable stories and captured scenarios retain it and both existing RNG
streams. Legacy saves without interaction state remain supported. Import checks
record identity, referenced definitions, roll arithmetic, scores, settlement,
pair locks, schedules and library identity before hydration. Invalid imports
and requests leave the active session unchanged.

Identical normalized library installation is a true no-op. Changing a library
requires all duels to be finished or cancelled and deliberately clears its
historical receipts, cooldowns and search intents, then schedules the new rules.
Definition ordering remains authored order; object key ordering does not change
the fingerprint. Limits are 60 definitions, 32 triggers, 16 active interactions,
60 historical receipts and 20 rounds per duel. These bounded data capabilities
are extension points rather than an arbitrary scripting engine.

The deterministic pipeline closes its existing actor-simulation phase with
paired settlement and rule/search processing after actor-major physiology.
Existing compiled profile phase IDs remain compatible. Pause/start gates hold
consent, rounds, rule clocks, needs and RNG; no wall clock or ambient randomness
advances the system.
