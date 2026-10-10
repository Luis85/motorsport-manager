# Business process engine

Definition-first contract for the Wildlands process extension as implemented in
the current checkout (introduced by PR #40 and extended since). The JSON document is the source of truth. A process is a graph of step scenes;
case tokens execute that graph in the shared Wildlands ECS. Navigation and both
renderers observe detached snapshots and never execute business work.

## Terms in the studio, the docs and the CLI

The same idea can carry a different word on screen, in these pages and in the JSON or CLI.
None of the words is wrong; this table maps them.

| Studio (what you see) | Docs | CLI and JSON |
|---|---|---|
| **Process** selector, process name | process, process definition | a `wildlands-process` definition; `content.definitions` in `game.json` |
| A card on the map, an entry in the step list, **Step scenes** | step, step scene | `steps[]`, each with a `scene` |
| A path in the step editor ("Path 1 of 1 · to …", **Where work goes next**, **Add path to…**, **Go to**, **Remove path**) | flow | `flows[]` (`from`, `to`, `when`, `on`) |
| **Shared resources** (People, Machine, System) | resource pool | `resources[]` with `kind` `people`, `machine` or `system` |
| Cases, customers or users | case | `cases`, `tokens` in the snapshot |
| **Edit process…**, Definition editor (**Tune values**, **Raw JSON**) | Definition editor | process-setting recipe operations such as `setDescription` and `setSeed` |
| **Edit step…**, step editor | step editor | `putStep` recipe operation |
| "Unapplied draft · …" chip, **Save to draft** | unapplied draft | no CLI equivalent (`--draft` instead permits graph diagnostics) |
| **Apply draft and reset run**, **Apply and reset run** | applied (active) definition | `revision` and `fingerprint` |
| **Present**, **Present slides** (phone menu) | Present mode, slide deck | `process slides`; `format: wildlands-process-slides` |
| working (people) or running (machines and systems) / waiting; slides: "Now in progress", "now waiting" | in progress, queued | `active`, `queued` per step |
| Map legend **Working**, **Waiting**, **Timer**, **Backlog**, **Blocked** | work state of a case token | token `status` `active`, `queued`, `timer`, `backlog`, `held` |
| **Blocked after finishing** (inspector), "blocked" (SIPOC, slides) | held work | `held` per step (a subset of `queued`) |
| **Work cost**; **Capacity cost** | work cost; capacity cost | `metrics.cost`; `metrics.capacityCost` (read model) |
| **Mean cycle** ("—" until a case finishes); **Mean age in progress** | mean cycle time; mean age | `metrics.meanCycleMinutes`; `metrics.meanAgeMinutes` (read model) |
| "min" (slides and SIPOC measures add an hours gloss from 120 min: "19,007 min (≈ 316.8 h)"), the clock "M min of H" with an hours line, "business minute M" in Present | business minute | `duration`, `minute`, `--minutes` |
| **Seed** | seed | `seed`, `--seed` |
| **Run until** ("Until: 24 h (1,440 min)", …, "Until: no limit", "Until: custom…") | run length | `horizon` (`Runtime.create` option) |
| **Process type** | genre | `genre` (`process`, `customer-journey`, `user-journey`) |
| **Tracked measures** | tracked fields | `track` |
| **Random timing**, **Random outcomes (draws)** | random timing, draws | `timing`, `draws` |
| **Feeling** | emotion | `emotion` (-3 to 3) |
| **SIPOC**, **Journey map** | lens | `sipoc`; the lens follows `genre` |

## Definition and units

`format: wildlands-process`, `schemaVersion: 1`, stable `id`, `name`, integer
`revision`, `start`, `resources`, `steps`, `flows`, and `arrivals` are required.
Each step has a unique scene with a stable `id`, a two-dimensional map `position`
in metres (X/Z in 3D), a color, and an optional Scene Forge `asset` definition. Steps have
`start`, `task`, `machine`, `system`, `touchpoint`, `timer`, `decision`, `fork`, `join`, or
`end` kinds (machine and system steps are described under Resource kinds and automated steps). Tasks declare whole
business-minute `duration`, optional `cost`, and simultaneous resource demands.
Tasks and timers may also declare `set` effects and `add` counters (execution rules 10 and 11).
Resource pools declare integer `capacity` and `costPerMinute`; costs are simulated
units, not currency or accounting entries. Pools represent capacity slots; moving
case markers and desk actors represent work, not physical people or a travel-time model.

One explicit simulation tick is one business minute. The shared ECS scheduler
receives its fixed 0.1-second step; this is an adapter interval, not business time.
Durations, arrivals and reported time use business minutes throughout. There is
no wall clock, ambient random source, network call or executable JSON expression
inside the simulation; any randomness comes only from an explicit integer seed
(see Randomness, seeds and steady arrivals). Arrival records specify `at`, `interval`,
scalar case `data` and one end rule (`count`, `until` or `open`). The example's numbers are synthetic demonstration assumptions.

### Resource kinds and automated steps

A resource pool may declare an optional `kind`: `people` (the default when absent),
`machine` (physical equipment such as a robot arm, CNC or packing line) or `system`
(software such as an API service, batch job, CI pipeline or bot). The snapshot
resource view always reports `kind` (absent resolves to `people`).

Two further step kinds execute exactly like tasks: `machine` and `system`. They have
a whole-minute `duration` of at least 1, optional `cost`, simultaneous resource
demands, backlog, `needs`, `set`/`add`, the same receipts (input, output, changes),
the same events (`entered`, `started`, `finished-task`) and token statuses, may sit in
parallel branches, and have one outgoing flow. Admission adds these rules:

- A `machine` step must demand at least one resource and every demanded pool must be
  `kind: machine`; a `system` step likewise needs `kind: system` pools.
- A `task` may demand only `people` pools (absent kind counts as people); naming a
  machine or system pool is a diagnostic. Timers still demand nothing. A `touchpoint`
  (Customer and user journeys) may demand pools of any kind, or none.
- Optional `technology` (1..80 characters) is a display-only label such as `Robot arm`
  or `CI/CD pipeline`; it is allowed on `machine` and `system` steps only.
- Optional `outputs` (up to 16 `{field, label?}`) is allowed on task, machine and
  system steps. Each declared field must be delivered by that step's own `set` or
  `add`, and fields may not repeat. Outputs are an interface declaration kept in the
  definition only; receipts already record the observed outputs, and the snapshot
  step metrics do not repeat them.

Automated steps are simulated assumptions, not integrations: no code, service,
robot or credential is executed or contacted. There is no resource failure, setup
time or maintenance window; a pool simply has capacity. Random durations and
outcomes are opt-in per step (Randomness, seeds and steady arrivals).

## Execution rules

1. At time zero admit due cases, resolve control steps, and allocate ready tasks.
2. A minute completes work already started; release all completed allocations,
   apply task `set` then `add` effects, fire timers that reach their due minute
   (rule 11), then route completions and admit arrivals due now.
3. Allocate queued tasks in entered-time, case-ID, token-ID order. Acquire all
   demands atomically; skip blocked work so another pool can progress. There is
   no preemption. Each task start charges its fixed cost once; occupied pool
   slots charge their per-minute costs for each actual work minute.
4. Start, task, timer and join have exactly one outgoing flow (a work step's optional
   deadline flow, `on: "deadline"`, is not counted). End has none. A decision
   evaluates outgoing conditions in authored order and takes the first match,
   otherwise its single unconditional fallback. Conditions compare a case field
   (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`) to a scalar `value` or to another case field
   named by `valueField` (exactly one of the two). Missing fields, on either side,
   never match, and the ordering operators need numbers on both sides. A condition may
   also be a `chance` route or an `all`/`any`/`not` combinator of conditions
   (Simulation semantics for BPMN-class processes).
5. A fork emits one token per outgoing flow and names a matching join. Parallel
   branches must be disjoint acyclic single-entry paths ending at that join.
   Nested forks and decisions within a parallel region are rejected in v1.
   Branches may update only disjoint case fields; `set` and `add` fields both count
   as writes. A branch may hold tasks and timers. The join consumes exactly one
   arrival per branch of that fork occurrence and emits one continuation. An
   `inclusive` fork (`mode: "inclusive"`) activates only the matching branches and its
   join consumes exactly the tokens that occurrence activated, under the same region rules.
6. Decisions outside parallel regions may implement bounded rework loops. A
   per-case transition limit fails that case explicitly and releases its work.
   A run has finite case, minute, transition, event and receipt limits; an
   arrival must occur strictly before the minute limit. Waiting work
   with no possible progress is reported as blocked, never silently completed.
7. **Backlogs.** A task or join may declare `backlog: {capacity, order, priority?, pull?}`.
   A task's backlog is its waiting queue: at most `capacity` items wait, and work
   that would exceed it stays *held* at its previous step (status `held`, event
   `held`) without resources until room appears. A join's backlog stores merged
   cases (status `backlog`, events `joined`, `backlogged`); a join does not merge
   while its backlog is full. `order` is `fifo` (default, oldest first), `lifo`
   (newest first) or `priority` (highest numeric case field named by `priority`
   first, ties oldest first); it ranks only within that step. A join's optional
   `pull` limits how many items may be queued or working in its next task; items
   are released (event `pulled`) in backlog order whenever the limit allows.
   Backlogs add no hidden capacity: resources still gate every task start.
8. **Needs.** Any step except start may declare `needs: [{field, op?, value?, label?}]`,
   the case data that earlier steps (or arrivals) must have delivered. A step
   delivers data with its task `set` effects. Admission analyses every route from
   the start (arrival data, task `set`, decision routes and parallel merges) and
   rejects a need that is not guaranteed on all routes with a `needs` diagnostic
   naming the step and need. Join needs are checked when the branches merge.
   The runtime repeats the check and fails a case explicitly if a need is unmet.
9. A case finishes only at an end with no outstanding parallel tokens (tokens spawned by a
   non-interrupting deadline run beside the main route; the case finishes with the last of them). Throughput,
   active/queued cases, completed/failed cases, cycle time, task waiting time,
   resource utilization and work cost derive from that same state (see Run metrics and costs).
10. **Counters.** A task or timer may declare `add: {<field>: <delta>}` with one to eight
   fields, each a nonzero whole number within ±1,000,000. At completion the engine
   applies `set` effects and then adds each delta (a missing field counts as 0; a field
   also in `set` adds to the value just set). An existing value that is not a whole number,
   or a sum outside ±1,000,000,000, fails that case explicitly (for example
   `Step "X" cannot add to n because it holds "x", not a whole number.`), applies
   none of the step's effects, records no receipt and releases its work. Static `needs` analysis treats `add` as
   delivering a whole-number field on every route through the step, but cannot prove a
   counter's value, so a need that tests a counter with `op`/`value` is rejected; use a
   bare delivery need. Decisions do not narrow counters or field-to-field conditions.
   Bounded rework loops use a counter and `iteration lt iterations` style conditions.
11. **Timers.** A `timer` step waits without resources, cost or a backlog. It declares
   exactly one of `duration` (1 to 100,000 whole minutes after the token arrives) or
   `until` (an absolute business minute from 1 to 99,999; if the clock is already at or
   past it the timer fires at once, in the same minute, with zero wait). The token has
   status `timer` and a `due` minute, and fires in the pass for the first minute at or
   after `due`: it applies `set` then `add`, records a receipt, and routes like a
   completed task. Simultaneous timers fire in due-minute, case-ID, token-ID order after
   that minute's task completions. Timers use no pool capacity, so any number may wait
   at once, and may sit in parallel branches next to tasks. A pending timer is progress:
   the run is never `blocked` and never `completed` while one waits. If a timer's due
   minute lies beyond the run horizon it stays pending and the run reports `limit`.

Definition validation rejects unknown fields, duplicate identities, nonfinite or
out-of-range values, dangling flows/resources, invalid scene geometry, impossible
resource demands, unreachable steps and steps without a route to an end. These
checks do not prove all data-dependent loops terminate. Bounded execution makes
those failures observable.

Diagnostics name the cause in plain words. A wrong number of outgoing flows says what the
step kind needs and what it has (`A task needs exactly 1 outgoing flow; this one has 0.`;
`... besides its deadline flow` when the step has a deadline). A demand on a pool that does not
exist reads `Uses pool "x", which is not defined.`; a demand above an existing pool's capacity
reads `Demand exceeds the available pool.` A flow whose `from` or `to` step is missing reads
`Both endpoints must exist.`, and while any flow has a missing endpoint the reachability and
route-to-end checks are skipped, so one bad flow is reported once instead of as a cascade of
unreachable steps. A list over its size limit names the limit and the count (`A process holds at
most 128 steps; this one has 150.`, likewise for flows, resource pools and arrival rules).

## Randomness, seeds and steady arrivals

All additions are optional. A definition without them behaves, fingerprints and
reports exactly as before.

**Determinism model.** There is no random generator with state. A draw is a pure
function of the run's integer `seed` and a stable text key: the engine hashes
`seed|key` and takes one value in [0, 1) from a small generator. Keys derive only
from stable identities, never from scheduling order or the clock:
`gap|<arrival entry>|<arrival number in that entry>`,
`arrive|<entry>|<arrival number>|<field>`, `time|<case>|<step>|<visit>`,
`draw|<case>|<step>|<visit>|<field>` and `route|<flow>|<case>|<visit>`
(multi-instance items, deadlines and combinator leaves extend them; see Simulation semantics
for BPMN-class processes). A visit is the case's own count of visits to that step, kept only
for steps that use randomness. Consequently one 1,000-minute advance, a thousand one-minute advances
and a reset followed by a rerun with the same seed produce identical snapshots, and
extra queueing from scarcer resources does not change what a given case draws at a
given step. The exponential, normal and Erlang distributions use a deterministic logarithm and
square root built from exactly rounded arithmetic, so results do not depend on the JavaScript engine.

**Seed.** The definition may declare `seed` (integer 0 to 2,147,483,647, default 1).
`Runtime.create(definition, {seed})` and `wildlands process run --seed N` override it
for one run without editing the definition. The snapshot reports the seed in use
as `seed`, so a report is reproducible from its definition and that number. A different
seed changes every drawn value; it changes nothing else.

**Distributions** (`Dist`) draw whole minutes, never fractions: `{dist: "uniform", min,
max}`, `{dist: "triangular", min, mode, max}`, `{dist: "exponential", mean, max?}`,
`{dist: "normal", mean, sd, min?, max?}` and `{dist: "erlang", k, mean}`
with every number a whole minute from 1 to 100,000 (`k` from 1 to 32) and `min <= mode <= max`
(`mean <= max`). Values are rounded, at least 1 and capped at `max` (exponential:
`max` defaults to 100,000). The normal and Erlang forms are described under Simulation
semantics for BPMN-class processes.

**Random timing.** A task, machine or system step, or a duration timer, may declare
`timing: Dist`. `duration` stays required: it is the planning or mean value that
editors and static analysis show; it is not cross-checked against the distribution.
The realized duration is drawn when work starts (a timer: when its token arrives)
and then drives the clock, resource allocation, per-minute costs and utilisation. The
receipt of a step that declares `timing` also records `duration`, the realized
minutes (`finished - started`). `timing` is rejected on `until` timers, decisions,
forks, joins, start and end.

**Draws.** A task, machine, system or timer step may declare up to eight `draws`, case
fields written at completion after `set` and before `add`; the drawn values appear
in the receipt `changes` and `output` and in the case data:

- `{field, kind: "chance", percent: 1..99, whenTrue?: scalar, whenFalse?: scalar}`
  (defaults `true` and `false`, which must differ);
- `{field, kind: "choice", values: [{value, weight}]}`, two to twelve distinct values
  with whole weights 1 to 1,000;
- `{field, kind: "int", min, max}`, inclusive whole numbers.

A draw field may not repeat, may not also appear in the step's `set`, and may appear
in its `add` only as an `int` draw. Draws count as writes for parallel-branch
disjointness, satisfy `outputs` declarations and count as deliveries for `needs`
analysis: the field is guaranteed, its value is unknown, so a bare `needs` entry
passes and a need with `op`/`value` is rejected like a counter.

**Chance routes.** A flow leaving a decision may use `when: {chance: 1..99}` instead
of a field condition. Flows are still evaluated in authored order and the first match
wins; a chance flow matches when its keyed draw for that case and decision visit is
below the percent. A `when` uses exactly one form, chance flows are allowed only
on decisions, and the decision still needs exactly one unconditional fallback.
Static `needs` analysis does not narrow fields across chance routes.

**Arrival streams.** `{at, count, interval, data}` stays valid. An arrival entry
declares exactly one end rule: `count` (1 to 200, as before), `until` (an absolute
minute: arrivals occur at `at`, `at + interval`, ... while earlier than `until`;
`until` greater than `at`, at most 100,000) or `open: true` (the stream continues for
the whole run). `gap` replaces the fixed spacing with a `Dist` of whole minutes
(minimum 1); `interval` stays required as the mean or planning value, and entries
with `until`, `open` or `gap` need `interval >= 1`. `draws` adds random case fields
at admission; the drawn values are kept in the case `input`. Streams are lazy: the
next arrival minute is computed from the keyed stream only when needed, so an open
stream never builds an unbounded list. Arrivals at the same minute are admitted in
entry order. Each arrival, admitted or refused, takes the next case number
(`case-0001`, ...), so identities do not shift when the system is busy.

**Bounded resources.** `limits.active` (500) is the most unfinished cases at once. An
arrival that finds the cap reached is refused: event `arrival-dropped` (detail
`system full`, case id the arrival would have had) and `metrics.dropped`. Arrivals
due in a minute are admitted before that minute's completions are routed, so a case
finishing in the minute does not yet free its slot. `limits.retained` (200) is the
most finished (completed or failed) cases kept in the snapshot `cases`; older ones
are pruned from the world and the detailed queries, oldest first, and
`retention.finishedDropped` counts them. Run totals (arrived, completed, failed,
dropped, mean cycle, cost, per-step completed and wait time, utilisation) are running
aggregates and stay exact however many cases were pruned; so do `goals`, `lost`,
`conversion`, the tracked-field aggregates and the per-step `entered`, `reached` and
`tracked` values (Customer and user journeys). The 128-receipt and
128-event histories are unchanged and may name a pruned case. Session options `active`
(1 to 500) and `retained` (1 to 10,000) are for tools and tests; defaults apply
otherwise. `limits.cases` still caps the total of `count` arrivals at 200.

**Unlimited and open runs.** With `horizon: null` an open stream keeps the run
`running` until paused; it is never `completed` or `blocked` while an arrival can
still occur, and `limit` is reported only when a set horizon is reached. Each clock
command still advances at most 100,000 minutes. Minutes in which nothing can change
(no arrival, completion or timer due) are applied in bulk with the same totals as
stepping them one by one. Measured on one development machine with Node 22, 100,000
minutes of a stream with about 33,000 arrivals, random timing and a chance route
took roughly 5 seconds; this is a measurement, not a guarantee.

**What this is not.** Random results are scenario assumptions drawn from authored
distributions, not forecasts or measured behaviour; one seed is one possible run. Not
supported: correlated or stateful random streams, lognormal or other distributions,
calendars or shift patterns, random streams shared between steps, and failure
injection on resources.

## Customer and user journeys

A customer journey or user journey is a process whose cases are customers or users and
whose steps are interactions. The engine adds only labels, one step kind and a few
exact counters on top of what already exists; everything is optional and strictly
additive, so a definition without these fields keeps its fingerprint and every result.

**`genre`** (definition level, `process` | `customer-journey` | `user-journey`, default
`process`) is a display preset only. It has no runtime effect: the same definition
runs identically with any genre. Views use it for terminology and a default view.

**`touchpoint`** is a customer- or user-facing interaction. It executes exactly like a
`task` (queue, atomic allocation, `duration` of at least 1, `cost`, `timing`, `draws`,
`set`, `add`, `needs`, `outputs`, backlog, the same receipts and events, parallel
branches, one outgoing flow), with two differences: its `resources` are optional and
may name pools of any kind, so backstage staff or systems can serve it, and with no
resources it never waits for capacity. It may declare a display `channel`, one of
`web`, `mobile`, `store`, `phone`, `chat`, `email`, `social`, `ads`, `delivery` or
`document`; any other step kind that names a channel is a diagnostic, and so is an
unknown channel. `technology` stays machine and system only.

**Annotations** are allowed on any step kind and never affect execution: `phase`
(1..40 characters; groups steps into journey stages or process milestones), `emotion`
(integer -3..3: the expected feeling of the customer or user at this step), and the
free-text notes `pain` and `opportunity` (1..240 characters each). They are authored
assumptions, not measurements.

**End outcomes.** An `end` step may declare `outcome: "goal" | "lost"` (end steps only).
The snapshot `metrics` add `goals` and `lost` (completed cases that finished at such an
end) and `conversion`, an integer permille `goals * 1000 / (goals + lost)` rounded half
up (0 to 1000), or `null` when no case has finished with an outcome. Ends without an
outcome count in `completed` only. All three are running aggregates, exact when
finished cases are pruned.

**Funnel counts.** Every step metric reports `entered` (every entry, equal to
`visits`) and `reached`, the number of distinct cases that entered the step at least
once. A rework loop raises `entered` but not `reached`. `reached` is kept with a small
per-case visited marker that is dropped when the case finishes, so it is exact under
pruning and does not grow with the run. The difference of two steps' `reached` values is not
all drop-off: it also holds cases that took an alternative route and cases still in progress.

The Journey map's funnel row shows, for each main-route step, the cases that reached it and
their share of the first step. Its drop-off ("−N% lost (n)") counts only cases that finished at
an end with `outcome: "lost"` branching off since the previous main-route step; a branch that
comes back reads "split, rejoins at <step>", and cases still between the two steps read "n in
progress", so neither shows as a loss. Failed cases are not counted there. The main route is
`LWProcessRoute.next` at each step (the rule the SIPOC view and the slides share), except that the
journey map keeps a fork's first branch on the route and draws the others as branches.

**Tracked fields.** `track` (definition level, up to six `{field, label?}`; the field
follows the case-field name rule, `label` is 1..40 characters, fields may not repeat)
selects case fields to summarize. Non-numeric, missing and non-finite values are
ignored, and the engine never reads a field the definition did not list.

- `metrics.tracked[field] = {label, n, mean, min, max}` aggregates the value at the
  finish of every completed case. `label` defaults to the field name; with `n` 0 the
  `mean`, `min` and `max` are `null`.
- Every step metric holds `tracked[field] = {n, mean}`, the average of the case's
  value at each entry to that step. Plotting `mean` along the touchpoints gives a
  measured sentiment curve next to the authored `emotion` expectation.
- Means are rounded to three decimals with `Math.round(x * 1000) / 1000`. Aggregates
  are running totals in a fixed event order, so they are exact when finished cases are
  pruned and identical however the clock is advanced in chunks.

**Modelling recipes.** Drop-off is a decision with a `chance` route to an end step with
`outcome: "lost"` (an abandonment end), or a field condition on a drawn or counted
value. Conversion randomness comes from `draws` and chance routes, whose keyed draws
are described in Randomness, seeds and steady arrivals. Sentiment is a counter field:
touchpoints `add` positive or negative whole numbers to it, an arrival `draws` or
`data` gives a starting mood, and `track` reports it. Waiting (delivery, consideration
time, a cooling-off period) is a `timer` or a touchpoint with `timing`. Steady demand is
an open or `until` arrival stream. Channels, phases and notes organize what a view
shows; none of them changes a result.

**What this is not.** Not supported: persona or segment libraries (segment by arrival
`data` and `draws` yourself), several simultaneous channels per customer beyond
explicit fork branches, marketing attribution models, and sentiment derived from text.
`emotion` annotations and the tracked mood are scenario assumptions, and `conversion`
is the outcome of a seeded simulation, not a forecast or a measured conversion rate.

## Simulation semantics for BPMN-class processes

Five additions let the engine simulate the constructs of a BPMN model: richer duration
distributions, boolean gateway conditions, inclusive gateways, multi-instance activities and
boundary timer events. All are optional and strictly additive: a definition without them keeps
its fingerprint, every pinned result and its snapshots (new snapshot fields exist only where a
step declares the feature). They add no ambient randomness: every draw is a pure function of
the seed and a key built from stable identities, so chunked advances equal a single advance and
extra queueing never changes what a given case draws.

### Normal and Erlang distributions

`Dist` (a step's `timing`, an arrival's `gap`, a deadline's `timing`) gains two forms:

```json
{"dist": "normal", "mean": 30, "sd": 5, "min": 20, "max": 45}
{"dist": "erlang", "k": 3, "mean": 30}
```

- `normal` needs whole `mean` and `sd` (1 to 100,000; `sd` at least 1); `min` (default 1)
  and `max` (default `mean + 6 * sd`, never above 100,000) are optional bounds. The drawn
  value is rounded and clamped to `[min, max]`; admission rejects an empty range. It is drawn
  with the Marsaglia polar method: attempt `n` takes two keyed uniform values (`<key>|n<n>|a`
  and `|b`), rejects the pair outside the unit disc, and uses `sqrt` and the engine's own
  exactly rounded logarithm; after 64 rejected attempts (practically never) the result is the
  mean. No `Math.cos`, `Math.log` or `Math.exp` result is used.
- `erlang` needs `k` (1 to 32 phases) and a whole `mean`. The value is the sum of `k` keyed
  exponentials (`<key>|e0` ... `|e<k-1>`) with mean `mean / k` each, rounded once and clamped
  to 1..100,000. Its standard deviation is `mean / sqrt(k)`; `k = 1` is exponential.
- Unknown keys for a form (`k` on a normal, `sd` on an Erlang, `max` on an Erlang) are
  rejected like the existing ones. For BPSim-style data, `normal` and `erlang` map directly to
  the distributions of the same name; `mean` and `sd` must be whole minutes.

### Condition combinators

A flow `when` may be a combinator instead of a single comparison or `chance`:
`{"all": [cond, ...]}`, `{"any": [cond, ...]}` or `{"not": cond}`. Each node uses exactly one
form, lists are non-empty (at most 8 entries), combinators nest at most 3 levels and one
`when` has at most 8 leaves (comparisons and chances together). Combinators and chance leaves
are allowed on flows leaving a decision or an inclusive fork only.

```json
{"id": "to-review", "from": "gate", "to": "review", "when":
  {"all": [{"field": "amount", "op": "gte", "value": 1000},
           {"any": [{"field": "region", "op": "eq", "value": "eu"}, {"not": {"field": "vip", "op": "eq", "value": true}}]}]}}
```

`all` and `any` evaluate in authored order and short-circuit; `not` negates. A missing field
never matches, so `not` of a leaf on a missing field is true. Every `chance` leaf draws from
its own keyed stream `route|<flow>|<leaf path>|<case>|<visit>` (the top-level leaf keeps the
plain `route|<flow>|<case>|<visit>` key; a path is the list index, or `n` under a `not`, joined
with dots, for example `1.0`). A keyed draw has no state, so whether an earlier leaf
short-circuited never changes what a later chance leaf would answer for that case.
Decisions still evaluate flows in authored order and fall back to the single flow without
`when`. Needs analysis does not treat conditions as needs and never narrows a field across a
combinator (it stays conservative).

### Inclusive gateway

A `fork` may declare `mode: "inclusive"` (absent means parallel, unchanged). Its outgoing
flows (at least two) may carry any `when`. At runtime the activated set is every flow whose
condition is true, in authored order; if none matches, the single flow without `when` (the
default flow) is activated; if none matches and there is no default, the case fails with
`Inclusive fork "X" matched no outgoing flow.` Admission allows zero or one flow without a
condition, and conditional flows only on inclusive forks and decisions. Event `forked`
(step = the fork) lists the activated flow ids, comma separated; parallel forks emit no such
event. Branch tokens carry `expected` (the count activated) so the join, named by `fork.join`,
consumes exactly that many tokens of the occurrence and emits one continuation.

```json
{"id": "ship", "kind": "fork", "join": "shipped", "mode": "inclusive"}
{"id": "to-insure", "from": "ship", "to": "insure", "when": {"field": "insured", "op": "eq", "value": true}}
{"id": "to-gift", "from": "ship", "to": "gift", "when": {"field": "gift", "op": "eq", "value": true}}
{"id": "to-parcel", "from": "ship", "to": "shipped"}
```

Branch regions follow the parallel rules: disjoint acyclic single-entry chains of work steps
(task, touchpoint, machine, system) and timers that end at the join, writing disjoint fields,
with no nested forks, decisions or joins; a flow straight from the fork to the join is an empty
branch (as above). Nested inclusive or exclusive gateways inside a region are not supported,
and the BPMN importer must report them. A field written on only some branches is not
guaranteed after the join: needs analysis unites the branch's values with the values before
the fork, so only fields delivered before the fork are guaranteed.

### Multi-instance work

A task, touchpoint, machine or system step may declare
`instances: {count: 2..50 | field: <case field>, mode: "parallel" | "sequential"}` (exactly
one of `count` and `field`; with `field` the runtime reads a whole number 1..50 from the case
data when the step is entered and otherwise fails the case, for example `... needs case field n
as a whole number from 1 to 50 for its instances, but it is not set.`). Admission rejects `field`
when no arrival or earlier step delivers it (a `needs` diagnostic at `/steps/N/instances/field`);
a delivered value is still judged per case at run time.

```json
{"id": "inspect", "kind": "task", "duration": 4, "cost": 10, "resources": {"auditors": 1},
 "set": {"inspected": true}, "instances": {"field": "lines", "mode": "parallel"}}
```

- `parallel`: all items are queued at entry; each demands the step's resources, draws its own
  random timing (`time|<case>|<step>|<visit>|<item>`, item numbers start at 1) and starts
  whenever capacity allows, in item order. `sequential`: item 1 is queued at entry and item
  `i + 1` enters the queue (at that minute, behind earlier waiters) when item `i` finishes.
- The step completes once when every item is done: `set`, `add` and `draws` are applied once
  (draws key to the visit), the case is routed once and `completed` counts the visit once.
  The fixed `cost` is charged for every item and pool minutes for every working item.
- One receipt per visit: `started` is the first item's start, `finished` the last item's end,
  `input` the case data at the first start, plus `instances: N` (only on these steps; `duration`
  still appears when the step has `timing`).
- Item tokens carry `item` (1-based), `items` (count) and `group` (the first item's token id).
  For these steps `queued` and `active` count items (sequential items not yet queued are not
  counted), and the step metric adds `items: {started, finished}` (cumulative items). `waitMinutes`
  sums every item's wait. Events `started` and `finished-task` are emitted per item with the
  detail `item i of N`.
- `backlog` on a multi-instance step is rejected.

### Boundary deadlines

A work step (not a timer) may declare
`deadline: {after: <minutes> | timing: Dist, mode: "interrupt" | "escalate", flow: <flow id>}`,
exactly one of `after` and `timing`. The named flow leaves the step and is marked `on: "deadline"`; it
is not the step's normal outgoing flow, so the step still has exactly one other flow. The deadline
starts when work starts (queue time is excluded) and fires `after` minutes (a drawn
`deadline|<case>|<step>|<visit>[|<item>]` value for `timing`) later. Work that finishes earlier,
or in the same minute, completes normally with no event.

```json
{"id": "approve", "kind": "task", "duration": 30, "resources": {"clerks": 1}, "set": {"approved": true},
 "deadline": {"after": 20, "mode": "escalate", "flow": "approve-late"}}
{"id": "approve-late", "from": "approve", "to": "alert-manager", "on": "deadline"}
```

- `interrupt`: the remaining work is cancelled and its resources released, `set`, `add` and
  `draws` are not applied, no receipt is recorded, cost covers the minutes actually worked, and
  the token is routed along the deadline flow (it may rejoin the main path). A step inside a
  parallel or inclusive region cannot interrupt (the join would never complete).
- `escalate` (non-interrupting): the work continues and completes normally; a new token is
  spawned on the deadline flow at the next settle step of that minute. Its route must reach an
  `end` and share no step with the normal route, cannot contain another escalating deadline (an
  escalated token is not escalated again) and is checked at admission. The escalated token shares
  case data with the work that continues (the normal route and, inside a fork region, sibling
  branches). Admission rejects a field both sides write, and needs analysis lets each side see
  every value the other may write. The case finishes only
  when the main and every escalated token are done; it counts the `outcome` of the main route's
  end (escalation ends' outcomes are not counted). At most 16 escalations per case: the 17th
  fails the case with `Case spawned more than 16 escalations.`
- Multi-instance steps keep a deadline clock per item: an interrupt cancels the whole visit
  (all items) once; an escalation is spawned per late item (bounded by the same 16).
- Events `deadline-interrupt` and `deadline-escalate` (step = the deadline step, detail = the
  deadline flow id, plus ` item i of N` for items). The step metric adds
  `deadlines: {interrupted, escalated}` (cumulative firings; only on steps with a deadline).
  A running token carries `deadlineAt` (the absolute minute) while its deadline is pending and
  escalated tokens carry `escalated: true`.

### Limits and determinism notes

Instance counts are at most 50, a condition has at most 8 leaves and 3 combinator levels, every
list in the new fields is bounded, escalations are at most 16 per case, and the per-case
transition limit still protects loops. New random keys never depend on scheduling order: items
key by index, deadlines by case, step, visit and item, and combinator chance leaves by flow,
leaf path, case and visit. An inclusive fork with chance conditions counts its own visits. Cases
that were retained or pruned, and snapshots taken after one advance or many, are identical.
A run that would pass 99,999,999 tokens stops before the transition changes anything (`The run
created more than 99999999 tokens; start a new run.`), so a fork, an item group or an arrival is
never half applied.

### BPMN mapping intent

| BPMN 2.0 | Wildlands |
| --- | --- |
| inclusive gateway (diverging + converging) | `fork` with `mode: "inclusive"` + its `join`; flow conditions become `when`, the BPMN default flow becomes the flow without `when` |
| multi-instance activity (parallel / sequential) | `instances: {count \| field, mode}` |
| interrupting boundary timer event | `deadline` with `mode: "interrupt"` and a flow `on: "deadline"` |
| non-interrupting boundary timer event | `deadline` with `mode: "escalate"` and a flow `on: "deadline"` to its own end |
| `conditionExpression` with `&&`, `\|\|`, `!` | `all`, `any`, `not` |
| BPSim normal / erlang distributions | `{dist: "normal", mean, sd}` / `{dist: "erlang", k, mean}` |
| event-based gateway racing outcomes | only a race by chance (a decision with `chance` routes), not event-driven |

### Not supported

Event-based gateway semantics beyond a race by chance, complex gateway semantics (the importer
rejects them, or with `unsupported: drop` approximates them as an exclusive decision), timer
calendars or working hours (every timer counts plain business minutes), compensation, error
propagation across subprocess boundaries, message flows between pools (simulate them as timers or
timed tasks), data objects (ignored), nested inclusive or exclusive gateways inside a fork region,
escalation routes that rejoin the main path, deadlines on timers, and multi-instance completion
conditions (every item runs). These are scenario assumptions, not validated process models.

## SIPOC description

`sipoc` (definition level, optional) is a purely descriptive record of the external
parties in a SIPOC view (Suppliers, Inputs, Process, Outputs, Customers). It has no
runtime effect: a definition with or without it produces identical runs and snapshots.
It changes only the definition, so its fingerprint differs when present; existing
definitions and results are unchanged. It applies to every genre, although the studio
shows the SIPOC view for business processes.

```json
"sipoc": {
  "suppliers": [{"name": "Warehouse", "supplies": "Stock and packaging"}],
  "customers": [{"name": "Shopper", "receives": "Delivered parcel"}]
}
```

Shape: `suppliers` and `customers` are each at most 8 entries of `{name (1-60 characters),
supplies | receives (optional, 1-160 characters)}` (suppliers use `supplies`, customers
use `receives`). Unknown keys are rejected, and a name repeated within one list is a
graph diagnostic at `/sipoc/suppliers/N/name` (or `/sipoc/customers/N/name`).

**Authored versus derived.** Only suppliers and customers are authored. Views derive
the rest automatically: inputs from arrival data and undelivered needs, process stages
from the step phases or the main route, outputs from declared step outputs and final
deliveries, and measures from the snapshot. Do not repeat derived content in `sipoc`.

How the SIPOC view derives its columns (pure `model()` in `process-sipoc-model.ts`, drawn by `process-renderer-sipoc.ts`; the main-route walk and phase grouping are the shared `process-route.ts`, also used by the slide deck):
suppliers and customers come only from `sipoc`, otherwise one muted "Add suppliers/customers
in Edit process" card; inputs are the fields in arrival `data` and `draws` plus `needs` that
no step delivers through `set`, `add` or `draws`, except internal state: a field that steps set
or add to and that every arrival seeds with the same constant (a counter starting at 0, a flag
starting false) is not an input, while a field the arrivals draw or seed with different values
stays one. An input's label comes from a presence need (a need without `op`; a tested need's
label describes a condition, not the field), else the declared output, else the field name; its
example lists the distinct arrival values (at most four, then "…") and plain descriptions of
draws, with live "cases arrived". The process column follows the main
route (first unconditional flow at decisions, a fork with its branches as one "in parallel"
stage), grouped by `phase` in order of first appearance, or collapsed into at most 7 stages
named by their first step; a stage shows live in-progress, waiting (`queued` minus `held`) and,
when any, blocked sums, a dashed "variant" marker when it holds a decision or rework loop, and
**completed**: the distinct cases that left the stage (the `reached` count of the next
main-route step, plus cases that finished at an end reached only from inside the stage, not
counting the ends of escalation paths), never a sum of step completions, so rework visits,
decisions and joins do not count as extra cases. Outputs are declared step
`outputs`, fields delivered just before end steps and one entry per end step (goal, lost or
reached) with its completed count; a measures strip shows completed, in progress, mean cycle
("—" until a case finishes), mean age in progress, work cost, capacity cost, throughput per 100
minutes, conversion and tracked means when present.

## Authoring and ownership

The application owns the ECS world and clock. The domain owns schema admission,
routing and resource semantics. Browser code, CLI and AI agents use commands and
detached queries. Import validates the complete document before replacing the
active session; a failure retains the existing process. Editing creates a new
revision and resets only when explicitly applied. The browser starts paused.

Agent tooling exposes discover, schema, create, validate, inspect, edit, run,
build and forge operations under `wildlands process`. Edit recipes require an
expected revision and fingerprint, apply complete upserts/removals atomically,
support dry runs, and report the resulting definition plus validation diagnostics.
Drafts may have graph diagnostics between incremental edits; runnable/exported
definitions must pass all validation. Commands never execute arbitrary methods.

## Scenes, Scene Forge and builds

The overview shows the complete connected graph in 2D or real Three.js 3D.
A third, type-driven lens shows the SIPOC grid (business process) or the Journey map (customer or user journey) over the same detached view; the controller mode is `lens` and the lens follows `genre`. Selecting in the lens only selects a step and never ticks.
Selecting a step opens its scene, resources, active work and queue. Switching
views or selecting another scene retains the same process time. Each step's
Scene Forge assets are interpreted by the existing Wildlands asset renderer.
The forge bridge emits one editable Scene Forge scene recipe per process step;
the reverse bridge admits Scene Forge's Wildlands asset export as scene assets.
No scripts, URLs or dynamically loaded modules are admitted as process assets.

Process definitions live in a data-only game folder with `template: process` and
exactly one of `content.definition` (one JSON path) or `content.definitions` (1-8
unique JSON paths; the first is the initially active process). Every listed file is
part of the folder inventory and digest and is admitted on its own; admission names
the failing index. A multi-process folder embeds the first entry as
`LWProcessDefinition` (so single-process consumers are unchanged) and the ordered
list as `LWProcessDefinitions`; the content profile exposes them as `process` and
`processes`. `build-game` and `process build` emit a single offline HTML
file containing the runtime, Three.js, CSS, process definition and scene assets.
The viewer imports/exports process JSON, runs/pauses/steps/resets simulations,
exports reports and downloads a new self-contained HTML with the current
definition. Exported HTML starts a fresh paused run; it is not a checkpoint.

When a game lists more than one process, the header shows a labelled **Process**
selector (hidden for one process) naming each definition. Switching has replace
semantics: a new paused session at minute 0, nothing selected, receipts and
inspector reset, the 3D scene and 2D frame rebuilt, with run length and view mode
kept. It never ticks the clock, even from a running process. When the run is past minute 0,
choosing another process first asks "Switch to <process>?" in a small modal that starts on
**Cancel** and names the minute and case count it discards (and that unapplied drafts are kept);
**Cancel**, Escape or Close restore the selector and its focus and leave the run unchanged
("Stayed on <process>. The run is unchanged."), and **Switch process** switches. A run seed
typed into **Seed** applies only to the process it was typed for; the status says so after a
switch ("Run seed 9 applied only to <process>; this process uses its own seed 7."). The studio keeps each
process's applied (edited, applied or imported) definition and its unapplied draft
text in memory, so switching back restores both. Import and Apply replace only the
active process in place. Export JSON, BPMN, draft and run report act on the active
process only, as the Export menu hint states. **Download HTML** rewrites
`LWProcessDefinition` (the first list entry) and `LWProcessDefinitions` with all
current applied definitions in list order; the page reopens on the first process
with every edit. Unapplied drafts and runs are not included.

## BPMN 2.0 interchange

`process export-bpmn` and the studio's **Export BPMN** (and **Export BPMN with BPSim**) write
BPMN 2.0 XML (model and diagram interchange); `process import-bpmn` and the studio's
**Import…** (through the **Import BPMN** dialog, see Presentation limits) read it.

| Wildlands | BPMN 2.0 |
| --- | --- |
| start / end | `startEvent` / `endEvent` |
| task (duration, cost, `set`, `add`, `outputs`) | `task`; resource demands as `performer` + `resourceRef` |
| system step (`technology`, `outputs`) | `serviceTask`; the extension `<wl:step kind="system" technology="..."/>` and `<wl:output field label/>` |
| touchpoint (journey interaction, `channel`) | `userTask` (customer-facing interaction); the extension `<wl:step kind="touchpoint" channel="..."/>` is what marks it, so a foreign `userTask` stays a plain task |
| step annotations `phase`, `emotion` (-3..3), `pain`, `opportunity` (any step kind) | attributes of `<wl:step/>` (extension only) |
| end `outcome` (`goal` or `lost`) | `<wl:step outcome="..."/>` on a plain `endEvent` |
| definition `genre`, `track` (`field`, `label`) | `genre` on `<wl:process/>`; one `<wl:track field label/>` per tracked field (extension only) |
| definition `sipoc` (`suppliers`, `customers`: `name`, `supplies`/`receives`) | one `<wl:supplier name supplies/>` / `<wl:customer name receives/>` per party under the process `extensionElements`, in list order (extension only) |
| machine step (`technology`, `outputs`) | plain `task` (BPMN 2.0 has no machine task type); the extension `<wl:step kind="machine" .../>` is what marks it |
| timer (`duration`) | `intermediateCatchEvent` (id prefix `Event_`, event-sized shape) with `timerEventDefinition` / `timeDuration` `PT{n}M` |
| timer (`until`) | the same element with a `timeDate`; see below |
| decision, conditional flow | `exclusiveGateway` with `default`; `conditionExpression` (`${field == value}`, `${field < otherField}`, or `&&` / `\|\|` / `!` combinations such as `${a > 1 && !(b == 'x')}`) |
| fork / join | diverging / converging `parallelGateway` |
| inclusive fork / join (`mode: "inclusive"`) | diverging / converging `inclusiveGateway`; the flow without `when` is the gateway `default`; `<wl:step join>` names the join |
| `instances` (`count` or `field`, `parallel` or `sequential`) | `multiInstanceLoopCharacteristics` (`isSequential`, `loopCardinality` as the literal count or `${field}`); the extension `<wl:instances count field mode/>` is exact |
| `deadline` (`after` or `timing`, `interrupt` or `escalate`) and its `on: "deadline"` flow | `boundaryEvent` (`cancelActivity` true for interrupt, false for escalate) with `timerEventDefinition` / `timeDuration` `PT{n}M` (a random deadline shows its mean); the flow leaves the boundary event; `<wl:deadline mode flow after/>` (and `<wl:timing/>`) are exact |
| combinator conditions (`all`, `any`, `not`) | the expression above plus a nested `<wl:when combine="all\|any\|not">` tree; a condition holding a `chance` leaf has no standard expression, only the tree |
| a work step's first demanded people pool | `laneSet` / `lane` (`<wl:lane resource>`) with a `flowNodeRef` for the step, besides the `performer` + `resourceRef` demand |
| `export-bpmn --bpsim` | a `BPSimData` relationship with one scenario (see Exporting BPSim) |
| definition `seed` | `<wl:process seed="N"/>` (extension only) |
| step `timing` (task, machine, system, duration timer) | `<wl:timing dist min mode max mean sd k/>`; the standard `timeDuration` keeps the planning `duration` (extension only, no `timerEventDefinition` form) |
| step `draws` | `<wl:draw field kind percent min max>` with `<wl:whenTrue/>`, `<wl:whenFalse/>` and `<wl:choice weight/>` children carrying typed scalars |
| chance route (`when: {chance}`) | `<wl:when chance="N"/>` plus a visible `conditionExpression` with `language="urn:wildlands:process:1#chance"` and text `N%` |
| arrival (`count`, `until` or `open`, `gap`, `draws`) | `<wl:arrival at interval>` with exactly one of `count`, `until`, `open="true"`; children `<wl:gap/>`, `<wl:draw/>`, `<wl:data/>` |
| flow label | `sequenceFlow` `name` |
| resources (with `kind`) | root `resource`; `kind` (`people`, `machine`, `system`) travels as `kind` on `<wl:resource/>` |
| scenes, layout | `BPMNShape` / `BPMNEdge` (10 pixels per scene unit) |

Values BPMN has no field for (durations, `until` minutes, costs, capacities, `set`, `add`,
`needs`, `backlog`, `valueField` comparisons, arrivals, scene ids, colours, attached assets, the exact condition) travel in
elements of the `urn:wildlands:process:1` namespace inside `extensionElements`. An
export imports back to an identical definition (same fingerprint), including
descriptions exactly as written (empty included) and containers present but empty, which
the extension lists in an `empty` attribute of `<wl:step>`, `<wl:process>` or
`<wl:arrival>`. Other BPMN tools ignore the extension. Exported files are not executable
BPMN (`isExecutable="false"`).
SIPOC parties stay in the extension: BPMN 2.0 has no SIPOC concept, and a `participant` would imply a collaboration with message flows that the engine does not model. The importer rejects unknown attributes or child elements, a missing or over-long `name`/`supplies`/`receives`, duplicate names within one list and more than 8 parties per list.

Every `wl:` element is checked against the vocabulary the exporter writes for its BPMN
element. Unknown elements or attributes, invalid `mode`, `op`, scalar `type` or boolean
values, non-whole numbers and non-numeric scene coordinates are rejections; nothing is
coerced. Attribute values carry tab, LF and CR as character references (`&#9;`, `&#10;`,
`&#13;`) and text carries CR as `&#13;`. Export refuses characters XML 1.0 cannot
represent, naming the character; the reader rejects them raw or as references.

An `until` timer waits for an absolute business minute, which BPMN cannot express
without a calendar. The exact minute travels in `<wl:step until="N"/>`; for tools that
ignore the extension the event carries a standard `timeDate` showing minute N counted
from the synthetic epoch `1970-01-01T00:00Z` (minute 200 is `1970-01-01T03:20:00Z`). That
text is display only: import trusts `until` from the extension and refuses a `timeDate`
without it. In `conditionExpression`, a bare word other than `true`, `false` or `null`
names another case field (`${a < b}`); the exact comparison is in
`<wl:when valueField="b"/>`. Text values are single-quoted (`${a == 'b'}`), or
double-quoted when the text holds an apostrophe. Text holding both quote kinds, a field
named `true`, `false`, `null`, `and`/`or`/`not` (any case) or an operator word (`eq ne gt
ge gte lt le lte`), and non-decimal numbers get no standard expression, so the visible text
is never ambiguous; the extension still carries the exact condition.

Random values follow the same rule: the extension carries the exact value and other tools
ignore it. BPMN has no standard chance or probability expression, and an invented
`${chance 15%}` would look like an expression language it is not, so a chance route uses
the BPMN-sanctioned `language` attribute of `conditionExpression` with the URI
`urn:wildlands:process:1#chance` and the plain text `15%`. Tools that do not know the
language show the percent and cannot evaluate it. Import accepts the extension, the
expression, or both when they agree. It rejects explicitly: a chance together with a field
condition, extension and expression percentages that differ, text other than a whole
`N%`, several `conditionExpression` elements, a chance flow that does not leave an
exclusive gateway, non-integer numbers, unknown attributes, elements, `dist` or draw
`kind` values, duplicate `timing`, `gap`, `whenTrue` or `whenFalse` elements, a choice
without a weight, an `open` other than `true`, and an arrival that does not declare
exactly one of `count`, `until` or `open`. Value ranges (percent 1 to 99, distribution
bounds, draw counts, `timing` on `until` timers) stay with the engine validator and come
back as diagnostics, never repaired. Foreign BPMN that lacks these elements imports unchanged.

Automated steps use the same `Activity_` id prefix and task-sized shape as tasks. Import
restores `kind`, `technology`, `outputs` and resource `kind` only from the Wildlands
extension, whatever the element is called. A `serviceTask`, `scriptTask`, `sendTask`,
`receiveTask` or `businessRuleTask` without that extension is foreign BPMN: by default it
becomes a `system` step on a system pool (Importing foreign BPMN for simulation); with
`autoSystemPool` off it stays a plain task with the usual warning, so missing pools never fail admission. An extension that
disagrees with the file is not repaired: the declared `kind` is kept, a warning names an
element mismatch (for example `machine` on a `userTask`), and the engine's admission
diagnostics (pool kinds, outputs, `technology`, unknown `kind`) are returned through the normal
draft path.

Journey values follow the same rule: the extension carries them and other tools ignore
them, so a journey exports and imports back with the same fingerprint (touchpoints,
channels, annotations, outcomes, genre and tracked fields), and a `userTask` without the
extension stays a plain task. Import rejects explicitly: an unknown `channel`, `genre` or
`outcome`, an `emotion` that is not a whole number from -3 to 3, a `track` without a
`field`, with unknown attributes, or repeating a field. A `touchpoint` declared on an element other than `userTask` is kept with a
mismatch warning, as for machine and system steps. Where an annotation applies (channel on
touchpoints only, outcome on end steps only, text lengths) stays with the engine validator
and comes back as diagnostics, never repaired.

Import accepts the constructs of the first table directly and maps a much wider set of foreign BPMN for simulation, described next. A `timeDate` timer needs the Wildlands `until` extension.

**ISO-8601 durations.** Catch timers, boundary timers and BPSim `DurationParameter` share one
ISO-8601 reading (`PnW`, `PnD`, `PTnH`, `PTnM`, `PTnS`, combinations such as `PT1H30M`, decimals
allowed). A day is `minutesPerDay` and an hour `minutesPerHour` business minutes, a week 5 days,
and the result is rounded to the nearest whole minute. A value under one minute (zero included)
becomes 1 minute with the warning `Timer duration "PT30S" is under one minute and is rounded up
to 1 minute.` Years, months, lower-case designators, negative or empty text are rejected naming
the text. There are no calendars or working hours: a duration is a count of business minutes,
not a span of dated time.

### Importing foreign BPMN for simulation

`process import-bpmn`, the studio's **Import BPMN** dialog and `LWProcessBpmn.import` / `analyze` turn a BPMN 2.0
file from another tool into a definition the engine can run. A file the Wildlands exporter wrote
is restored exactly from its extension (extension values always win). Anything else is mapped
onto the constructs of Simulation semantics for BPMN-class processes, and **every foreign
element is reported**. The tool never executes anything: service tasks, scripts, rules and
messages become timed work with assumed durations. A mapped file is a scenario to experiment
with, not a validated model of the original process (no BPMN conformance suite or specific
modeler was used to verify the mapping).

Options (CLI flag / API name; all optional, validated before any work):

| Option | Default | Meaning |
|---|---|---|
| `--process ID` / `process` | first `isExecutable="true"` process, else the first | Id or name of the process, or of the participant whose `processRef` it is. Other processes are not imported (a warning lists them) unless a call activity inlines them. |
| `--lanes pools\|ignore` / `lanes` | `pools` | `pools`: each lane that holds tasks becomes a pool named after it, demanded 1 per task. `ignore`: lanes are only reported and tasks demand no pool. |
| `--default-capacity N` / `defaultCapacity` | 1 | Capacity of a people pool created from a lane (1-1000). |
| `--no-auto-system-pool` / `autoSystemPool` | on | On: service-type tasks become `system` steps on the pool `Automation`. Off: they stay plain tasks with a warning. |
| `--system-capacity N` / `systemCapacity` | 4 | Capacity of system pools created from lanes or `Automation` (1-1000). `Automation` costs 1 per minute. |
| `--default-duration N` / `defaultDuration` | 5 | Minutes for a task or wait without any duration (1-100000). |
| `--minutes-per-day N`, `--minutes-per-hour N` / `minutesPerDay`, `minutesPerHour` | 480, 60 | Business minutes in a day (1-1440) and an hour (1-60) for ISO-8601 timer durations and BPSim units; a week is 5 days. |
| `--unsupported reject\|drop` / `unsupported` | `reject` | Reject lists unsupported constructs as rejections (no definition). Drop removes them with a warning each, bridges the flows of a dropped element that has one way out, prunes what the start can no longer reach, and fails if no end remains reachable or a remaining step has no route to an end. |
| `--no-bpsim` / `bpsim` | on | Ignore BPSim scenarios. |
| `--scenario ID` / `scenario` | first | BPSim scenario id or name; an unknown one is a rejection. |
| `--draft`, `--report FILE` | | CLI only: keep a definition with graph diagnostics; write the complete mapping to a JSON file. |

What becomes what (foreign element, then engine construct):

| BPMN 2.0 | Wildlands |
|---|---|
| `task`, `userTask`, `manualTask` | `task`; in a lane with a pool, demands 1 of it |
| `serviceTask`, `scriptTask`, `businessRuleTask`, `sendTask` | `system` step on its lane's system pool, else on `Automation`; one summary warning lists them |
| `receiveTask` | the same, plus a warning: it waits for its processing time and message arrival is an assumption |
| `laneSet` / `lane` / `flowNodeRef` | a pool per lane that holds tasks. A lane is a `system` pool when it holds no user, manual or plain task and (its name matches system, service, automation, engine, robot, bot, API, software, batch, server or platform, or all its tasks are service-type); otherwise a `people` pool. A service task in a people lane runs on `Automation`. Capacity and cost come from BPSim, else the options. |
| `performer` with `resourceRef` | the demand, exactly as before; it takes precedence over the lane |
| expanded `subProcess` (one start, at least one end, depth at most 3) | inlined: inner start and end events are folded away, inner steps get `phase` = the sub-process name and ids prefixed `<subId>-` |
| `callActivity` whose `calledElement` is a `process` in the file | an inlined copy (phase = call activity name, ids prefixed `<callId>-`). A recursive call is rejected; an unknown callee becomes a placeholder task plus a warning |
| `multiInstanceLoopCharacteristics` on a task | `instances`: literal `loopCardinality` n (2-50; larger values are clamped to 50 with a warning, 1 runs once) becomes `count`; `${field}` or a data collection becomes `field` (a generated `<id>Items` for collections) with a warning that arrivals must set it to 1-50; `isSequential` gives the mode; `completionCondition` is ignored with a warning |
| `standardLoopCharacteristics` on a task | a counter loop: the task adds 1 to the generated field `<id>Runs` and is followed by a decision step that repeats it while the parsed `loopCondition` (else a 50% chance, with a warning) holds and the counter is below `loopMaximum` (default 3) |
| `exclusiveGateway` | `decision`; merging gateways fold into their flows |
| `parallelGateway` | `fork` / `join` as before |
| `inclusiveGateway` pair | `fork` with `mode: "inclusive"` and its `join`. The region must be a clean single-entry, single-exit set of task/timer chains (a direct split-to-join flow is an empty branch); nested gateways, loops or a mismatched join are rejected naming the gateway and the element found |
| `eventBasedGateway` | `decision` with chance routes (equal shares, or BPSim probabilities) and the warning `race between events simulated by chance` |
| `complexGateway` | rejected; with `unsupported: drop` approximated as an exclusive gateway |
| `intermediateCatchEvent` timer with `timeDuration` | `timer` of the ISO-8601 duration above (BPSim `WaitTime` on the event replaces it); message, signal and conditional catch events become a `timer` of the BPSim `WaitTime` (or the default) with a warning; a link catch joins its link throw by name |
| `intermediateThrowEvent` (none, message, signal, escalation, link) | folded into the flow with a warning (link: a direct flow to the matching catch); compensation and the like are unsupported |
| `boundaryEvent` timer with `timeDuration` (the ISO-8601 duration above, such as `PT90M`, `PT1H30M` or `P1D`) on a task | `deadline` and a flow `on: "deadline"`; `cancelActivity` true or absent is `interrupt`, false is `escalate`; BPSim `WaitTime` on the event replaces the duration, and a BPSim `WaitTime` distribution becomes the deadline `timing`. Error, escalation, message, signal, conditional, `timeDate` and `timeCycle` boundary events, boundary events on sub-processes or call activities, and a second deadline on one task are unsupported |
| `startEvent` | the start; timer, message and signal definitions are ignored with a warning (arrivals come from BPSim or one default case) |
| `endEvent` | `end`; terminate is a plain end with a warning, error is an end with `outcome: "lost"`, message, signal and escalation are plain ends with a warning; compensation and cancel are unsupported |
| `documentation` | `description` (cut to 2000 characters with a warning) |
| `dataObject`, `dataObjectReference`, `dataStoreReference`, `textAnnotation`, `association`, `group` | ignored; one summary warning per element type |
| `collaboration` with `messageFlow` | the chosen process is imported, message flows are ignored with a warning listing the counterparties, and counterparty participants with flows into (out of) the process become SIPOC suppliers (customers) named after them, with the flow name as `supplies` / `receives` |

Unsupported (rejected, or dropped): `transaction`, `adHocSubProcess`, event sub-processes,
sub-processes without exactly one start and an end, nesting deeper than 3 levels, recursion,
multi-instance or loops on sub-processes and call activities, compensation activities and
events, cancel events, non-timer boundary events, calendars (`timeDate`,
`timeCycle`), a parallel or inclusive gateway that neither splits nor joins, an unconditional
non-default flow of an inclusive gateway (BPMN always takes it; the engine has no always-true
branch), several unconditioned flows of an exclusive gateway without BPSim probabilities (drop
mode shares them equally), and conditions outside the grammar. Missing element ids, dangling
flows, a missing or duplicate start event are always rejections.

**Condition grammar.** A flow condition (`conditionExpression`, wrapped in `${...}` or plain) is
a comparison of a case field with a number, `true`, `false`, `null`, a quoted text or another field
(`== != > >= < <=`, or `eq ne gt ge gte lt le lte`; a bare field means `== true`; the literal may
come first), joined by `&&` / `and`, `||` / `or`, `!` / `not` and parentheses. `and` binds tighter than
`or`; the result is a single comparison or the `all` / `any` / `not` form, within 8 comparisons and
3 combinator levels. Field names follow the case-field rule (lower-case start). Anything else (calls,
member access, arithmetic) is unsupported and the message quotes the text; in drop mode that flow
becomes a 50% chance with a warning. The `default` attribute names the flow without `when`.

**BPSim.** The first `Scenario` of any `BPSimData` (inside `definitions`, a `relationship` or an
`extensionElements`), or the one named by `scenario`, supplies simulation parameters. Values are
read in minutes: the unit is the `timeUnit` of the parameter, else `baseTimeUnit` of the scenario,
else minutes (`ms`, `s`, `min`, `hrs`, `days`, `wks`); times under one minute round up to 1 with a
warning.

| BPSim parameter | Wildlands |
|---|---|
| `ProcessingTime` (task) | `duration` for a constant (`FloatingParameter`, `NumericParameter`, `ConstantParam`, `DurationParameter`); for a distribution `timing` and `duration` = its mean |
| `WaitTime` (timer or catch event) | the timer duration, or its `timing` |
| `UniformDistribution(min,max)`, `TriangularDistribution(min,mode,max)`, `NegativeExponentialDistribution(mean)`, `NormalDistribution(mean,standardDeviation)`, `ErlangDistribution(k,mean)` | `uniform`, `triangular`, `exponential`, `normal`, `erlang` |
| Poisson, Gamma, LogNormal, Weibull, Beta, Binomial, TruncatedNormal, user-defined, expression | not supported: a warning, and the default duration applies (never a rejection) |
| `Probability` on flows of an exclusive or event-based gateway | chained chance routes: with shares p1..pN (normalised to 1 with a warning when they do not sum to 1; one missing share is the remainder) flow i gets `chance` round(pi / (1 - earlier shares) * 100) clamped to 1-99 and the last flow is the default; a rounding warning names the percents when they are not exact |
| `Probability` on flows of an inclusive gateway | an independent `chance` leaf per flow |
| `InterTriggerTimer` on the start event | arrival `gap` (and `interval` = its mean); a constant gives a fixed `interval`. `TriggerCount` gives `count` (at most 200), else the scenario `Duration` gives `until`, else the stream is `open` (with a warning to give each run a horizon). `Property` values of the start event: constants become arrival `data`, a `UniformDistribution` an `int` draw |
| `Quantity` on a lane, participant or resource | pool capacity |
| `UnitCost` on a lane, participant or resource | pool `costPerMinute` (per the unit, rounded to a whole number) |
| `FixedCost` on a task | step `cost` (rounded) |
| `Duration` of the scenario | a horizon hint (`info.horizon`) and the `until` above |
| `seed` of `ScenarioParameters` | the definition `seed` when the Wildlands extension names none; a seed that is not a whole number from 0 to 2147483647 is ignored with a warning, and an extension seed that differs wins with a warning |
| `replication`, `Selection`, `Priority`, `Interruptible` and any other parameter | ignored, one warning per parameter name |

Where the Wildlands extension and BPSim both describe a value and disagree, the extension wins
and a warning says so; without the extension BPSim fills the value; without either, the default
applies. Parameters for an id the file does not contain are reported.

**Report.** `analyze(xml, options)` never throws for content problems and returns
`{ok, acceptable, definition, diagnostics, warnings, mapping, rejections, info}`: `mapping` holds
one `{id, type, target, how}` per foreign element, flow, lane, resource, BPSim parameter used and
message flow (`target` is `step:<id>`, `flow:<id>`, `pool:<id>`, `field:<name>`, `arrival:1`,
`sipoc:<name>` or `none`); `rejections` holds `{id, type, message}` (and `definition` is absent when
there are any); `info` holds `process`, `processes`, `scenario`, `scenarios`, `horizon` and the resolved
`options`. `import(xml, options)` returns the same report but throws an Error listing the rejections.
`inspect(xml)` lists processes (with lanes and construct counts), BPSim scenarios and participants
so a dialog can offer the choices before importing, and `options(options)` validates an options
object. Warnings never replace the engine's own checks: the definition is validated like any other,
and a draft with diagnostics can be kept (`--draft`). XML with DOCTYPE or entity declarations,
more than 8 MiB or 64 levels of nesting is refused. DOCTYPE, ENTITY and the other markup
declarations are refused as markup tokens ("DOCTYPE and entity declarations are not allowed."),
so a comment or CDATA section that merely contains the text `<!DOCTYPE` is still read.

**Size bound.** Events, pass-through gateways and inlined container boundaries fold away, so a
file may hold more elements than the definition it becomes, but not without limit: before any
analysis that grows with the file, a process (and, after inlining call activities, its copies)
with more than 4 times the definition limits, 512 flow nodes or 1,024 sequence flows, is
rejected in one linear pass with a plain message, for example "This process is too large to
import: it has 602 flow nodes and 601 sequence flows, but a Wildlands process holds at most 128
steps and 256 flows. Import reads at most 512 flow nodes and 1,024 sequence flows, which leaves
room for events and gateways that fold away; split the model into smaller processes." (a
rejection with `type: "import"`). Within the bound the gateway and flow passes look edges up
in an index built once per process instead of scanning every flow for each element.

