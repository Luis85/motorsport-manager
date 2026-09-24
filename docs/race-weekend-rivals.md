# Contextual rivals and a calmer pit wall — 0.11.0

## Scope and authority

This increment follows the supplied Race Weekend GDD v1.0, RW-18 (rival styles), with cross-cutting RW-16 UI, focus, readability and performance work. Base: current main `a8c551c42b6ec0d8c7191460c4d3536607d6a5b2`, tree `ce49436312af662ab20c647ed5fb29ab4af1b71e`. The practice implementation, merged recovery/task-oriented UI, native editor and physical simulation are retained. There were no open PRs at baseline inspection; PR #5 had no review comments.

**RW-18 is partial. Pressure is deliberately deferred.** The candidate pressure pathway would currently duplicate existing patient/conserve/defend trade-offs, and no observed human decision benefit has been established. This release adds no pressure meter, encouragement buff, hidden order refusal or new incident multiplier. It does not mark Stage D, broad balance or human accessibility validation complete. RW-19 and RW-20 remain subsequent work.

## Play

Open `project.godot` in Godot 4.7.2 Standard and press F5. A new **Grand Prix Weekend** enables contextual rivals alongside optional practice. At briefing, either run practice or start qualifying directly; preparation, formation and lights still need explicit approval.

For a focused start, choose **Scenario challenges → Rival styles**. Both recipes begin at a disclosed, untimed preparation grid. They skip practice and qualifying rather than fabricating measured qualifying results. Formation and the start remain physical. Read **Team → Battles → Rival field**, or use **Find / Ctrl+K** and search for rival. Selecting a rival exposes only its public profile, observed compound and measured laps; your two driver cards remain available.

The **Weekend** menu holds Save checkpoint, Export race log, Resume guide and Main menu. **Messages** beside Find retains command acknowledgements/errors; **Review → Radio** retains race messages. Opening either, a comparison, a guide or a public profile never pauses, advances, approves a draft or issues a race command.

## Bounded contextual styles

The existing strategist/driving/race-control separation is preserved. `RivalStyles` is a pure helper, not another simulation or agent inheritance layer. New normal weekends configure the five rival teams from four public tendencies:

| Profile | Intended tendency, not a promise |
|---|---|
| Track-position protector | Avoid a marginal stop which loses places; cover a credible, actually observed threat when the comparison supports it. |
| Opportunistic undercutter | Favor early fresh tyres when a feasible offset and traffic context make the stop worthwhile. |
| Long-stint conservator | Extend usable tyres rather than pay for a poor rejoin. |
| Adaptive risk-taker | Accept a bounded moderate-risk opportunity; never bypass fuel, stock, flags or physical entry. |

Six named preference weights are stored per driver: pit cost, tyre offset, traffic, extension, cover and uncertainty. Current defaults live in `RivalStyles.PROFILES`; persisted weights do not silently change when defaults are tuned. Profiles are associated with teams, not nationality. Player drivers are not assigned an autonomous rival policy.

The inherited review timer schedules discretionary evaluation at 12–14 simulated-second intervals, subject to the existing whole-field engineer cadence. The evaluator receives at most three existing forecaster candidates: current policy, stop at the next safe entry, or extend two laps. It rejects unavailable/high-risk alternatives, insufficient fuel and a box candidate without a legal driver-owned set or reachable pre-finish gate. Extension requires at least three laps remaining and 35 tread points. Feasible alternatives must lie within **four estimated seconds** of the fastest feasible candidate; a preference can contribute at most ±4 score units. These are transparent tuning hypotheses, not calibrated confidence bounds.

Context uses own-car estimates, public longitudinal gaps, public pit-entry history and the existing physical pit/rejoin forecast. A cover response can consider a recent opposing entry within the shorter of 40 simulated seconds or one reference lap. It cannot inspect an uncommitted player plan, future weather or a random stream. Lapped traffic and visual bridge crossings are not treated as same-place contests through 2D proximity.

A chosen stop enters the existing `queue_pit`/physical gate/service/exit path. Choosing extension withholds discretionary intervention through the two forecast entries; it is not a promise that the car must stop at a secret exact later lap. Re-evaluation happens after that hold. Approved windows, manual ownership, existing emergency authority, punctures, serious damage and adverse-weather recovery take precedence. Wet crossovers retain their existing fair information model; differentiated wet strategy and richer team strategy splitting are **not** claimed here.

## Information and evidence

Public UI shows tendency descriptions, observed compounds, measured lap times and actual pit entries. It never displays another team's exact remaining tread, fuel, setup, inventory or intended stop as known information. Rival timing rows show RUN/PIT/BOX/OUT/FIN rather than private tread percentages. Own-car inspection and commands remain unchanged. Legacy weekends preserve their earlier inspection presentation as well as their earlier model.

