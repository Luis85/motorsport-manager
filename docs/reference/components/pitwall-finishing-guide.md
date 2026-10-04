---
id: "pitwall-finishing-guide"
title: "Pitwall finishing guide"
description: "Customizes the composed Advanced guide with task-specific copy, targets, reveal callbacks and placement."
kind: "helper"
surface: "advanced"
source: "scripts/ui/pitwall_finishing_guide.gd"
symbol: "PitwallFinishingGuide"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "RefCounted"
---

# Pitwall finishing guide

Customizes the composed Advanced guide with task-specific copy, targets, reveal callbacks and placement.

## Intent and purpose

Keep Advanced onboarding copy and placement separate from pitwall construction and command logic.

## User goals

Understand setup, finite tyres, decision confirmation, telemetry, shared pit service and original-result provenance while the relevant controls remain reachable.

## Used components

- [Context guide](context-guide.md)
- [Practice engineering layout](race-practice-workspace.md)
- [Full analysis layout](race-analysis-workspace.md)
- [Race observation layout](race-observation-workspace.md)

This helper supplies presentation behavior/resources to these consumers or depends on them; it is not an independently mounted page.

## Interactions

configure runs on an already-built pitwall and changes guide steps/reveal targets. The placement callback chooses the visible programme/full workspace or observation region. Next/Back reveal existing tasks; described commands still need their own explicit approval.

## Behavior and state

configure receives the constructed pitwall host. PR 28 extracts this responsibility from PitwallWorkspace. Practice/full-analysis placement uses the current visible workspace; reveals navigate existing controls without executing the guide's described race actions.

## Source and integration

Implementation: [scripts/ui/pitwall_finishing_guide.gd](../../../scripts/ui/pitwall_finishing_guide.gd) (`PitwallFinishingGuide`, extends `RefCounted`).

Referenced by [scripts/ui/pitwall_workspace.gd](../../../scripts/ui/pitwall_workspace.gd).

## Interface

Primary presentation entry points:

- `configure(host) -> void`

This helper declares no custom intent signals. The host supplies callbacks or observes the native controls it constructs.

## Related documentation

- [Engineering pitwall layout](pitwall-workspace.md)
- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)

## Links to other pages

- [Engineering pitwall layout](pitwall-workspace.md) — owning/consuming workflow.
- [Practice engineering layout](race-practice-workspace.md) — owning/consuming workflow.
- [Full analysis layout](race-analysis-workspace.md) — owning/consuming workflow.
- [Session review layout](race-results-workspace.md) — owning/consuming workflow.
