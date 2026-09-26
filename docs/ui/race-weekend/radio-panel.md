# Radio

## Integrated components

RaceRadioInspector.

## Information contract

Eight persistent native message cards per page, category filters, newest-first Live and an explicit frozen History snapshot. Empty filters are explained; older events are paged rather than growing unbounded controls.

## Interaction and safety

History does not pause the simulation. Live resets pagination to the latest feed. Filtering is observational. Command acknowledgements/errors remain separately recoverable in Messages.

## Shared acceptance

Use the [layout](layout-system.md), [responsive](responsive-behaviour.md), [accessibility](accessibility.md) and [interaction](interaction-model.md) contracts. Rendering this screen does not create a command or alter pause/speed. Actual executable coverage is recorded in [verification](verification-completion.md).
