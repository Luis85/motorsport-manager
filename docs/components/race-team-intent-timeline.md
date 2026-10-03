---
id: "race-team-intent-timeline"
title: "Team intent timeline"
description: "Shows both cars' accepted stop windows and already-issued bounded intents on a common distance domain."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/team_intent_timeline.gd"
symbol: "RaceTeamIntentTimeline"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "Control"
---

# Team intent timeline

Shows both cars' accepted stop windows and already-issued bounded intents on a common distance domain.

## Intent and purpose

The intent is to make both cars’ already accepted intentions legible together. Its purpose is to show accepted pit windows and issued bounded pace/engine overrides on one distance-lap domain without becoming a command scheduler.

## User goals

- See each car’s accepted windows and active/past overrides alongside current distance.
- Inspect the exact supplied intent description for either teammate.
- Separate accepted plans and issued intents from actual tyre-fitting history.

## Used components

A custom `Control` reads detached `RaceChartQuery.intentions()` data. [PitwallDesign](pitwall-design.md) supplies its chart surface, while [RaceStrategyChart](race-strategy-chart.md) supplies set coloring. The [TeamOrdersPanel](team-orders-panel.md) host provides the adjacent selection text.

## Interactions

Up/Down or D-pad selects the driver; Left/Right selects an item; clicking selects the nearest interval in a driver lane. Inspection emits `selection_changed(text)` and updates accessible descriptions. Filled pit-window bands and outlined issued pace/engine intents have different meanings; past items fade and current measured distance is marked. Reading/selection never approves, reschedules or applies a command. Editing remains in Strategy Plan/Control.

## Links to other pages

- [Team: Accepted plans host](team-orders-panel.md)
- [Strategy Plan editing](strategy-desk.md)
- [Strategy Control overrides](strategy-desk.md)
- [Actually fitted sets](race-stint-history.md)

## Behavior and state

configure accepts RaceChartQuery and present reads its detached timeline. selection_changed and selected_text describe inspection; pointer/keyboard navigation has no approval or scheduling effect. New edits remain in the Strategy Plan/Control pages.

## Source and integration

Implementation: [scripts/ui/race_weekend/team_intent_timeline.gd](../../scripts/ui/race_weekend/team_intent_timeline.gd) (`RaceTeamIntentTimeline`, extends `Control`).

Referenced by [scripts/ui/team_orders_panel.gd](../../scripts/ui/team_orders_panel.gd).

## Interface

Primary presentation entry points:

- `configure(value: RaceChartQuery) -> void`
- `present() -> void`
- `selected_text() -> String`

Emitted intent signals:

- `selection_changed(text: String)`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
