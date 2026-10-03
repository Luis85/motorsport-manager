---
id: "how-to-play"
title: "How to play dialog"
description: "Opens native first-weekend instructions adapted to the saved Minimal or Advanced preference."
kind: "component"
surface: "shipping"
source: "scripts/composition/main.gd"
symbol: "HowToPlay"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "show_help"
---

# How to play dialog

Opens native first-weekend instructions adapted to the saved Minimal or Advanced preference.

## Intent and purpose

Provide quick, layout-specific instructions from the global header. This is a modal informational dialog with control and phase guidance, rather than a progress-tracking tutorial.

## User goals

Learn the sequence of session approvals, driver release/recall, pace and engine actions, playback shortcuts and, in Advanced, tyre/strategy and editor basics.

## Used components

[Native notification dialog](native-notification.md) renders host-supplied instruction text through [Native UI helpers](ui.md). The [Global header](global-header.md) provides the invoking button.

## Interactions

show_help selects Minimal or Advanced instruction text from the saved layout preference and opens the notification. Dismissal closes the dialog. Reading instructions does not issue a race command or explicitly change playback.

## Links to other pages

[Global header](global-header.md) opens help on non-weekend destinations. The described controls belong to [Minimal race layout](minimal-race-workspace.md), [Race Director layout](race-director-workspace.md), [Engineering pitwall](pitwall-workspace.md) and [Circuit Atelier](track-editor.md).

## Behavior and state

show_help uses UI.notify. Instructions explain actual session approvals, playback, driver actions and editor entry. This modal reading surface has no command adapter; its close restores the native dialog lifecycle.

## Source and integration

Implementation: [scripts/composition/main.gd](../../scripts/composition/main.gd) (`show_help`).

## Interface

This entry is implemented inside `scripts/composition/main.gd` at `show_help`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Native application shell](native-shell.md)
- [Native control helpers](ui.md)
- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
