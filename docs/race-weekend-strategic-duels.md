# Strategic Duels — 0.15.0

## Scope and authority

This increment implements the approved **Strategic Duels — Two Cars, Competing Plans** direction in the existing native game. It builds on merged PR #12: `79a944a4c0031a08e1cbb23ec5109b772b149b99`, source tree `e74353c508e942ae62a4dc2abf0abeb927934c52`. Implementation proceeds on `feat/race-weekend-strategic-duels`, PR #13. The first domain commit is `586de0aed1e152b3572a3eea22f8faacda393402`.

Design basis: supplied Race Weekend GDD v1.0, especially chapters 8, 12, 16, 20, 23 and 25. This deepens RW-02/04/06/07/08, with RW-16 interaction coverage. It does not declare every GDD package or the human-playtest gate complete. The existing engagement research remains relevant; no new user research was conducted during implementation.

## Play

Start a new **Grand Prix Weekend**, or choose **Scenario challenges → Strategic duels**. New normal weekends enable the new tactical/rival model. Continue Weekend and older recipes retain their original model; they are not silently upgraded to different race behavior.

Open **Strategy → Tactics**, **Find → Strategy / Tactics**, or either driver's **More → Tactical plan**. Select MER or MOR explicitly, choose a named opposing driver, a real replacement set, and a bounded window. Compare before approving. The default is **Recommend only**. Choose **Delegate this pit tactic only** to authorize execution.

An undercut attempts the earlier authorized stop. An extension withholds that discretionary call for one or two entry opportunities from the window start. The window must leave room for the extension and remain before the finish. The tactic is not a guaranteed pass or an optimal strategy.

**Both cars** compares keeping both ordinary plans with each direction of an early/extended split. It uses the ordinary forecaster's suggested replacement sets, not unapplied tactical drafts, and never approves either driver. Estimated summed time and shared-box exposure are not team points or a predicted classification. Approve the actual driver-specific plans separately.

**Plan evidence** retains intentions, assumptions and subsequent observations. The existing race reading, driver cards and decision debrief also expose relevant tactical state. The guide includes a resumable tactical step. Existing replay bookmarks, separate sandbox experiments and opt-in notebook remain available; an alternate run is never presented as the original or awarded campaign rewards.

## Ownership and physical execution

One active tactic per driver. Approval pins the driver, target, tyre set, parameters, comparison key/time, tactical revision and underlying plan revision. Invalid or stale approval changes nothing. An active tactic must be ended or reach review before replacement.

Recommendation only does not borrow any channel, issue a stop or prevent existing authorized work. A subsequent manual stop is a superseding command, not proof that the recommendation was executed automatically.

Delegated tactics temporarily own **pit timing only**. Existing pace, engine, racecraft and qualifying owners remain. Already-delegated resource channels may conserve toward the approved reserves; manual values and temporary overrides stay respected. There is no automatic push, extra fuel, refreshed tyre or free performance bonus.

The order of responsibility is: accepted physical commitments and explicit superseding commands; existing safety/weather/recovery authority; the applicable bounded dry tactic; then the previous ordinary pit policy. A dry mandate cannot grant previously absent emergency consent. It returns the actual previous pit owner before asking existing recovery logic to act.

The new review runs at a bounded simulated-time cadence. It checks reachable gates, stock, resource floor, fuel projection, flag restrictions, observed target entry, rejoin traffic and own-team queue exposure. It never postpones beyond the approved window. A failed condition produces review with a reason and returns prior pit ownership. Silence is not new permission.

The physical lifecycle is **approved → preparing → ordered → executing → evaluating → completed**, with explicit review and abandonment paths. Acceptance is not entry; entry is not exit; temporary pit-cycle positions are not the result. Ending a tactic preserves an already accepted pit transaction. Cancel that stop through the ordinary pit controls while cancellation remains legal.

A tactic replaces only the next discretionary stop, not the rest of an approved strategy. A successful physical replacement consumes that one window once, including when a different legal set is chosen. Later approved stints remain. Explicit manual pit/ownership/ordinary-plan changes supersede the tactic without restoring an obsolete owner over the new choice.

## Rival behavior and estimates

The new model refines the existing four contextual profiles, rather than adding a second strategist or new speed modifiers. A credible public entry can trigger a cover when fresh-tyre benefit exceeds modeled warm-up/traffic cost. Otherwise an available extension can be preferable. Own-team accepted service can favor a split response rather than discretionary double-stacking. These choices stay within the existing legal, near-best candidate shortlist; flag, resource, stock and physical-entry constraints remain.

Inputs are own-team information, public race observations and the existing forecaster's permitted snapshot. Opponent uncommitted plans, exact fuel/condition and authoritative future weather are excluded. Private diagnostic scores do not become public radio; physical entries and observed outcomes do.

The comparison retains current, earlier-stop and extended candidates. Conditional rival-response cases explain covering one lap later versus waiting two laps. A numerical cycle margin is shown only with a comparable observed non-pit race-lap sample. It explicitly assumes the current gap survives to entry, continued observed rival pace, one stop each and equal net stop loss. The rival's actual future plan, fresh-set condition and future traffic remain unknown. Without suitable evidence, only qualitative cases are shown.

The remaining-time forecast still uses a coarse warm-up/traffic model, fixed current modes/water and uncalibrated ranges. It is not a probability, guaranteed position, or full response tree. No live tyre, fuel, physics or service coefficients were changed merely to make one scenario succeed.

## Persistence and bounded evidence

