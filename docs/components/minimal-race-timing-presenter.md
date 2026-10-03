---
id: "minimal-race-timing-presenter"
title: "Minimal timing presenter"
description: "Diffs and reorders persistent timing rows by stable driver ID and updates the two read-only driver cards."
kind: "helper"
surface: "shipping"
source: "scripts/ui/race_weekend/minimal/timing_presenter.gd"
symbol: "MinimalRaceTimingPresenter"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Minimal timing presenter

Diffs and reorders persistent timing rows by stable driver ID and updates the two read-only driver cards.

## Intent and purpose

Keep changing classification legible while preserving each native row’s driver identity and the selected driver. PR 28 separates this presentation responsibility from the workspace’s composition and input.

## User goals

Follow ranking and session-specific timing without losing the intended command target during pointer selection, and see matching condition cards for both managed drivers.

## Used components

The helper updates the existing Tree and persistent TreeItems of [Minimal timing table](minimal-timing-table.md), then presents detached readouts to [Minimal driver cards](minimal-driver-card.md). [Minimal race style](minimal-race-style.md) supplies row and state colors.

## Interactions

present(host) reads the host’s detached frame, blocks Tree signals during updates, skips unchanged row assignments and delays row movement while the left mouse button is held. Only managed drivers are selectable. Headings switch among BEST, GRID and GAP according to phase; the helper emits no navigation or commands.

## Links to other pages

[Minimal race layout](minimal-race-workspace.md) invokes this helper through present_timing. Its output appears in [Minimal timing table](minimal-timing-table.md) and the [two-driver instrument row](minimal-driver-row.md).

## Behavior and state

present receives the Minimal workspace and its detached frame. PR 28 extracts this work from workspace.gd. Ranking moves pause while the left pointer button is held; unchanged row data avoids text assignments. Only managed-driver rows are selectable, and timing headings follow the actual phase.

## Source and integration

Implementation: [scripts/ui/race_weekend/minimal/timing_presenter.gd](../../scripts/ui/race_weekend/minimal/timing_presenter.gd) (`MinimalRaceTimingPresenter`, extends `RefCounted`).

Referenced by [scripts/ui/race_weekend/minimal/workspace.gd](../../scripts/ui/race_weekend/minimal/workspace.gd).

## Interface

Primary entry points:

- `present(host) -> void`

This RefCounted helper declares no custom signals. It updates or emits through the supplied host controls; it is not a native Control.

## Related documentation

- [docs/race-weekend-minimal.md](../../docs/race-weekend-minimal.md)
- [Component catalog](README.md)
