# Research-informed architecture review and improvement plan

## Scope and evidence

This review follows the first verified quality checkpoint (853/853 checks). Primary-source research covers Flecs, Bevy, EnTT, the author-maintained Game Programming Patterns book, official Godot best practices and JSON Schema. The accompanying `ARCHITECTURE-RESEARCH.md` records verified references and tradeoffs. Read-only reproductions identify the changes below; recommendations are applied to Littlewild's existing deterministic, data-only contracts.

## Implementation plan dispatched to a separate polishing agent

| Priority | Finding | Improvement and acceptance evidence |
| --- | --- | --- |
| P1 | A caller can edit a content preview's mechanical diff after review and bypass the committed-story policy. | Bind review identity to candidate/current registry revisions and recompute or verify policy against trusted reviewed data. Changed candidate/diff, fabricated or stale reviews cannot commit; ordinary valid reviews and deterministic continuation still pass. |
| P1 | A frozen inventory destination can throw after the source has been debited; a later malformed batch transfer can leave earlier transfers settled. | Preflight authoritative write targets and prepare the complete batch before mutation. Frozen/read-only/accessor targets fail before any debit, receipt or ECS projection changes. Existing mutable inventory semantics and settlement order remain characterized. |
| P2 | Locale-sensitive comparisons affect contested transfer ordering. | Use explicit locale-independent ordering for internal identifiers and assert order on mixed-case identifiers. Preserve stable sequence tie-breaking. |
| P2 | Failed engine initialization remains marked successful and retries silently skip hooks. | Define initializing/ready/failed lifecycle states, validate boundaries before starting, reject reentry and fail closed after hook failure. Successful initialization stays idempotent; partial instances never appear ready. |
| P2 | JSON Schema string lengths and runtime UTF-16 lengths disagree for Unicode text. | Count Unicode code points consistently at public schema boundaries; astral text at/beyond limits has matching CLI/runtime acceptance. |
| P2 | Architecture scanning allows wall-clock `Date()` and aliases. | Detect clock-producing calls with the same alias analysis as construction/property calls; add adversarial domain-policy regressions. |
| P2 | Build output protection checks lexical paths and may follow a symlink into protected inputs. | Resolve existing parent paths before validating destinations; preserve protected source/vendor/generated trees and original output on rejected destinations. |
| P2 | Sparse arrays with substituted named properties pass catalog descriptor-count checks. | Require exactly the dense own index set and reject added named properties/accessors; prove malformed vectors/catalog arrays fail without mutation. |

## Creature authoring extension

The additional user requirement adds co-located creature gameplay and visual data under `source/assets/creatures/<id>/`, explicit data-selected defaults and visual references, validated existing behavior tuning, and a nondefault archetype exercised through factory, ECS, presentation and real-engine save continuation. Adding or swapping an asset must not require a species-specific renderer branch. Definitions remain data-only and retain the shared required persistent contract. Authoring documentation and build discovery must match the new layout.

## Review and completion

A separate polishing agent implements this plan with focused regressions. Root independently reviews each change, rebuilds the standalone artifact and runs the full registered strict/architecture/domain/CLI/browser gate. Fresh source/artifact digests replace historical evidence. Only then is the completed follow-up pushed to PR #25 and current CI reviewed.

## Architectural decisions

Keep one authoritative persistent state, reference-bound transient ECS projections, explicit deterministic schedules and compiled trusted behaviors. Data-driven content defines validated capabilities rather than executable plugins. Defer an archetype/SOA ECS rewrite, cached queries, worker parallelism, event buses and pooling until profiling or a concrete ownership requirement demonstrates value; these introduce invalidation and ordering costs. The subsequent quality pass completed strict checking for all fifteen inventoried compatibility modules and ratcheted the typing-debt budget to zero. Process-global registry ownership remains a documented boundary; strict contracts do not establish multi-world isolation. Native quality policy remains unchanged; the integrated current-main scan reports zero findings.

## Expansion review dispatched to the architecture polishing agent

The independent follow-up review produced this concrete implementation plan for the expanded scenario, construction, terrain and presentation systems. This plan preserves the six deterministic ECS phases and the existing persistent simulation authority.

| Area | Change | Acceptance evidence |
| --- | --- | --- |
| Errors and events | Define inward, value-only runtime result codes, event payloads and geometry contracts; use shared aliases instead of incompatible declarations in each feature. | Strict compilation, discoverable developer failure codes, and unchanged synchronous `temper` gameplay effects. |
| Application composition | Declare the compiled adapter installation order, wrapped predecessors and method ownership in one closed manifest. | Missing roles, reordered or duplicate installation and undeclared changes fail; the real facade installs once and preserves continuation. |
| Authored data and configuration | Record each shipped JSON catalog, ruleset, schema and scenario's owner and compiled validation role. | Architecture checks reject missing ownership and invalid bindings without allowing JSON to select executable validators. |
| Type boundaries | Assign project type contracts to bounded contexts and check type-only dependencies, including presentation-only DOM contracts. | Negative fixtures catch outward type dependencies; existing physical line budgets and strict compiler checks remain enforced. |
| Presentation replacement | Keep the current renderer behind a default adapter; expose a registry, lifecycle, detached scene values and validated command intents to developer plugins. | A real custom renderer switches and disposes correctly, observes interiors and authored visuals, and cannot mutate simulation through frame values. |
| Shared spatial authority | Construction footprints, interior floor layouts and terrain walkability use the same persisted geometry and movement rules. | Paid construction and production survive native and portable checkpoints; vertical additions preserve an existing foundation; rejected edits leave active work unchanged. |

