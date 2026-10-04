---
id: "advanced-debrief-page"
title: "Advanced debrief page"
description: "Collects decisions and observed consequences with export and explicit original-result acceptance in practice-capable hosts."
kind: "page"
surface: "advanced"
source: "scripts/ui/strategy_weekend.gd"
symbol: "AdvancedDebriefPage"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "var debrief_page"
---

# Advanced debrief page

Collects decisions and observed consequences with export and explicit original-result acceptance in practice-capable hosts.

## Intent and purpose

The intent is to help the player learn from decisions without rewriting their outcome. Its purpose is to compare assumptions and estimates recorded at accepted calls with retained observed consequences, plus explicit evidence export and host-provided review actions.

## User goals

- Review accepted team decisions and observed pit visits without treating hypothetical finishing positions as facts.
- Export the retained journal when the on-screen latest-100 reading is insufficient.
- Open structured evidence, notebook or replay/sandbox, and deliberately accept an eligible completed original result through the practice-capable host.

## Used components

The page is a body created through [RaceInspectorPage](race-inspector-page.md) / `tab_page()` in [StrategyWeekendView](strategy-weekend-view.md), with native heading, explanation, Export decision evidence button and narrative label. [PitwallWorkspace](pitwall-workspace.md) adds Structured decision evidence, opening [RaceJournalView](race-journal-view.md) in full review. [PracticeWeekendView](practice-weekend-view.md) adds shared review controls for replay, checkpoint and original-result acceptance; these are host controls, not a separate debrief authority.

## Interactions

Opening Review / Debrief changes the inspector destination. Refresh reads the latest 100 retained team/player journal records when its sequence changes, preserving command/model versus observed provenance; practice-capable refresh also prefixes practice reports and public rival context. Export opens the shared save dialog and sends detached versioned evidence through injected presentation services. Structured decision evidence opens the full Decisions reading. Practice host routes open Replay / sandbox or Circuit notebook; Keep checkpoint bookmarks within the recorder limit and requires save/export for disk retention. Accept original result calls the injected acceptance service explicitly; unfinished/sandbox results cannot become original receipts, and reading/export/Next does not accept a result or settle campaign rewards.

## Links to other pages

- [Classification, laps and structured decisions](race-results-workspace.md)
- [Personal interpretation beside remembered facts](notebook-window.md)
- [Separate replay/sandbox exploration](replay-workspace.md)
- [Return to explicit strategy planning](strategy-desk.md)

## Behavior and state

Refresh reads retained strategy records rather than recomputing a successful history. Estimated losses at the call stay distinct from actual pit visits. PracticeWeekendView adds checkpoint, notebook/replay and Accept original result routes through injected application ports.

## Source and integration

Implementation: [scripts/ui/strategy_weekend.gd](../../../scripts/ui/strategy_weekend.gd) (`var debrief_page`).

## Interface

This entry is implemented inside `scripts/ui/strategy_weekend.gd` at `var debrief_page`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Strategy-capable weekend layout](strategy-weekend-view.md)
- [Practice-capable weekend layout](practice-weekend-view.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
