---
id: "replay-workspace"
title: "Replay and sandbox"
description: "Displays an independent replay with seek/play controls and explicit sandbox/scenario/export routes."
kind: "page"
surface: "advanced"
source: "scripts/ui/replay_workspace.gd"
symbol: "ReplayWorkspace"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Replay and sandbox

Displays an independent replay with seek/play controls and explicit sandbox/scenario/export routes.

## Intent and purpose

Displays an independent replay with seek/play controls and explicit sandbox/scenario/export routes.

## User goals

Inspect a sealed recording, seek retained checkpoints and try a different decision in a separately saved sandbox.

## Used components

- [Track canvas](track-canvas.md)
- [Race Director layout](race-director-workspace.md)
- [Scenario author dialog](scenario-author.md)

## Interactions

Select a checkpoint or saved endpoint, Play/Pause the record, or choose replay budget. Try another decision requests an independent sandbox binding; Return to replay saves the experiment through presentation services and checks unapplied edits. Return to original closes through composition, which restores the original runner. Export recording and Author scenario create evidence/data, never accept results or grant rewards.

## Links to other pages

Related host and task documentation (these links describe integration; actual in-app routes are listed under Interactions):

- [Practice-capable weekend layout](practice-weekend-view.md)
- [Race Director layout](race-director-workspace.md)
- [Scenario author dialog](scenario-author.md)
- [Circuit notebook](notebook-window.md)
- [Replay screen composition](replay-controller.md)

## Behavior and state

configure accepts ReplayViewSession, never the original live aggregate. branch_requested asks ReplayController to create a separate sandbox; mount_sandbox receives its own RaceViewHandle. Leaving saves through presentation ports and restores the original paused/live context via the controller. Experiment checkpoints and results remain separate from original result acceptance.

## Source and integration

Implementation: [scripts/ui/replay_workspace.gd](../../../scripts/ui/replay_workspace.gd) (`ReplayWorkspace`, extends `VBoxContainer`).

Referenced by [scripts/composition/replay_controller.gd](../../../scripts/composition/replay_controller.gd).

## Interface

Public presentation entry points:

- `configure(replay: ReplayViewSession) -> void`
- `refresh() -> void`
- `seek(index: int) -> void`
- `toggle_play() -> void`
- `start_sandbox() -> void`
- `mount_sandbox(session: RaceViewHandle, record: RaceRecord) -> void`
- `save_sandbox() -> String`
- `leave_sandbox() -> void`

Emitted intent signals:

- `close_requested`
- `branch_requested`
- `sandbox_closed`

## Related documentation

- [Replay screen composition](replay-controller.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
