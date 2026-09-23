# Project documentation

| Document | Purpose |
|---|---|
| [Getting started](getting-started.md) | Import in Godot, first weekend, first custom track, troubleshooting |
| [Architecture](architecture.md) | Modules, ownership, scene composition, fixed-step/render separation |
| [Track editor](track-editor.md) | Tools, exact curve insertion, pits, features, reference images, saves |
| [Track formats](track-format.md) | Native authoring, Circuit Atelier imports, compiled runtime contract |
| [Grand Prix weekend](race-weekend.md) | Session flow, pit-wall actions, classification and player decisions |
| [Simulation](simulation.md) | Geometry, speed envelope, traffic, tyres, fuel, weather, incidents |
| [Persistence](persistence.md) | Local storage, backup writes, settings, checkpoints, validation |
| [Verification](verification.md) | Reproducible tests, CI, acceptance checks, coverage limits |
| [Port status](port-status.md) | Source baselines, implemented parity, simplifications and exclusions |
| [Graphics](graphics.md) | Art direction, deterministic illustration, cache ownership and preferences |
| [Tyres and strategy](tyres-and-strategy.md) | Finite allocations, plan/fit lifecycle, scheduled stops and continuity |

Implementation target: **Godot 4.7.2 standard / GDScript / Compatibility renderer**. Native project version **0.3.0**. Documentation describes implemented behavior, not a proposed future architecture.


## Current iteration

[Iteration 3: a calmer circuit world](iteration-3.md) describes the implemented graphics and prototype-parity slice. [Iteration 2](iteration-2.md) is retained as historical release documentation; its checkpoint/version statements apply to that release.
