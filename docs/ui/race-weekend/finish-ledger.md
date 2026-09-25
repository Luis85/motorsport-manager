# Race Weekend finishing ledger

## Reconciled starting reference

- PR #12 remains open/unmerged on `feat/race-weekend-ui-overhaul` at `d5832348b750554e50487bc6e8bf8fe43e721689`.
- Live tree `34b9b2993e4776cc3c12c7bb63c71f7fcfb3e808`; handoff source independently reproduced that exact tree. No intervening changes, comments or reviews were returned.
- Direct Git transport is unavailable in the session. The exact source and exact shallow commit object were restored from the verified handoff and live Git metadata; no other working copy was replaced.
- Pinned engine retrieved from successful run 36172477187 artifact 10882090219: `4.7.2.stable.official.ed1daf0bf`. Hosted baseline #262 is **successful**, not pending.
- Fresh full baseline verification started with `LP_NUM_THREADS=2` and the repository runner's isolated user data. Clean import and 102 production script loads passed; full run in progress.

## Evidence dimensions

Implemented, native regression, visual review and platform/manual acceptance are separate. Synthetic boundary fixtures are labeled; physical fixed-step evolution does not manufacture telemetry or results.

| Gap | Work | Implementation | Native regression | Visual | Platform/manual |
|---|---|---|---|---|---|
| G01 Non-pit decision terminal states | WP01 | Implemented: correlated UI receipts, terminal labels and submit guard | 47-check finishing suite plus 68 completion / 89 repair checks pass | Six native receipts/boundaries captured; visual matrix still pending | Windows / real controller not available |
| G02 Driver identity and intent hierarchy | WP03 | Open / verify existing | Pending | Pending where applicable | Windows / real controller not available |
| G03 Queue cardinality and severity | WP03 | Open / verify existing | Pending | Pending where applicable | Windows / real controller not available |
| G04 Qualifying release context | WP04 | Open / verify existing | Pending | Pending where applicable | Windows / real controller not available |
| G05 Populated practice readability | WP05 | Open / verify existing | Pending | Pending where applicable | Windows / real controller not available |
| G06 Strategy timeline usability | WP06 | Open / verify existing | Pending | Pending where applicable | Windows / real controller not available |
| G07 Weather information hierarchy | WP07 | Open / verify existing | Pending | Pending where applicable | Windows / real controller not available |
| G08 Chart semantics and inspection | WP08 | Implemented: timestamp domains, keyboard/pointer cursor, range selection and padded range | Native keyboard, irregular/missing/zero/flat/cleared-series checks pass | Populated multi-profile matrix pending | Windows / real controller not available |
| G09 Missing-sample preservation | WP08 | Implemented: null gaps preserve time/category alignment | Red baseline reproduced; green positional/category checks pass | Explicit N/A case capture; final framing pending | Windows / real controller not available |
| G10 Tyres and setup task clarity | WP09 | Open / verify existing | Pending | Pending where applicable | Windows / real controller not available |
| G11 Pit-service execution view | WP10 | Open / verify existing | Pending | Pending where applicable | Windows / real controller not available |
| G12 Shared team intent timeline | WP10 | Open / verify existing | Pending | Pending where applicable | Windows / real controller not available |
| G13 Radio and feedback at load | WP11 | Open / verify existing | Pending | Pending where applicable | Windows / real controller not available |
| G14 Result lap/stint chart completeness | WP12 | Open / verify existing | Pending | Pending where applicable | Windows / real controller not available |
| G15 First-use and phase-transition coverage | WP13 | Open / verify existing | Pending | Pending where applicable | Windows / real controller not available |
| G16 Complete responsive and input matrix | WP14 | Open / verify existing | Pending | Pending where applicable | Windows / real controller not available |
| G17 Release-platform and long-session performance | WP15 | Open / verify existing | Pending | Pending where applicable | Windows / real controller not available |
| G18 Screen-wide visual acceptance | WP02 | Open / verify existing | Pending | Pending where applicable | Windows / real controller not available |

## WP00 / WP01 test-first work

`tests/ui_finish_tests.gd` begins with reproductions for fuel handback, release completion, supersession, cancellation, unrelated pit counts, retirement, duplicate native Enter activation, reopened receipts and missing middle/category samples. It targets the existing production scene and command boundary. Tests are added before production changes.

