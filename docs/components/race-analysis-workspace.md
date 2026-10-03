---
id: "race-analysis-workspace"
title: "Full analysis layout"
description: "Expands the current inspector into a focused task view while keeping both driver selectors reachable."
kind: "layout"
surface: "advanced"
source: "scripts/ui/race_weekend/analysis_workspace.gd"
symbol: "RaceAnalysisWorkspace"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Full analysis layout

Expands the current inspector into a focused task view while keeping both driver selectors reachable.

## Intent and purpose

Expands the current inspector into a focused task view while keeping both driver selectors reachable.

## User goals

Read one complex engineering task at full width while keeping both owned-driver selectors reachable.

## Used components

Native title, owned-driver selector buttons and a content `VBoxContainer`, built through [native control helpers](ui.md). attach reparents the existing task inspector supplied by [Engineering](pitwall-workspace.md); this wrapper does not construct another copy of that inspector.

## Interactions

The host attaches its existing inspector rather than constructing a copy. Driver buttons emit a named selection; Back emits close_requested so the host returns the same panel and restores focus. Presentation and reparenting preserve drafts and playback.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Engineering pitwall layout](pitwall-workspace.md)
- [Race Director layout](race-director-workspace.md)
- [Inspector scroll layout](race-inspector-page.md)

## Behavior and state

configure binds RaceViewQuery and attach reparents an existing panel. close_requested returns that same control to the pitwall; driver_requested names a driver. No inspector clone, draft reset or implicit playback change occurs.

## Source and integration

Implementation: [scripts/ui/race_weekend/analysis_workspace.gd](../../scripts/ui/race_weekend/analysis_workspace.gd) (`RaceAnalysisWorkspace`, extends `VBoxContainer`).

Referenced by [scripts/ui/pitwall_workspace.gd](../../scripts/ui/pitwall_workspace.gd).

## Interface

Public presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `present() -> void`
- `attach(panel: Control) -> void`

Emitted intent signals:

- `close_requested`
- `driver_requested(id: int)`

## Related documentation

- [docs/ui/race-weekend/layout-system.md](../../docs/ui/race-weekend/layout-system.md)
- [Component catalog](README.md)
