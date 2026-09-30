# Technical and documentation debt maintenance

Status: in progress on `chore/tech-doc-debt-maintenance`. Base: `main` at `66ab6f4e8e066f8abac649cd9ac3b98d42760a5c` (merged PR #24).

This branch began as focused technical/documentation maintenance. It now also contains bounded follow-up product foundations requested on the same PR: a read-only Minimal forecast surface, selectable Advanced presentation, deterministic campaign state/storage, an atomic weekend consequence transaction, and versioned series/season authority. None changes race physics, sporting authority or the independently tested standalone weekend.

## Scoped work and acceptance

1. **Documentation authority.** Reconcile the current README, documentation index, content-refactor status, and outdated feature/port descriptions with merged PR #23/#24. Mark historical documents clearly, preserve links to their original release evidence, and name known unimplemented campaign functionality.
2. **Focused technical debt.** Select a cohesive extraction or cleanup in a high-change code path. Preserve public entry points, domain/UI ownership, deterministic sporting behavior, recorded commands, and old-save semantics. Avoid mechanical file splitting.
3. **Regression evidence.** Require the repository's registered six-shard Godot suite, generated content/schema verification, architecture checker, standalone export/smoke and the advisory quality diff on the final published source. Keep old sporting fixtures unchanged. Record any unavailable checks explicitly.
4. **Debt inventory.** Record remaining active legacy hotspots and validation limits, including lack of human gameplay/accessibility evidence and unsupported cross-host performance comparisons.

## Exclusions

No new race model, complete company-management campaign, content schema or mechanic provider; no altered race checkpoint format or race scoring; no redesign of the retained Race Director/Engineering workspaces; no global formatting/renaming campaign. The campaign work adds deterministic integration and sporting-domain foundations, not commitments/forecast finance, staff/projects/rivals simulation or management UI. Making an existing interface selectable does not certify every advanced tool as intuitive, calibrated or accessibility-complete. Do not claim that historical PR test counts were rerun on a different source.

## Publication gate

Keep the PR in draft until the exact final commit has green required CI and its documentation reports are consistent. A green advisory-quality job is not a clean lint report. Human playtesting and same-hardware performance measurement remain separate product-validation work.

## Implemented in this maintenance pass

### Documentation

- Added `docs/current-state.md` as the authoritative post-PR24 capability/validation inventory, separating shipping interfaces from retained diagnostic tooling, implemented foundations and proposals.
- Promoted this authority in root and docs READMEs, corrected post-merge content inventory/acceptance claims, and labeled original `docs/port-status.md`, `docs/feature-parity.md` and `docs/race-weekend.md` as historical rather than current.
- Documented the canvas overlay extraction, campaign/weekend boundary, selectable interface, campaign state/storage, atomic consequence transaction and season lifecycle without rewriting historical implementation records as present-tense release claims.

### Technical debt

- Extracted UI-only surface sampling, live surface drawing, car/label painting and editor selection painting into `scripts/ui/track_canvas_overlays.gd`. `TrackCanvas` retains its public methods and its original cache invalidation/rebuild counter, live detached frame capture, view projection and all edit transactions.
- Kept `TrackCanvasOverlayRenderer` as a bounded host adapter so cache/lifecycle ownership remains visible while stateless painters stay independent of editor and race authority.
- The active `track_canvas.gd` source is reduced from **476 to 400 counted code lines**, exactly the repository's declared budget, without changing commands, sporting arithmetic, saved data or editor mutations.
- Extended the registered native `editor_gesture_tests` suite with direct sampling/cache checks. Existing rendered/click-through editor and complete-weekend suites remain mandatory; synthetic screenshots alone are not a human usability sign-off.

### P0 campaign/weekend integration boundary

- Added `CampaignWeekendManifest`, a strict immutable record binding campaign/season/event identity, departure/return slots, exact race event/model, frozen track/roster/resource/rules hashes and complete race-local → stable campaign person/team/car mappings.
- Added `CampaignWeekendSettlement`, which validates a factual `WeekendResult`, rejects sandbox or mismatching results, maps classification and returned resources to stable identities and stages one versioned receipt ledger.
- Reapplying the same manifest/result returns `already_settled` without mutating the ledger. A different valid result for the same campaign event returns an explicit conflict and requires a future correction workflow.
- The receipt boundary itself awards no championship points, cash, XP, repair state, component diagnosis or calendar progression. Those responsibilities now enter through the separate explicit transaction below.
- Extended registered `weekend_launch_tests` coverage for manifest detachment/integrity, stable identity projection, exact-once settlement, correction conflict and absence of invented rewards. Full physical finishing remains covered by existing full-weekend suites.
- Added `docs/campaign/weekend-boundary.md` as the implementation and persistence contract.

### P1 Minimal strategy discoverability

- Added one visible **Strategy** action to the shipping Minimal toolbar for a selected running managed driver during the race. It opens a bounded read-only comparison of the current plan, next safe-entry stop and two-lap extension when those options exist.
- Reused the existing `RaceForecaster` through `MinimalWeekendQuery.strategy_comparison()`. The application query enforces player/race/running scope and returns a detached copy; the popup receives no live simulation, inventory, command adapter or scheduler reference.
- Forecast work is strictly on demand: opening the popup or pressing **Refresh estimate** computes a snapshot. The ordinary 5 Hz Minimal refresh loop does not forecast. Opening, refreshing and closing issue no commands, change no ownership, pause/resume state or speed, and consume no gameplay randomness.
- Kept `workspace.gd` within the 400-code-line source budget by isolating stable popup rendering in `strategy_comparison.gd`. The popup has no Apply/Approve path and suppresses race shortcuts while focused.
- Extended registered `minimal_tests` and native `minimal_ui_tests` with full-snapshot/RNG/command/playback invariants, detached-result checks, explicit-refresh behavior, keyboard-focus isolation and 1440×900 / 1100×720 at 130% layout coverage.
- Updated the README, current-state authority and Minimal contract so they no longer claim that all forecast surfaces are absent.

### Player-selectable Minimal and Advanced interfaces

- Added a staged **Race interface** setting with **Minimal** and **Advanced** choices. Minimal remains the default. Advanced can begin in the approachable Race Director surface or directly in Engineering.
- Reused the existing `pitwall_layout` composition seam rather than introducing another router or simulation. The setting applies when a weekend screen next opens and mounts the selected presentation over the same authoritative weekend, recording, commands and application-owned scheduler.
- Restored recognized persisted `minimal`, `director` and `engineering` values. The public `advanced` alias migrates deterministically to `director`; unsupported values fall back to Minimal. Explicit CLI overrides remain available for development and verification.
- Kept racing-line presentation disabled while Minimal is staged, while retaining its saved value for Advanced. Settings preview remains non-mutating until Apply; persistence failures retain the draft through the existing recovery behavior.
- Extended registered native `architecture_ui_tests` to exercise staged selection, real settings storage, legacy/public migration, both advanced starts and complete weekend/RNG fingerprint preservation while mounting each interface.
- Updated the README, current-state inventory and Minimal contract to describe Advanced as optional player-facing presentation rather than a hidden diagnostic-only route.

### P0 deterministic campaign state, clock and checkpoint

- Added `CampaignIdentity` for bounded stable campaign keys and `CampaignClock` for a pure Gregorian calendar expressed as dated fifteen-minute slots. Batch and individual slot advances are equivalent; neither OS time nor race ticks are inputs.
- Added `CampaignState` with campaign/organization/principal identity, six-point daily intervention energy, non-overlapping principal reservations, accepted-command revision/history and exact replay-based restoration.
- Added the weak `CampaignCommands` application boundary. Rejected, malformed, duplicate, overlapping, unaffordable and overflow commands leave the complete snapshot unchanged.
- Added `CampaignCheckpoint`, initially binding replay-validated state to the exactly-once settlement ledger and optional active manifest. Cross-campaign receipts/manifests and active-already-settled events fail closed.
- Added `CampaignStorage`, reusing the existing temporary/backup/rollback JSON policy. Precise numeric decoding preserves integral slots/revisions; interrupted replacement retains the previous campaign; retry publishes the next revision.
- Extended registered `weekend_launch_tests` through focused contract helpers covering identity/date validation, leap days, command non-mutation, energy/occupancy, replay determinism, history tamper detection, weak lifetime, exact JSON round-trip and atomic recovery.
- Added `docs/campaign/state-clock-storage.md` and updated the boundary/current-state documents and repository rules.

### P0 atomic weekend consequence transaction

- Added `CampaignWeekendPolicy`, a strict per-event input containing explicit points eligibility, ordered scoring/bonus tables, organization account identity, event cost and participation amount. Race facts do not silently invent these campaign rules.
- Added `CampaignCompetition`, which stores immutable event awards and rebuilds driver/team points, starts, wins and best positions from event history.
- Added `CampaignEconomy`, an integer-minor-unit cash ledger with dated, categorized, source-digested event entry, participation and position-bonus postings. Cash must reconcile to opening balance plus postings; orphaned or multiply indexed entries fail validation.
- Added `CampaignInventory`, preserving exact returned car/tyre values by stable identity and dated event. It deliberately does not infer consumed resources, itemized failures, repairs or replacement costs.
- Added `CampaignWeekendTransaction`, which validates the exact active manifest, stages the factual receipt and all three projections on detached values, advances time from the frozen departure slot to return exactly once, clears the active manifest, and returns one version-two checkpoint candidate. Any failed sub-step returns the unchanged caller checkpoint.
- Upgraded `CampaignCheckpoint` to version 2 and made version-one migration deterministic. All consequence projections must contain the same event set and agree with the receipt/result digest; legacy receipts can remain projection-free until explicitly completed.
- Extended `CampaignStorage` with complete-checkpoint publication while preserving temporary-file, backup and rollback behavior.
- Extended the registered campaign contracts with exact no-op reapplication, result/policy conflict, invalid-inventory rollback, departure-time drift rejection, dated financial reconciliation, explicit points eligibility, persistence and v1 migration checks.
- Added `docs/campaign/weekend-consequence-transaction.md`.

### P0 series calendar, entries, standings rules and season lifecycle

- Upgraded `CampaignCompetition` to version 2 while retaining validation and exact duplicate no-op behavior for version-one sporting history. Non-empty legacy history stays read-only rather than receiving invented calendars or entrants.
- Added immutable `CampaignSeriesRules` for cars per entrant, entrant/event bounds, frozen points table, countback depth and an explicit `final_only` classification policy.
- Added versioned `CampaignSeason` records containing an ordered non-overlapping calendar, frozen event revision/track/rules hashes, persistent entry records, derived standings and lifecycle state.
- Added submitted/accepted/rejected/withdrawn entry handling. Live entries cannot repeat entrant, team, person or car identities; undecided submissions and insufficient accepted fields block entry closure.
- Bound every newly settled weekend to the next scheduled active-season event. Dates, revision, track/rules hashes and the complete accepted field must agree with the immutable manifest before any consequence stages.
- Added prefix-only event resolution, explicit cancellation without sporting awards, final-classification gating and the controlled `planning → entries_open → preseason → active → final_classification → settled → contract_transition → completed` path.
- Driver and team rankings rebuild from immutable event awards using points then successive finish-count countback. Exact unresolved ties receive a shared position; stable identity controls serialization order only.
- Split calendar, entry registry and standings projection into bounded domain helpers while retaining the `CampaignSeason` API; all new source and test files remain within repository line budgets.
- Registered a four-round deterministic contract covering invalid transitions, identity conflicts, out-of-order results, frozen scoring, shared ties, countback, tamper detection, finalization, cancellation and safe next-season creation. The atomic transaction fixture now settles through a real registered season.
- Added `docs/campaign/season-lifecycle.md`.

### P0/P1 closure and follow-up scope

All P0 and P1 debt items identified for the original maintenance sequence remain implemented. The selectable-interface and campaign milestones are explicit follow-up product requests built on existing composition/storage seams; none reopens sporting authority. The next campaign dependency is TM-04: future commitments, due dates and minimum-cash forecasting over the factual ledger.

### Verification boundary

GitHub Actions executes independently for PR updates. Judge this branch **only by the checks attached to the exact final PR head**: six registered Godot shards and aggregate; content/schema/exported-runtime; runtime confidence; Linux/Windows packaged build/smoke; advisory quality comparison. A cancelled/superseded run on an earlier intermediate commit is not evidence about the final head. No local Godot runner is available in this maintenance execution environment. The PR description should record the exact final-source checks once completed.

## Deliberately remaining debt

- `scripts/domain/race_sim.gd` and retained `scripts/ui/weekend.gd` / `scripts/ui/pitwall_workspace.gd` remain above the source-size budget. Prioritize them when implementation actually touches those responsibilities; extracting their stateful sporting code without dedicated characterization would increase regression risk.
- Advisory findings are not a verified bug count, and moving a responsibility to its own source path can register as both resolved and new diagnostics. Review the full exact-head quality inventory and retain existing budgets.
- Provisional classifications and correction deltas; commitments and forecast finance; staff/contracts; engineering; rivals; season prizes/promotion; and campaign UI remain unimplemented. The calendar/consequence foundations do not make a playable campaign or establish balanced rewards.
- Human player testing of both interface modes, broad accessibility, same-machine performance comparison, and stronger clearance/collision diagnostics remain separate product/engineering work. Selectability does not turn every retained specialist workspace into a validated final UX.
