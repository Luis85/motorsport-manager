---
id: "scenario-screens"
title: "Diagnostic scenario galleries"
description: "Builds the retained dry, weather, recovery, practice, rival and duel exercise destinations."
kind: "helper"
surface: "developer"
source: "scripts/composition/scenario_screens.gd"
symbol: "ScenarioScreens"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "add_collection_intro"
extends: "RefCounted"
---

# Diagnostic scenario galleries

Builds the retained dry, weather, recovery, practice, rival and duel exercise destinations.

## Intent and purpose

Keep the six trusted developer diagnostic collections reachable from the Advanced scenario menu. The helper assembles exercises for inspecting implemented systems; these retained galleries are separate from external authored content-scenario staging.

## User goals

- Find a deterministic exercise by objective, hint and seed.
- Open dry, weather, recovery, practice, rival or duel diagnostics.
- Choose deliberately before replacing an existing weekend.

## Used components

Native grids or vertical card/scroll layouts built through [UI](ui.md); `ScenarioCatalog` supplies collection copy and trusted recipes. Family builders use `App.library`. Failures use [native notifications](native-notification.md). Replacement uses locally constructed native ConfirmationDialogs, rather than the shared UI confirmation helper.

## Interactions

`add_collection_intro` resolves each family’s title/description with fallback copy. The six `show_*` functions clear the shell screen and bind card launch buttons. Launch builds a candidate, reports a null candidate, installs `App.weekend`, applies saved playback speed and calls `host.show_weekend`. Dry checks `App.requires_entry_confirmation`; the other five only confirm when an in-memory weekend exists outside briefing/results. Confirmation cancellation does not invoke the launch callback. These retained composition routes do not use the shipping staged `WeekendLaunch` entry flow. Dry/weather use two-column grids, recovery/duels use vertical scroll, and practice/rivals append cards directly.

## Links to other pages

- [Main menu](main-menu-view.md) — Advanced Scenario challenges entry.
- [Dry strategy scenarios](strategy-scenarios.md) — Nested-plan dry exercises.
- [Weather scenarios](weather-scenarios-page.md) — Weather-mode diagnostics.
- [Recovery scenarios](recovery-scenarios-page.md) — Reliability/recovery exercises.
- [Practice scenarios](practice-scenarios-page.md) — Measured-practice briefing.
- [Rival-style scenarios](rival-scenarios-page.md) — Finite worn-set rival preparation.
- [Strategic duel scenarios](duel-scenarios-page.md) — Untimed-grid duel preparation.
- [Content scenario controls](content-scenario-controls.md) — Separate authored scenario staging.

## Source and integration

Implementation: [scripts/composition/scenario_screens.gd](../../../scripts/composition/scenario_screens.gd) (`add_collection_intro`).

## Interface

`ScenarioScreens` is a global `RefCounted` composition helper. Call its static functions with the shell host:

- `add_collection_intro(host, family, fallback_title, fallback_description, size = 30)`
- `show_strategy_scenarios(host)`
- `show_weather_scenarios(host)`
- `show_recovery_scenarios(host)`
- `show_practice_scenarios(host)`
- `show_rival_scenarios(host)`
- `show_duel_scenarios(host)`

There is no `configure` method or custom signal on this helper.

## Related documentation

- [Authored scenario selector](content-scenario-controls.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
