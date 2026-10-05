# Wildlands RTS engine

This contract concerns the TypeScript Wildlands maker in
[`docs/concepts/littlewild/`](../concepts/littlewild/README.md), extended from PR 25.
It is separate from the native Godot race and campaign authorities. The RTS demo
is an original scenario illustrating reusable genre mechanics rather than a
recreation of a licensed game's content or rules. Follow the
[demo tutorial](../tutorials/rts-demo.md) for a bounded route.

## Content and authority

The complete catalog is plain JSON with `format: "wildlands-rts"`, `schemaVersion: 1`,
identity and nine arrays. The shipped fixture is
[`rts-demo.json`](../concepts/littlewild/source/content/rts-demo.json).
[`rts-contracts.d.ts`](../concepts/littlewild/source/rts-contracts.d.ts) defines
all records; [`rts-catalog.ts`](../concepts/littlewild/source/rts-catalog.ts)
validates shape, ranges, references and technology dependencies before use.
The checked-in external shape contract is
[`rts.schema.json`](../concepts/littlewild/source/content/rts.schema.json); runtime
validation remains authoritative for cross-record constraints.

| Family | Editable gameplay records |
|---|---|
| Resources | Gather rates and display identity |
| Factions | Permitted units, buildings, technologies, starting resources and bounded AI policy |
| Units | Worker, infantry, ranged, cavalry, siege, vehicle, naval, aircraft and creature roles; movement, health, armor, sight, population, costs, weapons, work rates and technology prerequisites |
| Buildings | Footprint, construction cost/time, storage, production, research, population, power and weapons |
| Items | Ability reference, cost and charges |
| Technologies | Prerequisites, cost/time and role-filtered stat multipliers |
| Abilities | Registered heal, damage, repair or reveal effects; amount, range, radius, cooldown, reveal duration and cost |
| Terrain | Land/water/air passability, speed factor, cover and display identity |
| Missions | Map, terrain patches, spawn records, resource deposits, item drops, fog, seed and eliminate/stockpile/survive objectives |

Content chooses values and registered behavior. JSON cannot inject executable
systems. Adding an algorithm requires implementing and registering its system,
updating the contract and validator, and testing both its accepted behavior and
rejections. Merely adding an unused field to JSON cannot add a mechanic.

The shared [`LWECS.World` and `Scheduler`](../concepts/littlewild/source/ecs.ts)
own entities, component records, system ordering and deferred structural edits.
The RTS application session owns commands, fixed ticks, detached queries and
checkpoints. Renderers and controls issue intent and consume snapshots; a redraw,
selection or query advances no simulation time. Catalog copies and query records
are detached so edits to an inspector result cannot change the running match.

## Mission authoring boundary

The [graphical mission editor](../how-to/rts-mission-editor.md) edits a separate
validated catalog draft. Its behavior-free contract is
[`rts-mission-editor-contracts.d.ts`](../concepts/littlewild/source/rts-mission-editor-contracts.d.ts).
`LWRTSMissionEditor.create(catalog, missionId)` returns an authoring session with
`query()`, `command(input)` and `exportCatalog()`. It owns no ECS world or clock.
Queries and exports return detached values.

Every command carries the revision observed by its caller. Stale revisions,
malformed records and invalid whole catalogs are rejected before draft or history
publication. Accepted edits increment revision and retain at most 64 undo states;
undo and redo also invalidate older proposals. Selecting a mission changes the
revision without adding an edit or changing the dirty state. Invalid form values
remain uncommitted UI input.

Supported authoring operations select, clone or remove a mission; change its
metadata; paint terrain rectangles; add, update or remove spawn, deposit, item and
objective records; import a complete catalog; and undo or redo accepted edits.
At least one mission must remain. Terrain painting normalizes the resulting tile
field into bounded patches and applies the same catalog placement/passability
rules as runtime admission. Editor admission additionally requires objective IDs
to be unique within each mission. Resizing cannot silently discard out-of-bounds
content. The exported catalog preserves the other content families and missions;
archetype values and new registered mechanics still use their JSON/code contracts.

Editing, importing into the draft, exporting and returning to the match leave the
existing match checkpoint unchanged. Explicitly playing the selected draft
validates and constructs a fresh match before replacing the application session,
then opens it paused. Authoring history is an in-memory draft facility, not a
checkpoint format or an autosave claim.

## Session boundaries

