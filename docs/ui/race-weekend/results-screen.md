# Full session results and evidence

## Integrated components

RaceResultsWorkspace + SessionResultsPanel + RaceJournalView + RaceStintHistory.

## Information contract

Classification, recorded laps/sectors, actual fitted stint intervals and structured accepted-command/observed-outcome records are dedicated review pages. Reuses the same classification Tree and selection. Qualifying, practice, lapped finishers, DNF and unavailable/live states remain semantically distinct.

## Interaction and safety

Completion opens session review; reopening/closing restores the original table parent. Next is explicit and disabled for unfinished sessions. Export/debrief/notebook/replay route to established host actions. A pit visit duration is not net race-time loss; experiments cannot replace original result receipts.

## Shared acceptance

Use the [layout](layout-system.md), [responsive](responsive-behaviour.md), [accessibility](accessibility.md) and [interaction](interaction-model.md) contracts. Rendering this screen does not create a command or alter pause/speed. Actual executable coverage is recorded in [verification](verification-completion.md).

## Finishing contract

Lap/run coordinates, padded measured ranges, invalid/pit annotations and compatible own-driver comparison are integrated. Practice uses recorded lap duration, not the crossing timestamp. Fitted-stint inspection and explicit entry/exit-correlated visit selection provide bounded text alternatives; absence of evidence is not a completed visit.

See [SC00–SC14](finish-specification.md) and the [finishing ledger](finish-ledger.md) for current acceptance evidence.
