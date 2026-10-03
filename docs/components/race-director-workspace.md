---
id: "race-director-workspace"
title: "Race Director layout"
description: "Provides a track-first Advanced entry surface with two driver cards, calls, plans, watch controls and specialist routes."
kind: "layout"
surface: "advanced"
source: "scripts/ui/race_director_workspace.gd"
symbol: "RaceDirectorWorkspace"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "PracticeWeekendView"
---

# Race Director layout

Provides a track-first Advanced entry surface with two driver cards, calls, plans, watch controls and specialist routes.

## Intent and purpose

Provides a track-first Advanced entry surface with two driver cards, calls, plans, watch controls and specialist routes.

## User goals

Watch the track and both owned drivers, pause deliberately for a named call, and follow physical execution before reviewing the outcome.

## Used components

- [Practice-capable weekend layout](practice-weekend-view.md)
- [Director driver card](director-car-card.md)
- [Director call room](race-call-room.md)

## Interactions

Pit wall, Race plan, Garage, Review and All tools reveal retained workspaces. Pause & decide explicitly pauses before capturing a call snapshot. Next moment and Watch explicitly run at 8× until an observed change or bounded check-in, then pause and restore the previous speed; manual speed selection ends the watch. Switching presentation keeps the same weekend and ends an armed temporary watch.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Director call room](race-call-room.md)
- [Strategy desk](strategy-desk.md)
- [Session review layout](race-results-workspace.md)
- [Find workspace dialog](pitwall-navigator.md)
- [Circuit notebook](notebook-window.md)

## Behavior and state

director_enabled selects Director versus Engineering presentation over the same practice-capable view. Reading and navigation are observational; explicitly labelled watch/pause actions can change playback. Call-room drafts stay tied to their driver, and exit restores host presentation state.

## Source and integration

Implementation: [scripts/ui/race_director_workspace.gd](../../scripts/ui/race_director_workspace.gd) (`RaceDirectorWorkspace`, extends `PracticeWeekendView`).

Referenced by [scripts/composition/main.gd](../../scripts/composition/main.gd), [scripts/ui/replay_workspace.gd](../../scripts/ui/replay_workspace.gd).

## Interface

Public presentation entry points:

- `refresh() -> void`
- `confirm_leave(proceed: Callable) -> void`
- `own_selection() -> int`
- `set_director_enabled(value: bool) -> void`
- `adapt_layout() -> void`
- `refresh_navigation() -> void`
- `open_topic(index: int) -> void`
- `open_practice(id: int) -> void`

No custom intent signals are declared by this script.

## Related documentation

- [docs/ui/race-weekend/layout-system.md](../../docs/ui/race-weekend/layout-system.md)
- [Component catalog](README.md)
