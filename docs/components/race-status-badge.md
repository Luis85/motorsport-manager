---
id: "race-status-badge"
title: "Status badge"
description: "Pairs uppercase state text with a redundant status tone and accessible name."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/status_badge.gd"
symbol: "RaceStatusBadge"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "PanelContainer"
---

# Status badge

Pairs uppercase state text with a redundant status tone and accessible name.

## Intent and purpose

The intent is to make a supplied state readable at a glance. Its purpose is to pair uppercase text and an accessible name with a redundant tone so meaning remains available without color.

## User goals

- Recognize the named state quickly in a driver or pit-service card.
- Read the same state text through accessibility metadata.
- Distinguish warning/danger emphasis without relying solely on border color.

## Used components

Uses one native `Label` inside a `PanelContainer`. [GameTheme](game-theme.md) tokens and [UI styling](ui.md) provide cached tone styles; no other component is nested.

## Interactions

`present(text, tone)` updates the uppercase label and `accessibility_name`, reusing neutral/good/warning/danger/info styles. Unknown tones fall back to the neutral surface. This is a supplied-state presenter with no input handler or command signal; the host decides which factual state and emphasis to show.

## Links to other pages

- [Pit-service states and phase chips](race-pit-service-panel.md)
- [Practice status host](race-practice-workspace.md)
- [Decision review status host](race-decision-drawer.md)

## Behavior and state

present accepts text and neutral/good/warning/danger/info tone. Cached styles avoid repeated construction. The state remains readable without color, and the badge cannot infer sporting status or issue a command.

## Source and integration

Implementation: [scripts/ui/race_weekend/status_badge.gd](../../scripts/ui/race_weekend/status_badge.gd) (`RaceStatusBadge`, extends `PanelContainer`).

Referenced by [scripts/ui/race_weekend/decision_drawer.gd](../../scripts/ui/race_weekend/decision_drawer.gd), [scripts/ui/race_weekend/decision_queue.gd](../../scripts/ui/race_weekend/decision_queue.gd), [scripts/ui/race_weekend/pit_service_panel.gd](../../scripts/ui/race_weekend/pit_service_panel.gd), [scripts/ui/race_weekend/practice_workspace.gd](../../scripts/ui/race_weekend/practice_workspace.gd).

## Interface

Primary presentation entry points:

- `present(text: String, tone: String = "neutral") -> void`

No custom intent signals are declared by this script. Inherited signals and native Control events remain available.

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
