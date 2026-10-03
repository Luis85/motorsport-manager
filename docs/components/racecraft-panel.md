---
id: "racecraft-panel"
title: "Garage setup panel"
description: "Stages per-driver setup sliders/numeric fields and shows fitted-to-draft trade-offs alongside a separate live brake-bias action."
kind: "component"
surface: "advanced"
source: "scripts/ui/racecraft_panel.gd"
symbol: "RacecraftPanel"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Garage setup panel

Stages per-driver setup sliders/numeric fields and shows fitted-to-draft trade-offs alongside a separate live brake-bias action.

## Intent and purpose

Let an owned driver prepare mechanical setup changes as an explicit draft, compare their estimated effects and apply only where garage rules allow. Keep a separately authorized live brake-bias adjustment available during the race.

## User goals

- Stage synchronized slider/numeric setup values without losing edits on refresh or driver switch.
- Compare fitted values and draft corner/straight/traction effects.
- Apply or revert one driver’s draft; adjust live front bias when eligible.

## Used components

Profile-driven HSliders and SpinBoxes, fitted-to-draft delta Labels, Apply/Revert Buttons, separate live-bias field/action and effect/temperature summaries, built through [UI](ui.md). The host [WeekendView](weekend-view.md) injects `RaceViewQuery` and a command callback.

## Interactions

`configure(model, command)` reads the frozen setup profile before mounting. Field edits update `drafts[loaded_driver]` and `edited`; refresh loads a driver’s existing draft and refreshes fitted values only when unedited. `garage_allowed` requires an owned, running/non-retired car in briefing or race preparation, or qualifying in the garage. Apply dispatches `setup_all` with a copied draft; Revert copies current fitted setup. Draft effects hold current tyre/surface observations constant. The separate `brake_bias` command is enabled only for an owned live racing car on track. `has_user_edits` allows the host to guard leaving. Heat labels are management-model estimates.

## Links to other pages

- [Engineering pitwall](pitwall-workspace.md) — Routes and draft-leaving guard.
- [Race inspector page](race-inspector-page.md) — Hosts setup within task navigation.
- [Full analysis layout](race-analysis-workspace.md) — Expanded reading/editing view.
- [Four-wheel dashboard](racecraft-panel-wheel-dashboard.md) — Separate fitted-wheel condition view.
- [Practice run panel](practice-panel.md) — Independent measured-practice drafting.

## Source and integration

Implementation: [scripts/ui/racecraft_panel.gd](../../scripts/ui/racecraft_panel.gd) (`RacecraftPanel`, extends `VBoxContainer`).

Referenced by [scripts/ui/weekend.gd](../../scripts/ui/weekend.gd), [scripts/ui/weekend_support.gd](../../scripts/ui/weekend_support.gd).

## Interface

Primary presentation entry points:

- `configure(model: RaceViewQuery, command: Callable) -> void`
- `refresh() -> void`
- `apply_draft() -> void`
- `garage_allowed() -> bool`
- `refresh_status() -> void`
- `has_user_edits() -> bool`
- `revert() -> void`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
