---
id: "minimal-driver-row"
title: "Minimal two-driver instrument row"
description: "Hosts both stable MinimalDriverCard instances beneath the main observation body."
kind: "component"
surface: "shipping"
source: "scripts/ui/race_weekend/minimal/workspace.gd"
symbol: "MinimalDriverRow"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "build_driver_row"
---

# Minimal two-driver instrument row

Hosts both stable MinimalDriverCard instances beneath the main observation body.

## Intent and purpose

Keep both managed drivers’ instruments visible beneath observation regardless of the selected command target. The row gives the player parallel condition awareness without turning instruments into navigation.

## User goals

Compare both cars’ tyres, fuel, condition and estimated stress while issuing actions only to the explicitly selected driver in the pitwall.

## Used components

A native HBoxContainer contains one stable [Minimal driver condition card](minimal-driver-card.md) for each managed car. [Minimal timing presenter](minimal-race-timing-presenter.md) supplies detached readouts and selection markers; the workspace applies compact spacing at short heights.

## Interactions

The row and cards expose no custom selection, drawer, command or playback actions. Resize-triggered workspace refresh changes compact card spacing; the same cards retain identity and numerical information. Selection is indicated by text and border supplied from the host.

## Links to other pages

The row belongs to [Minimal race layout](minimal-race-workspace.md). [Minimal pitwall](minimal-pitwall.md) holds actions, [timing table](minimal-timing-table.md) holds classification/selection, and [driver condition card](minimal-driver-card.md) describes each instrument panel.

## Behavior and state

Each card receives only its detached readout and selection marker from timing presentation. Responsive layout chooses compact instruments from current window/text scale. Both cars remain visible without granting the cards action or selection behavior.

## Source and integration

Implementation: [scripts/ui/race_weekend/minimal/workspace.gd](../../scripts/ui/race_weekend/minimal/workspace.gd) (`build_driver_row`).

## Interface

This entry is implemented inside `scripts/ui/race_weekend/minimal/workspace.gd` at `build_driver_row`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Minimal race layout](minimal-race-workspace.md)
- [docs/race-weekend-minimal.md](../../docs/race-weekend-minimal.md)
- [Component catalog](README.md)
