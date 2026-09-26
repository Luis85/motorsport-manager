# Tyres

## Integrated components

RaceTyreReadout + existing allocation/wheel/stop presenters.

## Information contract

The compact readout separates physically fitted set identity from the planned next set. Allocation, weakest wheel, finite inventory and actual stint history remain authoritative.

## Interaction and safety

Choosing a set plans it; physical release/formation/service fits it. No stock is created by a UI action. Existing selection legality, used-set damage and explicit scheduling/cancellation remain unchanged.

## Shared acceptance

Use the [layout](layout-system.md), [responsive](responsive-behaviour.md), [accessibility](accessibility.md) and [interaction](interaction-model.md) contracts. Rendering this screen does not create a command or alter pause/speed. Actual executable coverage is recorded in [verification](verification-completion.md).
