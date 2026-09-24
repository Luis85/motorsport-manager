# Race weekend — staged recovery and virtual neutralization

**Implementation: 0.8.0.** Design basis: Race Weekend GDD v1.0, sections 12, 14–17, 20, 22, 24 and 25. This delivers the next playable **RW-14/RW-15** slice and related **RW-16** interaction work. It does not declare the whole GDD, Stage C balance, or human-playtest acceptance complete.

## Integration and protected foundation

The branch `feat/race-weekend-recovery` targets **main directly**. At the start of this increment, main was `5d2aff4beee7051e122eba7cfcd8ab9163a37745`. PR #2 had been merged into the old feature branch after PR #1 was merged into main. The first integration commit brings in that completed weather merge, `e5e849ece8430ead5c9cfb72cd8ddc105b53b6ac`, while retaining main's newer compact/hover-theme work. No main update or pull-request merge was performed by this increment.

The native Godot application, dot cars, compiled circuits, four-wheel finite inventories, physical pit routes, approved strategy ownership, battle/team state, weather information boundary, qualifying/formation/start approvals, classification and player time controls remain. Track authoring and campaign management are outside this increment.

## Play

Open `project.godot` in **Godot 4.7.2 Standard**, then press **F5**. New **Grand Prix Weekend** sessions use the staged recovery model. Choose **Recovery → Protect the finish** for a disclosed damaged-car scenario, or **Recovery → Is the repair worth it?** for a short-race comparison.

In the pit wall, open either driver's **Recovery** button or select **Recovery & race control**. Both drivers retain independent access to Weather, Recovery and their primary pit controls. Compare the current run with **Protect** and **Repair only**. **Retire…** opens a named, irreversible-action confirmation. The race continues unless the player pauses.

The four existing dry recipes and three weather recipes keep their original model semantics for reproducibility. Old saves also retain their original model. Starting a new normal weekend or a recovery scenario is the route to the new reliability/control procedure; loading an old race does not silently enable it.

## RW-14 — scalar condition and recovery decisions

### Stages and exposure

`RaceReliability` represents aggregate condition, not individual components. Its stages are **normal → warning → degraded → critical → retired**. Damage, remaining lifetime health and observed temperature determine the visible stage; not every incident must traverse every stage.

The tuning seeds are explicit: damage at 5/20/55 enters warning/degraded/critical; health at 80/60/25 enters the corresponding bands. A thermal warning starts at 114°C and retains hysteresis down to 110°C. These are fictional gameplay coefficients, not engineering limits or calibrated failure probabilities.

Thermal and condition exposure accumulates against **simulated time**, not render frames. Engine saving reduces the exposure rate. Heat still evolves gradually through the existing cooling model; pressing Protect does not instantly cool or repair a car. Accumulated exposure can produce small scalar faults before critical failure. Progressive critical retirement has a minimum 15-simulated-second critical interval; zero lifetime health is a separate exhausted-condition boundary. Barrier incidents and fuel exhaustion retain their own consequences.

Each car has its own persisted reliability random stream and thresholds. Weather, driving/tyre incidents and service variation are separate streams in new sessions. UI queries never consume any of them. Repair does not redraw a threshold, and opening a panel cannot reroll a future fault. Calm mode suppresses stochastic scalar faults and threshold-based terminal failure, not wear, fuel exhaustion or zero-health consequences.

### Three practical choices

| Choice | Actual effect | Cost and limit |
|---|---|---|
| Keep current orders | No new command; current modes, owners and accepted plans continue | Damage/heat/health continue to matter |
| Protect | Existing two-lap engine-saving intent; previous engine owner returns afterward | Lower power; heat falls gradually; pit and pace ownership are unchanged |
| Repair only | A real physical entry, shared-box service and safe exit; removes scalar damage | Full transit/queue/service loss; fitted tyre identity, wear and existing stint remain; lifetime health is not replenished |

Voluntary retirement is also available through a separate confirmation. It preserves classification, cannot be undone by closing the panel, and does not manufacture a clearance hazard merely because the player chose to withdraw.

