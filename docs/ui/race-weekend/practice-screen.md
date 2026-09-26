# Two-driver engineering dashboard

## Integrated components

RacePracticeWorkspace + RacePracticeProgrammeCard + PracticePanel.

## Information contract

Both actual drivers have simultaneous programme grids for tyre-life, qualifying preparation, setup comparison and wet-condition learning. Each shows real used/fresh set, measured lap target, setup on release, estimated duration/fuel and measured run evidence.

## Interaction and safety

Drafts are shared with the compact editor but independent across drivers. Start affects the optional session; Run and Recall name one driver. End follows the existing confirmation/physical-return behavior. No hidden setup score, free tyres or fabricated five-star completion progress.

## Shared acceptance

Use the [layout](layout-system.md), [responsive](responsive-behaviour.md), [accessibility](accessibility.md) and [interaction](interaction-model.md) contracts. Rendering this screen does not create a command or alter pause/speed. Actual executable coverage is recorded in [verification](verification-completion.md).

## Finishing contract

Dashboard and inspector share both the per-driver drafts and genuine edited flags. Complete sessions prioritize recorded programmes, actual duration/sample quality and observed costs rather than a fresh run estimate. Practice-only edits receive the same safe-exit warning. Zero comparable clean samples retains baseline estimates truthfully.

See [SC00–SC14](finish-specification.md) and the [finishing ledger](finish-ledger.md) for current acceptance evidence.
