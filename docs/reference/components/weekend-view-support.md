---
id: "weekend-view-support"
title: "Advanced weekend support"
description: "Owns the shared presentation fields, interaction/navigation methods and retained StintPlot beneath WeekendView."
kind: "layout"
surface: "advanced"
source: "scripts/ui/weekend_support.gd"
symbol: "WeekendViewSupport"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
extends: "WeekendViewState"
---

# Advanced weekend support

Owns the shared presentation fields, interaction/navigation methods and retained StintPlot beneath WeekendView.

## Intent and purpose

Owns the shared presentation fields, interaction/navigation methods and retained StintPlot beneath WeekendView.

## User goals

Provide consistent selection, camera/navigation and command feedback beneath the base Advanced presentation.

## Used components

- [Inspector scroll layout](race-inspector-page.md)
- [Context guide](context-guide.md)

## Interactions

configure receives the restricted RaceViewHandle. Dispatch adds the selected target and routes commands; primary_action maps actual phase to an explicit next-stage command, with qualifying closure confirmed. Save/export use presentation services. Topic, tyre/drive subtopic, follow and keyboard actions preserve the distinction between navigation and deliberate car/playback intent.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Base Advanced weekend layout](weekend-view.md)
- [Advanced Drive page](advanced-drive-page.md)
- [Advanced Tyres page](advanced-tyres-page.md)
- [Retained stint plot](weekend-view-support-stint-plot.md)

## Behavior and state

PR 28 extracts this base without changing the public WeekendView type. configure receives RaceViewHandle and exposes its query/command/status handles. dispatch and primary_action use application commands; save/export use injected presentation services. It owns no race tick, live entrant or direct filesystem persistence.

## Source and integration

Implementation: [scripts/ui/weekend_support.gd](../../../scripts/ui/weekend_support.gd) (`WeekendViewSupport`, extends `WeekendViewState`).

Referenced by [scripts/ui/weekend.gd](../../../scripts/ui/weekend.gd).

## Interface

Public presentation entry points:

- `configure(value: RaceViewHandle) -> void`
- `refresh() -> void`
- `setup_guide() -> void`
- `tab_page(title: String) -> VBoxContainer`
- `fit_canvas() -> void`
- `set_follow(value: bool) -> void`
- `select_driver(id: int) -> void`
- `feedback(text: String) -> void`

Emitted intent signals:

- `new_weekend_requested`
- `menu_requested`

## Related documentation

- [Base Advanced weekend layout](weekend-view.md)
- [docs/_archive/ui/race-weekend/layout-system.md](../../_archive/ui/race-weekend/layout-system.md)
- [Component catalog](README.md)
