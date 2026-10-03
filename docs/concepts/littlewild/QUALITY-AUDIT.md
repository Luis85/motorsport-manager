# PR 25 code and test quality audit

This work starts from PR #25 commit `78ca533a3be2722de09c8efccba83e3838aa8b9b`. Littlewild remains an isolated browser concept under `docs/concepts/littlewild/`. Native Motorsport Manager gameplay is unchanged. Shared workflow action versions are updated to supported, immutable official releases.

## Inventory and completion boundary

GitHub reported no open repository issues and no unresolved PR #25 review threads at the start of this pass. The existing Littlewild M1–M6 implementation remains in place. Green historical workflows do not replace verification of this implementation.

The current source audit covers simulation transactions, component/task validation, deterministic continuation, library/catalog imports, composition lifecycle, navigation, persistence, command-line tools, architecture enforcement, source/module budgets, release output, and all registered browser workflows. Each new correctness fix has a focused regression in the registered gate.

## Defects resolved

| Boundary | Defect and resulting behavior | Regression evidence |
| --- | --- | --- |
| ECS execution | Registration/reentry and mutable actor scope could change an active step. Scheduling captures scope and guards execution privately. | ECS core |
| ECS transaction staging | A rejected late transfer specification could leave earlier commands queued for the next batch. All staging and execution paths clean transient commands. | Physical-world ECS |
| Physical production | Invalid job identity/output/reserved costs, depletion and counters could charge inputs or exceed inventory limits. Preflight rejects malformed state before mutation. | Physical-world ECS and integration |
| Economy | Combined research and statistic awards could bypass independent limits; XP addition could lose integer precision. Atomic settlement bounds the combined changes and rolls back failure. | Economy ECS and integration |
| Actor activity | Reused malformed paths/task phases and arithmetic overflow could mutate movement/work state. Validation precedes authoritative changes. | Actor activity |
| Composition | Failed definitions/factories could leave installed methods and duplicate predecessor chains on retry. Composition-owned descriptors and lifecycle state roll back. | Engine composition |
| Profiles and saves | Unsupported archetype IDs and edited public experience profiles could change behavior after reload. Compiled identity and captured-engine profile consistency are enforced. | Profile, scenario and integration |
| Story activation | A failure after installing libraries could leave profiles and libraries inconsistent. One transaction restores all registries and profiles. | Scenario domain |
| Schema objects | Inherited `toString`/`valueOf` properties could masquerade as schema-declared fields. Only own schema properties are accepted. | Content/scenario/catalog tests |
| Catalogs | Asset enumeration was mutable; malformed or executable-shaped manifest data could survive validation. Catalog lists and definitions are immutable, with exact renderer/creature contracts. | Assets and creatures |
| Navigation and histories | Grid indices could overflow; receipt sequence/history validation could permit reused identities or invalid times. Grid indexing and persisted history bounds now agree. | Domain |
| Local storage and clock | Deduplication skipped validation, provider errors lost diagnostics, and fine clock steps could advance without elapsed time. Validation, recovery diagnostics and relative clock tolerance are covered. | Storage and clock |
| CLI I/O | Ignored flags, output/input aliases and shared temporary names caused surprising behavior. Strict arguments, bounded reads and owned atomic temporary files preserve inputs and prior output. | CLI contracts |
| Verification | Claimed totals could disagree with evidence; failed subprocesses could lose logs or leak descendants. The gate validates explicit named results, records source identity, retains failures and bounds subprocess lifetimes. | Gate integrity |
| Architecture and release | Regex scans missed aliased/imported outward dependencies; a release filename regex missed authored JavaScript. Syntax analysis and recursive release scanning reject those paths. | Architecture policy and release |
| Browser diagnostics | Additional pages were unobserved and console warnings were ignored. All pages are monitored for uncaught errors, console warnings/errors and external requests. Deprecated shadow-map selection is removed. | Browser and browser contracts |

## Research follow-up and developer surface

The separate research-informed plan in `RESEARCH-IMPROVEMENT-PLAN.md` closes mutable content-review policy bypass, unwritable inventory/batch targets, locale-dependent settlement, partial initialization, Unicode discrepancies, callable wall-clock detection, canonical output paths and decorated sparse catalog arrays. Independent review additionally identified internal transaction-ID collisions and SDK Unicode discovery; both are covered by regressions.

