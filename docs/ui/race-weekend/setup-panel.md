# Setup

## Integrated components

RacecraftPanel with synchronized sliders and numeric drafts.

## Information contract

Wing, balance, suspension, cooling and brake bias are the implemented axes. Model-derived draft corner/straight/traction effects are shown while current tyre/surface assumptions are held constant.

## Interaction and safety

Sliders and numeric values update the same draft. Apply remains explicit and garage-gated. Live brake bias retains its existing separate command. Unsupported anti-roll/gear/pressure controls are not inert decorations.

## Shared acceptance

Use the [layout](layout-system.md), [responsive](responsive-behaviour.md), [accessibility](accessibility.md) and [interaction](interaction-model.md) contracts. Rendering this screen does not create a command or alter pause/speed. Actual executable coverage is recorded in [verification](verification-completion.md).