### Repair is a physical transaction

A repair-only order requires a running player car on the racing track, positive repairable damage, no accepted pit order, a safely reachable gate before the finish, and a usable fitted set with at least 10% limiting-wheel life. It needs **no spare tyre**, but cannot repair a puncture or an exhausted fitted wheel. Ordinary tyre-change stops remain a separate transaction.

The repair-only service lasts **2–3 seconds plus 0.14 seconds per damage unit**, using the separate service stream. Transit, physical queueing and safe release add their existing costs. The service job is frozen at the box; repair choices are locked after physical pit entry. Neither viewing the plan nor ordering the stop removes damage. Completion clears scalar damage and accumulated repairable exposure, not lifetime health.

The fitted set is never remounted by repair-only service. Its mounts, wear, temperature history and existing stint remain; normal pit-transit wear still occurs. Two teammates use the same physical box serially. Priority cannot move a car through an occupied box. Service and exit wording explicitly say the fitted tyres are retained; the strategy desk does not advertise a fictitious tyre change while that transaction is pending.

A manual repair takes **pit ownership only**, marks an approved plan overridden, and requires explicit re-approval of any intended subsequent tyre windows. Cancellation is available before pit entry through the normal cancellation command. A pending repair-only order must be canceled before changing its tyre/service type.

### Emergency authority

Additional critical repair-only stops require all of: engineer pit ownership, explicit repair authority, an approved plan that permits emergency action, sufficient remaining gate/tyre feasibility, and a repair-work cost inside the driver's cap. Player drivers start with **advice only**; rivals start with repair authority. This is a disclosed ownership default, not a physics advantage.

The cap defaults to 12 seconds and is configurable from 0 to 30 seconds. It caps the **additional repair work**, not total pit-lane time. Granting authority does not delegate pit ownership. Existing planned tyre stops and their previously selected repair setting are separate permissions. There is no automatic retirement or automatic pause. The legacy damage-triggered unplanned stop cannot bypass the new authority checks.

An engineer-owned engine policy reduces engine mode during degraded/critical running; manual engine ownership or a live player override remains binding. Ignoring advice does not grant new authority.

### Read-only comparison and command contracts

`RecoveryForecast` accepts the existing own-private/public-rival snapshot and an allow-listed observation. It never receives fault thresholds, random state or future weather. It compares lap estimates at current conditions, engine saving at current heat, and removal of scalar damage while retaining current health and tyre state. It shows full pit loss and a break-even lap count, not an exact final position or probability of finishing.

The estimate holds current tyres, heat, health and flag assumptions constant. It does not model future faults, later strategy changes or an entire counterfactual race. A flag release, new hazard, ownership revision, material health/heat/damage change or snapshot age can invalidate it. The native panel caches comparisons and refreshes on meaningful change or a short simulated-time cadence, not by consuming live randomness.

| Command | Required identity | Behavior |
|---|---|---|
| `recovery_protect` | Explicit driver, snapshot time and material key | Two-lap engine-saving intent |
| `recovery_repair` | Same plus exact safe-entry gate | Named repair-only order, with explicit deferral when applicable |
| `recovery_retire` | Same snapshot identity plus `confirm: true` | Irreversible named retirement |
| `recovery_authority` | Explicit driver, authority revision, value and budget | Change bounded permission without changing pit ownership |

Race commands reject snapshots older than five simulated seconds and stale keys. Retirement confirmation retains its original recipient and snapshot; switching the inspected car cannot redirect it. Rejected commands leave gameplay unchanged and explain why they failed.

## RW-15 — one supported fictional neutralization procedure

This increment implements **virtual neutralization**, not a physical safety car, real-series VSC certification, or deliberate field bunching.

| State | Implemented rule |
|---|---|
| Local yellow | Target speed at most 25 m/s; no passing in the affected sector; multiple local zones coexist |
| Virtual | Target speed at most 60% of the compiled reference speed envelope; slower cars remain slower; no passing, catch-up or field reset |
| Virtual ending | Same restrictions for eight simulated seconds before release; a new global hazard cancels the announced ending |
| Green | Global restriction released; any unexpired local yellow remains effective |

