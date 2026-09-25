# Full session results and evidence

## Integrated components

RaceResultsWorkspace + SessionResultsPanel + RaceJournalView + RaceStintHistory.

## Information contract

Classification, recorded laps/sectors, actual fitted stint intervals and structured accepted-command/observed-outcome records are dedicated review pages. Reuses the same classification Tree and selection. Qualifying, practice, lapped finishers, DNF and unavailable/live states remain semantically distinct.

## Interaction and safety

Completion opens session review; reopening/closing restores the original table parent. Next is explicit and disabled for unfinished sessions. Export/debrief/notebook/replay route to established host actions. A pit visit duration is not net race-time loss; experiments cannot replace original result receipts.

## Shared acceptance

Use the [layout](layout-system.md), [responsive](responsive-behaviour.md), [accessibility](accessibility.md) and [interaction](interaction-model.md) contracts. Rendering this screen does not create a command or alter pause/speed. Actual executable coverage is recorded in [verification](verification-completion.md).
