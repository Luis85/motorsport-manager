---
id: "practice-weekend-view"
title: "Practice-capable weekend layout"
description: "Extends Engineering with optional measured practice, replay, scenario/notebook routes and explicit result acceptance."
kind: "layout"
surface: "advanced"
source: "scripts/ui/practice_weekend.gd"
symbol: "PracticeWeekendView"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
extends: "PracticeWeekendReview"
---

# Practice-capable weekend layout

Extends Engineering with optional measured practice, replay, scenario/notebook routes and explicit result acceptance.

## Intent and purpose

Extends Engineering with optional measured practice, replay, scenario/notebook routes and explicit result acceptance.

## User goals

Choose optional measured practice, retain its evidence for later decisions, and review an original or sandbox weekend through explicit recording routes.

## Used components

- [Engineering pitwall layout](pitwall-workspace.md)
- [Practice run panel](practice-panel.md)
- [Practice engineering layout](race-practice-workspace.md)
- [Public rival inspector](public-rival-inspector.md)
- [Duel workspace binding](duel-workspace.md)

## Interactions

Practice links and Dashboard show the same per-driver drafts. Start/run/recall/end intent uses the host command adapter; practice measurements never set the qualifying grid. The Weekend menu opens replay or notebook. Keep checkpoint adds a bounded recording mark; Save persists through the injected presentation service. Accept original result is enabled only for a completed original, never a sandbox.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Practice engineering layout](race-practice-workspace.md)
- [Replay and sandbox](replay-workspace.md)
- [Circuit notebook](notebook-window.md)
- [Session review layout](race-results-workspace.md)
- [Advanced debrief page](advanced-debrief-page.md)

## Behavior and state

open_practice and open_practice_workspace use the same per-driver drafts. primary_action follows actual session phases; save_checkpoint and accept_result go through presentation/application ports. Reopening practice or replay navigation does not claim simulation time or invent measurements.

## Source and integration

Implementation: [scripts/ui/practice_weekend.gd](../../scripts/ui/practice_weekend.gd) (`PracticeWeekendView`, extends `PracticeWeekendReview`).

Referenced by [scripts/composition/main.gd](../../scripts/composition/main.gd), [scripts/ui/public_rival_inspector.gd](../../scripts/ui/public_rival_inspector.gd), [scripts/ui/race_director_workspace.gd](../../scripts/ui/race_director_workspace.gd), [scripts/ui/replay_workspace.gd](../../scripts/ui/replay_workspace.gd).

## Interface

Public presentation entry points:

- `refresh() -> void`
- `group_for(index: int) -> String`
- `refresh_navigation() -> void`
- `open_practice(id: int) -> void`
- `primary_action() -> void`
- `build_replay_actions() -> void`
- `open_destination(index: int, subtopic: int) -> void`
- `keep_checkpoint() -> void`

Emitted intent signals:

- `replay_requested`

## Related documentation

- [docs/ui/race-weekend/layout-system.md](../../docs/ui/race-weekend/layout-system.md)
- [Component catalog](README.md)
