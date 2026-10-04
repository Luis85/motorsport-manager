---
id: "race-inspector-page"
title: "Inspector scroll layout"
description: "Defines the shared scrolling content boundary used by Advanced topic pages."
kind: "layout"
surface: "advanced"
source: "scripts/ui/race_weekend/inspector_page.gd"
symbol: "RaceInspectorPage"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "ScrollContainer"
---

# Inspector scroll layout

Defines the shared scrolling content boundary used by Advanced topic pages.

## Intent and purpose

Defines the shared scrolling content boundary used by Advanced topic pages.

## User goals

Read long task content vertically and keep the focused field visible within a bounded inspector.

## Used components

A native `ScrollContainer` with inner `MarginContainer` and content `VBoxContainer`. The owning [Advanced weekend support](weekend-view-support.md) mounts the task content and keeps its action footer outside this scroll.

## Interactions

Native focus-following scroll reveals focused content and disables horizontal scrolling. The host inserts controls into body and owns task/navigation/commit behavior; this scroll boundary emits no custom intent.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Base Advanced weekend layout](weekend-view.md)
- [Advanced Drive page](advanced-drive-page.md)
- [Advanced Tyres page](advanced-tyres-page.md)
- [Telemetry inspector](race-telemetry-inspector.md)
- [Race radio inspector](race-radio-inspector.md)

## Behavior and state

The host supplies the page content and keeps commit/approval controls outside the scrolling evidence. Horizontal scrolling is disabled and the inner body expands to width. This container owns layout only and does not own a draft or command adapter.

## Source and integration

Implementation: [scripts/ui/race_weekend/inspector_page.gd](../../../scripts/ui/race_weekend/inspector_page.gd) (`RaceInspectorPage`, extends `ScrollContainer`).

Referenced by [scripts/ui/weekend_support.gd](../../../scripts/ui/weekend_support.gd).

## Interface

The host supplies fields/children and mounts the native lifecycle; this type has no public configure/present method.

No custom intent signals are declared by this script.

## Related documentation

- [docs/_archive/ui/race-weekend/layout-system.md](../../_archive/ui/race-weekend/layout-system.md)
- [Component catalog](README.md)
