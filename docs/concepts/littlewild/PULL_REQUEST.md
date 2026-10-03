# Littlewild: quality hardening, creature assets and typed developer toolbox

Littlewild preserves its existing data-driven worlds/creatures and deterministic ECS M1–M6. This update fixes atomic settlement, reviewed-content integrity, initialization, Unicode/schema parity, CLI I/O and verification/architecture gaps. Cohesive typed services replace oversized compatibility, UI and renderer modules; all Littlewild source fits the repository line budgets without exceptions.

Creature gameplay and visual manifests now live together under `source/assets/creatures/<id>/`. Catalog defaults, reusable visual references, physiology and additional owned ECS components are validated data. A second archetype regression covers discovery, real recruitment, rendering, story roundtrip and deterministic continuation without species-specific branches.

A typed developer toolbox exposes scenario/session lifecycle, compiled commands, bounded fixed steps, detached observations, reviewed checkpoints and catalog validation in Node and browser hosts. It includes generated declarations, a runnable headless example, and a coding-agent guide. Host leases and registry fingerprint checks make the existing single-active-context boundary explicit.

Research draws on verified official Flecs/Bevy/EnTT/Excalibur sources, Game Programming Patterns, Godot, JSON Schema and the supplied Playtank text. The separate improvement plan was implemented and independently reviewed. The complete clean-checkout gate passed **915/915 checks across 32 suites**; supplementary shipping-browser SDK checks passed 3/3. Exact source/artifact identities and limits are in `VERIFICATION.md` and `delivery-manifest.json`.

AJV's supported security fix removes the reported advisory; official shared workflow actions are immutable supported releases. Native gameplay source is unchanged. Native legacy advisory findings and 15 explicit compatibility typing modules remain visible; these are not described as resolved or hidden behind exclusions. Headless tests do not establish human usability/balance, hardware GPU behavior or full device/accessibility conformance.
