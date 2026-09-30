# Technical and documentation debt maintenance

Status: in progress on `chore/tech-doc-debt-maintenance`. Base: `main` at `66ab6f4e8e066f8abac649cd9ac3b98d42760a5c` (merged PR #24).

This branch began as focused technical/documentation maintenance. It now also contains bounded follow-up product foundations requested on the same PR: a read-only Minimal forecast surface, selectable Advanced presentation, and the deterministic campaign state/storage shell required before management rules. None changes race physics, sporting authority or the independently tested standalone weekend.

## Scoped work and acceptance

1. **Documentation authority.** Reconcile the current README, documentation index, content-refactor status, and outdated feature/port descriptions with merged PR #23/#24. Mark historical documents clearly, preserve links to their original release evidence, and name known unimplemented campaign functionality.
2. **Focused technical debt.** Select a cohesive extraction or cleanup in a high-change code path. Preserve public entry points, domain/UI ownership, deterministic sporting behavior, recorded commands, and old-save semantics. Avoid mechanical file splitting.
3. **Regression evidence.** Require the repository's registered six-shard Godot suite, generated content/schema verification, architecture checker, standalone export/smoke and the advisory quality diff on the final published source. Keep old sporting fixtures unchanged. Record any unavailable checks explicitly.
4. **Debt inventory.** Record remaining active legacy hotspots and validation limits, including lack of human gameplay/accessibility evidence and unsupported cross-host performance comparisons.

## Exclusions

No new race model, complete company-management campaign, content schema or mechanic provider; no altered race checkpoint format or scoring; no redesign of the retained Race Director/Engineering workspaces; no global formatting/renaming campaign. The campaign foundation adds no standings, finance, staff, projects, rival organizations or management UI. Making an existing interface selectable does not certify every advanced tool as intuitive, calibrated or accessibility-complete. Do not claim that historical PR test counts were rerun on a different source.

## Publication gate

Keep the PR in draft until the exact final commit has green required CI and its documentation reports are consistent. A green advisory-quality job is not a clean lint report. Human playtesting and same-hardware performance measurement remain separate product-validation work.

## Implemented in this maintenance pass

### Documentation

- Added `docs/current-state.md` as the authoritative post-PR24 capability/validation inventory, separating shipping interfaces from retained diagnostic tooling, implemented foundations and proposals.
- Promoted this authority in root and docs READMEs, corrected post-merge content inventory/acceptance claims, and labeled original `docs/port-status.md`, `docs/feature-parity.md` and `docs/race-weekend.md` as historical rather than current.
- Documented the canvas overlay extraction, campaign/weekend boundary, selectable interface and campaign state/storage foundation without rewriting historical implementation records as present-tense release claims.

### Technical debt

- Extracted UI-only surface sampling, live surface drawing, car/label painting and editor selection painting into `scripts/ui/track_canvas_overlays.gd`. `TrackCanvas` retains its public methods and its original cache invalidation/rebuild counter, live detached frame capture, view projection and all edit transactions.
- Kept `TrackCanvasOverlayRenderer` as a bounded host adapter so cache/lifecycle ownership remains visible while stateless painters stay independent of editor and race authority.
- The active `track_canvas.gd` source is reduced from **476 to 400 counted code lines**, exactly the repository's declared budget, without changing commands, sporting arithmetic, saved data or editor mutations.
- Extended the registered native `editor_gesture_tests` suite with direct sampling/cache checks. Existing rendered/click-through editor and complete-weekend suites remain mandatory; synthetic screenshots alone are not a human usability sign-off.

### P0 campaign/weekend integration boundary

- Added `CampaignWeekendManifest`, a strict immutable record binding campaign/season/event identity, departure/return slots, exact race event/model, frozen track/roster/resource/rules hashes and complete race-local → stable campaign person/team/car mappings.
- Added `CampaignWeekendSettlement`, which validates a factual `WeekendResult`, rejects sandbox or mismatching results, maps classification and returned resources to stable identities and stages one versioned receipt ledger.
- Reapplying the same manifest/result returns `already_settled` without mutating the ledger. A different valid result for the same campaign event returns an explicit conflict and requires a future correction workflow.
- The boundary intentionally awards no championship points, cash, XP, repair state, component diagnosis or calendar progression. Those remain responsibilities of an atomic campaign transaction.
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
- Added `CampaignCheckpoint`, binding replay-validated state to the exactly-once settlement ledger and optional active manifest. Cross-campaign receipts/manifests and active-already-settled events fail closed.
- Added `CampaignStorage`, reusing the existing temporary/backup/rollback JSON policy. Precise numeric decoding preserves integral slots/revisions; interrupted replacement retains the previous campaign; retry publishes the next revision.
- Kept the slice domain/storage-only: no campaign UI, automatic clock, standings, money, staff, engineering, rivals, rewards or weekend consequence application.
- Extended registered `weekend_launch_tests` through a focused contract helper covering identity/date validation, leap days, command non-mutation, energy/occupancy, replay determinism, history tamper detection, weak lifetime, exact JSON round-trip and atomic recovery.
- Added `docs/campaign/state-clock-storage.md` and updated the boundary/current-state documents and repository rules.

### P0/P1 closure and follow-up scope

All P0 and P1 debt items identified for the original maintenance sequence remain implemented. The selectable-interface and deterministic-campaign-shell milestones are explicit follow-up product requests built on existing composition/storage seams; neither reopens sporting authority. The next campaign milestone is the smallest versioned competition/economy settlement transaction over the new checkpoint, not broad management UI.

### Verification boundary

GitHub Actions executes independently for PR updates. Judge this branch **only by the checks attached to the exact final PR head**: six registered Godot shards and aggregate; content/schema/exported-runtime; runtime confidence; Linux/Windows packaged build/smoke; advisory quality comparison. A cancelled/superseded run on an earlier intermediate commit is not evidence about the final head. No local Godot runner is available in this maintenance execution environment. The PR description should record the exact final-source checks once completed.

## Deliberately remaining debt

- `scripts/domain/race_sim.gd` and retained `scripts/ui/weekend.gd` / `scripts/ui/pitwall_workspace.gd` remain above the source-size budget. Prioritize them when implementation actually touches those responsibilities; extracting their stateful sporting code without dedicated characterization would increase regression risk.
- Advisory findings are not a verified bug count, and moving a responsibility to its own source path can register as both resolved and new diagnostics. Review the full exact-head quality inventory and retain existing budgets.
- Championship/calendar rules, economy/ledger consequences, staff/contracts, engineering, rivals and campaign UI remain unimplemented. The state/clock/storage shell does not make a playable campaign.
- Human player testing of both interface modes, broad accessibility, same-machine performance comparison, and stronger clearance/collision diagnostics remain separate product/engineering work. Selectability does not turn every retained specialist workspace into a validated final UX.
