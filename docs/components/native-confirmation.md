---
id: "native-confirmation"
title: "Native confirmation dialog"
description: "Provides the shared explicit destructive-action confirmation with Cancel as initial focus."
kind: "component"
surface: "shared"
source: "scripts/ui/ui.gd"
symbol: "NativeConfirmation"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "confirm"
---

# Native confirmation dialog

Provides the shared explicit destructive-action confirmation with Cancel as initial focus.

## Intent and purpose

Require an explicit decision before the caller performs a destructive/replacement action.

## User goals

Keep a draft by choosing Cancel or deliberately confirm the named action with its consequences visible.

## Used components

- [Native control helpers](ui.md)
- [Pitwall design adapter](pitwall-design.md)

## Interactions

confirm reuses an existing visible ConfirmationDialog instead of stacking it; initial focus is Cancel. Cancel dismisses and restores focus without calling the action. Confirm dismisses and invokes the supplied callback; focus after success belongs to that callback, not an unconditional helper restoration.

## Behavior and state

UI.confirm captures the current focus invoker and calls the supplied action only on Confirm. Both Confirm and Cancel free the dialog. Cancel restores the invoker; after Confirm the action callback owns focus. Cancellation leaves the host draft intact; legacy diagnostic galleries also contain their own retained confirmation construction.

## Source and integration

Implementation: [scripts/ui/ui.gd](../../scripts/ui/ui.gd) (`confirm`).

## Interface

This entry is implemented inside `scripts/ui/ui.gd` at `confirm`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Native control helpers](ui.md)
- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Circuit Atelier](track-editor.md) — related destination or host.
- [Settings](settings-view.md) — related destination or host.
- [Circuit notebook](notebook-window.md) — related destination or host.
- [Tactical plan panel](tactical-plan-panel.md) — related destination or host.
- [Recovery panel](recovery-panel.md) — related destination or host.