### Exporting BPSim

`export-bpmn --bpsim` (API `export(definition, {bpsim: true})`) adds a `BPSimData` relationship
with one scenario in minutes (`baseTimeUnit="min"`): `ProcessingTime` for work steps and
`WaitTime` for duration timers (constant or one of the five distributions), `FixedCost` for step
costs, `Probability` per flow (the marginal share for chained chance routes of a decision whose
non-default flows are all plain chances; the percent for plain chance flows of an inclusive fork),
`InterTriggerTimer` (the `gap` or the interval) and `TriggerCount` for the first arrival,
the first arrival's case data as start-event `Property` parameters (constants as
`NumericParameter`, `FloatingParameter`, `BooleanParameter` or `StringParameter`, and each `int`
draw as a `UniformDistribution(min, max)`), the definition `seed` as the `seed` attribute of
`ScenarioParameters`, the scenario `Duration` (the span from minute 0, i.e. `until`) for an
`until` arrival, and `Quantity` / `UnitCost` per pool. Deadlines travel only on the boundary event
and in the extension, not as a BPSim parameter. The extension stays authoritative: a definition
exported with and without `--bpsim` imports back to the same fingerprint with no warning, and other
BPSim-aware tools see the same numbers.

**Fidelity notes.** `LWProcessBpmn.fidelity(definition, {bpsim})` (and the `fidelity` field that
`process export-bpmn` prints) lists, in plain sentences, what only the Wildlands extension carries,
so a tool that drops the extension loses it; the list is empty when nothing is lost. Without BPSim
the first note says that arrivals, durations, probabilities, pool sizes and costs are extension
only. With BPSim the notes name arrival rules after the first ("BPSim carries arrival rule 1 of 2;
rule 2 is only in the Wildlands extension."), a first arrival that starts after minute 0, case
fields other than constants and whole-number draws, steps whose case fields and counters, needs
and declared outputs, absolute-minute timers, random deadline timing or backlogs are extension
only, and pool kinds other than `people`. Lists of names keep the first four and count the rest.
The studio's export status line does not show these notes.

Exports are checked for well-formedness with the in-repository XML reader and, in the registered
`business-process-bpmn` suite, with the built-in conformance validator below: the exports of
every agency process with and without BPSim, both examples and their import/export round trips
must conform with no uncovered element. Separately, a one-off run on 2026-10-08 validated exports
against the OMG BPMN 2.0 and BPSim 1.0 schema files themselves
([record](../_archive/verification/bpmn-schema-conformance-2026-10-08.md)); that record is
historical and no check reads those files.

### Conformance validator

`process validate-bpmn --input FILE`, the API `LWProcessBpmnConformance.validate(xml)` (Node:
`conformance.validate` from `process-sdk`) and the **Standards check** line of the **Import BPMN**
dialog check a BPMN 2.0 file, including the BPSim 1.0 data inside it, against built-in rules. The
report is a detached value:

| Field | Meaning |
|---|---|
| `conforms` | `true` exactly when `errors` is empty. It says nothing about `notCovered` elements or `unchecked` content, which were not checked. |
| `errors` | `{line, path, code, message}` per problem, in line order (at most 1,000). `path` is XPath-like with the names as written (`/bpmn:definitions/bpmn:process/bpmn:task[2]/@name`); a reference problem points at the referring attribute or value. |
| `notCovered` | `{line, path, element, namespace, reason}` per element of a BPMN, BPMN DI, DD or BPSim namespace that the rules recognise but do not check; its content is skipped. |
| `unchecked` | `{namespace, elements, note}` per foreign namespace found as extension content: the Wildlands extension (`urn:wildlands:process:1`, read and validated by the importer, not schema-checked) and any other namespace (not checked). |
| `checked` | Number of elements checked against the rules. |
| `rules` | `{bpmn: "2.0", bpsim: "1.0"}`. |

**How it is built.** No schema file is shipped, vendored, downloaded or read at build, test or run
time. The rules are Wildlands data in a compact notation of our own:
`process-bpmn-conformance-model.ts` (the BPMN MODEL namespace and the diagram namespaces BPMN DI,
DD DI and DC) and `process-bpmn-conformance-bpsim.ts` (BPSim 1.0) list the top-level elements with
their substitution groups, and per type its base type, ordered content (occurrences, choices,
wildcards), attributes (type, required, default) and flags (abstract, mixed text, attributes of other
namespaces). `process-bpmn-conformance.ts` compiles them once and walks the file read by the
in-repository XML reader (with its opt-in line positions); `process-bpmn-conformance-values.ts`
holds the value rules.

**What is checked.** Every element must be known in its namespace and allowed at its position:
ordered content, minimum and maximum occurrences, choices and substitution groups (a `task` stands
where a flow element may), matched left to right without backtracking as an XML Schema validator
does; abstract elements and types need a concrete element or an `xsi:type` naming a derived type
(for example `bpmn:tFormalExpression` on an expression). Attributes must be allowed, present when
required and valid for their type (string, boolean, whole numbers with the `int` and `long` ranges,
double, id, id reference, qualified name, URI, date-time, ISO 8601 duration and the enumerations
such as `gatewayDirection`, `processType`, multi-instance `behavior` or BPSim `timeUnit`), with
XML Schema whitespace handling (strings and string enumerations are compared as written; other
values are collapsed first). Attributes without a namespace that a type does not declare are
errors; attributes of other namespaces are allowed where BPMN allows them. Ids are unique across
the whole file (BPMN, diagram and BPSim ids share one space) and every id reference
(`sourceRef`/`targetRef` of a sequence flow, `default`, `flowNodeRef`, BPSim `inherits`, ...)
names an id. Qualified-name references (`attachedToRef`, `processRef`, `incoming`/`outgoing`,
`messageRef`, `bpmnElement`, BPSim `elementRef`, ...) must name an id of the file when they have
no prefix or the prefix of the file's `targetNamespace`; a prefix of another namespace (an
imported file) is not followed. Qualified names that name types or outside things
(`structureRef`, `itemSubjectRef`, `calledElement`, `implementationRef`, ...) are only checked for
form and a declared prefix. Text may appear only in mixed content (documentation, expressions,
scripts, text annotations) or as a value; empty elements such as `dc:Bounds` must be empty.

