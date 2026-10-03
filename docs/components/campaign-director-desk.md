---
id: "campaign-director-desk"
title: "Campaign Director Desk"
description: "Presents a detached management overview with cash, committed minimum cash, next event, energy, standing, priorities, work, rivals and debrief."
kind: "page"
surface: "shipping"
source: "scripts/ui/campaign/director_desk.gd"
symbol: "CampaignDirectorDesk"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Campaign Director Desk

Presents a detached management overview with cash, committed minimum cash, next event, energy, standing, priorities, work, rivals and debrief.

## Intent and purpose

Give the team principal one dated management overview before committing to the next event. The desk brings cash, reserve pressure, energy, standing, priorities, scheduled work, rival summaries and factual debrief into the same read-only projection.

## User goals

Understand the team’s current position, see what needs attention, follow the first campaign loop, and explicitly advance to or depart for the next event.

## Used components

Native status panels, priority panels, work/rival/debrief columns and onboarding rows use [Minimal race style](minimal-race-style.md). [Pitwall design](pitwall-design.md) restores focus to the primary action or Main menu.

## Interactions

Advance to event and Start next event emit different intents according to the projected slot; neither reading nor showing the guide performs those transactions. Show/Hide guide emits a preference intent. Main menu exits through [Campaign screen composition](campaign-screens.md). Departure failures are reported by composition through a notification.

## Links to other pages

[Main menu](main-menu-view.md) opens the campaign; [Campaign screen composition](campaign-screens.md) mounts this desk or resumes an active event in the [Minimal race layout](minimal-race-workspace.md). [Campaign error](campaign-error.md) handles failed campaign loading/projection.

## Behavior and state

configure receives the projection, text scale and hidden-guide preference before mounting. Buttons emit menu, advance, departure and guide-visibility intents; reading the desk never settles money or advances the campaign. Departure blockers are rendered from the projection.

## Source and integration

Implementation: [scripts/ui/campaign/director_desk.gd](../../scripts/ui/campaign/director_desk.gd) (`CampaignDirectorDesk`, extends `VBoxContainer`).

Referenced by [scripts/composition/campaign_screens.gd](../../scripts/composition/campaign_screens.gd).

## Interface

Primary presentation entry points:

- `configure(value: Dictionary, scale: float = 1.0, hidden_guide: bool = false) -> void`

Emitted intent signals:

- `menu_requested`
- `advance_requested`
- `start_event_requested`
- `guide_visibility_requested(hidden: bool)`

## Related documentation

- [docs/campaign/director-desk-first-loop.md](../../docs/campaign/director-desk-first-loop.md)
- [Component catalog](README.md)
