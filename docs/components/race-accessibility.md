---
id: "race-accessibility"
title: "Race accessibility metadata"
description: "Adds semantic native Control descriptions and text alternatives across the composed Advanced tree."
kind: "helper"
surface: "advanced"
source: "scripts/ui/race_weekend/accessibility.gd"
symbol: "RaceAccessibility"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Race accessibility metadata

Adds semantic native Control descriptions and text alternatives across the composed Advanced tree.

## Intent and purpose

Expose native semantics and text descriptions alongside visual controls so state is not carried by color alone.

## User goals

Identify a control from its text/tooltip and inspect chart observations through their text alternatives.

## Used components

- [Native control helpers](ui.md)
- [Pitwall design adapter](pitwall-design.md)
- [Metric chart](race-metric-chart.md)
- [Measured sector table](race-sector-table.md)

This helper supplies presentation behavior/resources to these consumers or depends on them; it is not an independently mounted page.

## Interactions

describe recursively assigns tooltip descriptions, names textless buttons, derives SpinBox editor names and sets labels to accessibility focus. It adds no commands or replacement navigation. Physical screen-reader and human accessibility behavior require separate validation.

## Behavior and state

describe walks a supplied UI root. Metadata supplements real controls and chart descriptions. The implementation and automated coverage do not establish OS screen-reader support or human accessibility certification.

## Source and integration

Implementation: [scripts/ui/race_weekend/accessibility.gd](../../scripts/ui/race_weekend/accessibility.gd) (`RaceAccessibility`, extends `RefCounted`).

Referenced by [scripts/ui/pitwall_workspace.gd](../../scripts/ui/pitwall_workspace.gd), [scripts/ui/practice_weekend.gd](../../scripts/ui/practice_weekend.gd).

## Interface

Primary presentation entry points:

- `describe(root: Node) -> void`

This helper declares no custom intent signals. The host supplies callbacks or observes the native controls it constructs.

## Related documentation

- [Native control helpers](ui.md)
- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Engineering pitwall layout](pitwall-workspace.md) — owning/consuming workflow.
- [Practice-capable weekend layout](practice-weekend-view.md) — owning/consuming workflow.
- [Session review layout](race-results-workspace.md) — owning/consuming workflow.
