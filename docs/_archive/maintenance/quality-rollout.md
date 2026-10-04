# Quality rollout and recorded closure

> **Historical record.** Scope, version claims and validation below belong to the
> named milestone. See [current project status](../../reference/current-state.md)
> and [the documentation index](../../README.md) for current behavior.


## Initial debt and rollout

The recovered UI repair tree `7e5cf5a5fb4af99a2b9fd76df637454095b45f1a`
measured 265 source/test files, with these four size warnings:

| File | Code lines | Budget |
|---|---:|---:|
| `scripts/domain/race_sim.gd` | 752 | 400 |
| `scripts/ui/weekend.gd` | 619 | 400 |
| `scripts/ui/track_canvas.gd` | 593 | 400 |
| `scripts/ui/pitwall_workspace.gd` | 420 | 400 |

This is a dated review inventory, **not** a suppression baseline. Current Actions
reports always rescan the complete inventory, so new violations remain visible.
Prioritize changed hotspots and cohesive ownership splits over mechanical file
splitting or a repository-wide formatting commit. The scene shell and editor
controller are below the source budget after extracting presentation builders.

## Complete quality closure after PR #28

The comprehensive PR #29 pass remediated the recorded PR #28 baseline of **5,075 findings across 507 code files**, including lint, check-only formatting, complexity and physical-line budgets. It extracted cohesive validators, command handlers, read models, screen composition and test contracts while retaining APIs, save migration, sporting assertions, limits and the complete registered suite. Repository-wide formatting was explicitly authorized for this pass; it is not the default scope for an unrelated feature change.

A strict local scan of `0adb331ba47dadf4284f47004c7d28de2927166b` completed every configured tool and reported **611 code files, zero findings, `analysis_complete: true`**. Counts describe that source, including new collaborators; they are not a baseline exclusion or future guarantee. [The review ledger](data-driven-code-review.md) records compatibility and malformed-input fixes as well as the remaining product-validation work. Exact integrated CI evidence belongs to the corresponding PR head.

The later PR #29 source `2f9251d2cbfaa5893ceda1312d4f5da308b3235b` retains the same complete strict result: 611 files and zero findings. Hosted Advisory code quality is green; final functional/export acceptance remains separate.
