# Race weekend — uncertain weather and crossover decisions

**Implementation: 0.7.0.** Design basis: the supplied **Motorsport Manager — Race Weekend GDD v1.0**, especially sections 11, 16, 17, 20, 22, 24 and 25. This is the RW-12/RW-13 playable weather slice, with related persistence, journal and RW-16 interaction work. It is **not the entire GDD, all of Stage C, or a claim of calibrated balance or human-playtest acceptance**.

The branch builds on the completed 0.6 source at `4966c577380e3c80c693d70417a68c525be3070b` (PR #1). The existing strategy, battle and team systems are retained, not replaced. The work is isolated on `feat/race-weekend-weather`; main is unchanged.

## Play the slice

Open `project.godot` in **Godot 4.7.2 Standard**, then press F5. Choose **Weather Scenarios** on the main menu, or select **Grand Prix Weekend** and choose a weather profile plus its explicit weather mode. New normal weekends use seeded weather. The existing **Dry Scenarios** remain available as their original strategy fixtures.

In the pit wall, choose **Weather & crossovers** from the context selector, or either driver's persistent **Weather** button. The selected weather recipient is explicit; inspecting another car in the timing tower cannot redirect a command. The panel remains observational in briefing and other phases where a race stop is not legal.

Read observed rain separately from measured line water. Inspect the three sectors and the wettest on-line/off-line readings, then compare the current plan with a feasible tyre change and, where possible, the same change one lap later. **Surface map** shows the existing authoritative surface overlay. Scroll for detailed assumptions; the Box and Keep plan actions remain at the top of the panel.

**Box MER/MOR** issues a real stop at the displayed safe entry. **Keep plan** acknowledges the current comparison without changing an order, ownership, playback speed or pause. A stale click is rejected with a reason rather than silently becoming a newly calculated order. The contextual pit-wall guide includes **Rain is not the road** and never pauses the race on the player's behalf.

## Delivered behavior and information boundaries

### RW-12: seeded weather, observation-only forecasts

`WeekendWeather` owns a separate persisted 32-bit random stream and advances only on authoritative 0.05-second steps. It chooses bounded cloud targets and transition durations, with gradual cloud and rainfall movement. `dry` remains dry; `wet` is rain-prone, not a guarantee of later drying; `changeable` can produce different histories from different seeds. The coefficients are a fictional game model, not a validated meteorological simulation.

Only rainfall enters the existing `RaceSurface.evolve` path. The same 96 × 7 surface field continues to drive tyre/grip behavior and visual inspection. Turning a map overlay or decorative effect on or off does not alter rain, surface water, random streams or sporting results.

The public interface is `WeatherOutlook.evaluate(history, observation, reference_lap_seconds, mode)`. It receives **only measured history and current rain/cloud/surface observations**. It has no reference to the weather process, private target, transition countdown, seed or random state. The forecast estimates a recent trend and may show a broad possible arrival window from observed cloud buildup. Duration stays unknown. Missing history is explicitly described as a baseline with limited evidence.

Three deterministic stress cases describe a drier future, continuation of the recent trend and a wetter future. They are **not probabilities, calibrated coverage intervals, or samples of the authoritative future**. A forecast that says rain is possible does not promise a shower.

The alternative `scripted_training` mode retains the original fixed weather schedule, is labeled in setup and the pit wall, and is also used when migrating old saves. Its public forecast still does not read the future schedule. A legacy run is never silently converted into a different seeded future.

### RW-13: crossover decisions with real costs

`WeatherStrategy` uses the existing own-private/public-rival `RaceForecaster` snapshot. It evaluates the current plan and at most one representative usable set from each dry/intermediate/wet family, then exposes no more than three options: current plan, the relevant next-entry change and a one-lap-later comparison. Set selection considers the limiting wheel and projected useful life, not just the average tyre label.

The bounded model uses half-lap increments and existing tyre/grip, fuel, pace, pit geometry, service, warm-up, traffic and shared-box primitives. It includes the **full additional stop loss**. Conditions move gradually toward each public stress case, then remain constant. A partial wettest-sector offset makes uneven water relevant without pretending to predict every surface cell. Current modes remain constant in the comparison; incidents and unknown rival responses are not predicted.

Evaluation is capped at **24 remaining laps**. Longer custom races visibly label a partial horizon rather than claiming an entire-race optimum. Unsafe or unavailable stock, an unreachable final entry, and incompatible later stops do not produce a magically feasible recommendation. Revised comparisons preserve compatible later approved windows; the one-lap-later option is a comparison, not a hidden scheduled order.

Estimates and resource/finish risk are presented separately. Time bands reflect the stress cases and a small model allowance, not calibrated likelihood. Advice is useful for comparing assumptions; it is not a guaranteed fastest plan or finishing position.

### Ownership, rivals and physical execution

Manual weather Box takes **pit ownership only** through the existing validated pit command. Pace and engine delegation remain unchanged. The displayed tyre set is reserved by an order, not mounted or refreshed by looking at it. Actual pit entry, service and exit determine fitting and measured visit duration. Existing commitment, cancellation and queueing rules remain authoritative.

For unplanned, delegated running in seeded wet conditions, every team uses the same observation-only comparison with its own legal inventory. Evaluations are staggered at 15–18 simulated-second intervals. Binding approved plans, manual pit ownership, already accepted stops and emergency recovery retain the prior policy. The weather agent cannot rewrite a no-stop plan because it prefers another strategy. Team priority may defer a still-uncommitted discretionary stop only under the existing rules.

Keep plan retains the current weather choice until material assumptions change; approved windows and safety recovery still apply. No new input cooldown, time slowdown, automatic pause or unrelated ownership handback is introduced.

### Commands and stale-state validation

`weather_box` and `weather_hold` are routed through `WeatherRaceSim.command` and require:

| Field | Meaning |
|---|---|
| `id` | Explicit running player driver, 3 or 6 |
| `time` | Source snapshot time; at most five simulated seconds old |
| `key` | Existing material strategy/rejoin key, including policy revision |
| `weather_key` | Public observation and trend signature for material rain/cloud/surface or evidence revisions |
| `set_id` | For Box, the displayed currently feasible owned replacement |
| `gate` | For Box, the exact displayed safely reachable pit-entry distance |

Permissions, phase, car state, pending commitment, inventory and gate are checked at activation. Flag changes, rival stops, material surface changes, revised public trend evidence or expired source data invalidate the proposal. New observations can invalidate an old baseline even when the current rain and water readings have not changed. Rejection changes neither gameplay nor random state. A deferred safe entry is named as deferred; no last-lap teleportation is added.

Both player cards retain independent weather warning access. Persistent radio/journal warnings are deduplicated by issue and surface-condition family. These are advisory notices, not commands. Their fallback is always the existing plan and ownership.

## Checkpoint v7 and evidence

`WeatherRaceSim` extends `StrategyRaceSim` without rewriting the preserved movement, tyre, battle or track-editor classes. New application weekends save version **7**. The application loader accepts supported native **v1–v7** data and validates the complete inherited state before replacing the live weekend.

The new state includes private weather target/cloud/rain/RNG, bounded public observation history, sample cadence, per-driver notice/hold memory and delegated review times. It also retains all inherited policies, battle identities, team instructions, pending physical stops, finite wheel stock and driving/service RNG state.

A v1–v6 save migrates to explicitly labeled scripted training with **no fabricated past observations**. Its original rain/surface schedule and existing random state continue. Invalid weather ranges, future observations, malformed per-driver arrays and malformed weather journal evidence are rejected before use. Browser prototype saves remain incompatible.

The journal adds weather-mode provenance, actual observed warnings and at-call weather decisions. Manual and delegated stops retain their existing order IDs and measured entry/exit records. **Decision debrief** shows the last six team weather choices and the conditions known at the time, followed by the existing measured pit/strategy evidence. Predicted alternative gains are labeled estimates, never measured alternate results. Local evidence export retains the journal. This is not a replay branch or campaign settlement feature.

## Three scenario recipes

| Scenario | Starting premise | Player pit ownership |
|---|---|---|
| **A shower or a front?** | Pinecrest, 24 laps, seed 2026, seeded changeable conditions; weigh waiting against an early switch | Player |
| **Drying unevenly** | Pinecrest, 24 laps, seed 86, seeded rain-prone conditions; compare local wet sections with the evolving line | Engineer; takeover remains available |
| **Rain is not the road** | Pinecrest, 12 laps, seed 7314, explicitly scripted legacy wet-to-easing training | Player |

Each starts at briefing with normal qualifying, preparation, formation and start approvals. Calm incidents are disclosed and apply equally. Recipes carry track hash, ruleset, seed, public objective, hints and assist provenance. They do not force the winner or credit a choice for a scripted result. The four existing dry recipes are preserved separately.

## Verification evidence

A clean full local run passed on **24 September 2026** using Godot **4.7.2 Standard (`ed1daf0bf`)**, Linux, **AMD EPYC 9V74**, Mesa llvmpipe/Xvfb. The runner copied the project and isolated user data, imported afresh, and rejected script/runtime errors. Supported native layouts were exercised at **1440 × 900** and **1100 × 720**, including clipping ancestors, stable button identity, keyboard focus, both cars' actions and player time controls.

| Suite | Passing checks |
|---|---:|
| Existing base domain | 706 |
| Existing native UI | 113 |
| Strategy contracts | 109 |
| Complete dry scenario runs | 19 |
| Strategy native UI | 34 |
| Living racecraft/team domain | 113 |
| Living racecraft/team native UI | 31 |
| New weather domain contracts | 97 |
| New complete seeded wet weekend | 10 |
| New weather native UI | 31 |
| **Total** | **1,263** |

The final tested code is commit `7d89033376ec15e23e2e9d80d810f561ac9bc1ea`, tree `c18e85155cf3a1c539dc46b42e9e21cd59024e27`. The subsequent handoff commit changes documentation only.

**46 native screenshots** were produced. The 138 new checks cover separate RNG behavior, observational comparisons, forbidden hidden inputs, stale commands including revised public trend evidence, finite stock, physical gates, only-pit ownership, retained manual/approved plans, actual service, migration/continuation, evidence validation and UI access. JSON-restored numerical continuation uses a `1e-8` float tolerance with explicit discrete/RNG checks; cross-platform bit-identical floating-point output is not claimed.

The complete wet fixture exercised **29,344 counted fixed steps**, plus a paired 250-step continuation check, through qualifying, load/approval, physical formation, race and classification. All twelve entrants finished, including correctly classified lapped cars. It recorded **15 weather calls and 15 physical pit visits**; both player cars finished on the lead lap. In the separate focused service fixture, the measured visit was **33.15 seconds**, against the existing predicted **32.16–36.66-second** visit band. One contained result does not establish calibration.

The preserved two dry 24-lap branches also completed, exercising **44,249 counted fixed steps**. No source-level test was dropped to make the new feature pass.

Run:

```sh
python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

`reports/verification.json`, `weather-tests.json`, `weather-scenario.json`, `weather-ui.json` and the existing reports are generated by the runner. `--headless-only` explicitly skips native UI checks. GitHub Actions uses the same expanded runner and publishes its own evidence; a local pass is not presented as a hosted-CI pass before that run completes.

## Remaining GDD work and acceptance limits

This iteration implements the first seeded/public-forecast and local-crossover path. It does not close RW-14 staged scalar reliability or RW-15 coherent neutralization. The inherited simplified flag behavior is not relabeled as a physical safety car or full VSC/SC procedure. Optional practice, broader rival/driver depth, replay branches and immutable once-only campaign handoff remain later packages.

Within this weather slice, broader seeds/circuit coverage, forecast error and coverage analysis, crossover strategy balance, accessibility work with relevant players and newcomer/experienced-player comprehension testing remain open. There is no human-playtest finding, universal best-strategy claim, probability calibration, controller/screen-reader certification or 60-FPS guarantee. Weather coefficients and heuristic thresholds remain tuning hypotheses. Improve those through evidence before increasing simulation complexity.
