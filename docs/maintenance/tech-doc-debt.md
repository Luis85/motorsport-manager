# Technical and documentation debt maintenance

Status: in progress on `chore/tech-doc-debt-maintenance`. Base: `main` at `66ab6f4e8e066f8abac649cd9ac3b98d42760a5c` (merged PR #24).

This is a behavior-preserving maintenance branch, not a redesign, new gameplay feature, or new save/schema migration. The shipping interface remains Minimal; advanced developer workspaces remain diagnostic.

## Scoped work and acceptance

1. **Documentation authority.** Reconcile the current README, documentation index, content-refactor status, and outdated feature/port descriptions with merged PR #23/#24. Mark historical documents clearly, preserve links to their original release evidence, and name known unimplemented campaign functionality.
2. **Focused technical debt.** Select a cohesive extraction or cleanup in a high-change code path. Preserve public entry points, domain/UI ownership, deterministic sporting behavior, recorded commands, and old-save semantics. Avoid mechanical file splitting.
3. **Regression evidence.** Require the repository's registered six-shard Godot suite, generated content/schema verification, architecture checker, standalone export/smoke and the advisory quality diff on the final published source. Keep old sporting fixtures unchanged. Record any unavailable checks explicitly.
4. **Debt inventory.** Record remaining active legacy hotspots and validation limits, including lack of human gameplay/accessibility evidence and unsupported cross-host performance comparisons.

## Exclusions

No new race model, company-management campaign, content schema or mechanic provider; no altered checkpoint format or scoring; no reactivation of the retired advanced pit-wall navigation; no global formatting/renaming campaign. Do not claim that historical PR test counts were rerun on a different source.

## Publication gate

Keep the PR in draft until the exact final commit has green required CI and its documentation reports are consistent. A green advisory-quality job is not a clean lint report. Human playtesting and same-hardware performance measurement remain separate product-validation work.

## Implemented in this maintenance pass

### Documentation

- Added `docs/current-state.md` as the authoritative post-PR24 capability/validation inventory, separating shipping Minimal UI from retained diagnostic tooling and proposals.
- Promoted this authority in root and docs READMEs, corrected post-merge content inventory/acceptance claims, and labeled original `docs/port-status.md`, `docs/feature-parity.md` and `docs/race-weekend.md` as historical rather than current.
- Documented the canvas overlay extraction in the current architecture and editor guides. Historic implementation details are preserved, not rewritten as present-tense claims.

### Technical debt

- Extracted UI-only surface sampling, live surface drawing, car/label painting and editor selection painting into `scripts/ui/track_canvas_overlays.gd` (97 counted code lines at introduction). `TrackCanvas` retains its public methods and its original cache invalidation/rebuild counter, live detached frame capture, view projection and all edit transactions.
- The active `track_canvas.gd` source is reduced from **476 to 400 counted code lines**, exactly the repository's declared budget, without changing commands, sporting arithmetic, saved data or editor mutations.
- Extended the registered native `editor_gesture_tests` suite with direct sampling/cache checks. Existing rendered/click-through editor and complete-weekend suites remain mandatory; synthetic screenshots alone are not a human usability sign-off.

### Verification boundary

GitHub Actions executes independently for PR updates. Judge this branch **only by the checks attached to the exact final PR head**: six registered Godot shards and aggregate; content/schema/exported-runtime; runtime confidence; Linux/Windows packaged build/smoke; advisory quality comparison. A cancelled/superseded run on an earlier intermediate commit is not evidence about the final head. No local Godot runner is available in this maintenance execution environment. The PR description should record the exact final-source checks once completed.

## Deliberately remaining debt

- `scripts/domain/race_sim.gd` and historical `scripts/ui/weekend.gd` / `scripts/ui/pitwall_workspace.gd` remain above the source-size budget. Prioritize them when implementation actually touches those responsibilities; extracting their stateful sporting code without a dedicated characterization task would increase regression risk.
- Advisory findings are not a verified bug count, and moving a responsibility to its own source path can register as both resolved and new diagnostics. Review the full exact-head quality inventory and retain existing budgets.
- Campaign integration, strategy discoverability, human player testing, broad accessibility, same-machine performance comparison, and stronger clearance/collision diagnostics remain separate product/engineering work, not claimed fixed by this maintenance PR.
