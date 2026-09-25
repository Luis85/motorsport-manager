# Native race-weekend UI

This package documents the implemented UI-01–UI-10 migration on PR #12, built on the repaired source `0f450c542efc8864fef2b0dd32c2fad68be25c2e`.

The approved boards define hierarchy, colour, information roles and interaction rhythm. The game remains a native, illustrated dot-car manager. Generated portraits, Q1/Q2/Q3, additional setup axes, probability curves and unsupported telemetry are not substituted for real simulation data. See [implementation status](implementation-status.md) for the precise adaptations and [verification](verification-completion.md) for executed tests and remaining platform acceptance.

## Composition

`WeekendView` orchestrates the shared native components and maintains compatibility references used by the session extensions. `PitwallWorkspace` composes task navigation, the two-driver rail, queue, drawer and focused workspaces. `PracticeWeekendView` supplies the optional engineering dashboard and existing replay/notebook integration. The inheritance stack is retained as the command/orchestration boundary; extracted controls are real scene children, not parallel unused prototypes.

Persistent layers are the session header, task navigation, timing/circuit, own-driver cards and command feedback. A narrow viewport suppresses an empty attention queue; material decisions and driver-card review remain available. Focused analysis and full session review deliberately replace observation space without discarding drafts or issuing orders.

## Specifications

- [Design tokens](design-tokens.md), [layout](layout-system.md), [component catalog](component-catalog.md)
- [Interaction lifecycle](interaction-model.md), [accessibility](accessibility.md), [responsive behavior](responsive-behaviour.md)
- [Race](race-screen.md), [qualifying](qualifying-screen.md), [practice](practice-screen.md), [results](results-screen.md)
- [Strategy](strategy-panel.md), [telemetry](telemetry-panel.md), [tyres](tyres-panel.md), [setup](setup-panel.md)
- [Weather](weather-panel.md), [team](team-orders-panel.md), [radio](radio-panel.md), [surface](surface-panel.md)

Race state is read through the existing simulation. Components emit explicitly targeted intentions to the host. Only accepted domain commands mutate sporting state. UI presentation, selection, search and layout changes never advance time, take ownership, consume RNG, or apply a draft.
