---
id: "weekend-view"
title: "Base Advanced weekend layout"
description: "Builds and refreshes persistent native timing, circuit, session header and inspector controls."
kind: "layout"
surface: "advanced"
source: "scripts/ui/weekend.gd"
symbol: "WeekendView"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "\"res://scripts/ui/weekend_support.gd\""
---

# Base Advanced weekend layout

Builds and refreshes persistent native timing, circuit, session header and inspector controls.

## Intent and purpose

Builds and refreshes persistent native timing, circuit, session header and inspector controls.

## User goals

Observe a full weekend’s timing and circuit while reaching selected-driver driving, telemetry, radio, tyres, setup and surface tasks.

## Used components

- [Advanced weekend support](weekend-view-support.md)
- [Advanced session header](race-session-header.md)
- [Race observation layout](race-observation-workspace.md)
- [Advanced timing tower](race-timing-tower.md)
- [Qualifying context strip](race-qualifying-workspace.md)
- [Track canvas](track-canvas.md)
- [Telemetry inspector](race-telemetry-inspector.md)
- [Race radio inspector](race-radio-inspector.md)
- [Fitted and planned tyre readout](race-tyre-readout.md)
- [Garage setup panel](racecraft-panel.md)
- [Surface laboratory](surface-lab.md)
- [Retained stint plot](weekend-view-support-stint-plot.md)

## Interactions

Timing and teammate selection change observation target. Race view/Close retain inspector drafts; Fit, follow and Layers change camera/drawing only. Driving, tyre selection and stop scheduling emit intent through inherited dispatch. Header phase/pause/speed controls are explicit actions. Persistent controls refresh detached observations; application runners own progression.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Advanced Drive page](advanced-drive-page.md)
- [Advanced Tyres page](advanced-tyres-page.md)
- [Telemetry inspector](race-telemetry-inspector.md)
- [Race radio inspector](race-radio-inspector.md)
- [Strategy-capable weekend layout](strategy-weekend-view.md)

## Behavior and state

PR 28 moves shared state/navigation/interaction into WeekendViewSupport; WeekendView owns concrete construction and bounded refresh. It receives RaceViewHandle through inherited configure. Native Tree rows and pitwall controls remain stable as telemetry changes; application runners own elapsed-time progression.

## Source and integration

Implementation: [scripts/ui/weekend.gd](../../../scripts/ui/weekend.gd) (`WeekendView`, extends `"res://scripts/ui/weekend_support.gd"`).

Referenced by [scripts/composition/main.gd](../../../scripts/composition/main.gd), [scripts/ui/public_rival_inspector.gd](../../../scripts/ui/public_rival_inspector.gd), [scripts/ui/strategy_weekend.gd](../../../scripts/ui/strategy_weekend.gd), [scripts/ui/weekend_support.gd](../../../scripts/ui/weekend_support.gd).

## Interface

Public presentation entry points:

- `refresh() -> void`

No custom intent signals are declared by this script.

## Related documentation

- [Advanced weekend support](weekend-view-support.md)
- [docs/_archive/ui/race-weekend/layout-system.md](../../_archive/ui/race-weekend/layout-system.md)
- [Component catalog](README.md)
