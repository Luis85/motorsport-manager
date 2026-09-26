# Qualifying workspace

## Integrated components

RaceQualifyingWorkspace + shared observation surface.

## Information contract

Best valid lap, OUT/HOT/IN/BOX state, estimated latest feasible release and current run context replace race priorities. Traffic remains visible spatially. The model has one session, not mockup Q1/Q2/Q3.

## Interaction and safety

Release/recall use the existing physical route and finite set. No new hot lap is promised beyond the feasible release check. A completed qualifying session opens full review; untimed cars are not assigned pole evidence.

## Shared acceptance

Use the [layout](layout-system.md), [responsive](responsive-behaviour.md), [accessibility](accessibility.md) and [interaction](interaction-model.md) contracts. Rendering this screen does not create a command or alter pause/speed. Actual executable coverage is recorded in [verification](verification-completion.md).

## Finishing contract

New-release estimates are explicitly distinguished from the active lap countdown. Best-lap gaps refer to the fastest valid lap in this one session. Latest release uses elapsed session seconds; compact summaries retain that basis without truncation. Closed-session copy describes only eligible existing hot laps.

See [SC00–SC14](finish-specification.md) and the [finishing ledger](finish-ledger.md) for current acceptance evidence.
