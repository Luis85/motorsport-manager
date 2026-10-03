---
id: "component-catalog"
title: "UI component catalog"
description: "Source-backed references for every UI script, embedded control and shell-built screen at PR 28."
kind: "index"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
---

# UI component catalog

This catalog documents the native Godot UI at [PR #28](https://github.com/Luis85/motorsport-manager/pull/28), source commit
`c02b09585eccf90a26e1a3296386a3980b059069`. The initial references cover the full source tree at that recorded commit,
rather than only files changed in the PR. Each cataloged page, layout, component
and UI helper has its own Markdown reference with YAML frontmatter. References
reviewed after responsibility extraction record the newer source in their
frontmatter. The [current helper ownership map](refactor-helper-map.md) connects
additional extracted scripts to those existing components without inventing new
player-facing pages.

There are **120 references**: 26 pages, 15 layouts,
58 components and 21 helpers. Coverage includes every
`scripts/ui/**/*.gd` file at that original source, the five nested controls, screens built directly by
the scene shell, six diagnostic galleries and shared dialog factories. Native
Godot primitives (Label, Tree, Button, containers and their individual field
instances) are documented in their owning component rather than duplicated as
project-specific components. Existing topic components also serve as the page
references for telemetry, radio, setup, surface, strategy, team, weather,
recovery, practice, decision review and session results.

## Intent and purpose

Make each implemented UI responsibility easy to find, understand and maintain.
The references connect player intent to the actual source, composition, state and
command boundaries at PR #28.

## User goals

For maintainers: locate a screen or reusable control, understand the player goal,
trace its used components and navigation, and change it without breaking authority
or draft ownership. For players' goals, see each reference's User goals section.

## Used components

The source map below links every cataloged page, layout, component and helper.
Each reference names its own composed controls/dependencies; native Godot fields
are described within the owning control rather than given unrelated stub pages.

## Interactions

Choose a reference from the source map, follow its Used components to inspect
composition, and follow Links to other pages to trace destinations and hosts.
Component relationships describe the implemented UI; a documentation cross-link
does not imply that the control itself has a button to every related page.

## How to use this catalog

Start with the surface you are changing below. Each reference explains behavior,
state, source/host integration, entry points, signals and related contracts.
`shipping` means the current player route, `advanced` means the optional retained
Advanced interface/tools, `developer` means trusted diagnostic exercise routes,
and `shared` means a reusable presentation dependency. All entries are implemented;
that status does not establish human usability, accessibility certification or
representative-device performance. Code-owned campaign authorities without a
dedicated screen are not cataloged as imaginary pages.

PR 28's presentation splits are captured explicitly in
[Advanced weekend support](weekend-view-support.md),
[pitwall finishing guide](pitwall-finishing-guide.md),
[Minimal timing presenter](minimal-race-timing-presenter.md) and
[campaign screen composition](campaign-screens.md). New campaign creation uses
validated authored content, and resumed careers use their frozen content/circuits.

## Ownership rules

UI renders detached values and emits explicit intent. Application handles own
commands/queries; runners own race time; TrackEditorSession owns canonical editor
revisions/history; campaign transactions own management mutations. Persistence
uses injected ports/services or the composition shell. Navigation, chart inspection,
resize and refresh do not implicitly execute sporting actions. Explicit Pause,
Play, Watch and approved actions retain their existing command semantics.

GameTheme and its UI/Minimal/Director/Pitwall adapters own native chrome;
CircuitPalette owns illustrated-map ink. Preserve text scale, full labels,
keyboard focus, explicit unavailable reasons and cancellation that keeps drafts.
Content can scroll while commit controls remain reachable.

## Reference format and upkeep

All frontmatter is YAML. Required reference fields are `id`, `title`, `description`,
`kind`, `surface`, `source`, `symbol`, `status`, `source_pr` and `source_commit`.
`kind` is `page`, `layout`, `component` or `helper`; `source` is repository-relative.
Global scripts also record `extends`. Embedded controls/routes add `source_selector`
to identify their class or builder inside the owning file. `symbol` may therefore
be a global class, nested class or descriptive route name; it is not a promise of
a global class registration. The index uses `kind: index` and has no widget API.

When a UI script, nested control or user-visible route is added/renamed/removed,
update its reference and this index together. Recheck APIs and host links against
the changed source. Advance source provenance only for entries actually reviewed;
do not relabel historical behavior or green CI evidence as a new verification run.
This documentation addition does not change runtime code or save/content schemas.

## Source map

### Shipping screens and components

| Reference | Kind | Source |
|---|---|---|
| [Authored scenario selector](content-scenario-controls.md) | component | [composition/content_scenario_controls.gd](../../scripts/composition/content_scenario_controls.gd) |
| [Campaign Director Desk](campaign-director-desk.md) | page | [ui/campaign/director_desk.gd](../../scripts/ui/campaign/director_desk.gd) |
| [Campaign needs attention](campaign-error.md) | page | [composition/campaign_screens.gd](../../scripts/composition/campaign_screens.gd) |
| [Campaign screen composition](campaign-screens.md) | helper | [composition/campaign_screens.gd](../../scripts/composition/campaign_screens.gd) |
| [Canvas gesture draft](track-canvas-gesture.md) | helper | [ui/track_canvas_gesture.gd](../../scripts/ui/track_canvas_gesture.gd) |
| [Circuit Atelier](track-editor.md) | page | [ui/editor.gd](../../scripts/ui/editor.gd) |
| [Editor Checks page](editor-checks-page.md) | page | [ui/editor_inspector_workspace.gd](../../scripts/ui/editor_inspector_workspace.gd) |
| [Editor Features page](editor-features-page.md) | page | [ui/editor_inspector_circuit.gd](../../scripts/ui/editor_inspector_circuit.gd) |
| [Editor Point page](editor-point-page.md) | page | [ui/editor_inspector_selection.gd](../../scripts/ui/editor_inspector_selection.gd) |
| [Editor Reference page](editor-reference-page.md) | page | [ui/editor_inspector_workspace.gd](../../scripts/ui/editor_inspector_workspace.gd) |
| [Editor Sketch page](editor-sketch-page.md) | page | [ui/editor_inspector_workspace.gd](../../scripts/ui/editor_inspector_workspace.gd) |
| [Editor Track page](editor-track-page.md) | page | [ui/editor_inspector_circuit.gd](../../scripts/ui/editor_inspector_circuit.gd) |
| [Editor World page](editor-world-page.md) | page | [ui/editor_inspector_workspace.gd](../../scripts/ui/editor_inspector_workspace.gd) |
| [Editor inspector builder](track-editor-inspector.md) | helper | [ui/editor_inspector.gd](../../scripts/ui/editor_inspector.gd) |
| [Editor toolbar builder](track-editor-toolbar.md) | helper | [ui/editor_toolbar.gd](../../scripts/ui/editor_toolbar.gd) |
| [Global header](global-header.md) | component | [composition/main.gd](../../scripts/composition/main.gd) |
| [Grand Prix setup](grand-prix-setup.md) | page | [composition/main.gd](../../scripts/composition/main.gd) |
| [How to play dialog](how-to-play.md) | component | [composition/main.gd](../../scripts/composition/main.gd) |
| [Main menu](main-menu-view.md) | page | [ui/main_menu.gd](../../scripts/ui/main_menu.gd) |
| [Minimal comparison option card](minimal-comparison-option.md) | component | [ui/race_weekend/minimal/strategy_comparison.gd](../../scripts/ui/race_weekend/minimal/strategy_comparison.gd) |
| [Minimal driver action panel](minimal-pitwall.md) | component | [ui/race_weekend/minimal/workspace.gd](../../scripts/ui/race_weekend/minimal/workspace.gd) |
| [Minimal driver condition card](minimal-driver-card.md) | component | [ui/race_weekend/minimal/driver_card.gd](../../scripts/ui/race_weekend/minimal/driver_card.gd) |
| [Minimal race layout](minimal-race-workspace.md) | layout | [ui/race_weekend/minimal/workspace.gd](../../scripts/ui/race_weekend/minimal/workspace.gd) |
| [Minimal session toolbar](minimal-toolbar.md) | component | [ui/race_weekend/minimal/workspace.gd](../../scripts/ui/race_weekend/minimal/workspace.gd) |
| [Minimal status gauge](minimal-status-gauge.md) | component | [ui/race_weekend/minimal/gauge.gd](../../scripts/ui/race_weekend/minimal/gauge.gd) |
| [Minimal strategy comparison](minimal-strategy-comparison.md) | component | [ui/race_weekend/minimal/strategy_comparison.gd](../../scripts/ui/race_weekend/minimal/strategy_comparison.gd) |
| [Minimal timing presenter](minimal-race-timing-presenter.md) | helper | [ui/race_weekend/minimal/timing_presenter.gd](../../scripts/ui/race_weekend/minimal/timing_presenter.gd) |
| [Minimal timing table](minimal-timing-table.md) | component | [ui/race_weekend/minimal/workspace.gd](../../scripts/ui/race_weekend/minimal/workspace.gd) |
| [Minimal two-driver instrument row](minimal-driver-row.md) | component | [ui/race_weekend/minimal/workspace.gd](../../scripts/ui/race_weekend/minimal/workspace.gd) |
| [Native application shell](native-shell.md) | layout | [composition/main.gd](../../scripts/composition/main.gd) |
| [Settings](settings-view.md) | page | [ui/settings_view.gd](../../scripts/ui/settings_view.gd) |
| [Weekend completion](weekend-end-view.md) | page | [ui/weekend_end.gd](../../scripts/ui/weekend_end.gd) |
| [Weekend welcome and review](weekend-entry-view.md) | page | [ui/weekend_entry.gd](../../scripts/ui/weekend_entry.gd) |

### Advanced interface and retained tools

| Reference | Kind | Source |
|---|---|---|
| [Advanced Drive page](advanced-drive-page.md) | page | [ui/weekend_inspector_builder.gd](../../scripts/ui/weekend_inspector_builder.gd) |
| [Advanced Tyres page](advanced-tyres-page.md) | page | [ui/weekend_inspector_builder.gd](../../scripts/ui/weekend_inspector_builder.gd) |
| [Advanced debrief page](advanced-debrief-page.md) | page | [ui/strategy_weekend.gd](../../scripts/ui/strategy_weekend.gd) |
| [Advanced session header](race-session-header.md) | component | [ui/race_weekend/session_header.gd](../../scripts/ui/race_weekend/session_header.gd) |
| [Advanced timing tower](race-timing-tower.md) | component | [ui/race_weekend/timing_tower.gd](../../scripts/ui/race_weekend/timing_tower.gd) |
| [Advanced weekend support](weekend-view-support.md) | layout | [ui/weekend_support.gd](../../scripts/ui/weekend_support.gd) |
| [Base Advanced weekend layout](weekend-view.md) | layout | [ui/weekend.gd](../../scripts/ui/weekend.gd) |
| [Battle overlay](battle-overlay.md) | component | [ui/battle_overlay.gd](../../scripts/ui/battle_overlay.gd) |
| [Circuit notebook](notebook-window.md) | page | [ui/notebook_window.gd](../../scripts/ui/notebook_window.gd) |
| [Decision journal](race-journal-view.md) | component | [ui/race_weekend/journal_view.gd](../../scripts/ui/race_weekend/journal_view.gd) |
| [Decision queue](race-decision-queue.md) | component | [ui/race_weekend/decision_queue.gd](../../scripts/ui/race_weekend/decision_queue.gd) |
| [Decision review drawer](race-decision-drawer.md) | component | [ui/race_weekend/decision_drawer.gd](../../scripts/ui/race_weekend/decision_drawer.gd) |
| [Director call room](race-call-room.md) | component | [ui/race_weekend/call_room.gd](../../scripts/ui/race_weekend/call_room.gd) |
| [Director driver card](director-car-card.md) | component | [ui/race_weekend/director_car_card.gd](../../scripts/ui/race_weekend/director_car_card.gd) |
| [Director style adapter](director-style.md) | helper | [ui/race_weekend/director_style.gd](../../scripts/ui/race_weekend/director_style.gd) |
| [Driver emblem](race-driver-emblem.md) | component | [ui/race_weekend/driver_emblem.gd](../../scripts/ui/race_weekend/driver_emblem.gd) |
| [Duel workspace binding](duel-workspace.md) | helper | [ui/duel_workspace.gd](../../scripts/ui/duel_workspace.gd) |
| [Engineering driver card](pitwall-car-card.md) | component | [ui/pitwall_car_card.gd](../../scripts/ui/pitwall_car_card.gd) |
| [Engineering pitwall layout](pitwall-workspace.md) | layout | [ui/pitwall_workspace.gd](../../scripts/ui/pitwall_workspace.gd) |
| [Find workspace dialog](pitwall-navigator.md) | component | [ui/pitwall_navigator.gd](../../scripts/ui/pitwall_navigator.gd) |
| [Fitted and planned tyre readout](race-tyre-readout.md) | component | [ui/race_weekend/tyre_readout.gd](../../scripts/ui/race_weekend/tyre_readout.gd) |
| [Four-wheel condition dashboard](racecraft-panel-wheel-dashboard.md) | component | [ui/racecraft_panel.gd](../../scripts/ui/racecraft_panel.gd) |
| [Full analysis layout](race-analysis-workspace.md) | layout | [ui/race_weekend/analysis_workspace.gd](../../scripts/ui/race_weekend/analysis_workspace.gd) |
| [Garage setup panel](racecraft-panel.md) | component | [ui/racecraft_panel.gd](../../scripts/ui/racecraft_panel.gd) |
| [Inspector scroll layout](race-inspector-page.md) | layout | [ui/race_weekend/inspector_page.gd](../../scripts/ui/race_weekend/inspector_page.gd) |
| [Measured sector table](race-sector-table.md) | component | [ui/race_weekend/sector_table.gd](../../scripts/ui/race_weekend/sector_table.gd) |
| [Measured stint history](race-stint-history.md) | component | [ui/race_weekend/stint_history.gd](../../scripts/ui/race_weekend/stint_history.gd) |
| [Metric chart](race-metric-chart.md) | component | [ui/race_weekend/metric_chart.gd](../../scripts/ui/race_weekend/metric_chart.gd) |
| [Physical pit-service panel](race-pit-service-panel.md) | component | [ui/race_weekend/pit_service_panel.gd](../../scripts/ui/race_weekend/pit_service_panel.gd) |
| [Pit rejoin overlay](rejoin-overlay.md) | component | [ui/rejoin_overlay.gd](../../scripts/ui/rejoin_overlay.gd) |
| [Pitwall finishing guide](pitwall-finishing-guide.md) | helper | [ui/pitwall_finishing_guide.gd](../../scripts/ui/pitwall_finishing_guide.gd) |
| [Pitwall forecast comparison](pitwall-comparison.md) | component | [ui/pitwall_comparison.gd](../../scripts/ui/pitwall_comparison.gd) |
| [Practice engineering layout](race-practice-workspace.md) | layout | [ui/race_weekend/practice_workspace.gd](../../scripts/ui/race_weekend/practice_workspace.gd) |
| [Practice programme card](race-practice-programme-card.md) | component | [ui/race_weekend/practice_programme_card.gd](../../scripts/ui/race_weekend/practice_programme_card.gd) |
| [Practice run panel](practice-panel.md) | component | [ui/practice_panel.gd](../../scripts/ui/practice_panel.gd) |
| [Practice-capable weekend layout](practice-weekend-view.md) | layout | [ui/practice_weekend.gd](../../scripts/ui/practice_weekend.gd) |
| [Public rival inspector](public-rival-inspector.md) | helper | [ui/public_rival_inspector.gd](../../scripts/ui/public_rival_inspector.gd) |
| [Qualifying context strip](race-qualifying-workspace.md) | component | [ui/race_weekend/qualifying_workspace.gd](../../scripts/ui/race_weekend/qualifying_workspace.gd) |
| [Race Director layout](race-director-workspace.md) | layout | [ui/race_director_workspace.gd](../../scripts/ui/race_director_workspace.gd) |
| [Race accessibility metadata](race-accessibility.md) | helper | [ui/race_weekend/accessibility.gd](../../scripts/ui/race_weekend/accessibility.gd) |
| [Race gamepad navigation](race-gamepad-navigation.md) | helper | [ui/race_weekend/gamepad_navigation.gd](../../scripts/ui/race_weekend/gamepad_navigation.gd) |
| [Race observation layout](race-observation-workspace.md) | layout | [ui/race_weekend/race_workspace.gd](../../scripts/ui/race_weekend/race_workspace.gd) |
| [Race radio inspector](race-radio-inspector.md) | component | [ui/race_weekend/radio_inspector.gd](../../scripts/ui/race_weekend/radio_inspector.gd) |
| [Read the race panel](race-read-panel.md) | component | [ui/race_weekend/race_read_panel.gd](../../scripts/ui/race_weekend/race_read_panel.gd) |
| [Recovery panel](recovery-panel.md) | component | [ui/recovery_panel.gd](../../scripts/ui/recovery_panel.gd) |
| [Recovery-capable weekend layout](recovery-weekend-view.md) | layout | [ui/recovery_weekend.gd](../../scripts/ui/recovery_weekend.gd) |
| [Replay and sandbox](replay-workspace.md) | page | [ui/replay_workspace.gd](../../scripts/ui/replay_workspace.gd) |
| [Replay screen composition](replay-controller.md) | helper | [composition/replay_controller.gd](../../scripts/composition/replay_controller.gd) |
| [Retained stint plot](weekend-view-support-stint-plot.md) | component | [ui/weekend_view_state.gd](../../scripts/ui/weekend_view_state.gd) |
| [Scenario author dialog](scenario-author.md) | component | [ui/scenario_author.gd](../../scripts/ui/scenario_author.gd) |
| [Session classification panel](session-results-panel.md) | component | [ui/race_weekend/session_results_panel.gd](../../scripts/ui/race_weekend/session_results_panel.gd) |
| [Session review layout](race-results-workspace.md) | layout | [ui/race_weekend/results_workspace.gd](../../scripts/ui/race_weekend/results_workspace.gd) |
| [Status badge](race-status-badge.md) | component | [ui/race_weekend/status_badge.gd](../../scripts/ui/race_weekend/status_badge.gd) |
| [Strategy desk](strategy-desk.md) | component | [ui/strategy_desk.gd](../../scripts/ui/strategy_desk.gd) |
| [Strategy schedule chart](race-strategy-chart.md) | component | [ui/race_weekend/strategy_chart.gd](../../scripts/ui/race_weekend/strategy_chart.gd) |
| [Strategy-capable weekend layout](strategy-weekend-view.md) | layout | [ui/strategy_weekend.gd](../../scripts/ui/strategy_weekend.gd) |
| [Surface field heatmap](surface-lab-field-chart.md) | component | [ui/surface_lab.gd](../../scripts/ui/surface_lab.gd) |
| [Surface laboratory](surface-lab.md) | component | [ui/surface_lab.gd](../../scripts/ui/surface_lab.gd) |
| [Tactical plan panel](tactical-plan-panel.md) | component | [ui/tactical_plan_panel.gd](../../scripts/ui/tactical_plan_panel.gd) |
| [Team intent timeline](race-team-intent-timeline.md) | component | [ui/race_weekend/team_intent_timeline.gd](../../scripts/ui/race_weekend/team_intent_timeline.gd) |
| [Team orders panel](team-orders-panel.md) | component | [ui/team_orders_panel.gd](../../scripts/ui/team_orders_panel.gd) |
| [Telemetry inspector](race-telemetry-inspector.md) | component | [ui/race_weekend/telemetry_inspector.gd](../../scripts/ui/race_weekend/telemetry_inspector.gd) |
| [Weather panel](weather-panel.md) | component | [ui/weather_panel.gd](../../scripts/ui/weather_panel.gd) |
| [Weather-capable weekend layout](weather-weekend-view.md) | layout | [ui/weather_weekend.gd](../../scripts/ui/weather_weekend.gd) |

### Shared presentation

| Reference | Kind | Source |
|---|---|---|
| [Canvas car layer](track-canvas-car-overlay.md) | component | [ui/track_canvas_state.gd](../../scripts/ui/track_canvas_state.gd) |
| [Canvas overlay adapter](track-canvas-overlay-renderer.md) | helper | [ui/track_canvas_overlay_renderer.gd](../../scripts/ui/track_canvas_overlay_renderer.gd) |
| [Canvas overlay painters](track-canvas-overlays.md) | helper | [ui/track_canvas_overlays.gd](../../scripts/ui/track_canvas_overlays.gd) |
| [Canvas pointer input](track-canvas-input.md) | helper | [ui/track_canvas_input.gd](../../scripts/ui/track_canvas_input.gd) |
| [Canvas surface layer](track-canvas-surface-overlay.md) | component | [ui/track_canvas_state.gd](../../scripts/ui/track_canvas_state.gd) |
| [Circuit palette](circuit-palette.md) | helper | [ui/circuit_palette.gd](../../scripts/ui/circuit_palette.gd) |
| [Circuit world illustration](circuit-world.md) | component | [ui/circuit_world.gd](../../scripts/ui/circuit_world.gd) |
| [Context guide](context-guide.md) | component | [ui/context_guide.gd](../../scripts/ui/context_guide.gd) |
| [Game theme](game-theme.md) | helper | [ui/game_theme.gd](../../scripts/ui/game_theme.gd) |
| [Minimal style adapter](minimal-race-style.md) | helper | [ui/race_weekend/minimal/style.gd](../../scripts/ui/race_weekend/minimal/style.gd) |
| [Native confirmation dialog](native-confirmation.md) | component | [ui/ui.gd](../../scripts/ui/ui.gd) |
| [Native control helpers](ui.md) | helper | [ui/ui.gd](../../scripts/ui/ui.gd) |
| [Native file dialog](native-file-dialog.md) | component | [ui/ui.gd](../../scripts/ui/ui.gd) |
| [Native notification dialog](native-notification.md) | component | [ui/ui.gd](../../scripts/ui/ui.gd) |
| [Pitwall design adapter](pitwall-design.md) | helper | [ui/pitwall_design.gd](../../scripts/ui/pitwall_design.gd) |
| [Track canvas](track-canvas.md) | component | [ui/track_canvas.gd](../../scripts/ui/track_canvas.gd) |

### Diagnostic exercise pages

| Reference | Kind | Source |
|---|---|---|
| [Diagnostic scenario galleries](scenario-screens.md) | helper | [composition/scenario_screens.gd](../../scripts/composition/scenario_screens.gd) |
| [Dry strategy scenarios](strategy-scenarios.md) | page | [composition/scenario_screens.gd](../../scripts/composition/scenario_screens.gd) |
| [Practice scenarios](practice-scenarios-page.md) | page | [composition/scenario_screens.gd](../../scripts/composition/scenario_screens.gd) |
| [Recovery scenarios](recovery-scenarios-page.md) | page | [composition/scenario_screens.gd](../../scripts/composition/scenario_screens.gd) |
| [Rival-style scenarios](rival-scenarios-page.md) | page | [composition/scenario_screens.gd](../../scripts/composition/scenario_screens.gd) |
| [Strategic duel scenarios](duel-scenarios-page.md) | page | [composition/scenario_screens.gd](../../scripts/composition/scenario_screens.gd) |
| [Weather scenarios](weather-scenarios-page.md) | page | [composition/scenario_screens.gd](../../scripts/composition/scenario_screens.gd) |

## Links to other pages

- [Main menu](main-menu-view.md) — shipping weekend, campaign, editor and settings entry.
- Minimal route: [Grand Prix setup](grand-prix-setup.md) → [weekend welcome](weekend-entry-view.md) → [Minimal weekend](minimal-race-workspace.md) → [completion](weekend-end-view.md).
- [Campaign Director Desk](campaign-director-desk.md) — management/departure and factual return.
- [Race Director](race-director-workspace.md) / [Engineering](pitwall-workspace.md) — optional Advanced entry and specialist routes.
- [Circuit Atelier](track-editor.md) — author, validate and launch an isolated test snapshot.
- [Settings](settings-view.md) — stage presentation preferences and Apply explicitly.
- [Replay and sandbox](replay-workspace.md) — independent experiments and original-context return.

## Feature contracts

- [Documentation map](../README.md)
- [Current project state](../current-state.md)
- [Architecture and authority boundaries](../architecture-refactor.md)
- [Shipping Minimal weekend](../race-weekend-minimal.md)
- [Director Desk and campaign loop](../campaign/director-desk-first-loop.md)
- [Track editor](../track-editor.md)
- [Advanced layout contract](../ui/race-weekend/layout-system.md)
- [Advanced interaction contract](../ui/race-weekend/interaction-model.md)
- [Verification evidence boundaries](../verification.md)
