---
id: "pitwall-workspace"
title: "Engineering pitwall layout"
description: "Composes task navigation, session header, observation, two driver cards, decision review and expanded analysis/results workspaces."
kind: "layout"
surface: "advanced"
source: "scripts/ui/pitwall_workspace.gd"
symbol: "PitwallWorkspace"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
extends: "PitwallWorkspaceState"
---

# Engineering pitwall layout

Composes task navigation, session header, observation, two driver cards, decision review and expanded analysis/results workspaces.

## Intent and purpose

Composes task navigation, session header, observation, two driver cards, decision review and expanded analysis/results workspaces.

## User goals

Observe both drivers, notice decisions, and move between detailed engineering, session evidence and results while retaining drafts.

## Used components

- [Recovery-capable weekend layout](recovery-weekend-view.md)
- [Engineering driver card](pitwall-car-card.md)
- [Decision queue](race-decision-queue.md)
- [Decision review drawer](race-decision-drawer.md)
- [Pitwall forecast comparison](pitwall-comparison.md)
- [Find workspace dialog](pitwall-navigator.md)
- [Read the race panel](race-read-panel.md)
- [Full analysis layout](race-analysis-workspace.md)
- [Session review layout](race-results-workspace.md)
- [Session classification panel](session-results-panel.md)
- [Race gamepad navigation](race-gamepad-navigation.md)

## Interactions

Topic groups and Find reveal existing task controls. Full view and session review reparent existing controls and return them on close. Decision actions name a driver and pass through the inherited command boundary; leaving asks about unapplied drafts. Reading and ordinary navigation preserve playback.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Race Director layout](race-director-workspace.md)
- [Full analysis layout](race-analysis-workspace.md)
- [Practice engineering layout](race-practice-workspace.md)
- [Session review layout](race-results-workspace.md)
- [Strategy desk](strategy-desk.md)

## Behavior and state

It extends the retained recovery-capable stack. open_destination routes existing topics; full views reparent existing inspectors/results rather than clone drafts. refresh preserves focused controls and playback. Leaving checks unapplied drafts, and the PR 28 finishing-guide helper owns guide customization.

## Source and integration

Implementation: [scripts/ui/pitwall_workspace.gd](../../scripts/ui/pitwall_workspace.gd) (`PitwallWorkspace`, extends `PitwallWorkspaceState`).

Referenced by [scripts/composition/main.gd](../../scripts/composition/main.gd), [scripts/ui/practice_weekend.gd](../../scripts/ui/practice_weekend.gd).

## Interface

Public presentation entry points:

- `refresh() -> void`
- `confirm_leave(proceed: Callable) -> void`
- `build_navigation() -> void`
- `build_header() -> void`
- `compact_inspector() -> void`
- `group_for(index: int) -> String`
- `refresh_navigation() -> void`
- `build_driver_rail() -> void`

No custom intent signals are declared by this script.

## Related documentation

- [docs/ui/race-weekend/layout-system.md](../../docs/ui/race-weekend/layout-system.md)
- [Component catalog](README.md)
