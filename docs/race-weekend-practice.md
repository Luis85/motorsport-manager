# Race weekend — optional purposeful practice

**Implementation: 0.10.0.** Design basis: the supplied **Race Weekend GDD v1.0**, RW-17 and sections 7.2, 9.5, 17, 20, 22 and 25. This is the first playable purposeful-practice increment, with related RW-16 interaction and persistence work. It does **not** complete all of Stage D, establish calibrated forecast coverage or replace exploratory human playtesting.

Baseline: merged native **0.9.0**, commit `66c2338a3f708123265bc6c1e55923296638a1f7`. The implementation extends the merged task-oriented pit wall, weather, recovery, strategy and editor. Branch `feat/race-weekend-practice` targets main directly; main was not modified by this increment. Final tested code is `16970adbc41ce371d00b440daeb7170816880874`, tree `c9ee86c6505afc7e9a623a5719af3ddb1d64fa96`. The subsequent handoff commit changes documentation only.

## Play it

Open `project.godot` in **Godot 4.7.2 Standard** and press F5. Select **Practice → Spend a set to learn**, or create a new normal Grand Prix Weekend. At briefing, **Optional practice** opens the new **Strategy / Practice** topic without starting time or issuing an order. **Start qualifying** remains available as the direct skip path.

Choose MER or MOR, a run objective, a driver-owned tyre set, one to four measured laps, and an applied-setup baseline. Drafting is free and does not modify the car. **Start practice** explicitly opens the session. **Run MER/MOR** validates the displayed release and applies that driver's chosen setup, set and run modes. It then executes a physical departure, out lap, measured laps and in lap.

Read the report after return. **Recall** brings an unfinished run back through the next physical pit entry. **End practice…** closes the session for both drivers after confirmation: an already-started measured lap may finish, but no new run starts. All running cars return before the practice-results gate. **Return to briefing** retains the notebook and resource costs; starting qualifying still requires your approval.

Pause, speed and camera remain under player control. Closing the session at its published time limit is a sporting session rule, not a warning-triggered auto-pause. Menu/save behavior retains the established explicit navigation contract.

## Four objectives, real trade-offs

| Run objective | Execution and useful evidence | Boundary |
|---|---|---|
| Tyre-life estimate | Balanced pace/engine; measured full-lap tread depletion and pace | Condition, setup and traffic can invalidate extrapolation |
| Qualifying preparation | Push pace and attack engine; measured flying-lap evidence and higher resource expenditure | Practice times never count toward the qualifying grid or consume qualifying attempts |
| Setup comparison | Explicit current/balanced/low-drag/stable-wet configuration; retained measurements for comparing successive runs | No hidden optimum, perfect score or automatic winning setup; observed lap differences are confounded by fuel, tyre age, water and traffic |
| Wet-condition learning | Balanced run recording actual surface-water exposure and resource effects | A run on a dry road explicitly yields no wet-condition evidence; selecting the objective cannot make it rain |

Both drivers can perform complementary experiments. Their drafts, run IDs, tyre sets and notebook records remain separate. Player runs are limited to **three per driver**, each containing **one to four requested measured laps**, plus the actual departure/out/in/return work. Those bounds are tuning choices, not researched optimums. Session duration starts at the larger of 600 simulated seconds or seven reference laps, capped at 1,800 seconds.

The run estimate uses the compiled reference lap and physical pit transit, with an out/in allowance and return margin. It checks remaining session time before accepting a release. It is not a promise that wet running, traffic or a compromised car will complete the plan. Existing tyre and lifetime-health costs remain real. Fuel is shown in lap-equivalent units; garage loading for a new practice or qualifying run is distinct from prohibited race refueling. Review restores the ordinary pre-race fuel allocation in the garage, not spent tyre condition or lifetime health.

The selected setup remains applied after return. Temporary practice pace/engine values return to their previous values; race ownership and approved strategy policies are not rewritten. There is no participation boost. Skipping consumes neither time nor stock and retains baseline estimates and normal delegation. Running practice legitimately advances the authoritative weather/surface clock and changes the used car state, so its later race need not be identical to a skipped weekend.

## Physical execution, partial observations and fair information

`PracticeRaceSim` extends `RecoveryRaceSim`. It reuses existing movement, four-wheel tyres, pit routes, safe release and courtesy behavior through small shared run-session seams in `RaceSim`. There is no second physics engine, teleported return or fabricated full lap. Ordinary wear, thermal behavior and surface evolution continue. The existing stochastic driving/reliability-fault paths remain **race-only** in this increment; random practice accidents are not advertised or introduced.

Practice uses the existing out/hot/in internal movement states, but its crossing handler records to the practice notebook rather than qualifying history. Timing comes from interpolated timing-line crossings. A recall before the first full lap records consumed resources and elapsed time, but cannot manufacture a completed sample. Clock closure retains full laps already obtained and the partial run outcome. No run is repeated silently after return.