Creature definitions and visuals are co-located under `source/assets/creatures/<id>/`; explicit defaults/visual references/physiology/extra owned components are data. A nondefault archetype is exercised through real recruitment, rendering, story roundtrip and deterministic continuation. The typed developer toolbox exposes validated intent and detached observations with explicit session/host ownership. Sources, systemic state map, Excalibur adaptations and authoring examples are in the linked research/toolbox documents.

CI exposed an unanchored verification ignore rule that hid four new source helpers. Anchoring generated `/verification/` and tracking authored helpers corrected the clean-checkout failure; the final full gate ran from a committed git archive.

## Refactoring and typing

Focused modules preserve one authoritative engine and the existing facade/record contracts. Extractions retain task order, receiver/predecessor behavior, persisted fields, random draws and presentation timing. The machine-readable ownership map registers every runtime module. New services and infrastructure use explicit strict TypeScript ports.

All fifteen inventoried legacy domain/application modules now pass the integrated strict compiler through explicit content, actor, inventory, job, persistence, and application capability contracts. The architecture inventory has no remaining strict-typing debt, and its budget is zero. No `any`, TypeScript suppression, or size exception replaces the former debt. Pure world save validation is a focused service; prototype-installed services declare their actual typed methods and fields. This coverage does not claim strict semantic checking for every presentation module.

Additional boundary regressions reject sparse, inherited, accessor, and callback-shaped dice; protect cached probability results; reject nonfinite arithmetic; and preserve scenario capture and current interaction commitments. `RULES.md` documents the implemented RPG arithmetic and the friendly-duel rules boundary. Process-global content registries remain an explicit compatibility boundary rather than being described as per-engine dependency injection.

Independent contract review also exposed malformed Adventure attributes that could spend character points and write `NaN`; complete attribute/preference validation rejects those definitions before replacement. Reviewed declaration ports now describe stripped registry tables, nullable captured profiles, actual predecessor return values, and persisted personal actor fields. Activity settings use one saved preference object and the existing duel-cancellation and timed quest-recall authorities. Registered settings regressions cover independent flags, paused updates, state-pure no-ops, malformed input/imports, persistence, locks, and preserved provisions/finds.

The pinned Node declaration package is `@types/node` 22.20.5, compatible with TypeScript 5.9. The strict gate now checks dependency and authored declaration files with `skipLibCheck: false`; the previous three third-party Buffer declaration errors are resolved without suppression. The dependency audit remains clear.

## Expansion review findings

The expansion adds world/scene and creature editors, third-party editor exchange, storyboard/timeline playback, p5 animation, complete engine source export and centralized balancing. Review findings have focused regressions: timestamped cues fire at their boundary; equal-time cue tails survive cancelled admission; journey ledgers and scene cameras persist without leaking between stories; active duels and paid work reject conflicting balance changes; scene-specific balance edits preserve other native owners; complete source exports initialize safely from a cold CLI; and large CLI warning documents flush fully under pipe backpressure. Presentation admission rejects unavailable renderers before installing native state. Actual browser checks exercise Three.js, PixiJS, Excalibur and p5 under the unchanged offline CSP.

Balancing defaults are validated before publishing a rebuilt artifact, including every shipped effective pack and an audit of declared settings against their consumers. An isolated build proof changes canonical JSON and an asset-folder creature, verifies actual Node/browser effects, then confirms malformed defaults preserve the previous artifact.

## Verification

Final integrated and independent-review results are recorded in `VERIFICATION.md` and `delivery-manifest.json`. The authoritative machine evidence is the fresh `verification/v15/gate-results.json`, with authored source digest, runtime/browser identity, suite results and standalone hash. `--no-browser` produces explicitly partial evidence.

After integrating current main at `e3d184d`, native Python tooling tests completed **292 tests**, with one expected Windows Job Object skip on Linux. The native architecture scan covered **447 scripts** with zero violations. A clean native archive uses the pinned Godot 4.7.2 toolchain; the full registered six-shard checkpoint is recorded separately on completion. Littlewild has a `.gdignore` boundary because its npm packages and browser assets are not native Godot resources.

## Limits retained honestly

The merged-main native advisory scan covered **667 files** and reported **zero findings** across all five analyzers. Earlier native findings are historical evidence, not a description of the current main checkout. No warning suppression or advisory-policy weakening was introduced. Workflow runtime warnings are addressed with supported, immutable official actions. The dependency audit reports zero vulnerabilities.

Headless Chromium does not establish hardware WebGL performance, physical touch-device behavior, Safari/Firefox compatibility, screen-reader conformance, localization, human comprehension or game balance. Those require their own validation. Historical milestone hash/verification documents are identified as historical records, not current-source evidence.
