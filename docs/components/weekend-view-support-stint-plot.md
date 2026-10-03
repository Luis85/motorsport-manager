---
id: "weekend-view-support-stint-plot"
title: "Retained stint plot"
description: "Draws the retained selected-driver fitted-stint history inside the base Advanced view."
kind: "component"
surface: "advanced"
source: "scripts/ui/weekend_view_state.gd"
symbol: "WeekendViewState.StintPlot"
status: "implemented"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
source_selector: "class StintPlot"
---

# Retained stint plot

Draws the retained selected-driver fitted-stint history inside the base Advanced view.

## Intent and purpose

The intent is to provide a compact retained one-driver overview inside the base Advanced view. Its purpose is to draw actual fitted-set spans and a separate scheduled pit-gate marker using the selected driver’s chart projection.

## User goals

- See the selected driver’s fitted sets across measured race distance.
- Compare measured history with the separate marker for a pending scheduled stop.
- Recognize that an open fitted interval grows only with the car’s actual distance.

## Used components

This inner `Control` draws directly with native drawing methods, [UI styling](ui.md) and [GameTheme](game-theme.md) label ink. `RaceChartQuery.selected_stints()` supplies copied selected-driver fitting intervals, set colors/labels, current distance and scheduled gate; it contains no nested component.

## Interactions

The owning [WeekendView](weekend-view.md) selects the driver and requests redraws. The plot itself has no input handler, inspector cursor or command signal. Closed spans use recorded ends; open spans use measured distance. If a scheduled lap exists, a vertical marker shows its accepted gate separately from the fitting bands. Null/empty chart data draws no evidence. Full session review provides the richer two-driver inspection and text alternatives.

## Links to other pages

- [Owning Advanced support class](weekend-view-support.md)
- [Base Advanced view](weekend-view.md)
- [Interactive two-driver measured history](race-stint-history.md)
- [Stop-plan editing](advanced-tyres-page.md)

## Behavior and state

WeekendView supplies the chart query and driver selection. Drawing follows recorded fitting intervals and current measured distance; it offers no plan-edit or pit-order action. This older embedded plot coexists with the two-driver RaceStintHistory in full session review.

## Source and integration

Implementation: [scripts/ui/weekend_view_state.gd](../../scripts/ui/weekend_view_state.gd) (`class StintPlot`).

## Interface

This entry is implemented inside `scripts/ui/weekend_view_state.gd` at `class StintPlot`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Advanced weekend support](weekend-view-support.md)
- [Base Advanced weekend layout](weekend-view.md)
- [Measured stint history](race-stint-history.md)
- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
