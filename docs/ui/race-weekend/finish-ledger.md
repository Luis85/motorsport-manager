# Race Weekend finishing ledger

## Status and authority

**Native implementation and Linux automated/engineering visual acceptance are complete for the scoped finishing pass. Platform/manual release acceptance is partial.** These are separate dimensions, not an unqualified certification. The current code reuses the existing workspaces, drafts and command boundary. It does not implement a new race model or arbitrary future-command scheduler.

The acceptance contract is [finish-specification.md](finish-specification.md), with [player guide](player-guide.md), [visual review](finish-visual-acceptance.md) and [verification evidence](verification-finish.md). Generated reports live under `reports/`; exact final commit/tree/CI and source-archive hashes are recorded in the delivered publication receipt. That receipt is produced after committing, so this file does not invent its own future SHA.

## Reconciled publication history

| Reference | Meaning |
|---|---|
| `d5832348b750554e50487bc6e8bf8fe43e721689` / tree `34b9b2993e4776cc3c12c7bb63c71f7fcfb3e808` | Original handoff; hosted #262 / 36172477187 succeeded. |
| `d1a654d763659556ee219c5a639804e7f8ea6104` | Test-first action receipts and missing-sample foundation; hosted #264 succeeded. |
| `925bfaa0212c51753d1bbe77fcd58788cf35bede` | Observation, comparison and shared setup polish; hosted #266 succeeded. |
| `c0c6a9164030258ddb84cdf282e724bd636d5920` / tree `cc145c40d4ffbb307dbd40b6664f996d92113db7` | Recovered published physical-service/populated implementation. Hosted #268 / 36205488914 failed in compact UI after earlier suites saved 130% text settings. |
| Finishing continuation | Reproduced that order dependency, isolated each suite's user data, retained every compact assertion, expanded the native matrix, fixed qualifying text semantics/fit, and completed scrolled analytical evidence and handover. |

PR #12 was open/unmerged at recovery; no comments or reviews were returned. Source was restored from the exact hosted artifact, and its Git tree matched the live head. The older handoff archive was kept as a reference, not overlaid onto newer work. Direct Git transport was unavailable; normal Git objects and non-force branch updates use the connected Git API. No other worktree was reset and no publication workflow was added.

## Gap register: separate evidence dimensions

In the native column, short suite names resolve to `tests/` and the detailed verification report. “Visual” is an engineering inspection of actual renders, not a human usability study. All rows share the unverified platform gates below.

| Gap | Package | Implementation | Native regression evidence | Visual evidence | Platform/manual evidence |
|---|---|---|---|---|---|
| G01 | WP01 | Implemented; correlate fuel, release and pit receipts; explicit terminal/reopen/duplicate guards | finish 47; completion 68; repair 89 | Receipt and confirmation captures; native stale/driver boundaries | Open — P01–P05 |
| G02 | WP03 | Implemented; full actual identities, separate intent/owner and limiting resources | observation 19; populated 655 | Wide and compact names, dot/emblem identity and intent hierarchy | Open — P01–P05 |
| G03 | WP03 | Implemented; stable severity/count slots and secondary-issue selection | observation 19; states 40 | Visible critical/count labels; synthetic multi-issue boundary identified | Open — P01–P05 |
| G04 | WP04 | Implemented; best valid lap, public benchmark and visible new-release elapsed boundary | observation 19; finish 47; populated 655 | Compact hot-lap text red/green; no active-lap countdown implied | Open — P01–P05 |
| G05 | WP05 | Implemented; shared programmes/drafts, terminal evidence and measured costs | practice; completion; guide; populated; details | Both completed/recalled physical programmes, including below-fold costs | Open — P01–P05 |
| G06 | WP06 | Implemented; candidate distance schedules and read-only option/stop inspection | analysis 18; strategy UI; populated | Supplied stint bars/ruler/cursor and existing fixed approval/Box | Open — P01–P05 |
| G07 | WP07 | Implemented; observed sectors, public outlook, independent cases and alternatives | weather; populated; details | Physical wet scenario; scrolled cases and gate-cost alternatives | Open — P01–P05 |
| G08 | WP08 | Implemented; units/domains/ranges/cursors and exact own-driver comparison | finish; analysis; states; populated | Four real recorded channels and distinguishable paired traces | Open — P01–P05 |
| G09 | WP08 | Implemented; null/category alignment and isolated finite points preserved | finish red/green; analysis pixel regression | N/A/missing-middle fixtures; no gap interpolation | Open — P01–P05 |
| G10 | WP09 | Implemented; finite fitted/planned identity, limiting wheel, five-axis draft deltas | analysis; living racecraft; completion; populated | Real stock/wheels/setup, fixed Apply/Revert, named discard safeguard | Open — P01–P05 |
| G11 | WP10 | Implemented; actual approach/entry/queue/service/exit and correlated visits | execution 31; recovery; states; populated; details | Both physical service cards; whole-car timer, not per-wheel animation | Open — P01–P05 |
| G12 | WP10 | Implemented; accepted windows and active overrides on a shared distance axis | execution; states; populated | Native timeline selection is read-only; existing plans remain the editor | Open — P01–P05 |
| G13 | WP11 | Implemented/preserved; bounded stable radio, frozen history and retained UI feedback | states; repair; populated; soak | Live/history/pagination and explicit retention; long evidence scrolls | Open — P01–P05 |
| G14 | WP12 | Implemented; real lap/run IDs, compatible comparison, fitted stints and visits | analysis; execution; populated; details; replay/notebook | Physical classification, sectors, stints, visits and decision evidence | Open — P01–P05 |
| G15 | WP13 | Implemented/preserved; actual guide targets, phase approvals and safe draft exits | guide 300; completion; populated; replay/notebook UI | Native Next/Back/Dismiss/resume and actual approval lineage | Open — P01–P05 |
| G16 | WP14 | Linux native matrix verified; protected commands and modal/focus continuity | populated 655; details; guide; completion; compact; states | A–C all screens; primary scale cross-product; 1920 wide; focused resize | Open — P01–P05 |
| G17 | WP15 | Runtime safeguards verified; release-platform gate remains partial | full runner; 1800-second native soak: 606 checks; retained performance suites | Local llvmpipe observations only; see verification-finish.md | Open — P01–P05 |
| G18 | WP02/14 | Engineering visual acceptance completed with explicit concept adaptations | states fixture; populated 149 captures; details 15 captures | Six-dimension SC00–SC14 review; baseline/concept/native comparison bundle | Open — P01–P05 |