**Coverage.** Definitions, import and extension; process, lanes (`laneSet`, `lane`,
`childLaneSet`, `flowNodeRef`); every event (start, end, intermediate catch and throw, boundary,
implicit throw) and event definition (timer with `timeDate`/`timeDuration`/`timeCycle`,
conditional, message, signal, error, escalation, link, terminate, cancel, compensate); task and
every task type (user, manual, service, send, receive, script with `script`, business rule);
sub-process, ad-hoc sub-process, transaction and call activity; exclusive, inclusive, parallel,
event-based and complex gateways; sequence flows with condition expressions; standard and
multi-instance loop characteristics; data objects, stores, properties, inputs, outputs,
associations and assignments; resources, performers and assignment expressions; messages,
signals, errors, escalations, item definitions, interfaces, operations, end points, categories,
global tasks; collaboration, participant and message flow; text annotation, association and
group; relationship; and the diagram: `BPMNDiagram`, `BPMNPlane`, `BPMNShape`, `BPMNEdge`,
`BPMNLabel`, `BPMNLabelStyle`, `dc:Bounds`, `dc:Font`, `di:waypoint`. BPSim 1.0: `BPSimData`,
`Scenario` and its attributes, `ScenarioParameters`, `ElementParameters`, every parameter group and
parameter, the constant, enumeration, expression and distribution values with their exact
attribute names, `ResultRequest`, calendars and vendor extensions. Choreography, conversation,
correlation and partner elements are recognised in their places and reported in `notCovered`.

