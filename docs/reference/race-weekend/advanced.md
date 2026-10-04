# Advanced race-weekend interface

Minimal is the default. **Settings → Race interface → Advanced → Apply** selects
the retained Race Director or Engineering starting surface for the next opening
of a weekend. Both use the same authoritative weekend, recording and application
scheduler. Navigation and inspection do not issue racing commands or advance time.

Race Director presents the retained decision and observation workspaces;
Engineering opens the specialist tools directly. These are optional native
interfaces, with broader controls than Minimal's five driver actions and read-only
Strategy comparison. Choosing Advanced does not imply every retained tool is
human-validated or every historic screen description is current.

## Find the current contract

| Responsibility | Current reference |
|---|---|
| Interface selection and supported scope | [Current status](../current-state.md), [settings](../components/settings-view.md) |
| Composition, navigation and decisions | [Race Director](../components/race-director-workspace.md), [pitwall](../components/pitwall-workspace.md) |
| Strategy and observations | [Strategy desk](../components/strategy-desk.md), [comparison](../components/pitwall-comparison.md), [race reading](../components/race-read-panel.md) |
| Tyres, physical service and recovery | [Tyre/strategy contract](tyres-and-strategy.md), [service](../components/race-pit-service-panel.md), [recovery](../components/recovery-panel.md) |
| Measured practice and qualifying | [Practice](../components/race-practice-workspace.md), [qualifying](../components/race-qualifying-workspace.md) |
| Weather, surface and racecraft | [Weather](../components/weather-panel.md), [surface](../components/surface-lab.md), [racecraft](../components/racecraft-panel.md) |
| Replay, sandbox and authored challenges | [Replay workspace](../components/replay-workspace.md), [scenario author](../components/scenario-author.md), [persistence](../persistence.md) |
| Results, journal and personal history | [Results](../components/race-results-workspace.md), [journal](../components/race-journal-view.md), [notebook](../components/notebook-window.md) |

The [component catalog](../components/README.md) connects every retained workspace to
its source, state and commands. Command validators decide legality; opening a tool
does not grant a second simulation or bypass finite resources and save boundaries.

## Historical design and acceptance

The [archive](../../_archive/README.md) retains the 0.14 screen/state specifications,
subsequent Race Director research, and feature handoffs for strategy, weather,
recovery, practice, rivals, duels, replay, authoring and notebook. They describe
their named revisions. Consult current source and the component catalog for
present integration, and [verification](../../how-to/verification.md) for new acceptance.
