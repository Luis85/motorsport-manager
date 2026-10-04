---
id: "duel-workspace"
title: "Duel workspace binding"
description: "Adds tactical-plan controls, per-driver menu entries and contextual guide steps to the existing practice-capable pitwall."
kind: "helper"
surface: "advanced"
source: "scripts/ui/duel_workspace.gd"
symbol: "DuelWorkspace"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Duel workspace binding

Adds tactical-plan controls, per-driver menu entries and contextual guide steps to the existing practice-capable pitwall.

## Intent and purpose

Integrate tactical planning into existing Advanced navigation and command controls without introducing another race authority.

## User goals

Choose a driver, compare a named rival tactic, review the exact evidence and explicitly approve or end a bounded plan.

## Used components

- [Tactical plan panel](tactical-plan-panel.md)
- [Find workspace dialog](pitwall-navigator.md)
- [Context guide](context-guide.md)
- [Pitwall design adapter](pitwall-design.md)

This helper supplies presentation behavior/resources to these consumers or depends on them; it is not an independently mounted page.

## Interactions

configure creates the Tactical plan topic and adds driver-menu/Find/guide routes. open_for selects the named driver before revealing that topic. The panel commit bar is reparented outside scrolling content and its signals forward to the host. Refresh shows accepted tactic status; a tactical window is not a physical Box order.

## Behavior and state

configure binds the host; open_for targets the named driver and reveals TacticalPlanPanel. refresh reports the current tactical state. It uses the host command boundary and does not create a second race workspace or time owner.

## Source and integration

Implementation: [scripts/ui/duel_workspace.gd](../../../scripts/ui/duel_workspace.gd) (`DuelWorkspace`, extends `RefCounted`).

Referenced by [scripts/ui/practice_weekend.gd](../../../scripts/ui/practice_weekend.gd).

## Interface

Primary presentation entry points:

- `configure(view) -> void`
- `refresh() -> void`
- `open_for(id: int) -> void`

This helper declares no custom intent signals. The host supplies callbacks or observes the native controls it constructs.

## Related documentation

- [Tactical plan panel](tactical-plan-panel.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Practice-capable weekend layout](practice-weekend-view.md) — owning/consuming workflow.
- [Race Director layout](race-director-workspace.md) — owning/consuming workflow.
- [Tactical plan panel](tactical-plan-panel.md) — owning/consuming workflow.