Cars brake through the normal movement model when restrictions begin; their speed is not teleported to the target. Pit entry, transit, the shared box and safe exit remain physical and open. A conservative pre-step longitudinal constraint prevents a faster alongside follower from passing through a slower car under restriction. It never moves a car backwards or pulls a distant car toward the leader.

Incidents queue bounded, source-deduplicated requests during movement. **The next authoritative step processes those requests before capturing the whole-field movement snapshot.** This prevents different cars receiving different rules merely because of their roster iteration order. Journal order records the control change before a same-step pit entry. Multiple local zones are kept rather than overwritten by the last processed incident.

A stranded on-track retirement requests a 38-second global clearance interval; a recovering driving error requests an 18-second local interval. These timers are fictional clearance abstractions, not simulated marshals. Local restrictions inspect the swept longitudinal interval, including sector and start-line boundaries. Virtual release does not reset gaps or classification.

Forecasts use the current reduced running pace when estimating relative pit loss, rejoin movement and shared-box arrivals; they do not discount physical pit transit or repair work. They assume the current flag persists and become stale on its revision. Local-yellow sector time is not separately forecast. There are no new stewarding penalties, red flags, physical SC trains or rolling-restart rules.

## Native interaction and evidence

The Recovery panel's driver selectors, observed stage and three primary actions sit **outside its scrolling evidence**. A long explanation cannot scroll Protect, Repair only or Retire out of view. Authority drafts are per driver and survive presentation refreshes and driver switches; unapplied drafts do not survive application restart. Applying authority is explicit.

The compact button helper now constructs the application's normal/hover/pressed palette for detached controls instead of capturing Godot's fallback gray styles before parenting. Explicit primary styles remain intact. Both player cards retain Weather/Recovery/pit access at the tested desktop layouts. The guide adds **Protect the finish**, revealing actual controls without seizing time control.

The journal records stage transitions, scalar faults, observed pre-incident condition, decisions, service start/completion, retirements and rule transitions. Service records retain measured duration, damage before/after, health before/after and set identity. The debrief shows recent team recovery/control events and labels estimates separately from measured consequences. Refresh rebuilds it rather than appending duplicates.

## Persistence and module boundaries

New application sessions save **checkpoint v8** through `RecoveryRaceSim`, which extends the weather/strategy seams. The additional state includes per-car exposure and reliability streams, service RNG, authority/caps, frozen repair jobs, queued control requests, zones, release state and journal evidence. Existing weather, team, battle, inventory, physical-order and driving RNG data remain.

Supported native **v1–v7** saves migrate in **legacy recovery mode**, preserving their existing fault/flag and weather semantics. Migration does not fabricate historical failures or switch a live race to a new random process. That mode is shown explicitly and remains valid when resaved as v8. Browser prototype saves remain incompatible.

Validation rejects unsupported procedures, inconsistent flags, invalid numerical ranges, future records, malformed jobs/evidence, and repair-only state without the real transaction. The application validates before replacing the current weekend. JSON continuation checks use a `1e-8` numeric tolerance with explicit stream checks; cross-platform floating-point bit identity is not claimed.

The base `RaceSim` only gained small extension hooks for flag updates, observable forecast parameters, restricted progress, service and pit-exit wording. Legacy implementations retain their prior defaults. Domain classes remain independent of UI and the application singleton.

## Shipped learning scenarios

| Scenario | Disclosed initial state | Decision |
|---|---|---|
| Protect the finish | Pinecrest, 12 laps, seed 3108; MER damage 40 / health 72%; MOR damage 20 / health 78%; dry/calm, manual player pits | Retain the run, protect, or pay for repair |
| Is the repair worth it? | Pinecrest, 4 laps, seed 3109; MER damage 8 / health 88%; MOR damage 12 / health 85%; dry/calm, manual player pits | Weigh modest damage against the full stop with little time remaining |

Both begin at briefing and retain qualifying, preparation, formation and start approvals. Their differing initial resources are disclosed. Neither inserts a later hazard, forces a winner nor guarantees a lead-lap finish.