## Preserved boundaries

No production domain/service, save-schema, RNG, sporting, tyre, pit-routing or balance changes are authorized. No new global snapshot, command scheduler, duplicated setup/practice draft or write-enabled publication workflow.

## Environment-only acceptance

Physical controller hardware, Windows screen-reader behavior, Windows DPI/export launch, broad hardware profiling and human usability are not established by Linux Xvfb or synthetic native events. They remain explicit manual gates, not implementation failures or universal certification.

## Increment 1: WP01 and chart correctness foundation

Baseline red suite: **25 checks, 11 expected assertion failures, 4 native captures**. Seven failures establish the non-pit/incorrect-pit terminal defects; four establish missing-sample/category compression. No parser/runtime failures were accepted. Repeated native Enter did **not** reproduce a duplicate in the composed baseline path; it remains a passing regression, supplemented by a submit-stage/late-callback guard.

Green increment: fresh import and **47 finishing + 68 completion + 89 repair = 204 native checks**, with log scanning, Linux Xvfb / Mesa llvmpipe / Dummy audio / pinned 4.7.2 / LP_NUM_THREADS=2. New receipts match journal command IDs, override IDs/expiry, qualifying run numbers and order→entry→exit records. Qualifying completion can truthfully report an invalid lap. Missing journal identity is unavailable, not a successful outcome. Reopening retains the accepted receipt; a new review is explicit.

The full runner retains all prior suites and now includes `ui_finish_tests.gd`. Baseline full-run completion, broader populated screenshots, native pointer coverage and final-head hosted CI are distinct later gates. Evidence is retained in the delivered verification bundle; do not equate this targeted increment with final acceptance of G01–G18.


## Continuation: observation and analytical evidence

Recovered the last published head `d1a654d763659556ee219c5a639804e7f8ea6104`, tree `df174f6d71a71c6a7d209bad0d31376bda130201`, from hosted verification #264 / 36179960438. The run succeeded. The PR remained open and no comments/reviews were returned. The recovered artifact tree equals the remote Git tree; the handoff fallback was not overlaid onto it. Unpublished work from the interrupted container was not assumed to exist.

- **WP03 / G02–G03:** Full actual driver identity, responsive status placement, visible queue severity and per-driver cardinality, and a stable issue selector that makes each pending action reviewable. Selecting an issue is observation; it does not re-authorize a historical receipt.
- **WP04 / G04:** Required time and latest feasible qualifying release are visible rather than hover-only. The circuit continues to provide spatial traffic context; no release guarantees a clear lap.
- **WP06 / G06:** Optional strategy timeline gains a distance ruler, typed compound strips, current-distance cursor and native stop/option inspection. It displays existing candidate plans only.
- **WP08 / G08–G09:** Exact timestamp-aligned own-driver telemetry comparison, distinct solid/circle versus dashed/square traces, retained-sample counts and missing values. A new native pixel regression reproduced disappearing isolated points beside gaps; finite points now remain visible without bridging a gap.
- **WP09 / G10:** Fitted-to-draft deltas for the same five setup axes, shared edited-state safeguards, setup-only exit warning, and explicit limiting punctures on finite tyre readouts. No mechanical change occurs on editing.
- **WP12 / G14:** Actual lap/run coordinates, narrow padded measured ranges, unavailable laps retained, invalid/pit annotations and compatible teammate comparison. A reproducing fixture found that practice crossing timestamps were being treated as lap durations; the copied presentation record now uses recorded `seconds` while preserving the crossing timestamp separately. No practice record is mutated.

The new `ui_finish_observation_tests.gd` and `ui_finish_analysis_tests.gd` are registered in the full runner alongside every retained suite. Boundary fixtures are explicitly synthetic; populated physical-session and full visual-matrix acceptance remain separate work. Native red evidence: six observation assertions; nine initial analysis assertions; isolated-point pixel assertion; practice duration assertion. Harness mistakes are retained as diagnostics, not counted as product-defect reproductions.

**Platform evidence remains separate:** Linux/Xvfb/Mesa llvmpipe native events do not certify Windows, physical controllers, screen readers or broad hardware performance. Final work-package closure will be recorded against actual completed evidence, not this implementation list.
