---
id: "replay-controller"
title: "Replay screen composition"
description: "Creates independent replay/sandbox bindings, mounts ReplayWorkspace and restores the original weekend on return."
kind: "helper"
surface: "advanced"
source: "scripts/composition/replay_controller.gd"
symbol: "ReplayController"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "open_data"
---

# Replay screen composition

Creates independent replay/sandbox bindings, mounts ReplayWorkspace and restores the original weekend on return.

## Intent and purpose

Open an independent viewer/experiment while preserving the original view, per-driver drafts, focus and runner context.

## User goals

Review a recording or saved experiment, try an alternate sandbox and return to the unchanged original weekend.

## Used components

- [Replay and sandbox](replay-workspace.md)
- [Native control helpers](ui.md)
- [Pitwall design adapter](pitwall-design.md)

This helper supplies presentation behavior/resources to these consumers or depends on them; it is not an independently mounted page.

## Interactions

open_data validates recording/scenario/session envelopes, suspends the original session, hides/disables its existing nodes and mounts ReplayWorkspace. start_sandbox/resume_sandbox mount independent RaceViewSession runners. close restores the saved session, original nodes, header and focus rather than rebuilding their drafts. Import failures show a notification and leave the original context intact.

## Behavior and state

open_current/open_data validate sealed input and retain the original context. start_sandbox creates its own runner and view handle; resume_sandbox loads the separate checkpoint. close discards the viewer binding and restores original session ownership. UI views never receive the original aggregate through the replay route.

## Source and integration

Implementation: [scripts/composition/replay_controller.gd](../../../scripts/composition/replay_controller.gd) (`open_data`).

## Interface

`ReplayController` is a registered Node class. Call `configure(main: Control)` before using `open_current()`, `open_data(data: Variant) -> String`, `import_record()`, `resume_sandbox()`, `start_sandbox()` or `close()`. These are composition operations; the UI receives only the new viewer/sandbox handles.

## Related documentation

- [Replay screen composition](replay-controller.md)
- [Native control helpers](ui.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Replay and sandbox](replay-workspace.md) — owning/consuming workflow.
- [Practice-capable weekend layout](practice-weekend-view.md) — owning/consuming workflow.
- [Race Director layout](race-director-workspace.md) — owning/consuming workflow.
- [Circuit notebook](notebook-window.md) — owning/consuming workflow.