**Extension content.** `extensionElements` accepts other namespaces laxly, as BPMN does: a
top-level BPSim element (`BPSimData`, a parameter value) is checked with the BPSim rules, the
Wildlands extension and other namespaces are counted in `unchecked`, and a BPMN MODEL or unqualified
element there is an error. An element of a covered namespace that is not top-level there (for
example a `bpsim:Scenario` outside `BPSimData`) is listed in `notCovered` instead of being skipped
silently. Element wildcards that require declarations (DI `extension`, BPSim `VendorExtension`)
reject undeclared content.

**Error codes.** `xml-malformed`, `root-unknown`, `element-unknown` (no such element in a BPMN,
diagram or BPSim namespace), `element-unexpected` (wrong position or order, or not allowed in that
parent), `element-missing`, `element-abstract`, `element-undeclared` (strict wildcard),
`text-not-allowed`, `attribute-unknown`, `attribute-missing`, `attribute-undeclared`,
`value-invalid`, `value-enumeration`, `qname-prefix`, `xsi-type-invalid`, `id-duplicate`,
`idref-unresolved` and `reference-unresolved`.

**Limits.** These are structural, type and reference rules only. The semantic rules the BPMN
specification states in prose (which events may carry which definitions, gateway and flow
constraints, a flow staying inside one process, BPSim value meaning such as probabilities summing
to 1) are not checked, nor are references into imported files. A file must also pass the XML
reader's limits (8 MiB, 64 levels, no DOCTYPE or entity declaration). Compared with libxml2's `xmllint` on the same
rules, known differences are where `xmllint` is more lenient than XML Schema: it does not report
id references that name no id, it accepts an element of a repeated particle again after elements
of an immediately following repeated substitution group (for example a `laneSet` after flow
elements), and it accepts a number exponent without digits (`1e`); the validator reports all
three, and it also resolves qualified-name references, which XML Schema does not. The
**Standards check** in the import dialog informs only: the importer stays lenient with foreign files.

