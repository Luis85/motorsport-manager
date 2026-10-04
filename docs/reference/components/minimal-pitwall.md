---
id: "minimal-pitwall"
title: "Minimal driver action panel"
description: "Combines two driver selectors, the selected full name/state and Send out / Box this lap / Push / Calm / engine controls."
kind: "component"
surface: "shipping"
source: "scripts/ui/race_weekend/minimal/workspace.gd"
symbol: "MinimalPitwall"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "build_pitwall"
---

# Minimal driver action panel

Combines two driver selectors, the selected full name/state and Send out / Box this lap / Push / Calm / engine controls.

## Intent and purpose

Expose the bounded set of manual actions for one named managed driver. Target identity, availability reasons and per-driver receipts reduce ambiguity about which car receives an order.

## User goals

Select a driver, release or recall a car, trade pace for wear with Push/Calm, set engine mode and see acceptance/rejection without opening specialist workspaces.

## Used components

Native driver toggle buttons, identity/state labels, Send out/Box buttons, pace toggles, engine OptionButton and receipt/guidance labels use [Minimal race style](minimal-race-style.md). [Minimal race layout](minimal-race-workspace.md) binds MinimalRaceControls and per-driver receipts.

## Interactions

Selectors change the owned target. Send out and Box this lap use current phase/inventory/safe-entry validation with disabled reasons. Push/Calm toggle back to Normal on a second press. Engine choice is pinned to opening driver and phase; driver/phase changes close a stale menu. Accepted/rejected messages stay with their driver and clear at phase changes.

## Links to other pages

The [timing table](minimal-timing-table.md) and owned [Track canvas](track-canvas.md) car clicks provide alternative selection routes. [Driver cards](minimal-driver-card.md) provide read-only resources; [Strategy comparison](minimal-strategy-comparison.md) supplies estimates separately in [Minimal race layout](minimal-race-workspace.md).

## Behavior and state

Actions pass through MinimalRaceControls with current phase, inventory and safe-entry validation. Accepted/rejected receipts stay per-driver. Push/Calm toggle to Normal on a second press; engine menus stay pinned to the opening driver and phase and close when stale. Bottom driver cards are read-only.

## Source and integration

Implementation: [scripts/ui/race_weekend/minimal/workspace.gd](../../../scripts/ui/race_weekend/minimal/workspace.gd) (`build_pitwall`).

## Interface

This entry is implemented inside `scripts/ui/race_weekend/minimal/workspace.gd` at `build_pitwall`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Minimal race layout](minimal-race-workspace.md)
- [docs/reference/race-weekend/minimal.md](../race-weekend/minimal.md)
- [Component catalog](README.md)