The runtime's behavior-free component and command records are declared in
[`rts-runtime-contracts.d.ts`](../concepts/littlewild/source/rts-runtime-contracts.d.ts).
`LWRTS.create(catalog, missionId)` creates a session. `command(input)` returns
`{ok, message}` with an optional created entity ID. `query(faction)` projects
state, map, entities, resources, technologies, fog and bounded event observations.
`step(ticks)` is the explicit application clock with a fixed 0.1-second step. `checkpoint()` produces the
versioned serialized session rather than a rendered view.

Commands identify a faction and registered action, with explicit entity,
definition, position or target parameters. Domain preconditions decide whether
orders can be accepted. An accepted order describes an intention: movement,
construction, gathering, production, research and combat require simulation ticks.

The demo's mechanics run over that shared ECS: terrain-aware navigation,
movement orders, workers and finite deposits, construction, training queues,
research, population and power accounting, weapon attacks and travelling ECS projectiles,
ability effects, fog, AI orders and objectives. Unit radius drives local separation;
patrol orders repeat between their origin and destination. Terrain cover adds
armor, while movement passability and speed affect navigation. Enabled faction
AI periodically orders its combat units and queues its authored `preferredUnit`
through completed production buildings, using the same costs, population and
prerequisite gates as player training. Archetypes, factions, costs, effect magnitudes and
starting mission arrangements come from the validated catalog. Resource gather rate multiplies each worker's authored gather rate. Unit
technology prerequisites gate training; researched role-filtered multipliers are
derived from frozen definitions rather than cumulatively applied each tick.
Mission `items` records author pickup positions and item identities. `interact`
collects a nearby item into a unit's charged inventory; `purchase` spends its
catalog cost to grant charges directly. Item abilities consume charges and
respect ability costs, cooldowns and targeting. Reveal expiry uses authored
`duration` in seconds. Isometric
presentation is a projection of map coordinates rather than a separate world.

## Developer tools

[`rts-tools.ts`](../concepts/littlewild/source/rts-tools.ts) supplies catalog export,
validation, mission inspection and bounded command experiments. Discovery reports
available operations and actual budgets. The JSON-only CLI is
[`tools/rts-cli.cts`](../concepts/littlewild/source/tools/rts-cli.cts), compiled to
`.generated/tools/rts-cli.cjs` by the maker build.

| Operation | Inputs and result |
|---|---|
| `discover` | Operation and budget inventory; no session |
| `catalog [OUTPUT]` | Detached complete catalog; optionally write JSON |
| `validate CATALOG` | Whole-catalog validation with explicit errors |
| `inspect [MISSION] [CATALOG]` | Mission records, family counts and starting entity/deposit counts |
| `run RECIPE [OUTPUT] [CATALOG]` | Fresh session; return actual progress, commands, snapshot and checkpoint; optionally save checkpoint |
| `restore SAVE RECIPE [OUTPUT]` | Resume checkpoint for explicit bounded ticks; optionally write successor checkpoint |

A recipe has `ticks`, optional `missionId`, optional ordered `commands`, and
optional Boolean `stopOnError` (default true). Each scheduled entry has `atTick`
and a `command` record. Offsets are relative to the starting session tick, including
restored sessions. Equal offsets execute in array order. Tick-zero commands run
before the first tick; commands at the final requested offset run after that
many completed ticks. Restore retains the saved mission and rejects a replacement
`missionId`.

Budgets are 8 MiB per JSON document, 20,000 requested ticks and 256 scheduled
commands. Requests outside those bounds fail before session creation. A rejected
command stops the run by default; accepted earlier commands remain applied to its
returned checkpoint. `stopOnError: false` records rejections and continues.
Mission completion may stop a run early. Always inspect `completedTicks`,
`stopReason`, `skippedCommands` and each command receipt. The CLI exits 0 for
acceptance, 1 for catalog or command rejection, and 2 for usage or I/O failure.
Writes use unique temporary files and may not overwrite a supplied input.

## Scope and extension points

The maker retains Littlewild and its existing authoring tools alongside a
switchable RTS demonstration through the **RTS demo** toolbar action. The RTS session is its own game context; switching
games must not reinterpret a colony checkpoint as an RTS match. Existing native
race/campaign compatibility and source-bound verification still apply separately.

The foundation supplies the registered mechanics above, not every historical RTS
feature. Multiplayer/network lockstep, campaign storytelling,
sophisticated formation/flanking/tactical AI and full RTS
Godot export parity require additional consumers and tests. A deterministic
bounded experiment is not human playtesting, strategic balance or representative
hardware performance evidence. Current capability scope is tracked in
[current state](current-state.md).
