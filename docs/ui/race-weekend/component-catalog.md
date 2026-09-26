# Integrated component catalog

All new components below are constructed by the production scene stack. No feature flag or separate demo is needed.

| File under `scripts/ui/race_weekend/` | Responsibility / host |
|---|---|
| `session_header.gd` | Actual header, time controls and utility menu; aliased by WeekendView |
| `timing_tower.gd` | Stable native Tree, classifications and driver selection |
| `race_workspace.gd` | Shared spatial observation layout |
| `decision_queue.gd` | Two stable attention slots, counts and explicitly targeted review/acknowledgement |
| `decision_view_model.gd` | Immutable displayed evidence and exact forecast payload |
| `decision_drawer.gd` | Non-modal review/confirmation/stale/acknowledgement/execution/outcome lifecycle |
| `analysis_workspace.gd` | Full analysis by reusing—not cloning—the active inspector |
| `qualifying_workspace.gd` | Qualifying run/traffic/release context |
| `practice_workspace.gd`, `practice_programme_card.gd` | Simultaneous engineering programmes sharing the existing per-driver drafts and validation |
| `results_workspace.gd`, `session_results_panel.gd` | Full review and stable final/session-aware classification |
| `journal_view.gd`, `stint_history.gd` | Structured recorded command/outcome evidence and measured fitted-set intervals |
| `inspector_page.gd` | Content scroll boundary compatible with existing privacy masks |
| `telemetry_inspector.gd`, `metric_chart.gd`, `sector_table.gd` | Actual recorded/current metrics, chronological traces/categorical cases, measured sectors |
| `radio_inspector.gd` | Live/history message cards and bounded paging |
| `tyre_readout.gd` | Fitted versus planned finite set identity |
| `strategy_chart.gd` | Model-supported stop schedule alternatives and estimate bands |
| `status_badge.gd`, `driver_emblem.gd` | Reusable text-first state and original vector identity |
| `accessibility.gd`, `gamepad_navigation.gd` | Semantic metadata, chart alternatives and modal-aware controller navigation |

`PitwallDesign` owns the race design language. Existing `PitwallCarCard`, `StrategyDesk`, `WeatherPanel`, `TeamOrdersPanel`, `RacecraftPanel` and `PracticePanel` remain domain-aware presenters/adapters. Their duplicate construction is avoided; their commands still route through the existing host. `RaceUISnapshot` was removed rather than claimed as a completed performance layer: complete presentation stamps live where data is rendered.


## Finishing acceptance

The finishing pass additionally integrates `RacePitServicePanel` and `RaceTeamIntentTimeline` as read-only presentations, plus correlated result-visit inspection. `RaceMetricChart` preserves missing positions and exact observed comparison domains. Their host routes and semantic states are in [finish-specification.md](finish-specification.md); there is no new command authority.
