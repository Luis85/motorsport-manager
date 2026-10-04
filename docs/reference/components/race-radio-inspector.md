---
id: "race-radio-inspector"
title: "Race radio inspector"
description: "Shows bounded native message cards with filters, live mode and explicitly frozen history paging."
kind: "component"
surface: "advanced"
source: "scripts/ui/race_weekend/radio_inspector.gd"
symbol: "RaceRadioInspector"
status: "implemented"
source_pr: 28
source_commit: "c02b09585eccf90a26e1a3296386a3980b059069"
extends: "VBoxContainer"
---

# Race radio inspector

Shows bounded native message cards with filters, live mode and explicitly frozen history paging.

## Intent and purpose

The intent is to make the bounded event feed readable during observation. Its purpose is to provide live newest-first radio cards and an explicit frozen snapshot for browsing earlier retained messages.

## User goals

- Filter flags/incidents, pit decisions, tyre condition or weather messages.
- Browse older retained events without losing a fixed reading position.
- Return to the latest feed and recognize when no messages match or earlier history is unavailable.

## Used components

Uses eight persistent card surfaces built with [PitwallDesign](pitwall-design.md) and [UI helpers](ui.md), native buttons, an `OptionButton`, captions and labels. A hidden `RichTextLabel` is retained for compatibility; the visible presentation is the cards.

## Interactions

Live returns to newest-first events and page zero. History deep-copies the retained events; Older also freezes the feed before advancing. Newer/Older paginate eight matching events, with boundary buttons disabled. Changing the category resets page zero and emits `filter_changed(index)`. The caption names LIVE or HISTORY SNAPSHOT, page count, retained count, the 2000-event limit and earliest retained timestamp. These are reading actions and do not pause the session. Command acknowledgements/errors are separately available through the host’s Messages action.

## Links to other pages

- [Scrollable inspector page](race-inspector-page.md)
- [Base Advanced host](weekend-view.md)
- [Messages and full-view navigation](pitwall-workspace.md)

## Behavior and state

configure binds RaceViewQuery. History or Older copies retained events; Live resumes newest-first observation without changing race playback. Eight stable cards render each page, unavailable matches have an explicit caption, and the retention limit/earliest retained timestamp prevent implying complete unlimited history.

## Source and integration

Implementation: [scripts/ui/race_weekend/radio_inspector.gd](../../../scripts/ui/race_weekend/radio_inspector.gd) (`RaceRadioInspector`, extends `VBoxContainer`).

Referenced by [scripts/ui/weekend.gd](../../../scripts/ui/weekend.gd), [scripts/ui/weekend_support.gd](../../../scripts/ui/weekend_support.gd).

## Interface

Primary presentation entry points:

- `configure(value: RaceViewQuery) -> void`
- `present() -> void`

Emitted intent signals:

- `filter_changed(index: int)`

## Related documentation

- [docs/_archive/ui/race-weekend/component-catalog.md](../../_archive/ui/race-weekend/component-catalog.md)
- [Component catalog](README.md)
