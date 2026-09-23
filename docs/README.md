# Motorsport Manager documentation

Current native implementation: **0.5.0** · **Godot 4.7.2 Standard**.

| Document | Purpose |
|---|---|
| [Race-weekend strategy handoff](race-weekend-implementation.md) | Current 0.5 controls, ownership, forecasts, v5 persistence, tests and remaining GDD work |
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
| [Persistence](persistence.md) | Atomic saves and base checkpoint migrations; see the 0.5 handoff for v5 |
| [Verification](verification.md) | Automated checks, reports and environment boundaries |
| [Port status](port-status.md) | Current acceptance scope and unimplemented systems |

[Iteration 2](iteration-2.md) and [Iteration 3](iteration-3.md) are historical release records. Their old version numbers and then-unimplemented features should not be read as current state. Prototype behavior is the source reference; new native UI/algorithm decisions and simplifications are documented as adaptations, not silently described as source parity.

The 0.5 handoff is authoritative for the new strategy application. The 0.4 system documents remain detailed references for the unchanged base simulation/editor; their earlier single-owner and v4-current descriptions are superseded by the handoff. Stage A acceptance and the later GDD stages are explicitly tracked there, not silently marked complete.