## Explicit v1 boundaries

This is an executable process simulation format. BPMN 2.0 import maps the constructs
listed above onto the engine (sub-processes and call activities are inlined, not executed
as separate processes; an event-based gateway becomes a race by chance; a complex gateway
is rejected, or approximated as an exclusive decision in drop mode) and rejects or drops
the rest; it is not a BPMN execution engine. No external service execution, credentials,
calendars or working hours, lognormal
distributions, correlated or stateful random streams, failure injection on
resources, nested parallel regions (nested gateways inside a region), event-driven
gateway semantics, recurring or calendar-aware timers (timers count plain business
minutes), counters other than integer addition, persona libraries, attribution models,
text sentiment, compensation, live process migration, saved-run restoration, validation against
the OMG schema files themselves (the built-in conformance rules restate their structure; one
recorded run used the files), BPMN prose-semantics conformance, or native Godot process export is
claimed.
Graph layout and scene presentation do not influence scheduling. Simulation
results describe authored assumptions and are not measured project forecasts.

## Run metrics and costs

The snapshot reports two costs, both in simulated units, not money. `metrics.cost` is the
**work cost**: each task start charges its fixed `cost` once and occupied pool slots charge their
`costPerMinute` for each minute they actually work (execution rule 3). `metrics.capacityCost` is
the **capacity cost**: every pool unit charged for every minute so far, busy or idle
(the sum of `capacity × costPerMinute × minute`), so adding capacity is never free in a what-if.
Capacity cost is a read-model value computed when the snapshot is built; it never feeds the
engine, a fingerprint or a decision.