New-model weekends use native checkpoint **v11**, tactical state v1 and replay model **`race-weekend-0.15-duels-v1`**. Session/replay, result and notebook envelopes retain their existing versions, with validated embedded model/rules metadata. Known previous-model v10 replay continues under `race-weekend-0.12-v1`; v1–v9 raw saves retain the existing legacy migration path. Older saves acquire no invented tactical history.

Validation checks complete records, booleans, integral identities, set ownership, chronology, bounds, phase/entry evidence, borrowed pit ownership and matching rules metadata before exposing restored state. JSON numeric normalization is explicit. Original continuation requires matching engine/model; separate sandbox lineage and save slots remain intact.

Each driver retains the active record and eight previous plans. A plan keeps up to twenty detailed events and discloses truncation; the existing bounded race journal remains available. Approval-time estimates are kept with the record. Relative position after both observed exits is an outcome, not proof of causation. Different stop counts or an unfinished comparative cycle are reported as inconclusive.

## Native interaction contract

Drafts belong to a driver and survive navigation/refresh. They remain visibly unapplied and participate in the existing exit safeguard. Compare freezes readable text and moves focus to its heading. Page Up/Down and Home/End read long evidence. Comparison, End plan and Approve remain outside the scrolling form. Escape closes evidence and restores its invoker.

The circuit, both driver cards and player-owned time controls remain. At 1100×720 and enlarged text the form intentionally scrolls; Expand and the existing full workspaces remain available. Opening a reading does not pause. No content is claimed to require a new browser, prototype or renderer.

## Four disclosed dry exercises

| Exercise | Geometry / format / seed | Initial fitted tread | Question |
|---|---|---:|---|
| An earlier route past the rival | Pinecrest / 24 laps / 7314 | 48% | Earlier stop or preserve the tyre option? |
| Track position has a price | Monaco / 12 laps / 2026 | 85% | Is the stop worth surrendering track position? |
| Two opportunities, one pit box | Pinecrest / 16 laps / 4281 | 42% | Similar windows or complementary approaches? |
| Fresh tyres, little distance | Monza / 6 laps / 942 | 45% | Can a short-race stop repay its cost? |

All twelve cars start on disclosed used M1 sets; other stock is unchanged. These are untimed preparation grids, not fabricated qualifying results or fictional mid-race histories. Practice/qualifying are explicitly skipped for the exercises. Formation and lights remain physical and approved separately. Incidents are calm, player pits initially manual, no winner is forced, and no campaign reward is awarded. Normal weekends still support the full session journey.

## Experiments and acceptance boundaries

Development runs exercised twelve complete physical races: four recipes × retain/early/extend. All terminated with valid final checkpoint, result and notebook evidence. A separate legacy-policy diagnostic used matching declared grids/resources and ordinary stop windows. Its presence does not retroactively change an old recording's rules.

| Exercise | MER retains | MER early stop | MER extends |
|---|---|---|---|
| Earlier route, 24 laps | P11, 18 laps | P4, 24 laps | P8, 23 laps |
| Track position, 12 laps | P7, 12 laps | P11, 12 laps | P11, 12 laps |
| Two opportunities, 16 laps | P11, 14 laps | P2, 16 laps | P9, 15 laps |
| Short final-stint exercise | P10, 6 laps | P11, 6 laps | P12, 6 laps |

These are observed development-fixture outcomes, not guaranteed shipped results. Both drivers used explicit conserve/save modes; the matrix deliberately disabled optional traffic/rival-first contingencies and selected low diagnostic reserve bounds. Moreau retained his original tyres in these particular branches. Separate domain tests execute complementary tactics for both drivers together. The matrix therefore does not establish that two-car optimization is solved. A lapped finish is not comparable to a full-distance elapsed time. In the short exercise, an earlier stop slightly reduced Mercer's own elapsed time while worsening his place because the surrounding race also changed.

No universal strategy was inferred from this small matrix. Early stopping and retaining track position have contrasting useful contexts, but extension was not the best tested approach in these four cases. Finding robust extension-favorable contexts across more seeds remains an explicit balance gate. No coefficients were arbitrarily adjusted to manufacture that gate's success.

### Reproducible verification

```sh
LP_NUM_THREADS=2 python3 scripts/verify.py --godot /path/to/Godot_v4.7.2-stable_linux.x86_64
```

All prior suites remain. The new domain, contract, full-race and native UI suites are added, not substituted. The twelve-race phase has a 1500-second timeout; overall CI budget rises from 40 to 60 minutes to retain the full workload. Error detection, isolated user data, independent push/PR runs and evidence artifacts remain.

Focused development evidence: **91 domain checks**, **31 contract checks**, **149 complete-race checks**, and **73 native checks / nine captures**. The native profiles are 1440×900 and 1100×720 at 100%, 115% and 130% text. Some boundary tests deliberately supply synthetic public-entry or candidate-cost fixtures; actual formation, orders, service, fitting, exits, save/load and replay are tested separately. These counts describe those focused runs, not a completed final-head CI claim. Consult PR #13 and that run's `reports/verification.json` for the exact source and final combined result. Do not sum duplicate local/hosted runs.

The unchanged baseline passed a separate headless-only run; an earlier development source also received a full regression run. Neither should be relabeled as the final source. Testing used Godot 4.7.2 Standard on Linux, Xvfb and software GL for native checks. Matrix wall times under different shared load are not a matched performance comparison or FPS guarantee.

Still open: human comprehension, newcomer/experienced-player dry-race enjoyment, wider strategy and forecast calibration, full team-optimization experiments, Windows/exported launch and actual DPI, physical controllers, assistive-technology sessions and broad hardware/input-latency validation. The four engineering packages are implemented at the bounded scope above; their human-validation and broad-balance gates are not claimed complete.
