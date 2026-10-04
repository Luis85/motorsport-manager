---
id: "advanced-tyres-page"
title: "Advanced Tyres page"
description: "Groups finite stock selection, fitted/ planned-set details, wheel condition, physical stop scheduling and stint evidence."
kind: "page"
surface: "advanced"
source: "scripts/ui/weekend_inspector_builder.gd"
symbol: "AdvancedTyresPage"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
source_selector: "var tyres"
---

# Advanced Tyres page

Groups finite stock selection, fitted/ planned-set details, wheel condition, physical stop scheduling and stint evidence.

## Intent and purpose

Groups finite stock selection, fitted/ planned-set details, wheel condition, physical stop scheduling and stint evidence.

## User goals

Inspect the fitted and planned finite set, choose available stock, read individual wheel condition and stage or cancel a physical stop schedule.

## Used components

- [Fitted and planned tyre readout](race-tyre-readout.md)
- [Four-wheel condition dashboard](racecraft-panel-wheel-dashboard.md)
- [Retained stint plot](weekend-view-support-stint-plot.md)

## Interactions

Allocation, Wheels and Stop plan reveal retained subtopics. Choosing stock dispatches planned set selection without fitting it; physical release, formation or service owns fitting. Schedule explicitly submits an entry-gate lap; Cancel planned stop is a separate action. Pressure/puncture/tread remain factual wheel/set evidence, and the stint plot is read-only.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Base Advanced weekend layout](weekend-view.md)
- [Advanced Drive page](advanced-drive-page.md)
- [Fitted and planned tyre readout](race-tyre-readout.md)
- [Four-wheel condition dashboard](racecraft-panel-wheel-dashboard.md)
- [Measured stint history](race-stint-history.md)

## Behavior and state

Choosing an available set stages its identity without fitting it. Send, formation or physical service perform fitting through the existing command rules; lap scheduling has a separate explicit action. Stock, pressure and punctures remain tied to the real finite set.

## Source and integration

Implementation: [scripts/ui/weekend_inspector_builder.gd](../../../scripts/ui/weekend_inspector_builder.gd) (`var tyres`).

## Interface

This entry is implemented inside `scripts/ui/weekend_inspector_builder.gd` at `var tyres`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Base Advanced weekend layout](weekend-view.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