## Verification

The final clean local run passed on **24 September 2026**: **1,449 checks and 54 native screenshots**, including **186 new checks**. Environment: Godot **4.7.2 Standard (`ed1daf0bf`)**, Linux, **Intel Xeon Platinum 8370C at 2.80 GHz**, Mesa llvmpipe/Xvfb. Both **1440 × 900** and **1100 × 720** native layouts were exercised, including clipping ancestors, focus, explicit recipients and actions remaining outside scrollable evidence.

| Suite | Passing checks |
|---|---:|
| Existing base domain / native UI | 706 / 113 |
| Strategy contracts / complete dry scenarios / strategy UI | 109 / 19 / 34 |
| Living racecraft/team domain / UI | 113 / 31 |
| Weather domain / complete wet scenario / UI | 97 / 10 / 31 |
| New recovery/control domain / complete scenarios / UI | 128 / 24 / 34 |
| **Total** | **1,449** |

The current run's twenty read-only recovery comparisons took **23.675 ms** in the focused fixture. That is a bounded comparison-work observation, not a frame-rate benchmark or guarantee. Native screenshot inspection confirmed the scroll-independent controls and application palette. No human playtest or dedicated accessibility session was performed.

Hosted verification is separate from this local result. The final-code PR run is **35973409175**; consult its current status and published evidence rather than treating a local pass as a CI result.

The tested code commit is `1fcf6f188c09f3ea9ee87f2c1a6d5d9e1afcaf80`, tree `f93daf7dc5258df5a21a8e18da59c588aecdb4f6`. Its 181 tracked files were compared byte-for-byte with the clean verification copy, allowing only the runner's deliberate isolated application-name substitution. Subsequent handoff changes are documentation-only.

Run:

```sh
python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

The runner includes all prior domain/native UI/scenario suites plus `recovery_tests.gd`, `recovery_scenario_runs.gd` and `recovery_ui_smoke.gd`. It copies the project, isolates user data, imports afresh, rejects script/runtime errors and writes JSON reports, logs and native screenshots. `--headless-only` explicitly omits the rendered UI tests. GitHub Actions runs the same runner and publishes its own evidence.

The recovery scenario run counts **37,405 fixed steps** through real qualifying/formation and three race branches. In the paired damaged-car run, MER finishes P12 with 10 completed laps and no stop versus P11 with 11 completed laps and one repair; MOR finishes in both branches. These are different lap-count-first outcomes, not comparable raw finish times or a proof that repair always wins. The short-race fixture instead estimates a repair payback beyond the remaining distance.

A separate regression run explicitly injects a test-only barrier retirement and critical condition to exercise virtual deployment, ending, delegated repair and final classification. That injection is not shipped scenario behavior. Normal running in this small run produced no new scalar faults; a separate constant-heat 60-second exposure fixture produced two faults in attack mode versus zero while saving. Neither result is an incidence calibration study.

The focused physical repair fixture measured **38.45 seconds** for the total visit against the model's **36.51–41.01-second** band. This is one containment observation, not calibrated coverage. The preserved dry and wet suites also execute their complete weekends. No baseline test was removed to obtain a pass.

## Remaining acceptance and next packages

RW-14/RW-15 now have playable implementations with persistence, fair information boundaries, real costs, AI permissions and regression evidence. Human comprehension, broader circuit/seed strategy crossover tests, fault frequency tuning, forecast error/coverage analysis and dedicated accessibility testing remain open. Do not call Stage C fully accepted merely because automated checks pass.

The next GDD work is **RW-17 purposeful optional practice**, then justified **RW-18 rival/driver depth** and **RW-19 replay/sandbox branches** with a safe once-only result boundary. Practice should provide observed information rather than a hidden performance buff. Replay and campaign settlement do not exist in this increment.

Itemized component engineering, physical safety cars/bunching, full stewarding, red flags, new sporting formats, company finances and track-editor expansion are still outside scope. No full controller/screen-reader certification, enlarged-text certification, universal strategy balance or frame-rate guarantee is claimed.
