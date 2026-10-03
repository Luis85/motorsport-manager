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

Keep one authoritative persistent state, reference-bound transient ECS projections, explicit deterministic schedules and compiled trusted behaviors. Data-driven content defines validated capabilities rather than executable plugins. Defer an archetype/SOA ECS rewrite, cached queries, worker parallelism, event buses and pooling until profiling or a concrete ownership requirement demonstrates value; these introduce invalidation and ordering costs. The subsequent quality pass completed strict checking for all fifteen inventoried compatibility modules and ratcheted the typing-debt budget to zero. Process-global registry ownership remains a documented boundary; strict contracts do not establish multi-world isolation. Native legacy advisory debt is outside this Littlewild audit and remains visible.