Feature implementation agents own their systems; a separate integration agent owns bootstrap and SDK wiring. An independent final review follows actual browser captures and combined runtime checks. Current delivery identities and complete gate counts belong in `VERIFICATION.md`, not in historical checkpoints above.

## World and Scene Editor follow-up

The systemic-design state-space map becomes authored world/scene topology rather than executable callbacks. A scene identifies its world, optional parent, closed entry rules and events, links, and canonical entities; links may cross worlds. Building floors and owned islands bind their existing native authorities. A separate revisioned draft session owns authoring and history, and presentation only emits authoring intent.

The implementation is dispatched to the World and Scene Editor agent with separate runtime and UI contributors. Independent code/visual review and an additional CLI/schema/SDK review inspect the final combined result. Acceptance requires real placement and whole-pack exchange, desktop/mobile keyboard controls, reviewed atomic transitions, exact dormant work continuation, compatible native and portable persistence, coherent libraries, bounded nonrecursive checkpoints, and renderer-visible scene props. No new timer, inventory authority, script loader or world simulation is introduced for an editor view.

## Renderer, editor interchange and creature authoring follow-up

These additions extend the earlier toolbox recommendation after the user explicitly requested actual ExcaliburJS and PixiJS rendering. The original Excalibur source review remains the evidence for lifecycle and developer API patterns; the pinned distributed 0.32.0 graphics API is the implementation reference for the renderer. A presentation adapter does not replace the persistent simulation or its schedule.

| Area | Implementation assigned to | Required review evidence |
| --- | --- | --- |
| ExcaliburJS / PixiJS | Renderer implementation agent; shared integration agent owns bootstrap | Actual library graphics, visible canonical creature/building geometry, offline CSP diagnostics, no extra tickers, disposal and bounded asynchronous preparation. Selection, first draw and embedded-panel failures preserve the prior renderer and dimensions. |
| Scene composition | Renderer implementation agent | A 3D scene displays a 2D minimap/panel from its own or a dormant scene snapshot without advancing that scene. Cross-world references, dimension compatibility, cycles and mobile control overlap are checked. |
| Tiled / LDtk / Blender / Godot | External editor interoperability agent | Standard documents pass their applicable official schemas; file input, programmatic APIs and real CLI processes perform reviewed edits. Native rules, inventory, paid work and fractional unchanged positions survive. Actual Godot GLB re-export and translation edits supplement codec regressions. Static proxy geometry has explicit limits. |
| Obsidian Canvas / Advanced Canvas | Dedicated Canvas interoperability agent | Standard nodes/edges and supported plugin metadata describe worlds, scenes, hierarchy and connections. Layout/style provenance stays inert. Renames, links and supported configuration edits revalidate the whole pack; unsupported portals or external references produce actionable diagnostics. |
| 3D Creature Editor | Dedicated creature editor agent | The canonical primitive/rig renderer displays a real editable creature. Data-catalog forms edit archetype tuning, future defaults and current companion values through their native validators. Bounded package exchange, collisions, selection identity, undo/redo, stale reads, reviewed apply/cancel, mobile/keyboard interaction and exact retained paid-state continuation are checked. |

The independent final reviewer checks implementation and actual browser output separately from each owner's tests. The source freezes only after reported defects are resolved. The complete gate then runs from an immutable source checkpoint; final delivery records identify that checkpoint and the generated standalone artifact rather than borrowing counts from the earlier editor or expansion checkpoints.

## Storytelling, animation, code generation and balancing follow-up

The expanded authoring request adds explicit authored storytelling alongside the systemic simulation. Storyboards describe shots, intentions, relationships and feedback; cutscene timelines describe supported presentation changes. Neither creates another gameplay model. References remain stable across worlds and scenes, and scene transitions retain the existing checkpoint, requirement and review authority.

- The storytelling core agent owns versioned storyboard/cutscene data, deterministic keyframe sampling, playback state, bounded references and event intents. A separate editor UI agent owns visual shot/timeline authoring and its actual desktop/mobile acceptance.
- The renderer agent adds real p5.js drawing in instance mode, driven by the existing presentation host, with typed trusted extensions and bounded data-selected presets. Animation libraries cannot advance native work or consume gameplay RNG. Detached 3D playback must interpret canonical assets directly rather than temporarily writing the live engine or global catalogs.
- The engine export agent owns a distinct versioned code-generator JSON artifact: implementation sources, contracts, schemas, assets, capabilities, schedules, persistence/units/RNG contracts, dependency provenance and Godot mapping requirements. Exported source text is inert input for a generator, not executable scenario content. Export completeness is checked against the build inventory.
- The balancing specialist owns one editable document and its validation, diff, application and deterministic comparison tools. Existing canonical validators remain authoritative. Remaining numerical gameplay tuners are distinguished from mathematical, format and grid invariants; declared tuners must affect real simulation rather than exist only in documentation.

Combined acceptance includes visible sampled animation, pause/seek/skip/replay/disposal, retained native work and RNG, event requirements and bounded cycles, whole-pack storyboard/timeline continuation, malformed/stale import rejection, code-generator inventory integrity and seeded balancing comparisons with conserved resources. These additions extend the final source freeze and complete gate; earlier green checkpoints remain scoped historical evidence.