Rivals conduct one bounded initial two-lap tyre-life run using their own usable medium/intermediate allocation and the same release validator. This is a transparent baseline policy, not the expanded personality planner proposed in RW-18. It introduces real traffic and spends rival stock. Each team's forecast learning uses that driver's own records; no private rival notebook is copied into the player's forecast. Public practice lap display is separate from private learning data.

## Forecast learning: bounded evidence, not a bonus

`PracticeEvidence` retains full-lap times, mean surface water, measured tread loss, fuel/health context, damage, comparability and the baseline-model residual. A run also records its applied setup/modes, source set identity, start/end measurements and reason for completion or interruption. These values are observations, not a diagnosis of unmodeled components.

A sample contributes only when its **driver, compound, applied setup, pace and engine modes match**, its water differs from the current mean by at most 0.10, and its health/damage remain within the implemented comparison tolerances. A lap is conservatively excluded from learning after nearby forward traffic, neutralization, a loss event, unusable tyres or a material condition change. Exclusion never deletes the measured result: the report labels it context-limited and the model falls back to its baseline.

The coarse forecaster blends comparable wear and lap residuals with baseline values, weighted by `n / (n + 4)`. Raw wear ratios are bounded to 0.5–2.5 and lap ratios to 0.9–1.2 before blending. One or two matching laps cannot narrow the existing 6% time allowance. Three or more may reduce that allowance, with a 4.5% floor and an allowance for sample spread; unsampled future compounds retain baseline uncertainty. These are **uncalibrated model allowances**, not probability/confidence intervals with demonstrated coverage.

Learning changes `RaceForecaster` estimates and their disclosed assumptions, not speed, grip, driver skill or physical car parameters. Existing measured race-stint wear takes priority over a practice wear factor once enough current running exists. The shared wear estimator also feeds weather strategy comparisons. Future water changes remain a coarse stress-case approximation; the model does not prove transferability to every future cell or horizon. A changed setup, mode or materially different present conditions removes incompatible evidence from the current prior.

Better information can legitimately influence a subsequent delegated decision. It does not guarantee a better outcome. Both a prudent skip and a useful experiment remain valid options; the current content/test results do not establish that either universally dominates.

## Native workflow and usability

The merged **Watch / Strategy / Car / Team / Conditions / Review** navigation is preserved. Practice is a contextual Strategy topic and a Find view destination. Both player cards provide a Practice shortcut while the session or its review is active. Cards show run fuel and measured-run progress rather than misleading race-fuel shortfall advice or practice qualifying positions.

Run, Recall and End stay above the scrolling form/evidence. Form fields include visible intended setup values before release. Drafts are per driver, unapplied and retained through telemetry refresh/selection changes. They are **not persisted across application restart**; committed runs and measurements are. Existing broad draft-exit warnings are not relabeled as universal practice-draft persistence.

Actions name their driver independently of the timing selection. Release validates the source revision, material key, snapshot age (maximum five simulated seconds), live route, legal set, run limit and current clock margin. A stale release is rejected without a silent replacement experiment. Changing mechanical setup or tyre plans requires the garage. In-flight run control is Recall, not race pit commands or hidden ownership changes.

The guide adds **Learn before spending your best set** and highlights actual controls. It is dismissible/resumable and never pauses or changes speed. The existing text sizes 100%, 115% and 130% are retained. Native form controls and fixed actions were tested at both supported desktop layouts; this is not screen-reader/controller certification or human accessibility validation.

## Commands and checkpoint v9

| Command | Preconditions and result |
|---|---|
| `practice_start` | Available once at briefing; explicitly opens practice and puts the field in garages |
| `practice_run` | Explicit player driver plus objective/set/laps/baseline, source time/key/revision; validates and physically releases |
| `practice_recall` | Explicit active player run before return commitment; keeps partial evidence and uses physical return |
| `practice_end` | Open practice; closes new releases while honoring the current measured lap and return |
| `practice_finish` | Practice-results gate; retains resources/notebook, resets qualifying counters and returns to briefing |

The run journal retains command, measured-lap and return records tied to stable driver/run IDs. The **Practice notebook** appears in the causal debrief without repeated-prefix growth. It distinguishes measured averages, estimated future effects and confounding factors. Export continues to use the inherited journal/evidence path; no campaign award or settlement is attached to practice.

New application checkpoints use **v9** and retain per-driver runs, active timing anchors, sample accumulation, release cadence, draft-independent applied setup/modes and the inherited weather, reliability, service, team, strategy and random-stream state. Validation checks bounded collections, chronology, references, legal set identity, active-run/car consistency and journal-to-notebook linkage before replacing the active weekend.