**Platform/manual evidence, separately:** all G01–G18 rows remain unverified on physical controller hardware, Windows assistive technology/DPI/export launch and broad hardware profiles. G17 is therefore explicitly **partial at the release-platform level**. No synthetic event, screenshot or Linux pass closes those gates. Human comprehension/playtesting also remains outside this engineering acceptance.

## WP00–WP15 execution closure

WP00 reconciled the live PR and recovered/imported the exact source. WP01 repaired action-specific terminal receipts before further styling. WP02 established semantic production style states and the six-dimension visual review. WP03–WP04 refined the real overview, attention queue and qualifying context. WP05–WP09 completed populated practice, strategy, weather, recorded charts, finite tyres and shared setup. WP10–WP12 integrated read-only accepted intentions, actual physical service, recoverable communication and measured result evidence. WP13 traversed the actual guide and approval routes. WP14 exercised populated A–C, all primary text scales, wide profiles, native input, clipping ancestors and focus-preserving resize. WP15 freezes source, runs the retained full runner, records the extended native soak and packages exact-source evidence; its Windows/export/hardware portion remains explicitly blocked.

## Test-first findings and preserved correct behavior

- The initial lifecycle/chart red run had 25 checks and 11 assertion failures: seven action-terminal/correlation failures and four missing-sample/category failures. Repeated Enter did not reproduce a duplicate in the composed baseline path; it was retained as a passing regression with a submit-stage guard, not falsely reported as a reproduced defect.
- Subsequent native findings covered full-name fit, secondary issues, isolated chart points, practice duration versus absolute crossing time, retired pit approaches, unequal stint selection and terminal practice wording. UI-only repairs preserve the original records.
- Hosted #268's four compact failures reproduced after a guide wrote 130% preferences into shared test user data. The same compact suite passed clean. Per-suite application names and XDG/APPDATA directories now prevent contamination without deleting earlier evidence or weakening assertions. A real Godot user-directory regression supplements five runner tests.
- Final visual review found a second qualifying line truncated at 1100×720/130%, and a new-release estimate that could be mistaken for the active hot-lap countdown. Four new red assertions led to a compact, elapsed-session, “Next run” formulation; all 19 observation checks pass.
- Header/timing extraction, notebook/replay/result receipts, original/sandbox authority, inventory persistence and physical routing were preserved and regression-tested. They are not claimed as newly built missing systems.

## Source boundaries

A per-file comparison against the handoff source found **94 production domain/service files byte-identical**. There are no new save-schema, RNG, sporting, tyre-identity, pit-routing or balance edits. Workflow permissions remain read-only. The final source manifest and archive/tree checks establish the actual delivered tree rather than relying on a screenshot or an old commit message.
