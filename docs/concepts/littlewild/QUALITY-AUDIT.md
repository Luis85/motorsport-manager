# PR 25 code and test quality audit

This work starts from PR #25 commit `78ca533a3be2722de09c8efccba83e3838aa8b9b`. Littlewild remains an isolated browser concept under `docs/concepts/littlewild/`. Native Motorsport Manager gameplay is unchanged. Shared workflow action versions are updated to supported, immutable official releases.

## Inventory and completion boundary

GitHub reported no open repository issues and no unresolved PR #25 review threads at the start of this pass. The existing Littlewild M1–M6 implementation remains in place. Green historical workflows do not replace verification of this implementation.

The current source audit covers simulation transactions, component/task validation, deterministic continuation, library/catalog imports, composition lifecycle, navigation, persistence, command-line tools, architecture enforcement, source/module budgets, release output, and both browser workflows. Each new correctness fix has a focused regression in the registered gate.

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

## Refactoring and typing

Focused modules preserve one authoritative engine and the existing facade/record contracts. Extractions retain task order, receiver/predecessor behavior, persisted fields, random draws and presentation timing. The machine-readable ownership map registers every runtime module. New services and infrastructure use explicit strict TypeScript ports.

The strict-typing debt ratchet still makes any compatibility module without complete semantic typing visible. Removing a size exception is not evidence that a module is fully typed. Process-global content registries remain an explicit compatibility boundary rather than being described as per-engine dependency injection.

## Verification

Final integrated and independent-review results are recorded in `VERIFICATION.md` and `delivery-manifest.json`. The authoritative machine evidence is the fresh `verification/v15/gate-results.json`, with authored source digest, runtime/browser identity, suite results and standalone hash. `--no-browser` produces explicitly partial evidence.

Repository tooling regression tests passed **106/106** using the pinned Godot toolchain, and native architecture scanning passed for **190 scripts**. These checks complement the native CI workflows; they are not a claim that the full local six-shard native gate was executed.

## Limits retained honestly

The native Motorsport Manager advisory report contains thousands of existing findings outside Littlewild. They remain visible; no baseline exclusion, warning suppression or advisory-policy change is introduced. Workflow runtime warnings are addressed by upgrading official actions, while native gameplay changes remain outside this audit.

Headless Chromium does not establish hardware WebGL performance, physical touch-device behavior, Safari/Firefox compatibility, screen-reader conformance, localization, human comprehension or game balance. Those require their own validation. Historical milestone hash/verification documents are identified as historical records, not current-source evidence.
