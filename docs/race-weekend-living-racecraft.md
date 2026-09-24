# Race weekend — living racecraft and team coordination (0.6.0)

Design basis: Race Weekend GDD v1.0, sections 10, 12, 16, 24 and 25. Starting point: `17948096ddb2d7c866d909acde825e5a84395f9a`, the initial Stage A strategy slice. This iteration continues `feat/race-weekend-gdd` and PR #1 without changing `main`.

**Delivered:** the next playable Stage B implementation slice: persistent physical battles, bounded team cooperation, shared-box priority and public-stop cover/extend responses. **Not claimed:** completion of the full GDD, broad strategy balance, calibrated forecasts or the GDD's human-playtest acceptance gate. The [0.5 handoff](race-weekend-implementation.md) remains the detailed strategy reference; this document supersedes its battle/team deferrals and current checkpoint version.

## Play it

Open the project in Godot 4.7.2 Standard and press F5. Start a normal weekend or an existing **Strategy Scenario**. Progress through the explicit qualifying, preparation, formation and grid approvals. In a live race, select **Team & battles** in the right-hand topic selector.

**Cooperate:** name which teammate is ahead, choose Hold relative team position or Allow the teammate through, select a one-to-five-lap expiry, then apply. The button names both drivers. A reversed, distant, retired or pit-committed pairing is rejected with a reason. Cancellation retains the recorded outcome rather than deleting history.

**Battles:** inspect both drivers' persistent target, phase and explanation. Watch follows the named contest's car; manual map navigation releases follow. Paired outlines identify the physical participants without changing camera or time automatically. The panel also shows actual publicly observed pit entries, not secret future plans.

**Shared pit box:** compare arrival and possible waiting estimates. Each entry states whether it is hypothetical, an approved window, an accepted order or physically committed. Give either driver priority for two of that driver's laps. Priority only influences future delegated discretion; it does not issue a stop by itself. To see it stagger a stop, approve overlapping windows with a spare legal lap for the other driver. Manual pit ownership remains manual.

Both fixed car cards retain primary commands and show battle/cooperation status. The expanded seven-step guide is dismissible and resumable. Read the **Decision debrief** for completed passes, cooperation outcomes, deferrals and measured pit visits; export preserves the full recorded journal.

## Implemented rules and boundaries

### RW-09: persistent, physical contests

`RacecraftController` tracks a stable contest ID, target, side, timestamps, overlap and phase:

`approach → prepare → probe → commit → alongside → resolve → recover`

The existing corridor solver remains responsible for acceleration, braking, lateral clearance, pit gates and movement. Intent never awards a position. Same-lap targets use absolute race distance, not two-dimensional map proximity; lapped traffic remains a courtesy/blue-flag problem. Flags, an intervening car, pit commitment, lost road/grip opportunity or a retired target end an attempt without inventing a pass.

A completed pass requires recorded longitudinal overlap in separate corridors, followed by more than 7.5 metres of physical clearance. It produces one observed journal event and one pass count. The old center-crossing counter is disabled only in the strategy-aware subclass. A short recovery interval discourages immediate repeated attempts; it does not prevent a later genuine counterattack.

Width, curvature, preparation times and clearance thresholds are declared management-model tuning values, not certified motorsport physics. Narrow-road, lapped-car and yellow/neutralization fixtures exercise the restrictions. Broad track/driver balance remains open.

### RW-10: bounded team cooperation

Track cooperation and pit priority have separate, revisioned slots. Commands identify both eligible Obsidian drivers and an expiry. Safety and physical commitment take precedence; unrelated resource and strategy owners are unchanged.

Hold constrains only the following teammate against the named leader, not against rivals. Allow through waits for clear, sufficiently wide road and usable grip. The yielding car moves aside before any bounded speed reduction; it continues forward and pays a real time/distance cost. No swap is promised. Nearby unrelated traffic and flags prevent deliberate yielding. A retirement is not credited as a successful swap.

Priority can skip at most one reachable entry for the secondary car when estimated box arrivals overlap, provided that its pit domain is delegated, its approved window permits the later entry, a finish-time entry remains possible and its weakest wheel/resources permit waiting. Otherwise the original authority/window remains intact and the queue or recovery reason is shown. An already accepted pit order cannot be reprioritized. No car is teleported through its teammate, and physical arrival still decides service order.

### RW-07: public rival responses

`RivalStrategy` accepts only an allow-listed own-private/public-rival snapshot, observed pit-entry history and its own response memory. It has no simulation reference, live RNG, player draft or future weather. Up to 36 observed entries are retained. Own and teammate stops are not mistaken for an opposing undercut.

