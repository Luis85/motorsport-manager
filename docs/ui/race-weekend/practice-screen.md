# Two-driver engineering dashboard

## Integrated components

RacePracticeWorkspace + RacePracticeProgrammeCard + PracticePanel.

## Information contract

Both actual drivers have simultaneous programme grids for tyre-life, qualifying preparation, setup comparison and wet-condition learning. Each shows real used/fresh set, measured lap target, setup on release, estimated duration/fuel and measured run evidence.

## Interaction and safety

Drafts are shared with the compact editor but independent across drivers. Start affects the optional session; Run and Recall name one driver. End follows the existing confirmation/physical-return behavior. No hidden setup score, free tyres or fabricated five-star completion progress.

## Shared acceptance

Use the [layout](layout-system.md), [responsive](responsive-behaviour.md), [accessibility](accessibility.md) and [interaction](interaction-model.md) contracts. Rendering this screen does not create a command or alter pause/speed. Actual executable coverage is recorded in [verification](verification-completion.md).
