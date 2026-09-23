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

Implementation target: **Godot 4.7.2 standard / GDScript / Compatibility renderer**. Native project version **0.2.0**. Documentation describes implemented behavior, not a proposed future architecture.

## Current iteration

[Iteration 2: race and designer foundation](iteration-2.md) records the reviewed defects, implementation changes, interaction contract, test matrix and remaining boundaries.
