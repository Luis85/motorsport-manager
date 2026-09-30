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