A nearby observed rival stop can prompt a cover when estimated fresh-tyre gains justify it, or a one-entry extension when usable tyres and rejoin traffic favor waiting. Accepted orders still use the driver's real inventory and the physical pit route. Approved windows and manual ownership take precedence; emergencies are handled under the existing authorized policy.

These are bounded heuristics using uncertain current-condition estimates, not an omniscient opponent tree or a guarantee of strategic success. Distinct rival personalities, full overcut balance calibration and a richer response tree remain later work. Players see public stops; they do not receive rivals' exact internal plans.

## Persistence and command contract

Application checkpoints are **v6**. In addition to v5 strategies and evidence they retain battle IDs/phases, active team instructions/revisions, priority deferrals, observed entries and response memory. `StrategyRaceSim.restore_weekend` validates the base continuation and all added state before returning a replacement simulation.

Native v1–v4 migrations remain supported. A v5 save retains its existing strategy/history and starts with empty new battle/team/response records; no earlier events are fabricated. Existing PRNG state continues unchanged. JSON round trips and in-memory fixed-step continuation are tested. UI-only drafts are still unapplied and not saved across application restart. Evidence export is not a replay importer.

```gdscript
var request = {"id": 3, "teammate_id": 6, "kind": "yield", "laps": 2,
    "revision": sim.team_state.revision}
if not sim.command("team_order", request):
    print(sim.last_error) # No state change on rejection.

var current = sim.team_state.track_order
sim.command("cancel_team_order", {"id": 3, "slot": "track_order",
    "intent_id": current.intent_id, "revision": sim.team_state.revision})
```

The same command API accepts `kind: "hold"` and `kind: "pit_priority"`. Cancellation is scoped to a matching active slot/intent/revision; stale controls cannot cancel a replacement instruction. New team revisions/deferrals invalidate affected player forecasts. Reading panels, previews, outlines and debriefs is observational and does not consume RNG or change pause/speed.

## Verification

Run the complete clean-import verification:

```sh
python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

The final local 0.6.0 run passed **1,125 checks** and produced **40 native screenshots**:

| Suite | Checks |
|---|---:|
| Preserved domain | 706 |
| Preserved native UI | 113 |
| Strategy contracts | 109 |
| Full-weekend scenarios | 19 |
| Strategy native UI | 34 |
| Living racecraft/team domain | 113 |
| Living racecraft/team native UI | 31 |

The new domain fixtures exercise a complete physical overtake, physical yielding against a control run, two real staggered pit entries and services, an integrated rival cover stop, narrow-road and flag restrictions, stale/invalid commands, ownership, public information and checkpoint continuation. They are explicitly synthetic/adversarial scenarios, not proof of calibrated race balance. No new scenario recipe is claimed: the existing four remain available.

The existing two 24-lap dry Pinecrest branches completed qualifying, formation and classification with both player cars finishing; they used **44,249 fixed steps** in total. Their different outcomes are controlled model observations, not guaranteed strategy rankings.

Native tests exercise actual **1440 × 900** and **1100 × 720** viewports, including clipping ancestors, stable focus, explicit recipients, both primary car controls, cooperation/priority buttons, manual camera release and unchanged time controls. Six new screenshots cover cooperation, battle, priority, desktop, compact and debrief views.

Measured environment: Godot `4.7.2.stable.official.ed1daf0bf`, Linux container, Intel Xeon Platinum 8370C, Mesa llvmpipe and Xvfb. The verifier isolates user data and uses a fresh import. Per-phase timeouts are 360 seconds; the existing 15-minute CI job limit remains. This is functional evidence, not a frame-rate guarantee. Generated `reports/verification.json`, `living-racecraft-tests.json`, `living-racecraft-ui.json` and `strategy-scenarios.json` are the per-run authority. Remote CI is a separate execution; inspect the checks on the actual commit.

## Remaining GDD work

Stage A still needs broader contrasting-strategy fixtures, forecast error/coverage analysis and newcomer/experienced-player testing. Stage B now has the implemented mechanisms above, but broad fairness, comprehension and workload acceptance remain open. Battle state alone does not establish that every circuit produces enjoyable contests.

The next conditions stage remains unimplemented: seeded limited-information weather, local tyre crossovers, staged scalar reliability and a coherent supported neutralization procedure. Existing scripted weather and simplified safety-car caps are not relabeled as complete new procedures. Purposeful practice, expanded rival styles/pressure, replay branches, additional rulesets and immutable once-only campaign handoff remain later work.

The circuit editor, company economy, staff/manufacturing, detailed car models, multiplayer and full real-series regulations are outside this iteration. No campaign energy cost or unsolicited time-control behavior was added.
