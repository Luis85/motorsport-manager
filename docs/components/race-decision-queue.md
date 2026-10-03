---
id: "race-decision-queue"
title: "Decision queue"
description: "Shows two stable driver attention slots with outstanding issue counts and review/hold actions."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/decision_queue.gd"
symbol: "RaceDecisionQueue"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "PanelContainer"
---

# Decision queue

Shows two stable driver attention slots with outstanding issue counts and review/hold actions.

## Intent and purpose

Shows two stable driver attention slots with outstanding issue counts and review/hold actions.

## User goals

Notice unacknowledged issues for both owned drivers without losing the location of a focused action as priorities change.

## Used components

- [Status badge](race-status-badge.md)

## Interactions

Each stable driver slot emits Review or Keep plan with that driver’s ID. The host captures reviewed evidence or acknowledges the current issue; the queue itself sends no race command. Forecast absence remains explicit and does not suppress fuel/tyre checks. Zero issues means no open issue, not approval of a strategy.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Engineering pitwall layout](pitwall-workspace.md)
- [Decision review drawer](race-decision-drawer.md)
- [Engineering driver card](pitwall-car-card.md)

## Behavior and state

present reads the current query and supplied forecasts. review_requested and hold_requested carry stable driver IDs. Priority changes do not reorder focused buttons; the host may hide an empty queue at short heights while keeping review routes available.

## Source and integration

Implementation: [scripts/ui/race_weekend/decision_queue.gd](../../scripts/ui/race_weekend/decision_queue.gd) (`RaceDecisionQueue`, extends `PanelContainer`).

Referenced by [scripts/ui/pitwall_workspace.gd](../../scripts/ui/pitwall_workspace.gd).

## Interface

Public presentation entry points:

- `present(model: RaceViewQuery, forecasts: Dictionary) -> void`

Emitted intent signals:

- `review_requested(id: int)`
- `hold_requested(id: int)`

## Related documentation

- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
