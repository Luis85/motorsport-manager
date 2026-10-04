---
id: "campaign-error"
title: "Campaign needs attention"
description: "Displays a blocked campaign entry/resume error and a focused Main menu recovery button."
kind: "page"
surface: "shipping"
source: "scripts/composition/campaign_screens.gd"
symbol: "CampaignError"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
source_selector: "_show_campaign_error"
---

# Campaign needs attention

Displays a blocked campaign entry/resume error and a focused Main menu recovery button.

## Intent and purpose

Expose a campaign entry failure visibly instead of presenting incomplete management data. The page is a small recovery destination for invalid catalog, creation, loading, checkpoint, projection or unavailable active-weekend cases.

## User goals

Understand why the campaign cannot open and return to the main menu without being given fabricated campaign facts.

## Used components

Native heading/message labels and a primary Main menu button use [Native UI helpers](ui.md). [Pitwall design](pitwall-design.md) focuses that button; [Campaign screen composition](campaign-screens.md) supplies the error message.

## Interactions

The sole action calls show_menu. The view does not offer automatic repair, departure or time advancement. Failed explicit transactions from an otherwise open desk use notification dialogs instead of this page.

## Links to other pages

[Campaign screen composition](campaign-screens.md) mounts this page when entry fails. Main menu returns to [Main menu](main-menu-view.md); successful entry uses [Campaign Director Desk](campaign-director-desk.md) or the active [Minimal race layout](minimal-race-workspace.md).

## Behavior and state

_show_campaign_error renders the supplied failure message in the content region. It does not synthesize a checkpoint, repair missing frozen content or advance time. Transaction/save errors also use native notifications; the error view is an actual recovery destination rather than a separate campaign authority.

## Source and integration

Implementation: [scripts/composition/campaign_screens.gd](../../../scripts/composition/campaign_screens.gd) (`_show_campaign_error`).

## Interface

This entry is implemented inside `scripts/composition/campaign_screens.gd` at `_show_campaign_error`; it is not a separate global GDScript class. Use the owning script's API and lifecycle.

## Related documentation

- [Campaign screen composition](campaign-screens.md)
- [docs/reference/campaign/director-desk-first-loop.md](../campaign/director-desk-first-loop.md)
- [Component catalog](README.md)
