---
id: "minimal-comparison-option"
title: "Minimal comparison option card"
description: "Shows one supplied strategy alternative with estimated remaining-time band, relative gain, risk, minimum tread and fuel margin."
kind: "component"
surface: "shipping"
source: "scripts/ui/race_weekend/minimal/strategy_comparison.gd"
symbol: "MinimalComparisonOption"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "build_option"
---

# Minimal comparison option card

Shows one supplied strategy alternative with estimated remaining-time band, relative gain, risk, minimum tread and fuel margin.

## Intent and purpose

Explain one supplied alternative in the read-only Strategy comparison using consistent estimate/risk fields. The card preserves the difference between the current-plan baseline and estimated gain/loss of another option.

## User goals

Compare alternatives without mistaking unavailable data for a time prediction or an estimate for an accepted order.

## Used components

Native title, time-range, relative-gain and risk/tread/fuel labels sit inside a styled PanelContainer from [Minimal race style](minimal-race-style.md). [Minimal strategy comparison](minimal-strategy-comparison.md) builds three persistent slots and supplies option values.

## Interactions

Cards have no button or command signal. Unavailable options show their supplied reason and No comparison. Available options retain approximate time bands and explanatory tooltips. At text scale 1.25 or above the parent stacks cards in a single column.

## Links to other pages

[Minimal strategy comparison](minimal-strategy-comparison.md) owns these cards, with Refresh estimate and Close as the only actions. The [Minimal toolbar](minimal-toolbar.md) opens the popup in [Minimal race layout](minimal-race-workspace.md).

## Behavior and state

build_option creates three persistent slots; present_option renders only supplied alternatives. Unavailable options show their reason without a fictitious time. Each card is reading-only, and current-plan baseline differs from alternative gain/loss. Enlarged text stacks options in one column.

## Source and integration

Implementation: [scripts/ui/race_weekend/minimal/strategy_comparison.gd](../../scripts/ui/race_weekend/minimal/strategy_comparison.gd) (`build_option`).

## Interface

This entry is implemented inside `scripts/ui/race_weekend/minimal/strategy_comparison.gd` at `build_option`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Minimal strategy comparison](minimal-strategy-comparison.md)
- [docs/race-weekend-minimal.md](../../docs/race-weekend-minimal.md)
- [Component catalog](README.md)