`metrics.meanCycleMinutes` covers finished cases only and is 0 until one finishes; the studio
shows **Mean cycle** as "—" and the slides say "none yet" until then. `metrics.meanAgeMinutes`
(read model) is the mean number of minutes since arrival of the cases still in progress, rounded
to three decimals, or `null` when none is; it shows as **Mean age in progress**. These are means
of one seeded run, not distributions or confidence intervals.

Each step metric adds `held` (read model): tokens at the step with status `held`, work that
finished there and waits for room in the next step's backlog. It is a subset of `queued`; views
show it apart from waiting work (**Blocked after finishing** in the inspector, "blocked" in the
SIPOC stages and on slides), and blocked time is not counted in `waitMinutes`. Each pool reports
`utilization`, the average share of its capacity that was busy since minute 0, and `busy`, the
units busy right now; the inspector's meter reads "Average since minute 0 · b/c busy now".

In the studio the KPI strip under the stage shows the finished count, the journey outcomes,
**In progress**, **Mean cycle**, **Mean age in progress**, **Work cost**, **Capacity cost**,
**Failed**, **Dropped** (when any) and up to two tracked averages; a sentence under the pool
meters tells the two costs apart. A step with random timing reads "Planned N min (the average
shown in estimates)" when its draws average within 5% of the planned `duration`, and otherwise
"Planned N min; draws average about M min" (for example a triangular 240/720/1800 averages about
920), computed with the engine's own rounding and clamping (`LWProcessRandomView.meanOf`).

## Observed inputs and outputs

Both projections share an **Inputs & outputs** panel with a case selector.
The overview retains each case's arrival `input` separately from mutable `data`.
Completed cases show their final process outputs; active and failed cases show
current data, explicitly distinguished from a completed result.

A task captures its input fields when resources are allocated and work starts,
not while queued. On completion it records a receipt with case/step identity,
start/finish minutes, captured `input`, observed case `output`, and `changes`
(the fields written by that task). A later task or rework visit cannot rewrite
an earlier receipt. Parallel tasks share case data: a receipt's output can also
contain fields already written by another branch; `changes` identifies exactly
what this task wrote. The Visit selector exposes retained completed visits.
Timers record receipts the same way: `started` is the arrival minute, `finished` the
fire minute, `input` the case data on arrival, and `changes` the `set` and `add`
results (an `add` field shows its observed new value); a timer without effects
records empty `changes`. A multi-instance step records one receipt per visit with `instances: N`
(first item start to last item end). Receipt ids for timers end in `:<stepId>`, because one token
can pass several immediate timers in the same minute. Before completion the panel
labels authored `set` effects as **Expected changes**.
No inferred or planned effect is presented as an observed output.

Snapshots and exported reports retain the latest 128 task receipts and report
`receiptsDropped` explicitly. Original inputs and final case outputs remain for
all admitted cases even when earlier task receipts leave this bounded history.
These are additive read-model fields. Timer read model: a token with status `timer`
and `due`, per-step `timers: {waiting, nextDue}` (`nextDue` is `null` when none wait;
timer tokens are not counted in a step's `queued`), and events `timer-started`
(detail `due <minute>`) and `timer-fired`. A task completion still emits `finished-task`.

## Presentation limits

The 3D view displays up to 120 work markers, prioritizing active work, with a
visible overflow count. Up to three active tokens per scene (32 across the view)
use articulated desk actors; additional work and queues use compact markers.
Actor hands, heads and posture animate only during playback and remain still
when paused or reduced motion is requested. These actors are a representation
of active work, not staff allocation, additional capacity or travel time.
Room props, shadows, task progress and occupancy labels are presentation only.
The 3D camera supports pointer orbit/zoom, right-drag or Shift-drag pan, and keyboard arrows (orbit), Shift+arrows or WASD (pan), +/− and F to frame. The 2D map supports drag pan, wheel/pinch zoom, arrows, +/−, 0 and on-screen zoom buttons. With a step selected, Escape on the 2D map or the 3D scene returns to the whole process, and a **← Whole process** button in the stage header (`#back-overview`, at every width) does the same and moves focus to the stage heading, which then reads "Whole process"; selecting a step on a phone scrolls only the step strip, not the page. The 3D canvas has `role="img"` and an inset focus ring. Cameras are presentation-only and never tick the run.

On touch devices (`pointer: coarse`) the camera hint under the stage uses touch wording ("Drag to orbit · Tap a room to enter it · Frame view resets the camera", "Drag to pan · Pinch or + − to zoom · Tap a scene to select it") instead of mouse and keyboard hints.

**Readability.** Map text keeps a screen size, not a world size. The 2D map draws titles at their world size when zoomed in; zoomed out they stay at about 11 px in cards as wide as the neighbouring steps allow, on the fewest lines (up to three, spacing permitting, each of at least seven and at most 24 characters) that hold every name. Lines break between words; a word longer than a line is hyphen-broken with at least three characters on each side, and a name that still does not fit keeps its whole leading words and ends in an ellipsis, never cut mid-word. Hovering or focusing a card shows its full name and work counts in the caption row under the map (`#map-caption`, "Hover over or focus a card to read its full name and work counts." otherwise). When a card cannot hold even one line of seven characters (large maps, phones), cards show their two-digit list number instead of the name, matching the order of the step list, and the key "Card numbers match the step list" appears in the map's dock beside the zoom buttons (inside the map host, so it also shows in Present); **Frame view** then frames the zoom at which numbered cards no longer touch, starting at the start step, rather than the whole map. While names or details are hidden, a **Zoom in for names** (or **Zoom in for details**) button in the legend row zooms about the middle of the map to the first level that shows them. Fitting the map leaves room for the zoom dock, so the zoom buttons never cover a fitted card. These screen sizes are given for a 16 px root font and scale with the browser's default font size, as do the marker and cue minimums. Secondary lines and the text of pills and deadline tags appear only once they can be drawn at 9 px or larger. Below that, small cues (the deadline tag, the instance and deadline pills, the inclusive-fork marker, the outcome badge) hide their text but keep a glyph of at least 12 px, and their wording stays in the SVG title (tooltip) and the card's accessible name. For a count taken from a case field the 2D instance pill reads "× per case (field)" until items are live, then "× n"; the 3D caption keeps "× per case (field)" and its live line adds "× n now". A fixed count reads "× n". In 3D the room caption hangs below the room's front edge, clear of the queue rail and bench; captions grow until their lines reach 12 px, up to the width of a room (a selected room may widen its caption to most of the stage), and an overview caption that would still be smaller is not drawn, like the 2D map's secondary text; the inspector and step list keep the same counts. A portrait stage frames a selected room by its width.

**2D state encoding.** The legend under the stage and the map share one encoding
(`LWProcessMapMarks`, styled by `data-status` rules in `process.css`), so the key and the picture
cannot drift apart. Each work state has its own marker shape as well as its colour: **Working** a
filled disc, **Waiting** a ring, **Timer** an hourglass, **Backlog** a square and **Blocked** a cross;
markers are at least 8 px on screen and never sit on a card title. A card's border shows the step's
work state only (Blocked first, then Working, Waiting, Timer, Backlog), or an idle border with at
least 3:1 contrast against the stage; the room theme colours only the glyph and the progress bar.
Zoomed out with names shown, a row under each title shows one marker and count per work state, so
queues and blocked work read at the default framing (numbered cards do not show it); zoomed in
and in a step scene every work item has its own marker. In a card's accessible name the waiting count adds
blocked and backlog counts when there are any ("3 waiting (2 blocked, 1 in backlog)"). Conditional paths are drawn
long-dashed and deadline paths dotted (red when they interrupt, amber when they escalate), and the
legend shows both after the five states. The legend hides in the SIPOC and journey lenses, which
draw no work markers. In the step list each step's dot shows its live state in the same colours
and is absent for an idle step. In forced-colours (high contrast) mode the legend samples, map
markers, utilisation bar fills and step-list dots keep their colours, the utilisation bars gain a
border, and pressed view buttons, the selected step and the primary button gain a `Highlight`
outline or border.

Rooms use a presentation theme chosen from the step kind: start (Reception), end (Dispatch dock), decision (Decision room), fork and join (Junction; a join with a backlog is the Backlog room), machine (Automation cell), system (Software system), timer (Waiting room), touchpoint (one room per channel, such as Website or Documents, else a generic Touchpoint kiosk), and a task one of Office, Design studio, Test lab, Workshop, Review desk and Records room by a stable hash of the step id. A step with working tokens shows its animated task props and lit lamps; a step with none shows an idle variant (covered equipment, dimmed lamp, standby sign). Process Forge starter geometry (desk/monitor or podium/marker) yields to the themed room; custom attached geometry is drawn as authored.

Run length is a session option, not part of the definition or fingerprint. It defaults to the engine limit (100,000 minutes); `Runtime.create(definition, {horizon})` and `Session.setHorizon` accept a whole number of minutes or `null` for no clock limit. An unlimited run still stops when all work completes or cannot advance, and each clock command remains bounded to 100,000 minutes. A run with an `open` arrival stream never completes or blocks by itself: with no horizon it goes on until paused, and it reports `limit` only when a set horizon is reached. Case count and retained history limits are unchanged for `count` arrivals; streams use the active and retained caps described in Randomness, seeds and steady arrivals.

The **Definition editor** edits the process as a whole in its own native modal `<dialog>` (`LWProcessDefinitionEditor`, size wide, 1000 px), opened with **Edit process…** in the header actions (`#open-definition`, before Import) or with the **unapplied draft chip** beside it (`#draft-chip`, for example "Unapplied draft · 3 steps, 1 resource changed", hidden while the draft matches the running definition). There is no bottom Definition tab any more. Opening it pauses a running simulation (a command, never a tick) and its subtitle says so ("<process name> · revision N · The run is paused while this window is open"); like every dialog of the studio it is one at a time, traps focus, closes with Escape or Close and returns focus to the opener. Both panes write the shared draft (`LWProcessDraft`) on every input, so closing can never lose text and there is deliberately no discard guard. Edits update the draft only; **Apply draft and reset run** validates through the catalog and starts a fresh paused run that keeps the chosen run length (when the run is past minute 0 the shared `LWProcessDialog.confirmApplyOverRun` in-footer confirm first says "Applying starts a fresh paused run and discards minute N (X cases). Export the run report first if you need it." with **Back** (default) and **Apply and reset**). **Apply draft and reset run** is disabled while the draft holds the running definition, ignoring formatting and key order ("Nothing to apply: the draft holds the running definition. Use Reset run to restart the run."), so applying never bumps the revision for nothing. Applying a new revision of the same process keeps a run seed typed into **Seed** (while the definition's own `seed` is unchanged) and keeps the selected step while it still exists; the status names what carried over ("Run seed 9 kept.", or "Run seed 9 dropped; this run uses the definition seed 7.", and "<step> no longer exists, so the whole process is shown."). **Restore active definition** is disabled while the draft matches and otherwise asks "Replace the draft with the running definition?" with **Download draft first**, **Restore** and **Keep draft** (the default); **Validate** reports "Valid definition. Applying starts a fresh paused run." or the problem count; **Export draft** saves the text exactly as written.

**Undo and redo.** The draft store keeps an in-memory history of the active process's draft (at most 100 steps; typing from one pane within a second is one step, and every removal is its own step). Inside the Definition editor, outside the JSON textarea, Ctrl+Z (Cmd+Z on a Mac) undoes, and Ctrl+Shift+Z, Cmd+Shift+Z or Ctrl+Y redoes ("Undone. …", "Redone. …", "Nothing to undo."); the textarea keeps the browser's own text undo. Removing a row in Tune values (a resource, an arrival rule, a case field and the like) shows "Removed <name>. **Undo**" ("Removed Product owner", "Removed arrival 2"). The history is never written to storage and starts again whenever the studio applies, imports or switches process; the step editor has no undo of its own beyond **Cancel**.

Removing a resource that steps still demand first asks in the footer, naming them ("Discovery and Delivery still use Developers. Removing the pool also clears those demands."), with **Cancel** (default) and **Remove and clear demands**; each resource row says which steps use it ("Used by …" or "Not used by any step yet.").

On a desktop the modal has two columns, below 1000 px two tabs and at phone width a full sheet. **Tune values** (`LWProcessTuning`, with `LWProcessTuningFields` and `LWProcessTuningArrivals`) edits the process name, description and `seed` (a whole number from 0 to 2,147,483,647; empty leaves the seed out and the engine uses 1; "Same seed, same run. Change it to see another scenario."), the shared resources (name, kind People, Machine or System, capacity, cost per minute; `kind` is written only when it is not `people`, and resources can be added and removed) and each arrival: the end rule (**Fixed number of cases**, **Until a minute** or **Keeps arriving (open stream)**), first arrival minute, planning interval, an optional **Random gap** (None, Uniform, Triangular, Exponential), the typed case data fields and the random case fields (chance, weighted choice, whole-number range). The form never decides what is valid: the catalog's diagnostics are shown beside the field their path names, with `aria-invalid` on the control and a summary of the problems at the top; problems in steps or flows are counted and point to Raw JSON. The form also holds a **Process type** select (Business process, Customer journey or User journey, one sentence of help each; it writes `genre`, and leaves it out for a business process) and a **Tracked measures** section (`LWProcessTuningTrack`): up to six rows of a case field and an optional name, with Add and Remove, a field-name suggestion list built from the fields that steps and arrivals already write, and the explanation that the simulation averages these values when cases finish and at every step to draw the measured curve; Add is disabled with a visible reason at six. Raw JSON labels these paths as "Process › process type" and "Tracked measure 2 › field". The step-level form belongs to the step editor. **Raw JSON** shows the draft in a monospace textarea (no wrapping) with a synced line-number gutter, a status line ("Draft matches the running definition", "Unapplied draft: 3 steps, 1 resource changed" or "Invalid JSON: line 4, column 15 · …" using the pure `LWProcessJsonPath` scanner for the position), a details list of the changed steps, **Format JSON** (disabled while invalid), **Copy** (falls back to selecting all text when the clipboard is blocked) and the diagnostic list. `LWProcessCatalog.validate(draft, true)` returns every shape problem (up to 100) and stops there; the relationship checks (flows, needs, arrivals, draws) run only once the structure is valid, which the list says. Each entry reads "Step name › field" (paths are translated with the draft's step names) and is a button that selects the offending property in the textarea (the first line of a block, or the nearest block when the field is missing). Typing in Raw JSON updates the form after a short pause ("Updating form…" then "Form in sync"); while the JSON is invalid the form is disabled with "Fix the JSON to use the form".

A single step is edited in the **step editor**, a native modal `<dialog>` opened with **Edit step…** beside **Frame view** (the stage header). It is the same draft, not a second state: the dialog reads the shared unapplied draft (`LWProcessDraft`, below) into a detached form model (`LWProcessStepModel`, pure functions with no DOM, session or storage), renders it with `LWProcessStepSections` and writes edits back into a copy of the draft (`LWProcessStepEditor` is the UI surface). Sections follow the step kind: basics; timing and cost (task, machine and system duration and fixed cost, or a timer's duration or until-minute); **Automation** (machine and system steps: the display-only `technology` label with a character counter); people (tasks), **Equipment** (machine steps) or **Systems** (system steps), listing only pools of the matching kind with an "N available · 0 = not needed" hint, an explanation when the process has no pool of that kind, and any wrongly-kinded pool the step still demands, shown with its problem so it can be set to 0; **Random timing** (task, machine, system and duration-timer steps only: None, Uniform, Triangular, Exponential, Normal (mean, a spread of at least 1 and optional bounds) or Erlang (1 to 32 phases and a mean) with their whole-minute parameters, a note that the planning duration stays the average shown in estimates, and inline problems for inconsistent parameters from a local check plus the engine message); completion `set` values and `add` counters (task, machine, system and timer); **Random outcomes (draws)** (task, machine, system and timer: up to eight rows, each a chance, weighted choice of 2 to 12 values or whole-number range, applied after `set` and before `add`, with duplicate-field and set-collision problems shown on the row); **Declared outputs** (task, machine, system: a field and optional label per row, each of which must be delivered by this step's own `set` or `add`); needs from earlier steps; backlog (work steps and joins); and **Where work goes next**, this step's outgoing paths (`LWProcessStepFlows`, `process-step-flows.ts`). Each path is a card "Path n of N · to <step>" with **Go to** (any step except the start and this step), **Label shown on this path** and, for decisions and inclusive forks, its condition (a value, another field, or a random share of cases from 1 to 99 percent); a decision's paths add **Move up** and **Move down** under a one-line summary of the checked order ("1. If iteration < iterations → Iteration planning", "2. Otherwise → …"). **Remove path** is disabled with its reason while removing it would leave fewer paths than the kind needs ("A task needs exactly one outgoing path.", "A decision needs at least two outgoing paths."); removing the deadline path also clears the deadline's choice. **Add path to…** picks a target step and **Add path** adds a path without a label or condition (id `<step>-<target>`, numbered when taken). The editor never decides whether the result is valid: an extra path on a task, for example, is reported by the catalog until it becomes the deadline path or is removed. An end step says it has no outgoing paths. Case-field inputs (needs, conditions, effects, outputs) suggest names from the draft through datalists: fields delivered earlier for needs, fields usable by this step's conditions, and every known name. A chance path appears in that summary as "2. 8% of cases → Repack" and is edited like any other condition. Inputs & outputs shows "Took N min (planned M)" for a receipt with a realized `duration` and labels drawn fields `drawn`; `LWProcessRandomView` holds the pure plain-language sentences shared by these views. **Touchpoints** (`kind: touchpoint`) are edited like tasks with three differences: the **Journey** section (phase text with suggestions from the phases already used in the draft, **Channel** with plain labels such as Website, Phone call and Documents and forms, a **Feeling** from Very frustrated (-3) through Neutral to Delighted (+3), a **Pain point** and an **Opportunity**), **Backstage teams and systems (optional)** listing pools of every kind with a People, Machine or System badge and no required demand (customers do not consume capacity), and no Technology label. Every other kind has a collapsed **Journey notes (optional)** section with the same phase, feeling, pain point and opportunity, and **end** steps add an **Outcome** select (None, Goal reached, Customer or user lost). The words for feelings, channels and outcomes come from `LWProcessRandomView.describeEmotion`, `describeChannel` and `describeOutcome`. Empty notes are removed from the definition, not written as empty strings. The BPMN-class fields use the same pure model and sections (`LWProcessStepLogic` holds their read, write and local checks, `LWProcessStepLogicSections` their markup): a **fork** adds **Branching** (Parallel, all branches, or Inclusive, every branch whose condition is true with the branch without a condition as the default), and the paths of an inclusive fork use the same condition editor as a decision's; the condition editor also offers **All of these**, **Any of these** and **Not** groups of rows (at most three levels and eight tests, with Add test and Remove and the path summary reading "If iteration < iterations AND 8% of cases → Repack"); work steps add **Multiple instances** (Once, a fixed number from 2 to 50 or a case field, run in parallel or one after another; disabled with a visible reason while the step keeps a backlog) and **Deadline** (none, fixed minutes or a random time, Interrupt or Escalate, and **Which outgoing flow is the deadline path?**, a choice among the step's outgoing paths, which the editor marks `on: "deadline"`; when the step has only one path it says that a deadline needs a second path and links to **Add path to…** under **Where work goes next**, then the new path can be chosen here). Random timing and a deadline's random time share one distribution editor that also offers Normal and Erlang, and the arrival gap in the Definition editor offers the same two with the engine's range messages.