Private agent diagnostics retain the last 48 decisions, candidate estimates/scores, triggering context, selected set/gate and review counts. These support deterministic debugging. Public notices are emitted for actual entry/service events, not a rival's private accepted plan. The existing causal debrief filters strategic command detail to the player team; the added public field summary presents observed entries rather than hypothetical causal certainty. Raw local checkpoints and diagnostic exports remain developer-readable authoritative records, not encrypted multiplayer/anti-cheat boundaries.

## Checkpoint v10

Application version **0.11.0** and checkpoint schema **v10** are separate. v10 adds enabled status, profile identity, bounded configured weights, deferred review gate, review count and bounded private decision history. No new random stream is introduced. Validation checks driver identities, legal styles/weights, finite bounded numbers, chronology, candidate legality, set ownership and history size before replacing the active weekend.

Native **v1–v9** migration explicitly disables contextual rivals and creates no invented profile history. Their existing weather, practice, reliability, strategy, service and random-state semantics remain. A migrated v9 practice run retains its notebook and physical continuation. Old practice recipes explicitly request classic rivals for reproducibility. Browser prototype saves remain unsupported. UI-only unapplied drafts still survive navigation/refresh, not application restart.

## Disclosed scenarios

| Recipe | Initial state | Alternatives and limits |
|---|---|---|
| Faster car behind | Pinecrest, Formula, dry, calm, seed 7314, 12 laps. MER P3, MOR P7; Valenti follows Mercer with his existing higher skill. All fitted M1 sets start at **40% tread**. | Defend within existing rules, conserve, or compare a fresh-tyre stop. No stat boost, injected incident, forced overtake or winner. |
| Both cars in contention | Pinecrest, Formula, dry, calm, seed 2026, 16 laps. MER P2, MOR P4; all fitted M1 sets start at **50% tread**. | Compare shared-box timing and divergent approaches while retaining both cars' information. Initial grid advantage is disclosed. |

Other driver-owned stock is unchanged. The selected used M1 is explicitly retained through formation; movement continues consuming its real condition. These compressed, used-tyre starts expose decisions earlier, not a licensed sporting format. Neither recipe awards campaign money or immutable settlement. Retrying cannot duplicate an unimplemented reward.

The scenario suite runs two approaches per recipe: conserving both cars with manually owned pits, or an explicitly early MER stop while MOR conserves. Both are executable alternatives, not claimed optimal strategies. Report actual laps as well as position: a lapped finish must not be compared as an equal-distance total race time. Wider circuit/seed balance and whether either approach is satisfying remain open.

## Verification and measurements

The untouched base passed a fresh full local run: **1,869 checks / 79 native screenshots**. The same entry point is expanded, not replaced:

```sh
python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

New suites: `rival_styles_tests.gd`, `rival_scenario_runs.gd`, `rivals_ui_tests.gd` and `workspace_performance.gd`. The last verifies actual simulation-step work, not merely loop iterations on a paused simulation. Reports under `reports/` distinguish local checks, exact workloads and screenshots. CI retains all suites; its job budget increases from 15 to 25 minutes for the expanded complete-race and native benchmark work, with unchanged per-phase failure/error checks.

Focused development runs passed 49 rival domain checks, 34 complete-race checks (45,850 fixed steps) and 47 new native UI checks. The final clean run, exact tested revision/tree and matched before/after performance results are recorded in **[verification evidence](rivals-verification.md)** when complete. Focused runs are not substituted for that gate.

The paired domain fixture supplies the **same actual forecast** to all four profiles and obtains extend/box/extend/box. Separate contextual fixtures test expensive-stop refusal, uncertainty preference, public-stop-only evidence, flags, empty stock, fuel, independent ownership and puncture overrides. v10 JSON continuation and v9 classic migration are checked independently. These are controlled model fixtures, not proof of universal rival quality.

## Open gates

No human playtest, controller/screen-reader certification, 200% text support, broad hardware FPS guarantee, forecast calibration or multi-circuit balance study was performed. 100/115/130% native text at 1440×900 and 1100×720 plus a wider desktop layout are the tested targets. At the smallest enlarged-text size an open inspector still temporarily replaces the timing tower; Watch restores it. Long histories/inventories intentionally scroll. The three strategy summaries and fixed commit/cancel controls do not require that scroll.

Pressure, replay branches, once-only result handoff, campaign progression, itemized components and full sporting-rule expansion remain out of scope. See the [workspace specification](design/pitwall-workspace.md) for UI findings, capability locations and exploratory human-validation protocol.
