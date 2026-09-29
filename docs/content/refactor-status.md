# Data-driven refactor: implementation status

This review continuation is tracked directly on PR #24. The package table is
updated with each published increment; focused evidence does not replace the
complete final-source release gate.

| Work package | Delivered foundation | Remaining gate |
|---|---|---|
| DD-00 Inventory | Per-family content guides and explicit runtime contracts | Exhaustive literal/consumer coverage inventory and classifications |
| DD-01 Content boundary | Strict bounded packs, schemas, provenance, typed vehicles and external discovery | Retain regression gates as families expand |
| DD-02 Field | Separate teams/drivers/rosters, stable ownership, fourteen-car example | Existing targeted tests retained |
| DD-03 Tyres/setup | Arbitrary compounds, allocations, thermal/setup profiles; eleven authored wheel operating coefficients and documented invariant/safety classification | Complete-source sporting and performance acceptance |
| DD-04 Mechanics/weekends | Shared fuel, service, environment, operations, competition/rival tuning; authored registered-provider profiles frozen into weekends/replay | Exhaustive remaining consumer audit; new stateful provider implementations still require versioned code readers |
| DD-05 Editor/content | Shared circuit catalog, original track files, external styles, ordinary editor transactions, complete-weekend scenario briefs, six bounded file-backed diagnostic collections with gallery metadata, and bounded editor placement/guide profiles | Retain editor/content interaction regressions as authoring profiles evolve |
| DD-06 Continuation | Frozen supported definitions, circuit/style snapshots and scenario context; exact persisted number decoding | Extend the same contract to any subsequently migrated families |
| DD-07 Authoring | All authoring operations; ordered multi-pack selection, cross-pack cloning, side-specific diff dependencies, safe failed-write cleanup and explicit version incompatibility diagnostics | Real converters when an actual subsequent format is defined; none is fabricated for hypothetical versions |
| DD-08 Acceptance | Registered domain/native tests and Linux debug/release exported-runtime acceptance | Complete final-source six-shard regression, performance comparison, and remote CI |

## Scope of this continuation

The saved-number fix does not change hashes or round physics. Circuit authoring
uses the existing TrackDocument schema and transaction owner. Scenario selection
stages an existing weekend rather than introducing a second scenario simulator.
A bounded CLI segment explicitly distinguishes successful execution from a whole
weekend or balance test. See the linked family guides for commands and limits.

Built-in and old direct APIs remain compatible. Do not replace retained sporting
expected values to make a refactor pass. New tests are registered alongside the
existing monotonic suite floor, not substituted for it.

## Publication

A local source/patch handover is not evidence that GitHub was updated. Check the
actual PR head before publishing, and do not force-push over concurrent work.
This increment must remain a draft until its remaining work and complete-source
release gates are satisfied. No merge is authorized by this document.

## Review and hardening changes

The authoring bridge validates engine-result type/status, distinguishes authored
text from engine diagnostics, and rejects non-finite protocol numbers. Resolved
diffs distinguish booleans from numbers. New-file writes pre-serialize, exclusively
create, flush and synchronize; failures clean up only the file they created.
Schema check-only no longer creates output directories. The decimal regression
corpus uses `decimal_literal` instead of a misleading credential-like field name;
all 544 numerical inputs and expected bit patterns are unchanged. No secret-scan
ignore or history rewrite is introduced. A historical scanner incident must be
triaged in the scanner, not silently declared resolved by a source edit.

The content workflow also runs the Python authoring tests with its real pinned
engine and retains source/tree identity independently of later test success.
Focused local results are not a substitute for the final six-shard aggregate.
The PR comment/check runs record exact final-source evidence after execution.

Known scope is deliberately still visible: the exhaustive repository-wide
literal/consumer inventory is not implemented by this review increment. Editor
placement presets and contextual guide copy now use an authoring-only profile;
code retains every target/reveal action and the renderer type allow-list. The
developer diagnostic collections remain bundled verification resources with their
own validated presentation metadata, rather than a new executable external-pack format. The completed-wheel classification is not represented
as an audit of every other subsystem. Windows runtime execution and human
playtesting are separate acceptance gates.

New source/test files remain within the code-line budgets. Existing oversized
files remain visible (including RaceSim, which receives frozen-profile plumbing);
no blanket quality exclusions or adjusted sporting checkpoints are added.
