---
id: "native-notification"
title: "Native notification dialog"
description: "Shows a scaled AcceptDialog for host-supplied information or errors."
kind: "component"
surface: "shared"
source: "scripts/ui/ui.gd"
symbol: "NativeNotification"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "notify"
---

# Native notification dialog

Shows a scaled AcceptDialog for host-supplied information or errors.

## Intent and purpose

Show the host's information or error in a readable native modal without inventing a repair action.

## User goals

Understand why an action failed or read bounded help, then return to the invoking control.

## Used components

- [Native control helpers](ui.md)
- [Pitwall design adapter](pitwall-design.md)

## Interactions

notify sets supplied title/body on AcceptDialog, scales and centers it, and initially focuses OK. Confirm or Cancel dismisses/frees the window and restores a still-valid invoker. Only the host can retry or perform the described recovery.

## Behavior and state

UI.notify constructs it through prepare_dialog and frees it on close. The host supplies the message and owns recovery; displaying an error never silently repairs domain state.

## Source and integration

Implementation: [scripts/ui/ui.gd](../../scripts/ui/ui.gd) (`notify`).

## Interface

This entry is implemented inside `scripts/ui/ui.gd` at `notify`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Native control helpers](ui.md)
- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Campaign needs attention](campaign-error.md) — related destination or host.
- [How to play dialog](how-to-play.md) — related destination or host.
- [Settings](settings-view.md) — related destination or host.
- [Circuit Atelier](track-editor.md) — related destination or host.
