---
id: "content-scenario-controls"
title: "Authored scenario selector"
description: "Adds catalog scenario selection, Read brief and Review scenario to Grand Prix setup."
kind: "component"
surface: "shipping"
source: "scripts/composition/content_scenario_controls.gd"
symbol: "ContentScenarioControls"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "append"
---

# Authored scenario selector

Adds catalog scenario selection, Read brief and Review scenario to Grand Prix setup.

## Intent and purpose

Offer a catalog-authored scenario as an explicit alternative to custom Grand Prix configuration. Selection and brief reading stay separate from staging/review and race entry.

## User goals

Find a scenario by name, read its authored brief, then review its frozen circuit and weekend preset before starting practice.

## Used components

A native OptionButton, Read brief and Review scenario buttons use [Native UI helpers](ui.md). [Native notification](native-notification.md) displays the brief or staging error; the host supplies WeekendLaunch and the welcome route.

## Interactions

No row is built when the catalog has no scenarios. Both buttons start disabled and enable after a real selection. Read brief opens information only. Review scenario stages the selected stable scenario ID; failure displays launch_draft.last_error, success opens welcome. Selection alone does not start a race.

## Links to other pages

These controls appear in [Grand Prix setup](grand-prix-setup.md). Review opens [Weekend welcome](weekend-entry-view.md), which commits entry separately. [Native application shell](native-shell.md) owns the configuration/launch lifecycle.

## Behavior and state

append builds no row when the catalog has no scenarios. Read/review stay disabled until selection. Read brief shows authored copy; Review stages the scenario through WeekendLaunch and opens the welcome view only on success. The composition helper never starts a race merely because selection changed.

## Source and integration

Implementation: [scripts/composition/content_scenario_controls.gd](../../scripts/composition/content_scenario_controls.gd) (`append`).

## Interface

This entry is implemented inside `scripts/composition/content_scenario_controls.gd` at `append`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Authored scenario selector](content-scenario-controls.md)
- [docs/ui/race-weekend/component-catalog.md](../../docs/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
