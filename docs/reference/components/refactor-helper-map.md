---
id: "ui-refactor-helper-map"
title: "UI helper ownership after the quality refactor"
description: "Maps extracted UI implementation scripts to their existing component references."
kind: "index"
source_pr: 28
source_commit: "dfb7cead8f01ea9b0b42a4b936b1d4c4e9bf21fa"
---

# UI helper ownership after the quality refactor

The [component catalog](README.md) retains its original 120 page, layout,
component and helper references. The comprehensive quality pass extracted these
additional implementation scripts behind existing controls. This map records
their actual source paths and owning references at the source above; it does not
introduce new player-facing pages or claim new gameplay.

| Extracted source | Responsibility | Owning reference |
|---|---|---|
| [editor_authoring.gd](../../../scripts/ui/editor_authoring.gd) | Selection, tool and trace intent | [Circuit Atelier](track-editor.md) |
| [editor_inspector_circuit.gd](../../../scripts/ui/editor_inspector_circuit.gd) | Track and feature field builders | [Editor inspector](track-editor-inspector.md) |
| [editor_inspector_selection.gd](../../../scripts/ui/editor_inspector_selection.gd) | Selected-point field builder | [Editor Point page](editor-point-page.md) |
| [editor_inspector_workspace.gd](../../../scripts/ui/editor_inspector_workspace.gd) | Reference, Checks, World and Draw field builders | [Editor inspector](track-editor-inspector.md) |
| [editor_state.gd](../../../scripts/ui/editor_state.gd) | Editor view state and application-session coordination | [Circuit Atelier](track-editor.md) |
| [editor_storage.gd](../../../scripts/ui/editor_storage.gd) | Native dialog and injected persistence routing | [Circuit Atelier](track-editor.md) |
| [minimal_race_driver_presenter.gd](../../../scripts/ui/minimal_race_driver_presenter.gd) | Selected-driver display and compact layout | [Minimal race layout](minimal-race-workspace.md) |
| [minimal_race_workspace_builder.gd](../../../scripts/ui/minimal_race_workspace_builder.gd) | Toolbar, body and pitwall construction | [Minimal race layout](minimal-race-workspace.md) |
| [pitwall_workspace_builder.gd](../../../scripts/ui/pitwall_workspace_builder.gd) | Engineering navigation, header and driver rail | [Engineering pitwall](pitwall-workspace.md) |
| [pitwall_workspace_layout.gd](../../../scripts/ui/pitwall_workspace_layout.gd) | Layout adaptation and analysis/results presentation | [Engineering pitwall](pitwall-workspace.md) |
| [pitwall_workspace_state.gd](../../../scripts/ui/pitwall_workspace_state.gd) | Engineering view state and delegated interaction | [Engineering pitwall](pitwall-workspace.md) |
| [practice_weekend_review.gd](../../../scripts/ui/practice_weekend_review.gd) | Replay/checkpoint/acceptance intent and draft protection | [Practice-capable weekend](practice-weekend-view.md) |
| [race_director_presentation.gd](../../../scripts/ui/race_director_presentation.gd) | Director composition and moments reading | [Race Director](race-director-workspace.md) |
| [call_room_intent.gd](../../../scripts/ui/race_weekend/call_room_intent.gd) | Frozen named-driver intent and explicit confirmation | [Director call room](race-call-room.md) |
| [chart_navigation.gd](../../../scripts/ui/race_weekend/chart_navigation.gd) | Keyboard/controller inspection direction | [Metric chart](race-metric-chart.md) |
| [metric_chart_data.gd](../../../scripts/ui/race_weekend/metric_chart_data.gd) | Detached sample/case normalization and alignment | [Metric chart](race-metric-chart.md) |
| [strategy_desk_draft.gd](../../../scripts/ui/strategy_desk_draft.gd) | Local strategy draft and explicit approval intent | [Strategy desk](strategy-desk.md) |
| [strategy_desk_presentation.gd](../../../scripts/ui/strategy_desk_presentation.gd) | Forecast, overlap and timeline reading | [Strategy desk](strategy-desk.md) |
| [strategy_weekend_controls.gd](../../../scripts/ui/strategy_weekend_controls.gd) | Targeted command and task navigation adapters | [Strategy-capable weekend](strategy-weekend-view.md) |
| [strategy_weekend_presentation.gd](../../../scripts/ui/strategy_weekend_presentation.gd) | Driver decision refresh | [Strategy-capable weekend](strategy-weekend-view.md) |
| [tactical_plan_draft.gd](../../../scripts/ui/tactical_plan_draft.gd) | Local Plan/Review/Follow-up state | [Tactical plan panel](tactical-plan-panel.md) |
| [tactical_plan_review.gd](../../../scripts/ui/tactical_plan_review.gd) | Comparison and explicit approval confirmation | [Tactical plan panel](tactical-plan-panel.md) |
| [track_canvas_authoring.gd](../../../scripts/ui/track_canvas_authoring.gd) | Pointer/keyboard gesture and selection draft | [Track canvas](track-canvas.md) |
| [track_canvas_state.gd](../../../scripts/ui/track_canvas_state.gd) | Canvas view state and nested moving/surface layers | [Track canvas](track-canvas.md) |
| [weekend_driver_presenter.gd](../../../scripts/ui/weekend_driver_presenter.gd) | Telemetry, radio and driver-control reading | [Advanced weekend support](weekend-view-support.md) |
| [weekend_driver_support.gd](../../../scripts/ui/weekend_driver_support.gd) | Tyre refresh and current-decision projection | [Advanced weekend support](weekend-view-support.md) |
| [weekend_inspector_builder.gd](../../../scripts/ui/weekend_inspector_builder.gd) | Drive and Tyres inspector construction | [Advanced Drive](advanced-drive-page.md) / [Tyres](advanced-tyres-page.md) |
| [weekend_navigation.gd](../../../scripts/ui/weekend_navigation.gd) | Topic/detail navigation and contextual help | [Advanced weekend support](weekend-view-support.md) |
| [weekend_view_state.gd](../../../scripts/ui/weekend_view_state.gd) | Advanced view state and nested retained stint plot | [Advanced weekend support](weekend-view-support.md) |
| [weekend_workspace_builder.gd](../../../scripts/ui/weekend_workspace_builder.gd) | Base Advanced layout and driver-inspector composition | [Base Advanced weekend](weekend-view.md) |

Inherited presentation state remains on the same view instance. These helpers do
not own another simulation, scheduler or canonical editor document. Existing
application commands/queries, `TrackEditorSession`, injected persistence ports and
composition retain their authority. The source budget remains 400 physical code
lines per script; test code uses the separate 450-line budget.

When a responsibility moves, update the relevant reference's `source`,
`source_selector`, direct `extends` metadata and reviewed `source_commit`, plus
this map. A moved method may remain callable through inheritance, while its
implementation belongs in the linked collaborator. Keep original behavior and
verification provenance separate from that source-pointer update.

Related contracts: [architecture](../../explanation/architecture.md),
[code quality](../../how-to/code-quality.md), [developer toolbox](../developer-toolbox.md).
