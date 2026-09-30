# Technical and documentation debt — maintenance PR

Baseline: `main` at `66ab6f4e8e066f8abac649cd9ac3b98d42760a5c` (merged PR #24, 30 September 2026).

This is a bounded follow-up to the native Godot 0.19 architecture and the recently merged content-refactor work. Preserve the shipped Minimal pit wall, existing race and editor behavior, old-save contracts, deterministic fixtures, and the complete verification registry. No campaign gameplay or unrelated new mechanic belongs in this PR.

## Planned changes

1. Reconcile the current-state documentation and explicitly label retained older handoff records as historical. Replace stale port-status and feature-parity statements with a current capability inventory that distinguishes player-facing, retained diagnostic, external content, and not-yet-implemented campaign work.
2. Reduce debt in a focused production code path without changing sporting calculation, serialization, resource accounting, game inputs, or render behavior. Add focused regression coverage when extraction affects behavior.
3. Update contributor/documentation entry points so future contributors and AI agents use the current authoritative documents rather than historical summaries.
4. Run relevant focused checks and the source-pinned full GitHub Actions workflows. Distinguish passing automated checks from human playtesting and hardware-specific performance evidence.

## Constraints and acceptance

- Do not weaken sporting checkpoints, alter content/schema compatibility, or change RNG/arithmetic order to make a test pass.
- Avoid repo-wide formatting and unrelated refactors. Scope technical debt to tested, cohesive responsibilities.
- Maintain accurate source identity and results in the PR description. Do not treat an advisory-quality green workflow as zero debt.
- Keep this PR draft until its changed-source checks and applicable hosted gates pass.
