---
id: "minimal-timing-table"
title: "Minimal timing table"
description: "Shows position, driver code, measured best or estimated gap, and compact running state in persistent native rows."
kind: "component"
surface: "shipping"
source: "scripts/ui/race_weekend/minimal/workspace.gd"
symbol: "MinimalTimingTable"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "build_body"
---

# Minimal timing table

Shows position, driver code, measured best or estimated gap, and compact running state in persistent native rows.

## Intent and purpose

Provide a compact full-field classification view with phase-appropriate timing and stable native driver rows. Managed-driver selection connects observed ranking to the manual action target.

## User goals

Compare measured practice/qualifying laps, inspect starting order or live estimated gaps, read final classification, and select either managed driver accurately.

## Used components

A four-column native Tree and caption/legend labels are built by [Minimal race layout](minimal-race-workspace.md). [Minimal timing presenter](minimal-race-timing-presenter.md) diffs/reorders rows; [Minimal race style](minimal-race-style.md) provides selected/team/state ink.

## Interactions

Only managed-driver rows are selectable and their selection routes to select_driver. Hover text explains full identity/state; the legend marks team drivers and estimated gaps. Rankings move existing rows, delayed while the left pointer button is held. Reading rows emits no race command or playback intent.

## Links to other pages

The [Minimal pitwall](minimal-pitwall.md) reflects the selected row. [Driver cards](minimal-driver-card.md) show corresponding readouts through the [timing presenter](minimal-race-timing-presenter.md). All are hosted in [Minimal race layout](minimal-race-workspace.md).

## Behavior and state

Only managed-driver rows select the pitwall target. MinimalRaceTimingPresenter keeps row identity as rankings change and defers moves while the pointer is down. Practice uses real samples, qualifying real hot laps, live gaps keep their estimate marker and results use factual classification.

## Source and integration

Implementation: [scripts/ui/race_weekend/minimal/workspace.gd](../../../scripts/ui/race_weekend/minimal/workspace.gd) (`build_body`).

## Interface

This entry is implemented inside `scripts/ui/race_weekend/minimal/workspace.gd` at `build_body`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Minimal race layout](minimal-race-workspace.md)
- [Minimal timing presenter](minimal-race-timing-presenter.md)
- [docs/reference/race-weekend/minimal.md](../race-weekend/minimal.md)
- [Component catalog](README.md)
