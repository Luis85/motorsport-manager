# Motorsport Manager documentation

Current native implementation: **0.7.0** · **Godot 4.7.2 Standard**.

| Document | Purpose |
|---|---|
| [Uncertain weather handoff](race-weekend-weather.md) | Current 0.7 seeded weather, public forecasts, crossover calls, v7 migration, scenarios and verification |
| [Living racecraft and team handoff](race-weekend-living-racecraft.md) | Preserved 0.6 battles, team orders, public rival responses, v6 persistence and verification |
| [Race-weekend strategy handoff](race-weekend-implementation.md) | Historical 0.5 milestone; retained strategy controls, ownership and forecast assumptions |
| [Getting started](getting-started.md) | Open the project and exercise the playable workflows |
| [Iteration 4](iteration-4.md) | Delivered racecraft, editor and interaction changes |
| [Feature parity](feature-parity.md) | Source-to-native status, adaptations and explicit gaps |
| [Interaction design](interaction-design.md) | Observation, drafts, commands, guides and error recovery |
| [Architecture](architecture.md) | Ownership, modules and extension boundaries |
| [Race weekend](race-weekend.md) | Sessions, pit-wall decisions, timing and classification |
| [Simulation](simulation.md) | Fixed step, geometry, traffic, tyres and conditions |
| [Tyres and strategy](tyres-and-strategy.md) | Finite sets, four-wheel condition and physical stop planning |
| [Track editor](track-editor.md) | Authoring, selection, trace, calibration and validation |
| [Track formats](track-format.md) | Editable/native exchange and baked runtime schema |
| [Graphics](graphics.md) | Cozy illustration, dots, preferences and caching |
| [Persistence](persistence.md) | Atomic saves and base checkpoint migrations; see the 0.7 handoff for current v7 |
| [Verification](verification.md) | Automated checks, reports and environment boundaries |
| [Port status](port-status.md) | Current acceptance scope and unimplemented systems |

[Iteration 2](iteration-2.md) and [Iteration 3](iteration-3.md) are historical release records. Their old version numbers and then-unimplemented features should not be read as current state. Prototype behavior is the source reference; new native UI/algorithm decisions and simplifications are documented as adaptations, not silently described as source parity.

The 0.7 handoff is authoritative for current weather behavior and v7 application checkpoints. The 0.6 handoff remains authoritative for preserved battle/team behavior and its remaining GDD acceptance gates. The 0.5 handoff records the preceding strategy milestone and remains useful for retained controls/model assumptions. The 0.4 system documents describe the preserved base simulation/editor; their single-owner and v4-current statements are superseded by the later handoffs. No stage is declared human-playtest complete solely because automated checks pass.