Every edit is checked live with `LWProcessCatalog.validate(candidate, true)`. Engine diagnostics for this step are rewritten in plain language that names the field and its range ("Task duration must be 1 or more"), appear beside the field with `aria-invalid` on the control, and show one problem per field (a local representation problem hides the engine message for the same field). The status area is empty when there are no problems; otherwise it lists "This step" problems as links that focus the field and an "Elsewhere in the draft" group with paths translated to names ("Discovery › duration"). Nothing blocks typing. Representation problems that no definition can express (a blank or repeated field name, a non-numeric number) disable the footer actions with a visible reason ("Fix the highlighted fields before saving or applying."). **Save to draft** writes the candidate to the draft and closes; it is disabled until something changed ("Save to draft is unavailable until you change something."). **Apply and reset run** is disabled with its reason while this step has problems ("Fix the problems in this step before applying.") or while the step and the draft hold the running definition ("Nothing to apply: this step and the draft hold the running definition. Use Reset run to restart the run."); problems elsewhere in the draft do not stop **Save to draft**, but an apply refused for them shows "The draft cannot be applied yet. Fix these problems and try again." with the same plain, linked list, and nothing is written. It applies exactly like **Apply draft and reset run**, including the kept run seed and selection; when the run is past minute 0 an in-footer confirm first states "Applying starts a fresh paused run and discards minute N (X cases). Export the run report first if you need it." with **Back** (default) and **Apply and reset**. A banner summarises other unapplied changes outside this step. If the draft is not valid JSON, **Edit step…** opens the Definition editor on the JSON pane with the syntax error selected instead of opening the step editor, and the step editor's **Open the Definition editor** button closes it and opens the Definition editor on the first problem; with unsaved edits it first asks "Open the Definition editor? Your changes to <step> are not in the draft yet." with **Keep editing** (default), **Save to draft and open** (offered when the edits can be written) and **Discard changes**. **Previous step: <name>** and **Next step: <name>** in the dialog move through the steps in draft order (disabled at either end with "This is the first step." or "This is the last step.") behind the same question ("Go to <step>? …" with **Save to draft and go**). Opening the dialog pauses a running simulation (a command, never a tick).

The dialog shell is the reusable `LWProcessDialog` (`process-dialog.ts`; its header comment is the contract for the Definition and Activity editors). It owns the native `showModal` dialog, the Tab trap, `inert` on the studio root, body scroll lock, sticky header and footer, focus on open (first `[autofocus]` control, else Close; read-only dialogs focus the heading) and focus restore to the invoker or a fallback, and **one dirty guard**: Escape, **Close**, a cancel action and a backdrop click all call `requestClose`, which closes a clean dialog and otherwise shows the in-footer "Keep editing / Discard changes" confirm that starts on **Keep editing**. Only one dialog may be open at a time (no stacking). Sizes are `form` (760 px), `wide` (1000 px, with a `.pd-split` two-column grid) and `list` (640 px); at 650 px and below every dialog is a full-screen sheet with stacked full-width footer buttons, and motion is used only when reduced motion is not requested. In windows under 560 px tall (200% zoom on a laptop, a phone in landscape) every dialog except Activity becomes one full-screen sheet that scrolls as a single page: header, subtitle, footer reason and secondary actions scroll with the content and only the primary action stays in view at the bottom (the Activity list keeps its own scroller). Dialog openers carry `aria-haspopup="dialog"`. Dialog styles live in `process-dialogs.css` (the BPMN import dialog adds `process-bpmn-dialog.css`); the studio shell is `process.css` and the SIPOC and journey lenses `process-lenses.css`. All share the tokens at the top of `process.css`; type sizes are `rem`, so the browser's default font size is honoured. The studio has a single dark theme; there is no light theme.

**JSON import.** In the studio, **Import…** (or **Import JSON or BPMN…** in the phone menu) reads a JSON file of at most 8 MiB (`LWProcessIO`, `process-io.ts`) and checks it before anything changes. A rejected file changes nothing and is summarised in plain words in the status line, which shows at most two lines: "Import rejected: the file is not valid JSON (line 1, column 2). Choose a .process.json exported from the studio, or a BPMN file.", "Import rejected: this file is not a Wildlands process (N problems). …" or "Import rejected: this process has N problems; first, <path>: <message>. Fix the file, then import it again." A valid file that would discard a run past minute 0 or an unapplied draft first asks "Replace <process>?" in the same Cancel-first modal as a process switch, naming what is lost ("Importing <file> replaces <process> and discards minute 120 of the current run and the unapplied draft (1 step changed). Export the run report or the draft first if you need them."); **Cancel** keeps everything and returns focus to the control that opened the file picker, and **Import and replace** imports. A JSON import of a new revision of the same process keeps the run seed and selection like an apply.

**BPMN import dialog.** A `.bpmn` or `.xml` file (or text starting with `<`) instead opens **Import BPMN** (`LWProcessBpmnDialog`, `process-bpmn-dialog.ts`, dialog id `bi`, size wide), with read-only markup from `LWProcessBpmnPreview` (`process-bpmn-preview.ts`). `LWProcessBpmn.inspect` fills the **Process** and **BPSim scenario** pickers (the scenario picker is disabled when the file has none or BPSim is off) and lists the chosen process's lanes and element counts. The options are **Lanes** (resource pools or ignore), **Unsupported constructs** (reject or drop), **People per lane pool**, **System pool capacity**, **Business minutes per day**, **Default duration in minutes**, **Use BPSim simulation parameters** and **Run service-type tasks on automated system pools**; each field is validated by `LWProcessBpmn.options` and shows its own problem (business minutes per hour is a CLI/API option only and keeps 60). Shortly after each change, a preview from `LWProcessBpmn.analyze` (a UI debounce, never a simulation clock) shows the verdict, whether the result is runnable (`ok`) and acceptable as a draft, the process, scenario, step, flow, pool and arrival counts, the suggested run length from the BPSim scenario `Duration` (shown, not applied: import keeps the current **Run until** setting), rejections with their element ids, definition problems, warnings and the mapping grouped by target (steps, flows, resource pools, case fields, arrivals, SIPOC, folded or ignored). Each mapping group lists at most 200 rows and ends with "… N more entries not shown"; a process over the import size bound (see Importing foreign BPMN for simulation) shows only its plain rejection, without mapping groups. Above the panes, a **Standards check** note (`role="note"`, from `LWProcessBpmnConformance.validate`, computed once when the file opens) reads "Conforms to BPMN 2.0 and BPSim 1.0 · N elements checked", or the problem count with the first three problems and their lines, plus the number of elements not covered; it says that it never blocks import, and it does not gate **Import**. **Import** is disabled with a visible reason while an option is invalid, the preview lists rejections or the definition cannot run. It reuses the preview's analysis of the shown options (a pending preview is computed first; the file is not analysed a second time) and applies that definition through the studio's replace path: a fresh paused run at minute 0 that never ticks. When that would discard a run past minute 0 or an unapplied draft, an in-footer confirm names what is lost and starts on **Cancel** (Escape also cancels), with **Import and replace**. Opening the dialog does not pause the run; Cancel, Close and Escape change nothing and return focus to the control that opened the file picker. The Export menu adds **Export BPMN with BPSim** (`<id>.bpsim.bpmn`, the same as `export-bpmn --bpsim`).

`LWProcessDraft` (`process-draft.ts`) is the single source of truth for the unapplied draft text, one per process: `read`, `write(text, source, label?)` (`label` names a removal such as "Removed Product owner"), `parse`, `activeText`, `changed`, `same` (whether a text holds the running definition, ignoring formatting and key order), `diff` (counts of changed steps, flows, resources, arrival rules and process settings plus the names of changed steps), `describeDiff` ("Unapplied draft: 3 steps, 1 resource changed"), `undo`/`redo`/`canUndo`/`canRedo` (the in-memory history above), `subscribe`, and `enter`/`leave`/`restore` for apply, process switching and reset. The raw JSON textarea is a mirror of the store.

One WebGL renderer and canvas serve the page's lifetime (`LWProcess3D.stage`); rebuilding the 3D view for an apply, import or process switch replaces and frees only its scene, so no renderer, GL context or canvas accumulates (`LWProcess3D.live()` reports the renderers and GPU resources still held). 3D frames are drawn on demand: after a camera, selection or snapshot change and, while the run plays, only when a visible actor or room animates, at most about 30 times a second. Static paused scenes render only when the view or camera changes. The shadow map is `PCFShadowMap`.

Each 2D scene shows a bounded marker sample plus an overflow count. All cases
remain in the data inspector, simulation and reports. Resource occupancy appears
in the inspector. The latest 128 events are retained and listed in the Activity modal; metrics cover the full run.

