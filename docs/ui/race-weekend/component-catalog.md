# Component catalog

## Existing production components

PitwallWorkspace — task-oriented shell and responsive host.
PitwallCarCard — persistent two-car presentation.
PitwallNavigator — searchable navigation.
PitwallComparison — strategy comparison.
StrategyDesk — Compare / Plan / Control.
WeatherPanel — observations and uncertain weather alternatives.
TeamOrdersPanel — cooperation, battles and pit priority.
PracticePanel — programme/evidence workflow.
TrackCanvas — spatial race observation.

## New shared primitives

RaceUISnapshot — presentation-only revision/signature snapshot.
RaceStatusBadge — accessible semantic badge.
RaceMetricChart — lightweight measured line chart.
RaceSectorTable — compact sector/lap comparison.
SessionResultsPanel — authoritative results table ready for results/debrief surfaces.

These components must not mutate race state directly. Commands continue through the established host/domain boundary.
