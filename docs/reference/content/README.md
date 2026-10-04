# Content documentation

The game loads editable gameplay definitions from the built-in `config/` catalog
and selected external folder packs. New weekends and Team Principal careers freeze
their resolved definitions; later file edits affect future selections. The native
runtime uses the pinned Godot 4.7.2 build.

Choose a document for the task you want to complete. Current capabilities and
release evidence belong to [current project status](../current-state.md), while
[the refactor ledger](../../_archive/content/refactor-status.md) preserves historical implementation work.

## Learn by doing

[Create your first content pack](../../tutorials/author-a-pack.md) walks through adding a custom
vehicle, validating it and selecting it in the game.

## Complete an authoring task

| Task | Guide |
|---|---|
| Load ordered dependencies, clone across packs or compare compositions | [Multi-pack authoring](../../how-to/content/multi-pack-authoring.md) |
| Publish a circuit, illustration style or complete-weekend brief | [Circuits and scenarios](../../how-to/content/circuits-and-scenarios.md) |
| Choose a weekend and its shared race model | [Weekends and tuning](../../how-to/content/weekends-and-tuning.md) |
| Customize Circuit Atelier placements and guide copy | [Editor profiles](../../how-to/content/editor-profiles.md) |
| Inspect, edit and compare shipped balancing settings | [Balancing configuration](../../how-to/balancing.md) |

## Look up a contract

| Definition or boundary | Reference |
|---|---|
| Pack manifest, strict JSON, IDs, overrides, limits and frozen content | [Pack contract](pack-contract.md) |
| Teams, drivers and event entries | [Rosters](rosters.md) |
| Compounds, finite tyre allocations, thermal coefficients and setup | [Tyres and setup](tyres-and-setup.md) |
| Fuel, pace, service, condition, session and balance groups | [Race tuning fields](race-tuning-fields.md) |
| Weather, road surface and public outlook | [Weather and surface](weather-and-surface.md) |
| Scalar reliability, incidents and supported race control | [Reliability and control](reliability-and-control.md) |
| Rival profiles, passing, movement and team policy | [Competition and AI](competition-and-ai.md) |
| Registered mechanic-provider selection | [Mechanic profiles](mechanic-profiles.md) |
| Campaign definitions and frozen career policies | [Campaign content](campaigns.md) |
| Published schema fields and production owners | [Consumer inventory](consumer-inventory.md) |
| Format versions, omission behavior and migration policy | [Version compatibility](version-compatibility.md) |

The [generated schemas](../../../content/schemas/v1) are the editor-facing projection
of the production `ContentSchema` contract. The family guides explain consumers
and units; native validation also checks references and cross-field constraints.

## Understand a design decision

[Persisted numeric identity](../../explanation/persistence-numbers.md) explains why saved decimal
values need exact decoding to preserve deterministic replay.

[Reference index](../README.md) · [Documentation home](../../README.md).