**Studio layout and Activity.** Desktop windows (1100 px and wider, 600 px tall or more) use a
`100dvh` grid: a header and toolbar band of two rows, then three columns that scroll
internally; below that the page scrolls, and at 650 px and below the toolbar is a sticky run bar
that stops being sticky while **Run options** is expanded. Short windows between 651 and 1099 px
wide and under 600 px tall fold the secondary run controls under **Run options** like a phone. On
a phone a SIPOC or journey lens grows with the page instead of scrolling inside the 45vh stage.
`LWProcessMenu` (`process-menu.ts`) is the Export/overflow menu button; `LWProcessInspector`
(`process-inspector.ts`) builds the overview, step and resource-meter markup from a detached
view using `LWProcessRandomView` wording. The overview adds an **Instances, deadlines and forks**
summary when the process has any (multi-instance steps with items started and finished, deadline
steps with escalated and interrupted counts, inclusive forks); a step adds **Branching** (the
fork's description and its join), **Multiple instances** (items started and finished, visits in
progress, the item count of the latest completed visit) and **Deadline** (the deadline path, its
firing counters and the next pending deadline minute), and its next steps describe inclusive
branches and the deadline path; `LWProcessActivity` (`process-activity.ts`, dialog id
`act`, size list) owns the event tracker, the batched `#feed-announcer` (polite, atomic, at most
one batch per five seconds, failures, blocked work and dropped arrivals at once) and the
Activity modal. The engine's events have no sequence numbers, so the tracker counts appended
events by overlapping each new 128-event window with the previous one; the "latest N of M
events" subtitle and the new-events pill derive from that count. The **Activity** badge counts
only problems not yet shown in the modal (failed work, blocked work and dropped arrivals; routine
events never raise it), in the danger tone, as " · N" (99+ at most), and the button's accessible
name becomes "Activity, N new problems". The controller gains `seed(value | null)`: a fresh
paused run with that seed. Reset keeps it; `replace` keeps it for a new revision of the same
process (same id) while the definition's own `seed` is unchanged, and keeps the selected step
while it still exists; a process switch, or a replacement by another process, drops both. Neither
the modal nor the menu ticks, pauses or retains the simulation.

**Run bar and status line.** `LWProcessRunBar` (`process-run-bar.ts`) owns the toolbar and the
one status line under the stage title. **Speed** offers 1 min, 5 min (default), 30 min, 2 h and
24 h of simulated time per tick while the run plays. **Run until** offers 24 h (1,440 min), 168 h
(10,080 min), 720 h (43,200 min), 100,000 min (≈1,667 h), no limit and custom; a custom length
opens a **Minutes** field and is confirmed in the status line ("Run length set to 600 minutes (10
h)."). The clock reads "M min of H" (or "· no limit") with an hours line once 60 minutes have
passed, and **Advance 30 min** names the minutes it will really advance when fewer than 30 remain
before the run length. Once the run stops (completed, run limit or blocked), Run, Step and Advance
are disabled with the reason as their title, **Reset run** becomes the primary button (on a phone it
stays outside **Run options**) and takes focus from a control that was just disabled, and the
status says what to do next ("Run completed. Export the report or reset to run again."). A note
gives way to the run guidance on the next state change (play or pause, a new run status, another
process or revision, or a new minute while paused); an error stays until the next successful
command; an editor notice also gives way when the editor closes. The guidance never names the
minute, so the polite live region does not speak on every tick.

**Work protection.** `LWProcessGuard` (`process-guard.ts`) owns the one "are you sure?" modal
outside the editors (dialog id `ask`, built on `LWProcessDialog`): process switching and JSON
import past minute 0 or over an unapplied draft ask there first, starting on **Cancel** (Escape,
Close and a backdrop click also cancel), and focus returns to the invoker. While any process holds
an unapplied draft, leaving or reloading the page asks the browser's own "leave site?" question
(`beforeunload`); nothing is written to storage, so a draft that is left anyway is gone. A page
entering the back/forward cache (`pagehide` with `persisted`) only suspends the animation loop and
resumes on `pageshow`; a page that is really unloaded is disposed. **Export ▾** says when an
unapplied draft exists that JSON, BPMN and the run report use the running definition and the draft
is not included, and then offers **Export draft JSON** (`<id>.draft.json`, the draft exactly as
written); every export names what it saved in the status line ("Exported agency.process.json (the
running definition).").

**Phones and accessibility.** At 650 px wide or less a business process opens in **2D** (3D is
one press away; a journey keeps its Journey map), and the header's **Edit** button is named "Edit
process". At 400% zoom (320 x 256) no focus stop hides under the sticky run bar. The run groups are
separated by spacing rather than divider lines, so a wrapped toolbar never starts with a stray
rule, and the custom **Minutes** field is sized for six digits, keeping the desktop toolbar on one
row. Side columns are sized in `rem`, so they follow
a larger default text size. Glyphs such as ▾ and ← are hidden from accessible names; the run
metrics are a labelled group and the stage heading reads "Whole process" when no step is selected.

**Studio modules.** The studio shell `process-ui.ts` composes these presentation modules (all in
the `process-presentation` context of `source/wildlands/source/architecture/domain-map.json`);
none of them ticks, retains a session or touches storage:

| Module | Owns |
|---|---|
| `process-run-bar.ts` (`LWProcessRunBar`) | the run toolbar (Run, Step, Advance, Reset, Speed, Run until, Seed, clock) and the status line rules |
| `process-step-list.ts` (`LWProcessStepList`) | the step list markup with live counts and state dots, and keeping the selected step in sight |
| `process-io.ts` (`LWProcessIO`) | the Export menu items, Download HTML, the file picker, JSON import checks and the BPMN import dialog hand-off |
| `process-guard.ts` (`LWProcessGuard`) | the Cancel-first "are you sure?" modal, the leave-page guard and the back/forward-cache lifecycle |
| `process-map-marks.ts` (`LWProcessMapMarks`) | the 2D drawing vocabulary: SVG helper, glyphs, pills, state markers, the legend and label wrapping |
| `process-map-card.ts` (`LWProcessMapCard`) | one 2D step card: size, state border, title, markers or per-state counts, pills and badges |
| `process-renderer-2d.ts` (`LWProcess2D`) | the 2D map surface, its camera, zoom dock, card-number key, zoom button and caption |
| `process-step-flows.ts` (`LWProcessStepFlows`) | the step editor's **Where work goes next** section and its pure path operations |
| `process-time.ts` (`LWProcessTime`) | shared wording of business minutes with an hours gloss, used by the SIPOC model and the slides |

**Present mode.** **Present** (`#mode-present`, after the lens button; hidden at 650 px and
below) or, on a phone, **⋯** then **Present slides** (`#present-item`, after the import item)
opens `LWProcessPresent` (`process-present.ts`, `process-present.css`): a full-window native
`<dialog id="present">` (`showModal`, studio root `inert`) that shows the [slide deck](#slide-deck)
of the **active** definition, never the unapplied draft. The header names the process and
"Slide n of N" (`#present-count`), adds "Live facts come from one simulated run at business minute
M (seed S, <status>)." when the run is past minute 0 (the status in plain words: still running,
completed, blocked or stopped at the time limit), "The run is paused while you present." when
entering paused it and "Showing the applied definition; your unapplied draft is not included."
(`#present-draft`) when the studio holds an unapplied draft, and holds **Contents** (`#present-toc`, the slide list grouped by section; the
current slide is marked) and **Exit** (`#present-exit`); **Previous** and **Next**
(`#present-prev`, `#present-next`) sit in the footer. The studio's single 2D map host (`#map`)
moves into the map pane and back to its exact place on exit, so there is never a second
renderer: a step slide selects its step through the studio's selection command and frames it
together with its direct predecessors and successors, a section slide does the same for its first
step, the other slides frame the whole process, and choosing a step on the map moves the deck to
that step's slide. When the map shows card numbers, their key ("Card numbers match the step
list") sits in the map's own dock and so stays visible in Present. Present opens on the selected step's slide, else slide
1, and refuses to open while another studio dialog is open ("Close the open window first.").
Keys: Right, Page Down or `n` next, Left, Page Up or `p` previous, Home first, End last (arrow
keys inside the map pan it instead); while the slide itself has focus, Space and Down page forward
and Shift+Space and Up page back, but only once the slide cannot scroll further that way, so a long
slide still scrolls first. Escape closes Contents when it is open, otherwise exits. It never
ticks: entering pauses a playing run with a command and switches to 2D, and exit never resumes
the run ("Presentation closed. The run stays paused; choose Run simulation to continue."); exit
restores the previous view mode (including the 2D or 3D choice behind a lens) and selection and
returns focus to the invoker, else to **Present** or **⋯**. On a desktop the slide column and
the map sit side by side, each scrolling inside the window; below 900 px wide or 560 px tall the
dialog scrolls as one page (the slide, then the map at about a third of the window height) with
Previous and Next in a footer kept at the bottom, and at phone width the footer buttons share
the width. `LWProcessStudio.query()` adds `presenting: {index, count, id} | null` (0-based index
and the slide id). Slide text is the deck's plain text, escaped when rendered.

## Slide deck

`LWProcessSlides` (`process-slides.ts`, wording in `process-slides-text.ts`, types in
`process-slides-contracts.d.ts`) is a pure model: `build(definition, snapshot?)` turns one
definition, and optionally one snapshot, into a detached, deterministic deck
(`format: "wildlands-process-slides"`, `schemaVersion: 1`) with no DOM, session, clock, storage
or randomness; its inputs are copied first and the deck shares no object with them.
`markdown(deck)` renders it for agents. `process slides` (CLI) and Present mode (studio) use it.

- **Order.** Sections `intro` (slides `title`, `overview`, `resources`), one `phase-<n>` section
  per main-route phase in route order (or one `route` section when no step has a `phase`), a
  `variants` section for every step off the main route (when there is one) and `summary`. A
  phase or route section opens with a section slide (`section-<id>`) that lists its steps and the
  flows leaving the main route. No section is empty.
- **Every step once.** Each step appears on exactly one step slide (`step-<stepId>`): main-route
  steps in their phase, every other step in variants, breadth-first from the main route and
  labelled by how it is first reached (decision alternative, parallel or inclusive branch,
  deadline path, other end, other step).
- **Main route.** The route and phase grouping are `LWProcessRoute` (`process-route.ts`), the
  same rule as the SIPOC view: from `start`, follow the first outgoing non-deadline flow without
  `when`, else the first non-deadline flow, stop at a visited step, and walk a fork with all its
  branches up to its join; an unphased step joins the phase before it.
- **Content.** The overview is the SIPOC of a business process (from `LWProcessSipocModel`) or
  the phases and touchpoints of a journey, plus how cases arrive; resources list each pool's
  kind, capacity, cost and users. A step slide says what happens (the step description, else
  "No description authored."), who or what does it, how long it takes, what it needs and
  delivers and where the case goes next, with one short concept explainer per construct the step
  uses (touchpoint, machine or system step, timer, decision, chance route, counter loop,
  parallel fork, inclusive gateway, join, multi-instance, deadline, backlog). All text is plain
  text derived from the definition; the model never invents data. When the description calls
  its values synthetic or illustrative, the title slide repeats that they are assumptions.
- **Title and counts.** The title slide's lead is the description's first paragraph, cut after
  the last whole sentence that keeps it within about 60 words (a longer first sentence is cut at
  60 words with "…"); when that is not the whole description, a **Process description** block
  repeats it in full. "How to read this deck" says that times are simulated business minutes (min),
  not wall-clock time, and that long times also show hours. Section slides and the overview's
  **Process** stages count the steps between the start and the end ("2 steps on the main route
  and 1 step off it"), and the overview and summary say the main route counts "start and end
  included", so every slide counts steps the same way. The resources slide explains work cost
  against capacity cost.
- **Live facts.** Only when a snapshot is passed: step slides, the resources slide and the
  summary add a block whose heading names one simulated run, its business minute and seed ("One
  simulated run · business minute 165 · seed 7"), and the deck carries `live: {minute, seed,
  status}`. The title slide adds **Key results** right after its lead: run status, arrived and
  finished counts, mean cycle time, work cost and the most utilised pool. The resources slide lists
  each pool, most utilised first, with its average utilisation since minute 0, busy time, units
  busy now and the work waiting at its steps. The summary adds the run status in plain words, mean
  cycle time ("none yet" until a case finishes), mean age of the cases in progress, work cost,
  capacity cost and the most utilised pool. Step facts list work blocked after finishing apart from
  waiting work and drop "so far" once the run has completed. The Markdown ends with a reviewer's
  tip naming `bin/wildlands process slides --minutes N` and `process run`; the deck shown in
  Present has no command-line tip. The studio passes its detached snapshot only past minute 0;
  `process slides --minutes N [--seed S]` runs one fresh bounded run, the same as `process run`.
  These facts describe that one run, not a forecast.

## Verification suites

The process checks are registered Wildlands suites (see
[`source/wildlands/VERIFICATION.md`](../../source/wildlands/VERIFICATION.md) for the gate):

- `business-process` (Node): entry `source/test-process.cts`, which runs the check modules
  `test-process-engine`, `-authoring`, `-steps`, `-random`, `-journeys`, `-semantics`, `-slides`
  (the slide model) and `-slides-cli` (`process slides`, process-setting edits, `process diff`) (`.cts`)
  with shared helpers in `test-process-helpers.cts`.
- `business-process-bpmn` (Node): entry `source/test-process-bpmn.cts` (foreign BPMN mapping,
  BPSim, standard export and the pinned numbers of the example files), after the extension round
  trips in `test-process-bpmn-extensions.cts` and the conformance checks in
  `test-process-bpmn-conformance.cts` (every export and example conforms, violation fixtures,
  uncovered elements, `validate-bpmn` exit codes, a bounded-time large file), with helpers in
  `test-process-bpmn-helpers.cts`.
- Browser suites, sources `source/verification/process-*-browser.ts` with the shared
  `process-browser-fixture.ts` and `process-browser-models.ts`: `business-process-browser` (studio
  shell, navigation, time controls, imports, exports, process switch),
  `process-layout-browser` (responsive layout, including a check in the wider DejaVu Sans
  fallback font), `process-step-editor-browser`,
  `process-definition-browser`, `process-renderers-browser`,
  `process-lenses-browser`, `process-bpmn-import-browser` (the import dialog and
  BPSim export), `process-readability-browser` (large maps, small cues, captions,
  phone lenses and short-window dialogs, also in DejaVu Sans) and `process-present-browser`
  (Present mode: entry and exit, slide navigation, contents, map reuse, keyboard, focus, phone
  and short windows).

Not a suite: `npm run process:shots -- --game DIR --process N --minute M --out DIR [--cli FILE]`
(`source/verification/process-shots.ts`) is a review tool. It builds the game with the checkout's
compiled CLI (`.generated/tools/wildlands-cli.cjs` after `npm run build`, else `bin/wildlands`, or
`--cli`), runs process N to minute M through the studio's own **Run until**, speed and **Run**
controls, and writes desktop 2D, 3D and lens, desktop and phone (390x844) Present (first and a
step slide), the phone studio and DejaVu Sans Present captures plus `shots.json` with each
capture's horizontal overflow and the page's console errors.

Passing suites are automated evidence of the stated behaviour, and screenshots of a synthetic run
are review material; neither is human usability,
accessibility or visual-quality validation, and not validation of any imported model.
