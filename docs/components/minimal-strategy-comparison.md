---
id: "minimal-strategy-comparison"
title: "Minimal strategy comparison"
description: "Renders an on-demand detached snapshot of current-plan, next-safe-stop and extension alternatives."
kind: "component"
surface: "shipping"
source: "scripts/ui/race_weekend/minimal/strategy_comparison.gd"
symbol: "MinimalStrategyComparison"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
extends: "VBoxContainer"
source_selector: "extends VBoxContainer"
---

# Minimal strategy comparison

Renders an on-demand detached snapshot of current-plan, next-safe-stop and extension alternatives.

## Intent and purpose

Let the player compare a bounded set of strategy alternatives for one running managed driver without staging an order. Every estimate stays tied to the displayed observation time, model version and current-condition assumptions.

## User goals

Compare the current plan, a next safe stop and an extension when supplied; understand remaining-time range, relative gain, risk, tread, fuel margin and pit/rejoin estimates; request a fresh snapshot when needed.

## Used components

Three persistent [comparison option cards](minimal-comparison-option.md), native snapshot/assumption labels, Refresh estimate and Close buttons use [Minimal race style](minimal-race-style.md). The [Minimal race layout](minimal-race-workspace.md) owns the surrounding scrollable PopupPanel.

## Interactions

Refresh estimate emits refresh_requested; Close emits close_requested. present copies the supplied forecast and explains empty/unavailable data. Opening and refreshing are explicit host query operations, with playback unchanged. There is no approval or command action; the host restores focus to Strategy on close.

## Links to other pages

The [Minimal toolbar](minimal-toolbar.md) opens this popup in [Minimal race layout](minimal-race-workspace.md). [Comparison option cards](minimal-comparison-option.md) describe individual alternatives; commands remain in the [Minimal pitwall](minimal-pitwall.md).

## Behavior and state

The script is preloaded as StrategyComparisonView rather than registered with class_name. configure builds stable option rows and present copies the forecast. Refresh and Close emit intents only; there is no Apply action. Empty/unavailable forecasts explain why comparison is absent, and estimates retain observation time, model version and current-condition assumptions.

## Source and integration

Implementation: [scripts/ui/race_weekend/minimal/strategy_comparison.gd](../../scripts/ui/race_weekend/minimal/strategy_comparison.gd) (`MinimalStrategyComparison`, extends `VBoxContainer`).

Referenced by [scripts/ui/race_weekend/minimal/workspace.gd](../../scripts/ui/race_weekend/minimal/workspace.gd).

## Interface

`MinimalStrategyComparison` is the catalog name for this preloaded script; it is
not a registered `class_name`. The workspace constructs it from its script resource.

Primary presentation entry points:

- `configure(scale: float) -> void`
- `present(forecast: Dictionary, driver_name: String) -> void`
- `text(value: String, points: int, muted: bool = false) -> Label`
- `build_option() -> Dictionary`
- `present_option(row: Dictionary, option: Dictionary, index: int) -> void`

Emitted intent signals:

- `refresh_requested`
- `close_requested`

## Related documentation

- [docs/race-weekend-minimal.md](../../docs/race-weekend-minimal.md)
- [Component catalog](README.md)