Supported native **v1–v8** checkpoints load through the inherited migration chain and acquire an empty, explicitly legacy practice record. They cannot invent practice history or insert a compulsory new session. Historical dry/weather/recovery scenario constructors retain their existing models for reproducibility; create a new normal weekend or one of the new practice recipes to use practice. Browser prototype saves remain unsupported.

## Scenarios

**Spend a set to learn:** Pinecrest, Formula, dry, seed 2026, 12 race laps, calm incidents. The disclosed question is whether useful tyre-life evidence justifies spending a real set. The hint suggests complementary medium/hard experiments, not a promised result. Skipping remains available.

**Two setups, one question:** Pinecrest, Formula, rain-prone, seed 86, 12 race laps, calm incidents. Compare actual configurations while acknowledging changing water, tyres, fuel and traffic. The weather process is not controlled by the run objective. Neither recipe forces a hazard, pass or winner.

## Verification evidence

A clean full local run on **24 September 2026** passed **1,869 checks** and produced **79 native screenshots**, retaining all **1,707 merged-baseline checks** and adding **162**. The runner copied/imported the project afresh with isolated user data and rejected script/runtime errors. The published code tree was verified against the local tracked source by exact Git tree identity; all 217 tracked files match, including the planning document then present. The handoff commit only updates documentation.

| Suite | Passing checks |
|---|---:|
| Base domain / native UI | 706 / 113 |
| Strategy / complete dry scenarios / strategy UI | 109 / 19 / 34 |
| Living racecraft/team domain / UI | 113 / 33 |
| Weather / complete wet weekend / UI | 97 / 10 / 33 |
| Recovery/control / complete scenarios / UI | 128 / 24 / 41 |
| Compact UI / task-oriented pit-wall UX | 119 / 128 |
| New practice domain / complete weekend / UI | 78 / 17 / 67 |
| **Total** | **1,869** |

Environment: **Godot 4.7.2 Standard (`ed1daf0bf`)**, Linux, **AMD EPYC 9V74**, Mesa llvmpipe (LLVM 19.1.7)/Xvfb. Native sizes: **1440×900 and 1100×720**, each with **100%, 115% and 130% text**. Tests cover the individual form inputs, clipping ancestors, fixed actions while scrolled, both driver shortcuts, keyboard focus, stale clicks, canceled confirmations and actual save/load. Six practice screenshots supplement the preserved 73 screenshots. Total local phase time was approximately **693 seconds**, not a game-frame-rate claim.

The complete dry practice-to-race fixture counted **24,421 fixed steps**, measured two MER tyre-life laps and one MOR qualifying-preparation lap, saved/restored at review, completed subsequent actual qualifying, then physical formation/start approvals and a 12-lap race. All twelve cars finished. This is one lifecycle fixture, not proof that practice caused a winning result or that practice/skip strategies are balanced across seeds.

In a separate clean-air contract fixture, three actual medium-tyre laps measured **33.525, 32.518 and 32.506 seconds**, with **3.704–3.732 tread points/lap**. They produced a bounded pace factor of about **1.0111** and wear factor of **0.9925** in the coarse forecast. A separate ordinary-traffic fixture completed three laps but yielded **zero clean samples**; those observations correctly remained visible without fabricating learning. This conservative filter and real player ability to find a useful clear-air run require further tuning and usability testing.

The preserved observational-performance suite passed and matched headless outcomes at controlled 1×/16× input workloads. Its timings cover the merged baseline pit-wall/Monaco workload, **not a dedicated mature-practice benchmark**. No 60-FPS guarantee, achieved real-time multiplier or cross-platform bit-identical floating-point claim is made. JSON continuation tests use a `1e-8` numerical tolerance where appropriate with explicit random-state checks.

Run:

```sh
python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

Reports include `verification.json`, `practice-tests.json`, `practice-scenario.json`, `practice-ui.json` and existing suites under `reports/`. `--headless-only` explicitly omits native UI checks. GitHub Actions uses the same expanded runner and publishes separate hosted evidence; a local pass is not a hosted-CI pass before completion.

## Remaining acceptance and GDD scope

Broader circuit/seed coverage, practice-versus-skip balance, held-out forecast-error analysis, practical availability of clean laps, workload/comprehension sessions and dedicated accessibility validation remain open. The short dry complete-weekend fixture and separate wet-learning objective test are not a full multi-seed wet-practice study. No player interviews or exploratory human playtest were performed during this increment.

RW-18 expanded rival styles and race-local pressure, RW-19 replay branches with protected once-only result handoff, richer standalone progression, and separately justified ruleset/component expansion remain later work. This increment adds no campaign money, personal energy, itemized manufacturing, physical safety car, red-flag system or new track-editor features.
